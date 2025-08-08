// frontend/src/config/environment.ts
/**
 * Enterprise Environment Configuration
 * Centralized configuration loader for all React environment variables
 */

import { environmentDetector } from '../utils/environmentDetector';

export interface AppConfig {
    // API Endpoints & Integration
    api: {
        baseUrl: string;
        wsUrl: string;
        mlServiceUrl: string;
        orchestrationDashboardUrl: string;
        performanceAnalyticsUrl: string;
        aiDiagnosticsUrl: string;
    };

    // Enterprise Features
    enterprise: {
        mode: boolean;
        aiInsightsEnabled: boolean;
        performanceMonitoring: boolean;
        advancedAnalytics: boolean;
        threatMeterEnabled: boolean;
    };

    // AI Features
    ai: {
        explanationsEnabled: boolean;
        recommendationsEnabled: boolean;
        difficultyAdaptation: boolean;
        realTimeAnalysis: boolean;
    };

    // Game Configuration
    game: {
        timeout: number;
        aiThinkTime: number;
        historyEnabled: boolean;
        hintsEnabled: boolean;
        undoEnabled: boolean;
        autoSave: boolean;
        fastAIMode: boolean;
    };

    // UI/UX Configuration
    ui: {
        defaultTheme: 'light' | 'dark';
        themeSwitching: boolean;
        animationsEnabled: boolean;
        soundEffects: boolean;
        sidebarEnabled: boolean;
        achievementSystem: boolean;
        loadingAnimations: boolean;
        victoryCelebrations: boolean;
    };

    // Development & Debugging
    dev: {
        debugMode: boolean;
        verboseLogging: boolean;
        performanceMetrics: boolean;
        devTools: boolean;
    };

    // Analytics & Tracking
    analytics: {
        enabled: boolean;
        userTracking: boolean;
        performanceTracking: boolean;
        errorReporting: boolean;
    };
}

// Environment variable helper with type safety
const getEnvVar = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
};

const getEnvBool = (key: string, defaultValue: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
};

const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Helper to determine if we need the /api prefix
const needsApiPrefix = (): boolean => {
    // Backend mounts API at /api in all environments per backend/src/main.ts
    return true;
};

// Get dynamic service configuration
const serviceConfig = environmentDetector.getServiceConfiguration();

// Load and export enterprise configuration
export const appConfig: AppConfig = {
    api: {
        baseUrl: serviceConfig.backend,
        wsUrl: serviceConfig.backend,
        mlServiceUrl: serviceConfig.mlService,
        orchestrationDashboardUrl: getEnvVar('REACT_APP_ORCHESTRATION_DASHBOARD_URL', 'http://localhost:3011'),
        performanceAnalyticsUrl: getEnvVar('REACT_APP_PERFORMANCE_ANALYTICS_URL', 'http://localhost:3014'),
        aiDiagnosticsUrl: getEnvVar('REACT_APP_AI_DIAGNOSTICS_URL', 'http://localhost:3012'),
    },

    enterprise: {
        mode: getEnvBool('REACT_APP_ENTERPRISE_MODE', false),
        aiInsightsEnabled: getEnvBool('REACT_APP_AI_INSIGHTS_ENABLED', false),
        performanceMonitoring: getEnvBool('REACT_APP_PERFORMANCE_MONITORING', false),
        advancedAnalytics: getEnvBool('REACT_APP_ADVANCED_ANALYTICS', false),
        threatMeterEnabled: getEnvBool('REACT_APP_THREAT_METER_ENABLED', false),
    },

    ai: {
        explanationsEnabled: getEnvBool('REACT_APP_AI_EXPLANATIONS', false),
        recommendationsEnabled: getEnvBool('REACT_APP_AI_RECOMMENDATIONS', false),
        difficultyAdaptation: getEnvBool('REACT_APP_AI_DIFFICULTY_ADAPTATION', false),
        realTimeAnalysis: getEnvBool('REACT_APP_REAL_TIME_AI_ANALYSIS', false),
    },

    game: {
        timeout: getEnvNumber('REACT_APP_GAME_TIMEOUT', 300000),
        aiThinkTime: getEnvNumber('REACT_APP_AI_THINK_TIME', 50),
        historyEnabled: getEnvBool('REACT_APP_ENABLE_GAME_HISTORY', true),
        hintsEnabled: getEnvBool('REACT_APP_ENABLE_MOVE_HINTS', true),
        undoEnabled: getEnvBool('REACT_APP_ENABLE_UNDO', true),
        autoSave: getEnvBool('REACT_APP_AUTO_SAVE_GAMES', true),
        fastAIMode: getEnvBool('REACT_APP_FAST_AI_MODE', true),
    },

    ui: {
        defaultTheme: getEnvVar('REACT_APP_DEFAULT_THEME', 'dark') as 'light' | 'dark',
        themeSwitching: getEnvBool('REACT_APP_THEME_SWITCHING', true),
        animationsEnabled: getEnvBool('REACT_APP_ANIMATIONS_ENABLED', true),
        soundEffects: getEnvBool('REACT_APP_SOUND_EFFECTS', true),
        sidebarEnabled: getEnvBool('REACT_APP_SIDEBAR_ENABLED', true),
        achievementSystem: getEnvBool('REACT_APP_ACHIEVEMENT_SYSTEM', true),
        loadingAnimations: getEnvBool('REACT_APP_LOADING_ANIMATIONS', true),
        victoryCelebrations: getEnvBool('REACT_APP_VICTORY_CELEBRATIONS', true),
    },

    dev: {
        debugMode: getEnvBool('REACT_APP_DEBUG_MODE', false),
        verboseLogging: getEnvBool('REACT_APP_VERBOSE_LOGGING', false),
        performanceMetrics: getEnvBool('REACT_APP_PERFORMANCE_METRICS', false),
        devTools: getEnvBool('REACT_APP_DEV_TOOLS', true),
    },

    analytics: {
        enabled: getEnvBool('REACT_APP_ANALYTICS_ENABLED', true),
        userTracking: getEnvBool('REACT_APP_USER_TRACKING', false),
        performanceTracking: getEnvBool('REACT_APP_PERFORMANCE_TRACKING', true),
        errorReporting: getEnvBool('REACT_APP_ERROR_REPORTING', true),
    },
};

// Debug logging for development
if (appConfig.dev.debugMode || environmentDetector.shouldEnableDevelopmentFeatures()) {
    console.log('🏢 Enterprise Frontend Configuration:', {
        appConfig,
        environment: environmentDetector.getEnvironmentInfo(),
        services: environmentDetector.getServiceConfiguration()
    });
}

// Export individual sections for convenience
export const { api, enterprise, ai, game, ui, dev, analytics } = appConfig;

// Helper function to build API endpoints with correct prefix
export const buildApiEndpoint = (path: string): string => {
    const baseUrl = appConfig.api.baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const shouldUsePrefix = needsApiPrefix();

    // Debug logging
    if (appConfig.dev.debugMode || appConfig.dev.verboseLogging) {
        console.log('🔧 buildApiEndpoint:', {
            baseUrl,
            path,
            cleanPath,
            shouldUsePrefix,
            apiUrl: getEnvVar('REACT_APP_API_URL', 'http://localhost:3001'),
            useApiPrefix: getEnvVar('REACT_APP_USE_API_PREFIX', 'false')
        });
    }

    // ALWAYS add /api prefix for backend endpoints
    // The backend serves everything under /api
    if (cleanPath.startsWith('/api')) {
        // Already has /api prefix
        return `${baseUrl}${cleanPath}`;
    } else {
        // Add /api prefix
        return `${baseUrl}/api${cleanPath}`;
    }
};

export default appConfig; 