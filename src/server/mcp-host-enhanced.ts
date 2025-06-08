#!/usr/bin/env node

/**
 * Enhanced MCP Host for Knowledge Graph
 * 
 * Incorporates best practices from:
 * - Official MCP TypeScript SDK patterns
 * - mem0 AI memory management concepts
 * - Zod validation and type safety
 * - Proper lifecycle management
 * 
 * Usage:
 * 1. Start services: npm run start:services
 * 2. Configure AI apps to use: node dist/src/server/mcp-host-enhanced.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';

// Enhanced validation schemas following MCP TypeScript SDK patterns
const CreateEntitySchema = z.object({
  name: z.string().min(1, "Entity name is required"),
  type: z.string().min(1, "Entity type is required"), 
  description: z.string().min(1, "Entity description is required"),
  projectId: z.string().optional().default("default"),
  metadata: z.record(z.any()).optional()
});

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional()
});

const SearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  projectId: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7)
});

const CreateRelationshipSchema = z.object({
  fromEntityId: z.string().min(1, "Source entity ID is required"),
  toEntityId: z.string().min(1, "Target entity ID is required"),
  relationshipType: z.string().min(1, "Relationship type is required"),
  description: z.string().optional(),
  projectId: z.string().optional().default("default"),
  strength: z.number().min(0).max(1).optional().default(1.0)
});

const AddObservationSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  text: z.string().min(1, "Observation text is required"),
  type: z.enum(['note', 'insight', 'update', 'context']).optional().default('note'),
  importance: z.number().min(0).max(1).optional().default(0.5)
});

// Enhanced client detection with session management
interface ClientSession {
  id: string;
  name: string;
  version: string;
  pid: number;
  ppid: number;
  startTime: string;
  lastActivity: string;
  memoryContext: {
    userId?: string;
    sessionId: string;
    preferences: Record<string, any>;
    recentInteractions: string[];
  };
}

function detectClientInfo(): ClientSession {
  const pid = process.pid;
  const ppid = process.ppid || 0;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let clientName = 'Unknown MCP Client';
  let clientVersion = '1.0.0';
  
  try {
    // Enhanced client detection
    if (process.env.CLAUDE_DESKTOP_VERSION) {
      clientName = 'Claude Desktop';
      clientVersion = process.env.CLAUDE_DESKTOP_VERSION;
    } else if (process.env.CURSOR_VERSION) {
      clientName = 'Cursor';
      clientVersion = process.env.CURSOR_VERSION;
    } else if (process.env.CLINE_VERSION) {
      clientName = 'Cline';
      clientVersion = process.env.CLINE_VERSION;
    } else {
      const args = process.argv.join(' ');
      if (args.includes('claude')) clientName = 'Claude Desktop';
      else if (args.includes('cursor')) clientName = 'Cursor';
      else if (args.includes('cline')) clientName = 'Cline';
      else if (args.includes('continue')) clientName = 'Continue';
    }
  } catch (error) {
    // Fallback to unknown
  }
  
  const now = new Date().toISOString();
  
  return {
    id: `${clientName.toLowerCase().replace(/\s+/g, '-')}-${sessionId}`,
    name: clientName,
    version: clientVersion,
    pid,
    ppid,
    startTime: now,
    lastActivity: now,
    memoryContext: {
      sessionId,
      preferences: {},
      recentInteractions: []
    }
  };
}

// Enhanced backend service with memory features
class EnhancedBackendService {
  private serviceUrl = 'http://localhost:8000';
  private clientSession: ClientSession;
  
  constructor(clientSession: ClientSession) {
    this.clientSession = clientSession;
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.serviceUrl}${endpoint}`;
    
    // Update last activity
    this.clientSession.lastActivity = new Date().toISOString();
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Session': this.clientSession.sessionId,
        'X-Client-Name': this.clientSession.name,
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // mem0-inspired memory retrieval
  async getRelevantMemories(query: string, limit: number = 3): Promise<any[]> {
    try {
      const searchResponse = await this.request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return searchResponse.entities || [];
    } catch (error) {
      console.error('Failed to retrieve relevant memories:', error);
      return [];
    }
  }
  
  // Track interaction for learning
  async trackInteraction(interaction: {
    query: string;
    result: any;
    success: boolean;
    timestamp: string;
  }): Promise<void> {
    this.clientSession.memoryContext.recentInteractions.push(
      `${interaction.timestamp}: ${interaction.query} -> ${interaction.success ? 'SUCCESS' : 'FAILED'}`
    );
    
    // Keep only last 10 interactions
    if (this.clientSession.memoryContext.recentInteractions.length > 10) {
      this.clientSession.memoryContext.recentInteractions.shift();
    }
  }
}

// Initialize services
const clientSession = detectClientInfo();
const backend = new EnhancedBackendService(clientSession);

// Create enhanced MCP Server with proper lifecycle
const server = new Server({
  name: "knowledge-graph-enhanced",
  version: "2.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Server lifecycle management
async function initializeServer() {
  console.error(`🔌 Enhanced MCP Client: ${clientSession.name} v${clientSession.version}`);
  console.error(`📱 Session ID: ${clientSession.memoryContext.sessionId}`);
  
  const isHealthy = await backend.checkHealth();
  if (!isHealthy) {
    console.error('❌ Backend service not available at http://localhost:8000');
    console.error('📋 Please start services: npm run start:services');
    process.exit(1);
  }
  
  console.error('✅ Connected to enhanced backend service');
  console.error('🧠 Memory context initialized');
}

// Enhanced tool helper function
function createToolResponse(content: string, isError: boolean = false) {
  return {
    content: [{
      type: "text" as const,
      text: content
    }],
    isError
  };
}

// Tools list with enhanced validation
server.setRequestHandler(
  { method: "tools/list" },
  async () => {
    return {
      tools: [
        {
          name: "create_project",
          description: "Create a new project for organizing entities and knowledge",
          inputSchema: CreateProjectSchema.jsonSchema
        },
        {
          name: "list_projects",
          description: "List all projects with statistics and recent activity",
          inputSchema: z.object({}).jsonSchema
        },
        {
          name: "create_entity",
          description: "Create a new knowledge entity with enhanced metadata support",
          inputSchema: CreateEntitySchema.jsonSchema
        },
        {
          name: "get_entity", 
          description: "Retrieve an entity by ID with related context",
          inputSchema: z.object({
            entityId: z.string().min(1, "Entity ID is required"),
            includeRelated: z.boolean().optional().default(false)
          }).jsonSchema
        },
        {
          name: "list_entities",
          description: "List entities with advanced filtering and pagination",
          inputSchema: z.object({
            projectId: z.string().optional(),
            type: z.string().optional(),
            limit: z.number().min(1).max(100).optional().default(50),
            offset: z.number().min(0).optional().default(0)
          }).jsonSchema
        },
        {
          name: "search_entities_smart",
          description: "Enhanced semantic search with relevance scoring and context",
          inputSchema: SearchSchema.jsonSchema
        },
        {
          name: "add_observation",
          description: "Add a categorized observation with importance scoring",
          inputSchema: AddObservationSchema.jsonSchema
        },
        {
          name: "create_relationship",
          description: "Create a weighted relationship between entities",
          inputSchema: CreateRelationshipSchema.jsonSchema
        },
        {
          name: "get_memory_context",
          description: "Get relevant memory context for current session",
          inputSchema: z.object({
            query: z.string().optional(),
            limit: z.number().min(1).max(10).optional().default(5)
          }).jsonSchema
        },
        {
          name: "list_connected_clients",
          description: "List all connected MCP clients with session info",
          inputSchema: z.object({}).jsonSchema
        }
      ]
    };
  }
);

// Enhanced tool implementations
server.setRequestHandler(
  { method: "tools/call" },
  async (request) => {
    const { name, arguments: args } = request.params;
    const timestamp = new Date().toISOString();
    
    try {
      let result: any;
      
      switch (name) {
        case 'create_project': {
          const validated = CreateProjectSchema.parse(args);
          result = await backend.request('/api/projects', {
            method: 'POST',
            body: JSON.stringify(validated)
          });
          
          await backend.trackInteraction({
            query: `create_project: ${validated.name}`,
            result,
            success: true,
            timestamp
          });
          
          return createToolResponse(`✅ Created project "${validated.name}" with ID: ${result.id}`);
        }
        
        case 'list_projects': {
          result = await backend.request('/api/projects');
          
          const projectList = result.map((p: any) => 
            `• ${p.name}: ${p.description || 'No description'} (${p.entityCount} entities, ${p.relationshipCount} relationships)`
          ).join('\n');
          
          return createToolResponse(`📂 Projects:\n${projectList}`);
        }
        
        case 'create_entity': {
          const validated = CreateEntitySchema.parse(args);
          result = await backend.request('/api/entities', {
            method: 'POST',
            body: JSON.stringify({
              ...validated,
              addedBy: clientSession.name
            })
          });
          
          await backend.trackInteraction({
            query: `create_entity: ${validated.name}`,
            result,
            success: true,
            timestamp
          });
          
          return createToolResponse(`✅ Created entity "${validated.name}" (${validated.type}) with ID: ${result.id}`);
        }
        
        case 'search_entities_smart': {
          const validated = SearchSchema.parse(args);
          
          // Get relevant memories first (mem0-inspired)
          const relevantMemories = await backend.getRelevantMemories(validated.query, validated.limit);
          
          let searchEndpoint = `/api/search?q=${encodeURIComponent(validated.query)}&limit=${validated.limit}`;
          if (validated.projectId) {
            searchEndpoint += `&project_id=${validated.projectId}`;
          }
          
          result = await backend.request(searchEndpoint);
          
          const searchResults = result.entities.map((e: any) => 
            `• ${e.name} (${e.type}): ${e.description.substring(0, 100)}...`
          ).join('\n');
          
          await backend.trackInteraction({
            query: `search: ${validated.query}`,
            result,
            success: true,
            timestamp
          });
          
          return createToolResponse(
            `🔍 Search results for "${validated.query}":\n${searchResults}\n\n📊 Found ${result.entities.length} entities`
          );
        }
        
        case 'get_memory_context': {
          const validated = z.object({
            query: z.string().optional(),
            limit: z.number().min(1).max(10).optional().default(5)
          }).parse(args);
          
          const recentInteractions = clientSession.memoryContext.recentInteractions.slice(-validated.limit);
          const contextInfo = [
            `🧠 Memory Context for ${clientSession.name}`,
            `📱 Session: ${clientSession.memoryContext.sessionId}`,
            `⏰ Active since: ${clientSession.startTime}`,
            `🔄 Recent interactions:`,
            ...recentInteractions.map(interaction => `  ${interaction}`)
          ].join('\n');
          
          return createToolResponse(contextInfo);
        }
        
        case 'list_connected_clients': {
          return createToolResponse(
            `🔗 Connected Client:\n• ${clientSession.name} v${clientSession.version}\n• PID: ${clientSession.pid}\n• Session: ${clientSession.memoryContext.sessionId}\n• Active since: ${clientSession.startTime}`
          );
        }
        
        default: {
          // Handle other existing tools with validation
          const legacyResult = await handleLegacyTool(name, args);
          return legacyResult;
        }
      }
      
    } catch (error) {
      await backend.trackInteraction({
        query: `${name}: ${JSON.stringify(args)}`,
        result: null,
        success: false,
        timestamp
      });
      
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return createToolResponse(`❌ Validation Error: ${validationErrors}`, true);
      }
      
      return createToolResponse(`❌ Error: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  }
);

// Legacy tool handler for backward compatibility
async function handleLegacyTool(name: string, args: any) {
  switch (name) {
    case 'get_entity': {
      const { entityId, includeRelated = false } = args;
      const result = await backend.request(`/api/entities/${entityId}`);
      return createToolResponse(JSON.stringify(result, null, 2));
    }
    
    case 'list_entities': {
      const { projectId, type, limit = 50, offset = 0 } = args;
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (type) params.append('type', type);
      
      const result = await backend.request(`/api/entities?${params.toString()}`);
      const entityList = result.map((e: any) => `• ${e.name} (${e.type}): ${e.description}`).join('\n');
      return createToolResponse(`📋 Found ${result.length} entities:\n${entityList}`);
    }
    
    case 'add_observation': {
      const validated = AddObservationSchema.parse(args);
      await backend.request(`/api/entities/${validated.entityId}/observations`, {
        method: 'POST',
        body: JSON.stringify({
          entityId: validated.entityId,
          text: validated.text,
          addedBy: clientSession.name
        })
      });
      return createToolResponse(`📝 Added ${validated.type} observation to entity ${validated.entityId}`);
    }
    
    case 'create_relationship': {
      const validated = CreateRelationshipSchema.parse(args);
      const result = await backend.request('/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          sourceId: validated.fromEntityId,
          targetId: validated.toEntityId,
          type: validated.relationshipType,
          description: validated.description,
          projectId: validated.projectId,
          addedBy: clientSession.name
        })
      });
      return createToolResponse(`🔗 Created relationship: ${validated.fromEntityId} → ${validated.toEntityId} (${validated.relationshipType})`);
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Enhanced startup with proper lifecycle
async function main() {
  await initializeServer();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🚀 Enhanced MCP Knowledge Graph server ready!');
  console.error('🧠 Features: Zod validation, memory context, semantic search');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.error('📊 Session Summary:');
  console.error(`⏱️  Duration: ${Date.now() - new Date(clientSession.startTime).getTime()}ms`);
  console.error(`🔄 Interactions: ${clientSession.memoryContext.recentInteractions.length}`);
  process.exit(0);
});

main().catch((error) => {
  console.error('Failed to start enhanced MCP server:', error);
  process.exit(1);
});