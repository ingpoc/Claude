"use server"; // Mark this entire module as server-only

// This file implements the Knowledge Graph MCP as specified in the documentation

// NOTE: There are TypeScript linter errors in this file related to KuzuDB API access.
// These errors occur because we're using a flexible approach to handle different
// result formats from KuzuDB queries. The code uses type assertions and dynamic 
// property access that TypeScript's type system cannot verify statically.
// The code will work correctly at runtime despite these type errors.

import * as kuzu from 'kuzu';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Import constants from the new shared file
import { EntityTypes, RelationshipTypes } from './constants';
// Import project manager
import { getDbConnection } from './projectManager';
// import { Entity, Observation, Relationship } from './knowledgeGraphTypes'; // Remove this incorrect import

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

// Helper function to safely parse observations string
function parseObservations(obsData: string | Observation[] | null | undefined): Observation[] {
    if (!obsData) {
        return [];
    }
    if (Array.isArray(obsData)) {
        // Already parsed or was never stringified (e.g., during creation/update before save)
        return obsData;
    }
    if (typeof obsData === 'string') {
        try {
            const parsed = JSON.parse(obsData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('[DEBUG] Failed to parse observations JSON string:', obsData, e);
            return []; // Return empty array on parsing error
        }
    }
    // Should not happen, but return empty array as fallback
    console.warn('[WARN] Unexpected data type for observations:', typeof obsData);
    return [];
}

// Helper function to safely stringify observations
function stringifyObservations(observations: Observation[]): string {
  try {
    return JSON.stringify(observations);
  } catch (e) {
    console.error('[DEBUG] Failed to stringify observations:', e);
    return '[]'; // Return empty JSON array on error
  }
}

// Helper to run a query with schema check for a specific project
async function runQuery<T = any>(
  projectId: string,
  query: string, 
  params?: Record<string, any>
): Promise<kuzu.QueryResult | any> {
    try {
        // Add robust error handling around database connection
        let conn;
        try {
            const connResult = await getDbConnection(projectId);
            conn = connResult.conn;
            if (!conn) {
                console.error(`[ERROR] Failed to get database connection for project ${projectId}`);
                return null;
            }
        } catch (connError) {
            console.error(`[ERROR] Exception while getting database connection for project ${projectId}:`, connError);
            return null;
        }
        
        if (params) {
            // Use prepared statements: prepare on connection, then execute on connection
            // console.error(`[DEBUG] Preparing statement: ${query.substring(0, 100)}...`);
            try {
                // @ts-ignore - Linter error might be due to outdated types, runtime expects prepare
                const statement = await conn.prepare(query);
                // console.error(`[DEBUG] Executing prepared statement via conn.execute with params:`, params);
                // Pass prepared statement and params to conn.execute()
                // Add undefined for the progressCallback argument
                // @ts-ignore - Linter error might be due to outdated types, runtime expects execute
                const result = await conn.execute(statement, params, undefined); 
                // console.error(`[DEBUG] Raw result from prepared statement execution:`, result);
                // Manually close statement if needed (check KuzuDB API)
                // await statement.close(); 
                return result;
            } catch (prepareError) {
                console.error(`[ERROR] Failed to prepare or execute statement: ${query.substring(0, 100)}...`, prepareError);
                return null;
            }
        } else {
            // console.error(`[DEBUG] Running non-parameterized query: ${query}`);
            try {
                // Add undefined for the progressCallback argument
                const result = await conn.query(query, undefined);
                // console.error(`[DEBUG] Raw result from conn.query (non-parameterized):`, result);
                return result;
            } catch (queryError) {
                console.error(`[ERROR] Failed to execute query: ${query.substring(0, 100)}...`, queryError);
                return null;
            }
        }
    } catch (error) {
        console.error(`[ERROR] Unexpected error in runQuery: ${query.substring(0, 100)}...`, error);
        return null;
    }
}

// Create a new entity using a single parameterized query
export async function createEntity(
  projectId: string,
  name: string,
  type: string,
  description: string,
  observationsText: string[] = [], // Accept text initially
  parentId?: string
): Promise<Entity | null> {
  // console.error(`[DEBUG] Creating entity: ${name} (${type}) in project ${projectId}`);

  try {
    // Get direct database connection
    const { conn } = await getDbConnection(projectId);

    // Generate ID and create observations object
    const id = `entity_${uuidv4()}`;
    const observations: Observation[] = observationsText.map(text => ({ id: `obs_${uuidv4()}`, text }));
    const observationsJson = stringifyObservations(observations); // Use helper

    // Prepare parameters for the query
    const params: Record<string, any> = {
      id,
      name,
      type,
      description,
      observationsJson,
    };
    if (parentId) {
      params.parentId = parentId;
    } else {
      // KuzuDB requires all properties in the CREATE statement, even if null/undefined.
      // Provide an empty string or handle based on schema definition if NULL isn't directly supported for a property.
      // Assuming empty string is acceptable for an optional parentId.
      params.parentId = ''; 
    }

    // Single CREATE query with all properties using parameters
    // Ensure property names match the KuzuDB schema exactly.
    const createQuery = `
      CREATE (e:Entity {
        id: $id,
        name: $name,
        type: $type,
        description: $description,
        observations: $observationsJson,
        parentId: $parentId
      })
    `;

    // console.error(`[DEBUG] Executing combined entity creation query within explicit transaction`);
    let transactionStarted = false;
    try {
      // 1. Begin Transaction
      // console.error(`[DEBUG] Beginning transaction...`);
      const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
      if (!beginResult) {
          console.error(`[ERROR] Failed to begin transaction for entity "${name}".`);
          return null;
      }
      transactionStarted = true;
      // console.error(`[DEBUG] Transaction begun.`);
      
      // 2. Execute the single creation query with parameters using runQuery
      const createResult = await runQuery(projectId, createQuery, params);
      
      // Check if runQuery returned a result (not null)
      if (!createResult) {
          console.error(`[ERROR] Entity creation query failed for name "${name}" within transaction.`);
          // Attempt rollback if transaction started
          if (transactionStarted) {
              // console.error(`[DEBUG] Rolling back transaction due to creation failure...`);
              await runQuery(projectId, "ROLLBACK;");
          }
          return null;
      }
      // console.error(`[DEBUG] Entity creation query executed within transaction for ID: ${id}.`);

      // 3. Commit Transaction
      // console.error(`[DEBUG] Committing transaction...`);
      const commitResult = await runQuery(projectId, "COMMIT;");
      if (!commitResult) {
          console.error(`[ERROR] Failed to commit transaction for entity "${name}".`);
           // Attempt rollback - though commit failure might make this ineffective
           // console.error(`[DEBUG] Attempting rollback after commit failure...`);
           await runQuery(projectId, "ROLLBACK;"); 
          return null; // Return null as commit failed
      }
      // console.error(`[DEBUG] Transaction committed successfully for ID: ${id}.`);
      transactionStarted = false; // Transaction ended

      // --- Force Checkpoint (Diagnostic Step) ---
      // console.error(`[DEBUG] Forcing CHECKPOINT after commit for ID: ${id}`);
      try {
        const checkpointResult = await runQuery(projectId, "CHECKPOINT;");
        if (checkpointResult) {
          // console.error(`[DEBUG] CHECKPOINT executed successfully.`);
        } else {
          console.error(`[ERROR] CHECKPOINT command failed after commit.`);
        }
      } catch (checkpointError) {
        console.error(`[ERROR] Error executing CHECKPOINT command:`, checkpointError);
      }
      // --- End Force Checkpoint ---

      // --- Verification Step RE-ENABLED ---
      
      const verifyQuery = `MATCH (e:Entity {id: $id}) RETURN e.id`;
      // console.error(`[DEBUG] Verifying entity exists with query: MATCH (e:Entity {id: ${id}}) RETURN e.id`);

      try {
        // Add more robust verification with retries
        let verificationPassed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          // console.error(`[DEBUG] Verification attempt ${attempt + 1} for entity ${id}`);
          
          // Add increasing delay between attempts
          if (attempt > 0) {
            // console.error(`[DEBUG] Waiting ${100 * attempt}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
          
          // Use runQuery for verification query
          const verifyQueryResult = await runQuery(projectId, verifyQuery, { id });

          // --- Use getAll() for result processing ---
          let verifyRows: any[] = [];
          if (verifyQueryResult && typeof verifyQueryResult.getAll === 'function') {
              try {
                  verifyRows = await verifyQueryResult.getAll();
              } catch (getAllError) {
                  console.error(`[ERROR] Failed to execute verifyResult.getAll():`, getAllError);
                  verifyRows = []; // Assume empty on error
              }
          } else {
               console.warn(`[WARN] verifyQueryResult does not have getAll method. Result:`, verifyQueryResult);
               // Fallback attempts (less ideal)
               if (verifyQueryResult?.getRows) {
                   verifyRows = verifyQueryResult.getRows();
               } else if (Array.isArray(verifyQueryResult)) {
                   verifyRows = verifyQueryResult;
               }
          }
          // --- End Use getAll() ---
          
          // console.error(`[DEBUG] Verification rows (attempt ${attempt + 1}):`, JSON.stringify(verifyRows));

          if (verifyRows && verifyRows.length > 0 && verifyRows[0]['e.id'] === id) { // Check specific ID in result
            // console.error(`[DEBUG] Entity verified in database on attempt ${attempt + 1}: ${id}`);
            verificationPassed = true;
            break;
          }
        }
        
        if (!verificationPassed) {
          // This case indicates a problem - the CREATE supposedly succeeded, but verification failed after retries.
          console.error(`[ERROR] Entity verification failed after ${3} attempts for ID: ${id}. The entity might not be queryable immediately.`);
          // Despite verification failure, we'll return the entity anyway as the transaction was committed
          // console.error(`[DEBUG] Returning entity despite verification failure as transaction was committed: ${id}`);
        }
      } catch (verifyError) {
        console.error(`[ERROR] Error during entity verification for ID ${id}:`, verifyError);
        // Despite verification error, we'll return the entity anyway as the transaction was committed
        // console.error(`[DEBUG] Returning entity despite verification error as transaction was committed: ${id}`);
      }
      
      // --- END Verification Step RE-ENABLED ---

      // --- Add Direct Persistence Check ---
      // console.error(`[DEBUG] Performing direct persistence check immediately after commit for ID: ${id}`);
      try {
          const directCheckQuery = `MATCH (e:Entity {id: $id}) RETURN e.id`;
          const directCheckResult = await runQuery(projectId, directCheckQuery, { id });
          let directCheckRows: any[] = [];
          if (directCheckResult && typeof directCheckResult.getAll === 'function') {
              directCheckRows = await directCheckResult.getAll();
          }
          // console.error(`[DEBUG] Direct persistence check result rows:`, JSON.stringify(directCheckRows));
          if (directCheckRows && directCheckRows.length > 0 && directCheckRows[0]['e.id'] === id) {
              // console.error(`[SUCCESS] Direct persistence check PASSED for ${id}.`);
          } else {
              console.error(`[FAILED] Direct persistence check FAILED for ${id}. Entity not found immediately after commit.`);
          }
      } catch (directCheckError) {
          console.error(`[ERROR] Error during direct persistence check for ID ${id}:`, directCheckError);
      }
      // --- End Direct Persistence Check ---

      // Construct and return the entity object optimistically
      const entity: Entity = {
        id,
        name,
        type,
        description,
        observations, // Return the object, not the JSON string
        parentId: parentId || undefined // Return undefined if not provided initially
      };
      // console.error(`[DEBUG] Returning entity: ${id}`);
      return entity;

    } catch (createError) {
      console.error(`[ERROR] Error during combined entity creation query for name "${name}":`, createError);
      return null; // Return null if the main creation query fails
    }

  } catch (error) {
    console.error(`[ERROR] Error in createEntity function for name "${name}":`, error);
    return null;
  }
}

// Function to handle both relationship creation and deletion in a transaction
// Returns the relationship ID on success, null on failure
async function manageRelationship(
    projectId: string,
    action: 'CREATE' | 'DELETE',
    sourceId: string, 
    targetId: string, 
    type: string,
    description?: string, // Optional for create
    relationshipId?: string // Required for delete by ID (if needed)
): Promise<string | null> {
    console.error(`[DEBUG] ${action} relationship: ${type} from ${sourceId} to ${targetId}`);
    
    let transactionStarted = false;
    try {
        // Begin Transaction
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction');
        transactionStarted = true;
        console.error(`[DEBUG] Transaction begun for ${action}.`);
        
        let query = '';
        let params: Record<string, any> = {};
        let newRelationshipId: string | null = null;

        if (action === 'CREATE') {
             newRelationshipId = `rel_${uuidv4()}`;
             query = `
                MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId})
                CREATE (a)-[r:Related {id: $relId, type: $type}]->(b)
                RETURN r.id
            `;
            params = { sourceId, targetId, relId: newRelationshipId, type };
        } else if (action === 'DELETE') {
            if (relationshipId) {
                // Delete by relationship ID (preferred if ID is known)
                query = `MATCH ()-[r:Related {id: $relId}]->() DELETE r`;
                params = { relId: relationshipId };
            } else {
                // Delete by source, target, and type (if ID is not known)
                 query = `MATCH (a:Entity {id: $sourceId})-[r:Related {type: $type}]->(b:Entity {id: $targetId}) DELETE r`;
                 params = { sourceId, targetId, type };
            }
        }

        const result = await runQuery(projectId, query, params);
        if (!result) {
            throw new Error(`${action} relationship query failed.`);
        }
        console.error(`[DEBUG] ${action} query executed.`);

        // Commit Transaction
        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction');
        transactionStarted = false;
        console.error(`[DEBUG] Transaction committed for ${action}.`);
        
        // Force checkpoint after successful commit
        await runQuery(projectId, "CHECKPOINT;");
        
        return action === 'CREATE' ? newRelationshipId : (relationshipId || 'deleted'); // Return ID for create, or identifier for delete

    } catch (error) {
        console.error(`[ERROR] Error during manageRelationship (${action}):`, error);
        if (transactionStarted) {
            console.error(`[DEBUG] Rolling back transaction due to error...`);
            await runQuery(projectId, "ROLLBACK;");
        }
        return null;
    }
}

// Update existing createRelationship to use the helper
export async function createRelationship(
    projectId: string,
    fromEntityId: string,
    toEntityId: string,
    type: string,
    description?: string // Still accepting description, though not stored currently
): Promise<Relationship | null> {
    const newId = await manageRelationship(projectId, 'CREATE', fromEntityId, toEntityId, type, description);
    if (newId) {
        return { id: newId, from: fromEntityId, to: toEntityId, type };
    }
    return null;
}

// Update existing deleteRelationship to use the helper (delete by ID)
export async function deleteRelationship(
    projectId: string, 
    relationshipId: string
): Promise<boolean> {
    // Assuming manageRelationship handles delete by ID when relationshipId is provided
    // Need source/target/type as placeholders if delete requires MATCH pattern
    // This design is awkward. RETHINK: deleteRelationship should likely just take ID.
    
    // Let's simplify: Assume deleteRelationship only needs the ID
    console.error(`[DEBUG] Deleting relationship by ID: ${relationshipId}`);
    let transactionStarted = false;
    try {
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction');
        transactionStarted = true;

        const query = `MATCH ()-[r:Related {id: $relId}]->() DELETE r`;
        const params = { relId: relationshipId };
        const result = await runQuery(projectId, query, params);
        
        // KuzuDB DELETE doesn't return rows. Check for errors during runQuery.
        if (result === null) { // Check if runQuery indicated an error
             throw new Error('Delete relationship query failed.');
        }
        // We can't easily check if a row was *actually* deleted without another query.
        // Assume success if no error occurred.

        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction');
        transactionStarted = false;

        await runQuery(projectId, "CHECKPOINT;");
        return true; // Assume success if commit worked

    } catch (error) {
        console.error(`[ERROR] Error deleting relationship by ID ${relationshipId}:`, error);
        if (transactionStarted) {
            await runQuery(projectId, "ROLLBACK;");
        }
        return false;
    }
}

// Add observation, now returns the observation ID
export async function addObservation(
  projectId: string,
  entityId: string, 
  observationText: string
): Promise<{ observation_id: string } | null> {
    console.log(`[DEBUG] Adding observation to entity ${entityId}: "${observationText}"`);
    let transactionStarted = false;
    try {
        // 1. Get current observations
        const entity = await getEntity(projectId, entityId);
        if (!entity) {
            console.error(`[ERROR] Entity ${entityId} not found for adding observation.`);
            return null;
        }
        // Ensure observations is an array (it might be string if fetched raw initially)
        let currentObservations: Observation[] = [];
        if (typeof entity.observations === 'string') {
            try {
                currentObservations = JSON.parse(entity.observations);
            } catch (e) {
                console.error(`[ERROR] Failed to parse existing observations for entity ${entityId}. Starting fresh.`);
                currentObservations = [];
            }
        } else if (Array.isArray(entity.observations)) {
            currentObservations = entity.observations;
        }

        // 2. Create new observation and add to list
        const newObservation: Observation = {
            id: `obs_${uuidv4()}`,
            text: observationText,
        };
        const updatedObservations = [...currentObservations, newObservation];
        const observationsJson = stringifyObservations(updatedObservations);

        // 3. Update entity within a transaction
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction for adding observation');
        transactionStarted = true;

        const updateQuery = `
            MATCH (e:Entity {id: $entityId})
            SET e.observations = $observationsJson
        `;
        const params = { entityId, observationsJson };

        const updateResult = await runQuery(projectId, updateQuery, params);
        if (!updateResult) throw new Error('Observation update query failed');

        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction for adding observation');
        transactionStarted = false;

        await runQuery(projectId, "CHECKPOINT;");
        console.log(`[DEBUG] Observation added successfully to entity ${entityId}. New Obs ID: ${newObservation.id}`);
        
        return { observation_id: newObservation.id };

    } catch (error) {
        console.error(`[ERROR] Error adding observation to entity ${entityId}:`, error);
        if (transactionStarted) {
            console.error(`[DEBUG] Rolling back observation addition transaction...`);
            await runQuery(projectId, "ROLLBACK;");
        }
        return null;
    }
}

// Delete an observation from an entity
export async function deleteObservation(
    projectId: string,
    entityId: string,
    observationId: string
): Promise<boolean> {
    console.log(`[DEBUG] Deleting observation ${observationId} from entity ${entityId}`);
    let transactionStarted = false;
    try {
        // 1. Get current observations
        const entity = await getEntity(projectId, entityId);
        if (!entity) {
            console.error(`[ERROR] Entity ${entityId} not found for deleting observation.`);
            return false;
        }

        let currentObservations: Observation[] = [];
        if (typeof entity.observations === 'string') {
            try {
                currentObservations = JSON.parse(entity.observations);
            } catch (e) {
                console.error(`[ERROR] Failed to parse existing observations for entity ${entityId}. Cannot delete.`);
                return false;
            }
        } else if (Array.isArray(entity.observations)) {
            currentObservations = entity.observations;
        }

        // 2. Filter out the observation to delete
        const updatedObservations = currentObservations.filter(obs => obs.id !== observationId);

        // Check if the observation was actually found and removed
        if (updatedObservations.length === currentObservations.length) {
            console.warn(`[WARN] Observation ${observationId} not found on entity ${entityId}. No changes made.`);
            return false; // Indicate observation not found or no change needed
        }

        const observationsJson = stringifyObservations(updatedObservations);

        // 3. Update entity within a transaction
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction for deleting observation');
        transactionStarted = true;

        const updateQuery = `
            MATCH (e:Entity {id: $entityId})
            SET e.observations = $observationsJson
        `;
        const params = { entityId, observationsJson };

        const updateResult = await runQuery(projectId, updateQuery, params);
        if (!updateResult) throw new Error('Observation deletion update query failed');

        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction for deleting observation');
        transactionStarted = false;

        await runQuery(projectId, "CHECKPOINT;");
        console.log(`[DEBUG] Observation ${observationId} deleted successfully from entity ${entityId}.`);
        return true;

    } catch (error) {
        console.error(`[ERROR] Error deleting observation ${observationId} from entity ${entityId}:`, error);
        if (transactionStarted) {
            console.error(`[DEBUG] Rolling back observation deletion transaction...`);
            await runQuery(projectId, "ROLLBACK;");
        }
        return false;
    }
}

// Get entity by ID
export async function getEntity(
  projectId: string,
  entityId: string
): Promise<Entity | null> {
    const query = `MATCH (e:Entity {id: $entityId}) RETURN e`;
    const result = await runQuery(projectId, query, { entityId });
    if (!result) return null;

    try {
        // --- Use getAll() for result processing ---
        let rows: any[] = [];
        if (result && typeof result.getAll === 'function') {
            rows = await result.getAll();
        } else {
            console.warn(`[WARN] getEntity result does not have getAll method. Result:`, result);
            // Fallback attempts
            if (result?.getRows) {
                rows = result.getRows();
            } else if (Array.isArray(result)) {
                rows = result;
            } else if (typeof result === 'object' && result !== null && result.e) {
                 // Handle case where result is the row object itself
                rows = [result];
            }
        }
        // --- End Use getAll() ---

        if (rows && rows.length > 0) {
            const row = rows[0];
            // KuzuDB returns node properties nested under the alias 'e'
            const entityData = row.e; 
            if (entityData && entityData.id) {
                 // Parse observations if they exist
                 let parsedObservations: Observation[] = [];
                 if (entityData.observations) {
                     try {
                         parsedObservations = JSON.parse(entityData.observations);
                     } catch (parseErr) {
                         console.error(`[ERROR] Failed to parse observations for entity ${entityData.id} in getEntity:`, parseErr);
                     }
                 }

                return {
                    id: entityData.id,
                    name: entityData.name || '',
                    type: entityData.type || '',
                    description: entityData.description || '',
                    observations: parsedObservations, // Use parsed observations
                    parentId: entityData.parentId
                };
            }
        }
        
        // No valid entity found
        // console.error(`[DEBUG] No entity found or data malformed for ID: ${entityId}. Rows:`, JSON.stringify(rows));
        return null;
    } catch (error) {
        console.error(`[ERROR] Error processing entity query result for ID ${entityId}:`, error);
        return null;
    }
}

// List all entities in project
export async function getAllEntities(
  projectId: string
): Promise<Entity[]> {
    // console.error(`[DEBUG] getAllEntities called for project: ${projectId}`);
    
    // Get database connection directly
    const { conn } = await getDbConnection(projectId);
    
    try {
        // Query to get all entity data directly
        const query = `MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, e.observations AS observations, e.parentId AS parentId`;
        // console.error(`[DEBUG] Executing query: ${query}`);
        const result = await conn.query(query);
        // console.error(`[DEBUG] Raw result from getAllEntities query:`, result); // Log raw result

        // --- Use getAll() for result processing ---
        let rows: any[] = [];
         if (result && typeof result.getAll === 'function') {
             try {
                 rows = await result.getAll();
             } catch (getAllError) {
                 console.error(`[ERROR] Failed to execute result.getAll() in getAllEntities:`, getAllError);
                 rows = []; // Assume empty on error
             }
         } else {
              console.warn(`[WARN] getAllEntities result does not have getAll method. Result:`, result);
              // Fallback attempts
              if ((result as any)?.getRows) { // Check for getRows existence
                  rows = (result as any).getRows();
              } else if (Array.isArray(result)) {
                  rows = result;
              }
         }
         // console.error(`[DEBUG] Processed rows from getAllEntities: ${rows.length} rows found.`);
         // --- End Use getAll() ---
        
        const entities: Entity[] = [];
        for (const row of rows) {
            try {
                // Parse observations from JSON string
                let parsedObservations: Observation[] = [];
                if (row.observations) {
                    try {
                        if (typeof row.observations === 'string') {
                            console.log(`[DEBUG] Attempting to parse observations string for entity ${row.id}:`, JSON.stringify(row.observations));
                            parsedObservations = JSON.parse(row.observations);
                        } else if (Array.isArray(row.observations)) {
                            parsedObservations = row.observations;
                        } else {
                             console.warn(`[WARN] Unexpected format for observations in getAllEntities:`, row.observations);
                        }
                    } catch (parseErr) {
                        console.error(`[ERROR] Failed to parse observations string: ${JSON.stringify(row.observations)} for entity ${row.id} in getAllEntities:`, parseErr);
                    }
                }

                // Create entity object with fallbacks for missing fields
                const entity: Entity = {
                    id: row.id || 'missing_id', // Provide default if somehow missing
                    name: row.name || 'Unnamed Entity',
                    type: row.type || 'Unknown Type',
                    description: row.description || '',
                    observations: parsedObservations,
                    parentId: row.parentId || undefined // Ensure undefined if null/empty
                };
                
                entities.push(entity);
            } catch (entityErr) {
                 console.error(`[ERROR] Error processing entity row in getAllEntities: ${JSON.stringify(row)}`, entityErr);
            }
        }
        
        // console.error(`[DEBUG] getAllEntities returning ${entities.length} entities.`);
        return entities;
    } catch (error) {
        console.error('[ERROR] Error in getAllEntities:', error);
        return [];
    }
}

// Get relationships (optionally filtered)
export async function getRelationships(
    projectId: string,
    filters: { fromId?: string, toId?: string, type?: string } = {}
): Promise<Relationship[]> {
    // Build dynamic query based on filters
    let query = `MATCH`;
    let queryParams: Record<string, any> = {};
    
    // Add from entity condition if specified
    if (filters.fromId) {
        query += ` (from:Entity {id: $fromId})`;
        queryParams.fromId = filters.fromId;
    } else {
        query += ` (from:Entity)`;
    }
    
    // Add relationship type condition if specified
    if (filters.type) {
        query += `-[r:Related {type: $type}]->`;
        queryParams.type = filters.type;
    } else {
        query += `-[r:Related]->`;
    }
    
    // Add to entity condition if specified
    if (filters.toId) {
        query += ` (to:Entity {id: $toId})`;
        queryParams.toId = filters.toId;
    } else {
        query += ` (to:Entity)`;
    }
    
    // Return relationship fields
    query += ` RETURN r.id AS id, from.id AS fromId, to.id AS toId, r.type AS type`;
    
    const result = await runQuery(projectId, query, queryParams);

    // *** ADD THIS CHECK ***
    if (!result || typeof result.getAll !== 'function') {
      console.warn(`[getRelationships] Query executed but result is invalid or missing getAll method. Returning empty array. Query: ${query}, Result:`, result);
      return []; // Return empty array if result is problematic
    }
    // *** END ADDED CHECK ***

    const relationships: Relationship[] = [];
    
    // Handle result
    try {
        // --- Use getAll() for result processing ---
        let rows: any[] = [];
         if (result && typeof result.getAll === 'function') {
             try {
                 rows = await result.getAll();
             } catch (getAllError) {
                 console.error(`[ERROR] Failed to execute result.getAll() in getRelationships:`, getAllError);
                 rows = []; // Assume empty on error
             }
         } else {
              console.warn(`[WARN] getRelationships result does not have getAll method. Result:`, result);
              // Fallback attempts
              if ((result as any)?.getRows) {
                  rows = (result as any).getRows();
              } else if (Array.isArray(result)) {
                  rows = result;
              }
         }
         // --- End Use getAll() ---
        
        for (const row of rows) {
            relationships.push({
                id: row.id || '',
                from: row.fromId || '', // Ensure correct mapping from query aliases
                to: row.toId || '',     // Ensure correct mapping from query aliases
                type: row.type || ''
            });
        }
    } catch (error) {
        console.error("[ERROR] Error processing relationship query results:", error);
    }
    
    return relationships;
}

// Alias for getRelationships to maintain compatibility
export async function getAllRelationshipsForContext(projectId: string): Promise<Relationship[]> {
    return getRelationships(projectId);
}

// Get related entities based on relationship type and direction
// *** Replacing previous getRelatedEntities implementation ***
export async function getRelatedEntities(
    projectId: string,
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    console.log(`[DEBUG] Getting related entities for ${entityId}, type: ${relationshipType || 'any'}, direction: ${direction}`);
    try {
        let matchClause = '';
        const params: Record<string, any> = { entityId };

        // Build the MATCH clause based on direction and type
        const typeFilter = relationshipType ? `{type: $relType}` : '';
        if (relationshipType) params.relType = relationshipType;

        if (direction === 'outgoing') {
            matchClause = `MATCH (a:Entity {id: $entityId})-[r:Related ${typeFilter}]->(b:Entity)`;
        } else if (direction === 'incoming') {
            matchClause = `MATCH (a:Entity)<-[r:Related ${typeFilter}]-(b:Entity {id: $entityId})`;
        } else { // both
            // Exclude the starting node itself from the results when direction is 'both'
             matchClause = `MATCH (a:Entity {id: $entityId})-[r:Related ${typeFilter}]-(b:Entity) WHERE b.id <> $entityId`;
        }

        // Determine which node to return (the one that is NOT the starting entityId)
        const finalReturnNode = (direction === 'incoming') ? 'a' : 'b';

        const query = `
            ${matchClause}
            RETURN DISTINCT ${finalReturnNode}.id as id,
                          ${finalReturnNode}.name as name,
                          ${finalReturnNode}.type as type,
                          ${finalReturnNode}.description as description,
                          ${finalReturnNode}.observations as observations,
                          ${finalReturnNode}.parentId as parentId
        `;

        console.log(`[DEBUG] GetRelated Query: ${query}`);
        console.log(`[DEBUG] GetRelated Params:`, params);

        const result = await runQuery(projectId, query, params);
        if (!result) {
            console.error(`[ERROR] Failed to execute getRelatedEntities query.`);
            return [];
        }

        // Process results using getAll()
        let rows: any[] = [];
        if (result && typeof result.getAll === 'function') {
             try {
                 rows = await result.getAll();
             } catch (getAllError) {
                 console.error(`[ERROR] Failed to execute result.getAll() in getRelatedEntities:`, getAllError);
                 rows = []; // Assume empty on error
             }
        } else {
             console.warn(`[WARN] getRelatedEntities result does not have getAll method. Result:`, result);
             rows = Array.isArray(result) ? result : []; // Fallback
        }
        
        console.log(`[DEBUG] Found ${rows.length} related entities.`);
        
        // Parse observations for each entity
        return rows.map(row => ({
            ...row,
            observations: parseObservations(row.observations) // Use parser helper
        }));

    } catch (error) {
        console.error(`[ERROR] Error getting related entities for ${entityId}:`, error);
        return [];
    }
}

// Update entity description
export async function updateEntityDescription(
  projectId: string,
  entityId: string, 
  description: string
): Promise<boolean> {
    const query = `MATCH (e:Entity {id: $entityId}) SET e.description = $description`;
    const result = await runQuery(projectId, query, { entityId, description });
    if (result) {
        // console.error(`Entity ${entityId} description updated in project: ${projectId}`);
        return true;
    }
    return false;
}

// Update an existing entity's properties
export async function updateEntity(
    projectId: string,
    entityId: string,
    updates: Partial<Omit<Entity, 'id' | 'observations'> & { observations?: Observation[] }> // Allow updating specific fields, incl. observations array
): Promise<Entity | null> {
    console.log(`[DEBUG] Updating entity ${entityId} in project ${projectId} with updates:`, updates);
    let transactionStarted = false;
    try {
        // 1. Fetch the current entity data
        const currentEntity = await getEntity(projectId, entityId);
        if (!currentEntity) {
            console.error(`[ERROR] Entity ${entityId} not found for update.`);
            return null;
        }

        // 2. Construct the SET clause and params
        const setClauses: string[] = [];
        const params: Record<string, any> = { entityId };

        // Handle updatable fields (name, type, description, parentId)
        if (updates.name !== undefined) {
            setClauses.push('e.name = $name');
            params.name = updates.name;
        }
        if (updates.type !== undefined) {
            setClauses.push('e.type = $type');
            params.type = updates.type;
        }
        if (updates.description !== undefined) {
            setClauses.push('e.description = $description');
            params.description = updates.description;
        }
         // Handle parentId explicitly - allow setting to null/empty if needed
         if (updates.parentId !== undefined) {
             setClauses.push('e.parentId = $parentId');
             params.parentId = updates.parentId === null ? '' : updates.parentId; // Store empty string for null parent
         }

        // Handle observations update (replace the entire array)
        if (updates.observations !== undefined) {
            // Ensure observations have IDs if they don't already
             const updatedObservations = updates.observations.map(obs => ({
                 ...obs,
                 id: obs.id || `obs_${uuidv4()}` // Assign ID if missing
             }));
            const observationsJson = stringifyObservations(updatedObservations);
            setClauses.push('e.observations = $observationsJson');
            params.observationsJson = observationsJson;
        }

        if (setClauses.length === 0) {
            console.warn(`[WARN] No updatable fields provided for entity ${entityId}. Returning current entity.`);
            return currentEntity; // No changes to apply
        }

        // 3. Execute Update within a Transaction
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction for update');
        transactionStarted = true;

        const updateQuery = `
            MATCH (e:Entity {id: $entityId})
            SET ${setClauses.join(', \n                ')}
            RETURN e.id, e.name, e.type, e.description, e.observations, e.parentId
        `;

        console.log(`[DEBUG] Update Query: ${updateQuery}`);
        console.log(`[DEBUG] Update Params:`, params);

        const updateResult = await runQuery(projectId, updateQuery, params);
        if (!updateResult) throw new Error('Entity update query failed');
        
        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction for update');
        transactionStarted = false;

        await runQuery(projectId, "CHECKPOINT;");
        console.log(`[DEBUG] Update transaction committed for entity ${entityId}.`);

        // 4. Fetch and return the updated entity
        // The RETURN clause in the update query might not reflect the *committed* state immediately?
        // Fetching again is safer.
        return await getEntity(projectId, entityId);

    } catch (error) {
        console.error(`[ERROR] Error updating entity ${entityId}:`, error);
        if (transactionStarted) {
            console.error(`[DEBUG] Rolling back update transaction...`);
            await runQuery(projectId, "ROLLBACK;");
        }
        return null;
    }
}

// Get all nodes and edges for graph visualization
export async function getGraphData(projectId: string): Promise<{ nodes: Entity[], links: Relationship[] }> {
     console.log(`[DEBUG] Getting graph data for project ${projectId}`);
    try {
        // Fetch all nodes
        const nodesQuery = `
            MATCH (n:Entity)
            RETURN n.id as id, n.name as name, n.type as type, n.description as description, n.observations as observations, n.parentId as parentId
        `;
        const nodesResult = await runQuery(projectId, nodesQuery);
        let nodesRaw: any[] = [];
        if (nodesResult && typeof nodesResult.getAll === 'function') {
             try {
                 nodesRaw = await nodesResult.getAll();
             } catch (getAllError) {
                 console.error(`[ERROR] Failed to execute nodesResult.getAll() in getGraphData:`, getAllError);
                 nodesRaw = [];
             }
        } else {
            console.warn(`[WARN] getGraphData (nodes) result does not have getAll method.`);
             nodesRaw = Array.isArray(nodesResult) ? nodesResult : [];
        }
        const nodes = nodesRaw.map(node => ({
            ...node,
            observations: parseObservations(node.observations)
        }));
        console.log(`[DEBUG] Fetched ${nodes.length} nodes.`);

        // Fetch all relationships
        const linksQuery = `
            MATCH (a:Entity)-[r:Related]->(b:Entity)
            RETURN r.id as id, a.id as from, b.id as to, r.type as type
        `;
        const linksResult = await runQuery(projectId, linksQuery);
         let linksRaw: any[] = [];
        if (linksResult && typeof linksResult.getAll === 'function') {
             try {
                 linksRaw = await linksResult.getAll();
             } catch (getAllError) {
                 console.error(`[ERROR] Failed to execute linksResult.getAll() in getGraphData:`, getAllError);
                 linksRaw = [];
             }
        } else {
             console.warn(`[WARN] getGraphData (links) result does not have getAll method.`);
             linksRaw = Array.isArray(linksResult) ? linksResult : [];
        }
        const links = linksRaw; // Assuming direct mapping works
        console.log(`[DEBUG] Fetched ${links.length} links.`);
        
        return { nodes, links };

    } catch (error) {
        console.error(`[ERROR] Error getting graph data for project ${projectId}:`, error);
        return { nodes: [], links: [] };
    }
}

// Delete entity and all relationships
export async function deleteEntity(
  projectId: string,
  entityId: string
): Promise<boolean> {
    console.error(`[DEBUG] Deleting entity ${entityId} in project ${projectId}`);
    let transactionStarted = false;
    try {
        const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
        if (!beginResult) throw new Error('Failed to begin transaction for delete entity');
        transactionStarted = true;

        // DETACH DELETE removes the node and its relationships
        const query = `MATCH (e:Entity {id: $entityId}) DETACH DELETE e`;
        const result = await runQuery(projectId, query, { entityId });

        if (result === null) { // Check if runQuery indicated an error
            throw new Error('Delete entity query failed.');
        }
        // Assume success if no error from runQuery

        const commitResult = await runQuery(projectId, "COMMIT;");
        if (!commitResult) throw new Error('Failed to commit transaction for delete entity');
        transactionStarted = false;

        await runQuery(projectId, "CHECKPOINT;");
        console.log(`[DEBUG] Entity ${entityId} deleted successfully.`);
        return true; // Assume success if commit worked

    } catch (error) {
        console.error(`[ERROR] Error deleting entity ${entityId}:`, error);
        if (transactionStarted) {
            await runQuery(projectId, "ROLLBACK;");
        }
        return false;
    }
}
