// backend/src/ai/algorithms/rlhf/AdaptationSystem.ts
import { CellValue } from '../../connect4AI';

export interface AdaptationConfig {
    playerModeling: boolean;
    styleAdaptation: boolean;
    difficultyScaling: boolean;
    personalizedLearning: boolean;
    contextualMemory: boolean;
    transferLearning: boolean;
    onlineUpdates: boolean;
    adaptationRate: number;
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
    cognitiveLoad: number;
    emotionalState: 'engaged' | 'frustrated' | 'bored' | 'excited' | 'focused';
    lastUpdated: number;
}

export interface AdaptationStrategy {
    name: string;
    description: string;
    targetSkillRange: [number, number];
    adaptationFactor: number;
    implementation: (board: CellValue[][], moves: number[], playerModel: PlayerModel) => number[];
}

export interface AdaptationMetrics {
    totalAdaptations: number;
    successfulAdaptations: number;
    adaptationAccuracy: number;
    playerSatisfactionImprovement: number;
    learningEfficiency: number;
    styleMatchingScore: number;
    lastUpdate: number;
}

/**
 * Advanced Adaptation System
 * 
 * Features:
 * - Real-time player modeling and profiling
 * - Dynamic difficulty adjustment
 * - Playing style adaptation
 * - Personalized learning paths
 * - Contextual memory and transfer learning
 * - Emotional state recognition
 * - Cognitive load management
 * - Performance optimization
 */
export class AdaptationSystem {
    private config: AdaptationConfig;
    private playerModels: Map<string, PlayerModel> = new Map();
    private adaptationStrategies: AdaptationStrategy[] = [];
    private metrics: AdaptationMetrics;
    private contextualMemory: Map<string, any> = new Map();
    private transferLearningDatabase: Map<string, any> = new Map();

    constructor(config: AdaptationConfig) {
        this.config = config;
        this.metrics = this.initializeMetrics();
        this.initializeAdaptationStrategies();
    }

    /**
     * Adapt AI behavior based on player model
     */
    adaptToPlayer(
        board: CellValue[][],
        candidateMoves: number[],
        playerId: string,
        context: any
    ): {
        adaptedMoves: number[];
        adaptationStrategy: string;
        confidence: number;
        reasoning: string[];
    } {
        const playerModel = this.getOrCreatePlayerModel(playerId);

        // Select appropriate adaptation strategy
        const strategy = this.selectAdaptationStrategy(playerModel, context);

        // Apply adaptation
        const adaptedMoves = strategy.implementation(board, candidateMoves, playerModel);

        // Calculate confidence and reasoning
        const confidence = this.calculateAdaptationConfidence(playerModel, strategy, context);
        const reasoning = this.generateAdaptationReasoning(playerModel, strategy, context);

        // Update metrics
        this.updateAdaptationMetrics(playerModel, strategy, confidence);

        return {
            adaptedMoves,
            adaptationStrategy: strategy.name,
            confidence,
            reasoning
        };
    }

    /**
     * Adapt AI behavior based on opponent model (alias for adaptToPlayer)
     */
    adaptToOpponent(
        board: CellValue[][],
        candidateMoves: number[],
        opponentId: string,
        context: any
    ): {
        adaptedMoves: number[];
        adaptationStrategy: string;
        confidence: number;
        reasoning: string[];
    } {
        // This is an alias for adaptToPlayer to maintain backward compatibility
        return this.adaptToPlayer(board, candidateMoves, opponentId, context);
    }

    /**
     * Update player model based on game interaction
     */
    updatePlayerModel(
        playerId: string,
        gameData: {
            moves: number[];
            moveTimes: number[];
            outcome: 'win' | 'loss' | 'draw';
            satisfaction?: number;
            engagement?: number;
            feedback?: any;
        }
    ): void {
        const playerModel = this.getOrCreatePlayerModel(playerId);

        // Update skill level
        this.updateSkillLevel(playerModel, gameData);

        // Update playing style
        this.updatePlayingStyle(playerModel, gameData);

        // Update preferences
        this.updatePreferences(playerModel, gameData);

        // Update behavioral patterns
        this.updateBehavioralPatterns(playerModel, gameData);

        // Update cognitive and emotional state
        this.updateCognitiveState(playerModel, gameData);

        // Store in contextual memory
        this.storeContextualMemory(playerId, gameData);

        // Update transfer learning database
        this.updateTransferLearning(playerModel, gameData);

        playerModel.lastUpdated = Date.now();
        this.playerModels.set(playerId, playerModel);
    }

    /**
     * Get or create player model
     */
    private getOrCreatePlayerModel(playerId: string): PlayerModel {
        if (!this.playerModels.has(playerId)) {
            const newModel: PlayerModel = {
                playerId,
                skillLevel: 0.5,
                playingStyle: 'balanced',
                preferences: {
                    complexity: 0.5,
                    creativity: 0.5,
                    challenge: 0.5,
                    fairness: 0.8,
                    engagement: 0.7
                },
                behavioralPatterns: {
                    averageMoveTime: 5000,
                    consistencyScore: 0.5,
                    riskTolerance: 0.5,
                    learningRate: 0.5,
                    adaptabilityScore: 0.5
                },
                gameHistory: [],
                cognitiveLoad: 0.5,
                emotionalState: 'engaged',
                lastUpdated: Date.now()
            };
            this.playerModels.set(playerId, newModel);
        }
        return this.playerModels.get(playerId)!;
    }

    /**
     * Select appropriate adaptation strategy
     */
    private selectAdaptationStrategy(playerModel: PlayerModel, context: any): AdaptationStrategy {
        const eligibleStrategies = this.adaptationStrategies.filter(strategy => {
            const [minSkill, maxSkill] = strategy.targetSkillRange;
            return playerModel.skillLevel >= minSkill && playerModel.skillLevel <= maxSkill;
        });

        if (eligibleStrategies.length === 0) {
            return this.adaptationStrategies[0]; // Default strategy
        }

        // Select based on player state and context
        let bestStrategy = eligibleStrategies[0];
        let bestScore = 0;

        eligibleStrategies.forEach(strategy => {
            const score = this.evaluateStrategyFit(strategy, playerModel, context);
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        });

        return bestStrategy;
    }

    /**
     * Initialize adaptation strategies
     */
    private initializeAdaptationStrategies(): void {
        this.adaptationStrategies = [
            {
                name: 'beginner_support',
                description: 'Supportive adaptation for beginner players',
                targetSkillRange: [0, 0.3],
                adaptationFactor: 0.8,
                implementation: this.beginnerSupportStrategy.bind(this)
            },
            {
                name: 'intermediate_challenge',
                description: 'Balanced challenge for intermediate players',
                targetSkillRange: [0.3, 0.7],
                adaptationFactor: 0.6,
                implementation: this.intermediateChallengeStrategy.bind(this)
            },
            {
                name: 'advanced_competition',
                description: 'Competitive adaptation for advanced players',
                targetSkillRange: [0.7, 1.0],
                adaptationFactor: 0.4,
                implementation: this.advancedCompetitionStrategy.bind(this)
            },
            {
                name: 'creative_exploration',
                description: 'Creative moves for exploratory players',
                targetSkillRange: [0.2, 0.8],
                adaptationFactor: 0.5,
                implementation: this.creativeExplorationStrategy.bind(this)
            },
            {
                name: 'emotional_regulation',
                description: 'Emotional state-aware adaptation',
                targetSkillRange: [0, 1.0],
                adaptationFactor: 0.7,
                implementation: this.emotionalRegulationStrategy.bind(this)
            }
        ];
    }

    /**
     * Beginner support strategy
     */
    private beginnerSupportStrategy(board: CellValue[][], moves: number[], playerModel: PlayerModel): number[] {
        // Prioritize educational moves and avoid overwhelming complexity
        const supportedMoves = [...moves];

        // Favor center columns for beginners
        supportedMoves.sort((a, b) => {
            const aCenterDistance = Math.abs(a - 3);
            const bCenterDistance = Math.abs(b - 3);
            return aCenterDistance - bCenterDistance;
        });

        // If player is frustrated, make easier moves
        if (playerModel.emotionalState === 'frustrated') {
            return supportedMoves.slice(0, Math.min(3, supportedMoves.length));
        }

        return supportedMoves;
    }

    /**
     * Intermediate challenge strategy
     */
    private intermediateChallengeStrategy(board: CellValue[][], moves: number[], playerModel: PlayerModel): number[] {
        // Balance challenge with achievability
        const challengingMoves = [...moves];

        // Adapt based on consistency score
        if (playerModel.behavioralPatterns.consistencyScore > 0.7) {
            // Player is consistent, can handle more complexity
            return challengingMoves;
        } else {
            // Player is inconsistent, simplify choices
            return challengingMoves.slice(0, Math.min(4, challengingMoves.length));
        }
    }

    /**
     * Advanced competition strategy
     */
    private advancedCompetitionStrategy(board: CellValue[][], moves: number[], playerModel: PlayerModel): number[] {
        // Full strategic depth for advanced players
        const competitiveMoves = [...moves];

        // Adapt based on playing style
        if (playerModel.playingStyle === 'aggressive') {
            // Prioritize attacking moves
            return this.prioritizeAttackingMoves(board, competitiveMoves);
        } else if (playerModel.playingStyle === 'defensive') {
            // Prioritize defensive moves
            return this.prioritizeDefensiveMoves(board, competitiveMoves);
        }

        return competitiveMoves;
    }

    /**
     * Creative exploration strategy
     */
    private creativeExplorationStrategy(board: CellValue[][], moves: number[], playerModel: PlayerModel): number[] {
        // Encourage creative and unusual moves
        const creativeMoves = [...moves];

        // If player prefers creativity, show unusual moves
        if (playerModel.preferences.creativity > 0.6) {
            return this.prioritizeCreativeMoves(board, creativeMoves);
        }

        return creativeMoves;
    }

    /**
     * Emotional regulation strategy
     */
    private emotionalRegulationStrategy(board: CellValue[][], moves: number[], playerModel: PlayerModel): number[] {
        // Adapt based on emotional state
        const regulatedMoves = [...moves];

        switch (playerModel.emotionalState) {
            case 'frustrated':
                // Provide easier, more encouraging moves
                return regulatedMoves.slice(0, 2);
            case 'bored':
                // Provide more exciting, creative moves
                return this.prioritizeExcitingMoves(board, regulatedMoves);
            case 'excited':
                // Maintain excitement with dynamic moves
                return this.prioritizeDynamicMoves(board, regulatedMoves);
            default:
                return regulatedMoves;
        }
    }

    /**
     * Update skill level based on game performance
     */
    private updateSkillLevel(playerModel: PlayerModel, gameData: any): void {
        // Analyze move quality and timing
        const moveQuality = this.analyzeMoveQuality(gameData.moves);
        const timingConsistency = this.analyzeTimingConsistency(gameData.moveTimes);

        // Update skill level with exponential moving average
        const skillDelta = (moveQuality + timingConsistency) / 2 - playerModel.skillLevel;
        playerModel.skillLevel += skillDelta * this.config.adaptationRate;
        playerModel.skillLevel = Math.max(0, Math.min(1, playerModel.skillLevel));
    }

    /**
     * Update playing style based on move patterns
     */
    private updatePlayingStyle(playerModel: PlayerModel, gameData: any): void {
        const styleScores = this.analyzePlayingStyle(gameData.moves);
        const dominantStyle = Object.entries(styleScores).reduce((a, b) =>
            styleScores[a[0]] > styleScores[b[0]] ? a : b
        )[0] as PlayerModel['playingStyle'];

        playerModel.playingStyle = dominantStyle;
    }

    /**
     * Update preferences based on feedback and behavior
     */
    private updatePreferences(playerModel: PlayerModel, gameData: any): void {
        if (gameData.satisfaction !== undefined) {
            // Update preferences based on satisfaction
            const satisfactionDelta = gameData.satisfaction - 0.5;
            playerModel.preferences.challenge += satisfactionDelta * 0.1;
            playerModel.preferences.engagement += satisfactionDelta * 0.15;
        }
    }

    /**
     * Update behavioral patterns
     */
    private updateBehavioralPatterns(playerModel: PlayerModel, gameData: any): void {
        // Update average move time
        if (gameData.moveTimes) {
            const avgTime = gameData.moveTimes.reduce((a, b) => a + b, 0) / gameData.moveTimes.length;
            playerModel.behavioralPatterns.averageMoveTime =
                0.8 * playerModel.behavioralPatterns.averageMoveTime + 0.2 * avgTime;
        }

        // Update consistency score
        playerModel.behavioralPatterns.consistencyScore = this.calculateConsistencyScore(gameData);
    }

    /**
     * Update cognitive and emotional state
     */
    private updateCognitiveState(playerModel: PlayerModel, gameData: any): void {
        // Analyze cognitive load from move times and patterns
        const cognitiveLoad = this.analyzeCognitiveLoad(gameData);
        playerModel.cognitiveLoad = 0.7 * playerModel.cognitiveLoad + 0.3 * cognitiveLoad;

        // Update emotional state based on game outcome and patterns
        playerModel.emotionalState = this.inferEmotionalState(gameData, playerModel);
    }

    /**
     * Store contextual memory
     */
    private storeContextualMemory(playerId: string, gameData: any): void {
        const memoryKey = `${playerId}_${Date.now()}`;
        this.contextualMemory.set(memoryKey, {
            gameData,
            timestamp: Date.now()
        });

        // Cleanup old memories
        this.cleanupContextualMemory();
    }

    /**
     * Update transfer learning database
     */
    private updateTransferLearning(playerModel: PlayerModel, gameData: any): void {
        const pattern = this.extractLearningPattern(playerModel, gameData);
        const patternKey = this.generatePatternKey(pattern);

        this.transferLearningDatabase.set(patternKey, {
            pattern,
            outcomes: this.updatePatternOutcomes(patternKey, gameData.outcome),
            lastUpdated: Date.now()
        });
    }

    // Helper methods (simplified implementations)
    private evaluateStrategyFit(strategy: AdaptationStrategy, playerModel: PlayerModel, context: any): number {
        // Evaluate how well strategy fits player and context
        return Math.random(); // Simplified
    }

    private calculateAdaptationConfidence(playerModel: PlayerModel, strategy: AdaptationStrategy, context: any): number {
        // Calculate confidence in adaptation
        return 0.8; // Simplified
    }

    private generateAdaptationReasoning(playerModel: PlayerModel, strategy: AdaptationStrategy, context: any): string[] {
        // Generate reasoning for adaptation
        return [`Applied ${strategy.name} based on player skill level ${playerModel.skillLevel.toFixed(2)}`];
    }

    private updateAdaptationMetrics(playerModel: PlayerModel, strategy: AdaptationStrategy, confidence: number): void {
        // Update adaptation metrics
        this.metrics.totalAdaptations++;
        this.metrics.lastUpdate = Date.now();
    }

    private initializeMetrics(): AdaptationMetrics {
        return {
            totalAdaptations: 0,
            successfulAdaptations: 0,
            adaptationAccuracy: 0,
            playerSatisfactionImprovement: 0,
            learningEfficiency: 0,
            styleMatchingScore: 0,
            lastUpdate: Date.now()
        };
    }

    private prioritizeAttackingMoves(board: CellValue[][], moves: number[]): number[] {
        // Prioritize attacking moves
        return moves; // Simplified
    }

    private prioritizeDefensiveMoves(board: CellValue[][], moves: number[]): number[] {
        // Prioritize defensive moves
        return moves; // Simplified
    }

    private prioritizeCreativeMoves(board: CellValue[][], moves: number[]): number[] {
        // Prioritize creative moves
        return moves; // Simplified
    }

    private prioritizeExcitingMoves(board: CellValue[][], moves: number[]): number[] {
        // Prioritize exciting moves
        return moves; // Simplified
    }

    private prioritizeDynamicMoves(board: CellValue[][], moves: number[]): number[] {
        // Prioritize dynamic moves
        return moves; // Simplified
    }

    private analyzeMoveQuality(moves: number[]): number {
        // Analyze move quality
        return 0.5; // Simplified
    }

    private analyzeTimingConsistency(moveTimes: number[]): number {
        // Analyze timing consistency
        return 0.5; // Simplified
    }

    private analyzePlayingStyle(moves: number[]): { [key: string]: number } {
        // Analyze playing style
        return { aggressive: 0.3, defensive: 0.4, balanced: 0.3 };
    }

    private calculateConsistencyScore(gameData: any): number {
        // Calculate consistency score
        return 0.5; // Simplified
    }

    private analyzeCognitiveLoad(gameData: any): number {
        // Analyze cognitive load
        return 0.5; // Simplified
    }

    private inferEmotionalState(gameData: any, playerModel: PlayerModel): PlayerModel['emotionalState'] {
        // Infer emotional state
        return 'engaged'; // Simplified
    }

    private cleanupContextualMemory(): void {
        // Cleanup old memories
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        for (const [key, value] of this.contextualMemory.entries()) {
            if (value.timestamp < cutoffTime) {
                this.contextualMemory.delete(key);
            }
        }
    }

    private extractLearningPattern(playerModel: PlayerModel, gameData: any): any {
        // Extract learning pattern
        return {}; // Simplified
    }

    private generatePatternKey(pattern: any): string {
        // Generate pattern key
        return 'pattern_' + Date.now();
    }

    private updatePatternOutcomes(patternKey: string, outcome: string): any {
        // Update pattern outcomes
        return {}; // Simplified
    }

    /**
     * Get player model
     */
    getPlayerModel(playerId: string): PlayerModel | undefined {
        return this.playerModels.get(playerId);
    }

    /**
     * Get adaptation metrics
     */
    getAdaptationMetrics(): AdaptationMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset player model
     */
    resetPlayerModel(playerId: string): void {
        this.playerModels.delete(playerId);
    }
} 