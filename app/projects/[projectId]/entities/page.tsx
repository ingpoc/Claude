"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PlusSquare, Search, LayoutGrid, List, Folder, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { ProjectSidebar } from '@/components/ui/ProjectSidebar';
import EntityDetailsPanel from '@/components/EntityDetailsPanel';
import AddEntityModal from '@/components/AddEntityModal';
import TransitionWrapper from '@/components/TransitionWrapper';
import { ProjectProvider, useProject } from '@/context/ProjectContext';

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
  
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [relatedEntities, setRelatedEntities] = useState<Array<{entity: any, relationship: any}>>([]);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

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
  }, [selectedEntityId, findEntityById, getRelatedEntities]);

  const filteredEntities = useMemo(() => 
    searchQuery ? 
      entities.filter(entity => 
        entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(entity.observations) && entity.observations.some(obs => {
          if (typeof obs === 'string') {
            return obs.toLowerCase().includes(searchQuery.toLowerCase());
          } else if (obs && typeof obs === 'object' && typeof obs.text === 'string') {
            return obs.text.toLowerCase().includes(searchQuery.toLowerCase());
          }
          return false;
        }))
      )
      : entities,
    [entities, searchQuery]
  );

  const handleEntitySelect = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
  }, []);
  
  const handleCloseDetails = useCallback(() => {
    setSelectedEntityId(null);
  }, []);
  
  const handleAddEntity = useCallback(async (name: string, type: string, description: string) => {
    console.log(`Adding entity: ${name} (${type})`);
    const newEntity = await addEntity(name, type, description, []);
    console.log('Entity creation result:', newEntity);
    console.log(`Current entities count: ${entities.length}`);
    setIsAddEntityModalOpen(false);
  }, [addEntity, entities.length]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading project data...</div>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation currentPath={`/projects/${projectId}/entities`} />
      
      <div className="flex flex-1 overflow-hidden">
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
        
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="h-full w-full">
            <div className="bg-gray-900 border border-gray-800 shadow-lg overflow-hidden flex h-full">
              <TransitionWrapper
                isVisible={!!selectedEntity || !selectedEntityId}
                direction="right"
                duration={400}
                className="flex-1"
              >
                {isDetailLoading ? (
                  <div className="flex items-center justify-center h-full">Loading details...</div>
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
                    <div className="w-20 h-20 rounded-full bg-gray-800/70 flex items-center justify-center mb-6 relative overflow-hidden">
                      <div className="w-10 h-10 border-2 border-dashed border-gray-600 rounded-full"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
                    </div>
                    
                    <h3 className="text-xl font-medium mb-3 text-gray-300">Select an Entity to View Details</h3>
                    
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      Explore the knowledge graph by selecting an entity from the sidebar. You can view relationships, properties, and metadata for each entity.
                    </p>
                    
                    <div className="bg-gray-800/50 rounded-lg p-5 max-w-md w-full">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Quick Tips:</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="w-6 h-6 rounded-full bg-purple-900/30 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                            <Folder size={14} className="text-purple-400" />
                          </div>
                          <div>
                            <p className="text-gray-300 text-sm font-medium">Explore Domains</p>
                            <p className="text-gray-500 text-sm">Start by expanding a domain to see its child entities</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-900/30 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                            <Search size={14} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="text-gray-300 text-sm font-medium">Use Search</p>
                            <p className="text-gray-500 text-sm">Filter entities by typing in the search box</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-6 h-6 rounded-full bg-green-900/30 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                            <ArrowUp size={14} className="text-green-400" />
                            <ArrowDown size={14} className="text-green-400" />
                          </div>
                          <div>
                            <p className="text-gray-300 text-sm font-medium">Keyboard Navigation</p>
                            <p className="text-gray-500 text-sm">Use arrow keys to move between entities</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-5 pt-4 border-t border-gray-700 flex justify-between items-center">
                        <button
                          onClick={() => setIsAddEntityModalOpen(true)}
                          className="text-blue-400 text-sm flex items-center hover:text-blue-300"
                        >
                          <PlusSquare size={14} className="mr-1" />
                          Add New Entity
                        </button>
                        
                        <span className="text-xs text-gray-500">
                          {entities.length} total {entities.length === 1 ? 'entity' : 'entities'}
                        </span>
                      </div>
                    </div>
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
    </main>
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