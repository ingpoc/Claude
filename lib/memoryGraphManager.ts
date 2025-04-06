"use server";

import { v4 as uuidv4 } from 'uuid';
import { UserMemory } from './memoryManager';
import { EntityTypes, RelationshipTypes } from './constants';
import { 
  createEntity, 
  createRelationship, 
  addObservation,
  getEntity, 
  getRelatedEntities,
  getRelationships
} from './knowledgeGraph';

/**
 * Class to manage memory persistence in the knowledge graph
 */
export class MemoryGraphManager {
  private projectId: string;
  private userId: string;
  private userEntityId: string | null = null;
  
  /**
   * Constructor
   * @param projectId The knowledge graph project ID
   * @param userId The user ID (default to default_user)
   */
  constructor(projectId: string, userId: string = 'default_user') {
    this.projectId = projectId;
    this.userId = userId;
  }
  
  /**
   * Initialize the memory graph
   * Creates the user entity if it doesn't exist
   */
  async initialize(): Promise<boolean> {
    try {
      // console.log(`[MemoryGraph] Initializing memory graph for user ${this.userId}`);
      
      // Find or create the user entity
      await this.findOrCreateUserEntity();
      
      return !!this.userEntityId;
    } catch (error) {
      console.error('[MemoryGraph] Error initializing memory graph:', error);
      return false;
    }
  }
  
  /**
   * Find the user entity or create it if it doesn't exist
   */
  private async findOrCreateUserEntity(): Promise<void> {
    try {
      // Try to find the user entity by name
      // Ideally we'd have an index on name and type, but for now we'll just
      // iterate through all entities (this is inefficient but works for small datasets)
      const allEntities = await getRelatedEntities(this.projectId, this.userId, undefined, 'both');
      
      const userEntity = allEntities.find(entity => 
        entity.type === EntityTypes.USER && 
        entity.name === this.userId
      );
      
      if (userEntity) {
        this.userEntityId = userEntity.id;
        // console.log(`[MemoryGraph] Found existing user entity: ${this.userEntityId}`);
        return;
      }
      
      // User entity doesn't exist, create it
      const newUserEntity = await createEntity(
        this.projectId,
        this.userId,
        EntityTypes.USER,
        `User entity for ${this.userId}`,
        [`User initialized at ${new Date().toISOString()}`]
      );
      
      if (newUserEntity) {
        this.userEntityId = newUserEntity.id;
        // console.log(`[MemoryGraph] Created new user entity: ${this.userEntityId}`);
      } else {
        console.error(`[MemoryGraph] Failed to create user entity for ${this.userId}`);
      }
    } catch (error) {
      console.error('[MemoryGraph] Error finding/creating user entity:', error);
      throw error;
    }
  }
  
  /**
   * Store basic identity information in the knowledge graph
   * @param identity The identity information to store
   */
  async storeBasicIdentity(identity: Record<string, any>): Promise<boolean> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return false;
      }
      
      // Add observations for each identity field
      for (const [key, value] of Object.entries(identity)) {
        if (value !== undefined && value !== null) {
          const obsText = `${key}: ${value}`;
          await addObservation(this.projectId, this.userEntityId, obsText);
        }
      }
      
      return true;
    } catch (error) {
      console.error('[MemoryGraph] Error storing basic identity:', error);
      return false;
    }
  }
  
  /**
   * Store a new interest for the user
   * @param interest The interest text
   */
  async storeInterest(interest: string): Promise<boolean> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return false;
      }
      
      // Create interest entity
      const interestEntity = await createEntity(
        this.projectId,
        interest,
        EntityTypes.INTEREST,
        `User interest: ${interest}`,
        [`Added at ${new Date().toISOString()}`]
      );
      
      if (!interestEntity) {
        console.error(`[MemoryGraph] Failed to create interest entity: ${interest}`);
        return false;
      }
      
      // Create relationship between user and interest
      const relationship = await createRelationship(
        this.projectId,
        this.userEntityId,
        interestEntity.id,
        RelationshipTypes.HAS_INTEREST
      );
      
      return !!relationship;
    } catch (error) {
      console.error('[MemoryGraph] Error storing interest:', error);
      return false;
    }
  }
  
  /**
   * Store a preference for the user
   * @param key The preference key
   * @param value The preference value
   */
  async storePreference(key: string, value: string): Promise<boolean> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return false;
      }
      
      // Create preference entity with a descriptive name
      const prefName = `${key}: ${value}`;
      const prefEntity = await createEntity(
        this.projectId,
        prefName,
        EntityTypes.PREFERENCE,
        `User preference for ${key}`,
        [`Value: ${value}`, `Added at ${new Date().toISOString()}`]
      );
      
      if (!prefEntity) {
        console.error(`[MemoryGraph] Failed to create preference entity: ${prefName}`);
        return false;
      }
      
      // Create relationship between user and preference
      const relationship = await createRelationship(
        this.projectId,
        this.userEntityId,
        prefEntity.id,
        RelationshipTypes.HAS_PREFERENCE
      );
      
      return !!relationship;
    } catch (error) {
      console.error('[MemoryGraph] Error storing preference:', error);
      return false;
    }
  }
  
  /**
   * Store a goal for the user
   * @param goal The goal text
   */
  async storeGoal(goal: string): Promise<boolean> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return false;
      }
      
      // Create goal entity
      const goalEntity = await createEntity(
        this.projectId,
        goal,
        EntityTypes.GOAL,
        `User goal: ${goal}`,
        [`Added at ${new Date().toISOString()}`]
      );
      
      if (!goalEntity) {
        console.error(`[MemoryGraph] Failed to create goal entity: ${goal}`);
        return false;
      }
      
      // Create relationship between user and goal
      const relationship = await createRelationship(
        this.projectId,
        this.userEntityId,
        goalEntity.id,
        RelationshipTypes.HAS_GOAL
      );
      
      return !!relationship;
    } catch (error) {
      console.error('[MemoryGraph] Error storing goal:', error);
      return false;
    }
  }
  
  /**
   * Store a relationship to a person or organization
   * @param name The name of the person/organization
   * @param type The entity type (person or organization)
   * @param relationshipType The type of relationship
   * @param details Additional details about the relationship
   */
  async storeRelationship(
    name: string, 
    type: 'person' | 'organization',
    relationshipType: string,
    details: string[] = []
  ): Promise<boolean> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return false;
      }
      
      // Create the entity
      const entityType = type === 'person' ? EntityTypes.PERSON : EntityTypes.ORGANIZATION;
      const entity = await createEntity(
        this.projectId,
        name,
        entityType,
        `${type === 'person' ? 'Person' : 'Organization'}: ${name}`,
        [...details, `Added at ${new Date().toISOString()}`]
      );
      
      if (!entity) {
        console.error(`[MemoryGraph] Failed to create ${type} entity: ${name}`);
        return false;
      }
      
      // Create relationship between user and the entity
      const relationship = await createRelationship(
        this.projectId,
        this.userEntityId,
        entity.id,
        relationshipType
      );
      
      return !!relationship;
    } catch (error) {
      console.error(`[MemoryGraph] Error storing ${type} relationship:`, error);
      return false;
    }
  }
  
  /**
   * Get all interests for the user
   */
  async getInterests(): Promise<string[]> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return [];
      }
      
      // Get all interest entities related to the user
      const relatedEntities = await getRelatedEntities(
        this.projectId,
        this.userEntityId,
        RelationshipTypes.HAS_INTEREST,
        'outgoing'
      );
      
      // Extract and return the interest names
      return relatedEntities
        .filter(entity => entity.type === EntityTypes.INTEREST)
        .map(entity => entity.name);
    } catch (error) {
      console.error('[MemoryGraph] Error getting interests:', error);
      return [];
    }
  }
  
  /**
   * Get all preferences for the user
   */
  async getPreferences(): Promise<Record<string, string>> {
    try {
      if (!this.userEntityId) {
        await this.initialize();
        if (!this.userEntityId) return {};
      }
      
      // Get all preference entities related to the user
      const relatedEntities = await getRelatedEntities(
        this.projectId,
        this.userEntityId,
        RelationshipTypes.HAS_PREFERENCE,
        'outgoing'
      );
      
      // Extract preferences into a key-value map
      const preferences: Record<string, string> = {};
      
      for (const entity of relatedEntities) {
        if (entity.type === EntityTypes.PREFERENCE) {
          // Split the name which should be in format "key: value"
          const colonIndex = entity.name.indexOf(':');
          if (colonIndex > 0) {
            const key = entity.name.substring(0, colonIndex).trim();
            const value = entity.name.substring(colonIndex + 1).trim();
            preferences[key] = value;
          }
        }
      }
      
      return preferences;
    } catch (error) {
      console.error('[MemoryGraph] Error getting preferences:', error);
      return {};
    }
  }
  
  /**
   * Store the complete user memory in the graph
   * @param memory The complete user memory object
   */
  async storeMemory(memory: UserMemory): Promise<boolean> {
    try {
      // Initialize the user entity
      await this.initialize();
      if (!this.userEntityId) return false;
      
      let success = true;
      
      // Store basic identity
      if (memory.basicIdentity) {
        const identitySuccess = await this.storeBasicIdentity(memory.basicIdentity);
        if (!identitySuccess) success = false;
      }
      
      // Store interests
      if (memory.behaviors?.interests) {
        for (const interest of memory.behaviors.interests) {
          const interestSuccess = await this.storeInterest(interest);
          if (!interestSuccess) success = false;
        }
      }
      
      // Store preferences
      if (memory.preferences) {
        for (const [key, value] of Object.entries(memory.preferences)) {
          if (typeof value === 'string') {
            const prefSuccess = await this.storePreference(key, value);
            if (!prefSuccess) success = false;
          }
        }
      }
      
      // Store goals
      if (memory.goals?.targets) {
        for (const goal of memory.goals.targets) {
          const goalSuccess = await this.storeGoal(goal);
          if (!goalSuccess) success = false;
        }
      }
      
      if (memory.goals?.aspirations) {
        for (const goal of memory.goals.aspirations) {
          const goalSuccess = await this.storeGoal(goal);
          if (!goalSuccess) success = false;
        }
      }
      
      // Store personal relationships
      if (memory.relationships?.personal) {
        for (const [name, details] of Object.entries(memory.relationships.personal)) {
          // Convert details to string array if not already
          const detailsArray = typeof details === 'string' 
            ? [details] 
            : (
                Array.isArray(details) 
                  ? details.map(d => d.toString())
                  : Object.entries(details).map(([k, v]) => `${k}: ${v}`)
              );
          
          const relSuccess = await this.storeRelationship(
            name, 
            'person', 
            RelationshipTypes.KNOWS, 
            detailsArray
          );
          
          if (!relSuccess) success = false;
        }
      }
      
      // Store professional relationships
      if (memory.relationships?.professional) {
        for (const [name, details] of Object.entries(memory.relationships.professional)) {
          // Handle both organizations and persons
          const isPerson = typeof details === 'object' && details.type === 'person';
          
          // Convert details to string array if not already
          const detailsArray = typeof details === 'string' 
            ? [details] 
            : (
                Array.isArray(details) 
                  ? details.map(d => d.toString())
                  : Object.entries(details)
                      .filter(([k]) => k !== 'type')
                      .map(([k, v]) => `${k}: ${v}`)
              );
          
          const relSuccess = await this.storeRelationship(
            name, 
            isPerson ? 'person' : 'organization', 
            isPerson ? RelationshipTypes.KNOWS : RelationshipTypes.WORKS_AT, 
            detailsArray
          );
          
          if (!relSuccess) success = false;
        }
      }
      
      return success;
    } catch (error) {
      console.error('[MemoryGraph] Error storing complete memory:', error);
      return false;
    }
  }
  
  /**
   * Retrieve the complete user memory from the graph
   */
  async retrieveMemory(): Promise<UserMemory> {
    try {
      // Initialize the user entity
      await this.initialize();
      if (!this.userEntityId) return {};
      
      // Get the user entity to retrieve observations (basic identity)
      const userEntity = await getEntity(this.projectId, this.userEntityId);
      const basicIdentity: Record<string, any> = {};
      
      // Parse observations for basic identity
      if (userEntity?.observations) {
        for (const obs of userEntity.observations) {
          const colonIndex = obs.text.indexOf(':');
          if (colonIndex > 0) {
            const key = obs.text.substring(0, colonIndex).trim();
            const value = obs.text.substring(colonIndex + 1).trim();
            
            // Don't include system or meta observations
            if (!key.startsWith('_') && !key.includes('initialized')) {
              // Try to parse numbers
              if (!isNaN(Number(value))) {
                basicIdentity[key] = Number(value);
              } else {
                basicIdentity[key] = value;
              }
            }
          }
        }
      }
      
      // Get interests
      const interests = await this.getInterests();
      
      // Get preferences
      const preferencesMap = await this.getPreferences();
      
      // Get goals
      const goalEntities = await getRelatedEntities(
        this.projectId,
        this.userEntityId,
        RelationshipTypes.HAS_GOAL,
        'outgoing'
      );
      
      const goals = goalEntities
        .filter(entity => entity.type === EntityTypes.GOAL)
        .map(entity => entity.name);
      
      // Get personal relationships
      const knownPersonEntities = await getRelatedEntities(
        this.projectId,
        this.userEntityId,
        RelationshipTypes.KNOWS,
        'outgoing'
      );
      
      const personal: Record<string, any> = {};
      
      for (const entity of knownPersonEntities) {
        if (entity.type === EntityTypes.PERSON) {
          // Extract details from observations
          const details: string[] = entity.observations
            .map(obs => obs.text)
            .filter(text => !text.includes('Added at')); // Filter out system observations
          
          personal[entity.name] = details.length === 1 ? details[0] : details;
        }
      }
      
      // Get professional relationships (organizations)
      const workEntities = await getRelatedEntities(
        this.projectId,
        this.userEntityId,
        RelationshipTypes.WORKS_AT,
        'outgoing'
      );
      
      const professional: Record<string, any> = {};
      
      for (const entity of workEntities) {
        if (entity.type === EntityTypes.ORGANIZATION) {
          // Extract details from observations
          const details: string[] = entity.observations
            .map(obs => obs.text)
            .filter(text => !text.includes('Added at')); // Filter out system observations
          
          professional[entity.name] = details.length === 1 ? details[0] : details;
        }
      }
      
      // Also get professional relationships to people
      const professionalPersonEntities = knownPersonEntities.filter(entity => {
        // Check if any observations indicate a professional relationship
        return entity.observations.some(obs => 
          obs.text.toLowerCase().includes('colleague') ||
          obs.text.toLowerCase().includes('coworker') ||
          obs.text.toLowerCase().includes('manager') ||
          obs.text.toLowerCase().includes('reports to') ||
          obs.text.toLowerCase().includes('supervisor') ||
          obs.text.toLowerCase().includes('work')
        );
      });
      
      for (const entity of professionalPersonEntities) {
        // Extract details from observations
        const details: string[] = entity.observations
          .map(obs => obs.text)
          .filter(text => !text.includes('Added at')); // Filter out system observations
        
        professional[entity.name] = {
          type: 'person',
          details: details.length === 1 ? details[0] : details
        };
      }
      
      // Construct the complete memory object
      const memory: UserMemory = {
        basicIdentity: Object.keys(basicIdentity).length > 0 ? basicIdentity : undefined,
        behaviors: {
          interests: interests.length > 0 ? interests : undefined
        },
        preferences: Object.keys(preferencesMap).length > 0 ? preferencesMap : undefined,
        goals: {
          targets: goals.length > 0 ? goals : undefined
        },
        relationships: {
          personal: Object.keys(personal).length > 0 ? personal : undefined,
          professional: Object.keys(professional).length > 0 ? professional : undefined
        }
      };
      
      return memory;
    } catch (error) {
      console.error('[MemoryGraph] Error retrieving complete memory:', error);
      return {};
    }
  }
}

// Create a singleton instance to use throughout the app
let memoryGraphManagerInstance: MemoryGraphManager | null = null;

/**
 * Get the MemoryGraphManager instance
 * @param projectId The knowledge graph project ID
 * @param userId The user ID (default to default_user)
 */
export function getMemoryGraphManager(
  projectId: string, 
  userId: string = 'default_user'
): MemoryGraphManager {
  if (!memoryGraphManagerInstance) {
    memoryGraphManagerInstance = new MemoryGraphManager(projectId, userId);
  }
  
  return memoryGraphManagerInstance;
}

/**
 * Utility function to synchronize in-memory storage with the knowledge graph
 * @param projectId The knowledge graph project ID
 * @param memory The memory object to store
 * @param userId The user ID (default to default_user)
 */
export async function syncMemoryWithGraph(
  projectId: string,
  memory: UserMemory,
  userId: string = 'default_user'
): Promise<boolean> {
  try {
    const manager = getMemoryGraphManager(projectId, userId);
    return await manager.storeMemory(memory);
  } catch (error) {
    console.error(`[MemoryGraph] Error syncing memory with graph for user ${userId}:`, error);
    return false;
  }
}

/**
 * Utility function to load memory from the knowledge graph
 * @param projectId The knowledge graph project ID
 * @param userId The user ID (default to default_user)
 */
export async function loadMemoryFromGraph(
  projectId: string,
  userId: string = 'default_user'
): Promise<UserMemory> {
  try {
    const manager = getMemoryGraphManager(projectId, userId);
    return await manager.retrieveMemory();
  } catch (error) {
    console.error(`[MemoryGraph] Error loading memory from graph for user ${userId}:`, error);
    return {};
  }
}
