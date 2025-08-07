/**
 * 🎮 M1-Optimized Agent Configuration
 * 
 * Enforces buffer size limits for DRL agents on M1 Macs
 */

import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { Logger } from '@nestjs/common';

export interface AgentBufferConfig {
  maxBufferSize: number;
  batchSize: number;
  updateFrequency: number;
  prioritizedReplay: boolean;
  compressionEnabled: boolean;
}

export class M1AgentConfigManager {
  private static readonly logger = new Logger('M1AgentConfig');
  private static config = M1PerformanceOptimizer.getOptimizationConfig();
  
  /**
   * Get optimized buffer configuration for a specific agent type
   */
  static getAgentBufferConfig(agentType: string): AgentBufferConfig {
    const memoryGB = this.config.totalMemoryGB;
    const isM1 = this.config.isM1Architecture;
    
    // Base configuration
    let baseConfig: AgentBufferConfig = {
      maxBufferSize: 100000,
      batchSize: 32,
      updateFrequency: 4,
      prioritizedReplay: true,
      compressionEnabled: false
    };
    
    // Apply M1-specific limits based on memory
    if (isM1) {
      if (memoryGB <= 8) {
        // 8GB M1: Very conservative
        baseConfig = {
          maxBufferSize: 10000,
          batchSize: 16,
          updateFrequency: 8,
          prioritizedReplay: false, // Disable to save memory
          compressionEnabled: true
        };
      } else if (memoryGB <= 16) {
        // 16GB M1: Moderate limits
        baseConfig = {
          maxBufferSize: 20000,
          batchSize: 32,
          updateFrequency: 4,
          prioritizedReplay: true,
          compressionEnabled: false
        };
      } else {
        // 32GB+ M1: Still cap at 50k
        baseConfig = {
          maxBufferSize: 50000,
          batchSize: 64,
          updateFrequency: 4,
          prioritizedReplay: true,
          compressionEnabled: false
        };
      }
    }
    
    // Further adjustments based on agent type
    switch (agentType.toLowerCase()) {
      case 'dqn':
      case 'doubledqn':
      case 'duelingdqn':
        // Value-based methods can use full buffer
        return baseConfig;
        
      case 'ddpg':
      case 'td3':
      case 'sac':
        // Actor-critic methods need more memory for two networks
        return {
          ...baseConfig,
          maxBufferSize: Math.min(baseConfig.maxBufferSize, 30000),
          batchSize: Math.min(baseConfig.batchSize, 32)
        };
        
      case 'ppo':
      case 'a3c':
        // Policy gradient methods use smaller buffers
        return {
          ...baseConfig,
          maxBufferSize: Math.min(baseConfig.maxBufferSize, 10000),
          batchSize: Math.min(baseConfig.batchSize, 32),
          updateFrequency: 1 // Update after each episode
        };
        
      case 'rainbow':
        // Rainbow DQN uses multiple techniques, needs balance
        return {
          ...baseConfig,
          maxBufferSize: Math.min(baseConfig.maxBufferSize, 25000),
          prioritizedReplay: true // Always use for Rainbow
        };
        
      case 'alphazero':
      case 'muzero':
        // Model-based methods with MCTS
        return {
          ...baseConfig,
          maxBufferSize: Math.min(baseConfig.maxBufferSize, 20000),
          batchSize: Math.min(baseConfig.batchSize, 16),
          compressionEnabled: true // These store full game trees
        };
        
      default:
        this.logger.warn(`Unknown agent type: ${agentType}, using default config`);
        return baseConfig;
    }
  }
  
  /**
   * Get cache configuration for agents
   */
  static getAgentCacheConfig(agentType: string): {
    maxCacheSize: number;
    ttlSeconds: number;
    compressionEnabled: boolean;
  } {
    const memoryGB = this.config.totalMemoryGB;
    const isM1 = this.config.isM1Architecture;
    
    if (isM1 && memoryGB <= 16) {
      // Conservative cache for M1 with ≤16GB
      return {
        maxCacheSize: Math.min(50000, this.config.recommendedSettings.cacheMaxSize),
        ttlSeconds: 300, // 5 minutes
        compressionEnabled: memoryGB <= 8
      };
    }
    
    // Standard cache configuration
    return {
      maxCacheSize: Math.min(50000, this.config.recommendedSettings.cacheMaxSize),
      ttlSeconds: 600, // 10 minutes
      compressionEnabled: false
    };
  }
  
  /**
   * Get training configuration optimized for M1
   */
  static getTrainingConfig(agentType: string): {
    learningRate: number;
    gradientClipping: number;
    updateFrequency: number;
    targetUpdateFreq: number;
    useMixedPrecision: boolean;
  } {
    const isM1 = this.config.isM1Architecture;
    
    // Base configuration
    const baseConfig = {
      learningRate: 0.0001,
      gradientClipping: 1.0,
      updateFrequency: 4,
      targetUpdateFreq: 1000,
      useMixedPrecision: false // M1 doesn't benefit much from mixed precision
    };
    
    if (isM1) {
      // Adjust for M1 architecture
      return {
        ...baseConfig,
        updateFrequency: 8, // Less frequent updates to reduce overhead
        targetUpdateFreq: 2000, // Less frequent target updates
        gradientClipping: 0.5 // More aggressive clipping for stability
      };
    }
    
    return baseConfig;
  }
  
  /**
   * Create a memory-efficient replay buffer configuration
   */
  static createReplayBufferConfig(
    agentType: string,
    customMaxSize?: number
  ): {
    capacity: number;
    alpha: number; // Prioritization exponent
    beta: number; // Importance sampling
    epsilon: number; // Small constant for priority
    compressionRatio?: number;
  } {
    const bufferConfig = this.getAgentBufferConfig(agentType);
    const capacity = customMaxSize 
      ? Math.min(customMaxSize, bufferConfig.maxBufferSize)
      : bufferConfig.maxBufferSize;
    
    return {
      capacity,
      alpha: bufferConfig.prioritizedReplay ? 0.6 : 0.0,
      beta: bufferConfig.prioritizedReplay ? 0.4 : 1.0,
      epsilon: 1e-6,
      compressionRatio: bufferConfig.compressionEnabled ? 0.5 : undefined
    };
  }
  
  /**
   * Log agent configuration
   */
  static logAgentConfig(agentType: string): void {
    const bufferConfig = this.getAgentBufferConfig(agentType);
    const cacheConfig = this.getAgentCacheConfig(agentType);
    const trainingConfig = this.getTrainingConfig(agentType);
    
    this.logger.log(`🤖 ${agentType} Configuration (${this.config.isM1Architecture ? 'M1' : 'x86'}, ${this.config.totalMemoryGB}GB):`);
    this.logger.log(`   Buffer: ${bufferConfig.maxBufferSize} max, batch ${bufferConfig.batchSize}`);
    this.logger.log(`   Cache: ${cacheConfig.maxCacheSize} max, TTL ${cacheConfig.ttlSeconds}s`);
    this.logger.log(`   Training: LR ${trainingConfig.learningRate}, update freq ${trainingConfig.updateFrequency}`);
    this.logger.log(`   Compression: ${bufferConfig.compressionEnabled ? '✅' : '❌'}`);
  }
}

// Export convenience function
export const getM1AgentConfig = M1AgentConfigManager.getAgentBufferConfig.bind(M1AgentConfigManager);