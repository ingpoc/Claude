import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Box, File, Folder, Database, Settings, Layout, Code, FileCode, Globe, FileJson } from 'lucide-react';
import { Entity } from '../lib/services';
import { cn } from '../lib/utils';

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
  // Move hooks to the top level
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'DOMAIN': true // Default to expanding DOMAIN
  });

  // Safely handle empty or undefined entities using useMemo
  const safeEntities = useMemo(() => entities || [], [entities]);

  // Handle keyboard navigation (moved before early return)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedEntityId) return;
      
      // Find the current entity
      const allEntitiesList = safeEntities.flatMap(entity => entity); // Use memoized safeEntities
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
  }, [safeEntities, selectedEntityId, onSelectEntity]); // Use memoized safeEntities in dependency array

  // Display a message if there are no entities (early return check is now after hooks)
  if (safeEntities.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-muted-foreground text-sm">
          No entities available.
          <br />
          <span className="text-xs mt-1 block">
            Click &quot;Add Entity&quot; below to create your first entity.
          </span>
        </div>
      </div>
    );
  }
  
  // Group entities by type
  const groupedEntities: GroupedEntities = safeEntities.reduce((acc, entity) => {
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

  // Track expanded groups (Hook call already moved to top)
  // const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ ... }); // Original position
  
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Get icon based on entity type
  const getEntityIcon = (type: string, selected: boolean = false) => {
    const base = selected ? "text-white" : "";
    switch(type.toLowerCase()) {
      case 'component':
        return <Box size={20} className={cn("text-blue-400", base)} />;
      case 'page':
        return <Layout size={20} className={cn("text-orange-400", base)} />;
      case 'domain':
        return <Folder size={20} className={cn("text-purple-400", base)} />;
      case 'utility':
        return <Settings size={20} className={cn("text-green-400", base)} />;
      case 'config':
        return <FileJson size={20} className={cn("text-cyan-400", base)} />;
      case 'class':
        return <Code size={20} className={cn("text-pink-400", base)} />;
      case 'function':
        return <FileCode size={20} className={cn("text-yellow-400", base)} />;
      case 'api':
        return <Globe size={20} className={cn("text-red-400", base)} />;
      default:
        return <Database size={20} className={cn("text-muted-foreground", base)} />;
    }
  };
  
  // Handle keyboard navigation (Hook call already moved to top)
  // useEffect(() => { ... }); // Original position

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
    <div className="p-2 space-y-1">
      {/* Show domain entities first if they exist */}
      {domainEntities && domainEntities.length > 0 && (
        <div className="space-y-1">
          {domainEntities.map(domain => (
            <div key={domain.id}>
              <div 
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer text-sm transition-all duration-150",
                  selectedEntityId === domain.id 
                    ? "bg-primary text-white shadow-md"
                    : "hover:bg-primary/5 text-foreground"
                )}
              >
                <div 
                  className="flex items-center flex-1"
                  onClick={() => toggleGroup(domain.id)}
                >
                  {expandedGroups[domain.id] ? (
                    <ChevronDown size={18} className={cn("mr-2", selectedEntityId === domain.id ? "text-white" : "text-muted-foreground")} />
                  ) : (
                    <ChevronRight size={18} className={cn("mr-2", selectedEntityId === domain.id ? "text-white" : "text-muted-foreground")} />
                  )}
                  {getEntityIcon('domain', selectedEntityId === domain.id)}
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
              </div>
              
              {expandedGroups[domain.id] && (
                <div className="ml-6 pl-2 border-l border-border space-y-px">
                  {safeEntities
                    .filter(entity => entity.parentId === domain.id)
                    .map(childEntity => (
                      <div 
                        key={childEntity.id}
                        className={cn(
                          "flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer text-sm transition-all duration-150",
                          selectedEntityId === childEntity.id 
                            ? "bg-primary text-white shadow-md"
                            : "hover:bg-primary/5 text-foreground"
                        )}
                        onClick={() => onSelectEntity(childEntity.id)}
                      >
                        {getEntityIcon(childEntity.type, selectedEntityId === childEntity.id)}
                        <span className="ml-2">{childEntity.name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Separator before other groups if domains exist */}
      {domainEntities && domainEntities.length > 0 && Object.keys(groupedEntities).filter(g => g !== 'DOMAIN').length > 0 && (
        <div className="pt-2">
          <hr className="border-border" />
        </div>
      )}

      {/* Other entity groups */}
      {Object.entries(groupedEntities).map(([groupName, groupEntities]) => {
        if (groupName === 'DOMAIN') return null;
        const sortedEntities = [...groupEntities].sort((a, b) => a.name.localeCompare(b.name));
        
        return (
          <div key={groupName}>
            <div 
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-primary/5 cursor-pointer text-sm text-foreground transition-all duration-150"
              onClick={() => toggleGroup(groupName)}
            >
              {expandedGroups[groupName] ? (
                <ChevronDown size={18} className="mr-2 text-muted-foreground" />
              ) : (
                <ChevronRight size={18} className="mr-2 text-muted-foreground" />
              )}
              {getEntityIcon(groupName.toLowerCase())}
              <span className="ml-2 capitalize font-medium">{groupName.toLowerCase()}s</span>
              <span className="ml-auto text-muted-foreground text-xs pr-1">{groupEntities.length}</span>
            </div>
            
            {expandedGroups[groupName] && (
              <div className="ml-6 pl-2 border-l border-border space-y-px">
                {sortedEntities.map(entity => (
                  <div 
                    key={entity.id}
                    className={cn(
                      "flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer text-sm transition-all duration-150",
                      selectedEntityId === entity.id 
                        ? "bg-primary text-white shadow-md"
                        : "hover:bg-primary/5 text-foreground"
                    )}
                    onClick={() => onSelectEntity(entity.id)}
                  >
                    {getEntityIcon(entity.type, selectedEntityId === entity.id)}
                    <span className="ml-2">{entity.name}</span>
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