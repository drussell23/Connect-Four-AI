/**
 * 🎮 M1-Optimized AI Configuration Service
 * 
 * Dynamically configures AI features based on system resources
 * to ensure smooth performance on M1 Macs
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';

export interface AIFeatureFlags {
  // Core AI features
  enableAI: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  
  // Background processing
  enableBackgroundTraining: boolean;
  enableSelfPlay: boolean;
  enableContinuousLearning: boolean;
  
  // Performance features
  enablePredictionCache: boolean;
  enableTranspositionTable: boolean;
  enableParallelSearch: boolean;
  
  // Training parameters
  trainingBatchSize: number;
  trainingUpdateFrequency: number;
  maxTrainingGamesPerDay: number;
  
  // Self-play parameters
  selfPlayConcurrentGames: number;
  selfPlayInterval: number; // milliseconds
  selfPlayGamesPerSession: number;
  
  // Cache parameters
  predictionCacheSize: number;
  transpositionTableSize: number;
  cacheEvictionPolicy: 'lru' | 'lfu' | 'ttl';
  cacheTTL: number; // seconds
  
  // Memory management
  enableMemoryMonitoring: boolean;
  memoryCheckInterval: number; // milliseconds
  maxMemoryUsageMB: number;
  enableGarbageCollection: boolean;
  
  // Additional cache and buffer sizes
  evaluationCacheSize: number;
  replayBufferSize: number;
}

@Injectable()
export class M1AIConfigService {
  private readonly logger = new Logger('M1AIConfigService');
  private config: AIFeatureFlags;
  private readonly systemConfig = M1PerformanceOptimizer.getOptimizationConfig();
  
  constructor(private configService: ConfigService) {
    this.config = this.generateOptimalConfig();
    this.logConfiguration();
  }
  
  /**
   * Generate optimal configuration based on system resources
   */
  private generateOptimalConfig(): AIFeatureFlags {
    const settings = this.systemConfig.recommendedSettings;
    const isM1 = this.systemConfig.isM1Architecture;
    const memoryGB = this.systemConfig.totalMemoryGB;
    
    // Base configuration for all systems
    const baseConfig: AIFeatureFlags = {
      // Core AI always enabled
      enableAI: true,
      aiDifficulty: 'adaptive',
      
      // Background features based on system
      enableBackgroundTraining: settings.enableBackgroundTraining,
      enableSelfPlay: settings.enableSelfPlay,
      enableContinuousLearning: memoryGB >= 16,
      
      // Performance features
      enablePredictionCache: true,
      enableTranspositionTable: true,
      enableParallelSearch: !isM1 || memoryGB >= 16,
      
      // Training parameters
      trainingBatchSize: settings.batchSize,
      trainingUpdateFrequency: isM1 ? 1000 : 500,
      maxTrainingGamesPerDay: isM1 ? 100 : 1000,
      
      // Self-play parameters
      selfPlayConcurrentGames: isM1 ? 1 : 2,
      selfPlayInterval: isM1 ? 300000 : 60000, // 5 min vs 1 min
      selfPlayGamesPerSession: isM1 ? 5 : 20,
      
      // Cache parameters
      predictionCacheSize: settings.predictionCacheSize,
      transpositionTableSize: settings.transpositionTableSize,
      cacheEvictionPolicy: 'lru',
      cacheTTL: isM1 ? 300 : 600, // 5 min vs 10 min
      
      // Memory management
      enableMemoryMonitoring: true,
      memoryCheckInterval: isM1 ? 30000 : 60000,
      maxMemoryUsageMB: settings.maxOldSpaceSize * 0.8,
      enableGarbageCollection: true,
      
      // Additional cache and buffer sizes
      evaluationCacheSize: isM1 ? 1000 : 5000,
      replayBufferSize: isM1 ? (memoryGB <= 8 ? 10000 : 20000) : 50000
    };
    
    // Override with environment variables if provided
    return this.applyEnvironmentOverrides(baseConfig);
  }
  
  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(config: AIFeatureFlags): AIFeatureFlags {
    // Background training override
    if (process.env.ENABLE_BACKGROUND_TRAINING !== undefined) {
      config.enableBackgroundTraining = process.env.ENABLE_BACKGROUND_TRAINING === 'true';
    }
    
    // Self-play override
    if (process.env.ENABLE_SELF_PLAY !== undefined) {
      config.enableSelfPlay = process.env.ENABLE_SELF_PLAY === 'true';
    }
    
    // Continuous learning override
    if (process.env.ENABLE_CONTINUOUS_LEARNING !== undefined) {
      config.enableContinuousLearning = process.env.ENABLE_CONTINUOUS_LEARNING === 'true';
    }
    
    // Memory limit override
    if (process.env.MAX_MEMORY_MB !== undefined) {
      config.maxMemoryUsageMB = parseInt(process.env.MAX_MEMORY_MB, 10);
    }
    
    // Cache size overrides
    if (process.env.PREDICTION_CACHE_SIZE !== undefined) {
      config.predictionCacheSize = parseInt(process.env.PREDICTION_CACHE_SIZE, 10);
    }
    
    if (process.env.TRANSPOSITION_TABLE_SIZE !== undefined) {
      config.transpositionTableSize = parseInt(process.env.TRANSPOSITION_TABLE_SIZE, 10);
    }
    
    return config;
  }
  
  /**
   * Get current configuration
   */
  getConfig(): AIFeatureFlags {
    return { ...this.config };
  }
  
  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<AIFeatureFlags>): void {
    this.config = { ...this.config, ...updates };
    this.logger.log('Configuration updated:', updates);
  }
  
  /**
   * Enable/disable background features based on memory pressure
   */
  adjustForMemoryPressure(memoryUsagePercent: number): void {
    if (memoryUsagePercent > 80) {
      // High memory pressure - disable background features
      if (this.config.enableBackgroundTraining || this.config.enableSelfPlay) {
        this.logger.warn('High memory pressure - disabling background features');
        this.updateConfig({
          enableBackgroundTraining: false,
          enableSelfPlay: false,
          enableParallelSearch: false
        });
      }
    } else if (memoryUsagePercent < 50) {
      // Low memory pressure - can re-enable features
      const settings = this.systemConfig.recommendedSettings;
      if (!this.config.enableBackgroundTraining && settings.enableBackgroundTraining) {
        this.logger.log('Memory pressure reduced - re-enabling background training');
        this.updateConfig({
          enableBackgroundTraining: true
        });
      }
    }
  }
  
  /**
   * Get feature status summary
   */
  getFeatureStatus(): Record<string, boolean> {
    return {
      'Background Training': this.config.enableBackgroundTraining,
      'Self-Play': this.config.enableSelfPlay,
      'Continuous Learning': this.config.enableContinuousLearning,
      'Prediction Cache': this.config.enablePredictionCache,
      'Transposition Table': this.config.enableTranspositionTable,
      'Parallel Search': this.config.enableParallelSearch,
      'Memory Monitoring': this.config.enableMemoryMonitoring,
      'Garbage Collection': this.config.enableGarbageCollection
    };
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      system: {
        architecture: this.systemConfig.isM1Architecture ? 'Apple Silicon' : 'x86_64',
        memory: `${this.systemConfig.totalMemoryGB}GB`,
        cores: this.systemConfig.cpuCores
      },
      training: {
        batchSize: this.config.trainingBatchSize,
        updateFrequency: `${this.config.trainingUpdateFrequency}ms`,
        maxGamesPerDay: this.config.maxTrainingGamesPerDay
      },
      selfPlay: {
        concurrentGames: this.config.selfPlayConcurrentGames,
        interval: `${this.config.selfPlayInterval / 1000}s`,
        gamesPerSession: this.config.selfPlayGamesPerSession
      },
      caching: {
        predictionCache: this.config.predictionCacheSize,
        transpositionTable: this.config.transpositionTableSize,
        evictionPolicy: this.config.cacheEvictionPolicy,
        ttl: `${this.config.cacheTTL}s`
      },
      memory: {
        maxUsage: `${this.config.maxMemoryUsageMB}MB`,
        checkInterval: `${this.config.memoryCheckInterval / 1000}s`
      }
    };
  }
  
  /**
   * Log current configuration
   */
  private logConfiguration(): void {
    this.logger.log('🎮 AI Configuration initialized:');
    this.logger.log(`   🖥️  System: ${this.systemConfig.isM1Architecture ? 'Apple Silicon M1' : 'x86_64'}`);
    this.logger.log(`   💾 Memory: ${this.systemConfig.totalMemoryGB}GB`);
    this.logger.log(`   🧵 CPU Cores: ${this.systemConfig.cpuCores}`);
    
    const features = this.getFeatureStatus();
    this.logger.log('   📊 Features:');
    Object.entries(features).forEach(([feature, enabled]) => {
      this.logger.log(`      ${enabled ? '✅' : '❌'} ${feature}`);
    });
  }
}

// Export configuration presets for different scenarios
export const M1_PRESETS = {
  // Minimal preset for 8GB M1 Macs
  MINIMAL: {
    enableBackgroundTraining: false,
    enableSelfPlay: false,
    enableContinuousLearning: false,
    trainingBatchSize: 16,
    replayBufferSize: 10000, // 10k for 8GB
    predictionCacheSize: 50,
    transpositionTableSize: 20000,
    maxPerAgentBuffer: 10000 // Cap individual agent buffers
  },
  
  // Balanced preset for 16GB M1 Macs
  BALANCED: {
    enableBackgroundTraining: true,
    enableSelfPlay: false,
    enableContinuousLearning: true,
    trainingBatchSize: 32,
    replayBufferSize: 20000, // 20k for 16GB
    predictionCacheSize: 200,
    transpositionTableSize: 50000, // Limit to 50k
    maxPerAgentBuffer: 20000 // Cap individual agent buffers
  },
  
  // Performance preset for M1 Pro/Max (32GB+)
  PERFORMANCE: {
    enableBackgroundTraining: true,
    enableSelfPlay: true,
    enableContinuousLearning: true,
    trainingBatchSize: 64,
    replayBufferSize: 50000, // 50k for 32GB+
    predictionCacheSize: 500,
    transpositionTableSize: 50000, // Still cap at 50k for consistency
    maxPerAgentBuffer: 50000 // Cap at 50k as per requirements
  }
};