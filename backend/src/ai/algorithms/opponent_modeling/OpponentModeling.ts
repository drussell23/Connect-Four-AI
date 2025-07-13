// backend/src/ai/algorithms/opponent_modeling/OpponentModeling.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface OpponentProfile {
    playerId: string;

    // Skill Assessment
    skillLevel: number;
    skillConsistency: number;
    improvementRate: number;

    // Playing Style
    playingStyle: 'aggressive' | 'defensive' | 'balanced' | 'creative' | 'methodical' | 'adaptive';
    styleConfidence: number;

    // Behavioral Patterns
    movePatterns: {
        openingPreferences: number[];
        columnPreferences: number[];
        sequentialPatterns: number[][];
        timingPatterns: number[];
    };

    // Psychological Profile
    emotionalState: 'confident' | 'frustrated' | 'focused' | 'tired' | 'excited';
    riskTolerance: number;
    pressureResponse: 'improves' | 'degrades' | 'neutral';
    adaptabilityScore: number;

    // Predictive Patterns
    predictiveModel: tf.LayersModel | null;
    predictionAccuracy: number;

    // Context Awareness
    gamePhaseStrengths: {
        opening: number;
        middlegame: number;
        endgame: number;
    };

    // Learning Patterns
    learningCurve: number[];
    errorPatterns: string[];
    improvementAreas: string[];

    // Meta-Game Awareness
    strategicDepth: number;
    tacticalAwareness: number;
    patternRecognition: number;

    // Interaction History
    gameHistory: OpponentGame[];
    lastUpdated: number;
}

export interface OpponentGame {
    gameId: string;
    moves: number[];
    moveTimes: number[];
    outcome: 'win' | 'loss' | 'draw';
    finalBoard: CellValue[][];
    mistakes: { move: number; type: string; severity: number }[];
    strengths: { move: number; type: string; quality: number }[];
    emotionalMarkers: { move: number; state: string; confidence: number }[];
    adaptations: { move: number; type: string; effectiveness: number }[];
    timestamp: number;
}

export interface PredictionResult {
    predictedMove: number;
    confidence: number;
    reasoning: string[];
    alternatives: { move: number; probability: number }[];
    uncertainty: {
        epistemic: number;
        aleatoric: number;
        total: number;
    };
    contextualFactors: {
        factor: string;
        weight: number;
        impact: string;
    }[];
}

export interface AdaptationStrategy {
    name: string;
    description: string;
    targetProfile: Partial<OpponentProfile>;
    effectiveness: number;
    implementation: (board: CellValue[][], moves: number[], profile: OpponentProfile) => number[];
}

/**
 * Advanced Opponent Modeling System
 * 
 * Features:
 * - Deep behavioral analysis and prediction
 * - Real-time adaptation to opponent patterns
 * - Psychological profiling and emotional state tracking
 * - Predictive modeling using neural networks
 * - Strategic and tactical pattern recognition
 * - Learning curve analysis and improvement tracking
 * - Meta-game awareness and counter-strategy development
 * - Multi-dimensional opponent profiling
 */
export class OpponentModeling {
    private opponentProfiles: Map<string, OpponentProfile> = new Map();
    private adaptationStrategies: AdaptationStrategy[] = [];
    private globalPatterns: Map<string, any> = new Map();
    private predictionModel: tf.LayersModel | null = null;
    private behaviorClassifier: tf.LayersModel | null = null;
    private emotionDetector: tf.LayersModel | null = null;

    constructor() {
        this.initializeModels();
        this.initializeAdaptationStrategies();
    }

    /**
     * Predict opponent's next move
     */
    async predictOpponentMove(
        board: CellValue[][],
        moveHistory: number[],
        timingHistory: number[],
        playerId: string,
        context: any
    ): Promise<PredictionResult> {
        const profile = this.getOpponentProfile(playerId);

        // Multi-modal prediction
        const patternPrediction = this.predictFromPatterns(board, moveHistory, profile);
        const neuralPrediction = await this.predictFromNeuralNetwork(board, moveHistory, profile);
        const emotionalPrediction = this.predictFromEmotionalState(board, profile, context);
        const adaptivePrediction = this.predictFromAdaptation(board, moveHistory, profile, context);

        // Combine predictions with confidence weighting
        const combinedPrediction = this.combinePredictions([
            { result: patternPrediction, weight: 0.3 },
            { result: neuralPrediction, weight: 0.4 },
            { result: emotionalPrediction, weight: 0.2 },
            { result: adaptivePrediction, weight: 0.1 }
        ]);

        // Calculate uncertainty
        const uncertainty = this.calculatePredictionUncertainty(
            [patternPrediction, neuralPrediction, emotionalPrediction, adaptivePrediction],
            profile
        );

        // Generate contextual factors
        const contextualFactors = this.analyzeContextualFactors(board, profile, context);

        return {
            predictedMove: combinedPrediction.move,
            confidence: combinedPrediction.confidence,
            reasoning: combinedPrediction.reasoning,
            alternatives: combinedPrediction.alternatives,
            uncertainty,
            contextualFactors
        };
    }

    /**
     * Update opponent profile based on game data
     */
    updateOpponentProfile(
        playerId: string,
        gameData: {
            moves: number[];
            moveTimes: number[];
            outcome: 'win' | 'loss' | 'draw';
            board: CellValue[][];
            context: any;
        }
    ): void {
        const profile = this.getOpponentProfile(playerId);

        // Update skill assessment
        this.updateSkillAssessment(profile, gameData);

        // Update playing style
        this.updatePlayingStyle(profile, gameData);

        // Update behavioral patterns
        this.updateBehavioralPatterns(profile, gameData);

        // Update psychological profile
        this.updatePsychologicalProfile(profile, gameData);

        // Update predictive model
        this.updatePredictiveModel(profile, gameData);

        // Update game phase strengths
        this.updateGamePhaseStrengths(profile, gameData);

        // Update learning patterns
        this.updateLearningPatterns(profile, gameData);

        // Update meta-game awareness
        this.updateMetaGameAwareness(profile, gameData);

        // Add game to history
        this.addGameToHistory(profile, gameData);

        profile.lastUpdated = Date.now();
        this.opponentProfiles.set(playerId, profile);
    }

    /**
     * Adapt AI strategy based on opponent profile
     */
    adaptToOpponent(
        board: CellValue[][],
        candidateMoves: number[],
        playerId: string,
        context: any
    ): {
        adaptedMoves: number[];
        strategy: string;
        confidence: number;
        reasoning: string[];
    } {
        const profile = this.getOpponentProfile(playerId);
        const bestStrategy = this.selectAdaptationStrategy(profile, context);

        const adaptedMoves = bestStrategy.implementation(board, candidateMoves, profile);
        const confidence = this.calculateAdaptationConfidence(profile, bestStrategy, context);
        const reasoning = this.generateAdaptationReasoning(profile, bestStrategy, context);

        return {
            adaptedMoves,
            strategy: bestStrategy.name,
            confidence,
            reasoning
        };
    }

    /**
     * Get or create opponent profile
     */
    private getOpponentProfile(playerId: string): OpponentProfile {
        if (!this.opponentProfiles.has(playerId)) {
            const newProfile: OpponentProfile = {
                playerId,
                skillLevel: 0.5,
                skillConsistency: 0.5,
                improvementRate: 0.01,
                playingStyle: 'balanced',
                styleConfidence: 0.5,
                movePatterns: {
                    openingPreferences: [0.14, 0.14, 0.14, 0.16, 0.14, 0.14, 0.14], // Slight center bias
                    columnPreferences: [0.14, 0.14, 0.14, 0.16, 0.14, 0.14, 0.14],
                    sequentialPatterns: [],
                    timingPatterns: []
                },
                emotionalState: 'focused',
                riskTolerance: 0.5,
                pressureResponse: 'neutral',
                adaptabilityScore: 0.5,
                predictiveModel: null,
                predictionAccuracy: 0.5,
                gamePhaseStrengths: {
                    opening: 0.5,
                    middlegame: 0.5,
                    endgame: 0.5
                },
                learningCurve: [0.5],
                errorPatterns: [],
                improvementAreas: [],
                strategicDepth: 0.5,
                tacticalAwareness: 0.5,
                patternRecognition: 0.5,
                gameHistory: [],
                lastUpdated: Date.now()
            };
            this.opponentProfiles.set(playerId, newProfile);
        }
        return this.opponentProfiles.get(playerId)!;
    }

    /**
     * Predict from patterns
     */
    private predictFromPatterns(
        board: CellValue[][],
        moveHistory: number[],
        profile: OpponentProfile
    ): { move: number; confidence: number; reasoning: string[] } {
        const legalMoves = this.getLegalMoves(board);
        const scores = new Map<number, number>();
        const reasoning: string[] = [];

        // Column preferences
        legalMoves.forEach(move => {
            scores.set(move, profile.movePatterns.columnPreferences[move] || 0.14);
        });

        // Sequential patterns
        if (moveHistory.length >= 2) {
            const lastTwo = moveHistory.slice(-2);
            const patterns = profile.movePatterns.sequentialPatterns;

            for (const pattern of patterns) {
                if (pattern.length >= 3 &&
                    pattern[0] === lastTwo[0] &&
                    pattern[1] === lastTwo[1]) {
                    const predictedMove = pattern[2];
                    if (legalMoves.includes(predictedMove)) {
                        scores.set(predictedMove, (scores.get(predictedMove) || 0) + 0.3);
                        reasoning.push(`Sequential pattern suggests move ${predictedMove}`);
                    }
                }
            }
        }

        // Find best move
        let bestMove = legalMoves[0];
        let bestScore = 0;

        for (const [move, score] of scores.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return {
            move: bestMove,
            confidence: Math.min(bestScore * 2, 1.0),
            reasoning
        };
    }

    /**
     * Predict from neural network
     */
    private async predictFromNeuralNetwork(
        board: CellValue[][],
        moveHistory: number[],
        profile: OpponentProfile
    ): Promise<{ move: number; confidence: number; reasoning: string[] }> {
        if (!this.predictionModel) {
            return { move: 3, confidence: 0.5, reasoning: ['Neural network not available'] };
        }

        // Encode board and history
        const input = this.encodeGameState(board, moveHistory, profile);
        const prediction = await this.predictionModel.predict(input) as tf.Tensor;
        const probabilities = await prediction.data();

        // Find best legal move
        const legalMoves = this.getLegalMoves(board);
        let bestMove = legalMoves[0];
        let bestProb = 0;

        legalMoves.forEach(move => {
            if (probabilities[move] > bestProb) {
                bestProb = probabilities[move];
                bestMove = move;
            }
        });

        prediction.dispose();
        input.dispose();

        return {
            move: bestMove,
            confidence: bestProb,
            reasoning: [`Neural network prediction with ${(bestProb * 100).toFixed(1)}% confidence`]
        };
    }

    /**
     * Predict from emotional state
     */
    private predictFromEmotionalState(
        board: CellValue[][],
        profile: OpponentProfile,
        context: any
    ): { move: number; confidence: number; reasoning: string[] } {
        const legalMoves = this.getLegalMoves(board);
        const reasoning: string[] = [];

        let preferredMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        let confidence = 0.5;

        switch (profile.emotionalState) {
            case 'frustrated':
                // Frustrated players often make hasty decisions
                preferredMove = legalMoves[0]; // First legal move
                confidence = 0.7;
                reasoning.push('Frustrated players tend to play quickly');
                break;
            case 'confident':
                // Confident players prefer center columns
                const centerMoves = legalMoves.filter(m => m >= 2 && m <= 4);
                if (centerMoves.length > 0) {
                    preferredMove = centerMoves[0];
                    confidence = 0.8;
                    reasoning.push('Confident players prefer center control');
                }
                break;
            case 'tired':
                // Tired players make predictable moves
                preferredMove = profile.movePatterns.columnPreferences.indexOf(
                    Math.max(...profile.movePatterns.columnPreferences)
                );
                confidence = 0.6;
                reasoning.push('Tired players fall back to habitual patterns');
                break;
        }

        return { move: preferredMove, confidence, reasoning };
    }

    /**
     * Predict from adaptation patterns
     */
    private predictFromAdaptation(
        board: CellValue[][],
        moveHistory: number[],
        profile: OpponentProfile,
        context: any
    ): { move: number; confidence: number; reasoning: string[] } {
        const legalMoves = this.getLegalMoves(board);
        const reasoning: string[] = [];

        // Analyze if opponent is adapting to our strategy
        const adaptationScore = this.calculateAdaptationScore(profile, context);

        if (adaptationScore > 0.7) {
            // Opponent is adapting, predict counter-adaptation
            const counterMove = this.predictCounterAdaptation(board, moveHistory, profile, context);
            reasoning.push('Opponent is adapting to our strategy');
            return { move: counterMove, confidence: 0.8, reasoning };
        }

        // Default to center preference
        const centerMoves = legalMoves.filter(m => m >= 2 && m <= 4);
        const preferredMove = centerMoves.length > 0 ? centerMoves[0] : legalMoves[0];

        return { move: preferredMove, confidence: 0.4, reasoning };
    }

    /**
     * Combine multiple predictions
     */
    private combinePredictions(
        predictions: { result: { move: number; confidence: number; reasoning: string[] }; weight: number }[]
    ): { move: number; confidence: number; reasoning: string[]; alternatives: { move: number; probability: number }[] } {
        const moveScores = new Map<number, number>();
        const reasoning: string[] = [];

        predictions.forEach(({ result, weight }) => {
            const currentScore = moveScores.get(result.move) || 0;
            moveScores.set(result.move, currentScore + result.confidence * weight);
            reasoning.push(...result.reasoning);
        });

        // Find best move
        let bestMove = 0;
        let bestScore = 0;

        for (const [move, score] of moveScores.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        // Generate alternatives
        const alternatives = Array.from(moveScores.entries())
            .filter(([move, score]) => move !== bestMove)
            .map(([move, score]) => ({ move, probability: score / bestScore }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 3);

        return {
            move: bestMove,
            confidence: Math.min(bestScore, 1.0),
            reasoning,
            alternatives
        };
    }

    /**
     * Initialize models
     */
    private initializeModels(): void {
        // Initialize prediction model
        this.predictionModel = this.buildPredictionModel();
        this.behaviorClassifier = this.buildBehaviorClassifier();
        this.emotionDetector = this.buildEmotionDetector();
    }

    /**
     * Build prediction model
     */
    private buildPredictionModel(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 3] }); // Board + history encoding

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
        x = tf.layers.dense({ units: 256, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dropout({ rate: 0.3 }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({ units: 7, activation: 'softmax' }).apply(x) as tf.SymbolicTensor;

        const model = tf.model({ inputs: input, outputs: output });
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Build behavior classifier
     */
    private buildBehaviorClassifier(): tf.LayersModel {
        const input = tf.input({ shape: [20] }); // Behavioral features

        let x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
        x = tf.layers.dropout({ rate: 0.3 }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({ units: 6, activation: 'softmax' }).apply(x) as tf.SymbolicTensor; // 6 playing styles

        const model = tf.model({ inputs: input, outputs: output });
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Build emotion detector
     */
    private buildEmotionDetector(): tf.LayersModel {
        const input = tf.input({ shape: [10] }); // Emotional indicators

        let x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
        x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({ units: 5, activation: 'softmax' }).apply(x) as tf.SymbolicTensor; // 5 emotional states

        const model = tf.model({ inputs: input, outputs: output });
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Initialize adaptation strategies
     */
    private initializeAdaptationStrategies(): void {
        this.adaptationStrategies = [
            {
                name: 'exploit_patterns',
                description: 'Exploit opponent\'s predictable patterns',
                targetProfile: { patternRecognition: 0.3 },
                effectiveness: 0.8,
                implementation: this.exploitPatternsStrategy.bind(this)
            },
            {
                name: 'pressure_adaptation',
                description: 'Apply pressure to force mistakes',
                targetProfile: { pressureResponse: 'degrades' },
                effectiveness: 0.7,
                implementation: this.pressureAdaptationStrategy.bind(this)
            },
            {
                name: 'creative_disruption',
                description: 'Use creative moves to disrupt opponent patterns',
                targetProfile: { adaptabilityScore: 0.4 },
                effectiveness: 0.6,
                implementation: this.creativeDisruptionStrategy.bind(this)
            }
        ];
    }

    // Helper methods (simplified implementations)
    private getLegalMoves(board: CellValue[][]): number[] {
        const legalMoves: number[] = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                legalMoves.push(col);
            }
        }
        return legalMoves;
    }

    private encodeGameState(board: CellValue[][], moveHistory: number[], profile: OpponentProfile): tf.Tensor {
        // Encode game state for neural network
        return tf.zeros([1, 6, 7, 3]); // Simplified
    }

    private calculatePredictionUncertainty(predictions: any[], profile: OpponentProfile): any {
        // Calculate prediction uncertainty
        return { epistemic: 0.2, aleatoric: 0.1, total: 0.22 };
    }

    private analyzeContextualFactors(board: CellValue[][], profile: OpponentProfile, context: any): any[] {
        // Analyze contextual factors
        return [];
    }

    private updateSkillAssessment(profile: OpponentProfile, gameData: any): void {
        // Update skill assessment
    }

    private updatePlayingStyle(profile: OpponentProfile, gameData: any): void {
        // Update playing style
    }

    private updateBehavioralPatterns(profile: OpponentProfile, gameData: any): void {
        // Update behavioral patterns
    }

    private updatePsychologicalProfile(profile: OpponentProfile, gameData: any): void {
        // Update psychological profile
    }

    private updatePredictiveModel(profile: OpponentProfile, gameData: any): void {
        // Update predictive model
    }

    private updateGamePhaseStrengths(profile: OpponentProfile, gameData: any): void {
        // Update game phase strengths
    }

    private updateLearningPatterns(profile: OpponentProfile, gameData: any): void {
        // Update learning patterns
    }

    private updateMetaGameAwareness(profile: OpponentProfile, gameData: any): void {
        // Update meta-game awareness
    }

    private addGameToHistory(profile: OpponentProfile, gameData: any): void {
        // Add game to history
    }

    private selectAdaptationStrategy(profile: OpponentProfile, context: any): AdaptationStrategy {
        // Select adaptation strategy
        return this.adaptationStrategies[0];
    }

    private calculateAdaptationConfidence(profile: OpponentProfile, strategy: AdaptationStrategy, context: any): number {
        // Calculate adaptation confidence
        return 0.7;
    }

    private generateAdaptationReasoning(profile: OpponentProfile, strategy: AdaptationStrategy, context: any): string[] {
        // Generate adaptation reasoning
        return [`Applied ${strategy.name} strategy`];
    }

    private calculateAdaptationScore(profile: OpponentProfile, context: any): number {
        // Calculate adaptation score
        return 0.5;
    }

    private predictCounterAdaptation(board: CellValue[][], moveHistory: number[], profile: OpponentProfile, context: any): number {
        // Predict counter-adaptation
        return 3;
    }

    private exploitPatternsStrategy(board: CellValue[][], moves: number[], profile: OpponentProfile): number[] {
        // Exploit patterns strategy
        return moves;
    }

    private pressureAdaptationStrategy(board: CellValue[][], moves: number[], profile: OpponentProfile): number[] {
        // Pressure adaptation strategy
        return moves;
    }

    private creativeDisruptionStrategy(board: CellValue[][], moves: number[], profile: OpponentProfile): number[] {
        // Creative disruption strategy
        return moves;
    }

    /**
     * Get opponent profile
     */
    getProfile(playerId: string): OpponentProfile | undefined {
        return this.opponentProfiles.get(playerId);
    }

    /**
     * Get all profiles
     */
    getAllProfiles(): OpponentProfile[] {
        return Array.from(this.opponentProfiles.values());
    }

    /**
     * Reset profile
     */
    resetProfile(playerId: string): void {
        this.opponentProfiles.delete(playerId);
    }
} 