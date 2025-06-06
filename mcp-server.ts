#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import next from 'next';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

// Import services and tools
import { SessionManager } from './lib/mcp/SessionManager';
import { getKnowledgeGraphToolInfo } from './lib/mcp/tools/KnowledgeGraphTools';
import { getProjectToolInfo } from './lib/mcp/tools/ProjectTools';
import { getInitSessionToolInfo } from './lib/mcp/tools/InitSessionTool';
import { vectorSearchTools, vectorSearchHandlers } from './lib/mcp/tools/VectorSearchTools';
import { contextTools } from './lib/mcp/tools/ContextTools';
import { 
    handleAddConversationContext,
    handleGetConversationContext,
    handleAutoExtractEntities,
    handleInitializeSession,
    handleTrackEntityInteraction,
    handleSearchConversationHistory,
    handleUpdateSessionState,
    handleGetSmartSuggestions,
    handleEndSession
} from './lib/mcp/tools/ContextTools';

// Import project and graph functions needed for UI API
import * as projectManager from './lib/projectManager';
import { qdrantDataService } from './lib/services/QdrantDataService';
import { logger } from './lib/services/Logger';
import { performStartupChecks } from './lib/startup-checks';

// Determine if we're running in MCP-only mode
const isMcpMode = process.env.MCP_MODE === 'true' || process.argv.includes('--mcp-mode');
const runUI = process.env.RUN_UI === 'true' && !isMcpMode;

// Log startup mode
if (isMcpMode) {
    logger.info('Starting in MCP-only mode (no HTTP server)');
} else if (runUI) {
    logger.info('Starting with UI and API server');
} else {
    logger.info('Starting API server only (no UI)');
}

// Instantiate Session Manager
const sessionManager = new SessionManager();

// Only create Express app if not in MCP-only mode
let app: express.Application | null = null;
let nextApp: any = null;
let nextHandler: any = null;
let resolvedPort: number = 4000; // Default port

if (!isMcpMode) {
    app = express();
    app.use(cors());
    app.use(express.json());
    
    const dev = process.env.NODE_ENV !== 'production';
    const basePort = parseInt(process.env.UI_API_PORT || '4000', 10);
    const fallbackPorts = [basePort, basePort + 1, basePort + 2];
    
    // Find free port function
    async function findFreePort(startPort: number, portsToTry: number[]): Promise<number> {
        const net = require('net');
        for (const port of portsToTry) {
            const available = await new Promise<boolean>((resolve) => {
                const server = net.createServer();
                server.listen(port, () => {
                    server.close(() => resolve(true));
                });
                server.on('error', () => resolve(false));
            });
            if (available) return port;
        }
        return startPort;
    }
    
    // Start HTTP server
    (async () => {
        resolvedPort = await findFreePort(basePort, fallbackPorts);
        logger.info(`Using port ${resolvedPort} for HTTP API server`);
        
        // Setup Next.js if UI is enabled
        if (runUI) {
            nextApp = next({ dev, dir: path.resolve(__dirname, '..') });
            nextHandler = nextApp.getRequestHandler();
            await nextApp.prepare();
            logger.info('Next.js application prepared');
        }
        
        // Define API routes BEFORE starting the server
        setupApiRoutes();
        
        // Start Express server
        app!.listen(resolvedPort, () => {
            logger.info(`HTTP server started on port ${resolvedPort}`);
            if (runUI) {
                logger.info(`Dashboard available at http://localhost:${resolvedPort}`);
            }
        });
        
        // Setup Next.js routes if UI is enabled - MUST come after API routes
        if (runUI) {
            app!.all('*', (req: Request, res: Response) => {
                return nextHandler(req, res);
            });
        }
    })();
}

// Define API routes function
function setupApiRoutes() {
    if (!app) return;
    
    // Helper function to handle API errors
    const handleApiError = (res: Response, error: unknown, message: string) => {
        logger.error(message, error);
        res.status(500).json({ error: message, details: error instanceof Error ? error.message : String(error) });
    };
    
    // Helper function to ensure Qdrant is initialized
    async function ensureQdrantInitialized() {
        try {
            await qdrantDataService.initialize();
        } catch (error) {
            logger.error('Failed to initialize Qdrant', error);
            throw error;
        }
    }
    
    // Helper functions for data conversion
    function convertQdrantEntityToEntity(qEntity: any) {
        return {
            id: qEntity.id,
            name: qEntity.name,
            type: qEntity.type,
            description: qEntity.description || '',
            observations: qEntity.metadata?.observations || [],
            parentId: qEntity.metadata?.parentId
        };
    }
    
    function convertQdrantRelationshipToRelationship(qRel: any) {
        return {
            id: qRel.id,
            from: qRel.sourceId,
            to: qRel.targetId,
            type: qRel.type,
            description: qRel.description
        };
    }
    
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
                res.status(409).json({ error: `Project with name '${name}' might already exist.` });
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
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            const { page, limit, type } = req.query;
            
            // If pagination parameters are provided, use paginated endpoint
            if (page && limit) {
                const pageNum = parseInt(page as string, 10);
                const limitNum = parseInt(limit as string, 10);
                const offset = (pageNum - 1) * limitNum;
                
                const entities = await qdrantDataService.getEntitiesByProject(projectId, limitNum, offset);
                const convertedEntities = entities.map(convertQdrantEntityToEntity);
                
                res.json({
                    entities: convertedEntities,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: convertedEntities.length
                    }
                });
            } else {
                const entities = await qdrantDataService.getEntitiesByProject(projectId, 1000);
                const convertedEntities = entities.map(convertQdrantEntityToEntity);
                res.json(convertedEntities);
            }
        } catch (error) {
            handleApiError(res, error, `Failed to list entities for project ${req.params.projectId}`);
        }
    });
    
    app.post('/api/ui/projects/:projectId/entities', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            const { name, type, description, observations, parentId } = req.body;
            if (!name || !type) {
                 return res.status(400).json({ error: 'Entity name and type are required' });
            }
            
            const newEntity = await qdrantDataService.createEntity({
                name,
                type,
                description: description || '',
                projectId,
                metadata: { 
                    parentId,
                    observations: observations || []
                }
            });
            
            res.status(201).json(convertQdrantEntityToEntity(newEntity));
        } catch (error) {
            handleApiError(res, error, `Failed to create entity for project ${req.params.projectId}`);
        }
    });
    
    app.get('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
         try {
            await ensureQdrantInitialized();
            const { projectId, entityId } = req.params;
            const entity = await qdrantDataService.getEntity(projectId, entityId);
            if (entity) {
                res.json(convertQdrantEntityToEntity(entity));
            } else {
                res.status(404).json({ error: 'Entity not found' });
            }
        } catch (error) {
            handleApiError(res, error, `Failed to get entity ${req.params.entityId}`);
        }
    });
    
    app.put('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, entityId } = req.params;
            const updates = req.body;
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Request body cannot be empty for update' });
            }
            
            await qdrantDataService.updateEntity(projectId, entityId, {
                name: updates.name,
                type: updates.type,
                description: updates.description,
                metadata: updates.metadata || {}
            });
            
            const updatedEntity = await qdrantDataService.getEntity(projectId, entityId);
            if (updatedEntity) {
                res.json(convertQdrantEntityToEntity(updatedEntity));
            } else {
                res.status(404).json({ error: `Entity ${entityId} not found or update failed.` });
            }
        } catch (error) {
            handleApiError(res, error, `Failed to update entity ${req.params.entityId}`);
        }
    });
    
    app.delete('/api/ui/projects/:projectId/entities/:entityId', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, entityId } = req.params;
            await qdrantDataService.deleteEntity(projectId, entityId);
            res.status(204).send();
        } catch (error) {
            handleApiError(res, error, `Failed to delete entity ${req.params.entityId}`);
        }
    });
    
    // == Observation Routes (Nested under Entities) ==
    app.post('/api/ui/projects/:projectId/entities/:entityId/observations', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, entityId } = req.params;
            const { text } = req.body;
            if (!text) {
                return res.status(400).json({ error: 'Observation text is required' });
            }
            
            // Get current entity
            const entity = await qdrantDataService.getEntity(projectId, entityId);
            if (!entity) {
                return res.status(404).json({ error: `Entity ${entityId} not found` });
            }
            
            // Add observation to metadata
            const observations = entity.metadata.observations || [];
            const newObservation = {
                id: uuidv4(),
                text,
                createdAt: new Date().toISOString()
            };
            observations.push(newObservation);
            
            await qdrantDataService.updateEntity(projectId, entityId, {
                metadata: { ...entity.metadata, observations }
            });
            
            res.status(201).json({ observation_id: newObservation.id });
        } catch (error) {
            handleApiError(res, error, `Failed to add observation to entity ${req.params.entityId}`);
        }
    });
    
    app.delete('/api/ui/projects/:projectId/entities/:entityId/observations/:observationId', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, entityId, observationId } = req.params;
            
            // Get current entity
            const entity = await qdrantDataService.getEntity(projectId, entityId);
            if (!entity) {
                return res.status(404).json({ error: `Entity ${entityId} not found` });
            }
            
            // Remove observation from metadata
            const observations = entity.metadata.observations || [];
            const filteredObservations = observations.filter((obs: any) => obs.id !== observationId);
            
            if (filteredObservations.length === observations.length) {
                return res.status(404).json({ error: `Observation ${observationId} not found` });
            }
            
            await qdrantDataService.updateEntity(projectId, entityId, {
                metadata: { ...entity.metadata, observations: filteredObservations }
            });
            
            res.status(204).send();
        } catch (error) {
            handleApiError(res, error, `Failed to delete observation ${req.params.observationId}`);
        }
    });
    
    // == Search Route ==
    app.get('/api/ui/projects/:projectId/search', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            const { q, type, limit } = req.query;
            
            if (!q || typeof q !== 'string') {
                return res.status(400).json({ error: 'Search query (q) is required' });
            }
            
            const searchLimit = limit ? parseInt(limit as string, 10) : 50;
            const results = await qdrantDataService.searchEntities(projectId, q, searchLimit);
            const convertedResults = results.map(convertQdrantEntityToEntity);
            
            res.json({ query: q, results: convertedResults, total: convertedResults.length });
        } catch (error) {
            handleApiError(res, error, `Failed to search entities in project ${req.params.projectId}`);
        }
    });
    
    // == Related Entities Route ==
    app.get('/api/ui/projects/:projectId/entities/:entityId/related', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, entityId } = req.params;
            const { type, direction } = req.query;
            
            // Get relationships for this entity
            const relationships = await qdrantDataService.getRelationshipsByEntity(projectId, entityId);
            
            // Get related entity IDs based on direction
            let relatedEntityIds: string[] = [];
            const validDirections = ['incoming', 'outgoing', 'both'];
            const validatedDirection = (direction && validDirections.includes(direction as string)) ? direction as string : 'both';
            
            relationships.forEach(rel => {
                if (validatedDirection === 'both' || validatedDirection === 'outgoing') {
                    if (rel.sourceId === entityId) {
                        relatedEntityIds.push(rel.targetId);
                    }
                }
                if (validatedDirection === 'both' || validatedDirection === 'incoming') {
                    if (rel.targetId === entityId) {
                        relatedEntityIds.push(rel.sourceId);
                    }
                }
            });
            
            // Get the actual entities
            const relatedEntities = [];
            for (const relatedId of relatedEntityIds) {
                const entity = await qdrantDataService.getEntity(projectId, relatedId);
                if (entity) {
                    relatedEntities.push(convertQdrantEntityToEntity(entity));
                }
            }
            
            res.json(relatedEntities);
        } catch (error) {
            handleApiError(res, error, `Failed to get related entities for ${req.params.entityId}`);
        }
    });
    
    // == Relationship Routes ==
    app.get('/api/ui/projects/:projectId/relationships', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            const { sourceId, targetId, type } = req.query;
            
            let relationships = await qdrantDataService.getAllRelationships(projectId);
            
            // Apply filters
            if (sourceId) {
                relationships = relationships.filter(rel => rel.sourceId === sourceId);
            }
            if (targetId) {
                relationships = relationships.filter(rel => rel.targetId === targetId);
            }
            if (type) {
                relationships = relationships.filter(rel => rel.type === type);
            }
            
            const convertedRelationships = relationships.map(convertQdrantRelationshipToRelationship);
            res.json(convertedRelationships);
        } catch (error) {
             handleApiError(res, error, `Failed to get relationships for project ${req.params.projectId}`);
        }
    });
    
    app.post('/api/ui/projects/:projectId/relationships', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            const { sourceId, targetId, type } = req.body;
            if (!sourceId || !targetId || !type) {
                return res.status(400).json({ error: 'sourceId, targetId, and type are required' });
            }
            
            const newRelationship = await qdrantDataService.createRelationship({
                sourceId,
                targetId,
                type,
                projectId,
                strength: 1.0,
                metadata: {}
            });
            
            res.status(201).json(convertQdrantRelationshipToRelationship(newRelationship));
        } catch (error) {
            handleApiError(res, error, `Failed to create relationship for project ${req.params.projectId}`);
        }
    });
    
    app.delete('/api/ui/projects/:projectId/relationships/:relationshipId', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId, relationshipId } = req.params;
            
            await qdrantDataService.deleteRelationship(projectId, relationshipId);
            res.status(204).send();
        } catch (error) {
            handleApiError(res, error, `Failed to delete relationship ${req.params.relationshipId}`);
        }
    });
    
    // == Graph Data Route ==
    app.get('/api/ui/projects/:projectId/graph', async (req: Request, res: Response) => {
         try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            
            const entities = await qdrantDataService.getEntitiesByProject(projectId, 1000);
            const relationships = await qdrantDataService.getAllRelationships(projectId);
            
            const graphData = {
                entities: entities.map(convertQdrantEntityToEntity),
                relationships: relationships.map(convertQdrantRelationshipToRelationship)
            };
            
            res.json(graphData);
        } catch (error) {
            handleApiError(res, error, `Failed to get graph data for project ${req.params.projectId}`);
        }
    });
    
    // == Metrics Route ==
    app.get('/api/ui/projects/:projectId/metrics', async (req: Request, res: Response) => {
        try {
            await ensureQdrantInitialized();
            const { projectId } = req.params;
            
            const entities = await qdrantDataService.getEntitiesByProject(projectId, 1000);
            const relationships = await qdrantDataService.getAllRelationships(projectId);
            
            const metrics = {
                totalEntities: entities.length,
                totalRelationships: relationships.length,
                entityTypes: [...new Set(entities.map(e => e.type))],
                relationshipTypes: [...new Set(relationships.map(r => r.type))]
            };
            
            res.json(metrics);
        } catch (error) {
            handleApiError(res, error, `Failed to get metrics for project ${req.params.projectId}`);
        }
    });
    
    // == Cache Management Routes ==
    app.delete('/api/ui/projects/:projectId/cache', async (req: Request, res: Response) => {
        try {
            // Qdrant doesn't have explicit cache management like KuzuDB
            // This is a no-op for now
            res.status(204).send();
        } catch (error) {
            handleApiError(res, error, `Failed to clear cache for project ${req.params.projectId}`);
        }
    });
    
    app.get('/api/ui/cache/stats', async (req: Request, res: Response) => {
        try {
            // Return basic stats from Qdrant health check
            await ensureQdrantInitialized();
            const health = await qdrantDataService.healthCheck();
            res.json({
                status: health.status,
                collections: health.collections,
                totalPoints: health.totalPoints
            });
        } catch (error) {
            handleApiError(res, error, 'Failed to get cache statistics');
        }
    });
}

// Setup MCP server tools
const kgToolInfo = getKnowledgeGraphToolInfo(sessionManager);
const projectToolInfo = getProjectToolInfo(sessionManager);
const initSessionToolInfo = getInitSessionToolInfo(sessionManager);

// Create context tool handlers map
const contextToolHandlers = {
    add_conversation_context: handleAddConversationContext,
    get_conversation_context: handleGetConversationContext,
    auto_extract_entities: handleAutoExtractEntities,
    initialize_session: handleInitializeSession,
    track_entity_interaction: handleTrackEntityInteraction,
    search_conversation_history: handleSearchConversationHistory,
    update_session_state: handleUpdateSessionState,
    get_smart_suggestions: handleGetSmartSuggestions,
    end_session: handleEndSession
};

const allToolDefinitions = [
    ...kgToolInfo.tools,
    ...projectToolInfo.definitions,
    ...initSessionToolInfo.definitions,
    ...vectorSearchTools,
    ...contextTools
];

const allToolCallHandlers = {
    ...kgToolInfo.handlers,
    ...projectToolInfo.handlers,
    ...initSessionToolInfo.handlers,
    ...vectorSearchHandlers,
    ...contextToolHandlers
};

// Create MCP Server
const mcpServer = new Server({
    name: "mcp-knowledge-graph",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {}, 
        resources: {},
        prompts: {},
    },
});

// Register MCP handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allToolDefinitions,
}));

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

mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
}));

mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
}));

// Main entry point
async function main() {
    const environment = process.env.NODE_ENV || 'development';
    
    logger.info('Starting MCP Knowledge Graph Server', { 
        environment, 
        mcpMode: isMcpMode,
        uiEnabled: runUI 
    });
    
    try {
        // Perform startup checks
        const checksOk = await performStartupChecks();
        if (!checksOk) {
            logger.error('Startup checks failed, exiting...');
            process.exit(1);
        }
        
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

// Start the server
main().catch((error) => {
    logger.error('Server startup failed', error);
    process.exit(1);
});
