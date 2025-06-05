import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '../../../../../lib/services/AIService';
import { qdrantDataService } from '../../../../../lib/services/QdrantDataService';
import { SettingsService } from '../../../../../lib/services/SettingsService';
import { logger } from '../../../../../lib/services/Logger';

interface ProjectInfo { // For allProjects list
  id: string;
  name: string;
  description?: string;
}

interface QueryRequest {
  query: string;
  includeContext?: boolean;
  maxResults?: number;
  userId?: string;
  allProjects?: ProjectInfo[]; // Added for project determination
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
  // Extract projectId safely
  const { projectId: _projectId } = await params;
  let projectId = _projectId;
  
  try {
    // Now inside try, proceed safely
    const body: QueryRequest = await request.json();
    // Destructure allProjects, potentially undefined
    const { query, includeContext = true, maxResults = 10, userId = 'default-user', allProjects } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query is required and must be a non-empty string' 
        },
        { status: 400 }
      );
    }

    // Get user settings for AI configuration first (needed for AIService)
    await qdrantDataService.initialize(); // Ensure qdrant is initialized
    const userSettings = await qdrantDataService.getUserSettings(userId);
    
    if (!userSettings) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User settings not found. Please configure your settings first.' 
        },
        { status: 400 }
      );
    }

    const aiService = new AIService({ aiConfiguration: userSettings.aiConfiguration, aiFeatures: userSettings.aiFeatures });

    if (projectId === "_determine_") {
      if (!allProjects || allProjects.length === 0) {
        return NextResponse.json(
          { success: false, error: "Cannot determine project: Project list not provided." },
          { status: 400 }
        );
      }
      logger.info('AI to determine project for query', { originalQuery: query.substring(0,100), numProjects: allProjects.length });

      const projectDeterminationSystemPrompt = `You are an expert system that determines the most relevant project ID for a user's query based on a list of available projects.
The user will provide a query and a list of projects (with ID, name, and description).
Respond ONLY with the JSON object containing the ID of the most relevant project, like this: {"determinedProjectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}.
If no project seems relevant, or if you cannot confidently determine a project, respond with: {"determinedProjectId": "default"}.`;
      
      const projectsListText = allProjects.map(p => `ID: ${p.id}, Name: "${p.name}", Description: "${p.description || 'N/A'}"`).join('\\n');
      const projectDeterminationPrompt = `User query: "${query}"

Available projects:
${projectsListText}

Based on the user query and the project list, which project ID is most relevant? Return ONLY the JSON object.`;

      const determinationResponse = await aiService.queryNaturalLanguage(projectDeterminationPrompt, { systemPrompt: projectDeterminationSystemPrompt });

      if (!determinationResponse.success || !determinationResponse.data.response) {
        logger.error('AI project determination failed', { error: determinationResponse.error });
        return NextResponse.json(
          { success: false, error: "AI failed to determine the project." },
          { status: 500 }
        );
      }

      try {
        const responseObject = JSON.parse(determinationResponse.data.response.trim());
        const determinedId = responseObject.determinedProjectId;
        if (determinedId && allProjects.some(p => p.id === determinedId || determinedId === "default")) {
          projectId = determinedId; // Update projectId with the AI's choice
          logger.info('AI determined project ID', { determinedProjectId: projectId });
        } else {
          logger.warn('AI returned invalid or no project ID, falling back to default', { response: determinationResponse.data.response });
          // Fallback strategy: use the first project ID from the list if "default" was the AI choice or if ID is invalid
          // or consider a specific default project ID you might have.
          projectId = allProjects[0]?.id || 'default'; // Or handle as an error
        }
      } catch (e) {
        logger.error('Failed to parse AI project determination response', { response: determinationResponse.data.response, error: e });
        // Fallback if parsing fails
         projectId = allProjects[0]?.id || 'default'; 
      }
        // If projectId becomes "default" from AI, and you want to map it to an actual ID (e.g., first project)
      if (projectId === "default" && allProjects && allProjects.length > 0) {
        projectId = allProjects[0].id; 
        logger.info('AI chose "default", mapped to first project ID', { mappedProjectId: projectId });
      } else if (projectId === "default") {
         // Handle case where "default" is chosen but no projects exist or no fallback defined
        return NextResponse.json(
            { success: false, error: "AI chose default project, but no fallback project is available." },
            { status: 400 }
        );
      }
    }

    logger.info('Processing natural language query', { finalProjectId: projectId, query: query.substring(0, 100) });

    // Initialize qdrantDataService (might have been initialized already, but good to ensure)
    await qdrantDataService.initialize();

    // Get knowledge graph context if requested
    let context: any = {};
    if (includeContext) {
      try {
        // Get entities and relationships for context
        const entities = await qdrantDataService.getEntitiesByProject(projectId); // projectId is now the determined one
        const relationships = await qdrantDataService.getAllRelationships(projectId); // projectId is now the determined one
        
        // Create entity lookup for cleaner relationship descriptions
        const entityLookup = new Map();
        entities.forEach(e => entityLookup.set(e.id, e.name));

        context = {
          projectId, // Use the final projectId
          totalEntities: entities.length,
          totalRelationships: relationships.length,
          entities: entities.slice(0, 50).map(e => ({
            name: e.name,
            type: e.type,
            description: e.description
          })),
          relationships: relationships.slice(0, 30).map(r => ({
            from: entityLookup.get(r.sourceId) || 'Unknown Entity',
            to: entityLookup.get(r.targetId) || 'Unknown Entity',
            type: r.type,
            description: r.description
          }))
        };
      } catch (error) {
        logger.warn('Failed to load knowledge graph context', { finalProjectId: projectId, error });
        // Continue without context
      }
    }

    // Create a more user-friendly system prompt for better responses
    const systemPrompt = `You are a knowledgeable assistant helping analyze a software project's knowledge graph. 

When answering questions:
- Provide clear, concise insights without technical entity IDs or internal references
- Focus on the actual content and relationships, not the underlying data structure
- Use natural language and organize information logically
- When referencing specific components, use their descriptive names, not IDs
- Provide actionable insights and highlight important patterns
- Keep responses conversational and easy to understand

The knowledge graph contains information about project entities, their relationships, and migration status. Answer based on this context but present it in a thoughtful, human-readable way.`;

    // Process query with AI service using the final projectId in context
    const aiResponse = await aiService.queryNaturalLanguage(query, context, systemPrompt); // Pass the potentially enriched context

    if (!aiResponse.success) {
      return NextResponse.json({
        success: false,
        error: aiResponse.error || 'Failed to process natural language query'
      }, { status: 500 });
    }

    // Extract entities and relationships from the response
    // Adjust for different aiResponse.data structures from providers
    const responseText = typeof aiResponse.data === 'string' ? aiResponse.data : aiResponse.data?.response;

    if (typeof responseText !== 'string' || responseText.trim() === '') {
        logger.error('AI response text is not a string or is empty after processing aiResponse.data', { data: aiResponse.data });
        return NextResponse.json({
            success: false,
            error: 'AI provider returned empty or invalid response. Please check your AI configuration or try again.'
        }, { status: 500 });
    }

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
      finalProjectId: projectId, 
      queryType, 
      confidence,
      entitiesFound: extractedEntities.length,
      relationshipsFound: extractedRelationships.length
    });

    return NextResponse.json(response);

  } catch (error: any) {
    // Use a general projectId for logging if it was determined, otherwise the initial one
    const logProjectId = projectId === "_determine_" ? "undetermined" : projectId;
    logger.error('Failed to process natural language query', error, { 
      projectId: logProjectId 
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
    /\\b([A-Z][a-zA-Z]*(?:Service|Controller|Model|Component|API|Repository|Manager|Handler))\\b/g,
    /\\b([A-Z][a-zA-Z]*(?:Entity|Class|Function|Method))\\b/g,
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
    /(\\w+)\\s+(?:connects to|links to|depends on|uses|calls|extends|implements)\\s+(\\w+)/gi,
    /(\\w+)\\s*->\\s*(\\w+)/g,
    /(\\w+)\\s+(?:relationship|connection|dependency)\\s+(?:with|to)\\s+(\\w+)/gi
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