import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface TrainingConfiguration {
    modelType: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn' | 'alphazero' | 'ppo' | 'a3c';
    networkArchitecture: 'cnn' | 'resnet' | 'attention' | 'transformer' | 'custom';
    learningRate: number;
    batchSize: number;
    epochs: number;
    explorationRate: number;
    discountFactor: number;
    targetUpdateFreq: number;
    memorySize: number;
    optimizer: 'adam' | 'adamw' | 'rmsprop' | 'sgd';
    lossFunction: 'mse' | 'huber' | 'cross_entropy';
    regularization: {
        l1: number;
        l2: number;
        dropout: number;
    };
    curriculum: {
        enabled: boolean;
        stages: Array<{
            name: string;
            difficulty: number;
            episodes: number;
            criteria: string;
        }>;
    };
    multiAgent: {
        enabled: boolean;
        agents: number;
        cooperation: boolean;
        communication: boolean;
    };
}

export interface TrainingMetrics {
    epoch: number;
    episode: number;
    loss: number;
    reward: number;
    accuracy: number;
    explorationRate: number;
    qValue: number;
    winRate: number;
    averageGameLength: number;
    timestamp: number;
}

export interface ExperimentRecord {
    id: string;
    name: string;
    configuration: TrainingConfiguration;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    startTime: number;
    endTime?: number;
    metrics: TrainingMetrics[];
    bestMetrics: {
        bestLoss: number;
        bestReward: number;
        bestAccuracy: number;
        bestWinRate: number;
    };
    notes: string;
    progress: number;
    currentEpoch: number;
    currentEpisode: number;
    eta: number;
}

export interface PerformanceTestResult {
    overallScore: number;
    gamesWon: number;
    totalGames: number;
    averageGameLength: number;
    bestOpponent: string;
    byOpponent: {
        [opponent: string]: {
            winRate: number;
            averageMoves: number;
            gamesPlayed: number;
        };
    };
    detailed: {
        strategicDepth: number;
        tacticalAwareness: number;
        endgamePrecision: number;
    };
}

@Injectable()
export class TrainingService {
    private readonly logger = new Logger(TrainingService.name);
    private experiments: Map<string, ExperimentRecord> = new Map();
    private activeTraining: string | null = null;
    private trainingIntervals: Map<string, NodeJS.Timeout> = new Map();

    constructor(private eventEmitter: EventEmitter2) {
        this.logger.log('🧪 Training Service initialized');
    }

    /**
     * Start a new training experiment
     */
    async startTraining(experimentId: string, configuration: TrainingConfiguration): Promise<void> {
        if (this.activeTraining) {
            throw new Error('Another training session is already active');
        }

        const experiment: ExperimentRecord = {
            id: experimentId,
            name: `Training ${new Date().toLocaleString()}`,
            configuration,
            status: 'running',
            startTime: Date.now(),
            metrics: [],
            bestMetrics: {
                bestLoss: Infinity,
                bestReward: -Infinity,
                bestAccuracy: 0,
                bestWinRate: 0
            },
            notes: '',
            progress: 0,
            currentEpoch: 0,
            currentEpisode: 0,
            eta: 0
        };

        this.experiments.set(experimentId, experiment);
        this.activeTraining = experimentId;

        this.logger.log(`🚀 Starting training experiment: ${experimentId}`);
        this.logger.log(`📋 Configuration: ${configuration.modelType} with ${configuration.networkArchitecture}`);

        // Start training simulation
        await this.simulateTraining(experimentId);
    }

    /**
     * Stop active training
     */
    async stopTraining(): Promise<void> {
        if (!this.activeTraining) {
            throw new Error('No active training session');
        }

        const experiment = this.experiments.get(this.activeTraining);
        if (experiment) {
            experiment.status = 'completed';
            experiment.endTime = Date.now();

            // Clear training interval
            const interval = this.trainingIntervals.get(this.activeTraining);
            if (interval) {
                clearInterval(interval);
                this.trainingIntervals.delete(this.activeTraining);
            }

            this.logger.log(`⏹️ Training stopped: ${this.activeTraining}`);
            this.eventEmitter.emit('training.stopped', { experimentId: this.activeTraining });
        }

        this.activeTraining = null;
    }

    /**
     * Pause active training
     */
    async pauseTraining(): Promise<void> {
        if (!this.activeTraining) {
            throw new Error('No active training session');
        }

        const experiment = this.experiments.get(this.activeTraining);
        if (experiment) {
            experiment.status = 'paused';

            const interval = this.trainingIntervals.get(this.activeTraining);
            if (interval) {
                clearInterval(interval);
                this.trainingIntervals.delete(this.activeTraining);
            }

            this.logger.log(`⏸️ Training paused: ${this.activeTraining}`);
            this.eventEmitter.emit('training.paused', { experimentId: this.activeTraining });
        }
    }

    /**
     * Resume paused training
     */
    async resumeTraining(): Promise<void> {
        if (!this.activeTraining) {
            throw new Error('No active training session');
        }

        const experiment = this.experiments.get(this.activeTraining);
        if (experiment && experiment.status === 'paused') {
            experiment.status = 'running';

            this.logger.log(`▶️ Training resumed: ${this.activeTraining}`);
            this.eventEmitter.emit('training.resumed', { experimentId: this.activeTraining });

            // Resume training simulation
            await this.simulateTraining(this.activeTraining);
        }
    }

    /**
     * Get all experiments
     */
    getExperiments(): ExperimentRecord[] {
        return Array.from(this.experiments.values()).sort((a, b) => b.startTime - a.startTime);
    }

    /**
     * Get specific experiment
     */
    getExperiment(experimentId: string): ExperimentRecord | undefined {
        return this.experiments.get(experimentId);
    }

    /**
     * Delete experiment
     */
    async deleteExperiment(experimentId: string): Promise<void> {
        if (this.activeTraining === experimentId) {
            await this.stopTraining();
        }

        this.experiments.delete(experimentId);
        this.logger.log(`🗑️ Experiment deleted: ${experimentId}`);
    }

    /**
     * Clone experiment configuration
     */
    cloneExperiment(experimentId: string): TrainingConfiguration | null {
        const experiment = this.experiments.get(experimentId);
        return experiment ? { ...experiment.configuration } : null;
    }

    /**
     * Update experiment notes
     */
    updateExperimentNotes(experimentId: string, notes: string): void {
        const experiment = this.experiments.get(experimentId);
        if (experiment) {
            experiment.notes = notes;
        }
    }

    /**
     * Run performance test
     */
    async runPerformanceTest(config: {
        modelType: string;
        testGames: number;
        opponents: string[];
    }): Promise<PerformanceTestResult> {
        this.logger.log(`🎯 Starting performance test: ${config.testGames} games against ${config.opponents.length} opponents`);

        // Simulate performance testing
        const results: PerformanceTestResult = {
            overallScore: 0,
            gamesWon: 0,
            totalGames: config.testGames,
            averageGameLength: 0,
            bestOpponent: '',
            byOpponent: {},
            detailed: {
                strategicDepth: 0,
                tacticalAwareness: 0,
                endgamePrecision: 0
            }
        };

        let totalWins = 0;
        let totalMoves = 0;
        let bestWinRate = 0;

        for (const opponent of config.opponents) {
            const gamesPerOpponent = Math.floor(config.testGames / config.opponents.length);
            const wins = await this.simulateGamesAgainstOpponent(opponent, gamesPerOpponent, config.modelType);
            const winRate = wins / gamesPerOpponent;
            const avgMoves = 15 + Math.random() * 20; // Random average moves

            results.byOpponent[opponent] = {
                winRate,
                averageMoves: Math.round(avgMoves),
                gamesPlayed: gamesPerOpponent
            };

            totalWins += wins;
            totalMoves += avgMoves * gamesPerOpponent;

            if (winRate > bestWinRate) {
                bestWinRate = winRate;
                results.bestOpponent = opponent;
            }
        }

        results.gamesWon = totalWins;
        results.averageGameLength = Math.round(totalMoves / config.testGames);
        results.overallScore = Math.round((totalWins / config.testGames) * 100);

        // Calculate detailed metrics
        results.detailed = {
            strategicDepth: 70 + Math.random() * 25,
            tacticalAwareness: 65 + Math.random() * 30,
            endgamePrecision: 80 + Math.random() * 20
        };

        this.logger.log(`✅ Performance test completed: ${results.overallScore}% win rate`);

        return results;
    }

    /**
     * Get training statistics
     */
    getTrainingStatistics(): {
        totalExperiments: number;
        completedExperiments: number;
        averageTrainingTime: number;
        bestPerformance: {
            experimentId: string;
            winRate: number;
        };
        recentActivity: Array<{
            experimentId: string;
            action: string;
            timestamp: number;
        }>;
    } {
        const experiments = Array.from(this.experiments.values());
        const completed = experiments.filter(exp => exp.status === 'completed');

        let totalTrainingTime = 0;
        let bestWinRate = 0;
        let bestExperimentId = '';

        completed.forEach(exp => {
            if (exp.endTime) {
                totalTrainingTime += exp.endTime - exp.startTime;
            }

            if (exp.bestMetrics.bestWinRate > bestWinRate) {
                bestWinRate = exp.bestMetrics.bestWinRate;
                bestExperimentId = exp.id;
            }
        });

        return {
            totalExperiments: experiments.length,
            completedExperiments: completed.length,
            averageTrainingTime: completed.length > 0 ? totalTrainingTime / completed.length : 0,
            bestPerformance: {
                experimentId: bestExperimentId,
                winRate: bestWinRate
            },
            recentActivity: experiments
                .sort((a, b) => b.startTime - a.startTime)
                .slice(0, 10)
                .map(exp => ({
                    experimentId: exp.id,
                    action: `Training ${exp.status}`,
                    timestamp: exp.startTime
                }))
        };
    }

    // Private helper methods
    private async simulateTraining(experimentId: string): Promise<void> {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) return;

        const updateInterval = 2000; // Update every 2 seconds
        const epochDuration = 10000; // 10 seconds per epoch
        const episodesPerEpoch = 100;

        const interval = setInterval(async () => {
            if (experiment.status !== 'running') {
                clearInterval(interval);
                this.trainingIntervals.delete(experimentId);
                return;
            }

            // Update progress
            const elapsed = Date.now() - experiment.startTime;
            const epochProgress = (elapsed % epochDuration) / epochDuration;
            const currentEpisode = Math.floor(epochProgress * episodesPerEpoch);
            const currentEpoch = Math.floor(elapsed / epochDuration);

            experiment.currentEpoch = Math.min(currentEpoch, experiment.configuration.epochs - 1);
            experiment.currentEpisode = currentEpisode;
            experiment.progress = (experiment.currentEpoch / experiment.configuration.epochs) * 100;

            // Calculate ETA
            const remainingEpochs = experiment.configuration.epochs - experiment.currentEpoch;
            experiment.eta = Math.round((remainingEpochs * epochDuration) / 1000);

            // Generate new metrics
            if (currentEpisode % 10 === 0) { // Every 10 episodes
                const newMetrics = this.generateTrainingMetrics(experiment);
                experiment.metrics.push(newMetrics);

                // Update best metrics
                this.updateBestMetrics(experiment, newMetrics);

                // Emit training update
                this.eventEmitter.emit('training.update', {
                    experimentId,
                    progress: experiment.progress,
                    currentEpoch: experiment.currentEpoch,
                    currentEpisode: experiment.currentEpisode,
                    eta: experiment.eta,
                    newMetrics: [newMetrics]
                });

                this.eventEmitter.emit('training.log', `Epoch ${experiment.currentEpoch}, Episode ${experiment.currentEpisode}: Loss=${newMetrics.loss.toFixed(4)}, Reward=${newMetrics.reward.toFixed(2)}, Win Rate=${(newMetrics.winRate * 100).toFixed(1)}%`);
            }

            // Check if training is complete
            if (experiment.currentEpoch >= experiment.configuration.epochs - 1 && currentEpisode >= episodesPerEpoch - 1) {
                await this.completeTraining(experimentId);
            }
        }, updateInterval);

        this.trainingIntervals.set(experimentId, interval);
    }

    private generateTrainingMetrics(experiment: ExperimentRecord): TrainingMetrics {
        const epoch = experiment.currentEpoch;
        const episode = experiment.currentEpisode;
        const progress = experiment.progress / 100;

        // Simulate learning curves with some realism
        const baseLoss = 0.5;
        const lossImprovement = Math.exp(-progress * 3); // Exponential decay
        const noise = (Math.random() - 0.5) * 0.1; // Random noise
        const loss = Math.max(0.01, baseLoss * lossImprovement + noise);

        const baseReward = -0.5;
        const rewardImprovement = progress * 2 - 0.5; // Linear improvement
        const reward = baseReward + rewardImprovement + noise * 2;

        const baseWinRate = 0.1;
        const winRateImprovement = 1 / (1 + Math.exp(-5 * (progress - 0.5))); // Sigmoid curve
        const winRate = Math.max(0, Math.min(1, baseWinRate + winRateImprovement * 0.8 + noise * 0.1));

        const accuracy = Math.max(0, Math.min(1, winRate + noise * 0.05));

        const explorationRate = Math.max(0.01, experiment.configuration.explorationRate * (1 - progress));

        const qValue = Math.max(-1, Math.min(1, reward + noise * 0.2));

        const averageGameLength = Math.max(10, 25 - progress * 10 + noise * 5);

        return {
            epoch,
            episode,
            loss,
            reward,
            accuracy,
            explorationRate,
            qValue,
            winRate,
            averageGameLength: Math.round(averageGameLength),
            timestamp: Date.now()
        };
    }

    private updateBestMetrics(experiment: ExperimentRecord, metrics: TrainingMetrics): void {
        if (metrics.loss < experiment.bestMetrics.bestLoss) {
            experiment.bestMetrics.bestLoss = metrics.loss;
        }

        if (metrics.reward > experiment.bestMetrics.bestReward) {
            experiment.bestMetrics.bestReward = metrics.reward;
        }

        if (metrics.accuracy > experiment.bestMetrics.bestAccuracy) {
            experiment.bestMetrics.bestAccuracy = metrics.accuracy;
        }

        if (metrics.winRate > experiment.bestMetrics.bestWinRate) {
            experiment.bestMetrics.bestWinRate = metrics.winRate;
        }
    }

    private async completeTraining(experimentId: string): Promise<void> {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) return;

        experiment.status = 'completed';
        experiment.endTime = Date.now();
        experiment.progress = 100;

        // Clear interval
        const interval = this.trainingIntervals.get(experimentId);
        if (interval) {
            clearInterval(interval);
            this.trainingIntervals.delete(experimentId);
        }

        this.activeTraining = null;

        this.logger.log(`✅ Training completed: ${experimentId}`);
        this.logger.log(`📊 Final metrics: Win Rate=${(experiment.bestMetrics.bestWinRate * 100).toFixed(1)}%, Best Loss=${experiment.bestMetrics.bestLoss.toFixed(4)}`);

        this.eventEmitter.emit('training.complete', {
            experimentId,
            finalMetrics: experiment.bestMetrics,
            totalTime: experiment.endTime - experiment.startTime
        });
    }

    private async simulateGamesAgainstOpponent(opponent: string, games: number, modelType: string): Promise<number> {
        // Simulate game results based on opponent difficulty and model type
        let baseWinRate = 0.5;

        // Adjust based on opponent
        switch (opponent) {
            case 'random':
                baseWinRate = 0.9;
                break;
            case 'minimax':
                baseWinRate = 0.7;
                break;
            case 'mcts':
                baseWinRate = 0.6;
                break;
            case 'human_level':
                baseWinRate = 0.45;
                break;
        }

        // Adjust based on model type
        switch (modelType) {
            case 'dqn':
                baseWinRate *= 0.9;
                break;
            case 'double_dqn':
                baseWinRate *= 0.95;
                break;
            case 'rainbow_dqn':
                baseWinRate *= 1.1;
                break;
            case 'alphazero':
                baseWinRate *= 1.2;
                break;
        }

        // Simulate wins with some randomness
        let wins = 0;
        for (let i = 0; i < games; i++) {
            if (Math.random() < baseWinRate) {
                wins++;
            }
        }

        return wins;
    }
} 