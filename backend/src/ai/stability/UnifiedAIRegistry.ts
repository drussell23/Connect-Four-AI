/**
 * Unified AI Registry
 * 
 * This system provides a centralized registry for all AI components integrated
 * with the stability architecture, handling automatic registration, discovery,
 * and management of diverse AI algorithms and systems.
 */

import { ComponentRegistry } from './ComponentRegistry';
import { AIComponentIntegrator, ComponentWrapper } from './AIComponentIntegrator';
import {
    AIComponent,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    ComponentHealth,
    ComponentMetrics
} from './interfaces';

export interface RegistryConfig {
    autoDiscovery: boolean;
    autoRegistration: boolean;
    healthCheckInterval: number;
    componentValidation: boolean;
    performanceTracking: boolean;
    categorization: {
        enableGrouping: boolean;
        tierBasedPriority: boolean;
        typeBasedRouting: boolean;
    };
    metadata: {
        trackUsage: boolean;
        collectMetrics: boolean;
        auditChanges: boolean;
    };
}

export interface ComponentInfo {
    component: AIComponent;
    wrapper: ComponentWrapper;
    registrationTime: number;
    lastHealthCheck: number;
    usageCount: number;
    performanceHistory: Array<{
        timestamp: number;
        responseTime: number;
        successRate: number;
    }>;
    metadata: {
        category: string;
        algorithm: string;
        version: string;
        capabilities: string[];
        requirements: any;
    };
}

export interface RegistryStats {
    totalComponents: number;
    componentsByTier: { [tier: string]: number };
    componentsByType: { [type: string]: number };
    componentsByCategory: { [category: string]: number };
    healthyComponents: number;
    degradedComponents: number;
    unhealthyComponents: number;
    offlineComponents: number;
    averageResponseTime: number;
    totalRequests: number;
    successRate: number;
}

/**
 * Unified AI Component Registry
 * 
 * Manages the registration and organization of all AI components
 * in the stability architecture with advanced discovery and management features.
 */
export class UnifiedAIRegistry {
    private config: RegistryConfig;
    private coreRegistry: ComponentRegistry;
    private integrator: AIComponentIntegrator;
    private componentInfo: Map<string, ComponentInfo> = new Map();
    private categoryIndex: Map<string, Set<string>> = new Map();
    private tierIndex: Map<ComponentTier, Set<string>> = new Map();
    private typeIndex: Map<AIComponentType, Set<string>> = new Map();
    private healthIndex: Map<ComponentStatus, Set<string>> = new Map();
    private registryStats: RegistryStats;
    private isInitialized = false;

    constructor(
        config: Partial<RegistryConfig> = {},
        coreRegistry?: ComponentRegistry,
        integrator?: AIComponentIntegrator
    ) {
        this.config = {
            autoDiscovery: true,
            autoRegistration: true,
            healthCheckInterval: 30000,
            componentValidation: true,
            performanceTracking: true,
            categorization: {
                enableGrouping: true,
                tierBasedPriority: true,
                typeBasedRouting: true
            },
            metadata: {
                trackUsage: true,
                collectMetrics: true,
                auditChanges: true
            },
            ...config
        };

        this.coreRegistry = coreRegistry || new ComponentRegistry({
            autoRegistration: true,
            loadOnDemand: true,
            healthChecks: true,
            componentValidation: true,
            performanceTracking: true,
            caching: true
        });

        this.integrator = integrator || new AIComponentIntegrator({
            integrationMode: 'production'
        });

        this.initializeIndexes();
        this.initializeStats();
    }

    // === Initialization ===

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('⚠️ UnifiedAIRegistry already initialized');
            return;
        }

        console.log('🚀 Initializing Unified AI Registry...');

        try {
            // Initialize core registry
            await this.coreRegistry.initialize();

            // Auto-discovery and integration
            if (this.config.autoDiscovery) {
                await this.discoverAndIntegrateComponents();
            }

            // Auto-registration
            if (this.config.autoRegistration) {
                await this.registerAllComponents();
            }

            // Start health monitoring
            if (this.config.healthCheckInterval > 0) {
                this.startHealthMonitoring();
            }

            this.isInitialized = true;
            console.log('✅ Unified AI Registry initialized successfully');

            // Display registration summary
            this.displayRegistrationSummary();

        } catch (error) {
            console.error('❌ Failed to initialize Unified AI Registry:', error);
            throw error;
        }
    }

    private async discoverAndIntegrateComponents(): Promise<void> {
        console.log('🔍 Discovering and integrating AI components...');

        try {
            // Integrate all available AI components
            const wrappedComponents = await this.integrator.integrateAllComponents();

            console.log(`✅ Discovered and integrated ${wrappedComponents.size} components`);

            // Store component information
            for (const [name, wrapper] of wrappedComponents) {
                const componentInfo: ComponentInfo = {
                    component: wrapper.component,
                    wrapper,
                    registrationTime: Date.now(),
                    lastHealthCheck: 0,
                    usageCount: 0,
                    performanceHistory: [],
                    metadata: {
                        category: wrapper.metadata.category,
                        algorithm: wrapper.metadata.algorithm,
                        version: wrapper.metadata.version,
                        capabilities: wrapper.metadata.capabilities,
                        requirements: wrapper.metadata.requirements
                    }
                };

                this.componentInfo.set(name, componentInfo);
                this.updateIndexes(name, wrapper.component, wrapper.metadata.category);
            }

        } catch (error) {
            console.error('❌ Component discovery failed:', error);
            throw error;
        }
    }

    private async registerAllComponents(): Promise<void> {
        console.log('📝 Registering all components with core registry...');

        let registeredCount = 0;
        let failedCount = 0;

        for (const [name, info] of this.componentInfo) {
            try {
                await this.coreRegistry.register(info.component);
                registeredCount++;
                console.log(`  ✓ Registered ${name}`);
            } catch (error) {
                failedCount++;
                console.error(`  ❌ Failed to register ${name}:`, error.message);
            }
        }

        console.log(`✅ Registration complete: ${registeredCount} successful, ${failedCount} failed`);
    }

    private initializeIndexes(): void {
        // Initialize tier index
        for (const tier of Object.values(ComponentTier)) {
            if (typeof tier === 'number') {
                this.tierIndex.set(tier, new Set());
            }
        }

        // Initialize type index
        for (const type of Object.values(AIComponentType)) {
            this.typeIndex.set(type, new Set());
        }

        // Initialize health index
        for (const status of Object.values(ComponentStatus)) {
            this.healthIndex.set(status, new Set());
        }
    }

    private initializeStats(): void {
        this.registryStats = {
            totalComponents: 0,
            componentsByTier: {},
            componentsByType: {},
            componentsByCategory: {},
            healthyComponents: 0,
            degradedComponents: 0,
            unhealthyComponents: 0,
            offlineComponents: 0,
            averageResponseTime: 0,
            totalRequests: 0,
            successRate: 1.0
        };
    }

    private updateIndexes(name: string, component: AIComponent, category: string): void {
        // Update category index
        if (!this.categoryIndex.has(category)) {
            this.categoryIndex.set(category, new Set());
        }
        this.categoryIndex.get(category)!.add(name);

        // Update tier index
        this.tierIndex.get(component.tier)?.add(name);

        // Update type index
        this.typeIndex.get(component.type)?.add(name);

        // Initialize in healthy status
        this.healthIndex.get(ComponentStatus.HEALTHY)?.add(name);
    }

    // === Component Management ===

    async registerComponent(component: AIComponent, metadata?: any): Promise<void> {
        if (this.componentInfo.has(component.name)) {
            console.warn(`⚠️ Component ${component.name} already registered`);
            return;
        }

        try {
            // Register with core registry
            await this.coreRegistry.register(component);

            // Create component info
            const componentInfo: ComponentInfo = {
                component,
                wrapper: {
                    component,
                    originalInstance: null,
                    metadata: metadata || {
                        category: 'custom',
                        algorithm: 'Custom Algorithm',
                        version: '1.0.0',
                        author: 'User',
                        description: 'Custom registered component',
                        capabilities: [],
                        requirements: { memory: 256, cpu: 30 }
                    }
                },
                registrationTime: Date.now(),
                lastHealthCheck: 0,
                usageCount: 0,
                performanceHistory: [],
                metadata: metadata || {}
            };

            this.componentInfo.set(component.name, componentInfo);
            this.updateIndexes(component.name, component, metadata?.category || 'custom');
            this.updateStats();

            console.log(`✅ Registered custom component: ${component.name}`);

        } catch (error) {
            console.error(`❌ Failed to register component ${component.name}:`, error);
            throw error;
        }
    }

    async unregisterComponent(componentName: string): Promise<void> {
        const info = this.componentInfo.get(componentName);
        if (!info) {
            console.warn(`⚠️ Component ${componentName} not found`);
            return;
        }

        try {
            // Unregister from core registry
            await this.coreRegistry.unregister(componentName);

            // Remove from indexes
            this.removeFromIndexes(componentName, info.component, info.metadata.category);

            // Remove component info
            this.componentInfo.delete(componentName);
            this.updateStats();

            console.log(`✅ Unregistered component: ${componentName}`);

        } catch (error) {
            console.error(`❌ Failed to unregister component ${componentName}:`, error);
            throw error;
        }
    }

    private removeFromIndexes(name: string, component: AIComponent, category: string): void {
        this.categoryIndex.get(category)?.delete(name);
        this.tierIndex.get(component.tier)?.delete(name);
        this.typeIndex.get(component.type)?.delete(name);

        // Remove from all health statuses
        for (const statusSet of this.healthIndex.values()) {
            statusSet.delete(name);
        }
    }

    // === Component Discovery ===

    getComponentsByCategory(category: string): ComponentInfo[] {
        const componentNames = this.categoryIndex.get(category) || new Set();
        return Array.from(componentNames)
            .map(name => this.componentInfo.get(name)!)
            .filter(Boolean);
    }

    getComponentsByTier(tier: ComponentTier): ComponentInfo[] {
        const componentNames = this.tierIndex.get(tier) || new Set();
        return Array.from(componentNames)
            .map(name => this.componentInfo.get(name)!)
            .filter(Boolean);
    }

    getComponentsByType(type: AIComponentType): ComponentInfo[] {
        const componentNames = this.typeIndex.get(type) || new Set();
        return Array.from(componentNames)
            .map(name => this.componentInfo.get(name)!)
            .filter(Boolean);
    }

    getComponentsByHealth(status: ComponentStatus): ComponentInfo[] {
        const componentNames = this.healthIndex.get(status) || new Set();
        return Array.from(componentNames)
            .map(name => this.componentInfo.get(name)!)
            .filter(Boolean);
    }

    getComponentInfo(componentName: string): ComponentInfo | undefined {
        return this.componentInfo.get(componentName);
    }

    getAllComponents(): ComponentInfo[] {
        return Array.from(this.componentInfo.values());
    }

    // === Smart Component Selection ===

    selectBestComponent(criteria: {
        tier?: ComponentTier;
        type?: AIComponentType;
        category?: string;
        requireCapabilities?: string[];
        maxResponseTime?: number;
        minHealthScore?: number;
    }): ComponentInfo | null {
        let candidates = this.getAllComponents();

        // Filter by criteria
        if (criteria.tier !== undefined) {
            candidates = candidates.filter(info => info.component.tier === criteria.tier);
        }

        if (criteria.type !== undefined) {
            candidates = candidates.filter(info => info.component.type === criteria.type);
        }

        if (criteria.category) {
            candidates = candidates.filter(info => info.metadata.category === criteria.category);
        }

        if (criteria.requireCapabilities && criteria.requireCapabilities.length > 0) {
            candidates = candidates.filter(info =>
                criteria.requireCapabilities!.every(cap =>
                    info.metadata.capabilities.includes(cap)
                )
            );
        }

        if (criteria.maxResponseTime !== undefined) {
            candidates = candidates.filter(info =>
                info.performanceHistory.length === 0 ||
                this.getAverageResponseTime(info) <= criteria.maxResponseTime!
            );
        }

        if (criteria.minHealthScore !== undefined) {
            candidates = candidates.filter(info =>
                this.getHealthScore(info) >= criteria.minHealthScore!
            );
        }

        if (candidates.length === 0) {
            return null;
        }

        // Select best candidate based on multiple factors
        return candidates.reduce((best, current) => {
            const bestScore = this.calculateComponentScore(best);
            const currentScore = this.calculateComponentScore(current);
            return currentScore > bestScore ? current : best;
        });
    }

    selectComponentsForTier(tier: ComponentTier, count: number = 3): ComponentInfo[] {
        const tierComponents = this.getComponentsByTier(tier);

        // Sort by performance score
        tierComponents.sort((a, b) =>
            this.calculateComponentScore(b) - this.calculateComponentScore(a)
        );

        return tierComponents.slice(0, count);
    }

    // === Health Monitoring ===

    private startHealthMonitoring(): void {
        setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }

    private async performHealthChecks(): Promise<void> {
        if (!this.config.componentValidation) return;

        for (const [name, info] of this.componentInfo) {
            try {
                const health = await info.component.healthCheck();
                info.lastHealthCheck = Date.now();

                // Update health index
                this.updateHealthIndex(name, health.status);

                // Track performance
                if (this.config.performanceTracking && health.metrics) {
                    this.trackPerformance(info, health);
                }

            } catch (error) {
                console.error(`❌ Health check failed for ${name}:`, error.message);
                this.updateHealthIndex(name, ComponentStatus.OFFLINE);
            }
        }

        this.updateStats();
    }

    private updateHealthIndex(componentName: string, newStatus: ComponentStatus): void {
        // Remove from all health statuses
        for (const statusSet of this.healthIndex.values()) {
            statusSet.delete(componentName);
        }

        // Add to new status
        this.healthIndex.get(newStatus)?.add(componentName);
    }

    private trackPerformance(info: ComponentInfo, health: ComponentHealth): void {
        const performanceEntry = {
            timestamp: Date.now(),
            responseTime: health.metrics?.responseTime || 0,
            successRate: health.metrics?.successRate || 0
        };

        info.performanceHistory.push(performanceEntry);

        // Keep only recent history
        const maxHistoryLength = 100;
        if (info.performanceHistory.length > maxHistoryLength) {
            info.performanceHistory = info.performanceHistory.slice(-maxHistoryLength);
        }
    }

    // === Statistics and Analytics ===

    private updateStats(): void {
        this.registryStats.totalComponents = this.componentInfo.size;

        // Reset counters
        this.registryStats.componentsByTier = {};
        this.registryStats.componentsByType = {};
        this.registryStats.componentsByCategory = {};

        // Count by tier
        for (const [tier, componentSet] of this.tierIndex) {
            this.registryStats.componentsByTier[ComponentTier[tier] || tier] = componentSet.size;
        }

        // Count by type
        for (const [type, componentSet] of this.typeIndex) {
            this.registryStats.componentsByType[type] = componentSet.size;
        }

        // Count by category
        for (const [category, componentSet] of this.categoryIndex) {
            this.registryStats.componentsByCategory[category] = componentSet.size;
        }

        // Count by health status
        this.registryStats.healthyComponents = this.healthIndex.get(ComponentStatus.HEALTHY)?.size || 0;
        this.registryStats.degradedComponents = this.healthIndex.get(ComponentStatus.DEGRADED)?.size || 0;
        this.registryStats.unhealthyComponents = this.healthIndex.get(ComponentStatus.UNHEALTHY)?.size || 0;
        this.registryStats.offlineComponents = this.healthIndex.get(ComponentStatus.OFFLINE)?.size || 0;

        // Calculate aggregate metrics
        this.calculateAggregateMetrics();
    }

    private calculateAggregateMetrics(): void {
        const allComponents = this.getAllComponents();

        if (allComponents.length === 0) {
            this.registryStats.averageResponseTime = 0;
            this.registryStats.totalRequests = 0;
            this.registryStats.successRate = 1.0;
            return;
        }

        let totalResponseTime = 0;
        let totalRequests = 0;
        let totalSuccessful = 0;

        for (const info of allComponents) {
            totalRequests += info.usageCount;

            if (info.performanceHistory.length > 0) {
                const avgResponseTime = this.getAverageResponseTime(info);
                totalResponseTime += avgResponseTime * info.usageCount;

                const avgSuccessRate = this.getAverageSuccessRate(info);
                totalSuccessful += avgSuccessRate * info.usageCount;
            }
        }

        this.registryStats.averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
        this.registryStats.totalRequests = totalRequests;
        this.registryStats.successRate = totalRequests > 0 ? totalSuccessful / totalRequests : 1.0;
    }

    // === Helper Methods ===

    private calculateComponentScore(info: ComponentInfo): number {
        const healthScore = this.getHealthScore(info);
        const performanceScore = this.getPerformanceScore(info);
        const priorityScore = info.component.priority / 100;

        return (healthScore * 0.4) + (performanceScore * 0.4) + (priorityScore * 0.2);
    }

    private getHealthScore(info: ComponentInfo): number {
        // Simulate health score based on component tier and type
        const tierScore = {
            [ComponentTier.CRITICAL]: 0.95,
            [ComponentTier.STABLE]: 0.90,
            [ComponentTier.ADVANCED]: 0.85,
            [ComponentTier.EXPERIMENTAL]: 0.75,
            [ComponentTier.RESEARCH]: 0.70
        };

        return tierScore[info.component.tier] || 0.80;
    }

    private getPerformanceScore(info: ComponentInfo): number {
        if (info.performanceHistory.length === 0) {
            return 0.80; // Default score
        }

        const avgResponseTime = this.getAverageResponseTime(info);
        const avgSuccessRate = this.getAverageSuccessRate(info);

        // Normalize response time (lower is better)
        const timeScore = Math.max(0, 1 - (avgResponseTime / info.component.timeout));

        return (timeScore * 0.5) + (avgSuccessRate * 0.5);
    }

    private getAverageResponseTime(info: ComponentInfo): number {
        if (info.performanceHistory.length === 0) return 0;

        const total = info.performanceHistory.reduce((sum, entry) => sum + entry.responseTime, 0);
        return total / info.performanceHistory.length;
    }

    private getAverageSuccessRate(info: ComponentInfo): number {
        if (info.performanceHistory.length === 0) return 1.0;

        const total = info.performanceHistory.reduce((sum, entry) => sum + entry.successRate, 0);
        return total / info.performanceHistory.length;
    }

    private displayRegistrationSummary(): void {
        console.log('\n📊 Registration Summary:');
        console.log(`  Total components: ${this.registryStats.totalComponents}`);

        console.log('\n  By Tier:');
        for (const [tier, count] of Object.entries(this.registryStats.componentsByTier)) {
            console.log(`    ${tier}: ${count}`);
        }

        console.log('\n  By Category:');
        for (const [category, count] of Object.entries(this.registryStats.componentsByCategory)) {
            console.log(`    ${category}: ${count}`);
        }

        console.log(`\n  Health Status:`);
        console.log(`    Healthy: ${this.registryStats.healthyComponents}`);
        console.log(`    Degraded: ${this.registryStats.degradedComponents}`);
        console.log(`    Unhealthy: ${this.registryStats.unhealthyComponents}`);
        console.log(`    Offline: ${this.registryStats.offlineComponents}`);
    }

    // === Public Interface ===

    getRegistryStats(): RegistryStats {
        return { ...this.registryStats };
    }

    getCoreRegistry(): ComponentRegistry {
        return this.coreRegistry;
    }

    getIntegrator(): AIComponentIntegrator {
        return this.integrator;
    }

    async getComponentMetrics(componentName: string): Promise<ComponentMetrics | null> {
        const info = this.componentInfo.get(componentName);
        if (!info || !info.component.getMetrics) {
            return null;
        }

        try {
            return await info.component.getMetrics();
        } catch (error) {
            console.error(`❌ Failed to get metrics for ${componentName}:`, error);
            return null;
        }
    }

    incrementUsageCount(componentName: string): void {
        const info = this.componentInfo.get(componentName);
        if (info) {
            info.usageCount++;
        }
    }

    generateRegistryReport(): string {
        const stats = this.getRegistryStats();

        return `
Unified AI Registry Report
=========================

Components Overview:
- Total Components: ${stats.totalComponents}
- Healthy: ${stats.healthyComponents}
- Degraded: ${stats.degradedComponents}
- Unhealthy: ${stats.unhealthyComponents}
- Offline: ${stats.offlineComponents}

Performance Metrics:
- Average Response Time: ${stats.averageResponseTime.toFixed(1)}ms
- Total Requests: ${stats.totalRequests}
- Success Rate: ${(stats.successRate * 100).toFixed(1)}%

Distribution by Tier:
${Object.entries(stats.componentsByTier)
                .map(([tier, count]) => `- ${tier}: ${count}`)
                .join('\n')}

Distribution by Category:
${Object.entries(stats.componentsByCategory)
                .map(([category, count]) => `- ${category}: ${count}`)
                .join('\n')}

Registry Status: ${this.isInitialized ? '✅ ACTIVE' : '❌ INACTIVE'}
        `;
    }

    async shutdown(): Promise<void> {
        console.log('🧹 Shutting down Unified AI Registry...');

        try {
            await this.coreRegistry.shutdown();
            this.componentInfo.clear();
            this.categoryIndex.clear();
            this.tierIndex.clear();
            this.typeIndex.clear();
            this.healthIndex.clear();

            this.isInitialized = false;
            console.log('✅ Unified AI Registry shutdown complete');
        } catch (error) {
            console.error('❌ Registry shutdown error:', error);
        }
    }
} 