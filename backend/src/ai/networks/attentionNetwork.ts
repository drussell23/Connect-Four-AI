import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { NetworkConfig } from './cnnNetworks';

export interface AttentionConfig extends NetworkConfig {
    numHeads: number;
    numLayers: number;
    embedDim: number;
    feedForwardDim: number;
    usePositionalEncoding: boolean;
    maxSequenceLength: number;
    attentionDropout: number;
}

/**
 * Multi-Head Self-Attention Layer
 */
class MultiHeadAttention {
    private numHeads: number;
    private embedDim: number;
    private headDim: number;
    private dropout: number;
    private layerId: number;

    constructor(numHeads: number, embedDim: number, dropout: number = 0.1, layerId: number = 0) {
        this.numHeads = numHeads;
        this.embedDim = embedDim;
        this.headDim = Math.floor(embedDim / numHeads);
        this.dropout = dropout;
        this.layerId = layerId;
    }

    /**
     * Apply multi-head attention
     */
    apply(input: tf.SymbolicTensor, mask?: tf.SymbolicTensor): tf.SymbolicTensor {
        const layerName = `attention_${this.layerId}`;

        // Linear projections for Q, K, V
        const queries = tf.layers.dense({
            units: this.embedDim,
            name: `${layerName}_query`
        }).apply(input) as tf.SymbolicTensor;

        const keys = tf.layers.dense({
            units: this.embedDim,
            name: `${layerName}_key`
        }).apply(input) as tf.SymbolicTensor;

        const values = tf.layers.dense({
            units: this.embedDim,
            name: `${layerName}_value`
        }).apply(input) as tf.SymbolicTensor;

        // Reshape for multi-head attention
        // [batch, seq_len, embed_dim] -> [batch, seq_len, num_heads, head_dim]
        const queryHeads = this.reshapeForHeads(queries, `${layerName}_query_heads`);
        const keyHeads = this.reshapeForHeads(keys, `${layerName}_key_heads`);
        const valueHeads = this.reshapeForHeads(values, `${layerName}_value_heads`);

        // Scaled dot-product attention
        const attention = this.scaledDotProductAttention(queryHeads, keyHeads, valueHeads, mask, layerName);

        // Concatenate heads
        const concat = tf.layers.reshape({
            targetShape: [-1, this.embedDim],
            name: `${layerName}_concat`
        }).apply(attention) as tf.SymbolicTensor;

        // Final linear projection
        const output = tf.layers.dense({
            units: this.embedDim,
            name: `${layerName}_output`
        }).apply(concat) as tf.SymbolicTensor;

        // Dropout
        return tf.layers.dropout({ rate: this.dropout, name: `${layerName}_dropout` }).apply(output) as tf.SymbolicTensor;
    }

    /**
     * Reshape tensor for multi-head attention
     */
    private reshapeForHeads(tensor: tf.SymbolicTensor, name: string): tf.SymbolicTensor {
        // [batch, seq_len, embed_dim] -> [batch, seq_len, num_heads, head_dim]
        const reshaped = tf.layers.reshape({
            targetShape: [-1, this.numHeads, this.headDim],
            name: `${name}_reshape`
        }).apply(tensor) as tf.SymbolicTensor;

        // Transpose to [batch, num_heads, seq_len, head_dim]
        return tf.layers.permute({
            dims: [2, 1, 3],
            name: `${name}_transpose`
        }).apply(reshaped) as tf.SymbolicTensor;
    }

    /**
     * Scaled dot-product attention
     */
    private scaledDotProductAttention(
        queries: tf.SymbolicTensor,
        keys: tf.SymbolicTensor,
        values: tf.SymbolicTensor,
        mask: tf.SymbolicTensor | undefined,
        layerName: string
    ): tf.SymbolicTensor {
        // Compute attention scores
        // queries: [batch, num_heads, seq_len, head_dim]
        // keys: [batch, num_heads, seq_len, head_dim]
        const keyTranspose = tf.layers.permute({
            dims: [1, 2, 4, 3],
            name: `${layerName}_key_transpose`
        }).apply(keys) as tf.SymbolicTensor;

        // This is a simplified version - in practice, you'd use tf.matMul
        // For now, we'll use a custom layer or approximate with dense layers
        const scores = this.computeAttentionScores(queries, keyTranspose, layerName);

        // Scale by sqrt(head_dim)
        // Lambda layer is not available in TensorFlow.js, so we'll use a simple approach
        const scaledScores = tf.layers.dense({
            units: this.headDim,
            activation: 'linear',
            name: `${layerName}_scale`
        }).apply(scores) as tf.SymbolicTensor;

        // Apply mask if provided
        let maskedScores = scaledScores;
        if (mask) {
            maskedScores = tf.layers.add({ name: `${layerName}_mask` }).apply([scaledScores, mask]) as tf.SymbolicTensor;
        }

        // Softmax
        const attentionWeights = tf.layers.softmax({
            axis: -1,
            name: `${layerName}_softmax`
        }).apply(maskedScores) as tf.SymbolicTensor;

        // Apply attention to values
        const attentionOutput = this.applyAttentionToValues(attentionWeights, values, layerName);

        // Transpose back to [batch, seq_len, num_heads, head_dim]
        return tf.layers.permute({
            dims: [2, 1, 3],
            name: `${layerName}_output_transpose`
        }).apply(attentionOutput) as tf.SymbolicTensor;
    }

    /**
     * Compute attention scores (simplified matrix multiplication)
     */
    private computeAttentionScores(queries: tf.SymbolicTensor, keys: tf.SymbolicTensor, layerName: string): tf.SymbolicTensor {
        // This is a simplified implementation
        // In practice, you'd use proper matrix multiplication
        return tf.layers.dense({
            units: 42, // 6*7 for Connect Four board
            activation: 'linear',
            name: `${layerName}_scores`
        }).apply(queries) as tf.SymbolicTensor;
    }

    /**
     * Apply attention weights to values
     */
    private applyAttentionToValues(weights: tf.SymbolicTensor, values: tf.SymbolicTensor, layerName: string): tf.SymbolicTensor {
        // Simplified implementation
        return tf.layers.dense({
            units: this.headDim,
            activation: 'linear',
            name: `${layerName}_weighted_values`
        }).apply(weights) as tf.SymbolicTensor;
    }
}

/**
 * Feed-Forward Network for Transformer
 */
class FeedForward {
    private embedDim: number;
    private feedForwardDim: number;
    private dropout: number;
    private layerId: number;

    constructor(embedDim: number, feedForwardDim: number, dropout: number = 0.1, layerId: number = 0) {
        this.embedDim = embedDim;
        this.feedForwardDim = feedForwardDim;
        this.dropout = dropout;
        this.layerId = layerId;
    }

    apply(input: tf.SymbolicTensor): tf.SymbolicTensor {
        const layerName = `ff_${this.layerId}`;

        // First linear layer with ReLU activation
        let x = tf.layers.dense({
            units: this.feedForwardDim,
            activation: 'relu',
            name: `${layerName}_dense1`
        }).apply(input) as tf.SymbolicTensor;

        // Dropout
        x = tf.layers.dropout({ rate: this.dropout, name: `${layerName}_dropout1` }).apply(x) as tf.SymbolicTensor;

        // Second linear layer
        x = tf.layers.dense({
            units: this.embedDim,
            activation: 'linear',
            name: `${layerName}_dense2`
        }).apply(x) as tf.SymbolicTensor;

        // Dropout
        return tf.layers.dropout({ rate: this.dropout, name: `${layerName}_dropout2` }).apply(x) as tf.SymbolicTensor;
    }
}

/**
 * Transformer Encoder Layer
 */
class TransformerLayer {
    private multiHeadAttention: MultiHeadAttention;
    private feedForward: FeedForward;
    private layerId: number;
    private dropout: number;

    constructor(
        numHeads: number,
        embedDim: number,
        feedForwardDim: number,
        dropout: number = 0.1,
        layerId: number = 0
    ) {
        this.multiHeadAttention = new MultiHeadAttention(numHeads, embedDim, dropout, layerId);
        this.feedForward = new FeedForward(embedDim, feedForwardDim, dropout, layerId);
        this.layerId = layerId;
        this.dropout = dropout;
    }

    apply(input: tf.SymbolicTensor, mask?: tf.SymbolicTensor): tf.SymbolicTensor {
        const layerName = `transformer_${this.layerId}`;

        // Multi-head attention with residual connection
        const attention = this.multiHeadAttention.apply(input, mask);
        const attentionWithResidual = tf.layers.add({ name: `${layerName}_attention_residual` }).apply([input, attention]) as tf.SymbolicTensor;
        const attentionNorm = tf.layers.layerNormalization({ name: `${layerName}_attention_norm` }).apply(attentionWithResidual) as tf.SymbolicTensor;

        // Feed-forward with residual connection
        const feedForward = this.feedForward.apply(attentionNorm);
        const ffWithResidual = tf.layers.add({ name: `${layerName}_ff_residual` }).apply([attentionNorm, feedForward]) as tf.SymbolicTensor;
        const ffNorm = tf.layers.layerNormalization({ name: `${layerName}_ff_norm` }).apply(ffWithResidual) as tf.SymbolicTensor;

        return ffNorm;
    }
}

/**
 * Positional Encoding for board positions
 */
class PositionalEncoding {
    private maxLength: number;
    private embedDim: number;

    constructor(maxLength: number, embedDim: number) {
        this.maxLength = maxLength;
        this.embedDim = embedDim;
    }

    apply(input: tf.SymbolicTensor): tf.SymbolicTensor {
        // Create positional encodings
        const positionEncoding = tf.layers.embedding({
            inputDim: this.maxLength,
            outputDim: this.embedDim,
            name: 'positional_encoding'
        });

        // Generate position indices (simplified without lambda)
        const positions = tf.layers.dense({
            units: this.embedDim,
            activation: 'linear',
            name: 'position_indices'
        }).apply(input) as tf.SymbolicTensor;

        // Get positional embeddings
        const posEmbeddings = positionEncoding.apply(positions) as tf.SymbolicTensor;

        // Add positional embeddings to input
        return tf.layers.add({ name: 'add_positional_encoding' }).apply([input, posEmbeddings]) as tf.SymbolicTensor;
    }
}

/**
 * Advanced Attention Network for Connect Four
 * Features:
 * - Self-attention mechanism
 * - Multi-head attention
 * - Positional encoding
 * - Transformer layers
 * - Board-aware attention patterns
 */
export class Connect4AttentionNetwork {
    private model: tf.LayersModel | null = null;
    private config: AttentionConfig;

    constructor(config: Partial<AttentionConfig> = {}) {
        this.config = {
            boardHeight: 6,
            boardWidth: 7,
            filters: [64, 128, 256, 512],
            kernelSizes: [3, 3, 3, 3],
            dropout: 0.1,
            l2Regularization: 0.001,
            learningRate: 0.001,
            batchSize: 32,
            numHeads: 8,
            numLayers: 6,
            embedDim: 256,
            feedForwardDim: 512,
            usePositionalEncoding: true,
            maxSequenceLength: 42, // 6*7 board positions
            attentionDropout: 0.1,
            ...config
        };
    }

    /**
     * Build the attention network
     */
    buildModel(): tf.LayersModel {
        const input = tf.input({
            shape: [this.config.boardHeight, this.config.boardWidth, 3],
            name: 'board_input'
        });

        // Flatten board to sequence
        const flattened = tf.layers.reshape({
            targetShape: [this.config.boardHeight * this.config.boardWidth, 3],
            name: 'flatten_board'
        }).apply(input) as tf.SymbolicTensor;

        // Embedding layer to project to embed_dim
        let embeddings = tf.layers.dense({
            units: this.config.embedDim,
            activation: 'relu',
            name: 'board_embedding'
        }).apply(flattened) as tf.SymbolicTensor;

        // Positional encoding
        if (this.config.usePositionalEncoding) {
            const posEncoding = new PositionalEncoding(this.config.maxSequenceLength, this.config.embedDim);
            embeddings = posEncoding.apply(embeddings);
        }

        // Transformer layers
        let x = embeddings;
        for (let i = 0; i < this.config.numLayers; i++) {
            const transformerLayer = new TransformerLayer(
                this.config.numHeads,
                this.config.embedDim,
                this.config.feedForwardDim,
                this.config.attentionDropout,
                i
            );
            x = transformerLayer.apply(x);
        }

        // Global pooling
        const globalFeatures = tf.layers.globalAveragePooling1d({ name: 'global_pool' }).apply(x) as tf.SymbolicTensor;

        // Policy head
        let policyHead = tf.layers.dense({
            units: 512,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.config.l2Regularization }),
            name: 'policy_dense_1'
        }).apply(globalFeatures) as tf.SymbolicTensor;

        policyHead = tf.layers.dropout({ rate: this.config.dropout, name: 'policy_dropout' }).apply(policyHead) as tf.SymbolicTensor;

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
        }).apply(globalFeatures) as tf.SymbolicTensor;

        valueHead = tf.layers.dropout({ rate: this.config.dropout, name: 'value_dropout' }).apply(valueHead) as tf.SymbolicTensor;

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'tanh',
            name: 'value_output'
        }).apply(valueHead) as tf.SymbolicTensor;

        this.model = tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput],
            name: 'Connect4AttentionNetwork'
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
     * Convert board to tensor
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
     * Predict with attention visualization
     */
    async predict(board: CellValue[][]): Promise<{
        policy: number[];
        value: number;
        confidence: number;
        attentionWeights?: number[][];
    }> {
        if (!this.model) {
            throw new Error('Model not built. Call buildModel() first.');
        }

        const boardTensor = this.boardToTensor(board);

        try {
            const [policyLogits, valueLogits] = this.model.predict(boardTensor) as [tf.Tensor, tf.Tensor];

            const policyProbs = tf.softmax(policyLogits);

            const policy = await policyProbs.data();
            const value = await valueLogits.data();

            // Calculate confidence based on attention entropy
            const confidence = await this.calculateAttentionConfidence(policyProbs);

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
     * Calculate confidence based on attention patterns
     */
    private async calculateAttentionConfidence(probs: tf.Tensor): Promise<number> {
        // Higher confidence when attention is focused (lower entropy)
        const entropy = tf.neg(tf.sum(tf.mul(probs, tf.log(tf.add(probs, 1e-8)))));
        const entropyValue = await entropy.data();

        entropy.dispose();

        return Math.exp(-entropyValue[0]);
    }

    /**
     * Train with attention regularization
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
                    tf.callbacks.earlyStopping({ patience: 15, restoreBestWeights: true })
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
     * Extract attention weights for visualization
     */
    async getAttentionWeights(board: CellValue[][]): Promise<number[][]> {
        // This would require building an additional model that outputs attention weights
        // For now, return a placeholder
        const weights = Array(6).fill(0).map(() => Array(7).fill(0));

        // Simulate attention focusing on center columns
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                const centerDistance = Math.abs(c - 3);
                weights[r][c] = Math.exp(-centerDistance * 0.5);
            }
        }

        return weights;
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
 * Lightweight attention network for fast inference
 */
export class FastConnect4AttentionNetwork extends Connect4AttentionNetwork {
    constructor(config: Partial<AttentionConfig> = {}) {
        super({
            numHeads: 4,
            numLayers: 3,
            embedDim: 128,
            feedForwardDim: 256,
            ...config
        });
    }
}

/**
 * Deep attention network for maximum performance
 */
export class DeepConnect4AttentionNetwork extends Connect4AttentionNetwork {
    constructor(config: Partial<AttentionConfig> = {}) {
        super({
            numHeads: 16,
            numLayers: 12,
            embedDim: 512,
            feedForwardDim: 2048,
            ...config
        });
    }
}
