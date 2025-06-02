import { NextRequest, NextResponse } from 'next/server';

// This is a catch-all route that proxies all /api/ui/* requests to the backend server
// The backend server runs on a different port (3155 by default) in development

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PATCH');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // In development, the backend runs on a different port
  // In production, it's the same server
  const isDevelopment = process.env.NODE_ENV === 'development';
  const backendUrl = isDevelopment 
    ? 'http://localhost:3155' 
    : `http://localhost:${process.env.UI_API_PORT || '4000'}`;
  
  // Reconstruct the path
  const path = pathSegments.join('/');
  const url = `${backendUrl}/api/ui/${path}`;
  
  // Copy query parameters
  const searchParams = request.nextUrl.searchParams.toString();
  const fullUrl = searchParams ? `${url}?${searchParams}` : url;
  
  // Prepare headers
  const headers: HeadersInit = {};
  
  // Copy relevant headers from the original request
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['content-type'] = contentType;
  }
  
  // Prepare body for methods that support it
  let body: any = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (contentType?.includes('application/json')) {
      body = await request.text();
    } else {
      // For other content types, use the raw body
      body = await request.blob();
    }
  }
  
  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    });
    
    // Handle 204 No Content
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    // Get response body
    const responseText = await response.text();
    
    // Try to parse as JSON
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, return as text
      return new NextResponse(responseText, {
        status: response.status,
        headers: {
          'content-type': 'text/plain',
        },
      });
    }
    
    // Return JSON response
    return NextResponse.json(responseData, { status: response.status });
    
  } catch (error) {
    console.error(`Failed to proxy request to ${fullUrl}:`, error);
    return NextResponse.json(
      { error: 'Failed to proxy request to backend' },
      { status: 500 }
    );
  }
}
