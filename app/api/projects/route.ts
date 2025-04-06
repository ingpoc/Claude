"use server";

import { NextRequest, NextResponse } from 'next/server';
// Remove direct import from lib/projectManager
// import { getProjects, createProject } from '../../../lib/projectManager';

// Define the base URL for the UI API (consider centralizing this)
const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || 'http://localhost:3001';

// Reusable fetch helper (could be moved to a shared utility)
async function fetchFromApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`[API Route] Fetching: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        cache: 'no-store', // Ensure fresh data for API routes too
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Failed to parse error body');
        console.error(`[API Route] Error fetching ${url}: ${response.status} ${response.statusText}`, errorBody);
        // Throw an error to be caught by the route handler's catch block
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
    // Handle 204 No Content for DELETE (if needed in other routes)
    if (response.status === 204) {
        return null; // Or return true/false depending on context
    }
    return response.json();
}

export async function GET() {
  try {
    // const projects = await getProjects(); // Old direct call
    const projects = await fetchFromApi('/api/ui/projects');
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error getting projects via API:', error);
    // Return the error from the fetch call if possible, or a generic one
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects from API';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // const newProject = await createProject(name, description); // Old direct call
    const newProject = await fetchFromApi('/api/ui/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || "" }),
    });

    // The API now handles the duplicate check and returns 409
    // We might want to check the response status code if fetchFromApi doesn't throw for 409
    // But currently, fetchFromApi throws for non-ok statuses, so error is handled by catch.

    // if (!newProject) { ... } // This check might be redundant if fetchFromApi throws

    return NextResponse.json(newProject, { status: 201 }); // Return 201 Created

  } catch (error) {
    console.error('Error creating project via API:', error);
    // Return the error from the fetch call if possible, or a generic one
    const errorMessage = error instanceof Error ? error.message : 'Failed to create project via API';
    // Determine appropriate status code based on error if possible
    const status = error instanceof Error && error.message.includes('409') ? 409 : 500;
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
} 