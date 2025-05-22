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
  color?: 'blue' | 'green' | 'purple' | 'orange';
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
  color = 'blue',
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

  // Color mappings for gradients
  const colorMappings = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/20',
    green: 'from-green-500/10 to-green-600/5 border-green-200/20',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-200/20',
    orange: 'from-orange-500/10 to-orange-600/5 border-orange-200/20'
  };

  const iconColors = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500'
  };

  useEffect(() => {
    if (!cardRef.current || !valueRef.current) return;

    // Initial state
    gsap.set(cardRef.current, { opacity: 0, y: 30, scale: 0.95 });
    gsap.set(valueRef.current, { opacity: 0 });
    if (iconRef.current) {
      gsap.set(iconRef.current, { opacity: 0, scale: 0.8, rotation: -10 });
    }

    // Entrance animation
    const tl = gsap.timeline({ delay });
    
    tl.to(cardRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      ease: "back.out(1.2)"
    })
    .to(valueRef.current, {
      opacity: 1,
      duration: 0.4
    }, "-=0.2")
    .to(iconRef.current, {
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.5)"
    }, "-=0.3");

    // Animate number counting
    const numericValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/\D/g, ''));
    if (!isNaN(numericValue) && valueRef.current) {
      gsap.fromTo(valueRef.current, 
        { innerHTML: 0 },
        {
          innerHTML: numericValue,
          duration: 1.5,
          delay: delay + 0.3,
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

    // Hover animations
    const handleMouseEnter = () => {
      gsap.to(cardRef.current, {
        y: -5,
        scale: 1.02,
        duration: 0.3,
        ease: "power2.out"
      });
      
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          rotation: 10,
          scale: 1.1,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    };

    const handleMouseLeave = () => {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "power2.out"
      });
      
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          rotation: 0,
          scale: 1,
          duration: 0.3,
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
        "relative overflow-hidden border transition-all duration-300 hover:shadow-lg bg-gradient-to-br",
        colorMappings[color],
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
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
          className="text-3xl font-bold tracking-tight"
        >
          {typeof value === 'number' ? 0 : value}
        </div>
        
        {(description || trend !== 'neutral') && (
          <div className="flex items-center justify-between mt-3">
            {description && (
              <p className="text-xs text-muted-foreground flex-1">
                {description}
              </p>
            )}
            
            {trend !== 'neutral' && trendValue && (
              <div className={cn(
                "flex items-center text-xs font-medium",
                trend === 'up' ? 'text-green-600' : 'text-red-600'
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
        
        {/* Progress bar for visual appeal */}
        <div className="mt-3">
          <div className="w-full bg-black/5 rounded-full h-1.5">
            <div 
              className={cn(
                "h-1.5 rounded-full transition-all duration-1000 delay-500",
                color === 'blue' && 'bg-blue-500',
                color === 'green' && 'bg-green-500',
                color === 'purple' && 'bg-purple-500',
                color === 'orange' && 'bg-orange-500'
              )}
              style={{ 
                width: `${Math.min(Math.max((typeof value === 'number' ? value : 50) / 500 * 100, 20), 85)}%` 
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedStatCard; 