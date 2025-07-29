/**
 * Unified ML Model Manager for Connect Four
 * Orchestrates ONNX, Brain.js, and ML5.js models with advanced ensemble techniques
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ONNXModelEngine, ONNXModelConfig, ModelPrediction } from './onnx-model-engine';
import { BrainNeuralNetwork, BrainNetworkConfig, NetworkPrediction } from './brain-neural-network';
import { ML5TransferLearning, TransferLearningConfig, TransferLearningPrediction } from './ml5-transfer-learning';
import { CellValue } from '../connect4AI';

export interface UnifiedModelConfig {
  name: string;
  type: 'onnx' | 'brain' | 'ml5';
  config: ONNXModelConfig | BrainNetworkConfig | TransferLearningConfig;
  weight?: number;
  priority?: number;
  enabled?: boolean;
}

export interface UnifiedPrediction {
  move: number;
  confidence: number;
  value: number;
  policy: number[];
  modelContributions: {
    modelName: string;
    modelType: string;
    contribution: number;
    inferenceTime: number;
  }[];
  ensembleMethod: string;
  totalInferenceTime: number;
  metadata?: Record<string, any>;
}

export interface ModelPerformanceMetrics {
  modelName: string;
  accuracy: number;
  averageInferenceTime: number;
  totalPredictions: number;
  successRate: number;
  lastUpdated: Date;
}

export interface EnsembleStrategy {
  name: string;
  method: 'weighted_average' | 'voting' | 'stacking' | 'boosting' | 'dynamic';
  adaptiveWeights?: boolean;
  temperatureScaling?: number;
  confidenceThreshold?: number;
}

@Injectable()
export class UnifiedMLManager {
  private readonly logger = new Logger(UnifiedMLManager.name);
  private models: Map<string, UnifiedModelConfig> = new Map();
  private modelPerformance: Map<string, ModelPerformanceMetrics> = new Map();
  private ensembleStrategies: Map<string, EnsembleStrategy> = new Map();
  private predictionCache: Map<string, UnifiedPrediction> = new Map();
  private readonly maxCacheSize = 10000;

  constructor(
    private readonly onnxEngine: ONNXModelEngine,
    private readonly brainNetwork: BrainNeuralNetwork,
    private readonly ml5Transfer: ML5TransferLearning,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default ensemble strategies
   */
  private initializeDefaultStrategies(): void {
    // Weighted average strategy
    this.ensembleStrategies.set('weighted_average', {
      name: 'weighted_average',
      method: 'weighted_average',
      adaptiveWeights: true,
      temperatureScaling: 1.0
    });

    // Voting strategy
    this.ensembleStrategies.set('voting', {
      name: 'voting',
      method: 'voting',
      confidenceThreshold: 0.6
    });

    // Stacking strategy
    this.ensembleStrategies.set('stacking', {
      name: 'stacking',
      method: 'stacking',
      adaptiveWeights: true
    });

    // Dynamic strategy selection
    this.ensembleStrategies.set('dynamic', {
      name: 'dynamic',
      method: 'dynamic',
      adaptiveWeights: true,
      temperatureScaling: 1.5
    });
  }

  /**
   * Register a model with the unified manager
   */
  async registerModel(config: UnifiedModelConfig): Promise<void> {
    this.logger.log(`Registering model: ${config.name} (${config.type})`);

    try {
      // Initialize model based on type
      switch (config.type) {
        case 'onnx':
          await this.onnxEngine.loadModel(config.config as ONNXModelConfig);
          break;
        case 'brain':
          this.brainNetwork.createNetwork(config.name, config.config as BrainNetworkConfig);
          break;
        case 'ml5':
          await this.ml5Transfer.initializeModel(config.name, config.config as TransferLearningConfig);
          break;
      }

      // Store model configuration
      this.models.set(config.name, {
        ...config,
        weight: config.weight || 1.0,
        priority: config.priority || 1,
        enabled: config.enabled !== false
      });

      // Initialize performance metrics
      this.modelPerformance.set(config.name, {
        modelName: config.name,
        accuracy: 0,
        averageInferenceTime: 0,
        totalPredictions: 0,
        successRate: 0,
        lastUpdated: new Date()
      });

      this.logger.log(`Model ${config.name} registered successfully`);

      // Emit registration event
      this.eventEmitter.emit('unified.model.registered', {
        modelName: config.name,
        modelType: config.type,
        config
      });

    } catch (error) {
      this.logger.error(`Failed to register model ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Make prediction using unified ensemble
   */
  async predict(
    board: CellValue[][],
    strategy: string = 'dynamic',
    options?: {
      modelFilter?: (model: UnifiedModelConfig) => boolean;
      useCache?: boolean;
      timeLimit?: number;
    }
  ): Promise<UnifiedPrediction> {
    const startTime = performance.now();

    // Check cache
    if (options?.useCache !== false) {
      const cacheKey = this.getCacheKey(board, strategy);
      const cached = this.predictionCache.get(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached prediction');
        return cached;
      }
    }

    // Get enabled models
    const enabledModels = Array.from(this.models.values())
      .filter(model => model.enabled)
      .filter(options?.modelFilter || (() => true))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (enabledModels.length === 0) {
      throw new Error('No models available for prediction');
    }

    // Get predictions from all models
    const modelPredictions = await this.getModelPredictions(board, enabledModels, options?.timeLimit);

    // Apply ensemble strategy
    const ensembleStrategy = this.ensembleStrategies.get(strategy);
    if (!ensembleStrategy) {
      throw new Error(`Unknown ensemble strategy: ${strategy}`);
    }

    const unifiedPrediction = await this.applyEnsembleStrategy(
      modelPredictions,
      ensembleStrategy,
      board
    );

    // Update prediction with metadata
    unifiedPrediction.ensembleMethod = strategy;
    unifiedPrediction.totalInferenceTime = performance.now() - startTime;

    // Cache prediction
    if (options?.useCache !== false) {
      this.cachePredicton(board, strategy, unifiedPrediction);
    }

    // Update performance metrics
    this.updatePerformanceMetrics(modelPredictions);

    // Emit prediction event
    this.eventEmitter.emit('unified.prediction.made', {
      strategy,
      modelsUsed: modelPredictions.length,
      inferenceTime: unifiedPrediction.totalInferenceTime,
      confidence: unifiedPrediction.confidence
    });

    return unifiedPrediction;
  }

  /**
   * Get predictions from individual models
   */
  private async getModelPredictions(
    board: CellValue[][],
    models: UnifiedModelConfig[],
    timeLimit?: number
  ): Promise<Array<{
    modelName: string;
    modelType: string;
    prediction: ModelPrediction | NetworkPrediction | TransferLearningPrediction;
    weight: number;
    inferenceTime: number;
  }>> {
    const predictions = await Promise.allSettled(
      models.map(async (model) => {
        const startTime = performance.now();

        try {
          let prediction: any;

          // Get prediction based on model type
          switch (model.type) {
            case 'onnx':
              prediction = await this.onnxEngine.predict(model.name, board);
              break;
            case 'brain':
              prediction = await this.brainNetwork.predict(model.name, board);
              break;
            case 'ml5':
              prediction = await this.ml5Transfer.predict(model.name, board);
              break;
          }

          const inferenceTime = performance.now() - startTime;

          // Check time limit
          if (timeLimit && inferenceTime > timeLimit) {
            this.logger.warn(`Model ${model.name} exceeded time limit: ${inferenceTime}ms`);
          }

          return {
            modelName: model.name,
            modelType: model.type,
            prediction,
            weight: model.weight || 1.0,
            inferenceTime
          };

        } catch (error) {
          this.logger.error(`Error getting prediction from ${model.name}:`, error);
          throw error;
        }
      })
    );

    // Filter successful predictions
    return predictions
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * Apply ensemble strategy to predictions
   */
  private async applyEnsembleStrategy(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy,
    board: CellValue[][]
  ): Promise<UnifiedPrediction> {
    switch (strategy.method) {
      case 'weighted_average':
        return this.weightedAverageEnsemble(predictions, strategy);
      
      case 'voting':
        return this.votingEnsemble(predictions, strategy);
      
      case 'stacking':
        return this.stackingEnsemble(predictions, strategy, board);
      
      case 'boosting':
        return this.boostingEnsemble(predictions, strategy);
      
      case 'dynamic':
        return this.dynamicEnsemble(predictions, strategy, board);
      
      default:
        return this.weightedAverageEnsemble(predictions, strategy);
    }
  }

  /**
   * Weighted average ensemble
   */
  private weightedAverageEnsemble(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy
  ): UnifiedPrediction {
    const numColumns = 7;
    const ensembledPolicy = new Array(numColumns).fill(0);
    let ensembledValue = 0;
    let totalWeight = 0;

    // Adaptive weights based on model performance
    const weights = strategy.adaptiveWeights ? 
      this.calculateAdaptiveWeights(predictions) : 
      predictions.map(p => p.weight);

    // Calculate weighted averages
    predictions.forEach((pred, idx) => {
      const weight = weights[idx];
      totalWeight += weight;

      // Get policy from prediction
      const policy = this.extractPolicy(pred.prediction);
      for (let i = 0; i < numColumns; i++) {
        ensembledPolicy[i] += policy[i] * weight;
      }

      // Get value
      const value = this.extractValue(pred.prediction);
      ensembledValue += value * weight;
    });

    // Normalize
    for (let i = 0; i < numColumns; i++) {
      ensembledPolicy[i] /= totalWeight;
    }
    ensembledValue /= totalWeight;

    // Apply temperature scaling if specified
    if (strategy.temperatureScaling && strategy.temperatureScaling !== 1.0) {
      this.applyTemperatureScaling(ensembledPolicy, strategy.temperatureScaling);
    }

    // Find best move
    const validMoves = this.getValidMoves(ensembledPolicy);
    const bestMove = validMoves.reduce((best, move) => 
      ensembledPolicy[move] > ensembledPolicy[best] ? move : best
    );

    return {
      move: bestMove,
      confidence: ensembledPolicy[bestMove],
      value: ensembledValue,
      policy: ensembledPolicy,
      modelContributions: predictions.map((pred, idx) => ({
        modelName: pred.modelName,
        modelType: pred.modelType,
        contribution: weights[idx] / totalWeight,
        inferenceTime: pred.inferenceTime
      })),
      ensembleMethod: 'weighted_average',
      totalInferenceTime: 0
    };
  }

  /**
   * Voting ensemble
   */
  private votingEnsemble(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy
  ): UnifiedPrediction {
    const numColumns = 7;
    const votes = new Array(numColumns).fill(0);
    const policySum = new Array(numColumns).fill(0);
    let valueSum = 0;

    // Collect votes
    predictions.forEach(pred => {
      const policy = this.extractPolicy(pred.prediction);
      const bestMove = policy.indexOf(Math.max(...policy));
      
      // Only count vote if confidence exceeds threshold
      if (!strategy.confidenceThreshold || policy[bestMove] >= strategy.confidenceThreshold) {
        votes[bestMove] += pred.weight;
      }

      // Still accumulate policies and values
      for (let i = 0; i < numColumns; i++) {
        policySum[i] += policy[i];
      }
      valueSum += this.extractValue(pred.prediction);
    });

    // Normalize votes to create policy
    const totalVotes = votes.reduce((sum, v) => sum + v, 0);
    const votingPolicy = totalVotes > 0 ? 
      votes.map(v => v / totalVotes) : 
      policySum.map(p => p / predictions.length);

    // Find best move
    const bestMove = votes.indexOf(Math.max(...votes));
    const confidence = votingPolicy[bestMove];

    return {
      move: bestMove,
      confidence,
      value: valueSum / predictions.length,
      policy: votingPolicy,
      modelContributions: predictions.map(pred => ({
        modelName: pred.modelName,
        modelType: pred.modelType,
        contribution: 1 / predictions.length,
        inferenceTime: pred.inferenceTime
      })),
      ensembleMethod: 'voting',
      totalInferenceTime: 0
    };
  }

  /**
   * Stacking ensemble with meta-learner
   */
  private async stackingEnsemble(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy,
    board: CellValue[][]
  ): Promise<UnifiedPrediction> {
    // Create meta-features from base predictions
    const metaFeatures: number[] = [];

    predictions.forEach(pred => {
      const policy = this.extractPolicy(pred.prediction);
      const value = this.extractValue(pred.prediction);
      
      // Add policy as features
      metaFeatures.push(...policy);
      
      // Add value
      metaFeatures.push(value);
      
      // Add policy entropy as diversity measure
      const entropy = this.calculateEntropy(policy);
      metaFeatures.push(entropy);
      
      // Add max confidence
      metaFeatures.push(Math.max(...policy));
    });

    // Add board features
    metaFeatures.push(...this.extractBoardFeatures(board));

    // Use a meta-model to combine predictions
    // For now, we'll simulate this with a weighted combination based on features
    const metaWeights = this.calculateMetaWeights(metaFeatures, predictions.length);

    // Apply meta-weights
    const numColumns = 7;
    const stackedPolicy = new Array(numColumns).fill(0);
    let stackedValue = 0;

    predictions.forEach((pred, idx) => {
      const weight = metaWeights[idx];
      const policy = this.extractPolicy(pred.prediction);
      
      for (let i = 0; i < numColumns; i++) {
        stackedPolicy[i] += policy[i] * weight;
      }
      
      stackedValue += this.extractValue(pred.prediction) * weight;
    });

    // Normalize
    const totalWeight = metaWeights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < numColumns; i++) {
      stackedPolicy[i] /= totalWeight;
    }
    stackedValue /= totalWeight;

    const bestMove = stackedPolicy.indexOf(Math.max(...stackedPolicy));

    return {
      move: bestMove,
      confidence: stackedPolicy[bestMove],
      value: stackedValue,
      policy: stackedPolicy,
      modelContributions: predictions.map((pred, idx) => ({
        modelName: pred.modelName,
        modelType: pred.modelType,
        contribution: metaWeights[idx] / totalWeight,
        inferenceTime: pred.inferenceTime
      })),
      ensembleMethod: 'stacking',
      totalInferenceTime: 0,
      metadata: { metaFeatures: metaFeatures.length }
    };
  }

  /**
   * Boosting ensemble
   */
  private boostingEnsemble(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy
  ): UnifiedPrediction {
    // Sort predictions by model performance (best to worst)
    const sortedPredictions = [...predictions].sort((a, b) => {
      const perfA = this.modelPerformance.get(a.modelName)?.accuracy || 0;
      const perfB = this.modelPerformance.get(b.modelName)?.accuracy || 0;
      return perfB - perfA;
    });

    const numColumns = 7;
    const boostedPolicy = new Array(numColumns).fill(0);
    let boostedValue = 0;
    let remainingWeight = 1.0;

    // Apply boosting weights (exponentially decreasing)
    sortedPredictions.forEach((pred, idx) => {
      const boostWeight = remainingWeight * 0.5; // Take half of remaining weight
      remainingWeight -= boostWeight;

      const policy = this.extractPolicy(pred.prediction);
      for (let i = 0; i < numColumns; i++) {
        boostedPolicy[i] += policy[i] * boostWeight;
      }

      boostedValue += this.extractValue(pred.prediction) * boostWeight;
    });

    // Add remaining weight to best model
    if (remainingWeight > 0 && sortedPredictions.length > 0) {
      const bestPolicy = this.extractPolicy(sortedPredictions[0].prediction);
      for (let i = 0; i < numColumns; i++) {
        boostedPolicy[i] += bestPolicy[i] * remainingWeight;
      }
      boostedValue += this.extractValue(sortedPredictions[0].prediction) * remainingWeight;
    }

    const bestMove = boostedPolicy.indexOf(Math.max(...boostedPolicy));

    return {
      move: bestMove,
      confidence: boostedPolicy[bestMove],
      value: boostedValue,
      policy: boostedPolicy,
      modelContributions: sortedPredictions.map((pred, idx) => ({
        modelName: pred.modelName,
        modelType: pred.modelType,
        contribution: Math.pow(0.5, idx),
        inferenceTime: pred.inferenceTime
      })),
      ensembleMethod: 'boosting',
      totalInferenceTime: 0
    };
  }

  /**
   * Dynamic ensemble selection
   */
  private async dynamicEnsemble(
    predictions: Array<{
      modelName: string;
      modelType: string;
      prediction: any;
      weight: number;
      inferenceTime: number;
    }>,
    strategy: EnsembleStrategy,
    board: CellValue[][]
  ): Promise<UnifiedPrediction> {
    // Analyze board state to determine best ensemble method
    const boardComplexity = this.calculateBoardComplexity(board);
    const predictionDiversity = this.calculatePredictionDiversity(predictions);

    let selectedMethod: UnifiedPrediction;

    if (boardComplexity < 0.3) {
      // Simple position - use voting
      selectedMethod = this.votingEnsemble(predictions, {
        ...strategy,
        method: 'voting'
      });
    } else if (predictionDiversity > 0.7) {
      // High diversity - use stacking
      selectedMethod = await this.stackingEnsemble(predictions, {
        ...strategy,
        method: 'stacking'
      }, board);
    } else if (boardComplexity > 0.7) {
      // Complex position - use weighted average with adaptive weights
      selectedMethod = this.weightedAverageEnsemble(predictions, {
        ...strategy,
        method: 'weighted_average',
        adaptiveWeights: true
      });
    } else {
      // Default to boosting
      selectedMethod = this.boostingEnsemble(predictions, {
        ...strategy,
        method: 'boosting'
      });
    }

    // Override ensemble method name
    selectedMethod.ensembleMethod = 'dynamic';
    selectedMethod.metadata = {
      ...selectedMethod.metadata,
      selectedStrategy: selectedMethod.ensembleMethod,
      boardComplexity,
      predictionDiversity
    };

    return selectedMethod;
  }

  /**
   * Train models with game data
   */
  async trainModels(
    trainingData: Array<{
      board: CellValue[][];
      move: number;
      outcome: 'win' | 'loss' | 'draw';
    }>,
    modelFilter?: (model: UnifiedModelConfig) => boolean
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    const modelsToTrain = Array.from(this.models.values())
      .filter(modelFilter || (() => true));

    for (const model of modelsToTrain) {
      try {
        this.logger.log(`Training model: ${model.name}`);

        let result: any;

        switch (model.type) {
          case 'brain':
            const brainData = this.brainNetwork.generateTrainingData(trainingData);
            result = await this.brainNetwork.train(model.name, brainData);
            break;

          case 'ml5':
            for (const { board, move, outcome } of trainingData) {
              const value = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
              await this.ml5Transfer.addTrainingExample(model.name, board, move, value);
            }
            result = await this.ml5Transfer.train(model.name);
            break;

          case 'onnx':
            // ONNX models are typically pre-trained
            this.logger.log(`ONNX model ${model.name} is pre-trained`);
            result = { status: 'pre-trained' };
            break;
        }

        results.set(model.name, result);

        // Emit training complete event
        this.eventEmitter.emit('unified.model.trained', {
          modelName: model.name,
          modelType: model.type,
          result
        });

      } catch (error) {
        this.logger.error(`Failed to train model ${model.name}:`, error);
        results.set(model.name, { error: error.message });
      }
    }

    return results;
  }

  /**
   * Update model weights based on performance
   */
  async updateModelWeights(performanceData: Map<string, number>): Promise<void> {
    // Calculate new weights based on performance
    const totalPerformance = Array.from(performanceData.values())
      .reduce((sum, perf) => sum + perf, 0);

    for (const [modelName, performance] of performanceData) {
      const model = this.models.get(modelName);
      if (model) {
        // Update weight proportional to performance
        model.weight = performance / totalPerformance;
        this.logger.log(`Updated weight for ${modelName}: ${model.weight}`);
      }
    }

    // Emit weights updated event
    this.eventEmitter.emit('unified.weights.updated', {
      weights: Array.from(this.models.entries()).map(([name, model]) => ({
        modelName: name,
        weight: model.weight
      }))
    });
  }

  /**
   * Helper methods
   */

  private extractPolicy(prediction: any): number[] {
    if (Array.isArray(prediction)) {
      return prediction.slice(0, 7);
    }
    return prediction.policy || prediction.moveProbs || new Array(7).fill(1/7);
  }

  private extractValue(prediction: any): number {
    if (typeof prediction === 'number') {
      return prediction;
    }
    return prediction.value || 0;
  }

  private calculateAdaptiveWeights(predictions: any[]): number[] {
    const weights = predictions.map(pred => {
      const perf = this.modelPerformance.get(pred.modelName);
      if (!perf || perf.totalPredictions === 0) {
        return pred.weight;
      }

      // Weight based on accuracy and inference time
      const accuracyWeight = perf.accuracy;
      const speedWeight = 1 / (1 + perf.averageInferenceTime / 100);
      
      return pred.weight * (0.7 * accuracyWeight + 0.3 * speedWeight);
    });

    // Normalize weights
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum > 0 ? weights.map(w => w / sum) : weights;
  }

  private applyTemperatureScaling(policy: number[], temperature: number): void {
    // Apply temperature to logits
    const maxLogit = Math.max(...policy);
    const scaledExp = policy.map(logit => Math.exp((logit - maxLogit) / temperature));
    const sum = scaledExp.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < policy.length; i++) {
      policy[i] = scaledExp[i] / sum;
    }
  }

  private calculateEntropy(policy: number[]): number {
    return -policy.reduce((sum, p) => {
      return sum + (p > 0 ? p * Math.log(p) : 0);
    }, 0);
  }

  private calculateBoardComplexity(board: CellValue[][]): number {
    let complexity = 0;
    let pieces = 0;

    // Count pieces and patterns
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] !== 'Empty') {
          pieces++;
          
          // Check for threats
          if (this.isThreatPosition(board, r, c)) {
            complexity += 0.1;
          }
        }
      }
    }

    // Normalize by game progress
    complexity += pieces / 42;
    
    return Math.min(complexity, 1.0);
  }

  private calculatePredictionDiversity(predictions: any[]): number {
    if (predictions.length < 2) return 0;

    const policies = predictions.map(p => this.extractPolicy(p.prediction));
    let totalDistance = 0;
    let comparisons = 0;

    // Calculate pairwise distances
    for (let i = 0; i < policies.length - 1; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const distance = this.calculatePolicyDistance(policies[i], policies[j]);
        totalDistance += distance;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculatePolicyDistance(policy1: number[], policy2: number[]): number {
    // KL divergence
    let kl = 0;
    for (let i = 0; i < policy1.length; i++) {
      if (policy1[i] > 0 && policy2[i] > 0) {
        kl += policy1[i] * Math.log(policy1[i] / policy2[i]);
      }
    }
    return kl;
  }

  private extractBoardFeatures(board: CellValue[][]): number[] {
    const features: number[] = [];

    // Center column control
    let centerControl = 0;
    for (let r = 0; r < board.length; r++) {
      if (board[r][3] !== 'Empty') {
        centerControl += board[r][3] === 'Red' ? 1 : -1;
      }
    }
    features.push(centerControl / 6);

    // Piece count
    let redCount = 0, yellowCount = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] === 'Red') redCount++;
        else if (board[r][c] === 'Yellow') yellowCount++;
      }
    }
    features.push((redCount - yellowCount) / 42);

    // Height variance
    const heights = new Array(7).fill(0);
    for (let c = 0; c < 7; c++) {
      for (let r = 5; r >= 0; r--) {
        if (board[r][c] !== 'Empty') {
          heights[c] = 6 - r;
          break;
        }
      }
    }
    const avgHeight = heights.reduce((a, b) => a + b, 0) / 7;
    const variance = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / 7;
    features.push(variance / 36);

    return features;
  }

  private calculateMetaWeights(metaFeatures: number[], numModels: number): number[] {
    // Simulate meta-learner output
    const weights = new Array(numModels).fill(0);
    
    // Simple heuristic based on features
    for (let i = 0; i < numModels; i++) {
      const startIdx = i * 10; // Each model contributes 10 features
      const modelFeatures = metaFeatures.slice(startIdx, startIdx + 10);
      
      // Weight based on confidence and diversity
      const confidence = modelFeatures[7] || 0; // Max confidence
      const entropy = modelFeatures[8] || 0; // Entropy
      
      weights[i] = confidence * (1 - entropy / Math.log(7));
    }

    // Normalize
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum > 0 ? weights.map(w => w / sum) : weights.map(() => 1 / numModels);
  }

  private isThreatPosition(board: CellValue[][], row: number, col: number): boolean {
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    const player = board[row][col];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check forward
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check backward
      for (let i = 1; i < 4; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 3) return true;
    }
    
    return false;
  }

  private getValidMoves(policy: number[]): number[] {
    // For Connect Four, we'd check the top row
    // This is simplified - in reality would check actual board
    return Array.from({ length: 7 }, (_, i) => i);
  }

  private getCacheKey(board: CellValue[][], strategy: string): string {
    const boardStr = board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
    return `${boardStr}_${strategy}`;
  }

  private cachePredicton(board: CellValue[][], strategy: string, prediction: UnifiedPrediction): void {
    const key = this.getCacheKey(board, strategy);
    
    // Implement LRU cache
    if (this.predictionCache.size >= this.maxCacheSize) {
      const firstKey = this.predictionCache.keys().next().value;
      this.predictionCache.delete(firstKey);
    }
    
    this.predictionCache.set(key, prediction);
  }

  private updatePerformanceMetrics(predictions: any[]): void {
    predictions.forEach(pred => {
      const metrics = this.modelPerformance.get(pred.modelName);
      if (metrics) {
        metrics.totalPredictions++;
        metrics.averageInferenceTime = 
          (metrics.averageInferenceTime * (metrics.totalPredictions - 1) + pred.inferenceTime) / 
          metrics.totalPredictions;
        metrics.lastUpdated = new Date();
      }
    });
  }

  /**
   * Public API methods
   */

  getModelInfo(modelName: string): any {
    const model = this.models.get(modelName);
    const performance = this.modelPerformance.get(modelName);
    
    return {
      config: model,
      performance,
      enabled: model?.enabled,
      weight: model?.weight
    };
  }

  listModels(): string[] {
    return Array.from(this.models.keys());
  }

  enableModel(modelName: string): void {
    const model = this.models.get(modelName);
    if (model) {
      model.enabled = true;
      this.logger.log(`Model ${modelName} enabled`);
    }
  }

  disableModel(modelName: string): void {
    const model = this.models.get(modelName);
    if (model) {
      model.enabled = false;
      this.logger.log(`Model ${modelName} disabled`);
    }
  }

  async saveModels(directory: string): Promise<void> {
    for (const [name, model] of this.models) {
      try {
        const path = `${directory}/${name}`;
        
        switch (model.type) {
          case 'brain':
            const brainData = this.brainNetwork.saveNetwork(name);
            await require('fs').promises.writeFile(
              `${path}.json`,
              JSON.stringify(brainData, null, 2)
            );
            break;
            
          case 'ml5':
            await this.ml5Transfer.saveModel(name, path);
            break;
            
          case 'onnx':
            // ONNX models are already saved as files
            this.logger.log(`ONNX model ${name} already persisted`);
            break;
        }
        
      } catch (error) {
        this.logger.error(`Failed to save model ${name}:`, error);
      }
    }
  }

  getPerformanceReport(): any {
    const models = Array.from(this.modelPerformance.values());
    
    return {
      totalModels: models.length,
      averageAccuracy: models.reduce((sum, m) => sum + m.accuracy, 0) / models.length,
      averageInferenceTime: models.reduce((sum, m) => sum + m.averageInferenceTime, 0) / models.length,
      modelPerformance: models,
      cacheHitRate: this.predictionCache.size / this.maxCacheSize,
      ensembleStrategies: Array.from(this.ensembleStrategies.keys())
    };
  }
}