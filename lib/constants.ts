// Entity Types for the knowledge graph
export const EntityTypes = {
  COMPONENT: 'component',
  MODULE: 'module', 
  FUNCTION: 'function',
  CLASS: 'class',
  VARIABLE: 'variable',
  CONCEPT: 'concept',
  FEATURE: 'feature',
  REQUIREMENT: 'requirement',
  FILE: 'file',
  PROJECT: 'project',
  PERSON: 'person',
  ORGANIZATION: 'organization',
  EVENT: 'event',
  DOCUMENT: 'document',
  API: 'api',
  DATABASE: 'database',
  SERVICE: 'service',
  TOOL: 'tool',
  FRAMEWORK: 'framework',
  LIBRARY: 'library'
} as const;

export type EntityType = typeof EntityTypes[keyof typeof EntityTypes];

// Relationship Types
export const RelationshipTypes = {
  CALLS: 'calls',
  CONTAINS: 'contains', 
  IMPLEMENTS: 'implements',
  EXTENDS: 'extends',
  USES: 'uses',
  DEPENDS_ON: 'depends_on',
  RELATED_TO: 'related_to',
  PART_OF: 'part_of',
  SIMILAR_TO: 'similar_to',
  CREATED_BY: 'created_by',
  OWNS: 'owns',
  MANAGES: 'manages',
  COLLABORATES_WITH: 'collaborates_with',
  PRECEDES: 'precedes',
  FOLLOWS: 'follows',
  REFERENCES: 'references',
  CONFIGURES: 'configures',
  DEPLOYS: 'deploys',
  TESTS: 'tests',
  DOCUMENTS: 'documents',
  COMPOSED_OF: 'composed_of'
} as const;

export type RelationshipType = typeof RelationshipTypes[keyof typeof RelationshipTypes];

// Project Status
export const ProjectStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived', 
  DRAFT: 'draft',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold'
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];
