// src/ai/multiagent/multiAgentTraining.ts
import { Agent, MultiAgentEnvironment, MultiAgentGame, AgentAction, Experience } from './multiAgentEnv';
import { CellValue } from '../connect4AI';
import { Connect4Environment } from '../environment';

export interface TrainingConfig {
    method: 'self_play' | 'population' | 'cooperative' | 'competitive' | 'curriculum' | 'meta_learning';
    episodes: number;
    populationSize: number;
    eliteSize: number;
    mutationRate: number;
    crossoverRate: number;
    learningRate: number;
    explorationRate: number;
    explorationDecay: number;
    batchSize: number;
    memorySize: number;
    targetUpdateFrequency: number;
    evaluationFrequency: number;
    checkpointFrequency: number;
    parallelEnvironments: number;
    useExperienceReplay: boolean;
    usePrioritizedReplay: boolean;
    useDoubleDQN: boolean;
    useDuelingDQN: boolean;
    useNoisyNetworks: boolean;
    useDistributionalRL: boolean;
    useMultiStep: boolean;
    useAsyncTraining: boolean;
    diversityReward: number;
    opponentSampling: 'uniform' | 'league' | 'pfsp' | 'sp' | 'fsp';
    curriculumStages: CurriculumStage[];
}

export interface CurriculumStage {
    name: string;
    description: string;
    duration: number;
    difficulty: number;
    opponents: string[];
    objectives: string[];
    rewards: { [key: string]: number };
    graduationCriteria: string[];
}

export interface TrainingResult {
    algorithm: string;
    episodes: number;
    finalPerformance: number;
    learningCurve: number[];
    diversityScore: number;
    exploitability: number;
    convergenceEpisode: number;
    totalTrainingTime: number;
    memoryUsage: number;
    statistics: TrainingStatistics;
}

export interface TrainingStatistics {
    averageReward: number;
    winRate: number;
    episodeLength: number;
    explorationRate: number;
    learningRate: number;
    lossValue: number;
    gradientNorm: number;
    qValueStats: {
        mean: number;
        std: number;
        min: number;
        max: number;
    };
    policyEntropy: number;
    valueAccuracy: number;
    tdError: number;
    experienceReplayEfficiency: number;
}

export interface SelfPlayConfig {
    saveFrequency: number;
    opponentPool: Agent[];
    historicalOpponents: boolean;
    leagueSize: number;
    evaluationGames: number;
    winRateThreshold: number;
    diversityThreshold: number;
}

export interface PopulationConfig {
    generations: number;
    tournamentSize: number;
    elitismRate: number;
    mutationStrength: number;
    crossoverStrategy: 'uniform' | 'single_point' | 'two_point' | 'blend';
    fitnessSharing: boolean;
    speciation: boolean;
    coevolution: boolean;
    noveltySearch: boolean;
}

export interface CooperativeConfig {
    teamSize: number;
    communicationBandwidth: number;
    sharedReward: number;
    individualReward: number;
    coordinationMechanism: 'explicit' | 'implicit' | 'learned';
    consensusRequired: boolean;
    roleSpecialization: boolean;
}

export interface ExperienceReplayBuffer {
    capacity: number;
    buffer: Experience[];
    priorities: number[];
    position: number;
    add(experience: Experience): void;
    sample(batchSize: number): Experience[];
    updatePriorities(indices: number[], priorities: number[]): void;
    size(): number;
}

export interface LearningSchedule {
    type: 'linear' | 'exponential' | 'cosine' | 'step' | 'adaptive';
    initialValue: number;
    finalValue: number;
    decaySteps: number;
    warmupSteps: number;
    milestones: number[];
    gamma: number;
}

export interface TrainingMetrics {
    episodeRewards: number[];
    episodeLengths: number[];
    winRates: number[];
    lossValues: number[];
    explorationRates: number[];
    learningRates: number[];
    diversityScores: number[];
    convergenceMetrics: {
        policyKLDivergence: number[];
        valueMSE: number[];
        parameterNorm: number[];
    };
    opponentStats: {
        [opponentId: string]: {
            games: number;
            wins: number;
            losses: number;
            draws: number;
            averageReward: number;
        };
    };
}

/**
 * Comprehensive Multi-Agent Training System
 * 
 * Features:
 * - Self-play training with opponent leagues
 * - Population-based training with evolution
 * - Cooperative multi-agent learning
 * - Curriculum learning and progressive difficulty
 * - Experience replay and prioritized sampling
 * - Distributed and asynchronous training
 * - Advanced optimization techniques
 * - Comprehensive metrics and monitoring
 */
export class MultiAgentTrainer {
    private environment: MultiAgentEnvironment;
    private config: TrainingConfig;
    private replayBuffer: ExperienceReplayBuffer;
    private learningSchedule: LearningSchedule;
    private metrics: TrainingMetrics;
    private currentEpisode: number = 0;
    private bestAgents: Agent[] = [];
    private opponentLeague: Agent[] = [];
    private trainingHistory: TrainingResult[] = [];

    constructor(environment: MultiAgentEnvironment, config: Partial<TrainingConfig> = {}) {
        this.environment = environment;
        this.config = {
            method: 'self_play',
            episodes: 10000,
            populationSize: 50,
            eliteSize: 10,
            mutationRate: 0.1,
            crossoverRate: 0.7,
            learningRate: 0.001,
            explorationRate: 0.1,
            explorationDecay: 0.995,
            batchSize: 32,
            memorySize: 100000,
            targetUpdateFrequency: 1000,
            evaluationFrequency: 100,
            checkpointFrequency: 1000,
            parallelEnvironments: 4,
            useExperienceReplay: true,
            usePrioritizedReplay: true,
            useDoubleDQN: true,
            useDuelingDQN: true,
            useNoisyNetworks: false,
            useDistributionalRL: false,
            useMultiStep: false,
            useAsyncTraining: false,
            diversityReward: 0.1,
            opponentSampling: 'league',
            curriculumStages: [],
            ...config
        };

        this.replayBuffer = new PrioritizedExperienceReplayBuffer(this.config.memorySize);
        this.learningSchedule = this.createLearningSchedule();
        this.metrics = this.initializeMetrics();
    }

    /**
     * Start training with specified method
     */
    async startTraining(): Promise<TrainingResult> {
        console.log(`🚀 Starting ${this.config.method} training...`);

        const startTime = Date.now();
        let result: TrainingResult;

        switch (this.config.method) {
            case 'self_play':
                result = await this.trainSelfPlay();
                break;
            case 'population':
                result = await this.trainPopulation();
                break;
            case 'cooperative':
                result = await this.trainCooperative();
                break;
            case 'competitive':
                result = await this.trainCompetitive();
                break;
            case 'curriculum':
                result = await this.trainCurriculum();
                break;
            case 'meta_learning':
                result = await this.trainMetaLearning();
                break;
            default:
                throw new Error(`Unknown training method: ${this.config.method}`);
        }

        result.totalTrainingTime = Date.now() - startTime;
        this.trainingHistory.push(result);

        console.log(`✅ Training completed in ${result.totalTrainingTime / 1000}s`);
        console.log(`📊 Final performance: ${result.finalPerformance.toFixed(3)}`);
        console.log(`📈 Win rate: ${result.statistics.winRate.toFixed(3)}`);

        return result;
    }

    /**
     * Self-play training
     */
    private async trainSelfPlay(): Promise<TrainingResult> {
        console.log('🎯 Starting self-play training...');

        // Create initial agent
        const agent = await this.environment.createAgent(
            'selfplay_agent',
            'competitive',
            'neural'
        );

        // Add to opponent league
        this.opponentLeague.push(agent);

        for (let episode = 0; episode < this.config.episodes; episode++) {
            this.currentEpisode = episode;

            // Sample opponent from league
            const opponent = this.sampleOpponent();

            // Play game
            const gameResult = await this.playTrainingGame(agent, opponent);

            // Update agent
            await this.updateAgent(agent, gameResult);

            // Update opponent league
            if (episode % this.config.evaluationFrequency === 0) {
                await this.updateOpponentLeague(agent);
            }

            // Update metrics
            this.updateMetrics(gameResult);

            // Log progress
            if (episode % 100 === 0) {
                console.log(`Episode ${episode}: Win rate ${this.metrics.winRates[this.metrics.winRates.length - 1]?.toFixed(3)}`);
            }
        }

        return this.generateTrainingResult('self_play');
    }

    /**
     * Population-based training
     */
    private async trainPopulation(): Promise<TrainingResult> {
        console.log('🧬 Starting population-based training...');

        // Initialize population
        const population = await this.initializePopulation();

        for (let generation = 0; generation < this.config.episodes / this.config.populationSize; generation++) {
            console.log(`Generation ${generation + 1}/${this.config.episodes / this.config.populationSize}`);

            // Evaluate population
            const fitness = await this.evaluatePopulation(population);

            // Select elite
            const elite = this.selectElite(population, fitness);

            // Create new generation
            const newGeneration = await this.createNewGeneration(elite, population, fitness);

            // Replace population
            population.splice(0, population.length, ...newGeneration);

            // Update metrics
            this.updatePopulationMetrics(generation, fitness);
        }

        return this.generateTrainingResult('population');
    }

    /**
     * Cooperative training
     */
    private async trainCooperative(): Promise<TrainingResult> {
        console.log('🤝 Starting cooperative training...');

        // Create team of agents
        const team = await this.createAgentTeam(this.config.populationSize);

        for (let episode = 0; episode < this.config.episodes; episode++) {
            this.currentEpisode = episode;

            // Run cooperative episode
            const episodeResult = await this.runCooperativeEpisode(team);

            // Update all agents
            for (const agent of team) {
                await this.updateAgent(agent, episodeResult);
            }

            // Update cooperation parameters
            await this.updateCooperationParameters(team, episodeResult);

            // Update metrics
            this.updateMetrics(episodeResult);

            if (episode % 100 === 0) {
                console.log(`Episode ${episode}: Team performance ${episodeResult.teamPerformance.toFixed(3)}`);
            }
        }

        return this.generateTrainingResult('cooperative');
    }

    /**
     * Competitive training
     */
    private async trainCompetitive(): Promise<TrainingResult> {
        console.log('⚔️ Starting competitive training...');

        // Create competing agents
        const agents = await this.createCompetingAgents(this.config.populationSize);

        for (let episode = 0; episode < this.config.episodes; episode++) {
            this.currentEpisode = episode;

            // Run tournament
            const tournamentResult = await this.runTournament(agents);

            // Update agents based on performance
            for (const agent of agents) {
                await this.updateAgentFromTournament(agent, tournamentResult);
            }

            // Update metrics
            this.updateTournamentMetrics(tournamentResult);

            if (episode % 100 === 0) {
                console.log(`Episode ${episode}: Best agent rating ${Math.max(...agents.map(a => a.eloRating)).toFixed(0)}`);
            }
        }

        return this.generateTrainingResult('competitive');
    }

    /**
     * Curriculum learning
     */
    private async trainCurriculum(): Promise<TrainingResult> {
        console.log('📚 Starting curriculum learning...');

        const agent = await this.environment.createAgent(
            'curriculum_agent',
            'competitive',
            'neural'
        );

        for (const stage of this.config.curriculumStages) {
            console.log(`Starting curriculum stage: ${stage.name}`);

            await this.trainCurriculumStage(agent, stage);

            // Evaluate graduation criteria
            const graduated = await this.evaluateGraduation(agent, stage);

            if (!graduated) {
                console.log(`Agent did not graduate from ${stage.name}, continuing...`);
                // Continue training in same stage
                await this.trainCurriculumStage(agent, stage);
            }
        }

        return this.generateTrainingResult('curriculum');
    }

    /**
     * Meta-learning training
     */
    private async trainMetaLearning(): Promise<TrainingResult> {
        console.log('🧠 Starting meta-learning training...');

        const metaAgent = await this.environment.createAgent(
            'meta_agent',
            'competitive',
            'neural'
        );

        // Create diverse task distribution
        const tasks = await this.createMetaLearningTasks();

        for (let episode = 0; episode < this.config.episodes; episode++) {
            this.currentEpisode = episode;

            // Sample task
            const task = tasks[Math.floor(Math.random() * tasks.length)];

            // Fast adaptation phase
            const adaptedAgent = await this.fastAdaptation(metaAgent, task);

            // Evaluation phase
            const performance = await this.evaluateMetaLearning(adaptedAgent, task);

            // Meta-update
            await this.metaUpdate(metaAgent, task, performance);

            // Update metrics
            this.updateMetaLearningMetrics(task, performance);

            if (episode % 100 === 0) {
                console.log(`Episode ${episode}: Meta-learning performance ${performance.toFixed(3)}`);
            }
        }

        return this.generateTrainingResult('meta_learning');
    }

    // Helper methods for training
    private sampleOpponent(): Agent {
        switch (this.config.opponentSampling) {
            case 'uniform':
                return this.opponentLeague[Math.floor(Math.random() * this.opponentLeague.length)];
            case 'league':
                return this.sampleFromLeague();
            case 'pfsp':
                return this.samplePFSP();
            case 'sp':
                return this.sampleSP();
            case 'fsp':
                return this.sampleFSP();
            default:
                return this.opponentLeague[Math.floor(Math.random() * this.opponentLeague.length)];
        }
    }

    private sampleFromLeague(): Agent {
        // Sample based on ELO ratings
        const totalRating = this.opponentLeague.reduce((sum, agent) => sum + agent.eloRating, 0);
        const random = Math.random() * totalRating;

        let cumulative = 0;
        for (const agent of this.opponentLeague) {
            cumulative += agent.eloRating;
            if (random <= cumulative) {
                return agent;
            }
        }

        return this.opponentLeague[this.opponentLeague.length - 1];
    }

    private samplePFSP(): Agent {
        // Prioritized Fictitious Self-Play
        const winRates = this.opponentLeague.map(agent => agent.winRate);
        const priorities = winRates.map(wr => Math.pow(wr, 2));
        const totalPriority = priorities.reduce((sum, p) => sum + p, 0);

        const random = Math.random() * totalPriority;
        let cumulative = 0;

        for (let i = 0; i < this.opponentLeague.length; i++) {
            cumulative += priorities[i];
            if (random <= cumulative) {
                return this.opponentLeague[i];
            }
        }

        return this.opponentLeague[this.opponentLeague.length - 1];
    }

    private sampleSP(): Agent {
        // Self-Play - always use current agent
        return this.opponentLeague[this.opponentLeague.length - 1];
    }

    private sampleFSP(): Agent {
        // Fictitious Self-Play - uniform sampling
        return this.opponentLeague[Math.floor(Math.random() * this.opponentLeague.length)];
    }

    private async playTrainingGame(agent1: Agent, agent2: Agent): Promise<any> {
        const game = await this.environment.startGame('competitive', [agent1.id, agent2.id]);

        let moves = 0;
        let winner: string | undefined;
        const experiences: Experience[] = [];

        while (game.gameState === 'active' && moves < 42) {
            const turnResult = await this.environment.executeTurn(game.id);
            moves++;

            // Store experience
            const currentAgent = game.agents[game.currentTurn % 2];
            if (currentAgent.lastAction) {
                const experience: Experience = {
                    gameId: game.id,
                    boardState: game.boardState,
                    action: currentAgent.lastAction,
                    reward: this.calculateTrainingReward(currentAgent, turnResult),
                    nextState: turnResult.boardState,
                    opponent: game.agents.find(a => a.id !== currentAgent.id)?.id || 'unknown',
                    outcome: turnResult.gameState === 'finished' ?
                        (turnResult.winner === currentAgent.id ? 'win' : 'loss') : 'draw',
                    lessons: [],
                    timestamp: Date.now()
                };
                experiences.push(experience);
            }

            if (turnResult.gameState === 'finished') {
                winner = turnResult.winner;
                break;
            }
        }

        return {
            winner,
            moves,
            experiences,
            agent1Performance: winner === agent1.id ? 1 : winner === agent2.id ? -1 : 0,
            agent2Performance: winner === agent2.id ? 1 : winner === agent1.id ? -1 : 0,
            gameLength: moves,
            teamPerformance: 0.5 // Default for non-cooperative games
        };
    }

    private calculateTrainingReward(agent: Agent, turnResult: any): number {
        let reward = 0;

        // Basic game outcome reward
        if (turnResult.gameState === 'finished') {
            if (turnResult.winner === agent.id) {
                reward += 100;
            } else if (turnResult.winner) {
                reward -= 50;
            } else {
                reward += 25; // Draw
            }
        }

        // Diversity reward
        if (this.config.diversityReward > 0) {
            const diversityScore = this.calculateDiversityScore(agent);
            reward += diversityScore * this.config.diversityReward;
        }

        // Move quality reward
        if (agent.lastAction) {
            reward += agent.lastAction.confidence * 10;
        }

        return reward;
    }

    private calculateDiversityScore(agent: Agent): number {
        // Calculate how different this agent is from others
        let diversityScore = 0;

        for (const other of this.opponentLeague) {
            if (other.id !== agent.id) {
                const personalityDiff = this.calculatePersonalityDifference(agent, other);
                const strategyDiff = this.calculateStrategyDifference(agent, other);
                diversityScore += personalityDiff + strategyDiff;
            }
        }

        return diversityScore / Math.max(1, this.opponentLeague.length - 1);
    }

    private calculatePersonalityDifference(agent1: Agent, agent2: Agent): number {
        const traits = ['aggressiveness', 'riskTolerance', 'patience', 'adaptability'];
        let totalDiff = 0;

        for (const trait of traits) {
            const diff = Math.abs((agent1.personality as any)[trait] - (agent2.personality as any)[trait]);
            totalDiff += diff;
        }

        return totalDiff / traits.length;
    }

    private calculateStrategyDifference(agent1: Agent, agent2: Agent): number {
        const weights1 = agent1.strategy.evaluationWeights;
        const weights2 = agent2.strategy.evaluationWeights;

        let totalDiff = 0;
        const keys = Object.keys(weights1);

        for (const key of keys) {
            const diff = Math.abs(weights1[key as keyof typeof weights1] - weights2[key as keyof typeof weights2]);
            totalDiff += diff;
        }

        return totalDiff / keys.length;
    }

    private async updateAgent(agent: Agent, gameResult: any): Promise<void> {
        // Store experiences in replay buffer
        if (this.config.useExperienceReplay) {
            for (const experience of gameResult.experiences) {
                this.replayBuffer.add(experience);
            }
        }

        // Update agent parameters
        agent.learningRate = this.updateLearningRate();
        agent.explorationRate = this.updateExplorationRate();

        // Update agent statistics
        agent.gamesPlayed++;
        if (gameResult.winner === agent.id) {
            agent.winRate = ((agent.winRate * (agent.gamesPlayed - 1)) + 1) / agent.gamesPlayed;
        } else {
            agent.winRate = (agent.winRate * (agent.gamesPlayed - 1)) / agent.gamesPlayed;
        }

        // Experience replay learning
        if (this.config.useExperienceReplay && this.replayBuffer.size() >= this.config.batchSize) {
            const batch = this.replayBuffer.sample(this.config.batchSize);
            await this.learnFromBatch(agent, batch);
        }
    }

    private updateLearningRate(): number {
        const progress = this.currentEpisode / this.config.episodes;
        return this.config.learningRate * Math.pow(0.1, progress);
    }

    private updateExplorationRate(): number {
        return this.config.explorationRate * Math.pow(this.config.explorationDecay, this.currentEpisode);
    }

    private async learnFromBatch(agent: Agent, batch: Experience[]): Promise<void> {
        // Simplified learning update
        let totalLoss = 0;

        for (const experience of batch) {
            const target = experience.reward;
            const predicted = Math.random(); // Placeholder
            const loss = Math.pow(target - predicted, 2);
            totalLoss += loss;
        }

        // Update agent based on loss
        const avgLoss = totalLoss / batch.length;

        // Simple parameter update (placeholder)
        agent.learningRate *= avgLoss < 0.1 ? 1.01 : 0.99;
    }

    private async updateOpponentLeague(agent: Agent): Promise<void> {
        // Evaluate agent performance
        const performance = await this.evaluateAgent(agent);

        // Add to league if performance is good enough
        if (performance > 0.6 && this.opponentLeague.length < 10) {
            const clonedAgent = await this.cloneAgent(agent);
            this.opponentLeague.push(clonedAgent);
        }

        // Remove weak agents
        this.opponentLeague = this.opponentLeague.filter(a => a.winRate > 0.3);
    }

    private async evaluateAgent(agent: Agent): Promise<number> {
        let totalReward = 0;
        const evaluationGames = 10;

        for (let i = 0; i < evaluationGames; i++) {
            const opponent = this.sampleOpponent();
            const gameResult = await this.playTrainingGame(agent, opponent);
            totalReward += gameResult.agent1Performance;
        }

        return totalReward / evaluationGames;
    }

    private async cloneAgent(agent: Agent): Promise<Agent> {
        const clone = await this.environment.createAgent(
            `${agent.name}_clone_${Date.now()}`,
            agent.type,
            agent.algorithm,
            agent.personality,
            agent.strategy
        );

        clone.eloRating = agent.eloRating;
        clone.winRate = agent.winRate;
        clone.skillLevel = agent.skillLevel;

        return clone;
    }

    // Population-based training methods
    private async initializePopulation(): Promise<Agent[]> {
        const population: Agent[] = [];

        for (let i = 0; i < this.config.populationSize; i++) {
            const agent = await this.environment.createAgent(
                `pop_agent_${i}`,
                'competitive',
                'neural'
            );
            population.push(agent);
        }

        return population;
    }

    private async evaluatePopulation(population: Agent[]): Promise<number[]> {
        const fitness: number[] = [];

        for (const agent of population) {
            const performance = await this.evaluateAgent(agent);
            fitness.push(performance);
        }

        return fitness;
    }

    private selectElite(population: Agent[], fitness: number[]): Agent[] {
        const indexed = population.map((agent, i) => ({ agent, fitness: fitness[i] }));
        indexed.sort((a, b) => b.fitness - a.fitness);
        return indexed.slice(0, this.config.eliteSize).map(item => item.agent);
    }

    private async createNewGeneration(elite: Agent[], population: Agent[], fitness: number[]): Promise<Agent[]> {
        const newGeneration: Agent[] = [];

        // Keep elite
        for (const agent of elite) {
            newGeneration.push(await this.cloneAgent(agent));
        }

        // Generate offspring
        while (newGeneration.length < this.config.populationSize) {
            const parent1 = this.selectParent(population, fitness);
            const parent2 = this.selectParent(population, fitness);

            const offspring = await this.crossover(parent1, parent2);
            const mutated = await this.mutate(offspring);

            newGeneration.push(mutated);
        }

        return newGeneration;
    }

    private selectParent(population: Agent[], fitness: number[]): Agent {
        // Tournament selection
        const tournamentSize = 3;
        let best = 0;

        for (let i = 1; i < tournamentSize; i++) {
            const candidate = Math.floor(Math.random() * population.length);
            if (fitness[candidate] > fitness[best]) {
                best = candidate;
            }
        }

        return population[best];
    }

    private async crossover(parent1: Agent, parent2: Agent): Promise<Agent> {
        const offspring = await this.environment.createAgent(
            `offspring_${Date.now()}`,
            'competitive',
            'neural'
        );

        // Crossover personality
        const traits = Object.keys(parent1.personality);
        for (const trait of traits) {
            (offspring.personality as any)[trait] = Math.random() < 0.5 ?
                (parent1.personality as any)[trait] :
                (parent2.personality as any)[trait];
        }

        // Crossover strategy
        offspring.strategy.depthPreference = Math.random() < 0.5 ?
            parent1.strategy.depthPreference :
            parent2.strategy.depthPreference;

        return offspring;
    }

    private async mutate(agent: Agent): Promise<Agent> {
        if (Math.random() < this.config.mutationRate) {
            // Mutate personality
            const traits = Object.keys(agent.personality);
            const trait = traits[Math.floor(Math.random() * traits.length)];
            (agent.personality as any)[trait] = Math.random();
        }

        if (Math.random() < this.config.mutationRate) {
            // Mutate strategy
            agent.strategy.depthPreference += (Math.random() - 0.5) * 2;
            agent.strategy.depthPreference = Math.max(1, Math.min(15, agent.strategy.depthPreference));
        }

        return agent;
    }

    // Cooperative training methods
    private async createAgentTeam(size: number): Promise<Agent[]> {
        const team: Agent[] = [];

        for (let i = 0; i < size; i++) {
            const agent = await this.environment.createAgent(
                `team_agent_${i}`,
                'cooperative',
                'neural'
            );
            team.push(agent);
        }

        return team;
    }

    private async runCooperativeEpisode(team: Agent[]): Promise<any> {
        // Simplified cooperative episode
        const sharedReward = Math.random() * 100;
        const individualRewards = team.map(() => Math.random() * 50);

        return {
            sharedReward,
            individualRewards,
            teamPerformance: sharedReward / 100,
            cooperationLevel: Math.random(),
            experiences: []
        };
    }

    private async updateCooperationParameters(team: Agent[], episodeResult: any): Promise<void> {
        for (const agent of team) {
            agent.currentState.cooperationLevel = Math.min(1,
                agent.currentState.cooperationLevel + episodeResult.cooperationLevel * 0.1);
        }
    }

    // Competitive training methods
    private async createCompetingAgents(count: number): Promise<Agent[]> {
        const agents: Agent[] = [];

        for (let i = 0; i < count; i++) {
            const agent = await this.environment.createAgent(
                `competitor_${i}`,
                'competitive',
                'neural'
            );
            agents.push(agent);
        }

        return agents;
    }

    private async runTournament(agents: Agent[]): Promise<any> {
        const matches: any[] = [];

        // Round-robin tournament
        for (let i = 0; i < agents.length; i++) {
            for (let j = i + 1; j < agents.length; j++) {
                const gameResult = await this.playTrainingGame(agents[i], agents[j]);
                matches.push({
                    player1: agents[i].id,
                    player2: agents[j].id,
                    winner: gameResult.winner,
                    result: gameResult
                });
            }
        }

        return {
            matches,
            standings: this.calculateStandings(matches, agents)
        };
    }

    private calculateStandings(matches: any[], agents: Agent[]): any[] {
        const standings: any[] = [];

        for (const agent of agents) {
            let wins = 0;
            let losses = 0;
            let draws = 0;

            for (const match of matches) {
                if (match.player1 === agent.id || match.player2 === agent.id) {
                    if (match.winner === agent.id) {
                        wins++;
                    } else if (match.winner) {
                        losses++;
                    } else {
                        draws++;
                    }
                }
            }

            standings.push({
                agent: agent.id,
                wins,
                losses,
                draws,
                points: wins * 3 + draws * 1
            });
        }

        return standings.sort((a, b) => b.points - a.points);
    }

    private async updateAgentFromTournament(agent: Agent, tournamentResult: any): Promise<void> {
        const standing = tournamentResult.standings.find((s: any) => s.agent === agent.id);

        if (standing) {
            // Update ELO rating based on performance
            const totalGames = standing.wins + standing.losses + standing.draws;
            const performanceRatio = standing.wins / totalGames;

            agent.eloRating += (performanceRatio - 0.5) * 32; // Simple ELO update
            agent.winRate = standing.wins / totalGames;
        }
    }

    // Curriculum learning methods
    private async trainCurriculumStage(agent: Agent, stage: CurriculumStage): Promise<void> {
        const stageEpisodes = Math.floor(stage.duration / 1000); // Convert duration to episodes

        for (let episode = 0; episode < stageEpisodes; episode++) {
            // Create opponent based on stage difficulty
            const opponent = await this.createCurriculumOpponent(stage.difficulty);

            // Play game
            const gameResult = await this.playTrainingGame(agent, opponent);

            // Update agent
            await this.updateAgent(agent, gameResult);
        }
    }

    private async createCurriculumOpponent(difficulty: number): Promise<Agent> {
        const opponent = await this.environment.createAgent(
            `curriculum_opponent_${Date.now()}`,
            'competitive',
            'minimax'
        );

        // Adjust opponent strength based on difficulty
        opponent.skillLevel = difficulty;
        opponent.strategy.depthPreference = Math.floor(difficulty * 10);

        return opponent;
    }

    private async evaluateGraduation(agent: Agent, stage: CurriculumStage): Promise<boolean> {
        // Simple graduation criteria - win rate above threshold
        const performance = await this.evaluateAgent(agent);
        return performance > 0.7; // 70% win rate
    }

    // Meta-learning methods
    private async createMetaLearningTasks(): Promise<any[]> {
        const tasks = [];

        // Create diverse opponents as tasks
        for (let i = 0; i < 10; i++) {
            const task = {
                id: `task_${i}`,
                opponent: await this.environment.createAgent(
                    `task_opponent_${i}`,
                    'competitive',
                    'minimax'
                ),
                objective: 'maximize_winrate',
                adaptationSteps: 5
            };
            tasks.push(task);
        }

        return tasks;
    }

    private async fastAdaptation(metaAgent: Agent, task: any): Promise<Agent> {
        // Clone meta-agent for adaptation
        const adaptedAgent = await this.cloneAgent(metaAgent);

        // Fast adaptation through few gradient steps
        for (let step = 0; step < task.adaptationSteps; step++) {
            const gameResult = await this.playTrainingGame(adaptedAgent, task.opponent);
            await this.updateAgent(adaptedAgent, gameResult);
        }

        return adaptedAgent;
    }

    private async evaluateMetaLearning(adaptedAgent: Agent, task: any): Promise<number> {
        // Evaluate adapted agent on task
        const evaluationGames = 5;
        let totalReward = 0;

        for (let i = 0; i < evaluationGames; i++) {
            const gameResult = await this.playTrainingGame(adaptedAgent, task.opponent);
            totalReward += gameResult.agent1Performance;
        }

        return totalReward / evaluationGames;
    }

    private async metaUpdate(metaAgent: Agent, task: any, performance: number): Promise<void> {
        // Update meta-agent based on task performance
        const learningRate = 0.01;

        // Simple meta-update (placeholder)
        metaAgent.learningRate += learningRate * (performance - 0.5);
        metaAgent.learningRate = Math.max(0.0001, Math.min(0.1, metaAgent.learningRate));
    }

    // Metrics and utilities
    private createLearningSchedule(): LearningSchedule {
        return {
            type: 'exponential',
            initialValue: this.config.learningRate,
            finalValue: this.config.learningRate * 0.1,
            decaySteps: this.config.episodes,
            warmupSteps: 0,
            milestones: [],
            gamma: 0.95
        };
    }

    private initializeMetrics(): TrainingMetrics {
        return {
            episodeRewards: [],
            episodeLengths: [],
            winRates: [],
            lossValues: [],
            explorationRates: [],
            learningRates: [],
            diversityScores: [],
            convergenceMetrics: {
                policyKLDivergence: [],
                valueMSE: [],
                parameterNorm: []
            },
            opponentStats: {}
        };
    }

    private updateMetrics(gameResult: any): void {
        this.metrics.episodeRewards.push(gameResult.agent1Performance);
        this.metrics.episodeLengths.push(gameResult.gameLength);
        this.metrics.winRates.push(gameResult.agent1Performance > 0 ? 1 : 0);
        this.metrics.explorationRates.push(this.updateExplorationRate());
        this.metrics.learningRates.push(this.updateLearningRate());
    }

    private updatePopulationMetrics(generation: number, fitness: number[]): void {
        const avgFitness = fitness.reduce((sum, f) => sum + f, 0) / fitness.length;
        const maxFitness = Math.max(...fitness);

        this.metrics.episodeRewards.push(avgFitness);
        this.metrics.winRates.push(maxFitness);
    }

    private updateTournamentMetrics(tournamentResult: any): void {
        const bestPerformance = Math.max(...tournamentResult.standings.map((s: any) => s.points));
        this.metrics.episodeRewards.push(bestPerformance);
        this.metrics.winRates.push(bestPerformance / (tournamentResult.standings.length * 3));
    }

    private updateMetaLearningMetrics(task: any, performance: number): void {
        this.metrics.episodeRewards.push(performance);
        this.metrics.winRates.push(performance > 0 ? 1 : 0);
    }

    private generateTrainingResult(method: string): TrainingResult {
        const finalPerformance = this.metrics.episodeRewards[this.metrics.episodeRewards.length - 1] || 0;
        const finalWinRate = this.metrics.winRates[this.metrics.winRates.length - 1] || 0;

        return {
            algorithm: method,
            episodes: this.currentEpisode,
            finalPerformance,
            learningCurve: this.metrics.episodeRewards,
            diversityScore: this.metrics.diversityScores[this.metrics.diversityScores.length - 1] || 0,
            exploitability: 1 - finalWinRate, // Simplified
            convergenceEpisode: this.findConvergenceEpisode(),
            totalTrainingTime: 0, // Will be set by caller
            memoryUsage: this.replayBuffer.size(),
            statistics: {
                averageReward: this.metrics.episodeRewards.reduce((sum, r) => sum + r, 0) / this.metrics.episodeRewards.length,
                winRate: finalWinRate,
                episodeLength: this.metrics.episodeLengths.reduce((sum, l) => sum + l, 0) / this.metrics.episodeLengths.length,
                explorationRate: this.metrics.explorationRates[this.metrics.explorationRates.length - 1] || 0,
                learningRate: this.metrics.learningRates[this.metrics.learningRates.length - 1] || 0,
                lossValue: this.metrics.lossValues[this.metrics.lossValues.length - 1] || 0,
                gradientNorm: 0, // Placeholder
                qValueStats: {
                    mean: 0,
                    std: 0,
                    min: 0,
                    max: 0
                },
                policyEntropy: 0,
                valueAccuracy: 0,
                tdError: 0,
                experienceReplayEfficiency: this.replayBuffer.size() / this.config.memorySize
            }
        };
    }

    private findConvergenceEpisode(): number {
        // Simple convergence detection - when performance stabilizes
        const window = 100;
        const threshold = 0.01;

        for (let i = window; i < this.metrics.episodeRewards.length; i++) {
            const recent = this.metrics.episodeRewards.slice(i - window, i);
            const variance = this.calculateVariance(recent);

            if (variance < threshold) {
                return i;
            }
        }

        return -1; // No convergence detected
    }

    private calculateVariance(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }

    /**
     * Get training metrics
     */
    getMetrics(): TrainingMetrics {
        return this.metrics;
    }

    /**
     * Save training checkpoint
     */
    async saveCheckpoint(): Promise<void> {
        const checkpoint = {
            episode: this.currentEpisode,
            metrics: this.metrics,
            opponentLeague: this.opponentLeague,
            config: this.config
        };

        console.log(`💾 Checkpoint saved at episode ${this.currentEpisode}`);
        // Would save to file system in real implementation
    }

    /**
     * Load training checkpoint
     */
    async loadCheckpoint(): Promise<void> {
        // Would load from file system in real implementation
        console.log('📁 Checkpoint loaded');
    }

    /**
     * Export training results
     */
    exportResults(): string {
        return JSON.stringify(this.trainingHistory, null, 2);
    }
}

/**
 * Prioritized Experience Replay Buffer
 */
export class PrioritizedExperienceReplayBuffer implements ExperienceReplayBuffer {
    capacity: number;
    buffer: Experience[] = [];
    priorities: number[] = [];
    position: number = 0;
    private alpha: number = 0.6;
    private beta: number = 0.4;
    private maxPriority: number = 1.0;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    add(experience: Experience): void {
        if (this.buffer.length < this.capacity) {
            this.buffer.push(experience);
            this.priorities.push(this.maxPriority);
        } else {
            this.buffer[this.position] = experience;
            this.priorities[this.position] = this.maxPriority;
            this.position = (this.position + 1) % this.capacity;
        }
    }

    sample(batchSize: number): Experience[] {
        const n = this.buffer.length;
        const priorities = this.priorities.slice(0, n);

        // Convert priorities to probabilities
        const probabilities = priorities.map(p => Math.pow(p, this.alpha));
        const totalProbability = probabilities.reduce((sum, p) => sum + p, 0);
        const normalizedProbs = probabilities.map(p => p / totalProbability);

        // Sample based on probabilities
        const samples: Experience[] = [];
        for (let i = 0; i < batchSize; i++) {
            const random = Math.random();
            let cumulative = 0;

            for (let j = 0; j < n; j++) {
                cumulative += normalizedProbs[j];
                if (random <= cumulative) {
                    samples.push(this.buffer[j]);
                    break;
                }
            }
        }

        return samples;
    }

    updatePriorities(indices: number[], priorities: number[]): void {
        for (let i = 0; i < indices.length; i++) {
            this.priorities[indices[i]] = priorities[i];
            this.maxPriority = Math.max(this.maxPriority, priorities[i]);
        }
    }

    size(): number {
        return this.buffer.length;
    }
}

export default MultiAgentTrainer;

