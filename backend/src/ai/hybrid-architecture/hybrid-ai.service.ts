/**
 * Hybrid AI Service
 * Leverages Python for training and TypeScript for inference
 * Provides seamless integration between both worlds
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CellValue } from '../connect4AI';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

// Try to load onnxruntime-node, but make it optional
let ort: any;
let InferenceSession: any;
let Tensor: any;
try {
  ort = require('onnxruntime-node');
  InferenceSession = ort.InferenceSession;
  Tensor = ort.Tensor;
} catch (error) {
  console.warn('⚠️ ONNX Runtime not available - ONNX model support disabled');
}

export enum ModelType {
  ALPHAZERO = 'alphazero',
  MUZERO = 'muzero',
  PPO = 'ppo',
  DQN = 'dqn',
  TRANSFORMER = 'transformer',
  ENSEMBLE = 'ensemble'
}

export interface TrainingConfig {
  modelType: ModelType;
  batchSize?: number;
  learningRate?: number;
  epochs?: number;
  validationSplit?: number;
  earlyStoppingPatience?: number;
  optimizer?: 'adam' | 'sgd' | 'rmsprop' | 'adamw';
  scheduler?: 'cosine' | 'step' | 'exponential';
  regularization?: {
    l2?: number;
    dropout?: number;
    weightDecay?: number;
  };
  advancedConfig?: Record<string, any>;
}

export interface TrainingExample {
  board: {
    board: number[][];
    player: number;
  };
  move: number;
  value: number;
  policy?: number[];
}

export interface TrainingJob {
  jobId: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  metrics: Record<string, number>;
  error?: string;
  modelPath?: string;
}

export interface ModelVersion {
  id: string;
  modelType: ModelType;
  version: string;
  createdAt: Date;
  metrics: Record<string, number>;
  onnxPath: string;
  active: boolean;
  description?: string;
}

export interface HybridPrediction {
  move: number;
  policy: number[];
  value: number;
  confidence: number;
  modelVersion: string;
  inferenceTime: number;
}

@Injectable()
export class HybridAIService implements OnModuleInit {
  private readonly logger = new Logger(HybridAIService.name);
  private pythonClient: AxiosInstance;
  private inferenceSession: any | null = null;
  private modelVersions: Map<string, ModelVersion> = new Map();
  private activeModelId: string | null = null;
  private trainingQueue: TrainingExample[] = [];
  private readonly modelsDir = path.join(__dirname, 'models');
  private readonly dataDir = path.join(__dirname, 'training-data');

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.pythonClient = axios.create({
      baseURL: process.env.PYTHON_TRAINER_URL || 'http://localhost:8002',
      timeout: 300000, // 5 minutes for training requests
    });
  }

  async onModuleInit() {
    this.logger.log('Initializing Hybrid AI Service...');

    // Create directories
    await this.ensureDirectories();

    // Check Python trainer health
    await this.checkPythonTrainerHealth();

    // Load existing models
    await this.loadExistingModels();

    // Load active model for inference
    if (this.activeModelId) {
      await this.loadModelForInference(this.activeModelId);
    }

    this.logger.log('Hybrid AI Service initialized');
  }

  /**
   * Train a new model using Python service
   */
  async trainModel(
    examples: TrainingExample[],
    config: TrainingConfig,
    description?: string
  ): Promise<TrainingJob> {
    this.logger.log(`Starting training job for ${config.modelType} model`);

    try {
      // Validate training data
      this.validateTrainingData(examples);

      // Create training request
      const jobId = uuidv4();
      const response = await this.pythonClient.post('/train', {
        examples,
        config: {
          model_type: config.modelType,
          batch_size: config.batchSize || 128,
          learning_rate: config.learningRate || 0.001,
          epochs: config.epochs || 100,
          validation_split: config.validationSplit || 0.2,
          early_stopping_patience: config.earlyStoppingPatience || 10,
          optimizer: config.optimizer || 'adam',
          scheduler: config.scheduler,
          regularization: config.regularization,
          advanced_config: config.advancedConfig,
        },
        job_id: jobId,
        experiment_name: `connect_four_${Date.now()}`,
      });

      const job: TrainingJob = response.data;

      // Emit training started event
      this.eventEmitter.emit('hybrid.training.started', {
        jobId: job.jobId,
        modelType: config.modelType,
        examples: examples.length,
      });

      // Monitor training progress
      this.monitorTrainingJob(job.jobId);

      return job;
    } catch (error) {
      this.logger.error('Failed to start training:', error);
      throw error;
    }
  }

  /**
   * Train model incrementally with new examples
   */
  async incrementalTrain(
    examples: TrainingExample[],
    baseModelId?: string
  ): Promise<TrainingJob> {
    this.logger.log('Starting incremental training');

    // Add examples to training queue
    this.trainingQueue.push(...examples);

    // If queue is large enough, trigger training
    if (this.trainingQueue.length >= 1000) {
      const config: TrainingConfig = {
        modelType: ModelType.ALPHAZERO,
        epochs: 20, // Fewer epochs for incremental training
        learningRate: 0.0001, // Lower learning rate for fine-tuning
        advancedConfig: {
          baseModel: baseModelId || this.activeModelId,
          incrementalMode: true,
        },
      };

      const job = await this.trainModel(this.trainingQueue, config, 'Incremental training');
      this.trainingQueue = []; // Clear queue
      return job;
    }

    // Return dummy job for now
    return {
      jobId: 'queued',
      status: 'pending',
      progress: 0,
      currentEpoch: 0,
      totalEpochs: 0,
      metrics: {},
    };
  }

  /**
   * Make prediction using active ONNX model
   */
  async predict(board: CellValue[][]): Promise<HybridPrediction> {
    if (!this.inferenceSession) {
      throw new Error('No model loaded for inference');
    }

    const startTime = performance.now();

    try {
      // Convert board to tensor
      const inputTensor = this.boardToTensor(board);

      // Run inference
      const feeds = { input: inputTensor };
      const results = await this.inferenceSession.run(feeds);

      // Extract outputs
      const policy = await this.extractPolicy(results.policy);
      const value = (results.value.data as Float32Array)[0];

      // Find best valid move
      const validMoves = this.getValidMoves(board);
      let bestMove = -1;
      let maxProb = -1;

      for (const move of validMoves) {
        if (policy[move] > maxProb) {
          maxProb = policy[move];
          bestMove = move;
        }
      }

      const inferenceTime = performance.now() - startTime;

      // Clean up
      inputTensor.dispose();

      const prediction: HybridPrediction = {
        move: bestMove,
        policy,
        value,
        confidence: maxProb,
        modelVersion: this.activeModelId || 'unknown',
        inferenceTime,
      };

      // Emit prediction event
      this.eventEmitter.emit('hybrid.prediction.made', {
        move: prediction.move,
        confidence: prediction.confidence,
        inferenceTime,
      });

      return prediction;
    } catch (error) {
      this.logger.error('Prediction failed:', error);
      throw error;
    }
  }

  /**
   * Ensemble prediction using multiple models
   */
  async ensemblePredict(
    board: CellValue[][],
    modelIds?: string[]
  ): Promise<HybridPrediction> {
    const modelsToUse = modelIds || Array.from(this.modelVersions.keys()).slice(0, 3);
    
    if (modelsToUse.length === 0) {
      throw new Error('No models available for ensemble prediction');
    }

    const predictions: HybridPrediction[] = [];

    // Get predictions from each model
    for (const modelId of modelsToUse) {
      const model = this.modelVersions.get(modelId);
      if (!model) continue;

      // Load model temporarily
      const session = await InferenceSession.create(model.onnxPath);
      const inputTensor = this.boardToTensor(board);
      const results = await session.run({ input: inputTensor });

      const policy = await this.extractPolicy(results.policy);
      const value = (results.value.data as Float32Array)[0];

      predictions.push({
        move: 0, // Will be calculated
        policy,
        value,
        confidence: 0,
        modelVersion: modelId,
        inferenceTime: 0,
      });

      inputTensor.dispose();
    }

    // Ensemble the predictions
    return this.combineEnsemblePredictions(predictions, board);
  }

  /**
   * Download and deploy model from Python trainer
   */
  async deployModel(jobId: string, activate: boolean = true): Promise<ModelVersion> {
    this.logger.log(`Deploying model from job ${jobId}`);

    try {
      // Check job status
      const statusResponse = await this.pythonClient.get(`/status/${jobId}`);
      const job: TrainingJob = statusResponse.data;

      if (job.status !== 'completed') {
        throw new Error(`Job ${jobId} is not completed yet`);
      }

      // Download ONNX model
      const modelResponse = await this.pythonClient.get(`/download/${jobId}`, {
        responseType: 'arraybuffer',
        params: { format: 'onnx' },
      });

      // Save model to disk
      const modelPath = path.join(this.modelsDir, `${jobId}.onnx`);
      await fs.writeFile(modelPath, Buffer.from(modelResponse.data));

      // Get model metadata
      const metadataResponse = await this.pythonClient.get(`/models`);
      const metadata = metadataResponse.data.find((m: any) => m.model_id === jobId);

      // Create model version
      const version: ModelVersion = {
        id: jobId,
        modelType: metadata.model_type,
        version: this.generateVersion(),
        createdAt: new Date(metadata.created_at),
        metrics: metadata.training_metrics,
        onnxPath: modelPath,
        active: activate,
        description: metadata.description,
      };

      // Store version
      this.modelVersions.set(version.id, version);
      await this.saveModelRegistry();

      // Activate if requested
      if (activate) {
        await this.activateModel(version.id);
      }

      // Emit deployment event
      this.eventEmitter.emit('hybrid.model.deployed', {
        modelId: version.id,
        modelType: version.modelType,
        version: version.version,
        active: version.active,
      });

      return version;
    } catch (error) {
      this.logger.error(`Failed to deploy model ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Activate a model for inference
   */
  async activateModel(modelId: string): Promise<void> {
    const model = this.modelVersions.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Deactivate current model
    if (this.activeModelId) {
      const currentModel = this.modelVersions.get(this.activeModelId);
      if (currentModel) {
        currentModel.active = false;
      }
    }

    // Load new model
    await this.loadModelForInference(modelId);
    model.active = true;
    this.activeModelId = modelId;

    await this.saveModelRegistry();

    this.logger.log(`Activated model ${modelId}`);
  }

  /**
   * Run hyperparameter search
   */
  async hyperparameterSearch(
    examples: TrainingExample[],
    searchSpace: Record<string, any>
  ): Promise<Record<string, any>> {
    this.logger.log('Starting hyperparameter search');

    try {
      const response = await this.pythonClient.post('/hyperparameter-search', {
        examples,
        search_space: searchSpace,
      });

      const results = response.data;

      // Train model with best config
      const bestConfig: TrainingConfig = {
        modelType: ModelType.ALPHAZERO,
        ...results.best_config,
      };

      const job = await this.trainModel(
        examples,
        bestConfig,
        'Model from hyperparameter search'
      );

      return {
        bestConfig: results.best_config,
        trainingJobId: job.jobId,
        searchResults: results.results,
      };
    } catch (error) {
      this.logger.error('Hyperparameter search failed:', error);
      throw error;
    }
  }

  /**
   * Scheduled model retraining
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledRetrain(): Promise<void> {
    this.logger.log('Starting scheduled model retraining');

    // Load recent game data
    const recentGames = await this.loadRecentGameData();
    
    if (recentGames.length < 100) {
      this.logger.log('Not enough game data for retraining');
      return;
    }

    // Convert to training examples
    const examples = this.gamesToTrainingExamples(recentGames);

    // Train new model
    const config: TrainingConfig = {
      modelType: ModelType.ALPHAZERO,
      epochs: 50,
      advancedConfig: {
        scheduledTraining: true,
        baseModel: this.activeModelId,
      },
    };

    const job = await this.trainModel(examples, config, 'Scheduled retraining');

    // Monitor and auto-deploy if better
    this.monitorAndAutoDeploy(job.jobId);
  }

  /**
   * Export training data for analysis
   */
  async exportTrainingData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const dataPath = path.join(this.dataDir, `training_data_${Date.now()}.${format}`);

    if (format === 'json') {
      await fs.writeFile(dataPath, JSON.stringify(this.trainingQueue, null, 2));
    } else {
      // Convert to CSV
      const csv = this.trainingDataToCSV(this.trainingQueue);
      await fs.writeFile(dataPath, csv);
    }

    return dataPath;
  }

  /**
   * Get model performance comparison
   */
  async compareModels(
    modelIds: string[],
    testExamples: TrainingExample[]
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const modelId of modelIds) {
      const model = this.modelVersions.get(modelId);
      if (!model) continue;

      // Load model
      const session = await InferenceSession.create(model.onnxPath);
      
      let correct = 0;
      let totalLoss = 0;
      const infernceTimes: number[] = [];

      for (const example of testExamples) {
        const startTime = performance.now();
        
        const inputTensor = this.boardToTensor(example.board.board as any);
        const results = await session.run({ input: inputTensor });
        
        const policy = await this.extractPolicy(results.policy);
        const value = (results.value.data as Float32Array)[0];
        
        // Check if predicted move matches
        const predictedMove = policy.indexOf(Math.max(...policy));
        if (predictedMove === example.move) {
          correct++;
        }
        
        // Calculate loss
        const policyLoss = -Math.log(policy[example.move] + 1e-8);
        const valueLoss = Math.pow(value - example.value, 2);
        totalLoss += policyLoss + valueLoss;
        
        infernceTimes.push(performance.now() - startTime);
        inputTensor.dispose();
      }

      results[modelId] = {
        accuracy: correct / testExamples.length,
        averageLoss: totalLoss / testExamples.length,
        averageInferenceTime: infernceTimes.reduce((a, b) => a + b, 0) / infernceTimes.length,
        model: model,
      };
    }

    return results;
  }

  /**
   * Private helper methods
   */

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true });
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  private async checkPythonTrainerHealth(): Promise<void> {
    try {
      const response = await this.pythonClient.get('/health');
      this.logger.log('Python trainer health:', response.data);
    } catch (error) {
      this.logger.warn('Python trainer not available:', error.message);
    }
  }

  private async loadExistingModels(): Promise<void> {
    const registryPath = path.join(this.modelsDir, 'registry.json');
    
    try {
      const data = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(data);
      
      for (const [id, version] of Object.entries(registry.models)) {
        this.modelVersions.set(id, version as ModelVersion);
        
        if ((version as ModelVersion).active) {
          this.activeModelId = id;
        }
      }
      
      this.logger.log(`Loaded ${this.modelVersions.size} models from registry`);
    } catch (error) {
      this.logger.log('No existing model registry found');
    }
  }

  private async loadModelForInference(modelId: string): Promise<void> {
    const model = this.modelVersions.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Dispose current session
    if (this.inferenceSession) {
      // await this.inferenceSession.dispose(); // dispose() may not be available in all versions
      this.inferenceSession = null;
    }

    // Load new session
    if (!InferenceSession) {
      throw new Error('ONNX Runtime not available');
    }
    this.inferenceSession = await InferenceSession.create(model.onnxPath);
    this.logger.log(`Loaded model ${modelId} for inference`);
  }

  private async saveModelRegistry(): Promise<void> {
    const registry = {
      models: Object.fromEntries(this.modelVersions),
      activeModel: this.activeModelId,
      lastUpdated: new Date(),
    };

    const registryPath = path.join(this.modelsDir, 'registry.json');
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
  }

  private validateTrainingData(examples: TrainingExample[]): void {
    if (examples.length === 0) {
      throw new Error('No training examples provided');
    }

    for (const example of examples) {
      if (!example.board || !example.board.board) {
        throw new Error('Invalid board state in training example');
      }

      if (example.move < 0 || example.move >= 7) {
        throw new Error('Invalid move in training example');
      }

      if (example.value < -1 || example.value > 1) {
        throw new Error('Invalid value in training example');
      }
    }
  }

  private async monitorTrainingJob(jobId: string): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        const response = await this.pythonClient.get(`/status/${jobId}`);
        const job: TrainingJob = response.data;

        // Emit progress update
        this.eventEmitter.emit('hybrid.training.progress', {
          jobId: job.jobId,
          progress: job.progress,
          currentEpoch: job.currentEpoch,
          metrics: job.metrics,
        });

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(checkInterval);

          this.eventEmitter.emit('hybrid.training.completed', {
            jobId: job.jobId,
            status: job.status,
            metrics: job.metrics,
            error: job.error,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to check job status for ${jobId}:`, error);
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds
  }

  private boardToTensor(board: CellValue[][]): any {
    const data = new Float32Array(1 * 3 * 6 * 7);
    let idx = 0;

    // 3 channels: red, yellow, empty
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 6; r++) {
        for (let col = 0; col < 7; col++) {
          const cell = board[r][col];
          
          if (c === 0 && cell === 'Red') data[idx] = 1;
          else if (c === 1 && cell === 'Yellow') data[idx] = 1;
          else if (c === 2 && cell === 'Empty') data[idx] = 1;
          
          idx++;
        }
      }
    }

    return Tensor ? new Tensor('float32', data, [1, 3, 6, 7]) : null;
  }

  private async extractPolicy(policyTensor: any): Promise<number[]> {
    const data = policyTensor.data as Float32Array;
    
    // Apply softmax
    const maxLogit = Math.max(...data);
    const exp = Array.from(data).map(x => Math.exp(x - maxLogit));
    const sum = exp.reduce((a, b) => a + b, 0);
    
    return exp.map(x => x / sum);
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    
    return moves;
  }

  private combineEnsemblePredictions(
    predictions: HybridPrediction[],
    board: CellValue[][]
  ): HybridPrediction {
    const numColumns = 7;
    const ensembledPolicy = new Array(numColumns).fill(0);
    let ensembledValue = 0;

    // Average policies and values
    for (const pred of predictions) {
      for (let i = 0; i < numColumns; i++) {
        ensembledPolicy[i] += pred.policy[i];
      }
      ensembledValue += pred.value;
    }

    // Normalize
    for (let i = 0; i < numColumns; i++) {
      ensembledPolicy[i] /= predictions.length;
    }
    ensembledValue /= predictions.length;

    // Find best valid move
    const validMoves = this.getValidMoves(board);
    let bestMove = -1;
    let maxProb = -1;

    for (const move of validMoves) {
      if (ensembledPolicy[move] > maxProb) {
        maxProb = ensembledPolicy[move];
        bestMove = move;
      }
    }

    return {
      move: bestMove,
      policy: ensembledPolicy,
      value: ensembledValue,
      confidence: maxProb,
      modelVersion: 'ensemble',
      inferenceTime: predictions.reduce((sum, p) => sum + p.inferenceTime, 0),
    };
  }

  private generateVersion(): string {
    const date = new Date();
    const version = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}-${crypto
      .randomBytes(4)
      .toString('hex')}`;
    return version;
  }

  private async loadRecentGameData(): Promise<any[]> {
    // This would load from your game database
    // For now, return empty array
    return [];
  }

  private gamesToTrainingExamples(games: any[]): TrainingExample[] {
    // Convert game history to training examples
    const examples: TrainingExample[] = [];
    
    // Implementation would convert each game move to training example
    
    return examples;
  }

  private trainingDataToCSV(data: TrainingExample[]): string {
    // Convert training data to CSV format
    let csv = 'board,move,value\n';
    
    for (const example of data) {
      const boardStr = example.board.board.flat().join('');
      csv += `${boardStr},${example.move},${example.value}\n`;
    }
    
    return csv;
  }

  private async monitorAndAutoDeploy(jobId: string): Promise<void> {
    // Wait for training to complete
    const checkInterval = setInterval(async () => {
      try {
        const response = await this.pythonClient.get(`/status/${jobId}`);
        const job: TrainingJob = response.data;

        if (job.status === 'completed') {
          clearInterval(checkInterval);

          // Compare with current model
          const newModel = await this.deployModel(jobId, false);
          
          if (this.activeModelId) {
            const comparison = await this.compareModels(
              [this.activeModelId, newModel.id],
              [] // Would use validation set
            );

            // Auto-deploy if better
            if (comparison[newModel.id].accuracy > comparison[this.activeModelId].accuracy) {
              await this.activateModel(newModel.id);
              this.logger.log(`Auto-deployed better model: ${newModel.id}`);
            }
          }
        }
      } catch (error) {
        this.logger.error('Auto-deploy monitor error:', error);
        clearInterval(checkInterval);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get training job status
   */
  async getTrainingStatus(jobId: string): Promise<TrainingJob> {
    try {
      const response = await this.pythonClient.get(`/status/${jobId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get status for job ${jobId}: ${error.message}`);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    pythonTrainerAvailable: boolean;
    activeModel: string | null;
    modelCount: number;
    queuedExamples: number;
  } {
    return {
      pythonTrainerAvailable: true, // Would check actual status
      activeModel: this.activeModelId,
      modelCount: this.modelVersions.size,
      queuedExamples: this.trainingQueue.length,
    };
  }
}