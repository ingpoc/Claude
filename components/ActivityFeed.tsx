"use client";

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Clock, Plus, Edit, Link as LinkIcon, Trash } from 'lucide-react';
import { cn } from '../lib/utils';

interface ActivityItem {
  id: string;
  type: 'entity_created' | 'entity_updated' | 'relationship_created' | 'entity_deleted';
  description: string;
  timestamp: string;
  projectName?: string;
  entityName?: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  className?: string;
  maxItems?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  className,
  maxItems = 5
}) => {
  const feedRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement[]>([]);

  // Sample activities if none provided
  const sampleActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'entity_created',
      description: 'Created new entity "User Authentication"',
      timestamp: '2 minutes ago',
      projectName: 'atom-to-quark-migration',
      entityName: 'User Authentication'
    },
    {
      id: '2',
      type: 'relationship_created',
      description: 'Linked "Database" to "API Service"',
      timestamp: '5 minutes ago',
      projectName: 'stock-analysis'
    },
    {
      id: '3',
      type: 'entity_updated',
      description: 'Updated "Performance Metrics" entity',
      timestamp: '12 minutes ago',
      projectName: 'atom-to-quark-migration'
    },
    {
      id: '4',
      type: 'entity_created',
      description: 'Added "Data Processing Pipeline"',
      timestamp: '1 hour ago',
      projectName: 'stock-analysis'
    },
    {
      id: '5',
      type: 'entity_deleted',
      description: 'Removed "Legacy Component"',
      timestamp: '2 hours ago',
      projectName: 'atom-to-quark-migration'
    }
  ];

  const displayActivities = activities.length > 0 ? activities : sampleActivities;
  const limitedActivities = displayActivities.slice(0, maxItems);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'entity_created':
        return <Plus className="h-3 w-3" />;
      case 'entity_updated':
        return <Edit className="h-3 w-3" />;
      case 'relationship_created':
        return <LinkIcon className="h-3 w-3" />;
      case 'entity_deleted':
        return <Trash className="h-3 w-3" />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'entity_created':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'entity_updated':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'relationship_created':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'entity_deleted':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  useEffect(() => {
    if (!feedRef.current) return;

    // Initial state for the entire feed
    gsap.set(feedRef.current, { opacity: 0, y: 30 });

    // Entrance animation for the feed
    gsap.to(feedRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      delay: 0.8,
      ease: "power2.out"
    });

    // Animate each activity item
    itemsRef.current.forEach((item, index) => {
      if (item) {
        gsap.set(item, { opacity: 0, x: -20 });
        gsap.to(item, {
          opacity: 1,
          x: 0,
          duration: 0.4,
          delay: 1 + index * 0.1,
          ease: "power2.out"
        });
      }
    });
  }, [limitedActivities]);

  return (
    <Card ref={feedRef} className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Clock className="h-5 w-5 mr-2 text-blue-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {limitedActivities.length > 0 ? (
          <div className="space-y-3">
            {limitedActivities.map((activity, index) => (
              <div
                key={activity.id}
                ref={(el) => {
                  if (el) itemsRef.current[index] = el;
                }}
                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full border",
                  getActivityColor(activity.type)
                )}>
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium">
                    {activity.description}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-xs text-gray-500">
                      {activity.timestamp}
                    </span>
                    {activity.projectName && (
                      <Badge variant="secondary" className="text-xs py-0 px-2">
                        {activity.projectName}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        )}
        
        {displayActivities.length > maxItems && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-center text-gray-500">
              And {displayActivities.length - maxItems} more activities...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed; 