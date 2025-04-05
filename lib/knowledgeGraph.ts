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
import { EntityTypes, RelationshipTypes } from '@/lib/constants';
// Import project manager
import { getDbConnection } from '@/lib/projectManager';
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
        const { conn } = await getDbConnection(projectId);
        
        if (params) {
            // Use prepared statements: prepare on connection, then execute on connection
            console.log(`[DEBUG] Preparing statement: ${query.substring(0, 100)}...`);
            // @ts-ignore - Linter error might be due to outdated types, runtime expects prepare
            const statement = await conn.prepare(query);
            console.log(`[DEBUG] Executing prepared statement via conn.execute with params:`, params);
            // Pass prepared statement and params to conn.execute()
            // Add undefined for the progressCallback argument
            // @ts-ignore - Linter error might be due to outdated types, runtime expects execute
            const result = await conn.execute(statement, params, undefined); 
            console.log(`[DEBUG] Raw result from prepared statement execution:`, result);
            // Manually close statement if needed (check KuzuDB API)
            // await statement.close(); 
            return result;
        } else {
            console.log(`[DEBUG] Running non-parameterized query: ${query}`);
            // Add undefined for the progressCallback argument
            const result = await conn.query(query, undefined);
            console.log(`[DEBUG] Raw result from conn.query (non-parameterized):`, result);
            return result;
        }
    } catch (error) {
        console.error(`Error running query: ${query}`, error);
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
  console.log(`[DEBUG] Creating entity: ${name} (${type}) in project ${projectId}`);

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

    console.log(`[DEBUG] Executing combined entity creation query within explicit transaction`);
    let transactionStarted = false;
    try {
      // 1. Begin Transaction
      console.log(`[DEBUG] Beginning transaction...`);
      const beginResult = await runQuery(projectId, "BEGIN TRANSACTION;");
      if (!beginResult) {
          console.error(`[ERROR] Failed to begin transaction for entity "${name}".`);
          return null;
      }
      transactionStarted = true;
      console.log(`[DEBUG] Transaction begun.`);
      
      // 2. Execute the single creation query with parameters using runQuery
      const createResult = await runQuery(projectId, createQuery, params);
      
      // Check if runQuery returned a result (not null)
      if (!createResult) {
          console.error(`[ERROR] Entity creation query failed for name "${name}" within transaction.`);
          // Attempt rollback if transaction started
          if (transactionStarted) {
              console.log(`[DEBUG] Rolling back transaction due to creation failure...`);
              await runQuery(projectId, "ROLLBACK;");
          }
          return null;
      }
      console.log(`[DEBUG] Entity creation query executed within transaction for ID: ${id}.`);

      // 3. Commit Transaction
      console.log(`[DEBUG] Committing transaction...`);
      const commitResult = await runQuery(projectId, "COMMIT;");
      if (!commitResult) {
          console.error(`[ERROR] Failed to commit transaction for entity "${name}".`);
           // Attempt rollback - though commit failure might make this ineffective
           console.log(`[DEBUG] Attempting rollback after commit failure...`);
           await runQuery(projectId, "ROLLBACK;"); 
          return null; // Return null as commit failed
      }
      console.log(`[DEBUG] Transaction committed successfully for ID: ${id}.`);
      transactionStarted = false; // Transaction ended

      // --- Force Checkpoint (Diagnostic Step) ---
      console.log(`[DEBUG] Forcing CHECKPOINT after commit for ID: ${id}`);
      try {
        const checkpointResult = await runQuery(projectId, "CHECKPOINT;");
        if (checkpointResult) {
          console.log(`[DEBUG] CHECKPOINT executed successfully.`);
        } else {
          console.error(`[ERROR] CHECKPOINT command failed after commit.`);
        }
      } catch (checkpointError) {
        console.error(`[ERROR] Error executing CHECKPOINT command:`, checkpointError);
      }
      // --- End Force Checkpoint ---

      // --- Verification Step RE-ENABLED ---
      
      const verifyQuery = `MATCH (e:Entity {id: $id}) RETURN e.id`;
      console.log(`[DEBUG] Verifying entity exists with query: MATCH (e:Entity {id: ${id}}) RETURN e.id`);

      try {
        // Add more robust verification with retries
        let verificationPassed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`[DEBUG] Verification attempt ${attempt + 1} for entity ${id}`);
          
          // Add increasing delay between attempts
          if (attempt > 0) {
            console.log(`[DEBUG] Waiting ${100 * attempt}ms before retry...`);
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
          
          console.log(`[DEBUG] Verification rows (attempt ${attempt + 1}):`, JSON.stringify(verifyRows));

          if (verifyRows && verifyRows.length > 0 && verifyRows[0]['e.id'] === id) { // Check specific ID in result
            console.log(`[DEBUG] Entity verified in database on attempt ${attempt + 1}: ${id}`);
            verificationPassed = true;
            break;
          }
        }
        
        if (!verificationPassed) {
          // This case indicates a problem - the CREATE supposedly succeeded, but verification failed after retries.
          console.error(`[ERROR] Entity verification failed after ${3} attempts for ID: ${id}. The entity might not be queryable immediately.`);
          // Despite verification failure, we'll return the entity anyway as the transaction was committed
          console.log(`[DEBUG] Returning entity despite verification failure as transaction was committed: ${id}`);
        }
      } catch (verifyError) {
        console.error(`[ERROR] Error during entity verification for ID ${id}:`, verifyError);
        // Despite verification error, we'll return the entity anyway as the transaction was committed
        console.log(`[DEBUG] Returning entity despite verification error as transaction was committed: ${id}`);
      }
      
      // --- END Verification Step RE-ENABLED ---

      // --- Add Direct Persistence Check ---
      console.log(`[DEBUG] Performing direct persistence check immediately after commit for ID: ${id}`);
      try {
          const directCheckQuery = `MATCH (e:Entity {id: $id}) RETURN e.id`;
          const directCheckResult = await runQuery(projectId, directCheckQuery, { id });
          let directCheckRows: any[] = [];
          if (directCheckResult && typeof directCheckResult.getAll === 'function') {
              directCheckRows = await directCheckResult.getAll();
          }
          console.log(`[DEBUG] Direct persistence check result rows:`, JSON.stringify(directCheckRows));
          if (directCheckRows && directCheckRows.length > 0 && directCheckRows[0]['e.id'] === id) {
              console.log(`[SUCCESS] Direct persistence check PASSED for ${id}.`);
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
      console.log(`[DEBUG] Returning entity: ${id}`);
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

// Create a new relationship with ID
export async function createRelationship(
  projectId: string,
  fromEntityId: string, 
  toEntityId: string, 
  type: string, 
  description: string = "" // Optional description for potential future use
): Promise<Relationship | null> {
    // First, check if both entities exist
    try {
        // Corrected Cypher query for existence check
        const checkQuery = `MATCH (e:Entity {id: $id}) RETURN count(e) > 0`; 
        
        // Check source entity
        const fromExistsResult = await runQuery(projectId, checkQuery, { id: fromEntityId });
        let fromExists = false;
        
        if (fromExistsResult) {
            // TODO: Simplify this extraction based on the actual result structure 
            //       returned by KuzuDB for `RETURN count(e) > 0`.
            //       For now, keep the existing robust check.
            if (typeof fromExistsResult === 'object' && fromExistsResult !== null) {
                // Check for boolean result directly (assuming key might be implicit or standard)
                const keys = Object.keys(fromExistsResult);
                if (keys.length === 1 && typeof fromExistsResult[keys[0]] === 'boolean') {
                   fromExists = fromExistsResult[keys[0]];
                }
                // Fallback to existing checks if direct boolean not found
                else if ('exists' in fromExistsResult) { // Keep old check just in case alias works elsewhere
                    fromExists = !!fromExistsResult.exists;
                } 
                else if (Array.isArray(fromExistsResult) && fromExistsResult.length > 0) {
                     // Assuming the boolean might be in the first row, first column
                    const firstRow = fromExistsResult[0];
                    const firstColKey = Object.keys(firstRow)[0];
                    if (firstColKey && typeof firstRow[firstColKey] === 'boolean') {
                        fromExists = firstRow[firstColKey];
                    } else if (firstRow.exists !== undefined) { // Check for 'exists' key specifically
                        fromExists = !!firstRow.exists;
                    }
                }
                else if (typeof (fromExistsResult as any).getRows === 'function') {
                    const rows = (fromExistsResult as any).getRows();
                    if (rows && rows.length > 0) {
                         // Assuming the boolean might be in the first row, first column
                        const firstRow = rows[0];
                        const firstColKey = Object.keys(firstRow)[0];
                         if (firstColKey && typeof firstRow[firstColKey] === 'boolean') {
                            fromExists = firstRow[firstColKey];
                         } else if (firstRow.exists !== undefined) { // Check for 'exists' key specifically
                            fromExists = !!firstRow.exists;
                        }
                    }
                }
            } else if (typeof fromExistsResult === 'boolean') { // If the result itself is boolean
                 fromExists = fromExistsResult;
            }
        }
        
        // Check target entity with same approach
        const toExistsResult = await runQuery(projectId, checkQuery, { id: toEntityId });
        let toExists = false;
        
         if (toExistsResult) {
            // TODO: Simplify this extraction based on the actual result structure 
            //       returned by KuzuDB for `RETURN count(e) > 0`.
            //       For now, keep the existing robust check.
             if (typeof toExistsResult === 'object' && toExistsResult !== null) {
                 // Check for boolean result directly (assuming key might be implicit or standard)
                 const keys = Object.keys(toExistsResult);
                 if (keys.length === 1 && typeof toExistsResult[keys[0]] === 'boolean') {
                    toExists = toExistsResult[keys[0]];
                 }
                 // Fallback to existing checks if direct boolean not found
                 else if ('exists' in toExistsResult) { // Keep old check just in case alias works elsewhere
                     toExists = !!toExistsResult.exists;
                 } 
                 else if (Array.isArray(toExistsResult) && toExistsResult.length > 0) {
                      // Assuming the boolean might be in the first row, first column
                     const firstRow = toExistsResult[0];
                     const firstColKey = Object.keys(firstRow)[0];
                     if (firstColKey && typeof firstRow[firstColKey] === 'boolean') {
                         toExists = firstRow[firstColKey];
                     } else if (firstRow.exists !== undefined) { // Check for 'exists' key specifically
                         toExists = !!firstRow.exists;
                     }
                 }
                 else if (typeof (toExistsResult as any).getRows === 'function') {
                     const rows = (toExistsResult as any).getRows();
                     if (rows && rows.length > 0) {
                          // Assuming the boolean might be in the first row, first column
                         const firstRow = rows[0];
                         const firstColKey = Object.keys(firstRow)[0];
                          if (firstColKey && typeof firstRow[firstColKey] === 'boolean') {
                             toExists = firstRow[firstColKey];
                          } else if (firstRow.exists !== undefined) { // Check for 'exists' key specifically
                             toExists = !!firstRow.exists;
                         }
                     }
                 }
             } else if (typeof toExistsResult === 'boolean') { // If the result itself is boolean
                  toExists = toExistsResult;
             }
         }

        if (!fromExists || !toExists) {
            console.error(`Cannot create relationship: Entity ${!fromExists ? fromEntityId : toEntityId} not found in project: ${projectId}`);
            return null;
        }

        // Create the relationship if both entities exist
        const relId = `rel_${uuidv4()}`; // Generate UUID for relationship
        const query = `
            MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
            CREATE (from)-[r:Related {id: $relId, type: $type}]->(to)
            RETURN $relId as id
        `;
        const params = { fromId: fromEntityId, toId: toEntityId, type, relId };
        const result = await runQuery(projectId, query, params);
        
        // Check if the relationship was created
        if (result) {
            // Add verification with retry mechanism
            let verificationPassed = false;
            const verifyQuery = `MATCH (from:Entity {id: $fromId})-[r:Related {id: $relId}]->(to:Entity {id: $toId}) RETURN r.id`;
            
            for (let attempt = 0; attempt < 3; attempt++) {
                console.log(`[DEBUG] Relationship verification attempt ${attempt + 1} for ${relId}`);
                
                // Add increasing delay between attempts
                if (attempt > 0) {
                    console.log(`[DEBUG] Waiting ${100 * attempt}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                }
                
                try {
                    const verifyResult = await runQuery(projectId, verifyQuery, { 
                        fromId: fromEntityId, 
                        toId: toEntityId,
                        relId 
                    });
                    
                    // Check for results similar to entity verification
                    let verifyRows = [];
                    if (verifyResult?.getRows) {
                        verifyRows = verifyResult.getRows();
                    } else if (Array.isArray(verifyResult)) {
                        verifyRows = verifyResult.filter(row => row && row['r.id']);
                    } else if (verifyResult && typeof verifyResult === 'object') {
                        if (verifyResult['r.id'] === relId) {
                            verifyRows = [verifyResult];
                        }
                    }
                    
                    if (verifyRows && verifyRows.length > 0) {
                        console.log(`[DEBUG] Relationship verified in database on attempt ${attempt + 1}: ${relId}`);
                        verificationPassed = true;
                        break;
                    }
                } catch (verifyError) {
                    console.error(`[ERROR] Error during relationship verification for ID ${relId}:`, verifyError);
                }
            }
            
            if (!verificationPassed) {
                console.error(`[ERROR] Relationship verification failed after ${3} attempts for ID: ${relId}. The relationship might not be queryable immediately.`);
            }
            
            // Return the relationship data regardless of verification outcome
            console.log(`Relationship created: (${fromEntityId})-[${type}, ${relId}]->(${toEntityId}) in project: ${projectId}`);
            return { id: relId, from: fromEntityId, to: toEntityId, type };
        }
    } catch (error) {
        console.error(`Error creating relationship in project ${projectId}:`, error);
    }
    
    console.error(`Failed to create relationship: (${fromEntityId})-[${type}]->(${toEntityId}) in project: ${projectId}`);
    return null;
}

// Add observation, now returns the observation ID
export async function addObservation(
  projectId: string,
  entityId: string, 
  observationText: string
): Promise<{ observation_id: string } | null> {
    try {
        // First, read the current observations
        const readQuery = `MATCH (e:Entity {id: $id}) RETURN e.observations AS obs`;
        const readResult = await runQuery(projectId, readQuery, { id: entityId });
        
        if (!readResult) {
            console.error(`Cannot add observation: Entity ${entityId} not found in project: ${projectId}`);
            return null;
        }
        
        // Extract observations from result using different possible formats
        let existingObs: Observation[] = [];
        
        // Try direct property access
        if (readResult.obs) {
            existingObs = readResult.obs;
        }
        // Try as array result
        else if (Array.isArray(readResult) && readResult.length > 0) {
            existingObs = readResult[0].obs || [];
        }
        // Try with getRows method
        else if ((readResult as any).getRows) {
            const rows = (readResult as any).getRows();
            if (rows && rows.length > 0) {
                existingObs = rows[0].obs || [];
            }
        }
        
        // Create and add the new observation
        const newObservationId = `obs_${uuidv4()}`;
        const newObservation: Observation = { id: newObservationId, text: observationText };
        const newObsList = [...existingObs, newObservation];

        // Update the entity with the new observations list
        const writeQuery = `MATCH (e:Entity {id: $id}) SET e.observations = $newObsList`;
        const writeResult = await runQuery(projectId, writeQuery, { id: entityId, newObsList });
        
        if (writeResult) {
            console.log(`Observation ${newObservationId} added to entity: ${entityId} in project: ${projectId}`);
            return { observation_id: newObservationId };
        }
        
        console.error(`Failed to add observation to entity: ${entityId} in project: ${projectId}`);
        return null;
    } catch (error) {
        console.error(`Error adding observation to entity ${entityId} in project ${projectId}:`, error);
        return null;
    }
}

// Delete observation by its ID
export async function deleteObservation(
  projectId: string,
  entityId: string, 
  observationId: string
): Promise<boolean> {
    try {
        // First, read the current observations
        const readQuery = `MATCH (e:Entity {id: $entityId}) RETURN e.observations AS obs`;
        const readResult = await runQuery(projectId, readQuery, { entityId });
        
        if (!readResult) {
            console.error(`Cannot delete observation: Entity ${entityId} not found in project: ${projectId}`);
            return false;
        }
        
        // Extract observations from result using different possible formats
        let existingObs: Observation[] = [];
        
        // Try direct property access
        if (readResult.obs) {
            existingObs = readResult.obs;
        }
        // Try as array result
        else if (Array.isArray(readResult) && readResult.length > 0) {
            existingObs = readResult[0].obs || [];
        }
        // Try with getRows method
        else if ((readResult as any).getRows) {
            const rows = (readResult as any).getRows();
            if (rows && rows.length > 0) {
                existingObs = rows[0].obs || [];
            }
        }
        
        // Filter out the observation to delete
        const updatedObsList = existingObs.filter(obs => obs.id !== observationId);

        // If no change in length, the observation wasn't found
        if (updatedObsList.length === existingObs.length) {
            console.warn(`Observation ${observationId} not found on entity ${entityId} in project: ${projectId}`);
            // Return true because the desired state (observation gone) is achieved
            return true;
        }

        // Update the entity with the filtered observations list
        const writeQuery = `MATCH (e:Entity {id: $entityId}) SET e.observations = $updatedObsList`;
        const writeResult = await runQuery(projectId, writeQuery, { entityId, updatedObsList });
        
        if (writeResult) {
            console.log(`Observation ${observationId} deleted from entity: ${entityId} in project: ${projectId}`);
            return true;
        }
        
        console.error(`Failed to delete observation from entity: ${entityId} in project: ${projectId}`);
        return false;
    } catch (error) {
        console.error(`Error deleting observation from entity ${entityId} in project ${projectId}:`, error);
        return false;
    }
}

// Delete entity and all relationships
export async function deleteEntity(
  projectId: string,
  entityId: string
): Promise<boolean> {
    const query = `MATCH (e:Entity {id: $entityId}) DETACH DELETE e`;
    const result = await runQuery(projectId, query, { entityId });
    if (result) {
        console.log(`Entity ${entityId} deleted with all relationships in project: ${projectId}`);
        return true;
    }
    return false;
}

// Delete relationship by ID
export async function deleteRelationship(
  projectId: string,
  relationshipId: string
): Promise<boolean> {
    const query = `MATCH ()-[r:Related {id: $relationshipId}]->() DELETE r`;
    const result = await runQuery(projectId, query, { relationshipId });
    if (result) {
        console.log(`Relationship ${relationshipId} deleted in project: ${projectId}`);
        return true;
    }
    return false;
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
        console.log(`[DEBUG] No entity found or data malformed for ID: ${entityId}. Rows:`, JSON.stringify(rows));
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
    console.log(`[DEBUG] getAllEntities called for project: ${projectId}`);
    
    // Get database connection directly
    const { conn } = await getDbConnection(projectId);
    
    try {
        // Query to get all entity data directly
        const query = `MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, e.observations AS observations, e.parentId AS parentId`;
        console.log(`[DEBUG] Executing query: ${query}`);
        const result = await conn.query(query);
        console.log(`[DEBUG] Raw result from getAllEntities query:`, result); // Log raw result

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
         console.log(`[DEBUG] Processed rows from getAllEntities: ${rows.length} rows found.`);
         // --- End Use getAll() ---
        
        const entities: Entity[] = [];
        for (const row of rows) {
            try {
                // Parse observations from JSON string
                let parsedObservations: Observation[] = [];
                if (row.observations) {
                    try {
                        // KuzuDB might return observations directly as parsed JSON/objects in newer versions or specific setups
                        if (typeof row.observations === 'string') {
                            parsedObservations = JSON.parse(row.observations);
                        } else if (Array.isArray(row.observations)) { 
                            // Assume it's already parsed if it's an array
                            parsedObservations = row.observations; 
                        } else {
                             console.warn(`[WARN] Unexpected format for observations in getAllEntities:`, row.observations);
                        }
                    } catch (parseErr) {
                        console.error(`[ERROR] Failed to parse observations for entity ${row.id} in getAllEntities:`, parseErr);
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
        
        console.log(`[DEBUG] getAllEntities returning ${entities.length} entities.`);
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
    if (!result) return [];
    
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

// Get related entities
export async function getRelatedEntities(
  projectId: string,
  entityId: string,
  relationshipType?: string,
  direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    // We'll need different queries based on the direction
    let query = '';
    let queryParams: Record<string, any> = { entityId };
    if (relationshipType) queryParams.relType = relationshipType;
    
    // Build query based on direction
    if (direction === 'outgoing' || direction === 'both') {
        const outQuery = `
            MATCH (e:Entity {id: $entityId})-[r:Related${relationshipType ? " {type: $relType}" : ""}]->(related:Entity)
            RETURN DISTINCT related AS entity
        `;
        query = outQuery;
    }
    
    if (direction === 'incoming' || direction === 'both') {
        const inQuery = `
            MATCH (e:Entity {id: $entityId})<-[r:Related${relationshipType ? " {type: $relType}" : ""}]-(related:Entity)
            RETURN DISTINCT related AS entity
        `;
        
        // If we're doing both directions, combine queries with UNION
        if (direction === 'both' && query) {
            query += ` UNION ${inQuery}`;
        } else {
            query = inQuery;
        }
    }
    
    const result = await runQuery(projectId, query, queryParams);
    if (!result) return [];
    
    const relatedEntities: Entity[] = [];
    
    // Process results based on available methods
    try {
        // Try to access result rows directly
        if (typeof result === 'object' && result !== null) {
            // If the result is array-like or can be converted to array
            const rows = Array.isArray(result) ? result : 
                         (result as any).getRows ? (result as any).getRows() : 
                         [result];
                         
            for (const row of rows) {
                // Try to extract the entity data
                const entity = row.entity || row; 
                
                // Check if entity has expected fields
                if (entity && entity.id) {
                    relatedEntities.push({
                        id: entity.id,
                        name: entity.name || '',
                        type: entity.type || '',
                        description: entity.description || '',
                        observations: entity.observations || [],
                        parentId: entity.parentId
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error processing related entities query results:", error);
    }
    
    return relatedEntities;
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
        console.log(`Entity ${entityId} description updated in project: ${projectId}`);
        return true;
    }
    return false;
}

console.log("Knowledge graph library refactored for server-side KuzuDB use.");