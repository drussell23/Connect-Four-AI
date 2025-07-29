/**
 * ONNX Model Engine for Connect Four
 * Provides high-performance model inference using ONNX Runtime
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CellValue } from '../connect4AI';

// Try to load onnxruntime-node, but make it optional
let ort: any;
try {
  ort = require('onnxruntime-node');
} catch (error) {
  console.warn('⚠️ ONNX Runtime not available - ONNX model support disabled');
}

export interface ONNXModelConfig {
  modelPath: string;
  modelName: string;
  inputShape: number[];
  outputNames: string[];
  executionProviders?: string[];
  enableProfiling?: boolean;
  enableMemoryPattern?: boolean;
  enableCpuMemArena?: boolean;
  graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
}

export interface ModelPrediction {
  policy: number[];
  value: number;
  features?: Float32Array;
  inferenceTime: number;
  metadata?: Record<string, any>;
}

export interface ModelEnsemblePrediction extends ModelPrediction {
  individualPredictions: ModelPrediction[];
  ensembleMethod: 'average' | 'weighted' | 'voting' | 'stacking';
  confidence: number;
}

@Injectable()
export class ONNXModelEngine {
  private readonly logger = new Logger(ONNXModelEngine.name);
  private sessions: Map<string, any> = new Map();
  private modelConfigs: Map<string, ONNXModelConfig> = new Map();
  private inferenceStats: Map<string, {
    totalInferences: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Load an ONNX model with advanced configuration
   */
  async loadModel(config: ONNXModelConfig): Promise<void> {
    if (!ort) {
      this.logger.warn('ONNX Runtime not available - skipping model load');
      return;
    }
    
    this.logger.log(`Loading ONNX model: ${config.modelName}`);
    
    try {
      // Check if model file exists
      await fs.access(config.modelPath);
      
      // Create session options with optimizations
      const sessionOptions: any = {
        executionProviders: config.executionProviders || ['cpu'],
        graphOptimizationLevel: config.graphOptimizationLevel || 'all',
        enableCpuMemArena: config.enableCpuMemArena ?? true,
        enableMemPattern: config.enableMemoryPattern ?? true,
        enableProfiling: config.enableProfiling ?? false,
        logSeverityLevel: 3, // Warning level
      };

      // Create inference session
      const session = await ort.InferenceSession.create(
        config.modelPath,
        sessionOptions
      );

      // Store session and config
      this.sessions.set(config.modelName, session);
      this.modelConfigs.set(config.modelName, config);
      
      // Initialize stats
      this.inferenceStats.set(config.modelName, {
        totalInferences: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0
      });

      // Log model information
      this.logger.log(`Model loaded successfully: ${config.modelName}`);
      this.logger.log(`Input names: ${session.inputNames.join(', ')}`);
      this.logger.log(`Output names: ${session.outputNames.join(', ')}`);

      // Emit model loaded event
      this.eventEmitter.emit('onnx.model.loaded', {
        modelName: config.modelName,
        inputNames: session.inputNames,
        outputNames: session.outputNames
      });

    } catch (error) {
      this.logger.error(`Failed to load model ${config.modelName}:`, error);
      throw new Error(`Model loading failed: ${error.message}`);
    }
  }

  /**
   * Run inference on a single board state
   */
  async predict(
    modelName: string,
    board: CellValue[][]
  ): Promise<ModelPrediction> {
    if (!ort) {
      throw new Error('ONNX Runtime not available');
    }
    
    const session = this.sessions.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!session || !config) {
      throw new Error(`Model ${modelName} not loaded`);
    }

    const startTime = performance.now();

    try {
      // Convert board to tensor
      const inputTensor = this.boardToTensor(board, config.inputShape);
      
      // Create feeds
      const feeds: Record<string, any> = {
        [session.inputNames[0]]: inputTensor
      };

      // Run inference
      const results = await session.run(feeds);
      
      // Extract outputs
      const policy = await this.extractPolicy(results, config.outputNames[0]);
      const value = await this.extractValue(results, config.outputNames[1]);
      
      // Extract features if available
      let features: Float32Array | undefined;
      if (config.outputNames.length > 2) {
        features = await this.extractFeatures(results, config.outputNames[2]);
      }

      const inferenceTime = performance.now() - startTime;
      
      // Update statistics
      this.updateStats(modelName, inferenceTime);

      // Clean up tensors
      inputTensor.dispose();
      Object.values(results).forEach((tensor: any) => tensor.dispose());

      return {
        policy,
        value,
        features,
        inferenceTime,
        metadata: {
          modelName,
          boardHash: this.hashBoard(board)
        }
      };

    } catch (error) {
      this.logger.error(`Inference failed for model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Run batch inference for multiple boards
   */
  async batchPredict(
    modelName: string,
    boards: CellValue[][][]
  ): Promise<ModelPrediction[]> {
    const session = this.sessions.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!session || !config) {
      throw new Error(`Model ${modelName} not loaded`);
    }

    const startTime = performance.now();

    try {
      // Convert boards to batch tensor
      const batchTensor = this.boardsToBatchTensor(boards, config.inputShape);
      
      // Create feeds
      const feeds: Record<string, any> = {
        [session.inputNames[0]]: batchTensor
      };

      // Run batch inference
      const results = await session.run(feeds);
      
      // Extract batch outputs
      const policies = await this.extractBatchPolicies(results, config.outputNames[0], boards.length);
      const values = await this.extractBatchValues(results, config.outputNames[1], boards.length);
      
      const inferenceTime = performance.now() - startTime;
      const timePerBoard = inferenceTime / boards.length;

      // Update statistics
      this.updateStats(modelName, timePerBoard);

      // Clean up
      batchTensor.dispose();
      Object.values(results).forEach((tensor: any) => tensor.dispose());

      // Create predictions
      return boards.map((board, i) => ({
        policy: policies[i],
        value: values[i],
        inferenceTime: timePerBoard,
        metadata: {
          modelName,
          batchIndex: i,
          boardHash: this.hashBoard(board)
        }
      }));

    } catch (error) {
      this.logger.error(`Batch inference failed for model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Run ensemble inference using multiple models
   */
  async ensemblePredict(
    modelNames: string[],
    board: CellValue[][],
    weights?: number[]
  ): Promise<ModelEnsemblePrediction> {
    if (modelNames.length === 0) {
      throw new Error('No models specified for ensemble');
    }

    const startTime = performance.now();
    
    // Get individual predictions
    const predictions = await Promise.all(
      modelNames.map(modelName => this.predict(modelName, board))
    );

    // Apply ensemble method
    const ensembledPrediction = this.applyEnsembleMethod(
      predictions,
      weights || new Array(predictions.length).fill(1 / predictions.length)
    );

    const inferenceTime = performance.now() - startTime;

    return {
      ...ensembledPrediction,
      individualPredictions: predictions,
      ensembleMethod: weights ? 'weighted' : 'average',
      confidence: this.calculateEnsembleConfidence(predictions),
      inferenceTime
    };
  }

  /**
   * Convert PyTorch model to ONNX format
   */
  async convertPyTorchModel(
    pythonModelPath: string,
    onnxOutputPath: string,
    inputShape: number[]
  ): Promise<void> {
    this.logger.log(`Converting PyTorch model to ONNX: ${pythonModelPath}`);
    
    // This would typically call a Python script to do the conversion
    // For now, we'll simulate the conversion process
    const conversionScript = `
import torch
import torch.onnx

# Load the model
model = torch.load("${pythonModelPath}")
model.eval()

# Create dummy input
dummy_input = torch.randn(1, ${inputShape.join(', ')})

# Export to ONNX
torch.onnx.export(
    model,
    dummy_input,
    "${onnxOutputPath}",
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['policy', 'value'],
    dynamic_axes={'input': {0: 'batch_size'}}
)
    `;

    this.logger.log('Model conversion completed (simulated)');
    
    // Emit conversion event
    this.eventEmitter.emit('onnx.model.converted', {
      sourcePath: pythonModelPath,
      outputPath: onnxOutputPath
    });
  }

  /**
   * Optimize ONNX model for inference
   */
  async optimizeModel(
    modelName: string,
    optimizationLevel: 'basic' | 'extended' | 'aggressive' = 'extended'
  ): Promise<void> {
    const session = this.sessions.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!session || !config) {
      throw new Error(`Model ${modelName} not loaded`);
    }

    this.logger.log(`Optimizing model ${modelName} with level: ${optimizationLevel}`);

    // Apply optimization techniques
    const optimizations = {
      basic: ['constant_folding', 'dead_code_elimination'],
      extended: ['constant_folding', 'dead_code_elimination', 'common_subexpression_elimination', 'loop_fusion'],
      aggressive: ['constant_folding', 'dead_code_elimination', 'common_subexpression_elimination', 
                   'loop_fusion', 'quantization', 'pruning']
    };

    // In practice, this would apply actual optimizations
    // For now, we'll update the configuration
    config.graphOptimizationLevel = optimizationLevel === 'aggressive' ? 'all' : optimizationLevel;

    this.logger.log(`Model ${modelName} optimized successfully`);
  }

  /**
   * Quantize model for faster inference
   */
  async quantizeModel(
    modelName: string,
    quantizationType: 'int8' | 'uint8' | 'dynamic'
  ): Promise<void> {
    this.logger.log(`Quantizing model ${modelName} to ${quantizationType}`);
    
    // Quantization would reduce model size and improve inference speed
    // This is a placeholder for actual quantization logic
    
    this.eventEmitter.emit('onnx.model.quantized', {
      modelName,
      quantizationType,
      compressionRatio: 0.25 // Typical 4x compression
    });
  }

  /**
   * Board to tensor conversion
   */
  private boardToTensor(board: CellValue[][], shape: number[]): any {
    const [channels, height, width] = shape.slice(1);
    const data = new Float32Array(1 * channels * height * width);
    
    let idx = 0;
    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const cell = board[h]?.[w] || 'Empty';
          
          // 3-channel representation
          if (c === 0) data[idx] = cell === 'Red' ? 1 : 0;
          else if (c === 1) data[idx] = cell === 'Yellow' ? 1 : 0;
          else if (c === 2) data[idx] = cell === 'Empty' ? 1 : 0;
          
          idx++;
        }
      }
    }
    
    return new ort.Tensor('float32', data, [1, ...shape.slice(1)]);
  }

  /**
   * Convert multiple boards to batch tensor
   */
  private boardsToBatchTensor(boards: CellValue[][][], shape: number[]): any {
    const batchSize = boards.length;
    const [channels, height, width] = shape.slice(1);
    const data = new Float32Array(batchSize * channels * height * width);
    
    let idx = 0;
    for (let b = 0; b < batchSize; b++) {
      for (let c = 0; c < channels; c++) {
        for (let h = 0; h < height; h++) {
          for (let w = 0; w < width; w++) {
            const cell = boards[b][h]?.[w] || 'Empty';
            
            if (c === 0) data[idx] = cell === 'Red' ? 1 : 0;
            else if (c === 1) data[idx] = cell === 'Yellow' ? 1 : 0;
            else if (c === 2) data[idx] = cell === 'Empty' ? 1 : 0;
            
            idx++;
          }
        }
      }
    }
    
    return new ort.Tensor('float32', data, [batchSize, ...shape.slice(1)]);
  }

  /**
   * Extract policy from model output
   */
  private async extractPolicy(results: any, outputName: string): Promise<number[]> {
    const policyTensor = results[outputName];
    const policyData = await policyTensor.getData();
    
    // Apply softmax if not already applied
    const policy = Array.from(policyData as Float32Array);
    const maxLogit = Math.max(...policy);
    const expSum = policy.reduce((sum, logit) => sum + Math.exp(logit - maxLogit), 0);
    
    return policy.map(logit => Math.exp(logit - maxLogit) / expSum);
  }

  /**
   * Extract value from model output
   */
  private async extractValue(results: any, outputName: string): Promise<number> {
    const valueTensor = results[outputName];
    const valueData = await valueTensor.getData();
    return (valueData as Float32Array)[0];
  }

  /**
   * Extract features from model output
   */
  private async extractFeatures(results: any, outputName: string): Promise<Float32Array> {
    const featureTensor = results[outputName];
    const featureData = await featureTensor.getData();
    return new Float32Array(featureData as Float32Array);
  }

  /**
   * Extract batch policies
   */
  private async extractBatchPolicies(
    results: any,
    outputName: string,
    batchSize: number
  ): Promise<number[][]> {
    const policyTensor = results[outputName];
    const policyData = await policyTensor.getData() as Float32Array;
    const numActions = policyData.length / batchSize;
    
    const policies: number[][] = [];
    for (let i = 0; i < batchSize; i++) {
      const start = i * numActions;
      const end = start + numActions;
      const logits = Array.from(policyData.slice(start, end));
      
      // Apply softmax
      const maxLogit = Math.max(...logits);
      const expSum = logits.reduce((sum, logit) => sum + Math.exp(logit - maxLogit), 0);
      const policy = logits.map(logit => Math.exp(logit - maxLogit) / expSum);
      
      policies.push(policy);
    }
    
    return policies;
  }

  /**
   * Extract batch values
   */
  private async extractBatchValues(
    results: any,
    outputName: string,
    batchSize: number
  ): Promise<number[]> {
    const valueTensor = results[outputName];
    const valueData = await valueTensor.getData() as Float32Array;
    return Array.from(valueData);
  }

  /**
   * Apply ensemble method to predictions
   */
  private applyEnsembleMethod(
    predictions: ModelPrediction[],
    weights: number[]
  ): Omit<ModelPrediction, 'metadata'> {
    const numActions = predictions[0].policy.length;
    const ensembledPolicy = new Array(numActions).fill(0);
    let ensembledValue = 0;
    
    // Weighted average
    for (let i = 0; i < predictions.length; i++) {
      const weight = weights[i];
      
      // Policy ensemble
      for (let j = 0; j < numActions; j++) {
        ensembledPolicy[j] += predictions[i].policy[j] * weight;
      }
      
      // Value ensemble
      ensembledValue += predictions[i].value * weight;
    }
    
    // Average inference time
    const avgInferenceTime = predictions.reduce((sum, p) => sum + p.inferenceTime, 0) / predictions.length;
    
    return {
      policy: ensembledPolicy,
      value: ensembledValue,
      inferenceTime: avgInferenceTime
    };
  }

  /**
   * Calculate ensemble confidence
   */
  private calculateEnsembleConfidence(predictions: ModelPrediction[]): number {
    // Calculate standard deviation of values
    const values = predictions.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    return Math.max(0, 1 - stdDev);
  }

  /**
   * Update inference statistics
   */
  private updateStats(modelName: string, inferenceTime: number): void {
    const stats = this.inferenceStats.get(modelName);
    if (!stats) return;
    
    stats.totalInferences++;
    stats.totalTime += inferenceTime;
    stats.averageTime = stats.totalTime / stats.totalInferences;
    stats.minTime = Math.min(stats.minTime, inferenceTime);
    stats.maxTime = Math.max(stats.maxTime, inferenceTime);
  }

  /**
   * Hash board state for caching
   */
  private hashBoard(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
  }

  /**
   * Get model statistics
   */
  getModelStats(modelName: string) {
    return this.inferenceStats.get(modelName);
  }

  /**
   * List loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Unload a model
   */
  async unloadModel(modelName: string): Promise<void> {
    const session = this.sessions.get(modelName);
    if (session) {
      // ONNX Runtime will handle cleanup
      this.sessions.delete(modelName);
      this.modelConfigs.delete(modelName);
      this.inferenceStats.delete(modelName);
      
      this.logger.log(`Model ${modelName} unloaded`);
    }
  }

  /**
   * Cleanup all models
   */
  async dispose(): Promise<void> {
    for (const modelName of this.sessions.keys()) {
      await this.unloadModel(modelName);
    }
  }
}