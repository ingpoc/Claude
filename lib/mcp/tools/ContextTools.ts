import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { conversationService } from '../../services/ConversationService';
import { contextService } from '../../services/ContextService';
import { logger } from '../../services/Logger';
import type { CreateConversationRequest } from '../../models/Conversation';

/**
 * Context Intelligence Tools for MCP
 * Provides conversation memory, session management, and smart context loading
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
    description: 'Load relevant context for new conversation based on session and topic. Returns recent conversations, relevant entities, suggested actions, and knowledge gaps to make AI context-aware.',
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
          description: 'Optional topic or focus area to filter relevant context'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recent conversations to include (default: 10)'
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Whether to include suggested actions (default: true)'
        },
        include_gaps: {
          type: 'boolean',
          description: 'Whether to include knowledge gaps analysis (default: true)'
        }
      },
      required: ['projectId', 'sessionId']
    }
  },

  {
    name: 'auto_extract_entities',
    description: 'Automatically extract and identify entities mentioned in conversation text. Helps build knowledge graph connections from natural language.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to analyze for entity mentions'
        },
        projectId: {
          type: 'string',
          description: 'Project ID to search for existing entities'
        },
        confidence_threshold: {
          type: 'number',
          description: 'Minimum confidence score for entity extraction (0.0-1.0, default: 0.5)'
        }
      },
      required: ['text', 'projectId']
    }
  },

  {
    name: 'initialize_session',
    description: 'Initialize or resume a context-aware session for intelligent conversation continuity. Enables the AI to pick up where previous conversations left off.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID for the session'
        },
        userId: {
          type: 'string',
          description: 'User identifier for the session'
        },
        sessionId: {
          type: 'string',
          description: 'Optional specific session ID to resume (if not provided, creates new session)'
        }
      },
      required: ['projectId', 'userId']
    }
  },

  {
    name: 'track_entity_interaction',
    description: 'Track user interactions with entities to improve context intelligence. Helps the system understand user focus and suggest relevant actions.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Current session ID'
        },
        projectId: {
          type: 'string',
          description: 'Project ID containing the entity'
        },
        entityId: {
          type: 'string',
          description: 'ID of the entity being interacted with'
        },
        interactionType: {
          type: 'string',
          enum: ['view', 'edit', 'create', 'delete', 'relate'],
          description: 'Type of interaction with the entity'
        }
      },
      required: ['sessionId', 'projectId', 'entityId', 'interactionType']
    }
  },

  {
    name: 'search_conversation_history',
    description: 'Search through conversation history to find relevant past discussions. Enables AI to reference previous conversations and build on prior context.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to search within'
        },
        query: {
          type: 'string',
          description: 'Search query to find relevant conversations'
        },
        sessionId: {
          type: 'string',
          description: 'Optional: limit search to specific session'
        },
        dateFrom: {
          type: 'string',
          description: 'Optional: search from this date (ISO format)'
        },
        dateTo: {
          type: 'string',
          description: 'Optional: search until this date (ISO format)'
        },
        entityIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: limit search to conversations involving these entities'
        }
      },
      required: ['projectId', 'query']
    }
  },

  {
    name: 'update_session_state',
    description: 'Update session state with current user goals, topics, and context. Helps maintain conversation continuity and context awareness.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to update'
        },
        projectId: {
          type: 'string',
          description: 'Project ID for the session'
        },
        currentTopic: {
          type: 'string',
          description: 'Current conversation topic or focus'
        },
        userGoals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Current user goals or objectives'
        },
        pendingQuestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions that need to be answered'
        },
        workflowState: {
          type: 'string',
          description: 'Current workflow or process state'
        }
      },
      required: ['sessionId', 'projectId']
    }
  },

  {
    name: 'get_smart_suggestions',
    description: 'Get AI-powered suggestions for next actions based on current context and conversation history. Helps guide users toward productive next steps.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to generate suggestions for'
        },
        projectId: {
          type: 'string',
          description: 'Project ID to analyze'
        },
        includeEntitySuggestions: {
          type: 'boolean',
          description: 'Include suggestions for entity creation/editing (default: true)'
        },
        includeRelationshipSuggestions: {
          type: 'boolean',
          description: 'Include suggestions for relationship creation (default: true)'
        },
        includeWorkflowSuggestions: {
          type: 'boolean',
          description: 'Include workflow and process suggestions (default: true)'
        }
      },
      required: ['sessionId', 'projectId']
    }
  },

  {
    name: 'end_session',
    description: 'Properly end a context session and save final state. Ensures conversation context is preserved for future sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to end'
        },
        projectId: {
          type: 'string',
          description: 'Project ID for the session'
        },
        sessionSummary: {
          type: 'string',
          description: 'Optional summary of what was accomplished in this session'
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
    
    logger.info('Conversation context added successfully', { 
      conversationId: conversation.id,
      projectId: args.projectId,
      sessionId: args.sessionId 
    });

    return {
      success: true,
      conversationId: conversation.id,
      message: 'Conversation context stored successfully',
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
    const context = await conversationService.getConversationContext(
      args.projectId,
      args.sessionId,
      args.topic,
      args.limit || 10
    );

    // Enhance with additional suggestions if requested
    if (args.include_suggestions !== false) {
      const session = await contextService.getSession(args.sessionId, args.projectId);
      if (session) {
        // Context already includes suggestions from conversation service
      }
    }

    logger.info('Conversation context loaded', { 
      projectId: args.projectId,
      sessionId: args.sessionId,
      entitiesCount: context.relevantEntities.length,
      conversationsCount: context.recentConversations.length
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
          extractedEntities: c.extractedEntityIds
        })),
        sessionSummary: context.sessionSummary,
        userIntent: context.userIntent,
        suggestedActions: context.suggestedActions,
        knowledgeGaps: args.include_gaps !== false ? context.knowledgeGaps : []
      }
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
    const mentions = await conversationService.autoExtractEntities(
      args.text,
      args.projectId
    );

    const threshold = args.confidence_threshold || 0.5;
    const filteredMentions = mentions.filter(m => m.confidence >= threshold);

    logger.info('Auto-extracted entity mentions', { 
      projectId: args.projectId,
      totalMentions: mentions.length,
      filteredMentions: filteredMentions.length,
      threshold 
    });

    return {
      success: true,
      entities: filteredMentions.map(mention => ({
        entityId: mention.entityId,
        text: mention.text,
        confidence: mention.confidence,
        startOffset: mention.startOffset,
        endOffset: mention.endOffset,
        context: mention.context
      })),
      totalFound: mentions.length,
      aboveThreshold: filteredMentions.length
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