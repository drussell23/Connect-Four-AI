import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AsyncAIOrchestrator, AIRequest } from './async/async-ai-orchestrator';
import { PerformanceMonitor } from './async/performance-monitor';
import { DynamicStrategySelector, AIStrategy } from './async/strategy-selector';
import { CellValue } from './connect4AI';

interface GamePhase {
    phase: 'opening' | 'midgame' | 'endgame';
    moveCount: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface PredictionResult {
    move: number;
    probs: number[];
    confidence: number;
    uncertainty?: number[];
    source: 'fast' | 'deep' | 'ensemble';
    reasoning?: string;
}

interface OpponentProfile {
    type: 'aggressive' | 'defensive' | 'balanced' | 'random' | 'expert';
    confidence: number;
    patterns: string[];
    adaptations: number;
}

interface GameMemoryData {
    result: 'win' | 'loss' | 'draw';
    moveHistory: number[];
    opponentId?: string;
}

@Injectable()
export class AdaptiveAIService {
    private readonly logger = new Logger(AdaptiveAIService.name);
    private readonly ML_SERVICE_URL = 'http://localhost:8000';
    private readonly ML_INFERENCE_URL = 'http://localhost:8001';
    
    // Async orchestrator integration
    private asyncOrchestrator?: AsyncAIOrchestrator;
    private performanceMonitor?: PerformanceMonitor;
    private strategySelector?: DynamicStrategySelector;

    // Intelligence memory
    private opponentProfiles = new Map<string, OpponentProfile>();
    private gameMemory = new Map<string, GameMemoryData>();
    private strategyEffectiveness = new Map<string, number>();
    private ensembleWeights = { fast: 0.5, deep: 0.5 };
    
    constructor(
        asyncOrchestrator?: AsyncAIOrchestrator,
        performanceMonitor?: PerformanceMonitor,
        strategySelector?: DynamicStrategySelector
    ) {
        this.asyncOrchestrator = asyncOrchestrator;
        this.performanceMonitor = performanceMonitor;
        this.strategySelector = strategySelector;
    }

    /**
     * 🧠 ADAPTIVE PREDICTION ENGINE
     * Intelligently combines multiple AI approaches for superior gameplay
     */
    async adaptivePredict(
        board: string[][],
        gameId: string,
        opponentId?: string,
        moveHistory: number[] = []
    ): Promise<PredictionResult> {
        try {
            // Convert board to CellValue format
            const cellBoard = this.convertBoard(board);
            
            // Use async orchestrator if available
            if (this.asyncOrchestrator) {
                const request: AIRequest = {
                    gameId,
                    board: cellBoard,
                    player: this.determineAIPlayer(cellBoard, moveHistory),
                    difficulty: this.calculateDifficulty(moveHistory),
                    timeLimit: 5000,
                    priority: 5
                };
                
                const response = await this.asyncOrchestrator!.getAIMove(request);
                
                return {
                    move: response.move,
                    probs: this.generateProbsFromMove(response.move),
                    confidence: response.confidence,
                    source: 'ensemble',
                    reasoning: response.explanation || `${response.strategy} strategy with ${response.confidence.toFixed(2)} confidence`
                };
            }
            // 1. Analyze current game state
            const gamePhase = this.analyzeGamePhase(board, moveHistory);
            const opponentProfile = await this.analyzeOpponent(opponentId, moveHistory);

            this.logger.debug(`Game Phase: ${gamePhase.phase}, Threat: ${gamePhase.threatLevel}`);
            this.logger.debug(`Opponent: ${opponentProfile?.type || 'unknown'}`);

            // 2. Determine optimal AI strategy
            const strategy = this.selectOptimalStrategy(gamePhase, opponentProfile);

            // 3. Get predictions based on strategy
            if (strategy.useEnsemble) {
                return await this.ensemblePrediction(board, gamePhase, opponentProfile);
            } else if (strategy.preferFast) {
                return await this.fastPrediction(board, 'tactical');
            } else {
                return await this.deepPrediction(board, gamePhase);
            }

        } catch (error) {
            this.logger.error(`Adaptive prediction failed: ${error.message}`);
            // Fallback to simple prediction
            return await this.fastPrediction(board, 'fallback');
        }
    }

    /**
     * 🎯 GAME PHASE ANALYSIS
     * Determines current game phase and threat level
     */
    private analyzeGamePhase(board: string[][], moveHistory: number[]): GamePhase {
        const moveCount = moveHistory.length;
        const filledSpaces = board.flat().filter(cell => cell !== 'Empty').length;

        // Check for immediate threats
        const threatLevel = this.assessThreatLevel(board);

        // Determine phase
        let phase: 'opening' | 'midgame' | 'endgame';
        if (moveCount < 8) phase = 'opening';
        else if (filledSpaces < 30) phase = 'midgame';
        else phase = 'endgame';

        return { phase, moveCount, threatLevel };
    }

    /**
     * ⚡ THREAT ASSESSMENT
     * Analyzes immediate tactical threats
     */
    private assessThreatLevel(board: string[][]): 'low' | 'medium' | 'high' | 'critical' {
        let maxThreat = 0;

        // Check for winning moves (critical threat)
        if (this.hasWinningMove(board)) return 'critical';

        // Check for blocking required (high threat)
        if (this.hasBlockingRequired(board)) return 'high';

        // Check for 2-in-a-row threats (medium threat)
        const twoInRowCount = this.countTwoInRowThreats(board);
        if (twoInRowCount >= 2) return 'medium';

        return 'low';
    }

    /**
     * 🤖 OPPONENT ANALYSIS
     * Builds psychological profile of opponent
     */
    private async analyzeOpponent(opponentId: string, moveHistory: number[]): Promise<OpponentProfile | null> {
        if (!opponentId || moveHistory.length < 6) return null;

        const existingProfile = this.opponentProfiles.get(opponentId);

        // Analyze move patterns
        const patterns = this.extractMovePatterns(moveHistory);
        const aggression = this.calculateAggression(moveHistory);
        const consistency = this.calculateConsistency(moveHistory);

        // Determine opponent type
        let type: OpponentProfile['type'];
        if (aggression > 0.7) type = 'aggressive';
        else if (aggression < 0.3) type = 'defensive';
        else if (consistency < 0.4) type = 'random';
        else if (consistency > 0.8) type = 'expert';
        else type = 'balanced';

        const profile: OpponentProfile = {
            type,
            confidence: Math.min(moveHistory.length / 20, 1.0),
            patterns,
            adaptations: existingProfile?.adaptations || 0
        };

        this.opponentProfiles.set(opponentId, profile);
        return profile;
    }

    /**
     * 🧭 STRATEGY SELECTION
     * Chooses optimal AI approach based on context
     */
    private selectOptimalStrategy(gamePhase: GamePhase, opponentProfile: OpponentProfile | null) {
        // Critical situations: Use fast tactical response
        if (gamePhase.threatLevel === 'critical') {
            return { useEnsemble: false, preferFast: true, reason: 'critical_response' };
        }

        // Opening phase: Balance speed and strategy
        if (gamePhase.phase === 'opening') {
            return { useEnsemble: true, reason: 'opening_balance' };
        }

        // Against expert players: Use deep analysis
        if (opponentProfile?.type === 'expert') {
            return { useEnsemble: false, preferFast: false, reason: 'expert_opponent' };
        }

        // Endgame: Strategic depth crucial
        if (gamePhase.phase === 'endgame') {
            return { useEnsemble: false, preferFast: false, reason: 'endgame_strategy' };
        }

        // Default: Ensemble approach
        return { useEnsemble: true, reason: 'balanced_approach' };
    }

    /**
     * 🎭 ENSEMBLE PREDICTION
     * Combines multiple AI approaches with intelligent weighting
     */
    private async ensemblePrediction(
        board: string[][],
        gamePhase: GamePhase,
        opponentProfile: OpponentProfile | null
    ): Promise<PredictionResult> {
        // Get predictions from both services in parallel
        const [fastResult, deepResult] = await Promise.all([
            this.fastPrediction(board, 'ensemble_fast'),
            this.deepPrediction(board, gamePhase)
        ]);

        // Dynamic weight adjustment based on context
        const weights = this.calculateEnsembleWeights(gamePhase, opponentProfile);

        // Combine predictions with confidence weighting
        const combinedProbs = fastResult.probs.map((prob, i) =>
            prob * weights.fast + deepResult.probs[i] * weights.deep
        );

        const move = combinedProbs.indexOf(Math.max(...combinedProbs));
        const confidence = Math.max(...combinedProbs);

        return {
            move,
            probs: combinedProbs,
            confidence,
            source: 'ensemble',
            reasoning: `Combined fast (${weights.fast.toFixed(2)}) + deep (${weights.deep.toFixed(2)}) analysis`
        };
    }

    /**
     * ⚡ FAST PREDICTION
     * Quick tactical analysis using ML-Inference
     */
    private async fastPrediction(board: string[][], context: string): Promise<PredictionResult> {
        try {
            const response = await axios.post(`${this.ML_INFERENCE_URL}/predict`, {
                board,
                include_uncertainty: true
            });

            return {
                ...response.data,
                source: 'fast',
                reasoning: `Fast tactical analysis (${context})`
            };
        } catch (error) {
            this.logger.error(`Fast prediction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 🧠 DEEP PREDICTION
     * Strategic analysis using ML Service
     */
    private async deepPrediction(board: string[][], gamePhase: GamePhase): Promise<PredictionResult> {
        try {
            const response = await axios.post(`${this.ML_SERVICE_URL}/predict`, {
                board,
                include_uncertainty: true,
                model_type: gamePhase.phase === 'endgame' ? 'strategic' : 'standard'
            });

            return {
                ...response.data,
                source: 'deep',
                reasoning: `Deep strategic analysis (${gamePhase.phase})`
            };
        } catch (error) {
            this.logger.error(`Deep prediction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * ⚖️ DYNAMIC WEIGHT CALCULATION
     * Adjusts ensemble weights based on context
     */
    private calculateEnsembleWeights(gamePhase: GamePhase, opponentProfile: OpponentProfile | null) {
        let fastWeight = 0.5;
        let deepWeight = 0.5;

        // Adjust for game phase
        switch (gamePhase.phase) {
            case 'opening':
                fastWeight = 0.6; // Favor speed in opening
                break;
            case 'endgame':
                deepWeight = 0.7; // Favor strategy in endgame
                break;
        }

        // Adjust for threat level
        if (gamePhase.threatLevel === 'critical') {
            fastWeight = 0.8; // Emergency response
        }

        // Adjust for opponent
        if (opponentProfile?.type === 'expert') {
            deepWeight = 0.7; // Need deeper analysis
        } else if (opponentProfile?.type === 'random') {
            fastWeight = 0.7; // Simple responses work
        }

        // Normalize
        const total = fastWeight + deepWeight;
        return {
            fast: fastWeight / total,
            deep: deepWeight / total
        };
    }

    // Helper methods for game analysis
    private hasWinningMove(_board: string[][]): boolean {
        // Implementation for checking winning moves
        return false; // Placeholder
    }

    private hasBlockingRequired(_board: string[][]): boolean {
        // Implementation for checking blocking requirements
        return false; // Placeholder
    }

    private countTwoInRowThreats(_board: string[][]): number {
        // Implementation for counting two-in-a-row threats
        return 0; // Placeholder
    }

    private extractMovePatterns(moveHistory: number[]): string[] {
        // Analyze patterns in opponent moves
        const patterns: string[] = [];

        // Check for center preference
        const centerMoves = moveHistory.filter(move => move === 3).length;
        if (centerMoves / moveHistory.length > 0.4) {
            patterns.push('center_preference');
        }

        // Check for edge avoidance
        const edgeMoves = moveHistory.filter(move => move === 0 || move === 6).length;
        if (edgeMoves / moveHistory.length < 0.2) {
            patterns.push('edge_avoidance');
        }

        return patterns;
    }

    private calculateAggression(_moveHistory: number[]): number {
        // Calculate aggression score based on move choices
        // Placeholder implementation
        return 0.5;
    }

    private calculateConsistency(_moveHistory: number[]): number {
        // Calculate consistency in move patterns
        // Placeholder implementation
        return 0.5;
    }

    /**
     * 📊 LEARNING & ADAPTATION
     * Updates AI effectiveness based on game results
     */
    async updateFromGameResult(
        gameId: string,
        result: 'win' | 'loss' | 'draw',
        opponentId?: string,
        moveHistory: number[] = []
    ): Promise<void> {
        // Store game memory
        this.gameMemory.set(gameId, { result, moveHistory, opponentId });

        // Update strategy effectiveness
        const strategyKey = `ensemble_${moveHistory.length}`;
        const currentEffect = this.strategyEffectiveness.get(strategyKey) || 0.5;
        const newEffect = result === 'win' ? currentEffect + 0.1 : currentEffect - 0.05;
        this.strategyEffectiveness.set(strategyKey, Math.max(0.1, Math.min(0.9, newEffect)));

        // Adapt ensemble weights for opponent
        if (opponentId) {
            const profile = this.opponentProfiles.get(opponentId);
            if (profile) {
                profile.adaptations += 1;
                this.opponentProfiles.set(opponentId, profile);
            }
        }

        this.logger.log(`Updated AI from game ${gameId}: ${result}`);
    }
    
    /**
     * Initialize async components if available
     */
    async initialize(): Promise<void> {
        if (this.asyncOrchestrator) {
            this.logger.log('Initializing with async orchestrator...');
            
            // Set up performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.setAlertThreshold(
                    'adaptive.ai.prediction',
                    3000,
                    'above',
                    (metric) => {
                        this.logger.warn(`Slow adaptive prediction: ${metric.value}ms`);
                    }
                );
            }
            
            // Configure strategy selector for adaptive AI
            if (this.strategySelector) {
                // Update strategy weights based on opponent profiles
                for (const [, profile] of this.opponentProfiles) {
                    if (profile.type === 'expert') {
                        await this.strategySelector.updatePerformance(AIStrategy.ALPHAZERO, 'win', 100, 0.9);
                        await this.strategySelector.updatePerformance(AIStrategy.DQN, 'win', 150, 0.85);
                    } else if (profile.type === 'aggressive') {
                        await this.strategySelector.updatePerformance(AIStrategy.ALPHA_BETA, 'win', 50, 0.8);
                    }
                }
            }
        }
    }
    
    /**
     * Convert string board to CellValue format
     */
    private convertBoard(board: string[][]): CellValue[][] {
        return board.map(row => row.map(cell => {
            if (cell === 'Red') return 'Red' as CellValue;
            if (cell === 'Yellow') return 'Yellow' as CellValue;
            return 'Empty' as CellValue;
        }));
    }
    
    /**
     * Determine AI player color based on board state
     */
    private determineAIPlayer(board: CellValue[][], moveHistory: number[]): CellValue {
        const redCount = board.flat().filter(c => c === 'Red').length;
        const yellowCount = board.flat().filter(c => c === 'Yellow').length;
        
        // AI plays as the color with fewer pieces (or Yellow if equal)
        return redCount > yellowCount ? 'Yellow' : 'Red';
    }
    
    /**
     * Calculate difficulty based on game progression
     */
    private calculateDifficulty(_moveHistory: number[]): number {
        const moveCount = _moveHistory.length;
        if (moveCount < 8) return 10; // Opening
        if (moveCount < 20) return 15; // Midgame
        return 20; // Endgame
    }
    
    /**
     * Generate probability array from single move
     */
    private generateProbsFromMove(move: number): number[] {
        const probs = new Array(7).fill(0);
        probs[move] = 1.0;
        
        // Add some noise to neighboring columns
        if (move > 0) probs[move - 1] = 0.1;
        if (move < 6) probs[move + 1] = 0.1;
        
        // Normalize
        const sum = probs.reduce((a, b) => a + b, 0);
        return probs.map(p => p / sum);
    }
} 