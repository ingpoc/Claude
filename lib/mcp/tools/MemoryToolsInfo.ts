"use server";

import { z } from 'zod';
import { SessionManager } from '../SessionManager';
import { 
  storeUserDataHandler, 
  retrieveUserDataHandler, 
  findRelatedEntitiesHandler,
  createMemoryProjectHandler,
  checkMemoryStatusHandler
} from './MemoryTools';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Schema definitions
const storeUserDataSchemaDef = {
  userId: z.string().optional().describe("The user identifier. Defaults to 'default_user' if not provided."),
  data: z.any().describe("Data to store for the user."),
  category: z.string().describe("The category to store the data in (basicIdentity, interests, preferences, goals, relationships).")
};

const retrieveUserDataSchemaDef = {
  userId: z.string().optional().describe("The user identifier. Defaults to 'default_user' if not provided."),
  category: z.string().optional().describe("Optional category to filter the returned data (basicIdentity, interests, preferences, goals, relationships).")
};

const findRelatedEntitiesSchemaDef = {
  userId: z.string().optional().describe("The user identifier. Defaults to 'default_user' if not provided."),
  entityName: z.string().describe("The name of the entity to find related entities for."),
  entityType: z.string().optional().describe("Optional entity type to filter by."),
  relationshipType: z.string().optional().describe("Optional relationship type to filter by.")
};

const createMemoryProjectSchemaDef = {
  userId: z.string().optional().describe("The user identifier. Defaults to 'default_user' if not provided.")
};

const checkMemoryStatusSchemaDef = {
  userId: z.string().optional().describe("The user identifier. Defaults to 'default_user' if not provided.")
};

// Export tool definitions and handlers
export function getMemoryToolInfo(_sessionManager: SessionManager) {
  const definitions: Tool[] = [
    {
      name: "store_user_data",
      description: "Stores user data in the specified category within the memory knowledge graph.",
      inputSchema: { 
        type: "object", 
        properties: storeUserDataSchemaDef, 
        required: ["data", "category"] 
      }
    },
    {
      name: "retrieve_user_data",
      description: "Retrieves user data from the memory knowledge graph, optionally filtered by category.",
      inputSchema: { 
        type: "object", 
        properties: retrieveUserDataSchemaDef,
        required: [] 
      }
    },
    {
      name: "find_related_entities",
      description: "Finds entities related to a specific entity by name in the memory knowledge graph.",
      inputSchema: { 
        type: "object", 
        properties: findRelatedEntitiesSchemaDef,
        required: ["entityName"] 
      }
    },
    {
      name: "create_memory_project",
      description: "Creates a project template for memory storage in the knowledge graph.",
      inputSchema: { 
        type: "object", 
        properties: createMemoryProjectSchemaDef,
        required: [] 
      }
    },
    {
      name: "check_memory_status",
      description: "Checks the status of the memory storage for a user.",
      inputSchema: { 
        type: "object", 
        properties: checkMemoryStatusSchemaDef,
        required: [] 
      }
    }
  ];

  const handlers = {
    store_user_data: storeUserDataHandler,
    retrieve_user_data: retrieveUserDataHandler,
    find_related_entities: findRelatedEntitiesHandler,
    create_memory_project: createMemoryProjectHandler,
    check_memory_status: checkMemoryStatusHandler
  };

  return { definitions, handlers };
}