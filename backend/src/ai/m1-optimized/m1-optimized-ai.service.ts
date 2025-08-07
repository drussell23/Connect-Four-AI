import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs';
import { M1AIConfigService } from './m1-ai-config.service';
import { AdaptiveCacheManager, CacheFactory } from './adaptive-cache-manager';
import { AdaptiveReplayBuffer } from './adaptive-replay-buffer';
import { LightweightInferenceService } from './lightweight-inference.service';
import { DynamicMemoryMonitor } from './dynamic-memory-monitor';
import { BackgroundLearningThrottle } from './background-learning-throttle';
import { CellValue } from '../connect4AI';

/**
 * M1-Optimized AI Service
 */
@Injectable()
export class M1OptimizedAIService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('M1OptimizedAI');
  private predictionCache: AdaptiveCacheManager<number[]>;
  private transpositionTable: AdaptiveCacheManager<any>;
  private evaluationCache: AdaptiveCacheManager<number>;
  private replayBuffer: AdaptiveReplayBuffer;
  private memoryMonitorInterval: NodeJS.Timeout;
  
  constructor(
    private readonly configService: M1AIConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly lightweightInference: LightweightInferenceService,
    private readonly memoryMonitor: DynamicMemoryMonitor,
    private readonly learningThrottle: BackgroundLearningThrottle
  ) {}
  
  async onModuleInit() {
    this.logger.log('🍎 Initializing M1-Optimized AI Service...');
    
    try {
      // Only initialize if M1 is explicitly enabled
      if (process.env.M1_OPTIMIZED !== 'true' && process.env.ENABLE_M1_FEATURES !== 'true') {
        this.logger.warn('M1 optimizations not enabled, skipping initialization');
        return;
      }
      
      if (!this.configService) {
        this.logger.error('ConfigService not injected!');
        return;
      }
      
      const config = this.configService.getConfig();
    
    // Initialize caches
    if (config.enablePredictionCache) {
      this.predictionCache = CacheFactory.createPredictionCache(config.predictionCacheSize);
      this.logger.log('✅ Prediction cache initialized');
    }
    
    if (config.enableTranspositionTable) {
      this.transpositionTable = CacheFactory.createTranspositionTable(config.transpositionTableSize);
      this.logger.log('✅ Transposition table initialized');
    }
    
    this.evaluationCache = CacheFactory.createEvaluationCache(config.evaluationCacheSize);
    this.logger.log('✅ Evaluation cache initialized');
    
    // Initialize replay buffer
    this.replayBuffer = new AdaptiveReplayBuffer(
      config.replayBufferSize,
      true // adaptiveResize
    );
    this.logger.log('✅ Adaptive replay buffer initialized');
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    this.logger.log('✅ M1-Optimized AI Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize M1-Optimized AI Service:', error);
      // Don't crash the app if M1 optimization fails
    }
  }
  
  async onModuleDestroy() {
    this.logger.log('🧹 Cleaning up M1-Optimized AI Service...');
    
    // Stop monitoring
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    // Cleanup caches
    if (this.predictionCache) this.predictionCache.destroy();
    if (this.transpositionTable) this.transpositionTable.destroy();
    if (this.evaluationCache) this.evaluationCache.destroy();
    
    // Cleanup replay buffer
    if (this.replayBuffer) {
      // AdaptiveReplayBuffer doesn't have destroy, just clear reference
      this.replayBuffer = null;
    }
    
    // Dispose all TensorFlow tensors
    tf.disposeVariables();
    
    this.logger.log('✅ Cleanup complete');
  }
  
  /**
   * Get AI prediction with caching
   */
  async getPrediction(boardKey: string, computeFn: () => Promise<number[]>): Promise<number[]> {
    const config = this.configService.getConfig();
    
    if (!config.enablePredictionCache || !this.predictionCache) {
      return computeFn();
    }
    
    // Check cache
    const cached = this.predictionCache.get(boardKey);
    if (cached) {
      return cached;
    }
    
    // Compute and cache
    const prediction = await computeFn();
    this.predictionCache.set(boardKey, prediction);
    
    return prediction;
  }
  
  /**
   * Add experience to replay buffer
   */
  addExperience(experience: any): void {
    this.replayBuffer.add(experience);
  }
  
  /**
   * Sample batch from replay buffer
   */
  sampleBatch(batchSize: number): any[] {
    return this.replayBuffer.sample(batchSize);
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    try {
      const memoryState = this.memoryMonitor?.getCurrentState() || { level: 'unknown' };
      
      return {
        memory: {
          ...memoryState,
          tensors: tf.memory()
        },
        caches: {
          prediction: this.predictionCache?.getStats() || null,
          transposition: this.transpositionTable?.getStats() || null,
          evaluation: this.evaluationCache?.getStats() || null
        },
        replayBuffer: this.replayBuffer?.getStats() || null,
        learningThrottle: { status: 'active' }, // BackgroundLearningThrottle doesn't have getStatus
        config: this.configService?.getConfig() || {}
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      return {
        memory: { level: 'error' },
        caches: {},
        replayBuffer: null,
        learningThrottle: { status: 'error' },
        config: {}
      };
    }
  }
  
  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Cache resize events
    this.eventEmitter.on('cache.resize', ({ factor }) => {
      this.logger.log(`Resizing caches by factor: ${factor}`);
      if (this.predictionCache) {
        const currentSize = this.predictionCache.getStats().maxSize;
        this.predictionCache = CacheFactory.createPredictionCache(
          Math.floor(currentSize * factor)
        );
      }
    });
    
    // Cache clear events
    this.eventEmitter.on('cache.clear.all', () => {
      this.logger.log('Clearing all caches');
      if (this.predictionCache) this.predictionCache.clear();
      if (this.transpositionTable) this.transpositionTable.clear();
      if (this.evaluationCache) this.evaluationCache.clear();
    });
    
    // Buffer resize events
    this.eventEmitter.on('buffer.resize', ({ factor }) => {
      this.logger.log(`Replay buffer resize requested by factor: ${factor}`);
      // AdaptiveReplayBuffer handles resizing internally through adaptive monitoring
    });
  }
  
  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    const config = this.configService.getConfig();
    
    if (!config.enableMemoryMonitoring) {
      this.logger.log('Memory monitoring disabled');
      return;
    }
    
    // Monitor every 30 seconds
    this.memoryMonitorInterval = setInterval(() => {
      const stats = this.getStats();
      
      // Emit metrics
      this.eventEmitter.emit('metrics.ai', stats);
      
      // Log if memory pressure is high
      if (stats.memory.level !== 'normal') {
        this.logger.warn(`Memory pressure: ${stats.memory.level}`);
      }
    }, 30000);
    
    this.logger.log('Memory monitoring started');
  }
}