"use client";

import React, { useState, useMemo } from 'react';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  Search, 
  Filter, 
  Download,
  Maximize2,
  Network
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  observations: any[];
}

interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
}

interface GraphData {
  nodes: Entity[];
  links: Relationship[];
}

export interface GraphVisualizationProps {
  projectId: string;
  data?: GraphData;
  isLoading?: boolean;
  onNodeClick?: (node: Entity) => void;
  onEdgeClick?: (edge: Relationship) => void;
  className?: string;
  height?: string;
}

function EntityCard({ 
  entity, 
  connections, 
  onClick 
}: { 
  entity: Entity; 
  connections: number; 
  onClick?: () => void;
}) {
  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      'function': 'border-blue-300 bg-blue-50 hover:bg-blue-100',
      'class': 'border-green-300 bg-green-50 hover:bg-green-100',
      'variable': 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100',
      'module': 'border-purple-300 bg-purple-50 hover:bg-purple-100',
      'file': 'border-gray-300 bg-gray-50 hover:bg-gray-100',
      'concept': 'border-orange-300 bg-orange-50 hover:bg-orange-100',
    };
    return colors[type.toLowerCase()] || 'border-gray-300 bg-gray-50 hover:bg-gray-100';
  };

  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all duration-200 border-2",
        getNodeColor(entity.type),
        onClick && "hover:shadow-md hover:scale-105"
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-sm truncate" title={entity.name}>
            {entity.name}
          </h3>
          <Badge variant="secondary" className="text-xs ml-2">
            {entity.type}
          </Badge>
        </div>
        
        {entity.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {entity.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {entity.observations.length} note{entity.observations.length !== 1 ? 's' : ''}
          </span>
          <span>
            {connections} connection{connections !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </Card>
  );
}

function RelationshipItem({ 
  relationship, 
  fromEntity, 
  toEntity, 
  onClick 
}: { 
  relationship: Relationship;
  fromEntity?: Entity;
  toEntity?: Entity;
  onClick?: () => void;
}) {
  return (
    <div 
      className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="space-y-1">
        <div className="text-sm font-medium">
          {fromEntity?.name} → {toEntity?.name}
        </div>
        <div className="text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {relationship.type}
          </Badge>
          {relationship.description && (
            <span className="ml-2">{relationship.description}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GraphVisualization({
  projectId,
  data,
  isLoading = false,
  onNodeClick,
  onEdgeClick,
  className,
  height = "600px"
}: GraphVisualizationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Get unique entity types for filtering
  const entityTypes = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.nodes.map(node => node.type))).sort();
  }, [data]);

  // Calculate connections for each entity
  const entityConnections = useMemo(() => {
    if (!data) return new Map();
    
    const connections = new Map<string, number>();
    data.nodes.forEach(node => connections.set(node.id, 0));
    
    data.links.forEach(link => {
      connections.set(link.from, (connections.get(link.from) || 0) + 1);
      connections.set(link.to, (connections.get(link.to) || 0) + 1);
    });
    
    return connections;
  }, [data]);

  // Filter entities based on search and type filters
  const filteredEntities = useMemo(() => {
    if (!data) return [];
    
    return data.nodes.filter(entity => {
      const matchesSearch = !searchTerm || 
        entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = selectedTypes.size === 0 || 
        selectedTypes.has(entity.type);
      
      return matchesSearch && matchesType;
    });
  }, [data, searchTerm, selectedTypes]);

  // Filter relationships to only show connections between visible entities
  const filteredRelationships = useMemo(() => {
    if (!data) return [];
    
    const visibleEntityIds = new Set(filteredEntities.map(entity => entity.id));
    return data.links.filter(link => 
      visibleEntityIds.has(link.from) && visibleEntityIds.has(link.to)
    );
  }, [data, filteredEntities]);

  const handleTypeFilter = (type: string) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTypes(new Set());
  };

  const downloadGraph = () => {
    if (!data) return;
    
    const graphData = {
      entities: filteredEntities,
      relationships: filteredRelationships,
      projectId,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-graph-${projectId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className={cn("flex items-center justify-center", className)} style={{ height }}>
        <LoadingSpinner size="lg" text="Loading graph data..." />
      </Card>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className={cn("flex items-center justify-center flex-col gap-4", className)} style={{ height }}>
        <div className="text-center">
          <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <div className="text-lg font-medium">No entities found</div>
          <div className="text-sm text-muted-foreground">
            Create some entities to see the knowledge graph
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)} style={{ minHeight: height }}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          
          {entityTypes.length > 0 && (
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {entityTypes.map(type => (
                <Badge
                  key={type}
                  variant={selectedTypes.has(type) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => handleTypeFilter(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          )}
          
          {(searchTerm || selectedTypes.size > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? 'List' : 'Grid'}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadGraph}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredEntities.length} entities</span>
        <span>{filteredRelationships.length} relationships</span>
        {(searchTerm || selectedTypes.size > 0) && (
          <span className="text-primary">
            Filtered from {data.nodes.length} total entities
          </span>
        )}
      </div>

      {/* Entities Grid/List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Entities</h3>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEntities.map(entity => (
              <EntityCard
                key={entity.id}
                entity={entity}
                connections={entityConnections.get(entity.id) || 0}
                onClick={() => onNodeClick?.(entity)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntities.map(entity => (
              <div key={entity.id} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                <Badge variant="secondary">{entity.type}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{entity.name}</div>
                  {entity.description && (
                    <div className="text-sm text-muted-foreground">{entity.description}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {entityConnections.get(entity.id) || 0} connections
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationships */}
      {filteredRelationships.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Relationships</h3>
          <div className="space-y-2">
            {filteredRelationships.map(relationship => {
              const fromEntity = data.nodes.find(n => n.id === relationship.from);
              const toEntity = data.nodes.find(n => n.id === relationship.to);
              
              return (
                <RelationshipItem
                  key={relationship.id}
                  relationship={relationship}
                  fromEntity={fromEntity}
                  toEntity={toEntity}
                  onClick={() => onEdgeClick?.(relationship)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 