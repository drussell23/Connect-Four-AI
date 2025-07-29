// backend/src/ai/async/request-batcher.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface BatchRequest<T, R> {
  id: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
}

export interface BatcherOptions {
  maxBatchSize?: number;
  maxLatency?: number;
  maxQueueSize?: number;
  priorityLevels?: number;
  onBatchProcess?: (batch: any[]) => void;
  onQueueFull?: () => void;
}

export interface QueueStats {
  pending: number;
  processing: number;
  processed: number;
  failed: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  queueUtilization: number;
}

@Injectable()
export class RequestBatcher {
  private readonly logger = new Logger(RequestBatcher.name);
  private readonly batchers = new Map<string, BatcherInstance<any, any>>();
  
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Create a batcher for a specific operation
   */
  create<T, R>(
    name: string,
    batchProcessor: (items: T[]) => Promise<R[]>,
    options: BatcherOptions = {}
  ): (data: T, priority?: number) => Promise<R> {
    if (!this.batchers.has(name)) {
      this.batchers.set(name, new BatcherInstance(
        name,
        batchProcessor,
        options,
        this.eventEmitter,
        this.logger
      ));
    }

    const batcher = this.batchers.get(name)! as BatcherInstance<T, R>;
    
    return (data: T, priority: number = 5) => batcher.add(data, priority);
  }

  /**
   * Create a priority queue for processing requests
   */
  createPriorityQueue<T, R>(
    name: string,
    processor: (item: T) => Promise<R>,
    options: {
      concurrency?: number;
      maxQueueSize?: number;
      timeout?: number;
    } = {}
  ): {
    enqueue: (data: T, priority?: number) => Promise<R>;
    getStats: () => QueueStats;
    pause: () => void;
    resume: () => void;
  } {
    const queue = new PriorityQueue(
      name,
      processor,
      options,
      this.eventEmitter,
      this.logger
    );

    return {
      enqueue: (data: T, priority?: number) => queue.enqueue(data, priority),
      getStats: () => queue.getStats(),
      pause: () => queue.pause(),
      resume: () => queue.resume()
    };
  }

  /**
   * Get statistics for all batchers
   */
  getStats(name?: string): Map<string, QueueStats> | QueueStats | null {
    if (name) {
      const batcher = this.batchers.get(name);
      return batcher ? batcher.getStats() : null;
    }

    const stats = new Map<string, QueueStats>();
    for (const [name, batcher] of this.batchers) {
      stats.set(name, batcher.getStats());
    }
    return stats;
  }

  /**
   * Flush pending requests in a batcher
   */
  async flush(name: string): Promise<void> {
    const batcher = this.batchers.get(name);
    if (batcher) {
      await batcher.flush();
    }
  }
}

class BatcherInstance<T, R> {
  private queue: BatchRequest<T, R>[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private stats = {
    processed: 0,
    failed: 0,
    totalBatches: 0,
    totalProcessingTime: 0
  };

  private readonly maxBatchSize: number;
  private readonly maxLatency: number;
  private readonly maxQueueSize: number;
  private readonly onBatchProcess?: (batch: any[]) => void;
  private readonly onQueueFull?: () => void;

  constructor(
    private readonly name: string,
    private readonly batchProcessor: (items: T[]) => Promise<R[]>,
    options: BatcherOptions,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger
  ) {
    this.maxBatchSize = options.maxBatchSize || 10;
    this.maxLatency = options.maxLatency || 50;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.onBatchProcess = options.onBatchProcess;
    this.onQueueFull = options.onQueueFull;
  }

  async add(data: T, priority: number = 5): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.maxQueueSize) {
        this.eventEmitter.emit('batcher.queueFull', { name: this.name });
        if (this.onQueueFull) {
          this.onQueueFull();
        }
        reject(new Error(`Queue full for batcher ${this.name}`));
        return;
      }

      // Add to queue
      const request: BatchRequest<T, R> = {
        id: `${Date.now()}-${Math.random()}`,
        data,
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      };

      this.queue.push(request);
      
      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.eventEmitter.emit('batcher.enqueue', {
        name: this.name,
        queueSize: this.queue.length,
        priority
      });

      // Schedule processing
      this.scheduleProcessing();
    });
  }

  private scheduleProcessing(): void {
    // If already processing or timer is set, don't schedule
    if (this.processing || this.timer) return;

    // If we have enough items, process immediately
    if (this.queue.length >= this.maxBatchSize) {
      this.processBatch();
      return;
    }

    // Otherwise, schedule processing after maxLatency
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processBatch();
    }, this.maxLatency);
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    
    // Clear any pending timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Get batch
    const batchSize = Math.min(this.queue.length, this.maxBatchSize);
    const batch = this.queue.splice(0, batchSize);
    
    const startTime = Date.now();
    
    try {
      // Process batch
      const items = batch.map(req => req.data);
      
      if (this.onBatchProcess) {
        this.onBatchProcess(items);
      }

      this.eventEmitter.emit('batcher.processing', {
        name: this.name,
        batchSize: batch.length,
        remainingQueue: this.queue.length
      });

      const results = await this.batchProcessor(items);
      
      // Resolve individual promises
      batch.forEach((req, index) => {
        if (index < results.length) {
          req.resolve(results[index]);
          this.stats.processed++;
        } else {
          req.reject(new Error('No result for request'));
          this.stats.failed++;
        }
      });

      // Update stats
      this.stats.totalBatches++;
      this.stats.totalProcessingTime += Date.now() - startTime;

      this.eventEmitter.emit('batcher.processed', {
        name: this.name,
        batchSize: batch.length,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      // Reject all requests in batch
      batch.forEach(req => {
        req.reject(error);
        this.stats.failed++;
      });

      this.logger.error(`Batch processing failed for ${this.name}:`, error);
      
      this.eventEmitter.emit('batcher.error', {
        name: this.name,
        error: error.message,
        batchSize: batch.length
      });
    } finally {
      this.processing = false;
      
      // Schedule next batch if queue is not empty
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      if (!this.processing && this.queue.length > 0) {
        await this.processBatch();
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  getStats(): QueueStats {
    const avgBatchSize = this.stats.totalBatches > 0
      ? this.stats.processed / this.stats.totalBatches
      : 0;
    
    const avgProcessingTime = this.stats.totalBatches > 0
      ? this.stats.totalProcessingTime / this.stats.totalBatches
      : 0;

    return {
      pending: this.queue.length,
      processing: this.processing ? 1 : 0,
      processed: this.stats.processed,
      failed: this.stats.failed,
      avgBatchSize,
      avgProcessingTime,
      queueUtilization: this.queue.length / this.maxQueueSize
    };
  }
}

class PriorityQueue<T, R> {
  private queue: Array<{
    data: T;
    priority: number;
    resolve: (result: R) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  
  private processing = 0;
  private paused = false;
  private stats = {
    processed: 0,
    failed: 0,
    totalProcessingTime: 0
  };

  private readonly concurrency: number;
  private readonly maxQueueSize: number;
  private readonly timeout: number;

  constructor(
    private readonly name: string,
    private readonly processor: (item: T) => Promise<R>,
    options: {
      concurrency?: number;
      maxQueueSize?: number;
      timeout?: number;
    },
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger
  ) {
    this.concurrency = options.concurrency || 3;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.timeout = options.timeout || 30000;
  }

  async enqueue(data: T, priority: number = 5): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error(`Queue full for ${this.name}`));
        return;
      }

      this.queue.push({
        data,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Sort by priority (higher first) and timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.eventEmitter.emit('queue.enqueue', {
        name: this.name,
        queueSize: this.queue.length,
        priority
      });

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.paused || this.processing >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift()!;
    this.processing++;

    const startTime = Date.now();
    
    // Set timeout
    const timeoutHandle = setTimeout(() => {
      item.reject(new Error(`Processing timeout after ${this.timeout}ms`));
      this.processing--;
      this.stats.failed++;
      this.processNext();
    }, this.timeout);

    try {
      const result = await this.processor(item.data);
      clearTimeout(timeoutHandle);
      
      item.resolve(result);
      this.stats.processed++;
      this.stats.totalProcessingTime += Date.now() - startTime;

      this.eventEmitter.emit('queue.processed', {
        name: this.name,
        processingTime: Date.now() - startTime,
        remainingQueue: this.queue.length
      });

    } catch (error) {
      clearTimeout(timeoutHandle);
      item.reject(error);
      this.stats.failed++;

      this.eventEmitter.emit('queue.error', {
        name: this.name,
        error: error.message
      });
    } finally {
      this.processing--;
      this.processNext();
    }
  }

  pause(): void {
    this.paused = true;
    this.eventEmitter.emit('queue.paused', { name: this.name });
  }

  resume(): void {
    this.paused = false;
    this.eventEmitter.emit('queue.resumed', { name: this.name });
    
    // Process any pending items
    for (let i = 0; i < this.concurrency - this.processing; i++) {
      this.processNext();
    }
  }

  getStats(): QueueStats {
    const avgProcessingTime = this.stats.processed > 0
      ? this.stats.totalProcessingTime / this.stats.processed
      : 0;

    return {
      pending: this.queue.length,
      processing: this.processing,
      processed: this.stats.processed,
      failed: this.stats.failed,
      avgBatchSize: 1,
      avgProcessingTime,
      queueUtilization: this.queue.length / this.maxQueueSize
    };
  }
}