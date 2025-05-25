import { v4 as uuidv4 } from 'uuid';
import { qdrantDataService } from './QdrantDataService';
import { logger } from './Logger';
import type {
  Conversation,
  CreateConversationRequest,
  ConversationFilter,
  ConversationSearchResult,
  Context,
  ContextSession,
  EntityMention
} from '../models/Conversation';

class ConversationService {
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CONTEXT_CONVERSATIONS = 10;
  private readonly MIN_RELEVANCE_SCORE = 0.3;

  // Cache for conversation contexts
  private contextCache = new Map<string, { data: Context; timestamp: number }>();

  /**
   * Create a new conversation entry
   * Note: Simplified implementation after DatabaseService removal
   */
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    try {
      const id = uuidv4();
      const timestamp = new Date();
      
      const conversation: Conversation = {
        id,
        projectId: request.projectId,
        sessionId: request.sessionId,
        userMessage: request.userMessage,
        aiResponse: request.aiResponse,
        extractedEntityIds: request.extractedEntityIds || [],
        timestamp,
        contextUsed: request.contextUsed || [],
        messageType: 'assistant',
        intent: request.intent,
        confidence: 0.8,
        metadata: request.metadata || {}
      };

      // TODO: Store conversation in Qdrant conversations collection
      logger.warn('ConversationService.createConversation - Using simplified implementation after DatabaseService removal');

      logger.info('Conversation created', { 
        conversationId: id, 
        projectId: request.projectId,
        sessionId: request.sessionId 
      });

      return conversation;

    } catch (error) {
      logger.error('Failed to create conversation', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        request 
      });
      throw new Error(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation context for a session/topic
   * Note: Simplified implementation after DatabaseService removal
   */
  async getConversationContext(
    projectId: string,
    sessionId: string,
    topic?: string,
    limit: number = this.MAX_CONTEXT_CONVERSATIONS
  ): Promise<Context> {
    const cacheKey = `context:${projectId}:${sessionId}:${topic || 'general'}:${limit}`;
    
    try {
      // Check cache first
      const cachedEntry = this.contextCache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < this.CACHE_TTL) {
        logger.debug('Context loaded from cache', { projectId, sessionId, topic });
        return cachedEntry.data;
      }

      // TODO: Implement with QdrantDataService
      logger.warn('ConversationService.getConversationContext - Using simplified implementation after DatabaseService removal');
      const conversations: Conversation[] = [];
      const entityIds: string[] = [];
      
      // Build simplified context
      const context: Context = {
        sessionId,
        relevantEntities: entityIds,
        recentConversations: conversations,
        sessionSummary: undefined,
        userIntent: undefined,
        suggestedActions: ['Explore project entities', 'Create new relationships'],
        knowledgeGaps: []
      };

      // Cache the context
      this.contextCache.set(cacheKey, {
        data: context,
        timestamp: Date.now()
      });

      logger.info('Context generated', { 
        projectId, 
        sessionId, 
        entitiesCount: entityIds.length,
        conversationsCount: conversations.length 
      });

      return context;

    } catch (error) {
      logger.error('Failed to get conversation context', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        sessionId 
      });
      throw new Error(`Failed to get conversation context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search conversations by content and context
   * Note: Simplified implementation after DatabaseService removal
   */
  async searchConversations(
    projectId: string,
    query: string,
    filters?: ConversationFilter
  ): Promise<ConversationSearchResult[]> {
    try {
      // TODO: Implement proper search with QdrantDataService
      logger.warn('ConversationService.searchConversations - Using simplified implementation after DatabaseService removal');
      
      const searchResults: ConversationSearchResult[] = [];

      logger.info('Conversation search completed', { 
        projectId, 
        query, 
        resultsCount: searchResults.length 
      });

      return searchResults;

    } catch (error) {
      logger.error('Failed to search conversations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId, 
        query 
      });
      throw new Error(`Failed to search conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-extract entities from conversation text
   * Note: Simplified implementation after DatabaseService removal
   */
  async autoExtractEntities(
    text: string,
    projectId: string,
    existingEntityIds: string[] = []
  ): Promise<EntityMention[]> {
    try {
      // TODO: Implement entity extraction with QdrantDataService
      logger.warn('ConversationService.autoExtractEntities - Using simplified implementation after DatabaseService removal');
      
      return [];

    } catch (error) {
      logger.error('Failed to auto-extract entities', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId 
      });
      return [];
    }
  }

  /**
   * Invalidate conversation caches
   */
  private invalidateConversationCaches(projectId: string, sessionId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.contextCache.keys()) {
      if (key.includes(projectId) && key.includes(sessionId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.contextCache.delete(key));
    
    logger.debug('Conversation caches invalidated', { 
      projectId, 
      sessionId, 
      keysDeleted: keysToDelete.length 
    });
  }
}

export const conversationService = new ConversationService(); 