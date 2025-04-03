import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Box, File, Folder, Database, Settings, Layout, Code, FileCode, Globe, FileJson } from 'lucide-react';
import { Entity } from '@/lib/knowledgeGraph';
import { cn } from '@/lib/utils';

interface EntityTreeProps {
  entities: Entity[];
  onSelectEntity: (id: string) => void;
  selectedEntityId?: string;
}

interface GroupedEntities {
  [key: string]: Entity[];
}

const EntityTree: React.FC<EntityTreeProps> = ({ 
  entities, 
  onSelectEntity,
  selectedEntityId
}) => {
  // Group entities by type
  const groupedEntities: GroupedEntities = entities.reduce((acc, entity) => {
    const type = entity.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    
    // Only add if not already present (avoid duplicates)
    const isDuplicate = acc[type].some(e => e.id === entity.id);
    if (!isDuplicate) {
      acc[type].push(entity);
    }
    return acc;
  }, {} as GroupedEntities);

  // Track expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    // Default to having DOMAIN expanded since it's the top-level category
    'DOMAIN': true
  });
  
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Get icon based on entity type
  const getEntityIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'component':
        return <Box size={16} className="text-blue-400" />;
      case 'page':
        return <Layout size={16} className="text-orange-400" />;
      case 'domain':
        return <Folder size={16} className="text-purple-400" />;
      case 'utility':
        return <Settings size={16} className="text-green-400" />;
      case 'config':
        return <FileJson size={16} className="text-cyan-400" />;
      case 'class':
        return <Code size={16} className="text-pink-400" />;
      case 'function':
        return <FileCode size={16} className="text-yellow-400" />;
      case 'api':
        return <Globe size={16} className="text-red-400" />;
      default:
        return <Database size={16} className="text-gray-400" />;
    }
  };
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedEntityId) return;
      
      // Find the current entity
      const allEntitiesList = entities.flatMap(entity => entity);
      const currentEntityIndex = allEntitiesList.findIndex(entity => entity.id === selectedEntityId);
      
      if (currentEntityIndex === -1) return;
      
      // Handle arrow key navigation
      switch (e.key) {
        case 'ArrowDown':
          if (currentEntityIndex < allEntitiesList.length - 1) {
            e.preventDefault();
            onSelectEntity(allEntitiesList[currentEntityIndex + 1].id);
          }
          break;
        case 'ArrowUp':
          if (currentEntityIndex > 0) {
            e.preventDefault();
            onSelectEntity(allEntitiesList[currentEntityIndex - 1].id);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [entities, selectedEntityId, onSelectEntity]);

  // Count entities by type with domain grouping
  const getDomainEntityCounts = () => {
    const domainEntities = groupedEntities['DOMAIN'] || [];
    const counts: Record<string, number> = {};
    
    // Count all non-domain entities
    Object.entries(groupedEntities).forEach(([type, entities]) => {
      if (type !== 'DOMAIN') {
        counts[type] = entities.length;
      }
    });
    
    return { domainEntities, counts };
  };
  
  const { domainEntities, counts } = getDomainEntityCounts();

  return (
    <div className="p-2">
      {/* Show domain entities first if they exist */}
      {domainEntities && domainEntities.length > 0 && (
        <div className="mb-4">
          {domainEntities.map(domain => (
            <div key={domain.id} className="mb-2">
              <div 
                className={cn(
                  "flex items-center p-2 rounded cursor-pointer",
                  selectedEntityId === domain.id 
                    ? "bg-blue-600/20 text-blue-400"
                    : "hover:bg-gray-800 text-gray-300"
                )}
              >
                <div 
                  className="flex items-center flex-1"
                  onClick={() => toggleGroup(domain.id)}
                >
                  {expandedGroups[domain.id] ? (
                    <ChevronDown size={16} className="text-gray-500 mr-2" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-500 mr-2" />
                  )}
                  {getEntityIcon('domain')}
                  <span 
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEntity(domain.id);
                    }}
                  >
                    {domain.name}
                  </span>
                </div>
                
                {/* Show a dot indicator if selected */}
                {selectedEntityId === domain.id && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 mr-1"></div>
                )}
              </div>
              
              {/* If domain is expanded, show child entities under it */}
              {expandedGroups[domain.id] && (
                <div className="ml-6 pl-2 border-l border-gray-800">
                  {/* Find entities that have this domain as their parent */}
                  {entities
                    .filter(entity => entity.parentId === domain.id)
                    .map(childEntity => (
                      <div 
                        key={childEntity.id}
                        className={cn(
                          "flex items-center p-2 rounded cursor-pointer",
                          selectedEntityId === childEntity.id 
                            ? "bg-blue-600/20 text-blue-400"
                            : "hover:bg-gray-800 text-gray-300"
                        )}
                        onClick={() => onSelectEntity(childEntity.id)}
                      >
                        {getEntityIcon(childEntity.type)}
                        <span className="ml-2">{childEntity.name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Other entity groups */}
      {Object.entries(groupedEntities).map(([groupName, groupEntities]) => {
        // Skip DOMAIN as we've already handled it specially
        if (groupName === 'DOMAIN') return null;
        
        // Sort entities alphabetically within each group
        const sortedEntities = [...groupEntities].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        return (
          <div key={groupName} className="mb-2">
            <div 
              className="flex items-center p-2 rounded hover:bg-gray-800 cursor-pointer"
              onClick={() => toggleGroup(groupName)}
            >
              {expandedGroups[groupName] ? (
                <ChevronDown size={16} className="text-gray-500 mr-2" />
              ) : (
                <ChevronRight size={16} className="text-gray-500 mr-2" />
              )}
              {getEntityIcon(groupName.toLowerCase())}
              <span className="ml-2 text-gray-300 capitalize">{groupName.toLowerCase()}s</span>
              <span className="ml-2 text-gray-500 text-xs">{groupEntities.length}</span>
            </div>
            
            {expandedGroups[groupName] && (
              <div className="ml-6 pl-2 border-l border-gray-800">
                {sortedEntities.map(entity => (
                  <div 
                    key={entity.id}
                    className={cn(
                      "flex items-center p-2 rounded cursor-pointer group",
                      selectedEntityId === entity.id 
                        ? "bg-blue-600/20 text-blue-400"
                        : "hover:bg-gray-800 text-gray-300"
                    )}
                    onClick={() => onSelectEntity(entity.id)}
                  >
                    {getEntityIcon(entity.type.toLowerCase())}
                    <span className="ml-2">{entity.name}</span>
                    
                    {/* Keyboard shortcut hint - only show on hover */}
                    <span className="ml-auto opacity-0 group-hover:opacity-100 text-gray-500 text-xs">
                      Click to view
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      
      {/* Keyboard navigation hint */}
      {selectedEntityId && (
        <div className="mt-4 px-3 py-2 bg-gray-800/40 rounded-md text-xs text-gray-500">
          <div className="flex items-center mb-1">
            <span className="font-medium mr-1">Tip:</span> Use keyboard to navigate
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded border border-gray-600 mr-1">↑</kbd>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded border border-gray-600">↓</kbd>
            </div>
            <span>Navigate entities</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityTree; 