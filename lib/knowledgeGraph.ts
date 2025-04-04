"use server"; // Mark this entire module as server-only

// This file implements the Knowledge Graph MCP as specified in the documentation

import * as kuzu from 'kuzu';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Import constants from the new shared file
import { EntityTypes, RelationshipTypes } from '@/lib/constants';

// Define Observation structure
export interface Observation {
  id: string;
  text: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: Observation[]; // Updated observation structure
  parentId?: string;
}

export interface Relationship {
  id: string; // Add relationship ID
  from: string;
  to: string;
  type: string;
}

// Constants for entity and relationship types are now imported
// export const EntityTypes = { /* ... */ };
// export const RelationshipTypes = { /* ... */ };

// --- KuzuDB Connection Manager (Server-Side Only) --- 

let dbInstance: kuzu.Database | null = null;
let connInstance: kuzu.Connection | null = null;
let schemaInitializationPromise: Promise<void> | null = null;

// Add type for PreparedStatement
interface PreparedStatement {
  _preparedStatement: any;
  isSuccess(): boolean;
  getErrorMessage(): string;
}

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
    console.log("[Schema] Initializing KuzuDB schema if necessary...");
    try {
        // Node table
        await connection.query(`
            CREATE NODE TABLE IF NOT EXISTS Entity (
                id STRING, name STRING, type STRING, description STRING,
                observations STRUCT(id STRING, text STRING)[], parentId STRING, PRIMARY KEY (id)
            )
        `);
        console.log("[Schema] Entity table checked/created.");
        // Edge table
        await connection.query(`
            CREATE REL TABLE IF NOT EXISTS Related (
                FROM Entity TO Entity, id STRING, type STRING
            )
        `);
        console.log("[Schema] Related table checked/created.");
        console.log("[Schema] KuzuDB schema initialization complete.");
    } catch (error) {
        console.error("[Schema] Error initializing KuzuDB schema:", error);
        throw error;
    }
}

// --- Data Functions (Now use getDbConnection) --- 

// Helper to run a query with schema check
async function runQuery<T = any>(query: string, params?: Record<string, any>): Promise<kuzu.QueryResult | null> {
    try {
        const { conn, ensureSchema } = getDbConnection();
        await ensureSchema(); // Ensure schema is ready before querying
        
        if (params) {
            // Create a parameterized query using string interpolation
            // This is a workaround until we can properly use prepared statements
            let parameterizedQuery = query;
            
            // Replace all parameter placeholders with actual values
            for (const [key, value] of Object.entries(params)) {
                // Safely convert value to string based on type
                let stringValue: string;
                if (value === null) {
                    stringValue = 'NULL';
                } else if (typeof value === 'string') {
                    // Escape single quotes in strings
                    stringValue = `'${value.replace(/'/g, "''")}'`;
                } else if (typeof value === 'number') {
                    stringValue = value.toString();
                } else if (typeof value === 'boolean') {
                    stringValue = value ? 'TRUE' : 'FALSE';
                } else if (Array.isArray(value)) {
                    // Handle arrays (like observations)
                    stringValue = JSON.stringify(value);
                } else {
                    // For objects or other types
                    stringValue = JSON.stringify(value);
                }
                
                // Replace $key with the actual value
                const regex = new RegExp(`\\$${key}\\b`, 'g');
                parameterizedQuery = parameterizedQuery.replace(regex, stringValue);
            }
            
            // Now call query with the parameterized query string
            return await conn.query(parameterizedQuery);
        } else {
            // If no params, just use query directly
            return await conn.query(query);
        }
    } catch (error) {
        console.error(`Error running query: ${query}`, error);
        return null;
    }
}

// Create a new entity
export async function createEntity(
  name: string, type: string, description: string,
  observationsText: string[] = [], // Accept text initially
  parentId?: string
): Promise<Entity | null> {
  const id = `entity_${uuidv4()}`; // Use UUID for entity ID
  // Convert initial observation texts to Observation objects
  const observations: Observation[] = observationsText.map(text => ({ id: `obs_${uuidv4()}`, text }));
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

// Create a new relationship with ID
export async function createRelationship(
  fromEntityId: string, toEntityId: string, type: string, description: string = "" // Optional description for potential future use
): Promise<Relationship | null> {
    const checkQuery = `MATCH (e:Entity {id: $id}) RETURN count(e) > 0 AS exists`;
    const fromExistsResult = await runQuery(checkQuery, { id: fromEntityId });
    const toExistsResult = await runQuery(checkQuery, { id: toEntityId });
    const fromExists = (await fromExistsResult?.next())?.getValue('exists');
    const toExists = (await toExistsResult?.next())?.getValue('exists');

    if (!fromExists || !toExists) {
        console.error(`Cannot create relationship: Entity ${!fromExists ? fromEntityId : toEntityId} not found.`);
        return null;
    }

    const relId = `rel_${uuidv4()}`; // Generate UUID for relationship
    const query = `
        MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
        CREATE (from)-[r:Related {id: $relId, type: $type}]->(to)
        RETURN $relId as id
    `;
    const params = { fromId: fromEntityId, toId: toEntityId, type, relId };
    const result = await runQuery(query, params);
    const createdRel = await result?.next(); // Check if query ran
    if (createdRel && createdRel.getValue('id') === relId) {
        console.log(`Relationship created: (${fromEntityId})-[${type}, ${relId}]->(${toEntityId})`);
        return { id: relId, from: fromEntityId, to: toEntityId, type };
    }
    console.error(`Failed to create relationship: (${fromEntityId})-[${type}]->(${toEntityId})`);
    return null;
}

// Add observation, now returns the observation ID
export async function addObservation(entityId: string, observationText: string): Promise<{ observation_id: string } | null> {
    const readQuery = `MATCH (e:Entity {id: $id}) RETURN e.observations AS obs`;
    const readResult = await runQuery(readQuery, { id: entityId });
    const data = await readResult?.next();
    if (!data) {
        console.error(`Cannot add observation: Entity ${entityId} not found.`);
        return null;
    }
    // Kuzu returns observations as array of objects {id: ..., text: ...}
    const existingObs: Observation[] = data.getValue('obs') || [];
    const newObservationId = `obs_${uuidv4()}`;
    const newObservation: Observation = { id: newObservationId, text: observationText };
    const newObsList = [...existingObs, newObservation];

    const writeQuery = `MATCH (e:Entity {id: $id}) SET e.observations = $newObsList`;
    const writeResult = await runQuery(writeQuery, { id: entityId, newObsList });
    if(writeResult) {
        console.log(`Observation ${newObservationId} added to entity: ${entityId}`);
        return { observation_id: newObservationId };
    }
    console.error(`Failed to add observation to entity: ${entityId}`);
    return null;
}

// NEW: Delete observation by its ID
export async function deleteObservation(entityId: string, observationId: string): Promise<boolean> {
    const readQuery = `MATCH (e:Entity {id: $entityId}) RETURN e.observations AS obs`;
    const readResult = await runQuery(readQuery, { entityId });
    const data = await readResult?.next();
    if (!data) {
        console.error(`Cannot delete observation: Entity ${entityId} not found.`);
        return false;
    }
    const existingObs: Observation[] = data.getValue('obs') || [];
    const updatedObsList = existingObs.filter(obs => obs.id !== observationId);

    if (updatedObsList.length === existingObs.length) {
        console.warn(`Observation ${observationId} not found on entity ${entityId}.`);
        // Return true because the desired state (observation gone) is achieved
        return true;
    }

    const writeQuery = `MATCH (e:Entity {id: $entityId}) SET e.observations = $updatedObsList`;
    const writeResult = await runQuery(writeQuery, { entityId, updatedObsList });
    if(writeResult) {
        console.log(`Observation ${observationId} deleted from entity: ${entityId}`);
        return true;
    }
    console.error(`Failed to delete observation ${observationId} from entity: ${entityId}`);
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

// Delete relationship BY RELATIONSHIP ID
export async function deleteRelationship(relationshipId: string): Promise<boolean> {
    const query = `
        MATCH ()-[r:Related {id: $id}]->()
        DELETE r
    `;
    const result = await runQuery(query, { id: relationshipId });
    // Revert to simpler check: If query ran without error, assume success or already deleted
    if(result) {
        console.log(`Relationship delete query executed for: ${relationshipId}`);
        return true;
    }
    console.error(`Failed to execute delete relationship query for: ${relationshipId}`);
    return false;
}

// Get entity by ID (ensuring observations are parsed correctly)
export async function getEntity(entityId: string): Promise<Entity | null> {
    const query = `MATCH (e:Entity {id: $id}) RETURN e.id, e.name, e.type, e.description, e.observations, e.parentId`;
    const result = await runQuery(query, { id: entityId });
    const allResults = await result?.getAll();
    const data = allResults?.[0];
    if (!data) return null;

    // Kuzu returns observations as array of objects {id: ..., text: ...}
    const observations: Observation[] = data['e.observations'] || [];

    return {
        id: data['e.id'],
        name: data['e.name'],
        type: data['e.type'],
        description: data['e.description'],
        observations: observations, // Assign parsed observations
        parentId: data['e.parentId'],
    };
}

// Get all entities (ensuring observations are parsed correctly)
export async function getAllEntities(): Promise<Entity[]> {
    const query = `MATCH (e:Entity) RETURN e.id, e.name, e.type, e.description, e.observations, e.parentId`;
    const result = await runQuery(query);
    const entities: Entity[] = [];
    if (result) {
        const allResults = await result.getAll();
        for (const data of allResults) {
             // Kuzu returns observations as array of objects {id: ..., text: ...}
            const observations: Observation[] = data['e.observations'] || [];
            entities.push({
                id: data['e.id'],
                name: data['e.name'],
                type: data['e.type'],
                description: data['e.description'],
                observations: observations, // Assign parsed observations
                parentId: data['e.parentId'],
            });
        }
    }
    return entities;
}

// Get relationships (updated to include relationship ID)
export async function getRelationships(
    filters: { fromId?: string, toId?: string, type?: string } = {}
): Promise<Relationship[]> {
    let matchClause = "MATCH (from:Entity)-[r:Related]->(to:Entity)";
    let whereClauses: string[] = [];
    let params: Record<string, any> = {};

    if (filters.fromId) {
        whereClauses.push("from.id = $fromId");
        params.fromId = filters.fromId;
    }
    if (filters.toId) {
        whereClauses.push("to.id = $toId");
        params.toId = filters.toId;
    }
    if (filters.type) {
        whereClauses.push("type = $type"); // Where clause seems to work with direct access
        params.type = filters.type;
    }
    const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    // Revert RETURN clause to use r. prefix for relationship properties
    const query = `${matchClause}${whereClause} RETURN r.id AS relationshipId, r.type AS relationshipType, from.id AS from, to.id AS to`;
    console.log(`[getRelationships] Executing query: ${query}`); // Log the exact query
    console.log(`[getRelationships] With params: ${JSON.stringify(params)}`);

    const result = await runQuery(query, params);
    const relationships: Relationship[] = [];
     if (result) {
        const allResults = await result.getAll();
        console.log(`[getRelationships] Query returned ${allResults.length} results.`);
        for (const data of allResults) {
            relationships.push({
                id: data['relationshipId'], // Use the alias
                from: data['from'],
                to: data['to'],
                type: data['relationshipType'], // Use the alias
            });
        }
    }
    return relationships;
}

// Get all relationships for context (use the new getRelationships)
export async function getAllRelationshipsForContext(): Promise<Relationship[]> {
   return getRelationships(); // Reuse the more general function
}

// Get related entities (remains largely the same, could optionally return relationship info)
export async function getRelatedEntities(
  entityId: string,
  relationshipType?: string,
  direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    let query = '';
    const params: Record<string, any> = { id: entityId };
    if (relationshipType) {
        params.type = relationshipType;
    }
    const typeMatch = relationshipType ? `{type: $type}` : '';

    switch (direction) {
        case 'outgoing':
            query = `MATCH (e:Entity {id: $id})-[r:Related ${typeMatch}]->(related:Entity) RETURN related.id, related.name, related.type, related.description, related.observations, related.parentId`;
            break;
        case 'incoming':
            query = `MATCH (related:Entity)-[r:Related ${typeMatch}]->(e:Entity {id: $id}) RETURN related.id, related.name, related.type, related.description, related.observations, related.parentId`;
            break;
        default: // both
            query = `
                MATCH (e:Entity {id: $id})-[r_out:Related ${typeMatch}]->(related_out:Entity)
                WITH e, collect(related_out) as outgoing_related
                MATCH (related_in:Entity)-[r_in:Related ${typeMatch}]->(e)
                WITH outgoing_related, collect(related_in) as incoming_related
                // Combine and distinct (Kuzu might handle distinct implicitly, but explicit is safer)
                WITH outgoing_related + incoming_related as all_related
                UNWIND all_related as related
                RETURN DISTINCT related.id, related.name, related.type, related.description, related.observations, related.parentId
            `;
            break;
    }

    const result = await runQuery(query, params);
    const entities: Entity[] = [];
    if (result) {
        const allResults = await result.getAll();
         for (const data of allResults) {
             const observations: Observation[] = data['related.observations'] || [];
             entities.push({
                id: data['related.id'],
                name: data['related.name'],
                type: data['related.type'],
                description: data['related.description'],
                observations: observations,
                parentId: data['related.parentId'],
            });
         }
    }
    return entities;
}

// Update entity description
export async function updateEntityDescription(entityId: string, description: string): Promise<boolean> {
    const query = `MATCH (e:Entity {id: $id}) SET e.description = $description`;
    const result = await runQuery(query, { id: entityId, description });
    // Revert to simpler check: If query ran without error, assume success.
    if(result) {
        console.log(`Description update query executed for entity: ${entityId}`);
        return true;
    }
    console.error(`Failed to execute update description query for entity: ${entityId}`);
    return false;
}

console.log("Knowledge graph library refactored for server-side KuzuDB use.");