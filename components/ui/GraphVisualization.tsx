"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { LoadingSpinner } from './LoadingSpinner';
import { 
  Search, 
  Filter, 
  Download,
  Network,
  Grid3X3,
  List
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
  sourceId?: string;
  targetId?: string;
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

// Custom node component for better styling
function CustomNode({ data }: { data: any }) {
  const getNodeColor = (type: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      'function': { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
      'class': { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
      'variable': { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
      'module': { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
      'file': { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
      'concept': { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
    };
    return colors[type.toLowerCase()] || { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' };
  };

  const colors = getNodeColor(data.type);
  
  return (
    <div className={cn(
      "px-4 py-3 rounded-lg border-2 shadow-sm min-w-[120px] max-w-[200px]",
      colors.bg,
      colors.border,
      "hover:shadow-md transition-shadow cursor-pointer"
    )}>
      <div className="space-y-1">
        <div className={cn("font-medium text-sm truncate", colors.text)}>
          {data.label}
        </div>
        <Badge variant="secondary" className="text-xs">
          {data.type}
        </Badge>
        {data.connections > 0 && (
          <div className="text-xs text-gray-600">
            {data.connections} connections
          </div>
        )}
      </div>
    </div>
  );
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

const nodeTypes = {
  custom: CustomNode,
};

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
  const [viewMode, setViewMode] = useState<'graph' | 'grid' | 'list'>('graph');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
      const fromId = link.from || link.sourceId;
      const toId = link.to || link.targetId;
      if (fromId) connections.set(fromId, (connections.get(fromId) || 0) + 1);
      if (toId) connections.set(toId, (connections.get(toId) || 0) + 1);
    });
    
    return connections;
  }, [data]);

  // Convert data to ReactFlow format
  const { reactFlowNodes, reactFlowEdges } = useMemo(() => {
    if (!data) return { reactFlowNodes: [], reactFlowEdges: [] };

    // Create a simple layout by positioning nodes in a circle or grid
    const nodeCount = data.nodes.length;
    const radius = Math.max(200, nodeCount * 25);
    const centerX = 300;
    const centerY = 300;

    const reactFlowNodes: Node[] = data.nodes.map((entity, index) => {
      let x: number, y: number;
      
      if (nodeCount <= 10) {
        // Circle layout for small graphs
        const angle = (index * 2 * Math.PI) / nodeCount;
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      } else {
        // Grid layout for larger graphs
        const cols = Math.ceil(Math.sqrt(nodeCount));
        const col = index % cols;
        const row = Math.floor(index / cols);
        x = col * 250 + 100;
        y = row * 150 + 100;
      }

      return {
        id: entity.id,
        type: 'custom',
        position: { x, y },
        data: {
          label: entity.name,
          type: entity.type,
          description: entity.description,
          connections: entityConnections.get(entity.id) || 0,
          entity: entity
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const reactFlowEdges: Edge[] = data.links.map((link, index) => {
      const fromId = link.from || link.sourceId;
      const toId = link.to || link.targetId;
      
      return {
        id: link.id || `edge-${index}`,
        source: fromId,
        target: toId,
        type: 'smoothstep',
        animated: true,
        label: link.type,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
          stroke: '#6366f1',
        },
        labelStyle: {
          fontSize: 12,
          fill: '#374151',
          fontWeight: 500,
        },
        data: { relationship: link }
      };
    });

    return { reactFlowNodes, reactFlowEdges };
  }, [data, entityConnections]);

  // Update ReactFlow nodes and edges when data changes
  useEffect(() => {
    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);
  }, [reactFlowNodes, reactFlowEdges, setNodes, setEdges]);

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
    return data.links.filter(link => {
      const fromId = link.from || link.sourceId;
      const toId = link.to || link.targetId;
      return fromId && toId && visibleEntityIds.has(fromId) && visibleEntityIds.has(toId);
    });
  }, [data, filteredEntities]);

  // Handle ReactFlow events
  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClickHandler = useCallback((_event: React.MouseEvent, node: Node) => {
    if (onNodeClick && node.data.entity) {
      onNodeClick(node.data.entity);
    }
  }, [onNodeClick]);

  const onEdgeClickHandler = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (onEdgeClick && edge.data?.relationship) {
      onEdgeClick(edge.data.relationship);
    }
  }, [onEdgeClick]);

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
            variant={viewMode === 'graph' ? 'default' : 'outline'}
            size="sm" 
            onClick={() => setViewMode('graph')}
          >
            <Network className="w-4 h-4 mr-2" />
            Graph
          </Button>
          <Button 
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm" 
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4 mr-2" />
            Grid
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm" 
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-2" />
            List
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

      {/* View Content */}
      {viewMode === 'graph' ? (
        <Card className="w-full" style={{ height: height }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClickHandler}
            onEdgeClick={onEdgeClickHandler}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className="bg-gray-50"
          >
            <Controls className="bg-white border border-gray-200 rounded-lg shadow-sm" />
            <MiniMap 
              className="bg-white border border-gray-200 rounded-lg shadow-sm"
              nodeStrokeColor={(n) => {
                const colors = {
                  'function': '#3b82f6',
                  'class': '#10b981',
                  'variable': '#f59e0b',
                  'module': '#8b5cf6',
                  'file': '#6b7280',
                  'concept': '#f97316',
                };
                return colors[n.data?.type as keyof typeof colors] || '#6b7280';
              }}
              nodeColor={(n) => {
                const colors = {
                  'function': '#dbeafe',
                  'class': '#d1fae5',
                  'variable': '#fef3c7',
                  'module': '#ede9fe',
                  'file': '#f3f4f6',
                  'concept': '#fed7aa',
                };
                return colors[n.data?.type as keyof typeof colors] || '#f3f4f6';
              }}
            />
            <Background color="#aaa" gap={16} />
          </ReactFlow>
        </Card>
      ) : (
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
      )}

      {/* Relationships - only show in grid/list views */}
      {viewMode !== 'graph' && filteredRelationships.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Relationships</h3>
          <div className="space-y-2">
            {filteredRelationships.map(relationship => {
              const fromId = relationship.from || relationship.sourceId;
              const toId = relationship.to || relationship.targetId;
              const fromEntity = data.nodes.find(n => n.id === fromId);
              const toEntity = data.nodes.find(n => n.id === toId);
              
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