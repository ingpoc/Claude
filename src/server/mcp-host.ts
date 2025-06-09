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
  InitializeRequestSchema,
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

// Client information captured from MCP initialize
let clientInfo = {
  name: 'unknown',
  version: 'unknown'
};

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
  const isHealthy = await backend.checkHealth();
  if (!isHealthy) {
    console.error('❌ Backend service not available at http://localhost:8000');
    console.error('🔧 Please start services: npm run start:services');
    process.exit(1);
  }
  
  console.error('✅ Connected to backend service');
}

// Initialize handler - captures client information from MCP protocol
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  const { params } = request;
  
  // Capture client info from the initialize request
  if (params.clientInfo) {
    clientInfo.name = params.clientInfo.name || 'unknown';
    clientInfo.version = params.clientInfo.version || 'unknown';
  }
  
  console.error(`🔌 MCP Client Connected: ${clientInfo.name} v${clientInfo.version}`);
  
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "knowledge-graph",
      version: "1.0.0"
    }
  };
});

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
        name: "list_entities",
        description: "List all entities, optionally filtered by type or project",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Filter by entity type (optional)" },
            projectId: { type: "string", description: "Filter by project ID (optional)" }
          },
          required: []
        }
      },
      {
        name: "find_related_entities",
        description: "Find entities related to a specific entity through relationships",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "ID of the entity to find relationships for" },
            direction: { type: "string", enum: ["outgoing", "incoming", "both"], description: "Direction of relationships to follow (default: both)" },
            relationshipType: { type: "string", description: "Filter by specific relationship type (optional)" },
            depth: { type: "number", description: "Depth of traversal (1-3, default: 1)" },
            projectId: { type: "string", description: "Filter by project ID (optional)" }
          },
          required: ["entityId"]
        }
      },
      {
        name: "list_relationships",
        description: "List relationships with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Filter by project ID (optional)" },
            relationshipType: { type: "string", description: "Filter by relationship type (optional)" },
            entityId: { type: "string", description: "Filter relationships involving specific entity (optional)" }
          },
          required: []
        }
      },
      {
        name: "search_observations",
        description: "Search for observations across all entities",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for observation content" },
            limit: { type: "number", description: "Maximum number of results (default: 10)" },
            projectId: { type: "string", description: "Filter by project ID (optional)" },
            entityId: { type: "string", description: "Filter by specific entity ID (optional)" },
            addedBy: { type: "string", description: "Filter by who added the observation (optional)" }
          },
          required: ["query"]
        }
      },
      {
        name: "update_entity",
        description: "Update an existing entity's properties",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "ID of the entity to update" },
            name: { type: "string", description: "New name for the entity (optional)" },
            type: { type: "string", description: "New type for the entity (optional)" },
            description: { type: "string", description: "New description for the entity (optional)" },
            projectId: { type: "string", description: "Move entity to different project (optional)" }
          },
          required: ["entityId"]
        }
      },
      {
        name: "get_analytics",
        description: "Get comprehensive analytics and statistics for the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Get analytics for specific project (optional)" },
            includeDetails: { type: "boolean", description: "Include detailed breakdowns (default: false)" }
          },
          required: []
        }
      },
      {
        name: "add_observation",
        description: "Add an observation to an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "ID of the entity to add observation to" },
            text: { type: "string", description: "The observation text" },
            projectId: { type: "string", description: "Project ID (optional)" }
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
        
        const searchResponse = await backend.request(`/api/search?${searchParams}`);
        const searchResults = searchResponse.entities || searchResponse || [];
        
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

      case "list_entities":
        const listParams = new URLSearchParams();
        
        if (args.type) {
          listParams.set('type', String(args.type));
        }
        
        if (args.projectId) {
          listParams.set('project_id', String(args.projectId));
        }
        
        const entitiesList = await backend.request(`/api/entities?${listParams}`);
        
        if (entitiesList.length === 0) {
          const filterText = args.type || args.projectId ? 
            ` (filtered by ${args.type ? `type: ${args.type}` : ''}${args.type && args.projectId ? ', ' : ''}${args.projectId ? `project: ${args.projectId}` : ''})` : '';
          
          return {
            content: [
              {
                type: "text",
                text: `📋 No entities found${filterText}`
              }
            ]
          };
        }
        
        const formattedEntities = entitiesList.map((entity: any, index: number) => 
          `${index + 1}. **${entity.name}** (${entity.type})\n   ${entity.description}\n   ID: ${entity.id}\n   Project: ${entity.projectId}`
        ).join('\n\n');
        
        const filterText = args.type || args.projectId ? 
          ` (filtered by ${args.type ? `type: ${args.type}` : ''}${args.type && args.projectId ? ', ' : ''}${args.projectId ? `project: ${args.projectId}` : ''})` : '';
        
        return {
          content: [
            {
              type: "text",
              text: `📋 Found ${entitiesList.length} entities${filterText}:\n\n${formattedEntities}`
            }
          ]
        };

      case "find_related_entities":
        const relatedParams = new URLSearchParams();
        
        if (args.direction) {
          relatedParams.set('direction', String(args.direction));
        }
        
        if (args.relationshipType) {
          relatedParams.set('relationship_type', String(args.relationshipType));
        }
        
        if (args.depth) {
          relatedParams.set('depth', String(args.depth));
        }
        
        if (args.projectId) {
          relatedParams.set('project_id', String(args.projectId));
        }
        
        const relatedEntities = await backend.request(`/api/entities/${args.entityId}/related?${relatedParams}`);
        
        if (relatedEntities.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `🔗 No related entities found for entity ${args.entityId}`
              }
            ]
          };
        }
        
        const formattedRelated = relatedEntities.map((item: any, index: number) => {
          const entity = item.entity;
          const relationship = item.relationship;
          const direction = item.direction;
          
          return `${index + 1}. **${entity.name}** (${entity.type})\n   ${entity.description}\n   🔗 ${direction} via "${relationship.type}": ${relationship.description || 'No description'}\n   Entity ID: ${entity.id}`;
        }).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🔗 Found ${relatedEntities.length} related entities:\n\n${formattedRelated}`
            }
          ]
        };

      case "list_relationships":
        const relationshipParams = new URLSearchParams();
        
        if (args.projectId) {
          relationshipParams.set('project_id', String(args.projectId));
        }
        
        if (args.relationshipType) {
          relationshipParams.set('type', String(args.relationshipType));
        }
        
        if (args.entityId) {
          relationshipParams.set('entity_id', String(args.entityId));
        }
        
        const relationships = await backend.request(`/api/relationships?${relationshipParams}`);
        
        if (relationships.length === 0) {
          const filterText = args.projectId || args.relationshipType || args.entityId ? 
            ' (with current filters)' : '';
          
          return {
            content: [
              {
                type: "text",
                text: `🔗 No relationships found${filterText}`
              }
            ]
          };
        }
        
        const formattedRelationships = relationships.map((rel: any, index: number) => 
          `${index + 1}. **${rel.type}**\n   From: ${rel.sourceId}\n   To: ${rel.targetId}\n   Description: ${rel.description || 'No description'}\n   Project: ${rel.projectId}\n   ID: ${rel.id}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🔗 Found ${relationships.length} relationships:\n\n${formattedRelationships}`
            }
          ]
        };

      case "search_observations":
        const obsSearchParams = new URLSearchParams({
          q: String(args.query || ''),
          limit: String(args.limit || 10)
        });
        
        if (args.projectId) {
          obsSearchParams.set('project_id', String(args.projectId));
        }
        
        if (args.entityId) {
          obsSearchParams.set('entity_id', String(args.entityId));
        }
        
        if (args.addedBy) {
          obsSearchParams.set('added_by', String(args.addedBy));
        }
        
        const observationResults = await backend.request(`/api/observations/search?${obsSearchParams}`);
        
        if (observationResults.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `📝 No observations found for query: "${args.query}"`
              }
            ]
          };
        }
        
        const formattedObservations = observationResults.map((obs: any, index: number) => 
          `${index + 1}. **Entity**: ${obs.entity_name} (${obs.entity_type})\n   **Observation**: ${obs.text}\n   **Added by**: ${obs.addedBy} on ${obs.createdAt}\n   **Entity ID**: ${obs.entityId}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: "text",
              text: `📝 Found ${observationResults.length} observations:\n\n${formattedObservations}`
            }
          ]
        };

      case "update_entity":
        const updateData: any = {};
        
        // Only include fields that are provided
        if (args.name !== undefined) updateData.name = args.name;
        if (args.type !== undefined) updateData.type = args.type;
        if (args.description !== undefined) updateData.description = args.description;
        if (args.projectId !== undefined) updateData.projectId = args.projectId;
        
        if (Object.keys(updateData).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "❌ No update fields provided. Please specify at least one field to update."
              }
            ]
          };
        }
        
        const updatedEntity = await backend.request(`/api/entities/${args.entityId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
        
        const changedFields = Object.keys(updateData).join(', ');
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Updated entity: ${updatedEntity.name} (${updatedEntity.type})\nID: ${updatedEntity.id}\nUpdated fields: ${changedFields}\nProject: ${updatedEntity.projectId}`
            }
          ]
        };

      case "get_analytics":
        const analyticsParams = new URLSearchParams();
        
        if (args.projectId) {
          analyticsParams.set('project_id', String(args.projectId));
        }
        
        if (args.includeDetails) {
          analyticsParams.set('include_details', String(args.includeDetails));
        }
        
        const analytics = await backend.request(`/api/analytics?${analyticsParams}`);
        
        let analyticsText = `📊 **Knowledge Graph Analytics**\n\n`;
        analyticsText += `📈 **Summary Statistics:**\n`;
        analyticsText += `   • Total Entities: ${analytics.total_entities}\n`;
        analyticsText += `   • Total Relationships: ${analytics.total_relationships}\n`;
        analyticsText += `   • Total Observations: ${analytics.total_observations}\n`;
        analyticsText += `   • Total Projects: ${analytics.total_projects}\n\n`;
        
        if (analytics.entity_types && Object.keys(analytics.entity_types).length > 0) {
          analyticsText += `🏷️ **Entity Types:**\n`;
          for (const [type, count] of Object.entries(analytics.entity_types)) {
            analyticsText += `   • ${type}: ${count}\n`;
          }
          analyticsText += `\n`;
        }
        
        if (analytics.relationship_types && Object.keys(analytics.relationship_types).length > 0) {
          analyticsText += `🔗 **Relationship Types:**\n`;
          for (const [type, count] of Object.entries(analytics.relationship_types)) {
            analyticsText += `   • ${type}: ${count}\n`;
          }
          analyticsText += `\n`;
        }
        
        if (analytics.project_stats && analytics.project_stats.length > 0) {
          analyticsText += `📁 **Project Statistics:**\n`;
          for (const project of analytics.project_stats) {
            analyticsText += `   • **${project.name}**: ${project.entity_count} entities, ${project.relationship_count} relationships\n`;
          }
          analyticsText += `\n`;
        }
        
        if (analytics.top_contributors && analytics.top_contributors.length > 0) {
          analyticsText += `👥 **Top Contributors:**\n`;
          for (const contributor of analytics.top_contributors) {
            analyticsText += `   • ${contributor.name}: ${contributor.entities} entities, ${contributor.observations} observations\n`;
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: analyticsText
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