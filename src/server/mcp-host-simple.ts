#!/usr/bin/env node

/**
 * Simplified MCP Host for Knowledge Graph
 * 
 * This implementation connects to an already running Python backend service
 * instead of trying to start/manage it internally.
 * 
 * Usage:
 * 1. Start backend and frontend: ./scripts/start-services.sh
 * 2. Configure AI apps to use: node dist/src/server/mcp-host-simple.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Types for knowledge graph operations
interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: Array<{
    id: string;
    text: string;
    addedBy: string;
    createdAt: string;
  }>;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
  addedBy: string;
  createdAt: string;
  projectId: string;
}

// Client detection from process info
function detectClientInfo() {
  const pid = process.pid;
  const ppid = process.ppid || 0;
  
  // Try to detect client from parent process or environment
  let clientName = 'Unknown MCP Client';
  let clientVersion = '1.0.0';
  
  try {
    // Check environment variables that different clients might set
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
      // Try to detect from process arguments or parent command
      const args = process.argv.join(' ');
      if (args.includes('claude')) clientName = 'Claude Desktop';
      else if (args.includes('cursor')) clientName = 'Cursor';
      else if (args.includes('cline')) clientName = 'Cline';
      else if (args.includes('continue')) clientName = 'Continue';
    }
  } catch (error) {
    // Fallback to unknown
  }
  
  return {
    id: `${clientName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: clientName,
    version: clientVersion,
    pid,
    ppid,
    detectedAt: new Date().toISOString()
  };
}

// Backend service connection
class BackendService {
  private serviceUrl = 'http://localhost:8000';
  
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
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Initialize services
const backend = new BackendService();
const clientInfo = detectClientInfo();

// Create MCP Server
const server = new Server({
  name: "knowledge-graph",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Check backend health on startup
async function initializeServer() {
  console.error(`🔌 MCP Client detected: ${clientInfo.name} v${clientInfo.version}`);
  
  const isHealthy = await backend.checkHealth();
  if (!isHealthy) {
    console.error('❌ Backend service not available at http://localhost:8000');
    console.error('📋 Please start the backend service first:');
    console.error('   ./scripts/start-services.sh');
    process.exit(1);
  }
  
  console.error('✅ Connected to backend service');
}

// Tool definitions
server.setRequestHandler(
  {
    method: "tools/list"
  },
  async () => {
    return {
      tools: [
      {
        name: "create_entity",
        description: "Create a new entity in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Entity name" },
            type: { type: "string", description: "Entity type (e.g., 'function', 'class', 'concept')" },
            description: { type: "string", description: "Entity description" },
            projectId: { type: "string", description: "Project ID (optional, defaults to 'default')" }
          },
          required: ["name", "type", "description"]
        }
      },
      {
        name: "get_entity",
        description: "Retrieve an entity by ID",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "Entity ID" }
          },
          required: ["entityId"]
        }
      },
      {
        name: "list_entities",
        description: "List entities with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID to filter by" },
            type: { type: "string", description: "Entity type to filter by" },
            limit: { type: "number", description: "Maximum number of entities to return" }
          }
        }
      },
      {
        name: "search_entities",
        description: "Search entities using semantic search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            projectId: { type: "string", description: "Project ID to search within" },
            limit: { type: "number", description: "Maximum number of results" }
          },
          required: ["query"]
        }
      },
      {
        name: "add_observation",
        description: "Add an observation/note to an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "Entity ID" },
            text: { type: "string", description: "Observation text" }
          },
          required: ["entityId", "text"]
        }
      },
      {
        name: "create_relationship",
        description: "Create a relationship between two entities",
        inputSchema: {
          type: "object",
          properties: {
            fromEntityId: { type: "string", description: "Source entity ID" },
            toEntityId: { type: "string", description: "Target entity ID" },
            relationshipType: { type: "string", description: "Type of relationship" },
            description: { type: "string", description: "Relationship description" }
          },
          required: ["fromEntityId", "toEntityId", "relationshipType"]
        }
      },
      {
        name: "create_project",
        description: "Create a new project for organizing entities",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" }
          },
          required: ["name"]
        }
      },
      {
        name: "list_projects",
        description: "List all projects",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "list_connected_clients",
        description: "List all connected MCP clients",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
    };
  }
);

// Tool implementations
server.setRequestHandler(
  {
    method: "tools/call"
  },
  async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
    switch (name) {
      case 'create_entity': {
        const { name, type, description, projectId = 'default' } = args as any;
        const result = await backend.request('/api/entities', {
          method: 'POST',
          body: JSON.stringify({
            name,
            type,
            description,
            projectId,
            addedBy: clientInfo.name
          })
        });
        return {
          content: [{
            type: "text",
            text: `Created entity "${name}" with ID: ${result.id}`
          }]
        };
      }
      
      case 'get_entity': {
        const { entityId } = args as any;
        const result = await backend.request(`/api/entities/${entityId}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'list_entities': {
        const { projectId, type, limit = 50 } = args as any;
        let endpoint = `/api/entities?`;
        const params = new URLSearchParams();
        if (projectId) params.append('project_id', projectId);
        if (type) params.append('type', type);
        
        const result = await backend.request(endpoint + params.toString());
        return {
          content: [{
            type: "text",
            text: `Found ${result.length} entities:\n${result.map((e: Entity) => `- ${e.name} (${e.type}): ${e.description}`).join('\n')}`
          }]
        };
      }
      
      case 'search_entities': {
        const { query, limit = 10 } = args as any;
        const result = await backend.request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        return {
          content: [{
            type: "text",
            text: `Search results for "${query}":\n${result.entities.map((e: Entity) => `- ${e.name} (${e.type}): ${e.description}`).join('\n')}`
          }]
        };
      }
      
      case 'add_observation': {
        const { entityId, text } = args as any;
        await backend.request(`/api/entities/${entityId}/observations`, {
          method: 'POST',
          body: JSON.stringify({
            entityId,
            text,
            addedBy: clientInfo.name
          })
        });
        return {
          content: [{
            type: "text",
            text: `Added observation to entity ${entityId}`
          }]
        };
      }
      
      case 'create_relationship': {
        const { fromEntityId, toEntityId, relationshipType, description, projectId = 'default' } = args as any;
        const result = await backend.request('/api/relationships', {
          method: 'POST',
          body: JSON.stringify({
            sourceId: fromEntityId,
            targetId: toEntityId,
            type: relationshipType,
            description,
            projectId,
            addedBy: clientInfo.name
          })
        });
        return {
          content: [{
            type: "text",
            text: `Created relationship: ${fromEntityId} → ${toEntityId} (${relationshipType})`
          }]
        };
      }
      
      case 'create_project': {
        const { name, description } = args as any;
        const result = await backend.request('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            description
          })
        });
        return {
          content: [{
            type: "text",
            text: `Created project "${name}" with ID: ${result.id}`
          }]
        };
      }
      
      case 'list_projects': {
        const result = await backend.request('/api/projects');
        return {
          content: [{
            type: "text",
            text: `Projects:\n${result.map((p: any) => `- ${p.name}: ${p.description || 'No description'} (${p.entityCount} entities, ${p.relationshipCount} relationships)`).join('\n')}`
          }]
        };
      }
      
      case 'list_connected_clients': {
        return {
          content: [{
            type: "text",
            text: `Connected client: ${clientInfo.name} v${clientInfo.version} (PID: ${clientInfo.pid})`
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Start server
async function main() {
  await initializeServer();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🎯 MCP Knowledge Graph server ready!');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

