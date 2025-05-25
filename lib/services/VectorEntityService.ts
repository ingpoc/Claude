import { v4 as uuidv4 } from 'uuid';
import { qdrantService, EntityVector, SearchResult } from './QdrantService';
import { logger } from './Logger';

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  projectId: string;
  relationships: string[];
  conversationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityRequest {
  name: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  projectId: string;
}

export interface UpdateEntityRequest {
  name?: string;
  type?: string;
  description?: string;
  metadata?: Record<string, any>;
  relationships?: string[];
  conversationIds?: string[];
}

export interface EntitySearchResult extends Entity {
  score: number;
}

export class VectorEntityService {
  async createEntity(request: CreateEntityRequest): Promise<Entity> {
    const now = new Date().toISOString();
    const entityId = uuidv4();
    const entity: Entity = {
      id: entityId,
      name: request.name,
      type: request.type,
      description: request.description,
      metadata: request.metadata || {},
      projectId: request.projectId,
      relationships: [],
      conversationIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const { id, ...payload } = entity;
    await qdrantService.upsertEntity({
      id: entity.id,
      payload,
    });

    logger.info('Entity created', { entityId: entity.id, projectId: entity.projectId });
    return entity;
  }

  async getEntity(entityId: string): Promise<Entity | null> {
    const result = await qdrantService.getEntity(entityId);
    if (!result) return null;

    return {
      id: result.id,
      ...result.payload,
    };
  }

  async updateEntity(entityId: string, updates: UpdateEntityRequest): Promise<Entity | null> {
    const existing = await this.getEntity(entityId);
    if (!existing) return null;

    const updated: Entity = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await qdrantService.upsertEntity({
      id: entityId,
      payload: updated,
    });

    logger.info('Entity updated', { entityId, projectId: updated.projectId });
    return updated;
  }

  async deleteEntity(entityId: string): Promise<boolean> {
    const existing = await this.getEntity(entityId);
    if (!existing) return false;

    await qdrantService.deleteEntity(entityId);
    logger.info('Entity deleted', { entityId, projectId: existing.projectId });
    return true;
  }

  async getAllEntities(projectId: string, offset: number = 0, limit: number = 100): Promise<Entity[]> {
    const results = await qdrantService.getAllEntities(projectId, offset, limit);
    return results.map(result => ({
      id: result.id,
      ...result.payload,
    }));
  }

  async searchEntities(
    query: string,
    projectId: string,
    options: {
      limit?: number;
      type?: string;
      minScore?: number;
    } = {}
  ): Promise<EntitySearchResult[]> {
    const { limit = 10, type, minScore = 0.5 } = options;
    
    const filter: Record<string, any> = {};
    if (type) {
      filter.type = type;
    }

    const results = await qdrantService.searchEntities(query, projectId, limit, filter);
    
    return results
      .filter(result => result.score >= minScore)
      .map(result => ({
        id: result.id,
        ...result.payload,
        score: result.score,
      }));
  }

  async findSimilarEntities(
    entityId: string,
    projectId: string,
    limit: number = 5
  ): Promise<EntitySearchResult[]> {
    const results = await qdrantService.findSimilarEntities(entityId, projectId, limit);
    
    return results.map(result => ({
      id: result.id,
      ...result.payload,
      score: result.score,
    }));
  }

  async addRelationship(fromEntityId: string, toEntityId: string): Promise<boolean> {
    const fromEntity = await this.getEntity(fromEntityId);
    const toEntity = await this.getEntity(toEntityId);
    
    if (!fromEntity || !toEntity) return false;

    // Add relationship to both entities
    if (!fromEntity.relationships.includes(toEntityId)) {
      fromEntity.relationships.push(toEntityId);
      await this.updateEntity(fromEntityId, { relationships: fromEntity.relationships });
    }

    if (!toEntity.relationships.includes(fromEntityId)) {
      toEntity.relationships.push(fromEntityId);
      await this.updateEntity(toEntityId, { relationships: toEntity.relationships });
    }

    logger.info('Relationship added', { fromEntityId, toEntityId });
    return true;
  }

  async removeRelationship(fromEntityId: string, toEntityId: string): Promise<boolean> {
    const fromEntity = await this.getEntity(fromEntityId);
    const toEntity = await this.getEntity(toEntityId);
    
    if (!fromEntity || !toEntity) return false;

    // Remove relationship from both entities
    fromEntity.relationships = fromEntity.relationships.filter(id => id !== toEntityId);
    toEntity.relationships = toEntity.relationships.filter(id => id !== fromEntityId);

    await this.updateEntity(fromEntityId, { relationships: fromEntity.relationships });
    await this.updateEntity(toEntityId, { relationships: toEntity.relationships });

    logger.info('Relationship removed', { fromEntityId, toEntityId });
    return true;
  }

  async getRelatedEntities(entityId: string): Promise<Entity[]> {
    const entity = await this.getEntity(entityId);
    if (!entity) return [];

    const relatedEntities: Entity[] = [];
    for (const relatedId of entity.relationships) {
      const related = await this.getEntity(relatedId);
      if (related) {
        relatedEntities.push(related);
      }
    }

    return relatedEntities;
  }

  async linkConversation(entityId: string, conversationId: string): Promise<boolean> {
    const entity = await this.getEntity(entityId);
    if (!entity) return false;

    if (!entity.conversationIds.includes(conversationId)) {
      entity.conversationIds.push(conversationId);
      await this.updateEntity(entityId, { conversationIds: entity.conversationIds });
      logger.debug('Conversation linked to entity', { entityId, conversationId });
    }

    return true;
  }

  async getEntityTypes(projectId: string): Promise<string[]> {
    const entities = await this.getAllEntities(projectId);
    const types = new Set(entities.map(entity => entity.type));
    return Array.from(types).sort();
  }

  async getEntityStats(projectId: string): Promise<{
    totalEntities: number;
    typeDistribution: Record<string, number>;
    averageRelationships: number;
  }> {
    const entities = await this.getAllEntities(projectId);
    
    const typeDistribution: Record<string, number> = {};
    let totalRelationships = 0;

    entities.forEach(entity => {
      typeDistribution[entity.type] = (typeDistribution[entity.type] || 0) + 1;
      totalRelationships += entity.relationships.length;
    });

    return {
      totalEntities: entities.length,
      typeDistribution,
      averageRelationships: entities.length > 0 ? totalRelationships / entities.length : 0,
    };
  }

  // Auto-suggest relationships based on vector similarity
  async suggestRelationships(
    entityId: string,
    projectId: string,
    limit: number = 5,
    minScore: number = 0.7
  ): Promise<EntitySearchResult[]> {
    const entity = await this.getEntity(entityId);
    if (!entity) return [];

    const similar = await this.findSimilarEntities(entityId, projectId, limit * 2);
    
    // Filter out already related entities and low scores
    return similar
      .filter(candidate => 
        !entity.relationships.includes(candidate.id) && 
        candidate.score >= minScore
      )
      .slice(0, limit);
  }

  // Extract entities from text using AI
  async extractEntitiesFromText(
    text: string,
    projectId: string,
    options: {
      autoCreate?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<{
    entities: EntitySearchResult[];
    suggestions: string[];
  }> {
    const { autoCreate = false, minConfidence = 0.6 } = options;
    
    // Search for existing entities that match the text
    const searchResults = await this.searchEntities(text, projectId, {
      limit: 20,
      minScore: minConfidence,
    });

    // TODO: Implement AI-based entity extraction from text
    // This would use the OpenAI API to identify potential entities in the text
    // and suggest new entities to create
    
    const suggestions: string[] = [];
    
    return {
      entities: searchResults,
      suggestions,
    };
  }
}

export const vectorEntityService = new VectorEntityService(); 