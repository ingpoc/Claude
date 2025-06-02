"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// Explicitly import only types from lib
import type { Entity, Relationship } from '../lib/services'; 
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
    getRelatedEntities as fetchRelatedEntities,
    editObservation,
    deleteObservation,
    deleteProjectAction
} from "../app/actions/knowledgeGraphActions"; // Import server actions
// Removed server action getProject, using REST API for project metadata

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
  findEntityById: (entityId: string, bustCache?: boolean) => Promise<Entity | null>;
  getRelatedEntities: (entityId: string) => Promise<Array<{entity: Entity, relationship: RelationshipInfo}>>;
  refreshState: (bustCache?: boolean) => Promise<void>; 
  isLoading: boolean;
  editObservation: (entityId: string, observationId: string, newText: string) => Promise<boolean>;
  deleteObservation: (entityId: string, observationId: string) => Promise<boolean>;
  deleteProject: (projectIdToDelete: string) => Promise<boolean>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ 
  children, 
  projectId 
}: { 
  children: ReactNode;
  projectId: string;
}) => {
  // Base URL for UI API
  const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || '';
  const [state, setState] = useState<ProjectState>({ 
    projectId,
    projectName: '',
    projectDescription: '',
    entities: [], 
    relationships: [] 
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshState = useCallback(async (bustCache: boolean = false) => {
    setIsLoading(true);
    try {
      // Fetch project metadata from UI API
      let project: { id: string; name: string; description?: string } | null = null;
      try {
        const projRes = await fetch(`${API_BASE_URL}/api/ui/projects/${projectId}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (projRes.ok) {
          project = await projRes.json();
        } else {
          console.error(`Failed to fetch project ${projectId}:`, projRes.statusText);
        }
      } catch (error) {
        console.error(`Error fetching project ${projectId}:`, error);
      }
      
      // Call server actions to get data with cache busting if needed
      const [entities, relationships] = await Promise.all([
          getAllEntities(projectId, bustCache),
          getAllRelationshipsForContext(projectId, bustCache)
      ]);
      
      setState({ 
        projectId,
        projectName: project?.name || projectId,
        projectDescription: project?.description || '',
        entities, 
        relationships 
      });
      
      // console.log(`Refreshed state for project ${projectId}: ${entities.length} entities, ${relationships.length} relationships.`);
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
      await refreshState(true); // Bust cache after creating entity
    }
    return newEntity;
  }, [projectId, refreshState]);

  const addObservationAction = useCallback(async (entityId: string, observation: string): Promise<boolean> => {
    const result = await addObservation(projectId, entityId, observation);
    if (result) {
       await refreshState(true); // Bust cache after adding observation
    }
    return !!result;
  }, [projectId, refreshState]);

  const updateEntityDescriptionAction = useCallback(async (entityId: string, description: string): Promise<boolean> => {
    const success = await updateEntityDescription(projectId, entityId, description);
    if (success) {
        await refreshState(true); // Bust cache after updating entity
    }
    return success;
  }, [projectId, refreshState]);
  
  const addRelationshipAction = useCallback(async (fromId: string, toId: string, type: string): Promise<RelationshipInfo | null> => {
      const newRel = await createRelationship(projectId, fromId, toId, type);
      if (newRel) {
          await refreshState(true); // Bust cache after creating relationship
      }
      // Assuming the action returns the same structure
      return newRel as RelationshipInfo | null; 
  }, [projectId, refreshState]);

  const deleteEntityAction = useCallback(async (entityId: string): Promise<boolean> => {
      const success = await deleteEntity(projectId, entityId);
      if (success) {
          await refreshState(true); // Bust cache after deleting entity
      }
      return success;
  }, [projectId, refreshState]);

  const deleteRelationshipAction = useCallback(async (relationshipId: string): Promise<boolean> => {
      const success = await deleteRelationship(projectId, relationshipId);
      if (success) {
          await refreshState(true); // Bust cache after deleting relationship
      }
      return success;
  }, [projectId, refreshState]);

  const editObservationAction = useCallback(async (entityId: string, observationId: string, newText: string): Promise<boolean> => {
    const success = await editObservation(projectId, entityId, observationId, newText);
    if (success) {
      await refreshState(true); // Bust cache after editing observation
    }
    return success;
  }, [projectId, refreshState]);

  const deleteObservationAction = useCallback(async (entityId: string, observationId: string): Promise<boolean> => {
    const success = await deleteObservation(projectId, entityId, observationId);
    if (success) {
      await refreshState(true); // Bust cache after deleting observation
    }
    return success;
  }, [projectId, refreshState]);

  const deleteProjectHandler = useCallback(async (projectIdToDelete: string): Promise<boolean> => {
    const success = await deleteProjectAction(projectIdToDelete);
    return success;
  }, []);

  const findEntityByIdAction = useCallback(async (entityId: string, bustCache: boolean = false) => 
    getEntity(projectId, entityId, bustCache)
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
    editObservation: editObservationAction,
    deleteObservation: deleteObservationAction,
    deleteProject: deleteProjectHandler,
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