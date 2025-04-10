"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '../../components/Navigation';
import ProjectCard from '../../components/ProjectCard';
import CreateProjectModal from '../../components/CreateProjectModal';
import { PlusSquare, Trash2 } from 'lucide-react';

import { deleteProjectAction, getProjectsAction } from '../actions/knowledgeGraphActions';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProjectsAction();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (name: string, description: string) => {
    try {
      const response = await fetch('/api/ui/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      if (response.ok) {
        await fetchProjects();
      } else {
        console.error("Failed to create project:", response.statusText);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
    setIsModalOpen(false);
  };

  const handleDeleteProject = useCallback(async (projectIdToDelete: string) => {
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      const success = await deleteProjectAction(projectIdToDelete);
      if (success) {
        await fetchProjects();
      } else {
        console.error(`Failed to delete project ${projectIdToDelete}`);
        alert(`Failed to delete project ${projectIdToDelete}.`);
      }
    }
  }, [fetchProjects]);

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
          {isLoading ? (
            <div className="col-span-3 text-center py-8">Loading projects...</div>
          ) : projects.length > 0 ? (
            projects.map((project) => (
              <ProjectCard 
                key={project.id}
                id={project.id}
                name={project.name}
                description={project.description || ""}
                lastUpdated={new Date(project.lastAccessed || project.createdAt).toLocaleDateString()}
                onDelete={() => handleDeleteProject(project.id)}
              />
            ))
          ) : (
            <div className="col-span-3 text-center py-8">No projects found. Create one to get started!</div>
          )}
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