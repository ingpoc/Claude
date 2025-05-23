"use client";

 import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { gsap } from 'gsap';
import { 
  PlusSquare, 
  Search, 
  LayoutGrid, 
  List, 
  Folder, 
  FolderSearch, 
  Command,
  Filter,
  SortAsc,
  Eye,
  Zap,
  Users,
  GitBranch
} from 'lucide-react';
import Link from 'next/link';
import { ProjectSidebar } from '../../../../components/ui/ProjectSidebar';
import EntityDetailsPanel from '../../../../components/EntityDetailsPanel';
import AddEntityModal from '../../../../components/AddEntityModal';
import TransitionWrapper from '../../../../components/TransitionWrapper';
import { ProjectProvider, useProject } from '../../../../context/ProjectContext';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

function EntitiesPageContent() {
  const {
    projectId,
    projectName,
    projectDescription,
    entities,
    addEntity,
    getRelatedEntities,
    findEntityById,
    isLoading
  } = useProject();

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [relatedEntities, setRelatedEntities] = useState<Array<{entity: any, relationship: any}>>([]);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  // Refs for animations
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enhanced entrance animations
  useEffect(() => {
    if (!isLoading && headerRef.current && statsRef.current && contentRef.current) {
      const tl = gsap.timeline();
      
      // Reset positions
      gsap.set([headerRef.current, statsRef.current, contentRef.current], { opacity: 0, y: 30 });
      
      tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" })
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
        .to(contentRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.2");
    }
  }, [isLoading]);

  useEffect(() => {
    if (selectedEntityId) {
      setIsDetailLoading(true);
      let isActive = true;
      Promise.all([
          findEntityById(selectedEntityId),
          getRelatedEntities(selectedEntityId)
      ]).then(([entityData, relatedData]) => {
          if (isActive) {
              setSelectedEntity(entityData);
              setRelatedEntities(relatedData); 
          }
      }).catch(error => {
          console.error("Error fetching entity details:", error);
          if (isActive) {
             setSelectedEntity(null);
             setRelatedEntities([]);
          }
      }).finally(() => {
          if (isActive) {
              setIsDetailLoading(false);
          }
      });
      
      return () => { isActive = false; };
    } else {
      setSelectedEntity(null);
      setRelatedEntities([]);
    }
  }, [selectedEntityId, findEntityById, getRelatedEntities, entities]);

  const filteredEntities = useMemo(() => 
    searchQuery ? 
      entities.filter(entity => 
        entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(entity.observations) && entity.observations.some(obs => {
          const obsString = typeof obs === 'string' ? obs : 
                            (obs && typeof obs === 'object' && 'text' in obs && typeof obs.text === 'string') ? 
                            obs.text : '';
          return obsString.toLowerCase().includes(searchQuery.toLowerCase());
        }))
      )
      : entities,
    [entities, searchQuery]
  );

  // Calculate enhanced stats
  const stats = useMemo(() => {
    const totalEntities = entities.length;
    const entityTypes = new Set(entities.map(e => e.type)).size;
    // Since relationshipCount may not be directly available, we'll use relatedEntities count
    const totalRelationships = relatedEntities.length;
    
    return {
      total: totalEntities,
      types: entityTypes,
      relationships: totalRelationships,
      filtered: filteredEntities.length
    };
  }, [entities, filteredEntities, relatedEntities]);

  const handleEntitySelect = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
  }, []);
  
  const handleCloseDetails = useCallback(() => {
    setSelectedEntityId(null);
  }, []);
  
  const handleAddEntity = useCallback(async (name: string, type: string, description: string) => {
    const newEntity = await addEntity(name, type, description, []);
    setIsAddEntityModalOpen(false);
  }, [addEntity]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20 flex items-center justify-center mx-auto mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Project</h3>
          <p className="text-muted-foreground">Please wait while we load your knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* Enhanced Header */}
      <div ref={headerRef} className="border-b border-white/20 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/20">
                  <Eye className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 bg-clip-text text-transparent">
                    {projectName}
                  </h1>
                  <p className="text-sm text-muted-foreground">Entity Explorer</p>
                </div>
              </div>
              {projectDescription && (
                <p className="text-muted-foreground max-w-2xl">
                  {projectDescription}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg bg-gray-100 p-1">
                <Button
                  variant={viewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('tree')}
                  className={cn(
                    "h-8 px-3",
                    viewMode === 'tree' && "bg-white shadow-sm"
                  )}
                >
                  <Folder className="h-4 w-4 mr-1" />
                  Tree
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "h-8 px-3",
                    viewMode === 'grid' && "bg-white shadow-sm"
                  )}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Grid
                </Button>
              </div>
              
              <Button 
                onClick={() => setIsAddEntityModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <PlusSquare className="mr-2 h-4 w-4" />
                Add Entity
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Statistics */}
      <div ref={statsRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/20 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Entities</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-2 rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/20 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Entity Types</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.types}</p>
                </div>
                <div className="p-2 rounded-full bg-purple-100">
                  <Filter className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/20 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Relationships</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.relationships}</p>
                </div>
                <div className="p-2 rounded-full bg-green-100">
                  <GitBranch className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/20 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Filtered</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.filtered}</p>
                </div>
                <div className="p-2 rounded-full bg-orange-100">
                  <Search className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div ref={contentRef} className="flex flex-1 overflow-hidden">
        <ProjectSidebar 
          projectName={projectName} 
          projectId={projectId}
          description={projectDescription}
          entities={filteredEntities}
          selectedEntityId={selectedEntityId || undefined}
          onSelectEntity={handleEntitySelect}
          activeView="entities"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddEntityClick={() => setIsAddEntityModalOpen(true)}
        />
        
        <div className="flex-1 overflow-auto flex flex-col bg-white/40 backdrop-blur-sm">
          <div className="h-full w-full">
            <div className="overflow-hidden flex h-full">
              <TransitionWrapper
                isVisible={!!selectedEntity || !selectedEntityId}
                direction="right"
                duration={400}
                className="flex-1"
              >
                {isDetailLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/20 flex items-center justify-center mx-auto mb-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                      </div>
                      <p>Loading entity details...</p>
                    </div>
                  </div>
                ) : selectedEntity ? (
                  <EntityDetailsPanel 
                    entity={selectedEntity}
                    allEntities={entities}
                    relationships={relatedEntities}
                    onClose={handleCloseDetails}
                    onSelectEntity={handleEntitySelect}
                    key={selectedEntity.id}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full flex-1 p-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/20 flex items-center justify-center mb-8 relative overflow-hidden">
                      <FolderSearch size={48} className="text-purple-600" />
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 animate-pulse" />
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 bg-clip-text text-transparent">
                      Explore Your Knowledge Graph
                    </h3>
                    
                    <p className="text-muted-foreground text-center max-w-lg mb-8 text-lg leading-relaxed">
                      Dive deep into your entities and discover the connections that form your knowledge network. Each entity tells a story, and every relationship reveals new insights.
                    </p>
                    
                    <Card className="bg-white/60 backdrop-blur-sm border-gray-200/60 shadow-lg max-w-2xl w-full">
                      <CardContent className="p-8">
                        <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center">
                          <Zap className="h-5 w-5 text-purple-600 mr-2" />
                          Quick Actions
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="flex items-start p-4 rounded-lg bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-200/20">
                              <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                <Folder size={16} className="text-purple-600" />
                              </div>
                              <div>
                                <p className="text-foreground text-sm font-medium">Browse Entities</p>
                                <p className="text-muted-foreground text-sm">Navigate through your organized knowledge tree</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start p-4 rounded-lg bg-gradient-to-r from-blue-500/5 to-green-500/5 border border-blue-200/20">
                              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                <Search size={16} className="text-blue-600" />
                              </div>
                              <div>
                                <p className="text-foreground text-sm font-medium">Search & Filter</p>
                                <p className="text-muted-foreground text-sm">Find specific entities using powerful search</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-start p-4 rounded-lg bg-gradient-to-r from-green-500/5 to-purple-500/5 border border-green-200/20">
                              <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                <GitBranch size={16} className="text-green-600" />
                              </div>
                              <div>
                                <p className="text-foreground text-sm font-medium">View Relationships</p>
                                <p className="text-muted-foreground text-sm">Discover connections between entities</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start p-4 rounded-lg bg-gradient-to-r from-orange-500/5 to-red-500/5 border border-orange-200/20">
                              <div className="w-8 h-8 rounded-md bg-orange-100 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                <Command size={16} className="text-orange-600" />
                              </div>
                              <div>
                                <p className="text-foreground text-sm font-medium">Keyboard Shortcuts</p>
                                <p className="text-muted-foreground text-sm">Navigate efficiently with hotkeys</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-gray-200/60 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/60 border-gray-200/60 hover:bg-white/80"
                            onClick={() => setIsAddEntityModalOpen(true)}
                          >
                            <PlusSquare size={16} className="mr-2" />
                            Add Your First Entity
                          </Button>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{entities.length} entities</span>
                            <span>•</span>
                            <span>{stats.types} types</span>
                            <span>•</span>
                            <span>{stats.relationships} connections</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TransitionWrapper>
            </div>
          </div>
        </div>
      </div>
      
      <AddEntityModal 
        isOpen={isAddEntityModalOpen}
        onClose={() => setIsAddEntityModalOpen(false)}
        onSubmit={handleAddEntity}
      />
    </div>
  );
}

export default function EntitiesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <ProjectProvider projectId={projectId}>
      <EntitiesPageContent />
    </ProjectProvider>
  );
}