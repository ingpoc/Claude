import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './DatabaseService';
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

  async createEntity(projectId: string, request: CreateEntityRequest): Promise<Entity | null> {
    const { name, type, description, observationsText = [], parentId } = request;
    
    logger.info('Creating entity', { 
      projectId, 
      operation: 'createEntity',
      entityName: name,
      entityType: type 
    });

    return databaseService.withTransaction(projectId, async () => {
      const id = `entity_${uuidv4()}`;
      const now = new Date().toISOString();
      const observations: Observation[] = observationsText.map(text => ({
        id: `obs_${uuidv4()}`,
        text,
        createdAt: now
      }));

      const params = {
        id,
        name,
        type,
        description,
        observationsJson: JSON.stringify(observations),
        parentId: parentId || '',
        createdAt: now,
        updatedAt: now
      };

      const createQuery = `
        CREATE (e:Entity {
          id: $id,
          name: $name,
          type: $type,
          description: $description,
          observations: $observationsJson,
          parentId: $parentId,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
      `;

      const result = await databaseService.executeQuery(projectId, createQuery, params);
      
      if (!result) {
        logger.error('Failed to create entity in database', undefined, { 
          projectId, 
          entityName: name 
        });
        return null;
      }

      logger.info('Entity created successfully', { 
        projectId, 
        entityId: id,
        entityName: name 
      });

      return {
        id,
        name,
        type,
        description,
        observations,
        parentId,
        createdAt: now,
        updatedAt: now
      };
    });
  }

  async getEntity(projectId: string, entityId: string): Promise<Entity | null> {
    logger.debug('Retrieving entity', { projectId, entityId, operation: 'getEntity' });

    const query = 'MATCH (e:Entity {id: $id}) RETURN e';
    const result = await databaseService.executeQuery(projectId, query, { id: entityId });

    if (!result || !(result as any).hasNext()) {
      logger.warn('Entity not found', { projectId, entityId });
      return null;
    }

    try {
      const record = (result as any).getNext();
      const entityData = record.get('e');
      
      return this.parseEntityFromDB(entityData);
    } catch (error) {
      logger.error('Failed to parse entity from database', error, { projectId, entityId });
      return null;
    }
  }

  async getAllEntities(projectId: string, type?: string): Promise<Entity[]> {
    logger.debug('Retrieving all entities', { 
      projectId, 
      operation: 'getAllEntities',
      filterType: type 
    });

    const query = type 
      ? 'MATCH (e:Entity {type: $type}) RETURN e ORDER BY e.name'
      : 'MATCH (e:Entity) RETURN e ORDER BY e.name';
    
    const params = type ? { type } : undefined;
    const result = await databaseService.executeQuery(projectId, query, params);

    if (!result) {
      logger.error('Failed to retrieve entities', undefined, { projectId });
      return [];
    }

    const entities: Entity[] = [];
    try {
      while ((result as any).hasNext()) {
        const record = (result as any).getNext();
        const entityData = record.get('e');
        const entity = this.parseEntityFromDB(entityData);
        
        if (entity) {
          entities.push(entity);
        }
      }
    } catch (error) {
      logger.error('Failed to parse entities from database', error, { projectId });
    }

    logger.debug('Retrieved entities', { projectId, count: entities.length });
    return entities;
  }

  async updateEntity(
    projectId: string, 
    entityId: string, 
    updates: UpdateEntityRequest
  ): Promise<Entity | null> {
    logger.info('Updating entity', { 
      projectId, 
      entityId, 
      operation: 'updateEntity',
      updateFields: Object.keys(updates)
    });

    return databaseService.withTransaction(projectId, async () => {
      // First get the current entity
      const currentEntity = await this.getEntity(projectId, entityId);
      if (!currentEntity) {
        logger.warn('Cannot update entity: entity not found', { projectId, entityId });
        return null;
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const params: any = { id: entityId, updatedAt: new Date().toISOString() };

      if (updates.name !== undefined) {
        updateFields.push('e.name = $name');
        params.name = updates.name;
      }
      
      if (updates.type !== undefined) {
        updateFields.push('e.type = $type');
        params.type = updates.type;
      }
      
      if (updates.description !== undefined) {
        updateFields.push('e.description = $description');
        params.description = updates.description;
      }
      
      if (updates.observations !== undefined) {
        updateFields.push('e.observations = $observationsJson');
        params.observationsJson = JSON.stringify(updates.observations);
      }
      
      if (updates.parentId !== undefined) {
        updateFields.push('e.parentId = $parentId');
        params.parentId = updates.parentId;
      }

      updateFields.push('e.updatedAt = $updatedAt');

      const updateQuery = `
        MATCH (e:Entity {id: $id})
        SET ${updateFields.join(', ')}
        RETURN e
      `;

      const result = await databaseService.executeQuery(projectId, updateQuery, params);
      
      if (!result || !(result as any).hasNext()) {
        logger.error('Failed to update entity', undefined, { projectId, entityId });
        return null;
      }

      try {
        const record = (result as any).getNext();
        const entityData = record.get('e');
        const updatedEntity = this.parseEntityFromDB(entityData);
        
        logger.info('Entity updated successfully', { projectId, entityId });
        return updatedEntity;
      } catch (error) {
        logger.error('Failed to parse updated entity', error, { projectId, entityId });
        return null;
      }
    });
  }

  async deleteEntity(projectId: string, entityId: string): Promise<boolean> {
    logger.info('Deleting entity', { projectId, entityId, operation: 'deleteEntity' });

    return databaseService.withTransaction(projectId, async () => {
      // First delete all relationships involving this entity
      const deleteRelQuery = `
        MATCH (e:Entity {id: $id})-[r]-()
        DELETE r
      `;
      
      await databaseService.executeQuery(projectId, deleteRelQuery, { id: entityId });

      // Then delete the entity itself
      const deleteEntityQuery = `
        MATCH (e:Entity {id: $id})
        DELETE e
      `;
      
      const result = await databaseService.executeQuery(projectId, deleteEntityQuery, { id: entityId });
      
      if (result) {
        logger.info('Entity deleted successfully', { projectId, entityId });
        return true;
      } else {
        logger.error('Failed to delete entity', undefined, { projectId, entityId });
        return false;
      }
    }) || false;
  }

  async addObservation(
    projectId: string, 
    entityId: string, 
    observationText: string
  ): Promise<{ observation_id: string } | null> {
    logger.info('Adding observation to entity', { 
      projectId, 
      entityId, 
      operation: 'addObservation' 
    });

    return databaseService.withTransaction(projectId, async () => {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot add observation: entity not found', { projectId, entityId });
        return null;
      }

      const newObservation: Observation = {
        id: `obs_${uuidv4()}`,
        text: observationText,
        createdAt: new Date().toISOString()
      };

      const updatedObservations = [...entity.observations, newObservation];
      
      const success = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (success) {
        logger.info('Observation added successfully', { 
          projectId, 
          entityId, 
          observationId: newObservation.id 
        });
        return { observation_id: newObservation.id };
      } else {
        logger.error('Failed to add observation', undefined, { projectId, entityId });
        return null;
      }
    });
  }

  async deleteObservation(
    projectId: string, 
    entityId: string, 
    observationId: string
  ): Promise<boolean> {
    logger.info('Deleting observation from entity', { 
      projectId, 
      entityId, 
      observationId,
      operation: 'deleteObservation' 
    });

    return databaseService.withTransaction(projectId, async () => {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot delete observation: entity not found', { projectId, entityId });
        return false;
      }

      const updatedObservations = entity.observations.filter(obs => obs.id !== observationId);
      
      if (updatedObservations.length === entity.observations.length) {
        logger.warn('Observation not found', { projectId, entityId, observationId });
        return false;
      }

      const success = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (success) {
        logger.info('Observation deleted successfully', { 
          projectId, 
          entityId, 
          observationId 
        });
        return true;
      } else {
        logger.error('Failed to delete observation', undefined, { 
          projectId, 
          entityId, 
          observationId 
        });
        return false;
      }
    }) || false;
  }

  async editObservation(
    projectId: string,
    entityId: string,
    observationId: string,
    newText: string
  ): Promise<Observation | null> {
    logger.info('Editing observation', { 
      projectId, 
      entityId, 
      observationId,
      operation: 'editObservation' 
    });

    return databaseService.withTransaction(projectId, async () => {
      const entity = await this.getEntity(projectId, entityId);
      if (!entity) {
        logger.warn('Cannot edit observation: entity not found', { projectId, entityId });
        return null;
      }

      const observationIndex = entity.observations.findIndex(obs => obs.id === observationId);
      if (observationIndex === -1) {
        logger.warn('Observation not found', { projectId, entityId, observationId });
        return null;
      }

      const updatedObservations = [...entity.observations];
      updatedObservations[observationIndex] = {
        ...updatedObservations[observationIndex],
        text: newText
      };

      const success = await this.updateEntity(projectId, entityId, {
        observations: updatedObservations
      });

      if (success) {
        logger.info('Observation edited successfully', { 
          projectId, 
          entityId, 
          observationId 
        });
        return updatedObservations[observationIndex];
      } else {
        logger.error('Failed to edit observation', undefined, { 
          projectId, 
          entityId, 
          observationId 
        });
        return null;
      }
    });
  }

  private parseEntityFromDB(entityData: any): Entity | null {
    try {
      const observations = this.parseObservations(entityData.observations);
      
      return {
        id: entityData.id,
        name: entityData.name,
        type: entityData.type,
        description: entityData.description,
        observations,
        parentId: entityData.parentId || undefined,
        createdAt: entityData.createdAt,
        updatedAt: entityData.updatedAt
      };
    } catch (error) {
      logger.error('Failed to parse entity from database', error);
      return null;
    }
  }

  private parseObservations(obsData: string | Observation[] | null | undefined): Observation[] {
    if (!obsData) {
      return [];
    }
    
    if (Array.isArray(obsData)) {
      return obsData;
    }
    
    if (typeof obsData === 'string') {
      try {
        const parsed = JSON.parse(obsData);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        logger.error('Failed to parse observations JSON', error);
        return [];
      }
    }
    
    return [];
  }
}

export const entityService = EntityService.getInstance(); 