import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { NetworkConfig } from './cnnNetworks';

export interface ResNetConfig extends NetworkConfig {
    numResidualBlocks: number;
    residualFilters: number;
    useBottleneck: boolean;
    seAttention: boolean; // Squeeze-and-Excitation attention
    preactivation: boolean;
}

/**
 * Residual Block for Connect Four ResNet
 * Implements both basic and bottleneck residual blocks with optional SE attention
 */
class ResidualBlock {
    private filters: number;
    private useBottleneck: boolean;
    private seAttention: boolean;
    private preactivation: boolean;
    private blockId: number;

    constructor(
        filters: number,
        blockId: number,
        useBottleneck: boolean = false,
        seAttention: boolean = false,
        preactivation: boolean = true
    ) {
        this.filters = filters;
        this.blockId = blockId;
        this.useBottleneck = useBottleneck;
        this.seAttention = seAttention;
        this.preactivation = preactivation;
    }

    /**
     * Build residual block
     */
    apply(input: tf.SymbolicTensor): tf.SymbolicTensor {
        let x = input;
        let residual = input;

        const blockName = `res_block_${this.blockId}`;

        if (this.preactivation) {
            // Pre-activation ResNet (identity mapping)
            x = tf.layers.batchNormalization({ name: `${blockName}_bn_pre` }).apply(x) as tf.SymbolicTensor;
            x = tf.layers.reLU({ name: `${blockName}_relu_pre` }).apply(x) as tf.SymbolicTensor;
        }

        if (this.useBottleneck) {
            // Bottleneck block (1x1 -> 3x3 -> 1x1)
            x = this.buildBottleneckBlock(x, blockName);
        } else {
            // Basic block (3x3 -> 3x3)
            x = this.buildBasicBlock(x, blockName);
        }

        // Squeeze-and-Excitation attention
        if (this.seAttention) {
            x = this.buildSEBlock(x, blockName);
        }

        // Ensure residual connection has same dimensions
        const inputShape = input.shape;
        const outputShape = x.shape;

        if (inputShape[inputShape.length - 1] !== outputShape[outputShape.length - 1]) {
            // Project residual to match dimensions
            residual = tf.layers.conv2d({
                filters: this.filters,
                kernelSize: 1,
                padding: 'same',
                name: `${blockName}_proj`
            }).apply(residual) as tf.SymbolicTensor;

            if (!this.preactivation) {
                residual = tf.layers.batchNormalization({ name: `${blockName}_proj_bn` }).apply(residual) as tf.SymbolicTensor;
            }
        }

        // Add residual connection
        x = tf.layers.add({ name: `${blockName}_add` }).apply([x, residual]) as tf.SymbolicTensor;

        if (!this.preactivation) {
            // Post-activation
            x = tf.layers.batchNormalization({ name: `${blockName}_bn_post` }).apply(x) as tf.SymbolicTensor;
            x = tf.layers.reLU({ name: `${blockName}_relu_post` }).apply(x) as tf.SymbolicTensor;
        }

        return x;
    }

    /**
     * Build basic residual block (3x3 -> 3x3)
     */
    private buildBasicBlock(input: tf.SymbolicTensor, blockName: string): tf.SymbolicTensor {
        let x = input;

        // First 3x3 conv
        x = tf.layers.conv2d({
            filters: this.filters,
            kernelSize: 3,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
            name: `${blockName}_conv1`
        }).apply(x) as tf.SymbolicTensor;

        if (!this.preactivation) {
            x = tf.layers.batchNormalization({ name: `${blockName}_bn1` }).apply(x) as tf.SymbolicTensor;
            x = tf.layers.reLU({ name: `${blockName}_relu1` }).apply(x) as tf.SymbolicTensor;
        } else {
            x = tf.layers.batchNormalization({ name: `${blockName}_bn1` }).apply(x) as tf.SymbolicTensor;
            x = tf.layers.reLU({ name: `${blockName}_relu1` }).apply(x) as tf.SymbolicTensor;
        }

        // Second 3x3 conv
        x = tf.layers.conv2d({
            filters: this.filters,
            kernelSize: 3,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
            name: `${blockName}_conv2`
        }).apply(x) as tf.SymbolicTensor;

        if (!this.preactivation) {
            x = tf.layers.batchNormalization({ name: `${blockName}_bn2` }).apply(x) as tf.SymbolicTensor;
        }

        return x;
    }

    /**
     * Build bottleneck residual block (1x1 -> 3x3 -> 1x1)
     */
    private buildBottleneckBlock(input: tf.SymbolicTensor, blockName: string): tf.SymbolicTensor {
        let x = input;
        const bottleneckFilters = Math.floor(this.filters / 4);

        // 1x1 conv (dimension reduction)
        x = tf.layers.conv2d({
            filters: bottleneckFilters,
            kernelSize: 1,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
            name: `${blockName}_conv1`
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: `${blockName}_bn1` }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.reLU({ name: `${blockName}_relu1` }).apply(x) as tf.SymbolicTensor;

        // 3x3 conv
        x = tf.layers.conv2d({
            filters: bottleneckFilters,
            kernelSize: 3,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
            name: `${blockName}_conv2`
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: `${blockName}_bn2` }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.reLU({ name: `${blockName}_relu2` }).apply(x) as tf.SymbolicTensor;

        // 1x1 conv (dimension expansion)
        x = tf.layers.conv2d({
            filters: this.filters,
            kernelSize: 1,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
            name: `${blockName}_conv3`
        }).apply(x) as tf.SymbolicTensor;

        if (!this.preactivation) {
            x = tf.layers.batchNormalization({ name: `${blockName}_bn3` }).apply(x) as tf.SymbolicTensor;
        }

        return x;
    }

    /**
     * Build Squeeze-and-Excitation block
     */
    private buildSEBlock(input: tf.SymbolicTensor, blockName: string): tf.SymbolicTensor {
        const numFilters = input.shape[input.shape.length - 1] as number;
        const seRatio = 16;
        const seFilters = Math.max(1, Math.floor(numFilters / seRatio));

        // Global average pooling
        let se = tf.layers.globalAveragePooling2d({ name: `${blockName}_se_gap` }).apply(input) as tf.SymbolicTensor;

        // Excitation: FC -> ReLU -> FC -> Sigmoid
        se = tf.layers.dense({
            units: seFilters,
            activation: 'relu',
            name: `${blockName}_se_fc1`
        }).apply(se) as tf.SymbolicTensor;

        se = tf.layers.dense({
            units: numFilters,
            activation: 'sigmoid',
            name: `${blockName}_se_fc2`
        }).apply(se) as tf.SymbolicTensor;

        // Reshape for multiplication
        se = tf.layers.reshape({
            targetShape: [1, 1, numFilters],
            name: `${blockName}_se_reshape`
        }).apply(se) as tf.SymbolicTensor;

        // Scale the input
        return tf.layers.multiply({ name: `${blockName}_se_scale` }).apply([input, se]) as tf.SymbolicTensor;
    }
}

/**
 * Advanced ResNet for Connect Four
 * Features:
 * - Residual connections for deep networks
 * - Pre-activation or post-activation blocks
 * - Bottleneck blocks for efficiency
 * - Squeeze-and-Excitation attention
 * - Dual-head architecture (policy + value)
 */
export class Connect4ResNet {
    private model: tf.LayersModel | null = null;
    private config: ResNetConfig;

    constructor(config: Partial<ResNetConfig> = {}) {
        this.config = {
            boardHeight: 6,
            boardWidth: 7,
            filters: [64, 128, 256, 512],
            kernelSizes: [3, 3, 3, 3],
            dropout: 0.3,
            l2Regularization: 0.001,
            learningRate: 0.001,
            batchSize: 32,
            numResidualBlocks: 8,
            residualFilters: 256,
            useBottleneck: false,
            seAttention: true,
            preactivation: true,
            ...config
        };
    }

    /**
     * Build the ResNet architecture
     */
    buildModel(): tf.LayersModel {
        const input = tf.input({
            shape: [this.config.boardHeight, this.config.boardWidth, 3],
            name: 'board_input'
        });

        // Initial convolution
        let x = tf.layers.conv2d({
            filters: 64,
            kernelSize: 7,
            strides: 1,
            padding: 'same',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'initial_conv'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: 'initial_bn' }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.reLU({ name: 'initial_relu' }).apply(x) as tf.SymbolicTensor;

        // Residual blocks
        for (let i = 0; i < this.config.numResidualBlocks; i++) {
            const block = new ResidualBlock(
                this.config.residualFilters,
                i,
                this.config.useBottleneck,
                this.config.seAttention,
                this.config.preactivation
            );
            x = block.apply(x);
        }

        // Global average pooling
        const features = tf.layers.globalAveragePooling2d({ name: 'final_gap' }).apply(x) as tf.SymbolicTensor;

        // Policy head
        let policyHead = tf.layers.dense({
            units: 512,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'policy_dense_1'
        }).apply(features) as tf.SymbolicTensor;

        policyHead = tf.layers.dropout({ rate: this.config.dropout, name: 'policy_dropout' }).apply(policyHead) as tf.SymbolicTensor;

        policyHead = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'policy_dense_2'
        }).apply(policyHead) as tf.SymbolicTensor;

        const policyOutput = tf.layers.dense({
            units: this.config.boardWidth,
            activation: 'linear',
            name: 'policy_output'
        }).apply(policyHead) as tf.SymbolicTensor;

        // Value head
        let valueHead = tf.layers.dense({
            units: 512,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'value_dense_1'
        }).apply(features) as tf.SymbolicTensor;

        valueHead = tf.layers.dropout({ rate: this.config.dropout, name: 'value_dropout' }).apply(valueHead) as tf.SymbolicTensor;

        valueHead = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'value_dense_2'
        }).apply(valueHead) as tf.SymbolicTensor;

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'tanh',
            name: 'value_output'
        }).apply(valueHead) as tf.SymbolicTensor;

        this.model = tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput],
            name: 'Connect4ResNet'
        });

        // Compile with advanced optimizer
        this.model.compile({
            optimizer: tf.train.adamax(this.config.learningRate),
            loss: {
                'policy_output': 'categoricalCrossentropy',
                'value_output': 'meanSquaredError'
            },
            metrics: ['accuracy']
        });

        return this.model;
    }

    /**
     * Convert board to tensor (same as CNN)
     */
    boardToTensor(board: CellValue[][]): tf.Tensor {
        const height = board.length;
        const width = board[0].length;

        const tensorData = new Float32Array(height * width * 3);

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const baseIdx = (r * width + c) * 3;
                const cell = board[r][c];

                tensorData[baseIdx] = cell === 'Red' ? 1.0 : 0.0;
                tensorData[baseIdx + 1] = cell === 'Yellow' ? 1.0 : 0.0;
                tensorData[baseIdx + 2] = cell === 'Empty' ? 1.0 : 0.0;
            }
        }

        return tf.tensor4d(tensorData, [1, height, width, 3]);
    }

    /**
     * Predict with confidence estimation
     */
    async predict(board: CellValue[][]): Promise<{ policy: number[]; value: number; confidence: number }> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        const boardTensor = this.boardToTensor(board);

        try {
            const [policyLogits, valueLogits] = this.model.predict(boardTensor) as [tf.Tensor, tf.Tensor];

            const policyProbs = tf.softmax(policyLogits);

            const policy = await policyProbs.data();
            const value = await valueLogits.data();

            // Calculate confidence using prediction variance
            const variance = await this.calculatePredictionVariance(policyProbs);
            const confidence = Math.exp(-variance);

            // Cleanup
            boardTensor.dispose();
            policyLogits.dispose();
            valueLogits.dispose();
            policyProbs.dispose();

            return {
                policy: Array.from(policy),
                value: value[0],
                confidence
            };
        } catch (error) {
            boardTensor.dispose();
            throw error;
        }
    }

    /**
     * Calculate prediction variance for confidence
     */
    private async calculatePredictionVariance(probs: tf.Tensor): Promise<number> {
        const mean = tf.mean(probs);
        const variance = tf.mean(tf.square(tf.sub(probs, mean)));
        const varianceValue = await variance.data();

        mean.dispose();
        variance.dispose();

        return varianceValue[0];
    }

    /**
     * Advanced training with learning rate scheduling
     */
    async trainBatch(
        boards: CellValue[][][],
        policies: number[][],
        values: number[],
        epoch: number = 0
    ): Promise<tf.History> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        // Learning rate scheduling
        const baseLR = this.config.learningRate;
        const decayRate = 0.96;
        const decaySteps = 1000;
        const currentLR = baseLR * Math.pow(decayRate, Math.floor(epoch / decaySteps));

        // Update optimizer learning rate
        // Note: setLearningRate is not available on all optimizers
        // this.model.optimizer.setLearningRate(currentLR);

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
                validationSplit: 0.15,
                callbacks: [
                    tf.callbacks.earlyStopping({ patience: 10, restoreBestWeights: true })
                ]
            });

            return history;
        } finally {
            boardTensors.dispose();
            policyTensors.dispose();
            valueTensors.dispose();
        }
    }

    /**
     * Save model
     */
    async saveModel(path: string): Promise<void> {
        if (!this.model) {
            throw new Error('Model not built.');
        }
        await this.model.save(`file://${path}`);
    }

    /**
     * Load model
     */
    async loadModel(path: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${path}`);
    }

    /**
     * Get model summary
     */
    getSummary(): string {
        if (!this.model) {
            throw new Error('Model not built.');
        }
        // model.summary() returns void, so we return a placeholder
        this.model.summary();
        return 'Model summary printed to console';
    }

    /**
     * Dispose model
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
    }
}

/**
 * Lightweight ResNet for fast inference
 */
export class FastConnect4ResNet extends Connect4ResNet {
    constructor(config: Partial<ResNetConfig> = {}) {
        super({
            numResidualBlocks: 4,
            residualFilters: 128,
            useBottleneck: false,
            seAttention: false,
            ...config
        });
    }
}

/**
 * Deep ResNet for maximum performance
 */
export class DeepConnect4ResNet extends Connect4ResNet {
    constructor(config: Partial<ResNetConfig> = {}) {
        super({
            numResidualBlocks: 16,
            residualFilters: 512,
            useBottleneck: true,
            seAttention: true,
            preactivation: true,
            ...config
        });
    }
}
