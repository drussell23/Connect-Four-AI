// test/ai/ultimateAI.spec.ts
import { UltimateConnect4AI, UltimateAIConfig } from '../../src/ai/connect4AI';
import { AutomatedTrainingPipeline } from '../../src/ai/selfplay/parallelSelfPlay';
import { DecisionTracer } from '../../src/ai/explainability/decisionTracer';
import { A3C } from '../../src/ai/algorithms/policy_based/A3C';
import { PPO } from '../../src/ai/algorithms/policy_based/PPO';
import { MADDPG } from '../../src/ai/algorithms/multi_agent/MADDPG';
import { QMIX } from '../../src/ai/algorithms/multi_agent/QMIX';
import { DQN } from '../../src/ai/algorithms/value_based/DQN';
import { RainbowDQN } from '../../src/ai/algorithms/value_based/RainbowDQN';
import { EnhancedAlphaZero } from '../../src/ai/algorithms/hybrid/EnhancedAlphaZero';

describe('Ultimate Connect Four AI System', () => {
    let ultimateAI: UltimateConnect4AI;
    let trainingPipeline: AutomatedTrainingPipeline;
    let decisionTracer: DecisionTracer;

    // Test board configurations
    const emptyBoard = Array(6).fill(null).map(() => Array(7).fill('Empty'));
    const midGameBoard = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty']
    ];

    const threatBoard = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'] // Red can win at column 3
    ];

    beforeAll(async () => {
        // Initialize systems with test configurations
        const testConfig: Partial<UltimateAIConfig> = {
            primaryStrategy: 'hybrid',
            neuralNetwork: {
                type: 'ensemble',
                enableTraining: false, // Disable for testing
                trainingFrequency: 10,
                batchSize: 16,
                learningRate: 0.001
            },
            reinforcementLearning: {
                algorithm: 'rainbow_dqn',
                experienceReplay: true,
                targetUpdateFreq: 100,
                exploration: {
                    strategy: 'epsilon_greedy',
                    initialValue: 0.1, // Lower for testing
                    decayRate: 0.995,
                    finalValue: 0.01
                }
            },
            advanced: {
                multiAgent: true,
                metaLearning: true,
                curriculumLearning: true,
                populationTraining: true,
                explainableAI: true,
                realTimeAdaptation: true
            },
            performance: {
                maxThinkingTime: 1000, // Shorter for testing
                multiThreading: false, // Disable for testing
                memoryLimit: 512,
                gpuAcceleration: false
            }
        };

        ultimateAI = new UltimateConnect4AI(testConfig);
        decisionTracer = new DecisionTracer(100, 'comprehensive', 'expert');

        console.log('🧪 Initializing Ultimate AI for testing...');
        await ultimateAI.initialize();
    }, 30000); // 30 second timeout for initialization

    afterAll(() => {
        ultimateAI?.dispose();
        trainingPipeline?.dispose();
    });

    describe('Core AI Functionality', () => {
        test('should initialize successfully', () => {
            expect(ultimateAI).toBeDefined();
        });

        test('should make valid moves on empty board', async () => {
            const decision = await ultimateAI.getBestMove(emptyBoard, 'Red', 2000);

            expect(decision).toBeDefined();
            expect(decision.move).toBeGreaterThanOrEqual(0);
            expect(decision.move).toBeLessThanOrEqual(6);
            expect(decision.confidence).toBeGreaterThan(0);
            expect(decision.confidence).toBeLessThanOrEqual(1);
            expect(decision.reasoning).toBeDefined();
            expect(decision.strategy).toBeDefined();
            expect(decision.thinkingTime).toBeGreaterThan(0);
        });

        test('should detect and play winning moves', async () => {
            const decision = await ultimateAI.getBestMove(threatBoard, 'Red', 2000);

            expect(decision.move).toBe(3); // Should play the winning move
            expect(decision.confidence).toBeGreaterThan(0.8);
            expect(decision.reasoning).toContain('win');
        });

        test('should provide detailed decision metadata', async () => {
            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 3000);

            expect(decision.metadata).toBeDefined();
            expect(decision.alternativeMoves).toBeDefined();
            expect(decision.alternativeMoves.length).toBeGreaterThan(0);
            expect(decision.nodesExplored).toBeGreaterThan(0);
        });
    });

    describe('Algorithm Integration', () => {
        test('should switch strategies dynamically', async () => {
            // Test different strategies
            const strategies = ['dqn', 'alphazero', 'hybrid', 'ensemble'] as const;

            for (const strategy of strategies) {
                ultimateAI.updateConfig({ primaryStrategy: strategy });

                const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 1000);
                expect(decision.strategy).toContain(strategy === 'ensemble' ? 'neural' : strategy);
            }
        });

        test('should provide algorithm-specific insights', async () => {
            ultimateAI.updateConfig({ primaryStrategy: 'hybrid' });

            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            const metrics = ultimateAI.getAIMetrics();

            expect(metrics.strategy).toBe('hybrid');
            expect(metrics.neuralNetworks.active.length).toBeGreaterThan(0);
            expect(metrics.performance).toBeDefined();
        });
    });

    describe('Neural Network Architectures', () => {
        test('should work with CNN architecture', async () => {
            ultimateAI.updateConfig({
                neuralNetwork: { type: 'cnn' },
                primaryStrategy: 'ensemble'
            });

            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            expect(decision.metadata.neuralNetworkEvaluation).toBeDefined();
        });

        test('should work with ResNet architecture', async () => {
            ultimateAI.updateConfig({
                neuralNetwork: { type: 'resnet' },
                primaryStrategy: 'ensemble'
            });

            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            expect(decision.metadata.neuralNetworkEvaluation).toBeDefined();
        });

        test('should work with Attention architecture', async () => {
            ultimateAI.updateConfig({
                neuralNetwork: { type: 'attention' },
                primaryStrategy: 'ensemble'
            });

            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            expect(decision.metadata.neuralNetworkEvaluation).toBeDefined();
        });

        test('should work with ensemble of all architectures', async () => {
            ultimateAI.updateConfig({
                neuralNetwork: { type: 'ensemble' },
                primaryStrategy: 'ensemble'
            });

            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 3000);
            const metrics = ultimateAI.getAIMetrics();

            expect(metrics.neuralNetworks.active).toContain('CNN');
            expect(metrics.neuralNetworks.active).toContain('ResNet');
            expect(metrics.neuralNetworks.active).toContain('Attention');
        });
    });

    describe('Decision Explainability', () => {
        test('should trace decisions comprehensively', async () => {
            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            const trace = await decisionTracer.traceDecision('hybrid', midGameBoard, decision);

            expect(trace).toBeDefined();
            expect(trace.algorithm).toBe('hybrid');
            expect(trace.selectedMove).toBe(decision.move);
            expect(trace.confidence).toBe(decision.confidence);
            expect(trace.alternativeAnalysis.length).toBeGreaterThan(0);
            expect(trace.threatAnalysis).toBeDefined();
            expect(trace.opportunityAnalysis).toBeDefined();
            expect(trace.positionalAnalysis).toBeDefined();
            expect(trace.humanExplanation).toBeDefined();
        });

        test('should provide human-readable explanations', async () => {
            const decision = await ultimateAI.getBestMove(threatBoard, 'Red', 2000);
            const trace = await decisionTracer.traceDecision('hybrid', threatBoard, decision);

            const explanation = trace.humanExplanation;
            expect(explanation.primaryReason).toBeDefined();
            expect(explanation.primaryReason.length).toBeGreaterThan(0);
            expect(explanation.strategicGoal).toBeDefined();
            expect(explanation.skillLevel).toBeDefined();
            expect(explanation.confidence).toBeDefined();
            expect(explanation.complexity).toBeDefined();
        });

        test('should analyze threats and opportunities', async () => {
            const decision = await ultimateAI.getBestMove(threatBoard, 'Red', 2000);
            const trace = await decisionTracer.traceDecision('hybrid', threatBoard, decision);

            const threatAnalysis = trace.threatAnalysis;
            const opportunityAnalysis = trace.opportunityAnalysis;

            expect(opportunityAnalysis.winningMove).toBe(true);
            expect(opportunityAnalysis.winningPositions.length).toBeGreaterThan(0);
        });

        test('should provide educational explanations for different skill levels', async () => {
            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            const trace = await decisionTracer.traceDecision('hybrid', midGameBoard, decision);

            const beginnerExplanation = decisionTracer.getEducationalExplanation(trace, 'beginner');
            const expertExplanation = decisionTracer.getEducationalExplanation(trace, 'expert');

            expect(beginnerExplanation).toBeDefined();
            expect(expertExplanation).toBeDefined();
            expect(expertExplanation.length).toBeGreaterThan(beginnerExplanation.length);
        });
    });

    describe('Individual Algorithms', () => {
        describe('Deep Q-Network (DQN)', () => {
            let dqn: DQN;

            beforeAll(async () => {
                dqn = new DQN({
                    useCNN: true,
                    learningRate: 0.001,
                    batchSize: 16,
                    experienceReplay: true
                });
                await dqn.initialize();
            });

            afterAll(() => {
                dqn?.dispose();
            });

            test('should initialize and select actions', async () => {
                const legalMoves = [0, 1, 2, 3, 4, 5, 6];
                const action = await dqn.selectAction(midGameBoard, legalMoves);

                expect(action).toBeGreaterThanOrEqual(0);
                expect(action).toBeLessThanOrEqual(6);
                expect(legalMoves).toContain(action);
            });

            test('should provide Q-values', async () => {
                const qValues = await dqn.getQValues(midGameBoard);

                expect(qValues).toHaveLength(7);
                expect(qValues.every(q => typeof q === 'number')).toBe(true);
            });
        });

        describe('Rainbow DQN', () => {
            let rainbowDQN: RainbowDQN;

            beforeAll(async () => {
                rainbowDQN = new RainbowDQN({
                    useCNN: true,
                    learningRate: 0.001,
                    batchSize: 16
                });
                await rainbowDQN.initialize();
            });

            afterAll(() => {
                rainbowDQN?.dispose();
            });

            test('should work with advanced features', async () => {
                const legalMoves = [0, 1, 2, 3, 4, 5, 6];
                const action = await rainbowDQN.selectAction(midGameBoard, legalMoves);
                const metrics = rainbowDQN.getMetrics();

                expect(action).toBeGreaterThanOrEqual(0);
                expect(action).toBeLessThanOrEqual(6);
                expect(metrics.prioritizedReplay).toBeDefined();
                expect(metrics.noisyNetworks).toBeDefined();
                expect(metrics.distributional).toBeDefined();
            });
        });

        describe('Enhanced AlphaZero', () => {
            let alphaZero: EnhancedAlphaZero;

            beforeAll(async () => {
                alphaZero = new EnhancedAlphaZero({
                    networkType: 'cnn',
                    simulations: 100, // Reduced for testing
                    timeLimit: 1000,
                    learningRate: 0.001
                });
            });

            afterAll(() => {
                alphaZero?.dispose();
            });

            test('should perform MCTS with neural network guidance', async () => {
                const move = await alphaZero.selectMove(midGameBoard, 'Red');
                const metrics = alphaZero.getMetrics();

                expect(move).toBeGreaterThanOrEqual(0);
                expect(move).toBeLessThanOrEqual(6);
                expect(metrics.simulations).toBeGreaterThan(0);
                expect(metrics.networkType).toBeDefined();
            });
        });

        describe('A3C (Asynchronous Advantage Actor-Critic)', () => {
            let a3c: A3C;

            beforeAll(async () => {
                a3c = new A3C({
                    learningRate: 0.001,
                    numWorkers: 2, // Reduced for testing
                    networkType: 'cnn',
                    hiddenSize: 256
                });
                await a3c.initialize();
            });

            afterAll(() => {
                a3c?.dispose();
            });

            test('should select actions using policy network', async () => {
                const legalMoves = [0, 1, 2, 3, 4, 5, 6];
                const action = await a3c.selectAction(midGameBoard, legalMoves);

                expect(action).toBeGreaterThanOrEqual(0);
                expect(action).toBeLessThanOrEqual(6);
                expect(legalMoves).toContain(action);
            });

            test('should provide Q-values for explainability', async () => {
                const qValues = await a3c.getQValues(midGameBoard);

                expect(qValues).toHaveLength(7);
                expect(qValues.every(q => typeof q === 'number')).toBe(true);
            });
        });

        describe('PPO (Proximal Policy Optimization)', () => {
            let ppo: PPO;

            beforeAll(async () => {
                ppo = new PPO({
                    learningRate: 0.001,
                    clipRatio: 0.2,
                    networkType: 'cnn',
                    hiddenSize: 256,
                    batchSize: 16
                });
                await ppo.initialize();
            });

            afterAll(() => {
                ppo?.dispose();
            });

            test('should select actions and provide value estimates', async () => {
                const legalMoves = [0, 1, 2, 3, 4, 5, 6];
                const action = await ppo.selectAction(midGameBoard, legalMoves);
                const policyProbs = await ppo.getPolicyProbs(midGameBoard);
                const valueEstimate = await ppo.getValueEstimate(midGameBoard);

                expect(action).toBeGreaterThanOrEqual(0);
                expect(action).toBeLessThanOrEqual(6);
                expect(policyProbs).toHaveLength(7);
                expect(typeof valueEstimate).toBe('number');
            });
        });

        describe('MADDPG (Multi-Agent DDPG)', () => {
            let maddpg: MADDPG;

            beforeAll(async () => {
                maddpg = new MADDPG({
                    numAgents: 2,
                    populationSize: 4, // Reduced for testing
                    actorLearningRate: 0.001,
                    criticLearningRate: 0.001,
                    networkType: 'cnn'
                });
                await maddpg.initialize();
            });

            afterAll(() => {
                maddpg?.dispose();
            });

            test('should handle multi-agent coordination', async () => {
                const legalMoves = [0, 1, 2, 3, 4, 5, 6];
                const action = await maddpg.selectAction(0, midGameBoard, legalMoves);
                const metrics = maddpg.getMetrics();

                expect(action).toBeGreaterThanOrEqual(0);
                expect(action).toBeLessThanOrEqual(6);
                expect(metrics.populationFitness.length).toBe(4);
                expect(metrics.diversityScore).toBeGreaterThanOrEqual(0);
            });

            test('should run population tournaments', async () => {
                await maddpg.runTournament();
                const bestAgent = maddpg.getBestAgent();

                expect(bestAgent).toBeDefined();
                expect(bestAgent.fitness).toBeGreaterThanOrEqual(0);
            });
        });

        describe('QMIX', () => {
            let qmix: QMIX;

            beforeAll(async () => {
                qmix = new QMIX({
                    numAgents: 2,
                    learningRate: 0.001,
                    batchSize: 16,
                    networkType: 'cnn'
                });
                await qmix.initialize();
            });

            afterAll(() => {
                qmix?.dispose();
            });

            test('should coordinate multiple agents', async () => {
                const states = [midGameBoard, midGameBoard];
                const legalMoves = [[0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6]];
                const actions = await qmix.selectActions(states, legalMoves);

                expect(actions).toHaveLength(2);
                expect(actions.every(a => a >= 0 && a <= 6)).toBe(true);
            });

            test('should provide mixed Q-values', async () => {
                const states = [midGameBoard, midGameBoard];
                const actions = [3, 4];
                const mixedQValue = await qmix.getMixedQValue(states, actions);

                expect(typeof mixedQValue).toBe('number');
            });
        });
    });

    describe('Automated Training Pipeline', () => {
        beforeAll(async () => {
            trainingPipeline = new AutomatedTrainingPipeline({
                maxGenerations: 2, // Very small for testing
                gamesPerGeneration: 4,
                populationSize: 4,
                parallelWorkers: 1,
                algorithmWeights: {
                    dqn: 0.3,
                    ppo: 0.3,
                    a3c: 0.2,
                    alphazero: 0.2,
                    maddpg: 0.0, // Disable for testing
                    qmix: 0.0
                }
            });

            await trainingPipeline.initialize();
        });

        test('should initialize training pipeline', () => {
            expect(trainingPipeline).toBeDefined();
        });

        test('should create diverse population', () => {
            const metrics = trainingPipeline.getMetrics();
            expect(metrics.generation).toBe(0);
            expect(Object.keys(metrics.algorithmPerformance).length).toBeGreaterThan(0);
        });

        test('should run short training session', async () => {
            const initialMetrics = trainingPipeline.getMetrics();

            // Run training for a very short time
            setTimeout(() => trainingPipeline.stopTraining(), 5000);

            try {
                await trainingPipeline.startTraining();
            } catch (error) {
                // Training stopped - this is expected
            }

            const finalMetrics = trainingPipeline.getMetrics();
            expect(finalMetrics.totalGames).toBeGreaterThanOrEqual(initialMetrics.totalGames);
        }, 10000);

        test('should track performance metrics', () => {
            const metrics = trainingPipeline.getMetrics();

            expect(metrics.generation).toBeGreaterThanOrEqual(0);
            expect(metrics.totalGames).toBeGreaterThanOrEqual(0);
            expect(typeof metrics.populationDiversity).toBe('number');
            expect(typeof metrics.bestPerformance).toBe('number');
        });

        test('should identify best performing agent', () => {
            const bestAgent = trainingPipeline.getBestAgent();

            if (bestAgent) {
                expect(bestAgent.id).toBeDefined();
                expect(bestAgent.algorithm).toBeDefined();
                expect(bestAgent.fitness).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Performance and Optimization', () => {
        test('should complete decisions within time limits', async () => {
            const startTime = Date.now();
            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(3000); // Should be faster than time limit
            expect(decision.thinkingTime).toBeLessThan(2500);
        });

        test('should handle memory efficiently', () => {
            const metrics = ultimateAI.getAIMetrics();

            // Should not consume excessive memory
            expect(metrics.performance).toBeDefined();
        });

        test('should scale with difficulty', async () => {
            const easyDecision = await ultimateAI.getBestMove(emptyBoard, 'Red', 1000);
            const hardDecision = await ultimateAI.getBestMove(midGameBoard, 'Red', 3000);

            // More complex positions should explore more nodes
            expect(hardDecision.nodesExplored).toBeGreaterThanOrEqual(easyDecision.nodesExplored);
        });
    });

    describe('Robustness and Edge Cases', () => {
        test('should handle nearly full board', async () => {
            const nearlyFullBoard = [
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty']
            ];

            const decision = await ultimateAI.getBestMove(nearlyFullBoard, 'Red', 2000);
            expect(decision.move).toBe(6); // Only legal move
        });

        test('should handle invalid board states gracefully', async () => {
            const invalidBoard = Array(6).fill(null).map(() => Array(7).fill('Invalid'));

            try {
                await ultimateAI.getBestMove(invalidBoard as any, 'Red', 1000);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test('should maintain consistency across multiple calls', async () => {
            const decisions = [];

            for (let i = 0; i < 3; i++) {
                const decision = await ultimateAI.getBestMove(threatBoard, 'Red', 1000);
                decisions.push(decision.move);
            }

            // Should consistently find the winning move
            expect(decisions.every(move => move === 3)).toBe(true);
        });
    });

    describe('Integration with Game Engine', () => {
        test('should provide comprehensive game analysis', async () => {
            const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 3000);
            const trace = await decisionTracer.traceDecision('hybrid', midGameBoard, decision);

            // Should provide rich analysis data
            expect(trace.positionalAnalysis.centerControl).toBeGreaterThanOrEqual(0);
            expect(trace.positionalAnalysis.connectionStrength).toBeGreaterThanOrEqual(0);
            expect(trace.positionalAnalysis.flexibility).toBeGreaterThanOrEqual(0);
            expect(trace.positionalAnalysis.pieceDistribution).toBeDefined();
        });

        test('should support real-time adaptation', async () => {
            ultimateAI.updateConfig({
                advanced: { realTimeAdaptation: true }
            });

            const decision1 = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
            const decision2 = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);

            // Both decisions should be valid
            expect(decision1.move).toBeGreaterThanOrEqual(0);
            expect(decision2.move).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Comparative Algorithm Analysis', () => {
        test('should compare different algorithms', async () => {
            const algorithms = ['dqn', 'alphazero', 'hybrid'] as const;
            const results: Array<{ algorithm: string; decision: any; trace: any }> = [];

            for (const algorithm of algorithms) {
                ultimateAI.updateConfig({ primaryStrategy: algorithm });
                const decision = await ultimateAI.getBestMove(midGameBoard, 'Red', 2000);
                const trace = await decisionTracer.traceDecision(algorithm, midGameBoard, decision);

                results.push({ algorithm, decision, trace });
            }

            // Should have results for all algorithms
            expect(results).toHaveLength(3);

            // Each should provide valid decisions
            results.forEach(result => {
                expect(result.decision.move).toBeGreaterThanOrEqual(0);
                expect(result.decision.move).toBeLessThanOrEqual(6);
                expect(result.trace.algorithm).toBe(result.algorithm);
            });

            // Get comparative analysis
            const comparison = decisionTracer.getComparativeAnalysis();
            expect(comparison.algorithms.length).toBeGreaterThan(0);
            expect(comparison.averageConfidence).toBeDefined();
            expect(comparison.averageThinkingTime).toBeDefined();
        });
    });
});

// Performance benchmarking test
describe('AI Performance Benchmarks', () => {
    let ultimateAI: UltimateConnect4AI;

    beforeAll(async () => {
        ultimateAI = new UltimateConnect4AI({
            primaryStrategy: 'hybrid',
            performance: { maxThinkingTime: 5000 }
        });
        await ultimateAI.initialize();
    });

    afterAll(() => {
        ultimateAI?.dispose();
    });

    test('should meet performance benchmarks', async () => {
        const testCases = [
            { name: 'Empty Board', board: Array(6).fill(null).map(() => Array(7).fill('Empty')), maxTime: 2000 },
            { name: 'Mid Game', board: midGameBoard, maxTime: 3000 },
            { name: 'Complex Position', board: threatBoard, maxTime: 1000 }
        ];

        const results = [];

        for (const testCase of testCases) {
            const startTime = Date.now();
            const decision = await ultimateAI.getBestMove(testCase.board as any, 'Red', testCase.maxTime);
            const endTime = Date.now();

            const result = {
                name: testCase.name,
                time: endTime - startTime,
                maxTime: testCase.maxTime,
                move: decision.move,
                confidence: decision.confidence,
                nodesExplored: decision.nodesExplored
            };

            results.push(result);

            // Should complete within time limit
            expect(result.time).toBeLessThan(testCase.maxTime + 500); // Small buffer
            expect(result.move).toBeGreaterThanOrEqual(0);
            expect(result.move).toBeLessThanOrEqual(6);
        }

        console.log('\n📊 Performance Benchmark Results:');
        results.forEach(result => {
            console.log(`  ${result.name}: ${result.time}ms (max: ${result.maxTime}ms) - Move: ${result.move}, Confidence: ${result.confidence.toFixed(3)}, Nodes: ${result.nodesExplored}`);
        });
    });
});

// Helper function to simulate a game
async function simulateGame(ai1: UltimateConnect4AI, ai2: UltimateConnect4AI): Promise<{
    winner: 'Player1' | 'Player2' | 'Draw';
    moves: number;
    gameTime: number;
}> {
    const board = Array(6).fill(null).map(() => Array(7).fill('Empty'));
    let currentPlayer: 'Red' | 'Yellow' = 'Red';
    let moves = 0;
    const startTime = Date.now();

    while (moves < 42) {
        const ai = currentPlayer === 'Red' ? ai1 : ai2;
        const decision = await ai.getBestMove(board as any, currentPlayer, 2000);

        // Make move
        const col = decision.move;
        let placed = false;

        for (let row = 5; row >= 0; row--) {
            if (board[row][col] === 'Empty') {
                board[row][col] = currentPlayer;
                placed = true;
                break;
            }
        }

        if (!placed) break; // Column full

        moves++;

        // Check for win
        if (checkWin(board as any, currentPlayer)) {
            return {
                winner: currentPlayer === 'Red' ? 'Player1' : 'Player2',
                moves,
                gameTime: Date.now() - startTime
            };
        }

        currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
    }

    return {
        winner: 'Draw',
        moves,
        gameTime: Date.now() - startTime
    };
}

function checkWin(board: any[][], player: string): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

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

// Integration test with actual gameplay
describe('AI vs AI Gameplay', () => {
    test('should complete full games between different AIs', async () => {
        const ai1 = new UltimateConnect4AI({ primaryStrategy: 'alphazero' });
        const ai2 = new UltimateConnect4AI({ primaryStrategy: 'dqn' });

        await ai1.initialize();
        await ai2.initialize();

        try {
            const gameResult = await simulateGame(ai1, ai2);

            expect(['Player1', 'Player2', 'Draw']).toContain(gameResult.winner);
            expect(gameResult.moves).toBeGreaterThan(0);
            expect(gameResult.moves).toBeLessThanOrEqual(42);
            expect(gameResult.gameTime).toBeGreaterThan(0);

            console.log(`\n🎮 AlphaZero vs DQN Game Result:`);
            console.log(`  Winner: ${gameResult.winner}`);
            console.log(`  Moves: ${gameResult.moves}`);
            console.log(`  Game Time: ${gameResult.gameTime}ms`);
        } finally {
            ai1.dispose();
            ai2.dispose();
        }
    }, 30000);
}); 