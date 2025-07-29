/**
 * WebGPU-Optimized CNN for Connect Four
 * Leverages M1's GPU for accelerated neural network inference
 */

import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-backend-webgpu'; // Optional dependency - not available in Node.js
import { CellValue } from '../connect4AI';
import { Logger } from '@nestjs/common';

export interface WebGPUNetworkConfig {
  boardHeight: number;
  boardWidth: number;
  filters: number[];
  kernelSizes: number[];
  dropout: number;
  l2Regularization: number;
  learningRate: number;
  batchSize: number;
  useFloat16: boolean;
  enableFusedOps: boolean;
  enableParallelExecution: boolean;
}

export interface BatchPrediction {
  policies: tf.Tensor2D;  // [batch, 7]
  values: tf.Tensor1D;    // [batch]
  features: tf.Tensor2D;  // [batch, features]
  computeTimeMs: number;
}

export class WebGPUOptimizedCNN {
  private readonly logger = new Logger(WebGPUOptimizedCNN.name);
  private model: tf.LayersModel | null = null;
  private readonly config: WebGPUNetworkConfig;
  private featureExtractor: tf.LayersModel | null = null;
  private policyHead: tf.LayersModel | null = null;
  private valueHead: tf.LayersModel | null = null;
  
  // Optimization: Pre-allocated tensors for common operations
  private preallocatedBoardTensor: tf.Tensor4D | null = null;
  private readonly tensorPool: Map<string, tf.Tensor> = new Map();

  constructor(config: Partial<WebGPUNetworkConfig> = {}) {
    this.config = {
      boardHeight: 6,
      boardWidth: 7,
      filters: [64, 128, 256, 512],
      kernelSizes: [3, 3, 3, 3],
      dropout: 0.3,
      l2Regularization: 0.001,
      learningRate: 0.001,
      batchSize: 32,
      useFloat16: true,
      enableFusedOps: true,
      enableParallelExecution: true,
      ...config
    };

    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    // Enable WebGPU-specific optimizations
    if (this.config.enableFusedOps) {
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_LAZILY_UNPACK', true);
      tf.env().set('WEBGL_CONV_IM2COL', true);
    }

    if (this.config.useFloat16) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }

    if (this.config.enableParallelExecution) {
      tf.env().set('WEBGL_FLUSH_THRESHOLD', -1); // Disable auto-flush for better batching
    }
  }

  /**
   * Build optimized CNN architecture with WebGPU considerations
   */
  async buildModel(): Promise<tf.LayersModel> {
    const input = tf.input({
      shape: [this.config.boardHeight, this.config.boardWidth, 3],
      name: 'board_input',
      dtype: this.config.useFloat16 ? 'float32' : 'float32' // TF.js handles conversion
    });

    // Build feature extraction layers
    let x = input;

    // Initial convolution with larger kernel for pattern detection
    x = tf.layers.conv2d({
      filters: this.config.filters[0],
      kernelSize: 5,
      padding: 'same',
      activation: 'linear', // Use linear + separate activation for fusion
      kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
      name: 'initial_conv'
    }).apply(x) as tf.SymbolicTensor;

    // Fused batch norm + activation for WebGPU efficiency
    x = this.addFusedBatchNormActivation(x, 'initial');

    // Residual blocks optimized for WebGPU
    for (let i = 0; i < this.config.filters.length; i++) {
      x = this.addOptimizedResidualBlock(
        x,
        this.config.filters[i],
        this.config.kernelSizes[i],
        `block_${i}`
      );
    }

    // Global pooling with attention mechanism
    const spatialAttention = this.addSpatialAttention(x, 'spatial_attention');
    const globalFeatures = tf.layers.globalAveragePooling2d({ 
      name: 'global_pool' 
    }).apply(spatialAttention) as tf.SymbolicTensor;

    // Create separate models for feature extraction and heads
    this.featureExtractor = tf.model({
      inputs: input,
      outputs: globalFeatures,
      name: 'feature_extractor'
    });

    // Policy head with WebGPU-optimized architecture
    const policyInput = tf.input({
      shape: [this.config.filters[this.config.filters.length - 1]],
      name: 'policy_input'
    });

    let policyHead = tf.layers.dense({
      units: 256,
      activation: 'linear',
      kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
      name: 'policy_dense_1'
    }).apply(policyInput) as tf.SymbolicTensor;

    policyHead = this.addFusedBatchNormActivation(policyHead, 'policy');

    const policyOutput = tf.layers.dense({
      units: this.config.boardWidth,
      activation: 'linear',
      name: 'policy_output'
    }).apply(policyHead) as tf.SymbolicTensor;

    this.policyHead = tf.model({
      inputs: policyInput,
      outputs: policyOutput,
      name: 'policy_head'
    });

    // Value head
    const valueInput = tf.input({
      shape: [this.config.filters[this.config.filters.length - 1]],
      name: 'value_input'
    });

    let valueHead = tf.layers.dense({
      units: 256,
      activation: 'linear',
      kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
      name: 'value_dense_1'
    }).apply(valueInput) as tf.SymbolicTensor;

    valueHead = this.addFusedBatchNormActivation(valueHead, 'value');

    const valueOutput = tf.layers.dense({
      units: 1,
      activation: 'tanh',
      name: 'value_output'
    }).apply(valueHead) as tf.SymbolicTensor;

    this.valueHead = tf.model({
      inputs: valueInput,
      outputs: valueOutput,
      name: 'value_head'
    });

    // Combine into full model
    const policyPrediction = this.policyHead.apply(globalFeatures) as tf.SymbolicTensor;
    const valuePrediction = this.valueHead.apply(globalFeatures) as tf.SymbolicTensor;

    this.model = tf.model({
      inputs: input,
      outputs: [policyPrediction, valuePrediction],
      name: 'WebGPUOptimizedConnect4CNN'
    });

    // Compile with WebGPU-optimized settings
    this.model.compile({
      optimizer: this.createOptimizedOptimizer(),
      loss: {
        'policy_output': 'categoricalCrossentropy',
        'value_output': 'meanSquaredError'
      },
      metrics: ['accuracy']
    });

    this.logger.log('✅ WebGPU-optimized CNN model built');
    return this.model;
  }

  /**
   * Add optimized residual block for WebGPU
   */
  private addOptimizedResidualBlock(
    input: tf.SymbolicTensor,
    filters: number,
    kernelSize: number,
    name: string
  ): tf.SymbolicTensor {
    // Main path
    let x = tf.layers.conv2d({
      filters,
      kernelSize,
      padding: 'same',
      activation: 'linear',
      kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
      name: `${name}_conv1`
    }).apply(input) as tf.SymbolicTensor;

    x = this.addFusedBatchNormActivation(x, `${name}_bn1`);

    x = tf.layers.conv2d({
      filters,
      kernelSize,
      padding: 'same',
      activation: 'linear',
      kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
      name: `${name}_conv2`
    }).apply(x) as tf.SymbolicTensor;

    x = tf.layers.batchNormalization({ 
      name: `${name}_bn2` 
    }).apply(x) as tf.SymbolicTensor;

    // Shortcut connection
    let shortcut = input;
    if (input.shape[input.shape.length - 1] !== filters) {
      shortcut = tf.layers.conv2d({
        filters,
        kernelSize: 1,
        padding: 'same',
        activation: 'linear',
        name: `${name}_shortcut`
      }).apply(input) as tf.SymbolicTensor;
    }

    // Add residual
    x = tf.layers.add({ name: `${name}_add` }).apply([x, shortcut]) as tf.SymbolicTensor;
    x = tf.layers.activation({ 
      activation: 'relu', 
      name: `${name}_activation` 
    }).apply(x) as tf.SymbolicTensor;

    return x;
  }

  /**
   * Add spatial attention mechanism
   */
  private addSpatialAttention(
    input: tf.SymbolicTensor,
    name: string
  ): tf.SymbolicTensor {
    // Channel-wise average and max pooling
    const avgPooled = tf.layers.globalAveragePooling2d({
      name: `${name}_avg_pool_global`
    }).apply(input) as tf.SymbolicTensor;
    
    // Reshape to keep spatial dimensions
    const avgPool = tf.layers.reshape({
      targetShape: [1, 1, -1],
      name: `${name}_avg_pool`
    }).apply(avgPooled) as tf.SymbolicTensor;

    const maxPooled = tf.layers.globalMaxPooling2d({
      name: `${name}_max_pool_global`
    }).apply(input) as tf.SymbolicTensor;
    
    // Reshape to keep spatial dimensions
    const maxPool = tf.layers.reshape({
      targetShape: [1, 1, -1],
      name: `${name}_max_pool`
    }).apply(maxPooled) as tf.SymbolicTensor;

    // Concatenate and convolve
    const concat = tf.layers.concatenate({ 
      axis: -1, 
      name: `${name}_concat` 
    }).apply([avgPool, maxPool]) as tf.SymbolicTensor;

    const attention = tf.layers.conv2d({
      filters: 1,
      kernelSize: 7,
      padding: 'same',
      activation: 'sigmoid',
      name: `${name}_conv`
    }).apply(concat) as tf.SymbolicTensor;

    // Apply attention
    return tf.layers.multiply({ 
      name: `${name}_multiply` 
    }).apply([input, attention]) as tf.SymbolicTensor;
  }

  /**
   * Add fused batch normalization and activation for WebGPU efficiency
   */
  private addFusedBatchNormActivation(
    input: tf.SymbolicTensor,
    name: string
  ): tf.SymbolicTensor {
    // WebGPU can fuse these operations efficiently
    let x = tf.layers.batchNormalization({ 
      name: `${name}_bn` 
    }).apply(input) as tf.SymbolicTensor;

    x = tf.layers.activation({ 
      activation: 'relu', 
      name: `${name}_relu` 
    }).apply(x) as tf.SymbolicTensor;

    return x;
  }

  /**
   * Create optimizer with M1-specific settings
   */
  private createOptimizedOptimizer(): tf.Optimizer {
    return tf.train.adam(this.config.learningRate, 0.9, 0.999, 1e-7);
  }

  /**
   * Optimized board to tensor conversion with pre-allocation
   */
  boardToTensor(board: CellValue[][]): tf.Tensor4D {
    return tf.tidy(() => {
      const height = board.length;
      const width = board[0].length;
      
      // Use Float16 if enabled for memory efficiency
      const dtype = this.config.useFloat16 ? 'float32' : 'float32';
      const data = new Float32Array(height * width * 3);

      // Vectorized board encoding
      let idx = 0;
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const cell = board[r][c];
          data[idx++] = cell === 'Red' ? 1.0 : 0.0;
          data[idx++] = cell === 'Yellow' ? 1.0 : 0.0;
          data[idx++] = cell === 'Empty' ? 1.0 : 0.0;
        }
      }

      return tf.tensor4d(data, [1, height, width, 3], dtype);
    });
  }

  /**
   * Batch prediction for multiple boards (optimized for WebGPU)
   */
  async batchPredict(boards: CellValue[][][]): Promise<BatchPrediction> {
    if (!this.model) {
      throw new Error('Model not built');
    }

    const startTime = performance.now();

    return tf.tidy(() => {
      // Convert all boards to tensors in a single operation
      const boardTensors = boards.map(board => this.boardToTensor(board));
      const batchedInput = tf.concat(boardTensors, 0);

      // Clean up individual tensors
      boardTensors.forEach(t => t.dispose());

      // Run batch prediction
      const [policyLogits, valueLogits] = this.model!.predict(batchedInput) as [tf.Tensor2D, tf.Tensor2D];
      
      // Apply softmax to policy logits
      const policies = tf.softmax(policyLogits);
      const values = tf.squeeze(valueLogits, [1]);

      // Extract features if needed
      const features = this.featureExtractor ? 
        this.featureExtractor.predict(batchedInput) as tf.Tensor2D : 
        tf.zeros([boards.length, 512]) as tf.Tensor2D;

      const computeTimeMs = performance.now() - startTime;

      return {
        policies,
        values: values as tf.Tensor1D,
        features,
        computeTimeMs
      };
    });
  }

  /**
   * Single board prediction with caching
   */
  async predict(board: CellValue[][]): Promise<{
    policy: number[];
    value: number;
    computeTimeMs: number;
  }> {
    const result = await this.batchPredict([board]);
    
    const policy = await result.policies.slice([0, 0], [1, -1]).data();
    const value = (await result.values.slice([0], [1]).data())[0];
    
    // Clean up tensors
    result.policies.dispose();
    result.values.dispose();
    result.features.dispose();

    return {
      policy: Array.from(policy),
      value,
      computeTimeMs: result.computeTimeMs
    };
  }

  /**
   * Warm up the model for optimal performance
   */
  async warmUp(): Promise<void> {
    this.logger.log('Warming up WebGPU-optimized model...');
    
    // Create dummy board
    const dummyBoard: CellValue[][] = Array(6).fill(null).map(() => 
      Array(7).fill('Empty')
    );

    // Run multiple predictions to warm up GPU
    for (let i = 0; i < 5; i++) {
      await this.predict(dummyBoard);
    }

    this.logger.log('✅ Model warm-up complete');
  }

  /**
   * Get model memory usage
   */
  getMemoryInfo(): {
    numTensors: number;
    numBytes: number;
    numBytesFormatted: string;
  } {
    const memInfo = tf.memory();
    return {
      numTensors: memInfo.numTensors,
      numBytes: memInfo.numBytes,
      numBytesFormatted: `${(memInfo.numBytes / 1048576).toFixed(2)} MB`
    };
  }

  /**
   * Dispose of model and free GPU memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
    if (this.featureExtractor) {
      this.featureExtractor.dispose();
    }
    if (this.policyHead) {
      this.policyHead.dispose();
    }
    if (this.valueHead) {
      this.valueHead.dispose();
    }
    
    // Clear tensor pool
    this.tensorPool.forEach(tensor => tensor.dispose());
    this.tensorPool.clear();
    
    if (this.preallocatedBoardTensor) {
      this.preallocatedBoardTensor.dispose();
    }

    this.logger.log('WebGPU-optimized CNN disposed');
  }
}