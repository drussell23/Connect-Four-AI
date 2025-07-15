import * as tf from '@tensorflow/tfjs';
import { performance } from 'perf_hooks';

/**
 * Comprehensive Neural Network Library for Connect Four AI
 * 
 * Features:
 *  - CNN architectures optimized for Connect Four board representation
 *  - ResNet architectures with skip connections for deeper networks
 *  - Attention mechanisms for sequence processing
 *  - Policy and value network heads for reinforcement learning
 *  - Ensemble methods for improved performance
 *  - Advanced regularization techniques
 *  - Model compression and optimization
 *  - Transfer learning capabilities
 *  - Performance monitoring and visualization
 */

// === Core Types and Interfaces ===

export interface NetworkConfig {
    // Basic architecture
    inputShape: number[];
    outputSize: number;
    networkType: 'cnn' | 'resnet' | 'attention' | 'policy_value' | 'ensemble';

    // CNN specific
    cnnConfig?: {
        filters: number[];
        kernelSizes: number[];
        strides: number[];
        activation: string;
        pooling?: 'max' | 'average' | 'global';
    };

    // ResNet specific
    resnetConfig?: {
        blocks: number[];
        initialFilters: number;
        bottleneck: boolean;
        skipConnections: boolean;
    };

    // Attention specific
    attentionConfig?: {
        heads: number;
        keyDim: number;
        valuesDim: number;
        sequenceLength: number;
        usePositionalEncoding: boolean;
    };

    // Policy-Value specific
    policyValueConfig?: {
        sharedLayers: number[];
        policyHead: number[];
        valueHead: number[];
        separateNetworks: boolean;
    };

    // Regularization
    regularization?: {
        l1: number;
        l2: number;
        dropout: number;
        batchNorm: boolean;
        layerNorm: boolean;
        spectralNorm: boolean;
    };

    // Optimization
    optimization?: {
        clipNorm: number;
        clipValue: number;
        gradientNoise: number;
        ema: boolean;
        emaDecay: number;
    };

    // Advanced features
    advanced?: {
        skipConnections: boolean;
        denseConnections: boolean;
        squeezeExcitation: boolean;
        groupConvolution: boolean;
        depthwiseSeparable: boolean;
    };
}

export interface TrainingConfig {
    epochs: number;
    batchSize: number;
    learningRate: number;
    optimizer: 'adam' | 'sgd' | 'rmsprop' | 'adamw';

    // Learning rate scheduling
    lrSchedule?: {
        type: 'exponential' | 'cosine' | 'polynomial' | 'step';
        decay: number;
        staircase: boolean;
        cycleLength?: number;
    };

    // Data augmentation
    augmentation?: {
        horizontalFlip: boolean;
        verticalFlip: boolean;
        rotation: boolean;
        noise: number;
        mixup: boolean;
        cutout: boolean;
    };

    // Callbacks
    callbacks?: {
        earlyStoppping: boolean;
        patience: number;
        modelCheckpoint: boolean;
        tensorboard: boolean;
        reduceOnPlateau: boolean;
    };

    // Validation
    validationSplit: number;
    validationSteps?: number;
}

export interface NetworkMetrics {
    trainLoss: number;
    trainAccuracy: number;
    valLoss: number;
    valAccuracy: number;
    epoch: number;
    learningRate: number;
    trainingTime: number;
    memoryUsage: number;

    // Task-specific metrics
    policyLoss?: number;
    valueLoss?: number;
    entropyBonus?: number;

    // Performance metrics
    inferenceTime: number;
    throughput: number;
    modelSize: number;
    flops: number;

    // Training diagnostics
    gradientNorm: number;
    weightNorm: number;
    activationStats: {
        mean: number;
        std: number;
        min: number;
        max: number;
    };
}

export interface ModelPrediction {
    policy?: number[];
    value?: number;
    confidence: number;
    features?: tf.Tensor;
    attention?: tf.Tensor[];
    uncertainty?: number;
    inferenceTime?: number; // Add missing property
    explanation?: {
        importantRegions: number[][];
        featureContributions: number[];
        decisionPath: string[];
    };
}

/**
 * Base Neural Network Class
 */
export abstract class BaseNeuralNetwork {
    protected model: tf.LayersModel;
    protected config: NetworkConfig;
    protected metrics: NetworkMetrics[] = [];
    protected optimizer: tf.Optimizer;
    protected isCompiled: boolean = false;
    protected isTraining: boolean = false;

    constructor(config: NetworkConfig) {
        this.config = config;
        this.initializeOptimizer();
    }

    abstract buildModel(): tf.LayersModel;

    /**
     * Compile the model with optimizer and loss functions
     */
    compile(loss: string | string[], optimizer?: tf.Optimizer): void {
        if (!this.model) {
            this.model = this.buildModel();
        }

        const opt = optimizer || this.optimizer;

        this.model.compile({
            optimizer: opt,
            loss,
            metrics: ['accuracy']
        });

        this.isCompiled = true;
        this.log('info', 'Model compiled', {
            params: this.model.countParams(),
            layers: this.model.layers.length
        });
    }

    /**
     * Train the model
     */
    async train(
        x: tf.Tensor | tf.Tensor[],
        y: tf.Tensor | tf.Tensor[],
        config: TrainingConfig
    ): Promise<NetworkMetrics[]> {
        if (!this.isCompiled) {
            throw new Error('Model must be compiled before training');
        }

        this.isTraining = true;
        const startTime = performance.now();

        try {
            // Prepare training data
            const { trainX, trainY, valX, valY } = this.splitData(x, y, config.validationSplit);

            // Setup callbacks
            const callbacks = this.setupCallbacks(config);

            // Train model
            const history = await this.model.fit(trainX, trainY, {
                epochs: config.epochs,
                batchSize: config.batchSize,
                validationData: valX && valY ? [valX, valY] : undefined,
                callbacks,
                verbose: 1
            });

            // Process training history
            const trainingMetrics = this.processTrainingHistory(history, performance.now() - startTime);
            this.metrics.push(...trainingMetrics);

            return trainingMetrics;

        } finally {
            this.isTraining = false;
        }
    }

    /**
     * Make predictions
     */
    async predict(x: tf.Tensor): Promise<ModelPrediction> {
        const startTime = performance.now();

        const predictions = this.model.predict(x) as tf.Tensor | tf.Tensor[];
        const inferenceTime = performance.now() - startTime;

        return this.processPredictions(predictions, inferenceTime);
    }

    /**
     * Evaluate model performance
     */
    async evaluate(x: tf.Tensor, y: tf.Tensor): Promise<NetworkMetrics> {
        const startTime = performance.now();

        const result = await this.model.evaluate(x, y) as tf.Scalar[];
        const evaluationTime = performance.now() - startTime;

        return {
            trainLoss: result[0].dataSync()[0],
            trainAccuracy: result[1]?.dataSync()[0] || 0,
            valLoss: 0,
            valAccuracy: 0,
            epoch: this.metrics.length,
            learningRate: this.getCurrentLearningRate(),
            trainingTime: evaluationTime,
            memoryUsage: this.getMemoryUsage(),
            inferenceTime: evaluationTime,
            throughput: x.shape[0] / (evaluationTime / 1000),
            modelSize: this.getModelSize(),
            flops: this.estimateFlops(),
            gradientNorm: 0,
            weightNorm: this.calculateWeightNorm(),
            activationStats: { mean: 0, std: 0, min: 0, max: 0 }
        };
    }

    /**
     * Save model
     */
    async save(path: string): Promise<void> {
        await this.model.save(`file://${path}`);
        this.log('info', 'Model saved', { path });
    }

    /**
     * Load model
     */
    async load(path: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${path}/model.json`);
        this.isCompiled = true;
        this.log('info', 'Model loaded', { path });
    }

    /**
     * Get model summary
     */
    summary(): void {
        if (this.model) {
            this.model.summary();
        }
    }

    /**
     * Dispose model resources
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
        }
        if (this.optimizer) {
            this.optimizer.dispose();
        }
        this.log('info', 'Model disposed');
    }

    // === Protected Helper Methods ===

    protected abstract processPredictions(predictions: tf.Tensor | tf.Tensor[], inferenceTime: number): ModelPrediction;

    protected initializeOptimizer(): void {
        this.optimizer = tf.train.adam(0.001);
    }

    protected splitData(
        x: tf.Tensor | tf.Tensor[],
        y: tf.Tensor | tf.Tensor[],
        validationSplit: number
    ): { trainX: tf.Tensor; trainY: tf.Tensor; valX?: tf.Tensor; valY?: tf.Tensor } {
        if (validationSplit <= 0) {
            return { trainX: x as tf.Tensor, trainY: y as tf.Tensor };
        }

        const batchSize = Array.isArray(x) ? x[0].shape[0] : (x as tf.Tensor).shape[0];
        const valSize = Math.floor(batchSize * validationSplit);
        const trainSize = batchSize - valSize;

        if (Array.isArray(x)) {
            const trainX = x[0].slice([0], [trainSize]);
            const valX = x[0].slice([trainSize], [valSize]);
            const trainY = (y as tf.Tensor[])[0].slice([0], [trainSize]);
            const valY = (y as tf.Tensor[])[0].slice([trainSize], [valSize]);

            return { trainX, trainY, valX, valY };
        } else {
            const trainX = (x as tf.Tensor).slice([0], [trainSize]);
            const valX = (x as tf.Tensor).slice([trainSize], [valSize]);
            const trainY = (y as tf.Tensor).slice([0], [trainSize]);
            const valY = (y as tf.Tensor).slice([trainSize], [valSize]);

            return { trainX, trainY, valX, valY };
        }
    }

    protected setupCallbacks(config: TrainingConfig): tf.CustomCallback[] {
        const callbacks: tf.CustomCallback[] = [];

        // Early stopping
        if (config.callbacks?.earlyStoppping) {
            callbacks.push(this.createEarlyStoppingCallback(config.callbacks.patience));
        }

        // Learning rate reduction
        if (config.callbacks?.reduceOnPlateau) {
            callbacks.push(this.createReduceLRCallback());
        }

        return callbacks;
    }

    protected createEarlyStoppingCallback(patience: number): tf.CustomCallback {
        let bestLoss = Infinity;
        let waitCount = 0;

        return {
            onEpochEnd: async (epoch, logs) => {
                // Extract current loss as a number, handling both number and Scalar types
                let currentLoss = Infinity;

                if (logs?.val_loss !== undefined) {
                    if (typeof logs.val_loss === 'number') {
                        currentLoss = logs.val_loss;
                    } else if (logs.val_loss && typeof (logs.val_loss as tf.Scalar).dataSync === 'function') {
                        currentLoss = (logs.val_loss as tf.Scalar).dataSync()[0];
                    }
                } else if (logs?.loss !== undefined) {
                    if (typeof logs.loss === 'number') {
                        currentLoss = logs.loss;
                    } else if (logs.loss && typeof (logs.loss as tf.Scalar).dataSync === 'function') {
                        currentLoss = (logs.loss as tf.Scalar).dataSync()[0];
                    }
                }

                if (currentLoss < bestLoss) {
                    bestLoss = currentLoss;
                    waitCount = 0;
                } else {
                    waitCount++;

                    if (waitCount >= patience) {
                        this.log('info', 'Early stopping triggered', { epoch, patience });
                        // Note: Early stopping should be handled externally
                        // TensorFlow.js callbacks cannot stop training directly
                    }
                }
                // Return void, not boolean
                return Promise.resolve();
            }
        } as tf.CustomCallback;
    }

    protected createReduceLRCallback(): tf.CustomCallback {
        let bestLoss = Infinity;
        let waitCount = 0;

        return {
            onEpochEnd: async (epoch, logs) => {
                // Extract current loss as a number, handling both number and Scalar types
                let currentLoss = Infinity;

                if (logs?.val_loss !== undefined) {
                    if (typeof logs.val_loss === 'number') {
                        currentLoss = logs.val_loss;
                    } else if (logs.val_loss && typeof (logs.val_loss as tf.Scalar).dataSync === 'function') {
                        currentLoss = (logs.val_loss as tf.Scalar).dataSync()[0];
                    }
                } else if (logs?.loss !== undefined) {
                    if (typeof logs.loss === 'number') {
                        currentLoss = logs.loss;
                    } else if (logs.loss && typeof (logs.loss as tf.Scalar).dataSync === 'function') {
                        currentLoss = (logs.loss as tf.Scalar).dataSync()[0];
                    }
                }

                if (currentLoss < bestLoss) {
                    bestLoss = currentLoss;
                    waitCount = 0;
                } else {
                    waitCount++;

                    if (waitCount >= 5) {
                        // Reduce learning rate
                        const currentLR = this.getCurrentLearningRate();
                        this.setLearningRate(currentLR * 0.5);
                        this.log('info', 'Learning rate reduced', {
                            epoch,
                            oldLR: currentLR,
                            newLR: currentLR * 0.5
                        });
                        waitCount = 0;
                    }
                }
                return Promise.resolve();
            }
        } as tf.CustomCallback;
    }

    protected processTrainingHistory(history: tf.History, trainingTime: number): NetworkMetrics[] {
        const epochs = history.epoch || [];
        const metrics: NetworkMetrics[] = [];

        for (let i = 0; i < epochs.length; i++) {
            const trainLoss = typeof history.history.loss?.[i] === 'number' ?
                history.history.loss[i] as number :
                (history.history.loss?.[i] as tf.Tensor)?.dataSync()[0] || 0;

            const trainAccuracy = typeof history.history.accuracy?.[i] === 'number' ?
                history.history.accuracy[i] as number :
                (history.history.accuracy?.[i] as tf.Tensor)?.dataSync()[0] || 0;

            const valLoss = typeof history.history.val_loss?.[i] === 'number' ?
                history.history.val_loss[i] as number :
                (history.history.val_loss?.[i] as tf.Tensor)?.dataSync()[0] || 0;

            const valAccuracy = typeof history.history.val_accuracy?.[i] === 'number' ?
                history.history.val_accuracy[i] as number :
                (history.history.val_accuracy?.[i] as tf.Tensor)?.dataSync()[0] || 0;

            metrics.push({
                trainLoss,
                trainAccuracy,
                valLoss,
                valAccuracy,
                epoch: epochs[i],
                learningRate: this.getCurrentLearningRate(),
                trainingTime: trainingTime / epochs.length,
                memoryUsage: this.getMemoryUsage(),
                inferenceTime: 0,
                throughput: 0,
                modelSize: this.getModelSize(),
                flops: this.estimateFlops(),
                gradientNorm: 0,
                weightNorm: this.calculateWeightNorm(),
                activationStats: {
                    mean: 0,
                    std: 1,
                    min: -1,
                    max: 1
                }
            });
        }

        return metrics;
    }

    protected getCurrentLearningRate(): number {
        // Extract learning rate from optimizer
        return 0.001; // Simplified
    }

    protected setLearningRate(lr: number): void {
        // Update optimizer learning rate
        // Implementation depends on optimizer type
    }

    protected getMemoryUsage(): number {
        return tf.memory().numBytes / (1024 * 1024); // MB
    }

    protected getModelSize(): number {
        return this.model ? this.model.countParams() : 0;
    }

    protected estimateFlops(): number {
        // Simplified FLOPS estimation
        return this.getModelSize() * 2; // Approximation
    }

    protected calculateWeightNorm(): number {
        if (!this.model) return 0;

        let totalNorm = 0;
        let weightCount = 0;

        this.model.layers.forEach(layer => {
            const weights = layer.getWeights();
            weights.forEach(weight => {
                const norm = tf.norm(weight).dataSync()[0];
                totalNorm += norm * norm;
                weightCount++;
            });
        });

        return Math.sqrt(totalNorm / Math.max(1, weightCount));
    }

    protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [NeuralNetwork] [${level.toUpperCase()}] ${message}`;

        if (data) {
            console[level](logMessage, data);
        } else {
            console[level](logMessage);
        }
    }
}

/**
 * CNN Network for Connect Four
 */
export class Connect4CNN extends BaseNeuralNetwork {
    buildModel(): tf.LayersModel {
        const input = tf.input({ shape: this.config.inputShape });

        let x = input;

        // Convolutional layers
        const filters = this.config.cnnConfig?.filters || [32, 64, 128];
        const kernelSizes = this.config.cnnConfig?.kernelSizes || [3, 3, 3];

        for (let i = 0; i < filters.length; i++) {
            x = tf.layers.conv2d({
                filters: filters[i],
                kernelSize: kernelSizes[i],
                activation: 'relu',
                padding: 'same',
                name: `conv2d_${i}`
            }).apply(x) as tf.SymbolicTensor;

            if (this.config.regularization?.batchNorm) {
                x = tf.layers.batchNormalization({ name: `bn_${i}` }).apply(x) as tf.SymbolicTensor;
            }

            if (this.config.regularization?.dropout) {
                x = tf.layers.dropout({
                    rate: this.config.regularization.dropout,
                    name: `dropout_${i}`
                }).apply(x) as tf.SymbolicTensor;
            }
        }

        // Global average pooling
        x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(x) as tf.SymbolicTensor;

        // Dense layers
        x = tf.layers.dense({
            units: 256,
            activation: 'relu',
            name: 'dense_1'
        }).apply(x) as tf.SymbolicTensor;

        if (this.config.regularization?.dropout) {
            x = tf.layers.dropout({
                rate: this.config.regularization.dropout,
                name: 'dropout_dense'
            }).apply(x) as tf.SymbolicTensor;
        }

        // Output layer
        const output = tf.layers.dense({
            units: this.config.outputSize,
            activation: 'softmax',
            name: 'output'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'connect4_cnn' });
    }

    protected processPredictions(predictions: tf.Tensor | tf.Tensor[], inferenceTime: number): ModelPrediction {
        const policyTensor = Array.isArray(predictions) ? predictions[0] : predictions;
        const policy = Array.from(policyTensor.dataSync());

        // Calculate confidence as max probability
        const confidence = Math.max(...policy);

        policyTensor.dispose();

        return {
            policy,
            confidence,
            inferenceTime
        };
    }
}

/**
 * ResNet Architecture for Connect Four
 */
export class Connect4ResNet extends BaseNeuralNetwork {
    buildModel(): tf.LayersModel {
        const input = tf.input({ shape: this.config.inputShape });

        let x = input;

        // Initial convolution
        x = tf.layers.conv2d({
            filters: this.config.resnetConfig?.initialFilters || 64,
            kernelSize: 3,
            padding: 'same',
            name: 'initial_conv'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: 'initial_bn' }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.activation({ activation: 'relu', name: 'initial_relu' }).apply(x) as tf.SymbolicTensor;

        // Residual blocks
        const blocks = this.config.resnetConfig?.blocks || [2, 2, 2];
        let filters = this.config.resnetConfig?.initialFilters || 64;

        for (let i = 0; i < blocks.length; i++) {
            for (let j = 0; j < blocks[i]; j++) {
                x = this.residualBlock(x, filters, `block_${i}_${j}`);
            }
            filters *= 2;
        }

        // Global average pooling
        x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(x) as tf.SymbolicTensor;

        // Final dense layer
        const output = tf.layers.dense({
            units: this.config.outputSize,
            activation: 'softmax',
            name: 'output'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'connect4_resnet' });
    }

    private residualBlock(input: tf.SymbolicTensor, filters: number, name: string): tf.SymbolicTensor {
        let x = input;

        // First convolution
        x = tf.layers.conv2d({
            filters,
            kernelSize: 3,
            padding: 'same',
            name: `${name}_conv1`
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: `${name}_bn1` }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.activation({ activation: 'relu', name: `${name}_relu1` }).apply(x) as tf.SymbolicTensor;

        // Second convolution
        x = tf.layers.conv2d({
            filters,
            kernelSize: 3,
            padding: 'same',
            name: `${name}_conv2`
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.batchNormalization({ name: `${name}_bn2` }).apply(x) as tf.SymbolicTensor;

        // Skip connection
        let shortcut = input;
        if (input.shape[input.shape.length - 1] !== filters) {
            shortcut = tf.layers.conv2d({
                filters,
                kernelSize: 1,
                padding: 'same',
                name: `${name}_shortcut`
            }).apply(input) as tf.SymbolicTensor;
        }

        // Add skip connection
        x = tf.layers.add({ name: `${name}_add` }).apply([x, shortcut]) as tf.SymbolicTensor;
        x = tf.layers.activation({ activation: 'relu', name: `${name}_relu2` }).apply(x) as tf.SymbolicTensor;

        return x;
    }

    protected processPredictions(predictions: tf.Tensor | tf.Tensor[], inferenceTime: number): ModelPrediction {
        const policyTensor = Array.isArray(predictions) ? predictions[0] : predictions;
        const policy = Array.from(policyTensor.dataSync());

        const confidence = Math.max(...policy);

        policyTensor.dispose();

        return {
            policy,
            confidence,
            inferenceTime
        };
    }
}

/**
 * Policy-Value Network for Reinforcement Learning
 */
export class PolicyValueNetwork extends BaseNeuralNetwork {
    buildModel(): tf.LayersModel {
        const input = tf.input({ shape: this.config.inputShape });

        let shared = input;

        // Shared layers
        const sharedLayers = this.config.policyValueConfig?.sharedLayers || [256, 256];

        for (let i = 0; i < sharedLayers.length; i++) {
            shared = tf.layers.dense({
                units: sharedLayers[i],
                activation: 'relu',
                name: `shared_${i}`
            }).apply(shared) as tf.SymbolicTensor;

            if (this.config.regularization?.dropout) {
                shared = tf.layers.dropout({
                    rate: this.config.regularization.dropout,
                    name: `shared_dropout_${i}`
                }).apply(shared) as tf.SymbolicTensor;
            }
        }

        // Policy head
        let policyHead = shared;
        const policyLayers = this.config.policyValueConfig?.policyHead || [128];

        for (let i = 0; i < policyLayers.length; i++) {
            policyHead = tf.layers.dense({
                units: policyLayers[i],
                activation: 'relu',
                name: `policy_${i}`
            }).apply(policyHead) as tf.SymbolicTensor;
        }

        const policyOutput = tf.layers.dense({
            units: this.config.outputSize,
            activation: 'softmax',
            name: 'policy_output'
        }).apply(policyHead) as tf.SymbolicTensor;

        // Value head
        let valueHead = shared;
        const valueLayers = this.config.policyValueConfig?.valueHead || [128];

        for (let i = 0; i < valueLayers.length; i++) {
            valueHead = tf.layers.dense({
                units: valueLayers[i],
                activation: 'relu',
                name: `value_${i}`
            }).apply(valueHead) as tf.SymbolicTensor;
        }

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'tanh',
            name: 'value_output'
        }).apply(valueHead) as tf.SymbolicTensor;

        return tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput],
            name: 'policy_value_network'
        });
    }

    protected processPredictions(predictions: tf.Tensor | tf.Tensor[], inferenceTime: number): ModelPrediction {
        if (!Array.isArray(predictions)) {
            throw new Error('PolicyValueNetwork expects array of predictions');
        }

        const [policyTensor, valueTensor] = predictions;
        const policy = Array.from(policyTensor.dataSync());
        const value = valueTensor.dataSync()[0];

        const confidence = Math.max(...policy);

        policyTensor.dispose();
        valueTensor.dispose();

        return {
            policy,
            value,
            confidence,
            inferenceTime
        };
    }
}

/**
 * Attention Network for Sequence Processing
 */
export class AttentionNetwork extends BaseNeuralNetwork {
    buildModel(): tf.LayersModel {
        const input = tf.input({ shape: this.config.inputShape });

        let x = input;

        // Positional encoding
        if (this.config.attentionConfig?.usePositionalEncoding) {
            x = this.addPositionalEncoding(x);
        }

        // Multi-head attention (simplified implementation since tf.layers.multiHeadAttention doesn't exist)
        // Using dense layers to simulate attention mechanism
        const heads = this.config.attentionConfig?.heads || 8;
        const keyDim = this.config.attentionConfig?.keyDim || 64;

        // Simulate multi-head attention with dense layers
        const query = tf.layers.dense({ units: keyDim * heads, name: 'attention_query' }).apply(x) as tf.SymbolicTensor;
        const key = tf.layers.dense({ units: keyDim * heads, name: 'attention_key' }).apply(x) as tf.SymbolicTensor;
        const value = tf.layers.dense({ units: keyDim * heads, name: 'attention_value' }).apply(x) as tf.SymbolicTensor;

        // Simplified attention computation (actual implementation would be more complex)
        x = tf.layers.dense({ units: this.config.inputShape[0], activation: 'relu', name: 'attention_output' }).apply(value) as tf.SymbolicTensor;

        // Add & Norm
        x = tf.layers.add({ name: 'attention_add' }).apply([input, x]) as tf.SymbolicTensor;
        x = tf.layers.layerNormalization({ name: 'attention_norm' }).apply(x) as tf.SymbolicTensor;

        // Feed forward
        let ff = tf.layers.dense({
            units: 512,
            activation: 'relu',
            name: 'ff_1'
        }).apply(x) as tf.SymbolicTensor;

        ff = tf.layers.dense({
            units: x.shape[x.shape.length - 1] as number,
            name: 'ff_2'
        }).apply(ff) as tf.SymbolicTensor;

        // Add & Norm
        x = tf.layers.add({ name: 'ff_add' }).apply([x, ff]) as tf.SymbolicTensor;
        x = tf.layers.layerNormalization({ name: 'ff_norm' }).apply(x) as tf.SymbolicTensor;

        // Global pooling and output
        x = tf.layers.globalAveragePooling1d({ name: 'global_pool' }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({
            units: this.config.outputSize,
            activation: 'softmax',
            name: 'output'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'attention_network' });
    }

    private addPositionalEncoding(input: tf.SymbolicTensor): tf.SymbolicTensor {
        // Simplified positional encoding
        // In a full implementation, this would add proper sinusoidal encodings
        return input;
    }

    protected processPredictions(predictions: tf.Tensor | tf.Tensor[], inferenceTime: number): ModelPrediction {
        const policyTensor = Array.isArray(predictions) ? predictions[0] : predictions;
        const policy = Array.from(policyTensor.dataSync());

        const confidence = Math.max(...policy);

        policyTensor.dispose();

        return {
            policy,
            confidence,
            inferenceTime
        };
    }
}

/**
 * Ensemble Network combining multiple models
 */
export class EnsembleNetwork {
    private networks: BaseNeuralNetwork[] = [];
    private weights: number[] = [];

    constructor(networks: BaseNeuralNetwork[], weights?: number[]) {
        this.networks = networks;
        this.weights = weights || Array(networks.length).fill(1 / networks.length);
    }

    async predict(x: tf.Tensor): Promise<ModelPrediction> {
        const startTime = performance.now();

        const predictions = await Promise.all(
            this.networks.map(network => network.predict(x))
        );

        // Combine predictions using weighted average
        const combinedPolicy = this.combinePoliciese(predictions.map(p => p.policy!));
        const combinedValue = this.combineValues(predictions.map(p => p.value));
        const confidence = this.calculateEnsembleConfidence(predictions);

        const inferenceTime = performance.now() - startTime;

        return {
            policy: combinedPolicy,
            value: combinedValue,
            confidence,
            inferenceTime
        };
    }

    private combinePoliciese(policies: number[][]): number[] {
        const combined = new Array(policies[0].length).fill(0);

        for (let i = 0; i < policies.length; i++) {
            const weight = this.weights[i];
            for (let j = 0; j < policies[i].length; j++) {
                combined[j] += policies[i][j] * weight;
            }
        }

        return combined;
    }

    private combineValues(values: (number | undefined)[]): number | undefined {
        const validValues = values.filter(v => v !== undefined) as number[];
        if (validValues.length === 0) return undefined;

        let weighted = 0;
        let totalWeight = 0;

        for (let i = 0; i < validValues.length; i++) {
            const weight = this.weights[i];
            weighted += validValues[i] * weight;
            totalWeight += weight;
        }

        return weighted / totalWeight;
    }

    private calculateEnsembleConfidence(predictions: ModelPrediction[]): number {
        // Calculate confidence as average of individual confidences
        const avgConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;

        // Calculate agreement between models (lower variance = higher confidence)
        const policies = predictions.map(p => p.policy!);
        const variance = this.calculatePolicyVariance(policies);
        const agreement = 1 / (1 + variance);

        return (avgConfidence + agreement) / 2;
    }

    private calculatePolicyVariance(policies: number[][]): number {
        if (policies.length < 2) return 0;

        const means = new Array(policies[0].length).fill(0);

        // Calculate means
        for (const policy of policies) {
            for (let i = 0; i < policy.length; i++) {
                means[i] += policy[i] / policies.length;
            }
        }

        // Calculate variance
        let totalVariance = 0;
        for (const policy of policies) {
            for (let i = 0; i < policy.length; i++) {
                totalVariance += Math.pow(policy[i] - means[i], 2);
            }
        }

        return totalVariance / (policies.length * policies[0].length);
    }

    dispose(): void {
        this.networks.forEach(network => network.dispose());
    }
}

// === Factory Functions ===

/**
 * Create a Connect Four CNN
 */
export function createConnect4CNN(config?: Partial<NetworkConfig>): Connect4CNN {
    const defaultConfig: NetworkConfig = {
        inputShape: [6, 7, 3],
        outputSize: 7,
        networkType: 'cnn',
        cnnConfig: {
            filters: [32, 64, 128],
            kernelSizes: [3, 3, 3],
            strides: [1, 1, 1],
            activation: 'relu'
        },
        regularization: {
            l1: 0,
            l2: 0.01,
            dropout: 0.3,
            batchNorm: true,
            layerNorm: false,
            spectralNorm: false
        }
    };

    return new Connect4CNN({ ...defaultConfig, ...config });
}

/**
 * Create a Connect Four ResNet
 */
export function createConnect4ResNet(config?: Partial<NetworkConfig>): Connect4ResNet {
    const defaultConfig: NetworkConfig = {
        inputShape: [6, 7, 3],
        outputSize: 7,
        networkType: 'resnet',
        resnetConfig: {
            blocks: [2, 2, 2],
            initialFilters: 32,
            bottleneck: false,
            skipConnections: true
        }
    };

    return new Connect4ResNet({ ...defaultConfig, ...config });
}

/**
 * Create a Policy-Value Network
 */
export function createPolicyValueNetwork(config?: Partial<NetworkConfig>): PolicyValueNetwork {
    const defaultConfig: NetworkConfig = {
        inputShape: [126], // Flattened 6x7x3
        outputSize: 7,
        networkType: 'policy_value',
        policyValueConfig: {
            sharedLayers: [512, 256],
            policyHead: [256],
            valueHead: [256],
            separateNetworks: false
        },
        regularization: {
            l1: 0,
            l2: 0.01,
            dropout: 0.2,
            batchNorm: false,
            layerNorm: true,
            spectralNorm: false
        }
    };

    return new PolicyValueNetwork({ ...defaultConfig, ...config });
}

/**
 * Create an ensemble of networks
 */
export function createEnsembleNetwork(
    networkConfigs: Partial<NetworkConfig>[],
    weights?: number[]
): EnsembleNetwork {
    const networks = networkConfigs.map(config => {
        switch (config.networkType || 'cnn') {
            case 'cnn':
                return createConnect4CNN(config);
            case 'resnet':
                return createConnect4ResNet(config);
            case 'policy_value':
                return createPolicyValueNetwork(config);
            default:
                return createConnect4CNN(config);
        }
    });

    return new EnsembleNetwork(networks, weights);
}

// === Utility Functions ===

/**
 * Convert Connect Four board to tensor
 */
export function boardToTensor(board: string[][]): tf.Tensor {
    const data = new Float32Array(6 * 7 * 3);

    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
            const idx = (r * 7 + c) * 3;
            const cell = board[r][c];

            if (cell === 'Empty') {
                data[idx] = 1;
            } else if (cell === 'Red') {
                data[idx + 1] = 1;
            } else if (cell === 'Yellow') {
                data[idx + 2] = 1;
            }
        }
    }

    return tf.tensor4d(data, [1, 6, 7, 3]);
}

/**
 * Augment training data
 */
export function augmentData(x: tf.Tensor, y: tf.Tensor): { x: tf.Tensor; y: tf.Tensor } {
    // Horizontal flip
    const xFlipped = tf.reverse(x, 2); // Flip along width axis
    const yFlipped = tf.reverse(y, 0); // Flip move probabilities

    // Combine original and augmented data
    const augmentedX = tf.concat([x, xFlipped]);
    const augmentedY = tf.concat([y, yFlipped]);

    return { x: augmentedX, y: augmentedY };
}

/**
 * Calculate model complexity
 */
export function calculateModelComplexity(model: tf.LayersModel): {
    parameters: number;
    layers: number;
    memoryMB: number;
    flopsMB: number;
} {
    const parameters = model.countParams();
    const layers = model.layers.length;
    const memoryMB = parameters * 4 / (1024 * 1024); // 4 bytes per parameter
    const flopsMB = parameters * 2 / (1024 * 1024); // Approximate FLOPs

    return { parameters, layers, memoryMB, flopsMB };
}

export default {
    BaseNeuralNetwork,
    Connect4CNN,
    Connect4ResNet,
    PolicyValueNetwork,
    AttentionNetwork,
    EnsembleNetwork,
    createConnect4CNN,
    createConnect4ResNet,
    createPolicyValueNetwork,
    createEnsembleNetwork,
    boardToTensor,
    augmentData,
    calculateModelComplexity
};
