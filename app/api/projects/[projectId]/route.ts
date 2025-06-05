import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || 'http://localhost:3155';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const response = await fetch(`${API_BASE_URL}/api/ui/projects/${projectId}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const response = await fetch(`${API_BASE_URL}/api/ui/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
