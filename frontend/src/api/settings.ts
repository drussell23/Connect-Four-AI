// frontend/src/api/settings.ts
import { appConfig } from '../config/environment';
import { emit, on } from './socket';

// Types for settings functionality
export interface UserSettings {
  playerId: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: {
      enabled: boolean;
      sound: boolean;
      vibration: boolean;
      email: boolean;
      push: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'friends' | 'private';
      gameHistoryVisibility: 'public' | 'friends' | 'private';
      allowAnalytics: boolean;
      allowTracking: boolean;
    };
    accessibility: {
      highContrast: boolean;
      largeText: boolean;
      reducedMotion: boolean;
      screenReader: boolean;
      keyboardNavigation: boolean;
    };
  };
  lastUpdated: Date;
  version: string;
}

export interface GameSettings {
  playerId: string;
  gamePreferences: {
    startingPlayer: 'random' | 'player' | 'ai';
    aiLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
    gameMode: 'standard' | 'timed' | 'blitz' | 'training' | 'challenge';
    timeControl: {
      enabled: boolean;
      timeLimit: number; // seconds
      increment: number; // seconds
    };
    boardSize: 'standard' | 'large' | 'custom';
    customBoard: {
      rows: number;
      cols: number;
      winLength: number;
    };
    rules: {
      gravity: boolean;
      diagonalWins: boolean;
      allowDraws: boolean;
      specialMoves: boolean;
    };
  };
  aiPreferences: {
    aiStyle: 'aggressive' | 'defensive' | 'balanced' | 'creative' | 'adaptive';
    difficultyScaling: boolean;
    hintsEnabled: boolean;
    moveExplanations: boolean;
    learningMode: boolean;
    personality: {
      friendly: boolean;
      competitive: boolean;
      helpful: boolean;
      challenging: boolean;
    };
  };
  lastUpdated: Date;
  version: string;
}

export interface UISettings {
  playerId: string;
  interface: {
    layout: 'default' | 'compact' | 'wide' | 'mobile';
    sidebar: {
      enabled: boolean;
      position: 'left' | 'right';
      autoHide: boolean;
    };
    board: {
      theme: 'classic' | 'modern' | 'minimal' | 'colorful';
      animations: boolean;
      soundEffects: boolean;
      particleEffects: boolean;
      showCoordinates: boolean;
      showMoveNumbers: boolean;
    };
    controls: {
      showTooltips: boolean;
      keyboardShortcuts: boolean;
      mouseWheelZoom: boolean;
      rightClickMenu: boolean;
    };
    display: {
      fontSize: 'small' | 'medium' | 'large';
      colorScheme: 'default' | 'highContrast' | 'colorBlind';
      showFPS: boolean;
      showDebugInfo: boolean;
    };
  };
  lastUpdated: Date;
  version: string;
}

export interface AIPreferences {
  playerId: string;
  aiConfiguration: {
    modelType: 'standard' | 'advanced' | 'experimental' | 'custom';
    algorithm: 'minimax' | 'alphabeta' | 'mcts' | 'neural' | 'hybrid';
    searchDepth: number;
    timeLimit: number; // milliseconds
    evaluationFunction: 'standard' | 'advanced' | 'custom';
  };
  learningPreferences: {
    adaptiveDifficulty: boolean;
    skillTracking: boolean;
    personalizedTraining: boolean;
    progressAnalysis: boolean;
    recommendationEngine: boolean;
  };
  interactionPreferences: {
    moveSuggestions: boolean;
    threatWarnings: boolean;
    strategicHints: boolean;
    postGameAnalysis: boolean;
    learningTips: boolean;
  };
  lastUpdated: Date;
  version: string;
}

export interface SettingsConfig {
  enableSync: boolean;
  enableBackup: boolean;
  enableValidation: boolean;
  enableCaching: boolean;
  cacheExpiry: number;
  maxCacheSize: number;
  autoSave: boolean;
  syncInterval: number;
  backupInterval: number;
}

// Default configuration
const DEFAULT_CONFIG: SettingsConfig = {
  enableSync: true,
  enableBackup: true,
  enableValidation: true,
  enableCaching: true,
  cacheExpiry: 1800000, // 30 minutes
  maxCacheSize: 100,
  autoSave: true,
  syncInterval: 300000, // 5 minutes
  backupInterval: 86400000, // 24 hours
};

// Enhanced Settings Manager Class
class SettingsManager {
  private config: SettingsConfig;
  private cache: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private backupTimer: NodeJS.Timeout | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor(config: Partial<SettingsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    console.log('⚙️ Initializing Settings Manager');
    console.log('🔧 Configuration:', this.config);

    // Setup event listeners
    this.setupEventListeners();

    // Start timers if enabled
    if (this.config.enableSync) {
      this.startSyncTimer();
    }

    if (this.config.enableBackup) {
      this.startBackupTimer();
    }

    this.isInitialized = true;
    console.log('✅ Settings Manager initialized');
  }

  private setupEventListeners(): void {
    // Listen for settings change events
    on('settings_updated', (data: any) => {
      this.handleSettingsUpdate(data);
    });

    on('settings_sync_completed', (data: any) => {
      this.handleSyncComplete(data);
    });

    on('settings_backup_completed', (data: any) => {
      this.handleBackupComplete(data);
    });
  }

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);
  }

  private startBackupTimer(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.performBackup();
    }, this.config.backupInterval);
  }

  private async handleSettingsUpdate(data: any): Promise<void> {
    try {
      // Clear relevant cache entries
      const cacheKey = this.getCacheKey('user_settings', data.playerId);
      this.cache.delete(cacheKey);

      console.log(`🔄 Settings updated for player: ${data.playerId}`);
    } catch (error) {
      console.error('🚨 Error handling settings update:', error);
    }
  }

  private async handleSyncComplete(_data: any): Promise<void> {
    try {
      console.log('🔄 Settings sync completed');
      // Clear cache to ensure fresh data
      this.cache.clear();
    } catch (error) {
      console.error('🚨 Error handling sync complete:', error);
    }
  }

  private async handleBackupComplete(_data: any): Promise<void> {
    try {
      console.log('💾 Settings backup completed');
    } catch (error) {
      console.error('🚨 Error handling backup complete:', error);
    }
  }

  private async performSync(): Promise<void> {
    try {
      emit('sync_settings', {}, (response: any) => {
        if (response.success) {
          console.log('🔄 Settings sync performed');
        }
      });
    } catch (error) {
      console.error('🚨 Error during settings sync:', error);
    }
  }

  private async performBackup(): Promise<void> {
    try {
      emit('backup_settings', {}, (response: any) => {
        if (response.success) {
          console.log('💾 Settings backup performed');
        }
      });
    } catch (error) {
      console.error('🚨 Error during settings backup:', error);
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
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    cacheKey?: string
  ): Promise<T> {
    // Check cache first
    if (cacheKey) {
      const cached = this.getCached<T>(cacheKey);
      if (cached) return cached;
    }

    // Check if request is already in progress
    const requestKey = `${method}_${endpoint}_${JSON.stringify(data || {})}`;
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey) as Promise<T>;
    }

    // Make new request
    const request = new Promise<T>(async (resolve, reject) => {
      try {
        const url = `http://localhost:3000/api/games${endpoint}`;
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (data && method === 'POST') {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Cache the result
        if (cacheKey) {
          this.setCached(cacheKey, result);
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
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
   * Get user settings
   */
  public async getUserSettings(playerId: string): Promise<UserSettings> {
    try {
      const cacheKey = this.getCacheKey('user_settings', playerId);

      return await this.makeRequest<UserSettings>(
        'GET',
        `/settings/user/${playerId}`,
        undefined,
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting user settings:', error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  public async updateUserSettings(playerId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const updatedSettings = await this.makeRequest<UserSettings>(
        'POST',
        `/settings/user/${playerId}`,
        settings
      );

      // Clear cache for this player
      const cacheKey = this.getCacheKey('user_settings', playerId);
      this.cache.delete(cacheKey);

      console.log(`⚙️ Updated user settings for player: ${playerId}`);
      return updatedSettings;
    } catch (error) {
      console.error('🚨 Error updating user settings:', error);
      throw error;
    }
  }

  /**
   * Get game settings
   */
  public async getGameSettings(playerId: string): Promise<GameSettings> {
    try {
      const cacheKey = this.getCacheKey('game_settings', playerId);

      return await this.makeRequest<GameSettings>(
        'GET',
        `/settings/game/${playerId}`,
        undefined,
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting game settings:', error);
      throw error;
    }
  }

  /**
   * Update game settings
   */
  public async updateGameSettings(playerId: string, settings: Partial<GameSettings>): Promise<GameSettings> {
    try {
      const updatedSettings = await this.makeRequest<GameSettings>(
        'POST',
        `/settings/game/${playerId}`,
        settings
      );

      // Clear cache for this player
      const cacheKey = this.getCacheKey('game_settings', playerId);
      this.cache.delete(cacheKey);

      console.log(`🎮 Updated game settings for player: ${playerId}`);
      return updatedSettings;
    } catch (error) {
      console.error('🚨 Error updating game settings:', error);
      throw error;
    }
  }

  /**
   * Get UI settings
   */
  public async getUISettings(playerId: string): Promise<UISettings> {
    try {
      const cacheKey = this.getCacheKey('ui_settings', playerId);

      return await this.makeRequest<UISettings>(
        'GET',
        `/settings/ui/${playerId}`,
        undefined,
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting UI settings:', error);
      throw error;
    }
  }

  /**
   * Update UI settings
   */
  public async updateUISettings(playerId: string, settings: Partial<UISettings>): Promise<UISettings> {
    try {
      const updatedSettings = await this.makeRequest<UISettings>(
        'POST',
        `/settings/ui/${playerId}`,
        settings
      );

      // Clear cache for this player
      const cacheKey = this.getCacheKey('ui_settings', playerId);
      this.cache.delete(cacheKey);

      console.log(`🎨 Updated UI settings for player: ${playerId}`);
      return updatedSettings;
    } catch (error) {
      console.error('🚨 Error updating UI settings:', error);
      throw error;
    }
  }

  /**
   * Get AI preferences
   */
  public async getAIPreferences(playerId: string): Promise<AIPreferences> {
    try {
      const cacheKey = this.getCacheKey('ai_preferences', playerId);

      return await this.makeRequest<AIPreferences>(
        'GET',
        `/settings/ai/${playerId}`,
        undefined,
        cacheKey
      );
    } catch (error) {
      console.error('🚨 Error getting AI preferences:', error);
      throw error;
    }
  }

  /**
   * Update AI preferences
   */
  public async updateAIPreferences(playerId: string, preferences: Partial<AIPreferences>): Promise<AIPreferences> {
    try {
      const updatedPreferences = await this.makeRequest<AIPreferences>(
        'POST',
        `/settings/ai/${playerId}`,
        preferences
      );

      // Clear cache for this player
      const cacheKey = this.getCacheKey('ai_preferences', playerId);
      this.cache.delete(cacheKey);

      console.log(`🤖 Updated AI preferences for player: ${playerId}`);
      return updatedPreferences;
    } catch (error) {
      console.error('🚨 Error updating AI preferences:', error);
      throw error;
    }
  }

  /**
   * Get all settings for a player
   */
  public async getAllSettings(playerId: string): Promise<{
    user: UserSettings;
    game: GameSettings;
    ui: UISettings;
    ai: AIPreferences;
  }> {
    try {
      const [user, game, ui, ai] = await Promise.all([
        this.getUserSettings(playerId),
        this.getGameSettings(playerId),
        this.getUISettings(playerId),
        this.getAIPreferences(playerId),
      ]);

      return { user, game, ui, ai };
    } catch (error) {
      console.error('🚨 Error getting all settings:', error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  public async resetSettings(playerId: string, type: 'user' | 'game' | 'ui' | 'ai' | 'all'): Promise<void> {
    try {
      await this.makeRequest<void>(
        'POST',
        `/settings/reset/${playerId}`,
        { type }
      );

      // Clear relevant cache entries
      if (type === 'all' || type === 'user') {
        this.cache.delete(this.getCacheKey('user_settings', playerId));
      }
      if (type === 'all' || type === 'game') {
        this.cache.delete(this.getCacheKey('game_settings', playerId));
      }
      if (type === 'all' || type === 'ui') {
        this.cache.delete(this.getCacheKey('ui_settings', playerId));
      }
      if (type === 'all' || type === 'ai') {
        this.cache.delete(this.getCacheKey('ai_preferences', playerId));
      }

      console.log(`🔄 Reset ${type} settings for player: ${playerId}`);
    } catch (error) {
      console.error('🚨 Error resetting settings:', error);
      throw error;
    }
  }

  /**
   * Export settings
   */
  public async exportSettings(playerId: string, format: 'json' | 'xml'): Promise<string> {
    try {
      return await this.makeRequest<string>(
        'GET',
        `/settings/export/${playerId}?format=${format}`,
        undefined
      );
    } catch (error) {
      console.error('🚨 Error exporting settings:', error);
      throw error;
    }
  }

  /**
   * Import settings
   */
  public async importSettings(playerId: string, data: string, format: 'json' | 'xml'): Promise<void> {
    try {
      await this.makeRequest<void>(
        'POST',
        `/settings/import/${playerId}`,
        { data, format }
      );

      // Clear all cache entries for this player
      this.cache.delete(this.getCacheKey('user_settings', playerId));
      this.cache.delete(this.getCacheKey('game_settings', playerId));
      this.cache.delete(this.getCacheKey('ui_settings', playerId));
      this.cache.delete(this.getCacheKey('ai_preferences', playerId));

      console.log(`📥 Imported settings for player: ${playerId}`);
    } catch (error) {
      console.error('🚨 Error importing settings:', error);
      throw error;
    }
  }

  /**
   * Clear settings cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Settings cache cleared');
  }

  /**
   * Update settings configuration
   */
  public updateConfig(newConfig: Partial<SettingsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Settings configuration updated:', this.config);
  }

  /**
   * Get current settings configuration
   */
  public getConfig(): SettingsConfig {
    return { ...this.config };
  }

  /**
   * Get settings manager status
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
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    this.cache.clear();
    this.requestQueue.clear();
    console.log('🧹 Settings Manager destroyed');
  }
}

// Create singleton instance
const settingsManager = new SettingsManager({
  enableSync: appConfig.enterprise.mode,
  enableBackup: appConfig.enterprise.mode,
  enableCaching: appConfig.enterprise.mode,
  autoSave: appConfig.game.autoSave,
});

// Export enhanced functions
export const getUserSettings = (playerId: string): Promise<UserSettings> =>
  settingsManager.getUserSettings(playerId);

export const updateUserSettings = (playerId: string, settings: Partial<UserSettings>): Promise<UserSettings> =>
  settingsManager.updateUserSettings(playerId, settings);

export const getGameSettings = (playerId: string): Promise<GameSettings> =>
  settingsManager.getGameSettings(playerId);

export const updateGameSettings = (playerId: string, settings: Partial<GameSettings>): Promise<GameSettings> =>
  settingsManager.updateGameSettings(playerId, settings);

export const getUISettings = (playerId: string): Promise<UISettings> =>
  settingsManager.getUISettings(playerId);

export const updateUISettings = (playerId: string, settings: Partial<UISettings>): Promise<UISettings> =>
  settingsManager.updateUISettings(playerId, settings);

export const getAIPreferences = (playerId: string): Promise<AIPreferences> =>
  settingsManager.getAIPreferences(playerId);

export const updateAIPreferences = (playerId: string, preferences: Partial<AIPreferences>): Promise<AIPreferences> =>
  settingsManager.updateAIPreferences(playerId, preferences);

export const getAllSettings = (playerId: string): Promise<{
  user: UserSettings;
  game: GameSettings;
  ui: UISettings;
  ai: AIPreferences;
}> => settingsManager.getAllSettings(playerId);

export const resetSettings = (playerId: string, type: 'user' | 'game' | 'ui' | 'ai' | 'all'): Promise<void> =>
  settingsManager.resetSettings(playerId, type);

export const exportSettings = (playerId: string, format: 'json' | 'xml'): Promise<string> =>
  settingsManager.exportSettings(playerId, format);

export const importSettings = (playerId: string, data: string, format: 'json' | 'xml'): Promise<void> =>
  settingsManager.importSettings(playerId, data, format);

export const clearSettingsCache = (): void =>
  settingsManager.clearCache();

export const updateSettingsConfig = (config: Partial<SettingsConfig>): void =>
  settingsManager.updateConfig(config);

export const getSettingsConfig = (): SettingsConfig =>
  settingsManager.getConfig();

export const getSettingsStatus = (): any =>
  settingsManager.getStatus();

export const destroySettings = (): void =>
  settingsManager.destroy();


export default settingsManager; 