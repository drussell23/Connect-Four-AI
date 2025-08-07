/**
 * 🚨 Emergency Cleanup Controller
 * 
 * Provides endpoints for manual memory recovery and system reset
 * when automatic measures aren't sufficient
 */

import { Controller, Post, Get, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs';
import { TensorFlowMemoryManager } from './tensorflow-memory-manager';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { DynamicMemoryMonitor } from './dynamic-memory-monitor';

export interface CleanupResult {
  success: boolean;
  timestamp: number;
  actions: string[];
  memoryBefore: {
    heapUsedMB: number;
    heapTotalMB: number;
    systemUsedMB: number;
    tensorCount: number;
  };
  memoryAfter: {
    heapUsedMB: number;
    heapTotalMB: number;
    systemUsedMB: number;
    tensorCount: number;
  };
  freedMB: number;
  tensorsFreed: number;
}

@Controller('api/emergency')
export class EmergencyCleanupController {
  private readonly logger = new Logger('EmergencyCleanup');
  private isCleanupInProgress = false;
  private lastCleanupTime = 0;
  private readonly minCleanupInterval = 5000; // 5 seconds between cleanups

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly memoryMonitor: DynamicMemoryMonitor
  ) {}

  /**
   * Emergency memory cleanup endpoint
   */
  @Post('cleanup')
  async performEmergencyCleanup(): Promise<CleanupResult> {
    // Prevent concurrent cleanups
    if (this.isCleanupInProgress) {
      throw new HttpException(
        'Cleanup already in progress',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastCleanupTime < this.minCleanupInterval) {
      throw new HttpException(
        `Please wait ${Math.ceil((this.minCleanupInterval - (now - this.lastCleanupTime)) / 1000)} seconds before next cleanup`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    this.isCleanupInProgress = true;
    this.lastCleanupTime = now;

    const actions: string[] = [];
    const memoryBefore = this.captureMemoryState();

    try {
      this.logger.warn('🚨 Emergency cleanup initiated');

      // Step 1: Pause all background activities
      actions.push('Paused all background tasks');
      this.eventEmitter.emit('emergency.cleanup.start', { timestamp: now });
      this.eventEmitter.emit('background.tasks.suspend.all', {
        reason: 'emergency_cleanup',
        timestamp: now
      });

      // Step 2: Clear all caches
      actions.push('Cleared all caches');
      this.eventEmitter.emit('cache.clear.all', {
        reason: 'emergency_cleanup',
        timestamp: now
      });

      // Step 3: TensorFlow cleanup
      const tfCleanupResult = await this.performTensorFlowCleanup();
      actions.push(`TensorFlow cleanup: ${tfCleanupResult}`);

      // Step 4: Force garbage collection (multiple passes)
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        actions.push('Performed 3 garbage collection passes');
      } else {
        actions.push('Garbage collection not available');
      }

      // Step 5: Enable lightweight mode
      this.eventEmitter.emit('inference.lightweight.enable', {
        reason: 'emergency_cleanup',
        timestamp: now
      });
      actions.push('Enabled lightweight inference mode');

      // Step 6: Shrink all buffers to minimum
      this.eventEmitter.emit('buffer.resize', { factor: 0.25 });
      actions.push('Reduced all buffers to 25% capacity');

      // Step 7: Clear model cache if exists
      this.eventEmitter.emit('models.cache.clear', {
        reason: 'emergency_cleanup'
      });
      actions.push('Cleared model cache');

      // Wait for actions to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      const memoryAfter = this.captureMemoryState();
      const freedMB = (memoryBefore.heapUsedMB - memoryAfter.heapUsedMB);
      const tensorsFreed = memoryBefore.tensorCount - memoryAfter.tensorCount;

      this.logger.warn(`Emergency cleanup complete: freed ${freedMB.toFixed(2)}MB, ${tensorsFreed} tensors`);

      // Emit completion event
      this.eventEmitter.emit('emergency.cleanup.complete', {
        timestamp: Date.now(),
        freedMB,
        tensorsFreed
      });

      return {
        success: true,
        timestamp: now,
        actions,
        memoryBefore,
        memoryAfter,
        freedMB,
        tensorsFreed
      };

    } catch (error) {
      this.logger.error('Emergency cleanup failed:', error);
      throw new HttpException(
        'Emergency cleanup failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    } finally {
      this.isCleanupInProgress = false;
    }
  }

  /**
   * Reset TensorFlow completely
   */
  @Post('reset-tensorflow')
  async resetTensorFlow(): Promise<{ success: boolean; message: string }> {
    this.logger.warn('🔄 TensorFlow reset requested');

    try {
      // Dispose all variables
      tf.disposeVariables();

      // Clear any custom registries
      TensorFlowMemoryManager.performCleanup();

      // Reset the backend
      await tf.setBackend('cpu');
      await tf.ready();

      // Re-enable webgl if available
      try {
        const webglVersion = tf.env().getNumber('WEBGL_VERSION');
        if (webglVersion >= 1) {
          await tf.setBackend('webgl');
        }
      } catch (e) {
        // WebGL not available
      }

      return {
        success: true,
        message: 'TensorFlow reset complete'
      };
    } catch (error) {
      this.logger.error('TensorFlow reset failed:', error);
      throw new HttpException(
        'TensorFlow reset failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get current memory status
   */
  @Get('status')
  async getEmergencyStatus() {
    const memoryState = this.memoryMonitor.getCurrentState();
    const memoryStats = this.captureMemoryState();
    const isEmergencyMode = memoryState.level === 'critical';

    return {
      timestamp: Date.now(),
      emergencyMode: isEmergencyMode,
      memoryPressure: memoryState.level,
      memory: {
        ...memoryStats,
        heapPercentage: (memoryStats.heapUsedMB / memoryStats.heapTotalMB * 100).toFixed(1),
        systemPercentage: memoryState.systemUsagePercent.toFixed(1)
      },
      tensorflow: {
        backend: tf.getBackend(),
        numTensors: tf.memory().numTensors,
        numBytes: tf.memory().numBytes,
        numBytesInGPU: (tf.memory() as any).numBytesInGPU || 0
      },
      recommendations: this.getRecommendations(memoryState.level)
    };
  }

  /**
   * Force immediate garbage collection
   */
  @Post('gc')
  async forceGarbageCollection(): Promise<{ success: boolean; message: string }> {
    if (!global.gc) {
      throw new HttpException(
        'Garbage collection not available. Run with --expose-gc flag',
        HttpStatus.NOT_IMPLEMENTED
      );
    }

    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();

    const freedMB = ((before.heapUsed - after.heapUsed) / 1024 / 1024).toFixed(2);

    return {
      success: true,
      message: `Garbage collection complete. Freed ${freedMB}MB`
    };
  }

  /**
   * Perform TensorFlow-specific cleanup
   */
  private async performTensorFlowCleanup(): Promise<string> {
    const startTensors = tf.memory().numTensors;

    // Dispose all variables
    tf.disposeVariables();

    // Run TensorFlow memory manager cleanup
    TensorFlowMemoryManager.performCleanup();

    // Tidy any remaining tensors
    tf.tidy(() => {
      // This will dispose any tensors created in this scope
    });

    const endTensors = tf.memory().numTensors;
    const disposed = startTensors - endTensors;

    return `Disposed ${disposed} tensors`;
  }

  /**
   * Capture current memory state
   */
  private captureMemoryState() {
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const tfMemory = tf.memory();

    return {
      heapUsedMB: memStats.heapUsedMB,
      heapTotalMB: memStats.heapTotalMB,
      systemUsedMB: memStats.usedMB,
      tensorCount: tfMemory.numTensors
    };
  }

  /**
   * Get recommendations based on memory pressure
   */
  private getRecommendations(level: string): string[] {
    const recommendations: string[] = [];

    switch (level) {
      case 'critical':
        recommendations.push('Use emergency cleanup immediately');
        recommendations.push('Consider restarting the service');
        recommendations.push('Disable all non-essential features');
        break;
      case 'high':
        recommendations.push('Monitor closely, cleanup may be needed soon');
        recommendations.push('Avoid starting new training sessions');
        break;
      case 'moderate':
        recommendations.push('System operating normally with reduced capacity');
        break;
      default:
        recommendations.push('System operating normally');
    }

    return recommendations;
  }
}