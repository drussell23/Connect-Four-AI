import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AsyncCacheManager } from '../async/cache-manager';

interface WorkloadMetrics {
  cpuUsage: number;
  memoryUsage: number;
  executionTime: number;
  frequency: number;
  lastExecution: number;
}

interface OptimizationStrategy {
  name: string;
  apply: (workload: Workload) => Promise<OptimizationResult>;
  applicableConditions: (metrics: SystemMetrics) => boolean;
}

interface OptimizationResult {
  success: boolean;
  memorySaved: number;
  performanceImpact: number;
  actions: string[];
}

interface Workload {
  id: string;
  type: string;
  priority: number;
  metrics: WorkloadMetrics;
  optimizable: boolean;
  currentState: 'active' | 'throttled' | 'paused' | 'optimized';
}

interface SystemMetrics {
  totalMemory: number;
  usedMemory: number;
  memoryPressure: number;
  swapUsage: number;
  cacheSize: number;
}

@Injectable()
export class WorkloadOptimizationEngine {
  private readonly logger = new Logger(WorkloadOptimizationEngine.name);
  
  // Tracked workloads
  private workloads = new Map<string, Workload>();
  
  // Optimization strategies
  private strategies: OptimizationStrategy[] = [
    {
      name: 'Cache Pruning',
      apply: this.applyCachePruning.bind(this),
      applicableConditions: (metrics) => metrics.cacheSize > 50 * 1024 * 1024 // 50MB
    },
    {
      name: 'Model Quantization',
      apply: this.applyModelQuantization.bind(this),
      applicableConditions: (metrics) => metrics.memoryPressure > 0.8
    },
    {
      name: 'Batch Size Reduction',
      apply: this.applyBatchSizeReduction.bind(this),
      applicableConditions: (metrics) => metrics.memoryPressure > 0.7
    },
    {
      name: 'Feature Reduction',
      apply: this.applyFeatureReduction.bind(this),
      applicableConditions: (metrics) => metrics.memoryPressure > 0.85
    },
    {
      name: 'Compute Offloading',
      apply: this.applyComputeOffloading.bind(this),
      applicableConditions: (metrics) => metrics.swapUsage > 0
    },
    {
      name: 'Memory Pool Optimization',
      apply: this.applyMemoryPoolOptimization.bind(this),
      applicableConditions: (metrics) => metrics.usedMemory > metrics.totalMemory * 0.9
    }
  ];
  
  // Optimization history
  private optimizationHistory: Array<{
    timestamp: number;
    strategy: string;
    result: OptimizationResult;
    systemMetricsBefore: SystemMetrics;
    systemMetricsAfter: SystemMetrics;
  }> = [];
  
  // Configuration
  private config = {
    optimizationInterval: 5000, // 5 seconds
    minMemoryThreshold: 100 * 1024 * 1024, // 100MB minimum free
    targetMemoryUsage: 0.75, // Target 75% memory usage
    aggressiveMode: false
  };
  
  private optimizationTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheManager: AsyncCacheManager
  ) {}
  
  async initialize(): Promise<void> {
    this.logger.log('🔧 Initializing Workload Optimization Engine...');
    
    this.setupEventListeners();
    this.startOptimizationLoop();
    
    this.logger.log('✅ Workload Optimization Engine initialized');
  }
  
  private setupEventListeners(): void {
    // Track workload lifecycle
    this.eventEmitter.on('workload.start', (data: { name: string; type?: string }) => {
      this.registerWorkload(data.name, data.type);
    });
    
    this.eventEmitter.on('workload.end', (data: { name: string }) => {
      this.updateWorkloadMetrics(data.name);
    });
    
    // Handle optimization requests
    this.eventEmitter.on('workload.optimize', (data: any) => {
      this.optimizeWorkload(data.workload, data.factor);
    });
    
    // Emergency optimization
    this.eventEmitter.on('cache.clear.emergency', () => {
      this.performEmergencyOptimization();
    });
    
    // Resource alerts
    this.eventEmitter.on('resource.throttle.changed', (data: any) => {
      if (data.newLevel === 'aggressive' || data.newLevel === 'emergency') {
        this.config.aggressiveMode = true;
        this.triggerImmediateOptimization();
      } else {
        this.config.aggressiveMode = false;
      }
    });
  }
  
  private startOptimizationLoop(): void {
    this.optimizationTimer = setInterval(async () => {
      await this.performOptimizationCycle();
    }, this.config.optimizationInterval);
  }
  
  private async performOptimizationCycle(): Promise<void> {
    const metrics = await this.collectSystemMetrics();
    
    // Check if optimization needed
    if (!this.isOptimizationNeeded(metrics)) {
      return;
    }
    
    this.logger.debug('Starting optimization cycle...');
    
    // Find applicable strategies
    const applicableStrategies = this.strategies.filter(
      strategy => strategy.applicableConditions(metrics)
    );
    
    if (applicableStrategies.length === 0) {
      return;
    }
    
    // Sort by expected impact
    const sortedStrategies = this.sortStrategiesByImpact(applicableStrategies, metrics);
    
    // Apply strategies until target is reached
    for (const strategy of sortedStrategies) {
      const result = await this.applyStrategy(strategy, metrics);
      
      if (result.success) {
        // Re-measure after optimization
        const newMetrics = await this.collectSystemMetrics();
        
        // Record in history
        this.optimizationHistory.push({
          timestamp: Date.now(),
          strategy: strategy.name,
          result,
          systemMetricsBefore: metrics,
          systemMetricsAfter: newMetrics
        });
        
        // Check if target reached
        if (newMetrics.memoryPressure < this.config.targetMemoryUsage) {
          break;
        }
      }
    }
  }
  
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memStats = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Get cache size
    const cacheStats = await this.cacheManager.getStats();
    let cacheSize = 0;
    
    if (cacheStats instanceof Map) {
      cacheStats.forEach(stat => {
        cacheSize += (stat as any).size || 0;
      });
    } else {
      cacheSize = (cacheStats as any).size || 0;
    }
    
    return {
      totalMemory,
      usedMemory,
      memoryPressure: usedMemory / totalMemory,
      swapUsage: 0, // Would need OS-specific implementation
      cacheSize
    };
  }
  
  private isOptimizationNeeded(metrics: SystemMetrics): boolean {
    // Check various conditions
    return (
      metrics.memoryPressure > this.config.targetMemoryUsage ||
      metrics.swapUsage > 0 ||
      (metrics.totalMemory - metrics.usedMemory) < this.config.minMemoryThreshold ||
      this.config.aggressiveMode
    );
  }
  
  private sortStrategiesByImpact(
    strategies: OptimizationStrategy[],
    metrics: SystemMetrics
  ): OptimizationStrategy[] {
    // Simple heuristic: prioritize based on current pressure
    return strategies.sort((a, b) => {
      // Cache pruning is always first if applicable
      if (a.name === 'Cache Pruning') return -1;
      if (b.name === 'Cache Pruning') return 1;
      
      // Memory pool optimization for critical situations
      if (metrics.memoryPressure > 0.9) {
        if (a.name === 'Memory Pool Optimization') return -1;
        if (b.name === 'Memory Pool Optimization') return 1;
      }
      
      return 0;
    });
  }
  
  private async applyStrategy(
    strategy: OptimizationStrategy,
    metrics: SystemMetrics
  ): Promise<OptimizationResult> {
    this.logger.log(`Applying optimization strategy: ${strategy.name}`);
    
    try {
      // Find most suitable workload for optimization
      const targetWorkload = this.selectTargetWorkload(strategy.name);
      
      if (!targetWorkload) {
        return {
          success: false,
          memorySaved: 0,
          performanceImpact: 0,
          actions: ['No suitable workload found']
        };
      }
      
      const result = await strategy.apply(targetWorkload);
      
      if (result.success) {
        this.logger.log(
          `✅ ${strategy.name} completed: saved ${(result.memorySaved / 1024 / 1024).toFixed(2)}MB`
        );
        
        // Emit optimization event
        this.eventEmitter.emit('workload.optimized', {
          workloadId: targetWorkload.id,
          strategy: strategy.name,
          memorySaved: result.memorySaved,
          performanceImpact: result.performanceImpact
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Strategy ${strategy.name} failed:`, error);
      return {
        success: false,
        memorySaved: 0,
        performanceImpact: 0,
        actions: [`Error: ${error.message}`]
      };
    }
  }
  
  private selectTargetWorkload(strategyName: string): Workload | null {
    // Select workload based on strategy and current state
    const workloads = Array.from(this.workloads.values())
      .filter(w => w.optimizable && w.currentState === 'active')
      .sort((a, b) => {
        // Prioritize by memory usage and low priority
        const scoreA = a.metrics.memoryUsage * (11 - a.priority);
        const scoreB = b.metrics.memoryUsage * (11 - b.priority);
        return scoreB - scoreA;
      });
    
    return workloads[0] || null;
  }
  
  // Optimization Strategy Implementations
  
  private async applyCachePruning(workload: Workload): Promise<OptimizationResult> {
    const actions: string[] = [];
    let memorySaved = 0;
    
    try {
      // Get cache statistics
      const stats = await this.cacheManager.getStats();
      
      // Clear old entries
      if (stats instanceof Map) {
        for (const [namespace, stat] of stats) {
          if (stat.hitRate < 0.1) { // Low hit rate
            await this.cacheManager.invalidate(namespace);
            memorySaved += (stat as any).size || 0;
            actions.push(`Cleared low-usage cache: ${namespace}`);
          }
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        actions.push('Triggered garbage collection');
      }
      
      return {
        success: memorySaved > 0,
        memorySaved,
        performanceImpact: 0.1, // Minor impact
        actions
      };
      
    } catch (error) {
      return {
        success: false,
        memorySaved: 0,
        performanceImpact: 0,
        actions: [`Cache pruning failed: ${error.message}`]
      };
    }
  }
  
  private async applyModelQuantization(workload: Workload): Promise<OptimizationResult> {
    // Emit event to request model quantization
    this.eventEmitter.emit('ai.model.quantize', {
      workloadId: workload.id,
      targetBits: 8 // Reduce to 8-bit
    });
    
    // Estimate memory savings (rough approximation)
    const estimatedSavings = workload.metrics.memoryUsage * 0.5;
    
    return {
      success: true,
      memorySaved: estimatedSavings,
      performanceImpact: 0.2, // 20% performance impact
      actions: ['Applied 8-bit quantization to AI models']
    };
  }
  
  private async applyBatchSizeReduction(workload: Workload): Promise<OptimizationResult> {
    // Reduce batch sizes for ML operations
    this.eventEmitter.emit('ai.batch.reduce', {
      workloadId: workload.id,
      reductionFactor: 0.5
    });
    
    const memorySaved = workload.metrics.memoryUsage * 0.3;
    
    return {
      success: true,
      memorySaved,
      performanceImpact: 0.3, // 30% slower but uses less memory
      actions: ['Reduced ML batch sizes by 50%']
    };
  }
  
  private async applyFeatureReduction(workload: Workload): Promise<OptimizationResult> {
    // Disable non-essential features
    const actions: string[] = [];
    let memorySaved = 0;
    
    // Disable advanced visualizations
    this.eventEmitter.emit('ai.features.disable', {
      features: ['visualizations', 'detailed_explanations']
    });
    actions.push('Disabled AI visualizations');
    memorySaved += 20 * 1024 * 1024; // 20MB estimate
    
    // Reduce model complexity
    this.eventEmitter.emit('ai.complexity.reduce', {
      workloadId: workload.id,
      level: 'minimal'
    });
    actions.push('Reduced AI model complexity');
    memorySaved += 30 * 1024 * 1024; // 30MB estimate
    
    return {
      success: true,
      memorySaved,
      performanceImpact: 0.4, // Significant feature reduction
      actions
    };
  }
  
  private async applyComputeOffloading(workload: Workload): Promise<OptimizationResult> {
    // Offload to external compute if available
    const canOffload = await this.checkOffloadingCapability();
    
    if (!canOffload) {
      return {
        success: false,
        memorySaved: 0,
        performanceImpact: 0,
        actions: ['Compute offloading not available']
      };
    }
    
    this.eventEmitter.emit('ai.compute.offload', {
      workloadId: workload.id,
      target: 'ml-service'
    });
    
    return {
      success: true,
      memorySaved: workload.metrics.memoryUsage * 0.7,
      performanceImpact: 0.5, // Network latency impact
      actions: ['Offloaded compute to ML service']
    };
  }
  
  private async applyMemoryPoolOptimization(workload: Workload): Promise<OptimizationResult> {
    const actions: string[] = [];
    let memorySaved = 0;
    
    // Consolidate memory pools
    this.eventEmitter.emit('memory.pools.consolidate');
    actions.push('Consolidated memory pools');
    memorySaved += 10 * 1024 * 1024; // 10MB estimate
    
    // Release unused buffers
    this.eventEmitter.emit('buffers.release.unused');
    actions.push('Released unused buffers');
    memorySaved += 15 * 1024 * 1024; // 15MB estimate
    
    // Compact heap if possible
    if (global.gc) {
      global.gc(true); // Full GC
      actions.push('Performed full garbage collection');
      memorySaved += 20 * 1024 * 1024; // 20MB estimate
    }
    
    return {
      success: true,
      memorySaved,
      performanceImpact: 0.15, // Minor pause for GC
      actions
    };
  }
  
  private async checkOffloadingCapability(): Promise<boolean> {
    // Check if ML service is available
    try {
      const response = await this.eventEmitter.emitAsync('ml.service.ping');
      return response[0]?.available || false;
    } catch {
      return false;
    }
  }
  
  private registerWorkload(id: string, type?: string): void {
    if (!this.workloads.has(id)) {
      this.workloads.set(id, {
        id,
        type: type || 'unknown',
        priority: 5,
        metrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          executionTime: 0,
          frequency: 0,
          lastExecution: Date.now()
        },
        optimizable: true,
        currentState: 'active'
      });
    }
  }
  
  private updateWorkloadMetrics(id: string): void {
    const workload = this.workloads.get(id);
    if (workload) {
      // Update metrics (would need actual measurement)
      workload.metrics.lastExecution = Date.now();
      workload.metrics.frequency++;
    }
  }
  
  private optimizeWorkload(workloadId: string, factor: number): void {
    const workload = this.workloads.get(workloadId);
    if (workload) {
      if (factor === 0) {
        workload.currentState = 'paused';
      } else if (factor < 1) {
        workload.currentState = 'throttled';
      } else {
        workload.currentState = 'active';
      }
    }
  }
  
  private async performEmergencyOptimization(): Promise<void> {
    this.logger.warn('🚨 Performing emergency optimization!');
    
    // Apply all strategies aggressively
    const metrics = await this.collectSystemMetrics();
    
    for (const strategy of this.strategies) {
      await this.applyStrategy(strategy, metrics);
    }
    
    // Clear all caches
    await this.cacheManager.invalidate('*');
    
    // Pause all low-priority workloads
    this.workloads.forEach(workload => {
      if (workload.priority < 7) {
        workload.currentState = 'paused';
        this.eventEmitter.emit('workload.pause', { name: workload.id });
      }
    });
  }
  
  private triggerImmediateOptimization(): void {
    // Cancel current timer and run immediately
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    this.performOptimizationCycle().then(() => {
      // Restart regular timer
      this.startOptimizationLoop();
    });
  }
  
  public getOptimizationReport(): {
    activeOptimizations: number;
    totalMemorySaved: number;
    averagePerformanceImpact: number;
    recentOptimizations: typeof this.optimizationHistory;
  } {
    const totalMemorySaved = this.optimizationHistory
      .reduce((sum, h) => sum + h.result.memorySaved, 0);
    
    const avgPerformanceImpact = this.optimizationHistory.length > 0
      ? this.optimizationHistory
          .reduce((sum, h) => sum + h.result.performanceImpact, 0) / this.optimizationHistory.length
      : 0;
    
    return {
      activeOptimizations: this.workloads.size,
      totalMemorySaved,
      averagePerformanceImpact: avgPerformanceImpact,
      recentOptimizations: this.optimizationHistory.slice(-10)
    };
  }
  
  public cleanup(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }
    
    this.workloads.clear();
    this.optimizationHistory = [];
  }
}

// Import os module
import * as os from 'os';

export { WorkloadMetrics, OptimizationResult };