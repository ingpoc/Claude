import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { qdrantService } from '../../services/QdrantService';
import { vectorEntityService } from '../../services/VectorEntityService';
import { logger } from '../../services/Logger';

/**
 * Vector Search Tools for MCP
 * Provides semantic search, similarity finding, and vector-based operations
 */

export const vectorSearchTools: Tool[] = [
  {
    name: 'semantic_search_entities',
    description: 'Search entities using semantic similarity based on vector embeddings. Find entities by meaning rather than exact keyword matches.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to search within'
        },
        query: {
          type: 'string',
          description: 'The search query - can be natural language describing what you\'re looking for'
        },
        type: {
          type: 'string',
          description: 'Optional: Filter by entity type (e.g., "function", "class", "file")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          minimum: 1,
          maximum: 100
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score (0.0 to 1.0, default: 0.5)',
          minimum: 0.0,
          maximum: 1.0
        }
      },
      required: ['projectId', 'query']
    }
  },
  {
    name: 'find_similar_entities',
    description: 'Find entities that are semantically similar to a given entity based on vector similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID containing the entities'
        },
        entityId: {
          type: 'string',
          description: 'The ID of the entity to find similar entities for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of similar entities to return (default: 5)',
          minimum: 1,
          maximum: 50
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score (0.0 to 1.0, default: 0.7)',
          minimum: 0.0,
          maximum: 1.0
        }
      },
      required: ['projectId', 'entityId']
    }
  },
  {
    name: 'extract_entities_from_text',
    description: 'Automatically extract and identify entities mentioned in text using AI and vector similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to search for entities in'
        },
        text: {
          type: 'string',
          description: 'The text to extract entities from'
        },
        confidenceThreshold: {
          type: 'number',
          description: 'Minimum confidence threshold for entity extraction (0.0 to 1.0, default: 0.5)',
          minimum: 0.0,
          maximum: 1.0
        },
        maxEntities: {
          type: 'number',
          description: 'Maximum number of entities to extract (default: 20)',
          minimum: 1,
          maximum: 100
        }
      },
      required: ['projectId', 'text']
    }
  },
  {
    name: 'get_entity_recommendations',
    description: 'Get AI-powered recommendations for entities that might be related to a given entity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID containing the entity'
        },
        entityId: {
          type: 'string',
          description: 'The ID of the entity to get recommendations for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recommendations to return (default: 5)',
          minimum: 1,
          maximum: 20
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score for recommendations (default: 0.7)',
          minimum: 0.0,
          maximum: 1.0
        }
      },
      required: ['projectId', 'entityId']
    }
  },
  {
    name: 'vector_search_conversations',
    description: 'Search through conversation history using semantic similarity to find relevant past discussions.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to search conversations in'
        },
        query: {
          type: 'string',
          description: 'The search query to find relevant conversations'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of conversations to return (default: 10)',
          minimum: 1,
          maximum: 50
        },
        minScore: {
          type: 'number',
          description: 'Minimum similarity score (default: 0.5)',
          minimum: 0.0,
          maximum: 1.0
        }
      },
      required: ['projectId', 'query']
    }
  },
  {
    name: 'get_vector_stats',
    description: 'Get statistics about the vector database collections for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get statistics for'
        }
      },
      required: ['projectId']
    }
  }
];

// Tool Handlers

export async function handleSemanticSearchEntities(args: any): Promise<any> {
  try {
    const { projectId, query, type, limit = 10, minScore = 0.5 } = args;

    const results = await vectorEntityService.searchEntities(query, projectId, {
      limit,
      type,
      minScore
    });

    logger.info('Semantic search completed', {
      projectId,
      query: query.substring(0, 100),
      resultsCount: results.length,
      type
    });

    return {
      success: true,
      results: results.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        score: entity.score,
        metadata: entity.metadata
      })),
      metadata: {
        query,
        searchType: 'semantic',
        totalResults: results.length,
        minScore,
        entityType: type
      }
    };

  } catch (error) {
    logger.error('Semantic search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Semantic search failed'
    };
  }
}

export async function handleFindSimilarEntities(args: any): Promise<any> {
  try {
    const { projectId, entityId, limit = 5, minScore = 0.7 } = args;

    const similarEntities = await vectorEntityService.findSimilarEntities(
      entityId,
      projectId,
      limit
    );

    const filteredResults = similarEntities.filter(entity => entity.score >= minScore);

    logger.info('Similar entities found', {
      projectId,
      entityId,
      totalFound: similarEntities.length,
      afterFiltering: filteredResults.length
    });

    return {
      success: true,
      entityId,
      similarEntities: filteredResults.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        score: entity.score,
        relationships: entity.relationships
      })),
      metadata: {
        totalFound: similarEntities.length,
        afterFiltering: filteredResults.length,
        minScore
      }
    };

  } catch (error) {
    logger.error('Find similar entities failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find similar entities'
    };
  }
}

export async function handleExtractEntitiesFromText(args: any): Promise<any> {
  try {
    const { projectId, text, confidenceThreshold = 0.5, maxEntities = 20 } = args;

    // Use the vector entity service to extract entities
    const result = await vectorEntityService.extractEntitiesFromText(text, projectId, {
      minConfidence: confidenceThreshold
    });

    const limitedEntities = result.entities.slice(0, maxEntities);

    logger.info('Entities extracted from text', {
      projectId,
      textLength: text.length,
      entitiesFound: result.entities.length,
      afterLimit: limitedEntities.length
    });

    return {
      success: true,
      extractedEntities: limitedEntities.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        score: entity.score,
        context: 'Extracted from provided text'
      })),
      suggestions: result.suggestions,
      metadata: {
        textLength: text.length,
        totalFound: result.entities.length,
        returned: limitedEntities.length,
        confidenceThreshold
      }
    };

  } catch (error) {
    logger.error('Entity extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract entities from text'
    };
  }
}

export async function handleGetEntityRecommendations(args: any): Promise<any> {
  try {
    const { projectId, entityId, limit = 5, minScore = 0.7 } = args;

    const recommendations = await vectorEntityService.suggestRelationships(
      entityId,
      projectId,
      limit,
      minScore
    );

    logger.info('Entity recommendations generated', {
      projectId,
      entityId,
      recommendationsCount: recommendations.length
    });

    return {
      success: true,
      entityId,
      recommendations: recommendations.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        score: entity.score,
        reason: 'Semantic similarity',
        suggestedRelationType: 'related_to'
      })),
      metadata: {
        totalRecommendations: recommendations.length,
        minScore,
        basedOn: 'vector_similarity'
      }
    };

  } catch (error) {
    logger.error('Entity recommendations failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get entity recommendations'
    };
  }
}

export async function handleVectorSearchConversations(args: any): Promise<any> {
  try {
    const { projectId, query, limit = 10, minScore = 0.5 } = args;

    const results = await qdrantService.searchConversations(query, projectId, limit);
    const filteredResults = results.filter(result => result.score >= minScore);

    logger.info('Conversation vector search completed', {
      projectId,
      query: query.substring(0, 100),
      totalFound: results.length,
      afterFiltering: filteredResults.length
    });

    return {
      success: true,
      conversations: filteredResults.map(result => ({
        id: result.id,
        content: result.payload.content,
        userId: result.payload.userId,
        timestamp: result.payload.timestamp,
        entities: result.payload.entities,
        sessionId: result.payload.sessionId,
        score: result.score
      })),
      metadata: {
        query,
        totalFound: results.length,
        afterFiltering: filteredResults.length,
        minScore
      }
    };

  } catch (error) {
    logger.error('Conversation vector search failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search conversations'
    };
  }
}

export async function handleGetVectorStats(args: any): Promise<any> {
  try {
    const { projectId } = args;

    // Get stats from different collections
    const collections = ['entities', 'conversations', 'context_sessions'];
    const stats = {};

    for (const collection of collections) {
      try {
        const collectionStats = await qdrantService.getCollectionStats(collection);
        
        // Count project-specific points (approximate)
        const projectEntities = await qdrantService.getAllEntities(projectId, 0, 1);
        
        stats[collection] = {
          totalPoints: collectionStats.points_count || 0,
          vectorsCount: collectionStats.vectors_count || 0,
          status: collectionStats.status || 'unknown',
          projectSpecific: collection === 'entities' ? projectEntities.length : 'N/A'
        };
      } catch (error) {
        stats[collection] = {
          status: 'error',
          error: 'Collection not accessible'
        };
      }
    }

    // Get entity stats for the project
    const entityStats = await vectorEntityService.getEntityStats(projectId);

    logger.info('Vector stats retrieved', { projectId, stats });

    return {
      success: true,
      projectId,
      vectorDatabase: {
        status: 'connected',
        collections: stats
      },
      projectStats: {
        totalEntities: entityStats.totalEntities,
        typeDistribution: entityStats.typeDistribution,
        averageRelationships: entityStats.averageRelationships
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Get vector stats failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      args
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vector statistics'
    };
  }
}

// Export handlers map for easy registration
export const vectorSearchHandlers = {
  semantic_search_entities: handleSemanticSearchEntities,
  find_similar_entities: handleFindSimilarEntities,
  extract_entities_from_text: handleExtractEntitiesFromText,
  get_entity_recommendations: handleGetEntityRecommendations,
  vector_search_conversations: handleVectorSearchConversations,
  get_vector_stats: handleGetVectorStats
}; 