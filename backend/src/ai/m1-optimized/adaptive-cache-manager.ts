/**
 * 💾 Adaptive Cache Manager
 * 
 * Intelligent caching system that dynamically adjusts size
 * based on available memory and usage patterns
 */

import { Logger } from '@nestjs/common';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';

interface CacheEntry<T> {
  value: T;
  hits: number;
  lastAccess: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
  memoryUsageMB: number;
}

export class AdaptiveCacheManager<T = any> {
  private readonly logger = new Logger('AdaptiveCacheManager');
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0,
    maxSize: 0,
    hitRate: 0,
    memoryUsageMB: 0
  };
  
  private maxSize: number;
  private readonly ttl: number;
  private readonly adaptiveResize: boolean;
  private resizeCheckInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(
    private readonly name: string,
    initialMaxSize?: number,
    options: {
      ttl?: number;
      adaptiveResize?: boolean;
      cleanupIntervalMs?: number;
      resizeIntervalMs?: number;
    } = {}
  ) {
    // Get recommended cache size based on system
    const config = M1PerformanceOptimizer.getOptimizationConfig();
    const recommendedSize = config.recommendedSettings.cacheMaxSize;
    
    // Enforce 50k limit for M1 Macs
    const maxAllowed = config.isM1Architecture ? 50000 : 100000;
    this.maxSize = Math.min(initialMaxSize || recommendedSize, maxAllowed);
    this.stats.maxSize = this.maxSize;
    
    this.ttl = options.ttl || (config.isM1Architecture ? 300000 : 600000); // 5 or 10 minutes
    this.adaptiveResize = options.adaptiveResize ?? true;
    
    this.logger.log(`Initialized ${name} cache with size: ${this.maxSize}, TTL: ${this.ttl}ms`);
    
    // Start cleanup interval
    const cleanupInterval = options.cleanupIntervalMs || 60000; // 1 minute
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);
    
    // Start adaptive resizing if enabled
    if (this.adaptiveResize) {
      const resizeInterval = options.resizeIntervalMs || 120000; // 2 minutes
      this.resizeCheckInterval = setInterval(() => this.checkAndResize(), resizeInterval);
    }
  }
  
  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check TTL
    if (Date.now() - entry.lastAccess > this.ttl) {
      this.cache.delete(key);
      this.stats.currentSize--;
      this.stats.misses++;
      return undefined;
    }
    
    // Update access info
    entry.hits++;
    entry.lastAccess = Date.now();
    this.stats.hits++;
    
    return entry.value;
  }
  
  /**
   * Set value in cache
   */
  set(key: string, value: T, sizeEstimate: number = 1): void {
    // Check if we need to evict entries
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    const entry: CacheEntry<T> = {
      value,
      hits: 0,
      lastAccess: Date.now(),
      size: sizeEstimate
    };
    
    this.cache.set(key, entry);
    this.stats.currentSize++;
  }
  
  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check TTL
    if (Date.now() - entry.lastAccess > this.ttl) {
      this.cache.delete(key);
      this.stats.currentSize--;
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.currentSize--;
    }
    return deleted;
  }
  
  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.currentSize = 0;
    this.logger.log(`${this.name} cache cleared`);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    this.stats.memoryUsageMB = this.estimateMemoryUsage();
    return { ...this.stats };
  }
  
  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.currentSize--;
      this.stats.evictions++;
    }
  }
  
  /**
   * Evict least frequently used entry
   */
  private evictLFU(): void {
    let leastUsedKey: string | null = null;
    let minHits = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.stats.currentSize--;
      this.stats.evictions++;
    }
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccess > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.stats.currentSize -= removed;
      this.logger.debug(`Cleaned up ${removed} expired entries from ${this.name} cache`);
    }
  }
  
  /**
   * Check memory and resize if needed
   */
  private checkAndResize(): void {
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const memoryPressure = memStats.heapPercentage / 100;
    
    if (memoryPressure > 0.8 && this.maxSize > 50) {
      // High memory pressure - reduce cache
      const newSize = Math.floor(this.maxSize * 0.7);
      this.resize(newSize);
      this.logger.warn(`High memory pressure - reduced ${this.name} cache to ${newSize}`);
    } else if (memoryPressure < 0.5 && this.stats.hitRate > 0.7) {
      // Low memory pressure and good hit rate - can increase
      const config = M1PerformanceOptimizer.getOptimizationConfig();
      const recommendedSize = config.recommendedSettings.cacheMaxSize;
      
      if (this.maxSize < recommendedSize) {
        const newSize = Math.min(Math.floor(this.maxSize * 1.5), recommendedSize);
        this.resize(newSize);
        this.logger.log(`Good performance - increased ${this.name} cache to ${newSize}`);
      }
    }
  }
  
  /**
   * Resize cache
   */
  public resize(newSize: number): void {
    if (newSize === this.maxSize) return;
    
    this.maxSize = newSize;
    this.stats.maxSize = newSize;
    
    // Evict entries if needed
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
  
  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimate based on cache size and entry count
    const avgEntrySize = 1024; // 1KB average per entry
    return (this.cache.size * avgEntrySize) / (1024 * 1024);
  }
  
  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.resizeCheckInterval) {
      clearInterval(this.resizeCheckInterval);
    }
    this.clear();
  }
}

/**
 * Factory for creating specialized caches
 */
export class CacheFactory {
  static createPredictionCache(maxSize?: number): AdaptiveCacheManager<number[]> {
    return new AdaptiveCacheManager('Prediction', maxSize, {
      ttl: 300000, // 5 minutes
      adaptiveResize: true,
      cleanupIntervalMs: 60000
    });
  }
  
  static createTranspositionTable(maxSize?: number): AdaptiveCacheManager<any> {
    return new AdaptiveCacheManager('Transposition', maxSize, {
      ttl: 600000, // 10 minutes
      adaptiveResize: true,
      cleanupIntervalMs: 120000
    });
  }
  
  static createEvaluationCache(maxSize?: number): AdaptiveCacheManager<number> {
    return new AdaptiveCacheManager('Evaluation', maxSize, {
      ttl: 180000, // 3 minutes
      adaptiveResize: true,
      cleanupIntervalMs: 60000
    });
  }
}