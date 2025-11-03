/**
 * 🚀 M1 Performance Optimizer
 * 
 * Intelligent resource management for Apple Silicon Macs
 * Automatically detects M1/M2/M3 architecture and applies optimizations
 */

import * as os from 'os';
import { Logger } from '@nestjs/common';

export interface M1OptimizationConfig {
  isM1Architecture: boolean;
  totalMemoryGB: number;
  cpuCores: number;
  recommendedSettings: {
    maxOldSpaceSize: number;
    tfNumThreads: number;
    replayBufferSize: number;
    cacheMaxSize: number;
    enableBackgroundTraining: boolean;
    enableSelfPlay: boolean;
    batchSize: number;
    predictionCacheSize: number;
    transpositionTableSize: number;
  };
}

export class M1PerformanceOptimizer {
  private static readonly logger = new Logger('M1PerformanceOptimizer');
  
  /**
   * Detect if running on Apple Silicon and get optimization config
   */
  static getOptimizationConfig(): M1OptimizationConfig {
    const platform = os.platform();
    const arch = os.arch();
    const totalMemory = os.totalmem();
    const totalMemoryGB = Math.floor(totalMemory / (1024 * 1024 * 1024));
    const cpuCores = os.cpus().length;
    
    // Detect Apple Silicon (M1/M2/M3)
    const isM1Architecture = platform === 'darwin' && arch === 'arm64';
    
    // Log system info
    this.logger.log(`System Detection: ${platform} ${arch}, ${totalMemoryGB}GB RAM, ${cpuCores} cores`);
    
    if (isM1Architecture) {
      this.logger.log('🍎 Apple Silicon detected - applying M1 optimizations');
    }
    
    // Calculate recommended settings based on available resources
    const recommendedSettings = this.calculateRecommendedSettings(
      isM1Architecture,
      totalMemoryGB,
      cpuCores
    );
    
    return {
      isM1Architecture,
      totalMemoryGB,
      cpuCores,
      recommendedSettings
    };
  }
  
  /**
   * Calculate optimal settings based on system resources
   */
  private static calculateRecommendedSettings(
    isM1: boolean,
    memoryGB: number,
    cores: number
  ) {
    // Base settings for resource-constrained environments
    let settings = {
      maxOldSpaceSize: 512,
      tfNumThreads: 2,
      replayBufferSize: 1000,
      cacheMaxSize: 100,
      enableBackgroundTraining: false,
      enableSelfPlay: false,
      batchSize: 16,
      predictionCacheSize: 50,
      transpositionTableSize: 10000
    };
    
    if (isM1) {
      // M1-specific optimizations
      if (memoryGB >= 32) {
        // M1 Pro/Max with 32GB+ RAM
        settings = {
          maxOldSpaceSize: 3072,
          tfNumThreads: Math.min(cores / 2, 4),
          replayBufferSize: 30000,
          cacheMaxSize: 800,
          enableBackgroundTraining: true,
          enableSelfPlay: false, // Still disable to reduce background load
          batchSize: 64,
          predictionCacheSize: 300,
          transpositionTableSize: 80000
        };
      } else if (memoryGB >= 16) {
        // M1 with 16GB RAM - More conservative than Pro/Max
        settings = {
          maxOldSpaceSize: 2048,
          tfNumThreads: Math.min(cores / 2, 4),
          replayBufferSize: 20000, // 20k as per Phase 2 requirements
          cacheMaxSize: 500,
          enableBackgroundTraining: true,
          enableSelfPlay: false, // Still disable to reduce background load
          batchSize: 32,
          predictionCacheSize: 200,
          transpositionTableSize: 50000 // Limit to 50k as per Phase 2
        };
      } else if (memoryGB >= 8) {
        // Base M1 with 8GB RAM
        settings = {
          maxOldSpaceSize: 1024,
          tfNumThreads: 2,
          replayBufferSize: 10000, // 10k as per Phase 2 requirements
          cacheMaxSize: 200,
          enableBackgroundTraining: false,
          enableSelfPlay: false,
          batchSize: 16,
          predictionCacheSize: 100,
          transpositionTableSize: 20000
        };
      }
    } else {
      // Intel/AMD optimizations
      if (memoryGB >= 32) {
        settings = {
          maxOldSpaceSize: 4096,
          tfNumThreads: Math.min(cores / 2, 8),
          replayBufferSize: 10000,
          cacheMaxSize: 1000,
          enableBackgroundTraining: true,
          enableSelfPlay: true,
          batchSize: 64,
          predictionCacheSize: 500,
          transpositionTableSize: 100000
        };
      } else if (memoryGB >= 16) {
        settings = {
          maxOldSpaceSize: 2048,
          tfNumThreads: Math.min(cores / 2, 4),
          replayBufferSize: 5000,
          cacheMaxSize: 500,
          enableBackgroundTraining: true,
          enableSelfPlay: false,
          batchSize: 32,
          predictionCacheSize: 200,
          transpositionTableSize: 50000
        };
      }
    }
    
    return settings;
  }
  
  /**
   * Apply environment variables for TensorFlow optimization
   */
  static applyTensorFlowOptimizations(config: M1OptimizationConfig): void {
    if (config.isM1Architecture) {
      // M1-specific TensorFlow settings
      process.env.TF_NUM_INTRAOP_THREADS = config.recommendedSettings.tfNumThreads.toString();
      process.env.TF_NUM_INTEROP_THREADS = '1';
      process.env.TF_CPP_MIN_LOG_LEVEL = '2'; // Reduce logging overhead
      process.env.TF_ENABLE_ONEDNN_OPTS = '0'; // Disable for M1
      
      this.logger.log(`Applied M1 TensorFlow optimizations: ${config.recommendedSettings.tfNumThreads} threads`);
    } else {
      // Standard TensorFlow settings
      process.env.TF_NUM_INTRAOP_THREADS = config.recommendedSettings.tfNumThreads.toString();
      process.env.TF_NUM_INTEROP_THREADS = '2';
    }
  }
  
  /**
   * Get memory usage statistics
   */
  static getMemoryStats() {
    const used = process.memoryUsage();
    const totalMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeMB = Math.round(os.freemem() / 1024 / 1024);
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    
    return {
      totalMB,
      freeMB,
      usedMB: totalMB - freeMB,
      heapUsedMB,
      heapTotalMB,
      heapPercentage: Math.round((heapUsedMB / heapTotalMB) * 100)
    };
  }
  
  /**
   * Monitor memory pressure and suggest GC if needed
   */
  static checkMemoryPressure(): boolean {
    const stats = this.getMemoryStats();
    const pressureThresholdPercent = 80; // 80% heap usage

    if (stats.heapPercentage > pressureThresholdPercent) {
      this.logger.warn(`High memory pressure detected: ${stats.heapPercentage}% heap usage`);

      // Force garbage collection if enabled
      if (global.gc) {
        this.logger.log('Running garbage collection...');
        global.gc();
        return true;
      }
    }

    return false;
  }
  
  /**
   * Create a resource-aware configuration for AI services
   */
  static createResourceAwareConfig() {
    const config = this.getOptimizationConfig();
    
    return {
      // Memory management
      enableMemoryMonitoring: true,
      gcInterval: config.isM1Architecture ? 30000 : 60000, // More frequent GC on M1
      
      // AI training settings
      training: {
        enabled: config.recommendedSettings.enableBackgroundTraining,
        batchSize: config.recommendedSettings.batchSize,
        replayBufferSize: config.recommendedSettings.replayBufferSize,
        updateFrequency: config.isM1Architecture ? 1000 : 500
      },
      
      // Self-play settings
      selfPlay: {
        enabled: config.recommendedSettings.enableSelfPlay,
        concurrentGames: config.isM1Architecture ? 1 : 2,
        gameInterval: config.isM1Architecture ? 60000 : 30000
      },
      
      // Cache settings
      caching: {
        predictionCacheSize: config.recommendedSettings.predictionCacheSize,
        transpositionTableSize: config.recommendedSettings.transpositionTableSize,
        ttlMinutes: config.isM1Architecture ? 5 : 10,
        cleanupInterval: config.isM1Architecture ? 60000 : 120000
      },
      
      // Thread pool settings
      threading: {
        workerThreads: Math.max(1, config.recommendedSettings.tfNumThreads - 1),
        aiComputeThreads: config.recommendedSettings.tfNumThreads
      },
      
      // System info
      system: config
    };
  }
}

// Export a singleton instance
export const m1Optimizer = M1PerformanceOptimizer;