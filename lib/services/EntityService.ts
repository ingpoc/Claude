import { v4 as uuidv4 } from 'uuid';
import { qdrantDataService } from './QdrantDataService';
import { logger } from './Logger';

export interface Observation {
  id: string;
  text: string;
  createdAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: Observation[];
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEntityRequest {
  name: string;
  type: string;
  description: string;
  observationsText?: string[];
  parentId?: string;
}

export interface UpdateEntityRequest {
  name?: string;
  type?: string;
  description?: string;
  observations?: Observation[];
  parentId?: string;
}

export class EntityService {
  private static instance: EntityService;

  static getInstance(): EntityService {
    if (!EntityService.instance) {
      EntityService.instance = new EntityService();
    }
    return EntityService.instance;
  }

  /**
   * Create a new entity
   * Note: Simplified implementation using QdrantDataService
   */
  async createEntity(projectId: string, request: CreateEntityRequest): Promise<Entity | null> {
    try {
      const id = `entity_${uuidv4()}`;
      const now = new Date().toISOString();
      const observations: Observation[] = (request.observationsText || []).map(text => ({
        id: uuidv4(),
        text,
        createdAt: now
      }));

      const entity: Entity = {
        id,
        name: request.name,
        type: request.type,
        description: request.description,
        observations,
        parentId: request.parentId,
        createdAt: now,
        updatedAt: now
      };

      // Create entity using QdrantDataService
      const qdrantEntity = await qdrantDataService.createEntity({
        name: request.name,
        type: request.type,
        description: request.description,
        projectId,
        metadata: {
          observations,
          parentId: request.parentId,
          originalCreatedAt: now,
          originalUpdatedAt: now
        }
      });

      logger.info('Entity created', { 
        entityId: id, 
        projectId, 
        name: request.name,
        type: request.type 
      });

      return entity;

    } catch (error) {
      logger.error('Failed to create entity', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        request 
      });
      return null;
    }
  }

  /**
   * Get entity by ID
   * Note: Simplified implementation using QdrantDataService
   */
  async getEntity(projectId: string, entityId: string): Promise<Entity | null> {
    try {
      const qdrantEntity = await qdrantDataService.getEntity(projectId, entityId);
      if (!qdrantEntity) {
        return null;
      }

      // Convert QdrantEntity to Entity
      const entity: Entity = {
        id: qdrantEntity.id,
        name: qdrantEntity.name,
        type: qdrantEntity.type,
        description: qdrantEntity.description || '',
        observations: qdrantEntity.metadata.observations || [],
        parentId: qdrantEntity.metadata.parentId,
        createdAt: qdrantEntity.metadata.originalCreatedAt || qdrantEntity.createdAt.toISOString(),
        updatedAt: qdrantEntity.metadata.originalUpdatedAt || qdrantEntity.updatedAt.toISOString()
      };

      return entity;

    } catch (error) {
      logger.error('Failed to get entity', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId 
      });
      return null;
    }
  }

  /**
   * Get all entities for a project
   * Note: Simplified implementation using QdrantDataService
   */
  async getAllEntities(projectId: string, type?: string): Promise<Entity[]> {
    try {
      const qdrantEntities = await qdrantDataService.getEntitiesByProject(projectId, 100, 0);
      
      // Convert QdrantEntities to Entities
      const entities: Entity[] = qdrantEntities
        .filter(qe => !type || qe.type === type)
        .map(qe => ({
          id: qe.id,
          name: qe.name,
          type: qe.type,
          description: qe.description || '',
          observations: qe.metadata.observations || [],
          parentId: qe.metadata.parentId,
          createdAt: qe.metadata.originalCreatedAt || qe.createdAt.toISOString(),
          updatedAt: qe.metadata.originalUpdatedAt || qe.updatedAt.toISOString()
        }));

      logger.info('Retrieved entities', { projectId, count: entities.length, type });
      return entities;

    } catch (error) {
      logger.error('Failed to retrieve entities', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId 
      });
      return [];
    }
  }

  /**
   * Update an entity
   * Note: Simplified implementation using QdrantDataService
   */
  async updateEntity(
    projectId: string, 
    entityId: string, 
    updates: UpdateEntityRequest
  ): Promise<Entity | null> {
    try {
      // Get the original QdrantEntity to preserve metadata structure
      const qdrantEntity = await qdrantDataService.getEntity(projectId, entityId);
      if (!qdrantEntity) {
        logger.warn('Cannot update entity: entity not found', { projectId, entityId });
        return null;
      }

      // Update entity using QdrantDataService with proper metadata structure
      await qdrantDataService.updateEntity(projectId, entityId, {
        name: updates.name,
        type: updates.type,
        description: updates.description,
        metadata: {
          ...qdrantEntity.metadata, // Preserve existing metadata structure
          observations: updates.observations || qdrantEntity.metadata.observations || [],
          parentId: updates.parentId !== undefined ? updates.parentId : qdrantEntity.metadata.parentId,
          originalUpdatedAt: new Date().toISOString()
        }
      });

      // Return updated entity
      return await this.getEntity(projectId, entityId);

    } catch (error) {
      logger.error('Failed to update entity', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId 
      });
      return null;
    }
  }

  /**
   * Delete an entity
   * Note: Simplified implementation using QdrantDataService
   */
  async deleteEntity(projectId: string, entityId: string): Promise<boolean> {
    try {
      await qdrantDataService.deleteEntity(projectId, entityId);
      
      logger.info('Entity deleted successfully', { projectId, entityId });
      return true;

    } catch (error) {
      logger.error('Failed to delete entity', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId 
      });
      return false;
    }
  }

  /**
   * Add observation to entity
   * Note: Simplified implementation - observations stored in metadata
   */
  async addObservation(
    projectId: string, 
    entityId: string, 
    observationText: string
  ): Promise<{ observation_id: string } | null> {
    try {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot add observation: entity not found', { projectId, entityId });
        return null;
      }

      const observationId = uuidv4();
      const newObservation: Observation = {
        id: observationId,
        text: observationText,
        createdAt: new Date().toISOString()
      };

      const updatedObservations = [...entity.observations, newObservation];
      
      const updateResult = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (updateResult) {
        logger.info('Observation added to entity', { 
          projectId, 
          entityId, 
          observationId 
        });
        return { observation_id: observationId };
      } else {
        return null;
      }

    } catch (error) {
      logger.error('Failed to add observation', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId 
      });
      return null;
    }
  }

  /**
   * Delete observation from entity
   * Note: Simplified implementation - observations stored in metadata
   */
  async deleteObservation(
    projectId: string, 
    entityId: string, 
    observationId: string
  ): Promise<boolean> {
    try {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot delete observation: entity not found', { projectId, entityId });
        return false;
      }

      const updatedObservations = entity.observations.filter(obs => obs.id !== observationId);
      
             const updateResult = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (updateResult) {
        logger.info('Observation deleted from entity', { 
          projectId, 
          entityId, 
          observationId 
        });
        return true;
      } else {
        return false;
      }

    } catch (error) {
      logger.error('Failed to delete observation', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId, 
        observationId 
      });
      return false;
    }
  }

  /**
   * Edit observation text
   * Note: Simplified implementation - observations stored in metadata
   */
  async editObservation(
    projectId: string,
    entityId: string,
    observationId: string,
    newText: string
  ): Promise<Observation | null> {
    try {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot edit observation: entity not found', { projectId, entityId });
        return null;
      }

      const observationIndex = entity.observations.findIndex(obs => obs.id === observationId);
      if (observationIndex === -1) {
        logger.warn('Cannot edit observation: observation not found', { 
          projectId, 
          entityId, 
          observationId 
        });
        return null;
      }

      const updatedObservations = [...entity.observations];
      updatedObservations[observationIndex] = {
        ...updatedObservations[observationIndex],
        text: newText
      };
      
      const updateResult = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (updateResult) {
        logger.info('Observation edited', { 
          projectId, 
          entityId, 
          observationId 
        });
        return updatedObservations[observationIndex];
      } else {
        return null;
      }

    } catch (error) {
      logger.error('Failed to edit observation', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        entityId, 
        observationId 
      });
      return null;
    }
  }

  /**
   * Parse entity data from database format
   */
  private parseEntityFromDB(entityData: any): Entity | null {
    if (!entityData) return null;

    try {
      return {
        id: entityData.id,
        name: entityData.name,
        type: entityData.type,
        description: entityData.description || '',
        observations: this.parseObservations(entityData.observations),
        parentId: entityData.parentId,
        createdAt: entityData.createdAt,
        updatedAt: entityData.updatedAt
      };
    } catch (error) {
      logger.error('Failed to parse entity from database', { error, entityData });
      return null;
    }
  }

  /**
   * Parse observations from various formats
   */
  private parseObservations(obsData: string | Observation[] | null | undefined): Observation[] {
    if (!obsData) return [];
    
    if (Array.isArray(obsData)) {
      return obsData;
    }
    
    if (typeof obsData === 'string') {
      try {
        const parsed = JSON.parse(obsData);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    
    return [];
  }
}

export const entityService = EntityService.getInstance(); 