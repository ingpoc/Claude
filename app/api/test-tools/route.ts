import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Send a tools/list request to our MCP endpoint
    const response = await fetch('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-tools',
        method: 'tools/list',
        params: {},
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to test tools: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 