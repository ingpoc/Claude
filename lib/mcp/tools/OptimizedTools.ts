import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { qdrantDataService } from '../services/QdrantDataService';
import { projectManager } from '../projectManager';
import { SessionManager } from '../SessionManager';
import { entityService } from '../services/EntityService';
import { openRouterService } from '../services/OpenRouterService';
import { v4 as uuidv4 } from 'uuid';

// Export consolidated tools for the lean MCP server
export const knowledgeGraphTools: Tool[] = [
    // Core entity management
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
        name: "search_entities",
        description: "Search entities using text or vector search",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                query: { type: "string", description: "Search query" },
                searchType: { 
                    type: "string", 
                    enum: ["text", "vector", "hybrid"],
                    default: "hybrid",
                    description: "Type of search to perform"
                },
                limit: { type: "integer", description: "Max results", default: 20 }
            },
            required: ["projectId", "query"]
        }
    },
    {
        name: "batch_operations",
        description: "Perform batch operations on entities and relationships",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                operations: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { 
                                type: "string", 
                                enum: ["create_entity", "create_relationship", "update_entity"]
                            },
                            data: { type: "object" }
                        },
                        required: ["type", "data"]
                    }
                }
            },
            required: ["projectId", "operations"]
        }
    },
    {
        name: "analyze_graph",
        description: "Analyze graph structure and extract insights",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                analysisType: {
                    type: "string",
                    enum: ["centrality", "clusters", "paths", "statistics"],
                    default: "statistics"
                },
                entityId: { type: "string", description: "Optional entity ID for focused analysis" }
            },
            required: ["projectId"]
        }
    },
    {
        name: "smart_query",
        description: "Natural language query with AI-powered entity extraction and search",
        inputSchema: {
            type: "object",
            properties: {
                projectId: { type: "string", description: "Project ID" },
                query: { type: "string", description: "Natural language query" },
                autoCreate: { 
                    type: "boolean", 
                    description: "Automatically create extracted entities",
                    default: false
                }
            },
            required: ["projectId", "query"]
        }
    }
];

// Consolidated tool handlers
export const knowledgeGraphHandlers: Record<string, (args: any) => Promise<any>> = {
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

    async search_entities(args: any) {
        await qdrantDataService.initialize();
        let results;
        
        if (args.searchType === 'text') {
            results = await qdrantDataService.searchEntities(args.projectId, args.query, args.limit);
        } else if (args.searchType === 'vector') {
            results = await qdrantDataService.vectorSearch(args.projectId, args.query, args.limit);
        } else {
            // Hybrid search - combine text and vector results
            const textResults = await qdrantDataService.searchEntities(args.projectId, args.query, args.limit);
            const vectorResults = await qdrantDataService.vectorSearch(args.projectId, args.query, args.limit);
            
            // Merge and deduplicate results
            const resultMap = new Map();
            [...textResults, ...vectorResults].forEach(entity => {
                if (!resultMap.has(entity.id)) {
                    resultMap.set(entity.id, entity);
                }
            });
            results = Array.from(resultMap.values()).slice(0, args.limit);
        }
        
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },

    async batch_operations(args: any) {
        await qdrantDataService.initialize();
        const results = [];
        
        for (const op of args.operations) {
            try {
                let result;
                switch (op.type) {
                    case 'create_entity':
                        result = await qdrantDataService.createEntity({
                            ...op.data,
                            projectId: args.projectId
                        });
                        break;
                    case 'create_relationship':
                        result = await qdrantDataService.createRelationship({
                            ...op.data,
                            projectId: args.projectId
                        });
                        break;
                    case 'update_entity':
                        await qdrantDataService.updateEntity(
                            args.projectId,
                            op.data.entityId,
                            op.data.updates
                        );
                        result = { entityId: op.data.entityId, updated: true };
                        break;
                }
                results.push({ operation: op.type, success: true, result });
            } catch (error) {
                results.push({ 
                    operation: op.type, 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },

    async analyze_graph(args: any) {
        await qdrantDataService.initialize();
        const entities = await qdrantDataService.getEntitiesByProject(args.projectId, 1000);
        const relationships = await qdrantDataService.getAllRelationships(args.projectId);
        
        let analysis: any = {
            projectId: args.projectId,
            timestamp: new Date().toISOString()
        };
        
        switch (args.analysisType) {
            case 'centrality':
                // Calculate degree centrality
                const degreeMap = new Map<string, number>();
                relationships.forEach(rel => {
                    degreeMap.set(rel.sourceId, (degreeMap.get(rel.sourceId) || 0) + 1);
                    degreeMap.set(rel.targetId, (degreeMap.get(rel.targetId) || 0) + 1);
                });
                
                const centrality = Array.from(degreeMap.entries())
                    .map(([id, degree]) => {
                        const entity = entities.find(e => e.id === id);
                        return { id, name: entity?.name, degree };
                    })
                    .sort((a, b) => b.degree - a.degree)
                    .slice(0, 10);
                
                analysis.centrality = centrality;
                break;
                
            case 'clusters':
                // Group entities by type
                const clusters = entities.reduce((acc, entity) => {
                    if (!acc[entity.type]) acc[entity.type] = [];
                    acc[entity.type].push(entity);
                    return acc;
                }, {} as Record<string, any[]>);
                
                analysis.clusters = Object.entries(clusters).map(([type, entities]) => ({
                    type,
                    count: entities.length,
                    entities: entities.slice(0, 5).map(e => ({ id: e.id, name: e.name }))
                }));
                break;
                
            case 'paths':
                if (args.entityId) {
                    // Find connected entities
                    const connected = new Set<string>();
                    relationships.forEach(rel => {
                        if (rel.sourceId === args.entityId) connected.add(rel.targetId);
                        if (rel.targetId === args.entityId) connected.add(rel.sourceId);
                    });
                    
                    analysis.connectedEntities = Array.from(connected).map(id => {
                        const entity = entities.find(e => e.id === id);
                        return { id, name: entity?.name, type: entity?.type };
                    });
                }
                break;
                
            case 'statistics':
            default:
                analysis.statistics = {
                    totalEntities: entities.length,
                    totalRelationships: relationships.length,
                    entityTypes: [...new Set(entities.map(e => e.type))].length,
                    relationshipTypes: [...new Set(relationships.map(r => r.type))].length,
                    avgRelationshipsPerEntity: relationships.length / Math.max(entities.length, 1),
                    topEntityTypes: Object.entries(
                        entities.reduce((acc, e) => {
                            acc[e.type] = (acc[e.type] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>)
                    ).sort((a, b) => b[1] - a[1]).slice(0, 5)
                };
                break;
        }
        
        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
    },

    async smart_query(args: any) {
        await qdrantDataService.initialize();
        
        // Extract entities from the query
        const { entities: extractedEntities, relationships } = await qdrantDataService.extractEntitiesFromText(
            args.query,
            args.projectId
        );
        
        // Search for existing entities
        const searchResults = await qdrantDataService.vectorSearch(
            args.projectId,
            args.query,
            20
        );
        
        // Auto-create entities if requested
        const createdEntities = [];
        if (args.autoCreate && extractedEntities.length > 0) {
            for (const entity of extractedEntities) {
                // Check if entity already exists
                const exists = searchResults.some(
                    e => e.name.toLowerCase() === entity.name.toLowerCase()
                );
                
                if (!exists) {
                    const created = await qdrantDataService.createEntity({
                        name: entity.name,
                        type: entity.type,
                        description: entity.description || '',
                        projectId: args.projectId,
                        metadata: {}
                    });
                    createdEntities.push(created);
                }
            }
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    query: args.query,
                    extractedEntities,
                    searchResults,
                    createdEntities,
                    suggestedRelationships: relationships
                }, null, 2)
            }]
        };
    }
};
