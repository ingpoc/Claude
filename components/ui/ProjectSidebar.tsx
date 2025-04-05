import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FolderIcon, FileIcon, Code, GitBranch, Search, PlusSquare } from 'lucide-react';
import Link from 'next/link';
import type { Entity } from '../../lib/knowledgeGraph';
import EntityTree from '../../components/EntityTree';

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

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Project Info */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
          <span className="text-xs text-green-500">Active</span>
        </div>
        
        <h2 className="text-lg font-semibold">{projectName}</h2>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
        
        <div className="flex items-center mt-3 text-xs text-gray-500">
          <GitBranch size={12} className="mr-1" />
          <span>Last Updated: 3/31/2025</span>
        </div>
      </div>
      
      {/* Search in sidebar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search entities..."
            className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-full text-sm"
          />
        </div>
      </div>
      
      {/* Add Entity Button */}
      <div className="px-3 py-2 border-b border-gray-800">
        <button 
          onClick={onAddEntityClick}
          className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
        >
          <PlusSquare size={16} className="mr-2" />
          Add Entity
        </button>
      </div>
      
      {/* Entity list section - only show for entities view */}
      {activeView === 'entities' && entities && entities.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="p-3 bg-gray-800/40 border-y border-gray-800 flex items-center">
            <h3 className="text-sm font-medium">Knowledge Entities</h3>
          </div>
          <EntityTree 
            entities={entities}
            onSelectEntity={onSelectEntity || (() => {})}
            selectedEntityId={selectedEntityId}
          />
        </div>
      )}
      
      {/* Entity Types section */}
      {activeView === 'graph' && (
        <div className="flex-1 overflow-auto">
          <div className="p-3 bg-gray-800/40 border-y border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-medium">Entity Types</h3>
            <button onClick={toggleEntityTypes} className="text-gray-500 hover:text-gray-300">
              {expandedEntityTypes ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          
          {expandedEntityTypes && (
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
                  <span>Class</span>
                </div>
                <span className="text-xs text-gray-500">(5)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                  <span>Function</span>
                </div>
                <span className="text-xs text-gray-500">(2)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-400 mr-2"></div>
                  <span>Utility</span>
                </div>
                <span className="text-xs text-gray-500">(1)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                  <span>Component</span>
                </div>
                <span className="text-xs text-gray-500">(3)</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-auto border-t border-gray-800 p-3 flex justify-between">
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-400">
          Settings
        </Link>
        <div className="flex space-x-2">
          <Link href={`/projects/${projectId}/entities`} className={`text-xs px-2 py-1 rounded ${activeView === 'entities' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-gray-400'}`}>
            Entities
          </Link>
          <Link href={`/projects/${projectId}/graph`} className={`text-xs px-2 py-1 rounded ${activeView === 'graph' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-gray-400'}`}>
            Graph
          </Link>
        </div>
      </div>
    </div>
  );
};