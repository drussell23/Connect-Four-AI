// frontend/src/api/ai-insights.ts
import { appConfig } from '../config/environment';
import { emit, on, off } from './socket';

// Types for AI insights functionality
export interface MoveExplanation {
    gameId: string;
    move: number;
    player: 'player' | 'ai';
    column: number;
    explanation: {
        primary: string;
        secondary: string[];
        strategic: string;
        tactical: string;
    };
    analysis: {
        quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
        score: number;
        confidence: number;
        alternatives: {
            column: number;
            score: number;
            reasoning: string;
        }[];
    };
    boardState: {
        before: string[][];
        after: string[][];
        highlights: number[];
    };
    metadata: {
        moveNumber: number;
        gamePhase: 'opening' | 'middlegame' | 'endgame';
        timeSpent: number;
        aiLevel: string;
    };
}

export interface GameAnalysis {
    gameId: string;
    playerId: string;
    overallAnalysis: {
        gameQuality: 'high' | 'medium' | 'low';
        playerPerformance: number;
        aiPerformance: number;
        keyMoments: number[];
        criticalMistakes: number[];
        missedOpportunities: number[];
    };
    moveAnalysis: MoveExplanation[];
    strategicInsights: {
        openingStrategy: string;
        middlegamePlan: string;
        endgameTechnique: string;
        keyPrinciples: string[];
    };
    improvementSuggestions: {
        immediate: string[];
        longTerm: string[];
        specificMoves: number[];
    };
    statistics: {
        totalMoves: number;
        averageMoveQuality: number;
        bestMove: number;
        worstMove: number;
        timeControl: string;
        accuracyRate: number;
    };
}

export interface StrategicInsights {
    boardState: string[][];
    currentPlayer: 'player' | 'ai';
    insights: {
        immediate: {
            threats: number[];
            opportunities: number[];
            defensiveMoves: number[];
            offensiveMoves: number[];
        };
        strategic: {
            control: string[];
            patterns: string[];
            weaknesses: string[];
            strengths: string[];
        };
        tactical: {
            combinations: string[];
            traps: string[];
            counters: string[];
        };
    };
    recommendations: {
        bestMoves: {
            column: number;
            score: number;
            reasoning: string;
            risk: 'low' | 'medium' | 'high';
        }[];
        avoidMoves: {
            column: number;
            reason: string;
            risk: 'low' | 'medium' | 'high';
        }[];
    };
    evaluation: {
        position: 'winning' | 'equal' | 'losing';
        score: number;
        confidence: number;
        complexity: 'simple' | 'moderate' | 'complex';
    };
}

export interface PlayerStyleAnalysis {
    playerId: string;
    styleProfile: {
        aggressiveness: number;
        defensiveness: number;
        creativity: number;
        consistency: number;
        adaptability: number;
        patience: number;
    };
    patterns: {
        preferredOpenings: string[];
        commonMistakes: string[];
        strengths: string[];
        weaknesses: string[];
        improvementAreas: string[];
    };
    behavioral: {
        averageMoveTime: number;
        timeManagement: 'aggressive' | 'balanced' | 'conservative';
        riskTolerance: 'low' | 'medium' | 'high';
        learningCurve: 'fast' | 'moderate' | 'slow';
    };
    recommendations: {
        styleAdjustments: string[];
        trainingFocus: string[];
        gameStrategy: string[];
        mentalGame: string[];
    };
}

export interface AIRecommendations {
    gameId: string;
    playerId: string;
    recommendations: {
        immediate: {
            type: 'move' | 'strategy' | 'warning';
            priority: 'high' | 'medium' | 'low';
            message: string;
            action?: number;
            reasoning: string;
        }[];
        strategic: {
            focus: string;
            approach: string;
            goals: string[];
            timeline: string;
        };
        learning: {
            concepts: string[];
            practiceAreas: string[];
            resources: string[];
            exercises: string[];
        };
    };
    adaptiveSuggestions: {
        difficultyAdjustment: 'increase' | 'decrease' | 'maintain';
        aiStyle: 'aggressive' | 'defensive' | 'balanced' | 'creative';
        gameMode: 'training' | 'challenge' | 'relaxed';
        hints: boolean;
    };
    progressTracking: {
        currentLevel: string;
        nextMilestone: string;
        progressPercentage: number;
        estimatedTimeToNext: string;
    };
}

export interface AIInsightsConfig {
    enableExplanations: boolean;
    enableAnalysis: boolean;
    enableRecommendations: boolean;
    enableCaching: boolean;
    cacheExpiry: number;
    maxCacheSize: number;
    enableRealTime: boolean;
    enablePrivacy: boolean;
    detailLevel: 'basic' | 'detailed' | 'expert';
}

// Default configuration
const DEFAULT_CONFIG: AIInsightsConfig = {
    enableExplanations: true,
    enableAnalysis: true,
    enableRecommendations: true,
    enableCaching: true,
    cacheExpiry: 600000, // 10 minutes
    maxCacheSize: 100,
    enableRealTime: true,
    enablePrivacy: true,
    detailLevel: 'detailed',
};

// Enhanced AI Insights Manager Class
class AIInsightsManager {
    private config: AIInsightsConfig;
    private cache: Map<string, any> = new Map();
    private isInitialized: boolean = false;
    private requestQueue: Map<string, Promise<any>> = new Map();

    constructor(config: Partial<AIInsightsConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initialize();
    }

    private initialize(): void {
        if (this.isInitialized) return;

        console.log('🧠 Initializing AI Insights Manager');
        console.log('🔧 Configuration:', this.config);

        // Setup event listeners for real-time insights
        if (this.config.enableRealTime) {
            this.setupEventListeners();
        }

        this.isInitialized = true;
        console.log('✅ AI Insights Manager initialized');
    }

    private setupEventListeners(): void {
        // Listen for AI thinking events to provide real-time insights
        on('aiThinking', (data: any) => {
            if (this.config.enableRealTime) {
                this.provideRealTimeInsights(data);
            }
        });

        on('aiMove', (data: any) => {
            if (this.config.enableExplanations) {
                this.requestMoveExplanation(data);
            }
        });

        on('playerMove', (data: any) => {
            if (this.config.enableAnalysis) {
                this.analyzePlayerMove(data);
            }
        });
    }

    private async provideRealTimeInsights(data: any): Promise<void> {
        try {
            const insights = await this.getStrategicInsights(data.boardState, data.currentPlayer);
            emit('ai_insights_update', {
                gameId: data.gameId,
                insights,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('🚨 Error providing real-time insights:', error);
        }
    }

    private async requestMoveExplanation(data: any): Promise<void> {
        try {
            const explanation = await this.getMoveExplanation(data.gameId, data.move, 'ai');
            emit('move_explanation', {
                gameId: data.gameId,
                explanation,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('🚨 Error requesting move explanation:', error);
        }
    }

    private async analyzePlayerMove(data: any): Promise<void> {
        try {
            const analysis = await this.getMoveExplanation(data.gameId, data.move, 'player');
            emit('player_move_analysis', {
                gameId: data.gameId,
                analysis,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('🚨 Error analyzing player move:', error);
        }
    }

    private getCacheKey(prefix: string, identifier: string): string {
        return `${prefix}_${identifier}`;
    }

    private getCached<T>(key: string): T | null {
        if (!this.config.enableCaching) return null;

        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
            return cached.data;
        }

        return null;
    }

    private setCached(key: string, data: any): void {
        if (!this.config.enableCaching) return;

        // Implement LRU cache eviction
        if (this.cache.size >= this.config.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    private async makeRequest<T>(
        event: string,
        data: any,
        cacheKey?: string
    ): Promise<T> {
        // Check cache first
        if (cacheKey) {
            const cached = this.getCached<T>(cacheKey);
            if (cached) return cached;
        }

        // Check if request is already in progress
        const requestKey = `${event}_${JSON.stringify(data)}`;
        if (this.requestQueue.has(requestKey)) {
            return this.requestQueue.get(requestKey) as Promise<T>;
        }

        // Make new request
        const request = new Promise<T>((resolve, reject) => {
            emit(event, data, (response: any) => {
                if (response.success) {
                    const result = response.data;

                    // Cache the result
                    if (cacheKey) {
                        this.setCached(cacheKey, result);
                    }

                    resolve(result);
                } else {
                    reject(new Error(response.error || `Failed to ${event}`));
                }
            });
        });

        this.requestQueue.set(requestKey, request);

        try {
            const result = await request;
            this.requestQueue.delete(requestKey);
            return result;
        } catch (error) {
            this.requestQueue.delete(requestKey);
            throw error;
        }
    }

    // Public API Methods

    /**
     * Get detailed explanation for a specific move
     */
    public async getMoveExplanation(
        gameId: string,
        move: number,
        player: 'player' | 'ai'
    ): Promise<MoveExplanation> {
        try {
            const cacheKey = this.getCacheKey('move_explanation', `${gameId}_${move}_${player}`);

            return await this.makeRequest<MoveExplanation>(
                'get_move_explanation',
                { gameId, move, player },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting move explanation:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive game analysis
     */
    public async getGameAnalysis(gameId: string, playerId: string): Promise<GameAnalysis> {
        try {
            const cacheKey = this.getCacheKey('game_analysis', `${gameId}_${playerId}`);

            return await this.makeRequest<GameAnalysis>(
                'get_game_analysis',
                { gameId, playerId },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting game analysis:', error);
            throw error;
        }
    }

    /**
     * Get strategic insights for current board position
     */
    public async getStrategicInsights(
        boardState: string[][],
        currentPlayer: 'player' | 'ai'
    ): Promise<StrategicInsights> {
        try {
            const boardHash = JSON.stringify(boardState);
            const cacheKey = this.getCacheKey('strategic_insights', `${boardHash}_${currentPlayer}`);

            return await this.makeRequest<StrategicInsights>(
                'get_strategic_insights',
                { boardState, currentPlayer },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting strategic insights:', error);
            throw error;
        }
    }

    /**
     * Get player style analysis
     */
    public async getPlayerStyleAnalysis(playerId: string): Promise<PlayerStyleAnalysis> {
        try {
            const cacheKey = this.getCacheKey('player_style', playerId);

            return await this.makeRequest<PlayerStyleAnalysis>(
                'get_player_style_analysis',
                { playerId },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting player style analysis:', error);
            throw error;
        }
    }

    /**
     * Get AI recommendations for player improvement
     */
    public async getAIRecommendations(gameId: string, playerId: string): Promise<AIRecommendations> {
        try {
            const cacheKey = this.getCacheKey('ai_recommendations', `${gameId}_${playerId}`);

            return await this.makeRequest<AIRecommendations>(
                'get_ai_recommendations',
                { gameId, playerId },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting AI recommendations:', error);
            throw error;
        }
    }

    /**
     * Get real-time move suggestions
     */
    public async getMoveSuggestions(
        boardState: string[][],
        currentPlayer: 'player' | 'ai',
        difficulty: string
    ): Promise<any> {
        try {
            const boardHash = JSON.stringify(boardState);
            const cacheKey = this.getCacheKey('move_suggestions', `${boardHash}_${currentPlayer}_${difficulty}`);

            return await this.makeRequest<any>(
                'get_move_suggestions',
                { boardState, currentPlayer, difficulty },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting move suggestions:', error);
            throw error;
        }
    }

    /**
     * Get learning path recommendations
     */
    public async getLearningPath(playerId: string): Promise<any> {
        try {
            const cacheKey = this.getCacheKey('learning_path', playerId);

            return await this.makeRequest<any>(
                'get_learning_path',
                { playerId },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting learning path:', error);
            throw error;
        }
    }

    /**
     * Get AI personality insights
     */
    public async getAIPersonalityInsights(aiLevel: string): Promise<any> {
        try {
            const cacheKey = this.getCacheKey('ai_personality', aiLevel);

            return await this.makeRequest<any>(
                'get_ai_personality_insights',
                { aiLevel },
                cacheKey
            );
        } catch (error) {
            console.error('🚨 Error getting AI personality insights:', error);
            throw error;
        }
    }

    /**
     * Clear insights cache
     */
    public clearCache(): void {
        this.cache.clear();
        console.log('🗑️ AI Insights cache cleared');
    }

    /**
     * Update insights configuration
     */
    public updateConfig(newConfig: Partial<AIInsightsConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ AI Insights configuration updated:', this.config);
    }

    /**
     * Get current insights configuration
     */
    public getConfig(): AIInsightsConfig {
        return { ...this.config };
    }

    /**
     * Get insights manager status
     */
    public getStatus(): any {
        return {
            isInitialized: this.isInitialized,
            cacheSize: this.cache.size,
            requestQueueSize: this.requestQueue.size,
            config: this.config,
        };
    }

    /**
     * Cleanup resources
     */
    public destroy(): void {
        this.cache.clear();
        this.requestQueue.clear();
        console.log('🧹 AI Insights Manager destroyed');
    }
}

// Create singleton instance
const aiInsightsManager = new AIInsightsManager({
    enableExplanations: appConfig.ai.explanationsEnabled,
    enableAnalysis: appConfig.ai.realTimeAnalysis,
    enableRecommendations: appConfig.ai.recommendationsEnabled,
    enableCaching: appConfig.enterprise.mode,
    enableRealTime: appConfig.ai.realTimeAnalysis,
    detailLevel: appConfig.enterprise.mode ? 'expert' : 'detailed',
});

// Export enhanced functions
export const getMoveExplanation = (
    gameId: string,
    move: number,
    player: 'player' | 'ai'
): Promise<MoveExplanation> => aiInsightsManager.getMoveExplanation(gameId, move, player);

export const getGameAnalysis = (gameId: string, playerId: string): Promise<GameAnalysis> =>
    aiInsightsManager.getGameAnalysis(gameId, playerId);

export const getStrategicInsights = (
    boardState: string[][],
    currentPlayer: 'player' | 'ai'
): Promise<StrategicInsights> => aiInsightsManager.getStrategicInsights(boardState, currentPlayer);

export const getPlayerStyleAnalysis = (playerId: string): Promise<PlayerStyleAnalysis> =>
    aiInsightsManager.getPlayerStyleAnalysis(playerId);

export const getAIRecommendations = (gameId: string, playerId: string): Promise<AIRecommendations> =>
    aiInsightsManager.getAIRecommendations(gameId, playerId);

export const getMoveSuggestions = (
    boardState: string[][],
    currentPlayer: 'player' | 'ai',
    difficulty: string
): Promise<any> => aiInsightsManager.getMoveSuggestions(boardState, currentPlayer, difficulty);

export const getLearningPath = (playerId: string): Promise<any> =>
    aiInsightsManager.getLearningPath(playerId);

export const getAIPersonalityInsights = (aiLevel: string): Promise<any> =>
    aiInsightsManager.getAIPersonalityInsights(aiLevel);

export const clearInsightsCache = (): void =>
    aiInsightsManager.clearCache();

export const updateInsightsConfig = (config: Partial<AIInsightsConfig>): void =>
    aiInsightsManager.updateConfig(config);

export const getInsightsConfig = (): AIInsightsConfig =>
    aiInsightsManager.getConfig();

export const getInsightsStatus = (): any =>
    aiInsightsManager.getStatus();

export const destroyInsights = (): void =>
    aiInsightsManager.destroy();

// Types are already exported individually above
export default aiInsightsManager; 