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
  PingRequestSchema,
  ListResourcesRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { SessionManager, SessionData } from "./utils/SessionManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Global session state - tracks the current active session per client
let currentSessionId: string | null = null;

// Backend service
class BackendService {
  private baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  
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
      await this.request('/');
      return true;
    } catch {
      return false;
    }
  }
}

// Initialize
const backend = new BackendService();
const sessionManager = new SessionManager();

const server = new Server(
  {
    name: "knowledge-graph",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      tools: {},
      resources: {},
    },
  },
);

// Health check
async function initializeServer() {
  // Allow skipping the backend health check when running inside Cursor or CI
  if (process.env.SKIP_HEALTH_CHECK === "1") {
    console.error("⚠️  Skipping backend health check (SKIP_HEALTH_CHECK=1)");
    return;
  }

  const isHealthy = await backend.checkHealth();
  if (!isHealthy) {
    console.error("❌ Backend service not available at http://localhost:8000");
    console.error("🔧 Please start services: npm run start:services or set SKIP_HEALTH_CHECK=1");
    process.exit(1);
  }

  console.error("✅ Connected to backend service");
}

// ----------------------------------------------------------------------------
// Session persistence helpers
// ----------------------------------------------------------------------------

const SESSIONS_DIR = path.join(__dirname, "..", "..", ".mcp-sessions");
const SESSION_TTL_DAYS = 7;

async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

interface SessionRecord {
  sessionId: string;
  createdAt: string;
  lastSeen: string;
  clientInfo: typeof clientInfo;
}

async function loadSession(sessionId: string): Promise<SessionRecord | null> {
  try {
    const p = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

async function saveSession(record: SessionRecord) {
  const p = path.join(SESSIONS_DIR, `${record.sessionId}.json`);
  await fs.writeFile(p, JSON.stringify(record, null, 2), "utf8");
}

async function cleanupExpiredSessions() {
  try {
    const entries = await fs.readdir(SESSIONS_DIR);
    const now = Date.now();
    const ttlMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
    await Promise.all(entries.map(async (file) => {
      if (!file.endsWith(".json")) return;
      const p = path.join(SESSIONS_DIR, file);
      try {
        const stat = await fs.stat(p);
        if (now - stat.mtimeMs > ttlMs) {
          await fs.unlink(p);
        }
      } catch {
        /* ignore */
      }
    }));
  } catch {
    // ignore
  }
}

await ensureSessionsDir();
await cleanupExpiredSessions();

// Initialize handler - captures client information from MCP protocol
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  const { params } = request;
  
  console.error(`📡 MCP Initialize request received`);
  console.error(`📡 Client info: ${JSON.stringify(params.clientInfo)}`);

  // Skip health check during initialization to avoid connection issues
  console.error(`📡 Skipping health check during initialization for better Cursor compatibility`);

  // Session handling
  let sessionId: string;
  if (params.sessionInfo && (params.sessionInfo as any).sessionId) {
    sessionId = (params.sessionInfo as any).sessionId as string;
  } else {
    sessionId = randomUUID();
  }

  // Capture client info
  if (params.clientInfo) {
    clientInfo.name = params.clientInfo.name || "unknown";
    clientInfo.version = params.clientInfo.version || "unknown";
  }

  const nowIso = new Date().toISOString();
  await saveSession({
    sessionId,
    createdAt: nowIso,
    lastSeen: nowIso,
    clientInfo: { ...clientInfo },
  });

  console.error(`🔌 MCP Client Connected: ${clientInfo.name} v${clientInfo.version} – session ${sessionId}`);

  const response = {
    protocolVersion: "2024-11-05",
    capabilities: {
      logging: {},
      resources: { listChanged: true, subscribe: false },
      tools: { 
        listChanged: true,
        tools: TOOL_DESCRIPTORS
      },
    },
    serverInfo: {
      name: "knowledge-graph",
      version: "1.0.0",
    },
    sessionInfo: {
      sessionId,
      resumeSupported: true,
    },
  };
  
  console.error(`📡 Sending initialize response: ${JSON.stringify(response)}`);
  return response;
});

// Ping handler (optional utility as per MCP spec)
try {
  server.setRequestHandler(PingRequestSchema, async () => ({}));
} catch {
  // If schema is not available in current SDK version, silently ignore
}

// Resources list handler – expose Memvid index JSON
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const indexPath = process.env.MEMVID_INDEX_PATH || path.join(process.cwd(), "python-service/shared_knowledge/knowledge_graph_index.json");

  return {
    resources: [
      {
        uri: `file://${indexPath}`,
        name: "Memvid Index",
        mimeType: "application/json",
      },
    ],
  };
});

// ----------------------------------------------------------------------------
// Tool descriptors (single source of truth)
// ----------------------------------------------------------------------------

export const TOOL_DESCRIPTORS = [
  {
    name: "init_session",
    description: "Initialize session with project context - REQUIRED FIRST STEP",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID to initialize (optional, defaults to 'default')"
        },
        codebaseIdentifier: {
          type: "string", 
          description: "Optional codebase identifier for context"
        }
      },
    },
  },
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
      required: ["name", "type", "description"],
    },
  },
  {
    name: "search_entities",
    description: "Search for entities in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Maximum number of results (default: 10)" },
        projectId: { type: "string", description: "Project ID to search within (optional)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_entity",
    description: "Get detailed information about a specific entity",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "ID of the entity to retrieve" }
      },
      required: ["entityId"],
    },
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
        projectId: { type: "string", description: "Project ID (optional, defaults to 'default')" }
      },
      required: ["sourceId", "targetId", "type"],
    },
  },
  {
    name: "list_projects",
    description: "List all projects in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {},
    },
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
      required: ["name", "description"],
    },
  },
  {
    name: "list_entities",
    description: "List entities with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by entity type (optional)" },
        projectId: { type: "string", description: "Filter by project ID (optional)" }
      },
    },
  },
  {
    name: "find_related_entities",
    description: "Find entities related to a specific entity",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "ID of the entity to find relationships for" },
        direction: { type: "string", description: "Direction: incoming, outgoing, or both (optional)" },
        relationshipType: { type: "string", description: "Filter by relationship type (optional)" },
        depth: { type: "number", description: "Depth of traversal (optional, default: 1)" },
        projectId: { type: "string", description: "Filter by project ID (optional)" }
      },
      required: ["entityId"],
    },
  },
  {
    name: "list_relationships",
    description: "List relationships with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Filter by project ID (optional)" },
        relationshipType: { type: "string", description: "Filter by relationship type (optional)" },
        entityId: { type: "string", description: "Filter by entity ID (optional)" }
      },
    },
  },
  {
    name: "search_observations",
    description: "Search observations with various filters",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Maximum number of results (default: 10)" },
        projectId: { type: "string", description: "Filter by project ID (optional)" },
        entityId: { type: "string", description: "Filter by entity ID (optional)" },
        addedBy: { type: "string", description: "Filter by contributor (optional)" }
      },
      required: ["query"],
    },
  },
  {
    name: "update_entity",
    description: "Update an existing entity",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "ID of the entity to update" },
        name: { type: "string", description: "New name (optional)" },
        type: { type: "string", description: "New type (optional)" },
        description: { type: "string", description: "New description (optional)" },
        projectId: { type: "string", description: "New project ID (optional)" }
      },
      required: ["entityId"],
    },
  },
  {
    name: "get_analytics",
    description: "Get analytics and statistics about the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Filter by project ID (optional)" },
        includeDetails: { type: "boolean", description: "Include detailed statistics (optional)" }
      },
    },
  },
  {
    name: "add_observation",
    description: "Add an observation to an entity",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "ID of the entity to add observation to" },
        text: { type: "string", description: "Observation text" }
      },
      required: ["entityId", "text"],
    },
  },
];

// Tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DESCRIPTORS,
  };
});

// Utility to emit streaming chunks for long-running tool calls (M2)
async function emitToolStreamChunk(text: string, isFinal: boolean = false) {
  // Skip streaming for compatibility - just log for now
  console.error(`📡 Stream chunk: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
}

// Helper function to check if session is required
function requiresSession(toolName: string): boolean {
  const sessionRequiredTools = [
    'create_entity', 'search_entities', 'get_entity', 'create_relationship',
    'list_entities', 'find_related_entities', 'list_relationships', 
    'search_observations', 'update_entity', 'add_observation'
  ];
  return sessionRequiredTools.includes(toolName);
}

// Helper function to get current session or create error response
function getCurrentSession(): { session: any, error?: any } {
  if (!currentSessionId || !sessionManager.isValidSession(currentSessionId)) {
    return {
      session: null,
      error: {
        content: [{ 
          type: "text", 
          text: "❌ Session initialization required. Please call 'init_session' first to establish project context."
        }],
        isError: true
      }
    };
  }
  
  const session = sessionManager.getSession(currentSessionId);
  return { session };
}

// Helper function to create tool responses with session context
function createToolResponse(content: string, sessionId?: string, isError = false) {
  const sessionToUse = sessionId || currentSessionId;
  const baseResponse = {
    content: [{ type: "text", text: content }],
    isError
  };
  
  if (sessionToUse) {
    const session = sessionManager.getSession(sessionToUse);
    if (session) {
      (baseResponse as any).sessionContext = {
        sessionId: session.id,
        projectId: session.projectId,
        entityCount: session.contextEntities.length,
        lastAccessed: session.lastAccessed.toISOString()
      };
    }
  }
  
  return baseResponse;
}

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error("Missing arguments in tool call");
  }
  
  // Check if session is required but not available
  if (requiresSession(name)) {
    const { session, error } = getCurrentSession();
    if (error) {
      return error;
    }
  }
  
  try {
    switch (name) {
      case "init_session":
        const initProjectId = (args as any).projectId || 'default';
        const codebaseIdentifier = (args as any).codebaseIdentifier;
        
        // Check if project exists in backend
        let projectExists = false;
        try {
          const projects = await backend.request('/api/projects');
          projectExists = projects.some((p: any) => p.id === initProjectId);
        } catch (error) {
          console.error('Failed to check existing projects:', error);
        }
        
        // Create project if it doesn't exist and get the actual project ID
        let actualProjectId = initProjectId;
        if (!projectExists && initProjectId !== 'default') {
          try {
            const createdProject = await backend.request('/api/projects', {
              method: 'POST',
              body: JSON.stringify({
                name: initProjectId,
                description: `Auto-created project for ${codebaseIdentifier || 'MCP session'}`
              })
            });
            actualProjectId = createdProject.id; // Use the UUID returned by backend
            console.error(`📁 Auto-created project: ${initProjectId} with ID: ${actualProjectId}`);
          } catch (error) {
            console.error('Failed to create project:', error);
            // If creation fails, try to find existing project by name
            try {
              const projects = await backend.request('/api/projects');
              const existingProject = projects.find((p: any) => p.name === initProjectId);
              if (existingProject) {
                actualProjectId = existingProject.id;
                console.error(`📁 Found existing project: ${initProjectId} with ID: ${actualProjectId}`);
              }
            } catch (findError) {
              console.error('Failed to find existing project:', findError);
            }
          }
        } else if (projectExists) {
          // Find the actual project ID for existing projects
          try {
            const projects = await backend.request('/api/projects');
            const existingProject = projects.find((p: any) => p.id === initProjectId || p.name === initProjectId);
            if (existingProject) {
              actualProjectId = existingProject.id;
            }
          } catch (findError) {
            console.error('Failed to find project ID:', findError);
          }
        }
        
        // Create session and set as current with the actual project ID
        const sessionId = sessionManager.createSession(actualProjectId, clientInfo);
        currentSessionId = sessionId;
        
        // Get project stats for context
        let projectStats = { entities: 0, relationships: 0 };
        try {
          const analytics = await backend.request('/api/analytics?project_id=' + actualProjectId);
          projectStats.entities = analytics.total_entities || 0;
          projectStats.relationships = analytics.total_relationships || 0;
        } catch (error) {
          console.error('Failed to get project stats:', error);
        }
        
        return createToolResponse(
          `✅ Session initialized successfully!\n\n` +
          `📋 **Session Details:**\n` +
          `   • Session ID: ${sessionId}\n` +
          `   • Project: ${initProjectId} (ID: ${actualProjectId})\n` +
          `   • Current Entities: ${projectStats.entities}\n` +
          `   • Current Relationships: ${projectStats.relationships}\n\n` +
          `🔧 **Ready for Operations:**\n` +
          `   • Session is now active for all subsequent tool calls\n` +
          `   • Use search_entities to explore existing knowledge\n` +
          `   • Use create_entity to add new information\n` +
          `   • All operations will automatically use this session context`,
          sessionId
        );

      case "create_entity":
        const { session: createSession } = getCurrentSession();
        
        const entityResponse = await backend.request('/api/entities', {
          method: 'POST',
          body: JSON.stringify({
            ...args,
            addedBy: createSession?.clientInfo.name || clientInfo.name,
            projectId: createSession?.projectId || 'default'
          })
        });
        
        // Add entity to session context
        if (currentSessionId) {
          sessionManager.addEntityToContext(currentSessionId, entityResponse.id);
        }
        
        return createToolResponse(
          `✅ Created entity: ${entityResponse.name} (${entityResponse.type})\nID: ${entityResponse.id}\nProject: ${entityResponse.projectId}`
        );

      case "search_entities":
        const { session: searchSession } = getCurrentSession();
        
        const searchParams = new URLSearchParams({
          q: String((args as any).query || ''),
          limit: String((args as any).limit || 10)
        });
        
        // Use session project if not specified
        const searchProjectId = (args as any).projectId || searchSession?.projectId;
        if (searchProjectId) {
          searchParams.set('project_id', String(searchProjectId));
        }
        
        const searchResponse = await backend.request(`/api/search?${searchParams}`);
        const searchResults = searchResponse.entities || searchResponse || [];
        
        if (searchResults.length === 0) {
          return createToolResponse(
            `🔍 No entities found for query: "${(args as any).query}" in project: ${searchProjectId}`
          );
        }
        
        // Format results
        const formattedResults = searchResults.slice(0, 10).map((entity: any, index: number) =>
          `${index + 1}. **${entity.name}** (${entity.type})\n   ${entity.description}\n   ID: ${entity.id}`
        ).join('\n\n');
        
        return createToolResponse(
          `🔍 Found ${searchResults.length} entities for "${(args as any).query}":\n\n${formattedResults}`
        );

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
        
        // Stream entities in chunks
        const ENT_CHUNK_SIZE = 5;
        for (let i = 0; i < entitiesList.length; i += ENT_CHUNK_SIZE) {
          const slice = entitiesList.slice(i, i + ENT_CHUNK_SIZE);
          const chunkText = slice.map((entity: any, index: number) =>
            `${i + index + 1}. **${entity.name}** (${entity.type})\n   ${entity.description}\n   ID: ${entity.id}\n   Project: ${entity.projectId}`
          ).join('\n\n');
          await emitToolStreamChunk(chunkText, false);
        }
        await emitToolStreamChunk('🔚 End of results', true);
        
        const filterText = args.type || args.projectId ? 
          ` (filtered by ${args.type ? `type: ${args.type}` : ''}${args.type && args.projectId ? ', ' : ''}${args.projectId ? `project: ${args.projectId}` : ''})` : '';
        
        return {
          content: [
            {
              type: "text",
              text: `📋 Streaming ${entitiesList.length} entities${filterText} finished.`
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
          const relFilter = args.projectId || args.relationshipType || args.entityId ? 
            ' (with current filters)' : '';
          
          return {
            content: [
              {
                type: "text",
                text: `🔗 No relationships found${relFilter}`
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
        if (args.projectId) analyticsParams.set('project_id', String(args.projectId));
        if (args.includeDetails) analyticsParams.set('include_details', String(args.includeDetails));
        
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
  console.error('📡 Ready for MCP client connections...');
}

main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});