import { logger } from './Logger';
import { Entity } from './EntityService';
import { Relationship } from './RelationshipService';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
}

export class CacheService {
  private static instance: CacheService;
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  // Separate caches for different data types
  private entityCache = new Map<string, CacheEntry<Entity>>();
  private entitiesListCache = new Map<string, CacheEntry<Entity[]>>();
  private relationshipCache = new Map<string, CacheEntry<Relationship[]>>();
  private graphDataCache = new Map<string, CacheEntry<{ nodes: Entity[], links: Relationship[] }>>();

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0
  };

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  constructor() {
    // Start cleanup interval
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanup();
      }, this.CLEANUP_INTERVAL);
    }
  }

  // Entity caching
  getEntity(projectId: string, entityId: string): Entity | null {
    const key = `${projectId}:entity:${entityId}`;
    return this.get(this.entityCache, key);
  }

  setEntity(projectId: string, entityId: string, entity: Entity, ttl = this.DEFAULT_TTL): void {
    const key = `${projectId}:entity:${entityId}`;
    this.set(this.entityCache, key, entity, ttl);
  }

  invalidateEntity(projectId: string, entityId: string): void {
    const key = `${projectId}:entity:${entityId}`;
    this.entityCache.delete(key);
    
    // Also invalidate related caches
    this.invalidateEntitiesList(projectId);
    this.invalidateGraphData(projectId);
    
    logger.debug('Invalidated entity cache', { projectId, entityId });
  }

  // Entities list caching
  getEntitiesList(projectId: string, type?: string): Entity[] | null {
    const key = type ? `${projectId}:entities:${type}` : `${projectId}:entities:all`;
    return this.get(this.entitiesListCache, key);
  }

  setEntitiesList(projectId: string, entities: Entity[], type?: string, ttl = this.DEFAULT_TTL): void {
    const key = type ? `${projectId}:entities:${type}` : `${projectId}:entities:all`;
    this.set(this.entitiesListCache, key, entities, ttl);
  }

  invalidateEntitiesList(projectId: string, type?: string): void {
    if (type) {
      const key = `${projectId}:entities:${type}`;
      this.entitiesListCache.delete(key);
    } else {
      // Invalidate all entity lists for this project
      for (const key of this.entitiesListCache.keys()) {
        if (key.startsWith(`${projectId}:entities:`)) {
          this.entitiesListCache.delete(key);
        }
      }
    }
    
    logger.debug('Invalidated entities list cache', { projectId, type });
  }

  // Relationships caching
  getRelationships(projectId: string, filters: string = 'all'): Relationship[] | null {
    const key = `${projectId}:relationships:${filters}`;
    return this.get(this.relationshipCache, key);
  }

  setRelationships(projectId: string, relationships: Relationship[], filters: string = 'all', ttl = this.DEFAULT_TTL): void {
    const key = `${projectId}:relationships:${filters}`;
    this.set(this.relationshipCache, key, relationships, ttl);
  }

  invalidateRelationships(projectId: string): void {
    // Invalidate all relationship caches for this project
    for (const key of this.relationshipCache.keys()) {
      if (key.startsWith(`${projectId}:relationships:`)) {
        this.relationshipCache.delete(key);
      }
    }
    
    // Also invalidate graph data
    this.invalidateGraphData(projectId);
    
    logger.debug('Invalidated relationships cache', { projectId });
  }

  // Graph data caching (most expensive operation)
  getGraphData(projectId: string): { nodes: Entity[], links: Relationship[] } | null {
    const key = `${projectId}:graph:all`;
    return this.get(this.graphDataCache, key);
  }

  setGraphData(projectId: string, data: { nodes: Entity[], links: Relationship[] }, ttl = this.DEFAULT_TTL): void {
    const key = `${projectId}:graph:all`;
    this.set(this.graphDataCache, key, data, ttl);
  }

  invalidateGraphData(projectId: string): void {
    const key = `${projectId}:graph:all`;
    this.graphDataCache.delete(key);
    
    logger.debug('Invalidated graph data cache', { projectId });
  }

  // Project-level invalidation
  invalidateProject(projectId: string): void {
    // Clear all caches for this project
    this.invalidateAllCachesForProject(projectId);
    
    logger.info('Invalidated all caches for project', { projectId });
  }

  // Generic cache operations
  private get<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if entry is expired
    if (now - entry.timestamp > this.DEFAULT_TTL) {
      cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;
    
    return entry.data;
  }

  private set<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    const now = Date.now();
    
    // Check cache size and evict if necessary
    if (cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU(cache);
    }

    cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    });
  }

  // Evict least recently used entries
  private evictLRU<T>(cache: Map<string, CacheEntry<T>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
      logger.debug('Evicted LRU cache entry', { key: oldestKey });
    }
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let totalRemoved = 0;

    const cleanupCache = <T>(cache: Map<string, CacheEntry<T>>, cacheName: string) => {
      let removed = 0;
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > this.DEFAULT_TTL) {
          cache.delete(key);
          removed++;
        }
      }
      if (removed > 0) {
        logger.debug(`Cleaned up ${removed} expired entries from ${cacheName} cache`);
      }
      return removed;
    };

    totalRemoved += cleanupCache(this.entityCache, 'entity');
    totalRemoved += cleanupCache(this.entitiesListCache, 'entitiesList');
    totalRemoved += cleanupCache(this.relationshipCache, 'relationship');
    totalRemoved += cleanupCache(this.graphDataCache, 'graphData');

    if (totalRemoved > 0) {
      logger.debug('Cache cleanup completed', { totalRemoved });
    }
  }

  // Clear specific cache types
  private invalidateAllCachesForProject(projectId: string): void {
    const clearCacheForProject = <T>(cache: Map<string, CacheEntry<T>>) => {
      for (const key of cache.keys()) {
        if (key.startsWith(`${projectId}:`)) {
          cache.delete(key);
        }
      }
    };

    clearCacheForProject(this.entityCache);
    clearCacheForProject(this.entitiesListCache);
    clearCacheForProject(this.relationshipCache);
    clearCacheForProject(this.graphDataCache);
  }

  // Cache statistics
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      totalEntries: this.entityCache.size + this.entitiesListCache.size + 
                   this.relationshipCache.size + this.graphDataCache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses
    };
  }

  // Clear all caches
  clearAll(): void {
    this.entityCache.clear();
    this.entitiesListCache.clear();
    this.relationshipCache.clear();
    this.graphDataCache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    
    logger.info('Cleared all caches');
  }
}

export const cacheService = CacheService.getInstance(); 