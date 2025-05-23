import { v4 as uuidv4 } from 'uuid';
import { databaseService, type QueryParams } from './DatabaseService';
import { logger } from './Logger';
import type {
  Conversation,
  ContextSession,
  ConversationEntityLink,
  CreateConversationRequest,
  ConversationFilter,
  ConversationSearchResult,
  Context,
  EntityMention
} from '../models/Conversation';

class ConversationService {
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CONTEXT_CONVERSATIONS = 10;
  private readonly MIN_RELEVANCE_SCORE = 0.3;

  // Simple in-memory cache for conversation context
  private contextCache = new Map<string, { data: Context; timestamp: number }>();

  /**
   * Store a new conversation with automatic entity linking
   */
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    const id = uuidv4();
    const timestamp = new Date();

    const conversation: Conversation = {
      id,
      timestamp,
      messageType: 'assistant',
      confidence: 0.8,
      extractedEntityIds: request.extractedEntityIds || [],
      contextUsed: request.contextUsed || [],
      ...request
    };

    try {
      // Store conversation in database
      const query = `
        CREATE (c:Conversation {
          id: $id,
          projectId: $projectId,
          sessionId: $sessionId,
          userMessage: $userMessage,
          aiResponse: $aiResponse,
          extractedEntityIds: $extractedEntityIds,
          timestamp: $timestamp,
          contextUsed: $contextUsed,
          messageType: $messageType,
          intent: $intent,
          confidence: $confidence,
          metadata: $metadata
        })
        RETURN c
      `;

      const params: QueryParams = {
        id,
        projectId: request.projectId,
        sessionId: request.sessionId,
        userMessage: request.userMessage,
        aiResponse: request.aiResponse,
        extractedEntityIds: request.extractedEntityIds || [],
        timestamp: timestamp.toISOString(),
        contextUsed: request.contextUsed || [],
        messageType: 'assistant',
        intent: request.intent,
        confidence: conversation.confidence,
        metadata: JSON.stringify(request.metadata || {})
      };

      await databaseService.executeQuery(request.projectId, query, params);

      // Create entity links if entities were extracted
      if (request.extractedEntityIds?.length) {
        await this.createEntityLinks(request.projectId, id, request.extractedEntityIds, 'manual', 0.9);
      }

      // Update session activity
      await this.updateSessionActivity(request.sessionId, request.projectId);

      // Invalidate relevant caches
      this.invalidateConversationCaches(request.projectId, request.sessionId);

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

      // Get recent conversations
      const conversations = await this.getConversations(projectId, {
        sessionId,
        limit
      });

      // Get relevant entities from conversations
      const entityIds = [...new Set(
        conversations.flatMap(c => c.extractedEntityIds)
      )];

      // Get session summary if available
      const session = await this.getSession(sessionId, projectId);
      
      // Build context
      const context: Context = {
        sessionId,
        relevantEntities: entityIds,
        recentConversations: conversations,
        sessionSummary: session?.sessionSummary,
        userIntent: session?.conversationState.currentTopic,
        suggestedActions: this.generateSuggestedActions(conversations),
        knowledgeGaps: await this.detectKnowledgeGaps(conversations, projectId)
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
   */
  async searchConversations(
    projectId: string,
    query: string,
    filters?: ConversationFilter
  ): Promise<ConversationSearchResult[]> {
    try {
      const cypherQuery = `
        MATCH (c:Conversation)
        WHERE c.projectId = $projectId
        ${filters?.sessionId ? 'AND c.sessionId = $sessionId' : ''}
        ${filters?.dateFrom ? 'AND datetime(c.timestamp) >= datetime($dateFrom)' : ''}
        ${filters?.dateTo ? 'AND datetime(c.timestamp) <= datetime($dateTo)' : ''}
        AND (
          toLower(c.userMessage) CONTAINS toLower($query) OR
          toLower(c.aiResponse) CONTAINS toLower($query) OR
          toLower(coalesce(c.intent, '')) CONTAINS toLower($query)
        )
        RETURN c
        ORDER BY c.timestamp DESC
        LIMIT 50
      `;

      const params: QueryParams = {
        projectId,
        query,
        sessionId: filters?.sessionId,
        dateFrom: filters?.dateFrom?.toISOString(),
        dateTo: filters?.dateTo?.toISOString()
      };

      const result = await databaseService.executeQuery(projectId, cypherQuery, params);
      
      if (!result) {
        return [];
      }

      const searchResults: ConversationSearchResult[] = [];
      while ((result as any).hasNext()) {
        const record = (result as any).getNextSync();
        const conversation = this.mapRowToConversation(record.c);
        const relevanceScore = this.calculateRelevanceScore(conversation, query);
        const matchedText = this.extractMatchedText(conversation, query);
        
        searchResults.push({
          conversation,
          relevanceScore,
          matchedText,
          relatedEntities: conversation.extractedEntityIds
        });
      }

      // Sort by relevance score
      searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

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
   */
  async autoExtractEntities(
    text: string,
    projectId: string,
    existingEntityIds: string[] = []
  ): Promise<EntityMention[]> {
    try {
      // Simple pattern-based extraction for now
      // In Phase 2, this will be enhanced with LLM-based extraction
      const entityMentions: EntityMention[] = [];
      
      // Get existing entities to match against
      const existingEntities = await this.getExistingEntities(projectId);
      
      for (const entity of existingEntities) {
        const regex = new RegExp(`\\b${entity.name}\\b`, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          entityMentions.push({
            entityId: entity.id,
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            text: match[0],
            confidence: 0.8, // Pattern matching confidence
            context: this.extractContext(text, match.index, 50)
          });
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueMentions = this.deduplicateEntityMentions(entityMentions);
      
      logger.info('Auto-extracted entity mentions', { 
        projectId, 
        textLength: text.length,
        mentionsCount: uniqueMentions.length 
      });

      return uniqueMentions;

    } catch (error) {
      logger.error('Failed to auto-extract entities', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId 
      });
      return [];
    }
  }

  /**
   * Get conversations with filtering and pagination
   */
  private async getConversations(
    projectId: string,
    filters: ConversationFilter & { limit?: number } = {}
  ): Promise<Conversation[]> {
    const query = `
      MATCH (c:Conversation)
      WHERE c.projectId = $projectId
      ${filters.sessionId ? 'AND c.sessionId = $sessionId' : ''}
      ${filters.dateFrom ? 'AND datetime(c.timestamp) >= datetime($dateFrom)' : ''}
      ${filters.dateTo ? 'AND datetime(c.timestamp) <= datetime($dateTo)' : ''}
      RETURN c
      ORDER BY c.timestamp DESC
      ${filters.limit ? `LIMIT ${filters.limit}` : ''}
    `;

    const params: QueryParams = {
      projectId,
      sessionId: filters.sessionId,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString()
    };

    const result = await databaseService.executeQuery(projectId, query, params);
    
    if (!result) {
      return [];
    }

    const conversations: Conversation[] = [];
    while ((result as any).hasNext()) {
      const record = (result as any).getNextSync();
      conversations.push(this.mapRowToConversation(record.c));
    }

    return conversations;
  }

  /**
   * Create entity links for a conversation
   */
  private async createEntityLinks(
    projectId: string,
    conversationId: string,
    entityIds: string[],
    extractionMethod: 'manual' | 'auto' | 'llm' | 'pattern',
    confidence: number
  ): Promise<void> {
    const extractedAt = new Date();

    for (const entityId of entityIds) {
      const query = `
        CREATE (cel:ConversationEntityLink {
          conversationId: $conversationId,
          entityId: $entityId,
          relevanceScore: $relevanceScore,
          extractionMethod: $extractionMethod,
          confidence: $confidence,
          extractedAt: $extractedAt
        })
      `;

      const params: QueryParams = {
        conversationId,
        entityId,
        relevanceScore: confidence,
        extractionMethod,
        confidence,
        extractedAt: extractedAt.toISOString()
      };

      await databaseService.executeQuery(projectId, query, params);
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string, projectId: string): Promise<void> {
    const query = `
      MERGE (s:ContextSession {id: $sessionId, projectId: $projectId})
      SET s.lastActive = $lastActive,
          s.isActive = true
    `;

    const params: QueryParams = {
      sessionId,
      projectId,
      lastActive: new Date().toISOString()
    };

    await databaseService.executeQuery(projectId, query, params);
  }

  /**
   * Get session information
   */
  private async getSession(sessionId: string, projectId: string): Promise<ContextSession | null> {
    const query = `
      MATCH (s:ContextSession)
      WHERE s.id = $sessionId AND s.projectId = $projectId
      RETURN s
    `;

    const result = await databaseService.executeQuery(projectId, query, { sessionId, projectId });
    
    if (!result || !(result as any).hasNext()) {
      return null;
    }

    const record = (result as any).getNextSync();
    return this.mapRowToSession(record.s);
  }

  /**
   * Generate suggested actions based on conversation history
   */
  private generateSuggestedActions(conversations: Conversation[]): string[] {
    const actions: string[] = [];
    
    if (conversations.length === 0) {
      actions.push('Start exploring the project structure');
      actions.push('Create your first entity or relationship');
      return actions;
    }

    // Analyze recent conversations for patterns
    const recentTopics = conversations
      .filter(c => c.intent)
      .map(c => c.intent!)
      .slice(0, 5);

    if (recentTopics.includes('entity_creation')) {
      actions.push('Add relationships between recent entities');
    }
    
    if (recentTopics.includes('graph_exploration')) {
      actions.push('Export current graph view');
      actions.push('Create documentation from graph');
    }

    return actions;
  }

  /**
   * Detect knowledge gaps in conversations
   */
  private async detectKnowledgeGaps(
    conversations: Conversation[],
    projectId: string
  ): Promise<string[]> {
    const gaps: string[] = [];
    
    // Simple gap detection - in Phase 2 this will be enhanced with LLM analysis
    const mentionedEntities = new Set(
      conversations.flatMap(c => c.extractedEntityIds)
    );

    if (mentionedEntities.size > 5) {
      gaps.push('Consider adding more relationships between entities');
    }

    if (conversations.some(c => c.userMessage.includes('how') || c.userMessage.includes('why'))) {
      gaps.push('Add more detailed descriptions to entities');
    }

    return gaps;
  }

  /**
   * Helper methods for data transformation and utilities
   */
  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      projectId: row.projectId,
      sessionId: row.sessionId,
      userMessage: row.userMessage,
      aiResponse: row.aiResponse,
      extractedEntityIds: row.extractedEntityIds || [],
      timestamp: new Date(row.timestamp),
      contextUsed: row.contextUsed || [],
      messageType: row.messageType || 'assistant',
      intent: row.intent,
      confidence: row.confidence || 0.8,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  private mapRowToSession(row: any): ContextSession {
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      lastActive: new Date(row.lastActive),
      sessionSummary: row.sessionSummary,
      activeEntityIds: row.activeEntityIds || [],
      conversationState: row.conversationState ? JSON.parse(row.conversationState) : {
        userGoals: [],
        recentEntities: [],
        pendingQuestions: [],
        contextWindow: []
      },
      totalMessages: row.totalMessages || 0,
      isActive: row.isActive || false,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  private calculateRelevanceScore(conversation: Conversation, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Check user message
    if (conversation.userMessage.toLowerCase().includes(lowerQuery)) {
      score += 0.5;
    }

    // Check AI response
    if (conversation.aiResponse.toLowerCase().includes(lowerQuery)) {
      score += 0.3;
    }

    // Check intent
    if (conversation.intent?.toLowerCase().includes(lowerQuery)) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private extractMatchedText(conversation: Conversation, query: string): string[] {
    const matches: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Extract context around matches
    [conversation.userMessage, conversation.aiResponse].forEach(text => {
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(lowerQuery);
      if (index !== -1) {
        const start = Math.max(0, index - 30);
        const end = Math.min(text.length, index + query.length + 30);
        matches.push(text.substring(start, end));
      }
    });

    return matches;
  }

  private async getExistingEntities(projectId: string): Promise<Array<{id: string, name: string}>> {
    const query = `
      MATCH (e:Entity)
      WHERE e.projectId = $projectId
      RETURN e.id as id, e.name as name
    `;

    const result = await databaseService.executeQuery(projectId, query, { projectId });
    
    if (!result) {
      return [];
    }

    const entities: Array<{id: string, name: string}> = [];
    while ((result as any).hasNext()) {
      const record = (result as any).getNextSync();
      entities.push({ id: record.id, name: record.name });
    }

    return entities;
  }

  private extractContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.substring(start, end);
  }

  private deduplicateEntityMentions(mentions: EntityMention[]): EntityMention[] {
    const seen = new Set<string>();
    return mentions.filter(mention => {
      const key = `${mention.entityId}:${mention.startOffset}:${mention.endOffset}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  private invalidateConversationCaches(projectId: string, sessionId: string): void {
    // Clear relevant caches
    const patterns = [
      `context:${projectId}:${sessionId}:`,
      `conversations:${projectId}:`,
      `session:${sessionId}:`
    ];

    for (const [key] of this.contextCache.entries()) {
      if (patterns.some(pattern => key.startsWith(pattern))) {
        this.contextCache.delete(key);
      }
    }
  }
}

export const conversationService = new ConversationService();
export type { 
  Conversation, 
  ContextSession, 
  ConversationEntityLink, 
  CreateConversationRequest,
  ConversationFilter,
  ConversationSearchResult,
  Context 
}; 