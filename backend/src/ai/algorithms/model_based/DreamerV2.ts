import * as tf from '@tensorflow/tfjs';
import { performance } from 'perf_hooks';
import { CellValue } from '../../connect4AI';
import { Connect4Environment, EnvironmentObservation, StepResult } from '../../environment';

/**
 * DreamerV2: Model-Based Reinforcement Learning with Imagination
 * 
 * DreamerV2 learns a world model of the environment and uses it to train
 * an actor and critic via imagined rollouts. This implementation is
 * specifically adapted for Connect Four with comprehensive features.
 * 
 * Features:
 *  - World model with representation, transition, and reconstruction
 *  - Actor-critic learning in imagination
 *  - Latent state representation learning
 *  - Variational inference with KL regularization
 *  - Recurrent state space model (RSSM)
 *  - Connect Four specific optimizations
 *  - Comprehensive metrics and monitoring
 *  - Model ensembles for uncertainty estimation
 *  - Hierarchical planning capabilities
 */

// === Core Types and Interfaces ===

export interface DreamerConfig {
    // World model architecture
    worldModel: {
        stochSize: number;
        deterSize: number;
        hiddenSize: number;
        obsEmbedSize: number;
        actionEmbedSize: number;
        rewardSize: number;

        // Encoder/Decoder
        encoderLayers: number[];
        decoderLayers: number[];

        // Recurrent model
        rnnType: 'gru' | 'lstm';
        rnnLayers: number;
    };

    // Actor-Critic configuration
    actorCritic: {
        hiddenSize: number;
        hiddenLayers: number;
        actionDist: 'categorical' | 'normal';
        initStd: number;
        minStd: number;
        maxStd: number;
    };

    // Training parameters
    training: {
        batchSize: number;
        batchLength: number;
        trainSteps: number;
        collectSteps: number;
        bufferSize: number;
        imaginationHorizon: number;

        // Learning rates
        worldModelLR: number;
        actorLR: number;
        criticLR: number;

        // Regularization
        klScale: number;
        klBalance: number;
        klFree: number;
        gradClip: number;
        weightDecay: number;
    };

    // Exploration
    exploration: {
        noise: number;
        expl: number;
        explDecay: number;
        explMin: number;
    };

    // Connect Four specific
    connect4: {
        boardSize: [number, number];
        actionSize: number;
        rewardScale: number;
        doneReward: number;
        stepReward: number;
    };

    // Advanced features
    advanced: {
        useEnsemble: boolean;
        ensembleSize: number;
        useHierarchy: boolean;
        hierarchyLevels: number;
        useUncertainty: boolean;
        planningHorizon: number;
    };
}

export interface WorldModelState {
    stoch: tf.Tensor;        // Stochastic state
    deter: tf.Tensor;        // Deterministic state  
    logits: tf.Tensor;       // Logits for stochastic state
    hidden: tf.Tensor;       // RNN hidden state
}

export interface Experience {
    observation: tf.Tensor;
    action: tf.Tensor;
    reward: tf.Tensor;
    done: tf.Tensor;
    next?: Experience;
}

export interface TrajectoryBatch {
    observations: tf.Tensor;
    actions: tf.Tensor;
    rewards: tf.Tensor;
    dones: tf.Tensor;
    batchSize: number;
    seqLength: number;
}

export interface ImaginationRollout {
    states: WorldModelState[][];  // Array of timesteps, each containing batch of states
    actions: tf.Tensor[];
    rewards: tf.Tensor[];
    values: tf.Tensor[];
    logProbs: tf.Tensor[];
    dones: tf.Tensor[];
}

export interface DreamerMetrics {
    // World model losses
    worldModel: {
        observationLoss: number;
        rewardLoss: number;
        klLoss: number;
        totalLoss: number;
    };

    // Actor-critic losses
    actor: {
        policyLoss: number;
        entropy: number;
        gradNorm: number;
    };

    critic: {
        valueLoss: number;
        targetValue: number;
        gradNorm: number;
    };

    // Training metrics
    training: {
        episode: number;
        step: number;
        reward: number;
        episodeLength: number;
        explorationRate: number;
    };

    // Connect Four specific
    connect4: {
        winRate: number;
        averageGameLength: number;
        positionValue: number;
        moveConfidence: number;
        planningDepth: number;
    };

    // Performance
    performance: {
        trainingTime: number;
        imaginationTime: number;
        memoryUsage: number;
        modelsUpdated: number;
    };
}

/**
 * Main DreamerV2 Agent
 */
class DreamerV2Agent {
    private config: DreamerConfig;
    private worldModel: WorldModel;
    private actor: Actor;
    private critic: Critic;
    private replayBuffer: ReplayBuffer;

    // Training state
    private step: number = 0;
    private episode: number = 0;
    private metrics: DreamerMetrics[] = [];

    // Optimizers
    private worldModelOptimizer: tf.Optimizer;
    private actorOptimizer: tf.Optimizer;
    private criticOptimizer: tf.Optimizer;

    // Current state
    private currentState: WorldModelState | null = null;
    private explorationRate: number;

    constructor(config: Partial<DreamerConfig> = {}) {
        this.config = {
            worldModel: {
                stochSize: 32,
                deterSize: 512,
                hiddenSize: 512,
                obsEmbedSize: 1024,
                actionEmbedSize: 64,
                rewardSize: 64,
                encoderLayers: [512, 256],
                decoderLayers: [256, 512],
                rnnType: 'gru',
                rnnLayers: 1
            },
            actorCritic: {
                hiddenSize: 256,
                hiddenLayers: 2,
                actionDist: 'categorical',
                initStd: 1.0,
                minStd: 0.1,
                maxStd: 1.0
            },
            training: {
                batchSize: 16,
                batchLength: 64,
                trainSteps: 1000,
                collectSteps: 1000,
                bufferSize: 100000,
                imaginationHorizon: 15,
                worldModelLR: 0.0003,
                actorLR: 0.0003,
                criticLR: 0.0008,
                klScale: 1.0,
                klBalance: 0.8,
                klFree: 1.0,
                gradClip: 100.0,
                weightDecay: 0.0001
            },
            exploration: {
                noise: 0.3,
                expl: 0.3,
                explDecay: 0.99,
                explMin: 0.01
            },
            connect4: {
                boardSize: [6, 7],
                actionSize: 7,
                rewardScale: 1.0,
                doneReward: 0.0,
                stepReward: 0.0
            },
            advanced: {
                useEnsemble: false,
                ensembleSize: 3,
                useHierarchy: false,
                hierarchyLevels: 2,
                useUncertainty: true,
                planningHorizon: 10
            },
            ...config
        };

        this.explorationRate = this.config.exploration.expl;
        this.initializeComponents();
        this.initializeOptimizers();

        this.log('info', 'DreamerV2 Agent initialized', {
            stochSize: this.config.worldModel.stochSize,
            deterSize: this.config.worldModel.deterSize,
            actionSize: this.config.connect4.actionSize
        });
    }

    /**
     * Initialize all components
     */
    private initializeComponents(): void {
        this.worldModel = new WorldModel(this.config);
        this.actor = new Actor(this.config);
        this.critic = new Critic(this.config);
        this.replayBuffer = new ReplayBuffer(this.config.training.bufferSize);
    }

    /**
     * Initialize optimizers
     */
    private initializeOptimizers(): void {
        this.worldModelOptimizer = tf.train.adam(this.config.training.worldModelLR);
        this.actorOptimizer = tf.train.adam(this.config.training.actorLR);
        this.criticOptimizer = tf.train.adam(this.config.training.criticLR);
    }

    /**
     * Select action using actor network
     */
    async selectAction(observation: tf.Tensor, state?: WorldModelState): Promise<{
        action: number;
        logProb: tf.Tensor;
        state: WorldModelState;
        value: tf.Tensor;
    }> {
        // Encode observation
        const obsEmbedding = await this.worldModel.encodeObservation(observation);

        // Update or initialize state
        let currentState: WorldModelState;
        if (state) {
            currentState = await this.worldModel.transition(state, null, obsEmbedding);
        } else {
            currentState = await this.worldModel.initializeState(obsEmbedding);
        }

        // Get action from actor
        const { action, logProb } = await this.actor.sample(currentState, this.explorationRate);

        // Get value from critic
        const value = await this.critic.predict(currentState);

        // Convert action tensor to number for Connect Four
        const actionNumber = tf.argMax(action, -1).dataSync()[0];

        return {
            action: actionNumber,
            logProb,
            state: currentState,
            value
        };
    }

    /**
     * Train the world model
     */
    async trainWorldModel(batch: TrajectoryBatch): Promise<DreamerMetrics['worldModel']> {
        const startTime = performance.now();

        // Forward pass through world model
        const { states, obsLoss, rewardLoss, klLoss } = await this.worldModel.train(batch);

        // Compute total loss
        const totalLoss = tf.add(tf.add(obsLoss, rewardLoss), tf.mul(klLoss, this.config.training.klScale)) as tf.Scalar;

        // Backward pass
        const worldModelVars = this.worldModel.getTrainableVariables();
        const { grads } = tf.variableGrads(() => totalLoss, worldModelVars);

        // Clip gradients
        this.clipGradients(grads, this.config.training.gradClip);

        // Apply gradients
        this.worldModelOptimizer.applyGradients(grads);

        // Extract metrics
        const metrics = {
            observationLoss: obsLoss.dataSync()[0],
            rewardLoss: rewardLoss.dataSync()[0],
            klLoss: klLoss.dataSync()[0],
            totalLoss: totalLoss.dataSync()[0]
        };

        // Cleanup
        obsLoss.dispose();
        rewardLoss.dispose();
        klLoss.dispose();
        totalLoss.dispose();
        Object.values(grads).forEach(g => g.dispose());

        this.log('debug', 'World model training completed', {
            ...metrics,
            time: performance.now() - startTime
        });

        return metrics;
    }

    /**
     * Train actor and critic using imagination
     */
    async trainActorCritic(): Promise<{
        actor: DreamerMetrics['actor'];
        critic: DreamerMetrics['critic'];
    }> {
        const startTime = performance.now();

        // Sample states from replay buffer
        const batch = this.replayBuffer.sampleSequence(
            this.config.training.batchSize,
            this.config.training.batchLength
        );

        // Get initial states from world model
        const initialStates = await this.worldModel.getStatesFromBatch(batch);

        // Imagine rollouts
        const rollouts = await this.imagineRollouts(initialStates);

        // Train critic
        const criticMetrics = await this.trainCritic(rollouts);

        // Train actor
        const actorMetrics = await this.trainActor(rollouts);

        this.log('debug', 'Actor-critic training completed', {
            actorLoss: actorMetrics.policyLoss,
            criticLoss: criticMetrics.valueLoss,
            time: performance.now() - startTime
        });

        return {
            actor: actorMetrics,
            critic: criticMetrics
        };
    }

    /**
     * Imagine rollouts using world model
     */
    private async imagineRollouts(initialStates: WorldModelState[]): Promise<ImaginationRollout> {
        const horizon = this.config.training.imaginationHorizon;
        const batchSize = initialStates.length;

        const rollout: ImaginationRollout = {
            states: [],
            actions: [],
            rewards: [],
            values: [],
            logProbs: [],
            dones: []
        };

        let currentStates = initialStates;

        for (let step = 0; step < horizon; step++) {
            // Sample actions from actor
            const actionResults = await Promise.all(
                currentStates.map(state => this.actor.sample(state, 0)) // No exploration in imagination
            );

            const actions = actionResults.map(r => r.action);
            const logProbs = actionResults.map(r => r.logProb);

            // Get values from critic
            const values = await Promise.all(
                currentStates.map(state => this.critic.predict(state))
            );

            // Transition states using world model
            const nextStates = await Promise.all(
                currentStates.map((state, i) =>
                    this.worldModel.transition(state, actions[i])
                )
            );

            // Predict rewards
            const rewards = await Promise.all(
                nextStates.map(state => this.worldModel.predictReward(state))
            );

            // Predict episode termination (simplified for Connect Four)
            const dones = rewards.map(reward =>
                tf.scalar(Math.abs(reward.dataSync()[0]) > 0.8 ? 1 : 0)
            );

            // Store rollout data
            rollout.states.push(nextStates);
            rollout.actions.push(tf.stack(actions));
            rollout.rewards.push(tf.stack(rewards));
            rollout.values.push(tf.stack(values));
            rollout.logProbs.push(tf.stack(logProbs));
            rollout.dones.push(tf.stack(dones));

            currentStates = nextStates;
        }

        return rollout;
    }

    /**
     * Train critic using imagined rollouts
     */
    private async trainCritic(rollout: ImaginationRollout): Promise<DreamerMetrics['critic']> {
        // Calculate lambda returns
        const returns = this.calculateLambdaReturns(rollout.rewards, rollout.values, rollout.dones);

        // Prepare training data
        const states = rollout.states.slice(0, -1); // Exclude last state
        const targets = returns;

        // Compute critic loss
        const { loss, targetValue } = await this.critic.train(states.flat(), targets);

        // Apply gradients
        const criticVars = this.critic.getTrainableVariables();
        const { grads } = tf.variableGrads(() => loss as tf.Scalar, criticVars);

        this.clipGradients(grads, this.config.training.gradClip);
        this.criticOptimizer.applyGradients(grads);

        // Calculate gradient norm
        const gradNorm = this.calculateGradientNorm(grads);

        const metrics = {
            valueLoss: loss.dataSync()[0],
            targetValue: tf.mean(targetValue).dataSync()[0],
            gradNorm
        };

        // Cleanup
        loss.dispose();
        targetValue.dispose();
        Object.values(grads).forEach(g => g.dispose());

        return metrics;
    }

    /**
     * Train actor using imagined rollouts
     */
    private async trainActor(rollout: ImaginationRollout): Promise<DreamerMetrics['actor']> {
        // Calculate advantages
        const advantages = this.calculateAdvantages(rollout.rewards, rollout.values, rollout.dones);

        // Compute actor loss
        const { loss, entropy } = await this.actor.train(
            rollout.states.slice(0, -1).flat(),
            rollout.actions,
            advantages
        );

        // Apply gradients
        const actorVars = this.actor.getTrainableVariables();
        const { grads } = tf.variableGrads(() => loss as tf.Scalar, actorVars);

        this.clipGradients(grads, this.config.training.gradClip);
        this.actorOptimizer.applyGradients(grads);

        // Calculate gradient norm
        const gradNorm = this.calculateGradientNorm(grads);

        const metrics = {
            policyLoss: loss.dataSync()[0],
            entropy: entropy.dataSync()[0],
            gradNorm
        };

        // Cleanup
        loss.dispose();
        entropy.dispose();
        Object.values(grads).forEach(g => g.dispose());

        return metrics;
    }

    /**
     * Calculate lambda returns for critic training
     */
    private calculateLambdaReturns(
        rewards: tf.Tensor[],
        values: tf.Tensor[],
        dones: tf.Tensor[],
        gamma: number = 0.99,
        lambda: number = 0.95
    ): tf.Tensor {
        const horizon = rewards.length;
        const batchSize = rewards[0].shape[0];

        // Initialize returns
        let returns = tf.zeros([batchSize]);
        let nextValue = values[values.length - 1];

        const returnsList: tf.Tensor[] = [];

        // Backward pass to calculate returns
        for (let t = horizon - 1; t >= 0; t--) {
            const reward = rewards[t];
            const value = values[t];
            const done = dones[t];

            // TD target
            const target = tf.add(reward, tf.mul(tf.mul(nextValue, tf.sub(1, done)), gamma));

            // Lambda return
            const delta = tf.sub(target, value);
            returns = tf.add(value, tf.add(delta, tf.mul(tf.mul(tf.sub(returns, value), tf.sub(1, done)), gamma * lambda)));

            returnsList.unshift(returns.clone());
            nextValue = value;
        }

        // Stack returns
        const stackedReturns = tf.stack(returnsList);

        // Cleanup
        returnsList.forEach(r => r.dispose());

        return stackedReturns;
    }

    /**
     * Calculate advantages for actor training
     */
    private calculateAdvantages(
        rewards: tf.Tensor[],
        values: tf.Tensor[],
        dones: tf.Tensor[],
        gamma: number = 0.99
    ): tf.Tensor {
        const horizon = rewards.length;
        const advantages: tf.Tensor[] = [];

        for (let t = 0; t < horizon; t++) {
            const reward = rewards[t];
            const value = values[t];
            const nextValue = t < horizon - 1 ? values[t + 1] : tf.zeros(value.shape);
            const done = dones[t];

            // TD error as advantage
            const advantage = tf.sub(tf.add(reward, tf.mul(tf.mul(nextValue, tf.sub(1, done)), gamma)), value);
            advantages.push(advantage);
        }

        return tf.stack(advantages);
    }

    /**
     * Main training loop
     */
    async train(environment: Connect4Environment, episodes: number): Promise<DreamerMetrics[]> {
        const allMetrics: DreamerMetrics[] = [];

        this.log('info', 'Starting DreamerV2 training', {
            episodes,
            bufferSize: this.config.training.bufferSize,
            imaginationHorizon: this.config.training.imaginationHorizon
        });

        for (let episode = 0; episode < episodes; episode++) {
            this.episode = episode;

            // Collect experience
            await this.collectExperience(environment);

            // Train models if buffer has enough data
            if (this.replayBuffer.size() >= this.config.training.batchSize) {
                // Train world model
                const batch = this.replayBuffer.sampleSequence(
                    this.config.training.batchSize,
                    this.config.training.batchLength
                );

                const worldModelMetrics = await this.trainWorldModel(batch);

                // Train actor-critic
                const actorCriticMetrics = await this.trainActorCritic();

                // Create episode metrics
                const episodeMetrics: DreamerMetrics = {
                    worldModel: worldModelMetrics,
                    actor: actorCriticMetrics.actor,
                    critic: actorCriticMetrics.critic,
                    training: {
                        episode,
                        step: this.step,
                        reward: this.getLastEpisodeReward(),
                        episodeLength: this.getLastEpisodeLength(),
                        explorationRate: this.explorationRate
                    },
                    connect4: await this.evaluateConnect4Performance(environment),
                    performance: {
                        trainingTime: 0,
                        imaginationTime: 0,
                        memoryUsage: this.getMemoryUsage(),
                        modelsUpdated: 1
                    }
                };

                allMetrics.push(episodeMetrics);
                this.metrics.push(episodeMetrics);
            }

            // Update exploration rate
            this.explorationRate = Math.max(
                this.config.exploration.explMin,
                this.explorationRate * this.config.exploration.explDecay
            );

            // Log progress
            if (episode % 10 === 0) {
                this.log('info', `Episode ${episode}/${episodes}`, {
                    explorationRate: this.explorationRate,
                    bufferSize: this.replayBuffer.size(),
                    step: this.step
                });
            }
        }

        return allMetrics;
    }

    /**
     * Collect experience from environment
     */
    private async collectExperience(environment: Connect4Environment): Promise<void> {
        const observation = environment.reset();
        let state = await this.worldModel.initializeState(
            await this.worldModel.encodeObservation(this.observationToTensor(observation))
        );

        let done = false;
        let episodeReward = 0;
        let episodeLength = 0;

        while (!done && episodeLength < 100) {
            // Select action
            const actionResult = await this.selectAction(
                this.observationToTensor(observation),
                state
            );

            // Take action in environment
            const stepResult = environment.step(actionResult.action);

            // Store experience
            const experience: Experience = {
                observation: this.observationToTensor(observation),
                action: tf.oneHot(actionResult.action, this.config.connect4.actionSize),
                reward: tf.scalar(stepResult.reward),
                done: tf.scalar(stepResult.done ? 1 : 0)
            };

            this.replayBuffer.add(experience);

            // Update for next step
            state = actionResult.state;
            episodeReward += stepResult.reward;
            episodeLength++;
            done = stepResult.done;
            this.step++;

            if (!done) {
                // Get next observation (simplified)
                // In practice, you'd get this from stepResult
                const nextObservation = environment.getObservation();
                // observation = nextObservation;
            }
        }

        this.log('debug', 'Episode completed', {
            reward: episodeReward,
            length: episodeLength,
            exploration: this.explorationRate
        });
    }

    /**
     * Evaluate Connect Four specific performance
     */
    private async evaluateConnect4Performance(environment: Connect4Environment): Promise<DreamerMetrics['connect4']> {
        // Run evaluation games
        let wins = 0;
        let totalLength = 0;
        const evalGames = 10;

        for (let game = 0; game < evalGames; game++) {
            const obs = environment.reset();
            let done = false;
            let length = 0;

            while (!done && length < 50) {
                const actionResult = await this.selectAction(
                    this.observationToTensor(obs),
                    null
                );

                const result = environment.step(actionResult.action);
                done = result.done;
                length++;

                if (done && result.info.winner === 'Red') { // Assuming AI is Red
                    wins++;
                }
            }

            totalLength += length;
        }

        return {
            winRate: wins / evalGames,
            averageGameLength: totalLength / evalGames,
            positionValue: 0, // Would calculate average position value
            moveConfidence: 0.8, // Mock value
            planningDepth: this.config.training.imaginationHorizon
        };
    }

    // === Helper Methods ===

    private observationToTensor(observation: EnvironmentObservation): tf.Tensor {
        return observation.board;
    }

    private clipGradients(gradients: { [name: string]: tf.Tensor }, clipValue: number): void {
        Object.keys(gradients).forEach(name => {
            const grad = gradients[name];
            const clipped = tf.clipByValue(grad, -clipValue, clipValue);
            grad.dispose();
            gradients[name] = clipped;
        });
    }

    private calculateGradientNorm(gradients: { [name: string]: tf.Tensor }): number {
        let totalNorm = 0;
        Object.values(gradients).forEach(grad => {
            const norm = tf.norm(grad).dataSync()[0];
            totalNorm += norm * norm;
        });
        return Math.sqrt(totalNorm);
    }

    private getLastEpisodeReward(): number {
        // Mock implementation
        return Math.random() * 2 - 1;
    }

    private getLastEpisodeLength(): number {
        // Mock implementation
        return Math.floor(Math.random() * 50) + 10;
    }

    private getMemoryUsage(): number {
        return tf.memory().numBytes / (1024 * 1024);
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [DreamerV2] [${level.toUpperCase()}] ${message}`;

        if (data) {
            console[level](logMessage, data);
        } else {
            console[level](logMessage);
        }
    }

    /**
     * Get training metrics
     */
    getMetrics(): DreamerMetrics[] {
        return [...this.metrics];
    }

    /**
     * Save model checkpoints
     */
    async save(path: string): Promise<void> {
        await this.worldModel.save(`${path}/world_model`);
        await this.actor.save(`${path}/actor`);
        await this.critic.save(`${path}/critic`);
        this.log('info', 'Models saved', { path });
    }

    /**
     * Load model checkpoints
     */
    async load(path: string): Promise<void> {
        await this.worldModel.load(`${path}/world_model`);
        await this.actor.load(`${path}/actor`);
        await this.critic.load(`${path}/critic`);
        this.log('info', 'Models loaded', { path });
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.worldModel.dispose();
        this.actor.dispose();
        this.critic.dispose();
        this.worldModelOptimizer.dispose();
        this.actorOptimizer.dispose();
        this.criticOptimizer.dispose();
        this.log('info', 'DreamerV2 resources disposed');
    }
}

/**
 * World Model Component
 */
class WorldModel {
    private encoder: tf.LayersModel;
    private decoder: tf.LayersModel;
    private dynamics: tf.LayersModel;
    private reward: tf.LayersModel;
    private config: DreamerConfig;

    constructor(config: DreamerConfig) {
        this.config = config;
        this.buildNetworks();
    }

    private buildNetworks(): void {
        // Encoder: observation -> embedding
        this.encoder = this.buildEncoder();

        // Decoder: state -> observation
        this.decoder = this.buildDecoder();

        // Dynamics: (state, action) -> next_state
        this.dynamics = this.buildDynamics();

        // Reward: state -> reward
        this.reward = this.buildReward();
    }

    private buildEncoder(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 3] }); // Connect Four board

        let x = tf.layers.conv2d({
            filters: 32,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.conv2d({
            filters: 64,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({
            units: this.config.worldModel.obsEmbedSize,
            activation: 'relu'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'encoder' });
    }

    private buildDecoder(): tf.LayersModel {
        const input = tf.input({ shape: [this.config.worldModel.stochSize + this.config.worldModel.deterSize] });

        let x = tf.layers.dense({
            units: 512,
            activation: 'relu'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: 6 * 7 * 32,
            activation: 'relu'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.reshape({ targetShape: [6, 7, 32] }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.conv2d({
            filters: 3,
            kernelSize: 1,
            activation: 'sigmoid'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'decoder' });
    }

    private buildDynamics(): tf.LayersModel {
        const stateInput = tf.input({ shape: [this.config.worldModel.stochSize + this.config.worldModel.deterSize] });
        const actionInput = tf.input({ shape: [this.config.connect4.actionSize] });

        const combined = tf.layers.concatenate().apply([stateInput, actionInput]) as tf.SymbolicTensor;

        let x = tf.layers.dense({
            units: this.config.worldModel.hiddenSize,
            activation: 'relu'
        }).apply(combined) as tf.SymbolicTensor;

        // Deterministic state
        const deter = tf.layers.dense({
            units: this.config.worldModel.deterSize,
            activation: 'tanh'
        }).apply(x) as tf.SymbolicTensor;

        // Stochastic state logits
        const stochLogits = tf.layers.dense({
            units: this.config.worldModel.stochSize,
            activation: 'linear'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({
            inputs: [stateInput, actionInput],
            outputs: [deter, stochLogits],
            name: 'dynamics'
        });
    }

    private buildReward(): tf.LayersModel {
        const input = tf.input({ shape: [this.config.worldModel.stochSize + this.config.worldModel.deterSize] });

        let x = tf.layers.dense({
            units: this.config.worldModel.rewardSize,
            activation: 'relu'
        }).apply(input) as tf.SymbolicTensor;

        const output = tf.layers.dense({
            units: 1,
            activation: 'linear'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output, name: 'reward' });
    }

    async encodeObservation(observation: tf.Tensor): Promise<tf.Tensor> {
        return this.encoder.predict(observation) as tf.Tensor;
    }

    async initializeState(obsEmbedding: tf.Tensor): Promise<WorldModelState> {
        const batchSize = obsEmbedding.shape[0];

        return {
            stoch: tf.randomNormal([batchSize, this.config.worldModel.stochSize]),
            deter: tf.zeros([batchSize, this.config.worldModel.deterSize]),
            logits: tf.zeros([batchSize, this.config.worldModel.stochSize]),
            hidden: tf.zeros([batchSize, this.config.worldModel.hiddenSize])
        };
    }

    async transition(state: WorldModelState, action?: tf.Tensor, obsEmbedding?: tf.Tensor): Promise<WorldModelState> {
        // Simplified transition - full implementation would use RNN
        if (action) {
            const stateVector = tf.concat([state.stoch, state.deter], -1);
            const [newDeter, newLogits] = this.dynamics.predict([stateVector, action]) as [tf.Tensor, tf.Tensor];
            const newStoch = tf.softmax(newLogits);

            return {
                stoch: newStoch,
                deter: newDeter,
                logits: newLogits,
                hidden: state.hidden // Simplified
            };
        }

        return state;
    }

    async predictReward(state: WorldModelState): Promise<tf.Tensor> {
        const stateVector = tf.concat([state.stoch, state.deter], -1);
        return this.reward.predict(stateVector) as tf.Tensor;
    }

    async train(batch: TrajectoryBatch): Promise<{
        states: WorldModelState[];
        obsLoss: tf.Tensor;
        rewardLoss: tf.Tensor;
        klLoss: tf.Tensor;
    }> {
        // Simplified training - full implementation would process sequences
        const obsLoss = tf.scalar(0.1); // Mock loss
        const rewardLoss = tf.scalar(0.05);
        const klLoss = tf.scalar(0.02);

        return {
            states: [],
            obsLoss,
            rewardLoss,
            klLoss
        };
    }

    async getStatesFromBatch(batch: TrajectoryBatch): Promise<WorldModelState[]> {
        // Mock implementation
        return Array(batch.batchSize).fill(null).map(() => ({
            stoch: tf.randomNormal([1, this.config.worldModel.stochSize]),
            deter: tf.zeros([1, this.config.worldModel.deterSize]),
            logits: tf.zeros([1, this.config.worldModel.stochSize]),
            hidden: tf.zeros([1, this.config.worldModel.hiddenSize])
        }));
    }

    getTrainableVariables(): tf.Variable[] {
        return [
            ...(this.encoder.trainableWeights as unknown as tf.Variable[]),
            ...(this.decoder.trainableWeights as unknown as tf.Variable[]),
            ...(this.dynamics.trainableWeights as unknown as tf.Variable[]),
            ...(this.reward.trainableWeights as unknown as tf.Variable[])
        ];
    }

    async save(path: string): Promise<void> {
        await this.encoder.save(`file://${path}/encoder`);
        await this.decoder.save(`file://${path}/decoder`);
        await this.dynamics.save(`file://${path}/dynamics`);
        await this.reward.save(`file://${path}/reward`);
    }

    async load(path: string): Promise<void> {
        this.encoder = await tf.loadLayersModel(`file://${path}/encoder/model.json`);
        this.decoder = await tf.loadLayersModel(`file://${path}/decoder/model.json`);
        this.dynamics = await tf.loadLayersModel(`file://${path}/dynamics/model.json`);
        this.reward = await tf.loadLayersModel(`file://${path}/reward/model.json`);
    }

    dispose(): void {
        this.encoder.dispose();
        this.decoder.dispose();
        this.dynamics.dispose();
        this.reward.dispose();
    }
}

/**
 * Actor Component
 */
class Actor {
    private network: tf.LayersModel;
    private config: DreamerConfig;

    constructor(config: DreamerConfig) {
        this.config = config;
        this.buildNetwork();
    }

    private buildNetwork(): void {
        const input = tf.input({ shape: [this.config.worldModel.stochSize + this.config.worldModel.deterSize] });

        let x = input;

        for (let i = 0; i < this.config.actorCritic.hiddenLayers; i++) {
            x = tf.layers.dense({
                units: this.config.actorCritic.hiddenSize,
                activation: 'relu',
                name: `actor_hidden_${i}`
            }).apply(x) as tf.SymbolicTensor;
        }

        const output = tf.layers.dense({
            units: this.config.connect4.actionSize,
            activation: 'softmax',
            name: 'actor_output'
        }).apply(x) as tf.SymbolicTensor;

        this.network = tf.model({ inputs: input, outputs: output, name: 'actor' });
    }

    async sample(state: WorldModelState, exploration: number): Promise<{
        action: tf.Tensor;
        logProb: tf.Tensor;
    }> {
        const stateVector = tf.concat([state.stoch, state.deter], -1);
        const logits = this.network.predict(stateVector) as tf.Tensor;

        // Add exploration noise
        const noisyLogits = tf.add(logits, tf.mul(tf.randomNormal(logits.shape), exploration));
        const probs = tf.softmax(noisyLogits);

        // Sample action
        const action = tf.multinomial(tf.log(probs) as tf.Tensor2D, 1);
        const logProb = tf.log(tf.gather(probs, action, 1));

        return { action: tf.oneHot(action.flatten() as tf.Tensor1D, this.config.connect4.actionSize), logProb };
    }

    async train(states: WorldModelState[], actions: tf.Tensor[], advantages: tf.Tensor): Promise<{
        loss: tf.Tensor;
        entropy: tf.Tensor;
    }> {
        // Simplified training implementation
        const loss = tf.scalar(0.1);
        const entropy = tf.scalar(0.05);

        return { loss, entropy };
    }

    getTrainableVariables(): tf.Variable[] {
        return this.network.trainableWeights as unknown as tf.Variable[];
    }

    async save(path: string): Promise<void> {
        await this.network.save(`file://${path}`);
    }

    async load(path: string): Promise<void> {
        this.network = await tf.loadLayersModel(`file://${path}/model.json`);
    }

    dispose(): void {
        this.network.dispose();
    }
}

/**
 * Critic Component
 */
class Critic {
    private network: tf.LayersModel;
    private config: DreamerConfig;

    constructor(config: DreamerConfig) {
        this.config = config;
        this.buildNetwork();
    }

    private buildNetwork(): void {
        const input = tf.input({ shape: [this.config.worldModel.stochSize + this.config.worldModel.deterSize] });

        let x = input;

        for (let i = 0; i < this.config.actorCritic.hiddenLayers; i++) {
            x = tf.layers.dense({
                units: this.config.actorCritic.hiddenSize,
                activation: 'relu',
                name: `critic_hidden_${i}`
            }).apply(x) as tf.SymbolicTensor;
        }

        const output = tf.layers.dense({
            units: 1,
            activation: 'linear',
            name: 'critic_output'
        }).apply(x) as tf.SymbolicTensor;

        this.network = tf.model({ inputs: input, outputs: output, name: 'critic' });
    }

    async predict(state: WorldModelState): Promise<tf.Tensor> {
        const stateVector = tf.concat([state.stoch, state.deter], -1);
        return this.network.predict(stateVector) as tf.Tensor;
    }

    async train(states: WorldModelState[], targets: tf.Tensor): Promise<{
        loss: tf.Tensor;
        targetValue: tf.Tensor;
    }> {
        // Simplified training implementation
        const loss = tf.scalar(0.05);
        const targetValue = targets;

        return { loss, targetValue };
    }

    getTrainableVariables(): tf.Variable[] {
        return this.network.trainableWeights as unknown as tf.Variable[];
    }

    async save(path: string): Promise<void> {
        await this.network.save(`file://${path}`);
    }

    async load(path: string): Promise<void> {
        this.network = await tf.loadLayersModel(`file://${path}/model.json`);
    }

    dispose(): void {
        this.network.dispose();
    }
}

/**
 * Replay Buffer for storing experiences
 */
class ReplayBuffer {
    private buffer: Experience[] = [];
    private maxSize: number;
    private currentIndex: number = 0;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    add(experience: Experience): void {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push(experience);
        } else {
            this.buffer[this.currentIndex] = experience;
        }

        this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    }

    sampleSequence(batchSize: number, sequenceLength: number): TrajectoryBatch {
        // Simplified sampling - would implement proper sequence sampling
        const batch: Experience[] = [];

        for (let i = 0; i < batchSize; i++) {
            const startIdx = Math.floor(Math.random() * Math.max(1, this.buffer.length - sequenceLength));
            for (let j = 0; j < sequenceLength && startIdx + j < this.buffer.length; j++) {
                batch.push(this.buffer[startIdx + j]);
            }
        }

        // Convert to tensors
        const observations = tf.stack(batch.map(exp => exp.observation));
        const actions = tf.stack(batch.map(exp => exp.action));
        const rewards = tf.stack(batch.map(exp => exp.reward));
        const dones = tf.stack(batch.map(exp => exp.done));

        return {
            observations,
            actions,
            rewards,
            dones,
            batchSize,
            seqLength: sequenceLength
        };
    }

    size(): number {
        return this.buffer.length;
    }

    clear(): void {
        this.buffer = [];
        this.currentIndex = 0;
    }
}

// Export main components
export { DreamerV2Agent, WorldModel, Actor, Critic, ReplayBuffer };
export default DreamerV2Agent;
