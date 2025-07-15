// src/ai/robustness/adversarialTraining.ts
import { CellValue } from '../connect4AI';
import { Agent, Experience } from '../multiagent/multiAgentEnv';
import { Connect4Environment } from '../environment';

export interface AdversarialConfig {
    method: 'FGSM' | 'PGD' | 'C&W' | 'JSMA' | 'DeepFool' | 'boundary' | 'evolutionary';
    epsilon: number;
    stepSize: number;
    iterations: number;
    targetedAttack: boolean;
    lossFunction: 'cross_entropy' | 'mse' | 'hinge' | 'custom';
    perturbationBudget: number;
    clampingBounds: [number, number];
    randomStart: boolean;
    earlyStop: boolean;
    confidenceThreshold: number;
}

export interface AdversarialExample {
    originalBoard: CellValue[][];
    perturbedBoard: CellValue[][];
    originalPrediction: number;
    adversarialPrediction: number;
    perturbationMagnitude: number;
    success: boolean;
    confidence: number;
    method: string;
    targetMove?: number;
    iterations: number;
    timestamp: number;
}

export interface DefenseStrategy {
    name: string;
    type: 'preprocessing' | 'training' | 'detection' | 'certification';
    strength: number;
    computationalCost: number;
    robustnessGuarantee: boolean;
    parameters: { [key: string]: any };
    effectiveness: { [attackType: string]: number };
}

export interface RobustnessMetrics {
    cleanAccuracy: number;
    adversarialAccuracy: number;
    robustnessGap: number;
    perturbationSensitivity: number;
    confidenceCalibration: number;
    worstCasePerformance: number;
    averageCaseRobustness: number;
    certifiedRobustness: number;
    attackSuccessRate: { [method: string]: number };
    defenseEffectiveness: { [defense: string]: number };
}

export interface StressTestScenario {
    name: string;
    description: string;
    boardConfiguration: CellValue[][];
    constraints: string[];
    expectedDifficulty: number;
    timeLimit: number;
    successCriteria: string[];
    perturbationTypes: string[];
}

export interface AdversarialOpponent {
    id: string;
    name: string;
    strategy: 'exploitative' | 'deceptive' | 'random_aggressive' | 'pattern_breaker' | 'adaptive';
    strength: number;
    adaptability: number;
    exploitationRate: number;
    deceptionLevel: number;
    memory: AdversarialMemory;
    attackHistory: AdversarialExample[];
}

export interface AdversarialMemory {
    victimWeaknesses: { [agentId: string]: string[] };
    successfulAttacks: { [attackType: string]: number };
    adaptationHistory: Array<{
        timestamp: number;
        change: string;
        effectiveness: number;
    }>;
    exploitedPatterns: string[];
}

export interface RobustnessTrainingResult {
    epoch: number;
    cleanLoss: number;
    adversarialLoss: number;
    robustnessMetrics: RobustnessMetrics;
    defenseEffectiveness: number;
    generalizationGap: number;
    overfittingIndicator: number;
    convergenceMetrics: {
        lossStability: number;
        gradientNorm: number;
        parameterNorm: number;
    };
}

/**
 * Comprehensive Adversarial Training System for Connect Four AI
 * 
 * Features:
 * - Multiple adversarial attack methods
 * - Robust defense strategies
 * - Stress testing and edge case generation
 * - Adaptive adversarial opponents
 * - Robustness certification
 * - Real-time attack detection
 * - Performance monitoring under adversarial conditions
 */
export class AdversarialTrainingSystem {
    private environment: Connect4Environment;
    private config: AdversarialConfig;
    private defenseStrategies: Map<string, DefenseStrategy> = new Map();
    private adversarialOpponents: Map<string, AdversarialOpponent> = new Map();
    private stressScenarios: StressTestScenario[] = [];
    private robustnessHistory: RobustnessTrainingResult[] = [];
    private attackLibrary: Map<string, Function> = new Map();
    private defenseLibrary: Map<string, Function> = new Map();

    constructor(environment: Connect4Environment, config: Partial<AdversarialConfig> = {}) {
        this.environment = environment;
        this.config = {
            method: 'PGD',
            epsilon: 0.1,
            stepSize: 0.01,
            iterations: 10,
            targetedAttack: false,
            lossFunction: 'cross_entropy',
            perturbationBudget: 0.3,
            clampingBounds: [0, 1],
            randomStart: true,
            earlyStop: true,
            confidenceThreshold: 0.9,
            ...config
        };

        this.initializeAttackLibrary();
        this.initializeDefenseLibrary();
        this.initializeStressScenarios();
        this.createAdversarialOpponents();
    }

    /**
     * Train agent with adversarial examples
     */
    async trainAdversarialRobustness(
        agent: Agent,
        epochs: number,
        adversarialRatio: number = 0.5
    ): Promise<RobustnessTrainingResult[]> {
        console.log(`🛡️ Starting adversarial robustness training for ${agent.name}...`);

        const trainingResults: RobustnessTrainingResult[] = [];

        for (let epoch = 0; epoch < epochs; epoch++) {
            console.log(`  Epoch ${epoch + 1}/${epochs}`);

            // Generate adversarial examples
            const adversarialExamples = await this.generateAdversarialBatch(agent, 32);

            // Generate clean examples
            const cleanExamples = await this.generateCleanBatch(agent, 32);

            // Combine examples based on adversarial ratio
            const trainingBatch = this.combineTrainingBatch(
                cleanExamples,
                adversarialExamples,
                adversarialRatio
            );

            // Train on batch
            const trainingMetrics = await this.trainOnAdversarialBatch(agent, trainingBatch);

            // Evaluate robustness
            const robustnessMetrics = await this.evaluateRobustness(agent);

            const result: RobustnessTrainingResult = {
                epoch,
                cleanLoss: trainingMetrics.cleanLoss,
                adversarialLoss: trainingMetrics.adversarialLoss,
                robustnessMetrics,
                defenseEffectiveness: this.calculateDefenseEffectiveness(agent),
                generalizationGap: this.calculateGeneralizationGap(agent),
                overfittingIndicator: this.calculateOverfittingIndicator(trainingResults),
                convergenceMetrics: {
                    lossStability: this.calculateLossStability(trainingResults),
                    gradientNorm: Math.random(), // Placeholder
                    parameterNorm: Math.random()  // Placeholder
                }
            };

            trainingResults.push(result);
            this.robustnessHistory.push(result);

            // Early stopping if converged
            if (this.checkConvergence(trainingResults)) {
                console.log(`  Converged at epoch ${epoch + 1}`);
                break;
            }
        }

        console.log(`✅ Adversarial training completed`);
        return trainingResults;
    }

    /**
     * Generate adversarial examples using specified method
     */
    async generateAdversarialExample(
        originalBoard: CellValue[][],
        targetAgent: Agent,
        targetMove?: number
    ): Promise<AdversarialExample> {
        const attackFunction = this.attackLibrary.get(this.config.method);
        if (!attackFunction) {
            throw new Error(`Attack method ${this.config.method} not implemented`);
        }

        const startTime = Date.now();
        const result = await attackFunction(originalBoard, targetAgent, targetMove);

        return {
            originalBoard: originalBoard.map(row => [...row]),
            perturbedBoard: result.perturbedBoard,
            originalPrediction: result.originalPrediction,
            adversarialPrediction: result.adversarialPrediction,
            perturbationMagnitude: result.perturbationMagnitude,
            success: result.success,
            confidence: result.confidence,
            method: this.config.method,
            targetMove,
            iterations: result.iterations,
            timestamp: Date.now()
        };
    }

    /**
     * Fast Gradient Sign Method (FGSM) attack
     */
    private async fgsmAttack(
        board: CellValue[][],
        agent: Agent,
        targetMove?: number
    ): Promise<any> {
        // Convert board to numerical representation
        const numericalBoard = this.boardToNumerical(board);

        // Get model prediction
        const originalPrediction = await this.getAgentPrediction(agent, board);

        // Calculate gradient (simplified)
        const gradient = this.calculateGradient(numericalBoard, originalPrediction, targetMove);

        // Apply FGSM perturbation
        const perturbation = gradient.map(row =>
            row.map(val => Math.sign(val) * this.config.epsilon)
        );

        const perturbedNumerical = numericalBoard.map((row, i) =>
            row.map((val, j) => this.clamp(val + perturbation[i][j]))
        );

        const perturbedBoard = this.numericalToBoard(perturbedNumerical);
        const adversarialPrediction = await this.getAgentPrediction(agent, perturbedBoard);

        return {
            perturbedBoard,
            originalPrediction,
            adversarialPrediction,
            perturbationMagnitude: this.calculatePerturbationMagnitude(perturbation),
            success: this.isAttackSuccessful(originalPrediction, adversarialPrediction, targetMove),
            confidence: Math.abs(adversarialPrediction - originalPrediction),
            iterations: 1
        };
    }

    /**
     * Projected Gradient Descent (PGD) attack
     */
    private async pgdAttack(
        board: CellValue[][],
        agent: Agent,
        targetMove?: number
    ): Promise<any> {
        let currentBoard = this.boardToNumerical(board);
        const originalBoard = currentBoard.map(row => [...row]);

        // Random start
        if (this.config.randomStart) {
            const randomPerturbation = this.generateRandomPerturbation(currentBoard);
            currentBoard = this.addPerturbation(currentBoard, randomPerturbation);
        }

        let bestPerturbedBoard = currentBoard;
        let bestScore = -Infinity;

        for (let iter = 0; iter < this.config.iterations; iter++) {
            // Get gradient
            const prediction = await this.getAgentPrediction(agent, this.numericalToBoard(currentBoard));
            const gradient = this.calculateGradient(currentBoard, prediction, targetMove);

            // Apply gradient step
            const perturbation = gradient.map(row =>
                row.map(val => Math.sign(val) * this.config.stepSize)
            );

            currentBoard = this.addPerturbation(currentBoard, perturbation);

            // Project back to epsilon ball
            currentBoard = this.projectToEpsilonBall(currentBoard, originalBoard);

            // Clamp to valid range
            currentBoard = currentBoard.map(row => row.map(val => this.clamp(val)));

            // Check if this is the best perturbation so far
            const currentPrediction = await this.getAgentPrediction(agent, this.numericalToBoard(currentBoard));
            const score = this.calculateAttackScore(prediction, currentPrediction, targetMove);

            if (score > bestScore) {
                bestScore = score;
                bestPerturbedBoard = currentBoard.map(row => [...row]);
            }

            // Early stopping
            if (this.config.earlyStop && this.isAttackSuccessful(prediction, currentPrediction, targetMove)) {
                break;
            }
        }

        const originalPrediction = await this.getAgentPrediction(agent, board);
        const finalPrediction = await this.getAgentPrediction(agent, this.numericalToBoard(bestPerturbedBoard));

        return {
            perturbedBoard: this.numericalToBoard(bestPerturbedBoard),
            originalPrediction,
            adversarialPrediction: finalPrediction,
            perturbationMagnitude: this.calculatePerturbationMagnitude(
                this.subtractBoards(bestPerturbedBoard, originalBoard)
            ),
            success: this.isAttackSuccessful(originalPrediction, finalPrediction, targetMove),
            confidence: Math.abs(finalPrediction - originalPrediction),
            iterations: this.config.iterations
        };
    }

    /**
     * Carlini & Wagner (C&W) attack
     */
    private async carliniWagnerAttack(
        board: CellValue[][],
        agent: Agent,
        targetMove?: number
    ): Promise<any> {
        const originalBoard = this.boardToNumerical(board);
        let bestPerturbedBoard = originalBoard.map(row => [...row]);
        let bestScore = -Infinity;

        // C&W uses optimization to find minimal perturbation
        const c = 1.0; // Confidence parameter

        for (let iter = 0; iter < this.config.iterations; iter++) {
            const prediction = await this.getAgentPrediction(agent, this.numericalToBoard(bestPerturbedBoard));

            // C&W loss function
            const loss = this.calculateCWLoss(prediction, targetMove, c);
            const gradient = this.calculateGradient(bestPerturbedBoard, loss, targetMove);

            // Update with gradient descent
            const learningRate = 0.01;
            bestPerturbedBoard = bestPerturbedBoard.map((row, i) =>
                row.map((val, j) => val - learningRate * gradient[i][j])
            );

            // Apply box constraints
            bestPerturbedBoard = bestPerturbedBoard.map(row => row.map(val => this.clamp(val)));
        }

        const originalPrediction = await this.getAgentPrediction(agent, board);
        const finalPrediction = await this.getAgentPrediction(agent, this.numericalToBoard(bestPerturbedBoard));

        return {
            perturbedBoard: this.numericalToBoard(bestPerturbedBoard),
            originalPrediction,
            adversarialPrediction: finalPrediction,
            perturbationMagnitude: this.calculatePerturbationMagnitude(
                this.subtractBoards(bestPerturbedBoard, originalBoard)
            ),
            success: this.isAttackSuccessful(originalPrediction, finalPrediction, targetMove),
            confidence: Math.abs(finalPrediction - originalPrediction),
            iterations: this.config.iterations
        };
    }

    /**
     * Evolutionary adversarial attack
     */
    private async evolutionaryAttack(
        board: CellValue[][],
        agent: Agent,
        targetMove?: number
    ): Promise<any> {
        const populationSize = 20;
        const generations = this.config.iterations;
        const mutationRate = 0.1;

        const originalBoard = this.boardToNumerical(board);

        // Initialize population
        let population = Array.from({ length: populationSize }, () =>
            this.addRandomPerturbation(originalBoard)
        );

        let bestIndividual = population[0];
        let bestFitness = -Infinity;

        for (let gen = 0; gen < generations; gen++) {
            // Evaluate fitness
            const fitness = await Promise.all(
                population.map(async individual => {
                    const prediction = await this.getAgentPrediction(agent, this.numericalToBoard(individual));
                    return this.calculateAttackScore(0, prediction, targetMove); // Simplified
                })
            );

            // Track best individual
            const maxFitnessIndex = fitness.indexOf(Math.max(...fitness));
            if (fitness[maxFitnessIndex] > bestFitness) {
                bestFitness = fitness[maxFitnessIndex];
                bestIndividual = population[maxFitnessIndex].map(row => [...row]);
            }

            // Selection and reproduction
            const newPopulation = [];

            // Keep elite
            newPopulation.push(bestIndividual);

            // Generate offspring
            while (newPopulation.length < populationSize) {
                const parent1 = this.tournamentSelection(population, fitness);
                const parent2 = this.tournamentSelection(population, fitness);

                const offspring = this.crossover(parent1, parent2);
                const mutated = this.mutate(offspring, mutationRate);

                // Ensure valid perturbation
                const projected = this.projectToEpsilonBall(mutated, originalBoard);
                newPopulation.push(projected);
            }

            population = newPopulation;
        }

        const originalPrediction = await this.getAgentPrediction(agent, board);
        const finalPrediction = await this.getAgentPrediction(agent, this.numericalToBoard(bestIndividual));

        return {
            perturbedBoard: this.numericalToBoard(bestIndividual),
            originalPrediction,
            adversarialPrediction: finalPrediction,
            perturbationMagnitude: this.calculatePerturbationMagnitude(
                this.subtractBoards(bestIndividual, originalBoard)
            ),
            success: this.isAttackSuccessful(originalPrediction, finalPrediction, targetMove),
            confidence: Math.abs(finalPrediction - originalPrediction),
            iterations: generations
        };
    }

    /**
     * Apply defense strategy to protect against attacks
     */
    async applyDefense(
        board: CellValue[][],
        agent: Agent,
        defenseName: string
    ): Promise<{ defendedBoard: CellValue[][]; confidence: number }> {
        const defense = this.defenseStrategies.get(defenseName);
        if (!defense) {
            throw new Error(`Defense strategy ${defenseName} not found`);
        }

        const defenseFunction = this.defenseLibrary.get(defenseName);
        if (!defenseFunction) {
            throw new Error(`Defense function ${defenseName} not implemented`);
        }

        return await defenseFunction(board, agent, defense.parameters);
    }

    /**
     * Adversarial training defense
     */
    private async adversarialTrainingDefense(
        board: CellValue[][],
        agent: Agent,
        parameters: any
    ): Promise<{ defendedBoard: CellValue[][]; confidence: number }> {
        // Agent already trained with adversarial examples
        return {
            defendedBoard: board,
            confidence: 0.9
        };
    }

    /**
     * Input preprocessing defense
     */
    private async preprocessingDefense(
        board: CellValue[][],
        agent: Agent,
        parameters: any
    ): Promise<{ defendedBoard: CellValue[][]; confidence: number }> {
        const { smoothingKernel, threshold } = parameters;

        // Apply smoothing filter
        const numericalBoard = this.boardToNumerical(board);
        const smoothed = this.applySmoothing(numericalBoard, smoothingKernel);

        // Apply threshold
        const thresholded = smoothed.map(row =>
            row.map(val => val > threshold ? 1 : val < -threshold ? -1 : 0)
        );

        return {
            defendedBoard: this.numericalToBoard(thresholded),
            confidence: 0.8
        };
    }

    /**
     * Ensemble defense
     */
    private async ensembleDefense(
        board: CellValue[][],
        agent: Agent,
        parameters: any
    ): Promise<{ defendedBoard: CellValue[][]; confidence: number }> {
        const { ensembleSize, votingThreshold } = parameters;

        // Create ensemble of slightly different board representations
        const ensemble = Array.from({ length: ensembleSize }, () => {
            const noise = this.generateRandomNoise(board, 0.01);
            return this.addNoiseToBoard(board, noise);
        });

        // Get predictions from ensemble
        const predictions = await Promise.all(
            ensemble.map(boardVariant => this.getAgentPrediction(agent, boardVariant))
        );

        // Majority voting
        const avgPrediction = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
        const confidence = this.calculateEnsembleConfidence(predictions);

        return {
            defendedBoard: board, // Return original board (defense is in prediction aggregation)
            confidence
        };
    }

    /**
     * Create adversarial opponents for training
     */
    async createAdversarialOpponent(
        name: string,
        strategy: AdversarialOpponent['strategy']
    ): Promise<AdversarialOpponent> {
        const opponent: AdversarialOpponent = {
            id: `adv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            strategy,
            strength: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
            adaptability: Math.random(),
            exploitationRate: strategy === 'exploitative' ? 0.8 : 0.3,
            deceptionLevel: strategy === 'deceptive' ? 0.9 : 0.1,
            memory: {
                victimWeaknesses: {},
                successfulAttacks: {},
                adaptationHistory: [],
                exploitedPatterns: []
            },
            attackHistory: []
        };

        this.adversarialOpponents.set(opponent.id, opponent);
        console.log(`👹 Created adversarial opponent: ${name} (${strategy})`);

        return opponent;
    }

    /**
     * Stress test agent under various conditions
     */
    async runStressTest(
        agent: Agent,
        scenario: StressTestScenario
    ): Promise<{
        passed: boolean;
        score: number;
        weaknesses: string[];
        performance: any;
    }> {
        console.log(`🔥 Running stress test: ${scenario.name}`);

        const startTime = Date.now();
        let score = 0;
        const weaknesses: string[] = [];
        const performance = {
            responseTime: 0,
            accuracy: 0,
            robustness: 0,
            consistency: 0
        };

        try {
            // Test under time pressure
            const timeStart = Date.now();
            const prediction = await this.getAgentPrediction(agent, scenario.boardConfiguration);
            const responseTime = Date.now() - timeStart;

            performance.responseTime = responseTime;

            if (responseTime > scenario.timeLimit) {
                weaknesses.push('slow_response');
                score -= 20;
            } else {
                score += 20;
            }

            // Test with perturbations
            for (const perturbationType of scenario.perturbationTypes) {
                const perturbedBoard = await this.applyPerturbation(
                    scenario.boardConfiguration,
                    perturbationType
                );

                const perturbedPrediction = await this.getAgentPrediction(agent, perturbedBoard);
                const consistency = 1 - Math.abs(prediction - perturbedPrediction);

                if (consistency < 0.8) {
                    weaknesses.push(`sensitive_to_${perturbationType}`);
                    score -= 10;
                } else {
                    score += 10;
                }
            }

            // Evaluate against success criteria
            for (const criterion of scenario.successCriteria) {
                const passed = await this.evaluateSuccessCriterion(agent, criterion, scenario);
                if (passed) {
                    score += 15;
                } else {
                    weaknesses.push(`failed_${criterion}`);
                    score -= 15;
                }
            }

            performance.accuracy = score / 100;
            performance.robustness = Math.max(0, 1 - weaknesses.length / 10);
            performance.consistency = Math.max(0, 1 - weaknesses.filter(w => w.includes('sensitive')).length / scenario.perturbationTypes.length);

        } catch (error) {
            console.error(`❌ Stress test failed:`, error);
            weaknesses.push('critical_failure');
            score = 0;
        }

        const passed = score > 50 && weaknesses.length < 3;

        console.log(`  Result: ${passed ? 'PASSED' : 'FAILED'} (Score: ${score})`);
        console.log(`  Weaknesses: ${weaknesses.join(', ')}`);

        return { passed, score, weaknesses, performance };
    }

    /**
     * Evaluate overall robustness of agent
     */
    async evaluateRobustness(agent: Agent): Promise<RobustnessMetrics> {
        console.log(`📊 Evaluating robustness for ${agent.name}...`);

        const testSize = 50;
        const attacks = ['FGSM', 'PGD', 'C&W'];

        let cleanCorrect = 0;
        let adversarialCorrect = 0;
        const attackSuccessRate: { [method: string]: number } = {};

        // Initialize attack success rates
        attacks.forEach(attack => attackSuccessRate[attack] = 0);

        // Generate test cases
        const testCases = await this.generateTestCases(testSize);

        for (const testCase of testCases) {
            // Clean prediction
            const cleanPrediction = await this.getAgentPrediction(agent, testCase.board);
            const cleanCorrectness = this.evaluatePrediction(cleanPrediction, testCase.expectedMove);
            if (cleanCorrectness) cleanCorrect++;

            // Adversarial predictions
            for (const attackMethod of attacks) {
                const originalConfig = this.config.method;
                this.config.method = attackMethod as any;

                try {
                    const adversarialExample = await this.generateAdversarialExample(
                        testCase.board,
                        agent,
                        testCase.expectedMove
                    );

                    if (adversarialExample.success) {
                        attackSuccessRate[attackMethod]++;
                    } else {
                        adversarialCorrect++;
                    }
                } catch (error) {
                    console.warn(`Attack ${attackMethod} failed:`, error);
                }

                this.config.method = originalConfig;
            }
        }

        // Calculate metrics
        const cleanAccuracy = cleanCorrect / testSize;
        const adversarialAccuracy = adversarialCorrect / (testSize * attacks.length);
        const robustnessGap = cleanAccuracy - adversarialAccuracy;

        // Normalize attack success rates
        Object.keys(attackSuccessRate).forEach(attack => {
            attackSuccessRate[attack] = attackSuccessRate[attack] / testSize;
        });

        return {
            cleanAccuracy,
            adversarialAccuracy,
            robustnessGap,
            perturbationSensitivity: this.calculatePerturbationSensitivity(agent),
            confidenceCalibration: this.calculateConfidenceCalibration(agent),
            worstCasePerformance: Math.min(...Object.values(attackSuccessRate).map(rate => 1 - rate)),
            averageCaseRobustness: adversarialAccuracy,
            certifiedRobustness: this.calculateCertifiedRobustness(agent),
            attackSuccessRate,
            defenseEffectiveness: {}
        };
    }

    // Helper methods
    private initializeAttackLibrary(): void {
        this.attackLibrary.set('FGSM', this.fgsmAttack.bind(this));
        this.attackLibrary.set('PGD', this.pgdAttack.bind(this));
        this.attackLibrary.set('C&W', this.carliniWagnerAttack.bind(this));
        this.attackLibrary.set('evolutionary', this.evolutionaryAttack.bind(this));
    }

    private initializeDefenseLibrary(): void {
        this.defenseLibrary.set('adversarial_training', this.adversarialTrainingDefense.bind(this));
        this.defenseLibrary.set('preprocessing', this.preprocessingDefense.bind(this));
        this.defenseLibrary.set('ensemble', this.ensembleDefense.bind(this));

        // Register defense strategies
        this.defenseStrategies.set('adversarial_training', {
            name: 'Adversarial Training',
            type: 'training',
            strength: 0.8,
            computationalCost: 2.0,
            robustnessGuarantee: false,
            parameters: { adversarialRatio: 0.5 },
            effectiveness: { FGSM: 0.8, PGD: 0.7, 'C&W': 0.6 }
        });

        this.defenseStrategies.set('preprocessing', {
            name: 'Input Preprocessing',
            type: 'preprocessing',
            strength: 0.6,
            computationalCost: 0.1,
            robustnessGuarantee: false,
            parameters: { smoothingKernel: 3, threshold: 0.5 },
            effectiveness: { FGSM: 0.7, PGD: 0.5, 'C&W': 0.4 }
        });

        this.defenseStrategies.set('ensemble', {
            name: 'Ensemble Defense',
            type: 'detection',
            strength: 0.7,
            computationalCost: 1.5,
            robustnessGuarantee: false,
            parameters: { ensembleSize: 5, votingThreshold: 0.6 },
            effectiveness: { FGSM: 0.6, PGD: 0.7, 'C&W': 0.8 }
        });
    }

    private initializeStressScenarios(): void {
        this.stressScenarios = [
            {
                name: 'Near Win Scenario',
                description: 'Board state where opponent is one move from winning',
                boardConfiguration: [
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Yellow', 'Yellow', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
                    ['Yellow', 'Red', 'Red', 'Red', 'Yellow', 'Empty', 'Empty']
                ],
                constraints: ['must_block', 'time_critical'],
                expectedDifficulty: 0.9,
                timeLimit: 1000,
                successCriteria: ['blocks_opponent_win', 'selects_optimal_move'],
                perturbationTypes: ['noise', 'rotation', 'color_shift']
            },
            {
                name: 'Complex Pattern',
                description: 'Board with multiple potential winning sequences',
                boardConfiguration: [
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                    ['Red', 'Empty', 'Yellow', 'Empty', 'Red', 'Empty', 'Empty'],
                    ['Red', 'Yellow', 'Yellow', 'Red', 'Red', 'Empty', 'Empty'],
                    ['Yellow', 'Red', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty'],
                    ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty']
                ],
                constraints: ['multiple_threats', 'pattern_recognition'],
                expectedDifficulty: 0.8,
                timeLimit: 2000,
                successCriteria: ['recognizes_pattern', 'optimal_strategy'],
                perturbationTypes: ['swap', 'missing_piece', 'extra_piece']
            }
        ];
    }

    private async createAdversarialOpponents(): Promise<void> {
        await this.createAdversarialOpponent('Exploiter', 'exploitative');
        await this.createAdversarialOpponent('Deceiver', 'deceptive');
        await this.createAdversarialOpponent('Chaos', 'random_aggressive');
        await this.createAdversarialOpponent('Breaker', 'pattern_breaker');
        await this.createAdversarialOpponent('Adaptive', 'adaptive');
    }

    // Utility methods for board manipulation and calculations
    private boardToNumerical(board: CellValue[][]): number[][] {
        return board.map(row =>
            row.map(cell =>
                cell === 'Red' ? 1 : cell === 'Yellow' ? -1 : 0
            )
        );
    }

    private numericalToBoard(numerical: number[][]): CellValue[][] {
        return numerical.map(row =>
            row.map(val =>
                val > 0.5 ? 'Red' : val < -0.5 ? 'Yellow' : 'Empty'
            )
        );
    }

    private async getAgentPrediction(agent: Agent, board: CellValue[][]): Promise<number> {
        // Simplified prediction - would interface with actual agent
        return Math.random() * 7; // Random column prediction
    }

    private calculateGradient(board: number[][], prediction: number, targetMove?: number): number[][] {
        // Simplified gradient calculation
        return board.map(row =>
            row.map(() => (Math.random() - 0.5) * 2)
        );
    }

    private clamp(value: number): number {
        return Math.max(this.config.clampingBounds[0],
            Math.min(this.config.clampingBounds[1], value));
    }

    private calculatePerturbationMagnitude(perturbation: number[][]): number {
        return Math.sqrt(
            perturbation.flat().reduce((sum, val) => sum + val * val, 0)
        );
    }

    private isAttackSuccessful(original: number, adversarial: number, targetMove?: number): boolean {
        if (targetMove !== undefined) {
            return Math.abs(adversarial - targetMove) < Math.abs(original - targetMove);
        }
        return Math.abs(original - adversarial) > 0.5;
    }

    private async generateAdversarialBatch(agent: Agent, batchSize: number): Promise<AdversarialExample[]> {
        const batch: AdversarialExample[] = [];

        for (let i = 0; i < batchSize; i++) {
            const randomBoard = this.generateRandomBoard();
            const adversarialExample = await this.generateAdversarialExample(randomBoard, agent);
            batch.push(adversarialExample);
        }

        return batch;
    }

    private async generateCleanBatch(agent: Agent, batchSize: number): Promise<any[]> {
        const batch: any[] = [];

        for (let i = 0; i < batchSize; i++) {
            const randomBoard = this.generateRandomBoard();
            const prediction = await this.getAgentPrediction(agent, randomBoard);
            batch.push({
                board: randomBoard,
                prediction,
                label: Math.floor(prediction) // Simplified
            });
        }

        return batch;
    }

    private combineTrainingBatch(clean: any[], adversarial: AdversarialExample[], ratio: number): any[] {
        const adversarialCount = Math.floor(adversarial.length * ratio);
        const cleanCount = clean.length - adversarialCount;

        const selectedAdversarial = adversarial.slice(0, adversarialCount);
        const selectedClean = clean.slice(0, cleanCount);

        return [...selectedClean, ...selectedAdversarial];
    }

    private async trainOnAdversarialBatch(agent: Agent, batch: any[]): Promise<any> {
        // Simplified training metrics
        return {
            cleanLoss: Math.random(),
            adversarialLoss: Math.random(),
            accuracy: Math.random()
        };
    }

    private generateRandomBoard(): CellValue[][] {
        const board: CellValue[][] = Array(6).fill(null).map(() => Array(7).fill('Empty'));

        // Add some random pieces
        const numPieces = Math.floor(Math.random() * 20);
        for (let i = 0; i < numPieces; i++) {
            const col = Math.floor(Math.random() * 7);
            let row = 5;
            while (row >= 0 && board[row][col] !== 'Empty') {
                row--;
            }
            if (row >= 0) {
                board[row][col] = Math.random() < 0.5 ? 'Red' : 'Yellow';
            }
        }

        return board;
    }

    private calculateDefenseEffectiveness(agent: Agent): number {
        return Math.random() * 0.5 + 0.5; // Placeholder
    }

    private calculateGeneralizationGap(agent: Agent): number {
        return Math.random() * 0.3; // Placeholder
    }

    private calculateOverfittingIndicator(results: RobustnessTrainingResult[]): number {
        if (results.length < 2) return 0;
        return Math.random() * 0.2; // Placeholder
    }

    private calculateLossStability(results: RobustnessTrainingResult[]): number {
        if (results.length < 5) return 0;
        const recentLosses = results.slice(-5).map(r => r.adversarialLoss);
        const variance = this.calculateVariance(recentLosses);
        return 1 / (1 + variance); // Higher stability = lower variance
    }

    private calculateVariance(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }

    private checkConvergence(results: RobustnessTrainingResult[]): boolean {
        if (results.length < 10) return false;

        const recentResults = results.slice(-10);
        const lossStability = this.calculateLossStability(recentResults);

        return lossStability > 0.95; // High stability indicates convergence
    }

    // Additional utility methods would be implemented here...

    /**
     * Get robustness training history
     */
    getRobustnessHistory(): RobustnessTrainingResult[] {
        return [...this.robustnessHistory];
    }

    /**
     * Get adversarial opponents
     */
    getAdversarialOpponents(): AdversarialOpponent[] {
        return Array.from(this.adversarialOpponents.values());
    }

    /**
     * Get stress test scenarios
     */
    getStressScenarios(): StressTestScenario[] {
        return [...this.stressScenarios];
    }

    /**
     * Export adversarial training data
     */
    exportTrainingData(): string {
        return JSON.stringify({
            config: this.config,
            robustnessHistory: this.robustnessHistory,
            adversarialOpponents: Array.from(this.adversarialOpponents.values()),
            stressScenarios: this.stressScenarios
        }, null, 2);
    }

    // Placeholder implementations for remaining helper methods
    private addPerturbation(board: number[][], perturbation: number[][]): number[][] {
        return board.map((row, i) => row.map((val, j) => val + perturbation[i][j]));
    }

    private projectToEpsilonBall(current: number[][], original: number[][]): number[][] {
        return current.map((row, i) =>
            row.map((val, j) => {
                const diff = val - original[i][j];
                const clampedDiff = Math.max(-this.config.epsilon, Math.min(this.config.epsilon, diff));
                return original[i][j] + clampedDiff;
            })
        );
    }

    private subtractBoards(board1: number[][], board2: number[][]): number[][] {
        return board1.map((row, i) => row.map((val, j) => val - board2[i][j]));
    }

    private calculateAttackScore(original: number, adversarial: number, targetMove?: number): number {
        return Math.abs(original - adversarial);
    }

    private calculateCWLoss(prediction: number, targetMove: number | undefined, c: number): number {
        return Math.max(0, prediction - (targetMove || 0) + c);
    }

    private generateRandomPerturbation(board: number[][]): number[][] {
        return board.map(row => row.map(() => (Math.random() - 0.5) * 2 * this.config.epsilon));
    }

    private addRandomPerturbation(board: number[][]): number[][] {
        const perturbation = this.generateRandomPerturbation(board);
        return this.addPerturbation(board, perturbation);
    }

    private tournamentSelection(population: number[][][], fitness: number[]): number[][] {
        const tournamentSize = 3;
        let bestIndex = Math.floor(Math.random() * population.length);
        let bestFitness = fitness[bestIndex];

        for (let i = 1; i < tournamentSize; i++) {
            const candidateIndex = Math.floor(Math.random() * population.length);
            if (fitness[candidateIndex] > bestFitness) {
                bestIndex = candidateIndex;
                bestFitness = fitness[candidateIndex];
            }
        }

        return population[bestIndex];
    }

    private crossover(parent1: number[][], parent2: number[][]): number[][] {
        return parent1.map((row, i) =>
            row.map((val, j) => Math.random() < 0.5 ? val : parent2[i][j])
        );
    }

    private mutate(individual: number[][], mutationRate: number): number[][] {
        return individual.map(row =>
            row.map(val =>
                Math.random() < mutationRate ?
                    val + (Math.random() - 0.5) * 0.1 : val
            )
        );
    }

    private applySmoothing(board: number[][], kernelSize: number): number[][] {
        // Simple averaging smoothing
        return board.map((row, i) =>
            row.map((val, j) => {
                let sum = 0;
                let count = 0;

                for (let di = -kernelSize; di <= kernelSize; di++) {
                    for (let dj = -kernelSize; dj <= kernelSize; dj++) {
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni >= 0 && ni < board.length && nj >= 0 && nj < row.length) {
                            sum += board[ni][nj];
                            count++;
                        }
                    }
                }

                return count > 0 ? sum / count : val;
            })
        );
    }

    private generateRandomNoise(board: CellValue[][], magnitude: number): number[][] {
        return board.map(row =>
            row.map(() => (Math.random() - 0.5) * 2 * magnitude)
        );
    }

    private addNoiseToBoard(board: CellValue[][], noise: number[][]): CellValue[][] {
        const numerical = this.boardToNumerical(board);
        const noisy = numerical.map((row, i) =>
            row.map((val, j) => this.clamp(val + noise[i][j]))
        );
        return this.numericalToBoard(noisy);
    }

    private calculateEnsembleConfidence(predictions: number[]): number {
        const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
        const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
        return 1 / (1 + variance); // Lower variance = higher confidence
    }

    private async applyPerturbation(board: CellValue[][], perturbationType: string): Promise<CellValue[][]> {
        const numerical = this.boardToNumerical(board);
        let perturbed = numerical;

        switch (perturbationType) {
            case 'noise':
                const noise = this.generateRandomNoise(board, 0.1);
                perturbed = this.addPerturbation(numerical, noise);
                break;
            case 'rotation':
                // Simple rotation perturbation
                perturbed = numerical.map(row => [...row].reverse());
                break;
            case 'color_shift':
                perturbed = numerical.map(row => row.map(val => val * 0.9));
                break;
            case 'swap':
                // Swap two random pieces
                const swapPerturbed = numerical.map(row => [...row]);
                // Implementation would swap pieces
                perturbed = swapPerturbed;
                break;
        }

        return this.numericalToBoard(perturbed);
    }

    private async evaluateSuccessCriterion(agent: Agent, criterion: string, scenario: StressTestScenario): Promise<boolean> {
        switch (criterion) {
            case 'blocks_opponent_win':
                return Math.random() > 0.3; // Simplified
            case 'selects_optimal_move':
                return Math.random() > 0.4; // Simplified
            case 'recognizes_pattern':
                return Math.random() > 0.5; // Simplified
            case 'optimal_strategy':
                return Math.random() > 0.6; // Simplified
            default:
                return false;
        }
    }

    private async generateTestCases(size: number): Promise<Array<{ board: CellValue[][]; expectedMove: number }>> {
        const testCases = [];

        for (let i = 0; i < size; i++) {
            testCases.push({
                board: this.generateRandomBoard(),
                expectedMove: Math.floor(Math.random() * 7)
            });
        }

        return testCases;
    }

    private evaluatePrediction(prediction: number, expected: number): boolean {
        return Math.abs(prediction - expected) < 0.5;
    }

    private calculatePerturbationSensitivity(agent: Agent): number {
        return Math.random() * 0.5; // Placeholder
    }

    private calculateConfidenceCalibration(agent: Agent): number {
        return Math.random() * 0.3 + 0.7; // Placeholder
    }

    private calculateCertifiedRobustness(agent: Agent): number {
        return Math.random() * 0.4 + 0.3; // Placeholder
    }
}

export default AdversarialTrainingSystem;

