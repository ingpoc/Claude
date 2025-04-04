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
    type Relationship
} from "@/lib/knowledgeGraph";

// Wrap functions with proper type signatures instead of using rest params
export async function createEntity(
    name: string, 
    type: string, 
    description: string,
    observationsText: string[] = [], 
    parentId?: string
): Promise<Entity | null> {
    return await createEntityDb(name, type, description, observationsText, parentId);
}

export async function createRelationship(
    fromEntityId: string, 
    toEntityId: string, 
    type: string, 
    description: string = ""
): Promise<Relationship | null> {
    return await createRelationshipDb(fromEntityId, toEntityId, type, description);
}

export async function addObservation(entityId: string, observationText: string): Promise<{ observation_id: string } | null> {
    return await addObservationDb(entityId, observationText);
}

export async function deleteEntity(entityId: string): Promise<boolean> {
    return await deleteEntityDb(entityId);
}

export async function deleteRelationship(relationshipId: string): Promise<boolean> {
    return await deleteRelationshipDb(relationshipId);
}

export async function getEntity(entityId: string): Promise<Entity | null> {
    return await getEntityDb(entityId);
}

export async function getAllEntities(): Promise<Entity[]> {
    return await getAllEntitiesDb();
}

export async function getAllRelationshipsForContext(): Promise<Relationship[]> {
    return await getAllRelationshipsForContextDb();
}

export async function getRelatedEntities(
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    return await getRelatedEntitiesDb(entityId, relationshipType, direction);
}

export async function updateEntityDescription(entityId: string, description: string): Promise<boolean> {
    return await updateEntityDescriptionDb(entityId, description);
} 