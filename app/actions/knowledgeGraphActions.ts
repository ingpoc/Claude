"use server";

// This file exposes the server-side KuzuDB functions as Server Actions
// Client components will import from here, not directly from lib/knowledgeGraph.ts

import {
    createEntity as createEntityDb,
    createRelationship as createRelationshipDb,
    addObservation as addObservationDb,
    deleteEntity as deleteEntityDb,
    deleteRelationship as deleteRelationshipDb,
    getEntity as getEntityDb,
    getAllEntities as getAllEntitiesDb,
    getAllRelationshipsForContext as getAllRelationshipsForContextDb,
    getRelatedEntities as getRelatedEntitiesDb,
    updateEntityDescription as updateEntityDescriptionDb,
} from "@/lib/knowledgeGraph";

// Re-export functions as server actions
export const createEntity = createEntityDb;
export const createRelationship = createRelationshipDb;
export const addObservation = addObservationDb;
export const deleteEntity = deleteEntityDb;
export const deleteRelationship = deleteRelationshipDb;
export const getEntity = getEntityDb;
export const getAllEntities = getAllEntitiesDb;
export const getAllRelationshipsForContext = getAllRelationshipsForContextDb;
export const getRelatedEntities = getRelatedEntitiesDb;
export const updateEntityDescription = updateEntityDescriptionDb; 