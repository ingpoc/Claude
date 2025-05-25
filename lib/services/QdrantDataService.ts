import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './Logger';

// Data Models for Qdrant-only architecture
export interface QdrantEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QdrantRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  projectId: string;
  strength: number; // 0-1 similarity score
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface QdrantProject {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, any>;
}

export interface QdrantUserSettings {
  id: string;
  userId: string;
  aiConfiguration: any;
  aiFeatures: any;
  privacy: any;
  performance: any;
  ui: any;
  createdAt: Date;
  updatedAt: Date;
}

export class QdrantDataService {
  private client: QdrantClient;
  private logger: typeof logger;
  private openaiApiKey: string;

  // Collection names
  private static readonly COLLECTIONS = {
    ENTITIES: 'entities',
    RELATIONSHIPS: 'relationships', 
    PROJECTS: 'projects',
    SETTINGS: 'user_settings',
    CONVERSATIONS: 'conversations',
    CONTEXT_SESSIONS: 'context_sessions'
  } as const;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.logger = logger;
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  // Initialize all collections
  async initialize(): Promise<void> {
    try {
      await this.ensureCollections();
      this.logger.info('QdrantDataService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize QdrantDataService', { error });
      throw error;
    }
  }

  private async ensureCollections(): Promise<void> {
    const collections = Object.values(QdrantDataService.COLLECTIONS);
    
    for (const collectionName of collections) {
      try {
        await this.client.getCollection(collectionName);
        this.logger.debug(`Collection ${collectionName} already exists`);
      } catch (error) {
        // Collection doesn't exist, create it
        await this.client.createCollection(collectionName, {
          vectors: {
            size: 1536, // OpenAI embedding size
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });
        this.logger.info(`Created collection: ${collectionName}`);
      }
    }
  }

  // Generate embeddings using OpenAI
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      // Return a dummy embedding for development
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002',
        }),
      });

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      this.logger.warn('Failed to generate embedding, using random', { error });
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    }
  }

  // PROJECT OPERATIONS
  async createProject(project: Omit<QdrantProject, 'id' | 'createdAt' | 'lastAccessed'>): Promise<QdrantProject> {
    const id = uuidv4();
    const now = new Date();
    const fullProject: QdrantProject = {
      ...project,
      id,
      createdAt: now,
      lastAccessed: now,
    };

    const embedding = await this.generateEmbedding(`${project.name} ${project.description || ''}`);

    await this.client.upsert(QdrantDataService.COLLECTIONS.PROJECTS, {
      wait: true,
      points: [{
        id,
        vector: embedding,
        payload: {
          ...fullProject,
          createdAt: fullProject.createdAt.toISOString(),
          lastAccessed: fullProject.lastAccessed.toISOString(),
        }
      }]
    });

    this.logger.info('Created project', { projectId: id, name: project.name });
    return fullProject;
  }

  async getProject(projectId: string): Promise<QdrantProject | null> {
    try {
      const result = await this.client.retrieve(QdrantDataService.COLLECTIONS.PROJECTS, {
        ids: [projectId],
        with_payload: true,
      });

      if (result.length === 0) return null;

      const point = result[0];
      return {
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        lastAccessed: new Date(point.payload!.lastAccessed as string),
      };
    } catch (error) {
      this.logger.error('Failed to get project', { projectId, error });
      return null;
    }
  }

  async getAllProjects(): Promise<QdrantProject[]> {
    try {
      const result = await this.client.scroll(QdrantDataService.COLLECTIONS.PROJECTS, {
        limit: 1000,
        with_payload: true,
      });

      return result.points.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        lastAccessed: new Date(point.payload!.lastAccessed as string),
      }));
    } catch (error) {
      this.logger.error('Failed to get all projects', { error });
      return [];
    }
  }

  async updateProject(projectId: string, updates: Partial<QdrantProject>): Promise<void> {
    const existing = await this.getProject(projectId);
    if (!existing) throw new Error('Project not found');

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const embedding = await this.generateEmbedding(`${updated.name} ${updated.description || ''}`);

    await this.client.upsert(QdrantDataService.COLLECTIONS.PROJECTS, {
      wait: true,
      points: [{
        id: projectId,
        vector: embedding,
        payload: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          lastAccessed: updated.lastAccessed.toISOString(),
        }
      }]
    });

    this.logger.info('Updated project', { projectId });
  }

  async deleteProject(projectId: string): Promise<void> {
    // Delete project and all related data
    await Promise.all([
      this.client.delete(QdrantDataService.COLLECTIONS.PROJECTS, {
        wait: true,
        points: [projectId]
      }),
      // Delete all entities in this project
      this.client.delete(QdrantDataService.COLLECTIONS.ENTITIES, {
        wait: true,
        filter: {
          must: [{ key: 'projectId', match: { value: projectId } }]
        }
      }),
      // Delete all relationships in this project
      this.client.delete(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
        wait: true,
        filter: {
          must: [{ key: 'projectId', match: { value: projectId } }]
        }
      })
    ]);

    this.logger.info('Deleted project and all related data', { projectId });
  }

  // ENTITY OPERATIONS
  async createEntity(entity: Omit<QdrantEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<QdrantEntity> {
    const id = uuidv4();
    const now = new Date();
    const fullEntity: QdrantEntity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const embedding = await this.generateEmbedding(
      `${entity.name} ${entity.type} ${entity.description || ''} ${JSON.stringify(entity.metadata)}`
    );

    await this.client.upsert(QdrantDataService.COLLECTIONS.ENTITIES, {
      wait: true,
      points: [{
        id,
        vector: embedding,
        payload: {
          ...fullEntity,
          createdAt: fullEntity.createdAt.toISOString(),
          updatedAt: fullEntity.updatedAt.toISOString(),
        }
      }]
    });

    this.logger.info('Created entity', { entityId: id, name: entity.name, projectId: entity.projectId });
    return fullEntity;
  }

  async getEntity(projectId: string, entityId: string): Promise<QdrantEntity | null> {
    try {
      const result = await this.client.retrieve(QdrantDataService.COLLECTIONS.ENTITIES, {
        ids: [entityId],
        with_payload: true,
      });

      if (result.length === 0) return null;

      const point = result[0];
      const entity = {
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        updatedAt: new Date(point.payload!.updatedAt as string),
      };

      // Verify it belongs to the project
      if (entity.projectId !== projectId) return null;

      return entity;
    } catch (error) {
      this.logger.error('Failed to get entity', { projectId, entityId, error });
      return null;
    }
  }

  async getEntitiesByProject(projectId: string, limit: number = 100, offset: number = 0): Promise<QdrantEntity[]> {
    try {
      const result = await this.client.scroll(QdrantDataService.COLLECTIONS.ENTITIES, {
        filter: {
          must: [{ key: 'projectId', match: { value: projectId } }]
        },
        limit,
        offset,
        with_payload: true,
      });

      return result.points.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        updatedAt: new Date(point.payload!.updatedAt as string),
      }));
    } catch (error) {
      this.logger.error('Failed to get entities by project', { projectId, error });
      return [];
    }
  }

  async searchEntities(projectId: string, query: string, limit: number = 10): Promise<QdrantEntity[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const result = await this.client.search(QdrantDataService.COLLECTIONS.ENTITIES, {
        vector: queryEmbedding,
        filter: {
          must: [{ key: 'projectId', match: { value: projectId } }]
        },
        limit,
        with_payload: true,
      });

      return result.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        updatedAt: new Date(point.payload!.updatedAt as string),
      }));
    } catch (error) {
      this.logger.error('Failed to search entities', { projectId, query, error });
      return [];
    }
  }

  async updateEntity(projectId: string, entityId: string, updates: Partial<QdrantEntity>): Promise<void> {
    const existing = await this.getEntity(projectId, entityId);
    if (!existing) throw new Error('Entity not found');

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    const embedding = await this.generateEmbedding(
      `${updated.name} ${updated.type} ${updated.description || ''} ${JSON.stringify(updated.metadata)}`
    );

    await this.client.upsert(QdrantDataService.COLLECTIONS.ENTITIES, {
      wait: true,
      points: [{
        id: entityId,
        vector: embedding,
        payload: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        }
      }]
    });

    this.logger.info('Updated entity', { projectId, entityId });
  }

  async deleteEntity(projectId: string, entityId: string): Promise<void> {
    // Delete entity and all related relationships
    await Promise.all([
      this.client.delete(QdrantDataService.COLLECTIONS.ENTITIES, {
        wait: true,
        points: [entityId]
      }),
      // Delete relationships where this entity is source or target
      this.client.delete(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
        wait: true,
        filter: {
          should: [
            { key: 'sourceId', match: { value: entityId } },
            { key: 'targetId', match: { value: entityId } }
          ]
        }
      })
    ]);

    this.logger.info('Deleted entity and related relationships', { projectId, entityId });
  }

  // RELATIONSHIP OPERATIONS
  async createRelationship(relationship: Omit<QdrantRelationship, 'id' | 'createdAt'>): Promise<QdrantRelationship> {
    const id = uuidv4();
    const now = new Date();
    const fullRelationship: QdrantRelationship = {
      ...relationship,
      id,
      createdAt: now,
    };

    const embedding = await this.generateEmbedding(
      `${relationship.type} ${relationship.description || ''} relationship from ${relationship.sourceId} to ${relationship.targetId}`
    );

    await this.client.upsert(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
      wait: true,
      points: [{
        id,
        vector: embedding,
        payload: {
          ...fullRelationship,
          createdAt: fullRelationship.createdAt.toISOString(),
        }
      }]
    });

    this.logger.info('Created relationship', { relationshipId: id, projectId: relationship.projectId });
    return fullRelationship;
  }

  async getRelationshipsByEntity(projectId: string, entityId: string): Promise<QdrantRelationship[]> {
    try {
      const result = await this.client.scroll(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
        filter: {
          must: [
            { key: 'projectId', match: { value: projectId } },
            {
              should: [
                { key: 'sourceId', match: { value: entityId } },
                { key: 'targetId', match: { value: entityId } }
              ]
            }
          ]
        },
        limit: 1000,
        with_payload: true,
      });

      return result.points.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
      }));
    } catch (error) {
      this.logger.error('Failed to get relationships by entity', { projectId, entityId, error });
      return [];
    }
  }

  async getAllRelationships(projectId: string): Promise<QdrantRelationship[]> {
    try {
      const result = await this.client.scroll(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
        filter: {
          must: [{ key: 'projectId', match: { value: projectId } }]
        },
        limit: 1000,
        with_payload: true,
      });

      return result.points.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
      }));
    } catch (error) {
      this.logger.error('Failed to get all relationships', { projectId, error });
      return [];
    }
  }

  async deleteRelationship(projectId: string, relationshipId: string): Promise<void> {
    try {
      await this.client.delete(QdrantDataService.COLLECTIONS.RELATIONSHIPS, {
        wait: true,
        points: [relationshipId]
      });

      this.logger.info('Deleted relationship', { projectId, relationshipId });
    } catch (error) {
      this.logger.error('Failed to delete relationship', { projectId, relationshipId, error });
      throw error;
    }
  }

  // USER SETTINGS OPERATIONS
  async getUserSettings(userId: string): Promise<QdrantUserSettings | null> {
    try {
      const result = await this.client.scroll(QdrantDataService.COLLECTIONS.SETTINGS, {
        filter: {
          must: [{ key: 'userId', match: { value: userId } }]
        },
        limit: 1,
        with_payload: true,
      });

      if (result.points.length === 0) return null;

      const point = result.points[0];
      return {
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        updatedAt: new Date(point.payload!.updatedAt as string),
      };
    } catch (error) {
      this.logger.error('Failed to get user settings', { userId, error });
      return null;
    }
  }

  async saveUserSettings(settings: QdrantUserSettings): Promise<void> {
    const embedding = await this.generateEmbedding(
      `user settings ${settings.userId} ${JSON.stringify(settings.aiConfiguration)} ${JSON.stringify(settings.aiFeatures)}`
    );

    await this.client.upsert(QdrantDataService.COLLECTIONS.SETTINGS, {
      wait: true,
      points: [{
        id: settings.id,
        vector: embedding,
        payload: {
          ...settings,
          createdAt: settings.createdAt.toISOString(),
          updatedAt: settings.updatedAt.toISOString(),
        }
      }]
    });

    this.logger.info('Saved user settings', { userId: settings.userId });
  }

  // SIMILARITY AND DISCOVERY OPERATIONS
  async findSimilarEntities(projectId: string, entityId: string, limit: number = 5): Promise<QdrantEntity[]> {
    try {
      // Get the entity's vector
      const entityResult = await this.client.retrieve(QdrantDataService.COLLECTIONS.ENTITIES, {
        ids: [entityId],
        with_vector: true,
      });

      if (entityResult.length === 0) return [];

      const entityVector = entityResult[0].vector as number[];

      // Find similar entities
      const result = await this.client.search(QdrantDataService.COLLECTIONS.ENTITIES, {
        vector: entityVector,
        filter: {
          must: [
            { key: 'projectId', match: { value: projectId } },
            { key: 'id', match: { value: entityId }, operator: 'not_equal' } // Exclude self
          ]
        },
        limit,
        with_payload: true,
      });

      return result.map(point => ({
        ...point.payload as any,
        createdAt: new Date(point.payload!.createdAt as string),
        updatedAt: new Date(point.payload!.updatedAt as string),
      }));
    } catch (error) {
      this.logger.error('Failed to find similar entities', { projectId, entityId, error });
      return [];
    }
  }

  // HEALTH CHECK
  async healthCheck(): Promise<{ status: string; collections: string[]; totalPoints: number }> {
    try {
      const collections = await this.client.getCollections();
      let totalPoints = 0;

      for (const collection of collections.collections) {
        const info = await this.client.getCollection(collection.name);
        totalPoints += info.points_count || 0;
      }

      return {
        status: 'healthy',
        collections: collections.collections.map(c => c.name),
        totalPoints
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        collections: [],
        totalPoints: 0
      };
    }
  }
}

// Export singleton instance
export const qdrantDataService = new QdrantDataService(); 