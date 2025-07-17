// frontend/src/api/game-history.ts
import { appConfig } from '../config/environment';
import { emit, on, off } from './socket';

// Types for game history functionality
export interface GameHistory {
  gameId: string;
  playerId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  winner: 'player' | 'ai' | 'draw';
  totalMoves: number;
  playerMoves: number[];
  aiMoves: number[];
  finalBoard: string[][];
  gameMode: string;
  aiLevel: string;
  playerSkill: string;
  metadata: {
    deviceType: string;
    sessionId: string;
    version: string;
    features: string[];
  };
  tags: string[];
  notes: string;
  rating: number;
  isFavorite: boolean;
  isPublic: boolean;
}

export interface GameReplay {
  gameId: string;
  moves: {
    moveNumber: number;
    player: 'player' | 'ai';
    column: number;
    timestamp: number;
    boardState: string[][];
    analysis?: {
      quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
      score: number;
      explanation: string;
    };
  }[];
  highlights: {
    moveNumber: number;
    type: 'brilliant' | 'mistake' | 'critical' | 'interesting';
    description: string;
    impact: 'high' | 'medium' | 'low';
  }[];
  statistics: {
    totalMoves: number;
    averageMoveTime: number;
    longestMove: number;
    shortestMove: number;
    accuracyRate: number;
  };
  commentary: {
    moveNumber: number;
    text: string;
    type: 'analysis' | 'commentary' | 'highlight';
  }[];
}

export interface MoveHistory {
  gameId: string;
  moves: {
    moveNumber: number;
    player: 'player' | 'ai';
    column: number;
    timestamp: number;
    timeSpent: number;
    boardState: string[][];
    moveQuality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
    moveScore: number;
    alternatives: {
      column: number;
      score: number;
      reasoning: string;
    }[];
    analysis: {
      threats: number[];
      opportunities: number[];
      strategicValue: number;
      tacticalValue: number;
    };
  }[];
  summary: {
    totalMoves: number;
    playerMoves: number;
    aiMoves: number;
    averageMoveTime: number;
    bestMove: number;
    worstMove: number;
    gamePhase: {
      opening: number;
      middlegame: number;
      endgame: number;
    };
  };
}

export interface GameSearchFilters {
  playerId?: string;
  winner?: 'player' | 'ai' | 'draw';
  dateRange?: {
    start: Date;
    end: Date;
  };
  gameMode?: string;
  aiLevel?: string;
  minMoves?: number;
  maxMoves?: number;
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
  isFavorite?: boolean;
  isPublic?: boolean;
  rating?: {
    min: number;
    max: number;
  };
}

export interface GameSearchResult {
  games: GameHistory[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: GameSearchFilters;
}

export interface GameHighlight {
  gameId: string;
  moveNumber: number;
  type: 'brilliant' | 'mistake' | 'critical' | 'interesting' | 'tactical' | 'strategic';
  description: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: number;
  boardState: string[][];
  analysis: {
    before: string;
    after: string;
    alternatives: string[];
    keyInsights: string[];
  };
  tags: string[];
}

export interface GameHistoryConfig {
  enableReplay: boolean;
  enableSearch: boolean;
  enableHighlights: boolean;
  enableCaching: boolean;
  cacheExpiry: number;
  maxCacheSize: number;
  enableAutoSave: boolean;
  enableCloudSync: boolean;
  maxHistorySize: number;
  searchIndexing: boolean;
}

// Default configuration
const DEFAULT_CONFIG: GameHistoryConfig = {
  enableReplay: true,
  enableSearch: true,
  enableHighlights: true,
  enableCaching: true,
  cacheExpiry: 900000, // 15 minutes
  maxCacheSize: 200,
  enableAutoSave: true,
  enableCloudSync: appConfig.enterprise.mode,
  maxHistorySize: 1000,
  searchIndexing: true,
};

// Enhanced Game History Manager Class
class GameHistoryManager {
  private config: GameHistoryConfig;
  private cache: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<GameHistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    console.log('📚 Initializing Game History Manager');
    console.log('🔧 Configuration:', this.config);

    // Setup event listeners
    this.setupEventListeners();
    
    // Start auto-save timer if enabled
    if (this.config.enableAutoSave) {
      this.startAutoSaveTimer();
    }

    this.isInitialized = true;
    console.log('✅ Game History Manager initialized');
  }

  private setupEventListeners(): void {
    // Listen for game events to auto-save
    on('gameOver', (data: any) => {
      if (this.config.enableAutoSave) {
        this.autoSaveGame(data);
      }
    });

    on('gameCreated', (data: any) => {
      if (this.config.enableAutoSave) {
        this.trackGameStart(data);
      }
    });

    on('playerMove', (data: any) => {
      if (this.config.enableHighlights) {
        this.checkForHighlights(data);
      }
    });

    on('aiMove', (data: any) => {
      if (this.config.enableHighlights) {
        this.checkForHighlights(data);
      }
    });
  }

  private startAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.performAutoSave();
    }, 30000); // Auto-save every 30 seconds
  }

  private async autoSaveGame(data: any): Promise<void> {
    try {
      const gameHistory: GameHistory = {
        gameId: data.gameId,
        playerId: data.playerId,
        startTime: new Date(data.startTime),
        endTime: new Date(),
        duration: Date.now() - data.startTime,
        winner: data.winner,
        totalMoves: data.totalMoves,
        playerMoves: data.playerMoves,
        aiMoves: data.aiMoves,
        finalBoard: data.finalBoard,
        gameMode: data.gameMode || 'standard',
        aiLevel: data.aiLevel || 'medium',
        playerSkill: data.playerSkill || 'intermediate',
        metadata: {
          deviceType: navigator.userAgent,
          sessionId: data.sessionId,
          version: '1.0.0',
          features: data.features || [],
        },
        tags: data.tags || [],
        notes: data.notes || '',
        rating: data.rating || 0,
        isFavorite: false,
        isPublic: false,
      };

      await this.saveGameHistory(gameHistory);
      console.log(`💾 Auto-saved game: ${data.gameId}`);
    } catch (error) {
      console.error('🚨 Error auto-saving game:', error);
    }
  }

  private async trackGameStart(data: any): Promise<void> {
    try {
      emit('track_game_start', {
        gameId: data.gameId,
        playerId: data.playerId,
        startTime: new Date(),
        gameMode: data.gameMode,
        aiLevel: data.aiLevel,
      });
    } catch (error) {
      console.error('🚨 Error tracking game start:', error);
    }
  }

  private async checkForHighlights(data: any): Promise<void> {
    try {
      const highlight = await this.detectHighlight(data);
      if (highlight) {
        emit('game_highlight_detected', highlight);
      }
    } catch (error) {
      console.error('🚨 Error checking for highlights:', error);
    }
  }

  private async detectHighlight(data: any): Promise<GameHighlight | null> {
    // This would typically involve AI analysis
    // For now, we'll use simple heuristics
    const moveQuality = data.moveQuality || 'average';
    const isCritical = data.isCritical || false;
    
    if (moveQuality === 'brilliant' || moveQuality === 'blunder' || isCritical) {
      return {
        gameId: data.gameId,
        moveNumber: data.moveNumber,
        type: moveQuality === 'brilliant' ? 'brilliant' : 
              moveQuality === 'blunder' ? 'mistake' : 'critical',
        description: data.description || 'Notable move detected',
        impact: 'high',
        timestamp: Date.now(),
        boardState: data.boardState,
        analysis: {
          before: data.analysis?.before || '',
          after: data.analysis?.after || '',
          alternatives: data.analysis?.alternatives || [],
          keyInsights: data.analysis?.keyInsights || [],
        },
        tags: data.tags || [],
      };
    }
    
    return null;
  }

  private async performAutoSave(): Promise<void> {
    try {
      emit('auto_save_games', {}, (response: any) => {
        if (response.success) {
          console.log('💾 Auto-save completed');
        }
      });
    } catch (error) {
      console.error('🚨 Error during auto-save:', error);
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
   * Save game history
   */
  public async saveGameHistory(gameHistory: GameHistory): Promise<void> {
    try {
      await this.makeRequest<void>(
        'save_game_history',
        gameHistory
      );
      console.log(`💾 Saved game history: ${gameHistory.gameId}`);
    } catch (error) {
      console.error('🚨 Error saving game history:', error);
      throw error;
    }
  }

  /**
   * Get game history for a player
   */
  public async getGameHistory(playerId: string, limit: number = 50): Promise<GameHistory[]> {
    try {
      const cacheKey = this.getCacheKey('game_history', `${playerId}_${limit}`);
      
      return await this.makeRequest<GameHistory[]>(
        'get_game_history',
        { playerId, limit },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting game history:', error);
      throw error;
    }
  }

  /**
   * Get game replay
   */
  public async getGameReplay(gameId: string): Promise<GameReplay> {
    try {
      const cacheKey = this.getCacheKey('game_replay', gameId);
      
      return await this.makeRequest<GameReplay>(
        'get_game_replay',
        { gameId },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting game replay:', error);
      throw error;
    }
  }

  /**
   * Get move history for a game
   */
  public async getMoveHistory(gameId: string): Promise<MoveHistory> {
    try {
      const cacheKey = this.getCacheKey('move_history', gameId);
      
      return await this.makeRequest<MoveHistory>(
        'get_move_history',
        { gameId },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting move history:', error);
      throw error;
    }
  }

  /**
   * Search games with filters
   */
  public async searchGames(
    filters: GameSearchFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<GameSearchResult> {
    try {
      const cacheKey = this.getCacheKey('game_search', `${JSON.stringify(filters)}_${page}_${pageSize}`);
      
      return await this.makeRequest<GameSearchResult>(
        'search_games',
        { filters, page, pageSize },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error searching games:', error);
      throw error;
    }
  }

  /**
   * Get game highlights
   */
  public async getGameHighlights(gameId: string): Promise<GameHighlight[]> {
    try {
      const cacheKey = this.getCacheKey('game_highlights', gameId);
      
      return await this.makeRequest<GameHighlight[]>(
        'get_game_highlights',
        { gameId },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting game highlights:', error);
      throw error;
    }
  }

  /**
   * Save game replay
   */
  public async saveGameReplay(gameId: string, replay: GameReplay): Promise<void> {
    try {
      await this.makeRequest<void>(
        'save_game_replay',
        { gameId, replay }
      );
      console.log(`💾 Saved game replay: ${gameId}`);
    } catch (error) {
      console.error('🚨 Error saving game replay:', error);
      throw error;
    }
  }

  /**
   * Export game data
   */
  public async exportGameData(gameId: string, format: 'json' | 'pgn' | 'html'): Promise<string> {
    try {
      return await this.makeRequest<string>(
        'export_game_data',
        { gameId, format }
      );
    } catch (error) {
      console.error('🚨 Error exporting game data:', error);
      throw error;
    }
  }

  /**
   * Import game data
   */
  public async importGameData(data: string, format: 'json' | 'pgn'): Promise<GameHistory> {
    try {
      return await this.makeRequest<GameHistory>(
        'import_game_data',
        { data, format }
      );
    } catch (error) {
      console.error('🚨 Error importing game data:', error);
      throw error;
    }
  }

  /**
   * Get game statistics
   */
  public async getGameStatistics(playerId: string): Promise<any> {
    try {
      const cacheKey = this.getCacheKey('game_statistics', playerId);
      
      return await this.makeRequest<any>(
        'get_game_statistics',
        { playerId },
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting game statistics:', error);
      throw error;
    }
  }

  /**
   * Clear history cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Game History cache cleared');
  }

  /**
   * Update history configuration
   */
  public updateConfig(newConfig: Partial<GameHistoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Game History configuration updated:', this.config);
  }

  /**
   * Get current history configuration
   */
  public getConfig(): GameHistoryConfig {
    return { ...this.config };
  }

  /**
   * Get history manager status
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
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.cache.clear();
    this.requestQueue.clear();
    console.log('🧹 Game History Manager destroyed');
  }
}

// Create singleton instance
const gameHistoryManager = new GameHistoryManager({
  enableReplay: true,
  enableSearch: true,
  enableHighlights: true,
  enableCaching: appConfig.enterprise.mode,
  enableAutoSave: appConfig.game.autoSave,
  enableCloudSync: appConfig.enterprise.mode,
  searchIndexing: appConfig.enterprise.advancedAnalytics,
});

// Export enhanced functions
export const saveGameHistory = (gameHistory: GameHistory): Promise<void> => 
  gameHistoryManager.saveGameHistory(gameHistory);

export const getGameHistory = (playerId: string, limit?: number): Promise<GameHistory[]> => 
  gameHistoryManager.getGameHistory(playerId, limit);

export const getGameReplay = (gameId: string): Promise<GameReplay> => 
  gameHistoryManager.getGameReplay(gameId);

export const getMoveHistory = (gameId: string): Promise<MoveHistory> => 
  gameHistoryManager.getMoveHistory(gameId);

export const searchGames = (
  filters: GameSearchFilters,
  page?: number,
  pageSize?: number
): Promise<GameSearchResult> => gameHistoryManager.searchGames(filters, page, pageSize);

export const getGameHighlights = (gameId: string): Promise<GameHighlight[]> => 
  gameHistoryManager.getGameHighlights(gameId);

export const saveGameReplay = (gameId: string, replay: GameReplay): Promise<void> => 
  gameHistoryManager.saveGameReplay(gameId, replay);

export const exportGameData = (gameId: string, format: 'json' | 'pgn' | 'html'): Promise<string> => 
  gameHistoryManager.exportGameData(gameId, format);

export const importGameData = (data: string, format: 'json' | 'pgn'): Promise<GameHistory> => 
  gameHistoryManager.importGameData(data, format);

export const getGameStatistics = (playerId: string): Promise<any> => 
  gameHistoryManager.getGameStatistics(playerId);

export const clearHistoryCache = (): void => 
  gameHistoryManager.clearCache();

export const updateHistoryConfig = (config: Partial<GameHistoryConfig>): void => 
  gameHistoryManager.updateConfig(config);

export const getHistoryConfig = (): GameHistoryConfig => 
  gameHistoryManager.getConfig();

export const getHistoryStatus = (): any => 
  gameHistoryManager.getStatus();

export const destroyHistory = (): void => 
  gameHistoryManager.destroy();


export default gameHistoryManager; 