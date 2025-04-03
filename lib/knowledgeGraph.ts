"use server"; // Mark this entire module as server-only

// This file implements the Knowledge Graph MCP as specified in the documentation

import * as kuzu from 'kuzu';
import path from 'path';
import fs from 'fs';
// Import constants from the new shared file
import { EntityTypes, RelationshipTypes } from '@/lib/constants'; 

export interface Entity {
  id: string;                // Kuzu requires specific ID types, often INT64 or STRING
  name: string;              
  type: string;              
  description: string;       
  observations: string[];    // Kuzu can store lists of strings
  parentId?: string;         
}

export interface Relationship {
  // Kuzu edges don't necessarily need a separate ID, 
  // the connection between nodes defines them. 
  // We might add properties later if needed.
  from: string;              // Source entity ID
  to: string;                // Target entity ID
  type: string;              // Relationship type as a property
}

// Constants for entity and relationship types are now imported
// export const EntityTypes = { /* ... */ };
// export const RelationshipTypes = { /* ... */ };

// --- KuzuDB Connection Manager (Server-Side Only) --- 

let dbInstance: kuzu.Database | null = null;
let connInstance: kuzu.Connection | null = null;
let schemaInitializationPromise: Promise<void> | null = null;

function getDbConnection() {
    // This function should ONLY run on the server.
    if (typeof window !== 'undefined') {
        throw new Error("Database connection cannot be established on the client-side.");
    }

    if (!dbInstance) {
        const DB_DIR = path.resolve(process.cwd(), '.kuzu-db');
        const DB_PATH = path.join(DB_DIR, 'mcp_graph.db');
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        dbInstance = new kuzu.Database(DB_PATH);
        connInstance = new kuzu.Connection(dbInstance);
        console.log("KuzuDB connection established (Singleton).");

        // Initialize schema when connection is first created
        schemaInitializationPromise = initializeSchema(connInstance);
    }
    return { db: dbInstance, conn: connInstance!, ensureSchema: () => schemaInitializationPromise! };
}

// Schema initialization function now takes connection
async function initializeSchema(connection: kuzu.Connection) {
    console.log("Initializing KuzuDB schema if necessary...");
    try {
        // Node table
        await connection.query(`
            CREATE NODE TABLE IF NOT EXISTS Entity (
                id STRING, name STRING, type STRING, description STRING, 
                observations STRING[], parentId STRING, PRIMARY KEY (id)
            )
        `);
        // Edge table
        await connection.query(`
            CREATE REL TABLE IF NOT EXISTS Related (FROM Entity TO Entity, type STRING)
        `);
        console.log("KuzuDB schema checked/created.");
    } catch (error) {
        console.error("Error initializing KuzuDB schema:", error);
        // Rethrow or handle appropriately
        throw error;
    }
}

// --- Data Functions (Now use getDbConnection) --- 

// Helper to run a query with schema check
async function runQuery<T = any>(query: string, params?: Record<string, any>): Promise<kuzu.QueryResult | null> {
    try {
        const { conn, ensureSchema } = getDbConnection();
        await ensureSchema(); // Ensure schema is ready before querying
        return await conn.query(query, params);
    } catch (error) {
        console.error(`Error running query: ${query}`, error);
        return null;
    }
}

// Create a new entity
export async function createEntity(
  name: string, type: string, description: string, 
  observations: string[] = [], parentId?: string
): Promise<Entity | null> {
  const id = `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const query = `
      CREATE (e:Entity { 
          id: $id, name: $name, type: $type, description: $description, 
          observations: $observations, parentId: $parentId
      })
  `;
  const params = { id, name, type, description, observations, parentId: parentId || null };
  const result = await runQuery(query, params);
  if (result) {
    const entity: Entity = { id, name, type, description, observations, parentId };
    console.log(`Entity created: ${id} (${name})`);
    return entity;
  }
  return null;
}

// Create a new relationship
export async function createRelationship(
  fromEntityId: string, toEntityId: string, type: string
): Promise<{ from: string, to: string, type: string } | null> {
    // Check if entities exist (optional but good practice)
    const checkQuery = `MATCH (e:Entity {id: $id}) RETURN count(e) > 0 AS exists`;
    const fromExistsResult = await runQuery(checkQuery, { id: fromEntityId });
    const toExistsResult = await runQuery(checkQuery, { id: toEntityId });
    const fromExists = (await fromExistsResult?.next())?.getValue('exists');
    const toExists = (await toExistsResult?.next())?.getValue('exists');

    if (!fromExists || !toExists) {
        console.error(`Cannot create relationship: Entity ${!fromExists ? fromEntityId : toEntityId} not found.`);
        return null;
    }

    const query = `
        MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
        CREATE (from)-[r:Related {type: $type}]->(to)
    `;
    const params = { fromId: fromEntityId, toId: toEntityId, type };
    const result = await runQuery(query, params);
    if (result) {
        console.log(`Relationship created: (${fromEntityId})-[${type}]->(${toEntityId})`);
        return { from: fromEntityId, to: toEntityId, type };
    }
    return null;
}

// Add observation
export async function addObservation(entityId: string, observation: string): Promise<boolean> {
    const readQuery = `MATCH (e:Entity {id: $id}) RETURN e.observations AS obs`;
    const readResult = await runQuery(readQuery, { id: entityId });
    const data = await readResult?.next();
    if (!data) {
        console.error(`Cannot add observation: Entity ${entityId} not found.`);
        return false;
    }
    const existingObs: string[] = data.getValue('obs') || [];
    const newObs = [...existingObs, observation];

    const writeQuery = `MATCH (e:Entity {id: $id}) SET e.observations = $newObs`;
    const writeResult = await runQuery(writeQuery, { id: entityId, newObs });
    if(writeResult) {
        console.log(`Observation added to entity: ${entityId}`);
        return true;
    }
    return false;
}

// Delete entity
export async function deleteEntity(entityId: string): Promise<boolean> {
    const query = `MATCH (e:Entity {id: $id}) DETACH DELETE e`;
    const result = await runQuery(query, { id: entityId });
    if(result) {
        console.log(`Entity deleted: ${entityId}`);
        return true;
    }
    return false;
}

// Delete relationship
export async function deleteRelationship(fromId: string, toId: string, type: string): Promise<boolean> {
    const query = `
        MATCH (from:Entity {id: $fromId})-[r:Related {type: $type}]->(to:Entity {id: $toId})
        DELETE r
    `;
    const result = await runQuery(query, { fromId, toId, type });
     if(result) {
        console.log(`Relationship deleted: (${fromId})-[${type}]->(${toId})`);
        return true;
    }
    return false;
}

// Get entity by ID
export async function getEntity(entityId: string): Promise<Entity | null> {
    const query = `MATCH (e:Entity {id: $id}) RETURN e.id, e.name, e.type, e.description, e.observations, e.parentId`;
    const result = await runQuery(query, { id: entityId });
    // Use getAll() which returns an array, take the first item if it exists
    const allResults = await result?.getAll(); 
    const data = allResults?.[0];
    if (!data) return null;
    // Access results using object keys directly (getAll returns array of objects)
    return {
        id: data['e.id'],
        name: data['e.name'],
        type: data['e.type'],
        description: data['e.description'],
        observations: data['e.observations'] || [],
        parentId: data['e.parentId'],
    };
}

// Get all entities
export async function getAllEntities(): Promise<Entity[]> {
    const query = `MATCH (e:Entity) RETURN e.id, e.name, e.type, e.description, e.observations, e.parentId`;
    const result = await runQuery(query);
    const entities: Entity[] = [];
    if (result) {
        // Use getAll() - returns array of result objects
        const allResults = await result.getAll(); 
        for (const data of allResults) {
            entities.push({
                id: data['e.id'],
                name: data['e.name'],
                type: data['e.type'],
                description: data['e.description'],
                observations: data['e.observations'] || [],
                parentId: data['e.parentId'],
            });
        }
    }
    return entities;
}

// Get all relationships for context
export async function getAllRelationshipsForContext(): Promise<Array<{ from: string, to: string, type: string }>> {
    const query = `MATCH (from:Entity)-[r:Related]->(to:Entity) RETURN from.id, to.id, r.type`;
    const result = await runQuery(query);
    const relationships: Array<{ from: string, to: string, type: string }> = [];
     if (result) {
        // Use getAll()
        const allResults = await result.getAll();
        for (const data of allResults) {
            relationships.push({
                from: data['from.id'],
                to: data['to.id'],
                type: data['r.type'],
            });
        }
    }
    return relationships;
}

// Get related entities
export async function getRelatedEntities(entityId: string): Promise<Array<{entity: Entity, relationship: Relationship}>> {
    const query = `
        MATCH (current:Entity {id: $entityId})-[r:Related]-(related:Entity)
        RETURN 
            related.id, related.name, related.type, related.description, related.observations, related.parentId,
            startNode(r).id AS fromId, endNode(r).id AS toId, r.type AS relType
        `;
    const result = await runQuery(query, { entityId });
    const related: Array<{entity: Entity, relationship: Relationship}> = [];
     if (result) {
        // Use getAll()
        const allResults = await result.getAll();
        for (const data of allResults) {
            const relatedEntity: Entity = { 
                 id: data['related.id'],
                name: data['related.name'],
                type: data['related.type'],
                description: data['related.description'],
                observations: data['related.observations'] || [],
                parentId: data['related.parentId'],
            };
            const relationship: Relationship = { 
                 from: data['fromId'],
                to: data['toId'],
                type: data['relType'],
            };
            related.push({ entity: relatedEntity, relationship });
        }
    }
    return related;
}

// Update description
export async function updateEntityDescription(entityId: string, description: string): Promise<boolean> {
    const query = `MATCH (e:Entity {id: $id}) SET e.description = $description`;
    const result = await runQuery(query, { id: entityId, description });
    if(result) {
        console.log(`Description updated for entity: ${entityId}`);
        return true;
    }
    return false;
}

console.log("Knowledge graph library refactored for server-side KuzuDB use.");