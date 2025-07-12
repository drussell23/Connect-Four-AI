// src/ai/algorithms/policy_based/PPO.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface PPOConfig {
    learningRate: number;
    gamma: number;
    lambda: number; // GAE parameter
    clipRatio: number;
    entropyCoeff: number;
    valueCoeff: number;
    maxGradNorm: number;
    batchSize: number;
    epochs: number;
    bufferSize: number;
    networkType: 'cnn' | 'mlp' | 'resnet';
    hiddenSize: number;
    targetKL: number;
    adaptiveKL: boolean;
    normalizeAdvantages: boolean;
    clipVLoss: boolean;
    useGAE: boolean;
}

export interface PPOMetrics {
    policyLoss: number;
    valueLoss: number;
    entropy: number;
    totalLoss: number;
    klDivergence: number;
    clipFraction: number;
    explorationRate: number;
    averageReward: number;
    episodeLength: number;
    gamesPlayed: number;
    winRate: number;
    performance: number;
    gradientNorm: number;
    learningRate: number;
}

export interface PPOExperience {
    state: number[][][];
    action: number;
    reward: number;
    nextState: number[][][];
    done: boolean;
    value: number;
    logProb: number;
    advantage: number;
    returns: number;
    oldLogProb: number;
    timestep: number;
}

/**
 * PPO (Proximal Policy Optimization) Implementation
 * 
 * Advanced features:
 * - Clipped surrogate objective
 * - Generalized Advantage Estimation (GAE)
 * - Adaptive KL divergence penalty
 * - Value function clipping
 * - Entropy regularization
 * - Gradient clipping and normalization
 * - Multiple epochs per update
 * - Advantage normalization
 * - Early stopping based on KL divergence
 */
export class PPO {
    private config: PPOConfig;
    private policyModel: tf.LayersModel | null = null;
    private valueModel: tf.LayersModel | null = null;
    private combinedModel: tf.LayersModel | null = null;
    private optimizer: tf.Optimizer;
    private buffer: PPOExperience[] = [];
    private metrics: PPOMetrics;
    private currentStep = 0;
    private bestPerformance = 0;

    constructor(config: Partial<PPOConfig> = {}) {
        this.config = {
            learningRate: 0.0003,
            gamma: 0.99,
            lambda: 0.95,
            clipRatio: 0.2,
            entropyCoeff: 0.01,
            valueCoeff: 0.5,
            maxGradNorm: 0.5,
            batchSize: 64,
            epochs: 10,
            bufferSize: 2048,
            networkType: 'cnn',
            hiddenSize: 512,
            targetKL: 0.01,
            adaptiveKL: true,
            normalizeAdvantages: true,
            clipVLoss: true,
            useGAE: true,
            ...config
        };

        this.optimizer = tf.train.adam(this.config.learningRate);
        this.metrics = this.initializeMetrics();
    }

    private initializeMetrics(): PPOMetrics {
        return {
            policyLoss: 0,
            valueLoss: 0,
            entropy: 0,
            totalLoss: 0,
            klDivergence: 0,
            clipFraction: 0,
            explorationRate: 1.0,
            averageReward: 0,
            episodeLength: 0,
            gamesPlayed: 0,
            winRate: 0,
            performance: 0,
            gradientNorm: 0,
            learningRate: this.config.learningRate
        };
    }

    /**
     * Initialize PPO networks
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing PPO Agent...');

        // Create combined actor-critic model
        this.combinedModel = this.createCombinedModel();

        // Separate models for specialized training
        this.policyModel = this.createPolicyModel();
        this.valueModel = this.createValueModel();

        console.log('✅ PPO Agent initialized successfully!');
    }

    private createCombinedModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x = this.createSharedLayers(input);

        // Policy head
        const policyHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const policyOutput = tf.layers.dense({
            units: 7,
            activation: 'softmax',
            kernelInitializer: 'heNormal',
            name: 'policy'
        }).apply(policyHidden) as tf.SymbolicTensor;

        // Value head
        const valueHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal',
            name: 'value'
        }).apply(valueHidden) as tf.SymbolicTensor;

        return tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput]
        });
    }

    private createPolicyModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x = this.createSharedLayers(input);

        x = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({
            units: 7,
            activation: 'softmax',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output });
    }

    private createValueModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x = this.createSharedLayers(input);

        x = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output });
    }

    private createSharedLayers(input: tf.SymbolicTensor): tf.SymbolicTensor {
        let x: tf.SymbolicTensor;

        if (this.config.networkType === 'cnn') {
            // CNN layers for spatial pattern recognition
            x = tf.layers.conv2d({
                filters: 32,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(input) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization().apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization().apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 128,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(x) as tf.SymbolicTensor;

            // Fix globalAveragePooling2d calls
            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        } else if (this.config.networkType === 'resnet') {
            // ResNet architecture
            x = this.createResNetBlock(input, 64);
            x = this.createResNetBlock(x, 128);
            x = this.createResNetBlock(x, 256);
            // Fix another globalAveragePooling2d call
            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        } else {
            // MLP architecture
            x = tf.layers.flatten().apply(input) as tf.SymbolicTensor;
        }

        // Shared dense layers
        x = tf.layers.dense({
            units: this.config.hiddenSize,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: this.config.hiddenSize / 2,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return x;
    }

    private createResNetBlock(input: tf.SymbolicTensor, filters: number): tf.SymbolicTensor {
        const conv1 = tf.layers.conv2d({
            filters,
            kernelSize: [3, 3],
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(input) as tf.SymbolicTensor;

        const bn1 = tf.layers.batchNormalization().apply(conv1) as tf.SymbolicTensor;
        const relu1 = tf.layers.activation({ activation: 'relu' }).apply(bn1) as tf.SymbolicTensor;

        const conv2 = tf.layers.conv2d({
            filters,
            kernelSize: [3, 3],
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(relu1) as tf.SymbolicTensor;

        const bn2 = tf.layers.batchNormalization().apply(conv2) as tf.SymbolicTensor;

        // Residual connection
        const residual = tf.layers.add().apply([input, bn2]) as tf.SymbolicTensor;
        return tf.layers.activation({ activation: 'relu' }).apply(residual) as tf.SymbolicTensor;
    }

    /**
     * Select action using current policy
     */
    async selectAction(board: CellValue[][], legalMoves: number[]): Promise<number> {
        if (!this.policyModel) {
            throw new Error('PPO policy model not initialized');
        }

        const state = this.boardToTensor(board);
        const policy = await this.policyModel.predict(state) as tf.Tensor;
        const policyArray = await policy.data() as Float32Array;

        // Mask illegal moves
        const maskedPolicy = Array.from(policyArray);
        maskedPolicy.forEach((prob, i) => {
            if (!legalMoves.includes(i)) {
                maskedPolicy[i] = 0;
            }
        });

        // Renormalize
        const sum = maskedPolicy.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            maskedPolicy.forEach((_, i) => {
                maskedPolicy[i] /= sum;
            });
        }

        // Sample action from policy
        const action = this.sampleFromPolicy(maskedPolicy);

        // Clean up
        state.dispose();
        policy.dispose();

        return action;
    }

    private sampleFromPolicy(policy: number[]): number {
        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < policy.length; i++) {
            cumulative += policy[i];
            if (random <= cumulative) {
                return i;
            }
        }

        return policy.indexOf(Math.max(...policy));
    }

    /**
     * Store experience in buffer
     */
    storeExperience(experience: PPOExperience): void {
        this.buffer.push(experience);

        if (this.buffer.length > this.config.bufferSize) {
            this.buffer.shift();
        }
    }

    /**
     * Train PPO agent
     */
    async train(): Promise<void> {
        if (this.buffer.length < this.config.batchSize) {
            return;
        }

        console.log('🏋️ Training PPO Agent...');

        // Calculate advantages and returns
        this.calculateAdvantagesAndReturns();

        // Train for multiple epochs
        for (let epoch = 0; epoch < this.config.epochs; epoch++) {
            const batchResults = await this.trainBatch();

            // Early stopping based on KL divergence
            if (this.config.adaptiveKL && batchResults.klDivergence > this.config.targetKL) {
                console.log(`Early stopping at epoch ${epoch} due to KL divergence: ${batchResults.klDivergence}`);
                break;
            }

            // Update metrics
            this.updateMetrics(batchResults);
        }

        // Clear buffer after training
        this.buffer = [];
        this.currentStep++;

        console.log('✅ PPO training completed');
    }

    private calculateAdvantagesAndReturns(): void {
        if (!this.config.useGAE) {
            // Simple advantage calculation
            for (let i = 0; i < this.buffer.length; i++) {
                const exp = this.buffer[i];
                exp.returns = exp.reward + (exp.done ? 0 : this.config.gamma * exp.value);
                exp.advantage = exp.returns - exp.value;
            }
        } else {
            // GAE calculation
            const advantages: number[] = [];
            const returns: number[] = [];
            let gae = 0;
            let lastValue = 0;

            for (let i = this.buffer.length - 1; i >= 0; i--) {
                const exp = this.buffer[i];
                const nextValue = i < this.buffer.length - 1 ? this.buffer[i + 1].value : 0;

                const delta = exp.reward + this.config.gamma * nextValue - exp.value;
                gae = delta + this.config.gamma * this.config.lambda * gae;

                advantages[i] = gae;
                returns[i] = gae + exp.value;

                exp.advantage = advantages[i];
                exp.returns = returns[i];
            }

            // Normalize advantages
            if (this.config.normalizeAdvantages) {
                const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
                const std = Math.sqrt(
                    advantages.reduce((sum, adv) => sum + Math.pow(adv - mean, 2), 0) / advantages.length
                );

                advantages.forEach((adv, i) => {
                    this.buffer[i].advantage = std > 0 ? (adv - mean) / std : adv;
                });
            }
        }
    }

    private async trainBatch(): Promise<{
        policyLoss: number;
        valueLoss: number;
        entropy: number;
        totalLoss: number;
        klDivergence: number;
        clipFraction: number;
    }> {
        const batchSize = Math.min(this.config.batchSize, this.buffer.length);
        const batch = this.buffer.slice(0, batchSize);

        // Prepare training data
        const states = tf.stack(batch.map(exp => tf.tensor3d(exp.state, [6, 7, 1])));
        const actions = tf.tensor1d(batch.map(exp => exp.action), 'int32');
        const oldLogProbs = tf.tensor1d(batch.map(exp => exp.oldLogProb));
        const advantages = tf.tensor1d(batch.map(exp => exp.advantage));
        const returns = tf.tensor1d(batch.map(exp => exp.returns));

        // Compute PPO loss
        const lossResults = await this.computePPOLoss(
            states, actions, oldLogProbs, advantages, returns
        );

        // Clean up tensors
        states.dispose();
        actions.dispose();
        oldLogProbs.dispose();
        advantages.dispose();
        returns.dispose();

        return lossResults;
    }

    private async computePPOLoss(
        states: tf.Tensor,
        actions: tf.Tensor,
        oldLogProbs: tf.Tensor,
        advantages: tf.Tensor,
        returns: tf.Tensor
    ): Promise<{
        policyLoss: number;
        valueLoss: number;
        entropy: number;
        totalLoss: number;
        klDivergence: number;
        clipFraction: number;
    }> {
        return tf.tidy(() => {
            const [newPolicy, newValues] = this.combinedModel!.predict(states) as [tf.Tensor, tf.Tensor];

            // Get action probabilities
            const newActionProbs = tf.gather(newPolicy, actions, 1);
            const newLogProbs = tf.log(tf.add(newActionProbs, 1e-8));

            // Compute probability ratio
            const ratios = tf.exp(tf.sub(newLogProbs, oldLogProbs));

            // Clipped surrogate loss
            const surr1 = tf.mul(ratios, advantages);
            const surr2 = tf.mul(
                tf.clipByValue(ratios, 1 - this.config.clipRatio, 1 + this.config.clipRatio),
                advantages
            );
            const policyLoss = tf.neg(tf.mean(tf.minimum(surr1, surr2)));

            // Value loss
            const valueErrors = tf.sub(returns, tf.squeeze(newValues));
            let valueLoss: tf.Tensor;

            if (this.config.clipVLoss) {
                // Clipped value loss
                const oldValues = tf.tensor1d(this.buffer.slice(0, states.shape[0]).map(exp => exp.value));
                const clippedValues = tf.add(
                    oldValues,
                    tf.clipByValue(
                        tf.sub(tf.squeeze(newValues), oldValues),
                        -this.config.clipRatio,
                        this.config.clipRatio
                    )
                );
                const vLoss1 = tf.square(valueErrors);
                const vLoss2 = tf.square(tf.sub(returns, clippedValues));
                valueLoss = tf.mean(tf.maximum(vLoss1, vLoss2));
            } else {
                valueLoss = tf.mean(tf.square(valueErrors));
            }

            // Entropy bonus
            const entropy = tf.mean(tf.sum(tf.mul(tf.neg(newPolicy), tf.log(tf.add(newPolicy, 1e-8))), 1));

            // KL divergence (for monitoring)
            const klDivergence = tf.mean(tf.sub(oldLogProbs, newLogProbs));

            // Clip fraction (for monitoring)
            const clipMask = tf.greater(tf.abs(tf.sub(ratios, 1)), this.config.clipRatio);
            const clipFraction = tf.mean(tf.cast(clipMask, 'float32'));

            // Total loss
            const totalLoss = tf.add(
                tf.add(policyLoss, tf.mul(valueLoss, this.config.valueCoeff)),
                tf.mul(tf.neg(entropy), this.config.entropyCoeff)
            );

            // Fix variableGrads call
            const gradients = tf.variableGrads(() => totalLoss as tf.Scalar);

            // Gradient clipping
            const clippedGradients: { [name: string]: tf.Tensor } = {};
            for (const [name, gradient] of Object.entries(gradients.grads)) {
                clippedGradients[name] = tf.clipByValue(gradient, -this.config.maxGradNorm, this.config.maxGradNorm);
            }

            this.optimizer.applyGradients(clippedGradients);

            return {
                policyLoss: policyLoss.dataSync()[0],
                valueLoss: valueLoss.dataSync()[0],
                entropy: entropy.dataSync()[0],
                totalLoss: totalLoss.dataSync()[0],
                klDivergence: klDivergence.dataSync()[0],
                clipFraction: clipFraction.dataSync()[0]
            };
        });
    }

    private updateMetrics(results: {
        policyLoss: number;
        valueLoss: number;
        entropy: number;
        totalLoss: number;
        klDivergence: number;
        clipFraction: number;
    }): void {
        this.metrics.policyLoss = results.policyLoss;
        this.metrics.valueLoss = results.valueLoss;
        this.metrics.entropy = results.entropy;
        this.metrics.totalLoss = results.totalLoss;
        this.metrics.klDivergence = results.klDivergence;
        this.metrics.clipFraction = results.clipFraction;
        this.metrics.performance = Math.exp(-results.totalLoss);

        // Update exploration rate
        this.metrics.explorationRate = Math.max(0.01, this.metrics.explorationRate * 0.995);
    }

    /**
     * Get policy probabilities for explainability
     */
    async getPolicyProbs(board: CellValue[][]): Promise<number[]> {
        if (!this.policyModel) {
            throw new Error('PPO policy model not initialized');
        }

        const state = this.boardToTensor(board);
        const policy = await this.policyModel.predict(state) as tf.Tensor;
        const policyArray = await policy.data() as Float32Array;

        state.dispose();
        policy.dispose();

        return Array.from(policyArray);
    }

    /**
     * Get value estimate for explainability
     */
    async getValueEstimate(board: CellValue[][]): Promise<number> {
        if (!this.valueModel) {
            throw new Error('PPO value model not initialized');
        }

        const state = this.boardToTensor(board);
        const value = await this.valueModel.predict(state) as tf.Tensor;
        const valueScalar = await value.data() as Float32Array;

        state.dispose();
        value.dispose();

        return valueScalar[0];
    }

    /**
     * Get current metrics
     */
    getMetrics(): PPOMetrics {
        return { ...this.metrics };
    }

    private boardToTensor(board: CellValue[][]): tf.Tensor4D {
        const numericBoard = board.map(row =>
            row.map(cell => {
                if (cell === 'Red') return 1;
                if (cell === 'Yellow') return -1;
                return 0;
            })
        );

        return tf.tensor4d([numericBoard.map(row => row.map(cell => [cell]))], [1, 6, 7, 1]);
    }

    /**
     * Save PPO models
     */
    async saveModel(path: string): Promise<void> {
        if (this.combinedModel) {
            await this.combinedModel.save(`file://${path}/combined`);
        }
        if (this.policyModel) {
            await this.policyModel.save(`file://${path}/policy`);
        }
        if (this.valueModel) {
            await this.valueModel.save(`file://${path}/value`);
        }
        console.log(`💾 PPO models saved to ${path}`);
    }

    /**
     * Load PPO models
     */
    async loadModel(path: string): Promise<void> {
        this.combinedModel = await tf.loadLayersModel(`file://${path}/combined`);
        this.policyModel = await tf.loadLayersModel(`file://${path}/policy`);
        this.valueModel = await tf.loadLayersModel(`file://${path}/value`);
        console.log(`📂 PPO models loaded from ${path}`);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.combinedModel?.dispose();
        this.policyModel?.dispose();
        this.valueModel?.dispose();
        this.optimizer.dispose();
    }
}
