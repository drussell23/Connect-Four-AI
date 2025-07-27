/**
 * TypeScript ML Service
 * High-level service demonstrating the power of TypeScript-native ML
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import { UnifiedMLManager, UnifiedModelConfig } from './unified-ml-manager';
import { ModelEnsembleVoting, EnsembleMember } from './model-ensemble-voting';
import * as path from 'path';

export interface MLPredictionResult {
  move: number;
  confidence: number;
  value: number;
  reasoning: {
    ensembleMethod: string;
    modelsUsed: number;
    consensus: number;
    inferenceTime: number;
  };
  modelBreakdown: Array<{
    model: string;
    contribution: number;
    confidence: number;
  }>;
}

@Injectable()
export class TypeScriptMLService implements OnModuleInit {
  private readonly logger = new Logger(TypeScriptMLService.name);
  private initialized = false;

  constructor(
    private readonly unifiedManager: UnifiedMLManager,
    private readonly ensembleVoting: ModelEnsembleVoting,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * Initialize ML models
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.log('Initializing TypeScript ML Service...');

    try {
      // Register ONNX models
      await this.registerONNXModels();

      // Register Brain.js networks
      await this.registerBrainNetworks();

      // Register ML5.js transfer learning models
      // Temporarily disabled for faster startup
      // await this.registerML5Models();

      // Register ensemble members
      await this.registerEnsembleMembers();

      this.initialized = true;
      this.logger.log('TypeScript ML Service initialized successfully');

      // Emit initialization complete
      this.eventEmitter.emit('typescript-ml.initialized', {
        totalModels: this.unifiedManager.listModels().length,
        ensembleMembers: this.ensembleVoting.getEnsembleStats().memberDetails.length
      });

    } catch (error) {
      this.logger.error('Failed to initialize TypeScript ML Service:', error);
      throw error;
    }
  }

  /**
   * Make AI prediction using full ML ensemble
   */
  async predict(
    board: CellValue[][],
    options?: {
      strategy?: 'fast' | 'balanced' | 'accurate';
      timeLimit?: number;
      minConfidence?: number;
    }
  ): Promise<MLPredictionResult> {
    const strategy = options?.strategy || 'balanced';
    const timeLimit = options?.timeLimit || 5000;

    // Select ensemble strategy based on requested mode
    let ensembleStrategy: string;
    let votingMethod: 'plurality' | 'borda' | 'condorcet' | 'quadratic';

    switch (strategy) {
      case 'fast':
        ensembleStrategy = 'voting';
        votingMethod = 'plurality';
        break;
      case 'accurate':
        ensembleStrategy = 'dynamic';
        votingMethod = 'condorcet';
        break;
      default:
        ensembleStrategy = 'weighted_average';
        votingMethod = 'borda';
    }

    // Get unified prediction
    const unifiedPrediction = await this.unifiedManager.predict(
      board,
      ensembleStrategy,
      {
        timeLimit,
        useCache: strategy === 'fast'
      }
    );

    // If confidence is too low, run ensemble voting
    if (unifiedPrediction.confidence < (options?.minConfidence || 0.3)) {
      const modelPredictions = new Map<string, { move: number; confidence: number }>();
      
      // Convert unified predictions to voting format
      unifiedPrediction.modelContributions.forEach(contrib => {
        const moveIdx = unifiedPrediction.policy.indexOf(Math.max(...unifiedPrediction.policy));
        modelPredictions.set(contrib.modelName, {
          move: moveIdx,
          confidence: contrib.contribution
        });
      });

      // Run ensemble voting
      const votingResult = await this.ensembleVoting.vote(
        modelPredictions,
        board,
        {
          votingMethod,
          weightingScheme: 'adaptive',
          diversityBonus: 0.1,
          consensusThreshold: 0.5,
          expertiseWeighting: true,
          dynamicReweighting: true
        }
      );

      // Use voting result if higher confidence
      if (votingResult.confidence > unifiedPrediction.confidence) {
        return {
          move: votingResult.move,
          confidence: votingResult.confidence,
          value: unifiedPrediction.value,
          reasoning: {
            ensembleMethod: `${ensembleStrategy}_with_${votingMethod}_voting`,
            modelsUsed: modelPredictions.size,
            consensus: votingResult.consensus,
            inferenceTime: unifiedPrediction.totalInferenceTime
          },
          modelBreakdown: Array.from(votingResult.votes.entries()).map(([model, move]) => ({
            model,
            contribution: 1 / votingResult.votes.size,
            confidence: votingResult.confidence
          }))
        };
      }
    }

    // Return unified prediction
    return {
      move: unifiedPrediction.move,
      confidence: unifiedPrediction.confidence,
      value: unifiedPrediction.value,
      reasoning: {
        ensembleMethod: unifiedPrediction.ensembleMethod,
        modelsUsed: unifiedPrediction.modelContributions.length,
        consensus: this.calculateConsensus(unifiedPrediction.modelContributions),
        inferenceTime: unifiedPrediction.totalInferenceTime
      },
      modelBreakdown: unifiedPrediction.modelContributions.map(contrib => ({
        model: contrib.modelName,
        contribution: contrib.contribution,
        confidence: unifiedPrediction.confidence * contrib.contribution
      }))
    };
  }

  /**
   * Train models with game history
   */
  async train(
    gameHistory: Array<{
      board: CellValue[][];
      move: number;
      outcome: 'win' | 'loss' | 'draw';
    }>
  ): Promise<void> {
    this.logger.log(`Training models with ${gameHistory.length} game positions`);

    // Train all models
    const results = await this.unifiedManager.trainModels(gameHistory);

    // Log results
    for (const [model, result] of results) {
      this.logger.log(`Training result for ${model}:`, result);
    }

    // Update ensemble weights based on training performance
    const performanceMap = new Map<string, number>();
    
    for (const [model, result] of results) {
      if (result && !result.error) {
        // Score based on training metrics
        const score = result.accuracy || (1 - (result.error || 0));
        performanceMap.set(model, score);
      }
    }

    await this.unifiedManager.updateModelWeights(performanceMap);

    this.logger.log('Model training completed');
  }

  /**
   * Register ONNX models
   */
  private async registerONNXModels(): Promise<void> {
    // AlphaZero-style model
    const alphaZeroConfig: UnifiedModelConfig = {
      name: 'alphazero_onnx',
      type: 'onnx',
      config: {
        modelPath: path.join(__dirname, 'models', 'alphazero.onnx'),
        modelName: 'alphazero_onnx',
        inputShape: [1, 3, 6, 7], // batch, channels, height, width
        outputNames: ['policy', 'value'],
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      },
      weight: 1.5,
      priority: 3
    };

    // Note: In production, you would have actual ONNX model files
    // For now, we'll skip if files don't exist
    try {
      await this.unifiedManager.registerModel(alphaZeroConfig);
    } catch (error) {
      this.logger.warn('AlphaZero ONNX model not available:', error.message);
    }

    // MuZero-style model
    const muZeroConfig: UnifiedModelConfig = {
      name: 'muzero_onnx',
      type: 'onnx',
      config: {
        modelPath: path.join(__dirname, 'models', 'muzero.onnx'),
        modelName: 'muzero_onnx',
        inputShape: [1, 3, 6, 7],
        outputNames: ['policy', 'value', 'features'],
        executionProviders: ['cpu'],
        enableMemoryPattern: true
      },
      weight: 1.8,
      priority: 4
    };

    try {
      await this.unifiedManager.registerModel(muZeroConfig);
    } catch (error) {
      this.logger.warn('MuZero ONNX model not available:', error.message);
    }
  }

  /**
   * Register Brain.js networks
   */
  private async registerBrainNetworks(): Promise<void> {
    // Deep feedforward network
    const deepFFConfig: UnifiedModelConfig = {
      name: 'deep_ff_brain',
      type: 'brain',
      config: {
        type: 'feedforward',
        hiddenLayers: [256, 128, 64, 32],
        activation: 'relu',
        learningRate: 0.001,
        momentum: 0.9,
        iterations: 1000,
        errorThresh: 0.005,
        dropout: 0.2
      },
      weight: 1.2,
      priority: 2
    };

    await this.unifiedManager.registerModel(deepFFConfig);

    // LSTM for sequence patterns
    const lstmConfig: UnifiedModelConfig = {
      name: 'lstm_brain',
      type: 'brain',
      config: {
        type: 'lstm',
        hiddenLayers: [128, 64],
        activation: 'tanh',
        learningRate: 0.005,
        momentum: 0.95,
        iterations: 500,
        errorThresh: 0.01
      },
      weight: 1.0,
      priority: 2
    };

    await this.unifiedManager.registerModel(lstmConfig);

    // GRU for efficient sequence learning
    const gruConfig: UnifiedModelConfig = {
      name: 'gru_brain',
      type: 'brain',
      config: {
        type: 'gru',
        hiddenLayers: [96],
        activation: 'sigmoid',
        learningRate: 0.003,
        momentum: 0.9,
        iterations: 750,
        errorThresh: 0.008
      },
      weight: 0.9,
      priority: 1
    };

    await this.unifiedManager.registerModel(gruConfig);
  }

  /**
   * Register ML5.js transfer learning models
   */
  private async registerML5Models(): Promise<void> {
    // MobileNet transfer learning
    const mobileNetConfig: UnifiedModelConfig = {
      name: 'mobilenet_ml5',
      type: 'ml5',
      config: {
        baseModel: 'MobileNet',
        numClasses: 7,
        learningRate: 0.001,
        batchSize: 16,
        epochs: 20,
        hiddenUnits: [128, 64],
        dropoutRate: 0.5
      },
      weight: 1.1,
      priority: 2
    };

    await this.unifiedManager.registerModel(mobileNetConfig);

    // ResNet50 transfer learning
    const resNetConfig: UnifiedModelConfig = {
      name: 'resnet50_ml5',
      type: 'ml5',
      config: {
        baseModel: 'ResNet50',
        numClasses: 7,
        learningRate: 0.0005,
        batchSize: 8,
        epochs: 30,
        hiddenUnits: [256, 128, 64],
        dropoutRate: 0.4,
        l2Regularization: 0.01
      },
      weight: 1.3,
      priority: 3
    };

    await this.unifiedManager.registerModel(resNetConfig);
  }

  /**
   * Register ensemble members
   */
  private async registerEnsembleMembers(): Promise<void> {
    // Strategic ensemble member
    const strategicMember: EnsembleMember = {
      id: 'strategic_ensemble',
      name: 'Strategic AI',
      type: 'hybrid',
      weight: 1.2,
      reliability: 0.8,
      specialization: {
        openingStrength: 0.9,
        middlegameStrength: 0.7,
        endgameStrength: 0.6,
        tacticalStrength: 0.5,
        strategicStrength: 0.95
      }
    };

    this.ensembleVoting.registerMember(strategicMember);

    // Tactical ensemble member
    const tacticalMember: EnsembleMember = {
      id: 'tactical_ensemble',
      name: 'Tactical AI',
      type: 'neural',
      weight: 1.0,
      reliability: 0.85,
      specialization: {
        openingStrength: 0.6,
        middlegameStrength: 0.9,
        endgameStrength: 0.95,
        tacticalStrength: 0.98,
        strategicStrength: 0.6
      }
    };

    this.ensembleVoting.registerMember(tacticalMember);

    // Balanced ensemble member
    const balancedMember: EnsembleMember = {
      id: 'balanced_ensemble',
      name: 'Balanced AI',
      type: 'tree',
      weight: 1.1,
      reliability: 0.9,
      specialization: {
        openingStrength: 0.8,
        middlegameStrength: 0.8,
        endgameStrength: 0.8,
        tacticalStrength: 0.8,
        strategicStrength: 0.8
      }
    };

    this.ensembleVoting.registerMember(balancedMember);
  }

  /**
   * Calculate consensus from model contributions
   */
  private calculateConsensus(contributions: Array<{ contribution: number }>): number {
    if (contributions.length === 0) return 0;

    const weights = contributions.map(c => c.contribution);
    const maxWeight = Math.max(...weights);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // High consensus if one model dominates
    return maxWeight / totalWeight;
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    models: string[];
    ensembleMembers: number;
    performance: any;
  } {
    return {
      initialized: this.initialized,
      models: this.unifiedManager.listModels(),
      ensembleMembers: this.ensembleVoting.getEnsembleStats().memberDetails.length,
      performance: this.unifiedManager.getPerformanceReport()
    };
  }

  /**
   * Save all models
   */
  async saveModels(directory: string): Promise<void> {
    await this.unifiedManager.saveModels(directory);
    this.logger.log(`Models saved to ${directory}`);
  }
}