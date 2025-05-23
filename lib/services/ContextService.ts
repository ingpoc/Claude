import { v4 as uuidv4 } from 'uuid';
import { databaseService, type QueryParams } from './DatabaseService';
import { conversationService } from './ConversationService';
import { logger } from './Logger';
import type {
  ContextSession,
  ConversationState,
  Context,
  Conversation
} from '../models/Conversation';

export interface SessionManager {
  userId: string;
  projectId: string;
}

export interface ContextLoadOptions {
  includeRecentConversations?: boolean;
  conversationLimit?: number;
  includeEntitySummary?: boolean;
  includeSuggestedActions?: boolean;
  includeKnowledgeGaps?: boolean;
}

class ContextService {
  private readonly DEFAULT_CONVERSATION_LIMIT = 10;
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CONTEXT_CACHE_TTL = 300000; // 5 minutes

  // Simple in-memory cache for active sessions
  private sessionCache = new Map<string, { session: ContextSession; timestamp: number }>();

  /**
   * Initialize or resume a session for context intelligence
   */
  async initializeSession(
    projectId: string,
    userId: string,
    sessionId?: string
  ): Promise<ContextSession> {
    const effectiveSessionId = sessionId || uuidv4();
    
    try {
      // Check if session already exists
      let session = await this.getSessionFromDB(effectiveSessionId, projectId);
      
      if (!session) {
        // Create new session
        session = {
          id: effectiveSessionId,
          projectId,
          userId,
          lastActive: new Date(),
          activeEntityIds: [],
          conversationState: {
            userGoals: [],
            recentEntities: [],
            pendingQuestions: [],
            contextWindow: []
          },
          totalMessages: 0,
          isActive: true
        };

        await this.saveSession(session);
        logger.info('New context session created', { sessionId: effectiveSessionId, projectId, userId });
      } else {
        // Update existing session
        session.lastActive = new Date();
        session.isActive = true;
        await this.saveSession(session);
        logger.info('Context session resumed', { sessionId: effectiveSessionId, projectId, userId });
      }

      // Cache the session
      this.sessionCache.set(effectiveSessionId, {
        session,
        timestamp: Date.now()
      });

      return session;

    } catch (error) {
      logger.error('Failed to initialize session', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: effectiveSessionId,
        projectId,
        userId 
      });
      throw new Error(`Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load comprehensive context for a session
   */
  async loadContext(
    sessionId: string,
    projectId: string,
    options: ContextLoadOptions = {}
  ): Promise<Context> {
    const {
      includeRecentConversations = true,
      conversationLimit = this.DEFAULT_CONVERSATION_LIMIT,
      includeEntitySummary = true,
      includeSuggestedActions = true,
      includeKnowledgeGaps = true
    } = options;

    try {
      const session = await this.getSession(sessionId, projectId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Build context object
      let context: Context = {
        sessionId,
        relevantEntities: session.activeEntityIds,
        recentConversations: [],
        sessionSummary: session.sessionSummary,
        userIntent: session.conversationState.currentTopic,
        suggestedActions: [],
        knowledgeGaps: []
      };

      // Load recent conversations if requested
      if (includeRecentConversations) {
        context = await conversationService.getConversationContext(
          projectId,
          sessionId,
          session.conversationState.currentTopic,
          conversationLimit
        );
      }

      // Enhance with additional context data
      if (includeEntitySummary) {
        context.relevantEntities = await this.getRelevantEntities(
          projectId,
          session.activeEntityIds,
          context.recentConversations
        );
      }

      if (includeSuggestedActions) {
        context.suggestedActions = await this.generateSmartSuggestions(
          session,
          context.recentConversations
        );
      }

      if (includeKnowledgeGaps) {
        context.knowledgeGaps = await this.detectContextualKnowledgeGaps(
          session,
          context.recentConversations,
          projectId
        );
      }

      logger.info('Context loaded successfully', { 
        sessionId, 
        projectId,
        entitiesCount: context.relevantEntities.length,
        conversationsCount: context.recentConversations.length,
        suggestionsCount: context.suggestedActions.length
      });

      return context;

    } catch (error) {
      logger.error('Failed to load context', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        projectId 
      });
      throw new Error(`Failed to load context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session state based on user activity
   */
  async updateSessionState(
    sessionId: string,
    projectId: string,
    updates: Partial<ConversationState>
  ): Promise<ContextSession> {
    try {
      const session = await this.getSession(sessionId, projectId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Merge updates with existing state
      session.conversationState = {
        ...session.conversationState,
        ...updates
      };

      // Update timestamp
      session.lastActive = new Date();

      // Save updated session
      await this.saveSession(session);

      // Update cache
      this.sessionCache.set(sessionId, {
        session,
        timestamp: Date.now()
      });

      logger.info('Session state updated', { sessionId, projectId, updates: Object.keys(updates) });
      
      return session;

    } catch (error) {
      logger.error('Failed to update session state', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        projectId 
      });
      throw new Error(`Failed to update session state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session summary
   */
  async updateSessionSummary(
    sessionId: string,
    projectId: string,
    summary: string
  ): Promise<ContextSession> {
    try {
      const session = await this.getSession(sessionId, projectId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.sessionSummary = summary;
      session.lastActive = new Date();

      await this.saveSession(session);

      // Update cache
      this.sessionCache.set(sessionId, {
        session,
        timestamp: Date.now()
      });

      logger.info('Session summary updated', { sessionId, projectId });
      
      return session;

    } catch (error) {
      logger.error('Failed to update session summary', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        projectId 
      });
      throw new Error(`Failed to update session summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track entity interactions for context intelligence
   */
  async trackEntityInteraction(
    sessionId: string,
    projectId: string,
    entityId: string,
    interactionType: 'view' | 'edit' | 'create' | 'delete' | 'relate'
  ): Promise<void> {
    try {
      const session = await this.getSession(sessionId, projectId);
      if (!session) {
        logger.warn('Cannot track entity interaction: session not found', { sessionId, entityId });
        return;
      }

      // Add to active entities if not already present
      if (!session.activeEntityIds.includes(entityId)) {
        session.activeEntityIds.push(entityId);
        
        // Keep only last 20 entities to prevent unbounded growth
        if (session.activeEntityIds.length > 20) {
          session.activeEntityIds = session.activeEntityIds.slice(-20);
        }
      }

      // Update recent entities in conversation state
      session.conversationState.recentEntities = [
        entityId,
        ...session.conversationState.recentEntities.filter(id => id !== entityId)
      ].slice(0, 10); // Keep last 10 recent entities

      // Update last activity
      session.lastActive = new Date();

      await this.saveSession(session);

      logger.debug('Entity interaction tracked', { 
        sessionId, 
        projectId, 
        entityId, 
        interactionType 
      });

    } catch (error) {
      logger.error('Failed to track entity interaction', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        projectId,
        entityId 
      });
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string, projectId: string): Promise<ContextSession | null> {
    // Check cache first
    const cached = this.sessionCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.CONTEXT_CACHE_TTL) {
      return cached.session;
    }

    // Load from database
    return this.getSessionFromDB(sessionId, projectId);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, projectId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId, projectId);
      if (!session) {
        logger.warn('Cannot end session: session not found', { sessionId });
        return;
      }

      session.isActive = false;
      session.lastActive = new Date();

      await this.saveSession(session);
      this.sessionCache.delete(sessionId);

      logger.info('Session ended', { sessionId, projectId });

    } catch (error) {
      logger.error('Failed to end session', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        projectId 
      });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const expiredBefore = new Date(Date.now() - this.SESSION_TIMEOUT);
      
      const query = `
        MATCH (s:ContextSession)
        WHERE datetime(s.lastActive) < datetime($expiredBefore)
        SET s.isActive = false
        RETURN count(s) as count
      `;

      const result = await databaseService.executeQuery('cleanup', query, { 
        expiredBefore: expiredBefore.toISOString() 
      });

      let count = 0;
      if (result && (result as any).hasNext()) {
        const record = (result as any).getNextSync();
        count = record.count || 0;
      }

      // Clean up cache
      for (const [sessionId, cached] of this.sessionCache.entries()) {
        if (Date.now() - cached.timestamp > this.SESSION_TIMEOUT) {
          this.sessionCache.delete(sessionId);
        }
      }

      logger.info('Cleaned up expired sessions', { count });
      return count;

    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private async getSessionFromDB(sessionId: string, projectId: string): Promise<ContextSession | null> {
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

  private async saveSession(session: ContextSession): Promise<void> {
    const query = `
      MERGE (s:ContextSession {id: $id, projectId: $projectId})
      SET s.userId = $userId,
          s.lastActive = $lastActive,
          s.sessionSummary = $sessionSummary,
          s.activeEntityIds = $activeEntityIds,
          s.conversationState = $conversationState,
          s.totalMessages = $totalMessages,
          s.isActive = $isActive,
          s.metadata = $metadata
    `;

    const params: QueryParams = {
      id: session.id,
      projectId: session.projectId,
      userId: session.userId,
      lastActive: session.lastActive.toISOString(),
      sessionSummary: session.sessionSummary || null,
      activeEntityIds: session.activeEntityIds,
      conversationState: JSON.stringify(session.conversationState),
      totalMessages: session.totalMessages,
      isActive: session.isActive,
      metadata: JSON.stringify(session.metadata || {})
    };

    await databaseService.executeQuery(session.projectId, query, params);
  }

  private async getRelevantEntities(
    projectId: string,
    activeEntityIds: string[],
    recentConversations: Conversation[]
  ): Promise<string[]> {
    // Combine active entities with entities mentioned in recent conversations
    const conversationEntityIds = recentConversations.flatMap(c => c.extractedEntityIds);
    const allRelevantIds = [...new Set([...activeEntityIds, ...conversationEntityIds])];
    
    return allRelevantIds.slice(0, 50); // Limit to prevent overwhelming context
  }

  private async generateSmartSuggestions(
    session: ContextSession,
    recentConversations: Conversation[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Based on recent activity
    if (session.activeEntityIds.length === 0) {
      suggestions.push('Create your first entity to start building knowledge');
      suggestions.push('Explore existing entities in this project');
    } else if (session.activeEntityIds.length === 1) {
      suggestions.push('Add relationships to connect your entities');
      suggestions.push('Create related entities to expand the knowledge graph');
    } else {
      suggestions.push('Visualize your knowledge graph');
      suggestions.push('Search for patterns in your entities');
    }

    // Based on conversation patterns
    const hasQuestions = recentConversations.some(c => 
      c.userMessage.includes('?') || c.userMessage.includes('how') || c.userMessage.includes('why')
    );

    if (hasQuestions) {
      suggestions.push('Add more detailed descriptions to answer your questions');
    }

    return suggestions.slice(0, 5); // Keep suggestions focused
  }

  private async detectContextualKnowledgeGaps(
    session: ContextSession,
    recentConversations: Conversation[],
    projectId: string
  ): Promise<string[]> {
    const gaps: string[] = [];

    // Gap detection based on conversation content
    const topics = recentConversations.map(c => c.intent).filter(Boolean);
    const uniqueTopics = [...new Set(topics)];

    if (uniqueTopics.length > 3 && session.activeEntityIds.length < 5) {
      gaps.push('You\'re discussing many topics but have few entities - consider creating more entities');
    }

    if (session.conversationState.pendingQuestions.length > 0) {
      gaps.push('You have unanswered questions - consider adding information to resolve them');
    }

    if (session.activeEntityIds.length > 10 && recentConversations.some(c => 
      c.userMessage.includes('relationship') || c.userMessage.includes('connect')
    )) {
      gaps.push('Consider adding more relationships between your entities');
    }

    return gaps;
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
}

export const contextService = new ContextService(); 