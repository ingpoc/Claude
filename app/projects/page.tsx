"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ProjectCard from '../../components/ProjectCard';
import CreateProjectModal from '../../components/CreateProjectModal';
import { Button } from "../../components/ui/button";
import { PlusSquare } from 'lucide-react';

import { deleteProjectAction, getProjectsAction } from '../actions/knowledgeGraphActions';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
}

export default function ProjectsPage() {
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_MCP_UI_API_URL || '';
      const response = await fetch(`${API_BASE_URL}/api/ui/projects`, {
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
      setIsLoading(true);
      const success = await deleteProjectAction(projectIdToDelete);
      if (success) {
        await fetchProjects();
      } else {
        console.error(`Failed to delete project ${projectIdToDelete}`);
        alert(`Failed to delete project ${projectIdToDelete}.`);
        setIsLoading(false);
      }
    }
  }, [fetchProjects]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your knowledge graph projects and organize entities.
          </p>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)}>
          <PlusSquare size={18} className="mr-2" />
          Create Project
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading && projects.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-8">Loading projects...</div>
        ) : !isLoading && projects.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-8">No projects found. Create one to get started!</div>
        ) : (
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
        )}
      </div>
      
      <CreateProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}