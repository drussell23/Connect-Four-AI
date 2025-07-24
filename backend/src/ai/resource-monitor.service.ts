import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  freeMemory: number;
  totalMemory: number;
  loadAverage: number[];
  timestamp: number;
}

export interface ThrottleDecision {
  shouldThrottle: boolean;
  reason?: string;
  suggestedDelay?: number;
  metrics: ResourceMetrics;
}

@Injectable()
export class ResourceMonitorService {
  private readonly logger = new Logger(ResourceMonitorService.name);
  private readonly cpuThreshold = 0.8; // 80% CPU usage
  private readonly memoryThreshold = 0.85; // 85% memory usage
  private readonly checkInterval = 1000; // Check every second
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: ResourceMetrics | null = null;
  private cpuHistory: number[] = [];
  private readonly historySize = 10;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous resource monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.checkInterval);
    
    this.logger.log('🔍 Resource monitoring started');
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.log('🛑 Resource monitoring stopped');
    }
  }

  /**
   * Collect current system resource metrics
   */
  private collectMetrics(): void {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Calculate CPU usage (simplified)
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
    const cpuUsage = 1 - (idle / total);
    
    // Update CPU history
    this.cpuHistory.push(cpuUsage);
    if (this.cpuHistory.length > this.historySize) {
      this.cpuHistory.shift();
    }
    
    this.lastMetrics = {
      cpuUsage,
      memoryUsage: usedMemory / totalMemory,
      freeMemory,
      totalMemory,
      loadAverage: os.loadavg(),
      timestamp: Date.now()
    };
  }

  /**
   * Get current resource metrics
   */
  getCurrentMetrics(): ResourceMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Check if AI requests should be throttled based on resource usage
   */
  shouldThrottleRequest(): ThrottleDecision {
    if (!this.lastMetrics) {
      return {
        shouldThrottle: false,
        metrics: this.getDefaultMetrics()
      };
    }

    const avgCpuUsage = this.getAverageCpuUsage();
    
    // Check CPU threshold
    if (avgCpuUsage > this.cpuThreshold) {
      return {
        shouldThrottle: true,
        reason: `CPU usage too high: ${(avgCpuUsage * 100).toFixed(1)}%`,
        suggestedDelay: Math.min(5000, (avgCpuUsage - this.cpuThreshold) * 10000),
        metrics: this.lastMetrics
      };
    }

    // Check memory threshold
    if (this.lastMetrics.memoryUsage > this.memoryThreshold) {
      return {
        shouldThrottle: true,
        reason: `Memory usage too high: ${(this.lastMetrics.memoryUsage * 100).toFixed(1)}%`,
        suggestedDelay: 3000,
        metrics: this.lastMetrics
      };
    }

    // Check load average (for Unix systems)
    const loadThreshold = os.cpus().length * 2; // 2x number of CPUs
    if (this.lastMetrics.loadAverage[0] > loadThreshold) {
      return {
        shouldThrottle: true,
        reason: `System load too high: ${this.lastMetrics.loadAverage[0].toFixed(2)}`,
        suggestedDelay: 2000,
        metrics: this.lastMetrics
      };
    }

    return {
      shouldThrottle: false,
      metrics: this.lastMetrics
    };
  }

  /**
   * Get average CPU usage from history
   */
  private getAverageCpuUsage(): number {
    if (this.cpuHistory.length === 0) {
      return 0;
    }
    
    const sum = this.cpuHistory.reduce((a, b) => a + b, 0);
    return sum / this.cpuHistory.length;
  }

  /**
   * Get default metrics when none are available
   */
  private getDefaultMetrics(): ResourceMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      loadAverage: os.loadavg(),
      timestamp: Date.now()
    };
  }

  /**
   * Get resource usage summary
   */
  getResourceSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    cpuUsage: string;
    memoryUsage: string;
    loadAverage: string;
    recommendation: string;
  } {
    const metrics = this.lastMetrics || this.getDefaultMetrics();
    const avgCpu = this.getAverageCpuUsage();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let recommendation = 'System resources are healthy';
    
    if (avgCpu > 0.9 || metrics.memoryUsage > 0.9) {
      status = 'critical';
      recommendation = 'Critical resource usage - consider reducing AI complexity';
    } else if (avgCpu > this.cpuThreshold || metrics.memoryUsage > this.memoryThreshold) {
      status = 'warning';
      recommendation = 'High resource usage - AI requests may be throttled';
    }
    
    return {
      status,
      cpuUsage: `${(avgCpu * 100).toFixed(1)}%`,
      memoryUsage: `${(metrics.memoryUsage * 100).toFixed(1)}%`,
      loadAverage: metrics.loadAverage.map(l => l.toFixed(2)).join(', '),
      recommendation
    };
  }

  /**
   * Wait for resources to become available
   */
  async waitForResources(maxWaitTime: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const decision = this.shouldThrottleRequest();
      if (!decision.shouldThrottle) {
        return true;
      }
      
      // Wait for suggested delay or 500ms
      await new Promise(resolve => setTimeout(resolve, decision.suggestedDelay || 500));
    }
    
    return false;
  }

  onModuleDestroy() {
    this.stopMonitoring();
  }
}