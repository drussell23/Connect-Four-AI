import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { PerformanceMonitor } from '../async/performance-monitor';

interface ResourcePrediction {
  timestamp: number;
  predictedCpuUsage: number;
  predictedMemoryUsage: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface WorkloadProfile {
  name: string;
  cpuWeight: number;
  memoryWeight: number;
  priority: number;
  canThrottle: boolean;
  throttleRatio: number;
}

interface ThrottlePolicy {
  level: 'none' | 'light' | 'moderate' | 'aggressive' | 'emergency';
  cpuThreshold: number;
  memoryThreshold: number;
  reductionFactor: number;
  cooldownPeriod: number;
}

@Injectable()
export class IntelligentResourceManager {
  private readonly logger = new Logger(IntelligentResourceManager.name);
  
  // Historical data for predictions
  private usageHistory: Array<{
    timestamp: number;
    cpu: number;
    memory: number;
    activeWorkloads: string[];
  }> = [];
  
  // Workload profiles
  private workloadProfiles = new Map<string, WorkloadProfile>([
    ['ai-move-computation', {
      name: 'AI Move Computation',
      cpuWeight: 0.8,
      memoryWeight: 0.6,
      priority: 10,
      canThrottle: true,
      throttleRatio: 0.5
    }],
    ['rlhf-processing', {
      name: 'RLHF Processing',
      cpuWeight: 0.7,
      memoryWeight: 0.8,
      priority: 8,
      canThrottle: true,
      throttleRatio: 0.6
    }],
    ['cache-precomputation', {
      name: 'Cache Precomputation',
      cpuWeight: 0.4,
      memoryWeight: 0.7,
      priority: 3,
      canThrottle: true,
      throttleRatio: 0.3
    }],
    ['model-training', {
      name: 'Model Training',
      cpuWeight: 0.9,
      memoryWeight: 0.9,
      priority: 5,
      canThrottle: true,
      throttleRatio: 0.4
    }],
    ['performance-monitoring', {
      name: 'Performance Monitoring',
      cpuWeight: 0.2,
      memoryWeight: 0.2,
      priority: 9,
      canThrottle: false,
      throttleRatio: 1.0
    }]
  ]);
  
  // Throttle policies
  private throttlePolicies: ThrottlePolicy[] = [
    { level: 'none', cpuThreshold: 0, memoryThreshold: 0, reductionFactor: 1.0, cooldownPeriod: 0 },
    { level: 'light', cpuThreshold: 70, memoryThreshold: 75, reductionFactor: 0.9, cooldownPeriod: 5000 },
    { level: 'moderate', cpuThreshold: 80, memoryThreshold: 85, reductionFactor: 0.7, cooldownPeriod: 10000 },
    { level: 'aggressive', cpuThreshold: 90, memoryThreshold: 90, reductionFactor: 0.5, cooldownPeriod: 15000 },
    { level: 'emergency', cpuThreshold: 95, memoryThreshold: 95, reductionFactor: 0.3, cooldownPeriod: 30000 }
  ];
  
  private currentThrottleLevel: ThrottlePolicy['level'] = 'none';
  private lastThrottleChange = 0;
  private activeWorkloads = new Set<string>();
  
  // Prediction model parameters
  private readonly historyWindow = 100; // Keep last 100 measurements
  private readonly predictionHorizon = 30000; // Predict 30 seconds ahead
  private readonly measurementInterval = 1000; // Measure every second
  
  // Resource limits
  private readonly cpuLimit = 80; // Target max CPU usage
  private readonly memoryLimit = 85; // Target max memory usage
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private predictionEngine: PredictionEngine;
  private workloadOptimizer: WorkloadOptimizer;
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly performanceMonitor: PerformanceMonitor
  ) {
    this.predictionEngine = new PredictionEngine();
    this.workloadOptimizer = new WorkloadOptimizer();
  }
  
  async initialize(): Promise<void> {
    this.logger.log('🧠 Initializing Intelligent Resource Manager...');
    
    // Start continuous monitoring
    this.startMonitoring();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize prediction engine
    await this.predictionEngine.initialize();
    
    this.logger.log('✅ Intelligent Resource Manager initialized');
  }
  
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
    }, this.measurementInterval);
  }
  
  private collectResourceMetrics(): void {
    const cpuUsage = this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    
    // Store in history
    this.usageHistory.push({
      timestamp: Date.now(),
      cpu: cpuUsage,
      memory: memoryUsage,
      activeWorkloads: Array.from(this.activeWorkloads)
    });
    
    // Trim history to window size
    if (this.usageHistory.length > this.historyWindow) {
      this.usageHistory = this.usageHistory.slice(-this.historyWindow);
    }
    
    // Make predictions
    const prediction = this.predictResourceUsage();
    
    // Check if throttling needed
    this.evaluateThrottling(cpuUsage, memoryUsage, prediction);
    
    // Emit metrics
    this.eventEmitter.emit('resource.metrics', {
      current: { cpu: cpuUsage, memory: memoryUsage },
      predicted: prediction,
      throttleLevel: this.currentThrottleLevel,
      activeWorkloads: Array.from(this.activeWorkloads)
    });
    
    // Log if critical
    if (prediction.riskLevel === 'critical') {
      this.logger.warn(`⚠️ Critical resource risk predicted: CPU ${prediction.predictedCpuUsage.toFixed(1)}%, Memory ${prediction.predictedMemoryUsage.toFixed(1)}%`);
    }
  }
  
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return Math.min(100, Math.max(0, usage));
  }
  
  private getMemoryUsage(): number {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return (usedMemory / totalMemory) * 100;
  }
  
  private predictResourceUsage(): ResourcePrediction {
    if (this.usageHistory.length < 5) {
      return {
        timestamp: Date.now() + this.predictionHorizon,
        predictedCpuUsage: this.getCpuUsage(),
        predictedMemoryUsage: this.getMemoryUsage(),
        confidence: 0.1,
        trend: 'stable',
        riskLevel: 'low'
      };
    }
    
    // Use prediction engine
    const prediction = this.predictionEngine.predict(
      this.usageHistory,
      this.activeWorkloads,
      this.predictionHorizon
    );
    
    // Determine risk level
    const riskLevel = this.calculateRiskLevel(
      prediction.predictedCpuUsage,
      prediction.predictedMemoryUsage
    );
    
    return { ...prediction, riskLevel };
  }
  
  private calculateRiskLevel(cpu: number, memory: number): 'low' | 'medium' | 'high' | 'critical' {
    const maxUsage = Math.max(cpu, memory);
    
    if (maxUsage >= 95) return 'critical';
    if (maxUsage >= 85) return 'high';
    if (maxUsage >= 75) return 'medium';
    return 'low';
  }
  
  private evaluateThrottling(
    currentCpu: number,
    currentMemory: number,
    prediction: ResourcePrediction
  ): void {
    // Use predicted values for proactive throttling
    const effectiveCpu = Math.max(currentCpu, prediction.predictedCpuUsage * 0.8);
    const effectiveMemory = Math.max(currentMemory, prediction.predictedMemoryUsage * 0.8);
    
    // Find appropriate throttle policy
    let newPolicy = this.throttlePolicies[0]; // Default to 'none'
    
    for (const policy of this.throttlePolicies) {
      if (effectiveCpu >= policy.cpuThreshold || effectiveMemory >= policy.memoryThreshold) {
        newPolicy = policy;
      }
    }
    
    // Check cooldown period
    const now = Date.now();
    const currentPolicy = this.throttlePolicies.find(p => p.level === this.currentThrottleLevel)!;
    
    if (newPolicy.level !== this.currentThrottleLevel) {
      if (now - this.lastThrottleChange >= currentPolicy.cooldownPeriod) {
        this.applyThrottlePolicy(newPolicy);
      }
    }
  }
  
  private applyThrottlePolicy(policy: ThrottlePolicy): void {
    const previousLevel = this.currentThrottleLevel;
    this.currentThrottleLevel = policy.level;
    this.lastThrottleChange = Date.now();
    
    this.logger.log(`🎚️ Throttle level changed: ${previousLevel} → ${policy.level}`);
    
    // Emit throttle change event
    this.eventEmitter.emit('resource.throttle.changed', {
      previousLevel,
      newLevel: policy.level,
      reductionFactor: policy.reductionFactor
    });
    
    // Apply workload optimization
    this.optimizeWorkloads(policy);
  }
  
  private optimizeWorkloads(policy: ThrottlePolicy): void {
    const optimization = this.workloadOptimizer.optimize(
      Array.from(this.activeWorkloads),
      this.workloadProfiles,
      policy.reductionFactor
    );
    
    // Apply optimizations
    optimization.forEach(opt => {
      this.eventEmitter.emit('workload.optimize', {
        workload: opt.workload,
        action: opt.action,
        factor: opt.factor
      });
    });
  }
  
  private setupEventListeners(): void {
    // Track workload start/end
    this.eventEmitter.on('workload.start', (data: { name: string }) => {
      this.activeWorkloads.add(data.name);
      this.logger.debug(`Workload started: ${data.name}`);
    });
    
    this.eventEmitter.on('workload.end', (data: { name: string }) => {
      this.activeWorkloads.delete(data.name);
      this.logger.debug(`Workload ended: ${data.name}`);
    });
    
    // Handle emergency situations
    this.eventEmitter.on('resource.emergency', () => {
      this.handleEmergency();
    });
  }
  
  private handleEmergency(): void {
    this.logger.error('🚨 Emergency resource situation detected!');
    
    // Apply emergency throttling immediately
    const emergencyPolicy = this.throttlePolicies.find(p => p.level === 'emergency')!;
    this.applyThrottlePolicy(emergencyPolicy);
    
    // Clear non-critical caches
    this.eventEmitter.emit('cache.clear.emergency');
    
    // Pause low-priority workloads
    this.activeWorkloads.forEach(workload => {
      const profile = this.workloadProfiles.get(workload);
      if (profile && profile.priority < 5) {
        this.eventEmitter.emit('workload.pause', { name: workload });
      }
    });
  }
  
  // Public API
  
  public getResourceStatus(): {
    current: { cpu: number; memory: number };
    predicted: ResourcePrediction | null;
    throttleLevel: string;
    activeWorkloads: string[];
    recommendations: string[];
  } {
    const current = {
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage()
    };
    
    const predicted = this.usageHistory.length >= 5
      ? this.predictResourceUsage()
      : null;
    
    const recommendations = this.generateRecommendations(current, predicted);
    
    return {
      current,
      predicted,
      throttleLevel: this.currentThrottleLevel,
      activeWorkloads: Array.from(this.activeWorkloads),
      recommendations
    };
  }
  
  private generateRecommendations(
    current: { cpu: number; memory: number },
    predicted: ResourcePrediction | null
  ): string[] {
    const recommendations: string[] = [];
    
    if (current.memory > 90) {
      recommendations.push('Clear unused caches to free memory');
    }
    
    if (predicted && predicted.riskLevel === 'high') {
      recommendations.push('Consider reducing AI complexity temporarily');
    }
    
    if (this.activeWorkloads.size > 5) {
      recommendations.push('Too many concurrent workloads - consider queuing');
    }
    
    return recommendations;
  }
  
  public async requestWorkload(
    name: string,
    estimatedCpu: number,
    estimatedMemory: number
  ): Promise<{ allowed: boolean; throttleFactor: number }> {
    const current = this.getResourceStatus();
    
    // Check if we can accommodate the workload
    const projectedCpu = current.current.cpu + estimatedCpu;
    const projectedMemory = current.current.memory + estimatedMemory;
    
    if (projectedCpu > this.cpuLimit || projectedMemory > this.memoryLimit) {
      // Check if throttling would help
      const currentPolicy = this.throttlePolicies.find(p => p.level === this.currentThrottleLevel)!;
      const throttledCpu = projectedCpu * currentPolicy.reductionFactor;
      const throttledMemory = projectedMemory * currentPolicy.reductionFactor;
      
      if (throttledCpu <= this.cpuLimit && throttledMemory <= this.memoryLimit) {
        return { allowed: true, throttleFactor: currentPolicy.reductionFactor };
      }
      
      return { allowed: false, throttleFactor: 0 };
    }
    
    return { allowed: true, throttleFactor: 1.0 };
  }
  
  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Prediction Engine using simple time-series analysis
class PredictionEngine {
  private weights = {
    trend: 0.4,
    seasonality: 0.2,
    workload: 0.3,
    noise: 0.1
  };
  
  async initialize(): Promise<void> {
    // Could load historical patterns here
  }
  
  predict(
    history: Array<{ timestamp: number; cpu: number; memory: number; activeWorkloads: string[] }>,
    activeWorkloads: Set<string>,
    horizon: number
  ): Omit<ResourcePrediction, 'riskLevel'> {
    // Calculate trends
    const cpuTrend = this.calculateTrend(history.map(h => h.cpu));
    const memoryTrend = this.calculateTrend(history.map(h => h.memory));
    
    // Calculate workload impact
    const workloadImpact = this.calculateWorkloadImpact(activeWorkloads);
    
    // Make predictions
    const lastCpu = history[history.length - 1].cpu;
    const lastMemory = history[history.length - 1].memory;
    
    const predictedCpu = Math.min(100, Math.max(0,
      lastCpu + (cpuTrend * this.weights.trend) + (workloadImpact.cpu * this.weights.workload)
    ));
    
    const predictedMemory = Math.min(100, Math.max(0,
      lastMemory + (memoryTrend * this.weights.trend) + (workloadImpact.memory * this.weights.workload)
    ));
    
    // Determine trend direction
    const trend = this.determineTrend(cpuTrend, memoryTrend);
    
    // Calculate confidence based on variance
    const confidence = this.calculateConfidence(history);
    
    return {
      timestamp: Date.now() + horizon,
      predictedCpuUsage: predictedCpu,
      predictedMemoryUsage: predictedMemory,
      confidence,
      trend
    };
  }
  
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return slope;
  }
  
  private calculateWorkloadImpact(activeWorkloads: Set<string>): { cpu: number; memory: number } {
    // This would use the workload profiles to estimate impact
    const baseImpact = activeWorkloads.size * 5; // 5% per workload
    return {
      cpu: baseImpact,
      memory: baseImpact * 1.2 // Memory typically impacted more
    };
  }
  
  private determineTrend(cpuTrend: number, memoryTrend: number): 'increasing' | 'stable' | 'decreasing' {
    const avgTrend = (cpuTrend + memoryTrend) / 2;
    
    if (avgTrend > 0.5) return 'increasing';
    if (avgTrend < -0.5) return 'decreasing';
    return 'stable';
  }
  
  private calculateConfidence(history: Array<{ cpu: number; memory: number }>): number {
    if (history.length < 10) return 0.3;
    
    // Calculate variance
    const cpuValues = history.slice(-10).map(h => h.cpu);
    const memoryValues = history.slice(-10).map(h => h.memory);
    
    const cpuVar = this.variance(cpuValues);
    const memoryVar = this.variance(memoryValues);
    
    // Lower variance = higher confidence
    const avgVar = (cpuVar + memoryVar) / 2;
    const confidence = Math.max(0.3, Math.min(0.9, 1 - (avgVar / 100)));
    
    return confidence;
  }
  
  private variance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}

// Workload optimizer
class WorkloadOptimizer {
  optimize(
    activeWorkloads: string[],
    profiles: Map<string, WorkloadProfile>,
    reductionFactor: number
  ): Array<{ workload: string; action: 'throttle' | 'pause' | 'continue'; factor: number }> {
    const optimizations: Array<{ workload: string; action: 'throttle' | 'pause' | 'continue'; factor: number }> = [];
    
    // Sort workloads by priority
    const sortedWorkloads = activeWorkloads
      .map(w => ({ name: w, profile: profiles.get(w)! }))
      .filter(w => w.profile)
      .sort((a, b) => b.profile.priority - a.profile.priority);
    
    // Apply optimization based on reduction factor
    sortedWorkloads.forEach(({ name, profile }) => {
      if (!profile.canThrottle) {
        optimizations.push({ workload: name, action: 'continue', factor: 1.0 });
      } else if (reductionFactor < 0.5 && profile.priority < 5) {
        optimizations.push({ workload: name, action: 'pause', factor: 0 });
      } else {
        const throttleFactor = Math.max(
          reductionFactor,
          profile.throttleRatio * reductionFactor
        );
        optimizations.push({ workload: name, action: 'throttle', factor: throttleFactor });
      }
    });
    
    return optimizations;
  }
}

export { ResourcePrediction, ThrottlePolicy, WorkloadProfile };