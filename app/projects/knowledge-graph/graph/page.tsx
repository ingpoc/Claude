"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/Navigation';
import { ProjectSidebar } from '@/components/ui/ProjectSidebar';
import { Search, ZoomIn, ZoomOut, RefreshCw, List, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  MarkerType,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  // Remove local KG imports if not needed directly here
  // Entity, 
  // Relationship, 
  // EntityTypes, 
  // RelationshipTypes,
  // createEntity,
  // createRelationship,
  // getRelatedEntities,
  // exportGraph,
  // importGraph
} from '@/lib/knowledgeGraph';
import dagre from 'dagre';
import { useKnowledgeGraph } from "@/context/KnowledgeGraphContext"; // Import the hook

// Map entity types to color classes for ReactFlow nodes
const entityTypeColors: Record<string, string> = {
  'component': '#63B3ED', // blue-400
  'domain': '#B794F4', // purple-400
  'utility': '#68D391', // green-400
  'page': '#F6AD55', // orange-400
  'function': '#F6E05E', // yellow-400
  'class': '#F687B3', // pink-400
  'api': '#FC8181', // red-400
  'config': '#4FD1C5', // cyan-400
  'default': '#A0AEC0' // gray-500
};

// Dagre layout function
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const nodeWidth = 172; // Approximate width of a node
  const nodeHeight = 50; // Approximate height of a node

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // We need to center the node based on the calculated top-left position
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    // Set source/target position based on layout direction
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;
  });

  return { nodes, edges };
};

export default function KnowledgeGraphVisualization() {
  // Get state and functions from context
  const {
    entities, 
    relationships, 
    isLoading // Use loading state from context
  } = useKnowledgeGraph();

  const [searchQuery, setSearchQuery] = useState('');
  // Remove local isLoading state
  // const [isLoading, setIsLoading] = useState(false);
  
  const projectId = 'knowledge-graph';
  const projectName = 'Knowledge Graph';

  // Remove local graph data initialization
  // const initialGraphData = useMemo(() => initializeKnowledgeGraph(), []);

  // Transform data for ReactFlow using data from context
  const initialNodes: Node[] = useMemo(() => 
    entities.map((entity, index) => ({
      id: entity.id,
      type: 'default',
      data: { label: entity.name, type: entity.type }, // Pass type to minimap
      position: { x: 0, y: 0 },
      style: {
        background: entityTypeColors[entity.type] || entityTypeColors.default,
        color: '#1A202C',
        border: '1px solid #4A5568',
        borderRadius: '8px',
        padding: '10px 15px',
        fontSize: '12px',
        width: 150
      }
    })),
    [entities] // Depend on context entities
  );

  const initialEdges: Edge[] = useMemo(() =>
    relationships.map((rel, index) => ({
      id: `e${index}-${rel.from}-${rel.to}`,
      source: rel.from,
      target: rel.to,
      label: rel.type,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#A0AEC0' },
      labelStyle: { fill: '#A0AEC0', fontSize: 10 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#A0AEC0' }
    })),
    [relationships] // Depend on context relationships
  );

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => 
      getLayoutedElements(initialNodes, initialEdges),
      [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes/edges when layoutedNodes/layoutedEdges change (derived from context)
  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  useEffect(() => {
    setEdges(layoutedEdges);
  }, [layoutedEdges, setEdges]);

  // Remove old useEffect for loading simulation
  // useEffect(() => {
  //   ...
  // }, []);

  // Add loading indicator
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading Knowledge Graph...</div>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation currentPath={`/projects/${projectId}/graph`} />
      
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar 
          projectName={projectName} 
          projectId={projectId}
          description="A knowledge graph for code understanding"
          activeView="graph"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddEntityClick={() => { /* TODO: Implement or centralize Add Entity Modal */ }}
        />
        
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="relative flex-grow w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              className="bg-gray-900"
            >
              <MiniMap nodeColor={(node) => entityTypeColors[node.data.type] || entityTypeColors.default} nodeStrokeWidth={3} zoomable pannable />
              <Controls />
              <Background color="#4A5568" gap={16} />
            </ReactFlow>
          </div>
        </div>
      </div>
    </main>
  );
}