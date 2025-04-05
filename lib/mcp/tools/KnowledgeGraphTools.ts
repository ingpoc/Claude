import { z } from 'zod';
// Removed McpServer import as we don't call server.tool directly
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionManager } from '../SessionManager'; // Keep for now if handlers use it, though projectId source will change

// Import the knowledge graph backend (assuming these work with projectId directly)
import {
  createEntity as createEntityDb, // Renamed to avoid conflict
  createRelationship as createRelationshipDb, // Renamed
  addObservation as addObservationDb, // Renamed
  deleteEntity as deleteEntityDb, // Renamed
  deleteRelationship as deleteRelationshipDb, // Renamed
  deleteObservation as deleteObservationDb, // Renamed
  getEntity as getEntityDb, // Renamed
  getRelationships as getRelationshipsDb, // Renamed
  getRelatedEntities as getRelatedEntitiesDb, // Renamed
  updateEntityDescription as updateEntityDescriptionDb, // Renamed
  getAllEntities as listEntitiesDb,
  type Entity,
  type Relationship, // Assuming this type exists
  type Observation // Assuming this type exists
} from "../../knowledgeGraph";

// Import Tool type from SDK
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Helper type for handler arguments
type ToolArgs<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

// Extra data provided to handlers
interface RequestHandlerExtra {
  [key: string]: unknown;
  sessionId?: string;
}

// --- Define Tool Schemas (Adding project_id where needed) ---

// 1. create_entity
const createEntitySchemaDef = {
  project_id: z.string().describe("The ID of the project context for this operation."),
  name: z.string().describe("The primary name or identifier of the entity (e.g., 'src/components/Button.tsx', 'calculateTotal', 'UserAuthenticationFeature')."),
  type: z.string().describe("The classification of the entity (e.g., 'file', 'function', 'class', 'variable', 'module', 'concept', 'feature', 'requirement')."),
  description: z.string().describe("A brief description of the entity's purpose or role."),
  observations: z.array(z.string()).optional().describe("Optional list of initial observation texts about this entity."),
  parentId: z.string().optional().describe("Optional ID of the parent entity.")
};

// 2. create_relationship
const createRelationshipSchemaDef = {
  project_id: z.string().describe("The ID of the project context for this operation."),
  source_id: z.string().describe("The unique ID of the source entity."),
  target_id: z.string().describe("The unique ID of the target entity."),
  type: z.string().describe("The type of relationship (e.g., 'calls', 'contains', 'implements', 'related_to')."),
  description: z.string().optional().describe("An optional description for the relationship.")
};

// 3. add_observation
const addObservationSchemaDef = {
  project_id: z.string().describe("The ID of the project context for this operation."),
  entity_id: z.string().describe("The unique ID of the entity to add the observation to."),
  observation: z.string().describe("The textual observation to add.")
};

// 4. get_entity
const getEntitySchemaDef = {
  project_id: z.string().describe("The ID of the project context for this operation."),
  entity_id: z.string().describe("The unique ID of the entity to retrieve.")
};

// 5. list_entities
const listEntitiesSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    type: z.string().optional().describe("Optional filter to list entities only of a specific type.")
};

// 6. get_related_entities
const getRelatedEntitiesSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    entity_id: z.string().describe("The ID of the entity to find related entities for."),
    relationship_type: z.string().optional().describe("Optional filter by relationship type."),
    direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both').describe("Direction of relationships to consider ('incoming', 'outgoing', 'both'). Default is 'both'.")
};

// 7. get_relationships
const getRelationshipsSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    entity_id: z.string().describe("The ID of the entity to get relationships for."),
    relationship_type: z.string().optional().describe("Optional filter by relationship type."),
    direction: z.enum(['incoming', 'outgoing', 'both']).optional().default('both').describe("Direction of relationships to consider ('incoming', 'outgoing', 'both'). Default is 'both'.")
};

// 8. update_entity_description
const updateEntityDescriptionSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    entity_id: z.string().describe("The unique ID of the entity to update."),
    description: z.string().describe("The new description for the entity.")
};

// 9. delete_entity
const deleteEntitySchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    entity_id: z.string().describe("The unique ID of the entity to delete.")
};

// 10. delete_relationship
const deleteRelationshipSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    relationship_id: z.string().describe("The unique ID of the relationship to delete.")
};

// 11. delete_observation
const deleteObservationSchemaDef = {
    project_id: z.string().describe("The ID of the project context for this operation."),
    entity_id: z.string().describe("The ID of the entity the observation belongs to."),
    observation_id: z.string().describe("The unique ID of the observation to delete.")
};


// --- Define Tool Handlers (Using project_id from args) ---

const createEntityHandler = async (args: ToolArgs<typeof createEntitySchemaDef>) => {
  try {
    // Project ID now comes from args
    const entity = await createEntityDb(
      args.project_id,
      args.name,
      args.type,
      args.description,
      args.observations,
      args.parentId
    );

    if (!entity) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to create entity." }],
        isError: true
      };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(entity) }] };
  } catch (error) {
    console.error("Error in createEntityHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error creating entity: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const createRelationshipHandler = async (args: ToolArgs<typeof createRelationshipSchemaDef>) => {
  try {
    const rel = await createRelationshipDb(
      args.project_id,
      args.source_id,
      args.target_id,
      args.type,
      args.description
    );

    if (!rel) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to create relationship." }],
        isError: true
      };
    }
    // Assuming Relationship type has from, to, type, id
    return { content: [{ type: "text" as const, text: JSON.stringify({ id: rel.id, from_id: rel.from, to_id: rel.to, type: rel.type }) }] };
  } catch (error) {
    console.error("Error in createRelationshipHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error creating relationship: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const addObservationHandler = async (args: ToolArgs<typeof addObservationSchemaDef>) => {
  try {
    const result = await addObservationDb(
      args.project_id,
      args.entity_id,
      args.observation
    );

    if (!result || !result.observation_id) { // Check if result is valid
      return {
        content: [{ type: "text" as const, text: "Error: Failed to add observation." }],
        isError: true
      };
    }
    // Assuming result has observation_id
    return { content: [{ type: "text" as const, text: `Observation added successfully (ID: ${result.observation_id}).` }] };
  } catch (error) {
    console.error("Error in addObservationHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error adding observation: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const getEntityHandler = async (args: ToolArgs<typeof getEntitySchemaDef>) => {
    try {
      const entity = await getEntityDb(args.project_id, args.entity_id);
      if (!entity) {
        return {
          content: [{ type: "text" as const, text: `Error: Entity not found (ID: ${args.entity_id}).` }],
          isError: true
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(entity) }] };
    } catch (error) {
      console.error("Error in getEntityHandler:", error);
      return {
        content: [{ type: "text" as const, text: `Error getting entity: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
};

const listEntitiesHandler = async (args: ToolArgs<typeof listEntitiesSchemaDef>) => {
    try {
      // Call with only project_id
      let entities = await listEntitiesDb(args.project_id);

      // Filter by type if provided
      if (args.type) {
        entities = entities.filter((entity: any) => entity.type === args.type);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(entities) }] };
    } catch (error) {
      console.error("Error in listEntitiesHandler:", error);
      return {
        content: [{ type: "text" as const, text: `Error listing entities: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
};

const getRelatedEntitiesHandler = async (args: ToolArgs<typeof getRelatedEntitiesSchemaDef>) => {
    try {
      const relatedEntities = await getRelatedEntitiesDb(
        args.project_id,
        args.entity_id
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(relatedEntities) }] };
    } catch (error) {
      console.error("Error in getRelatedEntitiesHandler:", error);
      return {
        content: [{ type: "text" as const, text: `Error getting related entities: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
};

const getRelationshipsHandler = async (args: ToolArgs<typeof getRelationshipsSchemaDef>) => {
    try {
      let relationships: any[]; // Use appropriate Relationship type if available

      if (args.direction === 'both') {
        // Fetch all (or filtered by type) and filter direction manually
        const filter: { type?: string } = {};
        if (args.relationship_type) {
          filter.type = args.relationship_type;
        }
        const allRelationships = await getRelationshipsDb(args.project_id, filter);
        relationships = allRelationships.filter((rel: any) => 
            rel.source_id === args.entity_id || rel.target_id === args.entity_id
        );
      } else {
        // Fetch filtered by direction and optionally type
        const filter: { fromId?: string; toId?: string; type?: string } = {};
        if (args.direction === 'outgoing') {
          filter.fromId = args.entity_id;
        } else { // direction === 'incoming'
          filter.toId = args.entity_id;
        }
        if (args.relationship_type) {
          filter.type = args.relationship_type;
        }
        relationships = await getRelationshipsDb(args.project_id, filter);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(relationships) }] };
    } catch (error) {
      console.error("Error in getRelationshipsHandler:", error);
      return {
        content: [{ type: "text" as const, text: `Error getting relationships: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
};

const updateEntityDescriptionHandler = async (args: ToolArgs<typeof updateEntityDescriptionSchemaDef>) => {
    try {
      const success = await updateEntityDescriptionDb(
          args.project_id,
          args.entity_id,
          args.description
      );
      if (!success) {
           return {
                content: [{ type: "text" as const, text: `Error: Failed to update description for entity ${args.entity_id}.`}],
                isError: true
            };
      }
      return { content: [{ type: "text" as const, text: `Description updated successfully for entity ${args.entity_id}.` }] };
    } catch (error) {
      console.error("Error in updateEntityDescriptionHandler:", error);
      return {
        content: [{ type: "text" as const, text: `Error updating entity description: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
};

const deleteEntityHandler = async (args: ToolArgs<typeof deleteEntitySchemaDef>) => {
    try {
        const success = await deleteEntityDb(args.project_id, args.entity_id);
         if (!success) {
            return {
                content: [{ type: "text" as const, text: `Error: Failed to delete entity ${args.entity_id}.`}],
                isError: true
            };
        }
        return { content: [{ type: "text" as const, text: `Entity ${args.entity_id} deleted successfully.` }] };
    } catch (error) {
        console.error("Error in deleteEntityHandler:", error);
         return {
            content: [{ type: "text" as const, text: `Error deleting entity: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
        };
    }
};

const deleteRelationshipHandler = async (args: ToolArgs<typeof deleteRelationshipSchemaDef>) => {
    try {
        const success = await deleteRelationshipDb(args.project_id, args.relationship_id);
         if (!success) {
            return {
                content: [{ type: "text" as const, text: `Error: Failed to delete relationship ${args.relationship_id}.`}],
                isError: true
            };
        }
        return { content: [{ type: "text" as const, text: `Relationship ${args.relationship_id} deleted successfully.` }] };
    } catch (error) {
        console.error("Error in deleteRelationshipHandler:", error);
         return {
            content: [{ type: "text" as const, text: `Error deleting relationship: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
        };
    }
};

const deleteObservationHandler = async (args: ToolArgs<typeof deleteObservationSchemaDef>) => {
     try {
        const success = await deleteObservationDb(args.project_id, args.entity_id, args.observation_id);
         if (!success) {
            return {
                content: [{ type: "text" as const, text: `Error: Failed to delete observation ${args.observation_id}.`}],
                isError: true
            };
        }
        return { content: [{ type: "text" as const, text: `Observation ${args.observation_id} deleted successfully.` }] };
    } catch (error) {
        console.error("Error in deleteObservationHandler:", error);
         return {
            content: [{ type: "text" as const, text: `Error deleting observation: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
        };
    }
};


// --- Assemble Definitions and Handlers ---

// Function to export tool definitions and handlers
// Note: sessionManager is passed but not used currently, as project_id comes from args
export function getKnowledgeGraphToolInfo(_sessionManager: SessionManager) {

  const definitions: Tool[] = [
    {
      name: "create_entity",
      description: "Registers a new entity (like a file, function, concept) in the knowledge graph for a specific project.",
      inputSchema: { type: "object", properties: createEntitySchemaDef, required: ["project_id", "name", "type", "description"] }
    },
    {
      name: "create_relationship",
      description: "Defines a relationship between two existing entities within a specific project.",
      inputSchema: { type: "object", properties: createRelationshipSchemaDef, required: ["project_id", "source_id", "target_id", "type"] }
    },
    {
      name: "add_observation",
      description: "Adds a specific textual observation to an existing entity within a specific project.",
      inputSchema: { type: "object", properties: addObservationSchemaDef, required: ["project_id", "entity_id", "observation"] }
    },
     {
      name: "get_entity",
      description: "Retrieves details for a specific entity within a project.",
      inputSchema: { type: "object", properties: getEntitySchemaDef, required: ["project_id", "entity_id"] }
    },
    {
      name: "list_entities",
      description: "Lists entities within a specific project, optionally filtered by type.",
      inputSchema: { type: "object", properties: listEntitiesSchemaDef, required: ["project_id"] }
    },
    {
        name: "get_related_entities",
        description: "Finds entities related to a specific entity within a project, optionally filtering by relationship type and direction.",
        inputSchema: { type: "object", properties: getRelatedEntitiesSchemaDef, required: ["project_id", "entity_id"] }
    },
    {
        name: "get_relationships",
        description: "Retrieves relationships connected to a specific entity within a project, optionally filtering by type and direction.",
        inputSchema: { type: "object", properties: getRelationshipsSchemaDef, required: ["project_id", "entity_id"] }
    },
    {
        name: "update_entity_description",
        description: "Updates the description of a specific entity within a project.",
        inputSchema: { type: "object", properties: updateEntityDescriptionSchemaDef, required: ["project_id", "entity_id", "description"] }
    },
    {
        name: "delete_entity",
        description: "Deletes a specific entity and its associated observations and relationships within a project.",
        inputSchema: { type: "object", properties: deleteEntitySchemaDef, required: ["project_id", "entity_id"] }
    },
    {
        name: "delete_relationship",
        description: "Deletes a specific relationship between entities within a project.",
        inputSchema: { type: "object", properties: deleteRelationshipSchemaDef, required: ["project_id", "relationship_id"] }
    },
    {
        name: "delete_observation",
        description: "Deletes a specific observation associated with an entity within a project.",
        inputSchema: { type: "object", properties: deleteObservationSchemaDef, required: ["project_id", "entity_id", "observation_id"] }
    }
  ];

  const handlers = {
    create_entity: createEntityHandler,
    create_relationship: createRelationshipHandler,
    add_observation: addObservationHandler,
    get_entity: getEntityHandler,
    list_entities: listEntitiesHandler,
    get_related_entities: getRelatedEntitiesHandler,
    get_relationships: getRelationshipsHandler,
    update_entity_description: updateEntityDescriptionHandler,
    delete_entity: deleteEntityHandler,
    delete_relationship: deleteRelationshipHandler,
    delete_observation: deleteObservationHandler,
  };

  return { definitions, handlers };
}

// Removed the old registerKnowledgeGraphTools function 