// Domain event types for the event-driven architecture

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
  version?: number;
}

// Entity events
export interface EntityCreatedEvent extends DomainEvent {
  type: 'EntityCreated';
  data: {
    entityId: string;
    projectId: string;
    name: string;
    type: string;
    description?: string;
    metadata: Record<string, any>;
  };
}

export interface EntityUpdatedEvent extends DomainEvent {
  type: 'EntityUpdated';
  data: {
    entityId: string;
    projectId: string;
    previous: any;
    current: any;
    changes: string[];
  };
}

export interface EntityDeletedEvent extends DomainEvent {
  type: 'EntityDeleted';
  data: {
    entityId: string;
    projectId: string;
    name: string;
    type: string;
  };
}

// Relationship events
export interface RelationshipCreatedEvent extends DomainEvent {
  type: 'RelationshipCreated';
  data: {
    relationshipId: string;
    projectId: string;
    sourceId: string;
    targetId: string;
    type: string;
    strength: number;
  };
}

export interface RelationshipDeletedEvent extends DomainEvent {
  type: 'RelationshipDeleted';
  data: {
    relationshipId: string;
    projectId: string;
    sourceId: string;
    targetId: string;
  };
}

// Session events
export interface SessionCreatedEvent extends DomainEvent {
  type: 'SessionCreated';
  data: {
    sessionId: string;
    projectId: string;
    userId: string;
  };
}

export interface SessionEndedEvent extends DomainEvent {
  type: 'SessionEnded';
  data: {
    sessionId: string;
    projectId: string;
    userId: string;
    duration: number;
  };
}

export interface ConversationMessageAddedEvent extends DomainEvent {
  type: 'ConversationMessageAdded';
  data: {
    messageId: string;
    sessionId: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    extractedEntities?: any[];
  };
}

export interface ContextEntityAddedEvent extends DomainEvent {
  type: 'ContextEntityAdded';
  data: {
    sessionId: string;
    entityId: string;
    projectId: string;
  };
}

// Project events
export interface ProjectCreatedEvent extends DomainEvent {
  type: 'ProjectCreated';
  data: {
    projectId: string;
    name: string;
    description?: string;
  };
}

export interface ProjectDeletedEvent extends DomainEvent {
  type: 'ProjectDeleted';
  data: {
    projectId: string;
    name: string;
  };
}

// Vector/Embedding events
export interface EmbeddingGeneratedEvent extends DomainEvent {
  type: 'EmbeddingGenerated';
  data: {
    entityId: string;
    projectId: string;
    embedding: number[];
    model: string;
  };
}

// Union type for all events
export type AllDomainEvents = 
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDeletedEvent
  | RelationshipCreatedEvent
  | RelationshipDeletedEvent
  | SessionCreatedEvent
  | SessionEndedEvent
  | ConversationMessageAddedEvent
  | ContextEntityAddedEvent
  | ProjectCreatedEvent
  | ProjectDeletedEvent
  | EmbeddingGeneratedEvent;

// Event handler type
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

// Event subscriber interface
export interface EventSubscriber {
  eventType: string;
  handler: EventHandler;
}
