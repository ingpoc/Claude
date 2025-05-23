"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { gsap } from 'gsap';
import Link from 'next/link';
import { 
  Users, 
  GitBranch, 
  Activity, 
  Calendar, 
  BarChart3, 
  Network,
  Eye,
  Settings,
  Plus,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ProjectProvider, useProject } from '../../../context/ProjectContext';
import { cn } from '../../../lib/utils';

function ProjectOverviewContent() {
  const { projectId, projectName, projectDescription, entities, isLoading } = useProject();
  
  const [recentActivities] = useState([
    { id: 1, action: 'Created entity', target: 'User Authentication', time: '2 hours ago', type: 'create' },
    { id: 2, action: 'Updated entity', target: 'Database Schema', time: '4 hours ago', type: 'update' },
    { id: 3, action: 'Added relationship', target: 'API → User Service', time: '1 day ago', type: 'relationship' },
    { id: 4, action: 'Created entity', target: 'Payment Gateway', time: '2 days ago', type: 'create' },
  ]);

  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enhanced entrance animations
  useEffect(() => {
    if (!isLoading && headerRef.current && statsRef.current && actionsRef.current && contentRef.current) {
      const tl = gsap.timeline();
      
      // Reset positions
      gsap.set([headerRef.current, statsRef.current, actionsRef.current, contentRef.current], { opacity: 0, y: 30 });
      
      tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" })
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
        .to(actionsRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.2")
        .to(contentRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.1");
    }
  }, [isLoading]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const totalEntities = entities.length;
    const entityTypes = new Set(entities.map(e => e.type)).size;
    const recentEntities = entities.filter(e => {
      const created = new Date(e.createdAt || Date.now());
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created > weekAgo;
    }).length;
    
    return {
      total: totalEntities,
      types: entityTypes,
      recent: recentEntities,
      relationships: Math.floor(totalEntities * 1.5) // Estimated relationships
    };
  }, [entities]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20 flex items-center justify-center mx-auto mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Project</h3>
          <p className="text-muted-foreground">Please wait while we load your project overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header */}
        <div ref={headerRef} className="mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                    {projectName}
                  </h1>
                  <p className="text-sm text-muted-foreground">Project Overview</p>
                </div>
              </div>
              {projectDescription && (
                <p className="text-muted-foreground max-w-2xl text-lg">
                  {projectDescription}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/60 border-gray-200/60 hover:bg-white/80"
                asChild
              >
                <Link href={`/projects/${projectId}/graph`}>
                  <Network className="h-4 w-4 mr-2" />
                  View Graph
                </Link>
              </Button>
              
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link href={`/projects/${projectId}/entities`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Explore Entities
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Statistics */}
        <div ref={statsRef} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Entities</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Knowledge nodes</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Entity Types</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.types}</p>
                    <p className="text-xs text-muted-foreground mt-1">Unique categories</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <Layers className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Relationships</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.relationships}</p>
                    <p className="text-xs text-muted-foreground mt-1">Connections</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <GitBranch className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/20 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Recent</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.recent}</p>
                    <p className="text-xs text-muted-foreground mt-1">This week</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div ref={actionsRef} className="mb-8">
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto p-4 bg-white/80 border-gray-200/60 hover:bg-white justify-start"
                asChild
              >
                <Link href={`/projects/${projectId}/entities`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Eye className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Explore Entities</p>
                      <p className="text-sm text-muted-foreground">Browse and manage knowledge nodes</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 bg-white/80 border-gray-200/60 hover:bg-white justify-start"
                asChild
              >
                <Link href={`/projects/${projectId}/graph`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Network className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">View Graph</p>
                      <p className="text-sm text-muted-foreground">Visualize relationships</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 bg-white/80 border-gray-200/60 hover:bg-white justify-start"
                onClick={() => {
                  // Add entity functionality would go here
                  window.location.href = `/projects/${projectId}/entities`;
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Plus className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Add Entity</p>
                    <p className="text-sm text-muted-foreground">Create new knowledge node</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-gray-50/50 to-white/50 border border-gray-200/30">
                      <div className={cn(
                        "p-2 rounded-full",
                        activity.type === 'create' && "bg-green-100",
                        activity.type === 'update' && "bg-blue-100", 
                        activity.type === 'relationship' && "bg-purple-100"
                      )}>
                        {activity.type === 'create' && <Plus className="h-4 w-4 text-green-600" />}
                        {activity.type === 'update' && <Settings className="h-4 w-4 text-blue-600" />}
                        {activity.type === 'relationship' && <GitBranch className="h-4 w-4 text-purple-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.target}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Info */}
          <div className="lg:col-span-1">
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                  <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Created</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date().toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Growth</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">+{stats.recent} this week</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-white/60 border-gray-200/60 hover:bg-white/80"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Project Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <ProjectProvider projectId={projectId}>
      <ProjectOverviewContent />
    </ProjectProvider>
  );
} 