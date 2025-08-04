// frontend/src/services/playerStatsService.ts
import { PlayerPerformance, WinRateAnalysis, Achievement } from '../api/analytics';
import { statsTracker } from './StatsTracker';

// Mock data for development
const mockPlayerStats: PlayerPerformance = {
    playerId: 'demo-user',
    totalGames: 47,
    wins: 23,
    losses: 18,
    draws: 6,
    winRate: 48.9,
    averageGameDuration: 45000, // 45 seconds
    averageMovesPerGame: 28,
    bestWinStreak: 5,
    currentStreak: 2,
    totalPlayTime: 3600000, // 60 minutes
    skillLevel: 'intermediate',
    improvementRate: 0.15,
    lastPlayed: new Date(),
    achievements: [
        {
            id: 'first-win',
            name: 'First Victory',
            description: 'Win your first game against AI',
            icon: '🏆',
            unlockedAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
            progress: 1,
            maxProgress: 1,
            rarity: 'common'
        },
        {
            id: 'win-streak-3',
            name: 'Hot Streak',
            description: 'Win 3 games in a row',
            icon: '🔥',
            unlockedAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
            progress: 3,
            maxProgress: 3,
            rarity: 'rare'
        },
        {
            id: 'ai-master',
            name: 'AI Challenger',
            description: 'Win against AI level 5 or higher',
            icon: '🤖',
            unlockedAt: new Date(Date.now() - 86400000), // 1 day ago
            progress: 1,
            maxProgress: 1,
            rarity: 'epic'
        },
        {
            id: 'quick-win',
            name: 'Speed Demon',
            description: 'Win a game in under 30 seconds',
            icon: '⚡',
            unlockedAt: new Date(),
            progress: 1,
            maxProgress: 1,
            rarity: 'rare'
        }
    ],
    preferredGameMode: 'classic',
    averageMoveTime: 2000, // 2 seconds
    accuracyRate: 72.5
};

const mockWinRateData: WinRateAnalysis = {
    timeframe: 'week',
    data: [
        { date: '2024-01-15', games: 5, wins: 3, losses: 2, draws: 0, winRate: 60 },
        { date: '2024-01-16', games: 3, wins: 1, losses: 2, draws: 0, winRate: 33.3 },
        { date: '2024-01-17', games: 4, wins: 2, losses: 1, draws: 1, winRate: 50 },
        { date: '2024-01-18', games: 6, wins: 4, losses: 1, draws: 1, winRate: 66.7 },
        { date: '2024-01-19', games: 2, wins: 1, losses: 1, draws: 0, winRate: 50 },
        { date: '2024-01-20', games: 7, wins: 3, losses: 3, draws: 1, winRate: 42.9 },
        { date: '2024-01-21', games: 4, wins: 2, losses: 1, draws: 1, winRate: 50 }
    ],
    trends: {
        overallTrend: 'improving',
        recentPerformance: 52.3,
        bestPeriod: '2024-01-18',
        worstPeriod: '2024-01-16'
    }
};

class PlayerStatsService {
    async getPlayerPerformance(playerId: string): Promise<PlayerPerformance> {
        // Get real stats from StatsTracker
        const stats = statsTracker.getStats();
        
        // If no games played yet, return default stats with some mock achievements
        if (stats.totalGames === 0) {
            return {
                ...stats,
                playerId,
                achievements: [
                    {
                        id: 'welcome',
                        name: 'Welcome!',
                        description: 'Start your Connect Four journey',
                        icon: '👋',
                        unlockedAt: new Date(),
                        progress: 1,
                        maxProgress: 1,
                        rarity: 'common'
                    }
                ]
            };
        }
        
        return {
            ...stats,
            playerId
        };
    }

    async getWinRateAnalysis(playerId: string, timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'week'): Promise<WinRateAnalysis> {
        // Get real win rate analysis from StatsTracker
        const analysis = statsTracker.getWinRateAnalysis(
            timeframe as 'week' | 'month' | 'year'
        );
        
        // If no data, return with sample data for visualization
        if (analysis.data.length === 0) {
            // Generate sample data for the last 7 days
            const sampleData = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                sampleData.push({
                    date: date.toISOString().split('T')[0],
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0
                });
            }
            
            return {
                timeframe,
                data: sampleData,
                trends: {
                    overallTrend: 'stable',
                    recentPerformance: 0,
                    bestPeriod: '',
                    worstPeriod: ''
                }
            };
        }
        
        return analysis;
    }

    async updatePlayerStats(playerId: string, gameResult: 'win' | 'loss' | 'draw', gameData: {
        duration: number;
        moveCount: number;
        averageMoveTime: number;
        accuracyRate: number;
    }): Promise<void> {
        // Stats are now updated through StatsTracker.endSession()
        // This method is kept for backward compatibility
        console.log('Stats update handled by StatsTracker');
    }

    async addAchievement(playerId: string, achievement: Achievement): Promise<void> {
        // Achievements are now handled by StatsTracker
        console.log('Achievements handled by StatsTracker');
    }

    async getPlayerStats(playerId: string): Promise<PlayerPerformance> {
        return this.getPlayerPerformance(playerId);
    }

    async resetPlayerStats(playerId: string): Promise<void> {
        // Reset stats through StatsTracker
        statsTracker.resetStats();
    }
}

// Export singleton instance
export const playerStatsService = new PlayerStatsService();

// Export functions for easy use
export const getPlayerStats = (playerId: string): Promise<PlayerPerformance> =>
  playerStatsService.getPlayerStats(playerId);

export const getWinRateAnalysis = (playerId: string, timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'week'): Promise<WinRateAnalysis> =>
  playerStatsService.getWinRateAnalysis(playerId, timeframe);

export const updatePlayerStats = (playerId: string, gameResult: 'win' | 'loss' | 'draw', gameData: any): Promise<void> =>
  playerStatsService.updatePlayerStats(playerId, gameResult, gameData);

export const addAchievement = (playerId: string, achievement: Achievement): Promise<void> =>
  playerStatsService.addAchievement(playerId, achievement);

export const resetPlayerStats = (playerId: string): Promise<void> =>
  playerStatsService.resetPlayerStats(playerId); 