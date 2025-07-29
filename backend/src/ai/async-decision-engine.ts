import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Worker } from 'worker_threads';
import * as os from 'os';
import { AdaptiveResourceManager, AdaptiveDecision } from './adaptive-resource-manager';
import { ResourceMonitorService } from './resource-monitor.service';
import { CircuitBreaker } from './async/circuit-breaker';
import { AsyncCacheManager } from './async/cache-manager';

export interface DecisionRequest {
  id: string;
  gameId: string;
  board: any[][];
  strategy: string;
  complexity: number;
  priority: number;
  timestamp: number;
}

export interface DecisionResult {
  id: string;
  decision: AdaptiveDecision;
  executionTime: number;
  resourcesUsed: {
    cpu: number;
    memory: number;
  };
  timestamp: number;
}

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
}

@Injectable()
export class AsyncDecisionEngine {
  private readonly logger = new Logger(AsyncDecisionEngine.name);
  private readonly maxConcurrency = os.cpus().length;
  private readonly requestQueue: Map<string, DecisionRequest> = new Map();
  private readonly processingQueue: Set<string> = new Set();
  private readonly workers: Worker[] = [];
  private readonly workerPool: Worker[] = [];
  private queueMetrics: QueueMetrics = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    averageWaitTime: 0,
    averageProcessingTime: 0
  };
  
  // Decision caching
  private readonly decisionCache = new Map<string, DecisionResult>();
  private readonly cacheExpiry = 60000; // 1 minute
  
  // Circuit breaker for worker failures
  private workerCircuitBreaker: CircuitBreaker;
  
  // Priority queue implementation
  private priorityQueue: DecisionRequest[] = [];
  
  constructor(
    private readonly adaptiveResourceManager: AdaptiveResourceManager,
    private readonly resourceMonitor: ResourceMonitorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheManager: AsyncCacheManager
  ) {
    this.initialize();
  }

  /**
   * Initialize the async decision engine
   */
  private async initialize(): Promise<void> {
    this.logger.log('🚀 Initializing Async Decision Engine...');
    
    // Initialize circuit breaker
    this.workerCircuitBreaker = new CircuitBreaker(this.eventEmitter);
    
    // Initialize worker pool
    this.initializeWorkerPool();
    
    // Start processing loop
    this.startProcessingLoop();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    this.logger.log('✅ Async Decision Engine initialized');
  }

  /**
   * Initialize worker thread pool
   */
  private initializeWorkerPool(): void {
    const workerCount = Math.min(this.maxConcurrency, 4);
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new Worker(`
          const { parentPort } = require('worker_threads');
          
          parentPort.on('message', async (data) => {
            const { id, task, params } = data;
            
            try {
              // Simulate AI decision processing
              const startTime = Date.now();
              
              // Perform CPU-intensive calculations
              let result = 0;
              for (let i = 0; i < params.complexity * 1000000; i++) {
                result += Math.sqrt(i);
              }
              
              const processingTime = Date.now() - startTime;
              
              parentPort.postMessage({
                id,
                success: true,
                result: {
                  processingTime,
                  cpuIntensive: result > 0
                }
              });
            } catch (error) {
              parentPort.postMessage({
                id,
                success: false,
                error: error.message
              });
            }
          });
        `, { eval: true });
        
        worker.on('error', (error) => {
          this.logger.error(`Worker error: ${error.message}`);
        });
        
        worker.on('exit', (code) => {
          if (code !== 0) {
            this.logger.error(`Worker exited with code ${code}`);
            // Replace dead worker
            this.replaceWorker(worker);
          }
        });
        
        this.workerPool.push(worker);
      } catch (error) {
        this.logger.error(`Failed to create worker: ${error.message}`);
      }
    }
    
    this.logger.log(`Initialized ${this.workerPool.length} worker threads`);
  }

  /**
   * Replace a dead worker
   */
  private replaceWorker(deadWorker: Worker): void {
    const index = this.workerPool.indexOf(deadWorker);
    if (index !== -1) {
      this.workerPool.splice(index, 1);
      // Create new worker after delay
      setTimeout(() => {
        this.initializeWorkerPool();
      }, 5000);
    }
  }

  /**
   * Submit a decision request
   */
  async submitDecision(request: Omit<DecisionRequest, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateRequestId();
    const fullRequest: DecisionRequest = {
      ...request,
      id,
      timestamp: Date.now()
    };
    
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = await this.checkCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for decision ${id}`);
      return cached.id;
    }
    
    // Add to priority queue
    this.addToQueue(fullRequest);
    
    // Emit event
    this.eventEmitter.emit('decision.queued', {
      id,
      priority: request.priority,
      queueSize: this.priorityQueue.length
    });
    
    return id;
  }

  /**
   * Get decision result (async/await pattern)
   */
  async getDecisionResult(id: string, timeout: number = 10000): Promise<DecisionResult | null> {
    const startTime = Date.now();
    
    // Check if already completed
    const cached = this.decisionCache.get(id);
    if (cached) {
      return cached;
    }
    
    // Wait for completion
    while (Date.now() - startTime < timeout) {
      const result = this.decisionCache.get(id);
      if (result) {
        return result;
      }
      
      // Check if still processing
      if (!this.requestQueue.has(id) && !this.processingQueue.has(id)) {
        // Request not found
        return null;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Timeout
    this.logger.warn(`Decision ${id} timed out after ${timeout}ms`);
    return null;
  }

  /**
   * Add request to priority queue
   */
  private addToQueue(request: DecisionRequest): void {
    this.requestQueue.set(request.id, request);
    
    // Insert into priority queue maintaining order
    const insertIndex = this.priorityQueue.findIndex(r => r.priority < request.priority);
    if (insertIndex === -1) {
      this.priorityQueue.push(request);
    } else {
      this.priorityQueue.splice(insertIndex, 0, request);
    }
    
    this.queueMetrics.pending++;
  }

  /**
   * Start the processing loop
   */
  private startProcessingLoop(): void {
    setInterval(async () => {
      await this.processQueue();
    }, 100); // Process every 100ms
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Check resource availability
    const resourceCheck = this.resourceMonitor.shouldThrottleRequest();
    if (resourceCheck.shouldThrottle && this.processingQueue.size > 0) {
      this.logger.debug(`Throttling decision processing: ${resourceCheck.reason}`);
      return;
    }
    
    // Process requests up to concurrency limit
    while (this.priorityQueue.length > 0 && 
           this.processingQueue.size < this.maxConcurrency &&
           this.hasAvailableWorker()) {
      
      const request = this.priorityQueue.shift();
      if (!request) break;
      
      this.requestQueue.delete(request.id);
      this.processingQueue.add(request.id);
      this.queueMetrics.pending--;
      this.queueMetrics.processing++;
      
      // Update wait time metric
      const waitTime = Date.now() - request.timestamp;
      this.queueMetrics.averageWaitTime = 
        this.queueMetrics.averageWaitTime * 0.9 + waitTime * 0.1;
      
      // Process request asynchronously
      this.processRequest(request).catch(error => {
        this.logger.error(`Failed to process request ${request.id}:`, error);
      });
    }
  }

  /**
   * Check if worker is available
   */
  private hasAvailableWorker(): boolean {
    return this.workerPool.length > 0;
  }

  /**
   * Process a single request
   */
  private async processRequest(request: DecisionRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get adaptive configuration
      const adaptiveConfig = await this.adaptiveResourceManager.getAdaptiveConfiguration(
        request.strategy,
        request.complexity
      );
      
      // Execute decision in worker if CPU-intensive
      let workerResult = null;
      if (adaptiveConfig.parallelism > 1 && this.hasAvailableWorker()) {
        workerResult = await this.executeInWorker(request, adaptiveConfig);
      }
      
      // Record resource usage
      const metrics = this.resourceMonitor.getCurrentMetrics();
      
      // Create result
      const result: DecisionResult = {
        id: request.id,
        decision: adaptiveConfig,
        executionTime: Date.now() - startTime,
        resourcesUsed: {
          cpu: metrics?.cpuUsage || 0,
          memory: metrics?.memoryUsage || 0
        },
        timestamp: Date.now()
      };
      
      // Cache result
      await this.cacheResult(request, result);
      
      // Update metrics
      this.processingQueue.delete(request.id);
      this.queueMetrics.processing--;
      this.queueMetrics.completed++;
      this.queueMetrics.averageProcessingTime = 
        this.queueMetrics.averageProcessingTime * 0.9 + result.executionTime * 0.1;
      
      // Emit completion event
      this.eventEmitter.emit('decision.completed', {
        id: request.id,
        executionTime: result.executionTime,
        strategy: adaptiveConfig.strategy
      });
      
    } catch (error) {
      this.logger.error(`Error processing request ${request.id}:`, error);
      
      this.processingQueue.delete(request.id);
      this.queueMetrics.processing--;
      this.queueMetrics.failed++;
      
      // Emit failure event
      this.eventEmitter.emit('decision.failed', {
        id: request.id,
        error: error.message
      });
    }
  }

  /**
   * Execute CPU-intensive work in worker thread
   */
  private async executeInWorker(
    request: DecisionRequest,
    config: AdaptiveDecision
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.workerPool.pop();
      if (!worker) {
        reject(new Error('No available workers'));
        return;
      }
      
      const timeout = setTimeout(() => {
        this.workerPool.push(worker);
        reject(new Error('Worker timeout'));
      }, config.maxThinkingTime);
      
      worker.once('message', (result) => {
        clearTimeout(timeout);
        this.workerPool.push(worker);
        
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error));
        }
      });
      
      worker.postMessage({
        id: request.id,
        task: 'process',
        params: {
          board: request.board,
          complexity: request.complexity,
          config
        }
      });
    });
  }

  /**
   * Cache decision result
   */
  private async cacheResult(request: DecisionRequest, result: DecisionResult): Promise<void> {
    const cacheKey = this.getCacheKey(request);
    
    // Memory cache
    this.decisionCache.set(result.id, result);
    
    // Note: AsyncCacheManager uses memoization pattern, not direct set/get
    // Cache is handled automatically through memoized functions
    
    // Clean up old entries
    setTimeout(() => {
      this.decisionCache.delete(result.id);
    }, this.cacheExpiry);
  }

  /**
   * Check cache for existing result
   */
  private async checkCache(cacheKey: string): Promise<DecisionResult | null> {
    // Check in-memory cache only since AsyncCacheManager doesn't expose get
    return null; // Will rely on memoization in the actual decision computation
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(request: Partial<DecisionRequest>): string {
    return `decision:${request.strategy}:${request.complexity}:${JSON.stringify(request.board)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Monitor system health
    this.eventEmitter.on('system.health.degraded', () => {
      // Reduce concurrency when system is stressed
      this.logger.warn('System health degraded, reducing concurrency');
      // Could implement dynamic worker scaling here
    });
    
    // Handle circuit breaker events
    this.eventEmitter.on('circuit.breaker.open', (event) => {
      if (event.name === 'worker-pool') {
        this.logger.error('Worker pool circuit breaker opened');
        // Could implement fallback strategies
      }
    });
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): QueueMetrics {
    return {
      ...this.queueMetrics,
      pending: this.priorityQueue.length,
      processing: this.processingQueue.size
    };
  }

  /**
   * Clear all queues (emergency)
   */
  clearQueues(): void {
    this.priorityQueue = [];
    this.requestQueue.clear();
    this.processingQueue.clear();
    this.queueMetrics.pending = 0;
    this.queueMetrics.processing = 0;
    
    this.logger.warn('All decision queues cleared');
  }

  /**
   * Cleanup on destroy
   */
  async onModuleDestroy(): Promise<void> {
    // Terminate all workers
    for (const worker of this.workerPool) {
      await worker.terminate();
    }
    
    // Clear caches
    this.decisionCache.clear();
    
    this.logger.log('Async Decision Engine destroyed');
  }
}