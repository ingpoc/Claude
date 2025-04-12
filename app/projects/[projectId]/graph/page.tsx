"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ProjectSidebar } from '../../../../components/ui/ProjectSidebar';
import { Search, ZoomIn, ZoomOut, RefreshCw, List, LayoutGrid, AlertTriangle, Share2 } from 'lucide-react';
import Link from 'next/link';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { ProjectProvider, useProject } from '../../../../context/ProjectContext';
import { Button } from '../../../../components/ui/button';

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
  // If there are no nodes or edges, return as is to prevent errors
  if (nodes.length === 0 || edges.length === 0) {
    return { nodes, edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  const nodeWidth = 172; // Approximate width of a node
  const nodeHeight = 50; // Approximate height of a node

  // Add nodes to the dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to the dagre graph, with safeguards
  edges.forEach((edge) => {
    // Only add the edge if source and target nodes exist
    if (nodes.some(n => n.id === edge.source) && nodes.some(n => n.id === edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Apply layout
  try {
    dagre.layout(dagreGraph);
    
    // Update node positions
    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      // Only update position if the node has a position from dagre
      if (nodeWithPosition && typeof nodeWithPosition.x === 'number' && typeof nodeWithPosition.y === 'number') {
        // We need to center the node based on the calculated top-left position
        node.position = {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        };

        // Set source/target position based on layout direction
        node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
        node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;
      }
    });
  } catch (error) {
    console.error('Error in dagre layout:', error);
    // Don't modify the positions if there's an error
  }

  return { nodes, edges };
};

function GraphPageContent() {
  const { 
    projectId, 
    projectName, 
    projectDescription, 
    entities, 
    relationships,
    isLoading 
  } = useProject();
  
  // console.log(`Graph page rendering for project ${projectId}`);
  // console.log(`Entities: ${entities.length}, Relationships: ${relationships.length}`);
  // console.log('Entity IDs:', entities.map(e => e.id));

  const [searchQuery, setSearchQuery] = useState('');
  
  // Transform data for ReactFlow using data from context
  const initialNodes: Node[] = useMemo(() => 
    entities.filter(entity => entity && entity.id && entity.name).map((entity) => ({
      id: entity.id,
      type: 'default',
      data: { 
        label: entity.name || 'Unnamed Entity',
        type: entity.type || 'default'
      },
      position: { x: 0, y: 0 },
      style: {
        background: 'hsl(var(--card))', 
        color: 'hsl(var(--card-foreground))',
        border: `1px solid ${entity.type && entityTypeColors[entity.type.toLowerCase()] ? entityTypeColors[entity.type.toLowerCase()] : entityTypeColors.default}`,
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
        fontSize: '12px',
        width: 150
      }
    })),
    [entities] // Depend on context entities
  );

  const initialEdges: Edge[] = useMemo(() => {
    const validEntities = new Set(entities.map(e => e.id));
    
    return relationships
      .filter(rel => 
        rel && 
        rel.from && 
        rel.to && 
        validEntities.has(rel.from) && 
        validEntities.has(rel.to)
      )
      .map((rel, index) => ({
        id: `e${index}-${rel.from}-${rel.to}`,
        source: rel.from,
        target: rel.to,
        label: rel.type || 'related',
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--border))' },
        labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--border))' }
      }));
  }, [relationships, entities]);

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

  // Update loading indicator style
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading project data...</div>;
  }

  // Empty state view
  if (entities.length === 0 || relationships.length === 0) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <ProjectSidebar 
            projectName={projectName} 
            projectId={projectId}
            description={projectDescription}
            activeView="graph"
            entities={entities || []}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          
          <div className="flex-1 overflow-auto flex flex-col">
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-24 h-24 rounded-full bg-muted/60 flex items-center justify-center mb-6 relative">
                <Share2 size={48} className="text-muted-foreground" />
              </div>
              
              <h3 className="text-xl font-semibold mb-3 text-foreground">No Graph Data Available</h3>
              
              <p className="text-gray-500 max-w-md mb-6">
                {entities.length === 0 
                  ? "There are no entities in this project yet. Create some entities to visualize them in the graph."
                  : "There are entities but no relationships between them. Create relationships to visualize connections."}
              </p>
              
              <div className="flex space-x-4">
                <Link href={`/projects/${projectId}/entities`} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Go to Entities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar 
          projectName={projectName} 
          projectId={projectId}
          description={projectDescription}
          activeView="graph"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="relative flex-grow w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              style={{ background: 'hsl(var(--background))' }}
            >
              <Background color="hsl(var(--border))" gap={16} />
              <MiniMap 
                 nodeStrokeWidth={3} 
                 zoomable 
                 pannable 
                 style={{ 
                   background: 'hsl(var(--card))',
                   border: '1px solid hsl(var(--border))'
                 }} 
                 nodeColor={(node) => node.style?.border?.toString() || 'hsl(var(--primary))'}
                />
              <Controls />
            </ReactFlow>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GraphPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  
  return (
    <ProjectProvider projectId={projectId}>
      <GraphPageContent />
    </ProjectProvider>
  );
} 