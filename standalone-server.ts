#!/usr/bin/env node

// Removed Express imports
// import express, { Request, Response } from 'express';
// import cors from 'cors';

// Import SDK components
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

// Keep SessionManager import if needed by tool info functions
import { SessionManager } from './lib/mcp/SessionManager';

// Import the new tool info functions
import { getKnowledgeGraphToolInfo } from './lib/mcp/tools/KnowledgeGraphTools';
import { getProjectToolInfo } from './lib/mcp/tools/ProjectTools';
import { getMemoryToolInfo } from './lib/mcp/tools/MemoryToolsInfo';

// Removed MCP protocol message interfaces (handled by SDK)

// Instantiate Session Manager (if needed by tool info functions)
const sessionManager = new SessionManager();

// --- Create MCP SDK Server instance ---
const server = new Server({
    name: "standalone-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {}, // Indicate tool capability
    },
});

// --- Get Tool Definitions and Handlers ---
// Pass sessionManager if the get...Info functions require it
const kgToolInfo = getKnowledgeGraphToolInfo(sessionManager);
const projectToolInfo = getProjectToolInfo(sessionManager);
const memoryToolInfo = getMemoryToolInfo(sessionManager);

// Combine tool definitions and handlers
const allToolDefinitions = [
    ...kgToolInfo.definitions,
    ...projectToolInfo.definitions,
    ...memoryToolInfo.definitions
];
const allToolHandlers = {
    ...kgToolInfo.handlers,
    ...projectToolInfo.handlers,
    ...memoryToolInfo.handlers
};

// --- Register SDK Handlers ---

// Handler for listTools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Log that tools are being listed (use console.error for stderr)
    console.error(`Listing ${allToolDefinitions.length} tools.`);
    return {
        tools: allToolDefinitions,
    };
});

// Handler for callTool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`Received callTool request for: ${name}`); // Log tool calls

    const handler = allToolHandlers[name];
    if (!handler) {
        console.error(`Method not found: ${name}`);
        // Use McpError for standard error reporting
        throw new McpError(-32601, `Method not found: ${name}`);
    }

    const handlerArgs = args || {};
    // Note: sessionId is not available via stdio transport

    try {
        // Assume the handler function returns the expected { content: [...] } structure
        const result = await handler(handlerArgs);
        console.error(`Tool ${name} executed successfully.`); // Log success

        // Check if the handler itself indicated an error (optional pattern)
        if (result?.isError) {
             console.warn(`Handler for ${name} indicated an error:`, result.content);
             // Consider throwing McpError here for consistency if possible
        }

        return result; // Directly return the { content: [...] } object
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        // Throw standard MCP error
        throw new McpError(-32000, error instanceof Error ? error.message : `Internal server error executing tool: ${name}`);
    }
});

// Removed old Express app setup, middleware, and routes (/events, /mcp-messages)

// --- Main function to connect server ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr as stdout is used for MCP communication
    console.error("🚀 MCP Server (SDK/Stdio) is running.");
}

// --- Start the server ---
main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});

// Removed app.listen() 