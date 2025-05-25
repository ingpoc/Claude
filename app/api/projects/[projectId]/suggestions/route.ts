import { NextRequest, NextResponse } from 'next/server';
import { qdrantDataService } from '../../../../../lib/services/QdrantDataService';
import { logger } from '../../../../../lib/services/Logger';

interface Suggestion {
  id: string;
  type: 'entity_creation' | 'relationship_suggestion' | 'pattern_insight' | 'optimization' | 'knowledge_gap';
  title: string;
  description: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  actionLabel: string;
  relatedEntities?: string[];
  estimatedImpact?: string;
  timeToImplement?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    logger.info('Generating AI suggestions', { projectId });

    // Fetch project entities and relationships
    const entities = await qdrantDataService.getEntitiesByProject(projectId, 100);
    const relationships = await qdrantDataService.getAllRelationships(projectId);

    // Generate AI-powered suggestions based on the data
    const suggestions = await generateAISuggestions(projectId, entities, relationships);

    logger.info('Generated AI suggestions', { 
      projectId, 
      suggestionCount: suggestions.length 
    });

    return NextResponse.json({
      success: true,
      suggestions,
      projectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate AI suggestions', error, { projectId: (await params).projectId });
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

async function generateAISuggestions(
  projectId: string, 
  entities: any[], 
  relationships: any[]
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Analysis 1: Check for isolated entities (entities with no relationships)
  const entityIds = new Set(entities.map(e => e.id));
  const connectedEntityIds = new Set();
  relationships.forEach(rel => {
    connectedEntityIds.add(rel.sourceEntityId);
    connectedEntityIds.add(rel.targetEntityId);
  });

  const isolatedEntities = entities.filter(e => !connectedEntityIds.has(e.id));
  
  if (isolatedEntities.length > 0) {
    suggestions.push({
      id: `isolated-entities-${Date.now()}`,
      type: 'relationship_suggestion',
      title: `Connect ${isolatedEntities.length} Isolated Entities`,
      description: `Found ${isolatedEntities.length} entities with no relationships. Consider connecting them to improve knowledge graph connectivity.`,
      confidence: 0.85,
      priority: isolatedEntities.length > 5 ? 'high' : 'medium',
      category: 'Relationships',
      actionLabel: 'Add Relationships',
      relatedEntities: isolatedEntities.slice(0, 3).map(e => e.name),
      estimatedImpact: 'Improves graph connectivity',
      timeToImplement: `${Math.min(isolatedEntities.length * 2, 15)} minutes`
    });
  }

  // Analysis 2: Check for potential duplicate entities (similar names)
  const duplicatePairs = findPotentialDuplicates(entities);
  if (duplicatePairs.length > 0) {
    duplicatePairs.forEach((pair, index) => {
      suggestions.push({
        id: `duplicate-${Date.now()}-${index}`,
        type: 'optimization',
        title: `Potential Duplicate: "${pair[0].name}" and "${pair[1].name}"`,
        description: `These entities have similar names and might be duplicates. Consider merging them if they represent the same concept.`,
        confidence: 0.75,
        priority: 'low',
        category: 'Optimization',
        actionLabel: 'Review & Merge',
        relatedEntities: [pair[0].name, pair[1].name],
        estimatedImpact: 'Reduces duplication',
        timeToImplement: '3 minutes'
      });
    });
  }

  // Analysis 3: Suggest missing common entity types
  const entityTypes = entities.map(e => e.type?.toLowerCase() || 'unknown');
  const hasAPI = entityTypes.some(t => t.includes('api') || t.includes('endpoint'));
  const hasDatabase = entityTypes.some(t => t.includes('database') || t.includes('db'));
  const hasService = entityTypes.some(t => t.includes('service'));

  if (hasAPI && hasDatabase && !hasService) {
    suggestions.push({
      id: `missing-service-${Date.now()}`,
      type: 'entity_creation',
      title: 'Consider Adding Service Layer',
      description: 'Your project has APIs and databases but no service layer entities. Adding service entities can improve architecture clarity.',
      confidence: 0.70,
      priority: 'medium',
      category: 'Architecture',
      actionLabel: 'Create Service Entity',
      relatedEntities: entities.filter(e => e.type?.toLowerCase().includes('api')).slice(0, 2).map(e => e.name),
      estimatedImpact: 'Improves architecture organization',
      timeToImplement: '5 minutes'
    });
  }

  // Analysis 4: Check relationship density
  const relationshipDensity = relationships.length / Math.max(entities.length, 1);
  if (relationshipDensity < 0.5 && entities.length > 3) {
    suggestions.push({
      id: `low-connectivity-${Date.now()}`,
      type: 'pattern_insight',
      title: 'Low Knowledge Graph Connectivity',
      description: `Your knowledge graph has ${relationships.length} relationships for ${entities.length} entities. Consider adding more relationships to improve discoverability.`,
      confidence: 0.80,
      priority: 'medium',
      category: 'Patterns',
      actionLabel: 'Analyze Connections',
      relatedEntities: entities.slice(0, 3).map(e => e.name),
      estimatedImpact: 'Better knowledge discovery',
      timeToImplement: '10 minutes'
    });
  }

  // Analysis 5: Check for missing descriptions
  const entitiesWithoutDescription = entities.filter(e => !e.description || e.description.trim().length < 10);
  if (entitiesWithoutDescription.length > 0) {
    suggestions.push({
      id: `missing-descriptions-${Date.now()}`,
      type: 'knowledge_gap',
      title: `${entitiesWithoutDescription.length} Entities Need Descriptions`,
      description: 'Several entities lack detailed descriptions. Adding descriptions improves searchability and understanding.',
      confidence: 0.90,
      priority: entitiesWithoutDescription.length > 5 ? 'high' : 'medium',
      category: 'Documentation',
      actionLabel: 'Add Descriptions',
      relatedEntities: entitiesWithoutDescription.slice(0, 3).map(e => e.name),
      estimatedImpact: 'Better searchability',
      timeToImplement: `${entitiesWithoutDescription.length * 2} minutes`
    });
  }

  return suggestions.slice(0, 8); // Limit to 8 suggestions max
}

function findPotentialDuplicates(entities: any[]): [any, any][] {
  const duplicates: [any, any][] = [];
  
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const name1 = entities[i].name?.toLowerCase() || '';
      const name2 = entities[j].name?.toLowerCase() || '';
      
      // Check for similar names (simple similarity check)
      if (name1 && name2 && (
        name1.includes(name2) || 
        name2.includes(name1) ||
        levenshteinDistance(name1, name2) <= 2
      )) {
        duplicates.push([entities[i], entities[j]]);
      }
    }
  }
  
  return duplicates.slice(0, 3); // Limit to 3 potential duplicates
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
} 