// frontend/src/api/analytics.ts
import { appConfig } from '../config/environment';
import { getConnectionStatus, emit, on, off } from './socket';

// Types for analytics functionality
export interface GameAnalytics {
    gameId: string;
    playerId: string;
    duration: number;
    moveCount: number;
    winner: 'player' | 'ai' | 'draw';
    playerMoves: number[];
    aiMoves: number[];
    playerMistakes: number;
    aiThreatsMissed: number;
    averageMoveTime: number;
    timestamp: Date;
    metadata: {
        aiLevel: string;
        playerSkill: string;
        gameMode: string;
        deviceType: string;
        sessionId: string;
    };
}

export interface PlayerPerformance {
    playerId: string;
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    averageGameDuration: number;
    averageMovesPerGame: number;
    bestWinStreak: number;
    currentStreak: number;
    totalPlayTime: number;
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    improvementRate: number;
    lastPlayed: Date;
    achievements: Achievement[];
    preferredGameMode: string;
    averageMoveTime: number;
    accuracyRate: number;
}

export interface AIEffectivenessMetrics {
    totalGames: number;
    winRate: number;
    averageResponseTime: number;
    moveQualityScore: number;
    threatDetectionRate: number;
    adaptationEffectiveness: number;
    modelVersion: string;
    lastUpdated: Date;
    performanceByLevel: {
        [level: string]: {
            games: number;
            winRate: number;
            averageResponseTime: number;
        };
    };
    errorRate: number;
    fallbackUsage: number;
}

export interface WinRateAnalysis {
    timeframe: 'day' | 'week' | 'month' | 'year' | 'all';
    data: {
        date: string;
        games: number;
        wins: number;
        losses: number;
        draws: number;
        winRate: number;
    }[];
    trends: {
        overallTrend: 'improving' | 'declining' | 'stable';
        recentPerformance: number;
        bestPeriod: string;
        worstPeriod: string;
    };
}

export interface MoveQualityMetrics {
    gameId: string;
    playerMoves: {
        move: number;
        quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
        score: number;
        alternativeMoves: number[];
        explanation: string;
    }[];
    aiMoves: {
        move: number;
        quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
        score: number;
        confidence: number;
        reasoning: string;
    }[];
    overallQuality: {
        playerScore: number;
        aiScore: number;
        gameQuality: 'high' | 'medium' | 'low';
    };
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: Date;
    progress: number;
    maxProgress: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface AnalyticsConfig {
    enableTracking: boolean;
    enableRealTime: boolean;
    enableCaching: boolean;
    cacheExpiry: number;
    batchSize: number;
    flushInterval: number;
    enablePrivacy: boolean;
    anonymizeData: boolean;
}

// Default configuration
const DEFAULT_CONFIG: AnalyticsConfig = {
    enableTracking: true,
    enableRealTime: true,
    enableCaching: true,
    cacheExpiry: 300000, // 5 minutes
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    enablePrivacy: true,
    anonymizeData: false,
};

// Enhanced Analytics Manager Class
class AnalyticsManager {
    private config: AnalyticsConfig;
    private cache: Map<string, any> = new Map();
    private eventQueue: GameAnalytics[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isInitialized: boolean = false;
    private sessionId: string;
    private deviceInfo: any;

    constructor(config: Partial<AnalyticsConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.sessionId = this.generateSessionId();
        this.deviceInfo = this.getDeviceInfo();
        this.initialize();
    }

    private initialize(): void {
        if (this.isInitialized) return;

        console.log('📊 Initializing Analytics Manager');
        console.log('🔧 Configuration:', this.config);

        // Setup event listeners
        this.setupEventListeners();

        // Start flush timer if real-time is enabled
        if (this.config.enableRealTime) {
            this.startFlushTimer();
        }

        this.isInitialized = true;
        console.log('✅ Analytics Manager initialized');
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getDeviceInfo(): any {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString(),
        };
    }

    private setupEventListeners(): void {
        // Listen for game events
        on('gameCreated', (data: any) => {
            this.trackGameEvent('game_created', data);
        });

        on('gameOver', (data: any) => {
            this.trackGameEvent('game_over', data);
        });

        on('playerMove', (data: any) => {
            this.trackGameEvent('player_move', data);
        });

        on('aiMove', (data: any) => {
            this.trackGameEvent('ai_move', data);
        });

        on('aiThinking', (data: any) => {
            this.trackGameEvent('ai_thinking', data);
        });

        // Listen for connection status changes
        on('connect', () => {
            this.trackSystemEvent('connection_established');
        });

        on('disconnect', () => {
            this.trackSystemEvent('connection_lost');
        });
    }

    private startFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(() => {
            this.flushEventQueue();
        }, this.config.flushInterval);
    }

    private trackGameEvent(eventType: string, data: any): void {
        if (!this.config.enableTracking) return;

        const event = {
            type: eventType,
            data,
            timestamp: new Date(),
            sessionId: this.sessionId,
            deviceInfo: this.deviceInfo,
        };

        this.addToQueue(event);
    }

    private trackSystemEvent(eventType: string): void {
        if (!this.config.enableTracking) return;

        const event = {
            type: eventType,
            timestamp: new Date(),
            sessionId: this.sessionId,
            deviceInfo: this.deviceInfo,
        };

        this.addToQueue(event);
    }

    private addToQueue(event: any): void {
        this.eventQueue.push(event);

        if (this.eventQueue.length >= this.config.batchSize) {
            this.flushEventQueue();
        }
    }

    private async flushEventQueue(): Promise<void> {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            await this.sendAnalyticsBatch(events);
            console.log(`📊 Flushed ${events.length} analytics events`);
        } catch (error) {
            console.error('🚨 Error flushing analytics events:', error);
            // Re-add events to queue for retry
            this.eventQueue.unshift(...events);
        }
    }

    private async sendAnalyticsBatch(events: any[]): Promise<void> {
        const payload = {
            events,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        };

        emit('analytics_batch', payload);
    }

    // Public API Methods

    /**
     * Track a complete game analytics
     */
    public async trackGameAnalytics(analytics: GameAnalytics): Promise<void> {
        if (!this.config.enableTracking) return;

        try {
            // Add session and device info
            const enrichedAnalytics = {
                ...analytics,
                sessionId: this.sessionId,
                deviceInfo: this.deviceInfo,
                timestamp: new Date(),
            };

            // Cache for quick access
            if (this.config.enableCaching) {
                this.cache.set(`game_${analytics.gameId}`, enrichedAnalytics);
            }

            // Send to backend
            emit('track_game_analytics', enrichedAnalytics);

            console.log(`📊 Tracked game analytics for game: ${analytics.gameId}`);
        } catch (error) {
            console.error('🚨 Error tracking game analytics:', error);
        }
    }

    /**
     * Get player performance analytics
     */
    public async getPlayerPerformance(playerId: string): Promise<PlayerPerformance> {
        try {
            // Check cache first
            const cacheKey = `player_performance_${playerId}`;
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
                return cached.data;
            }

            // Request from backend
            return new Promise((resolve, reject) => {
                emit('get_player_performance', { playerId }, (response: any) => {
                    if (response.success) {
                        const data = response.data;

                        // Cache the result
                        if (this.config.enableCaching) {
                            this.cache.set(cacheKey, {
                                data,
                                timestamp: Date.now(),
                            });
                        }

                        resolve(data);
                    } else {
                        reject(new Error(response.error || 'Failed to get player performance'));
                    }
                });
            });
        } catch (error) {
            console.error('🚨 Error getting player performance:', error);
            throw error;
        }
    }

    /**
     * Get AI effectiveness metrics
     */
    public async getAIEffectivenessMetrics(): Promise<AIEffectivenessMetrics> {
        try {
            const cacheKey = 'ai_effectiveness_metrics';
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
                return cached.data;
            }

            return new Promise((resolve, reject) => {
                emit('get_ai_effectiveness_metrics', {}, (response: any) => {
                    if (response.success) {
                        const data = response.data;

                        if (this.config.enableCaching) {
                            this.cache.set(cacheKey, {
                                data,
                                timestamp: Date.now(),
                            });
                        }

                        resolve(data);
                    } else {
                        reject(new Error(response.error || 'Failed to get AI effectiveness metrics'));
                    }
                });
            });
        } catch (error) {
            console.error('🚨 Error getting AI effectiveness metrics:', error);
            throw error;
        }
    }

    /**
     * Get win rate analysis for a specific timeframe
     */
    public async getWinRateAnalysis(timeframe: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<WinRateAnalysis> {
        try {
            const cacheKey = `win_rate_analysis_${timeframe}`;
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
                return cached.data;
            }

            return new Promise((resolve, reject) => {
                emit('get_win_rate_analysis', { timeframe }, (response: any) => {
                    if (response.success) {
                        const data = response.data;

                        if (this.config.enableCaching) {
                            this.cache.set(cacheKey, {
                                data,
                                timestamp: Date.now(),
                            });
                        }

                        resolve(data);
                    } else {
                        reject(new Error(response.error || 'Failed to get win rate analysis'));
                    }
                });
            });
        } catch (error) {
            console.error('🚨 Error getting win rate analysis:', error);
            throw error;
        }
    }

    /**
     * Get move quality metrics for a specific game
     */
    public async getMoveQualityMetrics(gameId: string): Promise<MoveQualityMetrics> {
        try {
            const cacheKey = `move_quality_${gameId}`;
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
                return cached.data;
            }

            return new Promise((resolve, reject) => {
                emit('get_move_quality_metrics', { gameId }, (response: any) => {
                    if (response.success) {
                        const data = response.data;

                        if (this.config.enableCaching) {
                            this.cache.set(cacheKey, {
                                data,
                                timestamp: Date.now(),
                            });
                        }

                        resolve(data);
                    } else {
                        reject(new Error(response.error || 'Failed to get move quality metrics'));
                    }
                });
            });
        } catch (error) {
            console.error('🚨 Error getting move quality metrics:', error);
            throw error;
        }
    }

    /**
     * Get real-time analytics dashboard data
     */
    public async getRealTimeAnalytics(): Promise<any> {
        try {
            return new Promise((resolve, reject) => {
                emit('get_real_time_analytics', {}, (response: any) => {
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error || 'Failed to get real-time analytics'));
                    }
                });
            });
        } catch (error) {
            console.error('🚨 Error getting real-time analytics:', error);
            throw error;
        }
    }

    /**
     * Clear analytics cache
     */
    public clearCache(): void {
        this.cache.clear();
        console.log('🗑️ Analytics cache cleared');
    }

    /**
     * Update analytics configuration
     */
    public updateConfig(newConfig: Partial<AnalyticsConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Analytics configuration updated:', this.config);
    }

    /**
     * Get current analytics configuration
     */
    public getConfig(): AnalyticsConfig {
        return { ...this.config };
    }

    /**
     * Get analytics session info
     */
    public getSessionInfo(): any {
        return {
            sessionId: this.sessionId,
            deviceInfo: this.deviceInfo,
            isInitialized: this.isInitialized,
            queueSize: this.eventQueue.length,
            cacheSize: this.cache.size,
        };
    }

    /**
     * Cleanup resources
     */
    public destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }

        this.flushEventQueue();
        this.cache.clear();
        this.eventQueue = [];

        console.log('🧹 Analytics Manager destroyed');
    }
}

// Create singleton instance
const analyticsManager = new AnalyticsManager({
    enableTracking: appConfig.analytics.enabled,
    enableRealTime: appConfig.enterprise.performanceMonitoring,
    enableCaching: appConfig.enterprise.mode,
    enablePrivacy: appConfig.analytics.userTracking,
});

// Export enhanced functions
export const trackGameAnalytics = (analytics: GameAnalytics): Promise<void> =>
    analyticsManager.trackGameAnalytics(analytics);

export const getPlayerPerformance = (playerId: string): Promise<PlayerPerformance> =>
    analyticsManager.getPlayerPerformance(playerId);

export const getAIEffectivenessMetrics = (): Promise<AIEffectivenessMetrics> =>
    analyticsManager.getAIEffectivenessMetrics();

export const getWinRateAnalysis = (timeframe: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<WinRateAnalysis> =>
    analyticsManager.getWinRateAnalysis(timeframe);

export const getMoveQualityMetrics = (gameId: string): Promise<MoveQualityMetrics> =>
    analyticsManager.getMoveQualityMetrics(gameId);

export const getRealTimeAnalytics = (): Promise<any> =>
    analyticsManager.getRealTimeAnalytics();

export const clearAnalyticsCache = (): void =>
    analyticsManager.clearCache();

export const updateAnalyticsConfig = (config: Partial<AnalyticsConfig>): void =>
    analyticsManager.updateConfig(config);

export const getAnalyticsConfig = (): AnalyticsConfig =>
    analyticsManager.getConfig();

export const getAnalyticsSessionInfo = (): any =>
    analyticsManager.getSessionInfo();

export const destroyAnalytics = (): void =>
    analyticsManager.destroy();

