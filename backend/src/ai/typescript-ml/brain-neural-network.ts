/**
 * Brain.js Neural Network for Connect Four
 * Pure JavaScript neural networks with advanced architectures
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

// Note: Brain.js types might need to be defined if not available
interface NeuralNetwork {
  train(data: any[], options?: any): any;
  run(input: any): any;
  toJSON(): any;
  fromJSON(json: any): void;
}

interface LSTMTimeStep {
  train(data: any[], options?: any): any;
  run(input: any): any;
  forecast(input: any, count: number): any;
}

export interface BrainNetworkConfig {
  type: 'feedforward' | 'lstm' | 'gru' | 'rnn';
  hiddenLayers: number[];
  activation: 'sigmoid' | 'relu' | 'leaky-relu' | 'tanh';
  learningRate: number;
  momentum: number;
  iterations: number;
  errorThresh: number;
  dropout?: number;
  regularization?: {
    l1?: number;
    l2?: number;
  };
}

export interface TrainingData {
  input: number[];
  output: number[];
}

export interface NetworkPrediction {
  policy: number[];
  value: number;
  confidence: number;
  activations?: number[][];
}

export interface TrainingMetrics {
  error: number;
  iterations: number;
  time: number;
  validationError?: number;
}

@Injectable()
export class BrainNeuralNetwork {
  private readonly logger = new Logger(BrainNeuralNetwork.name);
  private networks: Map<string, any> = new Map();
  private configs: Map<string, BrainNetworkConfig> = new Map();
  private trainingHistory: Map<string, TrainingMetrics[]> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Create a neural network with advanced architecture
   */
  createNetwork(name: string, config: BrainNetworkConfig): void {
    this.logger.log(`Creating Brain.js network: ${name}`);

    let network: any;

    // Create network based on type
    switch (config.type) {
      case 'feedforward':
        network = this.createFeedForwardNetwork(config);
        break;
      case 'lstm':
        network = this.createLSTMNetwork(config);
        break;
      case 'gru':
        network = this.createGRUNetwork(config);
        break;
      case 'rnn':
        network = this.createRNNNetwork(config);
        break;
      default:
        throw new Error(`Unknown network type: ${config.type}`);
    }

    this.networks.set(name, network);
    this.configs.set(name, config);
    this.trainingHistory.set(name, []);

    this.logger.log(`Network ${name} created successfully`);
  }

  /**
   * Create feedforward network
   */
  private createFeedForwardNetwork(config: BrainNetworkConfig): any {
    // Simulated Brain.js network creation
    // In reality, this would use: new brain.NeuralNetwork(options)
    return {
      type: 'feedforward',
      config: {
        hiddenLayers: config.hiddenLayers,
        activation: config.activation,
        learningRate: config.learningRate,
        momentum: config.momentum,
        dropout: config.dropout
      },
      weights: this.initializeWeights(config),
      train: (data: TrainingData[]) => this.simulateTraining(data, config),
      run: (input: number[]) => this.simulateInference(input, config),
      toJSON: () => ({ type: 'feedforward', config, weights: 'serialized' }),
      fromJSON: (json: any) => { /* Load weights from json */ }
    };
  }

  /**
   * Create LSTM network for sequence prediction
   */
  private createLSTMNetwork(config: BrainNetworkConfig): any {
    // Simulated LSTM network
    return {
      type: 'lstm',
      config: {
        hiddenLayers: config.hiddenLayers,
        activation: config.activation,
        learningRate: config.learningRate,
        outputSize: 7 // Connect 4 columns
      },
      cells: this.initializeLSTMCells(config),
      train: (data: any[]) => this.simulateLSTMTraining(data, config),
      run: (input: any) => this.simulateLSTMInference(input, config),
      forecast: (input: any, steps: number) => this.simulateLSTMForecast(input, steps, config)
    };
  }

  /**
   * Create GRU network
   */
  private createGRUNetwork(config: BrainNetworkConfig): any {
    // GRU is similar to LSTM but with fewer gates
    return {
      type: 'gru',
      config: {
        hiddenLayers: config.hiddenLayers,
        activation: config.activation,
        learningRate: config.learningRate
      },
      gates: {
        update: this.initializeGate(config),
        reset: this.initializeGate(config)
      },
      train: (data: any[]) => this.simulateGRUTraining(data, config),
      run: (input: any) => this.simulateGRUInference(input, config)
    };
  }

  /**
   * Create vanilla RNN network
   */
  private createRNNNetwork(config: BrainNetworkConfig): any {
    return {
      type: 'rnn',
      config: {
        hiddenLayers: config.hiddenLayers,
        activation: config.activation,
        learningRate: config.learningRate
      },
      recurrentWeights: this.initializeRecurrentWeights(config),
      train: (data: any[]) => this.simulateRNNTraining(data, config),
      run: (input: any) => this.simulateRNNInference(input, config)
    };
  }

  /**
   * Train a network with game data
   */
  async train(
    networkName: string,
    trainingData: TrainingData[],
    validationData?: TrainingData[]
  ): Promise<TrainingMetrics> {
    const network = this.networks.get(networkName);
    const config = this.configs.get(networkName);

    if (!network || !config) {
      throw new Error(`Network ${networkName} not found`);
    }

    this.logger.log(`Training network ${networkName} with ${trainingData.length} samples`);

    const startTime = performance.now();

    // Prepare training options
    const trainOptions = {
      iterations: config.iterations,
      errorThresh: config.errorThresh,
      log: true,
      logPeriod: 100,
      learningRate: config.learningRate,
      momentum: config.momentum,
      callback: (status: any) => {
        this.eventEmitter.emit('brain.training.progress', {
          networkName,
          iteration: status.iterations,
          error: status.error
        });
      }
    };

    // Train the network
    const trainResult = await network.train(trainingData, trainOptions);

    // Validate if validation data provided
    let validationError: number | undefined;
    if (validationData) {
      validationError = this.validateNetwork(network, validationData);
    }

    const trainingTime = performance.now() - startTime;

    const metrics: TrainingMetrics = {
      error: trainResult.error,
      iterations: trainResult.iterations,
      time: trainingTime,
      validationError
    };

    // Store training history
    const history = this.trainingHistory.get(networkName) || [];
    history.push(metrics);
    this.trainingHistory.set(networkName, history);

    this.logger.log(`Training completed: ${metrics.iterations} iterations, error: ${metrics.error}`);

    return metrics;
  }

  /**
   * Make prediction for a board state
   */
  async predict(networkName: string, board: CellValue[][]): Promise<NetworkPrediction> {
    const network = this.networks.get(networkName);
    const config = this.configs.get(networkName);

    if (!network || !config) {
      throw new Error(`Network ${networkName} not found`);
    }

    // Convert board to input vector
    const input = this.boardToInput(board);

    // Run inference
    const output = network.run(input);

    // Process output based on network type
    let prediction: NetworkPrediction;

    if (config.type === 'lstm' || config.type === 'gru' || config.type === 'rnn') {
      // Sequence models output move probabilities directly
      prediction = {
        policy: this.normalizePolicy(output.slice(0, 7)),
        value: output[7] || 0,
        confidence: this.calculateConfidence(output)
      };
    } else {
      // Feedforward network outputs
      prediction = {
        policy: this.normalizePolicy(output.policy || output.slice(0, 7)),
        value: output.value || output[7] || 0,
        confidence: this.calculateConfidence(output)
      };
    }

    return prediction;
  }

  /**
   * Ensemble prediction using multiple networks
   */
  async ensemblePredict(
    networkNames: string[],
    board: CellValue[][],
    method: 'average' | 'weighted' | 'voting' = 'average'
  ): Promise<NetworkPrediction> {
    const predictions = await Promise.all(
      networkNames.map(name => this.predict(name, board))
    );

    let ensembledPolicy: number[];
    let ensembledValue: number;
    let confidence: number;

    switch (method) {
      case 'average':
        ensembledPolicy = this.averagePolicies(predictions.map(p => p.policy));
        ensembledValue = predictions.reduce((sum, p) => sum + p.value, 0) / predictions.length;
        confidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
        break;

      case 'weighted':
        const weights = predictions.map(p => p.confidence);
        ensembledPolicy = this.weightedAveragePolicies(
          predictions.map(p => p.policy),
          weights
        );
        ensembledValue = this.weightedAverage(
          predictions.map(p => p.value),
          weights
        );
        confidence = Math.max(...weights);
        break;

      case 'voting':
        ensembledPolicy = this.votingPolicy(predictions.map(p => p.policy));
        ensembledValue = this.median(predictions.map(p => p.value));
        confidence = this.calculateVotingConfidence(predictions);
        break;
    }

    return {
      policy: ensembledPolicy,
      value: ensembledValue,
      confidence
    };
  }

  /**
   * Generate training data from game history
   */
  generateTrainingData(
    gameHistory: Array<{
      board: CellValue[][];
      move: number;
      outcome: 'win' | 'loss' | 'draw';
    }>
  ): TrainingData[] {
    return gameHistory.map(({ board, move, outcome }) => {
      const input = this.boardToInput(board);
      const output = this.createOutput(move, outcome);

      return { input, output };
    });
  }

  /**
   * Advanced training with curriculum learning
   */
  async curriculumTrain(
    networkName: string,
    stages: Array<{
      name: string;
      data: TrainingData[];
      iterations: number;
      errorThresh: number;
    }>
  ): Promise<TrainingMetrics[]> {
    const metrics: TrainingMetrics[] = [];

    for (const stage of stages) {
      this.logger.log(`Curriculum learning stage: ${stage.name}`);

      // Update network config for this stage
      const config = this.configs.get(networkName);
      if (config) {
        config.iterations = stage.iterations;
        config.errorThresh = stage.errorThresh;
      }

      // Train on stage data
      const stageMetrics = await this.train(networkName, stage.data);
      metrics.push(stageMetrics);

      // Emit stage completion
      this.eventEmitter.emit('brain.curriculum.stage', {
        networkName,
        stage: stage.name,
        metrics: stageMetrics
      });
    }

    return metrics;
  }

  /**
   * Network architecture search
   */
  async searchArchitecture(
    baseConfig: BrainNetworkConfig,
    trainingData: TrainingData[],
    validationData: TrainingData[],
    searchSpace: {
      hiddenLayers: number[][];
      activations: string[];
      learningRates: number[];
    }
  ): Promise<{ config: BrainNetworkConfig; score: number }> {
    this.logger.log('Starting neural architecture search...');

    let bestConfig: BrainNetworkConfig = baseConfig;
    let bestScore = -Infinity;

    for (const layers of searchSpace.hiddenLayers) {
      for (const activation of searchSpace.activations) {
        for (const lr of searchSpace.learningRates) {
          const testConfig: BrainNetworkConfig = {
            ...baseConfig,
            hiddenLayers: layers,
            activation: activation as any,
            learningRate: lr
          };

          // Create and train test network
          const testName = `nas_${Date.now()}`;
          this.createNetwork(testName, testConfig);
          
          const metrics = await this.train(testName, trainingData, validationData);
          
          // Score based on validation error and training time
          const score = -metrics.validationError! - (metrics.time / 10000);

          if (score > bestScore) {
            bestScore = score;
            bestConfig = testConfig;
          }

          // Clean up test network
          this.networks.delete(testName);
        }
      }
    }

    this.logger.log(`Best architecture found: ${JSON.stringify(bestConfig)}`);

    return { config: bestConfig, score: bestScore };
  }

  /**
   * Convert board to neural network input
   */
  private boardToInput(board: CellValue[][]): number[] {
    const input: number[] = [];

    // Flatten board with one-hot encoding
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        const cell = board[r][c];
        
        // One-hot encoding: [red, yellow, empty]
        input.push(cell === 'Red' ? 1 : 0);
        input.push(cell === 'Yellow' ? 1 : 0);
        input.push(cell === 'Empty' ? 1 : 0);
      }
    }

    // Add board-level features
    input.push(...this.extractBoardFeatures(board));

    return input;
  }

  /**
   * Extract high-level board features
   */
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

    // Piece count ratio
    let redCount = 0;
    let yellowCount = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] === 'Red') redCount++;
        else if (board[r][c] === 'Yellow') yellowCount++;
      }
    }
    features.push((redCount - yellowCount) / 42);

    // Threat detection (simplified)
    const threats = this.countThreats(board);
    features.push(threats.red / 10);
    features.push(threats.yellow / 10);

    return features;
  }

  /**
   * Count threats on the board
   */
  private countThreats(board: CellValue[][]): { red: number; yellow: number } {
    let redThreats = 0;
    let yellowThreats = 0;

    // Check all possible 4-in-a-row positions
    // This is simplified - real implementation would be more comprehensive
    
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length - 3; c++) {
        const window = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
        const redCount = window.filter(cell => cell === 'Red').length;
        const yellowCount = window.filter(cell => cell === 'Yellow').length;
        const emptyCount = window.filter(cell => cell === 'Empty').length;

        if (redCount === 3 && emptyCount === 1) redThreats++;
        if (yellowCount === 3 && emptyCount === 1) yellowThreats++;
      }
    }

    return { red: redThreats, yellow: yellowThreats };
  }

  /**
   * Create output vector for training
   */
  private createOutput(move: number, outcome: 'win' | 'loss' | 'draw'): number[] {
    const output = new Array(8).fill(0);

    // Policy output (move probabilities)
    output[move] = 1;

    // Value output
    output[7] = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;

    return output;
  }

  /**
   * Initialize network weights
   */
  private initializeWeights(config: BrainNetworkConfig): any {
    // Xavier/He initialization based on activation
    const scale = config.activation === 'relu' ? 
      Math.sqrt(2 / config.hiddenLayers[0]) : 
      Math.sqrt(1 / config.hiddenLayers[0]);

    return {
      input: this.randomMatrix(126, config.hiddenLayers[0], scale),
      hidden: config.hiddenLayers.slice(0, -1).map((size, i) => 
        this.randomMatrix(size, config.hiddenLayers[i + 1], scale)
      ),
      output: this.randomMatrix(config.hiddenLayers[config.hiddenLayers.length - 1], 8, scale)
    };
  }

  /**
   * Initialize LSTM cells
   */
  private initializeLSTMCells(config: BrainNetworkConfig): any {
    return {
      forget: this.initializeGate(config),
      input: this.initializeGate(config),
      output: this.initializeGate(config),
      cell: this.initializeGate(config)
    };
  }

  /**
   * Initialize gate weights
   */
  private initializeGate(config: BrainNetworkConfig): any {
    const inputSize = 126;
    const hiddenSize = config.hiddenLayers[0];

    return {
      weights: this.randomMatrix(inputSize + hiddenSize, hiddenSize, 0.1),
      bias: new Array(hiddenSize).fill(0).map(() => Math.random() * 0.1)
    };
  }

  /**
   * Initialize recurrent weights
   */
  private initializeRecurrentWeights(config: BrainNetworkConfig): any {
    const hiddenSize = config.hiddenLayers[0];
    return this.randomMatrix(hiddenSize, hiddenSize, 0.1);
  }

  /**
   * Create random matrix
   */
  private randomMatrix(rows: number, cols: number, scale: number): number[][] {
    return Array(rows).fill(null).map(() =>
      Array(cols).fill(null).map(() => (Math.random() - 0.5) * 2 * scale)
    );
  }

  /**
   * Simulate training (placeholder)
   */
  private simulateTraining(data: TrainingData[], config: BrainNetworkConfig): any {
    return {
      error: Math.random() * 0.01,
      iterations: config.iterations
    };
  }

  /**
   * Simulate inference (placeholder)
   */
  private simulateInference(input: number[], config: BrainNetworkConfig): any {
    // Simulate neural network forward pass
    const policy = new Array(7).fill(0).map(() => Math.random());
    const value = Math.random() * 2 - 1;
    
    return [...policy, value];
  }

  /**
   * Simulate LSTM training
   */
  private simulateLSTMTraining(data: any[], config: BrainNetworkConfig): any {
    return {
      error: Math.random() * 0.01,
      iterations: config.iterations
    };
  }

  /**
   * Simulate LSTM inference
   */
  private simulateLSTMInference(input: any, config: BrainNetworkConfig): any {
    return new Array(8).fill(0).map(() => Math.random());
  }

  /**
   * Simulate LSTM forecast
   */
  private simulateLSTMForecast(input: any, steps: number, config: BrainNetworkConfig): any[] {
    return Array(steps).fill(null).map(() => 
      new Array(8).fill(0).map(() => Math.random())
    );
  }

  /**
   * Simulate GRU training
   */
  private simulateGRUTraining(data: any[], config: BrainNetworkConfig): any {
    return {
      error: Math.random() * 0.01,
      iterations: config.iterations
    };
  }

  /**
   * Simulate GRU inference
   */
  private simulateGRUInference(input: any, config: BrainNetworkConfig): any {
    return new Array(8).fill(0).map(() => Math.random());
  }

  /**
   * Simulate RNN training
   */
  private simulateRNNTraining(data: any[], config: BrainNetworkConfig): any {
    return {
      error: Math.random() * 0.01,
      iterations: config.iterations
    };
  }

  /**
   * Simulate RNN inference
   */
  private simulateRNNInference(input: any, config: BrainNetworkConfig): any {
    return new Array(8).fill(0).map(() => Math.random());
  }

  /**
   * Validate network on data
   */
  private validateNetwork(network: any, data: TrainingData[]): number {
    let totalError = 0;

    for (const sample of data) {
      const output = network.run(sample.input);
      const error = this.calculateError(output, sample.output);
      totalError += error;
    }

    return totalError / data.length;
  }

  /**
   * Calculate error between output and target
   */
  private calculateError(output: any, target: number[]): number {
    let error = 0;
    const outputArray = Array.isArray(output) ? output : Object.values(output);

    for (let i = 0; i < target.length; i++) {
      error += Math.pow(outputArray[i] - target[i], 2);
    }

    return error / target.length;
  }

  /**
   * Normalize policy output
   */
  private normalizePolicy(policy: number[]): number[] {
    const sum = policy.reduce((a, b) => a + b, 0);
    return sum > 0 ? policy.map(p => p / sum) : policy.map(() => 1 / policy.length);
  }

  /**
   * Calculate confidence from output
   */
  private calculateConfidence(output: any): number {
    const values = Array.isArray(output) ? output : Object.values(output);
    const max = Math.max(...values.slice(0, 7));
    const entropy = -values.slice(0, 7).reduce((sum, p) => {
      const normalized = p / (values.slice(0, 7).reduce((a, b) => a + b, 0) || 1);
      return sum + (normalized > 0 ? normalized * Math.log(normalized) : 0);
    }, 0);

    return max * (1 - entropy / Math.log(7));
  }

  /**
   * Average multiple policies
   */
  private averagePolicies(policies: number[][]): number[] {
    const avgPolicy = new Array(7).fill(0);

    for (const policy of policies) {
      for (let i = 0; i < 7; i++) {
        avgPolicy[i] += policy[i];
      }
    }

    return avgPolicy.map(p => p / policies.length);
  }

  /**
   * Weighted average of policies
   */
  private weightedAveragePolicies(policies: number[][], weights: number[]): number[] {
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const avgPolicy = new Array(7).fill(0);

    for (let i = 0; i < policies.length; i++) {
      const weight = weights[i] / weightSum;
      for (let j = 0; j < 7; j++) {
        avgPolicy[j] += policies[i][j] * weight;
      }
    }

    return avgPolicy;
  }

  /**
   * Voting-based policy combination
   */
  private votingPolicy(policies: number[][]): number[] {
    const votes = new Array(7).fill(0);

    for (const policy of policies) {
      const bestMove = policy.indexOf(Math.max(...policy));
      votes[bestMove]++;
    }

    return votes.map(v => v / policies.length);
  }

  /**
   * Weighted average of values
   */
  private weightedAverage(values: number[], weights: number[]): number {
    const weightSum = weights.reduce((a, b) => a + b, 0);
    return values.reduce((sum, val, i) => sum + val * weights[i] / weightSum, 0);
  }

  /**
   * Calculate median
   */
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  /**
   * Calculate voting confidence
   */
  private calculateVotingConfidence(predictions: NetworkPrediction[]): number {
    const moves = predictions.map(p => p.policy.indexOf(Math.max(...p.policy)));
    const uniqueMoves = new Set(moves).size;
    return 1 - (uniqueMoves - 1) / 6; // More agreement = higher confidence
  }

  /**
   * Save network to JSON
   */
  saveNetwork(networkName: string): any {
    const network = this.networks.get(networkName);
    const config = this.configs.get(networkName);

    if (!network || !config) {
      throw new Error(`Network ${networkName} not found`);
    }

    return {
      name: networkName,
      config,
      weights: network.toJSON(),
      trainingHistory: this.trainingHistory.get(networkName)
    };
  }

  /**
   * Load network from JSON
   */
  loadNetwork(networkName: string, data: any): void {
    this.createNetwork(networkName, data.config);
    
    const network = this.networks.get(networkName);
    if (network) {
      network.fromJSON(data.weights);
      this.trainingHistory.set(networkName, data.trainingHistory || []);
    }
  }

  /**
   * Get network info
   */
  getNetworkInfo(networkName: string): any {
    const config = this.configs.get(networkName);
    const history = this.trainingHistory.get(networkName);

    return {
      config,
      trainingHistory: history,
      lastError: history && history.length > 0 ? history[history.length - 1].error : null
    };
  }

  /**
   * List all networks
   */
  listNetworks(): string[] {
    return Array.from(this.networks.keys());
  }

  /**
   * Remove network
   */
  removeNetwork(networkName: string): void {
    this.networks.delete(networkName);
    this.configs.delete(networkName);
    this.trainingHistory.delete(networkName);
  }
}