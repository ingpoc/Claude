"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// Explicitly import only types from lib
import type { Entity, Relationship } from '@/lib/knowledgeGraph'; 
import {
    createEntity,
    createRelationship,
    getRelatedEntities,
    addObservation,
    deleteEntity,
    deleteRelationship,
    getEntity,
    getAllEntities,
    getAllRelationshipsForContext,
    updateEntityDescription
} from "@/app/actions/knowledgeGraphActions"; // Import server actions

// Use types defined in lib/knowledgeGraph.ts if needed, or redefine here
// Interface for RelationshipInfo might need adjustment based on what getRelatedEntities action returns
interface RelationshipInfo {
    from: string;
    to: string;
    type: string;
}

interface KnowledgeGraphState {
  entities: Entity[];
  relationships: RelationshipInfo[];
}

interface KnowledgeGraphContextType extends KnowledgeGraphState {
  addEntity: (name: string, type: string, description: string, observations?: string[], parentId?: string) => Promise<Entity | null>;
  addObservation: (entityId: string, observation: string) => Promise<boolean>;
  updateEntityDescription: (entityId: string, description: string) => Promise<boolean>;
  addRelationship: (fromId: string, toId: string, type: string) => Promise<RelationshipInfo | null>;
  deleteEntity: (entityId: string) => Promise<boolean>;
  deleteRelationship: (fromId: string, toId: string, type: string) => Promise<boolean>;
  findEntityById: (entityId: string) => Promise<Entity | null>;
  getRelatedEntities: (entityId: string) => Promise<Array<{entity: Entity, relationship: RelationshipInfo}>>; // Type needs to match action return
  refreshState: () => Promise<void>; 
  isLoading: boolean;
}

const KnowledgeGraphContext = createContext<KnowledgeGraphContextType | undefined>(undefined);

export const KnowledgeGraphProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<KnowledgeGraphState>({ entities: [], relationships: [] });
  const [isLoading, setIsLoading] = useState(true);

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
        // Call server actions to get data
        const [entities, relationships] = await Promise.all([
            getAllEntities(),
            getAllRelationshipsForContext()
        ]);
        setState({ entities, relationships });
        console.log(`Refreshed state via Server Actions: ${entities.length} entities, ${relationships.length} relationships.`);
    } catch (error) {
        console.error("Failed to load knowledge graph via Server Actions:", error);
        setState({ entities: [], relationships: [] }); 
    } finally {
       setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Context methods now call server actions directly
  const addEntityAction = useCallback(async (name: string, type: string, description: string, observations?: string[], parentId?: string): Promise<Entity | null> => {
    const newEntity = await createEntity(name, type, description, observations, parentId);
    if (newEntity) {
      await refreshState();
    }
    return newEntity;
  }, [refreshState]);

  const addObservationAction = useCallback(async (entityId: string, observation: string): Promise<boolean> => {
    const success = await addObservation(entityId, observation);
    if (success) {
       await refreshState();
    }
    return success;
  }, [refreshState]);

  const updateEntityDescriptionAction = useCallback(async (entityId: string, description: string): Promise<boolean> => {
    const success = await updateEntityDescription(entityId, description);
    if (success) {
        await refreshState();
    }
    return success;
  }, [refreshState]);
  
  const addRelationshipAction = useCallback(async (fromId: string, toId: string, type: string): Promise<RelationshipInfo | null> => {
      const newRel = await createRelationship(fromId, toId, type);
      if (newRel) {
          await refreshState();
      }
      // Assuming the action returns the same structure
      return newRel as RelationshipInfo | null; 
  }, [refreshState]);

  const deleteEntityAction = useCallback(async (entityId: string): Promise<boolean> => {
      const success = await deleteEntity(entityId);
      if (success) {
          await refreshState();
      }
      return success;
  }, [refreshState]);

  const deleteRelationshipAction = useCallback(async (fromId: string, toId: string, type: string): Promise<boolean> => {
      const success = await deleteRelationship(fromId, toId, type);
      if (success) {
          await refreshState();
      }
      return success;
  }, [refreshState]);

  const findEntityByIdAction = useCallback(async (entityId: string) => getEntity(entityId), []);
  
  // Ensure return type matches the context definition
  const getRelatedEntitiesAction = useCallback(async (entityId: string): Promise<Array<{entity: Entity, relationship: RelationshipInfo}>> => {
      const relatedData = await getRelatedEntities(entityId);
      // Map the relationship part if necessary to match RelationshipInfo
      return relatedData.map(item => ({
          entity: item.entity,
          relationship: {
              from: item.relationship.from,
              to: item.relationship.to,
              type: item.relationship.type
          }
      }));
  }, []);


  const contextValue: KnowledgeGraphContextType = {
    ...state,
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
    <KnowledgeGraphContext.Provider value={contextValue}>
      {children}
    </KnowledgeGraphContext.Provider>
  );
};

export const useKnowledgeGraph = (): KnowledgeGraphContextType => {
  const context = useContext(KnowledgeGraphContext);
  if (context === undefined) {
    throw new Error('useKnowledgeGraph must be used within a KnowledgeGraphProvider');
  }
  return context;
}; 