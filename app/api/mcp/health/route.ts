import { NextResponse } from 'next/server';

// Simple health check endpoint for debugging MCP connection issues
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    mcp: 'knowledge-graph',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    tools: Object.keys(((global as any)?.server?._tools || {}))
  });
} 