"use server";

import { createProject, getProject, getProjects } from '../../projectManager';
import { EntityTypes, RelationshipTypes } from '../../constants';
import { UserMemory, getUserMemory, updateUserMemory } from '../../memoryManager';
import { 
  getMemoryGraphManager, 
  syncMemoryWithGraph, 
  loadMemoryFromGraph 
} from '../../memoryGraphManager';
import { createEntity, getEntity, getRelatedEntities } from '../../knowledgeGraph';

// Constants
const MEMORY_PROJECT_NAME = "UserMemory";
const MEMORY_PROJECT_DESCRIPTION = "Knowledge graph for storing user memory";

/**
 * Ensure the memory project exists
 */
async function ensureMemoryProject(): Promise<string> {
  try {
    // Check if the memory project already exists
    const projects = await getProjects();
    const memoryProject = projects.find(p => p.name === MEMORY_PROJECT_NAME);
    
    if (memoryProject) {
      return memoryProject.id;
    }
    
    // Create the memory project if it doesn't exist
    console.log(`[MemoryTools] Creating memory project: ${MEMORY_PROJECT_NAME}`);
    const newProject = await createProject(MEMORY_PROJECT_NAME, MEMORY_PROJECT_DESCRIPTION);
    
    if (!newProject) {
      throw new Error(`Failed to create memory project: ${MEMORY_PROJECT_NAME}`);
    }
    
    return newProject.id;
  } catch (error) {
    console.error('[MemoryTools] Error ensuring memory project exists:', error);
    throw error;
  }
}

/**
 * Tool handler to store user data into the knowledge graph
 */
export async function storeUserDataHandler(
  ctx: any,
  args: {
    userId?: string;
    data: any;
    category: string;
  }
): Promise<any> {
  try {
    console.log(`[MemoryTools] Storing user data for ${args.userId || 'default_user'} in category: ${args.category}`);
    
    // Get or create memory project
    const projectId = await ensureMemoryProject();
    
    // Get current user memory
    const userId = args.userId || 'default_user';
    const currentMemory = await getUserMemory(userId);
    
    // Update the memory category based on the input
    let updatedMemory: UserMemory = { ...currentMemory };
    
    switch (args.category) {
      case 'basicIdentity':
        updatedMemory.basicIdentity = {
          ...updatedMemory.basicIdentity,
          ...args.data
        };
        break;
        
      case 'interests':
        updatedMemory.behaviors = updatedMemory.behaviors || {};
        updatedMemory.behaviors.interests = [
          ...(updatedMemory.behaviors.interests || []),
          ...args.data
        ];
        break;
        
      case 'preferences':
        updatedMemory.preferences = {
          ...updatedMemory.preferences,
          ...args.data
        };
        break;
        
      case 'goals':
        updatedMemory.goals = updatedMemory.goals || {};
        updatedMemory.goals.targets = [
          ...(updatedMemory.goals.targets || []),
          ...args.data
        ];
        break;
        
      case 'relationships':
        updatedMemory.relationships = updatedMemory.relationships || {};
        if (args.data.personal) {
          updatedMemory.relationships.personal = {
            ...(updatedMemory.relationships.personal || {}),
            ...args.data.personal
          };
        }
        if (args.data.professional) {
          updatedMemory.relationships.professional = {
            ...(updatedMemory.relationships.professional || {}),
            ...args.data.professional
          };
        }
        break;
        
      default:
        return { 
          content: [{ 
            type: 'text', 
            text: `Invalid category: ${args.category}. Supported categories are: basicIdentity, interests, preferences, goals, relationships.` 
          }],
          isError: true
        };
    }
    
    // Update the in-memory storage
    await updateUserMemory(userId, updatedMemory);
    
    // Sync to the knowledge graph
    await syncMemoryWithGraph(projectId, updatedMemory, userId);
    
    return { 
      content: [{ 
        type: 'text', 
        text: `Successfully stored ${args.category} data for user: ${userId}` 
      }]
    };
  } catch (error) {
    console.error('[MemoryTools] Error in storeUserDataHandler:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error storing user data: ${error.message}` 
      }],
      isError: true
    };
  }
}

/**
 * Tool handler to retrieve user data from the knowledge graph
 */
export async function retrieveUserDataHandler(
  ctx: any,
  args: {
    userId?: string;
    category?: string;
  }
): Promise<any> {
  try {
    const userId = args.userId || 'default_user';
    console.log(`[MemoryTools] Retrieving user data for ${userId}`);
    
    // Get memory project
    const projectId = await ensureMemoryProject();
    
    // Load memory from both in-memory store and knowledge graph
    const inMemoryData = await getUserMemory(userId);
    const graphData = await loadMemoryFromGraph(projectId, userId);
    
    // Merge data (prefer graph data if available)
    const mergedMemory = {
      ...inMemoryData,
      ...graphData,
      basicIdentity: {
        ...(inMemoryData.basicIdentity || {}),
        ...(graphData.basicIdentity || {})
      },
      behaviors: {
        ...(inMemoryData.behaviors || {}),
        ...(graphData.behaviors || {}),
        interests: [
          ...new Set([
            ...(inMemoryData.behaviors?.interests || []),
            ...(graphData.behaviors?.interests || [])
          ])
        ]
      },
      preferences: {
        ...(inMemoryData.preferences || {}),
        ...(graphData.preferences || {})
      },
      goals: {
        ...(inMemoryData.goals || {}),
        ...(graphData.goals || {}),
        targets: [
          ...new Set([
            ...(inMemoryData.goals?.targets || []),
            ...(graphData.goals?.targets || [])
          ])
        ],
        aspirations: [
          ...new Set([
            ...(inMemoryData.goals?.aspirations || []),
            ...(graphData.goals?.aspirations || [])
          ])
        ]
      },
      relationships: {
        ...(inMemoryData.relationships || {}),
        ...(graphData.relationships || {}),
        personal: {
          ...(inMemoryData.relationships?.personal || {}),
          ...(graphData.relationships?.personal || {})
        },
        professional: {
          ...(inMemoryData.relationships?.professional || {}),
          ...(graphData.relationships?.professional || {})
        }
      }
    };
    
    // Filter by category if specified
    if (args.category) {
      switch (args.category) {
        case 'basicIdentity':
          return { content: [{ type: 'text', text: JSON.stringify(mergedMemory.basicIdentity || {}, null, 2) }] };
          
        case 'interests':
          return { content: [{ type: 'text', text: JSON.stringify(mergedMemory.behaviors?.interests || [], null, 2) }] };
          
        case 'preferences':
          return { content: [{ type: 'text', text: JSON.stringify(mergedMemory.preferences || {}, null, 2) }] };
          
        case 'goals':
          return { content: [{ type: 'text', text: JSON.stringify(mergedMemory.goals || {}, null, 2) }] };
          
        case 'relationships':
          return { content: [{ type: 'text', text: JSON.stringify(mergedMemory.relationships || {}, null, 2) }] };
          
        default:
          return { 
            content: [{ 
              type: 'text', 
              text: `Invalid category: ${args.category}. Supported categories are: basicIdentity, interests, preferences, goals, relationships.` 
            }],
            isError: true
          };
      }
    }
    
    // Return all memory data if no category specified
    return { content: [{ type: 'text', text: JSON.stringify(mergedMemory, null, 2) }] };
  } catch (error) {
    console.error('[MemoryTools] Error in retrieveUserDataHandler:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error retrieving user data: ${error.message}` 
      }],
      isError: true
    };
  }
}

/**
 * Tool handler to find related entities for a given entity
 */
export async function findRelatedEntitiesHandler(
  ctx: any,
  args: {
    userId?: string;
    entityName: string;
    entityType?: string;
    relationshipType?: string;
  }
): Promise<any> {
  try {
    const userId = args.userId || 'default_user';
    console.log(`[MemoryTools] Finding related entities for ${args.entityName} (type: ${args.entityType || 'any'})`);
    
    // Get memory project
    const projectId = await ensureMemoryProject();
    
    // Initialize memory graph manager
    const memoryManager = getMemoryGraphManager(projectId, userId);
    await memoryManager.initialize();
    
    // Get all entities to find the requested one by name and type
    const allEntities = await getRelatedEntities(projectId, userId, undefined, 'both');
    
    // Filter entities by name and optionally by type
    const matchingEntities = allEntities.filter(entity => 
      entity.name === args.entityName && 
      (!args.entityType || entity.type === args.entityType)
    );
    
    if (matchingEntities.length === 0) {
      return { 
        content: [{ 
          type: 'text', 
          text: `No entity found with name "${args.entityName}"${args.entityType ? ` and type "${args.entityType}"` : ''}` 
        }]
      };
    }
    
    // Use the first matching entity (ideally should only be one)
    const entityId = matchingEntities[0].id;
    
    // Get related entities
    const relatedEntities = await getRelatedEntities(
      projectId,
      entityId,
      args.relationshipType,
      'both'
    );
    
    // Format the result
    const result = relatedEntities.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      observations: entity.observations.map(obs => obs.text)
    }));
    
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify(result, null, 2) 
      }]
    };
  } catch (error) {
    console.error('[MemoryTools] Error in findRelatedEntitiesHandler:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error finding related entities: ${error.message}` 
      }],
      isError: true
    };
  }
}

/**
 * Tool handler to create a default project template for memory storage
 */
export async function createMemoryProjectHandler(
  ctx: any,
  args: {
    userId?: string;
  }
): Promise<any> {
  try {
    const userId = args.userId || 'default_user';
    console.log(`[MemoryTools] Creating memory project for ${userId}`);
    
    // Create the memory project
    const projectId = await ensureMemoryProject();
    
    // Initialize the memory graph manager to create the user entity
    const memoryManager = getMemoryGraphManager(projectId, userId);
    await memoryManager.initialize();
    
    return { 
      content: [{ 
        type: 'text', 
        text: `Successfully created memory project with ID: ${projectId}` 
      }]
    };
  } catch (error) {
    console.error('[MemoryTools] Error in createMemoryProjectHandler:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error creating memory project: ${error.message}` 
      }],
      isError: true
    };
  }
}

/**
 * Tool handler to check the memory storage status
 */
export async function checkMemoryStatusHandler(
  ctx: any,
  args: {
    userId?: string;
  }
): Promise<any> {
  try {
    const userId = args.userId || 'default_user';
    console.log(`[MemoryTools] Checking memory status for ${userId}`);
    
    // Try to get the memory project
    const projects = await getProjects();
    const memoryProject = projects.find(p => p.name === MEMORY_PROJECT_NAME);
    
    if (!memoryProject) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Memory project not found. Call createMemoryProject to initialize.` 
        }]
      };
    }
    
    // Check if user entity exists
    const projectId = memoryProject.id;
    
    // Initialize memory manager (and create user entity if not exists)
    const memoryManager = getMemoryGraphManager(projectId, userId);
    await memoryManager.initialize();
    
    // Retrieve memory to check what data exists
    const memory = await loadMemoryFromGraph(projectId, userId);
    
    // Count items in each category
    const identityCount = Object.keys(memory.basicIdentity || {}).length;
    const interestsCount = (memory.behaviors?.interests || []).length;
    const preferencesCount = Object.keys(memory.preferences || {}).length;
    const goalsCount = (memory.goals?.targets || []).length + (memory.goals?.aspirations || []).length;
    const relationshipsCount = 
      Object.keys(memory.relationships?.personal || {}).length + 
      Object.keys(memory.relationships?.professional || {}).length;
    
    return { 
      content: [{ 
        type: 'text', 
        text: `Memory Status for ${userId}:
- Project ID: ${projectId}
- Identity attributes: ${identityCount}
- Interests: ${interestsCount}
- Preferences: ${preferencesCount}
- Goals: ${goalsCount}
- Relationships: ${relationshipsCount}
` 
      }]
    };
  } catch (error) {
    console.error('[MemoryTools] Error in checkMemoryStatusHandler:', error);
    return { 
      content: [{ 
        type: 'text', 
        text: `Error checking memory status: ${error.message}` 
      }],
      isError: true
    };
  }
}
