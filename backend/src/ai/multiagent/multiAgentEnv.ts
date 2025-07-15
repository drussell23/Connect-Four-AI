// src/ai/multiagent/multiAgentEnv.ts
import { CellValue } from '../connect4AI';
import { Connect4Environment } from '../environment';

export interface Agent {
    id: string;
    name: string;
    type: 'competitive' | 'cooperative' | 'mixed' | 'adversarial';
    algorithm: string;
    skillLevel: number;
    winRate: number;
    gamesPlayed: number;
    eloRating: number;
    personality: AgentPersonality;
    strategy: AgentStrategy;
    learningRate: number;
    explorationRate: number;
    experience: Experience[];
    lastAction: AgentAction | null;
    currentState: AgentState;
    communication: CommunicationModule;
    metadata: AgentMetadata;
}

export interface AgentPersonality {
    aggressiveness: number; // 0-1 scale
    riskTolerance: number;
    patience: number;
    adaptability: number;
    creativity: number;
    consistency: number;
    teamwork: number; // For cooperative scenarios
    competitiveness: number;
}

export interface AgentStrategy {
    primaryApproach: 'minimax' | 'mcts' | 'neural' | 'hybrid' | 'evolutionary';
    fallbackApproach: 'random' | 'minimax' | 'mcts';
    depthPreference: number;
    timeManagement: 'fixed' | 'adaptive' | 'anytime';
    evaluationWeights: {
        material: number;
        position: number;
        threats: number;
        opportunities: number;
        center: number;
        mobility: number;
    };
    specializations: string[];
}

export interface AgentAction {
    move: number;
    confidence: number;
    reasoning: string;
    timestamp: number;
    alternatives: Array<{ move: number; score: number; reasoning: string }>;
    communication?: CommunicationMessage[];
    metadata: {
        thinkingTime: number;
        nodesExplored: number;
        depth: number;
        evaluation: number;
    };
}

export interface AgentState {
    isActive: boolean;
    currentGame: string | null;
    position: 'Red' | 'Yellow' | 'Observer';
    energy: number; // Energy/stamina for long tournaments
    stress: number; // Stress level affecting performance
    confidence: number;
    recentPerformance: number[];
    adaptationLevel: number;
    cooperationLevel: number;
    messageQueue: CommunicationMessage[];
}

export interface CommunicationMessage {
    from: string;
    to: string | 'broadcast';
    type: 'strategy' | 'threat' | 'opportunity' | 'coordination' | 'meta';
    content: any;
    timestamp: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CommunicationModule {
    canSend: boolean;
    canReceive: boolean;
    bandwidth: number; // Messages per turn
    protocols: string[];
    messageHistory: CommunicationMessage[];
    vocabulary: string[];
    understanding: { [key: string]: number };
}

export interface Experience {
    gameId: string;
    boardState: CellValue[][];
    action: AgentAction;
    reward: number;
    nextState: CellValue[][];
    opponent: string;
    outcome: 'win' | 'loss' | 'draw';
    lessons: string[];
    timestamp: number;
}

export interface AgentMetadata {
    createdAt: number;
    lastUpdated: number;
    generation: number;
    parentAgents: string[];
    mutations: string[];
    specialAchievements: string[];
    weaknesses: string[];
    strengths: string[];
    preferredOpponents: string[];
    avoidsOpponents: string[];
}

export interface MultiAgentGame {
    id: string;
    type: 'competitive' | 'cooperative' | 'mixed' | 'tournament' | 'league';
    agents: Agent[];
    environment: Connect4Environment;
    currentTurn: number;
    gameState: 'waiting' | 'active' | 'paused' | 'finished';
    boardState: CellValue[][];
    moveHistory: AgentAction[];
    communicationLog: CommunicationMessage[];
    observers: Agent[];
    rules: GameRules;
    scoring: ScoringSystem;
    statistics: GameStatistics;
    startTime: number;
    endTime?: number;
}

export interface GameRules {
    maxMoves: number;
    timeLimit: number;
    communicationAllowed: boolean;
    observersAllowed: boolean;
    handicaps: { [agentId: string]: number };
    specialRules: string[];
    allowedAlgorithms: string[];
    collaborationLevel: number;
}

export interface ScoringSystem {
    winPoints: number;
    lossPoints: number;
    drawPoints: number;
    moveQualityBonus: boolean;
    timeBonus: boolean;
    communicationBonus: boolean;
    creativityBonus: boolean;
    consistencyBonus: boolean;
}

export interface GameStatistics {
    totalMoves: number;
    averageThinkingTime: number;
    threatsCreated: number;
    opportunitiesMissed: number;
    communicationMessages: number;
    creativeMoves: number;
    blunders: number;
    brilliantMoves: number;
    openingCategory: string;
    endgameCategory: string;
}

export interface MultiAgentScenario {
    name: string;
    description: string;
    agents: number;
    type: 'competitive' | 'cooperative' | 'mixed';
    rules: GameRules;
    objectives: string[];
    successCriteria: string[];
    constraints: string[];
    duration: number;
    iterations: number;
}

/**
 * Comprehensive Multi-Agent Environment for Connect Four
 * 
 * Features:
 * - Multi-agent competitive and cooperative gameplay
 * - Advanced agent communication systems
 * - Population-based training and evolution
 * - Tournament and league management
 * - Diverse agent personalities and strategies
 * - Real-time performance monitoring
 * - Adaptive difficulty and skill matching
 * - Experience replay and meta-learning
 */
export class MultiAgentEnvironment {
    private agents: Map<string, Agent> = new Map();
    private games: Map<string, MultiAgentGame> = new Map();
    private scenarios: Map<string, MultiAgentScenario> = new Map();
    private environment: Connect4Environment;
    private communicationHub: CommunicationHub;
    private performanceTracker: PerformanceTracker;
    private agentFactory: AgentFactory;
    private config: MultiAgentConfig;

    constructor(config: Partial<MultiAgentConfig> = {}) {
        this.config = {
            maxAgents: 100,
            maxConcurrentGames: 10,
            communicationEnabled: true,
            observersEnabled: true,
            adaptiveDifficulty: true,
            diversityMaintenance: true,
            experienceReplay: true,
            metaLearning: true,
            populationSize: 20,
            eliteSize: 5,
            mutationRate: 0.1,
            crossoverRate: 0.3,
            ...config
        };

        this.environment = new Connect4Environment();
        this.communicationHub = new CommunicationHub();
        this.performanceTracker = new PerformanceTracker();
        this.agentFactory = new AgentFactory();

        this.initializeDefaultScenarios();
    }

    /**
     * Create a new agent with specified characteristics
     */
    async createAgent(
        name: string,
        type: Agent['type'],
        algorithm: string,
        personality?: Partial<AgentPersonality>,
        strategy?: Partial<AgentStrategy>
    ): Promise<Agent> {
        const agent = this.agentFactory.createAgent(name, type, algorithm, personality, strategy);
        this.agents.set(agent.id, agent);

        console.log(`🤖 Created agent: ${name} (${algorithm}, ${type})`);
        return agent;
    }

    /**
     * Start a multi-agent game
     */
    async startGame(
        gameType: MultiAgentGame['type'],
        participantIds: string[],
        rules?: Partial<GameRules>,
        observers?: string[]
    ): Promise<MultiAgentGame> {
        if (participantIds.length < 2) {
            throw new Error('At least 2 agents required for a game');
        }

        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const participants = participantIds.map(id => this.agents.get(id)!).filter(Boolean);
        const observerAgents = observers?.map(id => this.agents.get(id)!).filter(Boolean) || [];

        // Reset environment and get initial board state
        const initialObservation = this.environment.reset();
        const initialBoard = initialObservation.gameState.board || this.createEmptyBoard();

        const game: MultiAgentGame = {
            id: gameId,
            type: gameType,
            agents: participants,
            environment: this.environment,
            currentTurn: 0,
            gameState: 'waiting',
            boardState: initialBoard,
            moveHistory: [],
            communicationLog: [],
            observers: observerAgents,
            rules: this.createGameRules(rules),
            scoring: this.createScoringSystem(),
            statistics: this.initializeGameStatistics(),
            startTime: Date.now()
        };

        this.games.set(gameId, game);

        // Initialize agent states for this game
        await this.initializeGameAgents(game);

        console.log(`🎮 Started ${gameType} game: ${gameId} with ${participants.length} agents`);
        return game;
    }

    /**
     * Execute a game turn
     */
    async executeTurn(gameId: string): Promise<{
        move: AgentAction;
        gameState: 'active' | 'finished';
        winner?: string;
        boardState: CellValue[][];
    }> {
        const game = this.games.get(gameId);
        if (!game) throw new Error(`Game ${gameId} not found`);

        const currentPlayer = game.agents[game.currentTurn % game.agents.length];

        // Pre-move communication phase
        if (game.rules.communicationAllowed) {
            await this.handleCommunicationPhase(game, currentPlayer);
        }

        // Get move from current player
        const move = await this.getAgentMove(currentPlayer, game);

        // Validate and execute move
        const validMove = this.environment.isValidMove(move.move);
        if (!validMove) {
            throw new Error(`Invalid move ${move.move} by agent ${currentPlayer.name}`);
        }

        // Execute move and get result
        const stepResult = this.environment.step(move.move);
        const newBoardState = stepResult.observation.gameState.board || game.boardState;

        // Update game state
        game.boardState = newBoardState;
        game.moveHistory.push(move);
        game.currentTurn++;

        // Check for game end
        let gameState: 'active' | 'finished' = 'active';
        let winner: string | undefined;

        if (stepResult.done) {
            gameState = 'finished';
            game.gameState = 'finished';
            game.endTime = Date.now();

            if (stepResult.info.winner) {
                winner = stepResult.info.winner === 'Red' ?
                    game.agents[0].id : game.agents[1].id;
            }

            // Process game end
            await this.processGameEnd(game, winner);
        }

        // Update statistics
        this.updateGameStatistics(game, move);

        // Post-move communication phase
        if (game.rules.communicationAllowed) {
            await this.handlePostMoveCommunication(game, currentPlayer, move);
        }

        return {
            move,
            gameState,
            winner,
            boardState: newBoardState
        };
    }

    /**
     * Run a complete multi-agent scenario
     */
    async runScenario(scenarioName: string, iterations: number = 1): Promise<{
        results: ScenarioResult[];
        statistics: ScenarioStatistics;
        insights: string[];
    }> {
        const scenario = this.scenarios.get(scenarioName);
        if (!scenario) throw new Error(`Scenario ${scenarioName} not found`);

        const results: ScenarioResult[] = [];

        console.log(`🎯 Running scenario: ${scenarioName} (${iterations} iterations)`);

        for (let i = 0; i < iterations; i++) {
            console.log(`  Iteration ${i + 1}/${iterations}`);

            const result = await this.executeScenarioIteration(scenario, i);
            results.push(result);

            // Adaptive learning between iterations
            if (this.config.metaLearning) {
                await this.updateAgentsFromResults(results);
            }
        }

        const statistics = this.calculateScenarioStatistics(results);
        const insights = this.generateScenarioInsights(results, statistics);

        return { results, statistics, insights };
    }

    /**
     * Create a tournament between agents
     */
    async runTournament(
        participantIds: string[],
        format: 'round_robin' | 'elimination' | 'swiss' | 'league',
        rounds: number = 1
    ): Promise<TournamentResult> {
        console.log(`🏆 Starting ${format} tournament with ${participantIds.length} agents`);

        const tournament = new Tournament(format, participantIds, rounds);
        const results: TournamentResult = {
            format,
            participants: participantIds,
            rounds,
            matches: [],
            rankings: [],
            statistics: {},
            startTime: Date.now(),
            endTime: 0
        };

        // Generate match pairings
        const matches = tournament.generateMatches();

        for (const match of matches) {
            const game = await this.startGame('competitive', [match.player1, match.player2]);
            const matchResult = await this.playCompleteGame(game);

            results.matches.push({
                player1: match.player1,
                player2: match.player2,
                winner: matchResult.winner,
                moves: matchResult.moves,
                duration: matchResult.duration
            });

            // Update agent ratings
            await this.updateAgentRatings(match.player1, match.player2, matchResult.winner);
        }

        // Calculate final rankings
        results.rankings = this.calculateTournamentRankings(results.matches);
        results.statistics = this.calculateTournamentStatistics(results);
        results.endTime = Date.now();

        console.log(`🏆 Tournament completed! Winner: ${results.rankings[0].agentId}`);
        return results;
    }

    /**
     * Population-based training
     */
    async runPopulationTraining(
        generations: number,
        evaluationGames: number = 10
    ): Promise<{
        generations: PopulationGeneration[];
        bestAgents: Agent[];
        evolutionStats: EvolutionStatistics;
    }> {
        console.log(`🧬 Starting population training for ${generations} generations`);

        const population = this.initializePopulation();
        const generationHistory: PopulationGeneration[] = [];

        for (let gen = 0; gen < generations; gen++) {
            console.log(`  Generation ${gen + 1}/${generations}`);

            // Evaluate all agents
            const fitness = await this.evaluatePopulation(population, evaluationGames);

            // Select elite agents
            const elite = this.selectElite(population, fitness);

            // Generate new population
            const newPopulation = await this.generateNewPopulation(elite, population, fitness);

            // Record generation
            generationHistory.push({
                generation: gen,
                population: [...population],
                fitness,
                elite,
                averageFitness: fitness.reduce((sum, f) => sum + f, 0) / fitness.length,
                bestFitness: Math.max(...fitness),
                diversity: this.calculatePopulationDiversity(population)
            });

            // Update population
            population.splice(0, population.length, ...newPopulation);
        }

        const bestAgents = this.selectElite(population,
            await this.evaluatePopulation(population, evaluationGames));

        const evolutionStats = this.calculateEvolutionStatistics(generationHistory);

        return {
            generations: generationHistory,
            bestAgents,
            evolutionStats
        };
    }

    /**
 * Cooperative training scenario
 */
    async runCooperativeTraining(
        agentIds: string[],
        episodeCount: number,
        sharedObjective: string = 'maximize_joint_performance'
    ): Promise<{
        episodes: CooperativeEpisode[];
        finalPerformance: number;
        cooperationMetrics: CooperationMetrics;
    }> {
        console.log(`🤝 Starting cooperative training with ${agentIds.length} agents`);

        const episodes: CooperativeEpisode[] = [];
        const agents = agentIds.map(id => this.agents.get(id)!);

        for (let episode = 0; episode < episodeCount; episode++) {
            const episodeResult = await this.runCooperativeEpisode(
                agents,
                episode,
                sharedObjective
            );
            episodes.push(episodeResult);

            // Update cooperation parameters
            await this.updateCooperationParameters(agents, episodeResult);
        }

        const finalPerformance = this.calculateCooperativePerformance(episodes);
        const cooperationMetrics = this.calculateCooperationMetrics(episodes);

        return {
            episodes,
            finalPerformance,
            cooperationMetrics
        };
    }

    // Helper methods for missing implementations
    private createEmptyBoard(): CellValue[][] {
        return Array(6).fill(null).map(() => Array(7).fill('Empty'));
    }

    private async executeScenarioIteration(scenario: MultiAgentScenario, iteration: number): Promise<ScenarioResult> {
        // Create agents for this iteration
        const agentIds: string[] = [];
        for (let i = 0; i < scenario.agents; i++) {
            const agent = await this.createAgent(
                `${scenario.name}_agent_${i}`,
                scenario.type === 'competitive' ? 'competitive' : 'cooperative',
                'minimax'
            );
            agentIds.push(agent.id);
        }

        // Run the scenario
        const startTime = Date.now();
        const game = await this.startGame(scenario.type, agentIds, scenario.rules);
        const gameResult = await this.playCompleteGame(game);

        return {
            scenarioName: scenario.name,
            iteration,
            participants: agentIds,
            outcome: gameResult.winner || 'draw',
            duration: Date.now() - startTime,
            metrics: {
                moves: gameResult.moves,
                averageThinkingTime: gameResult.duration / gameResult.moves
            },
            events: [`Game completed with ${gameResult.moves} moves`]
        };
    }

    private async updateAgentsFromResults(results: ScenarioResult[]): Promise<void> {
        // Update agent parameters based on results
        for (const result of results) {
            for (const participantId of result.participants) {
                const agent = this.agents.get(participantId);
                if (agent) {
                    // Simple adaptation based on performance
                    if (result.outcome === agent.id) {
                        agent.learningRate *= 1.05; // Increase learning rate for winners
                    } else {
                        agent.learningRate *= 0.95; // Decrease for losers
                    }
                }
            }
        }
    }

    private calculateScenarioStatistics(results: ScenarioResult[]): ScenarioStatistics {
        const totalIterations = results.length;
        const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalIterations;
        const successRate = results.filter(r => r.outcome !== 'error').length / totalIterations;

        return {
            totalIterations,
            averageDuration,
            successRate,
            participantStats: {},
            performanceMetrics: {
                averageMovesPerGame: results.reduce((sum, r) => sum + (r.metrics.moves || 0), 0) / totalIterations
            }
        };
    }

    private generateScenarioInsights(results: ScenarioResult[], statistics: ScenarioStatistics): string[] {
        const insights: string[] = [];

        insights.push(`Success rate: ${(statistics.successRate * 100).toFixed(1)}%`);
        insights.push(`Average game duration: ${(statistics.averageDuration / 1000).toFixed(1)}s`);

        if (statistics.performanceMetrics.averageMovesPerGame) {
            insights.push(`Average moves per game: ${statistics.performanceMetrics.averageMovesPerGame.toFixed(1)}`);
        }

        return insights;
    }

    private async playCompleteGame(game: MultiAgentGame): Promise<{
        winner?: string;
        moves: number;
        duration: number;
    }> {
        const startTime = Date.now();
        let moves = 0;
        let winner: string | undefined;

        game.gameState = 'active';

        while (game.gameState === 'active' && moves < 42) {
            const turnResult = await this.executeTurn(game.id);
            moves++;

            if (turnResult.gameState === 'finished') {
                winner = turnResult.winner;
                break;
            }
        }

        return {
            winner,
            moves,
            duration: Date.now() - startTime
        };
    }

    private async updateAgentRatings(player1Id: string, player2Id: string, winner?: string): Promise<void> {
        const player1 = this.agents.get(player1Id);
        const player2 = this.agents.get(player2Id);

        if (!player1 || !player2) return;

        // Simple ELO rating update
        const k = 32; // K-factor
        const expectedScore1 = 1 / (1 + Math.pow(10, (player2.eloRating - player1.eloRating) / 400));
        const expectedScore2 = 1 - expectedScore1;

        let actualScore1 = 0.5; // Default to draw
        let actualScore2 = 0.5;

        if (winner === player1Id) {
            actualScore1 = 1;
            actualScore2 = 0;
        } else if (winner === player2Id) {
            actualScore1 = 0;
            actualScore2 = 1;
        }

        player1.eloRating += k * (actualScore1 - expectedScore1);
        player2.eloRating += k * (actualScore2 - expectedScore2);
    }

    private calculateTournamentRankings(matches: TournamentResult['matches']): TournamentResult['rankings'] {
        const playerStats: { [id: string]: { wins: number; losses: number; draws: number } } = {};

        // Initialize stats
        for (const match of matches) {
            if (!playerStats[match.player1]) {
                playerStats[match.player1] = { wins: 0, losses: 0, draws: 0 };
            }
            if (!playerStats[match.player2]) {
                playerStats[match.player2] = { wins: 0, losses: 0, draws: 0 };
            }
        }

        // Calculate stats
        for (const match of matches) {
            if (match.winner === match.player1) {
                playerStats[match.player1].wins++;
                playerStats[match.player2].losses++;
            } else if (match.winner === match.player2) {
                playerStats[match.player2].wins++;
                playerStats[match.player1].losses++;
            } else {
                playerStats[match.player1].draws++;
                playerStats[match.player2].draws++;
            }
        }

        // Create rankings
        const rankings = Object.entries(playerStats).map(([agentId, stats]) => ({
            rank: 0,
            agentId,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            points: stats.wins * 3 + stats.draws * 1
        }));

        // Sort by points and assign ranks
        rankings.sort((a, b) => b.points - a.points);
        rankings.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        return rankings;
    }

    private calculateTournamentStatistics(results: TournamentResult): { [key: string]: any } {
        return {
            totalMatches: results.matches.length,
            averageGameLength: results.matches.reduce((sum, m) => sum + m.moves, 0) / results.matches.length,
            averageGameDuration: results.matches.reduce((sum, m) => sum + m.duration, 0) / results.matches.length,
            draws: results.matches.filter(m => !m.winner).length
        };
    }

    // Population training methods
    private initializePopulation(): Agent[] {
        const population: Agent[] = [];

        for (let i = 0; i < this.config.populationSize; i++) {
            const agent = this.agentFactory.createAgent(
                `pop_agent_${i}`,
                'competitive',
                'minimax',
                this.generateRandomPersonality(),
                this.generateRandomStrategy()
            );
            population.push(agent);
        }

        return population;
    }

    private generateRandomPersonality(): Partial<AgentPersonality> {
        return {
            aggressiveness: Math.random(),
            riskTolerance: Math.random(),
            patience: Math.random(),
            adaptability: Math.random(),
            creativity: Math.random(),
            consistency: Math.random(),
            teamwork: Math.random(),
            competitiveness: Math.random()
        };
    }

    private generateRandomStrategy(): Partial<AgentStrategy> {
        return {
            depthPreference: Math.floor(Math.random() * 6) + 3,
            evaluationWeights: {
                material: Math.random() * 2,
                position: Math.random() * 2,
                threats: Math.random() * 2,
                opportunities: Math.random() * 2,
                center: Math.random() * 2,
                mobility: Math.random() * 2
            }
        };
    }

    private async evaluatePopulation(population: Agent[], evaluationGames: number): Promise<number[]> {
        const fitness: number[] = [];

        for (const agent of population) {
            let totalReward = 0;

            // Play against random opponents
            for (let game = 0; game < evaluationGames; game++) {
                const opponent = population[Math.floor(Math.random() * population.length)];
                if (opponent.id !== agent.id) {
                    const gameResult = await this.playAgentsGame(agent, opponent);
                    totalReward += gameResult.winner === agent.id ? 100 :
                        gameResult.winner === opponent.id ? -50 : 25;
                }
            }

            fitness.push(totalReward / evaluationGames);
        }

        return fitness;
    }

    private async playAgentsGame(agent1: Agent, agent2: Agent): Promise<{
        winner?: string;
        moves: number;
        duration: number;
    }> {
        const game = await this.startGame('competitive', [agent1.id, agent2.id]);
        return await this.playCompleteGame(game);
    }

    private selectElite(population: Agent[], fitness: number[]): Agent[] {
        const indexed = population.map((agent, i) => ({ agent, fitness: fitness[i] }));
        indexed.sort((a, b) => b.fitness - a.fitness);
        return indexed.slice(0, this.config.eliteSize).map(item => item.agent);
    }

    private async generateNewPopulation(elite: Agent[], population: Agent[], fitness: number[]): Promise<Agent[]> {
        const newPopulation: Agent[] = [];

        // Keep elite
        newPopulation.push(...elite);

        // Generate offspring
        while (newPopulation.length < this.config.populationSize) {
            const parent1 = this.selectParent(population, fitness);
            const parent2 = this.selectParent(population, fitness);

            const offspring = await this.crossoverAgents(parent1, parent2);
            const mutatedOffspring = this.mutateAgent(offspring);

            newPopulation.push(mutatedOffspring);
        }

        return newPopulation;
    }

    private selectParent(population: Agent[], fitness: number[]): Agent {
        // Tournament selection
        const tournamentSize = 3;
        let bestIndex = Math.floor(Math.random() * population.length);
        let bestFitness = fitness[bestIndex];

        for (let i = 1; i < tournamentSize; i++) {
            const index = Math.floor(Math.random() * population.length);
            if (fitness[index] > bestFitness) {
                bestIndex = index;
                bestFitness = fitness[index];
            }
        }

        return population[bestIndex];
    }

    private async crossoverAgents(parent1: Agent, parent2: Agent): Promise<Agent> {
        const offspring = this.agentFactory.createAgent(
            `offspring_${Date.now()}`,
            'competitive',
            'minimax'
        );

        // Crossover personality traits
        offspring.personality = {
            aggressiveness: Math.random() < 0.5 ? parent1.personality.aggressiveness : parent2.personality.aggressiveness,
            riskTolerance: Math.random() < 0.5 ? parent1.personality.riskTolerance : parent2.personality.riskTolerance,
            patience: Math.random() < 0.5 ? parent1.personality.patience : parent2.personality.patience,
            adaptability: Math.random() < 0.5 ? parent1.personality.adaptability : parent2.personality.adaptability,
            creativity: Math.random() < 0.5 ? parent1.personality.creativity : parent2.personality.creativity,
            consistency: Math.random() < 0.5 ? parent1.personality.consistency : parent2.personality.consistency,
            teamwork: Math.random() < 0.5 ? parent1.personality.teamwork : parent2.personality.teamwork,
            competitiveness: Math.random() < 0.5 ? parent1.personality.competitiveness : parent2.personality.competitiveness
        };

        // Crossover strategy
        offspring.strategy.depthPreference = Math.random() < 0.5 ? parent1.strategy.depthPreference : parent2.strategy.depthPreference;

        return offspring;
    }

    private mutateAgent(agent: Agent): Agent {
        if (Math.random() < this.config.mutationRate) {
            // Mutate personality
            const trait = Object.keys(agent.personality)[Math.floor(Math.random() * Object.keys(agent.personality).length)];
            (agent.personality as any)[trait] = Math.random();
        }

        if (Math.random() < this.config.mutationRate) {
            // Mutate strategy
            agent.strategy.depthPreference = Math.max(1, Math.min(10, agent.strategy.depthPreference + (Math.random() - 0.5) * 2));
        }

        return agent;
    }

    private calculatePopulationDiversity(population: Agent[]): number {
        // Simple diversity measure based on personality variance
        const traits = ['aggressiveness', 'riskTolerance', 'patience', 'adaptability'];
        let totalVariance = 0;

        for (const trait of traits) {
            const values = population.map(agent => (agent.personality as any)[trait]);
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            totalVariance += variance;
        }

        return totalVariance / traits.length;
    }

    private calculateEvolutionStatistics(generations: PopulationGeneration[]): EvolutionStatistics {
        return {
            generationCount: generations.length,
            fitnessProgress: generations.map(g => g.averageFitness),
            diversityProgress: generations.map(g => g.diversity),
            bestAgentHistory: generations.map(g => g.elite[0]),
            convergenceGeneration: generations.findIndex(g => g.diversity < 0.1) || -1,
            totalTrainingTime: Date.now() - (generations[0]?.generation || 0)
        };
    }

    // Cooperative training methods
    private async runCooperativeEpisode(
        agents: Agent[],
        episode: number,
        sharedObjective: string
    ): Promise<CooperativeEpisode> {
        const startTime = Date.now();

        // Simple cooperative episode simulation
        const individualRewards: { [agentId: string]: number } = {};
        for (const agent of agents) {
            individualRewards[agent.id] = Math.random() * 100;
        }

        const sharedReward = Object.values(individualRewards).reduce((sum, reward) => sum + reward, 0) / agents.length;

        return {
            episode,
            participants: agents.map(a => a.id),
            sharedObjective,
            individualRewards,
            sharedReward,
            cooperationLevel: Math.random(),
            communicationVolume: Math.floor(Math.random() * 10),
            duration: Date.now() - startTime
        };
    }

    private async updateCooperationParameters(agents: Agent[], episode: CooperativeEpisode): Promise<void> {
        for (const agent of agents) {
            // Update cooperation level based on episode performance
            agent.currentState.cooperationLevel = Math.min(1, agent.currentState.cooperationLevel + 0.1);
        }
    }

    private calculateCooperativePerformance(episodes: CooperativeEpisode[]): number {
        return episodes.reduce((sum, episode) => sum + episode.sharedReward, 0) / episodes.length;
    }

    private calculateCooperationMetrics(episodes: CooperativeEpisode[]): CooperationMetrics {
        const avgCooperation = episodes.reduce((sum, ep) => sum + ep.cooperationLevel, 0) / episodes.length;
        const avgCommunication = episodes.reduce((sum, ep) => sum + ep.communicationVolume, 0) / episodes.length;

        return {
            averageCooperationLevel: avgCooperation,
            communicationEfficiency: avgCommunication / 10, // Normalized
            knowledgeSharing: Math.random(), // Placeholder
            conflictResolution: Math.random(), // Placeholder
            teamPerformance: episodes.reduce((sum, ep) => sum + ep.sharedReward, 0) / episodes.length / 100
        };
    }

    // Helper methods
    private initializeDefaultScenarios(): void {
        // Competitive scenarios
        this.scenarios.set('competitive_basic', {
            name: 'Basic Competition',
            description: 'Two agents compete in standard Connect Four',
            agents: 2,
            type: 'competitive',
            rules: this.createGameRules(),
            objectives: ['win_game', 'improve_strategy'],
            successCriteria: ['game_completion', 'valid_moves'],
            constraints: ['time_limit', 'legal_moves'],
            duration: 300000, // 5 minutes
            iterations: 10
        });

        // Cooperative scenarios
        this.scenarios.set('cooperative_learning', {
            name: 'Cooperative Learning',
            description: 'Multiple agents learn together',
            agents: 4,
            type: 'cooperative',
            rules: this.createGameRules({ collaborationLevel: 0.8 }),
            objectives: ['shared_learning', 'knowledge_transfer'],
            successCriteria: ['performance_improvement', 'knowledge_sharing'],
            constraints: ['communication_bandwidth', 'learning_rate'],
            duration: 600000, // 10 minutes
            iterations: 20
        });

        // Mixed scenarios
        this.scenarios.set('mixed_tournament', {
            name: 'Mixed Tournament',
            description: 'Tournament with different agent types',
            agents: 8,
            type: 'mixed',
            rules: this.createGameRules({
                communicationAllowed: true,
                observersAllowed: true
            }),
            objectives: ['ranking_determination', 'strategy_diversity'],
            successCriteria: ['fair_competition', 'diverse_strategies'],
            constraints: ['tournament_format', 'fairness_rules'],
            duration: 1800000, // 30 minutes
            iterations: 1
        });
    }

    private createGameRules(rules?: Partial<GameRules>): GameRules {
        return {
            maxMoves: 42,
            timeLimit: 30000, // 30 seconds per move
            communicationAllowed: false,
            observersAllowed: false,
            handicaps: {},
            specialRules: [],
            allowedAlgorithms: ['minimax', 'mcts', 'neural', 'hybrid'],
            collaborationLevel: 0,
            ...rules
        };
    }

    private createScoringSystem(): ScoringSystem {
        return {
            winPoints: 3,
            lossPoints: 0,
            drawPoints: 1,
            moveQualityBonus: true,
            timeBonus: true,
            communicationBonus: false,
            creativityBonus: true,
            consistencyBonus: true
        };
    }

    private initializeGameStatistics(): GameStatistics {
        return {
            totalMoves: 0,
            averageThinkingTime: 0,
            threatsCreated: 0,
            opportunitiesMissed: 0,
            communicationMessages: 0,
            creativeMoves: 0,
            blunders: 0,
            brilliantMoves: 0,
            openingCategory: 'unknown',
            endgameCategory: 'unknown'
        };
    }

    private async initializeGameAgents(game: MultiAgentGame): Promise<void> {
        for (const agent of game.agents) {
            agent.currentState.isActive = true;
            agent.currentState.currentGame = game.id;
            agent.currentState.position = game.agents.indexOf(agent) === 0 ? 'Red' : 'Yellow';
            agent.currentState.energy = 100;
            agent.currentState.stress = 0;
            agent.currentState.confidence = 0.5;
            agent.currentState.messageQueue = [];
        }
    }

    private async handleCommunicationPhase(game: MultiAgentGame, currentPlayer: Agent): Promise<void> {
        // Allow agents to communicate before move
        for (const agent of game.agents) {
            if (agent.communication.canSend && agent.id !== currentPlayer.id) {
                const message = await this.generateCommunicationMessage(agent, game);
                if (message) {
                    this.communicationHub.sendMessage(message);
                    game.communicationLog.push(message);
                }
            }
        }
    }

    private async getAgentMove(agent: Agent, game: MultiAgentGame): Promise<AgentAction> {
        const startTime = Date.now();

        // Get agent's decision
        const decision = await this.requestAgentDecision(agent, game);

        const action: AgentAction = {
            move: decision.move,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            timestamp: Date.now(),
            alternatives: decision.alternatives || [],
            communication: decision.communication,
            metadata: {
                thinkingTime: Date.now() - startTime,
                nodesExplored: decision.nodesExplored || 0,
                depth: decision.depth || 0,
                evaluation: decision.evaluation || 0
            }
        };

        agent.lastAction = action;
        return action;
    }

    private async requestAgentDecision(agent: Agent, game: MultiAgentGame): Promise<any> {
        // This would interface with the actual AI algorithms
        // For now, return a mock decision
        return {
            move: Math.floor(Math.random() * 7),
            confidence: Math.random(),
            reasoning: `${agent.strategy.primaryApproach} decision`,
            alternatives: [],
            nodesExplored: Math.floor(Math.random() * 10000),
            depth: Math.floor(Math.random() * 10),
            evaluation: Math.random() * 1000 - 500
        };
    }

    private async processGameEnd(game: MultiAgentGame, winner?: string): Promise<void> {
        // Update agent statistics
        for (const agent of game.agents) {
            agent.gamesPlayed++;

            if (winner === agent.id) {
                agent.winRate = ((agent.winRate * (agent.gamesPlayed - 1)) + 1) / agent.gamesPlayed;
            } else {
                agent.winRate = (agent.winRate * (agent.gamesPlayed - 1)) / agent.gamesPlayed;
            }

            // Store experience
            const experience: Experience = {
                gameId: game.id,
                boardState: game.boardState,
                action: agent.lastAction!,
                reward: this.calculateReward(agent, game, winner),
                nextState: game.boardState,
                opponent: game.agents.find(a => a.id !== agent.id)?.id || 'unknown',
                outcome: winner === agent.id ? 'win' : winner ? 'loss' : 'draw',
                lessons: this.extractLessons(agent, game),
                timestamp: Date.now()
            };

            agent.experience.push(experience);

            // Limit experience history
            if (agent.experience.length > 1000) {
                agent.experience.shift();
            }
        }
    }

    private calculateReward(agent: Agent, game: MultiAgentGame, winner?: string): number {
        let reward = 0;

        if (winner === agent.id) {
            reward += 100; // Win bonus
        } else if (winner) {
            reward -= 50; // Loss penalty
        } else {
            reward += 25; // Draw
        }

        // Move quality bonus
        if (game.scoring.moveQualityBonus && agent.lastAction) {
            reward += agent.lastAction.confidence * 20;
        }

        // Time bonus
        if (game.scoring.timeBonus && agent.lastAction) {
            const timeEfficiency = 1 - (agent.lastAction.metadata.thinkingTime / game.rules.timeLimit);
            reward += timeEfficiency * 10;
        }

        return reward;
    }

    private extractLessons(agent: Agent, game: MultiAgentGame): string[] {
        const lessons: string[] = [];

        // Analyze game for learning opportunities
        if (game.statistics.blunders > 0) {
            lessons.push('Avoid blunder moves');
        }

        if (game.statistics.opportunitiesMissed > 2) {
            lessons.push('Improve opportunity recognition');
        }

        if (game.statistics.threatsCreated < 3) {
            lessons.push('Create more threats');
        }

        return lessons;
    }

    private updateGameStatistics(game: MultiAgentGame, move: AgentAction): void {
        game.statistics.totalMoves++;
        game.statistics.averageThinkingTime =
            (game.statistics.averageThinkingTime * (game.statistics.totalMoves - 1) +
                move.metadata.thinkingTime) / game.statistics.totalMoves;

        // Additional statistics would be calculated here
    }

    private async handlePostMoveCommunication(
        game: MultiAgentGame,
        currentPlayer: Agent,
        move: AgentAction
    ): Promise<void> {
        // Allow agents to react to the move
        for (const agent of game.agents) {
            if (agent.communication.canSend && agent.id !== currentPlayer.id) {
                const reaction = await this.generateReactionMessage(agent, game, move);
                if (reaction) {
                    this.communicationHub.sendMessage(reaction);
                    game.communicationLog.push(reaction);
                }
            }
        }
    }

    private async generateCommunicationMessage(agent: Agent, game: MultiAgentGame): Promise<CommunicationMessage | null> {
        // Generate appropriate communication based on game state
        return null; // Placeholder
    }

    private async generateReactionMessage(
        agent: Agent,
        game: MultiAgentGame,
        move: AgentAction
    ): Promise<CommunicationMessage | null> {
        // Generate reaction to opponent's move
        return null; // Placeholder
    }

    // Additional helper methods would be implemented here...

    /**
     * Get agent by ID
     */
    getAgent(agentId: string): Agent | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Get all agents
     */
    getAllAgents(): Agent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get active games
     */
    getActiveGames(): MultiAgentGame[] {
        return Array.from(this.games.values()).filter(game => game.gameState === 'active');
    }

    /**
     * Get game by ID
     */
    getGame(gameId: string): MultiAgentGame | undefined {
        return this.games.get(gameId);
    }

    /**
     * Clean up finished games
     */
    cleanupFinishedGames(): void {
        const finishedGames = Array.from(this.games.entries())
            .filter(([_, game]) => game.gameState === 'finished');

        for (const [gameId, _] of finishedGames) {
            this.games.delete(gameId);
        }
    }

    /**
     * Export agent data
     */
    exportAgents(): string {
        const agentData = Array.from(this.agents.values());
        return JSON.stringify(agentData, null, 2);
    }

    /**
     * Import agent data
     */
    importAgents(data: string): void {
        const agentData = JSON.parse(data) as Agent[];
        for (const agent of agentData) {
            this.agents.set(agent.id, agent);
        }
    }
}

// Supporting interfaces and types
export interface MultiAgentConfig {
    maxAgents: number;
    maxConcurrentGames: number;
    communicationEnabled: boolean;
    observersEnabled: boolean;
    adaptiveDifficulty: boolean;
    diversityMaintenance: boolean;
    experienceReplay: boolean;
    metaLearning: boolean;
    populationSize: number;
    eliteSize: number;
    mutationRate: number;
    crossoverRate: number;
}

export interface ScenarioResult {
    scenarioName: string;
    iteration: number;
    participants: string[];
    outcome: string;
    duration: number;
    metrics: { [key: string]: number };
    events: string[];
}

export interface ScenarioStatistics {
    totalIterations: number;
    averageDuration: number;
    successRate: number;
    participantStats: { [agentId: string]: any };
    performanceMetrics: { [metric: string]: number };
}

export interface TournamentResult {
    format: string;
    participants: string[];
    rounds: number;
    matches: Array<{
        player1: string;
        player2: string;
        winner?: string;
        moves: number;
        duration: number;
    }>;
    rankings: Array<{
        rank: number;
        agentId: string;
        wins: number;
        losses: number;
        draws: number;
        points: number;
    }>;
    statistics: { [key: string]: any };
    startTime: number;
    endTime: number;
}

export interface PopulationGeneration {
    generation: number;
    population: Agent[];
    fitness: number[];
    elite: Agent[];
    averageFitness: number;
    bestFitness: number;
    diversity: number;
}

export interface EvolutionStatistics {
    generationCount: number;
    fitnessProgress: number[];
    diversityProgress: number[];
    bestAgentHistory: Agent[];
    convergenceGeneration: number;
    totalTrainingTime: number;
}

export interface CooperativeEpisode {
    episode: number;
    participants: string[];
    sharedObjective: string;
    individualRewards: { [agentId: string]: number };
    sharedReward: number;
    cooperationLevel: number;
    communicationVolume: number;
    duration: number;
}

export interface CooperationMetrics {
    averageCooperationLevel: number;
    communicationEfficiency: number;
    knowledgeSharing: number;
    conflictResolution: number;
    teamPerformance: number;
}

// Helper classes
class CommunicationHub {
    sendMessage(message: CommunicationMessage): void {
        // Handle message routing
    }
}

class PerformanceTracker {
    // Track agent performance metrics
}

class AgentFactory {
    createAgent(
        name: string,
        type: Agent['type'],
        algorithm: string,
        personality?: Partial<AgentPersonality>,
        strategy?: Partial<AgentStrategy>
    ): Agent {
        const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
            id: agentId,
            name,
            type,
            algorithm,
            skillLevel: 0.5,
            winRate: 0,
            gamesPlayed: 0,
            eloRating: 1200,
            personality: {
                aggressiveness: 0.5,
                riskTolerance: 0.5,
                patience: 0.5,
                adaptability: 0.5,
                creativity: 0.5,
                consistency: 0.5,
                teamwork: 0.5,
                competitiveness: 0.5,
                ...personality
            },
            strategy: {
                primaryApproach: 'minimax',
                fallbackApproach: 'random',
                depthPreference: 6,
                timeManagement: 'fixed',
                evaluationWeights: {
                    material: 1.0,
                    position: 0.8,
                    threats: 1.2,
                    opportunities: 1.1,
                    center: 0.9,
                    mobility: 0.7
                },
                specializations: [],
                ...strategy
            },
            learningRate: 0.01,
            explorationRate: 0.1,
            experience: [],
            lastAction: null,
            currentState: {
                isActive: false,
                currentGame: null,
                position: 'Observer',
                energy: 100,
                stress: 0,
                confidence: 0.5,
                recentPerformance: [],
                adaptationLevel: 0,
                cooperationLevel: 0,
                messageQueue: []
            },
            communication: {
                canSend: true,
                canReceive: true,
                bandwidth: 3,
                protocols: ['basic', 'strategic'],
                messageHistory: [],
                vocabulary: ['threat', 'opportunity', 'defense', 'attack'],
                understanding: {}
            },
            metadata: {
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                generation: 0,
                parentAgents: [],
                mutations: [],
                specialAchievements: [],
                weaknesses: [],
                strengths: [],
                preferredOpponents: [],
                avoidsOpponents: []
            }
        };
    }
}

class Tournament {
    constructor(
        private format: string,
        private participants: string[],
        private rounds: number
    ) { }

    generateMatches(): Array<{ player1: string; player2: string }> {
        const matches: Array<{ player1: string; player2: string }> = [];

        if (this.format === 'round_robin') {
            // Generate all possible pairings
            for (let i = 0; i < this.participants.length; i++) {
                for (let j = i + 1; j < this.participants.length; j++) {
                    matches.push({
                        player1: this.participants[i],
                        player2: this.participants[j]
                    });
                }
            }
        }

        return matches;
    }
}

export default MultiAgentEnvironment;
