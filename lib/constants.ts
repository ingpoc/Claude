// lib/constants.ts

// Constants for entity types (safe for client & server)
export const EntityTypes = {
  DOMAIN: 'domain',
  COMPONENT: 'component',
  PAGE: 'page',
  FUNCTION: 'function',
  CLASS: 'class',
  API: 'api',
  UTILITY: 'utility',
  CONFIG: 'config'
};

// Constants for relationship types (safe for client & server)
export const RelationshipTypes = {
  DEPENDS_ON: 'depends_on',   
  COMPOSED_OF: 'composed_of', 
  CALLS: 'calls',             
  EXTENDS: 'extends',         
  RELATED_TO: 'related_to'    
}; 