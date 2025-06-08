'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Project } from '../lib/services';

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  projectId: string | null;
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  editObservation: (entityId: string, observationId: string, newText: string) => Promise<void>;
  deleteObservation: (entityId: string, observationId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
      
      // If no current project is selected and we have projects, select the first one
      if (!currentProject && data.projects && data.projects.length > 0) {
        setCurrentProject(data.projects[0]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async (name: string, description?: string): Promise<Project> => {
    setError(null);
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }
      
      const data = await response.json();
      const newProject = data.project;
      
      setProjects(prev => [...prev, newProject]);
      setCurrentProject(newProject);
      
      return newProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    setError(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // If we deleted the current project, switch to another one or null
      if (currentProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        setCurrentProject(remainingProjects.length > 0 ? remainingProjects[0] : null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const editObservation = async (entityId: string, observationId: string, newText: string): Promise<void> => {
    setError(null);
    
    try {
      // Update observation via API
      const response = await fetch(`/api/entities/${entityId}/observations/${observationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newText }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update observation: ${response.statusText}`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update observation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteObservation = async (entityId: string, observationId: string): Promise<void> => {
    setError(null);
    
    try {
      const response = await fetch(`/api/entities/${entityId}/observations/${observationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete observation: ${response.statusText}`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete observation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, []);

  const value: ProjectContextType = {
    currentProject,
    projects,
    projectId: currentProject?.id || null,
    setCurrentProject,
    refreshProjects,
    createProject,
    deleteProject,
    editObservation,
    deleteObservation,
    isLoading,
    error,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
