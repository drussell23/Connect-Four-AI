/**
 * 📊 Memory Dashboard Controller
 * 
 * Real-time monitoring endpoint for all M1 optimization metrics
 */

import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { DynamicMemoryMonitor } from './dynamic-memory-monitor';
import { BackgroundLearningThrottle } from './background-learning-throttle';
import { GracefulDegradationService } from './graceful-degradation.service';
import { M1StressTestService, StressTestConfig } from './stress-testing/m1-stress-test.service';

export interface DashboardMetrics {
  timestamp: number;
  
  // System metrics
  system: {
    platform: string;
    architecture: string;
    totalMemoryGB: number;
    cpuCores: number;
    isM1: boolean;
  };
  
  // Memory metrics
  memory: {
    heap: {
      usedMB: number;
      totalMB: number;
      percentage: number;
    };
    system: {
      usedMB: number;
      freeMB: number;
      percentage: number;
    };
    pressure: string;
  };
  
  // TensorFlow metrics
  tensorflow: {
    backend: string;
    numTensors: number;
    numBytes: number;
    numBytesInGPU: number;
    modelCount: number;
  };
  
  // Cache metrics
  caches: {
    prediction: CacheMetrics;
    history: CacheMetrics;
    transposition: CacheMetrics;
    total: {
      entries: number;
      memoryMB: number;
      hitRate: number;
    };
  };
  
  // AI metrics
  ai: {
    currentMode: string;
    offloadEnabled: boolean;
    lightweightActive: boolean;
    defensiveMode: boolean;
    inferenceDevice: string;
    avgInferenceTime: number;
  };
  
  // Background tasks
  background: {
    tasksQueued: number;
    tasksRunning: number;
    tasksDeferred: number;
    isPaused: boolean;
    selfPlayActive: boolean;
    trainingActive: boolean;
  };
  
  // Degradation status
  degradation: {
    level: string;
    rateLimits: {
      requestsPerSecond: number;
      currentDelay: number;
    };
    activeClients: number;
    blockedClients: number;
  };
  
  // Phase status
  phases: {
    phase0_detection: boolean;
    phase1_tensorManagement: boolean;
    phase2_adaptiveRuntime: boolean;
    phase3_memoryMonitor: boolean;
    phase4_backgroundThrottle: boolean;
    phase5_emergencyCleanup: boolean;
    phase6_pythonOffload: boolean;
    phase7_smartCaching: boolean;
    phase8_gracefulDegradation: boolean;
  };
}

interface CacheMetrics {
  currentSize: number;
  maxSize: number;
  hitRate: number;
  memoryMB: number;
  ttlMinutes: number;
  lastEviction: number;
}

@Controller('api/dashboard')
export class MemoryDashboardController {
  private readonly logger = new Logger('MemoryDashboard');
  private metricsHistory: DashboardMetrics[] = [];
  private readonly maxHistorySize = 300; // 5 minutes at 1 sample/sec

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly memoryMonitor: DynamicMemoryMonitor,
    private readonly learningThrottle: BackgroundLearningThrottle,
    private readonly degradationService: GracefulDegradationService,
    private readonly stressTestService: M1StressTestService
  ) {
    this.logger.log('🚀 Memory Dashboard Controller initialized');
    this.startMetricsCollection();
  }

  /**
   * Get current dashboard metrics
   */
  @Get('metrics')
  getCurrentMetrics(): DashboardMetrics {
    return this.collectMetrics();
  }

  /**
   * Get metrics history
   */
  @Get('metrics/history')
  getMetricsHistory(): { 
    metrics: DashboardMetrics[]; 
    timeRange: { start: number; end: number };
  } {
    if (this.metricsHistory.length === 0) {
      return {
        metrics: [],
        timeRange: { start: 0, end: 0 }
      };
    }

    return {
      metrics: this.metricsHistory,
      timeRange: {
        start: this.metricsHistory[0].timestamp,
        end: this.metricsHistory[this.metricsHistory.length - 1].timestamp
      }
    };
  }

  /**
   * Start stress test
   */
  @Post('stress-test/start')
  async startStressTest(@Body() config: StressTestConfig): Promise<{ 
    success: boolean; 
    testId: string;
    message: string;
  }> {
    try {
      const testId = `test_${Date.now()}`;
      
      // Start test asynchronously
      this.stressTestService.runStressTest(config).then(metrics => {
        this.logger.log(`Stress test ${testId} completed`, metrics);
        this.eventEmitter.emit('stress.test.completed', metrics);
      }).catch(error => {
        this.logger.error(`Stress test ${testId} failed`, error);
        this.eventEmitter.emit('stress.test.failed', { testId, error });
      });

      return {
        success: true,
        testId,
        message: 'Stress test started'
      };
    } catch (error) {
      return {
        success: false,
        testId: '',
        message: error.message
      };
    }
  }

  /**
   * Get stress test status
   */
  @Get('stress-test/status')
  getStressTestStatus(): {
    activeTests: any[];
    isRunning: boolean;
  } {
    const activeTests = this.stressTestService.getActiveTests();
    
    return {
      activeTests,
      isRunning: activeTests.length > 0
    };
  }

  /**
   * Get system health summary
   */
  @Get('health-summary')
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.collectMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check memory pressure
    if (metrics.memory.pressure === 'critical') {
      issues.push('Critical memory pressure detected');
      recommendations.push('Run emergency cleanup: POST /api/emergency/cleanup');
    } else if (metrics.memory.pressure === 'high') {
      issues.push('High memory pressure detected');
      recommendations.push('Monitor closely, cleanup may be needed soon');
    }

    // Check TensorFlow tensors
    if (metrics.tensorflow.numTensors > 1000) {
      issues.push(`High tensor count: ${metrics.tensorflow.numTensors}`);
      recommendations.push('Check for tensor leaks in models');
    }

    // Check cache efficiency
    const totalHitRate = metrics.caches.total.hitRate;
    if (totalHitRate < 0.5) {
      issues.push(`Low cache hit rate: ${(totalHitRate * 100).toFixed(1)}%`);
      recommendations.push('Consider increasing cache sizes or TTL');
    }

    // Check background tasks
    if (metrics.background.tasksDeferred > 10) {
      issues.push(`${metrics.background.tasksDeferred} tasks deferred`);
      recommendations.push('System under load, tasks being delayed');
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (metrics.memory.pressure === 'critical' || issues.length > 3) {
      status = 'critical';
    } else if (metrics.memory.pressure === 'high' || issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      issues,
      recommendations
    };
  }

  /**
   * Collect all metrics
   */
  private collectMetrics(): DashboardMetrics {
    const config = M1PerformanceOptimizer.getOptimizationConfig();
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const tfMemory = tf.memory();
    const memoryState = this.memoryMonitor.getCurrentState();
    const throttleStats = this.learningThrottle.getStatistics();
    const degradationStats = this.degradationService.getStatistics();

    // Mock cache stats for now - would get from actual cache services
    const mockCacheStats = {
      prediction: this.getMockCacheMetrics('prediction', 1000, 0.85),
      history: this.getMockCacheMetrics('history', 500, 0.75),
      transposition: this.getMockCacheMetrics('transposition', 50000, 0.90)
    };

    const totalCacheEntries = 
      mockCacheStats.prediction.currentSize + 
      mockCacheStats.history.currentSize + 
      mockCacheStats.transposition.currentSize;

    const totalCacheMemory = 
      mockCacheStats.prediction.memoryMB + 
      mockCacheStats.history.memoryMB + 
      mockCacheStats.transposition.memoryMB;

    const avgHitRate = 
      (mockCacheStats.prediction.hitRate + 
       mockCacheStats.history.hitRate + 
       mockCacheStats.transposition.hitRate) / 3;

    const metrics: DashboardMetrics = {
      timestamp: Date.now(),
      
      system: {
        platform: process.platform,
        architecture: process.arch,
        totalMemoryGB: config.totalMemoryGB,
        cpuCores: config.cpuCores,
        isM1: config.isM1Architecture
      },
      
      memory: {
        heap: {
          usedMB: memStats.heapUsedMB,
          totalMB: memStats.heapTotalMB,
          percentage: memStats.heapPercentage
        },
        system: {
          usedMB: memStats.usedMB,
          freeMB: memStats.freeMB,
          percentage: (memStats.usedMB / memStats.totalMB) * 100
        },
        pressure: memoryState.level
      },
      
      tensorflow: {
        backend: tf.getBackend(),
        numTensors: tfMemory.numTensors,
        numBytes: tfMemory.numBytes,
        numBytesInGPU: (tfMemory as any).numBytesInGPU || 0,
        modelCount: 3 // Would get from model registry
      },
      
      caches: {
        prediction: mockCacheStats.prediction,
        history: mockCacheStats.history,
        transposition: mockCacheStats.transposition,
        total: {
          entries: totalCacheEntries,
          memoryMB: totalCacheMemory,
          hitRate: avgHitRate
        }
      },
      
      ai: {
        currentMode: degradationStats.defensiveMode ? 'defensive' : 'normal',
        offloadEnabled: true, // Would get from offload service
        lightweightActive: degradationStats.defensiveMode,
        defensiveMode: degradationStats.defensiveMode,
        inferenceDevice: config.isM1Architecture ? 'mps' : 'cpu',
        avgInferenceTime: 50 // Would calculate from actual metrics
      },
      
      background: {
        tasksQueued: throttleStats.queue.pending,
        tasksRunning: throttleStats.queue.running,
        tasksDeferred: throttleStats.queue.deferred,
        isPaused: throttleStats.system.isPaused,
        selfPlayActive: false, // Would get from self-play service
        trainingActive: throttleStats.queue.running > 0
      },
      
      degradation: {
        level: degradationStats.currentLevel,
        rateLimits: {
          requestsPerSecond: degradationStats.rateLimitConfig.maxRequests,
          currentDelay: degradationStats.rateLimitConfig.delayMs
        },
        activeClients: degradationStats.clients.active,
        blockedClients: degradationStats.clients.blocked
      },
      
      phases: {
        phase0_detection: config.isM1Architecture,
        phase1_tensorManagement: true,
        phase2_adaptiveRuntime: true,
        phase3_memoryMonitor: true,
        phase4_backgroundThrottle: true,
        phase5_emergencyCleanup: true,
        phase6_pythonOffload: true,
        phase7_smartCaching: true,
        phase8_gracefulDegradation: true
      }
    };

    return metrics;
  }

  /**
   * Get mock cache metrics (would be replaced with real cache stats)
   */
  private getMockCacheMetrics(
    name: string,
    maxSize: number,
    hitRate: number
  ): CacheMetrics {
    const currentSize = Math.floor(maxSize * Math.random() * 0.8);
    const memoryPerEntry = name === 'transposition' ? 0.004 : 0.05;
    
    return {
      currentSize,
      maxSize,
      hitRate,
      memoryMB: currentSize * memoryPerEntry,
      ttlMinutes: name === 'prediction' ? 5 : name === 'history' ? 10 : 30,
      lastEviction: Date.now() - Math.floor(Math.random() * 60000)
    };
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    this.logger.log('📊 Starting metrics collection (1s interval)');
    
    // Emit first metric immediately
    const initialMetrics = this.collectMetrics();
    this.eventEmitter.emit('dashboard.metrics', initialMetrics);
    this.logger.log('📊 Emitted initial metrics');
    
    setInterval(() => {
      const metrics = this.collectMetrics();
      
      // Add to history
      this.metricsHistory.push(metrics);
      
      // Trim history if too large
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      // Emit for WebSocket
      this.eventEmitter.emit('dashboard.metrics', metrics);
      this.logger.debug('📊 Emitted metrics update');
    }, 1000); // Collect every second
  }
}