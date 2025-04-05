"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// Explicitly import only types from lib
import type { Entity, Relationship } from '@/lib/knowledgeGraph'; 
import {
    createEntity,
    createRelationship,
    addObservation,
    deleteEntity,
    deleteRelationship,
    getEntity,
    getAllEntities,
    getAllRelationshipsForContext,
    updateEntityDescription,
    getRelatedEntities as fetchRelatedEntities
} from "@/app/actions/knowledgeGraphActions"; // Import server actions
import { getProject } from '@/lib/projectManager';

// Interface for RelationshipInfo
interface RelationshipInfo {
    from: string;
    to: string;
    type: string;
}

interface ProjectState {
  projectId: string;
  projectName: string;
  projectDescription: string;
  entities: Entity[];
  relationships: RelationshipInfo[];
}

interface ProjectContextType extends Omit<ProjectState, 'projectId'> {
  projectId: string;
  addEntity: (name: string, type: string, description: string, observations?: string[], parentId?: string) => Promise<Entity | null>;
  addObservation: (entityId: string, observation: string) => Promise<boolean>;
  updateEntityDescription: (entityId: string, description: string) => Promise<boolean>;
  addRelationship: (fromId: string, toId: string, type: string) => Promise<RelationshipInfo | null>;
  deleteEntity: (entityId: string) => Promise<boolean>;
  deleteRelationship: (relationshipId: string) => Promise<boolean>;
  findEntityById: (entityId: string) => Promise<Entity | null>;
  getRelatedEntities: (entityId: string) => Promise<Array<{entity: Entity, relationship: RelationshipInfo}>>;
  refreshState: () => Promise<void>; 
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ 
  children, 
  projectId 
}: { 
  children: ReactNode;
  projectId: string;
}) => {
  const [state, setState] = useState<ProjectState>({ 
    projectId,
    projectName: '',
    projectDescription: '',
    entities: [], 
    relationships: [] 
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
        // Get project details
        const project = await getProject(projectId);
        
        // Call server actions to get data
        const [entities, relationships] = await Promise.all([
            getAllEntities(projectId),
            getAllRelationshipsForContext(projectId)
        ]);
        
        console.log(`[DEBUG] getAllEntities returned: ${JSON.stringify(entities)}`);
        
        setState({ 
          projectId,
          projectName: project?.name || projectId,
          projectDescription: project?.description || '',
          entities, 
          relationships 
        });
        
        console.log(`Refreshed state for project ${projectId}: ${entities.length} entities, ${relationships.length} relationships.`);
    } catch (error) {
        console.error(`Failed to load project ${projectId}:`, error);
        setState({ 
          projectId,
          projectName: projectId,
          projectDescription: '',
          entities: [], 
          relationships: [] 
        }); 
    } finally {
       setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Context methods now call server actions directly
  const addEntityAction = useCallback(async (name: string, type: string, description: string, observations?: string[], parentId?: string): Promise<Entity | null> => {
    const newEntity = await createEntity(projectId, name, type, description, observations, parentId);
    if (newEntity) {
      await refreshState();
    }
    return newEntity;
  }, [projectId, refreshState]);

  const addObservationAction = useCallback(async (entityId: string, observation: string): Promise<boolean> => {
    const result = await addObservation(projectId, entityId, observation);
    if (result) {
       await refreshState();
    }
    return !!result;
  }, [projectId, refreshState]);

  const updateEntityDescriptionAction = useCallback(async (entityId: string, description: string): Promise<boolean> => {
    const success = await updateEntityDescription(projectId, entityId, description);
    if (success) {
        await refreshState();
    }
    return success;
  }, [projectId, refreshState]);
  
  const addRelationshipAction = useCallback(async (fromId: string, toId: string, type: string): Promise<RelationshipInfo | null> => {
      const newRel = await createRelationship(projectId, fromId, toId, type);
      if (newRel) {
          await refreshState();
      }
      // Assuming the action returns the same structure
      return newRel as RelationshipInfo | null; 
  }, [projectId, refreshState]);

  const deleteEntityAction = useCallback(async (entityId: string): Promise<boolean> => {
      const success = await deleteEntity(projectId, entityId);
      if (success) {
          await refreshState();
      }
      return success;
  }, [projectId, refreshState]);

  const deleteRelationshipAction = useCallback(async (relationshipId: string): Promise<boolean> => {
      const success = await deleteRelationship(projectId, relationshipId);
      if (success) {
          await refreshState();
      }
      return success;
  }, [projectId, refreshState]);

  const findEntityByIdAction = useCallback(async (entityId: string) => 
    getEntity(projectId, entityId)
  , [projectId]);
  
  // Get related entities for a specific entity
  const getRelatedEntitiesAction = useCallback(async (entityId: string): Promise<Array<{entity: Entity, relationship: RelationshipInfo}>> => {
      // Use the imported fetchRelatedEntities function (renamed from getRelatedEntities to avoid conflict)
      const relatedEntities = await fetchRelatedEntities(projectId, entityId);
      
      // Create empty array to store formatted relationships
      const formattedRelationships: Array<{entity: Entity, relationship: RelationshipInfo}> = [];
      
      // Process each related entity
      for (const entity of relatedEntities) {
          formattedRelationships.push({
              entity, // This is already an Entity type from the server action
              relationship: {
                  from: '',  // These would need to be populated correctly from your backend
                  to: entityId,
                  type: ''
              }
          });
      }
      
      return formattedRelationships;
  }, [projectId]);

  const contextValue: ProjectContextType = {
    projectId,
    projectName: state.projectName,
    projectDescription: state.projectDescription,
    entities: state.entities,
    relationships: state.relationships,
    addEntity: addEntityAction,
    addObservation: addObservationAction,
    updateEntityDescription: updateEntityDescriptionAction,
    addRelationship: addRelationshipAction,
    deleteEntity: deleteEntityAction,
    deleteRelationship: deleteRelationshipAction,
    findEntityById: findEntityByIdAction,
    getRelatedEntities: getRelatedEntitiesAction,
    refreshState,
    isLoading,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}; 