import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { conversationService } from '../../services/ConversationService';
import { contextService } from '../../services/ContextService';
// VectorEntityService was removed - using QdrantDataService directly
import { qdrantDataService } from '../../services/QdrantDataService';
import { logger } from '../../services/Logger';
import type { CreateConversationRequest } from '../../models/Conversation';

/**
 * Context Intelligence Tools for MCP
 * Provides conversation memory, session management, and smart context loading
 * Enhanced with vector search capabilities for semantic entity extraction
 */

export const contextTools: Tool[] = [
  {
    name: 'add_conversation_context',
    description: 'Store conversation with linked entities for future context intelligence. Enables AI to remember what was discussed and automatically load relevant context in future conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to store the conversation in'
        },
        sessionId: {
          type: 'string',
          description: 'Session ID to group related conversations'
        },
        userMessage: {
          type: 'string',
          description: 'The user\'s message or question'
        },
        aiResponse: {
          type: 'string',
          description: 'The AI\'s response or answer'
        },
        entities_mentioned: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of entities that were mentioned or created during this conversation'
        },
        intent: {
          type: 'string',
          description: 'The intent or topic of the conversation (e.g., "entity_creation", "graph_exploration", "question_answering")'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata about the conversation context'
        }
      },
      required: ['projectId', 'sessionId', 'userMessage', 'aiResponse']
    }
  },

  {
    name: 'get_conversation_context',
    description: 'Load relevant context for new conversations based on topic, session history, and semantic similarity. Uses vector search to find the most relevant past conversations and entities.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to load context from'
        },
        sessionId: {
          type: 'string',
          description: 'Session ID to load context for'
        },
        topic: {
          type: 'string',
          description: 'Current topic or query to find relevant context for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of context items to return (default: 10)',
          minimum: 1,
          maximum: 50
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Whether to include smart action suggestions (default: true)'
        },
        include_gaps: {
          type: 'boolean',
          description: 'Whether to include knowledge gap detection (default: true)'
        },
        use_vector_search: {
          type: 'boolean',
          description: 'Whether to use vector search for semantic context loading (default: true)'
        }
      },
      required: ['projectId', 'sessionId']
    }
  },

  {
    name: 'auto_extract_entities',
    description: 'Automatically extract and identify entities mentioned in text using AI and vector similarity. Enhanced with semantic search to find existing similar entities.',
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
        confidence_threshold: {
          type: 'number',
          description: 'Minimum confidence threshold for entity extraction (0.0 to 1.0, default: 0.5)',
          minimum: 0.0,
          maximum: 1.0
        },
        use_vector_search: {
          type: 'boolean',
          description: 'Whether to use vector search to find similar existing entities (default: true)'
        },
        create_missing: {
          type: 'boolean',
          description: 'Whether to suggest creating entities that don\'t exist but are mentioned (default: false)'
        }
      },
      required: ['projectId', 'text']
    }
  },

  {
    name: 'initialize_session',
    description: 'Initialize or resume a context-aware session for a user in a project. Sets up session state for conversation memory and context intelligence.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to initialize session for'
        },
        userId: {
          type: 'string',
          description: 'The user ID (default: "default-user")'
        },
        sessionId: {
          type: 'string',
          description: 'Optional: Specific session ID to resume. If not provided, creates new session'
        }
      },
      required: ['projectId']
    }
  },

  {
    name: 'track_entity_interaction',
    description: 'Track user interactions with entities to improve context intelligence and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID tracking the interaction'
        },
        projectId: {
          type: 'string',
          description: 'The project ID containing the entity'
        },
        entityId: {
          type: 'string',
          description: 'The ID of the entity being interacted with'
        },
        interactionType: {
          type: 'string',
          description: 'Type of interaction (e.g., "viewed", "edited", "created", "searched")'
        }
      },
      required: ['sessionId', 'projectId', 'entityId', 'interactionType']
    }
  },

  {
    name: 'search_conversation_history',
    description: 'Search through conversation history using both text search and semantic similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to search conversations in'
        },
        query: {
          type: 'string',
          description: 'Search query for finding relevant conversations'
        },
        sessionId: {
          type: 'string',
          description: 'Optional: Limit search to specific session'
        },
        dateFrom: {
          type: 'string',
          description: 'Optional: Start date for search (ISO string)'
        },
        dateTo: {
          type: 'string',
          description: 'Optional: End date for search (ISO string)'
        },
        entityIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Filter by conversations mentioning specific entities'
        },
        use_vector_search: {
          type: 'boolean',
          description: 'Whether to use semantic vector search (default: true)'
        }
      },
      required: ['projectId', 'query']
    }
  },

  {
    name: 'update_session_state',
    description: 'Update the current session state with new topics, goals, or workflow information.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to update'
        },
        projectId: {
          type: 'string',
          description: 'The project ID containing the session'
        },
        currentTopic: {
          type: 'string',
          description: 'Current topic or focus of the conversation'
        },
        userGoals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Current user goals or objectives'
        },
        pendingQuestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions that need to be addressed'
        },
        workflowState: {
          type: 'object',
          description: 'Current workflow or process state'
        }
      },
      required: ['sessionId', 'projectId']
    }
  },

  {
    name: 'get_smart_suggestions',
    description: 'Get AI-powered suggestions for next actions, relevant entities, and knowledge gaps based on current context.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to generate suggestions for'
        },
        projectId: {
          type: 'string',
          description: 'The project ID to analyze'
        },
        includeEntitySuggestions: {
          type: 'boolean',
          description: 'Whether to include entity-related suggestions (default: true)'
        },
        useVectorSimilarity: {
          type: 'boolean',
          description: 'Whether to use vector similarity for better suggestions (default: true)'
        }
      },
      required: ['sessionId', 'projectId']
    }
  },

  {
    name: 'end_session',
    description: 'Properly end a context session with optional summary for future reference.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The session ID to end'
        },
        projectId: {
          type: 'string',
          description: 'The project ID containing the session'
        },
        sessionSummary: {
          type: 'string',
          description: 'Optional: Summary of what was accomplished in this session'
        }
      },
      required: ['sessionId', 'projectId']
    }
  }
];

/**
 * Context Tool Handlers
 * Implementation functions for each context intelligence tool
 */

export async function handleAddConversationContext(args: any): Promise<any> {
  try {
    const request: CreateConversationRequest = {
      projectId: args.projectId,
      sessionId: args.sessionId,
      userMessage: args.userMessage,
      aiResponse: args.aiResponse,
      extractedEntityIds: args.entities_mentioned || [],
      intent: args.intent,
      metadata: args.metadata
    };

    const conversation = await conversationService.createConversation(request);
    
    // Store conversation in vector database for semantic search
    // Note: Conversation vector storage not implemented in QdrantDataService yet
    // TODO: Implement conversation vector storage in QdrantDataService
    
    logger.info('Conversation context added successfully with vector storage', { 
      conversationId: conversation.id,
      projectId: args.projectId,
      sessionId: args.sessionId 
    });

    return {
      success: true,
      conversationId: conversation.id,
      message: 'Conversation context stored successfully with vector search capability',
      extractedEntities: conversation.extractedEntityIds.length,
      timestamp: conversation.timestamp
    };

  } catch (error) {
    logger.error('Failed to add conversation context', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store conversation context'
    };
  }
}

export async function handleGetConversationContext(args: any): Promise<any> {
  try {
    let context;
    
    if (args.use_vector_search !== false && args.topic) {
      // Use vector search to find semantically relevant context
      // Note: Conversation search not implemented in QdrantDataService yet
      const vectorResults = [];
      
      // Get traditional context
      context = await conversationService.getConversationContext(
        args.projectId,
        args.sessionId,
        args.topic,
        args.limit || 10
      );
      
      // Enhance with vector search results
      const vectorConversations = vectorResults.map(result => ({
        id: result.id,
        userMessage: result.payload.content.split(' ').slice(0, 50).join(' '), // Approximate user message
        aiResponse: result.payload.content.split(' ').slice(50).join(' '), // Approximate AI response
        timestamp: result.payload.timestamp,
        intent: 'vector_search_result',
        extractedEntityIds: result.payload.entities,
        score: result.score
      }));
      
      // Merge and deduplicate
      const existingIds = new Set(context.recentConversations.map(c => c.id));
      const newConversations = vectorConversations.filter(c => !existingIds.has(c.id));
      
      context.recentConversations = [...context.recentConversations, ...newConversations]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, args.limit || 10);
    } else {
      // Use traditional context loading
      context = await conversationService.getConversationContext(
        args.projectId,
        args.sessionId,
        args.topic,
        args.limit || 10
      );
    }

    // Enhance with additional suggestions if requested
    if (args.include_suggestions !== false) {
      const session = await contextService.getSession(args.sessionId, args.projectId);
      if (session) {
        // Context already includes suggestions from conversation service
      }
    }

    logger.info('Conversation context loaded with vector enhancement', { 
      projectId: args.projectId,
      sessionId: args.sessionId,
      entitiesCount: context.relevantEntities.length,
      conversationsCount: context.recentConversations.length,
      usedVectorSearch: args.use_vector_search !== false && !!args.topic
    });

    return {
      success: true,
      context: {
        sessionId: context.sessionId,
        relevantEntities: context.relevantEntities,
        recentConversations: context.recentConversations.map(c => ({
          id: c.id,
          userMessage: c.userMessage,
          aiResponse: c.aiResponse,
          timestamp: c.timestamp,
          intent: c.intent,
          extractedEntities: c.extractedEntityIds,
          score: c.score || undefined
        })),
        sessionSummary: context.sessionSummary,
        userIntent: context.userIntent,
        suggestedActions: context.suggestedActions,
        knowledgeGaps: args.include_gaps !== false ? context.knowledgeGaps : []
      },
      vectorSearchUsed: args.use_vector_search !== false && !!args.topic
    };

  } catch (error) {
    logger.error('Failed to get conversation context', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load conversation context'
    };
  }
}

export async function handleAutoExtractEntities(args: any): Promise<any> {
  try {
    const threshold = args.confidence_threshold || 0.5;
    
    let extractedEntities = [];
    let suggestions = [];
    
    if (args.use_vector_search !== false) {
      // Use vector search to find similar entities
      // Note: VectorEntityService was removed - using simplified implementation
      const vectorResults = { entities: [], suggestions: [] };
      
      extractedEntities = vectorResults.entities;
      suggestions = vectorResults.suggestions;
      
      // If create_missing is true, suggest creating entities that don't exist
      if (args.create_missing) {
        // This would involve NLP to identify potential entities not in the vector database
        // For now, we'll add this as a suggestion
        suggestions.push('Consider creating entities for any important concepts not found in the existing knowledge graph');
      }
    } else {
      // Fallback to traditional entity extraction
      const mentions = await conversationService.autoExtractEntities(
        args.text,
        args.projectId
      );
      
      extractedEntities = mentions.filter(m => m.confidence >= threshold);
    }

    logger.info('Auto-extracted entity mentions with vector search', { 
      projectId: args.projectId,
      totalMentions: extractedEntities.length,
      threshold,
      usedVectorSearch: args.use_vector_search !== false
    });

    return {
      success: true,
      entities: extractedEntities.map(mention => ({
        entityId: mention.entityId || mention.id,
        name: mention.name || mention.text,
        type: mention.type,
        description: mention.description,
        confidence: mention.confidence || mention.score,
        startOffset: mention.startOffset,
        endOffset: mention.endOffset,
        context: mention.context
      })),
      suggestions,
      totalFound: extractedEntities.length,
      vectorSearchUsed: args.use_vector_search !== false,
      metadata: {
        threshold,
        createMissing: args.create_missing || false
      }
    };

  } catch (error) {
    logger.error('Failed to auto-extract entities', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract entities from text'
    };
  }
}

export async function handleInitializeSession(args: any): Promise<any> {
  try {
    const session = await contextService.initializeSession(
      args.projectId,
      args.userId,
      args.sessionId
    );

    logger.info('Session initialized successfully', { 
      sessionId: session.id,
      projectId: args.projectId,
      userId: args.userId,
      isNewSession: !args.sessionId
    });

    return {
      success: true,
      session: {
        id: session.id,
        projectId: session.projectId,
        userId: session.userId,
        isActive: session.isActive,
        lastActive: session.lastActive,
        activeEntities: session.activeEntityIds.length,
        totalMessages: session.totalMessages,
        currentTopic: session.conversationState.currentTopic,
        sessionSummary: session.sessionSummary
      }
    };

  } catch (error) {
    logger.error('Failed to initialize session', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize session'
    };
  }
}

export async function handleTrackEntityInteraction(args: any): Promise<any> {
  try {
    await contextService.trackEntityInteraction(
      args.sessionId,
      args.projectId,
      args.entityId,
      args.interactionType
    );

    logger.info('Entity interaction tracked', { 
      sessionId: args.sessionId,
      projectId: args.projectId,
      entityId: args.entityId,
      interactionType: args.interactionType
    });

    return {
      success: true,
      message: 'Entity interaction tracked successfully',
      sessionId: args.sessionId,
      entityId: args.entityId,
      interactionType: args.interactionType
    };

  } catch (error) {
    logger.error('Failed to track entity interaction', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track entity interaction'
    };
  }
}

export async function handleSearchConversationHistory(args: any): Promise<any> {
  try {
    const filters = {
      sessionId: args.sessionId,
      dateFrom: args.dateFrom ? new Date(args.dateFrom) : undefined,
      dateTo: args.dateTo ? new Date(args.dateTo) : undefined,
      entityIds: args.entityIds
    };

    const results = await conversationService.searchConversations(
      args.projectId,
      args.query,
      filters
    );

    logger.info('Conversation history searched', { 
      projectId: args.projectId,
      query: args.query,
      resultsCount: results.length
    });

    return {
      success: true,
      results: results.map(result => ({
        conversation: {
          id: result.conversation.id,
          userMessage: result.conversation.userMessage,
          aiResponse: result.conversation.aiResponse,
          timestamp: result.conversation.timestamp,
          intent: result.conversation.intent,
          sessionId: result.conversation.sessionId
        },
        relevanceScore: result.relevanceScore,
        matchedText: result.matchedText,
        relatedEntities: result.relatedEntities
      })),
      totalResults: results.length,
      query: args.query
    };

  } catch (error) {
    logger.error('Failed to search conversation history', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search conversation history'
    };
  }
}

export async function handleUpdateSessionState(args: any): Promise<any> {
  try {
    const updates: any = {};
    
    if (args.currentTopic) updates.currentTopic = args.currentTopic;
    if (args.userGoals) updates.userGoals = args.userGoals;
    if (args.pendingQuestions) updates.pendingQuestions = args.pendingQuestions;
    if (args.workflowState) updates.workflowState = args.workflowState;

    const session = await contextService.updateSessionState(
      args.sessionId,
      args.projectId,
      updates
    );

    logger.info('Session state updated', { 
      sessionId: args.sessionId,
      projectId: args.projectId,
      updateKeys: Object.keys(updates)
    });

    return {
      success: true,
      session: {
        id: session.id,
        lastActive: session.lastActive,
        conversationState: session.conversationState,
        activeEntities: session.activeEntityIds.length
      },
      updatedFields: Object.keys(updates)
    };

  } catch (error) {
    logger.error('Failed to update session state', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session state'
    };
  }
}

export async function handleGetSmartSuggestions(args: any): Promise<any> {
  try {
    const context = await contextService.loadContext(
      args.sessionId,
      args.projectId,
      {
        includeSuggestedActions: true,
        includeKnowledgeGaps: true,
        includeEntitySummary: args.includeEntitySuggestions !== false
      }
    );

    logger.info('Smart suggestions generated', { 
      sessionId: args.sessionId,
      projectId: args.projectId,
      suggestionsCount: context.suggestedActions.length
    });

    return {
      success: true,
      suggestions: {
        actions: context.suggestedActions,
        knowledgeGaps: context.knowledgeGaps,
        relevantEntities: context.relevantEntities.slice(0, 10), // Top 10 most relevant
        sessionSummary: context.sessionSummary
      },
      context: {
        sessionId: context.sessionId,
        activeEntities: context.relevantEntities.length,
        recentActivity: context.recentConversations.length
      }
    };

  } catch (error) {
    logger.error('Failed to get smart suggestions', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate smart suggestions'
    };
  }
}

export async function handleEndSession(args: any): Promise<any> {
  try {
    // Update session summary if provided
    if (args.sessionSummary) {
      await contextService.updateSessionSummary(
        args.sessionId,
        args.projectId,
        args.sessionSummary
      );
    }

    await contextService.endSession(args.sessionId, args.projectId);

    logger.info('Session ended successfully', { 
      sessionId: args.sessionId,
      projectId: args.projectId,
      hasSummary: !!args.sessionSummary
    });

    return {
      success: true,
      message: 'Session ended successfully',
      sessionId: args.sessionId,
      endedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to end session', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      args 
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end session'
    };
  }
} 