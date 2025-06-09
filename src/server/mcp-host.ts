#!/usr/bin/env node

/**
 * MCP Knowledge Graph Server
 * 
 * Production MCP server for knowledge graph operations with memvid integration.
 * Connects to Python backend service for all storage and AI operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Types
interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  projectId: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

// Client detection
function detectClientInfo() {
  const processName = process.env.MCP_CLIENT_NAME || 'unknown';
  return {
    name: processName,
    version: '1.0.0'
  };
}

// Backend service
class BackendService {
  private baseUrl = 'http://localhost:8000';
  
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
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
  
  async checkHealth() {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Initialize
const backend = new BackendService();
const clientInfo = detectClientInfo();

const server = new Server({
  name: "knowledge-graph",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Health check
async function initializeServer() {
  console.error(`🔌 MCP Client: ${clientInfo.name} v${clientInfo.version}`);
  
  const isHealthy = await backend.checkHealth();
  if (!isHealthy) {
    console.error('❌ Backend service not available at http://localhost:8000');
    console.error('🔧 Please start services: npm run start:services');
    process.exit(1);
  }
  
  console.error('✅ Connected to backend service');
}

// Tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_entity",
        description: "Create a new entity in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the entity" },
            type: { type: "string", description: "Type/category of the entity" },
            description: { type: "string", description: "Description of the entity" },
            projectId: { type: "string", description: "Project ID (optional, defaults to 'default')" }
          },
          required: ["name", "type", "description"]
        }
      },
      {
        name: "search_entities",
        description: "Search for entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Maximum number of results (default: 10)" },
            projectId: { type: "string", description: "Project ID to search within (optional)" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_entity",
        description: "Get a specific entity by ID",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "ID of the entity to retrieve" }
          },
          required: ["entityId"]
        }
      },
      {
        name: "create_relationship",
        description: "Create a relationship between two entities",
        inputSchema: {
          type: "object",
          properties: {
            sourceId: { type: "string", description: "ID of the source entity" },
            targetId: { type: "string", description: "ID of the target entity" },
            type: { type: "string", description: "Type of relationship" },
            description: { type: "string", description: "Description of the relationship" },
            projectId: { type: "string", description: "Project ID (optional)" }
          },
          required: ["sourceId", "targetId", "type"]
        }
      },
      {
        name: "list_projects",
        description: "List all available projects",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "create_project",
        description: "Create a new project",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Description of the project" }
          },
          required: ["name", "description"]
        }
      },
      {
        name: "add_observation",
        description: "Add an observation to an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "ID of the entity to add observation to" },
            text: { type: "string", description: "The observation text" }
          },
          required: ["entityId", "text"]
        }
      }
    ]
  };
});

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error("Missing arguments in tool call");
  }
  
  try {
    switch (name) {
      case "create_entity":
        const entityResponse = await backend.request('/api/entities', {
          method: 'POST',
          body: JSON.stringify({
            ...args,
            addedBy: clientInfo.name,
            projectId: args.projectId || 'default'
          })
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Created entity: ${entityResponse.name} (${entityResponse.type})\nID: ${entityResponse.id}\nProject: ${entityResponse.projectId}`
            }
          ]
        };

      case "search_entities":
        const searchParams = new URLSearchParams({
          q: String(args.query || ''),
          limit: String(args.limit || 10)
        });
        
        if (args.projectId) {
          searchParams.set('project_id', String(args.projectId));
        }
        
        const searchResults = await backend.request(`/api/search?${searchParams}`);
        
        if (searchResults.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `🔍 No entities found for query: "${args.query}"`
              }
            ]
          };
        }
        
        const formattedResults = searchResults.map((entity: any, index: number) => 
          `${index + 1}. **${entity.name}** (${entity.type})\n   ${entity.description}\n   ID: ${entity.id}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🔍 Found ${searchResults.length} entities:\n\n${formattedResults}`
            }
          ]
        };

      case "get_entity":
        const entity = await backend.request(`/api/entities/${args.entityId}`);
        
        let observationsText = '';
        if (entity.observations && entity.observations.length > 0) {
          observationsText = `\n\n**Observations (${entity.observations.length}):**\n` + 
            entity.observations.map((obs: any, index: number) => 
              `${index + 1}. ${obs.text} (by ${obs.addedBy} at ${obs.createdAt})`
            ).join('\n');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `📋 **${entity.name}** (${entity.type})\n\n${entity.description}\n\nID: ${entity.id}\nProject: ${entity.projectId}\nCreated: ${entity.createdAt}\nAdded by: ${entity.addedBy}${observationsText}`
            }
          ]
        };

      case "create_relationship":
        const relationshipResponse = await backend.request('/api/relationships', {
          method: 'POST',
          body: JSON.stringify({
            ...args,
            addedBy: clientInfo.name,
            projectId: args.projectId || 'default'
          })
        });
        
        return {
          content: [
            {
              type: "text",
              text: `🔗 Created relationship: ${relationshipResponse.type}\nFrom: ${relationshipResponse.sourceId}\nTo: ${relationshipResponse.targetId}\nID: ${relationshipResponse.id}`
            }
          ]
        };

      case "list_projects":
        const projects = await backend.request('/api/projects');
        
        if (projects.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "📁 No projects found"
              }
            ]
          };
        }
        
        const formattedProjects = projects.map((project: any) => 
          `• **${project.name}** (${project.id})\n  ${project.description}\n  Created: ${project.createdAt}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `📁 Projects (${projects.length}):\n\n${formattedProjects}`
            }
          ]
        };

      case "create_project":
        const projectResponse = await backend.request('/api/projects', {
          method: 'POST',
          body: JSON.stringify(args)
        });
        
        return {
          content: [
            {
              type: "text",
              text: `📁 Created project: ${projectResponse.name}\nID: ${projectResponse.id}\nDescription: ${projectResponse.description}`
            }
          ]
        };

      case "add_observation":
        const observationResponse = await backend.request(`/api/entities/${args.entityId}/observations`, {
          method: 'POST',
          body: JSON.stringify({
            entityId: args.entityId,
            text: args.text,
            addedBy: clientInfo.name
          })
        });
        
        return {
          content: [
            {
              type: "text",
              text: `📝 Added observation to entity ${args.entityId}\nObservation ID: ${observationResponse.observation_id || observationResponse.id || 'success'}`
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Error executing ${name}: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  await initializeServer();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🚀 MCP Knowledge Graph server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});