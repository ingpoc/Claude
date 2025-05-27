"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';
import { PlusSquare, Search, Sparkles, FolderPlus, Grid3X3, List, Filter } from 'lucide-react';
import ProjectCard from '../../components/ProjectCard';
import EnhancedProjectCard from '../../components/EnhancedProjectCard';
import CreateProjectModal from '../../components/CreateProjectModal';
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { deleteProjectAction, getProjectsAction } from '../actions/knowledgeGraphActions';
import { cn } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const projectsGridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter projects based on search query
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate stats
  const stats = {
    total: projects.length,
    recent: projects.filter(p => {
      const lastAccessed = new Date(p.lastAccessed || p.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return lastAccessed > weekAgo;
    }).length,
    active: projects.filter(p => p.lastAccessed).length
  };

  const fetchProjects = useCallback(async (bustCache: boolean = false) => {
    setIsLoading(true);
    try {
      const data = await getProjectsAction(bustCache);
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Enhanced entrance animations
  useEffect(() => {
    if (!isLoading && headerRef.current && statsRef.current && projectsGridRef.current && searchRef.current) {
      const tl = gsap.timeline();
      
      // Reset positions
      gsap.set([headerRef.current, searchRef.current, statsRef.current], { opacity: 0, y: 30 });
      gsap.set(projectsGridRef.current, { opacity: 0, y: 50 });
      
      tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" })
        .to(searchRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.2")
        .to(projectsGridRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.1");
    }
  }, [isLoading]);

  const handleCreateProject = async (name: string, description: string) => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || '';
      const response = await fetch(`${API_BASE_URL}/api/ui/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      if (response.ok) {
        // Bust cache to ensure we get fresh data after creation
        await fetchProjects(true);
      } else {
        console.error("Failed to create project:", response.statusText);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
    setIsModalOpen(false);
  };

  const handleDeleteProject = useCallback(async (projectIdToDelete: string) => {
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      // Optimistically update UI immediately
      const originalProjects = [...projects];
      setProjects(projects.filter(p => p.id !== projectIdToDelete));
      
      try {
        const success = await deleteProjectAction(projectIdToDelete);
        if (success) {
          // Refresh from server to ensure data consistency
          await fetchProjects(true);
        } else {
          // Revert optimistic update on failure
          setProjects(originalProjects);
          console.error(`Failed to delete project ${projectIdToDelete}`);
          alert(`Failed to delete project ${projectIdToDelete}.`);
        }
      } catch (error) {
        // Revert optimistic update on error
        setProjects(originalProjects);
        console.error('Error deleting project:', error);
        alert(`Error deleting project ${projectIdToDelete}.`);
      }
    }
  }, [projects, fetchProjects]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header */}
        <div ref={headerRef} className="mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20">
                  <FolderPlus className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  Projects
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Manage your knowledge graph projects and organize entities
              </p>
            </div>
            
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              <PlusSquare className="mr-2 h-5 w-5" />
              Create Project
            </Button>
          </div>
        </div>

        {/* Search and View Controls */}
        <div ref={searchRef} className="mb-8">
          <Card className="backdrop-blur-sm bg-white/60 border-white/20 shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/80 border-gray-200/60 focus:border-blue-300 focus:ring-blue-200"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg bg-gray-100 p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "h-8 px-3",
                        viewMode === 'grid' && "bg-white shadow-sm"
                      )}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "h-8 px-3",
                        viewMode === 'list' && "bg-white shadow-sm"
                      )}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Statistics */}
        <div ref={statsRef} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <FolderPlus className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Recently Active</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.recent}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <Sparkles className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">With Activity</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <Filter className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Projects Grid */}
        <div ref={projectsGridRef}>
          {isLoading && projects.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading projects...</p>
              </div>
            </div>
          ) : !isLoading && filteredProjects.length === 0 ? (
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200/60">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20 flex items-center justify-center mx-auto mb-6">
                  <FolderPlus className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No projects found' : 'No projects yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery 
                    ? `No projects match "${searchQuery}". Try adjusting your search.`
                    : 'Create your first project to start building your knowledge graph!'
                  }
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
                  >
                    <PlusSquare className="mr-2 h-4 w-4" />
                    Create Your First Project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={cn(
              "grid gap-6",
              viewMode === 'grid' 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1"
            )}>
              {filteredProjects.map((project, index) => (
                <EnhancedProjectCard 
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  description={project.description || ""}
                  lastUpdated={new Date(project.lastAccessed || project.createdAt).toLocaleDateString()}
                  entityCount={Math.floor(Math.random() * 50) + 10}
                  relationshipCount={Math.floor(Math.random() * 100) + 20}
                  activityScore={Math.floor(Math.random() * 100) + 20}
                  status={index === 0 ? 'new' : 'active'}
                  delay={index * 0.1}
                  onDelete={() => handleDeleteProject(project.id)}
                  variant={viewMode}
                />
              ))}
            </div>
          )}

          {/* Show count when filtered */}
          {searchQuery && filteredProjects.length > 0 && (
            <div className="mt-6 text-center">
              <Badge variant="secondary" className="bg-white/60 backdrop-blur-sm">
                Showing {filteredProjects.length} of {projects.length} projects
              </Badge>
            </div>
          )}
        </div>
        
        <CreateProjectModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateProject}
        />
      </div>
    </div>
  );
}