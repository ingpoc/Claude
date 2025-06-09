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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Label } from './label';

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

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface NaturalLanguageQueryProps {
  projectId: string;
  allProjects?: Project[];
  className?: string;
  onEntityClick?: (entityId: string) => void;
}

export function NaturalLanguageQuery({ 
  projectId: initialProjectId,
  allProjects = [],
  className,
  onEntityClick
}: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  
  // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL
  // Use the settings hook to check AI feature availability
  const { isAIFeatureEnabled, getAIConfig, loading: settingsLoading } = useSettings();

  // Update selectedProjectId if initialProjectId changes and is valid
  useEffect(() => {
    if (initialProjectId && allProjects.some(p => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
    } else if (allProjects.length > 0) {
      setSelectedProjectId(allProjects[0].id); // Default to first project if initial is invalid
    } else {
      setSelectedProjectId("_determine_"); // Fallback if no projects
    }
  }, [initialProjectId, allProjects]);

  // Mock suggestions - Initialize suggestions
  useEffect(() => {
    const mockSuggestions: Suggestion[] = [
      { text: "Show me all components related to authentication", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "What are the main dependencies in this project?", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "Find entities connected to database operations", type: 'query', icon: <Search className="h-3 w-3" /> },
      { text: "Explain the relationship between API and services", type: 'query', icon: <Lightbulb className="h-3 w-3" /> }
    ];
    setSuggestions(mockSuggestions);
  }, []);

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
    
    // Use the selectedProjectId from state
    let targetProjectId = selectedProjectId;

    // If selectedProjectId is somehow not set (e.g. no projects), or is explicitly "_determine_"
    // and allProjects are available, set it to "_determine_" for backend processing.
    if ((!targetProjectId || targetProjectId === "_determine_") && allProjects && allProjects.length > 0) {
      targetProjectId = "_determine_"; 
    } else if (!targetProjectId && (!allProjects || allProjects.length === 0)) {
      // No project selected and no projects available, cannot send query
      console.error("No project selected and no projects available.");
      // Optionally set an error state to display to the user
      // For now, just log and return
      setIsLoading(false);
      return;
    }
    
    const requestBody: any = {
      query: query.trim(),
      includeContext: true,
      maxResults: 10,
      userId: 'default-user'
    };

    if (targetProjectId === "_determine_") {
      requestBody.allProjects = allProjects.map(p => ({ id: p.id, name: p.name, description: p.description }));
    }

    try {
      // Try Python backend AI endpoint first (if available)
      try {
        const backendResponse = await fetch('http://localhost:8000/api/ai-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
            project_id: targetProjectId === '_determine_' ? null : targetProjectId,
            ai_config: getAIConfig(),
            include_context: true,
            max_results: 10
          })
        });
        
        if (backendResponse.ok) {
          const data = await backendResponse.json();
          if (data.success) {
            const newResult: QueryResult = {
              id: Date.now().toString(),
              query: data.query,
              response: data.response,
              timestamp: new Date(data.timestamp),
              entities: data.entities || [],
              relationships: data.relationships || [],
              confidence: data.confidence || 0.9,
              queryType: data.queryType || 'ai_processed'
            };
            
            setResults(prev => [newResult, ...prev]);
            setQuery('');
            
            // Scroll to bottom
            setTimeout(() => {
              if (scrollAreaRef.current) {
                scrollAreaRef.current.scrollTop = 0;
              }
            }, 100);
            
            return; // Success, exit early
          } else {
            console.warn('Backend AI query failed:', data.error);
            // Fall through to demo response
          }
        }
      } catch (backendError) {
        console.warn('Backend AI endpoint not available:', backendError);
        // Fall through to demo response
      }
      
      // Fallback to demo response if AI is not available
      console.log('Using demo response for query:', query.trim());
      const newResult: QueryResult = {
        ...mockResults[0],
        id: Date.now().toString(),
        query: query.trim(),
        response: `Demo response for "${query.trim()}": ${mockResults[0].response}\n\n*Note: Configure your OpenRouter API key in Settings to get real AI responses.*`,
        timestamp: new Date(),
        confidence: 0.5
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
      console.error('Query failed:', error);
      // For demo purposes, use mock results
      const newResult: QueryResult = mockResults[0];
      setResults(prev => [{ ...newResult, id: Date.now().toString(), query: query.trim() }, ...prev]);
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
      case 'entity_search': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'relationship_analysis': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'pattern_discovery': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getQueryTypeLabel = (type: QueryResult['queryType']) => {
    switch (type) {
      case 'entity_search': return 'Entity Search';
      case 'relationship_analysis': return 'Relationships';
      case 'pattern_discovery': return 'Pattern Analysis';
      default: return 'General';
    }
  };

  // CONDITIONAL RENDERING AFTER ALL HOOKS
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

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-700">
          <MessageSquare className="h-5 w-5" />
          Natural Language Query
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Project Selection Dropdown */}
        {allProjects && allProjects.length > 0 && (
          <div className="mb-2">
            <Label htmlFor="nlq-project-select" className="text-xs text-slate-600 mb-1 block">Select Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="nlq-project-select" className="w-full">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {allProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                {/* Option to let AI determine project if needed */}
                <SelectItem value="_determine_">Let AI decide / All Projects</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
                            <div 
                              className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: formatAIResponse(result.response) }}
                            ></div>
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
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your knowledge graph... (Press Enter to send)"
                  className="pr-20 pl-4 py-3 text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm resize-none"
                  rows={2}
                />
                <Button 
                  type="button" 
                  size="icon" 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                  onClick={handleSendQuery}
                  disabled={isLoading || !query.trim() || (!selectedProjectId && (!allProjects || allProjects.length === 0))}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to format AI response with better structure
function formatAIResponse(text: string): string {
  if (!text) return '';

  let html = text;

  // Remove any entity ID references (UUIDs in parentheses)
  html = html.replace(/\s*\([a-f0-9\-]{36}\)/gi, '');
  
  // Remove standalone entity IDs
  html = html.replace(/\b[a-f0-9\-]{36}\b/gi, '');

  // Convert numbered lists (1. 2. 3.) to proper HTML lists
  const numberedListPattern = /^(\d+\.\s+.*?)(?=\n\d+\.\s+|\n\n|\n[^0-9]|\n$|$)/gms;
  if (html.match(/^\d+\.\s+/m)) {
    html = html.replace(numberedListPattern, (match) => {
      const items = match.split(/\n(?=\d+\.\s+)/).map(item => 
        item.replace(/^\d+\.\s*/, '').trim()
      );
      return '<ol>' + items.map(item => `<li>${item}</li>`).join('') + '</ol>';
    });
  }

  // Convert markdown-style bold (**text**) to <strong>text</strong>
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

  // Convert markdown headings (## Heading, ### Heading) to <h2>, <h3>
  html = html.replace(/^###\s+(.*$)/gim, '<h3 class="text-sm font-semibold text-slate-800 mt-3 mb-1">$1</h3>');
  html = html.replace(/^##\s+(.*$)/gim, '<h2 class="text-base font-semibold text-slate-900 mt-4 mb-2">$1</h2>');

  // Convert remaining newlines to proper paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p class="mb-2">');
  html = html.replace(/\n/g, '<br />');
  
  // Wrap in paragraph if not already structured
  if (!html.includes('<p>') && !html.includes('<ol>') && !html.includes('<ul>')) {
    html = `<p class="mb-2">${html}</p>`;
  } else {
    html = `<p class="mb-2">${html}</p>`;
  }

  // Clean up any multiple paragraph tags
  html = html.replace(/<\/p><p[^>]*><br \/>/g, '</p><p class="mb-2">');
  html = html.replace(/<p[^>]*><\/p>/g, '');

  return html;
}