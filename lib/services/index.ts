// Service exports for clean imports
export { logger, LogLevel, type LogContext } from './Logger';
export { databaseService, type QueryParams, type QueryOptions } from './DatabaseService';
export { 
  entityService, 
  type Entity, 
  type Observation, 
  type CreateEntityRequest, 
  type UpdateEntityRequest 
} from './EntityService';
export { 
  relationshipService, 
  type Relationship, 
  type CreateRelationshipRequest, 
  type RelationshipFilter 
} from './RelationshipService';
export { 
  cacheService, 
  type CacheEntry, 
  type CacheStats 
} from './CacheService';
export { 
  knowledgeGraphService, 
  type PaginationOptions, 
  type PaginatedResult, 
  type GraphMetrics 
} from './KnowledgeGraphService'; 