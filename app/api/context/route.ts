"use server";

import { NextRequest, NextResponse } from 'next/server';

// Define the base URL for the UI API
const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || 'http://localhost:3001';

// Reusable fetch helper
async function fetchFromApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        cache: 'no-store',
    });
    
    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Failed to parse error body');
        console.error(`[Context API] Error fetching ${url}: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
    
    if (response.status === 204) {
        return null;
    }
    
    return response.json();
}

// Initialize or resume a context session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let endpoint = '';
    let method = 'POST';

    switch (action) {
      case 'initialize_session':
        endpoint = '/api/ui/context/sessions';
        break;
      case 'add_conversation':
        endpoint = '/api/ui/context/conversations';
        break;
      case 'update_session_state':
        endpoint = `/api/ui/context/sessions/${params.sessionId}/state`;
        method = 'PUT';
        break;
      case 'track_entity_interaction':
        endpoint = `/api/ui/context/sessions/${params.sessionId}/interactions`;
        break;
      case 'end_session':
        endpoint = `/api/ui/context/sessions/${params.sessionId}/end`;
        method = 'PUT';
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const result = await fetchFromApi(endpoint, {
      method,
      body: JSON.stringify(params),
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in context API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Context API request failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Get context information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const sessionId = searchParams.get('sessionId');
    const projectId = searchParams.get('projectId');

    if (!sessionId || !projectId) {
      return NextResponse.json(
        { error: 'sessionId and projectId are required' },
        { status: 400 }
      );
    }

    let endpoint = '';

    switch (action) {
      case 'get_context':
        const topic = searchParams.get('topic');
        const limit = searchParams.get('limit');
        const includeGaps = searchParams.get('include_gaps');
        const includeSuggestions = searchParams.get('include_suggestions');
        
        endpoint = `/api/ui/context/sessions/${sessionId}/context?projectId=${projectId}`;
        if (topic) endpoint += `&topic=${encodeURIComponent(topic)}`;
        if (limit) endpoint += `&limit=${limit}`;
        if (includeGaps) endpoint += `&include_gaps=${includeGaps}`;
        if (includeSuggestions) endpoint += `&include_suggestions=${includeSuggestions}`;
        break;
        
      case 'get_suggestions':
        endpoint = `/api/ui/context/sessions/${sessionId}/suggestions?projectId=${projectId}`;
        break;
        
      case 'search_conversations':
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json(
            { error: 'query parameter is required for search' },
            { status: 400 }
          );
        }
        endpoint = `/api/ui/context/conversations/search?projectId=${projectId}&query=${encodeURIComponent(query)}`;
        if (sessionId) endpoint += `&sessionId=${sessionId}`;
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const result = await fetchFromApi(endpoint);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error getting context:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get context';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 