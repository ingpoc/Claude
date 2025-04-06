import React, { useState, useEffect } from 'react';
import { X, Link2, ArrowRight, ChevronDown, ChevronUp, Info, Clock, Hash, FilePlus } from 'lucide-react';
// Import only types explicitly
import type { Entity, Relationship } from '../lib/knowledgeGraph'; 
// Import constants from the shared file
import { RelationshipTypes } from '../lib/constants';

interface EntityDetailsPanelProps {
  entity: Entity;
  allEntities: Entity[];
  relationships?: Array<{
    entity: Entity;
    relationship: Relationship;
  }>;
  onClose: () => void;
  onSelectEntity: (id: string) => void;
}

// Animation keyframes for relationships
const slideInKeyframes = `
  @keyframes customSlideIn {
    from { transform: translateX(10px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

// Map relationship types to human-readable descriptions
const relationshipLabels: Record<string, string> = {
  [RelationshipTypes.DEPENDS_ON]: 'Depends on',
  [RelationshipTypes.COMPOSED_OF]: 'Composed of',
  [RelationshipTypes.CALLS]: 'Calls',
  [RelationshipTypes.EXTENDS]: 'Extends',
  [RelationshipTypes.RELATED_TO]: 'Related to'
};

// Map entity types to color classes
const entityTypeColors: Record<string, string> = {
  'component': 'bg-blue-900/30 text-blue-400',
  'domain': 'bg-purple-900/30 text-purple-400',
  'utility': 'bg-green-900/30 text-green-400',
  'page': 'bg-orange-900/30 text-orange-400',
  'function': 'bg-yellow-900/30 text-yellow-400',
  'class': 'bg-pink-900/30 text-pink-400',
  'api': 'bg-red-900/30 text-red-400',
  'config': 'bg-cyan-900/30 text-cyan-400',
  'default': 'bg-gray-800 text-gray-400'
};

const EntityDetailsPanel: React.FC<EntityDetailsPanelProps> = ({ 
  entity, 
  allEntities,
  relationships = [], 
  onClose, 
  onSelectEntity
}) => {
  const [expandedSections, setExpandedSections] = useState({
    description: true,
    relationships: true,
    metadata: true
  });

  // Toggle a section's expanded state
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Add keyboard shortcut to close panel with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Get color class based on entity type
  const getEntityTypeColorClass = (type: string): string => {
    return entityTypeColors[type] || entityTypeColors.default;
  };

  // Get human-readable relationship label
  const getRelationshipLabel = (type: string): string => {
    return relationshipLabels[type] || type;
  };

  // Get the breadcrumb path based on parent IDs
  const buildBreadcrumbPath = (currentEntityId: string, currentPath: Entity[] = []): Entity[] => {
    const currentEntity = allEntities.find(e => e.id === currentEntityId);
    if (!currentEntity) return currentPath; // Entity not found

    // Add current entity to the beginning of the path
    const newPath = [currentEntity, ...currentPath];

    // If there's a parent, recurse
    if (currentEntity.parentId) {
      return buildBreadcrumbPath(currentEntity.parentId, newPath);
    }
    
    // No more parents, return the final path
    return newPath;
  };

  const renderBreadcrumbs = () => {
    const pathEntities = buildBreadcrumbPath(entity.id);
    
    // If only the current entity is in the path (no parents), don't render breadcrumbs
    if (pathEntities.length <= 1) return null;

    return (
      <div className="flex items-center text-xs text-gray-500 mt-1 mb-2">
        <span className="mr-2">Path:</span>
        {pathEntities.map((pathEntity, index) => (
          <React.Fragment key={pathEntity.id}>
            {index > 0 && <span className="mx-1 text-gray-600">/</span>}
            {index === pathEntities.length - 1 ? (
              // Current entity (last item) - not clickable
              <span className="text-gray-400">{pathEntity.name}</span>
            ) : (
              // Parent entity - clickable
              <span 
                className="text-blue-400/70 hover:text-blue-400 cursor-pointer"
                onClick={() => onSelectEntity(pathEntity.id)}
              >
                {pathEntity.name}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Add keyframe styles */}
      <style jsx>{slideInKeyframes}</style>
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-5 py-4 flex justify-between items-center">
        <div className="flex flex-col">
          <div className="flex items-center">
            <div className={`inline-block text-xs py-1 px-2 rounded-full mr-3 ${getEntityTypeColorClass(entity.type)}`}>
              {entity.type}
            </div>
            <h2 className="text-xl font-semibold text-white">{entity.name}</h2>
          </div>
          {renderBreadcrumbs()}
        </div>
        <div className="flex items-center">
          <div className="text-xs text-gray-500 mr-3">
            Press <kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 mx-1">Esc</kbd> to close
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors duration-200 text-gray-400 hover:text-white"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 overflow-auto space-y-6">
        {/* Description Section */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div 
            className="bg-gray-800/40 px-5 py-3 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('description')}
          >
            <h3 className="text-sm font-medium text-gray-300 uppercase flex items-center">
              <Info size={14} className="text-blue-400 mr-2" />
              Description
            </h3>
            <button className="text-gray-500 hover:text-gray-300">
              {expandedSections.description ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          {expandedSections.description && (
            <div 
              className="p-5" 
              style={{ 
                transition: 'opacity 300ms ease-in-out',
                borderLeft: '3px solid rgba(59, 130, 246, 0.5)'
              }}
            >
              <p className="text-gray-300 leading-relaxed">
                {entity.description || `This is the ${entity.name} ${entity.type}.`}
              </p>
              
              {/* Show observations as regular bullet points if they exist */}
              {entity.observations && entity.observations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-400">Additional Details:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {entity.observations.map((observation, index) => (
                      <li key={index} className="text-gray-300 text-sm">
                        {typeof observation === 'string' 
                          ? observation 
                          : (observation && typeof observation === 'object' && 'text' in observation)
                            ? observation.text
                            : 'Observation data'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Related Entities Section */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div 
            className="bg-gray-800/40 px-5 py-3 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('relationships')}
          >
            <h3 className="text-sm font-medium text-gray-300 uppercase flex items-center">
              <Link2 size={14} className="text-blue-400 mr-2" />
              Related Entities <span className="ml-2 text-xs text-gray-500">({relationships.length})</span>
            </h3>
            <button className="text-gray-500 hover:text-gray-300">
              {expandedSections.relationships ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          {expandedSections.relationships && (
            <div className="p-2">
              {relationships && relationships.length > 0 ? (
                <div className="grid gap-2">
                  {relationships.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-gray-800/30 p-3 px-4 rounded-md hover:bg-gray-800 transition-colors duration-200 cursor-pointer"
                      style={{ 
                        animation: 'customSlideIn 0.5s forwards',
                        animationDelay: `${80 * (index + 1)}ms`,
                        borderLeft: '2px solid rgba(59, 130, 246, 0.3)'
                      }}
                      onClick={() => onSelectEntity(item.entity.id)}
                    >
                      <div className="flex items-center min-w-0">
                        <span className="text-gray-200 truncate">{item.entity.name}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${getEntityTypeColorClass(item.entity.type)} flex-shrink-0`}>
                          {item.entity.type}
                        </span>
                      </div>
                      <div className="flex items-center flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-500 mr-2">{getRelationshipLabel(item.relationship.type)}</span>
                        <ArrowRight size={14} className="text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 italic bg-gray-800/20 rounded-md p-4 text-center">
                  No related entities found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Entity metadata Section */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div 
            className="bg-gray-800/40 px-5 py-3 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('metadata')}
          >
            <h3 className="text-sm font-medium text-gray-300 uppercase flex items-center">
              <Hash size={14} className="text-blue-400 mr-2" />
              Entity Metadata
            </h3>
            <button className="text-gray-500 hover:text-gray-300">
              {expandedSections.metadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          {expandedSections.metadata && (
            <div className="p-4">
              <div className="bg-gray-800/40 rounded-md p-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-gray-500 mb-1">ID</span>
                  <span className="text-gray-400 font-mono text-sm">{entity.id}</span>
                </div>
                {entity.parentId && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Parent ID</span>
                    <span className="text-gray-400 font-mono text-sm">{entity.parentId}</span>
                  </div>
                )}
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Creation Date</span>
                  <div className="flex items-center">
                    <Clock size={12} className="text-gray-500 mr-1" />
                    <span className="text-gray-400 text-sm">March 30, 2025</span>
                  </div>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Last Modified</span>
                  <div className="flex items-center">
                    <FilePlus size={12} className="text-gray-500 mr-1" />
                    <span className="text-gray-400 text-sm">Today</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityDetailsPanel; 