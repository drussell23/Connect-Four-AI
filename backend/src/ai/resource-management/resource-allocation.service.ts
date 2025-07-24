import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface ResourcePool {
  totalCpu: number;
  totalMemory: number;
  availableCpu: number;
  availableMemory: number;
  reserved: Map<string, ResourceAllocation>;
}

interface ResourceAllocation {
  workloadId: string;
  cpuAllocation: number;
  memoryAllocation: number;
  priority: number;
  startTime: number;
  estimatedDuration: number;
  actualUsage?: {
    cpu: number;
    memory: number;
  };
}

interface AllocationRequest {
  workloadId: string;
  type: string;
  priority: number;
  requirements: {
    cpu: number;
    memory: number;
    duration: number;
  };
  flexible?: boolean;
  minRequirements?: {
    cpu: number;
    memory: number;
  };
}

interface PredictiveModel {
  predictRequired(workloadType: string, context: any): {
    cpu: number;
    memory: number;
    duration: number;
    confidence: number;
  };
  updateModel(actual: ResourceAllocation): void;
}

@Injectable()
export class ResourceAllocationService {
  private readonly logger = new Logger(ResourceAllocationService.name);
  
  // Resource pools
  private resourcePool: ResourcePool = {
    totalCpu: 100, // Percentage
    totalMemory: process.memoryUsage().heapTotal,
    availableCpu: 100,
    availableMemory: process.memoryUsage().heapTotal,
    reserved: new Map()
  };
  
  // Allocation queue
  private pendingAllocations: AllocationRequest[] = [];
  private allocationHistory: ResourceAllocation[] = [];
  
  // Predictive model
  private predictiveModel: PredictiveModel;
  
  // Configuration
  private config = {
    oversubscriptionRatio: 1.2, // Allow 20% oversubscription
    reservationTimeout: 30000, // 30 seconds
    preemptionEnabled: true,
    predictiveAllocation: true,
    allocationStrategy: 'best-fit' as 'first-fit' | 'best-fit' | 'worst-fit'
  };
  
  // Statistics
  private stats = {
    totalAllocations: 0,
    successfulAllocations: 0,
    preemptions: 0,
    timeouts: 0,
    avgUtilization: { cpu: 0, memory: 0 },
    peakUtilization: { cpu: 0, memory: 0 }
  };
  
  private allocationTimer: NodeJS.Timeout | null = null;
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.predictiveModel = new SimplePredictiveModel();
  }
  
  async initialize(): Promise<void> {
    this.logger.log('🎯 Initializing Resource Allocation Service...');
    
    // Calculate actual resource limits
    this.updateResourceLimits();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start allocation processor
    this.startAllocationProcessor();
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    this.logger.log('✅ Resource Allocation Service initialized');
  }
  
  private updateResourceLimits(): void {
    const cpus = require('os').cpus().length;
    this.resourcePool.totalCpu = cpus * 100; // Percentage per CPU
    this.resourcePool.availableCpu = this.resourcePool.totalCpu;
    
    const totalMemory = require('os').totalmem();
    const maxHeap = process.memoryUsage().heapTotal;
    
    // Use conservative memory limit
    this.resourcePool.totalMemory = Math.min(totalMemory * 0.8, maxHeap);
    this.resourcePool.availableMemory = this.resourcePool.totalMemory;
    
    this.logger.log(`Resource limits: ${cpus} CPUs (${this.resourcePool.totalCpu}%), ${(this.resourcePool.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB memory`);
  }
  
  private setupEventListeners(): void {
    // Handle resource requests
    this.eventEmitter.on('resource.request', async (data: any) => {
      const result = await this.requestAllocation({
        workloadId: data.name,
        type: data.type || 'unknown',
        priority: data.priority || 5,
        requirements: {
          cpu: data.estimatedCpu || 10,
          memory: data.estimatedMemory || 50 * 1024 * 1024,
          duration: data.estimatedDuration || 5000
        },
        flexible: data.flexible !== false
      });
      
      // Return result through event
      this.eventEmitter.emit('resource.request.result', {
        requestId: data.name,
        ...result
      });
    });
    
    // Handle resource release
    this.eventEmitter.on('workload.end', (data: { name: string }) => {
      this.releaseAllocation(data.name);
    });
    
    // Handle emergency situations
    this.eventEmitter.on('resource.emergency', () => {
      this.handleEmergencyMode();
    });
    
    // Update actual usage
    this.eventEmitter.on('workload.usage.update', (data: any) => {
      this.updateActualUsage(data.workloadId, data.cpu, data.memory);
    });
  }
  
  private startAllocationProcessor(): void {
    this.allocationTimer = setInterval(() => {
      this.processPendingAllocations();
    }, 100); // Process every 100ms
  }
  
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredAllocations();
      this.updateStatistics();
    }, 5000); // Every 5 seconds
  }
  
  public async requestAllocation(request: AllocationRequest): Promise<{
    allowed: boolean;
    allocated?: ResourceAllocation;
    reason?: string;
    alternativeResources?: { cpu: number; memory: number };
  }> {
    this.stats.totalAllocations++;
    
    // Use predictive model if enabled
    if (this.config.predictiveAllocation) {
      const prediction = this.predictiveModel.predictRequired(
        request.type,
        { priority: request.priority }
      );
      
      if (prediction.confidence > 0.7) {
        // Adjust requirements based on prediction
        request.requirements.cpu = Math.max(request.requirements.cpu, prediction.cpu);
        request.requirements.memory = Math.max(request.requirements.memory, prediction.memory);
      }
    }
    
    // Check immediate availability
    const canAllocate = this.checkAvailability(request.requirements);
    
    if (canAllocate) {
      const allocation = this.allocateResources(request);
      if (allocation) {
        this.stats.successfulAllocations++;
        return { allowed: true, allocated: allocation };
      }
    }
    
    // Try flexible allocation if allowed
    if (request.flexible && request.minRequirements) {
      const minCanAllocate = this.checkAvailability(request.minRequirements);
      if (minCanAllocate) {
        const allocation = this.allocateResources({
          ...request,
          requirements: {
          ...request.minRequirements,
          duration: request.requirements.duration
        }
        });
        if (allocation) {
          this.stats.successfulAllocations++;
          return { allowed: true, allocated: allocation };
        }
      }
    }
    
    // Check if preemption can help
    if (this.config.preemptionEnabled && request.priority >= 8) {
      const preempted = this.tryPreemption(request);
      if (preempted) {
        const allocation = this.allocateResources(request);
        if (allocation) {
          this.stats.successfulAllocations++;
          this.stats.preemptions++;
          return { allowed: true, allocated: allocation };
        }
      }
    }
    
    // Add to pending queue
    this.pendingAllocations.push(request);
    
    // Suggest alternative resources
    const available = this.getAvailableResources();
    
    return {
      allowed: false,
      reason: 'Insufficient resources available',
      alternativeResources: {
        cpu: Math.min(available.cpu, request.requirements.cpu),
        memory: Math.min(available.memory, request.requirements.memory)
      }
    };
  }
  
  private checkAvailability(requirements: { cpu: number; memory: number }): boolean {
    const effectiveCpu = this.resourcePool.availableCpu * this.config.oversubscriptionRatio;
    const effectiveMemory = this.resourcePool.availableMemory * this.config.oversubscriptionRatio;
    
    return requirements.cpu <= effectiveCpu && requirements.memory <= effectiveMemory;
  }
  
  private allocateResources(request: AllocationRequest): ResourceAllocation | null {
    try {
      const allocation: ResourceAllocation = {
        workloadId: request.workloadId,
        cpuAllocation: request.requirements.cpu,
        memoryAllocation: request.requirements.memory,
        priority: request.priority,
        startTime: Date.now(),
        estimatedDuration: request.requirements.duration
      };
      
      // Reserve resources
      this.resourcePool.availableCpu -= allocation.cpuAllocation;
      this.resourcePool.availableMemory -= allocation.memoryAllocation;
      this.resourcePool.reserved.set(allocation.workloadId, allocation);
      
      // Record in history
      this.allocationHistory.push(allocation);
      
      // Emit allocation event
      this.eventEmitter.emit('resource.allocated', {
        workloadId: allocation.workloadId,
        cpu: allocation.cpuAllocation,
        memory: allocation.memoryAllocation
      });
      
      this.logger.debug(
        `Allocated resources for ${request.workloadId}: ` +
        `CPU ${allocation.cpuAllocation}%, Memory ${(allocation.memoryAllocation / 1024 / 1024).toFixed(2)}MB`
      );
      
      return allocation;
      
    } catch (error) {
      this.logger.error('Failed to allocate resources:', error);
      return null;
    }
  }
  
  private tryPreemption(request: AllocationRequest): boolean {
    // Find lower priority allocations that can be preempted
    const candidates = Array.from(this.resourcePool.reserved.values())
      .filter(alloc => alloc.priority < request.priority)
      .sort((a, b) => a.priority - b.priority); // Lowest priority first
    
    let freedCpu = 0;
    let freedMemory = 0;
    const toPreempt: string[] = [];
    
    for (const candidate of candidates) {
      toPreempt.push(candidate.workloadId);
      freedCpu += candidate.cpuAllocation;
      freedMemory += candidate.memoryAllocation;
      
      if (freedCpu >= request.requirements.cpu && freedMemory >= request.requirements.memory) {
        // Preempt selected workloads
        toPreempt.forEach(workloadId => {
          this.preemptWorkload(workloadId);
        });
        return true;
      }
    }
    
    return false;
  }
  
  private preemptWorkload(workloadId: string): void {
    const allocation = this.resourcePool.reserved.get(workloadId);
    if (!allocation) return;
    
    this.logger.warn(`Preempting workload ${workloadId} (priority ${allocation.priority})`);
    
    // Emit preemption event
    this.eventEmitter.emit('workload.preempted', {
      workloadId,
      reason: 'Higher priority workload requires resources'
    });
    
    // Release resources
    this.releaseAllocation(workloadId);
  }
  
  public releaseAllocation(workloadId: string): void {
    const allocation = this.resourcePool.reserved.get(workloadId);
    if (!allocation) return;
    
    // Return resources to pool
    this.resourcePool.availableCpu += allocation.cpuAllocation;
    this.resourcePool.availableMemory += allocation.memoryAllocation;
    this.resourcePool.reserved.delete(workloadId);
    
    // Update predictive model with actual usage
    if (allocation.actualUsage) {
      this.predictiveModel.updateModel(allocation);
    }
    
    this.logger.debug(
      `Released resources for ${workloadId}: ` +
      `CPU ${allocation.cpuAllocation}%, Memory ${(allocation.memoryAllocation / 1024 / 1024).toFixed(2)}MB`
    );
    
    // Process pending allocations
    this.processPendingAllocations();
  }
  
  private processPendingAllocations(): void {
    if (this.pendingAllocations.length === 0) return;
    
    // Sort by priority (highest first)
    this.pendingAllocations.sort((a, b) => b.priority - a.priority);
    
    const processed: AllocationRequest[] = [];
    
    for (const request of this.pendingAllocations) {
      if (this.checkAvailability(request.requirements)) {
        const allocation = this.allocateResources(request);
        if (allocation) {
          processed.push(request);
          this.stats.successfulAllocations++;
        }
      }
    }
    
    // Remove processed requests
    this.pendingAllocations = this.pendingAllocations.filter(
      req => !processed.includes(req)
    );
  }
  
  private cleanupExpiredAllocations(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    this.resourcePool.reserved.forEach((allocation, workloadId) => {
      if (now - allocation.startTime > allocation.estimatedDuration + this.config.reservationTimeout) {
        expired.push(workloadId);
        this.stats.timeouts++;
      }
    });
    
    expired.forEach(workloadId => {
      this.logger.warn(`Allocation expired for ${workloadId}`);
      this.releaseAllocation(workloadId);
    });
  }
  
  private updateActualUsage(workloadId: string, cpu: number, memory: number): void {
    const allocation = this.resourcePool.reserved.get(workloadId);
    if (allocation) {
      allocation.actualUsage = { cpu, memory };
    }
  }
  
  private updateStatistics(): void {
    const usedCpu = this.resourcePool.totalCpu - this.resourcePool.availableCpu;
    const usedMemory = this.resourcePool.totalMemory - this.resourcePool.availableMemory;
    
    const cpuUtilization = (usedCpu / this.resourcePool.totalCpu) * 100;
    const memoryUtilization = (usedMemory / this.resourcePool.totalMemory) * 100;
    
    // Update average (exponential moving average)
    const alpha = 0.1;
    this.stats.avgUtilization.cpu = this.stats.avgUtilization.cpu * (1 - alpha) + cpuUtilization * alpha;
    this.stats.avgUtilization.memory = this.stats.avgUtilization.memory * (1 - alpha) + memoryUtilization * alpha;
    
    // Update peak
    this.stats.peakUtilization.cpu = Math.max(this.stats.peakUtilization.cpu, cpuUtilization);
    this.stats.peakUtilization.memory = Math.max(this.stats.peakUtilization.memory, memoryUtilization);
  }
  
  private handleEmergencyMode(): void {
    this.logger.error('🚨 Emergency mode activated in allocation service');
    
    // Release all low-priority allocations
    const toRelease: string[] = [];
    
    this.resourcePool.reserved.forEach((allocation, workloadId) => {
      if (allocation.priority < 7) {
        toRelease.push(workloadId);
      }
    });
    
    toRelease.forEach(workloadId => {
      this.logger.warn(`Emergency release: ${workloadId}`);
      this.releaseAllocation(workloadId);
    });
    
    // Clear pending low-priority requests
    this.pendingAllocations = this.pendingAllocations.filter(req => req.priority >= 7);
  }
  
  public getAvailableResources(): { cpu: number; memory: number } {
    return {
      cpu: this.resourcePool.availableCpu,
      memory: this.resourcePool.availableMemory
    };
  }
  
  public getAllocationStatus(): {
    pool: ResourcePool;
    activeAllocations: ResourceAllocation[];
    pendingRequests: number;
    statistics: typeof this.stats;
  } {
    return {
      pool: { ...this.resourcePool, reserved: new Map(this.resourcePool.reserved) },
      activeAllocations: Array.from(this.resourcePool.reserved.values()),
      pendingRequests: this.pendingAllocations.length,
      statistics: { ...this.stats }
    };
  }
  
  public cleanup(): void {
    if (this.allocationTimer) {
      clearInterval(this.allocationTimer);
      this.allocationTimer = null;
    }
    
    // Release all allocations
    const allWorkloads = Array.from(this.resourcePool.reserved.keys());
    allWorkloads.forEach(workloadId => this.releaseAllocation(workloadId));
    
    this.pendingAllocations = [];
  }
}

// Simple predictive model implementation
class SimplePredictiveModel implements PredictiveModel {
  private patterns = new Map<string, { avgCpu: number; avgMemory: number; avgDuration: number; count: number }>();
  
  predictRequired(workloadType: string, context: any): {
    cpu: number;
    memory: number;
    duration: number;
    confidence: number;
  } {
    const pattern = this.patterns.get(workloadType);
    
    if (!pattern || pattern.count < 5) {
      // Default predictions based on type
      const defaults: Record<string, any> = {
        'ai-move-computation': { cpu: 30, memory: 100 * 1024 * 1024, duration: 2000 },
        'rlhf-processing': { cpu: 50, memory: 200 * 1024 * 1024, duration: 5000 },
        'cache-precomputation': { cpu: 20, memory: 150 * 1024 * 1024, duration: 3000 },
        'model-training': { cpu: 80, memory: 500 * 1024 * 1024, duration: 10000 }
      };
      
      const defaultValues = defaults[workloadType] || { cpu: 25, memory: 100 * 1024 * 1024, duration: 3000 };
      
      return {
        ...defaultValues,
        confidence: pattern ? pattern.count / 10 : 0.1
      };
    }
    
    // Adjust based on context (e.g., priority)
    const priorityFactor = context.priority ? context.priority / 10 : 1;
    
    return {
      cpu: pattern.avgCpu * priorityFactor,
      memory: pattern.avgMemory * priorityFactor,
      duration: pattern.avgDuration,
      confidence: Math.min(0.9, pattern.count / 50)
    };
  }
  
  updateModel(actual: ResourceAllocation): void {
    if (!actual.actualUsage) return;
    
    const type = actual.workloadId.split('-')[0]; // Extract type from ID
    const pattern = this.patterns.get(type) || { avgCpu: 0, avgMemory: 0, avgDuration: 0, count: 0 };
    
    // Update averages
    const alpha = 0.2; // Learning rate
    pattern.avgCpu = pattern.avgCpu * (1 - alpha) + actual.actualUsage.cpu * alpha;
    pattern.avgMemory = pattern.avgMemory * (1 - alpha) + actual.actualUsage.memory * alpha;
    pattern.avgDuration = pattern.avgDuration * (1 - alpha) + (Date.now() - actual.startTime) * alpha;
    pattern.count++;
    
    this.patterns.set(type, pattern);
  }
}

export { ResourceAllocation, AllocationRequest };