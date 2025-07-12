// src/ai/algorithms/multi_agent/QMIX.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface QMIXConfig {
    numAgents: number;
    learningRate: number;
    gamma: number;
    epsilon: number;
    epsilonDecay: number;
    epsilonMin: number;
    bufferSize: number;
    batchSize: number;
    targetUpdateFreq: number;
    mixingEmbedDim: number;
    hypernetHiddenDim: number;
    networkType: 'cnn' | 'mlp';
    hiddenSize: number;
    useDoubleQ: boolean;
    prioritizedReplay: boolean;
}

export interface QMIXMetrics {
    totalLoss: number;
    qValues: number[][];
    mixedQValue: number;
    explorationRate: number;
    averageReward: number;
    gamesPlayed: number;
    winRate: number;
    cooperationScore: number;
    teamworkEfficiency: number;
}

export interface QMIXExperience {
    states: number[][][][]; // [numAgents][6][7][1]
    actions: number[];
    rewards: number[];
    nextStates: number[][][][];
    dones: boolean[];
    globalState: number[][][];
    teamReward: number;
    timestep: number;
}

/**
 * QMIX Implementation for Multi-Agent Value Decomposition
 * 
 * Features:
 * - Individual Q-networks for each agent
 * - Mixing network for team coordination
 * - Hypernetwork for parameter generation
 * - Centralized training with decentralized execution
 * - Monotonic value decomposition
 * - Individual-Global-Max (IGM) property
 */
export class QMIX {
    private config: QMIXConfig;
    private agentNetworks: tf.LayersModel[] = [];
    private targetAgentNetworks: tf.LayersModel[] = [];
    private mixingNetwork: tf.LayersModel | null = null;
    private targetMixingNetwork: tf.LayersModel | null = null;
    private hyperNetwork: tf.LayersModel | null = null;
    private targetHyperNetwork: tf.LayersModel | null = null;
    private optimizer: tf.Optimizer;
    private replayBuffer: QMIXExperience[] = [];
    private metrics: QMIXMetrics;
    private currentStep = 0;

    constructor(config: Partial<QMIXConfig> = {}) {
        this.config = {
            numAgents: 2,
            learningRate: 0.0005,
            gamma: 0.99,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01,
            bufferSize: 10000,
            batchSize: 32,
            targetUpdateFreq: 200,
            mixingEmbedDim: 32,
            hypernetHiddenDim: 64,
            networkType: 'cnn',
            hiddenSize: 256,
            useDoubleQ: true,
            prioritizedReplay: false,
            ...config
        };

        this.optimizer = tf.train.adam(this.config.learningRate);
        this.metrics = this.initializeMetrics();
    }

    private initializeMetrics(): QMIXMetrics {
        return {
            totalLoss: 0,
            qValues: Array(this.config.numAgents).fill(0).map(() => Array(7).fill(0)),
            mixedQValue: 0,
            explorationRate: this.config.epsilon,
            averageReward: 0,
            gamesPlayed: 0,
            winRate: 0,
            cooperationScore: 0,
            teamworkEfficiency: 0
        };
    }

    /**
     * Initialize QMIX networks
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing QMIX Multi-Agent System...');

        // Initialize agent networks
        for (let i = 0; i < this.config.numAgents; i++) {
            const agentNetwork = this.createAgentNetwork();
            const targetAgentNetwork = this.createAgentNetwork();
            this.copyWeights(agentNetwork, targetAgentNetwork);

            this.agentNetworks.push(agentNetwork);
            this.targetAgentNetworks.push(targetAgentNetwork);
        }

        // Initialize mixing network
        this.mixingNetwork = this.createMixingNetwork();
        this.targetMixingNetwork = this.createMixingNetwork();
        this.copyWeights(this.mixingNetwork, this.targetMixingNetwork);

        // Initialize hypernetwork
        this.hyperNetwork = this.createHyperNetwork();
        this.targetHyperNetwork = this.createHyperNetwork();
        this.copyWeights(this.hyperNetwork, this.targetHyperNetwork);

        console.log(`✅ QMIX initialized with ${this.config.numAgents} agents`);
    }

    private createAgentNetwork(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x: tf.SymbolicTensor;

        if (this.config.networkType === 'cnn') {
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

            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;
        } else {
            x = tf.layers.flatten().apply(input) as tf.SymbolicTensor;
        }

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

        const output = tf.layers.dense({
            units: 7,
            activation: 'linear',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output });
    }

    private createMixingNetwork(): tf.LayersModel {
        // Takes agent Q-values and global state
        const agentQsInput = tf.input({ shape: [this.config.numAgents] });
        const globalStateInput = tf.input({ shape: [6, 7, 1] });

        // Process global state
        let stateFeatures = tf.layers.conv2d({
            filters: 32,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(globalStateInput) as tf.SymbolicTensor;

        stateFeatures = tf.layers.globalAveragePooling2d({}).apply(stateFeatures) as tf.SymbolicTensor;

        stateFeatures = tf.layers.dense({
            units: this.config.mixingEmbedDim,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(stateFeatures) as tf.SymbolicTensor;

        // Mixing weights (ensure monotonicity)
        const mixingWeights = tf.layers.dense({
            units: this.config.numAgents,
            activation: 'softplus', // Ensures positive weights
            kernelInitializer: 'heNormal'
        }).apply(stateFeatures) as tf.SymbolicTensor;

        // Bias
        const mixingBias = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal'
        }).apply(stateFeatures) as tf.SymbolicTensor;

        // Mix agent Q-values
        const weightedQs = tf.layers.multiply().apply([agentQsInput, mixingWeights]) as tf.SymbolicTensor;
        // Create a ones tensor for summing
        const onesInput = tf.input({ shape: [this.config.numAgents, 1] });
        const summedQs = tf.layers.dot({ axes: 1 }).apply([weightedQs, onesInput]) as tf.SymbolicTensor;
        const mixedQ = tf.layers.add().apply([summedQs, mixingBias]) as tf.SymbolicTensor;

        return tf.model({
            inputs: [agentQsInput, globalStateInput],
            outputs: mixedQ
        });
    }

    private createHyperNetwork(): tf.LayersModel {
        // Generates parameters for mixing network based on global state
        const input = tf.input({ shape: [6, 7, 1] });

        let x = tf.layers.conv2d({
            filters: 32,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: this.config.hypernetHiddenDim,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        // Generate mixing weights
        const mixingWeights = tf.layers.dense({
            units: this.config.numAgents,
            activation: 'softplus',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        // Generate bias
        const mixingBias = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({
            inputs: input,
            outputs: [mixingWeights, mixingBias]
        });
    }

    private copyWeights(source: tf.LayersModel, target: tf.LayersModel): void {
        const sourceWeights = source.getWeights();
        target.setWeights(sourceWeights);
    }

    /**
     * Select actions for all agents
     */
    async selectActions(
        states: CellValue[][][],
        legalMoves: number[][]
    ): Promise<number[]> {
        const actions: number[] = [];

        for (let i = 0; i < this.config.numAgents; i++) {
            const action = await this.selectAction(i, states[i], legalMoves[i]);
            actions.push(action);
        }

        return actions;
    }

    private async selectAction(
        agentId: number,
        state: CellValue[][],
        legalMoves: number[]
    ): Promise<number> {
        // Epsilon-greedy exploration
        if (Math.random() < this.config.epsilon) {
            const randomIndex = Math.floor(Math.random() * legalMoves.length);
            return legalMoves[randomIndex];
        }

        // Get Q-values from agent network
        const stateTensor = this.boardToTensor(state);
        const qValues = await this.agentNetworks[agentId].predict(stateTensor) as tf.Tensor;
        const qValuesArray = await qValues.data() as Float32Array;

        // Mask illegal moves
        const maskedQValues = Array.from(qValuesArray);
        maskedQValues.forEach((q, i) => {
            if (!legalMoves.includes(i)) {
                maskedQValues[i] = -Infinity;
            }
        });

        // Select best action
        const bestAction = maskedQValues.indexOf(Math.max(...maskedQValues));

        // Store Q-values for metrics
        this.metrics.qValues[agentId] = Array.from(qValuesArray);

        // Clean up
        stateTensor.dispose();
        qValues.dispose();

        return bestAction;
    }

    /**
     * Store experience in replay buffer
     */
    storeExperience(experience: QMIXExperience): void {
        this.replayBuffer.push(experience);

        if (this.replayBuffer.length > this.config.bufferSize) {
            this.replayBuffer.shift();
        }
    }

    /**
     * Train QMIX networks
     */
    async train(): Promise<void> {
        if (this.replayBuffer.length < this.config.batchSize) {
            return;
        }

        console.log('🏋️ Training QMIX Multi-Agent System...');

        const batch = this.sampleBatch();
        const loss = await this.computeLoss(batch);

        // Update target networks
        if (this.currentStep % this.config.targetUpdateFreq === 0) {
            this.updateTargetNetworks();
        }

        // Decay epsilon
        this.config.epsilon = Math.max(
            this.config.epsilonMin,
            this.config.epsilon * this.config.epsilonDecay
        );

        // Update metrics
        this.metrics.totalLoss = loss;
        this.metrics.explorationRate = this.config.epsilon;

        this.currentStep++;
        console.log('✅ QMIX training completed');
    }

    private sampleBatch(): QMIXExperience[] {
        const batch: QMIXExperience[] = [];

        for (let i = 0; i < this.config.batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.replayBuffer.length);
            batch.push(this.replayBuffer[randomIndex]);
        }

        return batch;
    }

    private async computeLoss(batch: QMIXExperience[]): Promise<number> {
        // Prepare batch data
        const batchStates = batch.map(exp => exp.states);
        const batchActions = batch.map(exp => exp.actions);
        const batchRewards = batch.map(exp => exp.teamReward);
        const batchNextStates = batch.map(exp => exp.nextStates);
        const batchDones = batch.map(exp => exp.dones);
        const batchGlobalStates = batch.map(exp => exp.globalState);

        return tf.tidy(() => {
            // Compute current Q-values for each agent
            const currentQValues: tf.Tensor[] = [];
            for (let i = 0; i < this.config.numAgents; i++) {
                const agentStates = tf.stack(batchStates.map(states =>
                    tf.tensor3d(states[i], [6, 7, 1])
                ));
                const agentQs = this.agentNetworks[i].predict(agentStates) as tf.Tensor;

                // Get Q-values for chosen actions
                const actions = tf.tensor1d(batchActions.map(actions => actions[i]), 'int32');
                const chosenQs = tf.gather(agentQs, actions, 1);
                currentQValues.push(chosenQs);
            }

            // Stack agent Q-values
            const stackedCurrentQs = tf.stack(currentQValues, 1);

            // Mix current Q-values
            const globalStates = tf.stack(batchGlobalStates.map(state =>
                tf.tensor3d(state, [6, 7, 1])
            ));
            const currentMixedQs = this.mixingNetwork!.predict([
                stackedCurrentQs,
                globalStates
            ]) as tf.Tensor;

            // Compute target Q-values
            const targetQValues: tf.Tensor[] = [];
            for (let i = 0; i < this.config.numAgents; i++) {
                const agentNextStates = tf.stack(batchNextStates.map(states =>
                    tf.tensor3d(states[i], [6, 7, 1])
                ));
                const agentTargetQs = this.targetAgentNetworks[i].predict(agentNextStates) as tf.Tensor;

                // Get max Q-values for next states
                const maxQs = tf.max(agentTargetQs, 1);
                targetQValues.push(maxQs);
            }

            // Stack target Q-values
            const stackedTargetQs = tf.stack(targetQValues, 1);

            // Mix target Q-values
            const nextGlobalStates = tf.stack(batchNextStates.map(states =>
                tf.tensor3d(states[0], [6, 7, 1]) // Use first agent's state as global
            ));
            const targetMixedQs = this.targetMixingNetwork!.predict([
                stackedTargetQs,
                nextGlobalStates
            ]) as tf.Tensor;

            // Compute TD targets
            const rewards = tf.tensor1d(batchRewards);
            const dones = tf.tensor1d(batchDones.map(done => done[0] ? 1 : 0));
            const tdTargets = tf.add(
                rewards,
                tf.mul(
                    tf.scalar(this.config.gamma),
                    tf.mul(
                        tf.squeeze(targetMixedQs),
                        tf.sub(tf.scalar(1), dones)
                    )
                )
            );

            // Compute loss
            const loss = tf.mean(tf.square(tf.sub(tdTargets, tf.squeeze(currentMixedQs))));

            // Compute gradients and apply
            const gradients = tf.variableGrads(() => loss as tf.Scalar);
            this.optimizer.applyGradients(gradients.grads);

            return loss.dataSync()[0];
        });
    }

    private updateTargetNetworks(): void {
        // Update agent target networks
        for (let i = 0; i < this.config.numAgents; i++) {
            this.copyWeights(this.agentNetworks[i], this.targetAgentNetworks[i]);
        }

        // Update mixing target network
        this.copyWeights(this.mixingNetwork!, this.targetMixingNetwork!);

        // Update hyper target network
        this.copyWeights(this.hyperNetwork!, this.targetHyperNetwork!);
    }

    /**
     * Get mixed Q-value for current state
     */
    async getMixedQValue(
        states: CellValue[][][],
        actions: number[]
    ): Promise<number> {
        if (!this.mixingNetwork) {
            throw new Error('QMIX not initialized');
        }

        // Get individual Q-values
        const agentQValues: number[] = [];
        for (let i = 0; i < this.config.numAgents; i++) {
            const stateTensor = this.boardToTensor(states[i]);
            const qValues = await this.agentNetworks[i].predict(stateTensor) as tf.Tensor;
            const qValuesArray = await qValues.data() as Float32Array;

            agentQValues.push(qValuesArray[actions[i]]);

            stateTensor.dispose();
            qValues.dispose();
        }

        // Mix Q-values
        const agentQsTensor = tf.tensor2d([agentQValues]);
        const globalStateTensor = this.boardToTensor(states[0]);
        const mixedQ = await this.mixingNetwork.predict([
            agentQsTensor,
            globalStateTensor
        ]) as tf.Tensor;

        const mixedQValue = (await mixedQ.data() as Float32Array)[0];

        // Clean up
        agentQsTensor.dispose();
        globalStateTensor.dispose();
        mixedQ.dispose();

        this.metrics.mixedQValue = mixedQValue;
        return mixedQValue;
    }

    /**
     * Get current metrics
     */
    getMetrics(): QMIXMetrics {
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
     * Save QMIX models
     */
    async saveModel(path: string): Promise<void> {
        // Save agent networks
        for (let i = 0; i < this.config.numAgents; i++) {
            await this.agentNetworks[i].save(`file://${path}/agent_${i}`);
        }

        // Save mixing network
        if (this.mixingNetwork) {
            await this.mixingNetwork.save(`file://${path}/mixing`);
        }

        // Save hypernetwork
        if (this.hyperNetwork) {
            await this.hyperNetwork.save(`file://${path}/hyper`);
        }

        console.log(`💾 QMIX model saved to ${path}`);
    }

    /**
     * Load QMIX models
     */
    async loadModel(path: string): Promise<void> {
        // Load agent networks
        for (let i = 0; i < this.config.numAgents; i++) {
            this.agentNetworks[i] = await tf.loadLayersModel(`file://${path}/agent_${i}`);
            this.copyWeights(this.agentNetworks[i], this.targetAgentNetworks[i]);
        }

        // Load mixing network
        this.mixingNetwork = await tf.loadLayersModel(`file://${path}/mixing`);
        this.copyWeights(this.mixingNetwork, this.targetMixingNetwork!);

        // Load hypernetwork
        this.hyperNetwork = await tf.loadLayersModel(`file://${path}/hyper`);
        this.copyWeights(this.hyperNetwork, this.targetHyperNetwork!);

        console.log(`📂 QMIX model loaded from ${path}`);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.agentNetworks.forEach(network => network.dispose());
        this.targetAgentNetworks.forEach(network => network.dispose());
        this.mixingNetwork?.dispose();
        this.targetMixingNetwork?.dispose();
        this.hyperNetwork?.dispose();
        this.targetHyperNetwork?.dispose();
        this.optimizer.dispose();
    }
}
