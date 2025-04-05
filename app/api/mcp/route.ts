import { NextRequest } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z, type ZodRawShape } from 'zod';

// Import the backend functions
import {
    createEntity,
    createRelationship,
    addObservation,
    deleteEntity,
    deleteRelationship,
    deleteObservation,
    getEntity,
    getRelationships,
    getRelatedEntities,
    updateEntityDescription,
    getAllEntities as listEntitiesDb,
    type Entity,
    type Relationship,
    type Observation
} from "@/lib/knowledgeGraph";

// Import project manager
import {
    createProject,
    getProject,
    getProjects,
    deleteProject,
    type ProjectMetadata
} from "@/lib/projectManager";

// --- Define our own RequestHandlerExtra interface based on the SDK's expectations ---
interface RequestHandlerExtra {
  [key: string]: unknown;
  sessionId?: string;
}

// Define JSON-RPC message types
interface JSONRPCMessage {
  type: string;
  id?: string;
  [key: string]: any;
}

// Create a custom transport class that works with Next.js streams
class NextJsSSETransport {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder: TextEncoder;
  public _handlingRequest?: boolean;
  public extra?: {
    sessionId: string;
    [key: string]: unknown;
  };
  public sessionId: string;
  private isStarted: boolean = false;

  constructor(sessionId: string, writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
    this.encoder = new TextEncoder();
    this.sessionId = sessionId;
  }

  // Start the SSE connection
  async start(): Promise<void> {
    this.isStarted = true;
    return Promise.resolve();
  }

  // Send a message over SSE
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isStarted) {
      await this.start();
    }

    const data = JSON.stringify(message);
    let sseMessage = `data: ${data}\n\n`;
    
    try {
      await this.writer.write(this.encoder.encode(sseMessage));
    } catch (error) {
      console.error("Error writing to SSE stream:", error);
    }
  }

  // Send a custom event
  async sendEvent(event: string, data: string): Promise<void> {
    if (!this.isStarted) {
      await this.start();
    }

    let message = `event: ${event}\n`;
    message += `data: ${data}\n\n`;
    
    try {
      await this.writer.write(this.encoder.encode(message));
    } catch (error) {
      console.error("Error writing to SSE stream:", error);
    }
  }

  // Close the SSE connection
  async close(): Promise<void> {
    try {
      await this.writer.close();
    } catch (error) {
      console.error("Error closing SSE stream:", error);
    }
  }

  // Handle incoming messages from the client
  async handleMessage(message: JSONRPCMessage): Promise<void> {
    // This would normally be handled by SSEServerTransport
    // We need to implement our own handler that will send any responses
    if (message && message.type === 'request' && message.tool) {
      try {
        // Call the appropriate tool handler
        const toolName = message.tool;
        const args = message.args || {};
        const extra = this.extra || {};
        
        console.log(`Processing tool request: ${toolName} with args:`, args);
        
        // Find the registered tool handler
        const toolHandler = (server as any)._tools?.[toolName];
        if (!toolHandler) {
          throw new Error(`Tool not found: ${toolName}`);
        }
        
        // Call the handler
        const result = await toolHandler.handler(args, extra);
        
        // Create and send response
        const response = {
          type: 'response',
          id: message.id,
          isError: result.isError || false,
          content: result.content || []
        };
        
        console.log(`Sending response for tool: ${toolName}`);
        await this.send(response);
      } catch (error) {
        console.error("Error handling message:", error);
        // Send error response
        if (message.id) {
          const errorResponse = {
            type: 'response',
            id: message.id,
            isError: true,
            content: [{
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
          await this.send(errorResponse);
        }
      }
    }
  }
}

// --- Session management ---
interface SessionData {
  projectId?: string;
}

// Track session data
const sessionData: Record<string, SessionData> = {};

// Keep track of active SSE transports
const transports: { [sessionId: string]: NextJsSSETransport } = {};

// Helper to get the current project ID for a session
function getProjectIdForSession(sessionId?: string): string | null {
  if (!sessionId) return null;
  return sessionData[sessionId]?.projectId || null;
}

// Helper to set the current project ID for a session
function setProjectIdForSession(sessionId: string, projectId: string): void {
  if (!sessionData[sessionId]) {
    sessionData[sessionId] = {};
  }
  sessionData[sessionId].projectId = projectId;
}

// Helper to validate project ID in session
function validateProjectId(sessionId?: string): { valid: boolean; error?: string; projectId?: string } {
    const projectId = getProjectIdForSession(sessionId);
    if (!projectId) {
        return { 
            valid: false, 
            error: "No project selected. Use 'select_project' or 'create_project' first."
        };
    }
    return { valid: true, projectId };
}

// --- MCP Server Setup ---

const server = new McpServer({
    name: "ai-code-knowledge-graph",
    version: "0.1.0",
});

// --- Define Tool Schemas and Handlers ---

// Helper type for handler arguments
type ToolArgs<T extends ZodRawShape> = z.infer<z.ZodObject<T>>;

// --- Project Management Tools ---

// 1. create_project
const createProjectSchemaDef = {
    name: z.string().describe("A unique name for the project."),
    description: z.string().optional().describe("Optional description of the project."),
};
const createProjectHandler = async (args: ToolArgs<typeof createProjectSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        const project = await createProject(args.name, args.description);
        if (!project) {
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Failed to create project (name may already be in use).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Find the transport that's handling this request
        // The transport's sessionId is used as the key
        const transportSessionId = Object.keys(transports).find(sId => {
            const transportObj = transports[sId];
            return transportObj._handlingRequest === true;
        });

        // Set this as the current project for the session if we can identify it
        if (transportSessionId) {
            setProjectIdForSession(transportSessionId, project.id);
        }

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify(project),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in createProjectHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error creating project: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("create_project", "Creates a new project with a separate knowledge graph.", createProjectSchemaDef, createProjectHandler);

// 2. select_project
const selectProjectSchemaDef = {
    project_id: z.string().describe("The ID of the project to select as current."),
};
const selectProjectHandler = async (args: ToolArgs<typeof selectProjectSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Verify the project exists
        const project = await getProject(args.project_id);
        if (!project) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: Project with ID ${args.project_id} not found.`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Set as current project for this session
        if (extra.sessionId) {
            setProjectIdForSession(extra.sessionId, args.project_id);
            console.log(`Set current project to ${args.project_id} for session ${extra.sessionId}`);
        } else {
            console.warn("No sessionId in extra, cannot select project");
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Could not set current project (session issue).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        return {
            content: [{
                type: "text" as const,
                text: `Selected project: ${project.name} (${project.id})`,
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in selectProjectHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error selecting project: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("select_project", "Selects a project to work with for the current session.", selectProjectSchemaDef, selectProjectHandler);

// 3. list_projects
const listProjectsSchemaDef = {};
const listProjectsHandler = async (_args: ToolArgs<typeof listProjectsSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        const projects = await getProjects();
        const currentProjectId = getProjectIdForSession(extra.sessionId);
        
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    projects: projects.map(p => ({
                        ...p,
                        is_current: p.id === currentProjectId
                    }))
                }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in listProjectsHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("list_projects", "Lists all available projects.", listProjectsSchemaDef, listProjectsHandler);

// 4. delete_project
const deleteProjectSchemaDef = {
    project_id: z.string().describe("The ID of the project to delete."),
};
const deleteProjectHandler = async (args: ToolArgs<typeof deleteProjectSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        const success = await deleteProject(args.project_id);
        if (!success) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: Project with ID ${args.project_id} not found or could not be deleted.`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // If this was the current project for the session, unset it
        if (extra.sessionId && sessionData[extra.sessionId]?.projectId === args.project_id) {
            delete sessionData[extra.sessionId].projectId;
        }

        return {
            content: [{
                type: "text" as const,
                text: "Project successfully deleted.",
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in deleteProjectHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error deleting project: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("delete_project", "Deletes a project and its knowledge graph.", deleteProjectSchemaDef, deleteProjectHandler);

// --- Knowledge Graph Tools ---

// 1. create_entity
const createEntitySchemaDef = {
    name: z.string().describe("The primary name or identifier of the entity (e.g., 'src/components/Button.tsx', 'calculateTotal', 'UserAuthenticationFeature')."),
    type: z.string().describe("The classification of the entity (e.g., 'file', 'function', 'class', 'variable', 'module', 'concept', 'feature', 'requirement')."),
    description: z.string().describe("A brief description of the entity's purpose or role."),
    observations: z.array(z.string()).optional().describe("Optional list of initial observation texts about this entity."),
    parentId: z.string().optional().describe("Optional ID of the parent entity.")
};
const createEntityHandler = async (args: ToolArgs<typeof createEntitySchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const entity = await createEntity(
            projectValidation.projectId!, 
            args.name, 
            args.type, 
            args.description, 
            args.observations, 
            args.parentId
        );
        
        if (!entity) {
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Failed to create entity (perhaps due to invalid input or database issue).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return JSON as specified in the plan
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify(entity),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in createEntityHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error creating entity: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("create_entity", "Registers a new entity (like a file, function, concept) in the knowledge graph.", createEntitySchemaDef, createEntityHandler);

// 2. create_relationship
const createRelationshipSchemaDef = {
    source_id: z.string().describe("The unique ID of the source entity."),
    target_id: z.string().describe("The unique ID of the target entity."),
    type: z.string().describe("The type of relationship (e.g., 'calls', 'contains', 'implements', 'related_to')."),
    description: z.string().optional().describe("An optional description for the relationship.")
};
const createRelationshipHandler = async (args: ToolArgs<typeof createRelationshipSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const rel = await createRelationship(
            projectValidation.projectId!,
            args.source_id, 
            args.target_id, 
            args.type, 
            args.description
        );
        
        if (!rel) {
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Failed to create relationship (ensure source and target IDs exist).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return JSON as specified in the plan
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({ id: rel.id, from_id: rel.from, to_id: rel.to, type: rel.type }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in createRelationshipHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error creating relationship: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("create_relationship", "Defines a relationship between two existing entities.", createRelationshipSchemaDef, createRelationshipHandler);

// 3. add_observation
const addObservationSchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity to add the observation to."),
    observation: z.string().describe("The textual observation to add.")
};
const addObservationHandler = async (args: ToolArgs<typeof addObservationSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const result = await addObservation(
            projectValidation.projectId!,
            args.entity_id, 
            args.observation
        );
        
        if (!result) {
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Failed to add observation (ensure entity ID exists).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return simple text message as specified
        return {
            content: [{
                type: "text" as const,
                text: `Observation added successfully (ID: ${result.observation_id}).`,
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in addObservationHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error adding observation: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("add_observation", "Adds a specific textual observation to an existing entity.", addObservationSchemaDef, addObservationHandler);

// 4. get_entity
const getEntitySchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity to retrieve.")
};
const getEntityHandler = async (args: ToolArgs<typeof getEntitySchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const entity = await getEntity(
            projectValidation.projectId!,
            args.entity_id
        );
        
        if (!entity) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: Entity with ID ${args.entity_id} not found.`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return JSON as specified in the plan (mapping parentId to parent_id)
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({ ...entity, parent_id: entity.parentId }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in getEntityHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error getting entity: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("get_entity", "Retrieves detailed information about a specific entity, including its observations.", getEntitySchemaDef, getEntityHandler);

// 5. list_entities
const listEntitiesSchemaDef = {
    filter_type: z.string().optional().describe("Optional filter to return only entities of a specific type."),
    filter_name_contains: z.string().optional().describe("Optional filter to return entities whose name contains the given string (case-insensitive).")
};
const listEntitiesHandler = async (args: ToolArgs<typeof listEntitiesSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Fetch all entities for this project
        let entities = await listEntitiesDb(projectValidation.projectId!);

        // Apply server-side filtering
        if (args.filter_type) {
            entities = entities.filter((e: Entity) => e.type.toLowerCase() === args.filter_type?.toLowerCase());
        }
        if (args.filter_name_contains) {
            entities = entities.filter((e: Entity) => e.name.toLowerCase().includes(args.filter_name_contains?.toLowerCase() ?? ''));
        }

        // Limit results as per plan (default 20) - apply after filtering
        const limit = 20; // Default limit from plan (args.limit not implemented yet)
        const limitedEntities = entities.slice(0, limit);

        // Return JSON object containing the list, as specified in the plan
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    entities: limitedEntities.map(e => ({ id: e.id, name: e.name, type: e.type }))
                }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in listEntitiesHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error listing entities: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("list_entities", "Lists entities in the knowledge graph, optionally filtering by type or name.", listEntitiesSchemaDef, listEntitiesHandler);

// 6. get_related_entities
const getRelatedEntitiesSchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity to find relatives for."),
    relationship_type: z.string().optional().describe("Optional filter to only consider relationships of a specific type."),
    direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both').describe("Direction of relationships to consider ('incoming', 'outgoing', or 'both'). Defaults to 'both'.")
};
const getRelatedEntitiesHandler = async (args: ToolArgs<typeof getRelatedEntitiesSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Limit is specified in the plan (default 20)
        const limit = 20; // (args.limit not implemented yet)
        const entities = await getRelatedEntities(
            projectValidation.projectId!,
            args.entity_id, 
            args.relationship_type, 
            args.direction as ('incoming' | 'outgoing' | 'both')
        );

        // Limit results
        const limitedEntities = entities.slice(0, limit);

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    related_entities: limitedEntities.map(e => ({ id: e.id, name: e.name, type: e.type }))
                }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in getRelatedEntitiesHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error getting related entities: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("get_related_entities", "Finds entities directly connected to a given entity ID, optionally filtering by relationship type or direction.", getRelatedEntitiesSchemaDef, getRelatedEntitiesHandler);

// 7. get_relationships
const getRelationshipsSchemaDef = {
    from_id: z.string().optional().describe("Optional: Filter relationships originating from this entity ID."),
    to_id: z.string().optional().describe("Optional: Filter relationships targeting this entity ID."),
    type: z.string().optional().describe("Optional: Filter relationships of this specific type.")
};
const getRelationshipsHandler = async (args: ToolArgs<typeof getRelationshipsSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Limit is specified in the plan (default 20)
        const limit = 20; // (args.limit not implemented yet)
        const relationships = await getRelationships(
            projectValidation.projectId!,
            { 
                fromId: args.from_id, 
                toId: args.to_id, 
                type: args.type 
            }
        );

        const limitedRelationships = relationships.slice(0, limit);

        // Return JSON object containing the list, as specified in the plan
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    relationships: limitedRelationships.map(r => ({ id: r.id, from_id: r.from, to_id: r.to, type: r.type }))
                }),
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in getRelationshipsHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error getting relationships: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("get_relationships", "Retrieves relationships from the knowledge graph, optionally filtering by source, target, or type.", getRelationshipsSchemaDef, getRelationshipsHandler);

// 8. update_entity_description
const updateEntityDescriptionSchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity whose description should be updated."),
    description: z.string().describe("The new description text.")
};
const updateEntityDescriptionHandler = async (args: ToolArgs<typeof updateEntityDescriptionSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const success = await updateEntityDescription(
            projectValidation.projectId!,
            args.entity_id, 
            args.description
        );
        
        if (!success) {
            return {
                content: [{
                    type: "text" as const,
                    text: "Error: Failed to update entity description (entity might not exist or description unchanged).",
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return simple text message as specified
        return {
            content: [{
                type: "text" as const,
                text: "Entity description updated successfully.",
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in updateEntityDescriptionHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error updating entity description: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("update_entity_description", "Updates the main description field of an entity.", updateEntityDescriptionSchemaDef, updateEntityDescriptionHandler);

// 9. delete_entity
const deleteEntitySchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity to delete. This will also remove associated relationships.")
};
const deleteEntityHandler = async (args: ToolArgs<typeof deleteEntitySchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const success = await deleteEntity(
            projectValidation.projectId!,
            args.entity_id
        );
        
        if (!success) {
            console.warn(`Attempted to delete entity ${args.entity_id}, but DB function returned false (may already be deleted or error occurred).`);
        }

        // Return simple text message as specified
        return {
            content: [{
                type: "text" as const,
                text: "Entity and related relationships deleted.", // Assuming success or already deleted
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in deleteEntityHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error deleting entity: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("delete_entity", "Deletes an entity and all its associated relationships from the graph.", deleteEntitySchemaDef, deleteEntityHandler);

// 10. delete_relationship
const deleteRelationshipSchemaDef = {
    relationship_id: z.string().describe("The unique ID of the relationship to delete.")
};
const deleteRelationshipHandler = async (args: ToolArgs<typeof deleteRelationshipSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const success = await deleteRelationship(
            projectValidation.projectId!,
            args.relationship_id
        );
        
        if (!success) {
            console.warn(`Attempted to delete relationship ${args.relationship_id}, but DB function returned false (may already be deleted or error occurred).`);
        }

        // Return simple text message as specified
        return {
            content: [{
                type: "text" as const,
                text: "Relationship deleted.", // Assuming success or already deleted
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in deleteRelationshipHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error deleting relationship: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("delete_relationship", "Removes a specific relationship between two entities using its ID.", deleteRelationshipSchemaDef, deleteRelationshipHandler);


// 11. delete_observation
const deleteObservationSchemaDef = {
    entity_id: z.string().describe("The unique ID of the entity from which to delete the observation."),
    observation_id: z.string().describe("The unique ID of the observation to delete.")
};
const deleteObservationHandler = async (args: ToolArgs<typeof deleteObservationSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Validate project ID
        const projectValidation = validateProjectId(extra.sessionId);
        if (!projectValidation.valid) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: ${projectValidation.error}`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        const success = await deleteObservation(
            projectValidation.projectId!,
            args.entity_id, 
            args.observation_id
        );
        
        if (!success) {
            return {
                content: [{
                    type: "text" as const,
                    text: `Error: Failed to delete observation (entity ID ${args.entity_id} might not exist).`,
                    [Symbol.for("_")]: undefined
                }],
                isError: true
            };
        }

        // Return simple text message as specified
        return {
            content: [{
                type: "text" as const,
                text: "Observation deleted.", // Assuming success or observation already deleted
                [Symbol.for("_")]: undefined
            }]
        };
    } catch (error) {
        console.error("Error in deleteObservationHandler:", error);
        return {
            content: [{
                type: "text" as const,
                text: `Error deleting observation: ${error instanceof Error ? error.message : String(error)}`,
                [Symbol.for("_")]: undefined
            }],
            isError: true
        };
    }
};
server.tool("delete_observation", "Removes a specific observation from an entity using the observation's ID.", deleteObservationSchemaDef, deleteObservationHandler);


// --- Next.js Route Handlers for MCP over SSE ---

// GET handler for establishing the SSE connection
export async function GET(req: NextRequest) {
    // Get or generate session ID
    const sessionId = req.nextUrl.searchParams.get('sessionId') || `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    console.log(`SSE connection request received for session: ${sessionId}`);

    try {
        // Create a response stream
        const responseStream = new TransformStream();
        const writer = responseStream.writable.getWriter();
        const encoder = new TextEncoder();

        // Create SSE headers with CORS support
        const headers = new Headers();
        headers.set('Content-Type', 'text/event-stream');
        headers.set('Cache-Control', 'no-cache');
        headers.set('Connection', 'keep-alive');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');

        console.log(`Setting up transport for session: ${sessionId}`);

        // Create our custom NextJS-compatible SSE transport
        const transport = new NextJsSSETransport(sessionId, writer);
        
        // Add session ID to transport extra
        transport.extra = { sessionId };

        // Store the transport
        transports[sessionId] = transport;

        // Initialize session data
        sessionData[sessionId] = {};

        // Check if a project ID was provided in the request
        const projectId = req.nextUrl.searchParams.get('projectId');
        if (projectId) {
            // Try to set the project if it exists
            const project = await getProject(projectId);
            if (project) {
                setProjectIdForSession(sessionId, projectId);
                console.log(`Set initial project to ${projectId} for session ${sessionId}`);
            }
        }

        // Handle connection closing
        req.signal.addEventListener('abort', () => {
            console.log(`SSE connection closed by client: ${sessionId}`);
            delete transports[sessionId];
            delete sessionData[sessionId];
        });

        // Send a keep-alive ping immediately to ensure connection is working
        try {
            console.log(`Sending immediate ping for session: ${sessionId}`);
            await writer.write(encoder.encode(`: ping\n\n`));
            
            // Send the initial connected event
            console.log(`Sending connected event for session: ${sessionId}`);
            const connectedEvent = `event: connected\ndata: ${JSON.stringify({ session: sessionId })}\n\n`;
            await writer.write(encoder.encode(connectedEvent));
            
            console.log(`SSE connection established for session: ${sessionId}`);
        } catch (err) {
            console.error(`Error sending initial events for session ${sessionId}:`, err);
        }

        // Return the streaming response
        return new Response(responseStream.readable, { headers });
    } catch (error) {
        console.error(`Error in GET handler for session ${sessionId}:`, error);
        return new Response(`Internal server error: ${error instanceof Error ? error.message : String(error)}`, { 
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }
}

// --- Handle MCP Protocol methods directly ---
const handleMcpProtocolMethods = async (message: any) => {
  // Handle initialization request
  if (message.method === 'initialize') {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",  // Use the standard MCP protocol version
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "knowledge-graph-mcp",
          version: "0.1.0"
        }
      }
    };
  }
  
  // Handle tool listing request
  if (message.method === 'tools/list') {
    // Build tool descriptions from registered tools
    const toolDescriptions = Object.entries((server as any)._tools || {}).map(([name, tool]) => {
      const handler = tool as any;
      
      // Convert Zod schema to JSON Schema for the input schema
      let inputSchema = {};
      if (handler.parameterSchema) {
        inputSchema = {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
          $schema: "http://json-schema.org/draft-07/schema#"
        };
        
        // Add properties from Zod schema
        Object.entries(handler.parameterSchema.shape || {}).forEach(([paramName, paramSchema]: [string, any]) => {
          // Get param description from Zod description
          const description = paramSchema._def?.description || '';
          
          // Map Zod types to JSON Schema types
          let type = "string";
          if (paramSchema instanceof z.ZodNumber) type = "number";
          if (paramSchema instanceof z.ZodBoolean) type = "boolean";
          if (paramSchema instanceof z.ZodArray) type = "array";
          if (paramSchema instanceof z.ZodObject) type = "object";
          
          // Add property to schema
          (inputSchema as any).properties[paramName] = {
            type,
            description
          };
          
          // Add to required list if not optional
          if (!paramSchema.isOptional?.()) {
            (inputSchema as any).required.push(paramName);
          }
        });
      }
      
      return {
        name,
        description: handler.description || `Knowledge Graph MCP: ${name}`,
        inputSchema
      };
    });
    
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: toolDescriptions
      }
    };
  }
  
  // Handle notifications/initialized notification
  if (message.method === 'notifications/initialized') {
    // Just acknowledge, no response needed
    return null;
  }
  
  // For other MCP protocol methods, return a method not found error
  if (message.method && message.method.indexOf('/') !== -1) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    };
  }
  
  // Not a protocol method, continue with normal processing
  return false;
};

// POST handler for receiving messages from the client
export async function POST(request: NextRequest) {
  try {
    // Get JSON body
    const body = await request.json();
    const sessionId = request.nextUrl.searchParams.get('sessionId') || '';
    
    // Initialize state for this session if needed
    if (!sessionData[sessionId]) {
      sessionData[sessionId] = {};
    }
    
    // Check if this is an MCP protocol method (initialize, tools/list, etc.)
    const protocolResponse = await handleMcpProtocolMethods(body);
    if (protocolResponse) {
      // If we got a protocol response, return it
      return new Response(
        protocolResponse ? JSON.stringify(protocolResponse) : '',
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // If no transport exists for this session, create one
    if (!transports[sessionId]) {
      // This shouldn't normally happen with SSE, but just in case
      console.error(`No transport found for session ${sessionId}, creating new one.`);
      return new Response(JSON.stringify({
        type: 'error',
        content: [{ type: 'text', text: 'Session not found' }]
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Mark this transport as handling a request
    const transport = transports[sessionId];
    transport._handlingRequest = true;
    
    // Process the message
    await transport.handleMessage(body);
    
    // Reset handling flag
    transport._handlingRequest = false;
    
    // For simplicity, we don't return a response here, as the transport will handle sending responses
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error processing POST request:', error);
    return new Response(
      JSON.stringify({ 
        type: 'error', 
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS(req: NextRequest) {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
} 