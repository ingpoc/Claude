"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Trash2, Activity, Users, GitBranch } from 'lucide-react';
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { gsap } from 'gsap';

interface EnhancedProjectCardProps {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  className?: string;
  onDelete?: () => void;
  entityCount?: number;
  relationshipCount?: number;
  activityScore?: number;
  status?: 'active' | 'archived' | 'new';
  delay?: number;
  variant?: 'grid' | 'list';
}

const EnhancedProjectCard: React.FC<EnhancedProjectCardProps> = ({ 
  id, 
  name, 
  description, 
  lastUpdated, 
  className, 
  onDelete,
  entityCount = 0,
  relationshipCount = 0,
  activityScore = 0,
  status = 'active',
  delay = 0,
  variant = 'grid'
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const statusConfig = {
    active: { color: 'bg-green-500', label: 'Active', textColor: 'text-green-700' },
    archived: { color: 'bg-gray-500', label: 'Archived', textColor: 'text-gray-700' },
    new: { color: 'bg-blue-500', label: 'New', textColor: 'text-blue-700' }
  };

  useEffect(() => {
    if (!cardRef.current || !contentRef.current || !statsRef.current) return;

    // Initial state
    gsap.set(cardRef.current, { opacity: 0, y: 50, rotationY: -15, scale: 0.9 });
    gsap.set(contentRef.current, { opacity: 0, y: 20 });
    gsap.set(statsRef.current, { opacity: 0, y: 15 });

    // Entrance animation
    const tl = gsap.timeline({ delay });
    
    tl.to(cardRef.current, {
      opacity: 1,
      y: 0,
      rotationY: 0,
      scale: 1,
      duration: 0.8,
      ease: "power3.out"
    })
    .to(contentRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out"
    }, "-=0.4")
    .to(statsRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: "power2.out"
    }, "-=0.2");

    // Hover animations
    const handleMouseEnter = () => {
      gsap.to(cardRef.current, {
        y: -8,
        scale: 1.02,
        rotationY: 2,
        duration: 0.4,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        rotationY: 0,
        duration: 0.4,
        ease: "power2.out"
      });
    };

    const card = cardRef.current;
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [delay]);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        variant === 'grid' 
          ? "flex flex-col justify-between h-full" 
          : "flex flex-row items-center",
        "relative overflow-hidden",
        "bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60",
        "hover:shadow-xl hover:shadow-gray-200/40 transition-all duration-300",
        "backdrop-blur-sm",
        className
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        "absolute top-4",
        variant === 'list' ? "right-4" : "right-4"
      )}>
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs font-medium",
            statusConfig[status].textColor,
            "bg-opacity-10"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full mr-1.5", statusConfig[status].color)} />
          {statusConfig[status].label}
        </Badge>
      </div>

      {variant === 'grid' ? (
        <>
          <CardHeader className="pb-3">
            <div ref={contentRef}>
              <CardTitle className="text-lg font-semibold text-gray-900 mb-2 pr-16">
                {name}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {description || "No description provided."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pb-3">
            <div ref={statsRef} className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-blue-50/50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-3 w-3 text-blue-600 mr-1" />
                  <span className="text-xs font-medium text-blue-700">Entities</span>
                </div>
                <div className="text-lg font-bold text-blue-800">{entityCount}</div>
              </div>
              
              <div className="text-center p-2 bg-purple-50/50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <GitBranch className="h-3 w-3 text-purple-600 mr-1" />
                  <span className="text-xs font-medium text-purple-700">Links</span>
                </div>
                <div className="text-lg font-bold text-purple-800">{relationshipCount}</div>
              </div>
              
              <div className="text-center p-2 bg-green-50/50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <Activity className="h-3 w-3 text-green-600 mr-1" />
                  <span className="text-xs font-medium text-green-700">Score</span>
                </div>
                <div className="text-lg font-bold text-green-800">{activityScore}</div>
              </div>
            </div>

            {/* Activity progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Activity Level</span>
                <span className="text-xs font-medium text-gray-700">{Math.min(activityScore, 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-1000 delay-700"
                  style={{ width: `${Math.min(activityScore, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between items-center pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 flex items-center">
              <Calendar className="h-3 w-3 mr-1.5" />
              Updated {lastUpdated}
            </div>
            
            <div className="flex items-center space-x-2">
              {onDelete && (
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete();
                  }}
                  title="Delete Project"
                  aria-label="Delete Project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button 
                asChild 
                size="sm"
                className="h-8 px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
              >
                <Link href={`/projects/${id}/entities`} className="flex items-center">
                  View 
                  <ArrowRight className="h-3 w-3 ml-1.5" />
                </Link>
              </Button>
            </div>
          </CardFooter>
        </>
      ) : (
        // List variant layout
        <div className="flex w-full items-center p-6 pr-20">
          <div ref={contentRef} className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <CardTitle className="text-lg font-semibold text-gray-900 truncate mr-4">
                {name}
              </CardTitle>
              <div className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1.5" />
                {lastUpdated}
              </div>
            </div>
            <CardDescription className="text-sm text-gray-600 line-clamp-1 mb-3">
              {description || "No description provided."}
            </CardDescription>
            
            {/* Horizontal stats */}
            <div ref={statsRef} className="flex items-center space-x-6">
              <div className="flex items-center">
                <Users className="h-3 w-3 text-blue-600 mr-1" />
                <span className="text-xs text-gray-600 mr-1">Entities:</span>
                <span className="text-sm font-semibold text-gray-900">{entityCount}</span>
              </div>
              <div className="flex items-center">
                <GitBranch className="h-3 w-3 text-purple-600 mr-1" />
                <span className="text-xs text-gray-600 mr-1">Links:</span>
                <span className="text-sm font-semibold text-gray-900">{relationshipCount}</span>
              </div>
              <div className="flex items-center">
                <Activity className="h-3 w-3 text-green-600 mr-1" />
                <span className="text-xs text-gray-600 mr-1">Score:</span>
                <span className="text-sm font-semibold text-gray-900">{activityScore}</span>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {onDelete && (
              <Button 
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete();
                }}
                title="Delete Project"
                aria-label="Delete Project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button 
              asChild 
              size="sm"
              className="h-8 px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
            >
              <Link href={`/projects/${id}/entities`} className="flex items-center">
                View 
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EnhancedProjectCard; 