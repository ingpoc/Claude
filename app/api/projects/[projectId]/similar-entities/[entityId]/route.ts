import { NextRequest, NextResponse } from 'next/server';
import { vectorEntityService } from '../../../../../../lib/services/VectorEntityService';
import { logger } from '../../../../../../lib/services/Logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; entityId: string }> }
) {
  try {
    const { projectId, entityId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const minScore = parseFloat(searchParams.get('minScore') || '0.5');

    // Find similar entities
    const similarEntities = await vectorEntityService.findSimilarEntities(
      entityId,
      projectId,
      limit
    );

    // Filter by minimum score
    const filteredResults = similarEntities.filter(entity => entity.score >= minScore);

    logger.info('Similar entities found', {
      projectId,
      entityId,
      totalFound: similarEntities.length,
      afterFiltering: filteredResults.length,
      minScore
    });

    return NextResponse.json({
      success: true,
      entityId,
      similarEntities: filteredResults,
      metadata: {
        limit,
        minScore,
        totalFound: similarEntities.length,
        afterFiltering: filteredResults.length
      }
    });

  } catch (error) {
    logger.error('Failed to find similar entities', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId: 'unknown',
      entityId: 'unknown'
    });

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find similar entities' 
      },
      { status: 500 }
    );
  }
} 