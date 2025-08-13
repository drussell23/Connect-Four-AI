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

// ============================================================================
// Advanced API Endpoint Builder
// ============================================================================

// Endpoint builder options
export interface EndpointOptions {
  // Path parameters (e.g., /users/:id => { id: '123' })
  params?: Record<string, string | number>;
  // Query parameters (e.g., ?page=1&limit=10)
  query?: Record<string, string | number | boolean | string[] | undefined>;
  // Override base URL
  baseUrl?: string;
  // API version (e.g., 'v2' => /api/v2/...)
  version?: string;
  // Skip API prefix
  skipApiPrefix?: boolean;
  // Include timestamp in query (cache busting)
  timestamp?: boolean;
  // Enable debug logging for this request
  debug?: boolean;
}

// Cache for built endpoints
class EndpointCache {
  private cache = new Map<string, { url: string; timestamp: number }>();
  private maxSize = 100;
  private ttl = 60000; // 1 minute

  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.url;
  }

  set(key: string, url: string): void {
    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { url, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global endpoint cache instance
const endpointCache = new EndpointCache();

// Helper to clean and normalize paths
const cleanPath = (path: string): string => {
  // Remove duplicate slashes
  path = path.replace(/\/+/g, '/');
  
  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Remove trailing slash unless it's the root
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  
  return path;
};

// Helper to build query string
const buildQueryString = (query: Record<string, any>): string => {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    
    if (Array.isArray(value)) {
      value.forEach(v => params.append(key, String(v)));
    } else {
      params.set(key, String(value));
    }
  });
  
  return params.toString();
};

// Helper to substitute path parameters
const substitutePathParams = (path: string, params: Record<string, string | number>): string => {
  let result = path;
  
  Object.entries(params).forEach(([key, value]) => {
    // Support both :param and {param} syntax
    result = result.replace(`:${key}`, encodeURIComponent(String(value)));
    result = result.replace(`{${key}}`, encodeURIComponent(String(value)));
  });
  
  return result;
};

// Generate cache key for endpoint
const generateCacheKey = (path: string, options: EndpointOptions): string => {
  const keyParts = [
    path,
    JSON.stringify(options.params || {}),
    JSON.stringify(options.query || {}),
    options.version || '',
    options.baseUrl || '',
  ];
  
  // Simple hash function
  let hash = 0;
  const str = keyParts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
};

// Helper function to build API endpoints with correct prefix (enhanced)
export const buildApiEndpoint = (path: string, options: EndpointOptions = {}): string => {
  // Check cache first
  const cacheKey = generateCacheKey(path, options);
  const cached = endpointCache.get(cacheKey);
  if (cached && !options.timestamp) {
    return cached;
  }

  // Get base URL (from options or config)
  const baseUrl = options.baseUrl || appConfig.api.baseUrl;
  
  // Clean and prepare the path
  let finalPath = cleanPath(path);
  
  // Substitute path parameters
  if (options.params) {
    finalPath = substitutePathParams(finalPath, options.params);
  }
  
  // Add API version if specified
  if (options.version) {
    // If path already has /api, insert version after it
    if (finalPath.startsWith('/api/')) {
      finalPath = finalPath.replace('/api/', `/api/${options.version}/`);
    } else if (finalPath.startsWith('/api')) {
      finalPath = `/api/${options.version}${finalPath.substring(4)}`;
    } else {
      finalPath = `/${options.version}${finalPath}`;
    }
  }
  
  // Smart API prefix handling
  if (!options.skipApiPrefix) {
    // Check various patterns to avoid double /api
    const hasApiPrefix = finalPath.startsWith('/api/') || finalPath === '/api';
    const containsApiInPath = finalPath.match(/\/api\/(?!.*\/api\/)/); // Check for /api/ not followed by another /api/
    
    if (!hasApiPrefix && !containsApiInPath) {
      // Add /api prefix
      finalPath = `/api${finalPath}`;
    }
  }
  
  // Build query string
  const queryObj: Record<string, any> = { ...options.query };
  
  // Add timestamp if requested (cache busting)
  if (options.timestamp) {
    queryObj._t = Date.now();
  }
  
  // Add debug flag in development
  if ((options.debug || appConfig.dev.debugMode) && !environmentDetector.getEnvironmentInfo().isProduction) {
    queryObj._debug = '1';
  }
  
  const queryString = buildQueryString(queryObj);
  const fullPath = queryString ? `${finalPath}?${queryString}` : finalPath;
  
  // Construct full URL
  const fullUrl = `${baseUrl}${fullPath}`;
  
  // Debug logging
  if (options.debug || appConfig.dev.verboseLogging) {
    console.log('🔧 buildApiEndpoint:', {
      input: { path, options },
      processing: {
        cleanedPath: cleanPath(path),
        finalPath,
        queryString,
        hasApiPrefix: finalPath.startsWith('/api'),
      },
      output: {
        fullUrl,
        cacheKey,
      },
    });
  }
  
  // Validate no double /api
  if (fullUrl.includes('/api/api')) {
    console.warn('⚠️ Double /api detected in URL:', fullUrl);
  }
  
  // Cache the result
  endpointCache.set(cacheKey, fullUrl);
  
  return fullUrl;
};

// Convenience functions for common patterns
export const buildApiEndpointWithParams = (path: string, params: Record<string, string | number>): string => {
  return buildApiEndpoint(path, { params });
};

export const buildApiEndpointWithQuery = (path: string, query: Record<string, any>): string => {
  return buildApiEndpoint(path, { query });
};

// Clear endpoint cache
export const clearEndpointCache = (): void => {
  endpointCache.clear();
};

export default appConfig; 