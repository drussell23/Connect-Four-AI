import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { Connect4DRLEnvironment, Connect4State } from '../../connect4DRL';

// Define environment types locally since they're not exported
type Connect4Environment = Connect4DRLEnvironment;
type EnvironmentObservation = Connect4State;

/**
 * MuZero Configuration Interface
 */
export interface MuZeroConfig {
    // Network architecture
    network: {
        representationSize: number;
        hiddenSize: number;
        actionSize: number;
        supportSize: number;

        // Network layers
        representationLayers: number[];
        dynamicsLayers: number[];
        predictionLayers: number[];

        // Activation functions
        activation: string;
        outputActivation: string;
    };

    // MCTS configuration
    mcts: {
        numSimulations: number;
        maxDepth: number;
        cPuct: number;
        dirichletAlpha: number;
        explorationFraction: number;

        // Progressive widening
        progressiveWidening: boolean;
        pwBase: number;
        pwAlpha: number;

        // Value bounds
        minValue: number;
        maxValue: number;

        // Search efficiency
        virtualLoss: number;
        parallelSimulations: number;
    };

    // Training configuration
    training: {
        batchSize: number;
        numUnrollSteps: number;
        tdSteps: number;
        valueLoss: number;
        policyLoss: number;

        // Learning rates
        learningRate: number;
        lrDecay: number;
        weightDecay: number;

        // Experience replay
        replayBufferSize: number;
        prioritizedReplay: boolean;
        priorityAlpha: number;
        priorityBeta: number;

        // Training schedule
        trainInterval: number;
        targetUpdateInterval: number;
        checkpointInterval: number;
    };

    // Self-play configuration
    selfPlay: {
        numActors: number;
        gamesPerIteration: number;
        temperature: number;
        temperatureThreshold: number;

        // Game settings
        maxGameLength: number;
        evaluationGames: number;
        evaluationInterval: number;
    };

    // Connect Four specific
    connect4: {
        boardSize: [number, number];
        actionSpace: number;
        winCondition: number;
        rewardScale: number;

        // Game-specific optimizations
        symmetryAugmentation: boolean;
        endgameTablebase: boolean;
        openingBook: boolean;
    };

    // Advanced features
    advanced: {
        useEnsemble: boolean;
        ensembleSize: number;
        uncertaintyEstimation: boolean;
        adaptiveSearch: boolean;
        modelDistillation: boolean;
        compressionRatio: number;
    };
}

export interface MuZeroState {
    representation: tf.Tensor;
    hiddenState: tf.Tensor;
    searchStatistics: MCTSStatistics;
    gameHistory: GameStep[];
}

export interface GameStep {
    observation: tf.Tensor;
    action: number;
    reward: number;
    value: number;
    policyProbs: number[];
    searchTree?: MCTSNode;
}

export interface MCTSNode {
    state: tf.Tensor;
    parent: MCTSNode | null;
    children: Map<number, MCTSNode>;

    // Visit statistics
    visitCount: number;
    totalActionValue: number;
    meanActionValue: number;
    priorProbability: number;

    // Value and policy predictions
    valueSum: number;
    rewardSum: number;
    predictedValue: number;
    policyLogits: number[];

    // Tree structure
    action: number;
    depth: number;
    isTerminal: boolean;

    // Uncertainty estimation
    valueUncertainty?: number;
    policyUncertainty?: number;

    // Progressive widening
    expandedActions: Set<number>;
    actionOrder: number[];
}

export interface MCTSStatistics {
    numSimulations: number;
    maxDepth: number;
    averageDepth: number;
    explorationRate: number;
    searchTime: number;
    nodesCreated: number;
    cacheHitRate: number;
    pruningRate: number;
}

export interface NetworkPrediction {
    value: number;
    policy: number[];
    reward?: number;
    hiddenState?: tf.Tensor;
    uncertainty?: {
        valueUncertainty: number;
        policyUncertainty: number;
    };
}

export interface TrainingBatch {
    observations: tf.Tensor;
    actions: tf.Tensor;
    targetValues: tf.Tensor;
    targetPolicies: tf.Tensor;
    targetRewards: tf.Tensor;
    weights: tf.Tensor;
    priorities: number[];
}

export interface MuZeroMetrics {
    // Training metrics
    training: {
        epoch: number;
        step: number;
        valueLoss: number;
        policyLoss: number;
        rewardLoss: number;
        totalLoss: number;
        learningRate: number;
        gradientNorm: number;
    };

    // Self-play metrics
    selfPlay: {
        gamesPlayed: number;
        winRate: number;
        averageGameLength: number;
        temperature: number;
        explorationRate: number;
    };

    // MCTS metrics
    mcts: {
        averageSimulations: number;
        averageDepth: number;
        searchTime: number;
        nodesPerSecond: number;
        cacheHitRate: number;
    };

    // Connect Four specific
    connect4: {
        strategicDepth: number;
        tacticalAccuracy: number;
        endgameStrength: number;
        openingVariety: number;
        positionEvaluation: number;
    };

    // Performance metrics
    performance: {
        trainingTime: number;
        inferenceTime: number;
        memoryUsage: number;
        modelSize: number;
        throughput: number;
    };
}

/**
 * MuZero Agent - Main class for MuZero algorithm
 */
export class MuZeroAgent {
    private config: MuZeroConfig;
    private networks: MuZeroNetworks;
    private replayBuffer: PrioritizedReplayBuffer;
    private searchTree: MCTSTree;

    // Training state
    private trainingStep: number = 0;
    private gameCount: number = 0;
    private metrics: MuZeroMetrics[] = [];

    private optimizer: tf.Optimizer;

    // Current game state
    private currentGame: GameStep[] = [];
    private temperature: number;

    constructor(config: Partial<MuZeroConfig> = {}) {
        this.config = this.getDefaultConfig(config);
        this.temperature = this.config.selfPlay.temperature;
        this.initializeComponents();
    }

    /**
     * Initialize all components
     */
    private initializeComponents(): void {
        this.networks = new MuZeroNetworks(this.config);
        this.replayBuffer = new PrioritizedReplayBuffer(
            this.config.training.replayBufferSize,
            this.config.training.priorityAlpha
        );
        this.searchTree = new MCTSTree(this.config);
        this.optimizer = tf.train.sgd(this.config.training.learningRate);
    }

    /**
     * Select action using MCTS search
     */
    async selectAction(
        observation: tf.Tensor,
        addExplorationNoise: boolean = true
    ): Promise<{
        action: number;
        searchStats: MCTSStatistics;
        policyProbs: number[];
        predictedValue: number;
    }> {
        const startTime = performance.now();

        // Get initial representation
        const representation = await this.networks.representation(observation);

        // Initialize root node
        const rootPrediction = await this.networks.prediction(representation);
        const root = this.searchTree.createRoot(representation, rootPrediction);

        // Add exploration noise to root
        if (addExplorationNoise) {
            this.addExplorationNoise(root);
        }

        // Run MCTS simulations
        const searchStats = await this.runMCTSSimulations(root);

        // Select action based on visit counts
        const { action, policyProbs } = this.selectActionFromSearchTree(root);

        const searchTime = performance.now() - startTime;
        searchStats.searchTime = searchTime;

        this.log('debug', 'Action selected', {
            action,
            simulations: searchStats.numSimulations,
            value: rootPrediction.value,
            searchTime: searchTime.toFixed(2)
        });

        return {
            action,
            searchStats,
            policyProbs,
            predictedValue: rootPrediction.value
        };
    }

    /**
     * Run MCTS simulations
     */
    private async runMCTSSimulations(root: MCTSNode): Promise<MCTSStatistics> {
        const stats: MCTSStatistics = {
            numSimulations: 0,
            maxDepth: 0,
            averageDepth: 0,
            explorationRate: 0,
            searchTime: 0,
            nodesCreated: 0,
            cacheHitRate: 0,
            pruningRate: 0
        };

        let totalDepth = 0;

        for (let sim = 0; sim < this.config.mcts.numSimulations; sim++) {
            const searchPath = this.searchTree.select(root);
            const leafNode = searchPath[searchPath.length - 1];

            // Expand leaf node
            if (!leafNode.isTerminal && leafNode.visitCount > 0) {
                await this.expandNode(leafNode);
            }

            // Evaluate leaf node
            const value = await this.evaluateNode(leafNode);

            // Backup value through search path
            this.backup(searchPath, value, stats);

            stats.numSimulations++;
            totalDepth += searchPath.length;
            stats.maxDepth = Math.max(stats.maxDepth, searchPath.length);
        }

        stats.averageDepth = totalDepth / stats.numSimulations;

        return stats;
    }

    /**
     * Expand a node by adding children
     */
    private async expandNode(node: MCTSNode): Promise<void> {
        if (node.children.size > 0) return; // Already expanded

        // Get dynamics prediction
        const actionsToExpand = this.getActionsToExpand(node);

        for (const action of actionsToExpand) {
            // Predict next state and reward
            const { nextState, reward } = await this.networks.dynamics(node.state, action);

            // Get prediction for next state
            const prediction = await this.networks.prediction(nextState);

            // Create child node
            const child = this.searchTree.createChild(node, action, nextState, prediction, reward);

            // Check if terminal (simplified for Connect Four)
            child.isTerminal = this.isTerminalState(nextState, action);
        }
    }

    /**
     * Evaluate a node
     */
    private async evaluateNode(node: MCTSNode): Promise<number> {
        if (node.isTerminal) {
            return this.getTerminalValue(node);
        }

        // Use predicted value from network
        return node.predictedValue;
    }

    /**
     * Backup value through search path
     */
    private backup(searchPath: MCTSNode[], value: number, stats: MCTSStatistics): void {
        for (let i = searchPath.length - 1; i >= 0; i--) {
            const node = searchPath[i];

            node.visitCount++;
            node.valueSum += value;
            node.meanActionValue = node.valueSum / node.visitCount;

            // Add virtual loss and discount
            value = (value + node.rewardSum) * 0.95; // Discount factor
        }

        stats.nodesCreated += searchPath.length;
    }

    /**
     * Select action from search tree visit counts
     */
    private selectActionFromSearchTree(root: MCTSNode): {
        action: number;
        policyProbs: number[];
    } {
        const visitCounts = new Array(this.config.connect4.actionSpace).fill(0);

        // Collect visit counts
        for (const [action, child] of root.children) {
            visitCounts[action] = child.visitCount;
        }

        // Apply temperature
        let policyProbs: number[];
        if (this.temperature === 0) {
            // Greedy selection
            const bestAction = this.argmax(visitCounts);
            policyProbs = new Array(this.config.connect4.actionSpace).fill(0);
            policyProbs[bestAction] = 1;
        } else {
            // Temperature-based sampling
            policyProbs = this.softmax(visitCounts.map(count => Math.log(count + 1e-8) / this.temperature));
        }

        // Sample action
        const action = this.sampleFromDistribution(policyProbs);

        return { action, policyProbs };
    }

    /**
     * Train the networks using replay buffer
     */
    async train(): Promise<MuZeroMetrics['training']> {
        const startTime = performance.now();

        // Sample training batch
        const batch = this.replayBuffer.sample(
            this.config.training.batchSize,
            this.config.training.priorityBeta
        );

        // Compute losses and gradients
        const { losses, priorities } = await this.computeLosses(batch);

        // Apply gradients
        const grads = tf.variableGrads(() => losses.totalLoss as tf.Scalar);

        // Fix dispose issue - cast to tf.Tensor
        const gradientNorm = this.clipGradients(
            Object.fromEntries(
                Object.entries(grads.grads).map(([k, v]) => [k, v as tf.Tensor])
            ),
            1.0
        );

        this.optimizer.applyGradients(grads.grads);

        // Update replay buffer priorities
        this.replayBuffer.updatePriorities(
            Array.from({ length: batch.priorities.length }, (_, i) => i),
            priorities
        );

        // Update training step
        this.trainingStep++;

        const trainingTime = performance.now() - startTime;

        const metrics = {
            epoch: Math.floor(this.trainingStep / 1000),
            step: this.trainingStep,
            valueLoss: losses.valueLoss.dataSync()[0],
            policyLoss: losses.policyLoss.dataSync()[0],
            rewardLoss: losses.rewardLoss?.dataSync()[0] || 0,
            totalLoss: losses.totalLoss.dataSync()[0],
            learningRate: this.config.training.learningRate,
            gradientNorm
        };

        // Cleanup - fix dispose issue with proper type casting
        Object.values(losses).forEach(loss => loss.dispose());
        Object.values(grads.grads).forEach(grad => (grad as tf.Tensor).dispose());

        this.log('debug', 'Training step completed', {
            step: metrics.step,
            totalLoss: metrics.totalLoss.toFixed(4),
            valueLoss: metrics.valueLoss.toFixed(4),
            policyLoss: metrics.policyLoss.toFixed(4),
            trainingTime: trainingTime.toFixed(2)
        });

        return metrics;
    }

    /**
     * Self-play training loop
     */
    async selfPlay(environment: Connect4Environment, games: number): Promise<MuZeroMetrics[]> {
        const allMetrics: MuZeroMetrics[] = [];

        this.log('info', 'Starting self-play training', {
            games,
            simulations: this.config.mcts.numSimulations,
            temperature: this.temperature
        });

        for (let game = 0; game < games; game++) {
            const gameMetrics = await this.playGame(environment);

            // Store game in replay buffer
            this.storeGameInReplayBuffer();

            // Train network periodically
            if (this.gameCount % this.config.training.trainInterval === 0) {
                const trainingMetrics = await this.train();

                const fullMetrics: MuZeroMetrics = {
                    training: trainingMetrics,
                    selfPlay: gameMetrics.selfPlay,
                    mcts: gameMetrics.mcts,
                    connect4: gameMetrics.connect4,
                    performance: gameMetrics.performance
                };

                allMetrics.push(fullMetrics);
                this.metrics.push(fullMetrics);
            }

            // Update temperature
            this.updateTemperature();

            // Log progress
            if (game % 50 === 0) {
                this.log('info', `Self-play game ${game}/${games}`, {
                    winRate: gameMetrics.selfPlay.winRate,
                    averageLength: gameMetrics.selfPlay.averageGameLength,
                    temperature: this.temperature
                });
            }
        }

        return allMetrics;
    }

    /**
     * Play a single game
     */
    private async playGame(environment: Connect4Environment): Promise<Partial<MuZeroMetrics>> {
        const startTime = performance.now();
        this.currentGame = [];

        let observation = environment.reset();
        let done = false;
        let gameLength = 0;
        let totalSearchTime = 0;
        let totalSimulations = 0;

        while (!done && gameLength < this.config.selfPlay.maxGameLength) {
            // Convert observation to tensor
            const observationTensor = this.observationToTensor(observation);

            // Select action using MCTS
            const actionResult = await this.selectAction(observationTensor, true);

            // Take action in environment
            const stepResult = environment.step(actionResult.action);

            // Store game step
            const gameStep: GameStep = {
                observation: observationTensor,
                action: actionResult.action,
                reward: stepResult.reward,
                value: actionResult.predictedValue,
                policyProbs: actionResult.policyProbs
            };

            this.currentGame.push(gameStep);

            // Update state
            observation = stepResult.nextState;
            done = stepResult.done;
            gameLength++;
            totalSearchTime += actionResult.searchStats.searchTime;
            totalSimulations += actionResult.searchStats.numSimulations;
        }

        const gameTime = performance.now() - startTime;
        this.gameCount++;

        // Calculate game outcome
        const winner = done ? null : null; // Will be determined from game state later
        const winRate = winner === 'Red' ? 1 : winner === 'Yellow' ? 0 : 0.5; // Assume AI is Red

        return {
            selfPlay: {
                gamesPlayed: this.gameCount,
                winRate,
                averageGameLength: gameLength,
                temperature: this.temperature,
                explorationRate: this.config.mcts.explorationFraction
            },
            mcts: {
                averageSimulations: totalSimulations / gameLength,
                averageDepth: 0, // Would calculate from search stats
                searchTime: totalSearchTime / gameLength,
                nodesPerSecond: totalSimulations / (totalSearchTime / 1000),
                cacheHitRate: 0.8 // Mock value
            },
            connect4: {
                strategicDepth: this.calculateStrategicDepth(),
                tacticalAccuracy: this.calculateTacticalAccuracy(),
                endgameStrength: this.calculateEndgameStrength(),
                openingVariety: this.calculateOpeningVariety(),
                positionEvaluation: 0.5 // Mock value
            },
            performance: {
                trainingTime: 0,
                inferenceTime: totalSearchTime / gameLength,
                memoryUsage: this.getMemoryUsage(),
                modelSize: this.getModelSize(),
                throughput: gameLength / (gameTime / 1000)
            }
        };
    }

    /**
     * Store current game in replay buffer
     */
    private storeGameInReplayBuffer(): void {
        const gameLength = this.currentGame.length;

        for (let i = 0; i < gameLength; i++) {
            const step = this.currentGame[i];

            // Calculate n-step returns
            const targetValue = this.calculateNStepReturn(i);
            const targetPolicy = step.policyProbs;
            const targetReward = i < gameLength - 1 ? this.currentGame[i + 1].reward : 0;

            // Calculate priority (TD error approximation)
            const priority = Math.abs(targetValue - step.value) + 1e-6;

            this.replayBuffer.add({
                observation: step.observation,
                action: step.action,
                targetValue,
                targetPolicy,
                targetReward
            }, priority);
        }
    }

    /**
     * Calculate n-step return for value target
     */
    private calculateNStepReturn(stepIndex: number): number {
        const gameLength = this.currentGame.length;
        const nSteps = Math.min(this.config.training.tdSteps, gameLength - stepIndex);

        let returns = 0;
        let discount = 1;

        for (let i = stepIndex; i < stepIndex + nSteps; i++) {
            returns += discount * this.currentGame[i].reward;
            discount *= 0.95; // Discount factor
        }

        // Add bootstrap value if not terminal
        if (stepIndex + nSteps < gameLength) {
            returns += discount * this.currentGame[stepIndex + nSteps].value;
        }

        return returns;
    }

    // === Helper Methods ===

    private observationToTensor(observation: EnvironmentObservation): tf.Tensor {
        return tf.tensor(observation.board);
    }

    private addExplorationNoise(node: MCTSNode): void {
        const alpha = this.config.mcts.dirichletAlpha;
        const noise = this.sampleDirichlet(alpha, this.config.connect4.actionSpace);
        const fraction = this.config.mcts.explorationFraction;

        // Mix prior probabilities with noise
        for (let i = 0; i < node.policyLogits.length; i++) {
            node.policyLogits[i] = (1 - fraction) * node.policyLogits[i] + fraction * noise[i];
        }
    }

    private getActionsToExpand(node: MCTSNode): number[] {
        if (!this.config.mcts.progressiveWidening) {
            return Array.from({ length: this.config.connect4.actionSpace }, (_, i) => i);
        }

        // Progressive widening: limit number of children
        const maxChildren = Math.ceil(this.config.mcts.pwBase + this.config.mcts.pwAlpha * Math.sqrt(node.visitCount));
        const availableActions = Array.from({ length: this.config.connect4.actionSpace }, (_, i) => i);

        // Sort actions by prior probability
        availableActions.sort((a, b) => node.policyLogits[b] - node.policyLogits[a]);

        return availableActions.slice(0, Math.min(maxChildren, this.config.connect4.actionSpace));
    }

    private isTerminalState(state: tf.Tensor, lastAction: number): boolean {
        // Simplified terminal check - would implement actual Connect Four logic
        return false;
    }

    private getTerminalValue(node: MCTSNode): number {
        // Return terminal value based on Connect Four game state
        return node.predictedValue;
    }

    private async computeLosses(batch: TrainingBatch): Promise<{
        losses: {
            valueLoss: tf.Tensor;
            policyLoss: tf.Tensor;
            rewardLoss?: tf.Tensor;
            totalLoss: tf.Tensor;
        };
        priorities: number[];
    }> {
        // Forward pass through networks
        const representations = await this.networks.representation(batch.observations);

        // Fix: predictions should be processed correctly
        const batchSize = batch.observations.shape[0];
        const predictions: NetworkPrediction[] = [];

        // Process each sample in the batch
        for (let i = 0; i < batchSize; i++) {
            const stateTensor = representations.slice([i, 0], [1, -1]);
            const prediction = await this.networks.prediction(stateTensor);
            predictions.push(prediction);
        }

        // Extract values and policies from predictions
        const predictedValues = tf.tensor1d(predictions.map(p => p.value));
        const predictedPolicies = tf.stack(predictions.map(p => tf.tensor1d(p.policy)));

        // Compute losses
        const valueLoss = tf.mean(tf.square(tf.sub(batch.targetValues, predictedValues)));
        const policyLoss = tf.mean(tf.losses.softmaxCrossEntropy(batch.targetPolicies, predictedPolicies));
        const totalLoss = tf.add(
            tf.mul(valueLoss, this.config.training.valueLoss),
            tf.mul(policyLoss, this.config.training.policyLoss)
        );

        const priorities = this.calculatePriorities(batch, predictions);

        return {
            losses: { valueLoss, policyLoss, totalLoss },
            priorities
        };
    }

    private calculatePriorities(batch: TrainingBatch, predictions: any): number[] {
        // Simplified priority calculation
        return Array(batch.observations.shape[0]).fill(1.0);
    }

    private clipGradients(gradients: { [name: string]: tf.Tensor }, clipNorm: number): number {
        let totalNorm = 0;
        Object.values(gradients).forEach(grad => {
            const norm = tf.norm(grad).dataSync()[0];
            totalNorm += norm * norm;
        });

        const gradNorm = Math.sqrt(totalNorm);

        if (gradNorm > clipNorm) {
            const scale = clipNorm / gradNorm;
            Object.keys(gradients).forEach(name => {
                const scaled = tf.mul(gradients[name], scale);
                gradients[name].dispose();
                gradients[name] = scaled;
            });
        }

        return gradNorm;
    }

    private updateTemperature(): void {
        if (this.gameCount > this.config.selfPlay.temperatureThreshold) {
            this.temperature = 0; // Switch to greedy
        }
    }

    private calculateStrategicDepth(): number {
        // Analyze game for strategic depth
        return 0.7; // Mock value
    }

    private calculateTacticalAccuracy(): number {
        // Analyze tactical move accuracy
        return 0.85; // Mock value
    }

    private calculateEndgameStrength(): number {
        // Analyze endgame performance
        return 0.9; // Mock value
    }

    private calculateOpeningVariety(): number {
        // Analyze opening move variety
        return 0.6; // Mock value
    }

    private createEmptyTrainingMetrics(): MuZeroMetrics['training'] {
        return {
            epoch: 0,
            step: 0,
            valueLoss: 0,
            policyLoss: 0,
            rewardLoss: 0,
            totalLoss: 0,
            learningRate: this.config.training.learningRate,
            gradientNorm: 0
        };
    }

    private getMemoryUsage(): number {
        return tf.memory().numBytes / (1024 * 1024);
    }

    private getModelSize(): number {
        return this.networks.getParameterCount();
    }

    // === Utility Functions ===

    private argmax(array: number[]): number {
        let maxIndex = 0;
        let maxValue = array[0];

        for (let i = 1; i < array.length; i++) {
            if (array[i] > maxValue) {
                maxValue = array[i];
                maxIndex = i;
            }
        }

        return maxIndex;
    }

    private softmax(values: number[]): number[] {
        const max = Math.max(...values);
        const exp = values.map(v => Math.exp(v - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(v => v / sum);
    }

    private sampleFromDistribution(probs: number[]): number {
        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < probs.length; i++) {
            cumulative += probs[i];
            if (random < cumulative) {
                return i;
            }
        }

        return probs.length - 1;
    }

    private sampleDirichlet(alpha: number, size: number): number[] {
        // Simplified Dirichlet sampling
        const samples = Array(size).fill(0).map(() => Math.random());
        const sum = samples.reduce((a, b) => a + b, 0);
        return samples.map(s => s / sum);
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [MuZero] [${level.toUpperCase()}] ${message}`;

        if (data) {
            console[level](logMessage, data);
        } else {
            console[level](logMessage);
        }
    }

    /**
     * Get training metrics
     */
    getMetrics(): MuZeroMetrics[] {
        return [...this.metrics];
    }

    /**
     * Save model checkpoints
     */
    async save(path: string): Promise<void> {
        await this.networks.save(path);
        this.log('info', 'Model saved', { path });
    }

    /**
     * Load model checkpoints
     */
    async load(path: string): Promise<void> {
        await this.networks.load(path);
        this.log('info', 'Model loaded', { path });
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.networks.dispose();
        this.optimizer.dispose();
        this.replayBuffer.clear();
        this.log('info', 'MuZero resources disposed');
    }

    private getDefaultConfig(config: Partial<MuZeroConfig>): MuZeroConfig {
        return {
            network: {
                representationSize: 256,
                hiddenSize: 256,
                actionSize: 7,
                supportSize: 21,
                representationLayers: [512, 256],
                dynamicsLayers: [512, 256],
                predictionLayers: [256, 128],
                activation: 'relu',
                outputActivation: 'linear'
            },
            mcts: {
                numSimulations: 50,
                maxDepth: 10,
                cPuct: 1.0,
                dirichletAlpha: 0.3,
                explorationFraction: 0.25,
                progressiveWidening: true,
                pwBase: 19652,
                pwAlpha: 0.5,
                minValue: -1,
                maxValue: 1,
                virtualLoss: 3,
                parallelSimulations: 1
            },
            training: {
                batchSize: 32,
                numUnrollSteps: 5,
                tdSteps: 5,
                valueLoss: 0.25,
                policyLoss: 1.0,
                learningRate: 0.001,
                lrDecay: 0.95,
                weightDecay: 0.0001,
                replayBufferSize: 10000,
                prioritizedReplay: true,
                priorityAlpha: 0.6,
                priorityBeta: 0.4,
                trainInterval: 1000,
                targetUpdateInterval: 200,
                checkpointInterval: 10000
            },
            selfPlay: {
                numActors: 1,
                gamesPerIteration: 100,
                temperature: 1.0,
                temperatureThreshold: 30,
                maxGameLength: 512,
                evaluationGames: 32,
                evaluationInterval: 1000
            },
            connect4: {
                boardSize: [6, 7],
                actionSpace: 7,
                winCondition: 4,
                rewardScale: 1.0,
                symmetryAugmentation: true,
                endgameTablebase: false,
                openingBook: false
            },
            advanced: {
                useEnsemble: false,
                ensembleSize: 5,
                uncertaintyEstimation: false,
                adaptiveSearch: true,
                modelDistillation: false,
                compressionRatio: 0.5
            },
            ...config
        };
    }
}

/**
 * MuZero Neural Networks
 */
class MuZeroNetworks {
    private representationNet: tf.LayersModel;
    private dynamicsNet: tf.LayersModel;
    private predictionNet: tf.LayersModel;
    private config: MuZeroConfig;

    constructor(config: MuZeroConfig) {
        this.config = config;
        this.buildNetworks();
    }

    private buildNetworks(): void {
        this.representationNet = this.buildRepresentationNetwork();
        this.dynamicsNet = this.buildDynamicsNetwork();
        this.predictionNet = this.buildPredictionNetwork();
    }

    private buildRepresentationNetwork(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x = input;

        // Build representation layers
        for (let i = 0; i < this.config.network.representationLayers.length; i++) {
            const units = this.config.network.representationLayers[i];
            x = tf.layers.dense({
                units,
                activation: 'relu' as any,
                name: `repr_dense_${i}`
            }).apply(x) as tf.SymbolicTensor;
        }

        return tf.model({ inputs: input, outputs: x });
    }

    private buildDynamicsNetwork(): tf.LayersModel {
        const stateInput = tf.input({
            shape: [this.config.network.representationSize],
            name: 'state_input'
        });
        const actionInput = tf.input({
            shape: [this.config.network.actionSize],
            name: 'action_input'
        });

        const concat = tf.layers.concatenate().apply([stateInput, actionInput]);
        let x = concat;

        // Build dynamics layers
        for (let i = 0; i < this.config.network.dynamicsLayers.length; i++) {
            const units = this.config.network.dynamicsLayers[i];
            x = tf.layers.dense({
                units,
                activation: 'relu' as any,
                name: `dyn_dense_${i}`
            }).apply(x) as tf.SymbolicTensor;
        }

        return tf.model({ inputs: [stateInput, actionInput], outputs: x as tf.SymbolicTensor });
    }

    private buildPredictionNetwork(): tf.LayersModel {
        const input = tf.input({ shape: [this.config.network.representationSize] });
        let x = input;

        // Build prediction layers
        for (let i = 0; i < this.config.network.predictionLayers.length; i++) {
            const units = this.config.network.predictionLayers[i];
            x = tf.layers.dense({
                units,
                activation: 'relu' as any,
                name: `pred_dense_${i}`
            }).apply(x) as tf.SymbolicTensor;
        }

        // Value head
        const valueHead = tf.layers.dense({
            units: 1,
            activation: 'tanh',
            name: 'value_head'
        }).apply(x) as tf.SymbolicTensor;

        // Policy head
        const policyHead = tf.layers.dense({
            units: this.config.network.actionSize,
            activation: 'softmax',
            name: 'policy_head'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: [valueHead, policyHead] });
    }

    async representation(observation: tf.Tensor): Promise<tf.Tensor> {
        return this.representationNet.predict(observation) as tf.Tensor;
    }

    async dynamics(state: tf.Tensor, action: number): Promise<{
        nextState: tf.Tensor;
        reward: number;
    }> {
        const actionTensor = tf.oneHot(action, this.config.network.actionSize);
        const nextState = this.dynamicsNet.predict([state, actionTensor]) as tf.Tensor;
        const reward = Math.random() * 2 - 1; // Placeholder
        return { nextState, reward };
    }

    async prediction(state: tf.Tensor): Promise<NetworkPrediction> {
        const [valueLogits, policyLogits] = this.predictionNet.predict(state) as [tf.Tensor, tf.Tensor];

        const value = this.scalarFromLogits(valueLogits);
        // Fix: properly type the array conversion
        const policy = Array.from(policyLogits.dataSync()) as number[];

        return { value, policy };
    }

    private scalarFromLogits(logits: tf.Tensor): number {
        const scalar = tf.scalar(logits.dataSync()[0]);
        return scalar.dataSync()[0];
    }

    getTrainableVariables(): tf.Variable[] {
        const allVars = [
            ...this.representationNet.trainableWeights,
            ...this.dynamicsNet.trainableWeights,
            ...this.predictionNet.trainableWeights
        ];

        return allVars as unknown as tf.Variable[];
    }

    getParameterCount(): number {
        return this.getTrainableVariables().reduce((sum, variable) => {
            return sum + variable.shape.reduce((prod, dim) => prod * dim, 1);
        }, 0);
    }

    async save(path: string): Promise<void> {
        await this.representationNet.save(`file://${path}/representation`);
        await this.dynamicsNet.save(`file://${path}/dynamics`);
        await this.predictionNet.save(`file://${path}/prediction`);
    }

    async load(path: string): Promise<void> {
        this.representationNet = await tf.loadLayersModel(`file://${path}/representation`);
        this.dynamicsNet = await tf.loadLayersModel(`file://${path}/dynamics`);
        this.predictionNet = await tf.loadLayersModel(`file://${path}/prediction`);
    }

    dispose(): void {
        this.representationNet.dispose();
        this.dynamicsNet.dispose();
        this.predictionNet.dispose();
    }
}

/**
 * MCTS Tree for search
 */
class MCTSTree {
    private config: MuZeroConfig;

    constructor(config: MuZeroConfig) {
        this.config = config;
    }

    createRoot(state: tf.Tensor, prediction: NetworkPrediction): MCTSNode {
        return {
            state,
            parent: null,
            children: new Map(),
            visitCount: 0,
            totalActionValue: 0,
            meanActionValue: 0,
            priorProbability: 1.0,
            valueSum: 0,
            rewardSum: 0,
            predictedValue: prediction.value,
            policyLogits: prediction.policy,
            action: -1,
            depth: 0,
            isTerminal: false,
            expandedActions: new Set(),
            actionOrder: []
        };
    }

    createChild(
        parent: MCTSNode,
        action: number,
        state: tf.Tensor,
        prediction: NetworkPrediction,
        reward: number
    ): MCTSNode {
        const child: MCTSNode = {
            state,
            parent,
            children: new Map(),
            visitCount: 0,
            totalActionValue: 0,
            meanActionValue: 0,
            priorProbability: prediction.policy[action],
            valueSum: 0,
            rewardSum: reward,
            predictedValue: prediction.value,
            policyLogits: prediction.policy,
            action,
            depth: parent.depth + 1,
            isTerminal: false,
            expandedActions: new Set(),
            actionOrder: []
        };

        parent.children.set(action, child);
        return child;
    }

    select(root: MCTSNode): MCTSNode[] {
        const path: MCTSNode[] = [];
        let current = root;

        while (!current.isTerminal && current.children.size > 0) {
            path.push(current);
            current = this.selectBestChild(current);
        }

        path.push(current);
        return path;
    }

    private selectBestChild(node: MCTSNode): MCTSNode {
        let bestChild: MCTSNode | null = null;
        let bestValue = -Infinity;

        for (const [action, child] of node.children) {
            const uctValue = this.calculateUCTValue(child, node);

            if (uctValue > bestValue) {
                bestValue = uctValue;
                bestChild = child;
            }
        }

        return bestChild!;
    }

    private calculateUCTValue(child: MCTSNode, parent: MCTSNode): number {
        if (child.visitCount === 0) {
            return Infinity; // Prioritize unvisited nodes
        }

        const qValue = child.meanActionValue;
        const uValue = this.config.mcts.cPuct * child.priorProbability *
            Math.sqrt(parent.visitCount) / (1 + child.visitCount);

        return qValue + uValue;
    }
}

/**
 * Prioritized Replay Buffer
 */
class PrioritizedReplayBuffer {
    private buffer: Array<{
        data: any;
        priority: number;
        index: number;
    }> = [];

    private maxSize: number;
    private alpha: number;
    private currentIndex: number = 0;
    private maxPriority: number = 1.0;

    constructor(maxSize: number, alpha: number) {
        this.maxSize = maxSize;
        this.alpha = alpha;
    }

    add(data: any, priority: number): void {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push({ data, priority, index: this.currentIndex });
        } else {
            this.buffer[this.currentIndex % this.maxSize] = { data, priority, index: this.currentIndex };
        }
        this.currentIndex++;
        this.maxPriority = Math.max(this.maxPriority, priority);
    }

    sample(batchSize: number, beta: number): TrainingBatch {
        // Simplified sampling for now
        const samples = [];
        for (let i = 0; i < batchSize; i++) {
            samples.push(this.sampleOne());
        }

        // Create mock training batch
        return {
            observations: tf.zeros([batchSize, 6, 7, 1]),
            actions: tf.zeros([batchSize]),
            targetValues: tf.zeros([batchSize]),
            targetPolicies: tf.zeros([batchSize, 7]),
            targetRewards: tf.zeros([batchSize]),
            weights: tf.ones([batchSize]),
            priorities: new Array(batchSize).fill(1.0)
        };
    }

    private sampleOne(): any {
        const index = Math.floor(Math.random() * this.buffer.length);
        return this.buffer[index];
    }

    updatePriorities(indices: number[], newPriorities: number[]): void {
        for (let i = 0; i < indices.length; i++) {
            if (indices[i] < this.buffer.length) {
                this.buffer[indices[i]].priority = newPriorities[i];
            }
        }
    }

    size(): number {
        return this.buffer.length;
    }

    clear(): void {
        this.buffer = [];
        this.currentIndex = 0;
        this.maxPriority = 1.0;
    }
}

// Export only once at the end
export { MuZeroNetworks, MCTSTree, PrioritizedReplayBuffer };
export default MuZeroAgent;
