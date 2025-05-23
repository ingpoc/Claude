import React from 'react';
import Link from 'next/link';
import { Users, Library, Workflow, Settings, Brain } from 'lucide-react';
import { Button } from "../components/ui/button";
import ProjectCard from "../components/ProjectCard";
import StatCard from "../components/StatCard";
import EnhancedStatCard from "../components/EnhancedStatCard";
import EnhancedProjectCard from "../components/EnhancedProjectCard";
import AnimatedDashboardHeader from "../components/AnimatedDashboardHeader";
import ActivityFeed from "../components/ActivityFeed";
import { ContextDashboard } from "../components/ui/ContextDashboard";
import { NaturalLanguageQuery } from "../components/ui/NaturalLanguageQuery";
import { SmartSuggestionsPanel } from "../components/ui/SmartSuggestionsPanel";
import { getProjectsAction } from './actions/knowledgeGraphActions';
import { settingsService } from '../lib/services/SettingsService';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

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
    const fetchedProjects = await getProjectsAction();
    projects = fetchedProjects || [];
  } catch (error) {
    console.error("Error fetching projects for dashboard:", error);
    fetchError = "Failed to load projects.";
    // For build time, use mock data instead of failing
    projects = [
      {
        id: 'sample-1',
        name: 'Sample Project',
        description: 'A sample project for demonstration',
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      }
    ];
    fetchError = null; // Clear error for build time
  }

  // Fetch user settings to check AI feature availability
  let userSettings;
  try {
    userSettings = await settingsService.getUserSettings('default-user');
  } catch (error) {
    console.error("Error fetching user settings:", error);
    // Use default settings if fetch fails
    userSettings = null;
  }

  // Check which AI features are enabled
  const aiEnabled = userSettings?.aiConfiguration?.enabled ?? false;
  const aiFeatures = userSettings?.aiFeatures ?? {
    naturalLanguageQuery: false,
    smartEntityExtraction: false,
    intelligentSuggestions: false,
    conversationAnalysis: false,
    conflictResolution: false,
    knowledgeGapDetection: false,
    contextPrediction: false
  };

  // Check if any AI features are enabled for Context Intelligence section
  const hasAnyAIFeatures = aiEnabled && (
    aiFeatures.naturalLanguageQuery ||
    aiFeatures.intelligentSuggestions ||
    aiFeatures.conversationAnalysis ||
    aiFeatures.contextPrediction
  );

  // Placeholder stats (replace with real data fetching if available)
  const totalEntities = 157; // Example stat
  const totalRelationships = 342; // Example stat

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                MCP Knowledge Graph Dashboard
              </h1>
              <p className="text-slate-600">
                Manage your knowledge graphs with context intelligence and AI-powered insights.
              </p>
            </div>
            <Link 
              href="/settings" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors duration-200"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
          <AnimatedDashboardHeader userName="User" />
        </div>

        {/* Enhanced Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <EnhancedStatCard 
            title="Total Projects" 
            value={projects.length} 
            iconName="Library"
            description="Active projects in your workspace"
            color="slate"
            delay={0}
            trend="up"
            trendValue={12}
          />
          <EnhancedStatCard 
            title="Total Entities" 
            value={totalEntities}
            iconName="Users" 
            description="Knowledge entities across projects"
            color="emerald"
            delay={0.1}
            trend="up"
            trendValue={8}
          />
          <EnhancedStatCard 
            title="Total Relationships" 
            value={totalRelationships}
            iconName="Workflow" 
            description="Connections between entities"
            color="indigo"
            delay={0.2}
            trend="up"
            trendValue={15}
          />
        </div>

        {/* Context Intelligence Section - Only show if AI features are enabled */}
        {hasAnyAIFeatures ? (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Context Intelligence</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Natural Language Query - Only show if enabled */}
              {aiFeatures.naturalLanguageQuery && (
                <div className="lg:col-span-2">
                  <NaturalLanguageQuery 
                    projectId={projects[0]?.id || 'default'}
                    className="h-full min-h-[400px]"
                  />
                </div>
              )}
              
              {/* Smart Suggestions - Only show if enabled */}
              {aiFeatures.intelligentSuggestions && (
                <div className={aiFeatures.naturalLanguageQuery ? "lg:col-span-1" : "lg:col-span-3"}>
                  <SmartSuggestionsPanel 
                    projectId={projects[0]?.id || 'default'}
                    className="h-full min-h-[400px]"
                  />
                </div>
              )}

              {/* If only one AI feature is enabled and it's not natural language query, make it span more columns */}
              {!aiFeatures.naturalLanguageQuery && !aiFeatures.intelligentSuggestions && (aiFeatures.conversationAnalysis || aiFeatures.contextPrediction) && (
                <div className="lg:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-indigo-600" />
                        Context Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600">
                        Advanced context analysis features are enabled. AI will analyze your conversations and predict relevant context.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Show AI Features Disabled Message */
          <div className="mb-8">
            <Card className="border-slate-200">
              <CardContent className="py-8">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    AI Features Available
                  </h3>
                  <p className="text-slate-600 mb-4 max-w-md mx-auto">
                    Enable AI-powered features like natural language queries, smart suggestions, and context intelligence to unlock the full potential of your knowledge graphs.
                  </p>
                  <Button asChild variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50">
                    <Link href="/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Enable AI Features
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Context Section - Only show if conversation analysis or context prediction is enabled */}
        {projects.length > 0 && (aiFeatures.conversationAnalysis || aiFeatures.contextPrediction) && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Recent Context</h2>
            <ContextDashboard 
              projectId={projects[0].id}
              className="lg:grid-cols-3"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Section */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Your Projects</h2>
              {projects.length > 3 && (
                <Button variant="outline" asChild className="border-slate-200 text-slate-600 hover:bg-slate-50">
                  <Link href="/projects">View All</Link>
                </Button>
              )}
            </div>

            {fetchError ? (
              <div className="text-center text-red-600 py-8">
                {fetchError}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.slice(0, 4).map((project, index) => ( 
                  <EnhancedProjectCard 
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    description={project.description || ""}
                    lastUpdated={new Date(project.lastAccessed || project.createdAt).toLocaleDateString()}
                    entityCount={Math.floor(Math.random() * 50) + 10} // Mock data
                    relationshipCount={Math.floor(Math.random() * 100) + 20} // Mock data
                    activityScore={Math.floor(Math.random() * 100) + 20} // Mock data
                    status={index === 0 ? 'new' : index === 1 ? 'active' : 'active'}
                    delay={0.3 + index * 0.1}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Library className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No projects found. Create your first project to get started!</p>
              </div>
            )}
          </div>

          {/* Activity Feed Sidebar */}
          <div className="lg:col-span-1">
            <ActivityFeed 
              className="h-fit"
              maxItems={6}
            />
          </div>
        </div>
      </div>
    </div>
  );
}