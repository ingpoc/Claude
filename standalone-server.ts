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
import { knowledgeGraphService } from './lib/services/KnowledgeGraphService';
import { logger } from './lib/services/Logger';

// Instantiate Session Manager
const sessionManager = new SessionManager();

// --- Create Express App for UI API ---
const app = express();
const dev = process.env.NODE_ENV !== 'production';

let resolvedUiApiPort: number;
if (dev) {
  // Part of 'npm run start:all', this is the API server for the Next.js dev server
  resolvedUiApiPort = parseInt(process.env.UI_API_PORT || '3155', 10); 
} else {
  // 'npm run start:prod', this server handles both UI and API
  resolvedUiApiPort = parseInt(process.env.UI_API_PORT || '4000', 10); 
}

const uiApiPort = resolvedUiApiPort;

// --- Next.js Setup ---
const nextApp = next({ dev, dir: path.resolve(__dirname, '..') });
const nextHandler = nextApp.getRequestHandler();

app.use(cors()); 
app.use(express.json());

// --- Define UI API Routes ---
const handleApiError = (res: Response, error: unknown, message: string) => {
    logger.error(message, error);
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
        const { page, limit, type } = req.query;
        
        // If pagination parameters are provided, use paginated endpoint
        if (page && limit) {
            const paginationOptions = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10)
            };
            const result = await knowledgeGraphService.getEntitiesPaginated(
                projectId, 
                paginationOptions, 
                type as string | undefined
            );
            res.json(result);
        } else {
            const entities = await knowledgeGraphService.getAllEntities(projectId, type as string | undefined);
            res.json(entities);
        }
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
        const newEntity = await knowledgeGraphService.createEntity(projectId, {
            name, type, description, observationsText: observations, parentId
        });
        res.status(201).json(newEntity);
    } catch (error) {
        handleApiError(res, error, `Failed to create entity for project ${req.params.projectId}`);
    }
});

app.get('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
     try {
        const { projectId, entityId } = req.params;
        const entity = await knowledgeGraphService.getEntity(projectId, entityId);
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
        const updatedEntity = await knowledgeGraphService.updateEntity(projectId, entityId, updates);
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
        const deleted = await knowledgeGraphService.deleteEntity(projectId, entityId);
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
        const result = await knowledgeGraphService.addObservation(projectId, entityId, text);
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
    try {
        const { projectId, entityId, observationId } = req.params;
        const deleted = await knowledgeGraphService.deleteObservation(projectId, entityId, observationId);
        if (deleted) {
            res.status(204).send(); 
        } else {
            res.status(404).json({ error: `Observation ${observationId} not found on entity ${entityId}, or entity not found.` });
        }
    } catch (error) {
        handleApiError(res, error, `Failed to delete observation ${req.params.observationId}`);
    }
});

// == Search Route ==
app.get('/api/ui/projects/:projectId/search', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { q, type, limit } = req.query;
        
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Search query (q) is required' });
        }
        
        const searchLimit = limit ? parseInt(limit as string, 10) : 50;
        const results = await knowledgeGraphService.searchEntities(
            projectId, 
            q, 
            type as string | undefined, 
            searchLimit
        );
        
        res.json({ query: q, results, total: results.length });
    } catch (error) {
        handleApiError(res, error, `Failed to search entities in project ${req.params.projectId}`);
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
        const relatedEntities = await knowledgeGraphService.getRelatedEntities(
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
        const relationships = await knowledgeGraphService.getRelationships(
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
        const newRelationship = await knowledgeGraphService.createRelationship(projectId, {
            fromEntityId: sourceId,
            toEntityId: targetId,
            type
        });
        res.status(201).json(newRelationship);
    } catch (error) {
        handleApiError(res, error, `Failed to create relationship for project ${req.params.projectId}`);
    }
});

app.delete('/api/ui/projects/:projectId/relationships/:relationshipId', async (req: Request, res: Response) => {
    try {
        const { projectId, relationshipId } = req.params;
         const deleted = await knowledgeGraphService.deleteRelationship(projectId, relationshipId);
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
        const graphData = await knowledgeGraphService.getGraphData(projectId);
        res.json(graphData);
    } catch (error) {
        handleApiError(res, error, `Failed to get graph data for project ${req.params.projectId}`);
    }
});

// == Metrics Route ==
app.get('/api/ui/projects/:projectId/metrics', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const metrics = await knowledgeGraphService.getGraphMetrics(projectId);
        res.json(metrics);
    } catch (error) {
        handleApiError(res, error, `Failed to get metrics for project ${req.params.projectId}`);
    }
});

// == Cache Management Routes ==
app.delete('/api/ui/projects/:projectId/cache', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        knowledgeGraphService.clearProjectCache(projectId);
        res.status(204).send();
    } catch (error) {
        handleApiError(res, error, `Failed to clear cache for project ${req.params.projectId}`);
    }
});

app.get('/api/ui/cache/stats', async (req: Request, res: Response) => {
    try {
        const stats = knowledgeGraphService.getCacheStats();
        res.json(stats);
    } catch (error) {
        handleApiError(res, error, 'Failed to get cache statistics');
    }
});

// --- Create MCP SDK Server instance ---
const mcpServer = new Server({
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
    ...kgToolInfo.tools,
    ...projectToolInfo.definitions,
    ...initSessionToolInfo.definitions
];

const allToolCallHandlers = {
    ...kgToolInfo.handlers,
    ...projectToolInfo.handlers,
    ...initSessionToolInfo.handlers
};

// Register list_tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allToolDefinitions,
}));

// Register call_tool handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const handler = allToolCallHandlers[name];
    if (!handler) {
        throw new McpError(-1, `Unknown tool: ${name}`); 
    }
    
    try {
        const result = await handler(args || {});
        return result;
    } catch (error) {
        logger.error('Tool execution failed', error, { toolName: name });
        throw new McpError(
            -1,
            `Failed to execute tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
});

// Register list_resources handler (empty for now)
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
}));

// Register list_prompts handler (empty for now)
mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
}));

// Entry point function
async function main() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    logger.info('Starting MCP Knowledge Graph Server', {
        environment: process.env.NODE_ENV || 'development',
        port: uiApiPort,
        production: isProduction
    });

    try {
        // Prepare Next.js
        await nextApp.prepare();
        logger.info('Next.js application prepared');

        if (isProduction) {
            // Production mode: Serve both UI and API from this single server
            logger.info('Running in production mode - serving UI and API');
            
            // Serve Next.js static files and pages
            app.all('*', (req, res) => {
                return nextHandler(req, res);
            });
        } else {
            // Development mode: Only serve API (UI runs separately via `npm run start-nextjs`)
            logger.info('Running in development mode - serving API only');
        }

                 // Start Express server
         app.listen(uiApiPort, () => {
             logger.info('Express server started', { port: uiApiPort });
         });

        // Start MCP server
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
        logger.info('MCP server connected via stdio');

    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

if (require.main === module) {
    main().catch((error) => {
        logger.error('Server startup failed', error);
        process.exit(1);
    });
} 