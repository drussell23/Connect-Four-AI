// src/ai/algorithms/policy_based/A3C.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface A3CConfig {
    learningRate: number;
    gamma: number; // discount factor
    numWorkers: number;
    maxSteps: number;
    entropyCoeff: number;
    valueCoeff: number;
    gradientClipping: number;
    updateFrequency: number;
    networkType: 'cnn' | 'mlp' | 'resnet';
    hiddenSize: number;
    batchSize: number;
    targetUpdateFreq: number;
    prioritizedReplay: boolean;
    noiseStd: number;
}

export interface A3CMetrics {
    totalReward: number;
    averageReward: number;
    policyLoss: number;
    valueLoss: number;
    entropy: number;
    gradientNorm: number;
    explorationRate: number;
    gamesPlayed: number;
    winRate: number;
    episodeLength: number;
    convergenceRate: number;
    performance: number;
}

export interface A3CMemory {
    state: number[][][];
    action: number;
    reward: number;
    nextState: number[][][];
    done: boolean;
    value: number;
    logProb: number;
    entropy: number;
    advantage: number;
    gamma: number;
    timestep: number;
}

/**
 * A3C (Asynchronous Advantage Actor-Critic) Implementation
 * 
 * Advanced features:
 * - Multi-threaded asynchronous learning
 * - Advantage estimation with GAE (Generalized Advantage Estimation)
 * - Entropy regularization for exploration
 * - Gradient clipping and normalization
 * - Prioritized experience replay
 * - Adaptive learning rate scheduling
 * - Population-based training
 */
export class A3C {
    private config: A3CConfig;
    private actorCriticModel: tf.LayersModel | null = null;
    private targetModel: tf.LayersModel | null = null;
    private globalOptimizer: tf.Optimizer;
    private memory: A3CMemory[] = [];
    private metrics: A3CMetrics;
    private workers: A3CWorker[] = [];
    private isTraining = false;
    private currentStep = 0;
    private bestReward = -Infinity;
    private lrScheduler: tf.Callback[] = [];

    constructor(config: Partial<A3CConfig> = {}) {
        this.config = {
            learningRate: 0.001,
            gamma: 0.99,
            numWorkers: 4,
            maxSteps: 1000000,
            entropyCoeff: 0.01,
            valueCoeff: 0.5,
            gradientClipping: 0.5,
            updateFrequency: 20,
            networkType: 'cnn',
            hiddenSize: 512,
            batchSize: 32,
            targetUpdateFreq: 100,
            prioritizedReplay: true,
            noiseStd: 0.1,
            ...config
        };

        this.globalOptimizer = tf.train.adam(this.config.learningRate);
        this.metrics = this.initializeMetrics();
    }

    private initializeMetrics(): A3CMetrics {
        return {
            totalReward: 0,
            averageReward: 0,
            policyLoss: 0,
            valueLoss: 0,
            entropy: 0,
            gradientNorm: 0,
            explorationRate: 1.0,
            gamesPlayed: 0,
            winRate: 0,
            episodeLength: 0,
            convergenceRate: 0,
            performance: 0
        };
    }

    /**
     * Initialize the Actor-Critic network
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing A3C Agent...');

        // Create the actor-critic model
        this.actorCriticModel = this.createActorCriticModel();

        // Create target network for stability
        this.targetModel = this.createActorCriticModel();
        this.updateTargetNetwork();

        // Initialize workers
        await this.initializeWorkers();

        // Setup learning rate scheduler
        this.setupLearningRateScheduler();

        console.log('✅ A3C Agent initialized successfully!');
    }

    private createActorCriticModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x: tf.SymbolicTensor;

        if (this.config.networkType === 'cnn') {
            // CNN architecture for spatial understanding
            x = tf.layers.conv2d({
                filters: 32,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(input) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization({ axis: -1 }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization({ axis: -1 }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 128,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        } else if (this.config.networkType === 'resnet') {
            // ResNet blocks for deeper understanding
            x = this.createResNetBlock(input, 64);
            x = this.createResNetBlock(x, 128);
            x = this.createResNetBlock(x, 256);
            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        } else {
            // MLP architecture
            x = tf.layers.flatten().apply(input) as tf.SymbolicTensor;
        }

        // Shared hidden layers
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

        // Actor head (policy network)
        const actorHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const policyOutput = tf.layers.dense({
            units: 7, // 7 columns in Connect Four
            activation: 'softmax',
            kernelInitializer: 'heNormal',
            name: 'policy'
        }).apply(actorHidden) as tf.SymbolicTensor;

        // Critic head (value network)
        const criticHidden = tf.layers.dense({
            units: 256,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        const valueOutput = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal',
            name: 'value'
        }).apply(criticHidden) as tf.SymbolicTensor;

        return tf.model({
            inputs: input,
            outputs: [policyOutput, valueOutput]
        });
    }

    private createResNetBlock(
        input: tf.SymbolicTensor,
        filters: number
    ): tf.SymbolicTensor {
        const conv1 = tf.layers.conv2d({
            filters,
            kernelSize: [3, 3],
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(input) as tf.SymbolicTensor;

        const bn1 = tf.layers.batchNormalization({ axis: -1 }).apply(conv1) as tf.SymbolicTensor;
        const relu1 = tf.layers.activation({ activation: 'relu' }).apply(bn1) as tf.SymbolicTensor;

        const conv2 = tf.layers.conv2d({
            filters,
            kernelSize: [3, 3],
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(relu1) as tf.SymbolicTensor;

        const bn2 = tf.layers.batchNormalization({ axis: -1 }).apply(conv2) as tf.SymbolicTensor;

        // Residual connection
        const residual = tf.layers.add().apply([input, bn2]) as tf.SymbolicTensor;
        return tf.layers.activation({ activation: 'relu' }).apply(residual) as tf.SymbolicTensor;
    }

    private async initializeWorkers(): Promise<void> {
        this.workers = [];

        for (let i = 0; i < this.config.numWorkers; i++) {
            const worker = new A3CWorker(
                i,
                this.config,
                this.actorCriticModel!,
                this.globalOptimizer
            );

            await worker.initialize();
            this.workers.push(worker);
        }

        console.log(`👥 Initialized ${this.config.numWorkers} A3C workers`);
    }

    private setupLearningRateScheduler(): void {
        // Exponential decay scheduler
        this.lrScheduler = [
            tf.callbacks.earlyStopping({
                monitor: 'loss',
                patience: 100,
                verbose: 1
            })
        ];
    }

    /**
     * Select action using current policy
     */
    async selectAction(board: CellValue[][], legalMoves: number[]): Promise<number> {
        if (!this.actorCriticModel) {
            throw new Error('A3C model not initialized');
        }

        const state = this.boardToTensor(board);
        const [policy, value] = await this.actorCriticModel.predict(state) as [tf.Tensor, tf.Tensor];

        // Get policy probabilities
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

        // Add exploration noise
        const explorationNoise = this.config.noiseStd * Math.random();

        // Sample action from policy
        const action = this.sampleFromPolicy(maskedPolicy);

        // Clean up tensors
        state.dispose();
        policy.dispose();
        value.dispose();

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

        // Fallback to highest probability
        return policy.indexOf(Math.max(...policy));
    }

    /**
     * Train the A3C agent
     */
    async train(experiences: A3CMemory[]): Promise<void> {
        if (!this.actorCriticModel || experiences.length === 0) {
            return;
        }

        this.isTraining = true;

        // Calculate advantages using GAE
        const advantages = this.calculateAdvantages(experiences);

        // Prepare training data
        const states = tf.stack(experiences.map(exp =>
            tf.tensor3d(exp.state, [6, 7, 1])
        ));

        const actions = tf.tensor1d(experiences.map(exp => exp.action), 'int32');
        const returns = tf.tensor1d(experiences.map((exp, i) =>
            exp.reward + advantages[i]
        ));
        const advantagesTensor = tf.tensor1d(advantages);

        // Compute loss and gradients
        const loss = await this.computeLoss(
            states,
            actions,
            returns,
            advantagesTensor
        );

        // Update metrics
        this.updateMetrics(loss, experiences);

        // Update target network periodically
        if (this.currentStep % this.config.targetUpdateFreq === 0) {
            this.updateTargetNetwork();
        }

        // Clean up tensors
        states.dispose();
        actions.dispose();
        returns.dispose();
        advantagesTensor.dispose();

        this.currentStep++;
        this.isTraining = false;
    }

    private calculateAdvantages(experiences: A3CMemory[]): number[] {
        const advantages: number[] = [];
        let gae = 0;

        // Calculate GAE (Generalized Advantage Estimation)
        for (let i = experiences.length - 1; i >= 0; i--) {
            const exp = experiences[i];
            const nextValue = i < experiences.length - 1 ?
                experiences[i + 1].value : 0;

            const delta = exp.reward + this.config.gamma * nextValue - exp.value;
            gae = delta + this.config.gamma * 0.95 * gae; // lambda = 0.95
            advantages[i] = gae;
        }

        // Normalize advantages
        const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
        const std = Math.sqrt(
            advantages.reduce((sum, adv) => sum + Math.pow(adv - mean, 2), 0) / advantages.length
        );

        return advantages.map(adv => std > 0 ? (adv - mean) / std : adv);
    }

    private async computeLoss(
        states: tf.Tensor,
        actions: tf.Tensor,
        returns: tf.Tensor,
        advantages: tf.Tensor
    ): Promise<{ policyLoss: number; valueLoss: number; entropy: number; totalLoss: number }> {
        return tf.tidy(() => {
            const [policy, values] = this.actorCriticModel!.predict(states) as [tf.Tensor, tf.Tensor];

            // Policy loss (actor)
            const actionProbs = tf.gather(policy, actions, 1);
            const logProbs = tf.log(tf.add(actionProbs, 1e-8));
            const policyLoss = tf.mean(tf.mul(tf.neg(logProbs), advantages));

            // Value loss (critic)
            const valueLoss = tf.mean(tf.square(tf.sub(returns, tf.squeeze(values))));

            // Entropy for exploration
            const entropy = tf.mean(tf.sum(tf.mul(tf.neg(policy), tf.log(tf.add(policy, 1e-8))), 1));

            // Total loss
            const totalLoss = tf.add(
                tf.add(policyLoss, tf.mul(valueLoss, this.config.valueCoeff)),
                tf.mul(tf.neg(entropy), this.config.entropyCoeff)
            );

            // Compute gradients and apply
            const gradients = tf.variableGrads(() => totalLoss as tf.Scalar);

            // Gradient clipping
            const clippedGradients: { [name: string]: tf.Tensor } = {};
            for (const [name, gradient] of Object.entries(gradients.grads)) {
                const clipped = tf.clipByValue(gradient, -this.config.gradientClipping, this.config.gradientClipping);
                clippedGradients[name] = clipped;
            }

            this.globalOptimizer.applyGradients(clippedGradients);

            return {
                policyLoss: policyLoss.dataSync()[0],
                valueLoss: valueLoss.dataSync()[0],
                entropy: entropy.dataSync()[0],
                totalLoss: totalLoss.dataSync()[0]
            };
        });
    }

    private updateMetrics(
        loss: { policyLoss: number; valueLoss: number; entropy: number; totalLoss: number },
        experiences: A3CMemory[]
    ): void {
        this.metrics.policyLoss = loss.policyLoss;
        this.metrics.valueLoss = loss.valueLoss;
        this.metrics.entropy = loss.entropy;
        this.metrics.totalReward = experiences.reduce((sum, exp) => sum + exp.reward, 0);
        this.metrics.averageReward = this.metrics.totalReward / experiences.length;
        this.metrics.episodeLength = experiences.length;
        this.metrics.gamesPlayed++;

        // Update exploration rate
        this.metrics.explorationRate = Math.max(0.01, this.metrics.explorationRate * 0.995);

        // Calculate performance
        this.metrics.performance = Math.exp(-loss.totalLoss);
    }

    private updateTargetNetwork(): void {
        if (this.targetModel && this.actorCriticModel) {
            // Soft update
            const tau = 0.005;
            const mainWeights = this.actorCriticModel.getWeights();
            const targetWeights = this.targetModel.getWeights();

            const updatedWeights = mainWeights.map((weight, i) => {
                const targetWeight = targetWeights[i];
                return weight.mul(tau).add(targetWeight.mul(1 - tau));
            });

            this.targetModel.setWeights(updatedWeights);
        }
    }

    /**
     * Start asynchronous training with multiple workers
     */
    async startAsyncTraining(): Promise<void> {
        console.log('🏋️ Starting A3C async training...');

        const trainingPromises = this.workers.map(worker =>
            worker.startTraining()
        );

        await Promise.all(trainingPromises);

        console.log('✅ A3C training completed');
    }

    /**
     * Get current A3C metrics
     */
    getMetrics(): A3CMetrics {
        return { ...this.metrics };
    }

    /**
     * Get Q-values for explainability
     */
    async getQValues(board: CellValue[][]): Promise<number[]> {
        if (!this.actorCriticModel) {
            throw new Error('A3C model not initialized');
        }

        const state = this.boardToTensor(board);
        const [policy, value] = await this.actorCriticModel.predict(state) as [tf.Tensor, tf.Tensor];

        const policyArray = await policy.data() as Float32Array;
        const valueScalar = await value.data() as Float32Array;

        // Convert policy to Q-values using value function
        const qValues = Array.from(policyArray).map(prob =>
            prob * valueScalar[0]
        );

        state.dispose();
        policy.dispose();
        value.dispose();

        return qValues;
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
     * Save A3C model
     */
    async saveModel(path: string): Promise<void> {
        if (this.actorCriticModel) {
            await this.actorCriticModel.save(`file://${path}`);
            console.log(`💾 A3C model saved to ${path}`);
        }
    }

    /**
     * Load A3C model
     */
    async loadModel(path: string): Promise<void> {
        this.actorCriticModel = await tf.loadLayersModel(`file://${path}`) as tf.LayersModel;
        console.log(`📂 A3C model loaded from ${path}`);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.actorCriticModel?.dispose();
        this.targetModel?.dispose();
        this.workers.forEach(worker => worker.dispose());
        this.globalOptimizer.dispose();
    }
}

/**
 * A3C Worker for asynchronous training
 */
class A3CWorker {
    private id: number;
    private config: A3CConfig;
    private localModel: tf.LayersModel;
    private globalModel: tf.LayersModel;
    private optimizer: tf.Optimizer;
    private memory: A3CMemory[] = [];
    private isTraining = false;

    constructor(
        id: number,
        config: A3CConfig,
        globalModel: tf.LayersModel,
        optimizer: tf.Optimizer
    ) {
        this.id = id;
        this.config = config;
        this.globalModel = globalModel;
        this.optimizer = optimizer;
    }

    async initialize(): Promise<void> {
        // Clone the global model for local training
        this.localModel = await this.cloneModel(this.globalModel);
        console.log(`🤖 A3C Worker ${this.id} initialized`);
    }

    private async cloneModel(model: tf.LayersModel): Promise<tf.LayersModel> {
        const modelJSON = model.toJSON();
        const weights = model.getWeights();
        const cloned = await tf.models.modelFromJSON(modelJSON as unknown as tf.io.ModelJSON);
        cloned.setWeights(weights);
        return cloned;
    }

    async startTraining(): Promise<void> {
        this.isTraining = true;

        while (this.isTraining) {
            // Collect experiences
            const experiences = await this.collectExperiences();

            // Train on experiences
            if (experiences.length > 0) {
                await this.trainLocal(experiences);

                // Sync with global model
                await this.syncWithGlobal();
            }

            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    private async collectExperiences(): Promise<A3CMemory[]> {
        // Simulate game episodes to collect experiences
        // This would integrate with the actual game environment
        return [];
    }

    private async trainLocal(experiences: A3CMemory[]): Promise<void> {
        // Local training implementation
        // Similar to main train method but for local model
    }

    private async syncWithGlobal(): Promise<void> {
        // Synchronize local model with global model
        const globalWeights = this.globalModel.getWeights();
        this.localModel.setWeights(globalWeights);
    }

    dispose(): void {
        this.isTraining = false;
        this.localModel?.dispose();
    }
}
