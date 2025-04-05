import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Create and configure the MCP server instance
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "ai-code-knowledge-graph",
    version: "0.1.0",
  });

  // Register standard MCP methods to ensure they're available
  // This is crucial for client operation
  try {
    // Add standard method handlers for MCP protocol support
    server.tool("tools/list", "Lists all available tools", {}, async (_args: any, _extra: any) => {
      // Get tools from the server
      const toolsObj = (server as any)._tools || {};
      
      const toolList = Object.keys(toolsObj).map(toolName => {
        const tool = toolsObj[toolName] || {};
        return {
          name: toolName,
          description: tool.description || "",
          parameters: tool.parameters || {}
        };
      });
      
      console.log(`Responding to tools/list with ${toolList.length} tools`);
      
      // Return in the expected format with content property
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ tools: toolList })
        }]
      };
    });
    
    server.tool("resources/list", "Lists all available resources", {}, async (_args: any, _extra: any) => {
      // Currently no resources implemented
      console.log('Responding to resources/list with empty list');
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ resources: [] })
        }]
      };
    });
    
    server.tool("prompts/list", "Lists all available prompts", {}, async (_args: any, _extra: any) => {
      // Currently no prompts implemented
      console.log('Responding to prompts/list with empty list');
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ prompts: [] })
        }]
      };
    });
    
    console.error('Successfully registered standard MCP methods for protocol compliance');
  } catch (error) {
    console.error('Error registering standard MCP methods:', error);
  }

  return server;
}

// Define JSON-RPC helper interfaces
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: number | string | null; // Can be null for notifications
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null; // Match the request ID
  result?: any;
  error?: { code: number; message: string; data?: any };
}

/**
 * Handle standard MCP protocol methods directly
 */
export async function handleMcpProtocolMethods(message: any): Promise<JsonRpcResponse | null | false> {
  // Handle initialization request
  if (message.method === 'initialize') {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",  // Use the standard MCP protocol version
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "knowledge-graph-mcp",
          version: "0.1.0"
        }
      }
    };
  }
  
  // Handle tool listing request
  if (message.method === 'tools/list') {
    // We'll handle this through the server instance
    return false;
  }

  // Handle resources listing request
  if (message.method === 'resources/list') {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        resources: [] // This server doesn't provide additional resources
      }
    };
  }

  // Handle prompts listing request
  if (message.method === 'prompts/list') {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        prompts: [] // This server doesn't provide prompts
      }
    };
  }
  
  // Handle notifications/initialized notification
  if (message.method === 'notifications/initialized') {
    // Just acknowledge, no response needed
    return null;
  }
  
  // For other MCP protocol methods, return a method not found error
  if (message.method && message.method.indexOf('/') !== -1) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    };
  }
  
  // Not a protocol method, continue with normal processing
  return false;
} 