#!/usr/bin/env node

// Reintroduce Express imports
import express, { Request, Response } from 'express';
import cors from 'cors';

// Import SDK components
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

// Keep SessionManager import if needed by tool info functions
import { SessionManager } from './lib/mcp/SessionManager';

// Import the new tool info functions
import { getKnowledgeGraphToolInfo } from './lib/mcp/tools/KnowledgeGraphTools';
import { getProjectToolInfo } from './lib/mcp/tools/ProjectTools';

// Import project and graph functions needed for UI API
import * as projectManager from './lib/projectManager';
import * as knowledgeGraph from './lib/knowledgeGraph';

// Removed MCP protocol message interfaces (handled by SDK)

// Instantiate Session Manager (if needed by tool info functions)
const sessionManager = new SessionManager();

// --- Create Express App for UI API ---
const app = express();
const uiApiPort = process.env.UI_API_PORT || 3001; // Use env var or default

app.use(cors()); // Enable CORS for UI interaction
app.use(express.json()); // Middleware to parse JSON bodies

// --- Define UI API Routes ---

// Helper function for error handling
const handleApiError = (res: Response, error: unknown, message: string) => {
    console.error(message, error);
    res.status(500).json({ error: message, details: error instanceof Error ? error.message : String(error) });
};

// == Project Routes ==
app.get('/api/ui/projects', async (req: Request, res: Response) => {
    try {
        const projects = await projectManager.getProjects();
        res.json(projects);
    } catch (error) {
        handleApiError(res, error, 'Failed to get projects');
    }
});

app.post('/api/ui/projects', async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        const newProject = await projectManager.createProject(name, description || "");
        if (newProject) {
            res.status(201).json(newProject);
        } else {
            // Handle case where project creation failed (e.g., duplicate name)
             res.status(409).json({ error: `Project with name '${name}' might already exist or another creation error occurred.` });
        }
    } catch (error) {
        handleApiError(res, error, 'Failed to create project');
    }
});

app.get('/api/ui/projects/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const project = await projectManager.getProject(projectId);
        if (project) {
            res.json(project);
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (error) {
        handleApiError(res, error, 'Failed to get project');
    }
});

app.delete('/api/ui/projects/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const deleted = await projectManager.deleteProject(projectId);
        if (deleted) {
            res.status(204).send(); // No content
        } else {
            res.status(404).json({ error: 'Project not found or deletion failed' });
        }
    } catch (error) {
        handleApiError(res, error, 'Failed to delete project');
    }
});


// == Entity Routes ==
app.get('/api/ui/projects/:projectId/entities', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        // Add any query param handling if needed (e.g., filtering by type)
        const entities = await knowledgeGraph.getAllEntities(projectId);
        res.json(entities);
    } catch (error) {
        handleApiError(res, error, `Failed to list entities for project ${req.params.projectId}`);
    }
});

app.post('/api/ui/projects/:projectId/entities', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, type, description, observations, parentId } = req.body;
        // Basic validation
        if (!name || !type) {
             return res.status(400).json({ error: 'Entity name and type are required' });
        }
        const newEntity = await knowledgeGraph.createEntity(projectId, name, type, description, observations, parentId);
        res.status(201).json(newEntity);
    } catch (error) {
        handleApiError(res, error, `Failed to create entity for project ${req.params.projectId}`);
    }
});

app.get('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
     try {
        const { projectId, entityId } = req.params;
        const entity = await knowledgeGraph.getEntity(projectId, entityId);
        if (entity) {
            res.json(entity);
        } else {
            res.status(404).json({ error: 'Entity not found' });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to get entity ${req.params.entityId}`);
    }
});

app.put('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
    // Uncomment and implement the route for updating an entity
    try {
        const { projectId, entityId } = req.params;
        // Body should contain only the fields to update
        // Exclude id, handle observations separately if needed by backend function
        const updates = req.body;

        // Basic validation: ensure body is not empty
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Request body cannot be empty for update' });
        }

        // Call the backend function
        const updatedEntity = await knowledgeGraph.updateEntity(projectId, entityId, updates);

        if (updatedEntity) {
            res.json(updatedEntity);
        } else {
            // updateEntity returns null if entity not found or error occurred
            res.status(404).json({ error: `Entity ${entityId} not found or update failed.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to update entity ${req.params.entityId}`);
    }
});

app.delete('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
    try {
        const { projectId, entityId } = req.params;
        const deleted = await knowledgeGraph.deleteEntity(projectId, entityId);
         if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Entity not found or deletion failed' });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to delete entity ${req.params.entityId}`);
    }
});

// == Observation Routes (Nested under Entities) ==
app.post('/api/ui/projects/:projectId/entities/:entityId/observations', async (req: Request, res: Response) => {
    try {
        const { projectId, entityId } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Observation text is required' });
        }

        const result = await knowledgeGraph.addObservation(projectId, entityId, text);

        if (result && result.observation_id) {
            res.status(201).json(result); // Return { observation_id: ... }
        } else {
            // Assuming null means entity not found or other error
            res.status(404).json({ error: `Failed to add observation to entity ${entityId}. Entity may not exist.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to add observation to entity ${req.params.entityId}`);
    }
});

app.delete('/api/ui/projects/:projectId/entities/:entityId/observations/:observationId', async (req: Request, res: Response) => {
    try {
        const { projectId, entityId, observationId } = req.params;

        const deleted = await knowledgeGraph.deleteObservation(projectId, entityId, observationId);

        if (deleted) {
            res.status(204).send(); // No content on successful deletion
        } else {
            // False could mean entity not found, observation not found, or other error
            res.status(404).json({ error: `Observation ${observationId} not found on entity ${entityId}, or entity not found.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to delete observation ${req.params.observationId}`);
    }
});

// == Related Entities Route ==
app.get('/api/ui/projects/:projectId/entities/:entityId/related', async (req: Request, res: Response) => {
    try {
        const { projectId, entityId } = req.params;
        // Extract query parameters for filtering
        const { type, direction } = req.query;

        // Validate direction if provided
        const validDirections = ['incoming', 'outgoing', 'both'];
        let validatedDirection: 'incoming' | 'outgoing' | 'both' = 'both'; // Default
        if (direction && typeof direction === 'string' && validDirections.includes(direction)) {
            validatedDirection = direction as 'incoming' | 'outgoing' | 'both';
        }

        const relatedEntities = await knowledgeGraph.getRelatedEntities(
            projectId,
            entityId,
            type as string | undefined, // Pass type string directly
            validatedDirection
        );

        res.json(relatedEntities);
    } catch (error) {
        handleApiError(res, error, `Failed to get related entities for ${req.params.entityId}`);
    }
});

// == Relationship Routes ==
app.get('/api/ui/projects/:projectId/relationships', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { sourceId, targetId, type } = req.query; // Allow optional filtering
        const relationships = await knowledgeGraph.getRelationships(
            projectId,
            // Pass filters as an object
            {
                 fromId: sourceId as string | undefined,
                 toId: targetId as string | undefined,
                 type: type as string | undefined
            }
        );
        res.json(relationships);
    } catch (error) {
         handleApiError(res, error, `Failed to get relationships for project ${req.params.projectId}`);
    }
});

app.post('/api/ui/projects/:projectId/relationships', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { sourceId, targetId, type } = req.body;
        if (!sourceId || !targetId || !type) {
            return res.status(400).json({ error: 'sourceId, targetId, and type are required' });
        }
        const newRelationship = await knowledgeGraph.createRelationship(projectId, sourceId, targetId, type);
        res.status(201).json(newRelationship);
    } catch (error) {
        handleApiError(res, error, `Failed to create relationship for project ${req.params.projectId}`);
    }
});

app.delete('/api/ui/projects/:projectId/relationships/:relationshipId', async (req: Request, res: Response) => {
    try {
        const { projectId, relationshipId } = req.params;
         // Note: knowledgeGraph.ts might need a deleteRelationship function by ID
         // Assuming deleteRelationship function exists or needs modification.
         // For now, let's assume it exists and takes projectId and relationshipId
         // If it doesn't exist, this route will fail until it's implemented in knowledgeGraph.ts
         const deleted = await knowledgeGraph.deleteRelationship(projectId, relationshipId); // Adjust if function signature differs
         if (deleted) {
             res.status(204).send();
         } else {
             res.status(404).json({ error: 'Relationship not found or deletion failed' });
         }
     } catch (error) {
         handleApiError(res, error, `Failed to delete relationship ${req.params.relationshipId}`);
     }
 });


// == Graph Data Route ==
app.get('/api/ui/projects/:projectId/graph', async (req: Request, res: Response) => {
    // Uncomment and implement the route for getting graph data
     try {
        const { projectId } = req.params;
        const graphData = await knowledgeGraph.getGraphData(projectId);
        res.json(graphData); // Returns { nodes: [], links: [] }
    } catch (error) {
        handleApiError(res, error, `Failed to get graph data for project ${req.params.projectId}`);
    }
});

// --- Create MCP SDK Server instance ---
const server = new Server({
    name: "standalone-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {}, // Indicate tool capability
    },
});

// --- Get Tool Definitions and Handlers ---
// Pass sessionManager if the get...Info functions require it
const kgToolInfo = getKnowledgeGraphToolInfo(sessionManager);
const projectToolInfo = getProjectToolInfo(sessionManager);

// Combine tool definitions and handlers
const allToolDefinitions = [
    ...kgToolInfo.definitions,
    ...projectToolInfo.definitions
];
const allToolHandlers = {
    ...kgToolInfo.handlers,
    ...projectToolInfo.handlers
};

// --- Register SDK Handlers ---

// Handler for listTools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Log that tools are being listed (use console.error for stderr)
    console.error(`Listing ${allToolDefinitions.length} tools.`);
    return {
        tools: allToolDefinitions,
    };
});

// Handler for callTool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`Received callTool request for: ${name}`); // Log tool calls

    const handler = allToolHandlers[name];
    if (!handler) {
        console.error(`Method not found: ${name}`);
        // Use McpError for standard error reporting
        throw new McpError(-32601, `Method not found: ${name}`);
    }

    const handlerArgs = args || {};
    // Note: sessionId is not available via stdio transport

    try {
        // Assume the handler function returns the expected { content: [...] } structure
        const result = await handler(handlerArgs);
        console.error(`Tool ${name} executed successfully.`); // Log success

        // Check if the handler itself indicated an error (optional pattern)
        if (result?.isError) {
             console.warn(`Handler for ${name} indicated an error:`, result.content);
             // Consider throwing McpError here for consistency if possible
        }

        return result; // Directly return the { content: [...] } object
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        // Throw standard MCP error
        throw new McpError(-32000, error instanceof Error ? error.message : `Internal server error executing tool: ${name}`);
    }
});

// --- Main function to connect server ---
async function main() {
    // Start the Express server for UI API
    app.listen(uiApiPort, () => {
        console.error(`🚀 UI API Server listening on port ${uiApiPort}`);
    });

    // Connect the MCP SDK server via Stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr as stdout is used for MCP communication
    console.error("🚀 MCP Server (SDK/Stdio) is running.");
}

// --- Start the server ---
main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});

// Removed app.listen() // This comment is now inaccurate as we added app.listen above 