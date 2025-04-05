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

// Store project metadata in a JSON file
// Assume server is started from project root
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROJECTS_DIR = path.join(PROJECT_ROOT, '.kuzu-db');
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');

// console.error(`[DEBUG] Using database directory: ${PROJECTS_DIR}`);

// DB instances cache
const dbConnections: Record<string, { 
  db: kuzu.Database, 
  conn: kuzu.Connection,
  schemaInitialized: boolean 
}> = {};

// Get or create a KuzuDB connection for a project
// Cache connections for better performance
const connectionCache: Record<string, { db: kuzu.Database, conn: kuzu.Connection, lastAccessed: number }> = {};

// Initialize the projects directory and metadata file if they don't exist
function ensureProjectInfrastructure() {
  try {
    // console.error(`[DEBUG] Ensuring project infrastructure at: ${PROJECTS_DIR}`);
    if (!fs.existsSync(PROJECTS_DIR)) {
      // console.error(`[DEBUG] Creating projects directory: ${PROJECTS_DIR}`);
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(PROJECTS_FILE)) {
      // console.error(`[DEBUG] Creating projects metadata file: ${PROJECTS_FILE}`);
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }), 'utf8');
    }
    // console.error(`[DEBUG] Project infrastructure check completed successfully`);
  } catch (error) {
    console.error(`[ERROR] Failed to ensure project infrastructure:`, error);
    throw error; // Re-throw to make the error visible to the caller
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
// Cache connections for better performance
export async function getDbConnection(projectId: string): Promise<{ conn: kuzu.Connection }> {
    // Check if a connection exists and is less than 5 minutes old
    const cached = connectionCache[projectId];
    const now = Date.now();
    
    if (cached && (now - cached.lastAccessed) < 300000) { // 5 minutes
        // Update last accessed time
        cached.lastAccessed = now;
        return { conn: cached.conn };
    }
    
    // Check for and remove stale connections to prevent too many open connections
    const staleConnections = Object.keys(connectionCache).filter(
        id => (now - connectionCache[id].lastAccessed) > 600000 // 10 minutes
    );
    
    // Remove stale connections
    for (const staleId of staleConnections) {
        // console.error(`[DEBUG] Removing stale connection for project: ${staleId}`);
        delete connectionCache[staleId];
    }
    
    // Create a new connection
    try {
        // Initialize database path and dir with better error handling
        const projectDirPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectDirPath, 'graph.db');
        
        // console.error(`[DEBUG] Ensuring project directory exists: ${projectDirPath}`);
        if (!fs.existsSync(projectDirPath)) {
            fs.mkdirSync(projectDirPath, { recursive: true });
            // console.error(`[DEBUG] Created project directory: ${projectDirPath}`);
        }
        
        // console.error(`[DEBUG] Creating new database for project: ${projectId}`);
        // First create the database object
        const db = new kuzu.Database(dbPath);
        
        // console.error(`[DEBUG] Creating new connection for project: ${projectId}`);
        // Then create a connection from the database
        const conn = new kuzu.Connection(db);
        
        // Initialize schema if needed
        await initializeSchema(conn);
        
        // Cache the connection
        connectionCache[projectId] = { db, conn, lastAccessed: now };
        
        console.error(`KuzuDB connection established for project: ${projectId}`);
        return { conn };
    } catch (error) {
        // Handle connection errors
        console.error(`[ERROR] Error connecting to KuzuDB for project ${projectId}:`, error);
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
    
    // Close DB connection if exists
    if (dbConnections[projectId]) {
      // No explicit close method in KuzuDB? Remove from cache
      delete dbConnections[projectId];
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