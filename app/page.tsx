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
  GitBranch
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";

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

  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadAllData();
  }, []);

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

  const handleNaturalLanguageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalLanguageQuery.trim() || !selectedProject) return;
    
    try {
      // This would integrate with your AI service
      console.log('Natural language query:', naturalLanguageQuery, 'for project:', selectedProject);
      // TODO: Implement actual natural language query
    } catch (error) {
      console.error('Query failed:', error);
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
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  Natural Language Query
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
                  <>
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <MessageSquare className="h-12 w-12 mb-4" />
                    </div>
                    <p className="text-center text-gray-500 mb-4">
                      Ask me anything about your knowledge graph
                    </p>
                    <p className="text-center text-sm text-gray-400 mb-4">
                      Try these examples:
                    </p>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left h-auto py-3"
                        onClick={() => setNaturalLanguageQuery("Show me all entities in this project")}
                      >
                        <Search className="h-4 w-4 mr-2 text-gray-400" />
                        Show me all entities in this project
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left h-auto py-3"
                        onClick={() => setNaturalLanguageQuery("What relationships exist between entities?")}
                      >
                        <Search className="h-4 w-4 mr-2 text-gray-400" />
                        What relationships exist between entities?
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left h-auto py-3"
                        onClick={() => setNaturalLanguageQuery("Find entities without relationships")}
                      >
                        <Search className="h-4 w-4 mr-2 text-gray-400" />
                        Find entities without relationships
                      </Button>
                    </div>
                    
                    <form onSubmit={handleNaturalLanguageSubmit} className="mt-6">
                      <div className="flex gap-2">
                        <Input
                          value={naturalLanguageQuery}
                          onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                          placeholder="Ask about your knowledge graph... (Press Enter to send)"
                          className="flex-1"
                          disabled={!selectedProject}
                        />
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!selectedProject}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </>
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