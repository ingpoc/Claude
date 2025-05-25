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

  // Mock suggestions for demo - Initialize suggestions
  useEffect(() => {
    const mockSuggestions: Suggestion[] = [
      {
        id: '1',
        type: 'entity_creation',
        title: 'Create API Gateway Entity',
        description: 'Your system seems to have multiple API endpoints. Consider creating an API Gateway entity to centralize routing and management.',
        confidence: 0.89,
        priority: 'high',
        category: 'Architecture',
        actionLabel: 'Create Entity',
        relatedEntities: ['UserAPI', 'AuthAPI', 'DataAPI'],
        estimatedImpact: 'Improves system organization',
        timeToImplement: '5 minutes'
      },
      {
        id: '2',
        type: 'relationship_suggestion',
        title: 'Link Database to Services',
        description: 'I noticed several service entities that likely interact with your database. Adding these relationships would improve clarity.',
        confidence: 0.92,
        priority: 'medium',
        category: 'Relationships',
        actionLabel: 'Add Relationships',
        relatedEntities: ['UserService', 'Database', 'AuthService'],
        estimatedImpact: 'Better dependency tracking',
        timeToImplement: '3 minutes'
      },
      {
        id: '3',
        type: 'pattern_insight',
        title: 'Microservices Pattern Detected',
        description: 'Your architecture follows a microservices pattern. Consider documenting service boundaries and communication protocols.',
        confidence: 0.85,
        priority: 'medium',
        category: 'Patterns',
        actionLabel: 'Document Pattern',
        relatedEntities: ['UserService', 'AuthService', 'NotificationService'],
        estimatedImpact: 'Clearer architecture documentation',
        timeToImplement: '10 minutes'
      },
      {
        id: '4',
        type: 'optimization',
        title: 'Consolidate Similar Entities',
        description: 'Found entities with similar names that might be duplicates: "User Model" and "UserModel". Consider merging them.',
        confidence: 0.95,
        priority: 'low',
        category: 'Optimization',
        actionLabel: 'Review & Merge',
        relatedEntities: ['User Model', 'UserModel'],
        estimatedImpact: 'Reduces duplication',
        timeToImplement: '2 minutes'
      },
      {
        id: '5',
        type: 'knowledge_gap',
        title: 'Missing Error Handling Documentation',
        description: 'Your API entities lack error handling documentation. This could improve system reliability understanding.',
        confidence: 0.78,
        priority: 'medium',
        category: 'Documentation',
        actionLabel: 'Add Documentation',
        relatedEntities: ['API Endpoints', 'Error Handling'],
        estimatedImpact: 'Better error management',
        timeToImplement: '15 minutes'
      }
    ];
    setSuggestions(mockSuggestions);
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
                  : "No suggestions available right now."
                }
              </p>
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