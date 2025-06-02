#!/usr/bin/env node
// This file is kept for backward compatibility
// It now redirects to the new mcp-server architecture

console.warn('⚠️  Note: standalone-server.ts is being redirected to mcp-server.ts');
console.warn('   For MCP clients (Claude, Cursor), use mcp-only.js to avoid port conflicts');
console.warn('   For dashboard access, use: npm run start');

// Set environment to run with UI for backward compatibility
process.env.RUN_UI = 'true';

// Import and run the new server
import './mcp-server';
