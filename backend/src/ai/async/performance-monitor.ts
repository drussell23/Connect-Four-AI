// backend/src/ai/async/performance-monitor.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as os from 'os';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface OperationTrace {
  operationId: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  metadata?: Record<string, any>;
  spans: SpanTrace[];
}

export interface SpanTrace {
  spanId: string;
  spanName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parentSpanId?: string;
  attributes?: Record<string, any>;
}

export interface ErrorReport {
  errorId: string;
  timestamp: number;
  errorType: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number;
  lastOccurrence: number;
}

export interface SystemHealth {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
  };
  eventLoop: {
    latency: number;
    utilization: number;
  };
  uptime: number;
  timestamp: number;
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
  };
  operations: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  errors: {
    total: number;
    unique: number;
    topErrors: ErrorReport[];
  };
  systemHealth: SystemHealth;
  aiMetrics: {
    cacheHitRate: number;
    avgInferenceTime: number;
    strategySwitches: number;
    circuitBreakerTrips: number;
  };
}

@Injectable()
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  private readonly metrics: PerformanceMetric[] = [];
  private readonly operations = new Map<string, OperationTrace>();
  private readonly errors = new Map<string, ErrorReport>();
  private readonly maxMetricsSize = 5000; // Reduced from 10000
  private readonly maxOperationsSize = 500; // Reduced from 1000
  
  private eventLoopMonitor?: NodeJS.Timeout;
  private systemHealthMonitor?: NodeJS.Timeout;
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {
    this.startMonitoring();
  }

  /**
   * Start an operation trace
   */
  startOperation(operationName: string, metadata?: Record<string, any>): string {
    const operationId = `${operationName}-${Date.now()}-${Math.random()}`;
    
    const operation: OperationTrace = {
      operationId,
      operationName,
      startTime: Date.now(),
      status: 'running',
      metadata,
      spans: []
    };

    this.operations.set(operationId, operation);
    
    // Clean up old operations if needed
    if (this.operations.size > this.maxOperationsSize) {
      const oldestKey = this.operations.keys().next().value;
      this.operations.delete(oldestKey);
    }

    return operationId;
  }

  /**
   * End an operation trace
   */
  endOperation(operationId: string, status: 'completed' | 'failed', error?: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.status = status;
    if (error) operation.error = error;

    // Record metric
    this.recordMetric({
      name: `operation.${operation.operationName}.duration`,
      value: operation.duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags: { status }
    });

    // Emit event
    this.eventEmitter.emit('performance.operation.completed', operation);

    // Check for slow operations
    if (operation.duration > 1000) {
      this.logger.warn(`Slow operation detected: ${operation.operationName} took ${operation.duration}ms`);
    }
  }

  /**
   * Start a span within an operation
   */
  startSpan(operationId: string, spanName: string, parentSpanId?: string): string {
    const operation = this.operations.get(operationId);
    if (!operation) return '';

    const spanId = `${spanName}-${Date.now()}-${Math.random()}`;
    
    const span: SpanTrace = {
      spanId,
      spanName,
      startTime: Date.now(),
      parentSpanId
    };

    operation.spans.push(span);
    return spanId;
  }

  /**
   * End a span
   */
  endSpan(operationId: string, spanId: string, attributes?: Record<string, any>): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    const span = operation.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    if (attributes) span.attributes = attributes;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Clean up old metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }

    // Check for anomalies
    this.checkForAnomalies(metric);
  }

  /**
   * Record an error
   */
  recordError(error: Error, context?: Record<string, any>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const errorKey = `${error.name}-${error.message}`;
    
    const existingError = this.errors.get(errorKey);
    
    if (existingError) {
      existingError.frequency++;
      existingError.lastOccurrence = Date.now();
    } else {
      const errorReport: ErrorReport = {
        errorId: `error-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        errorType: error.name,
        message: error.message,
        stack: error.stack,
        context,
        severity,
        frequency: 1,
        lastOccurrence: Date.now()
      };
      
      this.errors.set(errorKey, errorReport);
    }

    // Emit error event
    this.eventEmitter.emit('performance.error', {
      error: this.errors.get(errorKey),
      isNew: !existingError
    });

    // Log critical errors
    if (severity === 'critical') {
      this.logger.error(`Critical error: ${error.message}`, error.stack);
    }
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length;

    return {
      cpu: {
        usage: cpuUsage * 100,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentUsed: (usedMemory / totalMemory) * 100
      },
      eventLoop: await this.measureEventLoopLatency(),
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Generate performance report
   */
  async generateReport(periodMs: number = 3600000): Promise<PerformanceReport> {
    const now = Date.now();
    const start = now - periodMs;

    // Filter operations within period
    const periodOperations = Array.from(this.operations.values())
      .filter(op => op.startTime >= start);

    // Calculate operation metrics
    const completedOps = periodOperations.filter(op => op.status === 'completed');
    const failedOps = periodOperations.filter(op => op.status === 'failed');
    const durations = completedOps.map(op => op.duration || 0).sort((a, b) => a - b);

    const operationMetrics = {
      total: periodOperations.length,
      successful: completedOps.length,
      failed: failedOps.length,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p50Duration: this.percentile(durations, 0.5),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99)
    };

    // Filter errors within period
    const periodErrors = Array.from(this.errors.values())
      .filter(err => err.timestamp >= start);

    const errorMetrics = {
      total: periodErrors.reduce((sum, err) => sum + err.frequency, 0),
      unique: periodErrors.length,
      topErrors: periodErrors
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
    };

    // Get AI-specific metrics
    const aiMetrics = await this.getAIMetrics(start, now);

    // Get system health
    const systemHealth = await this.getSystemHealth();

    return {
      period: { start, end: now },
      operations: operationMetrics,
      errors: errorMetrics,
      systemHealth,
      aiMetrics
    };
  }

  /**
   * Set up alerting thresholds
   */
  setAlertThreshold(
    metricName: string,
    threshold: number,
    condition: 'above' | 'below',
    callback: (metric: PerformanceMetric) => void
  ): void {
    this.eventEmitter.on('performance.metric', (metric: PerformanceMetric) => {
      if (metric.name === metricName) {
        if (
          (condition === 'above' && metric.value > threshold) ||
          (condition === 'below' && metric.value < threshold)
        ) {
          callback(metric);
        }
      }
    });
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Group metrics by name
    const metricGroups = new Map<string, PerformanceMetric[]>();
    
    for (const metric of this.metrics) {
      const group = metricGroups.get(metric.name) || [];
      group.push(metric);
      metricGroups.set(metric.name, group);
    }

    // Export each metric group
    for (const [name, metrics] of metricGroups) {
      const latestMetric = metrics[metrics.length - 1];
      const metricName = name.replace(/\./g, '_');
      
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`# UNIT ${metricName} ${latestMetric.unit}`);
      
      if (latestMetric.tags) {
        const labels = Object.entries(latestMetric.tags)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${metricName}{${labels}} ${latestMetric.value}`);
      } else {
        lines.push(`${metricName} ${latestMetric.value}`);
      }
    }

    return lines.join('\n');
  }

  private startMonitoring(): void {
    // Monitor event loop latency (reduced frequency)
    this.eventLoopMonitor = setInterval(async () => {
      const latency = await this.measureEventLoopLatency();
      
      this.recordMetric({
        name: 'system.eventloop.latency',
        value: latency.latency,
        unit: 'ms',
        timestamp: Date.now()
      });

      this.recordMetric({
        name: 'system.eventloop.utilization',
        value: latency.utilization,
        unit: 'percent',
        timestamp: Date.now()
      });
    }, 5000); // Increased from 1 second to 5 seconds

    // Monitor system health (reduced frequency)
    this.systemHealthMonitor = setInterval(async () => {
      const health = await this.getSystemHealth();
      
      this.recordMetric({
        name: 'system.cpu.usage',
        value: health.cpu.usage,
        unit: 'percent',
        timestamp: Date.now()
      });

      this.recordMetric({
        name: 'system.memory.used',
        value: health.memory.percentUsed,
        unit: 'percent',
        timestamp: Date.now()
      });
      
      // Proactive memory cleanup at 85% usage
      if (health.memory.percentUsed > 85) {
        this.logger.warn(`Memory usage at ${health.memory.percentUsed.toFixed(2)}%, triggering proactive cleanup`);
        this.triggerMemoryCleanup();
      }
    }, 10000); // Increased from 5 seconds to 10 seconds

    // Register intervals with scheduler
    this.schedulerRegistry.addInterval('eventLoopMonitor', this.eventLoopMonitor);
    this.schedulerRegistry.addInterval('systemHealthMonitor', this.systemHealthMonitor);
  }

  private async measureEventLoopLatency(): Promise<{ latency: number; utilization: number }> {
    const start = process.hrtime.bigint();
    
    await new Promise(resolve => setImmediate(resolve));
    
    const end = process.hrtime.bigint();
    const latency = Number(end - start) / 1e6; // Convert to milliseconds
    
    // Estimate utilization (simplified)
    const utilization = Math.min(100, latency * 10); // Rough estimate
    
    return { latency, utilization };
  }

  private checkForAnomalies(metric: PerformanceMetric): void {
    // Check for high latency
    if (metric.name.includes('latency') && metric.value > 100) {
      this.logger.warn(`High latency detected: ${metric.name} = ${metric.value}${metric.unit}`);
    }

    // Check for high error rate
    if (metric.name.includes('error.rate') && metric.value > 0.05) {
      this.logger.warn(`High error rate detected: ${metric.value * 100}%`);
    }

    // Check for memory issues
    if (metric.name === 'system.memory.used' && metric.value > 90) {
      this.logger.error(`Critical memory usage: ${metric.value}%`);
      // Trigger cleanup when memory is critical
      this.triggerMemoryCleanup();
    }
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  private triggerMemoryCleanup(): void {
    this.logger.warn('Triggering memory cleanup...');
    
    // Clear old metrics beyond half the max size
    if (this.metrics.length > this.maxMetricsSize / 2) {
      const toRemove = this.metrics.length - Math.floor(this.maxMetricsSize / 2);
      this.metrics.splice(0, toRemove);
      this.logger.warn(`Removed ${toRemove} old metrics`);
    }
    
    // Clear old operations
    if (this.operations.size > this.maxOperationsSize / 2) {
      const entries = Array.from(this.operations.entries());
      const toRemove = entries.slice(0, Math.floor(this.operations.size / 2));
      toRemove.forEach(([key]) => this.operations.delete(key));
      this.logger.warn(`Removed ${toRemove.length} old operations`);
    }
    
    // Clear old errors
    if (this.errors.size > 100) {
      const entries = Array.from(this.errors.entries());
      const toRemove = entries.slice(0, 50);
      toRemove.forEach(([key]) => this.errors.delete(key));
      this.logger.warn(`Removed ${toRemove.length} old errors`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.logger.warn('Forced garbage collection');
    }
    
    // Emit memory cleanup event
    this.eventEmitter.emit('performance.memory.cleanup', {
      timestamp: Date.now(),
      metricsRemaining: this.metrics.length,
      operationsRemaining: this.operations.size,
      errorsRemaining: this.errors.size
    });
  }

  private async getAIMetrics(start: number, end: number): Promise<{
    cacheHitRate: number;
    avgInferenceTime: number;
    strategySwitches: number;
    circuitBreakerTrips: number;
  }> {
    // Filter AI-related metrics
    const aiMetrics = this.metrics.filter(m => 
      m.timestamp >= start && 
      m.timestamp <= end &&
      (m.name.includes('cache') || m.name.includes('inference') || m.name.includes('strategy') || m.name.includes('circuit'))
    );

    // Calculate cache hit rate
    const cacheHits = aiMetrics.filter(m => m.name === 'cache.hit').length;
    const cacheMisses = aiMetrics.filter(m => m.name === 'cache.miss').length;
    const cacheHitRate = cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    // Calculate average inference time
    const inferenceTimes = aiMetrics
      .filter(m => m.name === 'ai.inference.time')
      .map(m => m.value);
    const avgInferenceTime = inferenceTimes.length > 0
      ? inferenceTimes.reduce((a, b) => a + b, 0) / inferenceTimes.length
      : 0;

    // Count strategy switches
    const strategySwitches = aiMetrics.filter(m => m.name === 'strategy.switch').length;

    // Count circuit breaker trips
    const circuitBreakerTrips = aiMetrics.filter(m => m.name === 'circuit.open').length;

    return {
      cacheHitRate,
      avgInferenceTime,
      strategySwitches,
      circuitBreakerTrips
    };
  }

  onModuleDestroy(): void {
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
    }
    if (this.systemHealthMonitor) {
      clearInterval(this.systemHealthMonitor);
    }
  }
}