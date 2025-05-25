import { z } from 'zod';
// Removed McpServer import as we don't call server.tool directly
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionManager } from '../SessionManager'; // Keep for now if handlers use it, though projectId source will change

// Import the Qdrant data service
import { qdrantDataService } from "../../services/QdrantDataService";

// Define types for compatibility
interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: Array<{ id: string; text: string; createdAt?: string }>;
  parentId?: string;
}

interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
}

interface Observation {
  id: string;
  text: string;
  createdAt?: string;
}

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

// Helper function to convert Zod schema to JSON Schema
function zodToJsonSchema(zodSchema: z.ZodRawShape): any {
  const properties: any = {};
  const required: string[] = [];
  
  for (const [key, value] of Object.entries(zodSchema)) {
    if (value instanceof z.ZodString) {
      properties[key] = {
        type: "string",
        description: value.description
      };
      if (!value.isOptional()) {
        required.push(key);
      }
    } else if (value instanceof z.ZodOptional) {
      const innerType = value._def.innerType;
      if (innerType instanceof z.ZodString) {
        properties[key] = {
          type: "string",
          description: innerType.description
        };
      } else if (innerType instanceof z.ZodEnum) {
        properties[key] = {
          type: "string",
          enum: innerType._def.values,
          description: innerType.description
        };
      }
    } else if (value instanceof z.ZodDefault) {
      const innerType = value._def.innerType;
      if (innerType instanceof z.ZodOptional) {
        const enumType = innerType._def.innerType;
        if (enumType instanceof z.ZodEnum) {
          properties[key] = {
            type: "string",
            enum: enumType._def.values,
            description: enumType.description,
            default: value._def.defaultValue()
          };
        }
      }
    } else if (value instanceof z.ZodEnum) {
      properties[key] = {
        type: "string",
        enum: value._def.values,
        description: value.description
      };
      required.push(key);
    }
  }
  
  return {
    type: "object",
    properties,
    required
  };
}

// --- Define Tool Handlers (Using QdrantDataService) ---

const createEntityHandler = async (args: ToolArgs<typeof createEntitySchemaDef>) => {
  try {
    // Parse the observations string into an array if provided
    const observationsArray: string[] = args.observations 
        ? args.observations.split('\n').map(s => s.trim()).filter(s => s.length > 0) 
        : [];

    // Initialize Qdrant and create entity
    await qdrantDataService.initialize();
    const qEntity = await qdrantDataService.createEntity({
      name: args.name,
      type: args.type,
      description: args.description,
      projectId: args.project_id,
      metadata: { 
        parentId: args.parentId,
        observations: observationsArray.map((text, index) => ({
          id: `obs_${index}`,
          text,
          createdAt: new Date().toISOString()
        }))
      }
    });

    // Convert to expected format
    const entity: Entity = {
      id: qEntity.id,
      name: qEntity.name,
      type: qEntity.type,
      description: qEntity.description || '',
      observations: qEntity.metadata.observations || [],
      parentId: qEntity.metadata.parentId
    };

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
    await qdrantDataService.initialize();
    const qRel = await qdrantDataService.createRelationship({
      sourceId: args.source_id,
      targetId: args.target_id,
      type: args.type,
      description: args.description,
      projectId: args.project_id,
      strength: 1.0,
      metadata: {}
    });

    const rel: Relationship = {
      id: qRel.id,
      from: qRel.sourceId,
      to: qRel.targetId,
      type: qRel.type,
      description: qRel.description
    };

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
    await qdrantDataService.initialize();
    
    // Get current entity
    const entity = await qdrantDataService.getEntity(args.project_id, args.entity_id);
    if (!entity) {
      return {
        content: [{ type: "text" as const, text: "Error: Entity not found." }],
        isError: true
      };
    }
    
    // Add observation to metadata
    const observations = entity.metadata.observations || [];
    const newObservation = {
      id: `obs_${Date.now()}`,
      text: args.observation,
      createdAt: new Date().toISOString()
    };
    observations.push(newObservation);
    
    await qdrantDataService.updateEntity(args.project_id, args.entity_id, {
      metadata: { ...entity.metadata, observations }
    });

    return { content: [{ type: "text" as const, text: `Observation added successfully (ID: ${newObservation.id}).` }] };
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
    await qdrantDataService.initialize();
    const qEntity = await qdrantDataService.getEntity(args.project_id, args.entity_id);
    
    if (!qEntity) {
      return {
        content: [{ type: "text" as const, text: "Error: Entity not found." }],
        isError: true
      };
    }

    const entity: Entity = {
      id: qEntity.id,
      name: qEntity.name,
      type: qEntity.type,
      description: qEntity.description || '',
      observations: qEntity.metadata.observations || [],
      parentId: qEntity.metadata.parentId
    };

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
    await qdrantDataService.initialize();
    let qEntities = await qdrantDataService.getEntitiesByProject(args.project_id, 1000);
    
    if (args.type) {
      qEntities = qEntities.filter(entity => entity.type === args.type);
    }

    const entities: Entity[] = qEntities.map(qEntity => ({
      id: qEntity.id,
      name: qEntity.name,
      type: qEntity.type,
      description: qEntity.description || '',
      observations: qEntity.metadata.observations || [],
      parentId: qEntity.metadata.parentId
    }));

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
    await qdrantDataService.initialize();
    
    // Get relationships for this entity
    const relationships = await qdrantDataService.getRelationshipsByEntity(args.project_id, args.entity_id);
    
    // Filter by relationship type if specified
    const filteredRelationships = args.relationship_type 
      ? relationships.filter(rel => rel.type === args.relationship_type)
      : relationships;
    
    // Get related entity IDs based on direction
    let relatedEntityIds: string[] = [];
    const direction = args.direction || 'both';
    
    filteredRelationships.forEach(rel => {
      if (direction === 'both' || direction === 'outgoing') {
        if (rel.sourceId === args.entity_id) {
          relatedEntityIds.push(rel.targetId);
        }
      }
      if (direction === 'both' || direction === 'incoming') {
        if (rel.targetId === args.entity_id) {
          relatedEntityIds.push(rel.sourceId);
        }
      }
    });
    
    // Get the actual entities
    const relatedEntities: Entity[] = [];
    for (const relatedId of relatedEntityIds) {
      const qEntity = await qdrantDataService.getEntity(args.project_id, relatedId);
      if (qEntity) {
        relatedEntities.push({
          id: qEntity.id,
          name: qEntity.name,
          type: qEntity.type,
          description: qEntity.description || '',
          observations: qEntity.metadata.observations || [],
          parentId: qEntity.metadata.parentId
        });
      }
    }

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
    await qdrantDataService.initialize();
    
    // Get relationships for this entity
    let relationships = await qdrantDataService.getRelationshipsByEntity(args.project_id, args.entity_id);
    
    // Filter by relationship type if specified
    if (args.relationship_type) {
      relationships = relationships.filter(rel => rel.type === args.relationship_type);
    }
    
    // Apply direction filter if specified
    const direction = args.direction || 'both';
    if (direction === 'incoming') {
      relationships = relationships.filter(rel => rel.targetId === args.entity_id);
    } else if (direction === 'outgoing') {
      relationships = relationships.filter(rel => rel.sourceId === args.entity_id);
    }
    // 'both' doesn't need additional filtering
    
    // Convert to expected format
    const convertedRelationships: Relationship[] = relationships.map(rel => ({
      id: rel.id,
      from: rel.sourceId,
      to: rel.targetId,
      type: rel.type,
      description: rel.description
    }));

    return { content: [{ type: "text" as const, text: JSON.stringify(convertedRelationships) }] };
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
    await qdrantDataService.initialize();
    
    await qdrantDataService.updateEntity(args.project_id, args.entity_id, {
      description: args.description
    });

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
    await qdrantDataService.initialize();
    await qdrantDataService.deleteEntity(args.project_id, args.entity_id);
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
    await qdrantDataService.initialize();
    await qdrantDataService.deleteRelationship(args.project_id, args.relationship_id);
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
    await qdrantDataService.initialize();
    
    // Get current entity
    const entity = await qdrantDataService.getEntity(args.project_id, args.entity_id);
    if (!entity) {
      return {
        content: [{ type: "text" as const, text: "Error: Entity not found." }],
        isError: true
      };
    }
    
    // Remove observation from metadata
    const observations = entity.metadata.observations || [];
    const filteredObservations = observations.filter((obs: any) => obs.id !== args.observation_id);
    
    if (filteredObservations.length === observations.length) {
      return {
        content: [{ type: "text" as const, text: "Error: Observation not found." }],
        isError: true
      };
    }
    
    await qdrantDataService.updateEntity(args.project_id, args.entity_id, {
      metadata: { ...entity.metadata, observations: filteredObservations }
    });

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

export function getKnowledgeGraphToolInfo(_sessionManager: SessionManager) {
  const tools: Tool[] = [
    {
      name: "create_entity",
      description: "Registers a new entity (like a file, function, concept) in the knowledge graph for the active project.",
      inputSchema: zodToJsonSchema(createEntitySchemaDef)
    },
    {
      name: "create_relationship",
      description: "Defines a relationship between two existing entities within the active project.",
      inputSchema: zodToJsonSchema(createRelationshipSchemaDef)
    },
    {
      name: "add_observation",
      description: "Adds a specific textual observation to an existing entity within the active project.",
      inputSchema: zodToJsonSchema(addObservationSchemaDef)
    },
    {
      name: "get_entity",
      description: "Retrieves details for a specific entity within the active project.",
      inputSchema: zodToJsonSchema(getEntitySchemaDef)
    },
    {
      name: "list_entities",
      description: "Lists entities within the active project, optionally filtered by type.",
      inputSchema: zodToJsonSchema(listEntitiesSchemaDef)
    },
    {
      name: "get_related_entities",
      description: "Finds entities related to a specific entity within the active project, optionally filtering by relationship type and direction.",
      inputSchema: zodToJsonSchema(getRelatedEntitiesSchemaDef)
    },
    {
      name: "get_relationships",
      description: "Retrieves relationships connected to a specific entity within the active project, optionally filtering by type and direction.",
      inputSchema: zodToJsonSchema(getRelationshipsSchemaDef)
    },
    {
      name: "update_entity_description",
      description: "Updates the description of a specific entity within the active project.",
      inputSchema: zodToJsonSchema(updateEntityDescriptionSchemaDef)
    },
    {
      name: "delete_entity",
      description: "Removes an entity and all its relationships from the active project.",
      inputSchema: zodToJsonSchema(deleteEntitySchemaDef)
    },
    {
      name: "delete_relationship",
      description: "Removes a specific relationship from the active project.",
      inputSchema: zodToJsonSchema(deleteRelationshipSchemaDef)
    },
    {
      name: "delete_observation",
      description: "Removes a specific observation from an entity within the active project.",
      inputSchema: zodToJsonSchema(deleteObservationSchemaDef)
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
    delete_observation: deleteObservationHandler
  };

  return {
    tools,
    handlers
  };
}

// Removed the old registerKnowledgeGraphTools function 