"use client";

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import { gsap } from 'gsap';
import { TrendingUp, TrendingDown, Library, Users, Workflow, Activity, Database, GitBranch } from 'lucide-react';

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  iconName?: string;
  unit?: string;
  description?: string;
  className?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  color?: 'slate' | 'emerald' | 'indigo' | 'amber';
  delay?: number;
}

const EnhancedStatCard: React.FC<EnhancedStatCardProps> = ({
  title,
  value,
  iconName,
  unit,
  description,
  className,
  trend = 'neutral',
  trendValue,
  color = 'slate',
  delay = 0
}) => {
  // Map icon names to components
  const iconMap = {
    Library,
    Users,
    Workflow,
    Activity,
    Database,
    GitBranch
  };
  
  const Icon = iconName ? iconMap[iconName as keyof typeof iconMap] : null;
  const cardRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  // Sophisticated color mappings with muted tones
  const colorMappings = {
    slate: 'from-slate-50 to-slate-100/50 border-slate-200',
    emerald: 'from-emerald-50 to-emerald-100/50 border-emerald-200',
    indigo: 'from-indigo-50 to-indigo-100/50 border-indigo-200',
    amber: 'from-amber-50 to-amber-100/50 border-amber-200'
  };

  const iconColors = {
    slate: 'text-slate-600',
    emerald: 'text-emerald-600',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600'
  };

  useEffect(() => {
    if (!cardRef.current || !valueRef.current) return;

    // Initial state
    gsap.set(cardRef.current, { opacity: 0, y: 20, scale: 0.98 });
    gsap.set(valueRef.current, { opacity: 0 });
    if (iconRef.current) {
      gsap.set(iconRef.current, { opacity: 0, scale: 0.9, rotation: -5 });
    }

    // Entrance animation
    const tl = gsap.timeline({ delay });
    
    tl.to(cardRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.5,
      ease: "power2.out"
    })
    .to(valueRef.current, {
      opacity: 1,
      duration: 0.3
    }, "-=0.2")
    .to(iconRef.current, {
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 0.4,
      ease: "back.out(1.2)"
    }, "-=0.2");

    // Animate number counting
    const numericValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/\D/g, ''));
    if (!isNaN(numericValue) && valueRef.current) {
      gsap.fromTo(valueRef.current, 
        { innerHTML: 0 },
        {
          innerHTML: numericValue,
          duration: 1.2,
          delay: delay + 0.2,
          ease: "power2.out",
          snap: { innerHTML: 1 },
          onUpdate: function() {
            if (valueRef.current) {
              const currentValue = Math.round(Number(this.targets()[0].innerHTML));
              valueRef.current.innerHTML = currentValue.toLocaleString() + (unit ? ` ${unit}` : '');
            }
          }
        }
      );
    }

    // Subtle hover animations
    const handleMouseEnter = () => {
      gsap.to(cardRef.current, {
        y: -2,
        scale: 1.01,
        duration: 0.2,
        ease: "power2.out"
      });
      
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          rotation: 5,
          scale: 1.05,
          duration: 0.2,
          ease: "power2.out"
        });
      }
    };

    const handleMouseLeave = () => {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        duration: 0.2,
        ease: "power2.out"
      });
      
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          rotation: 0,
          scale: 1,
          duration: 0.2,
          ease: "power2.out"
        });
      }
    };

    const card = cardRef.current;
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [value, delay, unit]);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-hidden border transition-all duration-200 hover:shadow-md bg-gradient-to-br",
        colorMappings[color],
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        {Icon && (
          <div ref={iconRef}>
            <Icon className={cn("h-5 w-5", iconColors[color])} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div 
          ref={valueRef}
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          {typeof value === 'number' ? 0 : value}
        </div>
        
        {(description || trend !== 'neutral') && (
          <div className="flex items-center justify-between mt-3">
            {description && (
              <p className="text-xs text-slate-500 flex-1">
                {description}
              </p>
            )}
            
            {trend !== 'neutral' && trendValue && (
              <div className={cn(
                "flex items-center text-xs font-medium",
                trend === 'up' ? "text-emerald-600" : "text-red-500"
              )}>
                {trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {trendValue}%
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedStatCard; 