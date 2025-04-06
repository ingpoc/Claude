"use server";

// This file exposes the server-side KuzuDB functions as Server Actions
// Client components will import from here, using the API endpoints.

// Remove direct imports from lib/knowledgeGraph
/*
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
*/

// Import types if they are defined separately, otherwise define inline or fetch from API schema if available
// Assuming Entity and Relationship types are needed for return signatures.
// Define placeholder types if not available elsewhere.
export interface Observation {
  id: string;
  text: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: Observation[] | string; // API might return JSON string initially
  parentId?: string;
}

export interface Relationship {
  id: string;
  from: string; // Corresponds to sourceId in API request
  to: string;   // Corresponds to targetId in API request
  type: string;
  // description?: string; // API doesn't currently handle description for relationships
}


// import { SessionManager } from "../../lib/mcp/SessionManager"; // No longer needed directly here

// Define the base URL for the UI API
const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || 'http://localhost:3001';

// Helper function for API calls
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`[API Action] Fetching: ${options.method || 'GET'} ${url}`);
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            // Add cache: 'no-store' to ensure fresh data for Server Actions
            cache: 'no-store',
        });

        if (!response.ok) {
            let errorBody = 'Unknown error';
            try {
                errorBody = await response.text(); // Try to get error details
            } catch (_) { /* Ignore parsing error */ }
            console.error(`[API Action] Error fetching ${url}: ${response.status} ${response.statusText}`, errorBody);
             // Propagate specific errors if needed, e.g., 404 for not found
             if (response.status === 404) return null; // Treat 404 as null result generally
             if (response.status === 501) { // Not Implemented
                 console.warn(`[API Action] Endpoint ${url} is not implemented on the server.`);
                 return null;
             }
             // For other errors, maybe throw or return a specific error structure
             // For now, returning null for simplicity in actions
             return null;
        }

        // Handle 204 No Content specifically (for DELETE)
        if (response.status === 204) {
            // // console.log(`[API Action] Success (204 No Content): ${options.method || 'GET'} ${url}`);
            return true as T; // Assuming T is boolean for DELETE success
        }

        // // console.log(`[API Action] Success: ${options.method || 'GET'} ${url}`);
        const data = await response.json();
        return data as T;
    } catch (error) {
        console.error(`[API Action] Network or other error fetching ${url}:`, error);
        return null; // Return null on network error or other exceptions
    }
}


// Default project ID to use when one is not provided (can still be used as fallback)
const DEFAULT_PROJECT_ID = "current_project"; // Or fetch a default from config/API if needed

// --- Rewritten Server Actions using fetchApi ---

export async function createEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    name: string,
    type: string,
    description: string,
    observationsText: string[] = [], // API expects simple array of strings? Check API spec
    parentId?: string
): Promise<Entity | null> {
    // Note: The API endpoint POST /api/ui/projects/:projectId/entities
    // expects `observations` in the body. Ensure this matches.
    // The current implementation in standalone-server expects observations: string[]
    return await fetchApi<Entity>(`/api/ui/projects/${projectId}/entities`, {
        method: 'POST',
        body: JSON.stringify({ name, type, description, observations: observationsText, parentId }),
    });
}

export async function createRelationship(
    projectId: string = DEFAULT_PROJECT_ID,
    fromEntityId: string,
    toEntityId: string,
    type: string,
    // description: string = "" // API currently does not support relationship description
): Promise<Relationship | null> {
    return await fetchApi<Relationship>(`/api/ui/projects/${projectId}/relationships`, {
        method: 'POST',
        body: JSON.stringify({ sourceId: fromEntityId, targetId: toEntityId, type }),
    });
}

// Implemented - Calls POST /entities/:entityId/observations
export async function addObservation(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string,
    observationText: string
): Promise<{ observation_id: string } | null> {
    // console.warn("[API Action] addObservation: Not implemented via API yet.");
    // TODO: Implement when API endpoint exists
    // return null;
    return await fetchApi<{ observation_id: string }>(`/api/ui/projects/${projectId}/entities/${entityId}/observations`, {
        method: 'POST',
        body: JSON.stringify({ text: observationText }),
    });
    // return await addObservationDb(projectId, entityId, observationText);
}

export async function deleteEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string
): Promise<boolean> {
    const success = await fetchApi<boolean>(`/api/ui/projects/${projectId}/entities/${entityId}`, {
        method: 'DELETE',
    });
    return success ?? false; // Return false if fetchApi returned null
}

export async function deleteRelationship(
    projectId: string = DEFAULT_PROJECT_ID,
    relationshipId: string
): Promise<boolean> {
    // API uses relationshipId in the path
    const success = await fetchApi<boolean>(`/api/ui/projects/${projectId}/relationships/${relationshipId}`, {
        method: 'DELETE',
    });
     return success ?? false; // Return false if fetchApi returned null
}

export async function getEntity(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string
): Promise<Entity | null> {
    return await fetchApi<Entity>(`/api/ui/projects/${projectId}/entities/${entityId}`);
}

export async function getAllEntities(
    projectId: string = DEFAULT_PROJECT_ID
): Promise<Entity[]> {
    const entities = await fetchApi<Entity[]>(`/api/ui/projects/${projectId}/entities`);
    return entities ?? []; // Return empty array if fetchApi returned null
}

// Stubbed/Commented Out - API endpoint /api/ui/projects/:projectId/relationships exists,
// but its filtering capabilities might differ from the original getAllRelationshipsForContextDb
// which might have fetched *all* relationships unconditionally.
export async function getAllRelationshipsForContext(
    projectId: string = DEFAULT_PROJECT_ID
): Promise<Relationship[]> {
    console.warn("[API Action] getAllRelationshipsForContext: Functionality may differ or not be fully implemented via API yet. Using basic /relationships endpoint.");
    // Fetching all relationships without filters for now
    const relationships = await fetchApi<Relationship[]>(`/api/ui/projects/${projectId}/relationships`);
    return relationships ?? []; // Return empty array if fetchApi returned null
    // Original call: return await getAllRelationshipsForContextDb(projectId);
}

// Implemented - Calls GET /entities/:entityId/related
export async function getRelatedEntities(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string,
    relationshipType?: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
): Promise<Entity[]> {
    // console.warn("[API Action] getRelatedEntities: Not implemented via API yet.");
    // Build query parameters
    const params = new URLSearchParams();
    if (relationshipType) {
        params.append('type', relationshipType);
    }
    if (direction) { // Direction always has a value (defaults to 'both')
        params.append('direction', direction);
    }
    const queryString = params.toString();
    const endpoint = `/api/ui/projects/${projectId}/entities/${entityId}/related${queryString ? '?' + queryString : ''}`;

    const entities = await fetchApi<Entity[]>(endpoint);
    return entities ?? []; // Return empty array on null
    // Original call: return await getRelatedEntitiesDb(projectId, entityId, relationshipType, direction);
}

// Implemented - Calls general PUT /entities/:entityId
export async function updateEntityDescription(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string,
    description: string
): Promise<boolean> {
    // console.warn("[API Action] updateEntityDescription: Not implemented via API yet (requires general entity PUT).");
    const result = await fetchApi<Entity>(`/api/ui/projects/${projectId}/entities/${entityId}`, {
        method: 'PUT',
        body: JSON.stringify({ description }), // Send only the description field
    });
    return result !== null; // Return true if update was seemingly successful (API returned the updated entity)
    // Original call: return await updateEntityDescriptionDb(projectId, entityId, description);
}

// Implemented - Calls DELETE /entities/:entityId/observations/:observationId
export async function deleteObservation(
    projectId: string = DEFAULT_PROJECT_ID,
    entityId: string,
    observationId: string
): Promise<boolean> {
    // console.warn("[API Action] deleteObservation: Not implemented via API yet.");
    const success = await fetchApi<boolean>(`/api/ui/projects/${projectId}/entities/${entityId}/observations/${observationId}`, {
        method: 'DELETE',
    });
    return success ?? false; // Return false if fetchApi returned null
    // Original call: return await deleteObservationDb(projectId, entityId, observationId);
}

// == Project Actions ==
// If you have project actions (createProject, getProjects, deleteProject) in a separate file,
// modify them similarly. For example:

/*
import { ProjectMetadata } from '../../lib/projectManager'; // Assuming type exists

export async function getProjects(): Promise<ProjectMetadata[]> {
    const projects = await fetchApi<ProjectMetadata[]>('/api/ui/projects');
    return projects ?? [];
}

export async function createProjectAction(name: string, description?: string): Promise<ProjectMetadata | null> {
    return await fetchApi<ProjectMetadata>('/api/ui/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || "" }),
    });
}

export async function deleteProjectAction(projectId: string): Promise<boolean> {
    const success = await fetchApi<boolean>(`/api/ui/projects/${projectId}`, {
        method: 'DELETE',
    });
    return success ?? false;
}

export async function getProjectAction(projectId: string): Promise<ProjectMetadata | null> {
    return await fetchApi<ProjectMetadata>(`/api/ui/projects/${projectId}`);
}
*/ 