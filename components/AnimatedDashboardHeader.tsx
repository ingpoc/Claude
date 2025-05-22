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
    gsap.set(titleRef.current, { opacity: 0, y: -30, scale: 0.9 });
    gsap.set(subtitleRef.current, { opacity: 0, y: -20 });
    gsap.set(actionsRef.current, { opacity: 0, y: -25 });
    gsap.set(backgroundRef.current, { opacity: 0, scale: 1.1 });

    // Entrance animation
    const tl = gsap.timeline({ delay: 0.2 });
    
    tl.to(backgroundRef.current, {
      opacity: 1,
      scale: 1,
      duration: 1.2,
      ease: "power2.out"
    })
    .to(titleRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: "back.out(1.2)"
    }, "-=0.8")
    .to(subtitleRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: "power2.out"
    }, "-=0.4")
    .to(actionsRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: "power2.out"
    }, "-=0.3");

    // Floating animation for background elements
    if (backgroundRef.current) {
      gsap.to(backgroundRef.current.children, {
        y: "random(-20, 20)",
        rotation: "random(-5, 5)",
        duration: "random(3, 6)",
        ease: "power1.inOut",
        repeat: -1,
        yoyo: true,
        stagger: {
          each: 0.2,
          from: "random"
        }
      });
    }
  }, []);

  return (
    <div 
      ref={headerRef}
      className={cn(
        "relative overflow-hidden rounded-2xl p-8 mb-8",
        "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50",
        "border border-white/20 backdrop-blur-sm",
        className
      )}
    >
      {/* Animated background elements */}
      <div 
        ref={backgroundRef}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200/20 rounded-full blur-xl" />
        <div className="absolute top-20 right-20 w-24 h-24 bg-purple-200/20 rounded-full blur-lg" />
        <div className="absolute bottom-10 left-1/3 w-40 h-40 bg-pink-200/20 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-20 h-20 bg-indigo-200/20 rounded-full blur-lg" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left side - Title and subtitle */}
        <div className="flex-1">
          <h1 
            ref={titleRef}
            className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-2"
          >
            Hi, {userName}! 👋
          </h1>
          <p 
            ref={subtitleRef}
            className="text-lg text-gray-600 max-w-md"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search projects, entities..." 
              className="pl-10 bg-white/80 backdrop-blur-sm border-white/40 focus:bg-white"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-white"
            >
              <Bell className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-white"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleNewProject}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3Ccircle cx='53' cy='7' r='1'/%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='7' cy='53' r='1'/%3E%3Ccircle cx='53' cy='53' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
    </div>
  );
};

export default AnimatedDashboardHeader; 