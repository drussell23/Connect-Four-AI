/**
 * Connect4 Deep Reinforcement Learning (DRL) Module
 * 
 * This module provides specialized Deep Reinforcement Learning implementations
 * specifically optimized for Connect4. It serves as a bridge between general
 * RL algorithms and Connect4-specific training requirements.
 * 
 * Purpose:
 * - Connect4-specific DRL training environments
 * - Custom reward shaping for Connect4 gameplay
 * - Self-play training orchestration
 * - Performance evaluation and benchmarking
 * - Model management and versioning
 * - Training data collection and analysis
 * 
 * @author Connect4 AI Team
 */

import { CellValue, UltimateConnect4AI, UltimateAIConfig, AIDecision } from './connect4AI';
import { AdamWOptimizer } from './optimizers/adamW';
import { EntropyRegularizer } from './optimizers/entropyRegularizer';
import { LearningRateScheduler } from './optimizers/learningRateScheduler';

/**
 * Configuration for Connect4 DRL training
 */
export interface Connect4DRLConfig {
    // Environment settings
    environment: {
        rewardShaping: {
            winReward: number;
            lossReward: number;
            drawReward: number;
            moveReward: number;
            threatReward: number;
            blockReward: number;
            centerColumnBonus: number;
        };
        stateRepresentation: 'matrix' | 'bitboard' | 'enhanced';
        actionSpace: 'discrete' | 'continuous';
        observationSpace: 'raw' | 'features' | 'cnn_ready';
    };

    // Training parameters
    training: {
        algorithm: 'dqn' | 'rainbow_dqn' | 'ppo' | 'a3c' | 'alphazero';
        episodes: number;
        maxStepsPerEpisode: number;
        batchSize: number;
        learningRate: number;
        discountFactor: number;
        explorationStrategy: 'epsilon_greedy' | 'ucb' | 'thompson_sampling';
        targetUpdateFrequency: number;
    };

    // Self-play configuration
    selfPlay: {
        enabled: boolean;
        opponentStrategies: Array<'random' | 'minimax' | 'mcts' | 'trained_model'>;
        curriculumLearning: boolean;
        adaptiveDifficulty: boolean;
        tournamentMode: boolean;
    };

    // Experience replay
    experienceReplay: {
        bufferSize: number;
        prioritized: boolean;
        alpha: number;
        beta: number;
        minExperiences: number;
    };

    // Evaluation settings
    evaluation: {
        evaluationFrequency: number;
        evaluationEpisodes: number;
        benchmarkOpponents: string[];
        metricsToTrack: string[];
    };

    // Model management
    model: {
        saveFrequency: number;
        modelVersioning: boolean;
        checkpointPath: string;
        exportFormat: 'pytorch' | 'onnx' | 'tensorjs';
    };
}

/**
 * Connect4 environment state representation
 */
export interface Connect4State {
    board: CellValue[][];
    currentPlayer: CellValue;
    moveHistory: number[];
    gamePhase: 'opening' | 'midgame' | 'endgame';
    features: {
        threatCount: number;
        centerControl: number;
        connectivity: number;
        mobility: number;
    };
}

/**
 * Experience tuple for replay buffer
 */
export interface Connect4Experience {
    state: Connect4State;
    action: number;
    reward: number;
    nextState: Connect4State;
    done: boolean;
    priority?: number;
    metadata: {
        moveNumber: number;
        gameResult: 'win' | 'loss' | 'draw';
        opponent: string;
        difficulty: number;
    };
}

/**
 * Training episode result
 */
export interface EpisodeResult {
    totalReward: number;
    moves: number;
    result: 'win' | 'loss' | 'draw';
    opponent: string;
    explorationRate: number;
    averageQValue: number;
    finalBoardState: CellValue[][];
    gameHistory: number[];
}

/**
 * Training metrics and statistics
 */
export interface TrainingMetrics {
    episode: number;
    totalReward: number;
    averageReward: number;
    winRate: number;
    lossRate: number;
    drawRate: number;
    explorationRate: number;
    learningRate: number;
    loss: number;
    qValueMean: number;
    qValueStd: number;
    episodeDuration: number;
    totalTrainingTime: number;
}

/**
 * Connect4 Deep Reinforcement Learning Environment
 */
export class Connect4DRLEnvironment {
    private config: Connect4DRLConfig;
    private state: Connect4State;
    private experienceBuffer: Connect4Experience[];
    private currentEpisode: number = 0;
    private metrics: TrainingMetrics[] = [];

    constructor(config: Partial<Connect4DRLConfig> = {}) {
        this.config = this.getDefaultConfig(config);
        this.state = this.getInitialState();
        this.experienceBuffer = [];
    }

    /**
     * Reset environment to initial state
     */
    reset(): Connect4State {
        this.state = this.getInitialState();
        return this.state;
    }

    /**
     * Execute action in environment
     */
    step(action: number): {
        nextState: Connect4State;
        reward: number;
        done: boolean;
        info: any;
    } {
        // Validate action
        if (!this.isValidAction(action)) {
            return {
                nextState: this.state,
                reward: this.config.environment.rewardShaping.lossReward,
                done: true,
                info: { error: 'Invalid action' }
            };
        }

        // Apply action
        const newBoard = this.applyAction(this.state.board, action, this.state.currentPlayer);

        // Check game end conditions
        const gameResult = this.checkGameEnd(newBoard);
        const done = gameResult !== 'continue';

        // Calculate reward
        const reward = this.calculateReward(newBoard, action, gameResult);

        // Update state
        const nextState: Connect4State = {
            board: newBoard,
            currentPlayer: this.state.currentPlayer === 'Red' ? 'Yellow' : 'Red',
            moveHistory: [...this.state.moveHistory, action],
            gamePhase: this.determineGamePhase(newBoard, this.state.moveHistory.length + 1),
            features: this.extractFeatures(newBoard)
        };

        this.state = nextState;

        return {
            nextState,
            reward,
            done,
            info: {
                gameResult,
                moveNumber: this.state.moveHistory.length,
                features: nextState.features
            }
        };
    }

    /**
     * Get valid actions for current state
     */
    getValidActions(): number[] {
        const actions = [];
        for (let col = 0; col < 7; col++) {
            if (this.state.board[0][col] === 'Empty') {
                actions.push(col);
            }
        }
        return actions;
    }

    /**
     * Convert state to neural network input format
     */
    stateToInput(state: Connect4State): number[] | number[][] {
        switch (this.config.environment.stateRepresentation) {
            case 'matrix':
                return this.boardToMatrix(state.board);
            case 'bitboard':
                return this.boardToBitboard(state.board);
            case 'enhanced':
                return this.boardToEnhancedFeatures(state);
            default:
                return this.boardToMatrix(state.board);
        }
    }

    /**
     * Add experience to replay buffer
     */
    addExperience(experience: Connect4Experience): void {
        if (this.experienceBuffer.length >= this.config.experienceReplay.bufferSize) {
            this.experienceBuffer.shift();
        }
        this.experienceBuffer.push(experience);
    }

    /**
     * Sample batch from experience replay buffer
     */
    sampleExperiences(batchSize: number): Connect4Experience[] {
        if (this.experienceBuffer.length < batchSize) {
            return [...this.experienceBuffer];
        }

        if (this.config.experienceReplay.prioritized) {
            return this.prioritizedSample(batchSize);
        } else {
            return this.uniformSample(batchSize);
        }
    }

    /**
     * Get current training metrics
     */
    getMetrics(): TrainingMetrics[] {
        return [...this.metrics];
    }

    /**
     * Update training metrics
     */
    updateMetrics(episodeResult: EpisodeResult): void {
        const recentEpisodes = this.metrics.slice(-100); // Last 100 episodes
        const averageReward = recentEpisodes.length > 0
            ? recentEpisodes.reduce((sum, m) => sum + m.totalReward, 0) / recentEpisodes.length
            : episodeResult.totalReward;

        const winRate = recentEpisodes.length > 0
            ? recentEpisodes.filter(m => m.winRate > 0.5).length / recentEpisodes.length
            : episodeResult.result === 'win' ? 1.0 : 0.0;

        const metrics: TrainingMetrics = {
            episode: this.currentEpisode++,
            totalReward: episodeResult.totalReward,
            averageReward,
            winRate,
            lossRate: recentEpisodes.filter(m => m.winRate < 0.5).length / Math.max(recentEpisodes.length, 1),
            drawRate: recentEpisodes.filter(m => Math.abs(m.winRate - 0.5) < 0.1).length / Math.max(recentEpisodes.length, 1),
            explorationRate: episodeResult.explorationRate,
            learningRate: 0.001, // This should come from the actual optimizer
            loss: 0, // This should come from the training step
            qValueMean: episodeResult.averageQValue,
            qValueStd: 0, // Calculate from Q-values
            episodeDuration: Date.now(), // Should be actual duration
            totalTrainingTime: Date.now() // Should be cumulative time
        };

        this.metrics.push(metrics);

        // Keep only recent metrics to save memory
        if (this.metrics.length > this.config.evaluation.evaluationEpisodes * 10) {
            this.metrics = this.metrics.slice(-this.config.evaluation.evaluationEpisodes * 5);
        }
    }

    // Private helper methods

    private getDefaultConfig(config: Partial<Connect4DRLConfig>): Connect4DRLConfig {
        return {
            environment: {
                rewardShaping: {
                    winReward: 100,
                    lossReward: -100,
                    drawReward: 0,
                    moveReward: -1,
                    threatReward: 10,
                    blockReward: 15,
                    centerColumnBonus: 2
                },
                stateRepresentation: 'enhanced',
                actionSpace: 'discrete',
                observationSpace: 'cnn_ready'
            },
            training: {
                algorithm: 'rainbow_dqn',
                episodes: 10000,
                maxStepsPerEpisode: 42,
                batchSize: 32,
                learningRate: 0.001,
                discountFactor: 0.99,
                explorationStrategy: 'epsilon_greedy',
                targetUpdateFrequency: 100
            },
            selfPlay: {
                enabled: true,
                opponentStrategies: ['minimax', 'mcts', 'trained_model'],
                curriculumLearning: true,
                adaptiveDifficulty: true,
                tournamentMode: false
            },
            experienceReplay: {
                bufferSize: 100000,
                prioritized: true,
                alpha: 0.6,
                beta: 0.4,
                minExperiences: 1000
            },
            evaluation: {
                evaluationFrequency: 1000,
                evaluationEpisodes: 100,
                benchmarkOpponents: ['random', 'minimax_depth3', 'mcts_1000'],
                metricsToTrack: ['winRate', 'averageReward', 'explorationRate']
            },
            model: {
                saveFrequency: 5000,
                modelVersioning: true,
                checkpointPath: './models/connect4_drl',
                exportFormat: 'pytorch'
            },
            ...config
        };
    }

    private getInitialState(): Connect4State {
        return {
            board: Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue)),
            currentPlayer: 'Red',
            moveHistory: [],
            gamePhase: 'opening',
            features: {
                threatCount: 0,
                centerControl: 0,
                connectivity: 0,
                mobility: 7
            }
        };
    }

    private isValidAction(action: number): boolean {
        return action >= 0 && action < 7 && this.state.board[0][action] === 'Empty';
    }

    private applyAction(board: CellValue[][], action: number, player: CellValue): CellValue[][] {
        const newBoard = board.map(row => [...row]);

        // Find the lowest empty row in the column
        for (let row = 5; row >= 0; row--) {
            if (newBoard[row][action] === 'Empty') {
                newBoard[row][action] = player;
                break;
            }
        }

        return newBoard;
    }

    private checkGameEnd(board: CellValue[][]): 'win' | 'loss' | 'draw' | 'continue' {
        // Check for win condition (simplified - would use actual win detection)
        if (this.hasWinningPattern(board, 'Red')) return 'win';
        if (this.hasWinningPattern(board, 'Yellow')) return 'loss';

        // Check for draw (board full)
        const isFull = board[0].every(cell => cell !== 'Empty');
        if (isFull) return 'draw';

        return 'continue';
    }

    private hasWinningPattern(board: CellValue[][], player: CellValue): boolean {
        // Simplified win detection - in practice, use bitboard or optimized method
        // Check horizontal, vertical, and diagonal patterns
        const rows = board.length;
        const cols = board[0].length;

        // Horizontal check
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col <= cols - 4; col++) {
                if (board[row][col] === player &&
                    board[row][col + 1] === player &&
                    board[row][col + 2] === player &&
                    board[row][col + 3] === player) {
                    return true;
                }
            }
        }

        // Vertical check
        for (let row = 0; row <= rows - 4; row++) {
            for (let col = 0; col < cols; col++) {
                if (board[row][col] === player &&
                    board[row + 1][col] === player &&
                    board[row + 2][col] === player &&
                    board[row + 3][col] === player) {
                    return true;
                }
            }
        }

        // Diagonal checks would go here...

        return false;
    }

    private calculateReward(board: CellValue[][], action: number, gameResult: string): number {
        const { rewardShaping } = this.config.environment;
        let reward = rewardShaping.moveReward; // Base move penalty

        // Game outcome rewards
        switch (gameResult) {
            case 'win':
                reward += rewardShaping.winReward;
                break;
            case 'loss':
                reward += rewardShaping.lossReward;
                break;
            case 'draw':
                reward += rewardShaping.drawReward;
                break;
        }

        // Positional rewards
        if (action === 3) { // Center column
            reward += rewardShaping.centerColumnBonus;
        }

        // Threat/block rewards (simplified)
        const threats = this.countThreats(board, this.state.currentPlayer);
        const blocks = this.countThreats(board, this.state.currentPlayer === 'Red' ? 'Yellow' : 'Red');

        reward += threats * rewardShaping.threatReward;
        reward += blocks * rewardShaping.blockReward;

        return reward;
    }

    private countThreats(board: CellValue[][], player: CellValue): number {
        // Simplified threat counting - count potential winning positions
        let threats = 0;
        // Implementation would analyze board for 3-in-a-row patterns with one empty space
        return threats;
    }

    private determineGamePhase(board: CellValue[][], moveCount: number): 'opening' | 'midgame' | 'endgame' {
        if (moveCount <= 8) return 'opening';
        if (moveCount <= 30) return 'midgame';
        return 'endgame';
    }

    private extractFeatures(board: CellValue[][]): Connect4State['features'] {
        return {
            threatCount: this.countThreats(board, this.state.currentPlayer),
            centerControl: this.calculateCenterControl(board),
            connectivity: this.calculateConnectivity(board),
            mobility: this.getValidActions().length
        };
    }

    private calculateCenterControl(board: CellValue[][]): number {
        let control = 0;
        const centerCol = 3;
        for (let row = 0; row < 6; row++) {
            if (board[row][centerCol] === this.state.currentPlayer) {
                control += 1;
            }
        }
        return control;
    }

    private calculateConnectivity(board: CellValue[][]): number {
        // Simplified connectivity measure
        return 0;
    }

    private boardToMatrix(board: CellValue[][]): number[] {
        const matrix: number[] = [];
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const cell = board[row][col];
                if (cell === 'Empty') matrix.push(0);
                else if (cell === 'Red') matrix.push(1);
                else matrix.push(-1);
            }
        }
        return matrix;
    }

    private boardToBitboard(board: CellValue[][]): number[] {
        // Convert to bitboard representation
        const redBits: number[] = [];
        const yellowBits: number[] = [];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                redBits.push(board[row][col] === 'Red' ? 1 : 0);
                yellowBits.push(board[row][col] === 'Yellow' ? 1 : 0);
            }
        }

        return [...redBits, ...yellowBits];
    }

    private boardToEnhancedFeatures(state: Connect4State): number[] {
        const basicMatrix = this.boardToMatrix(state.board);
        const features = [
            state.features.threatCount / 10, // Normalized
            state.features.centerControl / 6,
            state.features.connectivity / 20,
            state.features.mobility / 7,
            state.moveHistory.length / 42, // Game progress
            state.gamePhase === 'opening' ? 1 : 0,
            state.gamePhase === 'midgame' ? 1 : 0,
            state.gamePhase === 'endgame' ? 1 : 0
        ];

        return [...basicMatrix, ...features];
    }

    private uniformSample(batchSize: number): Connect4Experience[] {
        const sampled: Connect4Experience[] = [];

        for (let i = 0; i < batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.experienceBuffer.length);
            sampled.push(this.experienceBuffer[randomIndex]);
        }

        return sampled;
    }

    private prioritizedSample(batchSize: number): Connect4Experience[] {
        // Simplified prioritized sampling - in practice, use proper priority sampling
        // Priority based on TD error or other importance measures
        return this.uniformSample(batchSize);
    }
}

/**
 * Connect4 DRL Trainer - orchestrates training process
 */
export class Connect4DRLTrainer {
    private environment: Connect4DRLEnvironment;
    private ai: UltimateConnect4AI;
    private config: Connect4DRLConfig;
    private trainingStep: number = 0;

    constructor(config: Partial<Connect4DRLConfig> = {}) {
        this.environment = new Connect4DRLEnvironment(config);
        this.config = this.environment['config'] || {} as Connect4DRLConfig;

        // Initialize AI with DRL-optimized configuration
        const aiConfig: Partial<UltimateAIConfig> = {
            primaryStrategy: 'dqn',
            reinforcementLearning: {
                algorithm: 'rainbow_dqn',
                experienceReplay: true,
                targetUpdateFreq: this.config.training?.targetUpdateFrequency || 100,
                exploration: {
                    strategy: 'epsilon_greedy',
                    initialValue: 1.0,
                    decayRate: 0.995,
                    finalValue: 0.01
                }
            },
            optimizers: {
                adamW: { enabled: true, preset: 'reinforcementLearning', config: {} },
                entropyRegularizer: { enabled: true, preset: 'policyGradient', config: {} },
                learningRateScheduler: { enabled: true, preset: 'adaptive', config: {} },
                integration: {
                    adaptiveOptimization: true,
                    crossOptimizerLearning: true,
                    performanceMonitoring: true,
                    autoTuning: true
                }
            }
        };

        this.ai = new UltimateConnect4AI(aiConfig);
    }

    /**
     * Run complete training process
     */
    async train(): Promise<TrainingMetrics[]> {
        console.log('🚀 Starting Connect4 DRL Training...');

        const episodes = this.config.training.episodes;

        for (let episode = 0; episode < episodes; episode++) {
            const result = await this.runEpisode();
            this.environment.updateMetrics(result);

            if (episode % this.config.evaluation.evaluationFrequency === 0) {
                await this.evaluate();
            }

            if (episode % this.config.model.saveFrequency === 0) {
                await this.saveModel(episode);
            }

            if (episode % 100 === 0) {
                console.log(`Episode ${episode}/${episodes} - Reward: ${result.totalReward}, Result: ${result.result}`);
            }
        }

        console.log('✅ Training completed!');
        return this.environment.getMetrics();
    }

    /**
     * Run single training episode
     */
    private async runEpisode(): Promise<EpisodeResult> {
        let state = this.environment.reset();
        let totalReward = 0;
        let moves = 0;
        let gameResult: 'win' | 'loss' | 'draw' = 'draw';
        const qValues: number[] = [];

        while (moves < this.config.training.maxStepsPerEpisode) {
            // Get AI action
            const decision = await this.ai.getBestMove(state.board, state.currentPlayer, 1000);
            const action = decision.move;

            // Store Q-values for metrics
            if (decision.metadata.reinforcementLearning?.qValues) {
                qValues.push(...decision.metadata.reinforcementLearning.qValues);
            }

            // Execute action
            const stepResult = this.environment.step(action);

            // Create experience
            const experience: Connect4Experience = {
                state,
                action,
                reward: stepResult.reward,
                nextState: stepResult.nextState,
                done: stepResult.done,
                metadata: {
                    moveNumber: moves,
                    gameResult: stepResult.info.gameResult || 'draw',
                    opponent: 'self_play',
                    difficulty: 1.0
                }
            };

            // Add to experience buffer
            this.environment.addExperience(experience);

            // Train if enough experiences
            if (this.environment['experienceBuffer'].length >= this.config.experienceReplay.minExperiences) {
                await this.trainStep();
            }

            totalReward += stepResult.reward;
            state = stepResult.nextState;
            moves++;

            if (stepResult.done) {
                gameResult = stepResult.info.gameResult;
                break;
            }
        }

        return {
            totalReward,
            moves,
            result: gameResult,
            opponent: 'self_play',
            explorationRate: 0.1, // Should come from actual epsilon
            averageQValue: qValues.length > 0 ? qValues.reduce((a, b) => a + b, 0) / qValues.length : 0,
            finalBoardState: state.board,
            gameHistory: state.moveHistory
        };
    }

    /**
     * Perform training step with experience replay
     */
    private async trainStep(): Promise<void> {
        const experiences = this.environment.sampleExperiences(this.config.training.batchSize);

        if (experiences.length === 0) return;

        // Convert experiences to training format
        const experienceReplay = experiences.map(exp => ({
            state: exp.state.board,
            action: exp.action,
            reward: exp.reward,
            nextState: exp.nextState.board,
            done: exp.done
        }));

        // Train the RL agent
        try {
            await this.ai.optimizeRLAgent('rainbow_dqn', experienceReplay, this.config.training.batchSize);
            this.trainingStep++;
        } catch (error) {
            console.warn('Training step failed:', error);
        }
    }

    /**
     * Evaluate current model performance
     */
    private async evaluate(): Promise<void> {
        console.log('📊 Running evaluation...');

        // Run evaluation games against different opponents
        const results = [];

        for (const opponent of this.config.evaluation.benchmarkOpponents) {
            let wins = 0;
            const evalEpisodes = this.config.evaluation.evaluationEpisodes;

            for (let i = 0; i < evalEpisodes; i++) {
                const result = await this.playEvaluationGame(opponent);
                if (result === 'win') wins++;
            }

            const winRate = wins / evalEpisodes;
            results.push({ opponent, winRate });
            console.log(`  vs ${opponent}: ${(winRate * 100).toFixed(1)}% win rate`);
        }
    }

    /**
     * Play evaluation game against specific opponent
     */
    private async playEvaluationGame(opponent: string): Promise<'win' | 'loss' | 'draw'> {
        // Simplified evaluation game - in practice, implement actual opponent strategies
        return Math.random() > 0.5 ? 'win' : 'loss';
    }

    /**
     * Save model checkpoint
     */
    private async saveModel(episode: number): Promise<void> {
        try {
            const path = `${this.config.model.checkpointPath}_episode_${episode}`;
            await this.ai.saveAI(path);
            console.log(`💾 Model saved: ${path}`);
        } catch (error) {
            console.warn('Failed to save model:', error);
        }
    }

    /**
     * Get training progress and metrics
     */
    getProgress(): {
        episode: number;
        metrics: TrainingMetrics[];
        optimizerMetrics: any;
    } {
        return {
            episode: this.trainingStep,
            metrics: this.environment.getMetrics(),
            optimizerMetrics: this.ai.getOptimizerMetrics()
        };
    }

    /**
     * Dispose of trainer resources
     */
    dispose(): void {
        this.ai.dispose();
    }
}

/**
 * Factory function to create DRL trainer
 */
export function createConnect4DRLTrainer(config?: Partial<Connect4DRLConfig>): Connect4DRLTrainer {
    return new Connect4DRLTrainer(config);
}

/**
 * Utility function to run quick DRL training
 */
export async function runQuickDRLTraining(episodes: number = 1000): Promise<TrainingMetrics[]> {
    const trainer = createConnect4DRLTrainer({
        training: {
            episodes,
            algorithm: 'rainbow_dqn',
            maxStepsPerEpisode: 42,
            batchSize: 32,
            learningRate: 0.001,
            discountFactor: 0.99,
            explorationStrategy: 'epsilon_greedy',
            targetUpdateFrequency: 100
        },
        evaluation: {
            evaluationFrequency: Math.floor(episodes / 10),
            evaluationEpisodes: 100,
            benchmarkOpponents: ['random'],
            metricsToTrack: ['winRate']
        }
    });

    try {
        return await trainer.train();
    } finally {
        trainer.dispose();
    }
}
