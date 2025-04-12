"use server";

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as kuzu from 'kuzu';

// Define the project metadata type
export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed: string;
}

// Add a flag to track if schema was initialized for a given DB path
const schemaInitializedPaths = new Set<string>();

// *** REINTRODUCE connectionCache ***
const connectionCache: Record<string, { db: kuzu.Database, conn: kuzu.Connection, lastAccessed: number }> = {};

// Determine Project Root: Prioritize ENV variable, fallback for non-Next.js context
const getProjectRoot = () => {
  // Check if running in Next.js context AND the variable is set
  if (process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR) {
    // console.log("[ProjectManager] Using NEXT_PUBLIC_PROJECT_ROOT_DIR env var:", process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR);
    return process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR;
  } else {
    // Fallback for other contexts (like the standalone server run from dist)
    const fallbackPath = path.resolve(__dirname, '..');
    // console.log(`[ProjectManager] NEXT_PUBLIC_PROJECT_ROOT_DIR not set or not in Next.js context. Falling back to path relative to __dirname (${__dirname}): ${fallbackPath}`);
    return fallbackPath;
  }
};

const PROJECT_ROOT = getProjectRoot();
const PROJECTS_DIR = path.join(PROJECT_ROOT, '.kuzu-db');
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');

// Keep logs for confirmation - COMMENTED OUT FOR STDIO COMPATIBILITY
// console.error(`[ProjectManager Init - Final Attempt] Using PROJECT_ROOT: ${PROJECT_ROOT}`);
// console.error(`[ProjectManager Init - Final Attempt] Using PROJECTS_DIR: ${PROJECTS_DIR}`);
// console.error(`[ProjectManager Init - Final Attempt] Using PROJECTS_FILE: ${PROJECTS_FILE}`);

// Initialize the projects directory and metadata file if they don't exist
function ensureProjectInfrastructure() {
  console.error(`[Project Infra Check] Target Dir: ${PROJECTS_DIR}, Target File: ${PROJECTS_FILE}`);
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      console.error(`[Project Infra Check] Projects directory NOT FOUND: ${PROJECTS_DIR}. Creating...`);
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    } else {
      console.error(`[Project Infra Check] Projects directory FOUND: ${PROJECTS_DIR}`);
    }

    if (!fs.existsSync(PROJECTS_FILE)) {
      console.error(`[Project Infra Check] Projects file NOT FOUND: ${PROJECTS_FILE}. Creating...`);
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }), 'utf8');
    } else {
      console.error(`[Project Infra Check] Projects file FOUND: ${PROJECTS_FILE}`);
    }
  } catch (error) {
    console.error(`[Project Infra Check] FAILED to ensure project infrastructure:`, error);
    throw error;
  }
}

// --- NEW Helper: Read projects data --- 
// Read projects data from the JSON file
async function readProjectsData(): Promise<ProjectMetadata[]> {
    ensureProjectInfrastructure();
    try {
        const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
        const { projects } = JSON.parse(data);
        // Basic validation - ensure projects is an array
        return Array.isArray(projects) ? projects : [];
    } catch (error) {
        console.error('Error reading projects metadata:', error);
        // If file is corrupt or unreadable, return empty array or throw
        return [];
    }
}

// --- NEW Helper: Write projects data --- 
// Write projects data to the JSON file
async function writeProjectsData(projects: ProjectMetadata[]): Promise<void> {
    ensureProjectInfrastructure(); // Ensure directory exists before writing
    try {
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing projects metadata:', error);
        throw error; // Re-throw write errors as they are critical
    }
}

// Get all projects - Updated to use helper
export async function getProjects(): Promise<ProjectMetadata[]> {
  // ensureProjectInfrastructure(); // No longer needed here, handled by readProjectsData
  return await readProjectsData();
  /* Original code:
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const { projects } = JSON.parse(data);
    return projects;
  } catch (error) {
    console.error('Error reading projects metadata:', error);
    return [];
  }
  */
}

// Create a new project - Updated to use helpers
export async function createProject(name: string, description: string = ""): Promise<ProjectMetadata | null> {
  try {
    // Use read helper
    const projects = await readProjectsData(); 
    
    // Check if project with same name already exists (case-insensitive)
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      console.error(`Project with name '${name}' already exists (case-insensitive).`);
      return null;
    }
    
    // Create new project object
    const newProject: ProjectMetadata = {
      id: `project_${uuidv4()}`,
      name,
      description,
      createdAt: new Date().toISOString(), // Keep for versioning
      lastAccessed: new Date().toISOString()
    };
    
    // Add to projects metadata and use write helper
    projects.push(newProject);
    await writeProjectsData(projects);
    
    // Initialize database connection/schema
    await getDbConnection(newProject.id);

    console.log(`[ProjectManager] Project created: ${newProject.id} (${newProject.name})`);    
    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

// Get a specific project by ID - Updated to use helper
export async function getProject(projectId: string): Promise<ProjectMetadata | null> {
  const projects = await readProjectsData(); // Use helper
  const project = projects.find(p => p.id === projectId);
  
  if (project) {
    // Update last accessed time (fire and forget is okay here)
    updateProjectAccess(projectId).catch(err => console.error("[ProjectManager] Background update access failed", err));
    return project;
  }
  
  return null;
}

// --- NEW Function: Get Project by Name or ID --- 
/**
 * Finds a project by its ID or name (case-insensitive).
 * Updates lastAccessed time if found.
 * @param identifier Project ID or Name
 * @returns ProjectMetadata or null if not found
 */
export async function getProjectByNameOrId(identifier: string): Promise<ProjectMetadata | null> {
    console.log(`[ProjectManager] Searching for project by identifier: ${identifier}`);
    const projects = await readProjectsData(); // Use helper
    let foundProject: ProjectMetadata | undefined;

    // Try finding by ID first (exact match)
    foundProject = projects.find(p => p.id === identifier);

    // If not found by ID, try finding by name (case-insensitive)
    if (!foundProject) {
        const lowerCaseIdentifier = identifier.toLowerCase();
        foundProject = projects.find(p => p.name.toLowerCase() === lowerCaseIdentifier);
    }

    if (foundProject) {
        console.log(`[ProjectManager] Found project: ${foundProject.id} (${foundProject.name})`);
        // Update last accessed time in the background
        updateProjectAccess(foundProject.id).catch(err => {
             console.error(`[ProjectManager] Background update access failed for ${foundProject?.id}:`, err);
        });
        return foundProject;
    }

    console.log(`[ProjectManager] Project not found for identifier: ${identifier}`);
    return null;
}
// --- End of NEW Function ---

// Update project's last accessed time - Updated to use helpers
async function updateProjectAccess(projectId: string): Promise<boolean> {
  try {
    const projects = await readProjectsData(); // Use helper
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
        console.warn(`[ProjectManager] Attempted to update access for non-existent project ID: ${projectId}`);
        return false;
    }
    
    projects[projectIndex].lastAccessed = new Date().toISOString();
    await writeProjectsData(projects); // Use helper
    // console.log(`[ProjectManager] Updated last access time for project: ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Error updating project access time for ${projectId}:`, error);
    return false;
  }
}

// Initialize schema for a KuzuDB connection
// Added dbPath parameter and check against schemaInitializedPaths
async function initializeSchema(conn: kuzu.Connection, dbPath: string): Promise<void> {
    // Check if schema was already initialized for this DB path in this run
    if (schemaInitializedPaths.has(dbPath)) {
        // console.log(`[Schema] Initialization already done for ${dbPath}. Skipping.`);
        return;
    }
    try {
        console.error(`[Schema] Initializing KuzuDB schema for ${dbPath}...`);
        
        // Create entity node with properties
        await conn.query(`
            CREATE NODE TABLE IF NOT EXISTS Entity (
                id STRING PRIMARY KEY,
                name STRING,
                type STRING,
                description STRING,
                observations STRING, 
                parentId STRING
            )
        `);
        console.error("[Schema] Entity table checked/created.");
        
        // Create relationship type
        await conn.query(`
            CREATE REL TABLE IF NOT EXISTS Related (
                FROM Entity TO Entity,
                id STRING,
                type STRING
            )
        `);
        console.error("[Schema] Related table checked/created.");
        
        console.error(`[Schema] KuzuDB schema initialization complete for ${dbPath}.`);
        schemaInitializedPaths.add(dbPath); // Mark as initialized
    } catch (error) {
        console.error(`[Schema] Error initializing KuzuDB schema for ${dbPath}:`, error);
        // Don't re-throw here, allow connection to proceed but log the error
    }
}

// Get or create a KuzuDB connection for a project
// Updated to pass dbPath to initializeSchema
export async function getDbConnection(projectId: string): Promise<{ conn: kuzu.Connection }> {
    const projectDirPath = path.join(PROJECTS_DIR, projectId);
    const dbPath = path.join(projectDirPath, 'graph.db');

    // Check cache first
    // ... caching logic ...
    const cached = connectionCache[projectId];
    const now = Date.now();

    if (cached && (now - cached.lastAccessed) < 300000) { // 5 minutes
        cached.lastAccessed = now;
        return { conn: cached.conn };
    }

    // Remove stale connections
    // ... stale connection logic ...
    const staleConnections = Object.keys(connectionCache).filter(
        id => (now - connectionCache[id].lastAccessed) > 600000 // 10 minutes
    );
    for (const staleId of staleConnections) {
        delete connectionCache[staleId];
    }

    // Create new connection
    try {
        if (!fs.existsSync(projectDirPath)) {
            fs.mkdirSync(projectDirPath, { recursive: true });
        }

        const db = new kuzu.Database(dbPath); 
        const conn = new kuzu.Connection(db);

        // Initialize schema if necessary, passing dbPath
        await initializeSchema(conn, dbPath);

        // Cache the new connection
        connectionCache[projectId] = { db, conn, lastAccessed: now };

        return { conn };
    } catch (error) {
        console.error(`[GetConnection] Error connecting to KuzuDB for project ${projectId}:`, error);
        throw error; 
    }
}

// Delete a project - Updated to use helper
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const projects = await readProjectsData(); // Use helper
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      console.error(`Project not found: ${projectId}`);
      return false;
    }

    // Remove from projects metadata
    projects.splice(projectIndex, 1);
    await writeProjectsData(projects); // Use helper

    // Remove the project's database directory
    // ... directory removal logic ...
    const projectDirPath = path.join(PROJECTS_DIR, projectId);
    if (fs.existsSync(projectDirPath)) {
      fs.rmSync(projectDirPath, { recursive: true, force: true });
      console.log(`Deleted project database directory: ${projectDirPath}`);
    }

    // Remove from connection cache if present
    delete connectionCache[projectId];

    console.log(`Project deleted successfully: ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return false;
  }
} 