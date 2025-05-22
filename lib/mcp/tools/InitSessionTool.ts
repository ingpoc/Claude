import { z } from 'zod';
// Fix SDK Type import and define handler type inline
import { Tool } from '@modelcontextprotocol/sdk/types.js'; // Use Tool type
import { SessionManager } from '../SessionManager'; // Adjust path if needed
import * as projectManager from '../../projectManager'; // Corrected path
import { knowledgeGraphService } from '../../services';
import path from 'path'; // Import path for basename
import { McpError } from "@modelcontextprotocol/sdk/types.js"; // Corrected Import

// Define the input schema for the init_session tool
const InitSessionInputSchema = z.object({
    codebaseIdentifier: z.string().optional().describe("Optional: Name, ID, or path for the codebase/project. If omitted, uses the server's CWD."),
});

// Define the output schema for the init_session tool
const InitSessionOutputSchema = z.object({
    message: z.string().describe("A confirmation message for the AI."),
    context: z.object({
        projectId: z.string().describe("The internal ID of the project."),
        version: z.string().optional().describe("Timestamp or hash indicating the context version."),
        details: z.any().optional().describe("Additional stored context summary (e.g., features, recent activity).")
    }).optional().describe("Summary of the project context found or created."),
});

// Define Handler Type based on expected signature
type InitSessionHandler = (args: z.infer<typeof InitSessionInputSchema>) => Promise<{ content: any[], isError?: boolean }>;


// Tool Definition using the imported Tool type
const initSessionDefinition: Tool = {
    name: "init_session",
    description: "Initializes or loads a project session context using the provided codebase identifier (name, ID, or path).",
    inputSchema: {
        type: "object",
        properties: {
            codebaseIdentifier: {
                type: "string",
                description: "Mandatory: Name, ID, or path for the codebase/project."
            }
        },
        required: ["codebaseIdentifier"]
    },
};

// Tool Handler Implementation
const handleInitSession = (sessionManager: SessionManager): InitSessionHandler => {
    return async (args) => {
        const { codebaseIdentifier } = args;
        let project: projectManager.ProjectMetadata | null;
        let message: string;
        let contextSummary: any = null;
        let version: string | undefined = undefined;
        const currentSessionId = undefined; // For stdio context

        // Ensure codebaseIdentifier is provided (tooling layer should enforce this)
        if (!codebaseIdentifier) {
            // This case should ideally not be reached if the tooling always provides the identifier
            console.error("[InitSession] Error: codebaseIdentifier is missing, but required.");
            return {
                content: [{ type: "text" as const, text: "Error: Missing required codebaseIdentifier." }],
                isError: true
            };
        }

        try {
            const identifierToUse: string = codebaseIdentifier; // Now guaranteed to be a string
            const searchType = "provided identifier (path/ID/name)";
            
            // --- Find or Create Project based on Identifier ---
            console.error(`[InitSession] Identifier provided: ${identifierToUse}`);
            project = await projectManager.getProjectByNameOrId(identifierToUse);
            if (!project) {
                // If not found by identifier, create it (using identifier as name)
                console.error(`[InitSession] Project not found for identifier '${identifierToUse}'. Creating new project.`);
                // Determine if the identifier looks like a path to store it
                const potentialPath = (identifierToUse.startsWith('/') || /^[a-zA-Z]:/.test(identifierToUse)) ? identifierToUse : undefined;
                project = await projectManager.createProject(identifierToUse, `Project for codebase: ${identifierToUse}`, potentialPath);
                if (!project) {
                    throw new McpError(500, `Failed to create project '${identifierToUse}'.`);
                }
                message = `New project '${identifierToUse}' created.`;
                contextSummary = { info: "Project newly initialized from identifier." };
            } else {
                message = `Project '${project.name}' found using identifier '${identifierToUse}'.`;
            }
            // --- End Find or Create Project ---

            // If we couldn't find or create a project, something went wrong
            if (!project) {
                 // This path might be less likely now, but kept for safety
                 throw new McpError(500, `Could not find or create a project using identifier: ${identifierToUse}`);
            }

            // --- Retrieve Context and Update Session ---
            console.error(`[InitSession] Using project: ${project.id} (${project.name})`);
                    // Note: getProjectContext is not available in new service architecture
        const graphData = await knowledgeGraphService.getGraphData(project.id);
        const graphContext = { 
          version: project.createdAt || new Date().toISOString(),
          details: { 
            entities: graphData.nodes.length, 
            relationships: graphData.links.length 
          } 
        };
        version = graphContext.version; // Use existing version or creation time
            // Only overwrite contextSummary if it wasn't set during creation
            if (contextSummary === null) {
                 contextSummary = graphContext?.details || {}; 
                 if (Object.keys(contextSummary).length > 0) {
                      message += ` Resuming session.`;
                 }
            }
            
            sessionManager.setActiveProjectContext(currentSessionId, project.id, version);
            // --- End Retrieve Context --- 

            // 3. Return success response matching expected text format
            // Construct a meaningful text message including key context info
            const successMessage = `${message} Project ID: ${project.id}, Version: ${version}. Which feature are you working on?`;
            return {
                content: [{
                    type: "text" as const, // Changed from 'json'
                    text: successMessage    // Put the info into the text field
                }]
            };

        } catch (error: any) {
            console.error(`[InitSession] Error processing init_session:`, error);
            sessionManager.clearActiveProjectContext(currentSessionId);
            // Provide a more informative error message to the user
            const userErrorMessage = `Error initializing session: ${error.message}`;
            return {
                content: [{ type: "text" as const, text: userErrorMessage }],
                isError: true
            };
            // throw new Error(`Error initializing session: ${error.message}`); // Original throw
        }
    };
};


// Function to export definitions and handlers
export const getInitSessionToolInfo = (sessionManager: SessionManager) => {
    return {
        definitions: [initSessionDefinition],
        handlers: {
            [initSessionDefinition.name]: handleInitSession(sessionManager),
        }
    };
};