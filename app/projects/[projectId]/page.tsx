"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { 
  ArrowLeft, Brain, Network, Plus, Search, Filter, Grid3X3, List, 
  BarChart3, TrendingUp, Activity, Eye, MessageSquare, Sparkles,
  Zap, GitBranch, Clock, Users, Target, ChevronDown, ChevronRight,
  FileText, LinkIcon, Settings, Download, Share2, Star
} from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Progress } from "../../../components/ui/progress";
import { Separator } from "../../../components/ui/separator";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
  entityCount?: number;
  relationshipCount?: number;
  activityScore?: number;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  addedBy: string;
  observations: Array<{
    id: string;
    text: string;
    addedBy: string;
    createdAt: string;
  }>;
}

interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  createdAt: string;
  projectId: string;
  addedBy: string;
}

interface ActivityItem {
  id: string;
  type: 'entity_created' | 'relationship_created' | 'observation_added';
  title: string;
  description: string;
  timestamp: string;
  user: string;
  icon: React.ReactNode;
}

export default function EnhancedProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  // Animation refs
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  useEffect(() => {
    // GSAP animations
    if (!isLoading && headerRef.current && statsRef.current && contentRef.current) {
      const tl = gsap.timeline();
      
      gsap.set([headerRef.current, statsRef.current, contentRef.current], { opacity: 0, y: 30 });
      
      tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.4")
        .to(contentRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.3");
    }
  }, [isLoading]);

  const loadProjectData = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      // Load project details
      const projectResponse = await fetch(`http://localhost:8000/api/projects/${projectId}`);
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProject(projectData);
      }

      // Load entities for this project
      const entitiesResponse = await fetch(`http://localhost:8000/api/entities?project_id=${projectId}`);
      if (entitiesResponse.ok) {
        const entitiesData = await entitiesResponse.json();
        setEntities(entitiesData || []);
      }

      // Load relationships for this project
      const relationshipsResponse = await fetch(`http://localhost:8000/api/relationships?project_id=${projectId}`);
      if (relationshipsResponse.ok) {
        const relationshipsData = await relationshipsResponse.json();
        setRelationships(relationshipsData || []);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entity.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || entity.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const uniqueTypes = [...new Set(entities.map(entity => entity.type))];

  // Generate activity timeline
  const generateActivity = (): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    entities.forEach(entity => {
      activities.push({
        id: `entity-${entity.id}`,
        type: 'entity_created',
        title: `Created entity "${entity.name}"`,
        description: `Added ${entity.type} entity with description`,
        timestamp: entity.createdAt,
        user: entity.addedBy,
        icon: <Brain className="h-4 w-4" />
      });
      
      entity.observations.forEach((obs, obsIndex) => {
        activities.push({
          id: `obs-${entity.id}-${obs.id}-${obsIndex}`,
          type: 'observation_added',
          title: `Added observation`,
          description: obs.text.substring(0, 100) + '...',
          timestamp: obs.createdAt,
          user: obs.addedBy,
          icon: <FileText className="h-4 w-4" />
        });
      });
    });
    
    relationships.forEach(rel => {
      activities.push({
        id: `rel-${rel.id}`,
        type: 'relationship_created',
        title: `Connected entities`,
        description: `Created ${rel.type} relationship`,
        timestamp: rel.createdAt,
        user: rel.addedBy,
        icon: <LinkIcon className="h-4 w-4" />
      });
    });
    
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  const calculateProjectHealth = (): number => {
    const entityScore = Math.min(entities.length * 10, 50);
    const relationshipScore = Math.min(relationships.length * 20, 30);
    const observationScore = Math.min(entities.reduce((acc, e) => acc + e.observations.length, 0) * 5, 20);
    return entityScore + relationshipScore + observationScore;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
          <p className="text-gray-600 mb-6">The project you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const activities = generateActivity();
  const projectHealth = calculateProjectHealth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Enhanced Header */}
        <div ref={headerRef} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/projects')} className="hover:scale-105 transition-transform">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  <Activity className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              {project.description && (
                <p className="text-gray-600">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created {formatTimeAgo(project.createdAt)}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Health: {projectHealth}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards with Progress */}
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white transform hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Entities</CardTitle>
              <Brain className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.length}</div>
              <Progress value={(entities.length / 10) * 100} className="mt-2" />
              <p className="text-xs text-blue-200 mt-1">Knowledge entities</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white transform hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Relationships</CardTitle>
              <Network className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{relationships.length}</div>
              <Progress value={(relationships.length / 5) * 100} className="mt-2" />
              <p className="text-xs text-purple-200 mt-1">Entity connections</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white transform hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Types</CardTitle>
              <Target className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueTypes.length}</div>
              <Progress value={(uniqueTypes.length / 3) * 100} className="mt-2" />
              <p className="text-xs text-emerald-200 mt-1">Unique categories</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white transform hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Health Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projectHealth}%</div>
              <Progress value={projectHealth} className="mt-2" />
              <p className="text-xs text-orange-200 mt-1">Project completeness</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabbed Interface */}
        <div ref={contentRef}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-fit">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Entities
              </TabsTrigger>
              <TabsTrigger value="relationships" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Graph
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Quick Stats */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Project Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Entity Distribution</p>
                        {uniqueTypes.map(type => {
                          const count = entities.filter(e => e.type === type).length;
                          const percentage = (count / entities.length) * 100;
                          return (
                            <div key={type} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize">{type}</span>
                                <span>{count}</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                        <div className="space-y-2">
                          {activities.slice(0, 3).map((activity) => (
                            <div key={activity.id} className="flex items-center gap-2 text-sm">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                {activity.icon}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{activity.title}</p>
                                <p className="text-gray-500 text-xs">{formatTimeAgo(activity.timestamp)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entity
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Create Relationship
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Natural Query
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Suggestions
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="entities" className="space-y-6">
              {/* Enhanced Filters */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search entities..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {uniqueTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Entities Display */}
              {filteredEntities.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Brain className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Entities Found</h3>
                    <p className="text-gray-600 mb-6">
                      {searchQuery || typeFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria.'
                        : 'This project doesn\'t have any entities yet.'}
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Entity
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4"
                }>
                  {filteredEntities.map((entity) => (
                    <Card key={entity.id} className="bg-white hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Brain className="h-4 w-4 text-blue-500" />
                            {entity.name}
                          </CardTitle>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {entity.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-gray-600 line-clamp-3">{entity.description}</p>
                        
                        {entity.observations.length > 0 && (
                          <div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedEntity(expandedEntity === entity.id ? null : entity.id)}
                              className="p-0 h-auto font-medium text-xs"
                            >
                              {expandedEntity === entity.id ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                              Observations ({entity.observations.length})
                            </Button>
                            
                            {expandedEntity === entity.id && (
                              <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-100">
                                {entity.observations.map((obs, obsIndex) => (
                                  <div key={`${entity.id}-obs-${obs.id}-${obsIndex}`} className="space-y-1">
                                    <p className="text-xs text-gray-700">{obs.text}</p>
                                    <p className="text-xs text-gray-400">
                                      By {obs.addedBy} • {formatTimeAgo(obs.createdAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {entity.addedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(entity.createdAt)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="relationships" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Knowledge Graph Relationships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {relationships.length === 0 ? (
                    <div className="text-center py-12">
                      <Network className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Relationships</h3>
                      <p className="text-gray-600 mb-6">Connect entities to build your knowledge graph.</p>
                      <Button>
                        <GitBranch className="h-4 w-4 mr-2" />
                        Create Relationship
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {relationships.map((relationship) => {
                        const sourceEntity = entities.find(e => e.id === relationship.sourceId);
                        const targetEntity = entities.find(e => e.id === relationship.targetId);
                        
                        return (
                          <div key={relationship.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {sourceEntity?.name.charAt(0) || '?'}
                                  </div>
                                  <span className="font-medium text-blue-600">
                                    {sourceEntity?.name || 'Unknown Entity'}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                                  <Badge variant="outline" className="mx-2 bg-white">
                                    {relationship.type}
                                  </Badge>
                                  <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {targetEntity?.name.charAt(0) || '?'}
                                  </div>
                                  <span className="font-medium text-purple-600">
                                    {targetEntity?.name || 'Unknown Entity'}
                                  </span>
                                </div>
                              </div>
                              {relationship.description && (
                                <p className="text-xs text-gray-600 mt-2 ml-10">{relationship.description}</p>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(relationship.createdAt)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Project Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity</h3>
                      <p className="text-gray-600">Project activity will appear here as you work.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              {activity.icon}
                            </div>
                            {index < activities.length - 1 && (
                              <div className="w-px h-8 bg-gray-200 mt-2"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">{activity.title}</h4>
                              <span className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">by {activity.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}