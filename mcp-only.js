#!/usr/bin/env node
// MCP-only server entry point (no HTTP server)
process.env.MCP_MODE = 'true';
require('./dist/mcp-server.js');
