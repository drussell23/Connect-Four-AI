// frontend/src/services/cleanupService.ts

import { destroy as disconnectSocket } from '../api/socket';
import settingsAPI from '../api/settings';

interface CleanupOptions {
  clearLocalStorage?: boolean;
  clearSessionStorage?: boolean;
  resetStats?: boolean;
  resetHistory?: boolean;
  disconnectSocket?: boolean;
  clearCache?: boolean;
}

/**
 * Service to handle cleanup of game data, connections, and storage
 */
class CleanupService {
  private cleanupHandlers: Set<() => void | Promise<void>> = new Set();
  private isCleaningUp = false;

  /**
   * Register a custom cleanup handler
   */
  public registerCleanupHandler(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.add(handler);
  }

  /**
   * Unregister a cleanup handler
   */
  public unregisterCleanupHandler(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.delete(handler);
  }

  /**
   * Perform comprehensive cleanup
   */
  public async cleanup(options: CleanupOptions = {}): Promise<void> {
    if (this.isCleaningUp) {
      console.log('🧹 Cleanup already in progress...');
      return;
    }

    this.isCleaningUp = true;
    console.log('🧹 Starting cleanup process...');

    const {
      clearLocalStorage = true,
      clearSessionStorage = true,
      resetStats = true,
      resetHistory = true,
      disconnectSocket = true,
      clearCache = true,
    } = options;

    try {
      // Run custom cleanup handlers
      await this.runCustomHandlers();

      // Clear game-related data from localStorage
      if (clearLocalStorage) {
        this.clearLocalStorageData();
      }

      // Clear session storage
      if (clearSessionStorage) {
        this.clearSessionStorageData();
      }

      // Reset game statistics
      if (resetStats) {
        await this.resetGameStats();
      }

      // Reset game history
      if (resetHistory) {
        await this.resetGameHistory();
      }

      // Clear any caches
      if (clearCache) {
        this.clearCaches();
      }

      // Disconnect socket connections
      if (disconnectSocket) {
        await this.disconnectSockets();
      }

      console.log('✅ Cleanup completed successfully');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Quick cleanup for game restart (keeps user settings)
   */
  public async cleanupForRestart(): Promise<void> {
    await this.cleanup({
      clearLocalStorage: false, // Keep user preferences
      clearSessionStorage: true,
      resetStats: true,
      resetHistory: true,
      disconnectSocket: false, // Keep connection alive
      clearCache: true,
    });
  }

  /**
   * Full cleanup for app exit
   */
  public async cleanupForExit(): Promise<void> {
    await this.cleanup({
      clearLocalStorage: true,
      clearSessionStorage: true,
      resetStats: true,
      resetHistory: true,
      disconnectSocket: true,
      clearCache: true,
    });
  }

  /**
   * Complete reset including persistent stats (for explicit user action)
   */
  public async completeReset(): Promise<void> {
    console.log('🔄 Performing complete reset including persistent data...');
    
    // First do normal cleanup
    await this.cleanupForExit();
    
    // Then also clear persistent data
    localStorage.removeItem('connect4EnhancedStats');
    localStorage.removeItem('selectedDifficulty');
    
    console.log('✅ Complete reset finished');
  }

  private async runCustomHandlers(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const handler of this.cleanupHandlers) {
      try {
        const result = handler();
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error('Error in cleanup handler:', error);
      }
    }

    await Promise.all(promises);
  }

  private clearLocalStorageData(): void {
    console.log('🗑️ Clearing localStorage data...');
    
    // List of keys to preserve (like user settings and persistent stats)
    const keysToPreserve = [
      'userTheme', 
      'userLanguage', 
      'cookieConsent',
      'connect4EnhancedStats', // Preserve player stats across sessions
      'selectedDifficulty' // Preserve selected difficulty
    ];
    
    // Get all keys
    const allKeys = Object.keys(localStorage);
    
    // Remove only temporary game-related keys
    allKeys.forEach(key => {
      if (!keysToPreserve.includes(key) && 
          (key.includes('tempGame') || 
           key.includes('currentBoard') ||
           key.includes('sessionData') ||
           key.includes('tempHistory'))) {
        localStorage.removeItem(key);
      }
    });
  }

  private clearSessionStorageData(): void {
    console.log('🗑️ Clearing sessionStorage data...');
    
    // Clear all session storage
    sessionStorage.clear();
  }

  private async resetGameStats(): Promise<void> {
    console.log('📊 Resetting temporary game statistics...');
    
    try {
      // Only clear temporary stats, not persistent player stats
      const tempStatsKeys = ['currentGameStats', 'sessionStats', 'tempAiStats'];
      tempStatsKeys.forEach(key => localStorage.removeItem(key));

      // Note: We preserve 'connect4EnhancedStats' which contains persistent player stats
      // You can also make an API call to reset server-side stats if needed
      // await fetch('/api/stats/reset', { method: 'POST' });
    } catch (error) {
      console.error('Error resetting game stats:', error);
    }
  }

  private async resetGameHistory(): Promise<void> {
    console.log('📜 Resetting current game history...');
    
    try {
      // Clear only current game history, not historical records
      const currentHistoryKeys = ['currentMoveHistory', 'tempGameHistory'];
      currentHistoryKeys.forEach(key => localStorage.removeItem(key));

      // Clear any in-memory history
      if (window.gameHistory) {
        window.gameHistory = [];
      }
    } catch (error) {
      console.error('Error resetting game history:', error);
    }
  }

  private clearCaches(): void {
    console.log('🧹 Clearing caches...');
    
    // Clear settings cache
    if (settingsAPI && typeof settingsAPI.clearCache === 'function') {
      settingsAPI.clearCache();
    }

    // Clear any other caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('game') || name.includes('api')) {
            caches.delete(name);
          }
        });
      });
    }
  }

  private async disconnectSockets(): Promise<void> {
    console.log('🔌 Disconnecting sockets...');
    
    try {
      disconnectSocket();
    } catch (error) {
      console.error('Error disconnecting sockets:', error);
    }
  }

  /**
   * Setup automatic cleanup on page unload
   */
  public setupAutoCleanup(): void {
    // Cleanup on page unload
    window.addEventListener('beforeunload', async (event) => {
      // Note: async operations might not complete before page unloads
      // For critical cleanup, use synchronous operations
      await this.cleanupForExit();
    });

    // Cleanup on visibility change (mobile browsers)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Save current state before potential termination
        this.saveCurrentState();
      }
    });

    // Cleanup on page hide (better for mobile)
    window.addEventListener('pagehide', (event) => {
      if (event.persisted) {
        // Page is being cached, do light cleanup
        this.clearSessionStorageData();
      } else {
        // Page is being terminated, do full cleanup
        this.cleanupForExit();
      }
    });
  }

  private saveCurrentState(): void {
    // Save any critical state that should persist
    const currentState = {
      timestamp: Date.now(),
      // Add any other state that needs to be saved
    };
    
    sessionStorage.setItem('lastState', JSON.stringify(currentState));
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();

// Export types
export type { CleanupOptions };

// Declare global for TypeScript
declare global {
  interface Window {
    gameHistory?: any[];
  }
}