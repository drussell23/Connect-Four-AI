import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';
import { Connect4CNN } from '../../networks/cnnNetworks';
import { TensorOps, tidyCreateBatch } from '../../shared/tensor-ops';

export interface DQNConfig {
    stateSize: number;
    actionSize: number;
    hiddenLayers: number[];
    learningRate: number;
    epsilonStart: number;
    epsilonEnd: number;
    epsilonDecay: number;
    batchSize: number;
    bufferSize: number;
    targetUpdateFreq: number;
    gamma: number; // discount factor
    tau: number; // soft update parameter
    prioritizedReplay: boolean;
    doubleQ: boolean;
    useCNN: boolean;
}

export interface Experience {
    state: CellValue[][];
    action: number;
    reward: number;
    nextState: CellValue[][];
    done: boolean;
    priority?: number;
}

export interface DQNMetrics {
    loss: number;
    avgQ: number;
    maxQ: number;
    epsilon: number;
    replayBufferSize: number;
    trainingSteps: number;
}

/**
 * Experience Replay Buffer with optional prioritized replay
 */
class ReplayBuffer {
    private buffer: Experience[] = [];
    private capacity: number;
    private alpha: number = 0.6; // prioritization strength
    private beta: number = 0.4; // importance sampling strength
    private priorities: number[] = [];
    private maxPriority: number = 1.0;
    private isPrioritized: boolean;

    constructor(capacity: number, prioritized: boolean = false) {
        this.capacity = capacity;
        this.isPrioritized = prioritized;
    }

    /**
     * Add experience to buffer
     */
    push(experience: Experience): void {
        if (this.buffer.length >= this.capacity) {
            this.buffer.shift();
            if (this.isPrioritized) {
                this.priorities.shift();
            }
        }

        this.buffer.push(experience);

        if (this.isPrioritized) {
            const priority = experience.priority || this.maxPriority;
            this.priorities.push(priority);
            this.maxPriority = Math.max(this.maxPriority, priority);
        }
    }

    /**
     * Sample batch from buffer
     */
    sample(batchSize: number): {
        experiences: Experience[],
        indices: number[],
        weights: number[]
    } {
        const experiences: Experience[] = [];
        const indices: number[] = [];
        const weights: number[] = [];

        if (this.isPrioritized) {
            // Prioritized sampling
            const totalPriority = this.priorities.reduce((sum, p) => sum + Math.pow(p, this.alpha), 0);

            for (let i = 0; i < batchSize; i++) {
                const randomValue = Math.random() * totalPriority;
                let cumulativePriority = 0;
                let selectedIndex = 0;

                for (let j = 0; j < this.priorities.length; j++) {
                    cumulativePriority += Math.pow(this.priorities[j], this.alpha);
                    if (randomValue <= cumulativePriority) {
                        selectedIndex = j;
                        break;
                    }
                }

                experiences.push(this.buffer[selectedIndex]);
                indices.push(selectedIndex);

                // Compute importance sampling weight
                const probability = Math.pow(this.priorities[selectedIndex], this.alpha) / totalPriority;
                const weight = Math.pow(1 / (this.buffer.length * probability), this.beta);
                weights.push(weight);
            }

            // Normalize weights
            const maxWeight = Math.max(...weights);
            for (let i = 0; i < weights.length; i++) {
                weights[i] /= maxWeight;
            }
        } else {
            // Uniform sampling
            for (let i = 0; i < batchSize; i++) {
                const randomIndex = Math.floor(Math.random() * this.buffer.length);
                experiences.push(this.buffer[randomIndex]);
                indices.push(randomIndex);
                weights.push(1.0);
            }
        }

        return { experiences, indices, weights };
    }

    /**
     * Update priorities for prioritized replay
     */
    updatePriorities(indices: number[], tdErrors: number[]): void {
        if (!this.isPrioritized) return;

        for (let i = 0; i < indices.length; i++) {
            const priority = Math.abs(tdErrors[i]) + 1e-6; // small epsilon to prevent zero priorities
            this.priorities[indices[i]] = priority;
            this.maxPriority = Math.max(this.maxPriority, priority);
        }
    }

    size(): number {
        return this.buffer.length;
    }

    clear(): void {
        this.buffer = [];
        this.priorities = [];
        this.maxPriority = 1.0;
    }
}

/**
 * Deep Q-Network for Connect Four
 * Features:
 * - Experience replay with optional prioritization
 * - Target network for stable learning
 * - Epsilon-greedy exploration
 * - CNN or MLP architecture
 * - Double Q-learning support
 */
export class DQN {
    protected config: DQNConfig;
    protected qNetwork: tf.LayersModel | null = null;
    protected targetNetwork: tf.LayersModel | null = null;
    protected cnnNetwork: Connect4CNN | null = null;
    protected replayBuffer: ReplayBuffer;
    protected epsilon: number;
    protected trainingSteps: number = 0;
    protected metrics: DQNMetrics;

    constructor(config: Partial<DQNConfig> = {}) {
        this.config = {
            stateSize: 6 * 7 * 3, // 6x7 board with 3 channels
            actionSize: 7,
            hiddenLayers: [512, 256, 128],
            learningRate: 0.001,
            epsilonStart: 1.0,
            epsilonEnd: 0.01,
            epsilonDecay: 0.995,
            batchSize: 32,
            bufferSize: 10000,
            targetUpdateFreq: 100,
            gamma: 0.99,
            tau: 0.005,
            prioritizedReplay: true,
            doubleQ: true,
            useCNN: true,
            ...config
        };

        this.epsilon = this.config.epsilonStart;
        this.replayBuffer = new ReplayBuffer(this.config.bufferSize, this.config.prioritizedReplay);

        this.metrics = {
            loss: 0,
            avgQ: 0,
            maxQ: 0,
            epsilon: this.epsilon,
            replayBufferSize: 0,
            trainingSteps: 0
        };
    }

    /**
     * Build Q-network architecture
     */
    buildNetwork(): tf.LayersModel {
        if (this.config.useCNN) {
            // Use CNN for spatial pattern recognition
            const input = tf.input({ shape: [6, 7, 3] });

            // CNN layers
            let x = tf.layers.conv2d({
                filters: 64,
                kernelSize: 3,
                padding: 'same',
                activation: 'relu',
                name: 'conv1'
            }).apply(input) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 128,
                kernelSize: 3,
                padding: 'same',
                activation: 'relu',
                name: 'conv2'
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 256,
                kernelSize: 3,
                padding: 'same',
                activation: 'relu',
                name: 'conv3'
            }).apply(x) as tf.SymbolicTensor;

            // Flatten for fully connected layers
            x = tf.layers.flatten({ name: 'flatten' }).apply(x) as tf.SymbolicTensor;

            // Dense layers
            for (let i = 0; i < this.config.hiddenLayers.length; i++) {
                x = tf.layers.dense({
                    units: this.config.hiddenLayers[i],
                    activation: 'relu',
                    name: `dense_${i}`
                }).apply(x) as tf.SymbolicTensor;
            }

            // Output layer (Q-values for each action)
            const output = tf.layers.dense({
                units: this.config.actionSize,
                activation: 'linear',
                name: 'q_values'
            }).apply(x) as tf.SymbolicTensor;

            return tf.model({ inputs: input, outputs: output, name: 'DQN_CNN' });
        } else {
            // Use MLP for flattened state
            const input = tf.input({ shape: [this.config.stateSize] });

            let x = input;
            for (let i = 0; i < this.config.hiddenLayers.length; i++) {
                x = tf.layers.dense({
                    units: this.config.hiddenLayers[i],
                    activation: 'relu',
                    name: `dense_${i}`
                }).apply(x) as tf.SymbolicTensor;
            }

            const output = tf.layers.dense({
                units: this.config.actionSize,
                activation: 'linear',
                name: 'q_values'
            }).apply(x) as tf.SymbolicTensor;

            return tf.model({ inputs: input, outputs: output, name: 'DQN_MLP' });
        }
    }

    /**
     * Initialize networks
     */
    initialize(): void {
        this.qNetwork = this.buildNetwork();
        this.targetNetwork = this.buildNetwork();

        // Compile networks
        this.qNetwork.compile({
            optimizer: tf.train.adam(this.config.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        this.targetNetwork.compile({
            optimizer: tf.train.adam(this.config.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        // Initialize target network with same weights as Q-network
        this.updateTargetNetwork();
    }

    /**
 * Convert board to tensor
 */
    protected boardToTensor(board: CellValue[][]): tf.Tensor {
        if (this.config.useCNN) {
            // CNN input: [batch, height, width, channels]
            const tensorData = new Float32Array(6 * 7 * 3);

            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 7; c++) {
                    const baseIdx = (r * 7 + c) * 3;
                    const cell = board[r][c];

                    tensorData[baseIdx] = cell === 'Red' ? 1.0 : 0.0;
                    tensorData[baseIdx + 1] = cell === 'Yellow' ? 1.0 : 0.0;
                    tensorData[baseIdx + 2] = cell === 'Empty' ? 1.0 : 0.0;
                }
            }

            return tf.tensor4d(tensorData, [1, 6, 7, 3]);
        } else {
            // MLP input: [batch, flattened_state]
            const tensorData = new Float32Array(this.config.stateSize);

            let idx = 0;
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 7; c++) {
                    const cell = board[r][c];
                    tensorData[idx++] = cell === 'Red' ? 1.0 : 0.0;
                    tensorData[idx++] = cell === 'Yellow' ? 1.0 : 0.0;
                    tensorData[idx++] = cell === 'Empty' ? 1.0 : 0.0;
                }
            }

            return tf.tensor2d(tensorData, [1, this.config.stateSize]);
        }
    }

    /**
     * Get Q-values for a given state
     */
    async getQValues(board: CellValue[][]): Promise<number[]> {
        if (!this.qNetwork) {
            throw new Error('Network not initialized. Call initialize() first.');
        }

        const stateTensor = this.boardToTensor(board);

        try {
            const qValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
            const qValuesArray = await qValues.data();

            qValues.dispose();
            return Array.from(qValuesArray);
        } finally {
            stateTensor.dispose();
        }
    }

    /**
     * Select action using epsilon-greedy policy
     */
    async selectAction(board: CellValue[][], validActions: number[]): Promise<number> {
        if (Math.random() < this.epsilon) {
            // Random action (exploration)
            return validActions[Math.floor(Math.random() * validActions.length)];
        } else {
            // Greedy action (exploitation)
            const qValues = await this.getQValues(board);

            // Mask invalid actions
            const maskedQValues = qValues.map((q, i) =>
                validActions.includes(i) ? q : -Infinity
            );

            return maskedQValues.indexOf(Math.max(...maskedQValues));
        }
    }

    /**
     * Store experience in replay buffer
     */
    storeExperience(experience: Experience): void {
        this.replayBuffer.push(experience);
    }

    /**
     * Train the network on a batch of experiences
     */
    async train(): Promise<void> {
        if (!this.qNetwork || !this.targetNetwork) {
            throw new Error('Networks not initialized.');
        }

        if (this.replayBuffer.size() < this.config.batchSize) {
            return;
        }

        const { experiences, indices, weights } = this.replayBuffer.sample(this.config.batchSize);

        // Convert experiences to tensors
        const states = tf.stack(experiences.map(exp => this.boardToTensor(exp.state).squeeze()));
        const nextStates = tf.stack(experiences.map(exp => this.boardToTensor(exp.nextState).squeeze()));
        const actions = tf.tensor1d(experiences.map(exp => exp.action), 'int32');
        const rewards = tf.tensor1d(experiences.map(exp => exp.reward));
        const dones = tf.tensor1d(experiences.map(exp => exp.done ? 1 : 0));
        const weightsTensor = tf.tensor1d(weights);

        // Declare variables outside try block for proper cleanup
        let currentQValues: tf.Tensor;
        let nextQValues: tf.Tensor;
        let targetQValues: tf.Tensor;
        let targetQValuesAll: tf.Tensor;
        let finalTargets: tf.Tensor;

        try {
            // Get current Q-values
            currentQValues = this.qNetwork.predict(states) as tf.Tensor;

            // Get next Q-values from target network
            nextQValues = this.targetNetwork.predict(nextStates) as tf.Tensor;

            if (this.config.doubleQ) {
                // Double Q-learning: use main network to select actions, target network to evaluate
                const nextQValuesMain = this.qNetwork.predict(nextStates) as tf.Tensor;
                const nextActions = tf.argMax(nextQValuesMain, 1);

                // Gather Q-values from target network using actions from main network
                const batchIndices = tf.range(0, this.config.batchSize);
                const indices2D = tf.stack([batchIndices, nextActions], 1);
                const selectedNextQValues = tf.gatherND(nextQValues, indices2D);

                targetQValues = tf.add(
                    rewards,
                    tf.mul(
                        tf.scalar(this.config.gamma),
                        tf.mul(selectedNextQValues, tf.sub(tf.scalar(1), dones))
                    )
                );

                nextQValuesMain.dispose();
                nextActions.dispose();
                batchIndices.dispose();
                indices2D.dispose();
                selectedNextQValues.dispose();
            } else {
                // Standard Q-learning
                const maxNextQValues = tf.max(nextQValues, 1);
                targetQValues = tf.add(
                    rewards,
                    tf.mul(
                        tf.scalar(this.config.gamma),
                        tf.mul(maxNextQValues, tf.sub(tf.scalar(1), dones))
                    )
                );

                maxNextQValues.dispose();
            }

            // Create target Q-values tensor
            targetQValuesAll = tf.clone(currentQValues);

            // Update Q-values for selected actions
            const batchIndices = tf.range(0, this.config.batchSize);
            const actionIndices = tf.stack([batchIndices, actions], 1);

            const updatedQValues = tf.scatterND(
                actionIndices,
                targetQValues,
                [this.config.batchSize, this.config.actionSize]
            );

            finalTargets = tf.add(
                tf.mul(targetQValuesAll, tf.sub(tf.scalar(1), tf.expandDims(tf.cast(tf.oneHot(actions, this.config.actionSize), 'float32'), 0))),
                updatedQValues
            );

            // Compute loss with importance sampling weights
            const loss = tf.losses.meanSquaredError(finalTargets, currentQValues, weightsTensor);

            // Compute TD errors for prioritized replay
            const tdErrors = tf.sub(targetQValues, tf.gather(currentQValues, actions, 0, 1));
            const tdErrorsArray = await tdErrors.data();

            // Update priorities
            this.replayBuffer.updatePriorities(indices, Array.from(tdErrorsArray));

            // Update metrics
            const lossValue = await loss.data();
            const avgQ = tf.mean(currentQValues);
            const maxQ = tf.max(currentQValues);

            this.metrics.loss = lossValue[0];
            this.metrics.avgQ = (await avgQ.data())[0];
            this.metrics.maxQ = (await maxQ.data())[0];
            this.metrics.epsilon = this.epsilon;
            this.metrics.replayBufferSize = this.replayBuffer.size();
            this.metrics.trainingSteps = this.trainingSteps;

            // Clean up
            avgQ.dispose();
            maxQ.dispose();
            tdErrors.dispose();

            // Perform training step
            await this.qNetwork.fit(states, finalTargets, {
                batchSize: this.config.batchSize,
                epochs: 1,
                verbose: 0,
                sampleWeight: weightsTensor
            });

            this.trainingSteps++;

            // Update target network periodically
            if (this.trainingSteps % this.config.targetUpdateFreq === 0) {
                this.updateTargetNetwork();
            }

            // Decay epsilon
            this.epsilon = Math.max(
                this.config.epsilonEnd,
                this.epsilon * this.config.epsilonDecay
            );

        } finally {
            // Clean up tensors
            states.dispose();
            nextStates.dispose();
            actions.dispose();
            rewards.dispose();
            dones.dispose();
            weightsTensor.dispose();
            currentQValues.dispose();
            nextQValues.dispose();
            targetQValues.dispose();
            targetQValuesAll.dispose();
            finalTargets.dispose();
        }
    }

    /**
     * Update target network with current network weights
     */
    private updateTargetNetwork(): void {
        if (!this.qNetwork || !this.targetNetwork) return;

        const qWeights = this.qNetwork.getWeights();
        const targetWeights = this.targetNetwork.getWeights();

        // Soft update: target = tau * current + (1 - tau) * target
        const updatedWeights = qWeights.map((qWeight, i) => {
            const targetWeight = targetWeights[i];
            return tf.add(
                tf.mul(qWeight, this.config.tau),
                tf.mul(targetWeight, 1 - this.config.tau)
            );
        });

        this.targetNetwork.setWeights(updatedWeights);

        // Clean up old weights
        targetWeights.forEach(weight => weight.dispose());
    }

    /**
     * Get current metrics
     */
    getMetrics(): DQNMetrics {
        return { ...this.metrics };
    }

    /**
     * Save model
     */
    async saveModel(path: string): Promise<void> {
        if (!this.qNetwork) {
            throw new Error('Network not initialized.');
        }
        await this.qNetwork.save(`file://${path}`);
    }

    /**
     * Load model
     */
    async loadModel(path: string): Promise<void> {
        this.qNetwork = await tf.loadLayersModel(`file://${path}`);
        this.targetNetwork = await tf.loadLayersModel(`file://${path}`);
    }

    /**
     * Reset epsilon for new training
     */
    resetEpsilon(): void {
        this.epsilon = this.config.epsilonStart;
    }

    /**
     * Clear replay buffer
     */
    clearBuffer(): void {
        this.replayBuffer.clear();
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        if (this.qNetwork) {
            this.qNetwork.dispose();
            this.qNetwork = null;
        }

        if (this.targetNetwork) {
            this.targetNetwork.dispose();
            this.targetNetwork = null;
        }

        if (this.cnnNetwork) {
            this.cnnNetwork.dispose();
            this.cnnNetwork = null;
        }
    }
}
