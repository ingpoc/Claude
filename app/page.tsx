import React from 'react';
import { Users, Library, Workflow } from 'lucide-react';
import { Button } from "../components/ui/button";
import ProjectCard from "../components/ProjectCard";
import StatCard from "../components/StatCard";
import { getProjectsAction } from './actions/knowledgeGraphActions';
import Link from 'next/link';

// Define Project type based on action return type (adjust if needed)
interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastAccessed?: string;
}

// Make the component async to fetch data
export default async function DashboardPage() {

  // Fetch projects using the server action
  let projects: Project[] = [];
  let fetchError = null;
  try {
    projects = await getProjectsAction();
  } catch (error) {
    console.error("Error fetching projects for dashboard:", error);
    fetchError = "Failed to load projects.";
  }

  // Placeholder stats (replace with real data fetching if available)
  const totalEntities = 157; // Example stat
  const totalRelationships = 342; // Example stat

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, User!</h1>
          <p className="text-muted-foreground">
            Let's look at your knowledge graph overview.
          </p>
        </div>
        {/* <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search entities..." className="pl-9" />
          </div>
          <Button>
            <Crown className="mr-2 h-4 w-4" /> Upgrade
          </Button>
        </div> */}
      </div>

      {/* Main Content Grid - Updated Layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-8">
        {/* Stat Cards Row/Area */}
        <StatCard 
           title="Total Projects" 
           value={projects.length} 
           icon={Library}
           description="Number of active projects."
           className="lg:col-span-1"
         />
         <StatCard 
           title="Total Entities" 
           value={totalEntities} // Use placeholder
           icon={Users} 
           description="Across all projects."
           className="lg:col-span-1"
         />
         <StatCard 
           title="Total Relationships" 
           value={totalRelationships} // Use placeholder
           icon={Workflow} 
           description="Connections between entities."
           className="lg:col-span-1"
         />

        {/* Project Cards Section - Spanning multiple columns */} 
        {fetchError ? (
          <div className="md:col-span-2 lg:col-span-3 text-center text-destructive py-8">
            {fetchError}
          </div>
        ) : projects.length > 0 ? (
           // You might want to limit the number shown on dashboard
          projects.slice(0, 3).map((project) => ( 
            <ProjectCard 
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description || ""}
              lastUpdated={new Date(project.lastAccessed || project.createdAt).toLocaleDateString()}
              className="md:col-span-1 lg:col-span-1" // Ensure cards take up appropriate grid space
            />
          ))
        ) : (
          <div className="md:col-span-2 lg:col-span-3 text-center text-muted-foreground py-8">
            No projects found.
          </div>
        )}
         {/* Optional: Link to see all projects if more than displayed */}
         {projects.length > 3 && (
             <div className="md:col-span-1 lg:col-span-1 flex items-center justify-center">
                 <Button variant="outline" asChild>
                     <Link href="/projects">View All Projects</Link>
                 </Button>
             </div>
         )}
      </div>
    </div>
  );
}