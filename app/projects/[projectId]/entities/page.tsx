"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import EntityCard from '@/components/EntityCard';
import AddEntityModal from '@/components/AddEntityModal';
import { PlusSquare } from 'lucide-react';

// Sample entity data for financial dashboard
const initialEntities = [
  {
    id: 'chart-component',
    name: 'ChartComponent',
    type: 'class' as const,
    content: 'class ChartComponent extends React.Component {\n  // Class content\n}'
  },
  {
    id: 'calculate-metrics',
    name: 'calculateMetrics',
    type: 'function' as const,
    content: 'function calculateMetrics(data) {\n  // Function content\n}'
  }
];

export default function ProjectEntities() {
  const params = useParams();
  const projectId = params.projectId as string;
  
  const [entities, setEntities] = useState(initialEntities);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<typeof initialEntities[0] | null>(null);

  // Map project IDs to project names
  const projectNames: Record<string, string> = {
    'financial-dashboard': 'Financial Dashboard',
    'recipe-application': 'Recipe Application',
    'knowledge-graph': 'Knowledge Graph'
  };

  const handleAddEntity = (name: string, type: 'class' | 'function', content: string) => {
    const newEntity = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      type: type as 'class' | 'function',
      content
    };
    
    setEntities([...entities, newEntity]);
    setIsModalOpen(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation currentPath={`/projects/${projectId}`} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          projectName={projectNames[projectId] || projectId} 
          projectId={projectId}
        />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold">{projectNames[projectId] || projectId} Entities</h1>
                <p className="text-gray-400 mt-1">
                  View and manage entities within this project
                </p>
              </div>
              
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                <PlusSquare size={18} className="mr-2" />
                Add Entity
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entities.map((entity) => (
                <EntityCard 
                  key={entity.id}
                  name={entity.name}
                  type={entity.type}
                  onClick={() => setSelectedEntity(entity)}
                />
              ))}
            </div>
            
            {selectedEntity && (
              <div className="mt-8 bg-gray-900 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-medium">{selectedEntity.name}</h2>
                  <span className="text-sm bg-gray-800 px-2 py-1 rounded">
                    {selectedEntity.type}
                  </span>
                </div>
                <pre className="bg-gray-800 p-4 rounded font-mono text-sm overflow-x-auto">
                  {selectedEntity.content}
                </pre>
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <h3 className="font-medium mb-2">Relations</h3>
                  <div className="text-gray-400">No relations found</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <AddEntityModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(name, type, content) => handleAddEntity(name, type as 'class' | 'function', content)}
      />
    </main>
  );
}