import { NextRequest, NextResponse } from 'next/server';
import { qdrantService } from '../../../../../lib/services/QdrantService';
import { vectorEntityService } from '../../../../../lib/services/VectorEntityService';
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
        // Semantic search using vector embeddings
        results = await vectorEntityService.searchEntities(query, projectId, {
          limit,
          type,
          minScore
        });
        break;

      case 'similar':
        // Find similar entities to a given entity ID
        if (!body.entityId) {
          return NextResponse.json(
            { error: 'entityId is required for similar search' },
            { status: 400 }
          );
        }
        results = await vectorEntityService.findSimilarEntities(
          body.entityId,
          projectId,
          limit
        );
        break;

      case 'conversation':
        // Search conversations semantically
        results = await qdrantService.searchConversations(query, projectId, limit);
        break;

      case 'hybrid':
        // Advanced hybrid search combining vector and keyword search
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for hybrid search' },
            { status: 400 }
          );
        }

        // Use the new hybrid search method from QdrantService
        const hybridResults = await qdrantService.hybridSearchEntities(query, projectId, {
          limit,
          vectorWeight: body.vectorWeight || 0.7,
          keywordWeight: body.keywordWeight || 0.3,
          minScore: minScore,
          entityType: type
        });

        // Convert to the expected format
        results = hybridResults.map(result => ({
          id: result.id,
          name: result.payload.name,
          type: result.payload.type,
          description: result.payload.description,
          score: result.score,
          metadata: result.payload.metadata,
          relationships: result.payload.relationships,
          conversationIds: result.payload.conversationIds,
          createdAt: result.payload.createdAt,
          updatedAt: result.payload.updatedAt
        }));
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid search type' },
          { status: 400 }
        );
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

    const results = await vectorEntityService.searchEntities(query, projectId, {
      limit,
      type: type || undefined,
      minScore
    });

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