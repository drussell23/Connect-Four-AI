import { Injectable, Logger } from '@nestjs/common';
// import * as tf from '@tensorflow/tfjs-node';
import tf from './mocks/tensorflow-mock'; // Using mock for development
/// <reference path="./mocks/tensorflow-types.d.ts" />
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResourceMonitorService, ResourceMetrics, ThrottleDecision } from './resource-monitor.service';
import { PerformanceMonitor } from './async/performance-monitor';

export interface ResourcePattern {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  activeRequests: number;
  aiStrategy: string;
  thinkingTime: number;
  modelComplexity: number;
  userLoad: number;
}

export interface AdaptiveDecision {
  strategy: string;
  maxThinkingTime: number;
  modelDepth: number;
  enableCaching: boolean;
  enablePrecomputation: boolean;
  batchSize: number;
  parallelism: number;
  confidence: number;
  reasoning: string;
}

export interface LearningMetrics {
  patternsLearned: number;
  adaptationAccuracy: number;
  resourceSavings: number;
  performanceImprovement: number;
  lastTrainingTime: number;
}

@Injectable()
export class AdaptiveResourceManager {
  private readonly logger = new Logger(AdaptiveResourceManager.name);
  private model: any | null = null; // tf.LayersModel when using real TensorFlow
  private patternHistory: ResourcePattern[] = [];
  private readonly maxHistorySize = 10000;
  private readonly batchSize = 32;
  private learningMetrics: LearningMetrics = {
    patternsLearned: 0,
    adaptationAccuracy: 0,
    resourceSavings: 0,
    performanceImprovement: 0,
    lastTrainingTime: Date.now()
  };
  
  // Model configuration
  private readonly inputFeatures = 8; // cpu, memory, requests, strategy, time, complexity, load, time_of_day
  private readonly outputFeatures = 7; // strategy_index, thinking_time, depth, caching, precomp, batch, parallel
  
  // Strategy mapping
  private readonly strategies = [
    'minimax', 'mcts', 'dqn', 'alphazero', 'constitutional_ai', 
    'simplified', 'cached', 'hybrid'
  ];
  
  // Real-time adaptation state
  private currentLoad = 0;
  private adaptationEnabled = true;
  private learningRate = 0.001;
  private readonly updateInterval = 5000; // Update model every 5 seconds
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly resourceMonitor: ResourceMonitorService,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initialize();
  }

  /**
   * Initialize the adaptive resource management system
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.log('🧠 Initializing Adaptive Resource Manager...');
      
      // Create or load the ML model
      await this.initializeModel();
      
      // Start continuous learning loop
      this.startContinuousLearning();
      
      // Subscribe to resource events
      this.subscribeToEvents();
      
      this.logger.log('✅ Adaptive Resource Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Adaptive Resource Manager:', error);
    }
  }

  /**
   * Initialize the neural network model
   */
  private async initializeModel(): Promise<void> {
    try {
      // Try to load existing model
      const modelPath = 'file://./models/adaptive-resource-model';
      
      try {
        this.model = await tf.loadLayersModel(modelPath + '/model.json');
        this.logger.log('📂 Loaded existing adaptive resource model');
      } catch (loadError) {
        // Create new model if loading fails
        this.model = this.createModel();
        this.logger.log('🆕 Created new adaptive resource model');
      }
      
      // Compile the model
      this.model.compile({
        optimizer: tf.train.adam(this.learningRate),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize model:', error);
      // Create a simple fallback model
      this.model = this.createSimpleModel();
    }
  }

  /**
   * Create the neural network architecture
   */
  private createModel(): any {
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [this.inputFeatures],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        
        // Hidden layers with dropout for regularization
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Output layer
        tf.layers.dense({
          units: this.outputFeatures,
          activation: 'sigmoid' // Normalized outputs
        })
      ]
    });
    
    return model;
  }

  /**
   * Create a simpler fallback model
   */
  private createSimpleModel(): any {
    return tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.inputFeatures],
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: this.outputFeatures,
          activation: 'sigmoid'
        })
      ]
    });
  }

  /**
   * Get adaptive AI configuration based on current resources
   */
  async getAdaptiveConfiguration(
    currentStrategy: string,
    modelComplexity: number = 1.0
  ): Promise<AdaptiveDecision> {
    const metrics = this.resourceMonitor.getCurrentMetrics();
    
    if (!metrics || !this.model || !this.adaptationEnabled) {
      return this.getDefaultConfiguration(currentStrategy);
    }
    
    try {
      // Prepare input features
      const features = this.prepareFeatures(metrics, currentStrategy, modelComplexity);
      
      // Get model prediction
      const prediction = await this.predict(features);
      
      // Convert prediction to configuration
      const config = this.interpretPrediction(prediction, metrics);
      
      // Apply safety constraints
      const safeConfig = this.applySafetyConstraints(config, metrics);
      
      // Record the decision
      this.recordPattern(metrics, currentStrategy, modelComplexity, safeConfig);
      
      return safeConfig;
      
    } catch (error) {
      this.logger.error('Failed to get adaptive configuration:', error);
      return this.getDefaultConfiguration(currentStrategy);
    }
  }

  /**
   * Prepare input features for the model
   */
  private prepareFeatures(
    metrics: ResourceMetrics,
    strategy: string,
    complexity: number
  ): any { // tf.Tensor2D
    const hour = new Date().getHours();
    const timeOfDay = Math.sin(2 * Math.PI * hour / 24); // Cyclical encoding
    
    const features = [
      metrics.cpuUsage,
      metrics.memoryUsage,
      this.currentLoad / 100, // Normalized active requests
      this.strategies.indexOf(strategy) / this.strategies.length,
      0.5, // Default thinking time (will be learned)
      complexity,
      metrics.loadAverage[0] / 10, // Normalized load average
      timeOfDay
    ];
    
    return tf.tensor2d([features], [1, this.inputFeatures]);
  }

  /**
   * Make a prediction using the model
   */
  private async predict(features: any): Promise<number[]> { // tf.Tensor2D
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const prediction = this.model.predict(features) as any; // tf.Tensor
    const result = await prediction.array() as number[][];
    
    // Clean up tensors
    features.dispose();
    prediction.dispose();
    
    return result[0];
  }

  /**
   * Interpret model prediction into configuration
   */
  private interpretPrediction(
    prediction: number[],
    metrics: ResourceMetrics
  ): AdaptiveDecision {
    const [
      strategyIndex,
      thinkingTimeNorm,
      depthNorm,
      cachingProb,
      precompProb,
      batchSizeNorm,
      parallelismNorm
    ] = prediction;
    
    // Determine strategy
    const strategyIdx = Math.round(strategyIndex * (this.strategies.length - 1));
    const strategy = this.strategies[strategyIdx];
    
    // Scale parameters based on resource availability
    const resourceFactor = 1 - Math.max(metrics.cpuUsage, metrics.memoryUsage);
    
    return {
      strategy,
      maxThinkingTime: Math.round(thinkingTimeNorm * 10000 * resourceFactor), // 0-10 seconds
      modelDepth: Math.round(depthNorm * 10 * resourceFactor) + 1, // 1-10 depth
      enableCaching: cachingProb > 0.5,
      enablePrecomputation: precompProb > 0.5 && resourceFactor > 0.3,
      batchSize: Math.max(1, Math.round(batchSizeNorm * 32)),
      parallelism: Math.max(1, Math.round(parallelismNorm * 4)),
      confidence: this.calculateConfidence(prediction),
      reasoning: this.generateReasoning(strategy, metrics, resourceFactor)
    };
  }

  /**
   * Apply safety constraints to prevent system overload
   */
  private applySafetyConstraints(
    config: AdaptiveDecision,
    metrics: ResourceMetrics
  ): AdaptiveDecision {
    // Critical resource protection
    if (metrics.cpuUsage > 0.9) {
      config.strategy = 'simplified';
      config.maxThinkingTime = Math.min(config.maxThinkingTime, 1000);
      config.modelDepth = Math.min(config.modelDepth, 3);
      config.enablePrecomputation = false;
      config.parallelism = 1;
      config.reasoning += ' [CRITICAL: CPU protection activated]';
    }
    
    // Memory protection
    if (metrics.memoryUsage > 0.85) {
      config.enableCaching = false;
      config.enablePrecomputation = false;
      config.batchSize = Math.min(config.batchSize, 8);
      config.reasoning += ' [WARNING: Memory conservation mode]';
    }
    
    // Load-based adjustments
    if (metrics.loadAverage[0] > 4) {
      config.maxThinkingTime = Math.min(config.maxThinkingTime, 2000);
      config.modelDepth = Math.min(config.modelDepth, 5);
    }
    
    return config;
  }

  /**
   * Calculate confidence score for the prediction
   */
  private calculateConfidence(prediction: number[]): number {
    // Use entropy as a measure of confidence
    const entropy = -prediction.reduce((sum, p) => {
      const clipped = Math.max(0.001, Math.min(0.999, p));
      return sum + clipped * Math.log(clipped);
    }, 0) / prediction.length;
    
    return 1 - entropy / Math.log(2); // Normalize to 0-1
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    strategy: string,
    metrics: ResourceMetrics,
    resourceFactor: number
  ): string {
    const parts = [`Selected ${strategy} strategy`];
    
    if (metrics.cpuUsage > 0.7) {
      parts.push('high CPU usage detected');
    }
    
    if (resourceFactor < 0.3) {
      parts.push('limited resources available');
    }
    
    if (metrics.loadAverage[0] > 2) {
      parts.push('system under load');
    }
    
    return parts.join(', ');
  }

  /**
   * Get default configuration when ML is not available
   */
  private getDefaultConfiguration(strategy: string): AdaptiveDecision {
    const metrics = this.resourceMonitor.getCurrentMetrics();
    const throttle = this.resourceMonitor.shouldThrottleRequest();
    
    if (throttle.shouldThrottle) {
      return {
        strategy: 'simplified',
        maxThinkingTime: 1000,
        modelDepth: 3,
        enableCaching: true,
        enablePrecomputation: false,
        batchSize: 1,
        parallelism: 1,
        confidence: 0.8,
        reasoning: `Throttling active: ${throttle.reason}`
      };
    }
    
    return {
      strategy,
      maxThinkingTime: 5000,
      modelDepth: 7,
      enableCaching: true,
      enablePrecomputation: true,
      batchSize: 16,
      parallelism: 2,
      confidence: 0.5,
      reasoning: 'Default configuration (ML not available)'
    };
  }

  /**
   * Record resource usage pattern
   */
  private recordPattern(
    metrics: ResourceMetrics,
    strategy: string,
    complexity: number,
    decision: AdaptiveDecision
  ): void {
    const pattern: ResourcePattern = {
      timestamp: Date.now(),
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      activeRequests: this.currentLoad,
      aiStrategy: strategy,
      thinkingTime: decision.maxThinkingTime,
      modelComplexity: complexity,
      userLoad: metrics.loadAverage[0]
    };
    
    this.patternHistory.push(pattern);
    
    // Maintain history size
    if (this.patternHistory.length > this.maxHistorySize) {
      this.patternHistory.shift();
    }
  }

  /**
   * Start continuous learning loop
   */
  private startContinuousLearning(): void {
    this.updateTimer = setInterval(async () => {
      if (this.patternHistory.length >= this.batchSize * 2) {
        await this.updateModel();
      }
    }, this.updateInterval);
  }

  /**
   * Update the model with recent patterns
   */
  private async updateModel(): Promise<void> {
    if (!this.model || this.patternHistory.length < this.batchSize) {
      return;
    }
    
    try {
      // Prepare training data from recent patterns
      const { inputs, outputs } = this.prepareTrainingData();
      
      // Train the model
      const history = await this.model.fit(inputs, outputs, {
        epochs: 5,
        batchSize: this.batchSize,
        validationSplit: 0.2,
        verbose: 0
      });
      
      // Update metrics
      const loss = history.history.loss[history.history.loss.length - 1] as number;
      this.learningMetrics.patternsLearned += this.batchSize;
      this.learningMetrics.adaptationAccuracy = 1 - loss;
      this.learningMetrics.lastTrainingTime = Date.now();
      
      // Clean up tensors
      inputs.dispose();
      outputs.dispose();
      
      // Save model periodically
      if (this.learningMetrics.patternsLearned % 1000 === 0) {
        await this.saveModel();
      }
      
      this.logger.debug(`Model updated - Loss: ${loss.toFixed(4)}, Patterns: ${this.learningMetrics.patternsLearned}`);
      
    } catch (error) {
      this.logger.error('Failed to update model:', error);
    }
  }

  /**
   * Prepare training data from pattern history
   */
  private prepareTrainingData(): { inputs: any; outputs: any } { // tf.Tensor2D
    const recentPatterns = this.patternHistory.slice(-this.batchSize * 2);
    
    const inputData: number[][] = [];
    const outputData: number[][] = [];
    
    for (let i = 0; i < recentPatterns.length - 1; i++) {
      const current = recentPatterns[i];
      const next = recentPatterns[i + 1];
      
      // Input features
      const hour = new Date(current.timestamp).getHours();
      const timeOfDay = Math.sin(2 * Math.PI * hour / 24);
      
      inputData.push([
        current.cpuUsage,
        current.memoryUsage,
        current.activeRequests / 100,
        this.strategies.indexOf(current.aiStrategy) / this.strategies.length,
        current.thinkingTime / 10000,
        current.modelComplexity,
        current.userLoad / 10,
        timeOfDay
      ]);
      
      // Output targets (what worked well)
      const performanceScore = this.calculatePerformanceScore(current, next);
      
      outputData.push([
        this.strategies.indexOf(next.aiStrategy) / this.strategies.length,
        next.thinkingTime / 10000,
        Math.min(next.modelComplexity * 10, 10) / 10,
        performanceScore > 0.7 ? 1 : 0, // Enable caching if good performance
        performanceScore > 0.8 ? 1 : 0, // Enable precomputation if very good
        Math.min(next.activeRequests, 32) / 32,
        Math.min(4, Math.ceil(1 / next.cpuUsage)) / 4
      ]);
    }
    
    return {
      inputs: tf.tensor2d(inputData),
      outputs: tf.tensor2d(outputData)
    };
  }

  /**
   * Calculate performance score for a pattern
   */
  private calculatePerformanceScore(current: ResourcePattern, next: ResourcePattern): number {
    // Lower resource usage is better
    const resourceImprovement = (current.cpuUsage + current.memoryUsage) - 
                               (next.cpuUsage + next.memoryUsage);
    
    // Faster thinking time with same strategy is better
    const speedImprovement = current.aiStrategy === next.aiStrategy ? 
                            (current.thinkingTime - next.thinkingTime) / current.thinkingTime : 0;
    
    // Lower load is better
    const loadImprovement = (current.userLoad - next.userLoad) / Math.max(current.userLoad, 1);
    
    // Combine scores
    const score = (resourceImprovement + speedImprovement + loadImprovement) / 3 + 0.5;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Save the model to disk
   */
  private async saveModel(): Promise<void> {
    if (!this.model) return;
    
    try {
      await this.model.save('file://./models/adaptive-resource-model');
      this.logger.log('💾 Adaptive resource model saved');
    } catch (error) {
      this.logger.error('Failed to save model:', error);
    }
  }

  /**
   * Subscribe to system events
   */
  private subscribeToEvents(): void {
    // Track active requests
    this.eventEmitter.on('ai.request.start', () => {
      this.currentLoad++;
    });
    
    this.eventEmitter.on('ai.request.end', () => {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    });
    
    // React to performance issues
    this.eventEmitter.on('ai.performance.slow', (event) => {
      this.learningRate *= 1.1; // Increase learning rate to adapt faster
    });
    
    // Update strategy effectiveness
    this.eventEmitter.on('ai.move.completed', (event: {
      strategy: string;
      thinkingTime: number;
      success: boolean;
    }) => {
      if (event.success) {
        this.learningMetrics.performanceImprovement += 0.01;
      }
    });
  }

  /**
   * Get current learning metrics
   */
  getLearningMetrics(): LearningMetrics {
    return { ...this.learningMetrics };
  }

  /**
   * Enable or disable adaptation
   */
  setAdaptationEnabled(enabled: boolean): void {
    this.adaptationEnabled = enabled;
    this.logger.log(`Adaptation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clean up resources
   */
  async onModuleDestroy(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    if (this.model) {
      await this.saveModel();
    }
  }
}