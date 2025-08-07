/**
 * 🚨 Dynamic Memory Monitor
 * 
 * Real-time memory monitoring with automatic intervention
 * to maintain system responsiveness on M1 Macs
 */

import * as os from 'os';
import { Logger, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { TensorFlowMemoryManager } from './tensorflow-memory-manager';

export enum MemoryPressureLevel {
  NORMAL = 'normal',      // < 70% usage
  MODERATE = 'moderate',  // 70-80% usage
  HIGH = 'high',         // 80-90% usage
  CRITICAL = 'critical'  // > 90% usage
}

export interface MemoryState {
  level: MemoryPressureLevel;
  heapUsagePercent: number;
  systemUsagePercent: number;
  tensorCount: number;
  timestamp: number;
}

export interface MemoryThresholds {
  moderate: number;  // Default 70%
  high: number;      // Default 80%
  critical: number;  // Default 90%
}

@Injectable()
export class DynamicMemoryMonitor {
  private readonly logger = new Logger('DynamicMemoryMonitor');
  private monitorInterval: NodeJS.Timeout;
  private currentState: MemoryState;
  private thresholds: MemoryThresholds;
  private isLightweightMode = false;
  private backgroundTasksPaused = false;
  private emergencyCleanupInProgress = false;
  
  // Track services that can be throttled
  private throttleableServices = new Set<string>();
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly config = M1PerformanceOptimizer.getOptimizationConfig()
  ) {
    this.thresholds = {
      moderate: 0.70,
      high: 0.80,
      critical: 0.90
    };
    
    this.currentState = {
      level: MemoryPressureLevel.NORMAL,
      heapUsagePercent: 0,
      systemUsagePercent: 0,
      tensorCount: 0,
      timestamp: Date.now()
    };
    
    this.logger.log('Dynamic Memory Monitor initialized');
    this.logger.log(`Thresholds - Moderate: ${this.thresholds.moderate * 100}%, High: ${this.thresholds.high * 100}%, Critical: ${this.thresholds.critical * 100}%`);
  }
  
  /**
   * Start monitoring memory
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitorInterval) {
      this.logger.warn('Monitor already running');
      return;
    }
    
    this.logger.log(`Starting memory monitoring (interval: ${intervalMs}ms)`);
    
    // Initial check
    this.checkMemory();
    
    // Regular monitoring
    this.monitorInterval = setInterval(() => {
      this.checkMemory();
    }, intervalMs);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.logger.log('Memory monitoring stopped');
    }
  }
  
  /**
   * Register a service that can be throttled
   */
  registerThrottleableService(serviceId: string): void {
    this.throttleableServices.add(serviceId);
    this.logger.log(`Registered throttleable service: ${serviceId}`);
  }
  
  /**
   * Check current memory state
   */
  private async checkMemory(): Promise<void> {
    try {
      // Get memory stats
      const memStats = M1PerformanceOptimizer.getMemoryStats();
      const tfMemory = TensorFlowMemoryManager.getMemoryInfo();
      
      // Calculate system memory usage
      const systemUsagePercent = (memStats.usedMB / memStats.totalMB);
      const heapUsagePercent = memStats.heapPercentage / 100;
      
      // Determine pressure level
      const newLevel = this.determinePressureLevel(heapUsagePercent, systemUsagePercent);
      
      // Update state
      const previousLevel = this.currentState.level;
      this.currentState = {
        level: newLevel,
        heapUsagePercent,
        systemUsagePercent,
        tensorCount: tfMemory.numTensors,
        timestamp: Date.now()
      };
      
      // Log state changes
      if (newLevel !== previousLevel) {
        this.logger.log(`Memory pressure changed: ${previousLevel} → ${newLevel}`);
        this.logger.log(`Heap: ${Math.round(heapUsagePercent * 100)}%, System: ${Math.round(systemUsagePercent * 100)}%, Tensors: ${tfMemory.numTensors}`);
      }
      
      // Take action based on pressure level
      await this.handleMemoryPressure(newLevel, previousLevel);
      
      // Emit state change event
      this.eventEmitter.emit('memory.state.changed', this.currentState);
      
    } catch (error) {
      this.logger.error('Memory check failed:', error);
    }
  }
  
  /**
   * Determine memory pressure level
   */
  private determinePressureLevel(
    heapPercent: number,
    systemPercent: number
  ): MemoryPressureLevel {
    // Use the higher of heap or system usage
    const usage = Math.max(heapPercent, systemPercent);
    
    if (usage >= this.thresholds.critical) {
      return MemoryPressureLevel.CRITICAL;
    } else if (usage >= this.thresholds.high) {
      return MemoryPressureLevel.HIGH;
    } else if (usage >= this.thresholds.moderate) {
      return MemoryPressureLevel.MODERATE;
    }
    
    return MemoryPressureLevel.NORMAL;
  }
  
  /**
   * Handle memory pressure changes
   */
  private async handleMemoryPressure(
    currentLevel: MemoryPressureLevel,
    previousLevel: MemoryPressureLevel
  ): Promise<void> {
    // Escalating pressure
    if (this.isPressureIncreasing(previousLevel, currentLevel)) {
      switch (currentLevel) {
        case MemoryPressureLevel.MODERATE:
          await this.handleModeratePressure();
          break;
          
        case MemoryPressureLevel.HIGH:
          await this.handleHighPressure();
          break;
          
        case MemoryPressureLevel.CRITICAL:
          await this.handleCriticalPressure();
          break;
      }
    }
    
    // Decreasing pressure - restore functionality
    else if (this.isPressureDecreasing(previousLevel, currentLevel)) {
      switch (currentLevel) {
        case MemoryPressureLevel.NORMAL:
          await this.restoreNormalOperation();
          break;
          
        case MemoryPressureLevel.MODERATE:
          await this.restoreFromHighPressure();
          break;
          
        case MemoryPressureLevel.HIGH:
          await this.restoreFromCriticalPressure();
          break;
      }
    }
  }
  
  /**
   * Handle moderate memory pressure (70-80%)
   */
  private async handleModeratePressure(): Promise<void> {
    this.logger.warn('📊 Moderate memory pressure - optimizing performance');
    
    // Emit events for services to reduce activity
    this.eventEmitter.emit('memory.pressure.moderate', {
      action: 'reduce_activity',
      timestamp: Date.now()
    });
    
    // Request cache size reduction
    this.eventEmitter.emit('cache.resize', { factor: 0.8 });
    
    // Log action
    this.logger.log('Actions taken: Requested activity reduction, cache resize to 80%');
  }
  
  /**
   * Handle high memory pressure (80-90%)
   */
  private async handleHighPressure(): Promise<void> {
    this.logger.warn('🚨 High memory pressure - pausing background tasks');
    
    if (!this.backgroundTasksPaused) {
      // Pause background training and self-play
      this.eventEmitter.emit('training.pause', {
        reason: 'high_memory_pressure',
        timestamp: Date.now()
      });
      
      this.eventEmitter.emit('selfplay.pause', {
        reason: 'high_memory_pressure',
        timestamp: Date.now()
      });
      
      this.backgroundTasksPaused = true;
      
      // Shrink buffers and caches
      this.eventEmitter.emit('buffer.resize', { factor: 0.5 });
      this.eventEmitter.emit('cache.resize', { factor: 0.5 });
      
      // Request garbage collection
      if (global.gc) {
        this.logger.log('Running garbage collection');
        global.gc();
      }
      
      // Clean up TensorFlow memory
      TensorFlowMemoryManager.performCleanup();
      
      this.logger.log('Actions taken: Paused background tasks, reduced buffers/caches by 50%, ran GC');
    }
  }
  
  /**
   * Handle critical memory pressure (>90%)
   */
  private async handleCriticalPressure(): Promise<void> {
    this.logger.error('🆘 CRITICAL memory pressure - emergency measures activated');
    
    if (!this.emergencyCleanupInProgress) {
      this.emergencyCleanupInProgress = true;
      
      // Enter lightweight inference mode
      if (!this.isLightweightMode) {
        this.eventEmitter.emit('inference.lightweight.enable', {
          reason: 'critical_memory_pressure',
          timestamp: Date.now()
        });
        this.isLightweightMode = true;
      }
      
      // Suspend ALL background tasks
      this.eventEmitter.emit('background.tasks.suspend.all', {
        reason: 'critical_memory_pressure',
        timestamp: Date.now()
      });
      
      // Emergency cache clear
      this.eventEmitter.emit('cache.clear.all', {
        reason: 'critical_memory_pressure',
        timestamp: Date.now()
      });
      
      // Aggressive TensorFlow cleanup
      TensorFlowMemoryManager.performCleanup();
      
      // Force multiple GC runs
      if (global.gc) {
        this.logger.log('Running aggressive garbage collection');
        for (let i = 0; i < 3; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      this.logger.log('Emergency actions: Lightweight mode, suspended all tasks, cleared caches, aggressive GC');
      
      this.emergencyCleanupInProgress = false;
    }
  }
  
  /**
   * Restore from critical pressure
   */
  private async restoreFromCriticalPressure(): Promise<void> {
    this.logger.log('📈 Memory pressure reduced from CRITICAL to HIGH');
    
    // Exit lightweight mode
    if (this.isLightweightMode) {
      this.eventEmitter.emit('inference.lightweight.disable', {
        reason: 'memory_pressure_reduced',
        timestamp: Date.now()
      });
      this.isLightweightMode = false;
    }
    
    // Caches remain small, background tasks stay suspended
  }
  
  /**
   * Restore from high pressure
   */
  private async restoreFromHighPressure(): Promise<void> {
    this.logger.log('📈 Memory pressure reduced from HIGH to MODERATE');
    
    // Gradually restore cache sizes
    this.eventEmitter.emit('cache.resize', { factor: 0.7 });
    
    // Background tasks remain paused
  }
  
  /**
   * Restore normal operation
   */
  private async restoreNormalOperation(): Promise<void> {
    this.logger.log('✅ Memory pressure normalized - restoring full operation');
    
    // Resume background tasks if they were paused
    if (this.backgroundTasksPaused) {
      this.eventEmitter.emit('training.resume', {
        reason: 'memory_pressure_normal',
        timestamp: Date.now()
      });
      
      this.eventEmitter.emit('selfplay.resume', {
        reason: 'memory_pressure_normal',
        timestamp: Date.now()
      });
      
      this.backgroundTasksPaused = false;
    }
    
    // Restore cache and buffer sizes
    this.eventEmitter.emit('buffer.resize', { factor: 1.0 });
    this.eventEmitter.emit('cache.resize', { factor: 1.0 });
    
    this.logger.log('Full operation restored');
  }
  
  /**
   * Check if pressure is increasing
   */
  private isPressureIncreasing(
    previous: MemoryPressureLevel,
    current: MemoryPressureLevel
  ): boolean {
    const levels = [
      MemoryPressureLevel.NORMAL,
      MemoryPressureLevel.MODERATE,
      MemoryPressureLevel.HIGH,
      MemoryPressureLevel.CRITICAL
    ];
    
    const prevIndex = levels.indexOf(previous);
    const currIndex = levels.indexOf(current);
    
    return currIndex > prevIndex;
  }
  
  /**
   * Check if pressure is decreasing
   */
  private isPressureDecreasing(
    previous: MemoryPressureLevel,
    current: MemoryPressureLevel
  ): boolean {
    const levels = [
      MemoryPressureLevel.NORMAL,
      MemoryPressureLevel.MODERATE,
      MemoryPressureLevel.HIGH,
      MemoryPressureLevel.CRITICAL
    ];
    
    const prevIndex = levels.indexOf(previous);
    const currIndex = levels.indexOf(current);
    
    return currIndex < prevIndex;
  }
  
  /**
   * Get current memory state
   */
  getCurrentState(): MemoryState {
    return { ...this.currentState };
  }
  
  /**
   * Get memory statistics
   */
  getStatistics() {
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const tfMemory = TensorFlowMemoryManager.getMemoryInfo();
    
    return {
      current: this.currentState,
      system: {
        totalMB: memStats.totalMB,
        usedMB: memStats.usedMB,
        freeMB: memStats.freeMB,
        usagePercent: Math.round((memStats.usedMB / memStats.totalMB) * 100)
      },
      heap: {
        usedMB: memStats.heapUsedMB,
        totalMB: memStats.heapTotalMB,
        usagePercent: memStats.heapPercentage
      },
      tensorflow: {
        tensors: tfMemory.numTensors,
        bytesUsed: tfMemory.numBytes,
        mbUsed: Math.round(tfMemory.numBytes / 1024 / 1024)
      },
      status: {
        lightweightMode: this.isLightweightMode,
        backgroundTasksPaused: this.backgroundTasksPaused,
        pressureLevel: this.currentState.level
      }
    };
  }
  
  /**
   * Force memory cleanup (manual trigger)
   */
  async forceCleanup(): Promise<void> {
    this.logger.warn('Manual memory cleanup triggered');
    await this.handleHighPressure();
  }
}

// Export singleton instance factory
export const createMemoryMonitor = (eventEmitter: EventEmitter2) => {
  return new DynamicMemoryMonitor(eventEmitter);
};