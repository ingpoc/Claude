"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Brain, Network, Plus, Search, Filter, Grid3X3, List } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

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

export default function ProjectDetailPage() {
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

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/projects')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-gray-600 mt-1">{project.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Entities</CardTitle>
              <Brain className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.length}</div>
              <p className="text-xs text-blue-200">Knowledge entities</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Relationships</CardTitle>
              <Network className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{relationships.length}</div>
              <p className="text-xs text-purple-200">Entity connections</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Types</CardTitle>
              <Filter className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueTypes.length}</div>
              <p className="text-xs text-emerald-200">Unique entity types</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
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
        </div>

        {/* Entities */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Entities ({filteredEntities.length})
          </h2>
          
          {filteredEntities.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Entities Found</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery || typeFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'This project doesn\'t have any entities yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
            }>
              {filteredEntities.map((entity) => (
                <Card key={entity.id} className="bg-white hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium">{entity.name}</CardTitle>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {entity.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600 line-clamp-3">{entity.description}</p>
                    
                    {entity.observations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          Observations ({entity.observations.length})
                        </p>
                        <div className="space-y-1">
                          {entity.observations.slice(0, 2).map((obs) => (
                            <p key={obs.id} className="text-xs text-gray-500 line-clamp-2">
                              {obs.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>By {entity.addedBy}</span>
                      <span>{formatTimeAgo(entity.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Relationships */}
        {relationships.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Relationships ({relationships.length})
            </h2>
            
            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {relationships.map((relationship) => {
                    const sourceEntity = entities.find(e => e.id === relationship.sourceId);
                    const targetEntity = entities.find(e => e.id === relationship.targetId);
                    
                    return (
                      <div key={relationship.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-blue-600">
                              {sourceEntity?.name || 'Unknown Entity'}
                            </span>
                            <span className="text-gray-400">→</span>
                            <Badge variant="outline" className="mx-2">
                              {relationship.type}
                            </Badge>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-purple-600">
                              {targetEntity?.name || 'Unknown Entity'}
                            </span>
                          </div>
                          {relationship.description && (
                            <p className="text-xs text-gray-600 mt-1">{relationship.description}</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimeAgo(relationship.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}