#!/usr/bin/env node

/**
 * MCP-Compliant Knowledge Graph Host
 * 
 * This implementation follows the official MCP Host-Client-Server architecture
 * enabling dynamic client registration for any MCP-compatible application.
 * 
 * Features:
 * - Auto-detection of client type (Claude, Cursor, Cline, etc.)
 * - Dynamic client registration with proper MCP lifecycle
 * - Automatic Python service management
 * - Shared knowledge graph across all clients
 * - Proper capability negotiation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Import existing services
import { memvidService } from '../../lib/services/MemvidService.js';
import { logger } from '../../lib/services/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientInfo {
  id: string;
  name: string;
  version: string;
  transport: 'stdio' | 'http';
  capabilities: Record<string, any>;
  processInfo: {
    pid: number;
    ppid: number;
    command: string;
    detectedFrom: string;
  };
  registeredAt: string;
}

interface MCPHost {
  registerClient(clientInfo: Partial<ClientInfo>): string;
  removeClient(clientId: string): void;
  listClients(): ClientInfo[];
  ensurePythonService(): Promise<boolean>;
  shutdown(): Promise<void>;
}

/**
 * Python Service Manager
 * Handles lifecycle of the Python memvid service
 */
class PythonServiceManager {
  private pythonService: ChildProcess | null = null;
  private serviceUrl = 'http://localhost:8000';
  private isStarting = false;
  private startupPromise: Promise<boolean> | null = null;

  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async ensureServiceRunning(): Promise<boolean> {
    // Return existing startup promise if already starting
    if (this.startupPromise) {
      return this.startupPromise;
    }

    // Check if already running
    if (await this.checkServiceHealth()) {
      logger.info('Python memvid service already running');
      return true;
    }

    // Start the service
    this.startupPromise = this.startService();
    const result = await this.startupPromise;
    this.startupPromise = null;
    return result;
  }

  private async startService(): Promise<boolean> {
    if (this.isStarting) {
      throw new Error('Service startup already in progress');
    }

    this.isStarting = true;
    logger.info('🐍 Starting Python memvid service...');

    try {
      // Resolve Python script from project root python-service folder
      const pythonScript = path.resolve(__dirname, '../../../python-service/python_memvid_service.py');
      
      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Python script not found: ${pythonScript}`);
      }

      // Use python3 binary from the virtual environment, running in a shell to pick up user's env
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      this.pythonService = spawn(pythonPath, [pythonScript], {
        cwd: path.resolve(__dirname, '../../../python-service'),
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      // Handle process events
      this.pythonService.on('error', (error) => {
        logger.error('Python service error', { error: error.message });
      });

      this.pythonService.on('exit', (code, signal) => {
        logger.info('Python service exited', { code, signal });
        this.pythonService = null;
      });

      // Log service output
      this.pythonService.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output.includes('Uvicorn running')) {
          logger.info('🐍 Python service ready');
        } else {
          logger.debug('Python stdout', { output });
        }
      });

      this.pythonService.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        // Ignore benign Python warnings
        if (msg.toLowerCase().includes('warning')) {
          return;
        }
        // Log the raw stderr message
        logger.error(`Python stderr: ${msg}`);
      });

      // Wait for service to be ready
      await this.waitForService();
      logger.info('✅ Python memvid service started successfully');
      return true;

    } catch (error) {
      logger.error('Failed to start Python service', { error: error.message });
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  private async waitForService(maxWaitMs = 30000, checkIntervalMs = 1000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.checkServiceHealth()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    
    throw new Error('Timeout waiting for Python service to become ready');
  }

  async stop(): Promise<void> {
    if (!this.pythonService) return;

    logger.info('🐍 Stopping Python memvid service...');
    
    // Try graceful shutdown first
    this.pythonService.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Force kill if still running
    if (this.pythonService && !this.pythonService.killed) {
      logger.warn('Force killing Python service');
      this.pythonService.kill('SIGKILL');
    }
    
    this.pythonService = null;
    logger.info('🐍 Python service stopped');
  }
}

/**
 * Client Detection and Management
 */
class ClientManager {
  private clients = new Map<string, ClientInfo>();
  private clientCounter = 0;

  /**
   * Auto-detect client information from process environment
   */
  detectClientFromProcess(): Partial<ClientInfo> {
    const ppid = process.ppid;
    const parentCmd = process.env._ || '';
    const cmdLine = process.argv.join(' ');
    
    // Detect client type from various indicators
    let clientName = 'Unknown MCP Client';
    let detectedFrom = 'process.env';
    
    if (parentCmd.includes('claude') || cmdLine.includes('claude')) {
      clientName = 'Claude Desktop';
      detectedFrom = 'claude in command path';
    } else if (parentCmd.includes('cursor') || cmdLine.includes('cursor')) {
      clientName = 'Cursor';
      detectedFrom = 'cursor in command path';
    } else if (parentCmd.includes('cline') || cmdLine.includes('cline') || process.env.CLIENT_ID === 'cline') {
      clientName = 'Cline';
      detectedFrom = 'cline in command path or CLIENT_ID';
    } else if (parentCmd.includes('continue') || cmdLine.includes('continue')) {
      clientName = 'Continue';
      detectedFrom = 'continue in command path';
    } else if (process.env.CLIENT_ID) {
      clientName = `Client (${process.env.CLIENT_ID})`;
      detectedFrom = 'CLIENT_ID environment variable';
    }

    return {
      name: clientName,
      version: '1.0.0',
      transport: 'stdio',
      capabilities: {},
      processInfo: {
        pid: process.pid,
        ppid: ppid,
        command: parentCmd,
        detectedFrom
      }
    };
  }

  registerClient(clientInfo: Partial<ClientInfo>): string {
    const detectedInfo = this.detectClientFromProcess();
    const clientId = `client_${++this.clientCounter}_${Date.now()}`;
    
    const fullClientInfo: ClientInfo = {
      id: clientId,
      name: clientInfo.name || detectedInfo.name || 'Unknown Client',
      version: clientInfo.version || detectedInfo.version || '1.0.0',
      transport: clientInfo.transport || detectedInfo.transport || 'stdio',
      capabilities: clientInfo.capabilities || {},
      processInfo: clientInfo.processInfo || detectedInfo.processInfo || {
        pid: process.pid,
        ppid: process.ppid,
        command: 'unknown',
        detectedFrom: 'fallback'
      },
      registeredAt: new Date().toISOString()
    };
    
    this.clients.set(clientId, fullClientInfo);
    
    logger.info('✅ MCP Client registered', {
      clientId,
      name: fullClientInfo.name,
      detectedFrom: fullClientInfo.processInfo.detectedFrom,
      totalClients: this.clients.size
    });
    
    return clientId;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info('❌ MCP Client disconnected', {
        clientId,
        name: client.name,
        remainingClients: this.clients.size
      });
    }
  }

  listClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * MCP Host Implementation
 */
class MCPHostProcess implements MCPHost {
  private pythonService: PythonServiceManager;
  private clientManager: ClientManager;
  private currentClientId: string | null = null;

  constructor() {
    this.pythonService = new PythonServiceManager();
    this.clientManager = new ClientManager();
  }

  registerClient(clientInfo: Partial<ClientInfo> = {}): string {
    const clientId = this.clientManager.registerClient(clientInfo);
    this.currentClientId = clientId;
    return clientId;
  }

  removeClient(clientId: string): void {
    this.clientManager.removeClient(clientId);
    if (this.currentClientId === clientId) {
      this.currentClientId = null;
    }
  }

  listClients(): ClientInfo[] {
    return this.clientManager.listClients();
  }

  async ensurePythonService(): Promise<boolean> {
    return await this.pythonService.ensureServiceRunning();
  }

  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down MCP Host...');
    
    // Remove all clients
    const clients = this.listClients();
    for (const client of clients) {
      this.removeClient(client.id);
    }
    
    // Stop Python service if no other processes are using it
    if (this.clientManager.getClientCount() === 0) {
      await this.pythonService.stop();
    }
    
    logger.info('✅ MCP Host shutdown complete');
  }

  getCurrentClientId(): string | null {
    return this.currentClientId;
  }

  getCurrentClient(): ClientInfo | null {
    if (!this.currentClientId) {
      return null;
    }
    const client = this.clientManager.getClient(this.currentClientId);
    return client ?? null;
  }
}

/**
 * Create and configure the MCP Server with knowledge graph tools
 */
function createKnowledgeGraphServer(host: MCPHostProcess): McpServer {
  const server = new McpServer({
    name: "knowledge-graph-host",
    version: "1.0.0"
  });

  // Entity Management Tools
  server.tool(
    "create_entity",
    {
      name: z.string().describe("Entity name"),
      type: z.string().describe("Entity type"),
      description: z.string().describe("Entity description"),
      observations: z.array(z.string()).optional().describe("Initial observations")
    },
    async ({ name, type, description, observations = [] }) => {
      const clientId = host.getCurrentClientId() || 'unknown';
      const client = host.getCurrentClient();
      
      const entity = await memvidService.createEntity({
        name,
        type,
        description,
        observations: observations.map((text: string) => ({
          id: `obs_${Date.now()}`,
          text,
          addedBy: client?.name || clientId,
          createdAt: new Date().toISOString()
        })),
        addedBy: client?.name || clientId
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            entity: {
              id: entity.id,
              name: entity.name,
              type: entity.type,
              description: entity.description,
              addedBy: entity.addedBy
            },
            client: client?.name || clientId
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "get_entity",
    {
      entityId: z.string().describe("Entity ID to retrieve")
    },
    async ({ entityId }) => {
      const entity = await memvidService.getEntity(entityId);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: !!entity,
            entity: entity || null
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "list_entities",
    {
      type: z.string().optional().describe("Filter by entity type")
    },
    async ({ type }) => {
      const entities = await memvidService.getAllEntities(type);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            entities,
            count: entities.length,
            filter: type ? { type } : null
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "update_entity",
    {
      entityId: z.string().describe("Entity ID to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description")
    },
    async ({ entityId, name, description }) => {
      const clientId = host.getCurrentClientId() || 'unknown';
      const client = host.getCurrentClient();
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      updates.updatedBy = client?.name || clientId;
      
      const entity = await memvidService.updateEntity(entityId, updates);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: !!entity,
            entity: entity || null,
            updatedBy: client?.name || clientId
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "delete_entity",
    {
      entityId: z.string().describe("Entity ID to delete")
    },
    async ({ entityId }) => {
      const success = await memvidService.deleteEntity(entityId);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success,
            entityId: success ? entityId : null
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "add_observation",
    {
      entityId: z.string().describe("Entity ID to add observation to"),
      text: z.string().describe("Observation text")
    },
    async ({ entityId, text }) => {
      const clientId = host.getCurrentClientId() || 'unknown';
      const client = host.getCurrentClient();
      
      const result = await memvidService.addObservation(entityId, text, client?.name || clientId);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: !!result,
            observation_id: result?.observation_id || null,
            addedBy: client?.name || clientId
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "search_entities",
    {
      query: z.string().describe("Search query"),
      limit: z.number().default(10).describe("Maximum number of results")
    },
    async ({ query, limit = 10 }) => {
      const entities = await memvidService.searchEntities(query, limit);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            query,
            entities,
            count: entities.length,
            limit
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "create_relationship",
    {
      sourceId: z.string().describe("Source entity ID"),
      targetId: z.string().describe("Target entity ID"),
      type: z.string().describe("Relationship type"),
      description: z.string().optional().describe("Relationship description")
    },
    async ({ sourceId, targetId, type, description }) => {
      const clientId = host.getCurrentClientId() || 'unknown';
      const client = host.getCurrentClient();
      
      const relationship = await memvidService.createRelationship({
        sourceId,
        targetId,
        type,
        description,
        addedBy: client?.name || clientId
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            relationship: {
              id: relationship.id,
              sourceId: relationship.sourceId,
              targetId: relationship.targetId,
              type: relationship.type,
              addedBy: relationship.addedBy
            },
            client: client?.name || clientId
          }, null, 2)
        }]
      };
    }
  );

  // Host management tools
  server.tool(
    "list_connected_clients",
    {},
    async () => {
      const clients = host.listClients();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            clients: clients.map(client => ({
              id: client.id,
              name: client.name,
              version: client.version,
              transport: client.transport,
              registeredAt: client.registeredAt,
              detectedFrom: client.processInfo.detectedFrom
            })),
            totalClients: clients.length
          }, null, 2)
        }]
      };
    }
  );

  return server;
}

/**
 * Main function to start the MCP Host
 */
async function main() {
  const host = new MCPHostProcess();
  
  try {
    // Register this client
    const clientId = host.registerClient();
    
    logger.info('🚀 Starting MCP Knowledge Graph Host', {
      clientId,
      pid: process.pid,
      ppid: process.ppid
    });
    
    // Ensure Python service is running
    logger.info('🔍 Checking Python memvid service...');
    const serviceReady = await host.ensurePythonService();
    
    if (!serviceReady) {
      logger.error('❌ Failed to start Python service, but continuing with MCP server');
    }

    // Create and start MCP server
    const server = createKnowledgeGraphServer(host);
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    logger.info('✅ MCP Knowledge Graph Host connected via stdio', { clientId });
    
    // Log client info periodically
    setInterval(() => {
      const clients = host.listClients();
      if (clients.length > 0) {
        logger.info('📊 Active MCP Clients', {
          count: clients.length,
          clients: clients.map(c => `${c.name} (${c.id})`)
        });
      }
    }, 60000);
    
  } catch (error) {
    logger.error('❌ Failed to start MCP Host', { error: error.message });
    await host.shutdown();
    process.exit(1);
  }

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    logger.info(`📶 Received ${signal}, shutting down gracefully`);
    
    try {
      await host.shutdown();
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
    }
    
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    await host.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    logger.error('Unhandled rejection', { reason });
    await host.shutdown();
    process.exit(1);
  });
}

// Start the host
main().catch(async (error) => {
  logger.error('MCP Host startup failed', { error: error.message });
  process.exit(1);
});
