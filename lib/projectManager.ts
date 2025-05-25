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
  associatedPath?: string; // Path to the codebase directory
}

// Add a flag to track if schema was initialized for a given DB path
const schemaInitializedPaths = new Set<string>();

// *** REINTRODUCE connectionCache ***
const connectionCache: Record<string, { db: kuzu.Database, conn: kuzu.Connection, lastAccessed: number }> = {};

// Determine Project Root: Prioritize ENV variable, fallback for non-Next.js context
const getProjectRoot = () => {
  // 1. Prioritize server-specific environment variable
  if (process.env.PROJECT_ROOT_DIR) {
    // console.log("[ProjectManager] Using PROJECT_ROOT_DIR env var:", process.env.PROJECT_ROOT_DIR);
    return process.env.PROJECT_ROOT_DIR;
  }
  // 2. Try client-public environment variable (useful if this code somehow runs client-side or for consistency)
  if (process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR) {
    // console.log("[ProjectManager] Using NEXT_PUBLIC_PROJECT_ROOT_DIR env var:", process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR);
    return process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR;
  } 
  // 3. Fallback for other contexts (like the standalone server run from dist or if Next.js __dirname is reliable)
  //    If __dirname is something like /path/to/project/dist/lib or .next/server/lib, adjust accordingly.
  //    For Next.js, __dirname in a server component/API route in `.next/server/app/...` might need `../../..` to reach project root.
  //    For standalone server in `dist/lib`, `../../` is correct.
  //    Let's assume if we are in .next/server, __dirname will be deep enough.
  let fallbackPath;
  if (__dirname.includes('.next' + path.sep + 'server')) {
    // Likely running within Next.js server build context
    fallbackPath = path.resolve(__dirname, '..', '..', '..'); // Adjust if layout is different
    // console.log(`[ProjectManager] In Next.js server context. Fallback path relative to __dirname (${__dirname}): ${fallbackPath}`);
  } else {
    // Likely standalone server context (e.g., from dist/lib) or other
    fallbackPath = path.resolve(__dirname, '..', '..');
    // console.log(`[ProjectManager] Not in Next.js server context or PROJECT_ROOT_DIR not set. Fallback path relative to __dirname (${__dirname}): ${fallbackPath}`);
  }
  return fallbackPath;
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
  return await readProjectsData();
}

// Create a new project - MODIFIED to accept and store associatedPath
export async function createProject(
  name: string, 
  description: string = "", 
  associatedPath?: string // Added optional parameter
): Promise<ProjectMetadata | null> {
  try {
    const projects = await readProjectsData(); 
    
    // Check if project with same name already exists (case-insensitive)
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      console.error(`Project with name '${name}' already exists (case-insensitive).`);
      return null;
    }

    // Check if project with same path already exists (if path provided)
    if (associatedPath && projects.some(p => p.associatedPath === associatedPath)) {
        console.error(`Project with associated path '${associatedPath}' already exists.`);
        return null;
    }
    
    // Create new project object
    const newProject: ProjectMetadata = {
      id: `project_${uuidv4()}`,
      name,
      description,
      createdAt: new Date().toISOString(), 
      lastAccessed: new Date().toISOString(),
      associatedPath: associatedPath // Store the path
    };
    
    projects.push(newProject);
    await writeProjectsData(projects);
    
    await getDbConnection(newProject.id);

    console.error(`[ProjectManager] Project created: ${newProject.id} (${newProject.name}) Path: ${newProject.associatedPath || 'N/A'}`);    
    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

// Get a specific project by ID - Updated to use helper
export async function getProject(projectId: string): Promise<ProjectMetadata | null> {
  const projects = await readProjectsData();
  const project = projects.find(p => p.id === projectId);
  
  if (project) {
    updateProjectAccess(projectId).catch(err => console.error("[ProjectManager] Background update access failed", err));
    return project;
  }
  
  return null;
}

// --- NEW Function: Get Project by Path ---
/**
 * Finds a project by its associated filesystem path.
 * Updates lastAccessed time if found.
 * @param filePath The absolute path associated with the project
 * @returns ProjectMetadata or null if not found
 */
export async function getProjectByPath(filePath: string): Promise<ProjectMetadata | null> {
    console.error(`[ProjectManager] Searching for project by path: ${filePath}`);
    const projects = await readProjectsData();
    const foundProject = projects.find(p => p.associatedPath === filePath);

    if (foundProject) {
        console.error(`[ProjectManager] Found project by path: ${foundProject.id} (${foundProject.name})`);
        updateProjectAccess(foundProject.id).catch(err => {
             console.error(`[ProjectManager] Background update access failed for ${foundProject?.id}:`, err);
        });
        return foundProject;
    }

    console.error(`[ProjectManager] Project not found for path: ${filePath}`);
    return null;
}
// --- End of NEW Function ---

// --- MODIFIED Function: Get Project by Name, ID, or Path ---
/**
 * Finds a project by its ID, name (case-insensitive), or associated path.
 * Updates lastAccessed time if found.
 * Priority: Path > ID > Name
 * @param identifier Project ID, Name, or Filesystem Path
 * @returns ProjectMetadata or null if not found
 */
export async function getProjectByNameOrId(identifier: string): Promise<ProjectMetadata | null> {
    console.error(`[ProjectManager] Searching for project by identifier: ${identifier}`);
    const projects = await readProjectsData(); 
    let foundProject: ProjectMetadata | undefined;

    // 1. Try finding by Path first (if identifier looks like a path)
    // Basic check: starts with '/' or a drive letter like 'C:'
    if (identifier.startsWith('/') || /^[a-zA-Z]:/.test(identifier)) {
        console.error(`[ProjectManager] Identifier looks like a path. Trying path lookup first.`);
        foundProject = projects.find(p => p.associatedPath === identifier);
        if (foundProject) {
            console.error(`[ProjectManager] Found project by path: ${foundProject.id} (${foundProject.name})`);
            updateProjectAccess(foundProject.id).catch(err => console.error(`[PM] BG update access failed:`, err));
            return foundProject;
        } else {
             console.error(`[ProjectManager] Identifier looked like path, but no match found.`);
        }
    }

    // 2. Try finding by ID (exact match)
    if (!foundProject) {
        foundProject = projects.find(p => p.id === identifier);
        if (foundProject) {
             console.error(`[ProjectManager] Found project by ID: ${foundProject.id} (${foundProject.name})`);
             updateProjectAccess(foundProject.id).catch(err => console.error(`[PM] BG update access failed:`, err));
             return foundProject;
        }
    }

    // 3. If not found by path or ID, try finding by name (case-insensitive)
    if (!foundProject) {
        const lowerCaseIdentifier = identifier.toLowerCase();
        foundProject = projects.find(p => p.name.toLowerCase() === lowerCaseIdentifier);
        if (foundProject) {
             console.error(`[ProjectManager] Found project by Name: ${foundProject.id} (${foundProject.name})`);
             updateProjectAccess(foundProject.id).catch(err => console.error(`[PM] BG update access failed:`, err));
             return foundProject;
        }
    }
    
    // If still not found
    console.error(`[ProjectManager] Project not found for identifier: ${identifier}`);
    return null;
}
// --- End of MODIFIED Function ---

// Update project's last accessed time - Updated to use helpers
async function updateProjectAccess(projectId: string): Promise<boolean> {
  try {
    const projects = await readProjectsData(); // Use helper
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
        console.error(`[ProjectManager] Attempted to update access for non-existent project ID: ${projectId}`);
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
                parentId STRING,
                createdAt STRING,
                updatedAt STRING
            )
        `);
        console.error("[Schema] Entity table checked/created.");
        
        // Create UserSettings table with TIMESTAMP types
        try {
            await conn.query(`
                CREATE NODE TABLE IF NOT EXISTS UserSettings (
                    id STRING PRIMARY KEY,
                    userId STRING,
                    aiProvider STRING,
                    aiEnabled BOOLEAN,
                    apiKey STRING,
                    model STRING,
                    baseUrl STRING,
                    maxTokens INT64,
                    aiFeatures STRING,
                    privacy STRING,
                    performance STRING,
                    ui STRING,
                    createdAt TIMESTAMP,
                    updatedAt TIMESTAMP
                )
            `);
            console.error("[Schema] UserSettings table checked/created.");
        } catch (settingsError) {
            console.error("[Schema] UserSettings table creation failed:", settingsError);
        }

        // Create Conversation tables with TIMESTAMP types
        try {
            await conn.query(`
                CREATE NODE TABLE IF NOT EXISTS Conversation (
                    id STRING PRIMARY KEY,
                    projectId STRING,
                    sessionId STRING,
                    userMessage STRING,
                    aiResponse STRING,
                    extractedEntityIds STRING[],
                    timestamp TIMESTAMP,
                    contextUsed STRING[],
                    messageType STRING,
                    intent STRING,
                    confidence DOUBLE,
                    metadata STRING
                )
            `);
            console.error("[Schema] Conversation table checked/created.");
        } catch (conversationError) {
            console.error("[Schema] Conversation table creation failed:", conversationError);
        }

        // Create ContextSession table with TIMESTAMP types
        try {
            await conn.query(`
                CREATE NODE TABLE IF NOT EXISTS ContextSession (
                    id STRING PRIMARY KEY,
                    projectId STRING,
                    userId STRING,
                    lastActive TIMESTAMP,
                    sessionSummary STRING,
                    activeEntityIds STRING[],
                    conversationState STRING,
                    totalMessages INT64,
                    isActive BOOLEAN,
                    metadata STRING
                )
            `);
            console.error("[Schema] ContextSession table checked/created.");
        } catch (sessionError) {
            console.error("[Schema] ContextSession table creation failed:", sessionError);
        }

        // Create ConversationEntityLink table with TIMESTAMP types
        try {
            await conn.query(`
                CREATE NODE TABLE IF NOT EXISTS ConversationEntityLink (
                    id STRING PRIMARY KEY,
                    conversationId STRING,
                    entityId STRING,
                    relevanceScore DOUBLE,
                    extractionMethod STRING,
                    confidence DOUBLE,
                    extractedAt TIMESTAMP
                )
            `);
            console.error("[Schema] ConversationEntityLink table checked/created.");
        } catch (linkError) {
            console.error("[Schema] ConversationEntityLink table creation failed:", linkError);
        }
        
        // For relationships, we need to handle schema migration
        // First try to create the table with full schema
        try {
            await conn.query(`
                CREATE REL TABLE IF NOT EXISTS Related (
                    FROM Entity TO Entity,
                    id STRING,
                    type STRING,
                    description STRING,
                    createdAt STRING
                )
            `);
            console.error("[Schema] Related table created with full schema.");
        } catch (tableCreateError) {
            console.error("[Schema] Table creation failed, might already exist. Attempting schema migration...");
            
            // If table exists but with old schema, we need to handle migration
            // For now, let's use a simplified relationship table without timestamps
            try {
                await conn.query(`
                    CREATE REL TABLE IF NOT EXISTS Related (
                        FROM Entity TO Entity,
                        id STRING,
                        type STRING
                    )
                `);
                console.error("[Schema] Related table created with basic schema (migration fallback).");
            } catch (fallbackError) {
                console.error("[Schema] Even basic table creation failed:", fallbackError);
            }
        }
        
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
      console.error(`Deleted project database directory: ${projectDirPath}`);
    }

    // Remove from connection cache if present
    delete connectionCache[projectId];

    console.error(`Project deleted successfully: ${projectId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return false;
  }
} 