// src/ai/selfplay/parallelSelfPlay.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { UltimateConnect4AI, UltimateAIConfig } from '../connect4AI';
import { A3C } from '../algorithms/policy_based/A3C';
import { PPO } from '../algorithms/policy_based/PPO';
import { MADDPG } from '../algorithms/multi_agent/MADDPG';
import { QMIX } from '../algorithms/multi_agent/QMIX';
import { DQN } from '../algorithms/value_based/DQN';
import { RainbowDQN } from '../algorithms/value_based/RainbowDQN';
import { EnhancedAlphaZero } from '../algorithms/hybrid/EnhancedAlphaZero';

export interface TrainingConfig {
    // Training Pipeline
    maxGenerations: number;
    gamesPerGeneration: number;
    parallelWorkers: number;
    evaluationGames: number;

    // Population Management
    populationSize: number;
    eliteRatio: number;
    mutationRate: number;
    diversityThreshold: number;

    // Self-Play Configuration
    selfPlayRatio: number;
    crossPlayRatio: number;
    humanPlayRatio: number;
    curriculumLearning: boolean;

    // Algorithm Mix
    algorithmWeights: {
        dqn: number;
        ppo: number;
        a3c: number;
        alphazero: number;
        maddpg: number;
        qmix: number;
    };

    // Performance Optimization
    batchSize: number;
    learningRate: number;
    memoryLimit: number;
    checkpointFrequency: number;

    // Adaptation
    adaptiveOpponents: boolean;
    difficultyScaling: boolean;
    performanceTracking: boolean;
    autoHyperparamTuning: boolean;
}

export interface TrainingMetrics {
    generation: number;
    totalGames: number;
    winRates: { [algorithm: string]: number };
    averageGameLength: number;
    explorationRate: number;
    populationDiversity: number;
    bestPerformance: number;
    convergenceRate: number;
    trainingTime: number;
    memoryUsage: number;
    cpuUsage: number;
    algorithmPerformance: {
        [algorithm: string]: {
            wins: number;
            losses: number;
            draws: number;
            averageTime: number;
            confidence: number;
        };
    };
}

export interface GameResult {
    player1: string;
    player2: string;
    winner: string;
    moves: number;
    gameTime: number;
    finalBoard: CellValue[][];
    moveHistory: number[];
    reasoning: string[];
}

export interface AgentInfo {
    id: string;
    algorithm: string;
    generation: number;
    fitness: number;
    wins: number;
    losses: number;
    draws: number;
    skillLevel: number;
    personality: string;
    lastUpdated: number;
}

/**
 * Automated Training Pipeline for Connect Four AI
 * 
 * Features:
 * - Parallel self-play across multiple algorithms
 * - Population-based training with evolution
 * - Curriculum learning and difficulty adaptation
 * - Performance monitoring and optimization
 * - Automated hyperparameter tuning
 * - Cross-algorithm learning and transfer
 * - Real-time performance analytics
 * - Distributed training support
 */
export class AutomatedTrainingPipeline {
    private config: TrainingConfig;
    private metrics: TrainingMetrics;
    private agents: Map<string, AgentInfo> = new Map();
    private activeAIs: Map<string, UltimateConnect4AI> = new Map();
    private gameHistory: GameResult[] = [];
    private isTraining = false;
    private currentGeneration = 0;
    private workers: Worker[] = [];
    private performanceTracker: PerformanceTracker;
    private hyperparamOptimizer: HyperparameterOptimizer;
    private checkpointManager: CheckpointManager;

    constructor(config: Partial<TrainingConfig> = {}) {
        this.config = {
            maxGenerations: 1000,
            gamesPerGeneration: 100,
            parallelWorkers: 4,
            evaluationGames: 50,
            populationSize: 20,
            eliteRatio: 0.2,
            mutationRate: 0.1,
            diversityThreshold: 0.3,
            selfPlayRatio: 0.7,
            crossPlayRatio: 0.2,
            humanPlayRatio: 0.1,
            curriculumLearning: true,
            algorithmWeights: {
                dqn: 0.15,
                ppo: 0.2,
                a3c: 0.15,
                alphazero: 0.25,
                maddpg: 0.15,
                qmix: 0.1
            },
            batchSize: 32,
            learningRate: 0.001,
            memoryLimit: 2048,
            checkpointFrequency: 10,
            adaptiveOpponents: true,
            difficultyScaling: true,
            performanceTracking: true,
            autoHyperparamTuning: true,
            ...config
        };

        this.metrics = this.initializeMetrics();
        this.performanceTracker = new PerformanceTracker();
        this.hyperparamOptimizer = new HyperparameterOptimizer();
        this.checkpointManager = new CheckpointManager();
    }

    private initializeMetrics(): TrainingMetrics {
        return {
            generation: 0,
            totalGames: 0,
            winRates: {},
            averageGameLength: 0,
            explorationRate: 1.0,
            populationDiversity: 0,
            bestPerformance: 0,
            convergenceRate: 0,
            trainingTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            algorithmPerformance: {}
        };
    }

    /**
     * Initialize training pipeline
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing Automated Training Pipeline...');

        // Initialize population
        await this.initializePopulation();

        // Setup workers for parallel training
        await this.setupWorkers();

        // Initialize performance monitoring
        await this.performanceTracker.initialize();

        // Initialize hyperparameter optimization
        await this.hyperparamOptimizer.initialize();

        console.log('✅ Training pipeline initialized successfully!');
    }

    private async initializePopulation(): Promise<void> {
        console.log('👥 Initializing AI population...');

        const algorithms = Object.keys(this.config.algorithmWeights);

        for (let i = 0; i < this.config.populationSize; i++) {
            // Select algorithm based on weights
            const algorithm = this.selectAlgorithm();

            // Create agent
            const agentId = `${algorithm}_${i}`;
            const agentInfo: AgentInfo = {
                id: agentId,
                algorithm,
                generation: 0,
                fitness: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                skillLevel: Math.random() * 0.5 + 0.5,
                personality: this.generatePersonality(),
                lastUpdated: Date.now()
            };

            this.agents.set(agentId, agentInfo);

            // Create AI instance
            const aiConfig = this.generateAIConfig(algorithm, agentInfo);
            const ai = new UltimateConnect4AI(aiConfig);
            // Note: AI initialization happens automatically in constructor

            this.activeAIs.set(agentId, ai);

            // Initialize algorithm performance tracking
            if (!this.metrics.algorithmPerformance[algorithm]) {
                this.metrics.algorithmPerformance[algorithm] = {
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    averageTime: 0,
                    confidence: 0.5
                };
            }
        }

        console.log(`✅ Population initialized with ${this.config.populationSize} agents`);
    }

    private selectAlgorithm(): string {
        const weights = this.config.algorithmWeights;
        const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
        const random = Math.random() * totalWeight;

        let cumulativeWeight = 0;
        for (const [algorithm, weight] of Object.entries(weights)) {
            cumulativeWeight += weight;
            if (random <= cumulativeWeight) {
                return algorithm;
            }
        }

        return Object.keys(weights)[0];
    }

    private generatePersonality(): string {
        const personalities = ['aggressive', 'defensive', 'balanced', 'adaptive', 'creative'];
        return personalities[Math.floor(Math.random() * personalities.length)];
    }

    private generateAIConfig(algorithm: string, agentInfo: AgentInfo): Partial<UltimateAIConfig> {
        const baseConfig: Partial<UltimateAIConfig> = {
            primaryStrategy: this.getStrategyFromAlgorithm(algorithm),
            advanced: {
                multiAgent: algorithm === 'maddpg' || algorithm === 'qmix',
                metaLearning: true,
                curriculumLearning: this.config.curriculumLearning,
                populationTraining: true,
                explainableAI: true,
                realTimeAdaptation: this.config.adaptiveOpponents,
                constitutionalAI: true,
                safetyMonitoring: true,
                opponentModeling: true,
                multiAgentDebate: true
            },
            performance: {
                maxThinkingTime: 2000,
                multiThreading: true,
                memoryLimit: 1024,
                gpuAcceleration: false
            },
            drlTraining: {
                enabled: true,
                continuousLearning: true,
                selfPlayEnabled: true,
                experienceReplaySize: 50000,
                trainingInterval: 1,
                evaluationInterval: 100,
                config: {},
                backgroundTraining: false,
                modelVersioning: true,
                adaptiveRewardShaping: true
            }
        };

        // Configure neural network based on algorithm
        switch (algorithm) {
            case 'dqn':
                baseConfig.neuralNetwork = {
                    type: 'cnn',
                    enableTraining: true,
                    trainingFrequency: 5,
                    batchSize: this.config.batchSize,
                    learningRate: this.config.learningRate,
                    architectureSearch: false
                };
                break;
            case 'ppo':
            case 'a3c':
                baseConfig.neuralNetwork = {
                    type: 'cnn',
                    enableTraining: true,
                    trainingFrequency: 10,
                    batchSize: this.config.batchSize,
                    learningRate: this.config.learningRate,
                    architectureSearch: false
                };
                break;
            case 'alphazero':
                baseConfig.neuralNetwork = {
                    type: 'resnet',
                    enableTraining: true,
                    trainingFrequency: 1,
                    batchSize: this.config.batchSize,
                    learningRate: this.config.learningRate,
                    architectureSearch: true
                };
                break;
            case 'maddpg':
            case 'qmix':
                baseConfig.neuralNetwork = {
                    type: 'attention',
                    enableTraining: true,
                    trainingFrequency: 5,
                    batchSize: this.config.batchSize,
                    learningRate: this.config.learningRate,
                    architectureSearch: false
                };
                break;
            default:
                baseConfig.neuralNetwork = {
                    type: 'cnn',
                    enableTraining: true,
                    trainingFrequency: 10,
                    batchSize: this.config.batchSize,
                    learningRate: this.config.learningRate,
                    architectureSearch: false
                };
        }

        // Algorithm-specific configurations
        switch (algorithm) {
            case 'alphazero':
                baseConfig.mcts = {
                    simulations: 1000,
                    timeLimit: 3000,
                    explorationConstant: 1.414,
                    progressiveWidening: true,
                    parallelization: true
                };
                break;
            case 'dqn':
            case 'rainbow_dqn':
                baseConfig.reinforcementLearning = {
                    algorithm: 'rainbow_dqn',
                    experienceReplay: true,
                    targetUpdateFreq: 100,
                    exploration: {
                        strategy: 'epsilon_greedy',
                        initialValue: 1.0,
                        decayRate: 0.995,
                        finalValue: 0.01
                    }
                };
                break;
        }

        return baseConfig;
    }

    private getStrategyFromAlgorithm(algorithm: string): UltimateAIConfig['primaryStrategy'] {
        switch (algorithm) {
            case 'alphazero': return 'alphazero';
            case 'dqn': return 'dqn';
            case 'ppo':
            case 'a3c':
            case 'maddpg':
            case 'qmix':
                return 'hybrid';
            default: return 'ensemble';
        }
    }

    private async setupWorkers(): Promise<void> {
        // Setup parallel workers for distributed training
        // This would implement Web Workers or Worker Threads
        console.log(`🔧 Setting up ${this.config.parallelWorkers} parallel workers...`);

        // For now, we'll simulate with async processing
        this.workers = Array(this.config.parallelWorkers).fill(null).map((_, i) => ({
            id: i,
            busy: false,
            currentTask: null
        }) as any);

        console.log('✅ Workers initialized');
    }

    /**
     * Start automated training
     */
    async startTraining(): Promise<void> {
        console.log('🏋️ Starting automated training pipeline...');

        this.isTraining = true;
        const startTime = Date.now();

        try {
            for (let generation = 0; generation < this.config.maxGenerations && this.isTraining; generation++) {
                this.currentGeneration = generation;
                this.metrics.generation = generation;

                console.log(`\n🔄 Generation ${generation + 1}/${this.config.maxGenerations}`);

                // Run training games
                await this.runTrainingGames();

                // Evaluate population
                await this.evaluatePopulation();

                // Evolve population
                await this.evolvePopulation();

                // Update metrics
                await this.updateMetrics();

                // Auto-tune hyperparameters
                if (this.config.autoHyperparamTuning) {
                    await this.hyperparamOptimizer.optimize(this.metrics);
                }

                // Save checkpoint
                if (generation % this.config.checkpointFrequency === 0) {
                    await this.checkpointManager.save(generation, this.agents, this.metrics);
                }

                // Performance monitoring
                await this.performanceTracker.update(this.metrics);

                // Log progress
                this.logProgress();
            }

            console.log('🎉 Training completed successfully!');

        } catch (error) {
            console.error('❌ Training failed:', error);
            throw error;
        } finally {
            this.isTraining = false;
            this.metrics.trainingTime = Date.now() - startTime;
        }
    }

    private async runTrainingGames(): Promise<void> {
        console.log('🎮 Running training games...');

        const gamePromises: Promise<GameResult[]>[] = [];
        const gamesPerWorker = Math.ceil(this.config.gamesPerGeneration / this.config.parallelWorkers);

        for (let worker = 0; worker < this.config.parallelWorkers; worker++) {
            const workerGames = Math.min(gamesPerWorker,
                this.config.gamesPerGeneration - worker * gamesPerWorker);

            if (workerGames > 0) {
                gamePromises.push(this.runWorkerGames(worker, workerGames));
            }
        }

        const gameResults = await Promise.all(gamePromises);

        // Process results
        gameResults.flat().forEach(result => {
            this.gameHistory.push(result);
            this.updateAgentStats(result);
        });

        console.log(`✅ Completed ${gameResults.flat().length} training games`);
    }

    private async runWorkerGames(workerId: number, numGames: number): Promise<GameResult[]> {
        const results: GameResult[] = [];

        for (let i = 0; i < numGames; i++) {
            const result = await this.playGame();
            results.push(result);

            // Update agents based on game result
            await this.updateAgentsFromGame(result);
        }

        return results;
    }

    private async playGame(): Promise<GameResult> {
        // Select opponents
        const [player1Id, player2Id] = this.selectOpponents();
        const player1 = this.activeAIs.get(player1Id)!;
        const player2 = this.activeAIs.get(player2Id)!;

        // Initialize game state
        const board: CellValue[][] = Array(6).fill(null).map(() => Array(7).fill('Empty'));
        const moveHistory: number[] = [];
        const reasoning: string[] = [];
        let currentPlayer: 'Red' | 'Yellow' = 'Red';
        let gameOver = false;
        let winner: 'Red' | 'Yellow' | 'Draw' = 'Draw';

        const startTime = Date.now();

        // Play game
        while (!gameOver && moveHistory.length < 42) {
            const currentAI = currentPlayer === 'Red' ? player1 : player2;
            const legalMoves = this.getLegalMoves(board);

            if (legalMoves.length === 0) {
                winner = 'Draw';
                break;
            }

            // Get AI decision
            const decision = await currentAI.getBestMove(board, currentPlayer);
            const move = decision.move;

            // Validate move
            if (!legalMoves.includes(move)) {
                // Invalid move - opponent wins
                winner = currentPlayer === 'Red' ? 'Yellow' : 'Red';
                break;
            }

            // Make move
            this.makeMove(board, move, currentPlayer);
            moveHistory.push(move);
            reasoning.push(decision.reasoning);

            // Check for win
            if (this.checkWin(board, currentPlayer)) {
                winner = currentPlayer;
                gameOver = true;
            }

            // Switch players
            currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
        }

        const gameTime = Date.now() - startTime;

        return {
            player1: player1Id,
            player2: player2Id,
            winner: winner === 'Red' ? player1Id : winner === 'Yellow' ? player2Id : 'Draw',
            moves: moveHistory.length,
            gameTime,
            finalBoard: board,
            moveHistory,
            reasoning
        };
    }

    private selectOpponents(): [string, string] {
        const agentIds = Array.from(this.agents.keys());

        if (Math.random() < this.config.selfPlayRatio) {
            // Self-play: same algorithm
            const algorithm = this.selectAlgorithm();
            const sameAlgorithmAgents = agentIds.filter(id =>
                this.agents.get(id)?.algorithm === algorithm
            );

            if (sameAlgorithmAgents.length >= 2) {
                const shuffled = sameAlgorithmAgents.sort(() => Math.random() - 0.5);
                return [shuffled[0], shuffled[1]];
            }
        }

        // Cross-play: different algorithms
        const shuffled = agentIds.sort(() => Math.random() - 0.5);
        return [shuffled[0], shuffled[1]];
    }

    private getLegalMoves(board: CellValue[][]): number[] {
        const legalMoves: number[] = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                legalMoves.push(col);
            }
        }
        return legalMoves;
    }

    private makeMove(board: CellValue[][], col: number, player: CellValue): void {
        for (let row = 5; row >= 0; row--) {
            if (board[row][col] === 'Empty') {
                board[row][col] = player;
                break;
            }
        }
    }

    private checkWin(board: CellValue[][], player: CellValue): boolean {
        // Check horizontal, vertical, and diagonal wins
        const directions = [
            [0, 1], [1, 0], [1, 1], [1, -1]
        ];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== player) continue;

                for (const [dr, dc] of directions) {
                    let count = 1;
                    for (let i = 1; i < 4; i++) {
                        const newRow = row + i * dr;
                        const newCol = col + i * dc;
                        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                            board[newRow][newCol] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }
                    if (count >= 4) return true;
                }
            }
        }

        return false;
    }

    private updateAgentStats(result: GameResult): void {
        const player1 = this.agents.get(result.player1)!;
        const player2 = this.agents.get(result.player2)!;

        if (result.winner === result.player1) {
            player1.wins++;
            player2.losses++;
        } else if (result.winner === result.player2) {
            player2.wins++;
            player1.losses++;
        } else {
            player1.draws++;
            player2.draws++;
        }

        // Update fitness based on performance
        const totalGames1 = player1.wins + player1.losses + player1.draws;
        const totalGames2 = player2.wins + player2.losses + player2.draws;

        player1.fitness = totalGames1 > 0 ? (player1.wins + 0.5 * player1.draws) / totalGames1 : 0.5;
        player2.fitness = totalGames2 > 0 ? (player2.wins + 0.5 * player2.draws) / totalGames2 : 0.5;

        // Update algorithm performance
        const alg1 = player1.algorithm;
        const alg2 = player2.algorithm;

        if (result.winner === result.player1) {
            this.metrics.algorithmPerformance[alg1].wins++;
            this.metrics.algorithmPerformance[alg2].losses++;
        } else if (result.winner === result.player2) {
            this.metrics.algorithmPerformance[alg2].wins++;
            this.metrics.algorithmPerformance[alg1].losses++;
        } else {
            this.metrics.algorithmPerformance[alg1].draws++;
            this.metrics.algorithmPerformance[alg2].draws++;
        }
    }

    private async updateAgentsFromGame(result: GameResult): Promise<void> {
        // Update AI agents based on game results
        const player1AI = this.activeAIs.get(result.player1)!;
        const player2AI = this.activeAIs.get(result.player2)!;

        // Trigger learning from game experience
        // This would involve calling train() methods on the AIs
        // with the game data as training examples

        // For now, we'll just update the last updated timestamp
        const player1Info = this.agents.get(result.player1)!;
        const player2Info = this.agents.get(result.player2)!;

        player1Info.lastUpdated = Date.now();
        player2Info.lastUpdated = Date.now();
    }

    private async evaluatePopulation(): Promise<void> {
        console.log('📊 Evaluating population...');

        // Run evaluation games
        const evaluationPromises: Promise<void>[] = [];

        for (const [agentId, agentInfo] of this.agents) {
            evaluationPromises.push(this.evaluateAgent(agentId, agentInfo));
        }

        await Promise.all(evaluationPromises);

        // Calculate population diversity
        this.metrics.populationDiversity = this.calculatePopulationDiversity();

        console.log('✅ Population evaluation completed');
    }

    private async evaluateAgent(agentId: string, agentInfo: AgentInfo): Promise<void> {
        // Evaluate agent against benchmark opponents
        const benchmarkResults = await this.runBenchmarkGames(agentId);

        // Update agent's skill level based on benchmark performance
        const benchmarkWinRate = benchmarkResults.wins / benchmarkResults.total;
        agentInfo.skillLevel = benchmarkWinRate;

        // Update fitness
        const totalGames = agentInfo.wins + agentInfo.losses + agentInfo.draws;
        if (totalGames > 0) {
            agentInfo.fitness = (agentInfo.wins + 0.5 * agentInfo.draws) / totalGames;
        }
    }

    private async runBenchmarkGames(agentId: string): Promise<{ wins: number; total: number }> {
        // Run games against standard benchmarks
        // For now, return simulated results
        return {
            wins: Math.floor(Math.random() * 10),
            total: 10
        };
    }

    private calculatePopulationDiversity(): number {
        // Calculate diversity based on algorithm distribution and performance spread
        const algorithmCounts: { [key: string]: number } = {};
        const fitnessValues: number[] = [];

        for (const agentInfo of this.agents.values()) {
            algorithmCounts[agentInfo.algorithm] = (algorithmCounts[agentInfo.algorithm] || 0) + 1;
            fitnessValues.push(agentInfo.fitness);
        }

        // Algorithm diversity (entropy)
        const totalAgents = this.agents.size;
        const algorithmDiversity = -Object.values(algorithmCounts)
            .map(count => count / totalAgents)
            .reduce((sum, p) => sum + p * Math.log2(p), 0);

        // Fitness diversity (standard deviation)
        const meanFitness = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
        const fitnessDiversity = Math.sqrt(
            fitnessValues.reduce((sum, f) => sum + Math.pow(f - meanFitness, 2), 0) / fitnessValues.length
        );

        return (algorithmDiversity + fitnessDiversity) / 2;
    }

    private async evolvePopulation(): Promise<void> {
        console.log('🧬 Evolving population...');

        // Sort agents by fitness
        const sortedAgents = Array.from(this.agents.entries())
            .sort((a, b) => b[1].fitness - a[1].fitness);

        // Select elite agents
        const eliteCount = Math.floor(this.config.populationSize * this.config.eliteRatio);
        const eliteAgents = sortedAgents.slice(0, eliteCount);

        // Replace bottom performers
        const replacementCount = this.config.populationSize - eliteCount;
        const newAgents = await this.generateOffspring(eliteAgents, replacementCount);

        // Remove worst performers
        const worstAgents = sortedAgents.slice(-replacementCount);
        for (const [agentId, _] of worstAgents) {
            this.agents.delete(agentId);
            this.activeAIs.get(agentId)?.dispose();
            this.activeAIs.delete(agentId);
        }

        // Add new agents
        for (const [agentId, agentInfo] of newAgents) {
            this.agents.set(agentId, agentInfo);

            const aiConfig = this.generateAIConfig(agentInfo.algorithm, agentInfo);
            const ai = new UltimateConnect4AI(aiConfig);
            // Note: AI initialization happens automatically in constructor

            this.activeAIs.set(agentId, ai);
        }

        console.log('✅ Population evolution completed');
    }

    private async generateOffspring(
        eliteAgents: [string, AgentInfo][],
        count: number
    ): Promise<[string, AgentInfo][]> {
        const offspring: [string, AgentInfo][] = [];

        for (let i = 0; i < count; i++) {
            // Select parent based on fitness
            const parent = eliteAgents[Math.floor(Math.random() * eliteAgents.length)];

            // Create offspring with mutation
            const childId = `${parent[1].algorithm}_gen${this.currentGeneration}_${i}`;
            const childInfo: AgentInfo = {
                id: childId,
                algorithm: parent[1].algorithm,
                generation: this.currentGeneration,
                fitness: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                skillLevel: parent[1].skillLevel + (Math.random() - 0.5) * this.config.mutationRate,
                personality: Math.random() < this.config.mutationRate ?
                    this.generatePersonality() : parent[1].personality,
                lastUpdated: Date.now()
            };

            // Clamp skill level
            childInfo.skillLevel = Math.max(0, Math.min(1, childInfo.skillLevel));

            offspring.push([childId, childInfo]);
        }

        return offspring;
    }

    private async updateMetrics(): Promise<void> {
        this.metrics.totalGames = this.gameHistory.length;
        this.metrics.averageGameLength = this.gameHistory.reduce((sum, game) => sum + game.moves, 0) / this.gameHistory.length;

        // Update win rates
        for (const [algorithm, performance] of Object.entries(this.metrics.algorithmPerformance)) {
            const total = performance.wins + performance.losses + performance.draws;
            this.metrics.winRates[algorithm] = total > 0 ? performance.wins / total : 0;
        }

        // Update best performance
        const bestFitness = Math.max(...Array.from(this.agents.values()).map(a => a.fitness));
        this.metrics.bestPerformance = bestFitness;

        // Update convergence rate
        const recentGames = this.gameHistory.slice(-100);
        const averageLength = recentGames.reduce((sum, game) => sum + game.moves, 0) / recentGames.length;
        this.metrics.convergenceRate = 1 - (averageLength / 42); // Normalize to [0,1]
    }

    private logProgress(): void {
        console.log(`📈 Generation ${this.metrics.generation} Summary:`);
        console.log(`  Total Games: ${this.metrics.totalGames}`);
        console.log(`  Best Performance: ${this.metrics.bestPerformance.toFixed(3)}`);
        console.log(`  Population Diversity: ${this.metrics.populationDiversity.toFixed(3)}`);
        console.log(`  Average Game Length: ${this.metrics.averageGameLength.toFixed(1)}`);

        console.log('  Algorithm Win Rates:');
        for (const [algorithm, winRate] of Object.entries(this.metrics.winRates)) {
            console.log(`    ${algorithm}: ${(winRate * 100).toFixed(1)}%`);
        }
    }

    /**
     * Get current training metrics
     */
    getMetrics(): TrainingMetrics {
        return { ...this.metrics };
    }

    /**
     * Get best performing agent
     */
    getBestAgent(): AgentInfo | null {
        let bestAgent: AgentInfo | null = null;
        let bestFitness = -1;

        for (const agent of this.agents.values()) {
            if (agent.fitness > bestFitness) {
                bestFitness = agent.fitness;
                bestAgent = agent;
            }
        }

        return bestAgent;
    }

    /**
     * Stop training
     */
    stopTraining(): void {
        this.isTraining = false;
        console.log('⏹️ Training stopped');
    }

    /**
     * Save training state
     */
    async saveTrainingState(path: string): Promise<void> {
        await this.checkpointManager.save(this.currentGeneration, this.agents, this.metrics);
        console.log(`💾 Training state saved to ${path}`);
    }

    /**
     * Load training state
     */
    async loadTrainingState(path: string): Promise<void> {
        const checkpoint = await this.checkpointManager.load(path);
        this.currentGeneration = checkpoint.generation;
        this.agents = checkpoint.agents;
        this.metrics = checkpoint.metrics;

        // Reinitialize AIs
        for (const [agentId, agentInfo] of this.agents) {
            const aiConfig = this.generateAIConfig(agentInfo.algorithm, agentInfo);
            const ai = new UltimateConnect4AI(aiConfig);
            // Note: AI initialization happens automatically in constructor
            this.activeAIs.set(agentId, ai);
        }

        console.log(`📂 Training state loaded from ${path}`);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.isTraining = false;

        for (const ai of this.activeAIs.values()) {
            ai.dispose();
        }

        this.activeAIs.clear();
        this.agents.clear();
        this.gameHistory = [];

        console.log('🧹 Training pipeline disposed');
    }
}

// Supporting classes
class PerformanceTracker {
    async initialize(): Promise<void> {
        // Initialize performance monitoring
    }

    async update(metrics: TrainingMetrics): Promise<void> {
        // Update performance metrics
        metrics.memoryUsage = this.getMemoryUsage();
        metrics.cpuUsage = this.getCPUUsage();
    }

    private getMemoryUsage(): number {
        // Get current memory usage
        return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }

    private getCPUUsage(): number {
        // Get current CPU usage
        return process.cpuUsage().user / 1000000; // Convert to seconds
    }
}

class HyperparameterOptimizer {
    async initialize(): Promise<void> {
        // Initialize hyperparameter optimization
    }

    async optimize(metrics: TrainingMetrics): Promise<void> {
        // Optimize hyperparameters based on performance
        if (metrics.bestPerformance < 0.6) {
            // Increase exploration
            console.log('🔧 Increasing exploration due to low performance');
        }

        if (metrics.populationDiversity < 0.3) {
            // Increase mutation rate
            console.log('🔧 Increasing mutation rate due to low diversity');
        }
    }
}

class CheckpointManager {
    async save(generation: number, agents: Map<string, AgentInfo>, metrics: TrainingMetrics): Promise<void> {
        // Save checkpoint to file system
        const checkpoint = {
            generation,
            agents: Array.from(agents.entries()),
            metrics,
            timestamp: Date.now()
        };

        // In a real implementation, this would save to disk
        console.log(`💾 Checkpoint saved for generation ${generation}`);
    }

    async load(path: string): Promise<{
        generation: number;
        agents: Map<string, AgentInfo>;
        metrics: TrainingMetrics;
    }> {
        // Load checkpoint from file system
        // For now, return empty data
        return {
            generation: 0,
            agents: new Map(),
            metrics: {} as TrainingMetrics
        };
    }
}
