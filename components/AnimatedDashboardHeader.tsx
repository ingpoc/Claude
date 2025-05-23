"use client";

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Search, Plus, Settings, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

interface AnimatedDashboardHeaderProps {
  userName?: string;
  className?: string;
}

const AnimatedDashboardHeader: React.FC<AnimatedDashboardHeaderProps> = ({
  userName = "User",
  className
}) => {
  const handleSearch = (query: string) => {
    console.log('Search:', query);
    // Implement search functionality here
  };

  const handleNewProject = () => {
    console.log('New project');
    // Implement new project functionality here
  };
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current || !titleRef.current || !subtitleRef.current || !actionsRef.current) return;

    // Initial state
    gsap.set(titleRef.current, { opacity: 0, y: -20, scale: 0.95 });
    gsap.set(subtitleRef.current, { opacity: 0, y: -15 });
    gsap.set(actionsRef.current, { opacity: 0, y: -20 });
    gsap.set(backgroundRef.current, { opacity: 0, scale: 1.05 });

    // Entrance animation
    const tl = gsap.timeline({ delay: 0.1 });
    
    tl.to(backgroundRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: "power2.out"
    })
    .to(titleRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      ease: "power2.out"
    }, "-=0.5")
    .to(subtitleRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out"
    }, "-=0.3")
    .to(actionsRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out"
    }, "-=0.2");

    // Subtle floating animation for background elements
    if (backgroundRef.current) {
      gsap.to(backgroundRef.current.children, {
        y: "random(-10, 10)",
        rotation: "random(-2, 2)",
        duration: "random(8, 12)",
        ease: "power1.inOut",
        repeat: -1,
        yoyo: true,
        stagger: {
          each: 0.5,
          from: "random"
        }
      });
    }
  }, []);

  return (
    <div 
      ref={headerRef}
      className={cn(
        "relative overflow-hidden rounded-xl p-8 mb-8",
        "bg-gradient-to-br from-white to-slate-50",
        "border border-slate-200 shadow-sm",
        className
      )}
    >
      {/* Subtle background elements */}
      <div 
        ref={backgroundRef}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute top-10 left-10 w-32 h-32 bg-slate-100/40 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-24 h-24 bg-slate-100/30 rounded-full blur-2xl" />
        <div className="absolute bottom-10 left-1/3 w-40 h-40 bg-slate-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-slate-100/40 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left side - Title and subtitle */}
        <div className="flex-1">
          <h1 
            ref={titleRef}
            className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2"
          >
            Hi, {userName}! 👋
          </h1>
          <p 
            ref={subtitleRef}
            className="text-lg text-slate-600 max-w-md"
          >
            Welcome back to your knowledge graph dashboard. Let&apos;s explore your data universe.
          </p>
        </div>

        {/* Right side - Actions */}
        <div 
          ref={actionsRef}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto"
        >
          {/* Search */}
          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search projects, entities..." 
              className="pl-10 bg-white border-slate-200 focus:border-slate-300 text-slate-700"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleNewProject}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Minimal pattern overlay */}
      <div className="absolute inset-0 opacity-[0.01] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Ccircle cx='20' cy='20' r='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
    </div>
  );
};

export default AnimatedDashboardHeader; 