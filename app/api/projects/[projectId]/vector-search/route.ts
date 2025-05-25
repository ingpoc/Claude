import { NextRequest, NextResponse } from 'next/server';
import { qdrantDataService } from '../../../../../lib/services/QdrantDataService';
import { logger } from '../../../../../lib/services/Logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { query, type, limit = 10, minScore = 0.5, searchType = 'semantic' } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    let results;

    switch (searchType) {
      case 'semantic':
        // Semantic search using QdrantDataService
        results = await qdrantDataService.searchEntities(projectId, query, limit);
        break;

      case 'similar':
        // Find similar entities to a given entity ID
        if (!body.entityId) {
          return NextResponse.json(
            { error: 'entityId is required for similar search' },
            { status: 400 }
          );
        }
        results = await qdrantDataService.findSimilarEntities(
          projectId,
          body.entityId,
          limit
        );
        break;

      default:
        // Simplified implementation - just use semantic search
        logger.warn(`Search type ${searchType} not fully implemented, falling back to semantic search`);
        results = await qdrantDataService.searchEntities(projectId, query, limit);
        break;
    }

    logger.info('Vector search completed', {
      projectId,
      searchType,
      query: query.substring(0, 100),
      resultsCount: results.length
    });

    return NextResponse.json({
      success: true,
      results,
      metadata: {
        searchType,
        query,
        limit,
        minScore,
        totalResults: results.length
      }
    });

  } catch (error) {
    logger.error('Vector search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId: 'unknown'
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Vector search failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');
    const minScore = parseFloat(searchParams.get('minScore') || '0.5');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const results = await qdrantDataService.searchEntities(projectId, query, limit);

    return NextResponse.json({
      success: true,
      results,
      metadata: {
        query,
        limit,
        minScore,
        totalResults: results.length
      }
    });

  } catch (error) {
    logger.error('Vector search GET failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId: 'unknown'
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Vector search failed' 
      },
      { status: 500 }
    );
  }
} 