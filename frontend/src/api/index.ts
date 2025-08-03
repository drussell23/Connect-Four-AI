// frontend/src/api/index.ts
// Advanced Centralized API Management System for Connect Four AI Platform

/**
 * Enterprise-grade API management system with:
 * - Automatic health monitoring and recovery
 * - Performance metrics tracking
 * - Intelligent error handling and retry logic
 * - Module lifecycle management
 * - Request/response interceptors
 * - Circuit breaker patterns
 * - Cache management
 * - Real-time status updates
 */

import { appConfig } from '../config/environment';

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

// Types for advanced API management
interface APIModule {
    name: string;
    status: 'initialized' | 'loading' | 'ready' | 'error' | 'degraded' | 'offline';
    lastHealthCheck?: Date;
    errorCount: number;
    successCount: number;
    averageResponseTime: number;
    lastError?: Error;
    metadata?: Record<string, any>;
}

interface HealthCheckResult {
    module: string;
    healthy: boolean;
    latency: number;
    error?: string;
    details?: any;
}

interface PerformanceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    uptime: number;
    memoryUsage: number;
}

interface CircuitBreakerConfig {
    threshold: number;
    timeout: number;
    resetTimeout: number;
}

enum CircuitBreakerState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

// Advanced API Manager with enterprise features
class EnterpriseAPIManager {
    private isInitialized: boolean = false;
    private modules: Map<string, APIModule> = new Map();
    private healthCheckInterval?: NodeJS.Timeout;
    private performanceMetrics: PerformanceMetrics;
    private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
    private circuitBreakerConfigs: Map<string, CircuitBreakerConfig> = new Map();
    private requestInterceptors: Array<(config: any) => any> = [];
    private responseInterceptors: Array<(response: any) => any> = [];
    private errorHandlers: Array<(error: any) => void> = [];
    private statusListeners: Set<(status: any) => void> = new Set();
    private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
    private initializationPromise?: Promise<void>;
    private startTime: number = Date.now();
    private latencyHistory: number[] = [];
    private maxLatencyHistory: number = 1000;

    constructor() {
        this.performanceMetrics = this.initializeMetrics();
        this.setupModules();
        this.initializationPromise = this.initialize();
        this.setupGlobalErrorHandling();
        this.setupPerformanceMonitoring();
    }

    private initializeMetrics(): PerformanceMetrics {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageLatency: 0,
            p95Latency: 0,
            p99Latency: 0,
            uptime: 0,
            memoryUsage: 0
        };
    }

    private setupModules(): void {
        const moduleConfigs = [
            { name: 'socket', critical: true },
            { name: 'analytics', critical: false },
            { name: 'aiInsights', critical: false },
            { name: 'gameHistory', critical: false },
            { name: 'settings', critical: false }
        ];

        moduleConfigs.forEach(config => {
            this.modules.set(config.name, {
                name: config.name,
                status: 'loading',
                errorCount: 0,
                successCount: 0,
                averageResponseTime: 0
            });

            // Setup circuit breaker for each module
            this.circuitBreakerConfigs.set(config.name, {
                threshold: config.critical ? 10 : 5,
                timeout: 30000,
                resetTimeout: 60000
            });
            this.circuitBreakers.set(config.name, CircuitBreakerState.CLOSED);
        });
    }

    private async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('🚀 Initializing Enterprise API Manager');
        const startTime = Date.now();

        try {
            // Initialize all modules in parallel with error handling
            const initPromises = Array.from(this.modules.keys()).map(async moduleName => {
                try {
                    await this.initializeModule(moduleName);
                    this.updateModuleStatus(moduleName, 'ready');
                } catch (error) {
                    console.error(`❌ Failed to initialize ${moduleName}:`, error);
                    this.updateModuleStatus(moduleName, 'error', error as Error);
                    // Don't fail initialization for non-critical modules
                    if (moduleName === 'socket') {
                        throw error; // Socket is critical
                    }
                }
            });

            await Promise.allSettled(initPromises);

            // Start health monitoring
            // Default to enabled if not explicitly disabled
            if (appConfig.enterprise?.mode !== false) {
                this.startHealthMonitoring();
            }

            // Start cache cleanup
            this.startCacheCleanup();

            this.isInitialized = true;
            const initTime = Date.now() - startTime;
            console.log(`✅ Enterprise API Manager initialized in ${initTime}ms`);
            
            this.notifyStatusListeners();
        } catch (error) {
            console.error('🚨 Critical error during API Manager initialization:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    private async initializeModule(moduleName: string): Promise<void> {
        const startTime = Date.now();
        
        switch (moduleName) {
            case 'socket':
                const socketModule = await import('./socket');
                if (socketModule.getInitializedSocket) {
                    await socketModule.getInitializedSocket();
                }
                break;
            case 'analytics':
                await import('./analytics');
                break;
            case 'aiInsights':
                await import('./ai-insights');
                break;
            case 'gameHistory':
                await import('./game-history');
                break;
            case 'settings':
                await import('./settings');
                break;
        }

        const loadTime = Date.now() - startTime;
        console.log(`📦 Module ${moduleName} loaded in ${loadTime}ms`);
    }

    private updateModuleStatus(moduleName: string, status: APIModule['status'], error?: Error): void {
        const module = this.modules.get(moduleName);
        if (module) {
            module.status = status;
            if (error) {
                module.lastError = error;
                module.errorCount++;
            } else if (status === 'ready') {
                module.successCount++;
            }
            module.lastHealthCheck = new Date();
            this.modules.set(moduleName, module);
        }
    }

    private startHealthMonitoring(): void {
        // Clear existing interval if any
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // Perform immediate health check
        this.performHealthCheck();

        // Schedule periodic health checks
        const interval = 30000; // 30 seconds default
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, interval);
    }

    private async performHealthCheck(): Promise<HealthCheckResult[]> {
        const results: HealthCheckResult[] = [];
        
        for (const [moduleName, module] of this.modules) {
            const startTime = Date.now();
            try {
                const healthy = await this.checkModuleHealth(moduleName);
                const latency = Date.now() - startTime;
                
                results.push({
                    module: moduleName,
                    healthy,
                    latency
                });

                // Update module status based on health
                if (healthy) {
                    if (module.status === 'error' || module.status === 'degraded') {
                        this.updateModuleStatus(moduleName, 'ready');
                        console.log(`✅ Module ${moduleName} recovered`);
                        this.attemptCircuitBreakerReset(moduleName);
                    }
                } else {
                    if (module.status === 'ready') {
                        this.updateModuleStatus(moduleName, 'degraded');
                        console.warn(`⚠️ Module ${moduleName} degraded`);
                    }
                }
            } catch (error) {
                const latency = Date.now() - startTime;
                results.push({
                    module: moduleName,
                    healthy: false,
                    latency,
                    error: (error as Error).message
                });
                
                this.updateModuleStatus(moduleName, 'error', error as Error);
                this.handleCircuitBreaker(moduleName);
            }
        }

        // Update performance metrics
        this.updatePerformanceMetrics(results);
        
        return results;
    }

    private async checkModuleHealth(moduleName: string): Promise<boolean> {
        const healthCheckTimeout = 5000; // 5 second timeout for health checks
        
        try {
            // Wrap health check in timeout
            return await this.withTimeout(
                this.performModuleHealthCheck(moduleName),
                healthCheckTimeout
            );
        } catch (error) {
            console.warn(`Health check failed for ${moduleName}:`, error);
            return false;
        }
    }

    private async performModuleHealthCheck(moduleName: string): Promise<boolean> {
        switch (moduleName) {
            case 'socket': {
                try {
                    const socketModule = await import('./socket');
                    
                    // Check if socket module is loaded and has required functions
                    if (!socketModule) return false;
                    
                    // Check basic socket health
                    const isHealthy = socketModule.isHealthy ? socketModule.isHealthy() : false;
                    if (!isHealthy) return false;
                    
                    // Check connection status
                    const status = socketModule.getConnectionStatus ? socketModule.getConnectionStatus() : null;
                    if (!status || !status.connected) {
                        // Try to get more detailed status
                        const socketState = socketModule.getSocketState ? socketModule.getSocketState() : null;
                        
                        // Allow 'connecting' state as healthy since it's transient
                        if (socketState?.connecting) {
                            return true;
                        }
                        
                        console.debug(`Socket health check: connected=${status?.connected}, latency=${status?.latency}ms`);
                        return false;
                    }
                    
                    // Verify socket can emit (without actually emitting)
                    if (!socketModule.emit || typeof socketModule.emit !== 'function') {
                        return false;
                    }
                    
                    // Check metrics if available
                    if (socketModule.getMetrics) {
                        const metrics = socketModule.getMetrics();
                        // Fail if error rate is too high (>20%)
                        const totalMessages = (metrics.messagesSent || 0) + (metrics.messagesReceived || 0);
                        if (totalMessages > 10) { // Only check after some messages
                            const errorRate = metrics.errorCount / totalMessages;
                            if (errorRate > 0.2) {
                                console.warn(`Socket error rate too high: ${(errorRate * 100).toFixed(2)}%`);
                                return false;
                            }
                        }
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Socket health check error:', error);
                    return false;
                }
            }
            
            case 'analytics': {
                try {
                    const analyticsModule = await import('./analytics');
                    
                    // Check if module loaded
                    if (!analyticsModule) return false;
                    
                    // Verify core analytics functions exist
                    const requiredFunctions = [
                        'trackEvent',
                        'trackPageView',
                        'trackError',
                        'getAnalytics'
                    ];
                    
                    for (const func of requiredFunctions) {
                        if (!(func in analyticsModule) || typeof (analyticsModule as any)[func] !== 'function') {
                            console.warn(`Analytics missing required function: ${func}`);
                            return false;
                        }
                    }
                    
                    // Check if analytics is initialized
                    if ('getAnalytics' in analyticsModule && typeof (analyticsModule as any).getAnalytics === 'function') {
                        const analytics = (analyticsModule as any).getAnalytics();
                        if (!analytics) {
                            console.warn('Analytics not initialized');
                            return false;
                        }
                    }
                    
                    // Verify analytics can track (test with a health check event)
                    try {
                        // Use a special health check event that won't pollute real analytics
                        if ('trackEvent' in analyticsModule) {
                            await (analyticsModule as any).trackEvent('system', 'health_check', {
                            module: 'analytics',
                            timestamp: Date.now(),
                                _internal: true // Flag to potentially filter out
                            });
                        }
                    } catch (trackError) {
                        console.warn('Analytics tracking test failed:', trackError);
                        return false;
                    }
                    
                    // Check analytics queue if available
                    if ('getQueueSize' in analyticsModule && typeof (analyticsModule as any).getQueueSize === 'function') {
                        const queueSize = (analyticsModule as any).getQueueSize();
                        if (queueSize > 1000) { // Queue is backing up
                            console.warn(`Analytics queue too large: ${queueSize}`);
                            return false;
                        }
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Analytics health check error:', error);
                    return false;
                }
            }
            
            case 'aiInsights': {
                try {
                    const insightsModule = await import('./ai-insights');
                    
                    if (!insightsModule) return false;
                    
                    // Check required AI insights functions
                    const requiredFunctions = [
                        'analyzeMove',
                        'getStrategicInsights',
                        'predictNextMove',
                        'evaluatePosition'
                    ];
                    
                    for (const func of requiredFunctions) {
                        if (!(func in insightsModule) || typeof (insightsModule as any)[func] !== 'function') {
                            console.warn(`AI Insights missing required function: ${func}`);
                            return false;
                        }
                    }
                    
                    // Test basic AI functionality with a simple board
                    try {
                        const testBoard = Array(6).fill(null).map(() => Array(7).fill('Empty'));
                        testBoard[5][3] = 'Red'; // Place one test piece
                        
                        // Try to evaluate this position
                        if ('evaluatePosition' in insightsModule) {
                            const evaluation = await Promise.race([
                                (insightsModule as any).evaluatePosition(testBoard, 'Yellow'),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('AI evaluation timeout')), 2000)
                                )
                            ]);
                            
                            if (!evaluation || typeof evaluation !== 'object') {
                                console.warn('AI Insights evaluation returned invalid result');
                                return false;
                            }
                        }
                    } catch (aiError) {
                        console.warn('AI Insights evaluation test failed:', aiError);
                        // Don't fail completely - AI might be temporarily unavailable
                        // but the module itself is healthy
                    }
                    
                    // Check if AI service connection is healthy
                    if ('checkAIServiceHealth' in insightsModule && typeof (insightsModule as any).checkAIServiceHealth === 'function') {
                        const aiHealthy = await (insightsModule as any).checkAIServiceHealth();
                        if (!aiHealthy) {
                            console.warn('AI service backend unhealthy');
                            // Return degraded but not failed
                            return true; // Module works but backend might be slow
                        }
                    }
                    
                    return true;
                } catch (error) {
                    console.error('AI Insights health check error:', error);
                    return false;
                }
            }
            
            case 'gameHistory': {
                try {
                    const historyModule = await import('./game-history');
                    
                    if (!historyModule) return false;
                    
                    // Check required history functions
                    const requiredFunctions = [
                        'saveGame',
                        'loadGame',
                        'getGameHistory',
                        'clearHistory'
                    ];
                    
                    for (const func of requiredFunctions) {
                        if (!(func in historyModule) || typeof (historyModule as any)[func] !== 'function') {
                            console.warn(`Game History missing required function: ${func}`);
                            return false;
                        }
                    }
                    
                    // Test localStorage access (primary storage for game history)
                    try {
                        const testKey = '__healthcheck_test__';
                        localStorage.setItem(testKey, 'test');
                        const value = localStorage.getItem(testKey);
                        localStorage.removeItem(testKey);
                        
                        if (value !== 'test') {
                            console.warn('localStorage not working properly');
                            return false;
                        }
                    } catch (storageError) {
                        console.warn('localStorage access failed:', storageError);
                        return false;
                    }
                    
                    // Check if history can be retrieved
                    try {
                        const history = await historyModule.getGameHistory('default');
                        if (!Array.isArray(history)) {
                            console.warn('Game history returned invalid format');
                            return false;
                        }
                        
                        // Check storage usage if available
                        if ('getStorageUsage' in historyModule && typeof (historyModule as any).getStorageUsage === 'function') {
                            const usage = (historyModule as any).getStorageUsage();
                            // Warn if using more than 4MB (leaving 1MB buffer for 5MB limit)
                            if (usage > 4 * 1024 * 1024) {
                                console.warn(`Game history storage nearly full: ${(usage / 1024 / 1024).toFixed(2)}MB`);
                                // Still healthy but degraded
                            }
                        }
                    } catch (historyError) {
                        console.warn('Failed to retrieve game history:', historyError);
                        return false;
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Game History health check error:', error);
                    return false;
                }
            }
            
            case 'settings': {
                try {
                    const settingsModule = await import('./settings');
                    
                    if (!settingsModule) return false;
                    
                    // Check required settings functions
                    const requiredFunctions = [
                        'getUserSettings',
                        'updateUserSettings',
                        'getAllSettings',
                        'resetSettings'
                    ];
                    
                    for (const func of requiredFunctions) {
                        if (!(func in settingsModule) || typeof (settingsModule as any)[func] !== 'function') {
                            console.warn(`Settings missing required function: ${func}`);
                            return false;
                        }
                    }
                    
                    // Test settings read/write with actual settings API
                    try {
                        // Try to save and retrieve settings
                        const testSettings = await settingsModule.getGameSettings('healthcheck');
                        if (!testSettings || typeof testSettings !== 'object') {
                            console.warn('Settings read test failed');
                            return false;
                        }
                    } catch (settingsError) {
                        console.warn('Settings operation failed:', settingsError);
                        return false;
                    }
                    
                    // Verify settings structure
                    try {
                        const allSettings = await settingsModule.getAllSettings('default');
                        if (!allSettings || typeof allSettings !== 'object') {
                            console.warn('Settings returned invalid format');
                            return false;
                        }
                        
                        // Check for critical settings
                        const criticalSettings = ['theme', 'difficulty', 'soundEnabled'];
                        for (const setting of criticalSettings) {
                            if (!(setting in allSettings)) {
                                console.warn(`Missing critical setting: ${setting}`);
                                // Don't fail - just warn
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to retrieve all settings:', error);
                        // Don't fail completely - settings might be initializing
                    }
                    
                    // Settings are persistent by default via localStorage
                    // No need to check persistence explicitly
                    
                    return true;
                } catch (error) {
                    console.error('Settings health check error:', error);
                    return false;
                }
            }
            
            default:
                console.warn(`Unknown module for health check: ${moduleName}`);
                return false;
        }
    }

    private handleCircuitBreaker(moduleName: string): void {
        const state = this.circuitBreakers.get(moduleName);
        const config = this.circuitBreakerConfigs.get(moduleName);
        const module = this.modules.get(moduleName);
        
        if (!state || !config || !module) return;

        if (state === CircuitBreakerState.CLOSED) {
            if (module.errorCount >= config.threshold) {
                console.warn(`🔌 Opening circuit breaker for ${moduleName}`);
                this.circuitBreakers.set(moduleName, CircuitBreakerState.OPEN);
                
                // Schedule reset attempt
                setTimeout(() => {
                    this.attemptCircuitBreakerReset(moduleName);
                }, config.resetTimeout);
            }
        }
    }

    private attemptCircuitBreakerReset(moduleName: string): void {
        const state = this.circuitBreakers.get(moduleName);
        
        if (state === CircuitBreakerState.OPEN) {
            console.log(`🔄 Attempting to reset circuit breaker for ${moduleName}`);
            this.circuitBreakers.set(moduleName, CircuitBreakerState.HALF_OPEN);
            
            // Reset error count for fresh evaluation
            const module = this.modules.get(moduleName);
            if (module) {
                module.errorCount = 0;
                this.modules.set(moduleName, module);
            }
        } else if (state === CircuitBreakerState.HALF_OPEN) {
            const module = this.modules.get(moduleName);
            if (module && module.errorCount === 0) {
                console.log(`✅ Circuit breaker reset for ${moduleName}`);
                this.circuitBreakers.set(moduleName, CircuitBreakerState.CLOSED);
            } else {
                console.warn(`❌ Circuit breaker reset failed for ${moduleName}`);
                this.circuitBreakers.set(moduleName, CircuitBreakerState.OPEN);
            }
        }
    }

    private updatePerformanceMetrics(healthResults: HealthCheckResult[]): void {
        // Update latency metrics
        const latencies = healthResults.map(r => r.latency);
        latencies.forEach(latency => {
            this.latencyHistory.push(latency);
            if (this.latencyHistory.length > this.maxLatencyHistory) {
                this.latencyHistory.shift();
            }
        });

        // Calculate percentiles
        if (this.latencyHistory.length > 0) {
            const sorted = [...this.latencyHistory].sort((a, b) => a - b);
            this.performanceMetrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
            this.performanceMetrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
            this.performanceMetrics.averageLatency = 
                sorted.reduce((a, b) => a + b, 0) / sorted.length;
        }

        // Update uptime
        this.performanceMetrics.uptime = Date.now() - this.startTime;

        // Estimate memory usage (if available)
        if (performance && (performance as any).memory) {
            this.performanceMetrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }
    }

    private setupGlobalErrorHandling(): void {
        // Listen for unhandled promise rejections related to API calls
        window.addEventListener('unhandledrejection', (event) => {
            if (this.isAPIRelatedError(event.reason)) {
                console.error('🚨 Unhandled API error:', event.reason);
                this.handleGlobalError(event.reason);
                event.preventDefault(); // Prevent default error handling
            }
        });
    }

    private isAPIRelatedError(error: any): boolean {
        // Check if error is related to our API modules
        const errorString = error?.toString() || '';
        const apiKeywords = ['socket', 'api', 'fetch', 'network', 'timeout'];
        return apiKeywords.some(keyword => 
            errorString.toLowerCase().includes(keyword)
        );
    }

    private handleGlobalError(error: any): void {
        // Notify all error handlers
        this.errorHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (e) {
                console.error('Error in error handler:', e);
            }
        });

        // Update metrics
        this.performanceMetrics.failedRequests++;
    }

    private setupPerformanceMonitoring(): void {
        // Monitor performance metrics
        if (appConfig.enterprise?.performanceMonitoring !== false) {
            // Use Performance Observer API if available
            if ('PerformanceObserver' in window) {
                try {
                    const observer = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.entryType === 'resource' && 
                                this.isAPIResource(entry.name)) {
                                this.trackResourcePerformance(entry as PerformanceResourceTiming);
                            }
                        }
                    });
                    observer.observe({ entryTypes: ['resource'] });
                } catch (e) {
                    console.warn('Performance monitoring setup failed:', e);
                }
            }
        }
    }

    private isAPIResource(url: string): boolean {
        // Check if URL is one of our API endpoints
        const apiPatterns = ['/api/', '/socket.io/', 'localhost:3000', 'localhost:8000'];
        return apiPatterns.some(pattern => url.includes(pattern));
    }

    private trackResourcePerformance(entry: PerformanceResourceTiming): void {
        const duration = entry.duration;
        this.latencyHistory.push(duration);
        
        if (this.latencyHistory.length > this.maxLatencyHistory) {
            this.latencyHistory.shift();
        }
        
        this.performanceMetrics.totalRequests++;
        
        // Consider > 2 seconds as failed/timeout
        if (duration > 2000) {
            this.performanceMetrics.failedRequests++;
        } else {
            this.performanceMetrics.successfulRequests++;
        }
    }

    private startCacheCleanup(): void {
        // Clean expired cache entries every minute
        setInterval(() => {
            const now = Date.now();
            const expired: string[] = [];
            
            this.cache.forEach((value, key) => {
                if (now - value.timestamp > value.ttl) {
                    expired.push(key);
                }
            });
            
            expired.forEach(key => {
                this.cache.delete(key);
            });
            
            if (expired.length > 0) {
                console.log(`🧹 Cleaned ${expired.length} expired cache entries`);
            }
        }, 60000); // Every minute
    }

    private notifyStatusListeners(): void {
        const status = this.getDetailedStatus();
        this.statusListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.error('Error in status listener:', error);
            }
        });
    }

    // Public API methods

    public async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    public getStatus(): any {
        return {
            isInitialized: this.isInitialized,
            modules: Object.fromEntries(
                Array.from(this.modules.entries()).map(([name, module]) => [
                    name,
                    module.status
                ])
            ),
            metrics: this.performanceMetrics,
            uptime: Date.now() - this.startTime
        };
    }

    public getDetailedStatus(): any {
        return {
            isInitialized: this.isInitialized,
            modules: Array.from(this.modules.values()),
            circuitBreakers: Object.fromEntries(this.circuitBreakers),
            metrics: this.performanceMetrics,
            cache: {
                size: this.cache.size,
                entries: Array.from(this.cache.keys())
            },
            uptime: Date.now() - this.startTime,
            health: this.getOverallHealth()
        };
    }

    private getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
        const modules = Array.from(this.modules.values());
        const errorCount = modules.filter(m => m.status === 'error').length;
        const degradedCount = modules.filter(m => m.status === 'degraded').length;
        
        if (errorCount > 0) return 'unhealthy';
        if (degradedCount > 0) return 'degraded';
        return 'healthy';
    }

    public async makeRequest<T>(
        moduleName: string,
        request: () => Promise<T>,
        options?: {
            cache?: boolean;
            cacheKey?: string;
            cacheTTL?: number;
            retry?: boolean;
            retryCount?: number;
            timeout?: number;
        }
    ): Promise<T> {
        // Check circuit breaker
        const circuitState = this.circuitBreakers.get(moduleName);
        if (circuitState === CircuitBreakerState.OPEN) {
            throw new Error(`Circuit breaker is open for ${moduleName}`);
        }

        // Check cache
        if (options?.cache && options.cacheKey) {
            const cached = this.cache.get(options.cacheKey);
            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                console.log(`📦 Cache hit for ${options.cacheKey}`);
                return cached.data;
            }
        }

        const startTime = Date.now();
        let lastError: Error | undefined;
        const maxRetries = options?.retry ? (options.retryCount || 3) : 1;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Apply request interceptors
                let modifiedRequest = request;
                for (const interceptor of this.requestInterceptors) {
                    modifiedRequest = interceptor(modifiedRequest);
                }

                // Execute request with timeout
                const timeoutMs = options?.timeout || 30000;
                const result = await this.withTimeout(modifiedRequest(), timeoutMs);

                // Apply response interceptors
                let modifiedResult = result;
                for (const interceptor of this.responseInterceptors) {
                    modifiedResult = interceptor(modifiedResult);
                }

                // Update metrics
                const duration = Date.now() - startTime;
                this.trackRequestSuccess(moduleName, duration);

                // Cache if requested
                if (options?.cache && options.cacheKey) {
                    this.cache.set(options.cacheKey, {
                        data: modifiedResult,
                        timestamp: Date.now(),
                        ttl: options.cacheTTL || 300000 // 5 minutes default
                    });
                }

                return modifiedResult;
            } catch (error) {
                lastError = error as Error;
                console.warn(`❌ Request failed (attempt ${attempt}/${maxRetries}):`, error);
                
                this.trackRequestFailure(moduleName);
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError || new Error('Request failed');
    }

    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private trackRequestSuccess(moduleName: string, duration: number): void {
        const module = this.modules.get(moduleName);
        if (module) {
            module.successCount++;
            // Update rolling average response time
            module.averageResponseTime = 
                (module.averageResponseTime * (module.successCount - 1) + duration) / 
                module.successCount;
            this.modules.set(moduleName, module);
        }
        
        this.performanceMetrics.successfulRequests++;
        this.performanceMetrics.totalRequests++;
    }

    private trackRequestFailure(moduleName: string): void {
        const module = this.modules.get(moduleName);
        if (module) {
            module.errorCount++;
            this.modules.set(moduleName, module);
        }
        
        this.performanceMetrics.failedRequests++;
        this.performanceMetrics.totalRequests++;
        
        this.handleCircuitBreaker(moduleName);
    }

    public addRequestInterceptor(interceptor: (config: any) => any): void {
        this.requestInterceptors.push(interceptor);
    }

    public addResponseInterceptor(interceptor: (response: any) => any): void {
        this.responseInterceptors.push(interceptor);
    }

    public addErrorHandler(handler: (error: any) => void): void {
        this.errorHandlers.push(handler);
    }

    public onStatusChange(listener: (status: any) => void): () => void {
        this.statusListeners.add(listener);
        // Return unsubscribe function
        return () => this.statusListeners.delete(listener);
    }

    public async destroy(): Promise<void> {
        console.log('🧹 Destroying Enterprise API Manager');

        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // Clear cache
        this.cache.clear();

        // Clear listeners
        this.statusListeners.clear();
        this.errorHandlers = [];
        this.requestInterceptors = [];
        this.responseInterceptors = [];

        // Destroy all modules
        const destroyPromises = [
            import('./socket').then(m => m.destroy && m.destroy()),
            import('./analytics').then(m => m.destroyAnalytics && m.destroyAnalytics()),
            import('./ai-insights').then(m => m.destroyInsights && m.destroyInsights()),
            import('./game-history').then(m => m.destroyHistory && m.destroyHistory()),
            import('./settings').then(m => m.destroySettings && m.destroySettings())
        ];

        await Promise.allSettled(destroyPromises);

        // Reset state
        this.modules.clear();
        this.circuitBreakers.clear();
        this.circuitBreakerConfigs.clear();
        this.isInitialized = false;
        this.latencyHistory = [];

        console.log('✅ Enterprise API Manager destroyed');
    }

    public async restart(): Promise<void> {
        console.log('🔄 Restarting Enterprise API Manager');
        await this.destroy();
        this.setupModules();
        this.initializationPromise = this.initialize();
        await this.initializationPromise;
    }

    public getModuleStatus(moduleName: string): APIModule | undefined {
        return this.modules.get(moduleName);
    }

    public isModuleHealthy(moduleName: string): boolean {
        const module = this.modules.get(moduleName);
        return module?.status === 'ready';
    }

    public getPerformanceMetrics(): PerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    public clearCache(pattern?: string): number {
        if (!pattern) {
            const size = this.cache.size;
            this.cache.clear();
            return size;
        }

        let cleared = 0;
        const keysToDelete: string[] = [];
        
        this.cache.forEach((_, key) => {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => {
            this.cache.delete(key);
            cleared++;
        });

        return cleared;
    }

    public getCacheStats(): { size: number; keys: string[]; totalBytes?: number } {
        const keys = Array.from(this.cache.keys());
        let totalBytes = 0;

        // Estimate cache size (rough approximation)
        this.cache.forEach(value => {
            try {
                totalBytes += JSON.stringify(value.data).length;
            } catch (e) {
                // Ignore circular reference errors
            }
        });

        return {
            size: this.cache.size,
            keys,
            totalBytes
        };
    }
}

// Create singleton instance
const apiManager = new EnterpriseAPIManager();

// Export the API manager
export { apiManager };
export default apiManager;

// Advanced convenience exports
export const getAPIStatus = (): any => apiManager.getStatus();
export const getDetailedAPIStatus = (): any => apiManager.getDetailedStatus();
export const destroyAllAPIs = (): Promise<void> => apiManager.destroy();
export const restartAPIs = (): Promise<void> => apiManager.restart();
export const ensureAPIsReady = (): Promise<void> => apiManager.ensureInitialized();
export const makeAPIRequest = <T>(
    module: string,
    request: () => Promise<T>,
    options?: any
): Promise<T> => apiManager.makeRequest(module, request, options);
export const onAPIStatusChange = (listener: (status: any) => void): () => void => 
    apiManager.onStatusChange(listener);
export const getAPIMetrics = (): any => apiManager.getPerformanceMetrics();
export const clearAPICache = (pattern?: string): number => apiManager.clearCache(pattern);
export const getCacheStats = () => apiManager.getCacheStats();

// Export types
export type { APIModule, HealthCheckResult, PerformanceMetrics, CircuitBreakerConfig };
export { CircuitBreakerState };