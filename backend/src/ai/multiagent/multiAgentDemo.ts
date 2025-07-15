// src/ai/multiagent/multiAgentDemo.ts
import MultiAgentEnvironment from './multiAgentEnv';
import MultiAgentTrainer from './multiAgentTraining';
import AgentCommunicationSystem from './agentCommunication';

/**
 * Comprehensive Multi-Agent Connect Four Demo
 * 
 * This demonstration shows how to use all the multi-agent components together:
 * 1. Multi-Agent Environment - for managing agents and games
 * 2. Multi-Agent Training - for training agents with various methods
 * 3. Agent Communication - for coordinating and sharing information
 */
export class MultiAgentDemo {
    private environment: MultiAgentEnvironment;
    private trainer: MultiAgentTrainer;
    private communicationSystem: AgentCommunicationSystem;

    constructor() {
        // Initialize environment
        this.environment = new MultiAgentEnvironment({
            maxAgents: 20,
            communicationEnabled: true,
            metaLearning: true,
            populationSize: 10
        });

        // Initialize trainer
        this.trainer = new MultiAgentTrainer(this.environment, {
            method: 'self_play',
            episodes: 1000,
            populationSize: 10,
            learningRate: 0.001,
            useExperienceReplay: true,
            usePrioritizedReplay: true
        });

        // Initialize communication system
        this.communicationSystem = new AgentCommunicationSystem({
            topology: 'fully_connected',
            reliability: 0.95,
            encryption: true
        });
    }

    /**
     * Run the complete multi-agent demonstration
     */
    async runCompleteDemo(): Promise<void> {
        console.log('🚀 Starting Complete Multi-Agent Connect Four Demo\n');

        try {
            // Phase 1: Basic Multi-Agent Setup
            console.log('='.repeat(60));
            console.log('📋 PHASE 1: Basic Multi-Agent Setup');
            console.log('='.repeat(60));
            await this.phase1_BasicSetup();

            // Phase 2: Agent Communication
            console.log('\n' + '='.repeat(60));
            console.log('💬 PHASE 2: Agent Communication');
            console.log('='.repeat(60));
            await this.phase2_Communication();

            // Phase 3: Competitive Training
            console.log('\n' + '='.repeat(60));
            console.log('⚔️ PHASE 3: Competitive Training');
            console.log('='.repeat(60));
            await this.phase3_CompetitiveTraining();

            // Phase 4: Cooperative Learning
            console.log('\n' + '='.repeat(60));
            console.log('🤝 PHASE 4: Cooperative Learning');
            console.log('='.repeat(60));
            await this.phase4_CooperativeLearning();

            // Phase 5: Population Evolution
            console.log('\n' + '='.repeat(60));
            console.log('🧬 PHASE 5: Population Evolution');
            console.log('='.repeat(60));
            await this.phase5_PopulationEvolution();

            // Phase 6: Tournament and Ranking
            console.log('\n' + '='.repeat(60));
            console.log('🏆 PHASE 6: Tournament and Ranking');
            console.log('='.repeat(60));
            await this.phase6_Tournament();

            // Phase 7: Advanced Features
            console.log('\n' + '='.repeat(60));
            console.log('🔬 PHASE 7: Advanced Features');
            console.log('='.repeat(60));
            await this.phase7_AdvancedFeatures();

            console.log('\n' + '='.repeat(60));
            console.log('✅ DEMO COMPLETED SUCCESSFULLY!');
            console.log('='.repeat(60));

        } catch (error) {
            console.error('❌ Demo failed:', error);
        }
    }

    /**
     * Phase 1: Basic Multi-Agent Setup
     */
    private async phase1_BasicSetup(): Promise<void> {
        console.log('🔧 Creating diverse agents...');

        // Create different types of agents
        const agents = [
            await this.environment.createAgent('AlphaBot', 'competitive', 'minimax', {
                aggressiveness: 0.8,
                riskTolerance: 0.6,
                patience: 0.4
            }),
            await this.environment.createAgent('BetaBot', 'competitive', 'mcts', {
                aggressiveness: 0.3,
                riskTolerance: 0.8,
                patience: 0.9
            }),
            await this.environment.createAgent('GammaBot', 'cooperative', 'neural', {
                aggressiveness: 0.5,
                riskTolerance: 0.5,
                teamwork: 0.9
            }),
            await this.environment.createAgent('DeltaBot', 'mixed', 'hybrid', {
                adaptability: 0.9,
                creativity: 0.8,
                consistency: 0.7
            })
        ];

        console.log(`✅ Created ${agents.length} agents with diverse personalities`);

        // Display agent characteristics
        for (const agent of agents) {
            console.log(`  🤖 ${agent.name}: ${agent.algorithm} (${agent.type})`);
            console.log(`     Aggressiveness: ${agent.personality.aggressiveness.toFixed(2)}`);
            console.log(`     Risk Tolerance: ${agent.personality.riskTolerance.toFixed(2)}`);
            console.log(`     Teamwork: ${agent.personality.teamwork.toFixed(2)}`);
        }

        // Run a basic game
        console.log('\n🎮 Running basic competitive game...');
        const game = await this.environment.startGame('competitive', [agents[0].id, agents[1].id]);
        const gameResult = await this.playCompleteGame(game.id);

        console.log(`🏁 Game completed: ${gameResult.moves} moves, winner: ${gameResult.winner || 'Draw'}`);
    }

    /**
     * Phase 2: Agent Communication
     */
    private async phase2_Communication(): Promise<void> {
        console.log('📡 Setting up agent communication...');

        // Get agents
        const agents = this.environment.getAllAgents();

        // Start a conversation about strategy
        console.log('💬 Starting strategy discussion...');
        const conversationId = await this.communicationSystem.startConversation(
            agents[0],
            [agents[1], agents[2]],
            'Connect Four Strategy Discussion',
            { gameType: 'competitive', difficulty: 'medium' }
        );

        // Simulate message exchange
        await this.communicationSystem.sendMessage(
            agents[0],
            agents[1],
            'strategy',
            {
                recommendation: 'Focus on center control',
                confidence: 0.8,
                reasoning: 'Center columns provide more winning opportunities'
            }
        );

        await this.communicationSystem.sendMessage(
            agents[1],
            agents[0],
            'strategy',
            {
                recommendation: 'Consider threat blocking',
                confidence: 0.9,
                reasoning: 'Defensive play prevents opponent wins'
            }
        );

        // Share knowledge
        console.log('📚 Sharing knowledge between agents...');
        await this.communicationSystem.shareKnowledge(
            agents[0],
            [agents[1], agents[2]],
            {
                pattern: 'three_in_row',
                effectiveness: 0.85,
                counters: ['blocking', 'distraction']
            },
            'strategy'
        );

        // Start negotiation
        console.log('🤝 Starting negotiation session...');
        const negotiationId = await this.communicationSystem.startNegotiation(
            agents[0],
            [agents[1], agents[2]],
            'Cooperative Learning Agreement',
            5
        );

        console.log('✅ Communication systems active');
        console.log(`   Active conversations: ${this.communicationSystem.getActiveConversations().length}`);
        console.log(`   Active negotiations: ${this.communicationSystem.getActiveNegotiations().length}`);
    }

    /**
     * Phase 3: Competitive Training
     */
    private async phase3_CompetitiveTraining(): Promise<void> {
        console.log('⚔️ Starting competitive training...');

        // Configure trainer for competitive training
        const competitiveTrainer = new MultiAgentTrainer(this.environment, {
            method: 'competitive',
            episodes: 100,
            populationSize: 4,
            learningRate: 0.01,
            explorationRate: 0.2,
            useExperienceReplay: true
        });

        // Start training
        const trainingResult = await competitiveTrainer.startTraining();

        console.log('📊 Competitive Training Results:');
        console.log(`   Final Performance: ${trainingResult.finalPerformance.toFixed(3)}`);
        console.log(`   Win Rate: ${trainingResult.statistics.winRate.toFixed(3)}`);
        console.log(`   Training Time: ${(trainingResult.totalTrainingTime / 1000).toFixed(1)}s`);
        console.log(`   Convergence Episode: ${trainingResult.convergenceEpisode}`);

        // Display learning curve
        console.log('\n📈 Learning Curve (last 10 episodes):');
        const lastTenRewards = trainingResult.learningCurve.slice(-10);
        lastTenRewards.forEach((reward, i) => {
            console.log(`   Episode ${trainingResult.episodes - 9 + i}: ${reward.toFixed(3)}`);
        });
    }

    /**
     * Phase 4: Cooperative Learning
     */
    private async phase4_CooperativeLearning(): Promise<void> {
        console.log('🤝 Starting cooperative learning...');

        // Get agents for cooperative training
        const agents = this.environment.getAllAgents();
        const cooperativeAgents = agents.filter(a => a.type === 'cooperative' || a.type === 'mixed');

        if (cooperativeAgents.length >= 2) {
            // Run cooperative training
            const cooperativeResult = await this.environment.runCooperativeTraining(
                cooperativeAgents.map(a => a.id),
                50, // episodes
                'maximize_joint_performance'
            );

            console.log('📊 Cooperative Learning Results:');
            console.log(`   Final Performance: ${cooperativeResult.finalPerformance.toFixed(3)}`);
            console.log(`   Average Cooperation: ${cooperativeResult.cooperationMetrics.averageCooperationLevel.toFixed(3)}`);
            console.log(`   Communication Efficiency: ${cooperativeResult.cooperationMetrics.communicationEfficiency.toFixed(3)}`);
            console.log(`   Team Performance: ${cooperativeResult.cooperationMetrics.teamPerformance.toFixed(3)}`);

            // Build consensus on strategy
            console.log('\n🎯 Building consensus on strategy...');
            const consensusResult = await this.communicationSystem.buildConsensus(
                cooperativeAgents[0],
                cooperativeAgents.slice(1),
                { strategy: 'cooperative_minimax', priority: 'high' },
                0.7
            );

            console.log(`   Consensus Reached: ${consensusResult.consensus ? 'Yes' : 'No'}`);
            console.log(`   Confidence: ${consensusResult.confidence.toFixed(3)}`);
        } else {
            console.log('⚠️ Not enough cooperative agents for cooperative learning');
        }
    }

    /**
     * Phase 5: Population Evolution
     */
    private async phase5_PopulationEvolution(): Promise<void> {
        console.log('🧬 Starting population evolution...');

        // Configure trainer for population-based training
        const populationTrainer = new MultiAgentTrainer(this.environment, {
            method: 'population',
            episodes: 200,
            populationSize: 8,
            eliteSize: 2,
            mutationRate: 0.15,
            crossoverRate: 0.7
        });

        // Start evolution
        const evolutionResult = await populationTrainer.startTraining();

        console.log('📊 Population Evolution Results:');
        console.log(`   Generations: ${evolutionResult.episodes / 8}`);
        console.log(`   Final Performance: ${evolutionResult.finalPerformance.toFixed(3)}`);
        console.log(`   Diversity Score: ${evolutionResult.diversityScore.toFixed(3)}`);
        console.log(`   Training Time: ${(evolutionResult.totalTrainingTime / 1000).toFixed(1)}s`);

        // Display fitness progression
        console.log('\n📈 Fitness Progression:');
        const fitnessPoints = evolutionResult.learningCurve.filter((_, i) => i % 10 === 0);
        fitnessPoints.forEach((fitness, i) => {
            console.log(`   Generation ${i + 1}: ${fitness.toFixed(3)}`);
        });
    }

    /**
     * Phase 6: Tournament and Ranking
     */
    private async phase6_Tournament(): Promise<void> {
        console.log('🏆 Starting tournament...');

        // Get all agents
        const agents = this.environment.getAllAgents();
        const participantIds = agents.map(a => a.id);

        // Run round-robin tournament
        const tournamentResult = await this.environment.runTournament(
            participantIds,
            'round_robin',
            1
        );

        console.log('📊 Tournament Results:');
        console.log(`   Format: ${tournamentResult.format}`);
        console.log(`   Total Matches: ${tournamentResult.matches.length}`);
        console.log(`   Duration: ${(tournamentResult.endTime - tournamentResult.startTime) / 1000}s`);

        console.log('\n🏅 Final Rankings:');
        tournamentResult.rankings.forEach((ranking, i) => {
            const agent = agents.find(a => a.id === ranking.agentId);
            console.log(`   ${i + 1}. ${agent?.name || ranking.agentId}`);
            console.log(`      Wins: ${ranking.wins}, Losses: ${ranking.losses}, Draws: ${ranking.draws}`);
            console.log(`      Points: ${ranking.points}, ELO: ${agent?.eloRating.toFixed(0)}`);
        });

        // Display match statistics
        console.log('\n📈 Match Statistics:');
        console.log(`   Average Game Length: ${tournamentResult.statistics.averageGameLength.toFixed(1)} moves`);
        console.log(`   Average Game Duration: ${(tournamentResult.statistics.averageGameDuration / 1000).toFixed(1)}s`);
        console.log(`   Draw Rate: ${(tournamentResult.statistics.draws / tournamentResult.matches.length * 100).toFixed(1)}%`);
    }

    /**
     * Phase 7: Advanced Features
     */
    private async phase7_AdvancedFeatures(): Promise<void> {
        console.log('🔬 Demonstrating advanced features...');

        // Scenario-based learning
        console.log('🎯 Running scenario-based learning...');
        const scenarioResult = await this.environment.runScenario('competitive_basic', 3);

        console.log('📊 Scenario Results:');
        console.log(`   Success Rate: ${scenarioResult.statistics.successRate.toFixed(3)}`);
        console.log(`   Average Duration: ${(scenarioResult.statistics.averageDuration / 1000).toFixed(1)}s`);
        console.log(`   Insights: ${scenarioResult.insights.join(', ')}`);

        // Agent coordination
        console.log('\n🤖 Coordinating joint actions...');
        const agents = this.environment.getAllAgents();
        const coordinationResult = await this.communicationSystem.coordinateAction(
            agents[0],
            agents.slice(1, 3),
            {
                type: 'strategic_alignment',
                parameters: { focus: 'center_control', intensity: 0.8 }
            },
            'immediate'
        );

        console.log(`   Coordination Success: ${coordinationResult.success ? 'Yes' : 'No'}`);
        console.log(`   Responses: ${coordinationResult.responses.length}`);

        // Knowledge sharing analysis
        console.log('\n📚 Knowledge base analysis...');
        const knowledgeBase = this.communicationSystem.getKnowledgeBase();
        console.log(`   Total Facts: ${Object.keys(knowledgeBase.facts).length}`);
        console.log(`   Rules: ${knowledgeBase.rules.length}`);
        console.log(`   Strategies: ${knowledgeBase.strategies.length}`);
        console.log(`   Shared Experiences: ${knowledgeBase.experiences.length}`);

        // Communication metrics
        console.log('\n📡 Communication metrics...');
        const commMetrics = this.communicationSystem.getMetrics();
        console.log(`   Messages Sent: ${commMetrics.messagesSent}`);
        console.log(`   Messages Received: ${commMetrics.messagesReceived}`);
        console.log(`   Drop Rate: ${(commMetrics.messagesDropped / commMetrics.messagesSent * 100).toFixed(1)}%`);
        console.log(`   Average Latency: ${commMetrics.averageLatency.toFixed(1)}ms`);
    }

    /**
     * Helper method to play a complete game
     */
    private async playCompleteGame(gameId: string): Promise<{
        winner?: string;
        moves: number;
        duration: number;
    }> {
        const startTime = Date.now();
        let moves = 0;
        let winner: string | undefined;

        const game = this.environment.getGame(gameId);
        if (!game) {
            throw new Error(`Game ${gameId} not found`);
        }

        // Set game to active
        game.gameState = 'active';

        while (game.gameState === 'active' && moves < 42) {
            const turnResult = await this.environment.executeTurn(gameId);
            moves++;

            if (turnResult.gameState === 'finished') {
                winner = turnResult.winner;
                break;
            }

            // Add small delay for visualization
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return {
            winner,
            moves,
            duration: Date.now() - startTime
        };
    }

    /**
     * Run a quick demo of key features
     */
    async runQuickDemo(): Promise<void> {
        console.log('⚡ Running Quick Multi-Agent Demo\n');

        try {
            // Create a few agents
            const agents = await Promise.all([
                this.environment.createAgent('QuickBot1', 'competitive', 'minimax'),
                this.environment.createAgent('QuickBot2', 'competitive', 'mcts'),
                this.environment.createAgent('QuickBot3', 'cooperative', 'neural')
            ]);

            console.log(`✅ Created ${agents.length} agents`);

            // Run a quick game
            const game = await this.environment.startGame('competitive', [agents[0].id, agents[1].id]);
            const gameResult = await this.playCompleteGame(game.id);

            console.log(`🎮 Game completed: ${gameResult.moves} moves, winner: ${gameResult.winner || 'Draw'}`);

            // Quick training session
            console.log('🏋️ Quick training session...');
            const quickTrainer = new MultiAgentTrainer(this.environment, {
                method: 'competitive',
                episodes: 10,
                populationSize: 2
            });

            const trainingResult = await quickTrainer.startTraining();
            console.log(`📊 Training completed: Final performance ${trainingResult.finalPerformance.toFixed(3)}`);

            // Communication test
            console.log('📡 Testing communication...');
            await this.communicationSystem.sendMessage(
                agents[0],
                agents[1],
                'greeting',
                { message: 'Hello, fellow AI!' }
            );

            console.log('✅ Quick demo completed successfully!');

        } catch (error) {
            console.error('❌ Quick demo failed:', error);
        }
    }

    /**
     * Performance benchmark
     */
    async runPerformanceBenchmark(): Promise<void> {
        console.log('🏎️ Running Performance Benchmark\n');

        const benchmarkResults = {
            agentCreation: 0,
            gameExecution: 0,
            training: 0,
            communication: 0
        };

        // Benchmark agent creation
        console.log('⏱️ Benchmarking agent creation...');
        const startTime = Date.now();

        const agents = await Promise.all(
            Array.from({ length: 10 }, (_, i) =>
                this.environment.createAgent(`BenchAgent${i}`, 'competitive', 'minimax')
            )
        );

        benchmarkResults.agentCreation = Date.now() - startTime;

        // Benchmark game execution
        console.log('⏱️ Benchmarking game execution...');
        const gameStart = Date.now();

        const game = await this.environment.startGame('competitive', [agents[0].id, agents[1].id]);
        await this.playCompleteGame(game.id);

        benchmarkResults.gameExecution = Date.now() - gameStart;

        // Benchmark training
        console.log('⏱️ Benchmarking training...');
        const trainingStart = Date.now();

        const benchmarkTrainer = new MultiAgentTrainer(this.environment, {
            method: 'competitive',
            episodes: 5,
            populationSize: 2
        });

        await benchmarkTrainer.startTraining();
        benchmarkResults.training = Date.now() - trainingStart;

        // Benchmark communication
        console.log('⏱️ Benchmarking communication...');
        const commStart = Date.now();

        for (let i = 0; i < 10; i++) {
            await this.communicationSystem.sendMessage(
                agents[0],
                agents[1],
                'benchmark',
                { iteration: i }
            );
        }

        benchmarkResults.communication = Date.now() - commStart;

        // Display results
        console.log('\n📊 Benchmark Results:');
        console.log(`   Agent Creation (10 agents): ${benchmarkResults.agentCreation}ms`);
        console.log(`   Game Execution (1 game): ${benchmarkResults.gameExecution}ms`);
        console.log(`   Training (5 episodes): ${benchmarkResults.training}ms`);
        console.log(`   Communication (10 messages): ${benchmarkResults.communication}ms`);

        const totalTime = Object.values(benchmarkResults).reduce((sum, time) => sum + time, 0);
        console.log(`   Total Time: ${totalTime}ms`);
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        console.log('🧹 Cleaning up resources...');

        // Clean up communication system
        this.communicationSystem.stop();

        // Clean up finished games
        this.environment.cleanupFinishedGames();

        console.log('✅ Cleanup completed');
    }

    /**
     * Export demo results
     */
    exportResults(): string {
        const results = {
            timestamp: new Date().toISOString(),
            agents: this.environment.getAllAgents().map(agent => ({
                id: agent.id,
                name: agent.name,
                type: agent.type,
                algorithm: agent.algorithm,
                winRate: agent.winRate,
                gamesPlayed: agent.gamesPlayed,
                eloRating: agent.eloRating
            })),
            communicationMetrics: this.communicationSystem.getMetrics(),
            knowledgeBase: this.communicationSystem.getKnowledgeBase()
        };

        return JSON.stringify(results, null, 2);
    }
}

/**
 * Main demo runner
 */
export async function runMultiAgentDemo(): Promise<void> {
    const demo = new MultiAgentDemo();

    try {
        await demo.runCompleteDemo();

        console.log('\n📄 Exporting results...');
        const results = demo.exportResults();
        console.log('✅ Results exported successfully');
        console.log(results);

        // Function returns void, not string
    } catch (error) {
        console.error('❌ Demo failed:', error);
        throw error;
    } finally {
        demo.cleanup();
    }
}

/**
 * Quick demo runner
 */
export async function runQuickMultiAgentDemo(): Promise<void> {
    const demo = new MultiAgentDemo();

    try {
        await demo.runQuickDemo();
    } catch (error) {
        console.error('❌ Quick demo failed:', error);
        throw error;
    } finally {
        demo.cleanup();
    }
}

/**
 * Performance benchmark runner
 */
export async function runPerformanceBenchmark(): Promise<void> {
    const demo = new MultiAgentDemo();

    try {
        await demo.runPerformanceBenchmark();
    } catch (error) {
        console.error('❌ Benchmark failed:', error);
        throw error;
    } finally {
        demo.cleanup();
    }
}

export default MultiAgentDemo; 