"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { Separator } from './separator';
import { cn } from '../../lib/utils';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  GitBranch, 
  Target,
  Clock,
  ArrowRight,
  Zap,
  CheckCircle2,
  Plus,
  Brain,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '../../lib/hooks/useSettings';
import { apiFetch } from "../../lib/api";

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

interface SmartSuggestionsPanelProps {
  projectId: string;
  className?: string;
  onActionClick?: (suggestion: Suggestion) => void;
}

export const SmartSuggestionsPanel: React.FC<SmartSuggestionsPanelProps> = ({
  projectId,
  className,
  onActionClick
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL
  // Use the settings hook to check AI feature availability
  const { isAIFeatureEnabled, loading: settingsLoading } = useSettings();

  // Generate AI-powered suggestions based on project data
  useEffect(() => {
    const generateSuggestions = async () => {
      try {
        // Fetch project data to analyze
        const [entitiesResponse, relationshipsResponse] = await Promise.all([
          apiFetch(`/api/entities?project_id=${projectId}`),
          apiFetch(`/api/relationships?project_id=${projectId}`)
        ]);

        if (entitiesResponse.ok && relationshipsResponse.ok) {
          const entities = await entitiesResponse.json();
          const relationships = await relationshipsResponse.json();
          
          const smartSuggestions = analyzeProjectAndGenerateSuggestions(entities, relationships, projectId);
          setSuggestions(smartSuggestions);
        } else {
          // Generate basic suggestions if API fails
          setSuggestions(generateBasicSuggestions(projectId));
        }
      } catch (error) {
        console.error('Failed to fetch project data for suggestions:', error);
        // Generate basic suggestions as fallback
        setSuggestions(generateBasicSuggestions(projectId));
      }
    };

    if (projectId && projectId !== 'default') {
      generateSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [projectId]);

  const categories = ['all', 'Architecture', 'Relationships', 'Patterns', 'Optimization', 'Documentation'];
  
  const filteredSuggestions = suggestions.filter(suggestion => 
    !dismissedSuggestions.has(suggestion.id) &&
    (selectedCategory === 'all' || suggestion.category === selectedCategory)
  );

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'entity_creation': return <Plus className="h-4 w-4 text-emerald-500" />;
      case 'relationship_suggestion': return <GitBranch className="h-4 w-4 text-indigo-500" />;
      case 'pattern_insight': return <Target className="h-4 w-4 text-amber-500" />;
      case 'optimization': return <Zap className="h-4 w-4 text-slate-500" />;
      case 'knowledge_gap': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getPriorityColor = (priority: Suggestion['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-600';
    if (confidence >= 0.7) return 'text-amber-600';
    return 'text-slate-600';
  };

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]));
  };

  const handleAction = (suggestion: Suggestion) => {
    if (onActionClick) {
      onActionClick(suggestion);
    } else {
      console.log('Action clicked for suggestion:', suggestion.title);
    }
  };

  // Smart suggestion generation based on project analysis
  const analyzeProjectAndGenerateSuggestions = (entities: any[], relationships: any[], projectId: string): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const entityTypes = entities.reduce((acc: any, entity: any) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {});

    // Entity type analysis
    const typeKeys = Object.keys(entityTypes);
    if (typeKeys.length > 0) {
      const dominantType = typeKeys.reduce((a, b) => entityTypes[a] > entityTypes[b] ? a : b);
      
      if (entityTypes[dominantType] > entities.length * 0.6) {
        suggestions.push({
          id: `diversify-${Date.now()}`,
          type: 'entity_creation',
          title: 'Diversify Entity Types',
          description: `Your project is heavily focused on "${dominantType}" entities (${entityTypes[dominantType]} of ${entities.length}). Consider adding more diverse entity types to create a richer knowledge graph.`,
          confidence: 0.85,
          priority: 'medium',
          category: 'Architecture',
          actionLabel: 'Add New Types',
          estimatedImpact: 'Improved organization',
          timeToImplement: '10-15 minutes'
        });
      }
    }

    // Relationship density analysis
    const relationshipDensity = relationships.length / Math.max(entities.length, 1);
    if (relationshipDensity < 0.5) {
      suggestions.push({
        id: `connections-${Date.now()}`,
        type: 'relationship_suggestion',
        title: 'Increase Entity Connections',
        description: `Your entities have few relationships (${relationships.length} relationships for ${entities.length} entities). Adding more connections will reveal patterns and improve knowledge discovery.`,
        confidence: 0.9,
        priority: 'high',
        category: 'Relationships',
        actionLabel: 'Add Relationships',
        estimatedImpact: 'Better knowledge discovery',
        timeToImplement: '15-20 minutes'
      });
    }

    // Orphaned entities (entities with no relationships)
    const connectedEntityIds = new Set([...relationships.map((r: any) => r.sourceId), ...relationships.map((r: any) => r.targetId)]);
    const orphanedEntities = entities.filter(entity => !connectedEntityIds.has(entity.id));
    
    if (orphanedEntities.length > 0) {
      suggestions.push({
        id: `orphans-${Date.now()}`,
        type: 'relationship_suggestion',
        title: 'Connect Isolated Entities',
        description: `${orphanedEntities.length} entities have no relationships. Connecting them will integrate them into your knowledge graph.`,
        confidence: 0.95,
        priority: 'high',
        category: 'Relationships',
        actionLabel: 'Connect Entities',
        relatedEntities: orphanedEntities.slice(0, 3).map(e => e.name),
        estimatedImpact: 'Complete knowledge graph',
        timeToImplement: '5-10 minutes'
      });
    }

    // Documentation gaps (entities with short descriptions)
    const poorlyDocumented = entities.filter(entity => !entity.description || entity.description.length < 50);
    if (poorlyDocumented.length > entities.length * 0.3) {
      suggestions.push({
        id: `documentation-${Date.now()}`,
        type: 'knowledge_gap',
        title: 'Improve Entity Documentation',
        description: `${poorlyDocumented.length} entities have minimal descriptions. Better documentation improves searchability and understanding.`,
        confidence: 0.8,
        priority: 'medium',
        category: 'Documentation',
        actionLabel: 'Add Descriptions',
        estimatedImpact: 'Better search results',
        timeToImplement: '20-30 minutes'
      });
    }

    // Observations analysis
    const entitiesWithObservations = entities.filter(entity => entity.observations && entity.observations.length > 0);
    if (entitiesWithObservations.length < entities.length * 0.2) {
      suggestions.push({
        id: `observations-${Date.now()}`,
        type: 'knowledge_gap',
        title: 'Add More Observations',
        description: `Only ${entitiesWithObservations.length} of ${entities.length} entities have observations. Adding notes and insights enriches your knowledge base.`,
        confidence: 0.75,
        priority: 'low',
        category: 'Documentation',
        actionLabel: 'Add Observations',
        estimatedImpact: 'Richer context',
        timeToImplement: '15-25 minutes'
      });
    }

    // Pattern discovery suggestions
    if (entities.length > 10 && relationships.length > 5) {
      const relationshipTypes = relationships.reduce((acc: any, rel: any) => {
        acc[rel.type] = (acc[rel.type] || 0) + 1;
        return acc;
      }, {});
      
      const dominantRelType = Object.keys(relationshipTypes).reduce((a, b) => 
        relationshipTypes[a] > relationshipTypes[b] ? a : b
      );
      
      suggestions.push({
        id: `patterns-${Date.now()}`,
        type: 'pattern_insight',
        title: 'Explore Knowledge Patterns',
        description: `Your graph shows interesting patterns with "${dominantRelType}" relationships being dominant. Consider exploring these patterns for insights.`,
        confidence: 0.7,
        priority: 'low',
        category: 'Patterns',
        actionLabel: 'Analyze Patterns',
        estimatedImpact: 'New insights',
        timeToImplement: '10-15 minutes'
      });
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  };

  const generateBasicSuggestions = (projectId: string): Suggestion[] => {
    return [
      {
        id: `basic-start-${Date.now()}`,
        type: 'entity_creation',
        title: 'Create Your First Entities',
        description: 'Start building your knowledge graph by creating entities that represent key concepts in your domain.',
        confidence: 0.9,
        priority: 'high',
        category: 'Architecture',
        actionLabel: 'Add Entities',
        estimatedImpact: 'Foundation for knowledge graph',
        timeToImplement: '5-10 minutes'
      },
      {
        id: `basic-relationships-${Date.now()}`,
        type: 'relationship_suggestion',
        title: 'Connect Related Concepts',
        description: 'Once you have entities, create relationships between them to show how concepts are connected.',
        confidence: 0.85,
        priority: 'medium',
        category: 'Relationships',
        actionLabel: 'Add Relationships',
        estimatedImpact: 'Structured knowledge',
        timeToImplement: '10-15 minutes'
      }
    ];
  };

  // CONDITIONAL RENDERING AFTER ALL HOOKS
  // If still loading settings, show loading state
  if (settingsLoading) {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <Lightbulb className="h-5 w-5" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Checking AI availability...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If AI intelligent suggestions is not enabled, show disabled message
  if (!isAIFeatureEnabled('intelligentSuggestions')) {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <Lightbulb className="h-5 w-5" />
            Smart Suggestions
            <Badge variant="outline" className="ml-auto text-xs bg-slate-100 text-slate-600">
              Disabled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center py-8">
          <Brain className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            AI Suggestions Disabled
          </h3>
          <p className="text-slate-600 text-center mb-4 max-w-sm">
            Enable intelligent suggestions in settings to get AI-powered recommendations for improving your knowledge graph.
          </p>
          <Button asChild variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50">
            <Link href="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Enable in Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Smart Suggestions
          <Badge variant="outline" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
            {filteredSuggestions.length} active
          </Badge>
        </CardTitle>
        <p className="text-sm text-slate-500">
          AI-powered recommendations to improve your knowledge graph
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "text-xs",
                selectedCategory === category 
                  ? "bg-slate-900 text-white" 
                  : "text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {category === 'all' ? 'All' : category}
            </Button>
          ))}
        </div>

        {/* Suggestions List */}
        <div className="space-y-4">
          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {dismissedSuggestions.size > 0 
                  ? "All suggestions completed or dismissed!"
                  : "No suggestions available. The AI is analyzing your project structure to generate smart recommendations."
                }
              </p>
              {dismissedSuggestions.size === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="mt-4 text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Refresh Suggestions
                </Button>
              )}
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <div key={suggestion.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {getSuggestionIcon(suggestion.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-900">{suggestion.title}</h4>
                        <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{suggestion.description}</p>
                      
                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className={getConfidenceColor(suggestion.confidence)}>
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                        {suggestion.timeToImplement && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{suggestion.timeToImplement}</span>
                          </div>
                        )}
                        {suggestion.estimatedImpact && (
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            <span>{suggestion.estimatedImpact}</span>
                          </div>
                        )}
                      </div>

                      {/* Related Entities */}
                      {suggestion.relatedEntities && suggestion.relatedEntities.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-600 mb-1">Related entities:</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.relatedEntities.map((entity, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                                {entity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDismiss(suggestion.id)}
                    className="text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(suggestion)}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    {suggestion.actionLabel}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {dismissedSuggestions.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissedSuggestions(new Set())}
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              Show {dismissedSuggestions.size} dismissed suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 