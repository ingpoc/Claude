"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Database, 
  RefreshCw, 
  Zap,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
}

interface PerformanceMetrics {
  cacheStats: CacheStats;
  lastUpdated: string;
}

export interface PerformanceMonitorProps {
  projectId?: string;
  refreshInterval?: number;
  showDetails?: boolean;
  className?: string;
}

export function PerformanceMonitor({
  projectId,
  refreshInterval = 10000, // 10 seconds
  showDetails = false,
  className
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ui/cache/stats');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const cacheStats = await response.json();
      setMetrics({
        cacheStats,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  if (error) {
    return (
      <Card className={cn("border-destructive", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <Activity className="w-4 h-4" />
            Performance Monitor - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMetrics} 
            className="mt-2"
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", isLoading && "animate-spin")} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { cacheStats } = metrics;
  const hitRateGood = cacheStats.hitRate > 0.7;
  const hitRateOk = cacheStats.hitRate > 0.5;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance Monitor
              {projectId && (
                <Badge variant="secondary" className="text-xs">
                  {projectId.slice(0, 8)}...
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchMetrics} 
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cache Hit Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" />
              Cache Hit Rate
            </div>
            <div className="flex items-center gap-1">
              {hitRateGood ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : hitRateOk ? (
                <BarChart3 className="w-3 h-3 text-yellow-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={cn(
                "font-medium",
                hitRateGood ? "text-green-600" : 
                hitRateOk ? "text-yellow-600" : "text-red-600"
              )}>
                {formatPercentage(cacheStats.hitRate)}
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                hitRateGood ? "bg-green-500" : 
                hitRateOk ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${cacheStats.hitRate * 100}%` }}
            />
          </div>
        </div>

        {/* Cache Statistics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Database className="w-3 h-3" />
              Cached Items
            </div>
            <div className="font-medium">{formatNumber(cacheStats.totalEntries)}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              Total Requests
            </div>
            <div className="font-medium">
              {formatNumber(cacheStats.totalHits + cacheStats.totalMisses)}
            </div>
          </div>
        </div>

        {/* Detailed Statistics */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground">Detailed Stats</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cache Hits:</span>
                <span className="font-medium text-green-600">
                  {formatNumber(cacheStats.totalHits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cache Misses:</span>
                <span className="font-medium text-red-600">
                  {formatNumber(cacheStats.totalMisses)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Miss Rate:</span>
                <span className="font-medium">
                  {formatPercentage(cacheStats.missRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efficiency:</span>
                <Badge 
                  variant={hitRateGood ? "default" : hitRateOk ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {hitRateGood ? "Excellent" : hitRateOk ? "Good" : "Poor"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tips */}
        {!hitRateGood && (
          <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
            💡 Tip: Low cache hit rate detected. Consider clearing cache or optimizing query patterns.
          </div>
        )}
      </CardContent>
    </Card>
  );
} 