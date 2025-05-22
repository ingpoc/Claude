import { z } from 'zod';
// Removed McpServer import as we don't call server.tool directly
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionManager } from '../SessionManager'; // Keep for now if handlers use it, though projectId source will change

// Import the knowledge graph service
import {
  knowledgeGraphService,
  type Entity,
  type Relationship,
  type Observation,
  type CreateEntityRequest,
  type CreateRelationshipRequest
} from "../../services";

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
  observations: z.string().optional().describe("Optional single string containing initial observations about this entity. Separate multiple observations with newlines (\\n)."),
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
    // Parse the observations string into an array if provided
    const observationsArray: string[] = args.observations 
        ? args.observations.split('\n').map(s => s.trim()).filter(s => s.length > 0) 
        : [];

    // Project ID now comes from args
    const entity = await knowledgeGraphService.createEntity(args.project_id, {
      name: args.name,
      type: args.type,
      description: args.description,
      observationsText: observationsArray,
      parentId: args.parentId
    });

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
    const rel = await knowledgeGraphService.createRelationship(args.project_id, {
      fromEntityId: args.source_id,
      toEntityId: args.target_id,
      type: args.type,
      description: args.description
    });

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
    const result = await knowledgeGraphService.addObservation(
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
    const entity = await knowledgeGraphService.getEntity(args.project_id, args.entity_id);
    
    if (!entity) {
      return {
        content: [{ type: "text" as const, text: "Error: Entity not found." }],
        isError: true
      };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(entity) }] };
  } catch (error) {
    console.error("Error in getEntityHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error retrieving entity: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const listEntitiesHandler = async (args: ToolArgs<typeof listEntitiesSchemaDef>) => {
  try {
    let entities = await knowledgeGraphService.getAllEntities(args.project_id, args.type);
    
    if (args.type) {
      entities = entities.filter(entity => entity.type === args.type);
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
    const relatedEntities = await knowledgeGraphService.getRelatedEntities(
      args.project_id,
      args.entity_id,
      args.relationship_type,
      args.direction
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
    // Create filter object
    const filter: { fromId?: string, toId?: string, type?: string } = {};

    if (args.direction === 'outgoing') {
      filter.fromId = args.entity_id;
    } else if (args.direction === 'incoming') {
      filter.toId = args.entity_id;
    } else {
      // For 'both', we need to get relationships where the entity is either source or target
      const allRelationships = await knowledgeGraphService.getRelationships(args.project_id, filter);
      let relationships = allRelationships.filter(rel => 
        rel.from === args.entity_id || rel.to === args.entity_id
      );
      
      if (args.relationship_type) {
        relationships = relationships.filter(rel => rel.type === args.relationship_type);
      }
      
      return { content: [{ type: "text" as const, text: JSON.stringify(relationships) }] };
    }

    if (args.relationship_type) {
      filter.type = args.relationship_type;
    }

    let relationships = await knowledgeGraphService.getRelationships(args.project_id, filter);

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
    const success = await knowledgeGraphService.updateEntity(
      args.project_id,
      args.entity_id,
      { description: args.description }
    );

    if (!success) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to update entity description." }],
        isError: true
      };
    }

    return { content: [{ type: "text" as const, text: "Entity description updated successfully." }] };
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
    const success = await knowledgeGraphService.deleteEntity(args.project_id, args.entity_id);

    if (!success) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to delete entity." }],
        isError: true
      };
    }

    return { content: [{ type: "text" as const, text: "Entity deleted successfully." }] };
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
    const success = await knowledgeGraphService.deleteRelationship(args.project_id, args.relationship_id);

    if (!success) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to delete relationship." }],
        isError: true
      };
    }

    return { content: [{ type: "text" as const, text: "Relationship deleted successfully." }] };
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
    const success = await knowledgeGraphService.deleteObservation(args.project_id, args.entity_id, args.observation_id);

    if (!success) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to delete observation." }],
        isError: true
      };
    }

    return { content: [{ type: "text" as const, text: "Observation deleted successfully." }] };
  } catch (error) {
    console.error("Error in deleteObservationHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error deleting observation: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

// --- Export Tool Information ---

// This function now returns an array of Tools instead of registering them
export function getKnowledgeGraphToolInfo(_sessionManager: SessionManager) {
  const tools: Tool[] = [
    {
      name: "create_entity",
      description: "Registers a new entity (like a file, function, concept) in the knowledge graph for the active project.",
      inputSchema: {
        type: "object",
        properties: createEntitySchemaDef,
        required: ["project_id", "name", "type", "description"]
      }
    },
    {
      name: "create_relationship",
      description: "Defines a relationship between two existing entities within the active project.",
      inputSchema: {
        type: "object",
        properties: createRelationshipSchemaDef,
        required: ["project_id", "source_id", "target_id", "type"]
      }
    },
    {
      name: "add_observation",
      description: "Adds a specific textual observation to an existing entity within the active project.",
      inputSchema: {
        type: "object",
        properties: addObservationSchemaDef,
        required: ["project_id", "entity_id", "observation"]
      }
    },
    {
      name: "get_entity",
      description: "Retrieves details for a specific entity within the active project.",
      inputSchema: {
        type: "object",
        properties: getEntitySchemaDef,
        required: ["project_id", "entity_id"]
      }
    },
    {
      name: "list_entities",
      description: "Lists entities within the active project, optionally filtered by type.",
      inputSchema: {
        type: "object",
        properties: listEntitiesSchemaDef,
        required: ["project_id"]
      }
    },
    {
      name: "get_related_entities",
      description: "Finds entities related to a specific entity within the active project, optionally filtering by relationship type and direction.",
      inputSchema: {
        type: "object",
        properties: getRelatedEntitiesSchemaDef,
        required: ["project_id", "entity_id"]
      }
    },
    {
      name: "get_relationships",
      description: "Retrieves relationships connected to a specific entity within the active project, optionally filtering by type and direction.",
      inputSchema: {
        type: "object",
        properties: getRelationshipsSchemaDef,
        required: ["project_id", "entity_id"]
      }
    },
    {
      name: "update_entity_description",
      description: "Updates the description of a specific entity within the active project.",
      inputSchema: {
        type: "object",
        properties: updateEntityDescriptionSchemaDef,
        required: ["project_id", "entity_id", "description"]
      }
    },
    {
      name: "delete_entity",
      description: "Deletes a specific entity and its associated observations and relationships within the active project.",
      inputSchema: {
        type: "object",
        properties: deleteEntitySchemaDef,
        required: ["project_id", "entity_id"]
      }
    },
    {
      name: "delete_relationship",
      description: "Deletes a specific relationship between entities within a project.",
      inputSchema: {
        type: "object",
        properties: deleteRelationshipSchemaDef,
        required: ["project_id", "relationship_id"]
      }
    },
    {
      name: "delete_observation",
      description: "Deletes a specific observation associated with an entity within the active project.",
      inputSchema: {
        type: "object",
        properties: deleteObservationSchemaDef,
        required: ["project_id", "entity_id", "observation_id"]
      }
    }
  ];

  // Return tool information with handlers
  return {
    tools,
    handlers: {
      "create_entity": createEntityHandler,
      "create_relationship": createRelationshipHandler,
      "add_observation": addObservationHandler,
      "get_entity": getEntityHandler,
      "list_entities": listEntitiesHandler,
      "get_related_entities": getRelatedEntitiesHandler,
      "get_relationships": getRelationshipsHandler,
      "update_entity_description": updateEntityDescriptionHandler,
      "delete_entity": deleteEntityHandler,
      "delete_relationship": deleteRelationshipHandler,
      "delete_observation": deleteObservationHandler
    }
  };
}

// Removed the old registerKnowledgeGraphTools function 