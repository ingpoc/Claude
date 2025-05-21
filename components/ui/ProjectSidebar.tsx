import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FolderIcon, FileIcon, Code, GitBranch, Search, PlusSquare } from 'lucide-react';
import Link from 'next/link';
import type { Entity } from '../../lib/knowledgeGraph';
import EntityTree from '../../components/EntityTree';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

interface ProjectSidebarProps {
  projectName: string;
  projectId: string;
  description: string;
  entities?: Entity[];
  selectedEntityId?: string;
  onSelectEntity?: (id: string) => void;
  activeView?: 'entities' | 'graph';
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddEntityClick?: () => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projectName,
  projectId,
  description,
  entities = [],
  selectedEntityId,
  onSelectEntity,
  activeView = 'entities',
  searchQuery = '',
  onSearchChange,
  onAddEntityClick
}) => {
  const [expandedEntityTypes, setExpandedEntityTypes] = useState(true);
  const toggleEntityTypes = () => setExpandedEntityTypes(!expandedEntityTypes);

  // Calculate entity types and counts dynamically
  const entityTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entities.forEach(entity => {
      const type = entity.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).sort(([typeA], [typeB]) => typeA.localeCompare(typeB)); // Sort alphabetically
  }, [entities]);

  // Function to get a color (can reuse logic from details panel or simplify)
  const getTypeColor = (type: string): string => {
    // Simplified example - map common types to colors
    const colors: Record<string, string> = {
      'class': 'bg-pink-500',
      'function': 'bg-green-500',
      'component': 'bg-blue-500',
      'page': 'bg-orange-500',
      'domain': 'bg-purple-500',
      'api': 'bg-red-500',
      'utility': 'bg-teal-500',
      'config': 'bg-cyan-500',
    }
    return colors[type.toLowerCase()] || 'bg-muted-foreground'; // Use muted for others
  };

  return (
    <div className="w-64 bg-card border-r h-full flex flex-col overflow-hidden">
      {/* Project Info */}
      <div className="p-5 border-b-2 border-slate-200">
        <div className="flex items-center mb-2">
          <Badge variant="outline" className="border-green-600 bg-green-500/10 text-green-700 text-xs px-1.5 py-0.5">
             <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5"></span>
             Active
          </Badge>
        </div>
        
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{projectName}</h2>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        
        <div className="flex items-center mt-3 text-xs text-muted-foreground">
          <GitBranch size={12} className="mr-1" />
          <span>Last Updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
      
      {/* Search input - using shadcn Input */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search entities..."
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>
      
      {/* Add Entity Button - using shadcn Button */}
      <div className="px-3 py-2 border-b">
        <Button 
          onClick={onAddEntityClick}
          className="w-full text-sm h-9"
          variant="default"
        >
          <PlusSquare size={16} className="mr-2" />
          Add Entity
        </Button>
      </div>
      
      {/* Entity list section or Entity Types section */}
      <div className="flex-1 overflow-y-auto">
        {activeView === 'entities' && entities && entities.length > 0 && (
          <>
            <div className="p-3 bg-muted/50 border-b flex items-centersticky top-0 z-10">
              <h3 className="text-sm font-medium text-foreground">Knowledge Entities</h3>
            </div>
            <EntityTree 
              entities={entities}
              onSelectEntity={onSelectEntity || (() => {})}
              selectedEntityId={selectedEntityId}
            />
          </>
        )}
        
        {activeView === 'graph' && (
          <>
            <div 
              className="p-3 bg-muted/50 border-b flex items-center justify-between cursor-pointer sticky top-0 z-10"
              onClick={toggleEntityTypes}
            >
              <h3 className="text-sm font-medium text-foreground">Entity Types</h3>
              <button className="text-muted-foreground hover:text-foreground">
                {expandedEntityTypes ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            
            {expandedEntityTypes && (
              <div className="p-2 space-y-1">
                {/* Render dynamic types and counts */}
                {entityTypeCounts.length > 0 ? (
                  entityTypeCounts.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm text-foreground">
                      <div className="flex items-center">
                        <span className={cn("w-2.5 h-2.5 rounded-full mr-2", getTypeColor(type))}></span>
                        <span className="capitalize">{type}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                  ))
                ) : (
                  <p className="p-2 text-xs text-muted-foreground italic">No entity types found.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Bottom View Switcher */}
      <div className="border-t p-3 flex justify-between items-center">
         <div className="flex space-x-1">
           <Button 
             variant={activeView === 'entities' ? 'secondary' : 'ghost'} 
             size="sm" 
             className="text-xs h-7 px-2" 
             asChild
            >
             <Link href={`/projects/${projectId}/entities`}>Entities</Link>
           </Button>
           <Button 
             variant={activeView === 'graph' ? 'secondary' : 'ghost'} 
             size="sm" 
             className="text-xs h-7 px-2" 
             asChild
            >
             <Link href={`/projects/${projectId}/graph`}>Graph</Link>
           </Button>
         </div>
      </div>
    </div>
  );
};