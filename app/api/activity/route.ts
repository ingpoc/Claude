import { NextRequest, NextResponse } from 'next/server';
import { qdrantDataService } from '../../../lib/services/QdrantDataService';
import { logger } from '../../../lib/services/Logger';

interface ActivityItem {
  id: string;
  type: 'entity_created' | 'entity_updated' | 'relationship_created' | 'entity_deleted';
  description: string;
  timestamp: string;
  projectName?: string;
  entityName?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const projectId = searchParams.get('projectId');

    logger.info('Fetching recent activity', { limit, projectId });

    // Get all projects to map project IDs to names
    const projects = await qdrantDataService.getAllProjects();
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const activities: ActivityItem[] = [];

    if (projectId) {
      // Get activity for specific project
      const projectActivities = await getProjectActivity(projectId, projectMap.get(projectId) || 'Unknown Project', limit);
      activities.push(...projectActivities);
    } else {
      // Get activity across all projects
      for (const project of projects.slice(0, 5)) { // Limit to 5 projects for performance
        const projectActivities = await getProjectActivity(project.id, project.name, Math.ceil(limit / projects.length));
        activities.push(...projectActivities);
      }
    }

    // Sort by timestamp (most recent first) and limit
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    logger.info('Fetched recent activity', { 
      activityCount: sortedActivities.length,
      projectId 
    });

    return NextResponse.json({
      success: true,
      activities: sortedActivities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to fetch recent activity', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}

async function getProjectActivity(projectId: string, projectName: string, limit: number): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];

  try {
    // Get recent entities (sorted by creation date)
    const entities = await qdrantDataService.getEntitiesByProject(projectId, limit * 2);
    const relationships = await qdrantDataService.getAllRelationships(projectId);

    // Convert entities to activities
    entities.forEach(entity => {
      activities.push({
        id: `entity-${entity.id}`,
        type: 'entity_created',
        description: `Created entity "${entity.name}"`,
        timestamp: entity.createdAt.toISOString(),
        projectName,
        entityName: entity.name
      });

      // Check if entity was updated (different created and updated times)
      if (entity.updatedAt && entity.updatedAt.getTime() !== entity.createdAt.getTime()) {
        activities.push({
          id: `entity-updated-${entity.id}`,
          type: 'entity_updated',
          description: `Updated entity "${entity.name}"`,
          timestamp: entity.updatedAt.toISOString(),
          projectName,
          entityName: entity.name
        });
      }
    });

    // Convert relationships to activities
    relationships.forEach(relationship => {
      const sourceEntity = entities.find(e => e.id === relationship.sourceId);
      const targetEntity = entities.find(e => e.id === relationship.targetId);
      
      const sourceName = sourceEntity?.name || 'Unknown Entity';
      const targetName = targetEntity?.name || 'Unknown Entity';

      activities.push({
        id: `relationship-${relationship.id}`,
        type: 'relationship_created',
        description: `Linked "${sourceName}" to "${targetName}"`,
        timestamp: relationship.createdAt.toISOString(),
        projectName
      });
    });

  } catch (error) {
    logger.error('Failed to get project activity', { projectId, error });
  }

  return activities;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
} 