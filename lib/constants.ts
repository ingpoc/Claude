// lib/constants.ts

// Constants for entity types (safe for client & server)
export const EntityTypes = {
  // System/Code entities
  DOMAIN: 'domain',
  COMPONENT: 'component',
  PAGE: 'page',
  FUNCTION: 'function',
  CLASS: 'class',
  API: 'api',
  UTILITY: 'utility',
  CONFIG: 'config',
  
  // Memory-specific entities
  USER: 'user',
  PERSON: 'person',
  ORGANIZATION: 'organization',
  LOCATION: 'location',
  INTEREST: 'interest',
  PREFERENCE: 'preference',
  GOAL: 'goal',
  EVENT: 'event'
};

// Constants for relationship types (safe for client & server)
export const RelationshipTypes = {
  // System/Code relationships
  DEPENDS_ON: 'depends_on',   
  COMPOSED_OF: 'composed_of', 
  CALLS: 'calls',             
  EXTENDS: 'extends',         
  RELATED_TO: 'related_to',
  
  // Memory-specific relationships
  HAS_INTEREST: 'has_interest',
  HAS_PREFERENCE: 'has_preference',
  HAS_GOAL: 'has_goal',
  KNOWS: 'knows',
  WORKS_AT: 'works_at',
  LOCATED_IN: 'located_in',
  PARTICIPATED_IN: 'participated_in'
}; 