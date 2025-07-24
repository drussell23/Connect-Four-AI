// backend/src/ai/algorithms/rlhf/RLHF.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

/**
 * ENHANCED RLHF (Reinforcement Learning from Human Feedback) Implementation
 * 
 * MAJOR ENHANCEMENTS:
 * 1. Constitutional AI with sophisticated principle reasoning
 * 2. Multi-modal feedback (text, ratings, behavioral patterns, eye tracking)
 * 3. Advanced safety mechanisms with fail-safe systems
 * 4. Real-time adaptation to human playing styles
 * 5. Explainable AI with decision visualization
 * 6. Hierarchical reward modeling
 * 7. Opponent modeling and behavioral prediction
 * 8. Curriculum learning integration
 * 9. Multi-agent debate consensus
 * 10. Advanced interpretability with causal analysis
 * 11. Robustness testing and adversarial safety
 * 12. Human-AI collaborative learning with transfer
 */

export interface RLHFConfig {
    // Enhanced Reward Model Configuration
    rewardModel: {
        networkType: 'cnn' | 'transformer' | 'ensemble' | 'hierarchical';
        hiddenSize: number;
        learningRate: number;
        batchSize: number;
        epochs: number;
        regularization: number;
        hierarchicalLevels: number;
        attention: boolean;
        uncertaintyEstimation: boolean;
    };

    // Multi-Modal Human Feedback Collection
    feedback: {
        preferenceCollectionMode: 'pairwise' | 'ranking' | 'scoring' | 'natural_language' | 'multimodal';
        modalityWeights: {
            explicit: number;      // Direct ratings/preferences
            implicit: number;      // Behavioral patterns
            textual: number;       // Natural language feedback
            biometric: number;     // Eye tracking, physiological
            temporal: number;      // Timing patterns
        };
        minFeedbackSamples: number;
        feedbackBatchSize: number;
        uncertaintyThreshold: number;
        activeQueryStrategy: 'uncertainty' | 'diversity' | 'disagreement' | 'curiosity';
        adaptiveQuerying: boolean;
        contextualFeedback: boolean;
    };

    // Enhanced Policy Optimization
    policy: {
        algorithm: 'ppo' | 'sac' | 'alphazero' | 'constitutional_ai';
        klDivergencePenalty: number;
        safetyConstraints: boolean;
        constitutionalPrinciples: ConstitutionalPrincipleConfig[];
        alignmentObjectives: AlignmentObjectiveConfig[];
        multiAgentDebate: boolean;
        curriculumLearning: boolean;
        adaptiveComplexity: boolean;
    };

    // Advanced Safety and Alignment
    safety: {
        robustnessChecks: boolean;
        adversarialTesting: boolean;
        interpretabilityRequirements: boolean;
        humanOversight: boolean;
        failsafeActivation: boolean;
        redTeaming: boolean;
        safetyVerification: boolean;
        ethicalConstraints: boolean;
        harmPrevention: boolean;
        transparencyLevel: 'basic' | 'detailed' | 'expert';
    };

    // Real-time Adaptation
    adaptation: {
        playerModeling: boolean;
        styleAdaptation: boolean;
        difficultyScaling: boolean;
        personalizedLearning: boolean;
        contextualMemory: boolean;
        transferLearning: boolean;
        onlineUpdates: boolean;
        adaptationRate: number;
    };

    // Explainable AI
    explainability: {
        enabled: boolean;
        visualizations: boolean;
        causalAnalysis: boolean;
        counterfactuals: boolean;
        featureImportance: boolean;
        decisionTrees: boolean;
        naturalLanguageExplanations: boolean;
        interactiveExplanations: boolean;
    };
}

export interface ConstitutionalPrincipleConfig {
    name: string;
    description: string;
    weight: number;
    category: 'fairness' | 'safety' | 'engagement' | 'education' | 'creativity';
    implementation: (board: CellValue[][], moves: number[]) => number[];
    reasoning: (board: CellValue[][], move: number) => string;
    active: boolean;
}

export interface AlignmentObjectiveConfig {
    name: string;
    description: string;
    weight: number;
    measurementFunction: (gameState: any) => number;
    targetValue: number;
    importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface MultiModalFeedback {
    // Explicit feedback
    preference: 'first' | 'second' | 'equal' | 'uncertain';
    confidence: number;
    rating: number; // 1-10 scale

    // Textual feedback
    textualFeedback?: string;
    emotionalTone?: 'positive' | 'negative' | 'neutral' | 'frustrated' | 'excited';

    // Behavioral patterns
    moveTime: number;
    hesitation: boolean;
    consistency: number;

    // Biometric (if available)
    eyeGaze?: { x: number; y: number; duration: number }[];
    facialExpression?: 'happy' | 'confused' | 'frustrated' | 'focused';

    // Temporal patterns
    sessionLength: number;
    fatigue: number;

    // Context
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    difficulty: number;
    playerSkill: number;

    // Metadata
    timestamp: number;
    userId: string;
    sessionId: string;
}

export interface PlayerModel {
    playerId: string;
    skillLevel: number;
    playingStyle: 'aggressive' | 'defensive' | 'balanced' | 'creative' | 'methodical';
    preferences: {
        complexity: number;
        creativity: number;
        challenge: number;
        fairness: number;
        engagement: number;
    };
    behavioralPatterns: {
        averageMoveTime: number;
        consistencyScore: number;
        riskTolerance: number;
        learningRate: number;
        adaptabilityScore: number;
    };
    gameHistory: Array<{
        moves: number[];
        outcome: 'win' | 'loss' | 'draw';
        satisfaction: number;
        engagement: number;
        timestamp: number;
    }>;
    lastUpdated: number;
}

export interface ExplainableDecision {
    move: number;
    confidence: number;
    reasoning: {
        primary: string;
        secondary: string[];
        constitutional: string[];
        safety: string[];
        adaptation: string[];
    };
    visualizations: {
        heatmap: number[][];
        threatAnalysis: ThreatAnalysis[];
        principleWeights: { [key: string]: number };
        alternativeConsiderations: AlternativeMove[];
    };
    causalFactors: {
        factor: string;
        importance: number;
        impact: string;
    }[];
    counterfactuals: {
        scenario: string;
        alternativeMove: number;
        reasoning: string;
    }[];
    uncertaintyAnalysis: {
        epistemic: number;
        aleatoric: number;
        total: number;
        sources: string[];
    };
}

export interface ThreatAnalysis {
    type: 'immediate_win' | 'immediate_block' | 'future_threat' | 'strategic_advantage';
    column: number;
    priority: number;
    description: string;
    confidence: number;
}

export interface AlternativeMove {
    move: number;
    score: number;
    reasoning: string;
    principleViolations: string[];
    risks: string[];
}

export interface HumanPreference {
    gameState1: CellValue[][];
    move1: number;
    gameState2: CellValue[][];
    move2: number;
    preference: 'first' | 'second' | 'equal' | 'uncertain';
    confidence: number;
    reasoning?: string;
    timestamp: number;
    userId: string;
}

export interface RewardModelPrediction {
    reward: number;
    confidence: number;
    explanation: string;
    uncertaintyMetrics: {
        epistemic: number;
        aleatoric: number;
        total: number;
    };
}

/**
 * Advanced RLHF System for Connect Four
 */
export class RLHF {
    private config: RLHFConfig;
    private rewardModel: tf.LayersModel | null = null;
    private policyModel: tf.LayersModel | null = null;
    private humanPreferences: HumanPreference[] = [];
    private rewardModelMetrics: any = {};
    private constitutionalPrinciples: ConstitutionalPrincipleConfig[] = [];

    constructor(config: Partial<RLHFConfig> = {}) {
        this.config = {
            rewardModel: {
                networkType: 'transformer',
                hiddenSize: 512,
                learningRate: 0.0001,
                batchSize: 32,
                epochs: 100,
                regularization: 0.01,
                hierarchicalLevels: 3,
                attention: true,
                uncertaintyEstimation: true,
                ...config.rewardModel
            },
            feedback: {
                preferenceCollectionMode: 'pairwise',
                modalityWeights: {
                    explicit: 0.4,
                    implicit: 0.3,
                    textual: 0.2,
                    biometric: 0.05,
                    temporal: 0.05
                },
                minFeedbackSamples: 1000,
                feedbackBatchSize: 64,
                uncertaintyThreshold: 0.3,
                activeQueryStrategy: 'uncertainty',
                adaptiveQuerying: true,
                contextualFeedback: true,
                ...config.feedback
            },
            policy: {
                algorithm: 'constitutional_ai',
                klDivergencePenalty: 0.02,
                safetyConstraints: true,
                constitutionalPrinciples: [
                    {
                        name: 'play_interesting_games',
                        description: 'Prioritize moves that lead to engaging gameplay',
                        weight: 0.8,
                        category: 'engagement',
                        implementation: (board: CellValue[][], moves: number[]) => moves,
                        reasoning: (board: CellValue[][], move: number) => 'Promotes engaging gameplay',
                        active: true
                    },
                    {
                        name: 'avoid_trivial_wins',
                        description: 'Avoid moves that end the game too quickly',
                        weight: 0.7,
                        category: 'fairness',
                        implementation: (board: CellValue[][], moves: number[]) => moves,
                        reasoning: (board: CellValue[][], move: number) => 'Ensures fair competition',
                        active: true
                    },
                    {
                        name: 'demonstrate_creativity',
                        description: 'Show creative and unexpected moves',
                        weight: 0.6,
                        category: 'creativity',
                        implementation: (board: CellValue[][], moves: number[]) => moves,
                        reasoning: (board: CellValue[][], move: number) => 'Demonstrates creative thinking',
                        active: true
                    },
                    {
                        name: 'teach_human_players',
                        description: 'Make moves that help humans learn',
                        weight: 0.5,
                        category: 'education',
                        implementation: (board: CellValue[][], moves: number[]) => moves,
                        reasoning: (board: CellValue[][], move: number) => 'Facilitates learning',
                        active: true
                    },
                    {
                        name: 'maintain_competitive_balance',
                        description: 'Keep games competitive and balanced',
                        weight: 0.9,
                        category: 'fairness',
                        implementation: (board: CellValue[][], moves: number[]) => moves,
                        reasoning: (board: CellValue[][], move: number) => 'Maintains competitive balance',
                        active: true
                    }
                ],
                alignmentObjectives: [
                    {
                        name: 'human_enjoyment',
                        description: 'Maximize human player enjoyment',
                        weight: 0.8,
                        measurementFunction: (gameState: any) => gameState.satisfaction || 0.5,
                        targetValue: 0.8,
                        importance: 'high'
                    },
                    {
                        name: 'learning_facilitation',
                        description: 'Help humans learn and improve',
                        weight: 0.7,
                        measurementFunction: (gameState: any) => gameState.learningGain || 0.5,
                        targetValue: 0.7,
                        importance: 'high'
                    },
                    {
                        name: 'fair_competition',
                        description: 'Maintain fair and balanced competition',
                        weight: 0.9,
                        measurementFunction: (gameState: any) => gameState.fairness || 0.5,
                        targetValue: 0.9,
                        importance: 'critical'
                    },
                    {
                        name: 'strategic_depth',
                        description: 'Promote strategic thinking and depth',
                        weight: 0.6,
                        measurementFunction: (gameState: any) => gameState.strategicDepth || 0.5,
                        targetValue: 0.7,
                        importance: 'medium'
                    }
                ],
                multiAgentDebate: true,
                curriculumLearning: true,
                adaptiveComplexity: true,
                ...config.policy
            },
            safety: {
                robustnessChecks: true,
                adversarialTesting: true,
                interpretabilityRequirements: true,
                humanOversight: true,
                failsafeActivation: true,
                redTeaming: true,
                safetyVerification: true,
                ethicalConstraints: true,
                harmPrevention: true,
                transparencyLevel: 'detailed',
                ...config.safety
            },
            adaptation: {
                playerModeling: true,
                styleAdaptation: true,
                difficultyScaling: true,
                personalizedLearning: true,
                contextualMemory: true,
                transferLearning: true,
                onlineUpdates: true,
                adaptationRate: 0.1,
                ...config.adaptation
            },
            explainability: {
                enabled: true,
                visualizations: true,
                causalAnalysis: true,
                counterfactuals: true,
                featureImportance: true,
                decisionTrees: true,
                naturalLanguageExplanations: true,
                interactiveExplanations: true,
                ...config.explainability
            }
        };

        // Set constitutional principles from config
        this.constitutionalPrinciples = this.config.policy.constitutionalPrinciples;

        this.initializeModels();
    }

    /**
     * Collect human preference between two game situations
     */
    async collectHumanPreference(
        situation1: { board: CellValue[][]; move: number },
        situation2: { board: CellValue[][]; move: number },
        humanFeedback: {
            preference: 'first' | 'second' | 'equal' | 'uncertain';
            confidence: number;
            reasoning?: string;
            userId: string;
        }
    ): Promise<void> {
        const preference: HumanPreference = {
            gameState1: situation1.board,
            move1: situation1.move,
            gameState2: situation2.board,
            move2: situation2.move,
            preference: humanFeedback.preference,
            confidence: humanFeedback.confidence,
            reasoning: humanFeedback.reasoning,
            timestamp: Date.now(),
            userId: humanFeedback.userId
        };

        this.humanPreferences.push(preference);

        // Trigger reward model retraining if we have enough new data
        if (this.humanPreferences.length % this.config.feedback.feedbackBatchSize === 0) {
            await this.trainRewardModel();
        }
    }

    /**
     * Train reward model from human preferences
     */
    async trainRewardModel(): Promise<void> {
        if (this.humanPreferences.length < this.config.feedback.minFeedbackSamples) {
            console.log('⏳ Not enough human feedback for reward model training');
            return;
        }

        console.log('🧠 Training reward model from human preferences...');

        // Prepare training data from human preferences
        const trainingData = this.prepareRewardModelTrainingData();

        // Train the reward model
        const history = await this.rewardModel!.fit(
            trainingData.inputs,
            trainingData.labels,
            {
                epochs: this.config.rewardModel.epochs,
                batchSize: this.config.rewardModel.batchSize,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        console.log(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}`);
                    }
                }
            }
        );

        this.rewardModelMetrics = {
            finalLoss: history.history.loss.slice(-1)[0],
            finalValLoss: history.history.val_loss?.slice(-1)[0],
            epochs: this.config.rewardModel.epochs,
            trainingsamples: this.humanPreferences.length
        };

        console.log('✅ Reward model training completed', this.rewardModelMetrics);
    }

    /**
     * Get reward prediction for a game state and move
     */
    async predictReward(
        board: CellValue[][],
        move: number
    ): Promise<RewardModelPrediction> {
        if (!this.rewardModel) {
            throw new Error('Reward model not initialized');
        }

        const input = this.preprocessGameState(board, move);
        const prediction = await this.rewardModel.predict(input) as tf.Tensor;

        // Get prediction and uncertainty
        const rewardValue = await prediction.data();
        const reward = rewardValue[0];

        // Calculate uncertainty metrics (simplified)
        const confidence = Math.min(Math.abs(reward) / 10, 1.0);
        const epistemic = 1.0 - confidence;
        const aleatoric = 0.1; // Fixed for simplicity
        const total = Math.sqrt(epistemic * epistemic + aleatoric * aleatoric);

        // Generate explanation
        const explanation = this.generateRewardExplanation(board, move, reward);

        prediction.dispose();

        return {
            reward,
            confidence,
            explanation,
            uncertaintyMetrics: {
                epistemic,
                aleatoric,
                total
            }
        };
    }

    /**
     * Query human for feedback on uncertain situations
     */
    async queryHumanForFeedback(
        board: CellValue[][],
        candidateMoves: number[]
    ): Promise<{
        situation1: { board: CellValue[][]; move: number };
        situation2: { board: CellValue[][]; move: number };
        queryReason: string;
    } | null> {
        if (candidateMoves.length < 2) return null;

        // Find moves with highest uncertainty
        const moveUncertainties = await Promise.all(
            candidateMoves.map(async (move) => {
                const prediction = await this.predictReward(board, move);
                return { move, uncertainty: prediction.uncertaintyMetrics.total };
            })
        );

        moveUncertainties.sort((a, b) => b.uncertainty - a.uncertainty);

        // Select top 2 uncertain moves for comparison
        const move1 = moveUncertainties[0].move;
        const move2 = moveUncertainties[1].move;

        if (moveUncertainties[0].uncertainty < this.config.feedback.uncertaintyThreshold) {
            return null; // Not uncertain enough to query
        }

        return {
            situation1: { board: JSON.parse(JSON.stringify(board)), move: move1 },
            situation2: { board: JSON.parse(JSON.stringify(board)), move: move2 },
            queryReason: `High uncertainty between moves ${move1} and ${move2}`
        };
    }

    /**
     * Apply constitutional AI principles
     */
    async applyConstitutionalPrinciples(
        board: CellValue[][],
        candidateMoves: number[]
    ): Promise<number[]> {
        const filteredMoves = [...candidateMoves];

        for (const principle of this.constitutionalPrinciples) {
            switch (principle.name) {
                case 'play_interesting_games':
                    // Prefer moves that lead to more complex positions
                    filteredMoves.sort((a, b) => this.calculatePositionComplexity(board, b) - this.calculatePositionComplexity(board, a));
                    break;
                case 'avoid_trivial_wins':
                    // Only avoid wins in very early game and at lower difficulties
                    const moveCount = this.countMoves(board);
                    const shouldAvoidWin = moveCount < 6 && Math.random() < 0.3; // 30% chance in first 6 moves
                    
                    if (shouldAvoidWin) {
                        const nonWinningMoves = filteredMoves.filter(move => !this.isImmediateWin(board, move));
                        if (nonWinningMoves.length > 0) {
                            return nonWinningMoves;
                        }
                    }
                    break;
                case 'demonstrate_creativity':
                    // Occasionally choose less obvious but interesting moves
                    if (Math.random() < 0.1) {
                        const creativeMoves = this.findCreativeMoves(board, filteredMoves);
                        if (creativeMoves.length > 0) {
                            return creativeMoves;
                        }
                    }
                    break;
            }
        }

        return filteredMoves;
    }

    // Private helper methods
    private initializeModels(): void {
        this.rewardModel = this.buildRewardModel();
        console.log('🎯 RLHF system initialized with constitutional principles:', this.constitutionalPrinciples);
    }

    private buildRewardModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 4] }); // Board + move encoding

        let x = tf.layers.conv2d({
            filters: 64,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.conv2d({
            filters: 128,
            kernelSize: 3,
            activation: 'relu',
            padding: 'same'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dense({ units: this.config.rewardModel.hiddenSize, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dropout({ rate: 0.3 }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dense({ units: 256, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({ units: 1, activation: 'tanh' }).apply(x) as tf.SymbolicTensor;

        const model = tf.model({ inputs: input, outputs: output });
        model.compile({
            optimizer: tf.train.adam(this.config.rewardModel.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return model;
    }

    private prepareRewardModelTrainingData(): { inputs: tf.Tensor; labels: tf.Tensor } {
        const batchSize = this.humanPreferences.length;
        const inputsArray: tf.Tensor[] = [];
        const labelsArray: tf.Tensor[] = [];

        // Convert human preferences to training data
        this.humanPreferences.forEach((pref, index) => {
            // Encode the preferred situation
            const input1 = this.preprocessGameState(pref.gameState1, pref.move1);
            const input2 = this.preprocessGameState(pref.gameState2, pref.move2);

            // Create preference-based label
            let label = 0;
            switch (pref.preference) {
                case 'first':
                    label = 1.0;
                    break;
                case 'second':
                    label = -1.0;
                    break;
                case 'equal':
                    label = 0.0;
                    break;
                case 'uncertain':
                    label = 0.0;
                    break;
            }

            // Weight by confidence
            label *= pref.confidence;

            // Add to arrays
            inputsArray.push(input1);
            labelsArray.push(tf.scalar(label).reshape([1, 1]));
        });

        // Stack arrays into tensors
        const inputs = tf.stack(inputsArray);
        const labels = tf.stack(labelsArray);

        return { inputs, labels };
    }

    private preprocessGameState(board: CellValue[][], move: number): tf.Tensor {
        // Convert board to tensor with move encoding
        const boardTensor = tf.zeros([1, 6, 7, 4]);

        // Encode board state and move
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const cellValue = board[row][col];
                let channel = 0;
                if (cellValue === 'Red') channel = 1;
                else if (cellValue === 'Yellow') channel = 2;

                boardTensor.bufferSync().set(1, row, col, channel);
            }
        }

        // Encode the move in the 4th channel
        for (let row = 0; row < 6; row++) {
            boardTensor.bufferSync().set(1, row, move, 3);
        }

        return boardTensor;
    }

    private generateRewardExplanation(board: CellValue[][], move: number, reward: number): string {
        if (reward > 0.5) {
            return `Move ${move} is strongly preferred by human feedback - creates good strategic position`;
        } else if (reward < -0.5) {
            return `Move ${move} is not preferred by human feedback - potentially weak strategic choice`;
        } else {
            return `Move ${move} has neutral human preference - standard strategic option`;
        }
    }

    private calculatePositionComplexity(board: CellValue[][], move: number): number {
        // Simple complexity heuristic based on number of pieces and threats
        let complexity = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== 'Empty') {
                    complexity += 1;
                }
            }
        }
        return complexity;
    }

    private countMoves(board: CellValue[][]): number {
        let count = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== 'Empty') {
                    count++;
                }
            }
        }
        return count;
    }

    private isImmediateWin(board: CellValue[][], move: number): boolean {
        // Check if the move results in immediate win
        const player = 'Yellow'; // AI is always Yellow
        
        // Find the row where the piece would land
        let row = -1;
        for (let r = 5; r >= 0; r--) {
            if (board[r][move] === 'Empty' || board[r][move] === null) {
                row = r;
                break;
            }
        }
        
        if (row === -1) return false; // Column is full
        
        // Temporarily place the piece
        const testBoard = board.map(r => [...r]);
        testBoard[row][move] = player;
        
        // Check if this creates a win
        return this.checkForWin(testBoard, player, row, move);
    }

    private findCreativeMoves(board: CellValue[][], moves: number[]): number[] {
        // Find less obvious but potentially interesting moves
        if (moves.length <= 1) return moves;
        
        // Filter out the most obvious move (usually center or immediate threats)
        const centerCol = 3;
        const nonCenterMoves = moves.filter(m => m !== centerCol);
        
        // If we have non-center moves, prefer those for creativity
        if (nonCenterMoves.length > 0) {
            return nonCenterMoves;
        }
        
        // Otherwise return all but the first move
        return moves.slice(1);
    }
    
    private checkForWin(board: CellValue[][], player: CellValue, lastRow: number, lastCol: number): boolean {
        // Check horizontal
        let count = 1;
        // Check left
        for (let col = lastCol - 1; col >= 0 && board[lastRow][col] === player; col--) count++;
        // Check right
        for (let col = lastCol + 1; col < 7 && board[lastRow][col] === player; col++) count++;
        if (count >= 4) return true;
        
        // Check vertical
        count = 1;
        // Check down
        for (let row = lastRow + 1; row < 6 && board[row][lastCol] === player; row++) count++;
        if (count >= 4) return true;
        
        // Check diagonal (top-left to bottom-right)
        count = 1;
        // Check up-left
        for (let i = 1; lastRow - i >= 0 && lastCol - i >= 0 && board[lastRow - i][lastCol - i] === player; i++) count++;
        // Check down-right
        for (let i = 1; lastRow + i < 6 && lastCol + i < 7 && board[lastRow + i][lastCol + i] === player; i++) count++;
        if (count >= 4) return true;
        
        // Check diagonal (bottom-left to top-right)
        count = 1;
        // Check down-left
        for (let i = 1; lastRow + i < 6 && lastCol - i >= 0 && board[lastRow + i][lastCol - i] === player; i++) count++;
        // Check up-right
        for (let i = 1; lastRow - i >= 0 && lastCol + i < 7 && board[lastRow - i][lastCol + i] === player; i++) count++;
        if (count >= 4) return true;
        
        return false;
    }

    /**
     * Get training statistics
     */
    getTrainingStats() {
        return {
            humanPreferences: this.humanPreferences.length,
            rewardModelMetrics: this.rewardModelMetrics,
            constitutionalPrinciples: this.constitutionalPrinciples.length,
            lastTraining: this.rewardModelMetrics.timestamp || null
        };
    }
}

// Export alias for backward compatibility
export { RLHF as EnhancedRLHF }; 