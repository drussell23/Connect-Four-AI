import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AIPerformanceMetric {
  timestamp: number;
  gameId: string;
  strategy: string;
  difficulty: number;
  thinkingTime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
  outcome: 'success' | 'failure' | 'timeout';
  moveQuality?: number; // 0-1 score
  adaptiveSettings?: {
    caching: boolean;
    parallelism: number;
    modelDepth: number;
  };
}

export interface PerformanceTrend {
  strategy: string;
  averageThinkingTime: number;
  averageResourceUsage: {
    cpu: number;
    memory: number;
  };
  successRate: number;
  totalMoves: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface SystemPerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  totalMoves: number;
  averageResponseTime: number;
  resourceEfficiency: number;
  strategyBreakdown: Record<string, PerformanceTrend>;
  recommendations: string[];
}

@Injectable()
export class AIPerformanceCollector {
  private readonly logger = new Logger(AIPerformanceCollector.name);
  private readonly metrics: AIPerformanceMetric[] = [];
  private readonly maxMetricsSize = 10000; // Reduced from 100000
  private readonly metricsFilePath = path.join(process.cwd(), 'data', 'ai-performance-metrics.json');
  
  // Performance tracking
  private readonly strategyPerformance = new Map<string, {
    totalTime: number;
    totalCpu: number;
    totalMemory: number;
    successCount: number;
    totalCount: number;
    recentMetrics: AIPerformanceMetric[];
  }>();
  
  // Real-time monitoring
  private currentLoad = {
    activeRequests: 0,
    averageResponseTime: 0,
    peakCpuUsage: 0,
    peakMemoryUsage: 0
  };

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initialize();
  }

  /**
   * Initialize the performance collector
   */
  private async initialize(): Promise<void> {
    this.logger.log('📊 Initializing AI Performance Collector...');
    
    // Load historical metrics
    await this.loadHistoricalMetrics();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    this.logger.log('✅ AI Performance Collector initialized');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<AIPerformanceMetric, 'timestamp'>): void {
    const fullMetric: AIPerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };
    
    // Add to memory
    this.metrics.push(fullMetric);
    
    // Update strategy performance
    this.updateStrategyPerformance(fullMetric);
    
    // Maintain size limit
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
    
    // Update current load
    this.updateCurrentLoad(fullMetric);
    
    // Emit event for real-time monitoring
    this.eventEmitter.emit('performance.metric.recorded', fullMetric);
  }

  /**
   * Update strategy-specific performance tracking
   */
  private updateStrategyPerformance(metric: AIPerformanceMetric): void {
    let strategyData = this.strategyPerformance.get(metric.strategy);
    
    if (!strategyData) {
      strategyData = {
        totalTime: 0,
        totalCpu: 0,
        totalMemory: 0,
        successCount: 0,
        totalCount: 0,
        recentMetrics: []
      };
      this.strategyPerformance.set(metric.strategy, strategyData);
    }
    
    // Update totals
    strategyData.totalTime += metric.thinkingTime;
    strategyData.totalCpu += metric.resourceUsage.cpu;
    strategyData.totalMemory += metric.resourceUsage.memory;
    strategyData.totalCount++;
    
    if (metric.outcome === 'success') {
      strategyData.successCount++;
    }
    
    // Keep recent metrics for trend analysis
    strategyData.recentMetrics.push(metric);
    if (strategyData.recentMetrics.length > 100) {
      strategyData.recentMetrics.shift();
    }
  }

  /**
   * Update current system load metrics
   */
  private updateCurrentLoad(metric: AIPerformanceMetric): void {
    // Update average response time (exponential moving average)
    this.currentLoad.averageResponseTime = 
      this.currentLoad.averageResponseTime * 0.9 + metric.thinkingTime * 0.1;
    
    // Track peak usage
    this.currentLoad.peakCpuUsage = Math.max(
      this.currentLoad.peakCpuUsage,
      metric.resourceUsage.cpu
    );
    
    this.currentLoad.peakMemoryUsage = Math.max(
      this.currentLoad.peakMemoryUsage,
      metric.resourceUsage.memory
    );
  }

  /**
   * Get performance trends for each strategy
   */
  getPerformanceTrends(): Record<string, PerformanceTrend> {
    const trends: Record<string, PerformanceTrend> = {};
    
    for (const [strategy, data] of this.strategyPerformance.entries()) {
      const avgThinkingTime = data.totalTime / data.totalCount;
      const avgCpu = data.totalCpu / data.totalCount;
      const avgMemory = data.totalMemory / data.totalCount;
      const successRate = data.successCount / data.totalCount;
      
      // Analyze trend from recent metrics
      const trend = this.analyzeTrend(data.recentMetrics);
      
      trends[strategy] = {
        strategy,
        averageThinkingTime: avgThinkingTime,
        averageResourceUsage: {
          cpu: avgCpu,
          memory: avgMemory
        },
        successRate,
        totalMoves: data.totalCount,
        trend
      };
    }
    
    return trends;
  }

  /**
   * Analyze performance trend
   */
  private analyzeTrend(recentMetrics: AIPerformanceMetric[]): 'improving' | 'stable' | 'degrading' {
    if (recentMetrics.length < 10) {
      return 'stable';
    }
    
    // Compare first half vs second half
    const midpoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, midpoint);
    const secondHalf = recentMetrics.slice(midpoint);
    
    const avgTimeFirst = firstHalf.reduce((sum, m) => sum + m.thinkingTime, 0) / firstHalf.length;
    const avgTimeSecond = secondHalf.reduce((sum, m) => sum + m.thinkingTime, 0) / secondHalf.length;
    
    const avgCpuFirst = firstHalf.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / firstHalf.length;
    const avgCpuSecond = secondHalf.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / secondHalf.length;
    
    // Check if performance is improving (lower time and resource usage)
    const timeImprovement = (avgTimeFirst - avgTimeSecond) / avgTimeFirst;
    const cpuImprovement = (avgCpuFirst - avgCpuSecond) / avgCpuFirst;
    
    if (timeImprovement > 0.1 && cpuImprovement > 0.05) {
      return 'improving';
    } else if (timeImprovement < -0.1 || cpuImprovement < -0.05) {
      return 'degrading';
    }
    
    return 'stable';
  }

  /**
   * Generate performance report
   */
  generateReport(periodHours: number = 24): SystemPerformanceReport {
    const now = Date.now();
    const periodStart = now - (periodHours * 60 * 60 * 1000);
    
    // Filter metrics for the period
    const periodMetrics = this.metrics.filter(m => m.timestamp >= periodStart);
    
    if (periodMetrics.length === 0) {
      return this.getEmptyReport(periodStart, now);
    }
    
    // Calculate overall metrics
    const totalMoves = periodMetrics.length;
    const avgResponseTime = periodMetrics.reduce((sum, m) => sum + m.thinkingTime, 0) / totalMoves;
    const avgCpu = periodMetrics.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / totalMoves;
    const avgMemory = periodMetrics.reduce((sum, m) => sum + m.resourceUsage.memory, 0) / totalMoves;
    
    // Resource efficiency: inverse of resource usage per successful move
    const successfulMoves = periodMetrics.filter(m => m.outcome === 'success').length;
    const resourceEfficiency = successfulMoves / (totalMoves * (avgCpu + avgMemory) / 2);
    
    // Get trends
    const strategyBreakdown = this.getPerformanceTrends();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      strategyBreakdown,
      avgResponseTime,
      resourceEfficiency
    );
    
    return {
      period: {
        start: new Date(periodStart),
        end: new Date(now)
      },
      totalMoves,
      averageResponseTime: avgResponseTime,
      resourceEfficiency,
      strategyBreakdown,
      recommendations
    };
  }

  /**
   * Generate recommendations based on performance data
   */
  private generateRecommendations(
    trends: Record<string, PerformanceTrend>,
    avgResponseTime: number,
    resourceEfficiency: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Check response time
    if (avgResponseTime > 5000) {
      recommendations.push('Consider reducing AI complexity for faster response times');
    }
    
    // Check resource efficiency
    if (resourceEfficiency < 0.5) {
      recommendations.push('Enable caching and precomputation to improve resource efficiency');
    }
    
    // Check strategy performance
    for (const [strategy, trend] of Object.entries(trends)) {
      if (trend.trend === 'degrading') {
        recommendations.push(`Strategy "${strategy}" is showing performance degradation - consider retraining`);
      }
      
      if (trend.successRate < 0.8) {
        recommendations.push(`Strategy "${strategy}" has low success rate (${(trend.successRate * 100).toFixed(1)}%)`);
      }
      
      if (trend.averageResourceUsage.cpu > 0.7) {
        recommendations.push(`Strategy "${strategy}" is CPU-intensive - consider optimization`);
      }
    }
    
    // Check for imbalanced strategy usage
    const strategyUsage = Object.values(trends).map(t => t.totalMoves);
    const maxUsage = Math.max(...strategyUsage);
    const minUsage = Math.min(...strategyUsage);
    
    if (maxUsage > minUsage * 10) {
      recommendations.push('Strategy usage is imbalanced - consider adaptive strategy selection');
    }
    
    return recommendations;
  }

  /**
   * Get empty report structure
   */
  private getEmptyReport(start: number, end: number): SystemPerformanceReport {
    return {
      period: {
        start: new Date(start),
        end: new Date(end)
      },
      totalMoves: 0,
      averageResponseTime: 0,
      resourceEfficiency: 0,
      strategyBreakdown: {},
      recommendations: ['No data available for the specified period']
    };
  }

  /**
   * Subscribe to system events
   */
  private subscribeToEvents(): void {
    // Track AI move completions
    this.eventEmitter.on('ai.move.completed', (event: {
      strategy: string;
      thinkingTime: number;
      success: boolean;
      gameId?: string;
      difficulty?: number;
    }) => {
      // Get current resource metrics
      const resourceMetrics = this.getCurrentResourceMetrics();
      
      this.recordMetric({
        gameId: event.gameId || 'unknown',
        strategy: event.strategy,
        difficulty: event.difficulty || 5,
        thinkingTime: event.thinkingTime,
        resourceUsage: resourceMetrics,
        outcome: event.success ? 'success' : 'failure'
      });
    });
    
    // Track request lifecycle
    this.eventEmitter.on('ai.request.start', () => {
      this.currentLoad.activeRequests++;
    });
    
    this.eventEmitter.on('ai.request.end', () => {
      this.currentLoad.activeRequests = Math.max(0, this.currentLoad.activeRequests - 1);
    });
  }

  /**
   * Get current resource metrics from process
   */
  private getCurrentResourceMetrics(): { cpu: number; memory: number } {
    const usage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    // Simple CPU percentage (this is approximate)
    const cpuPercent = (usage.user + usage.system) / 1000000 / 100;
    
    // Memory usage as percentage of heap
    const memPercent = memUsage.heapUsed / memUsage.heapTotal;
    
    return {
      cpu: Math.min(1, cpuPercent),
      memory: memPercent
    };
  }

  /**
   * Load historical metrics from disk
   */
  private async loadHistoricalMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFilePath, 'utf-8');
      const historical = JSON.parse(data) as AIPerformanceMetric[];
      
      // Load recent metrics only
      const recentMetrics = historical.filter(
        m => m.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
      );
      
      this.metrics.push(...recentMetrics);
      
      // Rebuild strategy performance
      for (const metric of recentMetrics) {
        this.updateStrategyPerformance(metric);
      }
      
      this.logger.log(`Loaded ${recentMetrics.length} historical metrics`);
    } catch (error) {
      this.logger.debug('No historical metrics found');
    }
  }

  /**
   * Save metrics to disk (called periodically)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async saveMetrics(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.metricsFilePath), { recursive: true });
      
      // Save recent metrics
      const recentMetrics = this.metrics.slice(-10000); // Keep last 10k metrics
      await fs.writeFile(
        this.metricsFilePath,
        JSON.stringify(recentMetrics, null, 2)
      );
      
      this.logger.debug(`Saved ${recentMetrics.length} metrics to disk`);
    } catch (error) {
      this.logger.error('Failed to save metrics:', error);
    }
  }

  /**
   * Get current system load
   */
  getCurrentLoad() {
    return { ...this.currentLoad };
  }

  /**
   * Reset peak usage metrics (called periodically)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  resetPeakMetrics(): void {
    this.currentLoad.peakCpuUsage = 0;
    this.currentLoad.peakMemoryUsage = 0;
    this.logger.log('Peak usage metrics reset');
  }

  /**
   * Clean up old metrics
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldMetrics(): Promise<void> {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const beforeCount = this.metrics.length;
    
    // Remove old metrics
    this.metrics.splice(0, this.metrics.findIndex(m => m.timestamp > oneWeekAgo));
    
    const removed = beforeCount - this.metrics.length;
    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} old metrics`);
    }
  }
}