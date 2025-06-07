// Shared domain types for the microservice architecture

export interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  projectId: string;
  strength: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, any>;
}

export interface Session {
  id: string;
  projectId: string;
  userId: string;
  contextEntityIds: string[];
  conversationHistory: ConversationMessage[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessedAt: Date;
  status: 'active' | 'paused' | 'ended';
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  extractedEntities?: ExtractedEntity[];
  metadata?: Record<string, any>;
}

export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
  startOffset: number;
  endOffset: number;
}

export interface UserSettings {
  id: string;
  userId: string;
  aiConfiguration: any;
  aiFeatures: any;
  privacy: any;
  performance: any;
  ui: any;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search types
export interface SearchResult<T = Entity> {
  item: T;
  score: number;
  highlights?: string[];
}

export interface SearchResponse<T = Entity> {
  query: string;
  results: SearchResult<T>[];
  total: number;
  took: number;
}
