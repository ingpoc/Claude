"use server";

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { qdrantDataService } from './services/QdrantDataService';

// Define the project metadata type
export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed: string;
  associatedPath?: string; // Path to the codebase directory
}

// Determine Project Root: Prioritize ENV variable, fallback for non-Next.js context
const getProjectRoot = () => {
  // 1. Prioritize server-specific environment variable
  if (process.env.PROJECT_ROOT_DIR) {
    return process.env.PROJECT_ROOT_DIR;
  }
  // 2. Try client-public environment variable
  if (process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR) {
    return process.env.NEXT_PUBLIC_PROJECT_ROOT_DIR;
  } 
  // 3. Fallback for other contexts
  let fallbackPath;
  if (__dirname.includes('.next' + path.sep + 'server')) {
    // Likely running within Next.js server build context
    fallbackPath = path.resolve(__dirname, '..', '..', '..');
  } else {
    // Likely standalone server context
    fallbackPath = path.resolve(__dirname, '..', '..');
  }
  return fallbackPath;
};

const PROJECT_ROOT = getProjectRoot();
const PROJECTS_DIR = path.join(PROJECT_ROOT, 'qdrant_storage');
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');

// Initialize the projects directory and metadata file if they don't exist
function ensureProjectInfrastructure() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }

    if (!fs.existsSync(PROJECTS_FILE)) {
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }), 'utf8');
    }
  } catch (error) {
    console.error(`[Project Infra Check] FAILED to ensure project infrastructure:`, error);
    throw error;
  }
}

// Read projects data from the JSON file
async function readProjectsData(): Promise<ProjectMetadata[]> {
  ensureProjectInfrastructure();
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const { projects } = JSON.parse(data);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    console.error('Error reading projects metadata:', error);
    return [];
  }
}

// Write projects data to the JSON file
async function writeProjectsData(projects: ProjectMetadata[]): Promise<void> {
  ensureProjectInfrastructure();
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing projects metadata:', error);
    throw error;
  }
}

// Get all projects
export async function getProjects(): Promise<ProjectMetadata[]> {
  try {
    // Initialize Qdrant and get projects from there
    await qdrantDataService.initialize();
    const qdrantProjects = await qdrantDataService.getAllProjects();
    
    // Convert Qdrant projects to ProjectMetadata format
    return qdrantProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
      lastAccessed: project.lastAccessed.toISOString(),
      associatedPath: project.metadata?.associatedPath
    }));
  } catch (error) {
    console.error('Error getting projects from Qdrant:', error);
    // Fallback to local file system
    return await readProjectsData();
  }
}

// Create a new project
export async function createProject(
  name: string, 
  description: string = "", 
  associatedPath?: string
): Promise<ProjectMetadata | null> {
  try {
    await qdrantDataService.initialize();
    
    // Check if project with same name already exists
    const existingProjects = await qdrantDataService.getAllProjects();
    if (existingProjects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      console.error(`Project with name '${name}' already exists (case-insensitive).`);
      return null;
    }

    // Check if project with same path already exists (if path provided)
    if (associatedPath && existingProjects.some(p => p.metadata?.associatedPath === associatedPath)) {
      console.error(`Project with associated path '${associatedPath}' already exists.`);
      return null;
    }
    
    // Create new project in Qdrant
    const newProject = await qdrantDataService.createProject({
      name,
      description,
      metadata: { associatedPath }
    });
    
    console.error(`[ProjectManager] Project created: ${newProject.id} (${newProject.name}) Path: ${associatedPath || 'N/A'}`);
    
    // Convert to ProjectMetadata format
    return {
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      createdAt: newProject.createdAt.toISOString(),
      lastAccessed: newProject.lastAccessed.toISOString(),
      associatedPath: newProject.metadata?.associatedPath
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

// Get a specific project by ID
export async function getProject(projectId: string): Promise<ProjectMetadata | null> {
  try {
    await qdrantDataService.initialize();
    const project = await qdrantDataService.getProject(projectId);
    
    if (project) {
      // Update last accessed time
      await qdrantDataService.updateProject(projectId, { lastAccessed: new Date() });
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
        lastAccessed: new Date().toISOString(),
        associatedPath: project.metadata?.associatedPath
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting project:', error);
    return null;
  }
}

// Get Project by Path
export async function getProjectByPath(filePath: string): Promise<ProjectMetadata | null> {
  console.error(`[ProjectManager] Searching for project by path: ${filePath}`);
  
  try {
    await qdrantDataService.initialize();
    const projects = await qdrantDataService.getAllProjects();
    const foundProject = projects.find(p => p.metadata?.associatedPath === filePath);

    if (foundProject) {
      console.error(`[ProjectManager] Found project by path: ${foundProject.id} (${foundProject.name})`);
      
      // Update last accessed time
      await qdrantDataService.updateProject(foundProject.id, { lastAccessed: new Date() });
      
      return {
        id: foundProject.id,
        name: foundProject.name,
        description: foundProject.description,
        createdAt: foundProject.createdAt.toISOString(),
        lastAccessed: new Date().toISOString(),
        associatedPath: foundProject.metadata?.associatedPath
      };
    }

    console.error(`[ProjectManager] Project not found for path: ${filePath}`);
    return null;
  } catch (error) {
    console.error('Error getting project by path:', error);
    return null;
  }
}

// Get project by name or ID
export async function getProjectByNameOrId(identifier: string): Promise<ProjectMetadata | null> {
  try {
    await qdrantDataService.initialize();
    const projects = await qdrantDataService.getAllProjects();
    
    const foundProject = projects.find(p => 
      p.id === identifier || p.name.toLowerCase() === identifier.toLowerCase()
    );

    if (foundProject) {
      // Update last accessed time
      await qdrantDataService.updateProject(foundProject.id, { lastAccessed: new Date() });
      
      return {
        id: foundProject.id,
        name: foundProject.name,
        description: foundProject.description,
        createdAt: foundProject.createdAt.toISOString(),
        lastAccessed: new Date().toISOString(),
        associatedPath: foundProject.metadata?.associatedPath
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting project by name or ID:', error);
    return null;
  }
}

// Delete a project
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    await qdrantDataService.initialize();
    await qdrantDataService.deleteProject(projectId);
    console.error(`[ProjectManager] Project deleted: ${projectId}`);
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

// Legacy function for compatibility - now returns a mock connection object
export async function getDbConnection(projectId: string): Promise<{ conn: any }> {
  console.warn(`[ProjectManager] getDbConnection called for ${projectId} - this is a legacy function, Qdrant is now used instead`);
  
  // Return a mock connection object for compatibility
  return {
    conn: {
      query: () => { throw new Error('KuzuDB connections are no longer supported. Use QdrantDataService instead.'); },
      close: () => { console.log('Mock connection closed'); }
    }
  };
} 