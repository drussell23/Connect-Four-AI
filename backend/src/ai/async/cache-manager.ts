// backend/src/ai/async/cache-manager.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  computeTime: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  avgComputeTime: number;
  memoryUsage: number;
  entries: number;
}

export interface MemoizationOptions {
  ttl?: number;
  maxSize?: number;
  keyGenerator?: (...args: any[]) => string;
  onEvict?: (key: string, value: any) => void;
  shouldCache?: (result: any) => boolean;
}

@Injectable()
export class AsyncCacheManager {
  private readonly logger = new Logger(AsyncCacheManager.name);
  private readonly caches = new Map<string, Map<string, CacheEntry<any>>>();
  private readonly stats = new Map<string, CacheStats>();
  private readonly pendingComputes = new Map<string, Promise<any>>();
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeCleanupInterval();
  }

  /**
   * Create a memoized version of an async function
   */
  memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    namespace: string,
    options: MemoizationOptions = {}
  ): T {
    const {
      ttl = 300000, // 5 minutes default
      maxSize = 1000,
      keyGenerator = this.defaultKeyGenerator,
      onEvict,
      shouldCache = () => true
    } = options;

    // Initialize cache for namespace
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map());
      this.stats.set(namespace, {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
        avgComputeTime: 0,
        memoryUsage: 0,
        entries: 0
      });
    }

    const cache = this.caches.get(namespace)!;
    const stats = this.stats.get(namespace)!;

    return (async (...args: any[]) => {
      const key = keyGenerator(...args);
      const cacheKey = `${namespace}:${key}`;

      // Check if computation is already in progress
      if (this.pendingComputes.has(cacheKey)) {
        this.logger.debug(`Waiting for pending computation: ${cacheKey}`);
        return this.pendingComputes.get(cacheKey);
      }

      // Check cache
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        stats.hits++;
        cached.hits++;
        this.updateHitRate(namespace);
        
        this.eventEmitter.emit('cache.hit', {
          namespace,
          key,
          hits: cached.hits,
          age: Date.now() - cached.timestamp
        });

        return cached.value;
      }

      // Cache miss
      stats.misses++;
      this.updateHitRate(namespace);

      this.eventEmitter.emit('cache.miss', { namespace, key });

      // Compute value
      const startTime = Date.now();
      const computePromise = fn(...args);
      
      // Store pending computation to prevent duplicate work
      this.pendingComputes.set(cacheKey, computePromise);

      try {
        const result = await computePromise;
        const computeTime = Date.now() - startTime;

        // Update average compute time
        stats.avgComputeTime = 
          (stats.avgComputeTime * stats.entries + computeTime) / 
          (stats.entries + 1);

        // Check if we should cache this result
        if (shouldCache(result)) {
          // Enforce size limit
          if (cache.size >= maxSize) {
            this.evictLRU(namespace, onEvict);
          }

          // Store in cache
          const entry: CacheEntry<typeof result> = {
            value: result,
            timestamp: Date.now(),
            ttl,
            hits: 1,
            computeTime,
            size: this.estimateSize(result)
          };

          cache.set(key, entry);
          stats.entries = cache.size;
          stats.memoryUsage += entry.size;

          this.eventEmitter.emit('cache.set', {
            namespace,
            key,
            computeTime,
            size: entry.size
          });
        }

        return result;
      } catch (error) {
        this.logger.error(`Computation failed for ${cacheKey}:`, error);
        throw error;
      } finally {
        // Remove from pending computes
        this.pendingComputes.delete(cacheKey);
      }
    }) as T;
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(namespace: string, keyPattern?: string): Promise<void> {
    const cache = this.caches.get(namespace);
    if (!cache) return;

    if (keyPattern) {
      // Invalidate matching keys
      const regex = new RegExp(keyPattern);
      const keysToDelete: string[] = [];
      
      for (const [key] of cache) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => cache.delete(key));
      
      this.eventEmitter.emit('cache.invalidate', {
        namespace,
        pattern: keyPattern,
        count: keysToDelete.length
      });
    } else {
      // Clear entire namespace
      const count = cache.size;
      cache.clear();
      
      this.eventEmitter.emit('cache.clear', { namespace, count });
    }

    // Reset stats
    const stats = this.stats.get(namespace);
    if (stats) {
      stats.entries = cache.size;
      stats.memoryUsage = 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(namespace?: string): CacheStats | Map<string, CacheStats> {
    if (namespace) {
      return this.stats.get(namespace) || this.createEmptyStats();
    }
    return new Map(this.stats);
  }

  /**
   * Preload cache with computed values
   */
  async preload<T>(
    namespace: string,
    items: Array<{ key: string; compute: () => Promise<T> }>,
    options: { ttl?: number; parallel?: boolean } = {}
  ): Promise<void> {
    const { ttl = 300000, parallel = true } = options;
    const cache = this.caches.get(namespace) || new Map();
    
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, cache);
    }

    const computeItem = async (item: { key: string; compute: () => Promise<T> }) => {
      try {
        const startTime = Date.now();
        const value = await item.compute();
        const computeTime = Date.now() - startTime;

        const entry: CacheEntry<T> = {
          value,
          timestamp: Date.now(),
          ttl,
          hits: 0,
          computeTime,
          size: this.estimateSize(value)
        };

        cache.set(item.key, entry);
        
        this.logger.log(`Preloaded ${namespace}:${item.key} in ${computeTime}ms`);
      } catch (error) {
        this.logger.error(`Failed to preload ${namespace}:${item.key}:`, error);
      }
    };

    if (parallel) {
      await Promise.all(items.map(computeItem));
    } else {
      for (const item of items) {
        await computeItem(item);
      }
    }

    this.eventEmitter.emit('cache.preload', {
      namespace,
      count: items.length,
      parallel
    });
  }

  /**
   * Batch get multiple cache entries
   */
  async batchGet<T>(
    namespace: string,
    keys: string[]
  ): Promise<Map<string, T | null>> {
    const cache = this.caches.get(namespace);
    const results = new Map<string, T | null>();

    if (!cache) {
      keys.forEach(key => results.set(key, null));
      return results;
    }

    for (const key of keys) {
      const entry = cache.get(key);
      if (entry && Date.now() - entry.timestamp < entry.ttl) {
        entry.hits++;
        results.set(key, entry.value);
      } else {
        results.set(key, null);
      }
    }

    return results;
  }

  /**
   * Warm up cache by computing frequently accessed values
   */
  async warmup(
    namespace: string,
    generator: () => AsyncGenerator<{ key: string; compute: () => Promise<any> }>,
    options: { maxItems?: number; ttl?: number } = {}
  ): Promise<void> {
    const { maxItems = 100, ttl = 600000 } = options;
    const items: Array<{ key: string; compute: () => Promise<any> }> = [];

    let count = 0;
    for await (const item of generator()) {
      items.push(item);
      count++;
      if (count >= maxItems) break;
    }

    await this.preload(namespace, items, { ttl, parallel: true });
    
    this.logger.log(`Warmed up ${namespace} cache with ${items.length} entries`);
  }

  private evictLRU(namespace: string, onEvict?: (key: string, value: any) => void): void {
    const cache = this.caches.get(namespace);
    if (!cache || cache.size === 0) return;

    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTimestamp = Infinity;
    let lruHits = Infinity;

    for (const [key, entry] of cache) {
      const lastAccess = entry.timestamp + (entry.hits * 1000); // Factor in hits
      if (lastAccess < lruTimestamp || (lastAccess === lruTimestamp && entry.hits < lruHits)) {
        lruKey = key;
        lruTimestamp = lastAccess;
        lruHits = entry.hits;
      }
    }

    if (lruKey) {
      const entry = cache.get(lruKey);
      cache.delete(lruKey);
      
      const stats = this.stats.get(namespace);
      if (stats) {
        stats.evictions++;
        stats.memoryUsage -= entry?.size || 0;
        stats.entries = cache.size;
      }

      if (onEvict && entry) {
        onEvict(lruKey, entry.value);
      }

      this.eventEmitter.emit('cache.evict', {
        namespace,
        key: lruKey,
        reason: 'lru',
        hits: entry?.hits || 0
      });
    }
  }

  private updateHitRate(namespace: string): void {
    const stats = this.stats.get(namespace);
    if (stats) {
      const total = stats.hits + stats.misses;
      stats.hitRate = total > 0 ? stats.hits / total : 0;
    }
  }

  private defaultKeyGenerator(...args: any[]): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(args))
      .digest('hex');
  }

  private estimateSize(obj: any): number {
    // Simple size estimation
    const str = JSON.stringify(obj);
    return str ? str.length * 2 : 0; // Rough estimate in bytes
  }

  private createEmptyStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      avgComputeTime: 0,
      memoryUsage: 0,
      entries: 0
    };
  }

  private getTotalMemoryUsage(): number {
    let total = 0;
    for (const stats of this.stats.values()) {
      total += stats.memoryUsage;
    }
    return total;
  }

  private initializeCleanupInterval(): void {
    // Clean up expired entries every 30 seconds (more frequent)
    setInterval(() => {
      const totalMemory = this.getTotalMemoryUsage();
      const maxMemory = 200 * 1024 * 1024; // 200MB max for cache
      
      for (const [namespace, cache] of this.caches) {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of cache) {
          // Remove expired entries
          if (now - entry.timestamp > entry.ttl) {
            keysToDelete.push(key);
          }
          // Also remove old entries if memory is high
          else if (totalMemory > maxMemory * 0.8 && now - entry.timestamp > entry.ttl / 2) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach(key => {
          const entry = cache.get(key);
          cache.delete(key);
          
          const stats = this.stats.get(namespace);
          if (stats && entry) {
            stats.memoryUsage -= entry.size;
            stats.entries = cache.size;
          }
        });

        if (keysToDelete.length > 0) {
          this.logger.debug(`Cleaned up ${keysToDelete.length} expired entries from ${namespace}`);
        }
      }
    }, 30000); // Reduced from 60 seconds to 30 seconds
  }
}