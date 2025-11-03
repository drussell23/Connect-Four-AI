import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { TensorOps } from '../shared/tensor-ops';

export interface NetworkConfig {
    boardHeight: number;
    boardWidth: number;
    filters: number[];
    kernelSizes: number[];
    dropout: number;
    l2Regularization: number;
    learningRate: number;
    batchSize: number;
}

export interface NetworkOutput {
    policyLogits: tf.Tensor; // Action probabilities [batch, 7]
    valueLogits: tf.Tensor;  // Position value [-1, 1]
    features?: tf.Tensor;    // Learned features for analysis
}

/**
 * Advanced CNN Architecture for Connect Four
 * Features:
 * - Dual-head architecture (policy + value)
 * - Spatial convolutions for pattern recognition
 * - Batch normalization and dropout
 * - L2 regularization
 */
export class Connect4CNN {
    private model: tf.LayersModel | null = null;
    private config: NetworkConfig;
    private isTraining: boolean = false;

    constructor(config: Partial<NetworkConfig> = {}) {
        this.config = {
            boardHeight: 6,
            boardWidth: 7,
            filters: [64, 128, 256, 512],
            kernelSizes: [3, 3, 3, 3],
            dropout: 0.3,
            l2Regularization: 0.001,
            learningRate: 0.001,
            batchSize: 32,
            ...config
        };
    }

    /**
     * Build the CNN architecture
     */
    buildModel(): tf.LayersModel {
        const input = tf.input({
            shape: [this.config.boardHeight, this.config.boardWidth, 3], // 3 channels: Red, Yellow, Empty
            name: 'board_input'
        });

        let x = input;

        // Convolutional layers with batch normalization
        for (let i = 0; i < this.config.filters.length; i++) {
            x = tf.layers.conv2d({
                filters: this.config.filters[i],
                kernelSize: this.config.kernelSizes[i],
                padding: 'same',
                activation: 'relu',
                kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
                name: `conv_${i + 1}`
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization({ name: `bn_${i + 1}` }).apply(x) as tf.SymbolicTensor;

            if (i < this.config.filters.length - 1) {
                x = tf.layers.dropout({ rate: this.config.dropout, name: `dropout_${i + 1}` }).apply(x) as tf.SymbolicTensor;
            }
        }

        // Global average pooling
        const features = tf.layers.globalAveragePooling2d({ name: 'global_pool' }).apply(x) as tf.SymbolicTensor;

        // Policy head (move probabilities)
        let policyHead = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'policy_dense_1'
        }).apply(features) as tf.SymbolicTensor;

        policyHead = tf.layers.dropout({ rate: this.config.dropout, name: 'policy_dropout' }).apply(policyHead) as tf.SymbolicTensor;

        const policyOutput = tf.layers.dense({
            units: this.config.boardWidth,
            activation: 'linear', // We'll apply softmax during prediction
            name: 'policy_output'
        }).apply(policyHead) as tf.SymbolicTensor;

        // Value head (position evaluation)
        let valueHead = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'value_dense_1'
        }).apply(features) as tf.SymbolicTensor;

        valueHead = tf.layers.dropout({ rate: this.config.dropout, name: 'value_dropout' }).apply(valueHead) as tf.SymbolicTensor;

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'tanh', // Output in [-1, 1]
            name: 'value_output'
        }).apply(valueHead) as tf.SymbolicTensor;

        this.model = tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput],
            name: 'Connect4CNN'
        });

        // Compile with custom loss functions
        this.model.compile({
            optimizer: tf.train.adam(this.config.learningRate),
            loss: {
                'policy_output': 'categoricalCrossentropy',
                'value_output': 'meanSquaredError'
            },
            metrics: ['accuracy']
        });

        return this.model;
    }

    /**
     * Convert board to tensor representation
     */
    boardToTensor(board: CellValue[][]): tf.Tensor {
        return TensorOps.tidy('boardToTensor', () => {
            const height = board.length;
            const width = board[0].length;

            // Create 3-channel representation
            const tensorData = new Float32Array(height * width * 3);

            for (let r = 0; r < height; r++) {
                for (let c = 0; c < width; c++) {
                    const baseIdx = (r * width + c) * 3;
                    const cell = board[r][c];

                    // Channel 0: Red pieces
                    tensorData[baseIdx] = cell === 'Red' ? 1.0 : 0.0;
                    // Channel 1: Yellow pieces  
                    tensorData[baseIdx + 1] = cell === 'Yellow' ? 1.0 : 0.0;
                    // Channel 2: Empty spaces
                    tensorData[baseIdx + 2] = cell === 'Empty' ? 1.0 : 0.0;
                }
            }

            return tf.tensor4d(tensorData, [1, height, width, 3]);
        });
    }

    /**
     * Predict move probabilities and position value
     */
    async predict(board: CellValue[][]): Promise<{ policy: number[]; value: number; confidence: number }> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        return TensorOps.tidy('cnn:predict', () => {
            const boardTensor = this.boardToTensor(board);
            const [policyLogits, valueLogits] = this.model!.predict(boardTensor) as [tf.Tensor, tf.Tensor];

            // Apply softmax to policy logits
            const policyProbs = tf.softmax(policyLogits);

            // Get arrays synchronously within tidy
            const policy = Array.from(policyProbs.dataSync());
            const value = valueLogits.dataSync()[0];

            // Calculate confidence (entropy-based)
            const logProbs = tf.log(tf.add(policyProbs, 1e-8));
            const entropy = tf.neg(tf.sum(tf.mul(policyProbs, logProbs)));
            const entropyValue = entropy.dataSync()[0];
            const confidence = Math.exp(-entropyValue);

            // Clean up intermediate tensors
            boardTensor.dispose();
            policyLogits.dispose();
            valueLogits.dispose();
            policyProbs.dispose();
            logProbs.dispose();
            entropy.dispose();

            return {
                policy,
                value,
                confidence
            };
        });
    }

    /**
     * Calculate prediction entropy for confidence estimation
     */
    private async calculateEntropy(probs: tf.Tensor): Promise<number> {
        const logProbs = tf.log(tf.add(probs, 1e-8)); // Add small epsilon to avoid log(0)
        const entropy = tf.neg(tf.sum(tf.mul(probs, logProbs)));
        const entropyValue = await entropy.data();

        logProbs.dispose();
        entropy.dispose();

        return entropyValue[0];
    }

    /**
     * Train on a batch of games
     */
    async trainBatch(
        boards: CellValue[][][],
        policies: number[][],
        values: number[]
    ): Promise<tf.History> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        this.isTraining = true;

        // Convert to tensors
        const batchSize = boards.length;
        const boardTensors = tf.stack(boards.map(board => this.boardToTensor(board).squeeze()));
        const policyTensors = tf.tensor2d(policies);
        const valueTensors = tf.tensor2d(values.map(v => [v]));

        try {
            const history = await this.model.fit(boardTensors, {
                'policy_output': policyTensors,
                'value_output': valueTensors
            }, {
                batchSize: this.config.batchSize,
                epochs: 1,
                verbose: 0,
                validationSplit: 0.1
            });

            return history;
        } finally {
            // Cleanup
            boardTensors.dispose();
            policyTensors.dispose();
            valueTensors.dispose();
            this.isTraining = false;
        }
    }

    /**
     * Save model to file
     */
    async saveModel(path: string): Promise<void> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        await this.model.save(`file://${path}`);
    }

    /**
     * Load model from file
     */
    async loadModel(path: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${path}`);
    }

    /**
     * Get model summary
     */
    getSummary(): string {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        // model.summary() returns void, so we return a placeholder
        this.model.summary();
        return 'Model summary printed to console';
    }

    /**
     * Dispose of the model and free memory
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
    }
}

/**
 * Lightweight CNN for fast inference
 */
export class FastConnect4CNN extends Connect4CNN {
    constructor(config: Partial<NetworkConfig> = {}) {
        super({
            filters: [32, 64, 128],
            kernelSizes: [3, 3, 3],
            dropout: 0.2,
            ...config
        });
    }
}

/**
 * Deep CNN for maximum accuracy
 */
export class DeepConnect4CNN extends Connect4CNN {
    constructor(config: Partial<NetworkConfig> = {}) {
        super({
            filters: [64, 128, 256, 512, 1024],
            kernelSizes: [5, 3, 3, 3, 3],
            dropout: 0.4,
            l2Regularization: 0.002,
            ...config
        });
    }
}

/**
 * Utility functions for network management
 */
export class NetworkManager {
    private networks: Map<string, Connect4CNN> = new Map();

    /**
     * Create and register a network
     */
    createNetwork(name: string, type: 'fast' | 'standard' | 'deep', config?: Partial<NetworkConfig>): Connect4CNN {
        let network: Connect4CNN;

        switch (type) {
            case 'fast':
                network = new FastConnect4CNN(config);
                break;
            case 'deep':
                network = new DeepConnect4CNN(config);
                break;
            default:
                network = new Connect4CNN(config);
        }

        network.buildModel();
        this.networks.set(name, network);

        return network;
    }

    /**
     * Get a registered network
     */
    getNetwork(name: string): Connect4CNN | undefined {
        return this.networks.get(name);
    }

    /**
     * Ensemble prediction from multiple networks
     */
    async ensemblePredict(
        board: CellValue[][],
        networkNames: string[],
        weights?: number[]
    ): Promise<{ policy: number[]; value: number; confidence: number }> {
        const networks = networkNames.map(name => this.getNetwork(name)).filter(n => n !== undefined) as Connect4CNN[];

        if (networks.length === 0) {
            throw new Error('No valid networks found for ensemble prediction');
        }

        const predictions = await Promise.all(networks.map(net => net.predict(board)));

        // Weighted average of predictions
        const ensembleWeights = weights || new Array(networks.length).fill(1 / networks.length);

        const policy = new Array(7).fill(0);
        let value = 0;
        let confidence = 0;

        for (let i = 0; i < predictions.length; i++) {
            const weight = ensembleWeights[i];
            const pred = predictions[i];

            for (let j = 0; j < policy.length; j++) {
                policy[j] += pred.policy[j] * weight;
            }

            value += pred.value * weight;
            confidence += pred.confidence * weight;
        }

        return { policy, value, confidence };
    }

    /**
     * Dispose all networks
     */
    dispose(): void {
        for (const network of this.networks.values()) {
            network.dispose();
        }
        this.networks.clear();
    }
}

// Export singleton instance
export const networkManager = new NetworkManager();
