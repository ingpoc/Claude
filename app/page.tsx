"use client";

import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { 
  Brain, 
  Database, 
  Search, 
  Users, 
  Activity, 
  Sparkles,
  TrendingUp,
  PlusCircle,
  MessageSquare,
  BarChart3,
  Network,
  Clock,
  Settings,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Link2,
  Tag,
  GitBranch,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";
import { ScrollArea } from "../components/ui/scroll-area";
import { useSettings } from "../lib/hooks/useSettings";

interface DashboardStats {
  entities: number;
  relationships: number;
  projects: number;
  memvid_available: boolean;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  createdAt: string;
  projectId: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    entities: 0,
    relationships: 0,
    projects: 0,
    memvid_available: false
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntities, setRecentEntities] = useState<Entity[]>([]);
  const [recentRelationships, setRecentRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pythonServiceStatus, setPythonServiceStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    id: string;
    type: 'user' | 'assistant';
    message: string;
    timestamp: Date;
    entities?: any[];
    confidence?: number;
  }>>([]);
  
  // Get AI configuration from settings
  const { getAIConfig, isAIFeatureEnabled } = useSettings();

  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        checkPythonService(),
        fetchStats(),
        fetchProjects(),
        fetchRecentEntities(),
        fetchRecentRelationships()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPythonService = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        setPythonServiceStatus('running');
        return true;
      } else {
        setPythonServiceStatus('stopped');
        return false;
      }
    } catch (error) {
      setPythonServiceStatus('stopped');
      return false;
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        const data = await response.json();
        setStats({
          entities: data.entities || 0,
          relationships: data.relationships || 0,
          projects: data.projects || 0,
          memvid_available: data.memvid_available || false
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data || []);
        // Set first project as selected if none selected
        if (data && data.length > 0 && !selectedProject) {
          setSelectedProject(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchRecentEntities = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/entities');
      if (response.ok) {
        const data = await response.json();
        // Get the 5 most recent entities
        const recent = (data || [])
          .sort((a: Entity, b: Entity) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentEntities(recent);
      }
    } catch (error) {
      console.error('Failed to fetch recent entities:', error);
      setRecentEntities([]);
    }
  };

  const fetchRecentRelationships = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/relationships');
      if (response.ok) {
        const data = await response.json();
        // Get the 5 most recent relationships
        const recent = (data || [])
          .sort((a: Relationship, b: Relationship) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentRelationships(recent);
      }
    } catch (error) {
      console.error('Failed to fetch recent relationships:', error);
      setRecentRelationships([]);
    }
  };

  // Animation effects
  useEffect(() => {
    if (!isLoading && headerRef.current && statsRef.current && contextRef.current) {
      const tl = gsap.timeline();
      
      gsap.set([headerRef.current, statsRef.current, contextRef.current], { opacity: 0, y: 30 });
      
      tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.4")
        .to(contextRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.3");
    }
  }, [isLoading]);

  // Use configured AI model for intelligent responses
  const generateAIResponse = async (query: string, searchResults: any, projectData: any): Promise<{ message: string; confidence: number }> => {
    const aiConfig = getAIConfig();
    const entities = searchResults.entities || [];
    const projectName = projects.find(p => p.id === selectedProject)?.name || 'your project';
    
    // Check if AI is properly configured
    if (!aiConfig.enabled || !aiConfig.config.apiKey) {
      return {
        message: `AI features are not configured. Please set up your OpenRouter API key in Settings to get intelligent responses.`,
        confidence: 0.1
      };
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
            query: query,
            project_id: selectedProject,
            ai_config: aiConfig,
            include_context: true,
            max_results: 10
          })
        });
        
        if (backendResponse.ok) {
          const result = await backendResponse.json();
          if (result.success) {
            return {
              message: result.response,
              confidence: result.confidence || 0.9
            };
          } else {
            console.warn('Backend AI query failed:', result.error);
            // Fall through to direct API call
          }
        }
      } catch (backendError) {
        console.warn('Backend AI endpoint not available, using direct API call:', backendError);
        // Fall through to direct API call
      }
      
      // Fallback to direct OpenRouter API call
      const context = `You are an AI assistant helping users understand their knowledge graph project "${projectName}". 

Project Statistics:
- Total entities: ${projectData.entityCount}
- Total relationships: ${projectData.relationshipCount}
- Entity types: ${projectData.entities.map((e: any) => e.type).filter((type: string, index: number, arr: string[]) => arr.indexOf(type) === index).join(', ')}

Search Results for "${query}":
${entities.map((e: any, i: number) => `${i + 1}. ${e.name} (${e.type}): ${e.description}`).join('\n')}

User Question: ${query}

Provide a helpful, conversational response about the search results and knowledge graph. Be specific about the entities found and suggest follow-up actions. Keep it concise but informative.`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'MCP Knowledge Graph'
        },
        body: JSON.stringify({
          model: aiConfig.config.model,
          messages: [{ role: 'user', content: context }],
          max_tokens: Math.min(aiConfig.config.maxTokens || 2048, 1000),
          temperature: aiConfig.config.temperature || 0.7
        })
      });

      if (response.ok) {
        const result = await response.json();
        const aiMessage = result.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
        
        return {
          message: aiMessage,
          confidence: 0.9
        };
      } else if (response.status === 401) {
        return {
          message: 'API key is invalid. Please check your OpenRouter API key in Settings.',
          confidence: 0.1
        };
      } else if (response.status === 429) {
        return {
          message: 'Rate limit exceeded. Please try again in a moment.',
          confidence: 0.3
        };
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('AI response error:', error);
      
      // Fallback to simple response if AI fails
      if (entities.length === 0) {
        return {
          message: `I couldn't find any entities matching "${query}" in ${projectName}. Try asking about specific concepts, types, or relationships in your knowledge graph.`,
          confidence: 0.3
        };
      }
      
      const simpleResponse = `I found ${entities.length} entities matching "${query}" in ${projectName}:\n\n${entities.slice(0, 3).map((e: any) => `• **${e.name}** (${e.type}) - ${e.description}`).join('\n')}${entities.length > 3 ? `\n\n...and ${entities.length - 3} more entities.` : ''}`;
      
      return {
        message: simpleResponse + '\n\n(Note: AI features unavailable - using basic search results)',
        confidence: 0.6
      };
    }
  };

  const handleNaturalLanguageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalLanguageQuery.trim() || !selectedProject || isQuerying) return;
    
    const userQuery = naturalLanguageQuery.trim();
    setIsQuerying(true);
    
    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      message: userQuery,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);
    setNaturalLanguageQuery('');
    
    try {
      // Fetch project entities and relationships for context
      const [entitiesResponse, relationshipsResponse, searchResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/entities?project_id=${selectedProject}`),
        fetch(`http://localhost:8000/api/relationships?project_id=${selectedProject}`),
        fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(userQuery)}&project_id=${selectedProject}&limit=10`)
      ]);
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        const projectEntities = entitiesResponse.ok ? await entitiesResponse.json() : [];
        const projectRelationships = relationshipsResponse.ok ? await relationshipsResponse.json() : [];
        
        const projectData = {
          entities: projectEntities,
          relationships: projectRelationships,
          entityCount: projectEntities.length,
          relationshipCount: projectRelationships.length
        };
        
        const aiResponse = await generateAIResponse(userQuery, searchResults, projectData);
        
        // Add AI response to chat
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          message: aiResponse.message,
          timestamp: new Date(),
          entities: searchResults.entities || [],
          confidence: aiResponse.confidence
        };
        setChatHistory(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          message: 'I\'m having trouble accessing the knowledge graph. Please make sure the Python service is running at http://localhost:8000.',
          timestamp: new Date(),
          confidence: 0.1
        };
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Query failed:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        message: 'I encountered an error while processing your query. Please check that the Python service is running.',
        timestamp: new Date(),
        confidence: 0.1
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsQuerying(false);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div ref={headerRef} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              MCP Knowledge Graph Dashboard
            </h1>
            <p className="text-gray-600">
              Manage your knowledge graphs with context intelligence and AI-powered insights
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>

        {/* Python Service Status Alert */}
        {pythonServiceStatus === 'stopped' && (
          <div className="mb-8">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <h3 className="font-medium text-red-800">Python Memvid Service Not Running</h3>
                    <p className="text-sm text-red-600 mt-1">
                      Start the service with: <code className="bg-red-100 px-2 py-1 rounded">python python_memvid_service.py</code>
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={checkPythonService} className="ml-auto">
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            Hi, User! 👋
          </h2>
          <p className="text-gray-600 mb-4">Welcome back to your knowledge graph dashboard.</p>
          <p className="text-gray-600">Let&apos;s explore your data universe.</p>
          
          <div className="flex items-center gap-4 mt-4">
            <Input 
              placeholder="Search projects, entities..."
              className="max-w-md"
            />
            <Link href="/projects">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Total Projects</CardTitle>
              <Database className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.projects}</div>
              <p className="text-xs text-blue-200">Active projects in your workspace</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Total Entities</CardTitle>
              <Brain className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.entities}</div>
              <p className="text-xs text-emerald-200">Knowledge entities across projects</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Total Relationships</CardTitle>
              <Network className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.relationships}</div>
              <p className="text-xs text-purple-200">Connections between entities</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Service Status</CardTitle>
              <Users className="h-4 w-4 text-orange-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pythonServiceStatus === 'running' ? '✓' : '✗'}
              </div>
              <p className="text-xs text-orange-200">
                {pythonServiceStatus === 'running' ? 'Python service running' : 'Service offline'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div ref={contextRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Natural Language Query Section */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-indigo-600" />
                    Natural Language Query
                  </div>
                  {chatHistory.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setChatHistory([])}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Clear Chat
                    </Button>
                  )}
                </CardTitle>
                {projects.length > 0 && (
                  <>
                    <p className="text-sm text-gray-600">Select Project</p>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a project..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">No projects found</p>
                    <Link href="/projects">
                      <Button>Create Your First Project</Button>
                    </Link>
                  </div>
                ) : pythonServiceStatus !== 'running' ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-400" />
                    <p className="text-gray-500 mb-4">Python service required for queries</p>
                    <Button onClick={checkPythonService} variant="outline">
                      Check Service Status
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col h-96">
                    {/* Chat History */}
                    <ScrollArea className="flex-1 mb-4 p-4 border rounded-lg bg-gray-50">
                      {chatHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-gray-500 mb-4">
                            Ask me anything about your knowledge graph
                          </p>
                          <div className="space-y-2 text-left">
                            <button
                              onClick={() => setNaturalLanguageQuery("Show me all entities in this project")}
                              className="block w-full text-left p-2 rounded hover:bg-gray-100 text-sm text-gray-600"
                            >
                              • Show me all entities in this project
                            </button>
                            <button
                              onClick={() => setNaturalLanguageQuery("What relationships exist between entities?")}
                              className="block w-full text-left p-2 rounded hover:bg-gray-100 text-sm text-gray-600"
                            >
                              • What relationships exist between entities?
                            </button>
                            <button
                              onClick={() => setNaturalLanguageQuery("Find entities without relationships")}
                              className="block w-full text-left p-2 rounded hover:bg-gray-100 text-sm text-gray-600"
                            >
                              • Find entities without relationships
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatHistory.map((message) => (
                            <div key={message.id} className={cn(
                              "flex items-start gap-3",
                              message.type === 'user' ? 'justify-end' : 'justify-start'
                            )}>
                              {message.type === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <Bot className="h-4 w-4 text-blue-600" />
                                </div>
                              )}
                              <div className={cn(
                                "max-w-[70%] rounded-lg p-3",
                                message.type === 'user' 
                                  ? 'bg-blue-600 text-white ml-auto' 
                                  : 'bg-white border border-gray-200'
                              )}>
                                <div className={cn(
                                  "text-sm whitespace-pre-wrap",
                                  message.type === 'user' ? 'text-white' : 'text-gray-700'
                                )}>
                                  {message.message.split('**').map((part, index) => 
                                    index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                                  )}
                                </div>
                                {message.confidence && (
                                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                    <TrendingUp className="h-3 w-3" />
                                    <span>{Math.round(message.confidence * 100)}% confidence</span>
                                  </div>
                                )}
                                <div className={cn(
                                  "text-xs mt-1",
                                  message.type === 'user' ? 'text-blue-200' : 'text-gray-400'
                                )}>
                                  {message.timestamp.toLocaleTimeString()}
                                </div>
                              </div>
                              {message.type === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Users className="h-4 w-4 text-gray-600" />
                                </div>
                              )}
                            </div>
                          ))}
                          {isQuerying && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                  Thinking...
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                    
                    {/* Chat Input */}
                    <form onSubmit={handleNaturalLanguageSubmit} className="flex gap-2">
                      <Input
                        value={naturalLanguageQuery}
                        onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                        placeholder="Ask about your knowledge graph... (Press Enter to send)"
                        className="flex-1"
                        disabled={!selectedProject || isQuerying}
                      />
                      <Button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700" 
                        disabled={!selectedProject || isQuerying || !naturalLanguageQuery.trim()}
                      >
                        {isQuerying ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Sidebar */}
          <div>
            <Card className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentEntities.length === 0 && recentRelationships.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Create entities and relationships to see activity</p>
                  </div>
                ) : (
                  <>
                    {/* Recent Entities */}
                    {recentEntities.map((entity) => (
                      <div key={entity.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Brain className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entity.name}</p>
                          <p className="text-xs text-gray-500">
                            Created {formatTimeAgo(entity.createdAt)} • {entity.type}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Recent Relationships */}
                    {recentRelationships.map((relationship) => (
                      <div key={relationship.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Link2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Relationship: {relationship.type}</p>
                          <p className="text-xs text-gray-500">
                            Created {formatTimeAgo(relationship.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Projects Section */}
        {projects.length > 0 && (
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Your Projects</CardTitle>
                <Link href="/projects">
                  <Button variant="outline">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.slice(0, 3).map((project) => (
                  <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium">{project.name}</CardTitle>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-600">{project.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>📅 Created {new Date(project.createdAt).toLocaleDateString()}</span>
                        <Link href={`/projects/${project.id}`}>
                          <Button size="sm" variant="ghost">
                            View →
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State for No Projects */}
        {projects.length === 0 && pythonServiceStatus === 'running' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="text-center py-12">
              <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
              <p className="text-gray-600 mb-6">Create your first project to start building your knowledge graph!</p>
              <Link href="/projects">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}