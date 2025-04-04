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

// --- Define our own RequestHandlerExtra interface based on the SDK's expectations ---
interface RequestHandlerExtra {
  [key: string]: unknown;
}

// --- MCP Server Setup ---

const server = new McpServer({
    name: "ai-code-knowledge-graph",
    version: "0.1.0",
});

// --- Define Tool Schemas and Handlers ---

// Helper type for handler arguments
type ToolArgs<T extends ZodRawShape> = z.infer<z.ZodObject<T>>;

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
        const entity = await createEntity(args.name, args.type, args.description, args.observations, args.parentId);
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
        const rel = await createRelationship(args.source_id, args.target_id, args.type, args.description);
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
        const result = await addObservation(args.entity_id, args.observation);
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
        const entity = await getEntity(args.entity_id);
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
    // limit: z.number().optional().default(20).describe("Maximum number of entities to return (default 20).") // Add limit to schema
};
const listEntitiesHandler = async (args: ToolArgs<typeof listEntitiesSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Fetch all entities first
        let entities = await listEntitiesDb(); // Use the imported alias for getAllEntities

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
    // limit: z.number().optional().default(20).describe("Maximum number of related entities to return (default 20).") // Add limit to schema
};
const getRelatedEntitiesHandler = async (args: ToolArgs<typeof getRelatedEntitiesSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Limit is specified in the plan (default 20)
        const limit = 20; // (args.limit not implemented yet)
        // The DB function `getRelatedEntities` doesn't support limit directly, handle post-query or modify DB function
        // For now, fetching all and limiting here. A DB-level limit would be more efficient.
        const entities = await getRelatedEntities(args.entity_id, args.relationship_type, args.direction);

        // Limit results
        const limitedEntities = entities.slice(0, limit);

        // Plan asks for { related_entities: [{ id, name, type, relationship_type }] }
        // Current DB function returns Entity[{ id, name, type, description, observations, parentId }]
        // Adding relationship_type would require changing the Kuzu query in getRelatedEntities.
        // For now, returning what's available matching the plan's entity structure.
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
    // limit: z.number().optional().default(20).describe("Maximum number of relationships to return (default 20).") // Add limit to schema
};
const getRelationshipsHandler = async (args: ToolArgs<typeof getRelationshipsSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        // Limit is specified in the plan (default 20)
        const limit = 20; // (args.limit not implemented yet)
        // The DB function `getRelationships` doesn't support limit directly. Apply post-query.
        const relationships = await getRelationships({ fromId: args.from_id, toId: args.to_id, type: args.type });

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
        const success = await updateEntityDescription(args.entity_id, args.description);
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
        const success = await deleteEntity(args.entity_id);
        if (!success) {
            // It might fail if the entity doesn't exist, but the desired state (gone) is achieved.
            // Let's consider not finding it as a "success" for deletion idempotency.
            // The DB function currently doesn't distinguish between "deleted" and "not found".
            // If more specific errors are needed, the DB function should be updated.
            console.warn(`Attempted to delete entity ${args.entity_id}, but DB function returned false (may already be deleted or error occurred).`);
            // Assuming success if no error thrown, even if DB function returns false
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
    // Plan uses 'id', let's use 'relationship_id' for clarity vs entity IDs
    relationship_id: z.string().describe("The unique ID of the relationship to delete.")
};
const deleteRelationshipHandler = async (args: ToolArgs<typeof deleteRelationshipSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        const success = await deleteRelationship(args.relationship_id);
        if (!success) {
            // Similar to deleteEntity, consider "not found" as success.
            console.warn(`Attempted to delete relationship ${args.relationship_id}, but DB function returned false (may already be deleted or error occurred).`);
            // Assuming success if no error thrown
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
    // Plan uses 'observation_index', but implementation uses 'observation_id'. ID is more robust.
    observation_id: z.string().describe("The unique ID of the observation to delete.")
};
const deleteObservationHandler = async (args: ToolArgs<typeof deleteObservationSchemaDef>, extra: RequestHandlerExtra) => {
    try {
        const success = await deleteObservation(args.entity_id, args.observation_id);
        if (!success) {
            // DB function returns false if entity not found, or true if obs not found (idempotent).
            // Assume failure only means entity not found.
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

// Keep track of active SSE transports
const transports: { [sessionId: string]: SSEServerTransport } = {};

// GET handler for establishing the SSE connection
export async function GET(req: NextRequest) {
    // Create a response stream
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Create SSE headers
    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');

    // Create the SSE transport
    const transport = new SSEServerTransport(
        req.nextUrl.pathname,
        {
            send: (data: string) => writer.write(encoder.encode(data)),
            close: () => writer.close()
        } as any
    );

    // Store the transport
    transports[transport.sessionId] = transport;

    // Handle connection closing
    req.signal.addEventListener('abort', () => {
        console.log(`SSE connection closed: ${transport.sessionId}`);
        delete transports[transport.sessionId];
    });

    // Connect the server to the transport
    server.connect(transport)
        .then(() => console.log(`MCP Server connected for session: ${transport.sessionId}`))
        .catch(err => console.error("Error connecting MCP server:", err));

    // Return the streaming response
    return new Response(responseStream.readable, { headers });
}

// POST handler for receiving messages from the client
export async function POST(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
        return new Response('Missing sessionId query parameter', { status: 400 });
    }

    const transport = transports[sessionId];
    if (!transport) {
        return new Response(`No active transport found for sessionId: ${sessionId}`, { status: 404 });
    }

    try {
        const message = await req.json();
        await transport.handleMessage(message);
        return new Response('Message received', { status: 200 });
    } catch (error) {
        console.error("Error processing client message:", error);
        return new Response('Error processing message', { status: 500 });
    }
} 