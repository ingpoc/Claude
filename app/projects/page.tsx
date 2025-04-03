"use client";

import React, { useState } from 'react';
import Navigation from '@/components/Navigation';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import { PlusSquare } from 'lucide-react';

// Sample project data
const initialProjects = [
  {
    id: 'knowledge-graph',
    name: 'Knowledge Graph',
    description: 'A knowledge graph for code understanding',
    lastUpdated: '3/31/2025'
  }
];

export default function Projects() {
  const [projects, setProjects] = useState(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateProject = (name: string, description: string) => {
    const newProject = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      lastUpdated: new Date().toLocaleDateString()
    };
    
    setProjects([...projects, newProject]);
    setIsModalOpen(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation currentPath="/projects" />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-gray-400 mt-1">
              Manage your knowledge graph projects and organize entities
            </p>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            <PlusSquare size={18} className="mr-2" />
            Create Project
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard 
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              lastUpdated={project.lastUpdated}
            />
          ))}
        </div>
      </div>
      
      <CreateProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </main>
  );
}