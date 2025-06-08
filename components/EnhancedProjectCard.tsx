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
    active: { color: 'bg-emerald-500', label: 'Active', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    archived: { color: 'bg-slate-400', label: 'Archived', textColor: 'text-slate-600', bgColor: 'bg-slate-50' },
    new: { color: 'bg-indigo-500', label: 'New', textColor: 'text-indigo-700', bgColor: 'bg-indigo-50' }
  };

  useEffect(() => {
    if (!cardRef.current || !contentRef.current || !statsRef.current) return;

    // Initial state
    gsap.set(cardRef.current, { opacity: 0, y: 30, scale: 0.95 });
    gsap.set(contentRef.current, { opacity: 0, y: 15 });
    gsap.set(statsRef.current, { opacity: 0, y: 10 });

    // Entrance animation
    const tl = gsap.timeline({ delay });
    
    tl.to(cardRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      ease: "power2.out"
    })
    .to(contentRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: "power2.out"
    }, "-=0.3")
    .to(statsRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.3,
      ease: "power2.out"
    }, "-=0.2");

    // Subtle hover animations
    const handleMouseEnter = () => {
      gsap.to(cardRef.current, {
        y: -4,
        scale: 1.01,
        duration: 0.3,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        duration: 0.3,
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
        "bg-white border border-slate-200",
        "hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300",
        className
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        "absolute top-4",
        variant === 'list' ? "right-4" : "right-4"
      )}>
        <Badge 
          variant="outline"
          className={cn(
            "text-xs font-medium border",
            statusConfig[status].textColor,
            statusConfig[status].bgColor,
            "border-current border-opacity-20"
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
              <CardTitle className="text-lg font-semibold text-slate-900 mb-2 pr-16">
                {name}
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                {description || "No description provided."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pb-3">
            <div ref={statsRef} className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-3 w-3 text-slate-600 mr-1" />
                  <span className="text-xs font-medium text-slate-700">Entities</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{entityCount}</div>
              </div>
              
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <GitBranch className="h-3 w-3 text-slate-600 mr-1" />
                  <span className="text-xs font-medium text-slate-700">Links</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{relationshipCount}</div>
              </div>
              
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <Activity className="h-3 w-3 text-slate-600 mr-1" />
                  <span className="text-xs font-medium text-slate-700">Score</span>
                </div>
                <div className="text-lg font-bold text-slate-900">{activityScore}</div>
              </div>
            </div>

            {/* Activity progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Activity Level</span>
                <span className="text-xs font-medium text-slate-700">{Math.min(activityScore, 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-slate-400 to-slate-600 h-1.5 rounded-full transition-all duration-1000 delay-500"
                  style={{ width: `${Math.min(activityScore, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center text-xs text-slate-500">
                <Calendar className="h-3 w-3 mr-1" />
                Updated {lastUpdated}
              </div>
              
              <div className="flex items-center gap-2">
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                
                <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">
                  <Link href={`/projects/${id}`} className="flex items-center">
                    View
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardFooter>
        </>
      ) : (
        // List variant layout
        <div className="flex items-center justify-between w-full p-4">
          <div ref={contentRef} className="flex-1 pr-4">
            <div className="flex items-center justify-between mb-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                {name}
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-slate-600">
              {description || "No description provided."}
            </CardDescription>
            <div className="flex items-center mt-2 text-xs text-slate-500">
              <Calendar className="h-3 w-3 mr-1" />
              Updated {lastUpdated}
            </div>
          </div>
          
          <div ref={statsRef} className="flex items-center gap-4 mr-4">
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900">{entityCount}</div>
              <div className="text-xs text-slate-500">Entities</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900">{relationshipCount}</div>
              <div className="text-xs text-slate-500">Links</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900">{activityScore}</div>
              <div className="text-xs text-slate-500">Score</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">
              <Link href={`/projects/${id}`} className="flex items-center">
                View
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EnhancedProjectCard;
