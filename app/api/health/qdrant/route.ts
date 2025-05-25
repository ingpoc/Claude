import { NextResponse } from 'next/server';
import { qdrantService } from '../../../../lib/services/QdrantService';
import { logger } from '../../../../lib/services/Logger';

export async function GET() {
  try {
    // Check Qdrant connectivity
    const isHealthy = await qdrantService.healthCheck();
    
    if (!isHealthy) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          service: 'qdrant',
          error: 'Qdrant connection failed'
        },
        { status: 503 }
      );
    }

    // Get collection stats for additional health info
    const collections = ['entities', 'conversations', 'context_sessions'];
    const collectionStats = {};
    let totalPoints = 0;
    let totalVectors = 0;

    for (const collection of collections) {
      try {
        const stats = await qdrantService.getCollectionStats(collection);
        const pointsCount = stats.points_count || 0;
        const vectorsCount = stats.vectors_count || 0;
        
        collectionStats[collection] = {
          status: 'healthy',
          pointsCount,
          vectorsCount,
          indexedVectorsCount: stats.indexed_vectors_count || 0,
          payloadSchemaCount: Object.keys(stats.payload_schema || {}).length,
          optimizerStatus: stats.optimizer_status || 'unknown'
        };
        
        totalPoints += pointsCount;
        totalVectors += vectorsCount;
      } catch (error) {
        collectionStats[collection] = {
          status: 'not_found',
          error: 'Collection not initialized'
        };
      }
    }

    // Performance metrics
    const performanceMetrics = {
      totalCollections: collections.length,
      totalPoints,
      totalVectors,
      averagePointsPerCollection: Math.round(totalPoints / collections.length),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version
    };

    // Configuration info
    const configuration = {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      hasApiKey: !!process.env.QDRANT_API_KEY,
      timeout: process.env.QDRANT_TIMEOUT || '30000',
      batchSize: process.env.QDRANT_BATCH_SIZE || '100',
      retryAttempts: process.env.QDRANT_RETRY_ATTEMPTS || '3',
      quantizationEnabled: process.env.QDRANT_QUANTIZATION_ENABLED === 'true',
      distanceMetric: process.env.QDRANT_DISTANCE_METRIC || 'Cosine',
      replicationFactor: process.env.QDRANT_REPLICATION_FACTOR || '1',
      shardNumber: process.env.QDRANT_SHARD_NUMBER || '1'
    };

    logger.info('Qdrant health check successful', { 
      collectionStats, 
      performanceMetrics,
      totalPoints,
      totalVectors 
    });

    return NextResponse.json({
      status: 'healthy',
      service: 'qdrant',
      timestamp: new Date().toISOString(),
      collections: collectionStats,
      performance: performanceMetrics,
      configuration,
      features: {
        vectorSearch: true,
        hybridSearch: true,
        batchOperations: true,
        quantization: configuration.quantizationEnabled,
        retryLogic: true,
        conversationMemory: true,
        contextIntelligence: true
      }
    });

  } catch (error) {
    logger.error('Qdrant health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { 
        status: 'unhealthy',
        service: 'qdrant',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
} 