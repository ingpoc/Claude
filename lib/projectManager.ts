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
    console.log("[ProjectManager] Using NEXT_PUBLIC_PROJECT_ROOT_DIR env var:", process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR);
    return process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR;
  } else {
    // Fallback for other contexts (like the standalone server run from dist)
    const fallbackPath = path.resolve(__dirname, '..');
    console.log(`[ProjectManager] NEXT_PUBLIC_PROJECT_ROOT_DIR not set or not in Next.js context. Falling back to path relative to __dirname (${__dirname}): ${fallbackPath}`);
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

// Get all projects
export async function getProjects(): Promise<ProjectMetadata[]> {
  ensureProjectInfrastructure();
  
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const { projects } = JSON.parse(data);
    return projects;
  } catch (error) {
    console.error('Error reading projects metadata:', error);
    return [];
  }
}

// Create a new project
export async function createProject(name: string, description: string = ""): Promise<ProjectMetadata | null> {
  try {
    // Make sure projects metadata exists
    await getProjects();
    
    // Check if project with same name already exists
    const projects = await getProjects();
    if (projects.some(p => p.name === name)) {
      console.error(`Project with name '${name}' already exists`);
      return null;
    }
    
    // Create new project object
    const newProject: ProjectMetadata = {
      id: `project_${uuidv4()}`, // Generate UUID for project ID
      name,
      description,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    
    // Add to projects metadata
    const metadata = await getProjects();
    metadata.push(newProject);
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: metadata }, null, 2), 'utf8');
    
    // Make sure project directory exists and initialize database
    // This now just initializes the connection, schema gets created automatically
    await getDbConnection(newProject.id);
    
    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

// Get a specific project by ID
export async function getProject(projectId: string): Promise<ProjectMetadata | null> {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);
  
  if (project) {
    // Update last accessed time
    await updateProjectAccess(projectId);
    return project;
  }
  
  return null;
}

// Update project's last accessed time
async function updateProjectAccess(projectId: string): Promise<boolean> {
  try {
    const projects = await getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) return false;
    
    projects[projectIndex].lastAccessed = new Date().toISOString();
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2), 'utf8');
    
    return true;
  } catch (error) {
    console.error(`Error updating project access time: ${projectId}`, error);
    return false;
  }
}

// Initialize schema for a KuzuDB connection
async function initializeSchema(conn: kuzu.Connection): Promise<void> {
    try {
        console.error("[Schema] Initializing KuzuDB schema...");
        
        // Create entity node with properties
        const entityTableCheck = await conn.query(`
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
        const relTableCheck = await conn.query(`
            CREATE REL TABLE IF NOT EXISTS Related (
                FROM Entity TO Entity,
                id STRING,
                type STRING
            )
        `);
        console.error("[Schema] Related table checked/created.");

        // --- Removed Attempt to Add Index on Entity Type ---
        // KuzuDB automatically indexes PRIMARY KEY (id).
        // Explicit secondary index creation on 'type' via CREATE INDEX is not supported or documented clearly.
        // Queries filtering by type will rely on KuzuDB's scan performance.
        
        console.error("[Schema] KuzuDB schema initialization complete.");
    } catch (error) {
        console.error("[Schema] Error initializing KuzuDB schema:", error);
        throw error;
    }
}

// Get or create a KuzuDB connection for a project
// *** REVERT to Caching Logic ***
export async function getDbConnection(projectId: string): Promise<{ conn: kuzu.Connection }> {
    // Check if a connection exists and is less than 5 minutes old
    const cached = connectionCache[projectId];
    const now = Date.now();

    if (cached && (now - cached.lastAccessed) < 300000) { // 5 minutes
        // Update last accessed time
        cached.lastAccessed = now;
        console.log(`[GetConnection] Using CACHED KuzuDB connection for project: ${projectId}`);
        return { conn: cached.conn };
    }

    // Check for and remove stale connections to prevent too many open connections
    const staleConnections = Object.keys(connectionCache).filter(
        id => (now - connectionCache[id].lastAccessed) > 600000 // 10 minutes
    );

    // Remove stale connections
    for (const staleId of staleConnections) {
        console.log(`[GetConnection] Removing STALE connection cache for project: ${staleId}`);
        // We might need explicit closing if the driver supports it and leaks resources
        // connectionCache[staleId].db.close(); // Example if a close method exists
        delete connectionCache[staleId];
    }

    // Create a new connection
    try {
        const projectDirPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectDirPath, 'graph.db');

        if (!fs.existsSync(projectDirPath)) {
            fs.mkdirSync(projectDirPath, { recursive: true });
        }

        console.log(`[GetConnection] Creating NEW KuzuDB connection for project: ${projectId}`);
        const db = new kuzu.Database(dbPath);
        const conn = new kuzu.Connection(db);

        // Initialize schema ONLY if not already done for this DB path
        if (!schemaInitializedPaths.has(dbPath)) {
            console.log(`[GetConnection] Schema not yet initialized for ${dbPath}. Initializing...`);
            await initializeSchema(conn);
            schemaInitializedPaths.add(dbPath);
             console.log(`[GetConnection] Schema initialization complete for ${dbPath}.`);
        } else {
             console.log(`[GetConnection] Schema already initialized for ${dbPath}. Skipping initialization.`); // Adjusted log
        }

        // Cache the new connection
        connectionCache[projectId] = { db, conn, lastAccessed: now };

        console.log(`[GetConnection] NEW KuzuDB connection established and cached for project: ${projectId}`);
        return { conn };
    } catch (error) {
        console.error(`[GetConnection] Error connecting to KuzuDB for project ${projectId}:`, error);
        throw error;
    }
}

// Delete a project
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const projects = await getProjects();
    const updatedProjects = projects.filter(p => p.id !== projectId);
    
    // If no project was removed, it didn't exist
    if (projects.length === updatedProjects.length) {
      console.warn(`Project not found for deletion: ${projectId}`);
      return false;
    }
    
    // Update projects metadata
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: updatedProjects }, null, 2), 'utf8');
    
    // Delete project directory
    const projectDir = path.join(PROJECTS_DIR, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting project: ${projectId}`, error);
    return false;
  }
} 