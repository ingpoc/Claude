import React from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, FileText, Trash2 } from 'lucide-react';

import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  className?: string;
  onDelete?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ id, name, description, lastUpdated, className, onDelete }) => {
  return (
    <Card className={cn("flex flex-col justify-between h-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription className="line-clamp-2 flex items-start pt-1">
          {description || "No description provided."}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-between items-center pt-4">
        <div className="text-xs text-muted-foreground flex items-center">
          <Calendar size={12} className="mr-1.5" />
          Last Updated: {lastUpdated}
        </div>
        
        <div className="flex items-center space-x-2">
          {onDelete && (
            <Button 
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }}
              title="Delete Project"
              aria-label="Delete Project"
            >
              <Trash2 size={16} />
            </Button>
          )}

          <Button asChild size="sm">
            <Link href={`/projects/${id}/entities`}>
              View <ArrowRight size={14} className="ml-1" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;