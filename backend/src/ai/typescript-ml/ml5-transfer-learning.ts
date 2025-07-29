/**
 * ML5.js Transfer Learning for Connect Four
 * Leverages pre-trained models with domain-specific fine-tuning
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import * as tf from '@tensorflow/tfjs';

// ML5.js type definitions (simplified)
interface ML5FeatureExtractor {
  classification(): ML5Classifier;
  regression(): ML5Regressor;
  predict(input: any): Promise<any>;
}

interface ML5Classifier {
  addImage(input: any, label: string): void;
  train(callback?: (loss: number) => void): Promise<void>;
  classify(input: any): Promise<Array<{ label: string; confidence: number }>>;
  save(name?: string): Promise<void>;
  load(path: string): Promise<void>;
}

interface ML5Regressor {
  addImage(input: any, output: number[]): void;
  train(options: any, callback?: (loss: number) => void): Promise<void>;
  predict(input: any): Promise<{ value: number[] }>;
  save(name?: string): Promise<void>;
  load(path: string): Promise<void>;
}

export interface TransferLearningConfig {
  baseModel: 'MobileNet' | 'DarkNet' | 'DenseNet' | 'ResNet50';
  featureExtractorLayer?: string;
  numClasses?: number;
  learningRate?: number;
  batchSize?: number;
  epochs?: number;
  hiddenUnits?: number[];
  dropoutRate?: number;
  l2Regularization?: number;
}

export interface TransferLearningPrediction {
  move: number;
  moveProbs: number[];
  value: number;
  features: Float32Array;
  confidence: number;
}

export interface AugmentationOptions {
  rotation?: boolean;
  horizontalFlip?: boolean;
  brightness?: number;
  contrast?: number;
  noise?: number;
}

@Injectable()
export class ML5TransferLearning {
  private readonly logger = new Logger(ML5TransferLearning.name);
  private featureExtractors: Map<string, any> = new Map();
  private classifiers: Map<string, any> = new Map();
  private regressors: Map<string, any> = new Map();
  private configs: Map<string, TransferLearningConfig> = new Map();
  private trainingData: Map<string, { inputs: any[]; outputs: any[] }> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Initialize transfer learning model
   */
  async initializeModel(
    modelName: string,
    config: TransferLearningConfig
  ): Promise<void> {
    this.logger.log(`Initializing ML5.js transfer learning model: ${modelName}`);

    try {
      // Create feature extractor from base model
      const featureExtractor = await this.createFeatureExtractor(config);
      
      // Create classifier for move prediction
      const classifier = this.createClassifier(featureExtractor, config);
      
      // Create regressor for value prediction
      const regressor = this.createRegressor(featureExtractor, config);

      // Store components
      this.featureExtractors.set(modelName, featureExtractor);
      this.classifiers.set(modelName, classifier);
      this.regressors.set(modelName, regressor);
      this.configs.set(modelName, config);
      this.trainingData.set(modelName, { inputs: [], outputs: [] });

      this.logger.log(`Model ${modelName} initialized successfully`);

      // Emit initialization event
      this.eventEmitter.emit('ml5.model.initialized', {
        modelName,
        baseModel: config.baseModel,
        config
      });

    } catch (error) {
      this.logger.error(`Failed to initialize model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Create feature extractor from pre-trained model
   */
  private async createFeatureExtractor(config: TransferLearningConfig): Promise<any> {
    // Simulated ML5.js feature extractor creation
    // In reality: ml5.featureExtractor(config.baseModel, options)
    
    let baseModel: tf.LayersModel;
    
    switch (config.baseModel) {
      case 'MobileNet':
        baseModel = await this.loadMobileNet();
        break;
      case 'ResNet50':
        baseModel = await this.loadResNet50();
        break;
      case 'DenseNet':
        baseModel = await this.loadDenseNet();
        break;
      default:
        baseModel = await this.loadMobileNet();
    }

    // Extract features from intermediate layer
    const layer = config.featureExtractorLayer || 'conv_pw_13_relu';
    const truncatedModel = tf.model({
      inputs: baseModel.inputs,
      outputs: baseModel.getLayer(layer).output
    });

    return {
      baseModel,
      truncatedModel,
      extract: async (input: tf.Tensor) => {
        return truncatedModel.predict(input) as tf.Tensor;
      }
    };
  }

  /**
   * Create classifier for move prediction
   */
  private createClassifier(featureExtractor: any, config: TransferLearningConfig): any {
    const numClasses = config.numClasses || 7; // 7 columns in Connect Four

    // Build custom classification head
    const classificationHead = this.buildClassificationHead(
      featureExtractor.truncatedModel.output.shape.slice(1),
      numClasses,
      config
    );

    return {
      featureExtractor,
      model: classificationHead,
      samples: [],
      
      addImage: function(input: any, label: string) {
        this.samples.push({ input, label });
      },
      
      train: async function(callback?: (loss: number) => void) {
        // Convert samples to training data
        const xs = tf.stack(this.samples.map(s => s.input));
        const ys = tf.oneHot(
          this.samples.map(s => parseInt(s.label)),
          numClasses
        );

        // Extract features
        const features = await featureExtractor.extract(xs);

        // Train classification head
        await classificationHead.fit(features, ys, {
          epochs: config.epochs || 20,
          batchSize: config.batchSize || 16,
          callbacks: callback ? {
            onEpochEnd: (epoch, logs) => callback(logs.loss)
          } : undefined
        });

        xs.dispose();
        ys.dispose();
        features.dispose();
      },
      
      classify: async function(input: any) {
        const features = await featureExtractor.extract(input);
        const predictions = classificationHead.predict(features) as tf.Tensor;
        const probs = await predictions.data();
        predictions.dispose();
        features.dispose();

        // Convert to ML5 format
        return Array.from(probs).map((prob, i) => ({
          label: i.toString(),
          confidence: prob
        }));
      }
    };
  }

  /**
   * Create regressor for value prediction
   */
  private createRegressor(featureExtractor: any, config: TransferLearningConfig): any {
    // Build custom regression head
    const regressionHead = this.buildRegressionHead(
      featureExtractor.truncatedModel.output.shape.slice(1),
      config
    );

    return {
      featureExtractor,
      model: regressionHead,
      samples: [],
      
      addImage: function(input: any, output: number[]) {
        this.samples.push({ input, output });
      },
      
      train: async function(options: any, callback?: (loss: number) => void) {
        const xs = tf.stack(this.samples.map(s => s.input));
        const ys = tf.tensor2d(this.samples.map(s => s.output));

        // Extract features
        const features = await featureExtractor.extract(xs);

        // Train regression head
        await regressionHead.fit(features, ys, {
          epochs: options.epochs || config.epochs || 20,
          batchSize: options.batchSize || config.batchSize || 16,
          callbacks: callback ? {
            onEpochEnd: (epoch, logs) => callback(logs.loss)
          } : undefined
        });

        xs.dispose();
        ys.dispose();
        features.dispose();
      },
      
      predict: async function(input: any) {
        const features = await featureExtractor.extract(input);
        const prediction = regressionHead.predict(features) as tf.Tensor;
        const value = await prediction.data();
        prediction.dispose();
        features.dispose();

        return { value: Array.from(value) };
      }
    };
  }

  /**
   * Add training example
   */
  async addTrainingExample(
    modelName: string,
    board: CellValue[][],
    move: number,
    value: number,
    augment: boolean = true
  ): Promise<void> {
    const classifier = this.classifiers.get(modelName);
    const regressor = this.regressors.get(modelName);
    const trainingData = this.trainingData.get(modelName);

    if (!classifier || !regressor || !trainingData) {
      throw new Error(`Model ${modelName} not found`);
    }

    // Convert board to image-like tensor
    const boardTensor = this.boardToImageTensor(board);

    // Add to classifier
    classifier.addImage(boardTensor, move.toString());

    // Add to regressor
    regressor.addImage(boardTensor, [value]);

    // Store for later use
    trainingData.inputs.push(boardTensor);
    trainingData.outputs.push({ move, value });

    // Data augmentation
    if (augment) {
      const augmentedBoards = this.augmentBoard(board);
      for (const augBoard of augmentedBoards) {
        const augTensor = this.boardToImageTensor(augBoard.board);
        classifier.addImage(augTensor, augBoard.move.toString());
        regressor.addImage(augTensor, [value]);
        trainingData.inputs.push(augTensor);
        trainingData.outputs.push({ move: augBoard.move, value });
      }
    }
  }

  /**
   * Train the model
   */
  async train(
    modelName: string,
    options?: {
      epochs?: number;
      batchSize?: number;
      validationSplit?: number;
    }
  ): Promise<{ classifierLoss: number; regressorLoss: number }> {
    const classifier = this.classifiers.get(modelName);
    const regressor = this.regressors.get(modelName);
    const config = this.configs.get(modelName);

    if (!classifier || !regressor || !config) {
      throw new Error(`Model ${modelName} not found`);
    }

    this.logger.log(`Training transfer learning model: ${modelName}`);

    let classifierLoss = 0;
    let regressorLoss = 0;

    // Train classifier
    await classifier.train((loss: number) => {
      classifierLoss = loss;
      this.eventEmitter.emit('ml5.training.progress', {
        modelName,
        type: 'classifier',
        loss
      });
    });

    // Train regressor
    await regressor.train(
      {
        epochs: options?.epochs || config.epochs,
        batchSize: options?.batchSize || config.batchSize
      },
      (loss: number) => {
        regressorLoss = loss;
        this.eventEmitter.emit('ml5.training.progress', {
          modelName,
          type: 'regressor',
          loss
        });
      }
    );

    this.logger.log(`Training completed. Classifier loss: ${classifierLoss}, Regressor loss: ${regressorLoss}`);

    return { classifierLoss, regressorLoss };
  }

  /**
   * Make prediction
   */
  async predict(
    modelName: string,
    board: CellValue[][]
  ): Promise<TransferLearningPrediction> {
    const classifier = this.classifiers.get(modelName);
    const regressor = this.regressors.get(modelName);
    const featureExtractor = this.featureExtractors.get(modelName);

    if (!classifier || !regressor || !featureExtractor) {
      throw new Error(`Model ${modelName} not found`);
    }

    // Convert board to tensor
    const boardTensor = this.boardToImageTensor(board);

    // Get move predictions
    const moveResults = await classifier.classify(boardTensor);
    const moveProbs = new Array(7).fill(0);
    moveResults.forEach(result => {
      const col = parseInt(result.label);
      if (col >= 0 && col < 7) {
        moveProbs[col] = result.confidence;
      }
    });

    // Get value prediction
    const valueResult = await regressor.predict(boardTensor);
    const value = valueResult.value[0];

    // Extract features
    const features = await featureExtractor.extract(boardTensor);
    const featuresData = await features.data();
    features.dispose();

    // Find best valid move
    const validMoves = this.getValidMoves(board);
    let bestMove = -1;
    let bestProb = -1;
    
    for (let i = 0; i < moveProbs.length; i++) {
      if (validMoves.includes(i) && moveProbs[i] > bestProb) {
        bestProb = moveProbs[i];
        bestMove = i;
      }
    }

    // Clean up
    boardTensor.dispose();

    return {
      move: bestMove,
      moveProbs,
      value,
      features: new Float32Array(featuresData),
      confidence: bestProb
    };
  }

  /**
   * Fine-tune with reinforcement learning
   */
  async reinforcementFineTune(
    modelName: string,
    gameHistory: Array<{
      board: CellValue[][];
      move: number;
      reward: number;
    }>
  ): Promise<void> {
    this.logger.log(`Fine-tuning model ${modelName} with RL`);

    // Convert game history to training examples with discounted rewards
    const gamma = 0.95; // Discount factor
    
    for (let i = 0; i < gameHistory.length; i++) {
      const { board, move } = gameHistory[i];
      
      // Calculate discounted reward
      let discountedReward = 0;
      for (let j = i; j < gameHistory.length; j++) {
        discountedReward += gameHistory[j].reward * Math.pow(gamma, j - i);
      }
      
      // Add as training example
      await this.addTrainingExample(modelName, board, move, discountedReward, false);
    }

    // Retrain with new examples
    await this.train(modelName);
  }

  /**
   * Knowledge distillation from stronger model
   */
  async distillKnowledge(
    studentModelName: string,
    teacherModelName: string,
    boards: CellValue[][],
    temperature: number = 3.0
  ): Promise<void> {
    this.logger.log(`Distilling knowledge from ${teacherModelName} to ${studentModelName}`);

    const teacherClassifier = this.classifiers.get(teacherModelName);
    const studentClassifier = this.classifiers.get(studentModelName);

    if (!teacherClassifier || !studentClassifier) {
      throw new Error('Teacher or student model not found');
    }

    // Get soft targets from teacher
    for (const board of boards) {
      const boardTensor = this.boardToImageTensor(board as any);
      
      // Get teacher predictions
      const teacherPreds = await teacherClassifier.classify(boardTensor);
      
      // Apply temperature scaling
      const softTargets = this.applySoftmax(
        teacherPreds.map(p => p.confidence),
        temperature
      );
      
      // Find best move from teacher
      const bestMove = teacherPreds.reduce((best, curr, idx) => 
        curr.confidence > teacherPreds[best].confidence ? idx : best, 0
      );
      
      // Add to student training data
      studentClassifier.addImage(boardTensor, bestMove.toString());
      
      boardTensor.dispose();
    }

    // Train student with distilled knowledge
    await studentClassifier.train();
  }

  /**
   * Convert board to image-like tensor
   */
  private boardToImageTensor(board: CellValue[][]): tf.Tensor4D {
    // Create 224x224x3 image tensor (standard input size for pre-trained models)
    const imageSize = 224;
    const cellSize = Math.floor(imageSize / 7);
    
    const imageData = new Float32Array(imageSize * imageSize * 3);
    
    // Fill image with board representation
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = board[r][c];
        const startY = r * cellSize;
        const startX = c * cellSize;
        
        // Color based on cell value
        const [red, green, blue] = 
          cell === 'Red' ? [1, 0, 0] :
          cell === 'Yellow' ? [1, 1, 0] :
          [0.5, 0.5, 0.5]; // Empty
        
        // Fill cell area
        for (let y = startY; y < startY + cellSize && y < imageSize; y++) {
          for (let x = startX; x < startX + cellSize && x < imageSize; x++) {
            const idx = (y * imageSize + x) * 3;
            imageData[idx] = red;
            imageData[idx + 1] = green;
            imageData[idx + 2] = blue;
          }
        }
      }
    }
    
    return tf.tensor4d(imageData, [1, imageSize, imageSize, 3]);
  }

  /**
   * Augment board data
   */
  private augmentBoard(
    board: CellValue[][]
  ): Array<{ board: CellValue[][]; move: number }> {
    const augmented: Array<{ board: CellValue[][]; move: number }> = [];
    
    // Horizontal flip
    const flipped = board.map(row => [...row].reverse());
    const flipMapping = [6, 5, 4, 3, 2, 1, 0];
    
    augmented.push({
      board: flipped,
      move: 3 // Center column stays the same
    });
    
    // Add slight noise (simulate imperfect play)
    // This is more conceptual for Connect Four
    
    return augmented;
  }

  /**
   * Build classification head
   */
  private buildClassificationHead(
    inputShape: number[],
    numClasses: number,
    config: TransferLearningConfig
  ): tf.Sequential {
    const model = tf.sequential();
    
    // Flatten features
    model.add(tf.layers.flatten({ inputShape }));
    
    // Hidden layers
    const hiddenUnits = config.hiddenUnits || [256, 128];
    for (const units of hiddenUnits) {
      model.add(tf.layers.dense({
        units,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: config.l2Regularization || 0.01 })
      }));
      
      if (config.dropoutRate) {
        model.add(tf.layers.dropout({ rate: config.dropoutRate }));
      }
    }
    
    // Output layer
    model.add(tf.layers.dense({
      units: numClasses,
      activation: 'softmax'
    }));
    
    // Compile
    model.compile({
      optimizer: tf.train.adam(config.learningRate || 0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  /**
   * Build regression head
   */
  private buildRegressionHead(
    inputShape: number[],
    config: TransferLearningConfig
  ): tf.Sequential {
    const model = tf.sequential();
    
    // Flatten features
    model.add(tf.layers.flatten({ inputShape }));
    
    // Hidden layers
    const hiddenUnits = config.hiddenUnits || [256, 128];
    for (const units of hiddenUnits) {
      model.add(tf.layers.dense({
        units,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: config.l2Regularization || 0.01 })
      }));
      
      if (config.dropoutRate) {
        model.add(tf.layers.dropout({ rate: config.dropoutRate }));
      }
    }
    
    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: 'tanh' // Value in [-1, 1]
    }));
    
    // Compile
    model.compile({
      optimizer: tf.train.adam(config.learningRate || 0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }

  /**
   * Load pre-trained MobileNet
   */
  private async loadMobileNet(): Promise<tf.LayersModel> {
    // Simulated loading - in reality would use tf.loadLayersModel
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          name: 'conv1'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          name: 'conv_pw_13_relu'
        }),
        tf.layers.globalAveragePooling2d({})
      ]
    });
    
    return model;
  }

  /**
   * Load pre-trained ResNet50
   */
  private async loadResNet50(): Promise<tf.LayersModel> {
    // Simulated - would load actual ResNet50
    return this.loadMobileNet();
  }

  /**
   * Load pre-trained DenseNet
   */
  private async loadDenseNet(): Promise<tf.LayersModel> {
    // Simulated - would load actual DenseNet
    return this.loadMobileNet();
  }

  /**
   * Get valid moves
   */
  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }

  /**
   * Apply softmax with temperature
   */
  private applySoftmax(logits: number[], temperature: number): number[] {
    const scaled = logits.map(l => l / temperature);
    const maxLogit = Math.max(...scaled);
    const exp = scaled.map(l => Math.exp(l - maxLogit));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(e => e / sum);
  }

  /**
   * Save model
   */
  async saveModel(modelName: string, path: string): Promise<void> {
    const classifier = this.classifiers.get(modelName);
    const regressor = this.regressors.get(modelName);
    
    if (!classifier || !regressor) {
      throw new Error(`Model ${modelName} not found`);
    }
    
    await classifier.save(`${path}_classifier`);
    await regressor.save(`${path}_regressor`);
    
    this.logger.log(`Model ${modelName} saved to ${path}`);
  }

  /**
   * Load model
   */
  async loadModel(modelName: string, path: string): Promise<void> {
    const config = this.configs.get(modelName);
    
    if (!config) {
      throw new Error(`Model ${modelName} config not found`);
    }
    
    await this.initializeModel(modelName, config);
    
    const classifier = this.classifiers.get(modelName);
    const regressor = this.regressors.get(modelName);
    
    await classifier.load(`${path}_classifier`);
    await regressor.load(`${path}_regressor`);
    
    this.logger.log(`Model ${modelName} loaded from ${path}`);
  }

  /**
   * Get model info
   */
  getModelInfo(modelName: string): any {
    const config = this.configs.get(modelName);
    const trainingData = this.trainingData.get(modelName);
    
    return {
      config,
      trainingSamples: trainingData?.inputs.length || 0
    };
  }

  /**
   * List models
   */
  listModels(): string[] {
    return Array.from(this.configs.keys());
  }
}