import { logger } from './Logger';
import { entityService, Entity, CreateEntityRequest, UpdateEntityRequest } from './EntityService';
import { relationshipService, Relationship, CreateRelationshipRequest, RelationshipFilter } from './RelationshipService';
import { cacheService } from './CacheService';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GraphMetrics {
  totalEntities: number;
  totalRelationships: number;
  entityTypes: Record<string, number>;
  relationshipTypes: Record<string, number>;
  avgConnectionsPerEntity: number;
}

export class KnowledgeGraphService {
  private static instance: KnowledgeGraphService;

  static getInstance(): KnowledgeGraphService {
    if (!KnowledgeGraphService.instance) {
      KnowledgeGraphService.instance = new KnowledgeGraphService();
    }
    return KnowledgeGraphService.instance;
  }

  // Entity operations with caching
  async createEntity(projectId: string, request: CreateEntityRequest): Promise<Entity | null> {
    logger.info('Creating entity via KnowledgeGraphService', {
      projectId,
      entityName: request.name,
      entityType: request.type
    });

    const entity = await entityService.createEntity(projectId, request);
    
    if (entity) {
      // Cache the new entity
      cacheService.setEntity(projectId, entity.id, entity);
      // Invalidate entities list cache since we added a new entity
      cacheService.invalidateEntitiesList(projectId);
      cacheService.invalidateGraphData(projectId);
    }

    return entity;
  }

  async getEntity(projectId: string, entityId: string): Promise<Entity | null> {
    // Try cache first
    const cached = cacheService.getEntity(projectId, entityId);
    if (cached) {
      logger.debug('Entity retrieved from cache', { projectId, entityId });
      return cached;
    }

    // Get from database
    const entity = await entityService.getEntity(projectId, entityId);
    
    if (entity) {
      // Cache the result
      cacheService.setEntity(projectId, entityId, entity);
    }

    return entity;
  }

  async getAllEntities(projectId: string, type?: string): Promise<Entity[]> {
    // Try cache first
    const cached = cacheService.getEntitiesList(projectId, type);
    if (cached) {
      logger.debug('Entities list retrieved from cache', { projectId, type, count: cached.length });
      return cached;
    }

    // Get from database
    const entities = await entityService.getAllEntities(projectId, type);
    
    // Cache the result
    cacheService.setEntitiesList(projectId, entities, type);

    return entities;
  }

  async getEntitiesPaginated(
    projectId: string, 
    options: PaginationOptions, 
    type?: string
  ): Promise<PaginatedResult<Entity>> {
    logger.debug('Retrieving paginated entities', { projectId, options, type });

    // Get all entities (cached)
    const allEntities = await this.getAllEntities(projectId, type);
    
    // Apply pagination
    const { page, limit } = options;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedEntities = allEntities.slice(startIndex, endIndex);
    
    return {
      data: paginatedEntities,
      total: allEntities.length,
      page,
      limit,
      totalPages: Math.ceil(allEntities.length / limit)
    };
  }

  async updateEntity(
    projectId: string, 
    entityId: string, 
    updates: UpdateEntityRequest
  ): Promise<Entity | null> {
    const entity = await entityService.updateEntity(projectId, entityId, updates);
    
    if (entity) {
      // Update cache
      cacheService.setEntity(projectId, entityId, entity);
      // Invalidate list cache since entity data changed
      cacheService.invalidateEntitiesList(projectId);
      cacheService.invalidateGraphData(projectId);
    }

    return entity;
  }

  async deleteEntity(projectId: string, entityId: string): Promise<boolean> {
    const success = await entityService.deleteEntity(projectId, entityId);
    
    if (success) {
      // Invalidate caches
      cacheService.invalidateEntity(projectId, entityId);
      cacheService.invalidateRelationships(projectId);
    }

    return success;
  }

  // Observation operations
  async addObservation(
    projectId: string, 
    entityId: string, 
    observationText: string
  ): Promise<{ observation_id: string } | null> {
    const result = await entityService.addObservation(projectId, entityId, observationText);
    
    if (result) {
      // Invalidate entity cache since observations changed
      cacheService.invalidateEntity(projectId, entityId);
    }

    return result;
  }

  async deleteObservation(
    projectId: string, 
    entityId: string, 
    observationId: string
  ): Promise<boolean> {
    const success = await entityService.deleteObservation(projectId, entityId, observationId);
    
    if (success) {
      // Invalidate entity cache
      cacheService.invalidateEntity(projectId, entityId);
    }

    return success;
  }

  // Relationship operations with caching
  async createRelationship(
    projectId: string, 
    request: CreateRelationshipRequest
  ): Promise<Relationship | null> {
    const relationship = await relationshipService.createRelationship(projectId, request);
    
    if (relationship) {
      // Invalidate relationship and graph caches
      cacheService.invalidateRelationships(projectId);
    }

    return relationship;
  }

  async getRelationships(
    projectId: string, 
    filters: RelationshipFilter = {}
  ): Promise<Relationship[]> {
    // Create cache key from filters
    const filterKey = JSON.stringify(filters);
    
    // Try cache first
    const cached = cacheService.getRelationships(projectId, filterKey);
    if (cached) {
      logger.debug('Relationships retrieved from cache', { projectId, filters, count: cached.length });
      return cached;
    }

    // Get from database
    const relationships = await relationshipService.getRelationships(projectId, filters);
    
    // Cache the result
    cacheService.setRelationships(projectId, relationships, filterKey);

    return relationships;
  }

  async getRelatedEntities(
    projectId: string,
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<Entity[]> {
    return relationshipService.getRelatedEntities(projectId, entityId, relationshipType, direction);
  }

  async deleteRelationship(projectId: string, relationshipId: string): Promise<boolean> {
    const success = await relationshipService.deleteRelationship(projectId, relationshipId);
    
    if (success) {
      // Invalidate relationship caches
      cacheService.invalidateRelationships(projectId);
    }

    return success;
  }

  // Graph data operations with caching
  async getGraphData(projectId: string): Promise<{ nodes: Entity[], links: Relationship[] }> {
    // Try cache first
    const cached = cacheService.getGraphData(projectId);
    if (cached) {
      logger.debug('Graph data retrieved from cache', { 
        projectId, 
        nodesCount: cached.nodes.length, 
        linksCount: cached.links.length 
      });
      return cached;
    }

    // Get from database
    const data = await relationshipService.getGraphData(projectId);
    
    // Cache the result
    cacheService.setGraphData(projectId, data);

    return data;
  }

  // Advanced analytics and metrics
  async getGraphMetrics(projectId: string): Promise<GraphMetrics> {
    logger.debug('Calculating graph metrics', { projectId });

    const [entities, relationships] = await Promise.all([
      this.getAllEntities(projectId),
      this.getRelationships(projectId)
    ]);

    // Calculate entity type distribution
    const entityTypes: Record<string, number> = {};
    entities.forEach(entity => {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    });

    // Calculate relationship type distribution
    const relationshipTypes: Record<string, number> = {};
    relationships.forEach(rel => {
      relationshipTypes[rel.type] = (relationshipTypes[rel.type] || 0) + 1;
    });

    // Calculate average connections per entity
    const connectionCounts = new Map<string, number>();
    relationships.forEach(rel => {
      connectionCounts.set(rel.from, (connectionCounts.get(rel.from) || 0) + 1);
      connectionCounts.set(rel.to, (connectionCounts.get(rel.to) || 0) + 1);
    });

    const avgConnectionsPerEntity = entities.length > 0 
      ? Array.from(connectionCounts.values()).reduce((sum, count) => sum + count, 0) / entities.length 
      : 0;

    return {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entityTypes,
      relationshipTypes,
      avgConnectionsPerEntity
    };
  }

  // Search and filtering
  async searchEntities(
    projectId: string, 
    query: string, 
    type?: string,
    limit: number = 50
  ): Promise<Entity[]> {
    logger.debug('Searching entities', { projectId, query, type, limit });

    const allEntities = await this.getAllEntities(projectId, type);
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    const filteredEntities = allEntities.filter(entity => {
      const searchableText = `${entity.name} ${entity.description} ${entity.observations.map(obs => obs.text).join(' ')}`.toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    });

    // Sort by relevance (simple scoring based on term frequency)
    const scoredEntities = filteredEntities.map(entity => {
      const searchableText = `${entity.name} ${entity.description}`.toLowerCase();
      let score = 0;
      
      searchTerms.forEach(term => {
        const termCount = (searchableText.match(new RegExp(term, 'g')) || []).length;
        score += termCount;
        
        // Boost score for matches in name
        if (entity.name.toLowerCase().includes(term)) {
          score += 2;
        }
      });
      
      return { entity, score };
    });

    return scoredEntities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.entity);
  }

  // Bulk operations
  async bulkCreateEntities(
    projectId: string, 
    requests: CreateEntityRequest[]
  ): Promise<Entity[]> {
    logger.info('Bulk creating entities', { projectId, count: requests.length });

    const createdEntities: Entity[] = [];
    
    for (const request of requests) {
      const entity = await entityService.createEntity(projectId, request);
      if (entity) {
        createdEntities.push(entity);
      }
    }

    // Invalidate caches after bulk operation
    if (createdEntities.length > 0) {
      cacheService.invalidateEntitiesList(projectId);
      cacheService.invalidateGraphData(projectId);
    }

    logger.info('Bulk entity creation completed', { 
      projectId, 
      requested: requests.length, 
      created: createdEntities.length 
    });

    return createdEntities;
  }

  async bulkCreateRelationships(
    projectId: string, 
    requests: CreateRelationshipRequest[]
  ): Promise<Relationship[]> {
    logger.info('Bulk creating relationships', { projectId, count: requests.length });

    const createdRelationships: Relationship[] = [];
    
    for (const request of requests) {
      const relationship = await relationshipService.createRelationship(projectId, request);
      if (relationship) {
        createdRelationships.push(relationship);
      }
    }

    // Invalidate caches after bulk operation
    if (createdRelationships.length > 0) {
      cacheService.invalidateRelationships(projectId);
    }

    logger.info('Bulk relationship creation completed', { 
      projectId, 
      requested: requests.length, 
      created: createdRelationships.length 
    });

    return createdRelationships;
  }

  // Cache management
  getCacheStats() {
    return cacheService.getStats();
  }

  clearProjectCache(projectId: string): void {
    cacheService.invalidateProject(projectId);
  }

  clearAllCaches(): void {
    cacheService.clearAll();
  }
}

export const knowledgeGraphService = KnowledgeGraphService.getInstance(); 