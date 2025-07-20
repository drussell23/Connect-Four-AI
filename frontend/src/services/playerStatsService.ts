// frontend/src/services/playerStatsService.ts
import { PlayerPerformance, WinRateAnalysis, Achievement } from '../api/analytics';

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
    private stats: Map<string, PlayerPerformance> = new Map();
    private winRateData: Map<string, WinRateAnalysis> = new Map();

    constructor() {
        // Initialize with mock data
        this.stats.set('demo-user', mockPlayerStats);
        this.winRateData.set('demo-user', mockWinRateData);
    }

    async getPlayerPerformance(playerId: string): Promise<PlayerPerformance> {
        // In a real app, this would fetch from API/database
        // For now, return mock data or create new player stats
        if (this.stats.has(playerId)) {
            return this.stats.get(playerId)!;
        }

        // Create new player stats
        const newPlayerStats: PlayerPerformance = {
            playerId,
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            averageGameDuration: 0,
            averageMovesPerGame: 0,
            bestWinStreak: 0,
            currentStreak: 0,
            totalPlayTime: 0,
            skillLevel: 'beginner',
            improvementRate: 0,
            lastPlayed: new Date(),
            achievements: [],
            preferredGameMode: 'classic',
            averageMoveTime: 0,
            accuracyRate: 0
        };

        this.stats.set(playerId, newPlayerStats);
        return newPlayerStats;
    }

    async getWinRateAnalysis(playerId: string, timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'week'): Promise<WinRateAnalysis> {
        // In a real app, this would fetch from API/database
        if (this.winRateData.has(playerId)) {
            const data = this.winRateData.get(playerId)!;
            return { ...data, timeframe };
        }

        // Return empty win rate data
        return {
            timeframe,
            data: [],
            trends: {
                overallTrend: 'stable',
                recentPerformance: 0,
                bestPeriod: '',
                worstPeriod: ''
            }
        };
    }

    async updatePlayerStats(playerId: string, gameResult: 'win' | 'loss' | 'draw', gameData: {
        duration: number;
        moveCount: number;
        averageMoveTime: number;
        accuracyRate: number;
    }): Promise<void> {
        const stats = await this.getPlayerPerformance(playerId);

        // Update basic stats
        stats.totalGames++;
        if (gameResult === 'win') {
            stats.wins++;
            stats.currentStreak++;
            if (stats.currentStreak > stats.bestWinStreak) {
                stats.bestWinStreak = stats.currentStreak;
            }
        } else if (gameResult === 'loss') {
            stats.losses++;
            stats.currentStreak = 0;
        } else {
            stats.draws++;
            stats.currentStreak = 0;
        }

        // Update calculated stats
        stats.winRate = (stats.wins / stats.totalGames) * 100;
        stats.totalPlayTime += gameData.duration;
        stats.averageGameDuration = stats.totalPlayTime / stats.totalGames;
        stats.averageMovesPerGame = ((stats.averageMovesPerGame * (stats.totalGames - 1)) + gameData.moveCount) / stats.totalGames;
        stats.averageMoveTime = ((stats.averageMoveTime * (stats.totalGames - 1)) + gameData.averageMoveTime) / stats.totalGames;
        stats.accuracyRate = ((stats.accuracyRate * (stats.totalGames - 1)) + gameData.accuracyRate) / stats.totalGames;
        stats.lastPlayed = new Date();

        // Update skill level based on win rate
        if (stats.winRate >= 70) stats.skillLevel = 'expert';
        else if (stats.winRate >= 50) stats.skillLevel = 'advanced';
        else if (stats.winRate >= 30) stats.skillLevel = 'intermediate';
        else stats.skillLevel = 'beginner';

        // Calculate improvement rate (simplified)
        stats.improvementRate = Math.min(1, stats.winRate / 100);

        // Save updated stats
        this.stats.set(playerId, stats);
    }

    async addAchievement(playerId: string, achievement: Achievement): Promise<void> {
        const stats = await this.getPlayerPerformance(playerId);
        const existingAchievement = stats.achievements.find(a => a.id === achievement.id);

        if (!existingAchievement) {
            stats.achievements.push(achievement);
            this.stats.set(playerId, stats);
        }
    }

    async getPlayerStats(playerId: string): Promise<PlayerPerformance> {
        return this.getPlayerPerformance(playerId);
    }

    async resetPlayerStats(playerId: string): Promise<void> {
        this.stats.delete(playerId);
        this.winRateData.delete(playerId);
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