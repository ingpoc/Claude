import { z } from 'zod';
// Fix SDK Type import and define handler type inline
import { Tool } from '@modelcontextprotocol/sdk/types.js'; // Use Tool type
import { SessionManager } from '../SessionManager'; // Adjust path if needed
import * as projectManager from '../../projectManager'; // Adjust path if needed
import * as knowledgeGraph from '../../knowledgeGraph'; // Adjust path if needed

// Define the input schema for the init_session tool
const InitSessionInputSchema = z.object({
    codebaseIdentifier: z.string().describe("The name or unique identifier for the codebase/project."),
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
    description: "Initializes or loads a project session context based on a codebase identifier. Must be called before other project-specific tools.",
    inputSchema: { 
        type: "object", 
        properties: {
            codebaseIdentifier: {
                type: "string", 
                description: "The name or unique identifier for the codebase/project."
            }
        },
        required: ["codebaseIdentifier"]
    },
};

// Tool Handler Implementation
const handleInitSession = (sessionManager: SessionManager): InitSessionHandler => {
    return async (args) => {
        const { codebaseIdentifier } = args;
        let project;
        let message: string;
        let contextSummary: any = null;
        let version: string | undefined = undefined;
        // Define sessionId for stdio context
        const currentSessionId = undefined; 

        try {
            console.log(`[InitSession] Attempting to find project for identifier: ${codebaseIdentifier}`);
            // 1. Try to find the project by name/identifier
            project = await projectManager.getProjectByNameOrId(codebaseIdentifier);

            if (project) {
                console.log(`[InitSession] Found existing project: ${project.id}`);
                // 2a. Project found: Retrieve context summary and version
                const graphContext = await knowledgeGraph.getProjectContext(project.id);
                version = graphContext?.version;
                contextSummary = graphContext?.details;

                // Set context in session manager - Pass currentSessionId
                sessionManager.setActiveProjectContext(currentSessionId, project.id, version || new Date().toISOString());

                message = `Project found for '${codebaseIdentifier}'.`;
                if (contextSummary) {
                    message += ` Resuming session.`;
                }

            } else {
                console.log(`[InitSession] Project not found for identifier: ${codebaseIdentifier}. Creating new project.`);
                // 2b. Project not found: Create a new project
                project = await projectManager.createProject(codebaseIdentifier, `Project for codebase: ${codebaseIdentifier}`);

                if (!project) {
                     console.error(`[InitSession] Failed to create project for identifier: ${codebaseIdentifier}.`);
                     throw new Error(`Failed to create project '${codebaseIdentifier}'.`);
                }
                console.log(`[InitSession] Created new project: ${project.id}`);

                // Set context in session manager - Pass currentSessionId
                version = project.createdAt || new Date().toISOString(); 
                sessionManager.setActiveProjectContext(currentSessionId, project.id, version);

                message = `New project created for '${codebaseIdentifier}'.`;
                contextSummary = { info: "Project newly initialized." };
            }

            // 3. Return success response
            return {
                content: [{
                    type: 'json',
                    json: {
                        message: message + " Which feature are you working on?",
                        context: {
                            projectId: project.id,
                            version: version,
                            details: contextSummary || {}
                        }
                    }
                }]
            };

        } catch (error: any) {
            console.error(`[InitSession] Error processing init_session for '${codebaseIdentifier}':`, error);
            // Clear any potentially partially set context on error - Pass currentSessionId
            sessionManager.clearActiveProjectContext(currentSessionId);
            throw new Error(`Error initializing session for '${codebaseIdentifier}': ${error.message}`);
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