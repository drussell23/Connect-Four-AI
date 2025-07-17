// frontend/src/api/index.ts
// Centralized API exports for Connect Four AI Platform

// Core Socket API
export * from './socket';
export { default as socket } from './socket';

// Analytics API
export * from './analytics';

// AI Insights API
export * from './ai-insights';

// Game History API
export * from './game-history';

// Settings API
export * from './settings';

// API Manager for centralized control
class APIManager {
    private isInitialized: boolean = false;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        if (this.isInitialized) return;

        console.log('🚀 Initializing API Manager');
        this.isInitialized = true;
        console.log('✅ API Manager initialized');
    }

    /**
     * Get API status
     */
    public getStatus(): any {
        return {
            isInitialized: this.isInitialized,
            modules: {
                socket: 'available',
                analytics: 'available',
                aiInsights: 'available',
                gameHistory: 'available',
                settings: 'available',
            },
        };
    }

    /**
     * Cleanup all API modules
     */
    public destroy(): void {
        console.log('🧹 Destroying API Manager');

        // Import and destroy each module
        import('./socket').then(module => {
            if (module.destroy) module.destroy();
        });

        import('./analytics').then(module => {
            if (module.destroyAnalytics) module.destroyAnalytics();
        });

        import('./ai-insights').then(module => {
            if (module.destroyInsights) module.destroyInsights();
        });

        import('./game-history').then(module => {
            if (module.destroyHistory) module.destroyHistory();
        });

        import('./settings').then(module => {
            if (module.destroySettings) module.destroySettings();
        });

        this.isInitialized = false;
    }
}

// Create singleton instance
const apiManager = new APIManager();

// Export the API manager
export { apiManager };
export default apiManager;

// Convenience exports for common operations
export const getAPIStatus = (): any => apiManager.getStatus();
export const destroyAllAPIs = (): void => apiManager.destroy(); 