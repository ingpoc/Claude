import { z } from 'zod';
import { SessionManager } from '../SessionManager';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Import project management functions
import {
  createProject as createProjectDb,
  getProject as getProjectDb,
  getProjects as getProjectsDb,
  deleteProject as deleteProjectDb,
  // type Project // Assuming this type exists but might not be exported - remove explicit import
} from "../../projectManager";

// Helper type for handler arguments
type ToolArgs<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

// --- Define Tool Schemas ---

// 1. create_project
const createProjectSchemaDef = {
  name: z.string().describe("A unique name for the project."),
  description: z.string().optional().describe("Optional description of the project."),
};

// 2. list_projects
const listProjectsSchemaDef = {};

// 3. delete_project
const deleteProjectSchemaDef = {
  project_id: z.string().describe("The ID of the project to delete."),
};

// --- Define Tool Handlers ---

const createProjectHandler = async (args: ToolArgs<typeof createProjectSchemaDef>) => {
  try {
    const project = await createProjectDb(args.name, args.description);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: "Error: Failed to create project (name may already be in use)." }],
        isError: true
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(project) }]
    };
  } catch (error) {
    console.error("Error in createProjectHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error creating project: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const listProjectsHandler = async (_args: ToolArgs<typeof listProjectsSchemaDef>) => {
  try {
    const projects = await getProjectsDb();
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ projects }) }]
    };
  } catch (error) {
    console.error("Error in listProjectsHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

const deleteProjectHandler = async (args: ToolArgs<typeof deleteProjectSchemaDef>) => {
  try {
    const success = await deleteProjectDb(args.project_id);
    if (!success) {
      return {
        content: [{ type: "text" as const, text: `Error: Project with ID ${args.project_id} not found or could not be deleted.` }],
        isError: true
      };
    }

    return {
      content: [{ type: "text" as const, text: "Project successfully deleted." }]
    };
  } catch (error) {
    console.error("Error in deleteProjectHandler:", error);
    return {
      content: [{ type: "text" as const, text: `Error deleting project: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

// --- Assemble Definitions and Handlers ---

// Function to export tool definitions and handlers
export function getProjectToolInfo(_sessionManager: SessionManager) { // sessionManager potentially unused now

  const definitions: Tool[] = [
    {
      name: "create_project",
      description: "Creates a new project with a separate knowledge graph.",
      inputSchema: { type: "object", properties: createProjectSchemaDef, required: ["name"] }
    },
    {
      name: "list_projects",
      description: "Lists all available projects.",
      inputSchema: { type: "object", properties: listProjectsSchemaDef }
    },
    {
      name: "delete_project",
      description: "Deletes a project and its knowledge graph.",
      inputSchema: { type: "object", properties: deleteProjectSchemaDef, required: ["project_id"] }
    }
  ];

  const handlers = {
    create_project: createProjectHandler,
    list_projects: listProjectsHandler,
    delete_project: deleteProjectHandler,
  };

  return { definitions, handlers };
} 