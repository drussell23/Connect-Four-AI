/**
 * 🧠 Smart LRU + TTL Cache
 * 
 * Advanced caching with Least Recently Used eviction,
 * Time-To-Live expiration, and dynamic sizing
 */

import { Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  size?: number; // Optional size in bytes
}

export interface SmartCacheConfig {
  maxSize: number;
  ttlMs: number;
  maxMemoryMB?: number;
  enableCompression?: boolean;
  shrinkFactor?: number; // How much to shrink under pressure (0.5 = 50%)
  minSize?: number; // Minimum size to maintain
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
  avgAccessTime: number;
  memoryUsageMB: number;
}

export class SmartLRUTTLCache<K, V> {
  private readonly logger: Logger;
  private cache: Map<K, CacheEntry<V>> = new Map();
  private accessOrder: K[] = []; // Track access order for LRU
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout;
  private originalMaxSize: number;
  private estimatedMemoryBytes = 0;

  constructor(
    private config: SmartCacheConfig,
    private name: string = 'SmartCache',
    private eventEmitter?: EventEmitter2
  ) {
    this.logger = new Logger(`SmartCache:${name}`);
    this.originalMaxSize = config.maxSize;
    this.stats = this.initializeStats();
    
    // Start periodic cleanup
    this.startCleanupTimer();
    
    // Setup event listeners if event emitter provided
    if (eventEmitter) {
      this.setupEventListeners();
    }
    
    this.logger.log(`Initialized with maxSize: ${config.maxSize}, TTL: ${config.ttlMs}ms`);
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }
    
    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    
    // Update LRU order
    this.updateAccessOrder(key);
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V, customTTL?: number): void {
    // Check if we need to evict
    if (!this.cache.has(key) && this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    // Estimate size if not provided
    const size = this.estimateSize(value);
    
    // Check memory limit
    if (this.config.maxMemoryMB) {
      const newMemoryMB = (this.estimatedMemoryBytes + size) / 1024 / 1024;
      if (newMemoryMB > this.config.maxMemoryMB) {
        this.evictUntilMemoryAvailable(size);
      }
    }
    
    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      size
    };
    
    // Remove old entry's memory if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry?.size) {
      this.estimatedMemoryBytes -= oldEntry.size;
    }
    
    this.cache.set(key, entry);
    this.estimatedMemoryBytes += size;
    this.updateAccessOrder(key);
  }

  /**
   * Delete entry from cache
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.size) {
        this.estimatedMemoryBytes -= entry.size;
      }
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.estimatedMemoryBytes = 0;
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    return {
      ...this.stats,
      currentSize: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      memoryUsageMB: this.estimatedMemoryBytes / 1024 / 1024
    };
  }

  /**
   * Shrink cache by factor
   */
  shrink(factor: number = 0.5): void {
    const targetSize = Math.max(
      Math.floor(this.config.maxSize * factor),
      this.config.minSize || 10
    );
    
    this.logger.warn(`Shrinking cache from ${this.config.maxSize} to ${targetSize}`);
    
    this.config.maxSize = targetSize;
    
    // Evict entries until we meet new size
    while (this.cache.size > targetSize) {
      this.evictLRU();
    }
  }

  /**
   * Restore cache to original size
   */
  restore(): void {
    if (this.config.maxSize < this.originalMaxSize) {
      this.logger.log(`Restoring cache size to ${this.originalMaxSize}`);
      this.config.maxSize = this.originalMaxSize;
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    return Date.now() - entry.timestamp > this.config.ttlMs;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: K): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    this.stats.evictions++;
    
    this.logger.debug(`Evicted LRU entry with key: ${String(lruKey)}`);
  }

  /**
   * Evict entries until memory is available
   */
  private evictUntilMemoryAvailable(requiredBytes: number): void {
    const maxMemoryBytes = (this.config.maxMemoryMB || 100) * 1024 * 1024;
    
    while (this.estimatedMemoryBytes + requiredBytes > maxMemoryBytes && this.accessOrder.length > 0) {
      this.evictLRU();
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: V): number {
    // Simple estimation - can be overridden for specific types
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per char
    } else if (Array.isArray(value)) {
      return value.length * 8; // Assume 8 bytes per element
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).length * 2;
    }
    return 8; // Default size
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.stats.expirations += expiredCount;
      this.logger.debug(`Cleaned up ${expiredCount} expired entries`);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup at 1/10 of TTL interval
    const interval = Math.max(this.config.ttlMs / 10, 1000);
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      currentSize: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      avgAccessTime: 0,
      memoryUsageMB: 0
    };
  }

  /**
   * Setup event listeners for dynamic sizing
   */
  private setupEventListeners(): void {
    if (!this.eventEmitter) return;

    // Listen for cache resize events
    this.eventEmitter.on(`cache.resize.${this.name}`, ({ factor }: { factor: number }) => {
      this.shrink(factor);
    });

    // Listen for cache clear events
    this.eventEmitter.on(`cache.clear.${this.name}`, () => {
      this.clear();
    });

    // Listen for cache restore events
    this.eventEmitter.on(`cache.restore.${this.name}`, () => {
      this.restore();
    });

    // Listen for global resize events
    this.eventEmitter.on('cache.resize', ({ factor }: { factor: number }) => {
      this.shrink(factor);
    });

    // Listen for global clear events
    this.eventEmitter.on('cache.clear.all', () => {
      this.clear();
    });
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.logger.log('Cache destroyed');
  }
}

/**
 * Factory for creating specialized caches
 */
export class SmartCacheFactory {
  static createPredictionCache(
    maxSize: number = 1000,
    ttlMs: number = 300000, // 5 minutes
    eventEmitter?: EventEmitter2
  ): SmartLRUTTLCache<string, number[]> {
    return new SmartLRUTTLCache<string, number[]>(
      {
        maxSize,
        ttlMs,
        maxMemoryMB: 50, // 50MB max for predictions
        shrinkFactor: 0.5,
        minSize: 100
      },
      'prediction',
      eventEmitter
    );
  }

  static createHistoryCache(
    maxSize: number = 500,
    ttlMs: number = 600000, // 10 minutes
    eventEmitter?: EventEmitter2
  ): SmartLRUTTLCache<string, any> {
    return new SmartLRUTTLCache<string, any>(
      {
        maxSize,
        ttlMs,
        maxMemoryMB: 100, // 100MB max for history
        shrinkFactor: 0.3, // More aggressive shrinking
        minSize: 50
      },
      'history',
      eventEmitter
    );
  }

  static createTranspositionTable(
    maxSize: number = 50000,
    ttlMs: number = 1800000, // 30 minutes
    eventEmitter?: EventEmitter2
  ): SmartLRUTTLCache<string, any> {
    return new SmartLRUTTLCache<string, any>(
      {
        maxSize,
        ttlMs,
        maxMemoryMB: 200, // 200MB max
        shrinkFactor: 0.4,
        minSize: 1000
      },
      'transposition',
      eventEmitter
    );
  }
}