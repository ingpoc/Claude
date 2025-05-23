export interface Conversation {
  id: string;
  projectId: string;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  extractedEntityIds: string[];
  timestamp: Date;
  contextUsed: string[];
  messageType: 'user' | 'assistant' | 'system';
  intent?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ContextSession {
  id: string;
  projectId: string;
  userId: string;
  lastActive: Date;
  sessionSummary?: string;
  activeEntityIds: string[];
  conversationState: ConversationState;
  totalMessages: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ConversationState {
  currentTopic?: string;
  userGoals: string[];
  recentEntities: string[];
  pendingQuestions: string[];
  workflowState?: string;
  lastAction?: string;
  contextWindow: string[];
}

export interface ConversationEntityLink {
  conversationId: string;
  entityId: string;
  relevanceScore: number;
  extractionMethod: 'manual' | 'auto' | 'llm' | 'pattern';
  confidence: number;
  extractedAt: Date;
}

export interface EntityMention {
  entityId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  confidence: number;
  context: string;
}

export interface Context {
  sessionId: string;
  relevantEntities: string[];
  recentConversations: Conversation[];
  sessionSummary?: string;
  userIntent?: string;
  suggestedActions: string[];
  knowledgeGaps: string[];
}

export interface CreateConversationRequest {
  projectId: string;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  extractedEntityIds?: string[];
  contextUsed?: string[];
  intent?: string;
  metadata?: Record<string, any>;
}

export interface ConversationFilter {
  projectId?: string;
  sessionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  entityIds?: string[];
  messageType?: 'user' | 'assistant' | 'system';
  hasIntent?: boolean;
  searchText?: string;
}

export interface ConversationSearchResult {
  conversation: Conversation;
  relevanceScore: number;
  matchedText: string[];
  relatedEntities: string[];
} 