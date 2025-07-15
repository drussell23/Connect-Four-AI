/**
 * Component Registry - AI Component Management System
 * 
 * This system manages all AI components with tier-based organization,
 * dependency tracking, and intelligent selection algorithms.
 * 
 * Features:
 * - Tier-based component organization (5 tiers)
 * - Dependency resolution and validation
 * - Component lifecycle management
 * - Health-based filtering
 * - Performance-based selection
 * - Dynamic component loading
 * - Component metadata management
 * 
 * @author Connect4 AI Team
 */

import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
    AIComponent,
    AIComponentType,
    ComponentStatus,
    ComponentTier,
    ComponentHealth,
    ComponentMetrics,
    AIRequest
} from './interfaces';

export interface ComponentRegistryConfig {
    // Component management
    autoRegistration: boolean;
    loadOnDemand: boolean;
    caching: boolean;
    healthChecks: boolean;

    // Dependency management
    dependencyValidation: boolean;
    circularDependencyCheck: boolean;

    // Performance optimization
    componentRanking: boolean;
    adaptiveSelection: boolean;

    // Lifecycle management
    autoCleanup: boolean;
    componentTimeouts: boolean;

    // Monitoring
    metricsCollection: boolean;
    performanceTracking: boolean;

    // Security
    componentValidation: boolean;
    sandboxedLoading: boolean;
}

export interface ComponentInfo {
    component: AIComponent;
    registrationTime: number;
    lastUsed: number;
    usageCount: number;

    // Status tracking
    status: ComponentStatus;
    health: ComponentHealth;
    metrics?: ComponentMetrics;

    // Performance tracking
    performance: {
        averageResponseTime: number;
        successRate: number;
        errorCount: number;
        totalExecutions: number;
    };

    // Dependency information
    dependencies: {
        resolved: boolean;
        missing: string[];
        circular: boolean;
    };

    // Lifecycle state
    lifecycle: {
        initialized: boolean;
        loading: boolean;
        ready: boolean;
        error?: string;
    };
}

export interface ComponentQuery {
    type?: AIComponentType;
    tier?: ComponentTier;
    status?: ComponentStatus;
    minHealth?: number;
    maxResponseTime?: number;
    availability?: boolean;

    // Advanced filters
    tags?: string[];
    capabilities?: string[];
    excludeComponents?: string[];

    // Performance requirements
    minSuccessRate?: number;
    maxErrorRate?: number;
    minReliability?: number;
}

export interface ComponentRanking {
    component: AIComponent;
    score: number;

    // Ranking factors
    factors: {
        health: number;
        performance: number;
        reliability: number;
        suitability: number;
        availability: number;
    };

    // Recommendation metadata
    recommendation: {
        confidence: number;
        reasons: string[];
        warnings: string[];
    };
}

/**
 * Component Registry - Central AI Component Management
 */
export class ComponentRegistry extends EventEmitter {
    private readonly logger = new Logger(ComponentRegistry.name);
    private readonly config: ComponentRegistryConfig;

    // Component storage
    private components = new Map<string, ComponentInfo>();
    private componentsByType = new Map<AIComponentType, Set<string>>();
    private componentsByTier = new Map<ComponentTier, Set<string>>();

    // Dependency graph
    private dependencyGraph = new Map<string, Set<string>>();
    private reverseDependencyGraph = new Map<string, Set<string>>();

    // Performance tracking
    private performanceHistory = new Map<string, number[]>();
    private selectionHistory: Array<{
        component: string;
        request: AIRequest;
        timestamp: number;
        success: boolean;
    }> = [];

    // Caching
    private queryCache = new Map<string, ComponentRanking[]>();
    private healthCache = new Map<string, ComponentHealth>();

    // State management
    private isInitialized = false;
    private registrationCount = 0;

    constructor(config: Partial<ComponentRegistryConfig> = {}) {
        super();

        this.config = {
            autoRegistration: true,
            loadOnDemand: true,
            caching: true,
            healthChecks: true,
            dependencyValidation: true,
            circularDependencyCheck: true,
            componentRanking: true,
            adaptiveSelection: true,
            autoCleanup: true,
            componentTimeouts: true,
            metricsCollection: true,
            performanceTracking: true,
            componentValidation: true,
            sandboxedLoading: false,
            ...config
        };
    }

    /**
     * Initialize the component registry
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            this.logger.warn('Component Registry already initialized');
            return;
        }

        try {
            this.logger.log('📝 Initializing Component Registry...');

            // Initialize data structures
            this.components.clear();
            this.componentsByType.clear();
            this.componentsByTier.clear();
            this.dependencyGraph.clear();
            this.reverseDependencyGraph.clear();

            // Initialize component types
            for (const type of Object.values(AIComponentType)) {
                this.componentsByType.set(type, new Set());
            }

            // Initialize tiers
            for (let tier = 1; tier <= 5; tier++) {
                this.componentsByTier.set(tier as ComponentTier, new Set());
            }

            // Start background tasks
            if (this.config.healthChecks) {
                this.startHealthChecking();
            }

            if (this.config.autoCleanup) {
                this.startAutoCleanup();
            }

            this.isInitialized = true;
            this.logger.log('✅ Component Registry initialized');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize Component Registry:', error);
            throw error;
        }
    }

    /**
     * Register a new AI component
     */
    async register(component: AIComponent): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Component Registry not initialized');
        }

        try {
            this.logger.debug(`Registering component: ${component.name}`);

            // Validate component
            if (this.config.componentValidation) {
                await this.validateComponent(component);
            }

            // Check for duplicates
            if (this.components.has(component.name)) {
                throw new Error(`Component ${component.name} already registered`);
            }

            // Create component info
            const componentInfo: ComponentInfo = {
                component,
                registrationTime: Date.now(),
                lastUsed: 0,
                usageCount: 0,
                status: ComponentStatus.HEALTHY,
                health: await this.getComponentHealth(component),
                performance: {
                    averageResponseTime: 0,
                    successRate: 1.0,
                    errorCount: 0,
                    totalExecutions: 0
                },
                dependencies: {
                    resolved: false,
                    missing: [],
                    circular: false
                },
                lifecycle: {
                    initialized: false,
                    loading: false,
                    ready: false
                }
            };

            // Store component
            this.components.set(component.name, componentInfo);

            // Index by type
            if (!this.componentsByType.has(component.type)) {
                this.componentsByType.set(component.type, new Set());
            }
            this.componentsByType.get(component.type)!.add(component.name);

            // Index by tier
            if (!this.componentsByTier.has(component.tier)) {
                this.componentsByTier.set(component.tier, new Set());
            }
            this.componentsByTier.get(component.tier)!.add(component.name);

            // Process dependencies
            if (this.config.dependencyValidation) {
                await this.processDependencies(component);
            }

            // Initialize component if needed
            if (component.initialize) {
                try {
                    componentInfo.lifecycle.loading = true;
                    await component.initialize();
                    componentInfo.lifecycle.initialized = true;
                    componentInfo.lifecycle.ready = true;
                } catch (error) {
                    componentInfo.lifecycle.error = error.message;
                    componentInfo.status = ComponentStatus.OFFLINE;
                    this.logger.error(`Failed to initialize component ${component.name}:`, error);
                } finally {
                    componentInfo.lifecycle.loading = false;
                }
            } else {
                componentInfo.lifecycle.ready = true;
            }

            this.registrationCount++;
            this.clearQueryCache();

            this.logger.log(`✅ Component ${component.name} registered successfully`);
            this.emit('component-registered', component.name, componentInfo);

        } catch (error) {
            this.logger.error(`❌ Failed to register component ${component.name}:`, error);
            throw error;
        }
    }

    /**
     * Unregister a component
     */
    async unregister(componentName: string): Promise<void> {
        const componentInfo = this.components.get(componentName);
        if (!componentInfo) {
            throw new Error(`Component ${componentName} not found`);
        }

        try {
            this.logger.debug(`Unregistering component: ${componentName}`);

            // Check for dependents
            const dependents = this.reverseDependencyGraph.get(componentName);
            if (dependents && dependents.size > 0) {
                const dependentNames = Array.from(dependents).join(', ');
                throw new Error(`Cannot unregister ${componentName}: used by ${dependentNames}`);
            }

            // Cleanup component
            if (componentInfo.component.cleanup) {
                await componentInfo.component.cleanup();
            }

            // Remove from indices
            this.componentsByType.get(componentInfo.component.type)?.delete(componentName);
            this.componentsByTier.get(componentInfo.component.tier)?.delete(componentName);

            // Remove from dependency graph
            this.dependencyGraph.delete(componentName);
            this.reverseDependencyGraph.delete(componentName);

            // Remove from main storage
            this.components.delete(componentName);

            // Clear caches
            this.clearQueryCache();
            this.healthCache.delete(componentName);
            this.performanceHistory.delete(componentName);

            this.logger.log(`✅ Component ${componentName} unregistered successfully`);
            this.emit('component-unregistered', componentName);

        } catch (error) {
            this.logger.error(`❌ Failed to unregister component ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * Get component by name
     */
    getComponent(name: string): AIComponent | null {
        const componentInfo = this.components.get(name);
        return componentInfo ? componentInfo.component : null;
    }

    /**
     * Get component info by name
     */
    getComponentInfo(name: string): ComponentInfo | null {
        return this.components.get(name) || null;
    }

    /**
     * Get all registered components
     */
    getAllComponents(): AIComponent[] {
        return Array.from(this.components.values()).map(info => info.component);
    }

    getComponents(): AIComponent[] {
        return this.getAllComponents();
    }

    /**
     * Get healthy components
     */
    async getHealthyComponents(): Promise<AIComponent[]> {
        const healthyComponents: AIComponent[] = [];

        for (const [name, info] of Array.from(this.components.entries())) {
            if (info.status === ComponentStatus.HEALTHY &&
                info.health.score > 0.7 &&
                info.lifecycle.ready) {
                healthyComponents.push(info.component);
            }
        }

        return healthyComponents;
    }

    /**
     * Query components with advanced filtering
     */
    async queryComponents(query: ComponentQuery): Promise<AIComponent[]> {
        const cacheKey = this.generateQueryCacheKey(query);

        if (this.config.caching && this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey)!;
            return cached.map(ranking => ranking.component);
        }

        const components: AIComponent[] = [];

        for (const [name, info] of Array.from(this.components.entries())) {
            if (this.matchesQuery(info, query)) {
                components.push(info.component);
            }
        }

        // Apply ranking if enabled
        if (this.config.componentRanking && components.length > 1) {
            const rankings = await this.rankComponents(components, query);

            if (this.config.caching) {
                this.queryCache.set(cacheKey, rankings);
            }

            return rankings.map(ranking => ranking.component);
        }

        return components;
    }

    /**
     * Get recommended components for a request
     */
    async getRecommendedComponents(request: AIRequest): Promise<ComponentRanking[]> {
        const query: ComponentQuery = {
            status: ComponentStatus.HEALTHY,
            minHealth: 0.5,
            availability: true
        };

        // Apply request-specific filters
        if (request.timeLimit < 1000) {
            query.tier = ComponentTier.CRITICAL;
        } else if (request.timeLimit < 5000) {
            query.tier = ComponentTier.STABLE;
        }

        if (request.difficulty > 0.8) {
            query.minSuccessRate = 0.8;
        }

        const components = await this.queryComponents(query);
        return await this.rankComponents(components, query, request);
    }

    /**
     * Get components by type
     */
    getComponentsByType(type: AIComponentType): AIComponent[] {
        const componentNames = this.componentsByType.get(type);
        if (!componentNames) return [];

        return Array.from(componentNames)
            .map(name => this.components.get(name))
            .filter(info => info && info.lifecycle.ready)
            .map(info => info!.component);
    }

    /**
     * Get components by tier
     */
    getComponentsByTier(tier: ComponentTier): AIComponent[] {
        const componentNames = this.componentsByTier.get(tier);
        if (!componentNames) return [];

        return Array.from(componentNames)
            .map(name => this.components.get(name))
            .filter(info => info && info.lifecycle.ready)
            .map(info => info!.component);
    }

    /**
     * Update component performance
     */
    async updateComponentPerformance(
        componentName: string,
        responseTime: number,
        success: boolean
    ): Promise<void> {
        const componentInfo = this.components.get(componentName);
        if (!componentInfo) return;

        const performance = componentInfo.performance;

        // Update execution count
        performance.totalExecutions++;

        // Update response time
        if (performance.averageResponseTime === 0) {
            performance.averageResponseTime = responseTime;
        } else {
            performance.averageResponseTime =
                (performance.averageResponseTime * (performance.totalExecutions - 1) + responseTime) /
                performance.totalExecutions;
        }

        // Update success rate
        if (success) {
            performance.successRate =
                (performance.successRate * (performance.totalExecutions - 1) + 1) /
                performance.totalExecutions;
        } else {
            performance.errorCount++;
            performance.successRate =
                (performance.successRate * (performance.totalExecutions - 1)) /
                performance.totalExecutions;
        }

        // Update performance history
        if (this.config.performanceTracking) {
            if (!this.performanceHistory.has(componentName)) {
                this.performanceHistory.set(componentName, []);
            }

            const history = this.performanceHistory.get(componentName)!;
            history.push(responseTime);

            // Keep only last 100 measurements
            if (history.length > 100) {
                history.shift();
            }
        }

        // Update last used time
        componentInfo.lastUsed = Date.now();
        componentInfo.usageCount++;

        // Clear cache
        this.clearQueryCache();

        this.emit('performance-updated', componentName, performance);
    }

    /**
     * Update component health
     */
    async updateComponentHealth(componentName: string, health: ComponentHealth): Promise<void> {
        const componentInfo = this.components.get(componentName);
        if (!componentInfo) return;

        const previousHealth = componentInfo.health;
        componentInfo.health = health;

        // Update status based on health
        if (health.score > 0.8) {
            componentInfo.status = ComponentStatus.HEALTHY;
        } else if (health.score > 0.5) {
            componentInfo.status = ComponentStatus.DEGRADED;
        } else if (health.score > 0.2) {
            componentInfo.status = ComponentStatus.UNHEALTHY;
        } else {
            componentInfo.status = ComponentStatus.OFFLINE;
        }

        // Cache health
        this.healthCache.set(componentName, health);

        // Clear query cache
        this.clearQueryCache();

        this.emit('health-updated', componentName, health, previousHealth);
    }

    /**
     * Get component count
     */
    getComponentCount(): number {
        return this.components.size;
    }

    /**
     * Get registry statistics
     */
    getStatistics(): {
        totalComponents: number;
        componentsByType: { [type: string]: number };
        componentsByTier: { [tier: string]: number };
        componentsByStatus: { [status: string]: number };
        healthyComponents: number;
        averageHealth: number;
        registrationCount: number;
        dependencyStats: {
            totalDependencies: number;
            resolvedDependencies: number;
            circularDependencies: number;
        };
    } {
        const stats = {
            totalComponents: this.components.size,
            componentsByType: {} as { [type: string]: number },
            componentsByTier: {} as { [tier: string]: number },
            componentsByStatus: {} as { [status: string]: number },
            healthyComponents: 0,
            averageHealth: 0,
            registrationCount: this.registrationCount,
            dependencyStats: {
                totalDependencies: 0,
                resolvedDependencies: 0,
                circularDependencies: 0
            }
        };

        let totalHealth = 0;

        for (const [name, info] of Array.from(this.components.entries())) {
            // Count by type
            const type = info.component.type;
            stats.componentsByType[type] = (stats.componentsByType[type] || 0) + 1;

            // Count by tier
            const tier = info.component.tier.toString();
            stats.componentsByTier[tier] = (stats.componentsByTier[tier] || 0) + 1;

            // Count by status
            const status = info.status;
            stats.componentsByStatus[status] = (stats.componentsByStatus[status] || 0) + 1;

            // Health statistics
            if (info.status === ComponentStatus.HEALTHY) {
                stats.healthyComponents++;
            }

            totalHealth += info.health.score;

            // Dependency statistics
            stats.dependencyStats.totalDependencies += info.component.dependencies.length;
            if (info.dependencies.resolved) {
                stats.dependencyStats.resolvedDependencies++;
            }
            if (info.dependencies.circular) {
                stats.dependencyStats.circularDependencies++;
            }
        }

        stats.averageHealth = this.components.size > 0 ? totalHealth / this.components.size : 0;

        return stats;
    }

    /**
     * Validate component
     */
    private async validateComponent(component: AIComponent): Promise<void> {
        if (!component.name || typeof component.name !== 'string') {
            throw new Error('Component name must be a non-empty string');
        }

        if (!component.type || !Object.values(AIComponentType).includes(component.type)) {
            throw new Error('Component type must be a valid AIComponentType');
        }

        if (!component.tier || component.tier < 1 || component.tier > 5) {
            throw new Error('Component tier must be between 1 and 5');
        }

        if (!component.priority || component.priority < 1) {
            throw new Error('Component priority must be a positive number');
        }

        if (!component.timeout || component.timeout < 1) {
            throw new Error('Component timeout must be a positive number');
        }

        if (!component.memoryLimit || component.memoryLimit < 1) {
            throw new Error('Component memory limit must be a positive number');
        }

        if (!component.dependencies || !Array.isArray(component.dependencies)) {
            throw new Error('Component dependencies must be an array');
        }

        if (!component.healthCheck || typeof component.healthCheck !== 'function') {
            throw new Error('Component must have a healthCheck function');
        }
    }

    /**
     * Process component dependencies
     */
    private async processDependencies(component: AIComponent): Promise<void> {
        const componentInfo = this.components.get(component.name)!;

        // Clear previous dependencies
        this.dependencyGraph.set(component.name, new Set());

        // Process each dependency
        for (const depName of component.dependencies) {
            // Check if dependency exists
            if (!this.components.has(depName)) {
                componentInfo.dependencies.missing.push(depName);
                continue;
            }

            // Add to dependency graph
            this.dependencyGraph.get(component.name)!.add(depName);

            // Add to reverse dependency graph
            if (!this.reverseDependencyGraph.has(depName)) {
                this.reverseDependencyGraph.set(depName, new Set());
            }
            this.reverseDependencyGraph.get(depName)!.add(component.name);
        }

        // Check for circular dependencies
        if (this.config.circularDependencyCheck) {
            componentInfo.dependencies.circular = this.hasCircularDependency(component.name);
        }

        // Mark as resolved if no missing dependencies
        componentInfo.dependencies.resolved = componentInfo.dependencies.missing.length === 0;
    }

    /**
     * Check for circular dependencies
     */
    private hasCircularDependency(componentName: string, visited = new Set<string>()): boolean {
        if (visited.has(componentName)) {
            return true;
        }

        visited.add(componentName);

        const dependencies = this.dependencyGraph.get(componentName);
        if (dependencies) {
            for (const dep of dependencies) {
                if (this.hasCircularDependency(dep, new Set(visited))) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get component health
     */
    private async getComponentHealth(component: AIComponent): Promise<ComponentHealth> {
        if (this.config.caching && this.healthCache.has(component.name)) {
            return this.healthCache.get(component.name)!;
        }

        try {
            const health = await component.healthCheck();

            if (this.config.caching) {
                this.healthCache.set(component.name, health);
            }

            return health;
        } catch (error) {
            this.logger.error(`Health check failed for ${component.name}:`, error);

            const failedHealth: ComponentHealth = {
                score: 0.0,
                status: ComponentStatus.UNHEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    errorRate: 1.0,
                    lastError: error.message
                }
            };

            return failedHealth;
        }
    }

    /**
     * Check if component info matches query
     */
    private matchesQuery(info: ComponentInfo, query: ComponentQuery): boolean {
        // Check type
        if (query.type && info.component.type !== query.type) {
            return false;
        }

        // Check tier
        if (query.tier && info.component.tier !== query.tier) {
            return false;
        }

        // Check status
        if (query.status && info.status !== query.status) {
            return false;
        }

        // Check health
        if (query.minHealth && info.health.score < query.minHealth) {
            return false;
        }

        // Check response time
        if (query.maxResponseTime && info.performance.averageResponseTime > query.maxResponseTime) {
            return false;
        }

        // Check availability
        if (query.availability && !info.lifecycle.ready) {
            return false;
        }

        // Check success rate
        if (query.minSuccessRate && info.performance.successRate < query.minSuccessRate) {
            return false;
        }

        // Check error rate
        if (query.maxErrorRate && (1 - info.performance.successRate) > query.maxErrorRate) {
            return false;
        }

        // Check exclusions
        if (query.excludeComponents && query.excludeComponents.includes(info.component.name)) {
            return false;
        }

        return true;
    }

    /**
     * Rank components for selection
     */
    private async rankComponents(
        components: AIComponent[],
        query: ComponentQuery,
        request?: AIRequest
    ): Promise<ComponentRanking[]> {
        const rankings: ComponentRanking[] = [];

        for (const component of components) {
            const info = this.components.get(component.name)!;

            // Calculate ranking factors
            const factors = {
                health: info.health.score,
                performance: Math.max(0, 1 - (info.performance.averageResponseTime / 10000)),
                reliability: info.performance.successRate,
                suitability: this.calculateSuitability(component, query, request),
                availability: info.lifecycle.ready ? 1 : 0
            };

            // Calculate overall score
            const score = (
                factors.health * 0.3 +
                factors.performance * 0.25 +
                factors.reliability * 0.25 +
                factors.suitability * 0.15 +
                factors.availability * 0.05
            );

            // Generate recommendation
            const recommendation = {
                confidence: score,
                reasons: this.generateRecommendationReasons(component, factors),
                warnings: this.generateRecommendationWarnings(component, factors)
            };

            rankings.push({
                component,
                score,
                factors,
                recommendation
            });
        }

        // Sort by score descending
        rankings.sort((a, b) => b.score - a.score);

        return rankings;
    }

    /**
     * Calculate component suitability for request
     */
    private calculateSuitability(
        component: AIComponent,
        query: ComponentQuery,
        request?: AIRequest
    ): number {
        let suitability = 0.5; // Base suitability

        // Tier-based suitability
        if (request?.timeLimit) {
            if (request.timeLimit < 1000 && component.tier === ComponentTier.CRITICAL) {
                suitability += 0.3;
            } else if (request.timeLimit < 5000 && component.tier === ComponentTier.STABLE) {
                suitability += 0.2;
            } else if (request.timeLimit >= 5000 && component.tier >= ComponentTier.ADVANCED) {
                suitability += 0.1;
            }
        }

        // Type-based suitability
        if (request?.strategy) {
            if (request.strategy === 'minimax' && component.type === AIComponentType.MINIMAX) {
                suitability += 0.2;
            } else if (request.strategy === 'neural' && component.type === AIComponentType.NEURAL) {
                suitability += 0.2;
            }
        }

        // Difficulty-based suitability
        if (request?.difficulty) {
            if (request.difficulty > 0.8 && component.tier >= ComponentTier.ADVANCED) {
                suitability += 0.1;
            } else if (request.difficulty < 0.3 && component.tier <= ComponentTier.STABLE) {
                suitability += 0.1;
            }
        }

        return Math.min(1.0, suitability);
    }

    /**
     * Generate recommendation reasons
     */
    private generateRecommendationReasons(component: AIComponent, factors: any): string[] {
        const reasons: string[] = [];

        if (factors.health > 0.9) {
            reasons.push('Excellent health score');
        }

        if (factors.performance > 0.8) {
            reasons.push('High performance');
        }

        if (factors.reliability > 0.9) {
            reasons.push('Very reliable');
        }

        if (component.tier <= ComponentTier.STABLE) {
            reasons.push('Low-risk component');
        }

        return reasons;
    }

    /**
     * Generate recommendation warnings
     */
    private generateRecommendationWarnings(component: AIComponent, factors: any): string[] {
        const warnings: string[] = [];

        if (factors.health < 0.7) {
            warnings.push('Component health is degraded');
        }

        if (factors.performance < 0.5) {
            warnings.push('Performance may be slow');
        }

        if (factors.reliability < 0.8) {
            warnings.push('Component may be unreliable');
        }

        if (component.tier >= ComponentTier.EXPERIMENTAL) {
            warnings.push('Experimental component - may fail');
        }

        return warnings;
    }

    /**
     * Start health checking
     */
    private startHealthChecking(): void {
        setInterval(async () => {
            for (const [name, info] of Array.from(this.components.entries())) {
                try {
                    const health = await this.getComponentHealth(info.component);
                    await this.updateComponentHealth(name, health);
                } catch (error) {
                    this.logger.error(`Health check failed for ${name}:`, error);
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Start auto cleanup
     */
    private startAutoCleanup(): void {
        setInterval(() => {
            // Clear old cache entries
            this.clearQueryCache();

            // Clear old performance history
            const cutoffTime = Date.now() - 3600000; // 1 hour ago
            for (const [name, history] of Array.from(this.performanceHistory.entries())) {
                if (history.length > 100) {
                    this.performanceHistory.set(name, history.slice(-50));
                }
            }

            // Clear old selection history
            this.selectionHistory = this.selectionHistory.filter(
                entry => entry.timestamp > cutoffTime
            );

        }, 300000); // Cleanup every 5 minutes
    }

    /**
     * Clear query cache
     */
    private clearQueryCache(): void {
        this.queryCache.clear();
    }

    /**
     * Generate query cache key
     */
    private generateQueryCacheKey(query: ComponentQuery): string {
        return JSON.stringify(query);
    }

    /**
     * Shutdown the registry
     */
    async shutdown(): Promise<void> {
        this.logger.log('🛑 Shutting down Component Registry...');

        // Cleanup all components
        for (const [name, info] of Array.from(this.components.entries())) {
            if (info.component.cleanup) {
                try {
                    await info.component.cleanup();
                } catch (error) {
                    this.logger.error(`Failed to cleanup component ${name}:`, error);
                }
            }
        }

        // Clear all data
        this.components.clear();
        this.componentsByType.clear();
        this.componentsByTier.clear();
        this.dependencyGraph.clear();
        this.reverseDependencyGraph.clear();
        this.queryCache.clear();
        this.healthCache.clear();
        this.performanceHistory.clear();
        this.selectionHistory = [];

        this.logger.log('✅ Component Registry shutdown complete');
        this.emit('shutdown');
    }
} 