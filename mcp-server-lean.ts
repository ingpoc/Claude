#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
    ListToolsRequestSchema, 
    CallToolRequestSchema, 
    McpError,
    Tool
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';
import { logger } from './lib/services/Logger';
import { qdrantDataService } from './lib/services/QdrantDataService';
import { SessionManager } from './lib/mcp/SessionManager';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize session manager
const sessionManager = new SessionManager();

// Consolidated tool definitions
const tools: Tool[] = [
    // === Core Entity Tools ===
    {
        name: "create_entity",
        description: "Create a new entity in the knowledge graph",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                name: { type: "string", description: "Entity name" },
                type: { type: "string", description: "Entity type" },
                description: { type: "string", description: "Optional description" },
                metadata: { type: "object", description: "Additional metadata" }
            },
            required: ["projectId", "name", "type"]
        }
    },
    {
        name: "get_entity",
        description: "Get an entity by ID",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entityId: { type: "string", description: "Entity ID" }
            },
            required: ["projectId", "entityId"]
        }
    },
    {
        name: "update_entity",
        description: "Update an entity",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entityId: { type: "string", description: "Entity ID" },
                updates: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                        description: { type: "string" },
                        metadata: { type: "object" }
                    }
                }
            },
            required: ["projectId", "entityId", "updates"]
        }
    },
    {
        name: "delete_entity",
        description: "Delete an entity and its relationships",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entityId: { type: "string", description: "Entity ID" }
            },
            required: ["projectId", "entityId"]
        }
    },
    {
        name: "search_entities",
        description: "Search entities by name or description",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                query: { type: "string", description: "Search query" },
                limit: { type: "integer", description: "Max results", default: 20 }
            },
            required: ["projectId", "query"]
        }
    },
    
    // === Relationship Tools ===
    {
        name: "create_relationship",
        description: "Create a relationship between entities",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                sourceId: { type: "string", description: "Source entity ID" },
                targetId: { type: "string", description: "Target entity ID" },
                type: { type: "string", description: "Relationship type" },
                metadata: { type: "object", description: "Additional metadata" }
            },
            required: ["projectId", "sourceId", "targetId", "type"]
        }
    },
    {
        name: "get_relationships",
        description: "Get relationships for an entity",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entityId: { type: "string", description: "Entity ID" },
                direction: { 
                    type: "string", 
                    enum: ["incoming", "outgoing", "both"],
                    default: "both"
                }
            },
            required: ["projectId", "entityId"]
        }
    },
    
    // === Vector Search Tools ===
    {
        name: "vector_search",
        description: "Semantic search using vector embeddings",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                query: { type: "string", description: "Search query" },
                limit: { type: "integer", description: "Max results", default: 10 },
                threshold: { type: "number", description: "Similarity threshold", default: 0.7 }
            },
            required: ["projectId", "query"]
        }
    },
    {
        name: "find_similar",
        description: "Find entities similar to a given entity",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entityId: { type: "string", description: "Entity ID" },
                limit: { type: "integer", description: "Max results", default: 10 }
            },
            required: ["projectId", "entityId"]
        }
    },
    
    // === Session & Context Tools ===
    {
        name: "init_session",
        description: "Initialize a knowledge graph session",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                metadata: { type: "object", description: "Session metadata" }
            },
            required: ["projectId"]
        }
    },
    {
        name: "add_context",
        description: "Add conversation context to session",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "Session ID" },
                role: { type: "string", enum: ["user", "assistant"] },
                content: { type: "string", description: "Message content" }
            },
            required: ["sessionId", "role", "content"]
        }
    },
    {
        name: "extract_entities",
        description: "Extract entities from text using AI",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                text: { type: "string", description: "Text to analyze" },
                createEntities: { type: "boolean", description: "Auto-create extracted entities", default: false }
            },
            required: ["projectId", "text"]
        }
    },
    
    // === Batch Operations ===
    {
        name: "batch_create_entities",
        description: "Create multiple entities at once",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                entities: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            type: { type: "string" },
                            description: { type: "string" },
                            metadata: { type: "object" }
                        },
                        required: ["name", "type"]
                    }
                }
            },
            required: ["projectId", "entities"]
        }
    },
    {
        name: "get_graph_snapshot",
        description: "Get complete graph data for a project",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                includeMetadata: { type: "boolean", default: false }
            },
            required: ["projectId"]
        }
    }
];

// Tool handlers
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    async create_entity(args: any) {
        await qdrantDataService.initialize();
        const entity = await qdrantDataService.createEntity({
            name: args.name,
            type: args.type,
            description: args.description || '',
            projectId: args.projectId,
            metadata: args.metadata || {}
        });
        return { content: [{ type: "text", text: JSON.stringify(entity, null, 2) }] };
    },

    async get_entity(args: any) {
        await qdrantDataService.initialize();
        const entity = await qdrantDataService.getEntity(args.projectId, args.entityId);
        if (!entity) {
            throw new McpError(-1, `Entity ${args.entityId} not found`);
        }
        return { content: [{ type: "text", text: JSON.stringify(entity, null, 2) }] };
    },

    async update_entity(args: any) {
        await qdrantDataService.initialize();
        await qdrantDataService.updateEntity(args.projectId, args.entityId, args.updates);
        const updated = await qdrantDataService.getEntity(args.projectId, args.entityId);
        return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    },

    async delete_entity(args: any) {
        await qdrantDataService.initialize();
        await qdrantDataService.deleteEntity(args.projectId, args.entityId);
        return { content: [{ type: "text", text: "Entity deleted successfully" }] };
    },

    async search_entities(args: any) {
        await qdrantDataService.initialize();
        const results = await qdrantDataService.searchEntities(
            args.projectId, 
            args.query, 
            args.limit || 20
        );
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },

    async create_relationship(args: any) {
        await qdrantDataService.initialize();
        const relationship = await qdrantDataService.createRelationship({
            sourceId: args.sourceId,
            targetId: args.targetId,
            type: args.type,
            projectId: args.projectId,
            strength: 1.0,
            metadata: args.metadata || {}
        });
        return { content: [{ type: "text", text: JSON.stringify(relationship, null, 2) }] };
    },

    async get_relationships(args: any) {
        await qdrantDataService.initialize();
        const relationships = await qdrantDataService.getRelationshipsByEntity(
            args.projectId,
            args.entityId
        );
        
        // Filter by direction if specified
        let filtered = relationships;
        if (args.direction === 'outgoing') {
            filtered = relationships.filter(r => r.sourceId === args.entityId);
        } else if (args.direction === 'incoming') {
            filtered = relationships.filter(r => r.targetId === args.entityId);
        }
        
        return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    },

    async vector_search(args: any) {
        await qdrantDataService.initialize();
        const results = await qdrantDataService.vectorSearch(
            args.projectId,
            args.query,
            args.limit || 10,
            args.threshold || 0.7
        );
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },

    async find_similar(args: any) {
        await qdrantDataService.initialize();
        const results = await qdrantDataService.findSimilarEntities(
            args.projectId,
            args.entityId,
            args.limit || 10
        );
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },

    async init_session(args: any) {
        const sessionId = uuidv4();
        const session = sessionManager.createSession(sessionId, args.projectId, args.metadata);
        return { content: [{ type: "text", text: JSON.stringify(session, null, 2) }] };
    },

    async add_context(args: any) {
        const session = sessionManager.getSession(args.sessionId);
        if (!session) {
            throw new McpError(-1, `Session ${args.sessionId} not found`);
        }
        
        sessionManager.addConversationContext(args.sessionId, {
            role: args.role,
            content: args.content,
            timestamp: new Date()
        });
        
        return { content: [{ type: "text", text: "Context added successfully" }] };
    },

    async extract_entities(args: any) {
        await qdrantDataService.initialize();
        const { entities, relationships } = await qdrantDataService.extractEntitiesFromText(
            args.text,
            args.projectId
        );
        
        if (args.createEntities) {
            for (const entity of entities) {
                await qdrantDataService.createEntity({
                    name: entity.name,
                    type: entity.type,
                    description: entity.description || '',
                    projectId: args.projectId,
                    metadata: {}
                });
            }
        }
        
        return { 
            content: [{ 
                type: "text", 
                text: JSON.stringify({ entities, relationships }, null, 2) 
            }] 
        };
    },

    async batch_create_entities(args: any) {
        await qdrantDataService.initialize();
        const created = [];
        
        for (const entity of args.entities) {
            const newEntity = await qdrantDataService.createEntity({
                name: entity.name,
                type: entity.type,
                description: entity.description || '',
                projectId: args.projectId,
                metadata: entity.metadata || {}
            });
            created.push(newEntity);
        }
        
        return { content: [{ type: "text", text: JSON.stringify(created, null, 2) }] };
    },

    async get_graph_snapshot(args: any) {
        await qdrantDataService.initialize();
        const entities = await qdrantDataService.getEntitiesByProject(args.projectId, 1000);
        const relationships = await qdrantDataService.getAllRelationships(args.projectId);
        
        const snapshot = {
            projectId: args.projectId,
            timestamp: new Date().toISOString(),
            entities: args.includeMetadata ? entities : entities.map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                description: e.description
            })),
            relationships: relationships.map(r => ({
                id: r.id,
                sourceId: r.sourceId,
                targetId: r.targetId,
                type: r.type
            })),
            stats: {
                totalEntities: entities.length,
                totalRelationships: relationships.length,
                entityTypes: [...new Set(entities.map(e => e.type))],
                relationshipTypes: [...new Set(relationships.map(r => r.type))]
            }
        };
        
        return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] };
    }
};

// Create MCP Server
const mcpServer = new Server({
    name: "mcp-knowledge-graph-lean",
    version: "2.0.0",
}, {
    capabilities: {
        tools: {},
    },
});

// Register handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools,
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const handler = toolHandlers[name];
    if (!handler) {
        throw new McpError(-1, `Unknown tool: ${name}`);
    }
    
    try {
        return await handler(args || {});
    } catch (error) {
        logger.error('Tool execution failed', error, { toolName: name });
        throw new McpError(
            -1,
            `Failed to execute tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
});

// Main entry point
async function main() {
    logger.info('Starting Lean MCP Knowledge Graph Server');
    
    try {
        // Initialize Qdrant
        await qdrantDataService.initialize();
        logger.info('Qdrant initialized successfully');
        
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
