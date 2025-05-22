import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './DatabaseService';
import { logger } from './Logger';
import { Entity, entityService } from './EntityService';

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
  createdAt?: string;
}

export interface CreateRelationshipRequest {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  description?: string;
}

export interface RelationshipFilter {
  fromId?: string;
  toId?: string;
  type?: string;
}

export class RelationshipService {
  private static instance: RelationshipService;

  static getInstance(): RelationshipService {
    if (!RelationshipService.instance) {
      RelationshipService.instance = new RelationshipService();
    }
    return RelationshipService.instance;
  }

  async createRelationship(
    projectId: string, 
    request: CreateRelationshipRequest
  ): Promise<Relationship | null> {
    const { fromEntityId, toEntityId, type, description } = request;
    
    logger.info('Creating relationship', {
      projectId,
      operation: 'createRelationship',
      fromEntityId,
      toEntityId,
      type
    });

    return databaseService.withTransaction(projectId, async () => {
      // Verify both entities exist
      const fromEntity = await entityService.getEntity(projectId, fromEntityId);
      const toEntity = await entityService.getEntity(projectId, toEntityId);

      if (!fromEntity) {
        logger.warn('Cannot create relationship: source entity not found', {
          projectId,
          fromEntityId
        });
        return null;
      }

      if (!toEntity) {
        logger.warn('Cannot create relationship: target entity not found', {
          projectId,
          toEntityId
        });
        return null;
      }

      const relationshipId = `rel_${uuidv4()}`;
      const now = new Date().toISOString();

      const createQuery = `
        MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
        CREATE (from)-[r:${type.toUpperCase()} {
          id: $relationshipId,
          type: $type,
          description: $description,
          createdAt: $createdAt
        }]->(to)
        RETURN r
      `;

      const params = {
        fromId: fromEntityId,
        toId: toEntityId,
        relationshipId,
        type,
        description: description || '',
        createdAt: now
      };

      const result = await databaseService.executeQuery(projectId, createQuery, params);

      if (!result || !(result as any).hasNext()) {
        logger.error('Failed to create relationship in database', undefined, {
          projectId,
          fromEntityId,
          toEntityId,
          type
        });
        return null;
      }

      logger.info('Relationship created successfully', {
        projectId,
        relationshipId,
        fromEntityId,
        toEntityId,
        type
      });

      return {
        id: relationshipId,
        from: fromEntityId,
        to: toEntityId,
        type,
        description,
        createdAt: now
      };
    });
  }

  async getRelationships(
    projectId: string, 
    filters: RelationshipFilter = {}
  ): Promise<Relationship[]> {
    logger.debug('Retrieving relationships', {
      projectId,
      operation: 'getRelationships',
      filters
    });

    let query = 'MATCH (from:Entity)-[r]->(to:Entity)';
    const params: any = {};
    const whereConditions: string[] = [];

    if (filters.fromId) {
      whereConditions.push('from.id = $fromId');
      params.fromId = filters.fromId;
    }

    if (filters.toId) {
      whereConditions.push('to.id = $toId');
      params.toId = filters.toId;
    }

    if (filters.type) {
      whereConditions.push('r.type = $type');
      params.type = filters.type;
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ' RETURN r, from.id as fromId, to.id as toId ORDER BY r.createdAt DESC';

    const result = await databaseService.executeQuery(projectId, query, params);

    if (!result) {
      logger.error('Failed to retrieve relationships', undefined, { projectId });
      return [];
    }

    const relationships: Relationship[] = [];
    try {
      while ((result as any).hasNext()) {
        const record = (result as any).getNext();
        const relationshipData = record.get('r');
        const fromId = record.get('fromId');
        const toId = record.get('toId');

        const relationship = this.parseRelationshipFromDB(relationshipData, fromId, toId);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    } catch (error) {
      logger.error('Failed to parse relationships from database', error, { projectId });
    }

    logger.debug('Retrieved relationships', { projectId, count: relationships.length });
    return relationships;
  }

  async getRelatedEntities(
    projectId: string,
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<Entity[]> {
    logger.debug('Retrieving related entities', {
      projectId,
      entityId,
      operation: 'getRelatedEntities',
      relationshipType,
      direction
    });

    let query = '';
    const params: any = { entityId };

    switch (direction) {
      case 'outgoing':
        query = 'MATCH (e:Entity {id: $entityId})-[r]->(related:Entity)';
        break;
      case 'incoming':
        query = 'MATCH (related:Entity)-[r]->(e:Entity {id: $entityId})';
        break;
      case 'both':
        query = 'MATCH (e:Entity {id: $entityId})-[r]-(related:Entity)';
        break;
    }

    if (relationshipType) {
      query += ` WHERE r.type = $relationshipType`;
      params.relationshipType = relationshipType;
    }

    query += ' RETURN DISTINCT related ORDER BY related.name';

    const result = await databaseService.executeQuery(projectId, query, params);

    if (!result) {
      logger.error('Failed to retrieve related entities', undefined, { projectId, entityId });
      return [];
    }

    const entities: Entity[] = [];
    try {
      while ((result as any).hasNext()) {
        const record = (result as any).getNext();
        const entityData = record.get('related');
        const entity = entityService['parseEntityFromDB'](entityData);
        
        if (entity) {
          entities.push(entity);
        }
      }
    } catch (error) {
      logger.error('Failed to parse related entities from database', error, { 
        projectId, 
        entityId 
      });
    }

    logger.debug('Retrieved related entities', { 
      projectId, 
      entityId, 
      count: entities.length 
    });
    return entities;
  }

  async deleteRelationship(projectId: string, relationshipId: string): Promise<boolean> {
    logger.info('Deleting relationship', {
      projectId,
      relationshipId,
      operation: 'deleteRelationship'
    });

    return databaseService.withTransaction(projectId, async () => {
      const deleteQuery = `
        MATCH ()-[r {id: $relationshipId}]-()
        DELETE r
      `;

      const result = await databaseService.executeQuery(projectId, deleteQuery, {
        relationshipId
      });

      if (result) {
        logger.info('Relationship deleted successfully', { projectId, relationshipId });
        return true;
      } else {
        logger.error('Failed to delete relationship', undefined, { projectId, relationshipId });
        return false;
      }
    }) || false;
  }

  async deleteRelationshipsByEntity(projectId: string, entityId: string): Promise<boolean> {
    logger.info('Deleting all relationships for entity', {
      projectId,
      entityId,
      operation: 'deleteRelationshipsByEntity'
    });

    return databaseService.withTransaction(projectId, async () => {
      const deleteQuery = `
        MATCH (e:Entity {id: $entityId})-[r]-()
        DELETE r
      `;

      const result = await databaseService.executeQuery(projectId, deleteQuery, { entityId });

      if (result) {
        logger.info('Entity relationships deleted successfully', { projectId, entityId });
        return true;
      } else {
        logger.error('Failed to delete entity relationships', undefined, { 
          projectId, 
          entityId 
        });
        return false;
      }
    }) || false;
  }

  async getGraphData(projectId: string): Promise<{ nodes: Entity[], links: Relationship[] }> {
    logger.debug('Retrieving graph data', { projectId, operation: 'getGraphData' });

    try {
      const [entities, relationships] = await Promise.all([
        entityService.getAllEntities(projectId),
        this.getRelationships(projectId)
      ]);

      logger.debug('Retrieved graph data', {
        projectId,
        nodesCount: entities.length,
        linksCount: relationships.length
      });

      return {
        nodes: entities,
        links: relationships
      };
    } catch (error) {
      logger.error('Failed to retrieve graph data', error, { projectId });
      return { nodes: [], links: [] };
    }
  }

  private parseRelationshipFromDB(
    relationshipData: any, 
    fromId: string, 
    toId: string
  ): Relationship | null {
    try {
      return {
        id: relationshipData.id,
        from: fromId,
        to: toId,
        type: relationshipData.type,
        description: relationshipData.description,
        createdAt: relationshipData.createdAt
      };
    } catch (error) {
      logger.error('Failed to parse relationship from database', error);
      return null;
    }
  }
}

export const relationshipService = RelationshipService.getInstance(); 