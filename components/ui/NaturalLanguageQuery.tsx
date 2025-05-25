"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Textarea } from './textarea';
import { ScrollArea } from './scroll-area';
import { cn } from '../../lib/utils';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Clock, 
  ArrowRight,
  Lightbulb,
  Search,
  Loader2,
  MessageSquare,
  Brain,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useSettings } from '../../lib/hooks/useSettings';

interface QueryResult {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
  entities: string[];
  relationships: string[];
  confidence: number;
  queryType: 'entity_search' | 'relationship_analysis' | 'pattern_discovery' | 'general';
}

interface Suggestion {
  text: string;
  type: 'query' | 'action';
  icon?: React.ReactNode;
}

interface NaturalLanguageQueryProps {
  projectId: string;
  className?: string;
  onEntityClick?: (entityId: string) => void;
}

export function NaturalLanguageQuery({ 
  projectId = 'default', 
  className,
  onEntityClick
}: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL
  // Use the settings hook to check AI feature availability
  const { isAIFeatureEnabled, loading: settingsLoading } = useSettings();

  // Mock suggestions - MOVED TO TOP LEVEL BEFORE ANY CONDITIONAL RETURNS
  useEffect(() => {
    const mockSuggestions: Suggestion[] = [
      { text: "Show me all components related to authentication", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "What are the main dependencies in this project?", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "Find entities connected to database operations", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "Explain the relationship between API and services", type: 'query', icon: <Lightbulb className="h-3 w-3" /> }
    ];
    setSuggestions(mockSuggestions);
  }, []);

  // NOW WE CAN DO CONDITIONAL RENDERING AFTER ALL HOOKS
  // If still loading settings, show loading state
  if (settingsLoading) {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <MessageSquare className="h-5 w-5" />
            Natural Language Query
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

  // If AI natural language query is not enabled, show disabled message
  if (!isAIFeatureEnabled('naturalLanguageQuery')) {
    return (
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-700">
            <MessageSquare className="h-5 w-5" />
            Natural Language Query
            <Badge variant="outline" className="ml-auto text-xs bg-slate-100 text-slate-600">
              Disabled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center py-8">
          <Brain className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            AI Query Disabled
          </h3>
          <p className="text-slate-600 text-center mb-4 max-w-sm">
            Enable natural language query in settings to ask questions about your knowledge graph using plain English.
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

  // Mock results for demo
  const mockResults: QueryResult[] = [
    {
      id: '1',
      query: 'Show me components related to user management',
      response: 'I found 5 components related to user management in your project. These include UserService (handles authentication and user operations), UserController (REST API endpoints), UserModel (data structure), AuthMiddleware (authentication checks), and UserRepository (database operations). These components form a complete user management system with clear separation of concerns.',
      timestamp: new Date(Date.now() - 300000),
      entities: ['UserService', 'UserController', 'UserModel', 'AuthMiddleware'],
      relationships: ['UserService -> UserRepository', 'UserController -> UserService'],
      confidence: 0.95,
      queryType: 'entity_search'
    },
    {
      id: '2',
      query: 'What are the performance bottlenecks?',
      response: 'Based on the analysis of your knowledge graph, I identified 3 potential performance bottlenecks: 1) Database queries in UserRepository lack proper indexing, 2) API endpoints don\'t implement caching mechanisms, and 3) The authentication middleware processes tokens on every request without caching validation results.',
      timestamp: new Date(Date.now() - 600000),
      entities: ['UserRepository', 'AuthMiddleware', 'APIEndpoints'],
      relationships: ['Database -> UserRepository', 'Cache -> APIEndpoints'],
      confidence: 0.87,
      queryType: 'pattern_discovery'
    }
  ];

  const handleSendQuery = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          includeContext: true,
          maxResults: 10,
          userId: 'default-user'
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process query');
      }

      const newResult: QueryResult = {
        id: Date.now().toString(),
        query: data.query,
        response: data.response,
        timestamp: new Date(data.timestamp),
        entities: data.entities || [],
        relationships: data.relationships || [],
        confidence: data.confidence || 0.7,
        queryType: data.queryType || 'general'
      };
      
      setResults(prev => [newResult, ...prev]);
      setQuery('');
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = 0;
        }
      }, 100);

    } catch (error) {
      console.error('Natural language query failed:', error);
      
      // Show error result
      const errorResult: QueryResult = {
        id: Date.now().toString(),
        query: query,
        response: `Sorry, I encountered an error processing your query: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or check your AI settings.`,
        timestamp: new Date(),
        entities: [],
        relationships: [],
        confidence: 0,
        queryType: 'general'
      };
      
      setResults(prev => [errorResult, ...prev]);
      setQuery('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    }
  };

  const handleUseSuggestion = (suggestion: Suggestion) => {
    setQuery(suggestion.text);
    textareaRef.current?.focus();
  };

  const getQueryTypeColor = (type: QueryResult['queryType']) => {
    switch (type) {
      case 'entity_search': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'relationship_analysis': return 'bg-green-50 text-green-700 border-green-200';
      case 'pattern_discovery': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getQueryTypeLabel = (type: QueryResult['queryType']) => {
    switch (type) {
      case 'entity_search': return 'Entity Search';
      case 'relationship_analysis': return 'Relationship Analysis';
      case 'pattern_discovery': return 'Pattern Discovery';
      default: return 'General Query';
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Card className="flex-1 border-slate-200 bg-white shadow-sm flex flex-col">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-slate-600" />
            Natural Language Query
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Ask questions about your knowledge graph in natural language
          </p>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col pt-4">
          {/* Query Results */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 mb-4 min-h-[300px]">
            <div className="space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-6">Ask me anything about your knowledge graph</p>
                  
                  {/* Suggestions */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 mb-3">Try these examples:</p>
                    <div className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleUseSuggestion(suggestion)}
                          className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {suggestion.icon}
                            <span className="text-sm text-slate-700">{suggestion.text}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {results.map((result) => (
                    <div key={result.id} className="space-y-3">
                      {/* User Query */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-700">{result.query}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-400">
                              {result.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-lg p-3">
                              <p className="text-sm text-slate-700 leading-relaxed">{result.response}</p>
                            </div>

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={getQueryTypeColor(result.queryType)}>
                                {getQueryTypeLabel(result.queryType)}
                              </Badge>
                              <Badge variant="outline" className="text-slate-600">
                                {Math.round(result.confidence * 100)}% confidence
                              </Badge>
                            </div>

                            {/* Entities & Relationships */}
                            {(result.entities.length > 0 || result.relationships.length > 0) && (
                              <div className="space-y-2">
                                {result.entities.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-600 mb-1">Related Entities:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {result.entities.map((entity, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => onEntityClick?.(entity)}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"
                                        >
                                          {entity}
                                          <ArrowRight className="h-3 w-3" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {result.relationships.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-600 mb-1">Key Relationships:</p>
                                    <div className="space-y-1">
                                      {result.relationships.map((rel, idx) => (
                                        <div key={idx} className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                          {rel}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Query Input */}
          <div className="border-t border-slate-100 pt-4 flex-shrink-0">
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your knowledge graph... (Press Enter to send)"
                  className="min-h-[80px] resize-none border-slate-200 focus:border-slate-300"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={handleSendQuery}
                disabled={!query.trim() || isLoading}
                className="self-end h-[80px] px-4 bg-slate-900 hover:bg-slate-800"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 