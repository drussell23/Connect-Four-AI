import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ThrottleConfig {
  baseDelay: number;
  maxDelay: number;
  adaptiveScaling: boolean;
  priorityLevels: Map<string, number>;
}

export interface ThrottleRequest {
  id: string;
  type: string;
  priority: number;
  estimatedDuration: number;
  resourceRequirements: {
    cpu: number;
    memory: number;
  };
  callback: () => Promise<any>;
}

interface QueuedRequest extends ThrottleRequest {
  queuedAt: number;
  attempts: number;
  lastAttempt?: number;
}

@Injectable()
export class AdaptiveThrottleService {
  private readonly logger = new Logger(AdaptiveThrottleService.name);
  
  // Request queues by priority
  private queues = new Map<number, QueuedRequest[]>();
  private activeRequests = new Map<string, QueuedRequest>();
  
  // Throttle configuration
  private config: ThrottleConfig = {
    baseDelay: 100,
    maxDelay: 5000,
    adaptiveScaling: true,
    priorityLevels: new Map([
      ['critical', 10],
      ['high', 8],
      ['normal', 5],
      ['low', 3],
      ['background', 1]
    ])
  };
  
  // Performance metrics
  private metrics = {
    totalRequests: 0,
    completedRequests: 0,
    throttledRequests: 0,
    droppedRequests: 0,
    avgWaitTime: 0,
    avgProcessingTime: 0
  };
  
  // Adaptive parameters
  private currentDelay = this.config.baseDelay;
  private throttleFactor = 1.0;
  private resourcePressure = 0;
  
  // Processing state
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initialize();
  }
  
  private initialize(): void {
    // Initialize priority queues
    for (let i = 1; i <= 10; i++) {
      this.queues.set(i, []);
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start processing loop
    this.startProcessing();
    
    this.logger.log('✅ Adaptive Throttle Service initialized');
  }
  
  private setupEventListeners(): void {
    // Listen for resource status updates
    this.eventEmitter.on('resource.metrics', (data: any) => {
      this.updateResourcePressure(data);
    });
    
    // Listen for throttle policy changes
    this.eventEmitter.on('resource.throttle.changed', (data: any) => {
      this.adjustThrottleFactor(data.reductionFactor);
    });
    
    // Listen for emergency situations
    this.eventEmitter.on('resource.emergency', () => {
      this.handleEmergency();
    });
  }
  
  private updateResourcePressure(metrics: any): void {
    const { current, predicted } = metrics;
    
    // Calculate resource pressure (0-1 scale)
    const currentPressure = Math.max(
      current.cpu / 100,
      current.memory / 100
    );
    
    const predictedPressure = predicted ? Math.max(
      predicted.predictedCpuUsage / 100,
      predicted.predictedMemoryUsage / 100
    ) : currentPressure;
    
    // Weighted average favoring predictions
    this.resourcePressure = currentPressure * 0.4 + predictedPressure * 0.6;
    
    // Adapt delay based on pressure
    if (this.config.adaptiveScaling) {
      this.adaptDelay();
    }
  }
  
  private adaptDelay(): void {
    // Exponential scaling based on resource pressure
    const scaleFactor = Math.pow(2, this.resourcePressure * 3);
    const targetDelay = Math.min(
      this.config.maxDelay,
      this.config.baseDelay * scaleFactor * this.throttleFactor
    );
    
    // Smooth transition
    this.currentDelay = this.currentDelay * 0.7 + targetDelay * 0.3;
    
    this.logger.debug(`Adapted delay: ${this.currentDelay.toFixed(0)}ms (pressure: ${(this.resourcePressure * 100).toFixed(1)}%)`);
  }
  
  private adjustThrottleFactor(reductionFactor: number): void {
    this.throttleFactor = 1 / reductionFactor; // Inverse relationship
    this.logger.log(`Throttle factor adjusted: ${this.throttleFactor.toFixed(2)}`);
  }
  
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNextRequest();
      }
    }, 50); // Check every 50ms
  }
  
  public async submitRequest(request: ThrottleRequest): Promise<any> {
    this.metrics.totalRequests++;
    
    // Check if we should accept the request
    const canAccept = await this.canAcceptRequest(request);
    
    if (!canAccept) {
      this.metrics.droppedRequests++;
      throw new Error('Request rejected due to resource constraints');
    }
    
    // Create queued request
    const queuedRequest: QueuedRequest = {
      ...request,
      queuedAt: Date.now(),
      attempts: 0
    };
    
    // Add to appropriate queue
    const queue = this.queues.get(request.priority) || this.queues.get(5)!;
    queue.push(queuedRequest);
    
    // Emit event
    this.eventEmitter.emit('throttle.request.queued', {
      id: request.id,
      type: request.type,
      priority: request.priority,
      queueLength: queue.length
    });
    
    // Return promise that resolves when request is processed
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const completed = this.checkRequestCompletion(request.id);
        if (completed.done) {
          clearInterval(checkInterval);
          if (completed.error) {
            reject(completed.error);
          } else {
            resolve(completed.result);
          }
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.removeRequest(request.id);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }
  
  private async canAcceptRequest(request: ThrottleRequest): Promise<boolean> {
    // Check queue sizes
    const totalQueued = Array.from(this.queues.values())
      .reduce((sum, queue) => sum + queue.length, 0);
    
    if (totalQueued > 100) {
      // Only accept high priority requests when queue is full
      return request.priority >= 8;
    }
    
    // Check resource requirements
    if (this.resourcePressure > 0.9 && request.priority < 7) {
      return false;
    }
    
    return true;
  }
  
  private async processNextRequest(): Promise<void> {
    if (this.isProcessing) return;
    
    // Find highest priority request
    const request = this.getNextRequest();
    if (!request) return;
    
    this.isProcessing = true;
    
    try {
      // Apply throttle delay
      const delay = this.calculateDelay(request);
      if (delay > 0) {
        await this.sleep(delay);
      }
      
      // Check if still valid
      if (this.shouldSkipRequest(request)) {
        this.removeFromQueue(request);
        return;
      }
      
      // Move to active requests
      this.activeRequests.set(request.id, request);
      this.removeFromQueue(request);
      
      // Track metrics
      const waitTime = Date.now() - request.queuedAt;
      this.updateMetrics('wait', waitTime);
      
      // Emit processing event
      this.eventEmitter.emit('throttle.request.processing', {
        id: request.id,
        type: request.type,
        waitTime
      });
      
      // Mark workload start
      this.eventEmitter.emit('workload.start', {
        name: `${request.type}-${request.id}`
      });
      
      // Process the request
      const startTime = Date.now();
      request.lastAttempt = startTime;
      request.attempts++;
      
      const result = await this.executeWithResourceTracking(request);
      
      // Track processing time
      const processingTime = Date.now() - startTime;
      this.updateMetrics('processing', processingTime);
      
      // Store result
      (request as any).result = result;
      (request as any).done = true;
      
      // Mark workload end
      this.eventEmitter.emit('workload.end', {
        name: `${request.type}-${request.id}`
      });
      
      this.metrics.completedRequests++;
      
      // Emit completion event
      this.eventEmitter.emit('throttle.request.completed', {
        id: request.id,
        type: request.type,
        processingTime,
        totalTime: Date.now() - request.queuedAt
      });
      
    } catch (error) {
      this.logger.error(`Request ${request.id} failed:`, error);
      (request as any).error = error;
      (request as any).done = true;
      
      // Mark workload end on error
      this.eventEmitter.emit('workload.end', {
        name: `${request.type}-${request.id}`
      });
      
    } finally {
      this.isProcessing = false;
    }
  }
  
  private getNextRequest(): QueuedRequest | null {
    // Process queues in priority order
    for (let priority = 10; priority >= 1; priority--) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        // Apply starvation prevention for lower priorities
        const waitingTime = Date.now() - queue[0].queuedAt;
        const starvationThreshold = 10000; // 10 seconds
        
        if (priority >= 7 || waitingTime > starvationThreshold) {
          return queue[0];
        }
      }
    }
    
    return null;
  }
  
  private calculateDelay(request: QueuedRequest): number {
    // Base delay adjusted by priority
    const priorityMultiplier = (11 - request.priority) / 10;
    let delay = this.currentDelay * priorityMultiplier;
    
    // Reduce delay for requests that have been waiting long
    const waitTime = Date.now() - request.queuedAt;
    if (waitTime > 5000) {
      delay *= 0.5;
    }
    
    // Apply minimum delay for throttling
    if (this.metrics.throttledRequests > 0) {
      delay = Math.max(delay, 50);
    }
    
    return Math.floor(delay);
  }
  
  private shouldSkipRequest(request: QueuedRequest): boolean {
    // Skip if waited too long (except critical requests)
    const maxWait = request.priority >= 9 ? 60000 : 30000;
    return (Date.now() - request.queuedAt) > maxWait;
  }
  
  private async executeWithResourceTracking(request: QueuedRequest): Promise<any> {
    // Request resources
    const resourceRequest = await this.eventEmitter.emitAsync('resource.request', {
      name: request.type,
      estimatedCpu: request.resourceRequirements.cpu,
      estimatedMemory: request.resourceRequirements.memory
    });
    
    const allowed = resourceRequest[0]?.allowed ?? true;
    const throttleFactor = resourceRequest[0]?.throttleFactor ?? 1.0;
    
    if (!allowed) {
      throw new Error('Insufficient resources');
    }
    
    // Apply throttling to the execution
    if (throttleFactor < 1.0) {
      this.metrics.throttledRequests++;
      // Could implement actual throttling logic here
      // For now, we'll just add extra delay
      await this.sleep(this.currentDelay * (1 - throttleFactor));
    }
    
    // Execute the actual request
    return await request.callback();
  }
  
  private removeFromQueue(request: QueuedRequest): void {
    const queue = this.queues.get(request.priority);
    if (queue) {
      const index = queue.findIndex(r => r.id === request.id);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    }
  }
  
  private removeRequest(requestId: string): void {
    // Remove from all queues and active requests
    this.queues.forEach(queue => {
      const index = queue.findIndex(r => r.id === requestId);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    });
    
    this.activeRequests.delete(requestId);
  }
  
  private checkRequestCompletion(requestId: string): { done: boolean; result?: any; error?: any } {
    const request = this.activeRequests.get(requestId);
    if (request && (request as any).done) {
      return {
        done: true,
        result: (request as any).result,
        error: (request as any).error
      };
    }
    
    return { done: false };
  }
  
  private updateMetrics(type: 'wait' | 'processing', value: number): void {
    if (type === 'wait') {
      const alpha = 0.1; // Exponential moving average factor
      this.metrics.avgWaitTime = this.metrics.avgWaitTime * (1 - alpha) + value * alpha;
    } else {
      const alpha = 0.1;
      this.metrics.avgProcessingTime = this.metrics.avgProcessingTime * (1 - alpha) + value * alpha;
    }
  }
  
  private handleEmergency(): void {
    this.logger.warn('🚨 Emergency mode activated in throttle service');
    
    // Clear low priority queues
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        this.logger.warn(`Dropping ${queue.length} requests from priority ${priority} queue`);
        queue.forEach(request => {
          (request as any).error = new Error('Dropped due to emergency');
          (request as any).done = true;
        });
        queue.length = 0;
      }
    }
    
    // Increase delays significantly
    this.currentDelay = this.config.maxDelay;
    this.throttleFactor = 3.0;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  public getMetrics(): typeof this.metrics & { queueSizes: Record<number, number> } {
    const queueSizes: Record<number, number> = {};
    this.queues.forEach((queue, priority) => {
      queueSizes[priority] = queue.length;
    });
    
    return {
      ...this.metrics,
      queueSizes
    };
  }
  
  public getQueueStatus(): {
    totalQueued: number;
    activeRequests: number;
    queuesByPriority: Record<number, number>;
    oldestRequest: number | null;
  } {
    const queuesByPriority: Record<number, number> = {};
    let oldestTimestamp = Infinity;
    let totalQueued = 0;
    
    this.queues.forEach((queue, priority) => {
      queuesByPriority[priority] = queue.length;
      totalQueued += queue.length;
      
      if (queue.length > 0 && queue[0].queuedAt < oldestTimestamp) {
        oldestTimestamp = queue[0].queuedAt;
      }
    });
    
    return {
      totalQueued,
      activeRequests: this.activeRequests.size,
      queuesByPriority,
      oldestRequest: oldestTimestamp === Infinity ? null : Date.now() - oldestTimestamp
    };
  }
  
  public cleanup(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Clear all queues
    this.queues.clear();
    this.activeRequests.clear();
  }
}