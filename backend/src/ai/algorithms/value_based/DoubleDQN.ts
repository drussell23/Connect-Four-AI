import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';
import { DQN, DQNConfig, Experience, DQNMetrics } from './DQN';

export interface DoubleDQNConfig extends DQNConfig {
    updateRatio: number; // How often to update the second network
    networkSyncFreq: number; // Frequency to sync networks
}

/**
 * Double DQN (DDQN) for Connect Four
 * 
 * Key improvements over DQN:
 * - Reduces overestimation bias by decoupling action selection from evaluation
 * - Uses main network for action selection, target network for evaluation
 * - More stable learning and better performance
 * 
 * Algorithm:
 * 1. Use main network to select best action: a* = argmax Q(s', a; θ)
 * 2. Use target network to evaluate: Q_target = r + γ * Q(s', a*; θ⁻)
 * 3. This prevents the maximization bias of standard DQN
 */
export class DoubleDQN extends DQN {
    private doubleDQNConfig: DoubleDQNConfig;
    private networkAUpdates: number = 0;
    private networkBUpdates: number = 0;
    private useNetworkA: boolean = true;

    constructor(config: Partial<DoubleDQNConfig> = {}) {
        const doubleDQNConfig = {
            ...config,
            doubleQ: true, // Force double Q-learning
            updateRatio: 0.5, // Update networks alternately
            networkSyncFreq: 200, // Sync networks every 200 steps
        };

        super(doubleDQNConfig);
        this.doubleDQNConfig = doubleDQNConfig as DoubleDQNConfig;
    }

    /**
     * Enhanced training with alternating network updates
     */
    async train(): Promise<void> {
        if (!this.qNetwork || !this.targetNetwork) {
            throw new Error('Networks not initialized.');
        }

        if (this.replayBuffer.size() < this.config.batchSize) {
            return;
        }

        // Alternate between updating main and target networks
        const shouldUpdateMain = Math.random() < this.doubleDQNConfig.updateRatio;

        const { experiences, indices, weights } = this.replayBuffer.sample(this.config.batchSize);

        // Convert experiences to tensors
        const states = tf.stack(experiences.map(exp => this.boardToTensor(exp.state).squeeze()));
        const nextStates = tf.stack(experiences.map(exp => this.boardToTensor(exp.nextState).squeeze()));
        const actions = tf.tensor1d(experiences.map(exp => exp.action), 'int32');
        const rewards = tf.tensor1d(experiences.map(exp => exp.reward));
        const dones = tf.tensor1d(experiences.map(exp => exp.done ? 1 : 0));
        const weightsTensor = tf.tensor1d(weights);

        // Declare variables for proper cleanup
        let currentQValues: tf.Tensor;
        let nextQValues: tf.Tensor;
        let nextQValuesTarget: tf.Tensor;
        let targetQValues: tf.Tensor;
        let targetQValuesAll: tf.Tensor;
        let finalTargets: tf.Tensor;

        try {
            if (shouldUpdateMain) {
                // Update main network
                currentQValues = this.qNetwork.predict(states) as tf.Tensor;

                // Double DQN: use main network for action selection
                nextQValues = this.qNetwork.predict(nextStates) as tf.Tensor;
                nextQValuesTarget = this.targetNetwork.predict(nextStates) as tf.Tensor;

                // Select actions using main network
                const nextActions = tf.argMax(nextQValues, 1);

                // Evaluate actions using target network
                const batchIndices = tf.range(0, this.config.batchSize);
                const actionIndices = tf.stack([batchIndices, nextActions], 1);
                const selectedNextQValues = tf.gatherND(nextQValuesTarget, actionIndices);

                // Compute targets
                targetQValues = tf.add(
                    rewards,
                    tf.mul(
                        tf.scalar(this.config.gamma),
                        tf.mul(selectedNextQValues, tf.sub(tf.scalar(1), dones))
                    )
                );

                // Create full target tensor
                targetQValuesAll = tf.clone(currentQValues);
                const mainActionIndices = tf.stack([batchIndices, actions], 1);

                // Update only the taken actions
                const updatedTargets = tf.scatterND(
                    mainActionIndices,
                    targetQValues,
                    [this.config.batchSize, this.config.actionSize]
                );

                finalTargets = tf.add(
                    tf.mul(targetQValuesAll, tf.sub(tf.scalar(1), tf.expandDims(tf.cast(tf.oneHot(actions, this.config.actionSize), 'float32'), 0))),
                    updatedTargets
                );

                // Train main network
                await this.qNetwork.fit(states, finalTargets, {
                    batchSize: this.config.batchSize,
                    epochs: 1,
                    verbose: 0,
                    sampleWeight: weightsTensor
                });

                this.networkAUpdates++;

                // Clean up temporary tensors
                nextActions.dispose();
                batchIndices.dispose();
                actionIndices.dispose();
                selectedNextQValues.dispose();
                mainActionIndices.dispose();
                updatedTargets.dispose();
            } else {
                // Update target network (less frequently)
                currentQValues = this.targetNetwork.predict(states) as tf.Tensor;

                // Standard Q-learning for target network
                nextQValues = this.targetNetwork.predict(nextStates) as tf.Tensor;
                const maxNextQValues = tf.max(nextQValues, 1);

                targetQValues = tf.add(
                    rewards,
                    tf.mul(
                        tf.scalar(this.config.gamma),
                        tf.mul(maxNextQValues, tf.sub(tf.scalar(1), dones))
                    )
                );

                targetQValuesAll = tf.clone(currentQValues);
                const batchIndices = tf.range(0, this.config.batchSize);
                const actionIndices = tf.stack([batchIndices, actions], 1);

                const updatedTargets = tf.scatterND(
                    actionIndices,
                    targetQValues,
                    [this.config.batchSize, this.config.actionSize]
                );

                finalTargets = tf.add(
                    tf.mul(targetQValuesAll, tf.sub(tf.scalar(1), tf.expandDims(tf.cast(tf.oneHot(actions, this.config.actionSize), 'float32'), 0))),
                    updatedTargets
                );

                // Train target network
                await this.targetNetwork.fit(states, finalTargets, {
                    batchSize: this.config.batchSize,
                    epochs: 1,
                    verbose: 0,
                    sampleWeight: weightsTensor
                });

                this.networkBUpdates++;

                // Clean up temporary tensors
                maxNextQValues.dispose();
                batchIndices.dispose();
                actionIndices.dispose();
                updatedTargets.dispose();
            }

            // Compute TD errors for prioritized replay
            const tdErrors = tf.sub(targetQValues, tf.gather(currentQValues, actions, 0, 1));
            const tdErrorsArray = await tdErrors.data();

            // Update priorities
            this.replayBuffer.updatePriorities(indices, Array.from(tdErrorsArray));

            // Update metrics
            const loss = tf.losses.meanSquaredError(finalTargets, currentQValues, weightsTensor);
            const lossValue = await loss.data();
            const avgQ = tf.mean(currentQValues);
            const maxQ = tf.max(currentQValues);

            this.metrics.loss = lossValue[0];
            this.metrics.avgQ = (await avgQ.data())[0];
            this.metrics.maxQ = (await maxQ.data())[0];
            this.metrics.epsilon = this.epsilon;
            this.metrics.replayBufferSize = this.replayBuffer.size();
            this.metrics.trainingSteps = this.trainingSteps;

            // Clean up metrics tensors
            loss.dispose();
            avgQ.dispose();
            maxQ.dispose();
            tdErrors.dispose();

            this.trainingSteps++;

            // Sync networks periodically
            if (this.trainingSteps % this.doubleDQNConfig.networkSyncFreq === 0) {
                this.syncNetworks();
            }

            // Decay epsilon
            this.epsilon = Math.max(
                this.config.epsilonEnd,
                this.epsilon * this.config.epsilonDecay
            );

        } finally {
            // Clean up all tensors
            states.dispose();
            nextStates.dispose();
            actions.dispose();
            rewards.dispose();
            dones.dispose();
            weightsTensor.dispose();

            if (currentQValues) currentQValues.dispose();
            if (nextQValues) nextQValues.dispose();
            if (nextQValuesTarget) nextQValuesTarget.dispose();
            if (targetQValues) targetQValues.dispose();
            if (targetQValuesAll) targetQValuesAll.dispose();
            if (finalTargets) finalTargets.dispose();
        }
    }

    /**
     * Sync networks by copying weights
     */
    private syncNetworks(): void {
        if (!this.qNetwork || !this.targetNetwork) return;

        // Copy main network weights to target network
        const mainWeights = this.qNetwork.getWeights();
        this.targetNetwork.setWeights(mainWeights);

        console.log(`[Double DQN] Networks synchronized at step ${this.trainingSteps}`);
    }

    /**
     * Enhanced action selection with network alternation
     */
    async selectAction(board: CellValue[][], validActions: number[]): Promise<number> {
        if (Math.random() < this.epsilon) {
            // Random action (exploration)
            return validActions[Math.floor(Math.random() * validActions.length)];
        } else {
            // Greedy action using both networks for better stability
            const qValues1 = await this.getQValues(board);
            const qValues2 = await this.getTargetQValues(board);

            // Average the Q-values from both networks
            const avgQValues = qValues1.map((q1, i) => (q1 + qValues2[i]) / 2);

            // Mask invalid actions
            const maskedQValues = avgQValues.map((q, i) =>
                validActions.includes(i) ? q : -Infinity
            );

            return maskedQValues.indexOf(Math.max(...maskedQValues));
        }
    }

    /**
     * Get Q-values from target network
     */
    private async getTargetQValues(board: CellValue[][]): Promise<number[]> {
        if (!this.targetNetwork) {
            throw new Error('Target network not initialized.');
        }

        const stateTensor = this.boardToTensor(board);

        try {
            const qValues = this.targetNetwork.predict(stateTensor) as tf.Tensor;
            const qValuesArray = await qValues.data();

            qValues.dispose();
            return Array.from(qValuesArray);
        } finally {
            stateTensor.dispose();
        }
    }

    /**
     * Get enhanced metrics including Double DQN specific stats
     */
    getMetrics(): DQNMetrics & {
        networkAUpdates: number;
        networkBUpdates: number;
        updateRatio: number
    } {
        return {
            ...super.getMetrics(),
            networkAUpdates: this.networkAUpdates,
            networkBUpdates: this.networkBUpdates,
            updateRatio: this.networkAUpdates / (this.networkAUpdates + this.networkBUpdates) || 0
        };
    }

    /**
     * Reset training statistics
     */
    resetTrainingStats(): void {
        this.networkAUpdates = 0;
        this.networkBUpdates = 0;
        this.trainingSteps = 0;
    }
}
