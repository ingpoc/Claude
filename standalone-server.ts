#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import next from 'next'; // Import next
import path from 'path'; // Import path

// Import SDK components
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
    ListToolsRequestSchema, 
    CallToolRequestSchema, 
    ListResourcesRequestSchema,
    ListPromptsRequestSchema,
    McpError 
} from "@modelcontextprotocol/sdk/types.js";

// Keep SessionManager import if needed by tool info functions
import { SessionManager } from './lib/mcp/SessionManager';

// Import the new tool info functions
import { getKnowledgeGraphToolInfo } from './lib/mcp/tools/KnowledgeGraphTools';
import { getProjectToolInfo } from './lib/mcp/tools/ProjectTools';
import { getInitSessionToolInfo } from './lib/mcp/tools/InitSessionTool';

// Import project and graph functions needed for UI API
import * as projectManager from './lib/projectManager';
import * as knowledgeGraph from './lib/knowledgeGraph';

// Removed MCP protocol message interfaces (handled by SDK)

// Instantiate Session Manager
const sessionManager = new SessionManager();

// --- Create Express App for UI API ---
const app = express();
const dev = process.env.NODE_ENV !== 'production';

let resolvedUiApiPort;
if (dev) {
  // Part of 'npm run start:all', this is the API server for the Next.js dev server
  resolvedUiApiPort = process.env.UI_API_PORT || 3155; 
} else {
  // 'npm run start:prod', this server handles both UI and API
  resolvedUiApiPort = process.env.UI_API_PORT || 4000; 
}

const uiApiPort = resolvedUiApiPort;

// --- Next.js Setup ---
const nextApp = next({ dev, dir: path.resolve(__dirname, '..') });
const nextHandler = nextApp.getRequestHandler();

app.use(cors()); 
app.use(express.json());

// --- Define UI API Routes ---
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
            res.status(204).send();
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
    try {
        const { projectId, entityId } = req.params;
        const updates = req.body;
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Request body cannot be empty for update' });
        }
        const updatedEntity = await knowledgeGraph.updateEntity(projectId, entityId, updates);
        if (updatedEntity) {
            res.json(updatedEntity);
        } else {
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
            res.status(201).json(result);
        } else {
            res.status(404).json({ error: `Failed to add observation to entity ${entityId}. Entity may not exist.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to add observation to entity ${req.params.entityId}`);
    }
});

app.delete('/api/ui/projects/:projectId/entities/:entityId/observations/:observationId', async (req: Request, res: Response) => {
    console.log(`[API DELETE /obs] Received request: projectId=${req.params.projectId}, entityId=${req.params.entityId}, observationId=${req.params.observationId}`);
    try {
        const { projectId, entityId, observationId } = req.params;
        const deleted = await knowledgeGraph.deleteObservation(projectId, entityId, observationId);
        if (deleted) {
            res.status(204).send(); 
        } else {
            res.status(404).json({ error: `Observation ${observationId} not found on entity ${entityId}, or entity not found.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to delete observation ${req.params.observationId}`);
    }
});

app.put('/api/ui/projects/:projectId/entities/:entityId/observations/:observationId', async (req: Request, res: Response) => {
    console.log(`[API PUT /obs] Received request: projectId=${req.params.projectId}, entityId=${req.params.entityId}, observationId=${req.params.observationId}`);
    console.log(`[API PUT /obs] Request body:`, req.body);
    try {
        const { projectId, entityId, observationId } = req.params;
        const { text } = req.body;
        if (typeof text !== 'string' || text.trim() === '') {
             return res.status(400).json({ error: 'Observation text cannot be empty' });
        }
        const updatedObservation = await knowledgeGraph.editObservation(projectId, entityId, observationId, text);
        if (updatedObservation) {
             res.status(200).json(updatedObservation); 
        } else {
            res.status(404).json({ error: `Failed to update observation ${observationId}. Entity or observation may not exist.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to update observation ${req.params.observationId}`);
    }
});

// == Related Entities Route ==
app.get('/api/ui/projects/:projectId/entities/:entityId/related', async (req: Request, res: Response) => {
    try {
        const { projectId, entityId } = req.params;
        const { type, direction } = req.query;
        const validDirections = ['incoming', 'outgoing', 'both'];
        let validatedDirection: 'incoming' | 'outgoing' | 'both' = 'both';
        if (direction && typeof direction === 'string' && validDirections.includes(direction)) {
            validatedDirection = direction as 'incoming' | 'outgoing' | 'both';
        }
        const relatedEntities = await knowledgeGraph.getRelatedEntities(
            projectId,
            entityId,
            type as string | undefined,
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
        const { sourceId, targetId, type } = req.query;
        const relationships = await knowledgeGraph.getRelationships(
            projectId,
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
         const deleted = await knowledgeGraph.deleteRelationship(projectId, relationshipId);
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
     try {
        const { projectId } = req.params;
        const graphData = await knowledgeGraph.getGraphData(projectId);
        res.json(graphData);
    } catch (error) {
        handleApiError(res, error, `Failed to get graph data for project ${req.params.projectId}`);
    }
});

// --- Create MCP SDK Server instance ---
const mcpServer = new Server({ // Renamed to mcpServer to avoid conflict with Express 'Server' type
    name: "standalone-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {}, 
        resources: {},
        prompts: {},
    },
});

const kgToolInfo = getKnowledgeGraphToolInfo(sessionManager);
const projectToolInfo = getProjectToolInfo(sessionManager);
const initSessionToolInfo = getInitSessionToolInfo(sessionManager);

const allToolDefinitions = [
    ...kgToolInfo.definitions,
    ...projectToolInfo.definitions,
    ...initSessionToolInfo.definitions
];
const allToolHandlers = {
    ...kgToolInfo.handlers,
    ...projectToolInfo.handlers,
    ...initSessionToolInfo.handlers
};

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error(`Listing ${allToolDefinitions.length} tools.`);
    return {
        tools: allToolDefinitions,
    };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const currentSessionId = undefined; 
    console.error(`[CallTool] Received request for: ${name} (Session Context: ${sessionManager.hasActiveProjectContext(currentSessionId) ? `Project ${sessionManager.getActiveProjectContext(currentSessionId)?.projectId}` : 'None'})`);
    let activeProjectId: string | null = null;
    if (name !== 'init_session') {
        const context = sessionManager.getActiveProjectContext(currentSessionId);
        if (!context) {
            console.error(`[CallTool] Rejecting tool call '${name}': Session not initialized.`);
            throw new McpError(-32001, `Session not initialized. Please call 'mcp_knowledge_graph_init_session' first with a codebase identifier (like a project ID, name, or path) to establish a context.`);
        }
        activeProjectId = context.projectId;
    }
    const handler = allToolHandlers[name];
    if (!handler) {
        console.error(`Method not found: ${name}`);
        throw new McpError(-32601, `Method not found: ${name}`);
    }
    const handlerArgs = args || {};
    const combinedArgs = activeProjectId ? { ...handlerArgs, project_id: activeProjectId } : handlerArgs;
    try {
        const result = await handler(combinedArgs);
        console.error(`[CallTool] Tool ${name} executed successfully.`);
        if (result?.isError) {
             console.warn(`[CallTool] Handler for ${name} indicated an error:`, result.content);
        }
        return result;
    } catch (error) {
        console.error(`[CallTool] Error executing tool ${name}:`, error);
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(-32000, error instanceof Error ? error.message : `Internal server error executing tool: ${name}`);
    }
});

mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [],
    };
});

mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [],
    };
});

async function main() {
    try {
        await nextApp.prepare(); 

        // Catch-all for Next.js pages - THIS MUST BE LAST for Express routing
        app.all('*', (req: Request, res: Response) => {
            return nextHandler(req, res);
        });
        
        // Start the Express server (which now also serves Next.js pages)
        app.listen(uiApiPort, () => {
            console.error(`🚀 HTTP Server (UI & API) listening on port ${uiApiPort}`);
            if (!dev) {
                console.error(`Production UI available at http://localhost:${uiApiPort}`);
            }
        });

        const transport = new StdioServerTransport();
        await mcpServer.connect(transport); // Use mcpServer
        console.error("🚀 MCP Server (SDK/Stdio) is running.");

    } catch (ex) {
        console.error("❌ Fatal error during server startup:", ex);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("❌ Fatal error in main:", error); // Added more specific error logging
    process.exit(1);
}); 