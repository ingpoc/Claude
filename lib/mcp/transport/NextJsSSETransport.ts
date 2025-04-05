import { z } from 'zod';

// Define JSON-RPC message types
export interface JSONRPCMessage {
  type: string;
  id?: string;
  [key: string]: any;
}

// Writer interface to support both Next.js and Express
export interface StreamWriter {
  write: (data: Uint8Array | string) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Custom transport class for MCP protocol that works with both Next.js streams and Express
 */
export class NextJsSSETransport {
  private writer: StreamWriter;
  private encoder: TextEncoder;
  public _handlingRequest?: boolean;
  public extra?: {
    sessionId: string;
    [key: string]: unknown;
  };
  public sessionId: string;
  private isStarted: boolean = false;
  private toolHandlers: Record<string, any> = {};

  constructor(sessionId: string, writer: StreamWriter | WritableStreamDefaultWriter<Uint8Array>) {
    // Handle different writer types (Next.js or Express)
    if ('write' in writer && 'close' in writer) {
      this.writer = writer as StreamWriter;
    } else {
      // Convert Next.js WritableStreamDefaultWriter to our StreamWriter interface
      this.writer = {
        write: async (data: Uint8Array | string) => {
          if (typeof data === 'string') {
            await (writer as WritableStreamDefaultWriter<Uint8Array>).write(this.encoder.encode(data));
          } else {
            await (writer as WritableStreamDefaultWriter<Uint8Array>).write(data);
          }
        },
        close: async () => await (writer as WritableStreamDefaultWriter<Uint8Array>).close()
      };
    }
    
    this.encoder = new TextEncoder();
    this.sessionId = sessionId;
  }

  /**
   * Register tool handlers for message processing
   */
  registerToolHandlers(handlers: Record<string, any>) {
    this.toolHandlers = handlers;
  }

  /**
   * Start the SSE connection
   */
  async start(): Promise<void> {
    this.isStarted = true;
    return Promise.resolve();
  }

  /**
   * Send a message over SSE
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isStarted) {
      await this.start();
    }

    const data = JSON.stringify(message);
    let sseMessage = `data: ${data}\n\n`;
    
    try {
      await this.writer.write(sseMessage);
    } catch (error) {
      console.error("Error writing to SSE stream:", error);
    }
  }

  /**
   * Send a custom event
   */
  async sendEvent(event: string, data: string): Promise<void> {
    if (!this.isStarted) {
      await this.start();
    }

    let message = `event: ${event}\n`;
    message += `data: ${data}\n\n`;
    
    try {
      await this.writer.write(message);
    } catch (error) {
      console.error("Error writing to SSE stream:", error);
    }
  }

  /**
   * Send a keep-alive ping
   */
  async sendPing(): Promise<void> {
    try {
      await this.writer.write(`: ping\n\n`);
    } catch (error) {
      console.error("Error sending ping:", error);
    }
  }

  /**
   * Close the SSE connection
   */
  async close(): Promise<void> {
    try {
      await this.writer.close();
    } catch (error) {
      console.error("Error closing SSE stream:", error);
    }
  }

  /**
   * Handle incoming messages from the client
   */
  async handleMessage(message: JSONRPCMessage): Promise<void> {
    if (!message || message.type !== 'request' || !message.tool) {
      console.warn("Received invalid message format:", message);
      return;
    }

    try {
      // Call the appropriate tool handler
      const toolName = message.tool;
      const args = message.args || {};
      const extra = this.extra || {};
      
      console.log(`Processing tool request: ${toolName} with args:`, args);
      
      // Find the registered tool handler
      const toolHandler = this.toolHandlers[toolName];
      if (!toolHandler) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Call the handler
      const result = await toolHandler.handler(args, extra);
      
      // Create and send response
      const response = {
        type: 'response',
        id: message.id,
        isError: result.isError || false,
        content: result.content || []
      };
      
      console.log(`Sending response for tool: ${toolName}`);
      await this.send(response);
    } catch (error) {
      console.error("Error handling message:", error);
      // Send error response
      if (message.id) {
        const errorResponse = {
          type: 'response',
          id: message.id,
          isError: true,
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
        await this.send(errorResponse);
      }
    }
  }
} 