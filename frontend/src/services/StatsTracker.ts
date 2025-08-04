/**
 * StatsTracker Service
 * Real-time game statistics tracking with localStorage persistence
 */

import { PlayerPerformance, WinRateAnalysis, Achievement } from '../api/analytics';

export interface GameSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  moves: Array<{
    column: number;
    player: 'Red' | 'Yellow';
    timestamp: number;
    thinkTime: number;
  }>;
  result?: 'win' | 'loss' | 'draw';
  opponent: 'AI' | 'Human';
  aiDifficulty?: number;
  boardStates: string[];
  accurateMoves: number;
  totalMoves: number;
}

export interface DetailedStats extends PlayerPerformance {
  dailyStats: Map<string, DailyStats>;
  weeklyStats: Map<string, WeeklyStats>;
  gameHistory: GameSession[];
  moveTimes: number[];
  winsByDifficulty: Map<number, { wins: number; losses: number; draws: number }>;
  timeOfDayPerformance: Map<number, { wins: number; losses: number }>;
  streakHistory: Array<{ value: number; date: Date }>;
}

interface DailyStats {
  date: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  totalPlayTime: number;
  averageMoveTime: number;
}

interface WeeklyStats {
  weekStart: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  improvementFromPrevious: number;
}

class StatsTracker {
  private static instance: StatsTracker;
  private currentSession: GameSession | null = null;
  private stats: DetailedStats;
  private readonly STORAGE_KEY = 'connectfour_player_stats';
  private readonly SESSION_STORAGE_KEY = 'connectfour_current_session';
  private readonly HISTORY_LIMIT = 100;
  private moveStartTime: number = 0;

  private constructor() {
    // Don't load from localStorage - always start fresh
    this.stats = this.createEmptyStats();
    // Don't restore session - start clean
    console.log('📊 Starting with fresh stats (all zeros)');
  }

  static getInstance(): StatsTracker {
    if (!StatsTracker.instance) {
      StatsTracker.instance = new StatsTracker();
    }
    return StatsTracker.instance;
  }

  /**
   * Start a new game session
   */
  startSession(opponent: 'AI' | 'Human', aiDifficulty?: number): void {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      moves: [],
      opponent,
      aiDifficulty,
      boardStates: [],
      accurateMoves: 0,
      totalMoves: 0
    };
    this.saveSession();
  }

  /**
   * Record a move
   */
  recordMove(column: number, player: 'Red' | 'Yellow', boardState: string): void {
    if (!this.currentSession) return;

    const thinkTime = this.moveStartTime ? Date.now() - this.moveStartTime : 0;
    
    this.currentSession.moves.push({
      column,
      player,
      timestamp: Date.now(),
      thinkTime
    });

    this.currentSession.boardStates.push(boardState);
    this.currentSession.totalMoves++;

    // Update move times for player moves only
    if (player === 'Red') {
      this.stats.moveTimes.push(thinkTime);
      // Keep only last 1000 move times
      if (this.stats.moveTimes.length > 1000) {
        this.stats.moveTimes.shift();
      }
    }

    this.saveSession();
    this.moveStartTime = Date.now();
  }

  /**
   * Mark a move as accurate (good strategic move)
   */
  markMoveAccurate(): void {
    if (!this.currentSession) return;
    this.currentSession.accurateMoves++;
  }

  /**
   * End the current game session
   */
  endSession(result: 'win' | 'loss' | 'draw'): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.result = result;

    // Update stats
    this.updateStats(this.currentSession);

    // Add to game history
    this.stats.gameHistory.push(this.currentSession);
    
    // Limit history size
    if (this.stats.gameHistory.length > this.HISTORY_LIMIT) {
      this.stats.gameHistory.shift();
    }

    // Check for achievements
    this.checkAchievements(result);

    // Save everything
    this.saveStats();
    
    // Clear current session
    this.currentSession = null;
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }

  /**
   * Update player statistics
   */
  private updateStats(session: GameSession): void {
    const duration = session.endTime!.getTime() - session.startTime.getTime();
    const playerMoves = session.moves.filter(m => m.player === 'Red');
    const avgMoveTime = playerMoves.reduce((sum, m) => sum + m.thinkTime, 0) / (playerMoves.length || 1);

    // Update basic stats
    this.stats.totalGames++;
    
    if (session.result === 'win') {
      this.stats.wins++;
      this.stats.currentStreak++;
      if (this.stats.currentStreak > this.stats.bestWinStreak) {
        this.stats.bestWinStreak = this.stats.currentStreak;
      }
      
      // Track wins by difficulty
      if (session.aiDifficulty !== undefined) {
        const diffStats = this.stats.winsByDifficulty.get(session.aiDifficulty) || 
          { wins: 0, losses: 0, draws: 0 };
        diffStats.wins++;
        this.stats.winsByDifficulty.set(session.aiDifficulty, diffStats);
      }
    } else if (session.result === 'loss') {
      this.stats.losses++;
      this.stats.currentStreak = 0;
      
      if (session.aiDifficulty !== undefined) {
        const diffStats = this.stats.winsByDifficulty.get(session.aiDifficulty) || 
          { wins: 0, losses: 0, draws: 0 };
        diffStats.losses++;
        this.stats.winsByDifficulty.set(session.aiDifficulty, diffStats);
      }
    } else {
      this.stats.draws++;
      this.stats.currentStreak = 0;
      
      if (session.aiDifficulty !== undefined) {
        const diffStats = this.stats.winsByDifficulty.get(session.aiDifficulty) || 
          { wins: 0, losses: 0, draws: 0 };
        diffStats.draws++;
        this.stats.winsByDifficulty.set(session.aiDifficulty, diffStats);
      }
    }

    // Track streak history
    this.stats.streakHistory.push({
      value: this.stats.currentStreak,
      date: new Date()
    });

    // Update calculated stats
    this.stats.winRate = this.stats.totalGames > 0 
      ? (this.stats.wins / this.stats.totalGames) * 100 
      : 0;
    
    this.stats.totalPlayTime += duration;
    this.stats.averageGameDuration = this.stats.totalPlayTime / this.stats.totalGames;
    
    this.stats.averageMovesPerGame = 
      ((this.stats.averageMovesPerGame * (this.stats.totalGames - 1)) + playerMoves.length) / 
      this.stats.totalGames;
    
    this.stats.averageMoveTime = 
      ((this.stats.averageMoveTime * (this.stats.totalGames - 1)) + avgMoveTime) / 
      this.stats.totalGames;
    
    const accuracyRate = session.totalMoves > 0 
      ? (session.accurateMoves / session.totalMoves) * 100 
      : 0;
    
    this.stats.accuracyRate = 
      ((this.stats.accuracyRate * (this.stats.totalGames - 1)) + accuracyRate) / 
      this.stats.totalGames;
    
    this.stats.lastPlayed = new Date();

    // Update skill level
    this.updateSkillLevel();

    // Update daily stats
    this.updateDailyStats(session);

    // Update weekly stats
    this.updateWeeklyStats();

    // Update time of day performance
    this.updateTimeOfDayPerformance(session);
  }

  /**
   * Update skill level based on performance
   */
  private updateSkillLevel(): void {
    const recentGames = this.stats.gameHistory.slice(-20);
    const recentWinRate = recentGames.length > 0
      ? (recentGames.filter(g => g.result === 'win').length / recentGames.length) * 100
      : 0;

    // Consider both overall and recent performance
    const weightedWinRate = (this.stats.winRate * 0.4) + (recentWinRate * 0.6);

    if (weightedWinRate >= 70 && this.stats.averageMoveTime < 3000) {
      this.stats.skillLevel = 'expert';
    } else if (weightedWinRate >= 50) {
      this.stats.skillLevel = 'advanced';
    } else if (weightedWinRate >= 30) {
      this.stats.skillLevel = 'intermediate';
    } else {
      this.stats.skillLevel = 'beginner';
    }

    // Calculate improvement rate
    const oldGames = this.stats.gameHistory.slice(0, 10);
    const oldWinRate = oldGames.length > 0
      ? (oldGames.filter(g => g.result === 'win').length / oldGames.length)
      : 0;
    
    this.stats.improvementRate = Math.max(0, Math.min(1, (recentWinRate / 100) - oldWinRate));
  }

  /**
   * Update daily statistics
   */
  private updateDailyStats(session: GameSession): void {
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = this.stats.dailyStats.get(today) || {
      date: today,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalPlayTime: 0,
      averageMoveTime: 0
    };

    dailyStats.games++;
    if (session.result === 'win') dailyStats.wins++;
    else if (session.result === 'loss') dailyStats.losses++;
    else dailyStats.draws++;

    const duration = session.endTime!.getTime() - session.startTime.getTime();
    dailyStats.totalPlayTime += duration;

    const playerMoves = session.moves.filter(m => m.player === 'Red');
    const avgMoveTime = playerMoves.reduce((sum, m) => sum + m.thinkTime, 0) / (playerMoves.length || 1);
    dailyStats.averageMoveTime = 
      ((dailyStats.averageMoveTime * (dailyStats.games - 1)) + avgMoveTime) / dailyStats.games;

    this.stats.dailyStats.set(today, dailyStats);

    // Keep only last 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    for (const [date, _] of this.stats.dailyStats) {
      if (date < cutoffString) {
        this.stats.dailyStats.delete(date);
      }
    }
  }

  /**
   * Update weekly statistics
   */
  private updateWeeklyStats(): void {
    const weekStart = this.getWeekStart(new Date());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    let weekStats: WeeklyStats = {
      weekStart: weekKey,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      improvementFromPrevious: 0
    };

    // Aggregate daily stats for current week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    for (const [date, daily] of this.stats.dailyStats) {
      const dateObj = new Date(date);
      if (dateObj >= weekStart && dateObj < weekEnd) {
        weekStats.games += daily.games;
        weekStats.wins += daily.wins;
        weekStats.losses += daily.losses;
        weekStats.draws += daily.draws;
      }
    }

    weekStats.winRate = weekStats.games > 0 
      ? (weekStats.wins / weekStats.games) * 100 
      : 0;

    // Calculate improvement from previous week
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevWeekKey = prevWeek.toISOString().split('T')[0];
    const prevWeekStats = this.stats.weeklyStats.get(prevWeekKey);
    
    if (prevWeekStats) {
      weekStats.improvementFromPrevious = weekStats.winRate - prevWeekStats.winRate;
    }

    this.stats.weeklyStats.set(weekKey, weekStats);

    // Keep only last 12 weeks
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 84);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    for (const [date, _] of this.stats.weeklyStats) {
      if (date < cutoffString) {
        this.stats.weeklyStats.delete(date);
      }
    }
  }

  /**
   * Update time of day performance
   */
  private updateTimeOfDayPerformance(session: GameSession): void {
    const hour = new Date().getHours();
    const hourStats = this.stats.timeOfDayPerformance.get(hour) || { wins: 0, losses: 0 };
    
    if (session.result === 'win') {
      hourStats.wins++;
    } else if (session.result === 'loss') {
      hourStats.losses++;
    }
    
    this.stats.timeOfDayPerformance.set(hour, hourStats);
  }

  /**
   * Check and award achievements
   */
  private checkAchievements(result: 'win' | 'loss' | 'draw'): void {
    const achievements = this.stats.achievements;

    // First Win
    if (result === 'win' && this.stats.wins === 1) {
      this.addAchievement({
        id: 'first-win',
        name: 'First Victory',
        description: 'Win your first game',
        icon: '🏆',
        unlockedAt: new Date(),
        progress: 1,
        maxProgress: 1,
        rarity: 'common'
      });
    }

    // Win Streaks
    if (this.stats.currentStreak === 3) {
      this.addAchievement({
        id: 'streak-3',
        name: 'Hot Streak',
        description: 'Win 3 games in a row',
        icon: '🔥',
        unlockedAt: new Date(),
        progress: 3,
        maxProgress: 3,
        rarity: 'rare'
      });
    }

    if (this.stats.currentStreak === 5) {
      this.addAchievement({
        id: 'streak-5',
        name: 'On Fire',
        description: 'Win 5 games in a row',
        icon: '🔥🔥',
        unlockedAt: new Date(),
        progress: 5,
        maxProgress: 5,
        rarity: 'epic'
      });
    }

    if (this.stats.currentStreak === 10) {
      this.addAchievement({
        id: 'streak-10',
        name: 'Unstoppable',
        description: 'Win 10 games in a row',
        icon: '⚡',
        unlockedAt: new Date(),
        progress: 10,
        maxProgress: 10,
        rarity: 'legendary'
      });
    }

    // Total Games Milestones
    const gamesMilestones = [10, 25, 50, 100, 250, 500, 1000];
    for (const milestone of gamesMilestones) {
      if (this.stats.totalGames === milestone) {
        this.addAchievement({
          id: `games-${milestone}`,
          name: `${milestone} Games`,
          description: `Play ${milestone} games`,
          icon: '🎮',
          unlockedAt: new Date(),
          progress: milestone,
          maxProgress: milestone,
          rarity: milestone >= 500 ? 'legendary' : milestone >= 100 ? 'epic' : 'rare'
        });
      }
    }

    // Speed achievements
    if (this.currentSession) {
      const duration = (this.currentSession.endTime?.getTime() || Date.now()) - 
                      this.currentSession.startTime.getTime();
      
      if (result === 'win' && duration < 30000) {
        this.addAchievement({
          id: 'speed-demon',
          name: 'Speed Demon',
          description: 'Win a game in under 30 seconds',
          icon: '⚡',
          unlockedAt: new Date(),
          progress: 1,
          maxProgress: 1,
          rarity: 'epic'
        });
      }

      if (result === 'win' && duration < 60000) {
        this.addAchievement({
          id: 'quick-win',
          name: 'Quick Victory',
          description: 'Win a game in under 1 minute',
          icon: '⏱️',
          unlockedAt: new Date(),
          progress: 1,
          maxProgress: 1,
          rarity: 'rare'
        });
      }
    }

    // Perfect game (win with high accuracy)
    if (result === 'win' && this.currentSession && 
        this.currentSession.accurateMoves === this.currentSession.totalMoves) {
      this.addAchievement({
        id: 'perfect-game',
        name: 'Perfect Game',
        description: 'Win with 100% move accuracy',
        icon: '💯',
        unlockedAt: new Date(),
        progress: 1,
        maxProgress: 1,
        rarity: 'legendary'
      });
    }

    // AI difficulty achievements
    if (result === 'win' && this.currentSession?.aiDifficulty !== undefined) {
      const difficulty = this.currentSession.aiDifficulty;
      
      if (difficulty >= 20) {
        this.addAchievement({
          id: 'ai-challenger',
          name: 'AI Challenger',
          description: 'Beat AI on difficulty 20+',
          icon: '🤖',
          unlockedAt: new Date(),
          progress: 1,
          maxProgress: 1,
          rarity: 'rare'
        });
      }

      if (difficulty >= 50) {
        this.addAchievement({
          id: 'ai-master',
          name: 'AI Master',
          description: 'Beat AI on difficulty 50+',
          icon: '🧠',
          unlockedAt: new Date(),
          progress: 1,
          maxProgress: 1,
          rarity: 'epic'
        });
      }

      if (difficulty >= 80) {
        this.addAchievement({
          id: 'ai-grandmaster',
          name: 'AI Grandmaster',
          description: 'Beat AI on difficulty 80+',
          icon: '👑',
          unlockedAt: new Date(),
          progress: 1,
          maxProgress: 1,
          rarity: 'legendary'
        });
      }
    }
  }

  /**
   * Add achievement if not already earned
   */
  private addAchievement(achievement: Achievement): void {
    if (!this.stats.achievements.find(a => a.id === achievement.id)) {
      this.stats.achievements.push(achievement);
      // Could emit an event here for UI notification
      console.log(`🎉 Achievement Unlocked: ${achievement.name}`);
    }
  }

  /**
   * Get player statistics
   */
  getStats(): PlayerPerformance {
    return {
      playerId: 'player',
      totalGames: this.stats.totalGames,
      wins: this.stats.wins,
      losses: this.stats.losses,
      draws: this.stats.draws,
      winRate: this.stats.winRate,
      averageGameDuration: this.stats.averageGameDuration,
      averageMovesPerGame: this.stats.averageMovesPerGame,
      bestWinStreak: this.stats.bestWinStreak,
      currentStreak: this.stats.currentStreak,
      totalPlayTime: this.stats.totalPlayTime,
      skillLevel: this.stats.skillLevel,
      improvementRate: this.stats.improvementRate,
      lastPlayed: this.stats.lastPlayed,
      achievements: this.stats.achievements,
      preferredGameMode: this.stats.preferredGameMode,
      averageMoveTime: this.stats.averageMoveTime,
      accuracyRate: this.stats.accuracyRate
    };
  }

  /**
   * Get win rate analysis
   */
  getWinRateAnalysis(timeframe: 'week' | 'month' | 'year'): WinRateAnalysis {
    const data: any[] = [];
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    switch (timeframe) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Aggregate data by day
    for (const [date, daily] of this.stats.dailyStats) {
      const dateObj = new Date(date);
      if (dateObj >= startDate && dateObj <= endDate) {
        data.push({
          date,
          games: daily.games,
          wins: daily.wins,
          losses: daily.losses,
          draws: daily.draws,
          winRate: daily.games > 0 ? (daily.wins / daily.games) * 100 : 0
        });
      }
    }

    // Calculate trends
    const recentData = data.slice(-7);
    const recentWinRate = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.winRate, 0) / recentData.length
      : 0;

    const olderData = data.slice(0, Math.floor(data.length / 2));
    const olderWinRate = olderData.length > 0
      ? olderData.reduce((sum, d) => sum + d.winRate, 0) / olderData.length
      : 0;

    const trend = recentWinRate > olderWinRate + 5 ? 'improving' :
                  recentWinRate < olderWinRate - 5 ? 'declining' : 'stable';

    const bestDay = data.reduce((best, day) => 
      day.winRate > (best?.winRate || 0) ? day : best, data[0]);
    
    const worstDay = data.reduce((worst, day) => 
      day.winRate < (worst?.winRate || 100) ? day : worst, data[0]);

    return {
      timeframe,
      data,
      trends: {
        overallTrend: trend,
        recentPerformance: recentWinRate,
        bestPeriod: bestDay?.date || '',
        worstPeriod: worstDay?.date || ''
      }
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): DetailedStats {
    return this.stats;
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    console.log('🔄 Resetting all player statistics');
    
    // End current session if active
    if (this.currentSession && !this.currentSession.endTime) {
      this.currentSession = null;
      sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
    }
    
    // Clear all stats
    this.stats = this.createEmptyStats();
    
    // Clear from storage (though we don't use localStorage anymore)
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
    
    console.log('✅ Stats reset complete');
  }
  
  /**
   * Abandon current session without saving
   */
  abandonSession(): void {
    console.log('🚫 Abandoning current game session');
    this.currentSession = null;
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }

  /**
   * Helper methods
   */
  private loadStats(): DetailedStats {
    // Always return empty stats - no persistence
    return this.createEmptyStats();
  }

  private createEmptyStats(): DetailedStats {
    return {
      playerId: 'player',
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
      accuracyRate: 0,
      dailyStats: new Map(),
      weeklyStats: new Map(),
      gameHistory: [],
      moveTimes: [],
      winsByDifficulty: new Map(),
      timeOfDayPerformance: new Map(),
      streakHistory: []
    };
  }

  private saveStats(): void {
    // Don't save to localStorage - we want stats to reset each session
    console.log('📊 Stats updated (session only, not persisted)');
  }

  private saveSession(): void {
    if (this.currentSession) {
      sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));
    }
  }

  private restoreSession(): void {
    const stored = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
    if (stored) {
      try {
        this.currentSession = JSON.parse(stored);
        if (this.currentSession) {
          this.currentSession.startTime = new Date(this.currentSession.startTime);
          if (this.currentSession.endTime) {
            this.currentSession.endTime = new Date(this.currentSession.endTime);
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        this.currentSession = null;
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Start timing for next move
   */
  startMoveTimer(): void {
    this.moveStartTime = Date.now();
  }

  /**
   * Get current session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Check if currently in a game
   */
  isInGame(): boolean {
    return this.currentSession !== null && !this.currentSession.endTime;
  }
}

// Export singleton instance
export const statsTracker = StatsTracker.getInstance();