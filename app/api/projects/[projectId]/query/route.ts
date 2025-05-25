import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '../../../../../lib/services/AIService';
import { KnowledgeGraphService } from '../../../../../lib/services/KnowledgeGraphService';
import { SettingsService } from '../../../../../lib/services/SettingsService';
import { logger } from '../../../../../lib/services/Logger';

interface QueryRequest {
  query: string;
  includeContext?: boolean;
  maxResults?: number;
  userId?: string;
}

interface QueryResponse {
  success: boolean;
  query: string;
  response: string;
  entities: string[];
  relationships: string[];
  confidence: number;
  queryType: 'entity_search' | 'relationship_analysis' | 'pattern_discovery' | 'general';
  timestamp: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  
  try {
    const body: QueryRequest = await request.json();
    const { query, includeContext = true, maxResults = 10, userId = 'default-user' } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query is required and must be a non-empty string' 
        },
        { status: 400 }
      );
    }

    logger.info('Processing natural language query', { projectId, query: query.substring(0, 100) });

    // Get user settings for AI configuration
    const settingsService = SettingsService.getInstance();
    const userSettings = await settingsService.getUserSettings(userId);

    // Initialize services
    const aiService = new AIService(userSettings.aiConfiguration, userSettings.aiFeatures);
    const knowledgeGraphService = KnowledgeGraphService.getInstance();

    // Get knowledge graph context if requested
    let context: any = {};
    if (includeContext) {
      try {
        // Get entities and relationships for context
        const entities = await knowledgeGraphService.getAllEntities(projectId);
        const relationships = await knowledgeGraphService.getRelationships(projectId);
        
        context = {
          projectId,
          totalEntities: entities.length,
          totalRelationships: relationships.length,
          entities: entities.slice(0, 50).map(e => ({
            id: e.id,
            name: e.name,
            type: e.type,
            description: e.description
          })),
          relationships: relationships.slice(0, 30).map(r => ({
            from: r.from,
            to: r.to,
            type: r.type,
            description: r.description
          }))
        };
      } catch (error) {
        logger.warn('Failed to load knowledge graph context', { projectId, error });
        // Continue without context
      }
    }

    // Process query with AI service
    const aiResponse = await aiService.queryNaturalLanguage(query, context);

    if (!aiResponse.success) {
      return NextResponse.json({
        success: false,
        error: aiResponse.error || 'Failed to process natural language query'
      }, { status: 500 });
    }

    // Extract entities and relationships from the response
    const responseText = aiResponse.data.response;
    const extractedEntities = await extractEntitiesFromResponse(responseText, context.entities || []);
    const extractedRelationships = await extractRelationshipsFromResponse(responseText, context.relationships || []);
    
    // Determine query type based on content
    const queryType = determineQueryType(query, responseText);
    
    // Calculate confidence based on AI response and context matching
    const confidence = calculateConfidence(aiResponse, extractedEntities, extractedRelationships);

    const response: QueryResponse = {
      success: true,
      query,
      response: responseText,
      entities: extractedEntities,
      relationships: extractedRelationships,
      confidence,
      queryType,
      timestamp: new Date().toISOString()
    };

    logger.info('Natural language query processed successfully', { 
      projectId, 
      queryType, 
      confidence,
      entitiesFound: extractedEntities.length,
      relationshipsFound: extractedRelationships.length
    });

    return NextResponse.json(response);

  } catch (error: any) {
    logger.error('Failed to process natural language query', error, { 
      projectId
    });

    return NextResponse.json({
      success: false,
      error: 'Internal server error while processing query'
    }, { status: 500 });
  }
}

// Helper function to extract entities mentioned in the AI response
async function extractEntitiesFromResponse(responseText: string, contextEntities: any[]): Promise<string[]> {
  const entities = new Set<string>();
  
  // Look for entities mentioned in the response that exist in the knowledge graph
  contextEntities.forEach(entity => {
    if (responseText.toLowerCase().includes(entity.name.toLowerCase())) {
      entities.add(entity.name);
    }
  });

  // Also look for common patterns that might indicate entities
  const entityPatterns = [
    /\b([A-Z][a-zA-Z]*(?:Service|Controller|Model|Component|API|Repository|Manager|Handler))\b/g,
    /\b([A-Z][a-zA-Z]*(?:Entity|Class|Function|Method))\b/g,
  ];

  entityPatterns.forEach(pattern => {
    const matches = responseText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.length > 2 && match.length < 50) {
          entities.add(match);
        }
      });
    }
  });

  return Array.from(entities).slice(0, 10); // Limit to 10 entities
}

// Helper function to extract relationships mentioned in the AI response
async function extractRelationshipsFromResponse(responseText: string, contextRelationships: any[]): Promise<string[]> {
  const relationships = new Set<string>();
  
  // Look for relationship patterns in the response
  const relationshipPatterns = [
    /(\w+)\s+(?:connects to|links to|depends on|uses|calls|extends|implements)\s+(\w+)/gi,
    /(\w+)\s*->\s*(\w+)/g,
    /(\w+)\s+(?:relationship|connection|dependency)\s+(?:with|to)\s+(\w+)/gi
  ];

  relationshipPatterns.forEach(pattern => {
    const matches = [...responseText.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1] && match[2]) {
        relationships.add(`${match[1]} -> ${match[2]}`);
      }
    });
  });

  return Array.from(relationships).slice(0, 8); // Limit to 8 relationships
}

// Helper function to determine the type of query based on content
function determineQueryType(query: string, response: string): 'entity_search' | 'relationship_analysis' | 'pattern_discovery' | 'general' {
  const queryLower = query.toLowerCase();
  const responseLower = response.toLowerCase();

  if (queryLower.includes('show') || queryLower.includes('find') || queryLower.includes('list') || 
      queryLower.includes('what are') || responseLower.includes('found') || responseLower.includes('entities')) {
    return 'entity_search';
  }
  
  if (queryLower.includes('relationship') || queryLower.includes('connect') || queryLower.includes('depend') ||
      queryLower.includes('how') || responseLower.includes('relationship') || responseLower.includes('connects')) {
    return 'relationship_analysis';
  }
  
  if (queryLower.includes('pattern') || queryLower.includes('bottleneck') || queryLower.includes('issue') ||
      queryLower.includes('problem') || responseLower.includes('pattern') || responseLower.includes('identified')) {
    return 'pattern_discovery';
  }
  
  return 'general';
}

// Helper function to calculate confidence based on various factors
function calculateConfidence(aiResponse: any, entities: string[], relationships: string[]): number {
  let confidence = 0.7; // Base confidence
  
  // Boost confidence if AI provider returned usage info (indicates successful processing)
  if (aiResponse.usage && aiResponse.usage.tokens > 0) {
    confidence += 0.1;
  }
  
  // Boost confidence based on entities found
  if (entities.length > 0) {
    confidence += Math.min(entities.length * 0.05, 0.15);
  }
  
  // Boost confidence based on relationships found
  if (relationships.length > 0) {
    confidence += Math.min(relationships.length * 0.03, 0.1);
  }
  
  // Cap confidence at 0.95
  return Math.min(confidence, 0.95);
} 