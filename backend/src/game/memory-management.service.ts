import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { DynamicMemoryMonitor, MemoryPressureLevel } from '../ai/m1-optimized/dynamic-memory-monitor';
import { TensorFlowMemoryManager } from '../ai/m1-optimized/tensorflow-memory-manager';
import { GracefulDegradationService } from '../ai/m1-optimized/graceful-degradation.service';
import { AdaptiveCacheManager } from '../ai/m1-optimized/adaptive-cache-manager';
import { BackgroundLearningThrottle } from '../ai/m1-optimized/background-learning-throttle';
import { LightweightInferenceService } from '../ai/m1-optimized/lightweight-inference.service';
import * as os from 'os';

@Injectable()
export class MemoryManagementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryManagementService.name);
  private memoryMonitor: DynamicMemoryMonitor;
  private isEnabled: boolean;
  private lastCleanupTime: number = 0;
  private cleanupInterval: number = 30000; // 30 seconds minimum between cleanups
  private cacheManager: AdaptiveCacheManager;
  private isBackgroundThrottleActive: boolean = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly degradationService: GracefulDegradationService,
    private readonly backgroundThrottle?: BackgroundLearningThrottle,
    private readonly lightweightInference?: LightweightInferenceService
  ) {
    // Enable memory management based on environment or platform
    this.isEnabled = process.env.ENABLE_M1_FEATURES === 'true' || 
                    process.env.M1_OPTIMIZED === 'true' ||
                    this.isM1Mac();
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.log('Memory management disabled - not on M1 or not enabled');
      return;
    }

    this.logger.log('🧠 Initializing enhanced memory management service...');
    
    // Initialize TensorFlow memory manager
    TensorFlowMemoryManager.initialize(5000);
    
    // Create memory monitor
    this.memoryMonitor = new DynamicMemoryMonitor(this.eventEmitter);
    this.memoryMonitor.startMonitoring();
    
    // Initialize adaptive cache manager for AI move caching
    this.cacheManager = new AdaptiveCacheManager('ai-moves', 100, {
      ttl: 300000, // 5 minutes
      adaptiveResize: true,
      cleanupIntervalMs: 60000
    });
    
    // Start background learning throttle if available
    if (this.backgroundThrottle) {
      this.backgroundThrottle.start();
      this.isBackgroundThrottleActive = true;
      this.logger.log('✅ Background learning throttle activated');
    }
    
    // Switch to lightweight inference if available
    if (this.lightweightInference) {
      this.logger.log('✅ Lightweight inference service available for high memory pressure');
    }
    
    // Listen for memory pressure events
    this.eventEmitter.on('memory.state.changed', (state) => {
      this.handleMemoryStateChange(state);
    });

    this.eventEmitter.on('memory.cleanup.needed', () => {
      this.performCleanup();
    });
    
    // Listen for emergency cleanup requests
    this.eventEmitter.on('emergency.cleanup.start', () => {
      this.logger.warn('🚨 Emergency cleanup triggered');
      this.performEmergencyCleanup();
    });

    this.logger.log('✅ Enhanced memory management service initialized');
  }

  async onModuleDestroy() {
    if (this.memoryMonitor) {
      this.memoryMonitor.stopMonitoring();
    }
    if (this.backgroundThrottle && this.isBackgroundThrottleActive) {
      this.backgroundThrottle.stop();
    }
    if (this.cacheManager) {
      this.cacheManager.clear();
    }
  }

  /**
   * Check memory usage every 10 seconds
   */
  @Interval(10000)
  async checkMemoryHealth() {
    if (!this.isEnabled) return;

    const memInfo = process.memoryUsage();
    const systemMem = os.freemem() / os.totalmem();
    const heapUsed = memInfo.heapUsed / memInfo.heapTotal;

    // Log memory stats
    this.logger.debug(`Memory: Heap ${(heapUsed * 100).toFixed(1)}%, System ${((1 - systemMem) * 100).toFixed(1)}%`);

    // Check TensorFlow memory
    const tfMemory = TensorFlowMemoryManager.getMemoryInfo();
    if (tfMemory.numTensors > 500) {
      this.logger.warn(`⚠️ High tensor count: ${tfMemory.numTensors}`);
      TensorFlowMemoryManager.performCleanup();
    }

    // Trigger cleanup if needed
    if (heapUsed > 0.8 || systemMem < 0.2) {
      this.performCleanup();
    }
  }

  private handleMemoryStateChange(state: { level: MemoryPressureLevel }) {
    this.logger.log(`Memory pressure changed to: ${state.level}`);

    switch (state.level) {
      case MemoryPressureLevel.MODERATE:
        // Reduce cache size
        if (this.cacheManager) {
          this.cacheManager.resize(50);
        }
        // Emit event to throttle background tasks
        this.eventEmitter.emit('memory.pressure.moderate');
        break;
        
      case MemoryPressureLevel.HIGH:
        // Aggressive cache reduction
        if (this.cacheManager) {
          this.cacheManager.resize(25);
        }
        // Switch to lightweight inference
        this.eventEmitter.emit('inference.mode.lightweight', true);
        // Emit high pressure event
        this.eventEmitter.emit('memory.pressure.high');
        this.performCleanup();
        break;
        
      case MemoryPressureLevel.CRITICAL:
        // Clear cache completely
        if (this.cacheManager) {
          this.cacheManager.clear();
        }
        // Stop background learning completely
        if (this.backgroundThrottle && this.isBackgroundThrottleActive) {
          this.backgroundThrottle.stop();
          this.isBackgroundThrottleActive = false;
        }
        this.performEmergencyCleanup();
        break;
        
      case MemoryPressureLevel.NORMAL:
        // Restore normal operation
        if (this.cacheManager) {
          this.cacheManager.resize(100);
        }
        // Restart background learning if it was stopped
        if (this.backgroundThrottle && !this.isBackgroundThrottleActive) {
          this.backgroundThrottle.start();
          this.isBackgroundThrottleActive = true;
        }
        this.eventEmitter.emit('inference.mode.lightweight', false);
        this.eventEmitter.emit('memory.pressure.normal');
        break;
    }
  }

  private performCleanup() {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.cleanupInterval) {
      return; // Skip if cleaned up recently
    }

    this.logger.warn('🧹 Performing memory cleanup...');
    this.lastCleanupTime = now;

    try {
      // Clean up TensorFlow tensors
      TensorFlowMemoryManager.performCleanup();
      const disposedTensors = TensorFlowMemoryManager.disposeQueue();
      this.logger.log(`Disposed ${disposedTensors} tensors`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.log('Forced garbage collection');
      }

      // Emit cleanup event for other services
      this.eventEmitter.emit('memory.cleanup.performed', {
        timestamp: now,
        tensorsDisposed: disposedTensors
      });

    } catch (error) {
      this.logger.error(`Memory cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get current memory stats
   */
  getMemoryStats() {
    const memInfo = process.memoryUsage();
    const systemMem = os.freemem() / os.totalmem();
    const tfMemory = TensorFlowMemoryManager.getMemoryInfo();

    return {
      heap: {
        used: memInfo.heapUsed,
        total: memInfo.heapTotal,
        percentage: (memInfo.heapUsed / memInfo.heapTotal) * 100
      },
      system: {
        free: os.freemem(),
        total: os.totalmem(),
        percentage: (1 - systemMem) * 100
      },
      tensorflow: {
        tensors: tfMemory.numTensors,
        bytes: tfMemory.numBytes,
        megabytes: tfMemory.numBytes / 1024 / 1024
      },
      degradationLevel: this.degradationService ? 'normal' : 'unknown' // Graceful degradation service is optional
    };
  }

  /**
   * Perform emergency cleanup
   */
  private performEmergencyCleanup() {
    this.logger.error('🚨 EMERGENCY CLEANUP INITIATED');
    
    try {
      // 1. Stop all background tasks
      if (this.backgroundThrottle) {
        this.backgroundThrottle.stop();
        this.isBackgroundThrottleActive = false;
      }
      
      // 2. Clear all caches
      if (this.cacheManager) {
        const stats = this.cacheManager.getStats();
        this.logger.warn(`Clearing cache with ${stats.currentSize} entries`);
        this.cacheManager.clear();
      }
      
      // 3. Aggressive TensorFlow cleanup
      TensorFlowMemoryManager.performCleanup();
      
      // 4. Force garbage collection multiple times
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
        }
        this.logger.log('Forced multiple garbage collections');
      }
      
      // 5. Emit emergency state to all services
      this.eventEmitter.emit('system.emergency.active', true);
      
      // 6. Log final state
      const memStats = this.getMemoryStats();
      this.logger.warn('Emergency cleanup complete', memStats);
      
    } catch (error) {
      this.logger.error(`Emergency cleanup failed: ${error.message}`);
    }
  }

  /**
   * Force immediate cleanup
   */
  forceCleanup() {
    this.lastCleanupTime = 0; // Reset timer
    this.performCleanup();
  }
  
  /**
   * Get cache manager for external use
   */
  getCacheManager(): AdaptiveCacheManager | undefined {
    return this.cacheManager;
  }
  
  /**
   * Check if lightweight inference is active
   */
  isLightweightModeActive(): boolean {
    return this.memoryMonitor?.getCurrentState()?.level !== MemoryPressureLevel.NORMAL;
  }

  private isM1Mac(): boolean {
    return process.platform === 'darwin' && process.arch === 'arm64';
  }
}