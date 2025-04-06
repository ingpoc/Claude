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
    type Entity,
    type Relationship,
    deleteObservation as deleteObservationDb,
} from "../../lib/knowledgeGraph";

import { SessionManager } from "../../lib/mcp/SessionManager";

// Default project ID to use when one is not provided
const DEFAULT_PROJECT_ID = "current_project";

// Wrap functions with proper type signatures instead of using rest params
export async function createEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    name: string, 
    type: string, 
    description: string,
    observationsText: string[] = [], 
    parentId?: string
): Promise<Entity | null> {
    return await createEntityDb(projectId, name, type, description, observationsText, parentId);
}

export async function createRelationship(
    projectId: string = DEFAULT_PROJECT_ID,
    fromEntityId: string, 
    toEntityId: string, 
    type: string, 
    description: string = ""
): Promise<Relationship | null> {
    return await createRelationshipDb(projectId, fromEntityId, toEntityId, type, description);
}

export async function addObservation(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string, 
    observationText: string
): Promise<{ observation_id: string } | null> {
    return await addObservationDb(projectId, entityId, observationText);
}

export async function deleteEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string
): Promise<boolean> {
    return await deleteEntityDb(projectId, entityId);
}

export async function deleteRelationship(
    projectId: string = DEFAULT_PROJECT_ID,
    relationshipId: string
): Promise<boolean> {
    return await deleteRelationshipDb(projectId, relationshipId);
}

export async function getEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string
): Promise<Entity | null> {
    return await getEntityDb(projectId, entityId);
}

export async function getAllEntities(
    projectId: string = DEFAULT_PROJECT_ID
): Promise<Entity[]> {
    // console.warn(`[TEMP DEBUG] getAllEntities called for project ${projectId}. Bypassing DB call and returning empty array.`);
    return await getAllEntitiesDb(projectId); // <-- Restore original call
    // return Promise.resolve([]);
}

export async function getAllRelationshipsForContext(
    projectId: string = DEFAULT_PROJECT_ID
): Promise<Relationship[]> {
    // console.warn(`[TEMP DEBUG] getAllRelationshipsForContext called for project ${projectId}. Bypassing DB call and returning empty array.`);
    return await getAllRelationshipsForContextDb(projectId); // <-- Restore original call
    // return Promise.resolve([]);
}

export async function getRelatedEntities(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    return await getRelatedEntitiesDb(projectId, entityId, relationshipType, direction);
}

export async function updateEntityDescription(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string, 
    description: string
): Promise<boolean> {
    return await updateEntityDescriptionDb(projectId, entityId, description);
} 