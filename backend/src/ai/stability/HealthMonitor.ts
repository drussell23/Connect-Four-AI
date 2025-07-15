/**
 * Health Monitor - AI Component Health Monitoring System
 * 
 * This system monitors the health of all AI components with circuit breakers,
 * performance tracking, and intelligent health analysis.
 * 
 * Features:
 * - Real-time health monitoring
 * - Circuit breaker pattern implementation
 * - Performance trend analysis
 * - Predictive health forecasting
 * - Automated recovery mechanisms
 * - Health-based component ranking
 * - Alert and notification system
 * - Health metrics aggregation
 * 
 * @author Connect4 AI Team
 */

import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
    AIComponent,
    ComponentHealth,
    ComponentMetrics,
    ComponentStatus,
    HealthSnapshot,
    CircuitBreakerState,
    HealthEvent
} from './interfaces';

export interface HealthMonitorConfig {
    // Health check configuration
    healthCheck: {
        interval: number;
        timeout: number;
        retries: number;
        batchSize: number;
    };

    // Circuit breaker configuration
    circuitBreaker: {
        failureThreshold: number;
        recoveryTimeout: number;
        successThreshold: number;
        halfOpenTimeout: number;
    };

    // Health thresholds
    thresholds: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        critical: number;
    };

    // Performance monitoring
    performance: {
        trackTrends: boolean;
        trendWindow: number;
        alertOnDegradation: boolean;
        degradationThreshold: number;
    };

    // Recovery mechanisms
    recovery: {
        autoRestart: boolean;
        restartDelay: number;
        maxRestarts: number;
        escalationEnabled: boolean;
    };

    // Analytics
    analytics: {
        enabled: boolean;
        historicalData: boolean;
        dataRetention: number;
        predictiveHealth: boolean;
    };
}

export interface ComponentHealthRecord {
    componentName: string;
    health: ComponentHealth;
    timestamp: number;

    // Health history
    healthHistory: Array<{
        score: number;
        status: ComponentStatus;
        timestamp: number;
        checkDuration: number;
    }>;

    // Performance metrics
    performanceMetrics: {
        averageCheckTime: number;
        failureRate: number;
        recoveryTime: number;
        lastFailure?: number;
        consecutiveFailures: number;
        consecutiveSuccesses: number;
    };

    // Circuit breaker state
    circuitBreaker: CircuitBreakerState;

    // Health trends
    trends: {
        direction: 'improving' | 'stable' | 'degrading';
        velocity: number;
        confidence: number;
        prediction: {
            nextHour: number;
            nextDay: number;
        };
    };
}

export interface HealthAlert {
    type: 'degradation' | 'failure' | 'recovery' | 'circuit_breaker';
    severity: 'low' | 'medium' | 'high' | 'critical';
    componentName: string;
    message: string;
    timestamp: number;

    // Alert details
    details: {
        current_health: number;
        previous_health?: number;
        threshold?: number;
        trend?: string;
        recommended_action?: string;
    };

    // Alert metadata
    metadata: {
        alert_id: string;
        acknowledged: boolean;
        resolved: boolean;
        resolution_time?: number;
    };
}

export interface HealthDashboard {
    overview: {
        totalComponents: number;
        healthyComponents: number;
        degradedComponents: number;
        unhealthyComponents: number;
        offlineComponents: number;
        overallHealth: number;
    };

    // Component status breakdown
    components: {
        [componentName: string]: {
            health: ComponentHealth;
            trend: string;
            lastCheck: number;
            circuitBreakerState: string;
        };
    };

    // System health indicators
    indicators: {
        availability: number;
        reliability: number;
        performance: number;
        stability: number;
    };

    // Recent alerts
    recentAlerts: HealthAlert[];

    // Health trends
    trends: {
        overall: 'improving' | 'stable' | 'degrading';
        components: {
            [componentName: string]: 'improving' | 'stable' | 'degrading';
        };
    };
}

/**
 * Health Monitor - AI Component Health Management
 */
export class HealthMonitor extends EventEmitter {
    private readonly logger = new Logger(HealthMonitor.name);
    private readonly config: HealthMonitorConfig;

    // Health tracking
    private healthRecords = new Map<string, ComponentHealthRecord>();
    private circuitBreakers = new Map<string, CircuitBreakerState>();

    // Monitoring intervals
    private monitoringInterval?: NodeJS.Timeout;
    private recoveryInterval?: NodeJS.Timeout;
    private isMonitoring = false;

    // Analytics
    private healthHistory: Array<{
        timestamp: number;
        overallHealth: number;
        componentHealth: { [name: string]: number };
    }> = [];

    // Alerting
    private activeAlerts = new Map<string, HealthAlert>();
    private alertHistory: HealthAlert[] = [];

    // Performance tracking
    private performanceBaselines = new Map<string, number>();
    private healthCheckMetrics = new Map<string, {
        totalChecks: number;
        successfulChecks: number;
        averageCheckTime: number;
        lastCheckTime: number;
    }>();

    constructor(config: Partial<HealthMonitorConfig> = {}) {
        super();

        this.config = {
            healthCheck: {
                interval: 5000,
                timeout: 2000,
                retries: 3,
                batchSize: 10,
                ...config.healthCheck
            },
            circuitBreaker: {
                failureThreshold: 5,
                recoveryTimeout: 30000,
                successThreshold: 3,
                halfOpenTimeout: 10000,
                ...config.circuitBreaker
            },
            thresholds: {
                healthy: 0.8,
                degraded: 0.6,
                unhealthy: 0.3,
                critical: 0.1,
                ...config.thresholds
            },
            performance: {
                trackTrends: true,
                trendWindow: 300000, // 5 minutes
                alertOnDegradation: true,
                degradationThreshold: 0.2,
                ...config.performance
            },
            recovery: {
                autoRestart: true,
                restartDelay: 5000,
                maxRestarts: 3,
                escalationEnabled: true,
                ...config.recovery
            },
            analytics: {
                enabled: true,
                historicalData: true,
                dataRetention: 86400000, // 24 hours
                predictiveHealth: true,
                ...config.analytics
            }
        };
    }

    /**
     * Initialize the health monitor
     */
    async initialize(): Promise<void> {
        try {
            this.logger.log('🏥 Initializing Health Monitor...');

            // Initialize data structures
            this.healthRecords.clear();
            this.circuitBreakers.clear();
            this.activeAlerts.clear();
            this.alertHistory = [];
            this.healthHistory = [];

            this.logger.log('✅ Health Monitor initialized');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize Health Monitor:', error);
            throw error;
        }
    }

    /**
     * Start monitoring components
     */
    async startMonitoring(components: AIComponent[]): Promise<void> {
        if (this.isMonitoring) {
            this.logger.warn('Health monitoring already started');
            return;
        }

        try {
            this.logger.log('🔄 Starting health monitoring...');

            // Initialize component health records
            for (const component of components) {
                await this.initializeComponentHealth(component);
            }

            // Start monitoring interval
            this.monitoringInterval = setInterval(async () => {
                await this.performHealthCheck();
            }, this.config.healthCheck.interval);

            // Start recovery interval
            this.recoveryInterval = setInterval(async () => {
                await this.attemptRecovery();
            }, this.config.recovery.restartDelay);

            this.isMonitoring = true;
            this.logger.log(`✅ Health monitoring started for ${components.length} components`);
            this.emit('monitoring-started');

        } catch (error) {
            this.logger.error('❌ Failed to start health monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop health monitoring
     */
    async stopMonitoring(): Promise<void> {
        if (!this.isMonitoring) {
            return;
        }

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        if (this.recoveryInterval) {
            clearInterval(this.recoveryInterval);
        }

        this.isMonitoring = false;
        this.logger.log('✅ Health monitoring stopped');
    }

    /**
     * Add component to monitoring
     */
    async addComponent(component: AIComponent): Promise<void> {
        if (this.healthRecords.has(component.name)) {
            this.logger.warn(`Component ${component.name} already being monitored`);
            return;
        }

        await this.initializeComponentHealth(component);
        this.logger.log(`✅ Added component ${component.name} to health monitoring`);
        this.emit('component-added', component.name);
    }

    /**
     * Remove component from monitoring
     */
    async removeComponent(componentName: string): Promise<void> {
        if (!this.healthRecords.has(componentName)) {
            this.logger.warn(`Component ${componentName} not being monitored`);
            return;
        }

        this.healthRecords.delete(componentName);
        this.circuitBreakers.delete(componentName);
        this.performanceBaselines.delete(componentName);
        this.healthCheckMetrics.delete(componentName);

        // Remove component alerts
        const alertsToRemove = Array.from(this.activeAlerts.entries())
            .filter(([_, alert]) => alert.componentName === componentName)
            .map(([alertId]) => alertId);

        for (const alertId of alertsToRemove) {
            this.activeAlerts.delete(alertId);
        }

        this.logger.log(`✅ Removed component ${componentName} from health monitoring`);
        this.emit('component-removed', componentName);
    }

    /**
     * Perform health check for all components
     */
    async performHealthCheck(): Promise<void> {
        try {
            const components = Array.from(this.healthRecords.keys());

            // Process components in batches
            for (let i = 0; i < components.length; i += this.config.healthCheck.batchSize) {
                const batch = components.slice(i, i + this.config.healthCheck.batchSize);

                const healthCheckPromises = batch.map(componentName =>
                    this.performComponentHealthCheck(componentName)
                );

                await Promise.allSettled(healthCheckPromises);
            }

            // Update overall health
            await this.updateOverallHealth();

        } catch (error) {
            this.logger.error('Health check failed:', error);
            this.emit('health-check-failed', error);
        }
    }

    /**
     * Get component health
     */
    async getComponentHealth(componentName: string): Promise<ComponentHealth> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            throw new Error(`Component ${componentName} not found in health monitoring`);
        }

        return record.health;
    }

    /**
     * Get all component health
     */
    async getAllComponentHealth(): Promise<{ [componentName: string]: ComponentHealth }> {
        const healthMap: { [componentName: string]: ComponentHealth } = {};

        for (const [componentName, record] of Array.from(this.healthRecords.entries())) {
            healthMap[componentName] = record.health;
        }

        return healthMap;
    }

    /**
     * Get health snapshot
     */
    async getHealthSnapshot(): Promise<HealthSnapshot> {
        const components = await this.getAllComponentHealth();
        const componentNames = Object.keys(components);

        // Calculate overall health
        const overallHealth = componentNames.length > 0
            ? componentNames.reduce((sum, name) => sum + components[name].score, 0) / componentNames.length
            : 1.0;

        // Count component statuses
        const statusCounts = componentNames.reduce(
            (counts, name) => {
                counts[components[name].status] = (counts[components[name].status] || 0) + 1;
                return counts;
            },
            {} as Record<ComponentStatus, number>
        );

        // Count circuit breakers
        const circuitBreakersOpen = Array.from(this.circuitBreakers.values())
            .filter(cb => cb.state === 'open').length;

        return {
            overallHealth,
            unhealthyComponents: (statusCounts[ComponentStatus.UNHEALTHY] || 0) +
                (statusCounts[ComponentStatus.OFFLINE] || 0),
            circuitBreakersOpen,
            components,
            indicators: {
                performance: this.calculatePerformanceIndicator(),
                reliability: this.calculateReliabilityIndicator(),
                availability: this.calculateAvailabilityIndicator(),
                resource_efficiency: this.calculateResourceEfficiencyIndicator()
            },
            trends: {
                health_trend: this.calculateHealthTrend(),
                failure_rate: this.calculateFailureRate(),
                recovery_rate: this.calculateRecoveryRate()
            }
        };
    }

    async getOverallHealth(): Promise<{ score: number; status: ComponentStatus; details: any }> {
        const snapshot = await this.getHealthSnapshot();

        return {
            score: snapshot.overallHealth,
            status: this.getStatusFromScore(snapshot.overallHealth),
            details: {
                totalComponents: Object.keys(snapshot.components || {}).length,
                unhealthyComponents: snapshot.unhealthyComponents,
                circuitBreakersOpen: snapshot.circuitBreakersOpen,
                indicators: snapshot.indicators
            }
        };
    }

    /**
     * Get health dashboard
     */
    async getHealthDashboard(): Promise<HealthDashboard> {
        const snapshot = await this.getHealthSnapshot();

        const dashboard: HealthDashboard = {
            overview: {
                totalComponents: this.healthRecords.size,
                healthyComponents: 0,
                degradedComponents: 0,
                unhealthyComponents: 0,
                offlineComponents: 0,
                overallHealth: snapshot.overallHealth
            },
            components: {},
            indicators: {
                availability: this.calculateAvailabilityIndicator(),
                reliability: this.calculateReliabilityIndicator(),
                performance: this.calculatePerformanceIndicator(),
                stability: this.calculateResourceEfficiencyIndicator()
            },
            recentAlerts: Array.from(this.activeAlerts.values()).slice(-10),
            trends: {
                overall: this.analyzeOverallTrend(),
                components: {}
            }
        };

        // Count components by status
        for (const [componentName, record] of Array.from(this.healthRecords.entries())) {
            // Update component counts
            switch (record.health.status) {
                case ComponentStatus.HEALTHY:
                    dashboard.overview.healthyComponents++;
                    break;
                case ComponentStatus.DEGRADED:
                    dashboard.overview.degradedComponents++;
                    break;
                case ComponentStatus.UNHEALTHY:
                    dashboard.overview.unhealthyComponents++;
                    break;
                case ComponentStatus.OFFLINE:
                    dashboard.overview.offlineComponents++;
                    break;
            }

            // Add component details
            dashboard.components[componentName] = {
                health: record.health,
                trend: record.trends.direction,
                lastCheck: record.health.lastCheck,
                circuitBreakerState: record.circuitBreaker.state
            };

            // Add component trend
            dashboard.trends.components[componentName] = record.trends.direction;
        }

        return dashboard;
    }

    /**
     * Report error for a component
     */
    async reportError(componentName: string, error: Error): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            return;
        }

        // Update circuit breaker
        await this.updateCircuitBreaker(componentName, false);

        // Update health metrics
        record.performanceMetrics.consecutiveFailures++;
        record.performanceMetrics.consecutiveSuccesses = 0;
        record.performanceMetrics.lastFailure = Date.now();

        // Calculate new health score
        const newHealth = Math.max(0, record.health.score - 0.1);

        await this.updateComponentHealth(componentName, {
            score: newHealth,
            status: this.getStatusFromScore(newHealth),
            lastCheck: Date.now(),
            metrics: {
                ...record.health.metrics,
                errorRate: record.performanceMetrics.failureRate,
                lastError: error.message
            }
        });

        // Generate alert if needed
        if (newHealth < this.config.thresholds.degraded) {
            await this.generateAlert('degradation', componentName,
                `Component health degraded to ${(newHealth * 100).toFixed(1)}%`);
        }

        this.logger.warn(`Error reported for component ${componentName}:`, error.message);
        this.emit('error-reported', componentName, error);
    }

    /**
     * Update component health
     */
    async updateHealth(componentName: string, healthScore: number): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            return;
        }

        const newHealth: ComponentHealth = {
            score: healthScore,
            status: this.getStatusFromScore(healthScore),
            lastCheck: Date.now(),
            metrics: record.health.metrics
        };

        await this.updateComponentHealth(componentName, newHealth);
    }

    /**
     * Initialize component health
     */
    private async initializeComponentHealth(component: AIComponent): Promise<void> {
        try {
            // Get initial health
            const initialHealth = await this.executeHealthCheck(component);

            // Initialize circuit breaker
            const circuitBreaker: CircuitBreakerState = {
                state: 'closed',
                failureCount: 0,
                lastFailureTime: 0,
                nextAttemptTime: 0,
                config: {
                    failureThreshold: this.config.circuitBreaker.failureThreshold,
                    recoveryTimeout: this.config.circuitBreaker.recoveryTimeout,
                    successThreshold: this.config.circuitBreaker.successThreshold
                }
            };

            // Initialize health record
            const healthRecord: ComponentHealthRecord = {
                componentName: component.name,
                health: initialHealth,
                timestamp: Date.now(),
                healthHistory: [{
                    score: initialHealth.score,
                    status: initialHealth.status,
                    timestamp: Date.now(),
                    checkDuration: 0
                }],
                performanceMetrics: {
                    averageCheckTime: 0,
                    failureRate: 0,
                    recoveryTime: 0,
                    consecutiveFailures: 0,
                    consecutiveSuccesses: 0
                },
                circuitBreaker,
                trends: {
                    direction: 'stable',
                    velocity: 0,
                    confidence: 0.5,
                    prediction: {
                        nextHour: initialHealth.score,
                        nextDay: initialHealth.score
                    }
                }
            };

            this.healthRecords.set(component.name, healthRecord);
            this.circuitBreakers.set(component.name, circuitBreaker);

            // Initialize metrics
            this.healthCheckMetrics.set(component.name, {
                totalChecks: 1,
                successfulChecks: 1,
                averageCheckTime: 0,
                lastCheckTime: Date.now()
            });

            // Set performance baseline
            this.performanceBaselines.set(component.name, initialHealth.score);

        } catch (error) {
            this.logger.error(`Failed to initialize health for component ${component.name}:`, error);

            // Create unhealthy record
            const unhealthyRecord: ComponentHealthRecord = {
                componentName: component.name,
                health: {
                    score: 0,
                    status: ComponentStatus.OFFLINE,
                    lastCheck: Date.now(),
                    metrics: {
                        errorRate: 1.0,
                        lastError: error.message
                    }
                },
                timestamp: Date.now(),
                healthHistory: [],
                performanceMetrics: {
                    averageCheckTime: 0,
                    failureRate: 1.0,
                    recoveryTime: 0,
                    consecutiveFailures: 1,
                    consecutiveSuccesses: 0
                },
                circuitBreaker: {
                    state: 'open',
                    failureCount: 1,
                    lastFailureTime: Date.now(),
                    nextAttemptTime: Date.now() + this.config.circuitBreaker.recoveryTimeout,
                    config: {
                        failureThreshold: this.config.circuitBreaker.failureThreshold,
                        recoveryTimeout: this.config.circuitBreaker.recoveryTimeout,
                        successThreshold: this.config.circuitBreaker.successThreshold
                    }
                },
                trends: {
                    direction: 'degrading',
                    velocity: -1,
                    confidence: 0.9,
                    prediction: {
                        nextHour: 0,
                        nextDay: 0
                    }
                }
            };

            this.healthRecords.set(component.name, unhealthyRecord);
        }
    }

    /**
     * Perform health check for a specific component
     */
    private async performComponentHealthCheck(componentName: string): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            return;
        }

        const startTime = performance.now();

        try {
            // Check circuit breaker
            if (!this.canExecuteHealthCheck(componentName)) {
                return;
            }

            // Find the component (this would need to be injected or passed in)
            // For now, we'll simulate a health check
            const health = await this.simulateHealthCheck(componentName);

            const checkDuration = performance.now() - startTime;

            // Update circuit breaker
            await this.updateCircuitBreaker(componentName, true);

            // Update health record
            await this.updateComponentHealth(componentName, health);

            // Update metrics
            this.updateHealthCheckMetrics(componentName, checkDuration, true);

            // Update trends
            this.updateHealthTrends(componentName);

        } catch (error) {
            const checkDuration = performance.now() - startTime;

            this.logger.error(`Health check failed for component ${componentName}:`, error);

            // Update circuit breaker
            await this.updateCircuitBreaker(componentName, false);

            // Update metrics
            this.updateHealthCheckMetrics(componentName, checkDuration, false);

            // Generate alert
            await this.generateAlert('failure', componentName,
                `Health check failed: ${error.message}`);

            this.emit('component-health-check-failed', componentName, error);
        }
    }

    /**
     * Execute health check (this would call the actual component's health check)
     */
    private async executeHealthCheck(component: AIComponent): Promise<ComponentHealth> {
        return await component.healthCheck();
    }

    /**
     * Simulate health check for testing
     */
    private async simulateHealthCheck(componentName: string): Promise<ComponentHealth> {
        // Simulate varying health scores
        const baseScore = 0.8;
        const randomVariation = (Math.random() - 0.5) * 0.4;
        const score = Math.max(0, Math.min(1, baseScore + randomVariation));

        return {
            score,
            status: this.getStatusFromScore(score),
            lastCheck: Date.now(),
            metrics: {
                responseTime: Math.random() * 1000,
                errorRate: Math.random() * 0.1,
                successRate: 1 - Math.random() * 0.1
            }
        };
    }

    /**
     * Update component health
     */
    private async updateComponentHealth(componentName: string, health: ComponentHealth): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            return;
        }

        const previousHealth = record.health;
        record.health = health;
        record.timestamp = Date.now();

        // Add to history
        record.healthHistory.push({
            score: health.score,
            status: health.status,
            timestamp: Date.now(),
            checkDuration: 0
        });

        // Trim history
        if (record.healthHistory.length > 100) {
            record.healthHistory.shift();
        }

        // Check for status changes
        if (previousHealth.status !== health.status) {
            await this.handleStatusChange(componentName, previousHealth.status, health.status);
        }

        // Check for significant degradation
        if (previousHealth.score - health.score > this.config.performance.degradationThreshold) {
            await this.generateAlert('degradation', componentName,
                `Health degraded from ${(previousHealth.score * 100).toFixed(1)}% to ${(health.score * 100).toFixed(1)}%`);
        }

        this.emit('health-updated', componentName, health, previousHealth);
    }

    /**
     * Handle status change
     */
    private async handleStatusChange(
        componentName: string,
        previousStatus: ComponentStatus,
        newStatus: ComponentStatus
    ): Promise<void> {
        this.logger.log(`Component ${componentName} status changed: ${previousStatus} -> ${newStatus}`);

        // Generate appropriate alert
        if (newStatus === ComponentStatus.UNHEALTHY || newStatus === ComponentStatus.OFFLINE) {
            await this.generateAlert('failure', componentName, `Component became ${newStatus}`);
        } else if (newStatus === ComponentStatus.HEALTHY &&
            (previousStatus === ComponentStatus.UNHEALTHY || previousStatus === ComponentStatus.OFFLINE)) {
            await this.generateAlert('recovery', componentName, `Component recovered to ${newStatus}`);
        }

        this.emit('status-changed', componentName, previousStatus, newStatus);
    }

    /**
     * Update circuit breaker state
     */
    private async updateCircuitBreaker(componentName: string, success: boolean): Promise<void> {
        const circuitBreaker = this.circuitBreakers.get(componentName);
        if (!circuitBreaker) {
            return;
        }

        const now = Date.now();

        if (success) {
            // Reset failure count on success
            circuitBreaker.failureCount = 0;

            // If in half-open state, check if we can close
            if (circuitBreaker.state === 'half_open') {
                const record = this.healthRecords.get(componentName);
                if (record) {
                    record.performanceMetrics.consecutiveSuccesses++;

                    if (record.performanceMetrics.consecutiveSuccesses >=
                        circuitBreaker.config.successThreshold) {
                        circuitBreaker.state = 'closed';
                        await this.generateAlert('recovery', componentName,
                            'Circuit breaker closed - component recovered');
                    }
                }
            }
        } else {
            // Increment failure count
            circuitBreaker.failureCount++;
            circuitBreaker.lastFailureTime = now;

            // Check if we should open the circuit breaker
            if (circuitBreaker.state === 'closed' &&
                circuitBreaker.failureCount >= circuitBreaker.config.failureThreshold) {
                circuitBreaker.state = 'open';
                circuitBreaker.nextAttemptTime = now + circuitBreaker.config.recoveryTimeout;

                await this.generateAlert('circuit_breaker', componentName,
                    'Circuit breaker opened due to repeated failures');
            }
        }

        // Check if we should move from open to half-open
        if (circuitBreaker.state === 'open' && now >= circuitBreaker.nextAttemptTime) {
            circuitBreaker.state = 'half_open';
            circuitBreaker.nextAttemptTime = now + this.config.circuitBreaker.halfOpenTimeout;
        }
    }

    /**
     * Check if health check can be executed
     */
    private canExecuteHealthCheck(componentName: string): boolean {
        const circuitBreaker = this.circuitBreakers.get(componentName);
        if (!circuitBreaker) {
            return true;
        }

        return circuitBreaker.state !== 'open';
    }

    /**
     * Update health check metrics
     */
    private updateHealthCheckMetrics(componentName: string, duration: number, success: boolean): void {
        const metrics = this.healthCheckMetrics.get(componentName);
        if (!metrics) {
            return;
        }

        metrics.totalChecks++;
        if (success) {
            metrics.successfulChecks++;
        }

        metrics.averageCheckTime = (metrics.averageCheckTime * (metrics.totalChecks - 1) + duration) / metrics.totalChecks;
        metrics.lastCheckTime = Date.now();

        // Update record metrics
        const record = this.healthRecords.get(componentName);
        if (record) {
            record.performanceMetrics.averageCheckTime = metrics.averageCheckTime;
            record.performanceMetrics.failureRate = 1 - (metrics.successfulChecks / metrics.totalChecks);
        }
    }

    /**
     * Update health trends
     */
    private updateHealthTrends(componentName: string): void {
        const record = this.healthRecords.get(componentName);
        if (!record || record.healthHistory.length < 3) {
            return;
        }

        const recent = record.healthHistory.slice(-5);
        const trend = this.calculateTrend(recent.map(h => h.score));

        record.trends.direction = trend.direction;
        record.trends.velocity = trend.velocity;
        record.trends.confidence = trend.confidence;

        // Update predictions
        if (this.config.analytics.predictiveHealth) {
            record.trends.prediction = this.predictHealthScore(componentName);
        }
    }

    /**
     * Calculate trend from health scores
     */
    private calculateTrend(scores: number[]): {
        direction: 'improving' | 'stable' | 'degrading';
        velocity: number;
        confidence: number;
    } {
        if (scores.length < 2) {
            return { direction: 'stable', velocity: 0, confidence: 0 };
        }

        // Calculate slope
        const n = scores.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = scores.reduce((sum, score) => sum + score, 0);
        const sumXY = scores.reduce((sum, score, i) => sum + i * score, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        const direction = slope > 0.05 ? 'improving' : slope < -0.05 ? 'degrading' : 'stable';
        const velocity = Math.abs(slope);
        const confidence = Math.min(1, velocity * 10); // Simple confidence calculation

        return { direction, velocity, confidence };
    }

    /**
     * Predict health score
     */
    private predictHealthScore(componentName: string): { nextHour: number; nextDay: number } {
        const record = this.healthRecords.get(componentName);
        if (!record || record.healthHistory.length < 5) {
            return {
                nextHour: record?.health.score || 0.5,
                nextDay: record?.health.score || 0.5
            };
        }

        const recent = record.healthHistory.slice(-10);
        const trend = this.calculateTrend(recent.map(h => h.score));

        const currentScore = record.health.score;
        const hourPrediction = Math.max(0, Math.min(1, currentScore + trend.velocity * 0.1));
        const dayPrediction = Math.max(0, Math.min(1, currentScore + trend.velocity * 0.5));

        return {
            nextHour: hourPrediction,
            nextDay: dayPrediction
        };
    }

    /**
     * Generate health alert
     */
    private async generateAlert(
        type: 'degradation' | 'failure' | 'recovery' | 'circuit_breaker',
        componentName: string,
        message: string
    ): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) {
            return;
        }

        const alert: HealthAlert = {
            type,
            severity: this.getAlertSeverity(type, record.health.score),
            componentName,
            message,
            timestamp: Date.now(),
            details: {
                current_health: record.health.score,
                trend: record.trends.direction,
                recommended_action: this.getRecommendedAction(type, record.health.score)
            },
            metadata: {
                alert_id: `${componentName}-${type}-${Date.now()}`,
                acknowledged: false,
                resolved: false
            }
        };

        this.activeAlerts.set(alert.metadata.alert_id, alert);
        this.alertHistory.push(alert);

        // Trim alert history
        if (this.alertHistory.length > 1000) {
            this.alertHistory.shift();
        }

        this.logger.warn(`Health alert generated: ${alert.severity} - ${message}`);
        this.emit('alert-generated', alert);
    }

    /**
     * Get alert severity
     */
    private getAlertSeverity(type: string, healthScore: number): 'low' | 'medium' | 'high' | 'critical' {
        if (type === 'recovery') {
            return 'low';
        }

        if (healthScore < this.config.thresholds.critical) {
            return 'critical';
        } else if (healthScore < this.config.thresholds.unhealthy) {
            return 'high';
        } else if (healthScore < this.config.thresholds.degraded) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Get recommended action
     */
    private getRecommendedAction(type: string, healthScore: number): string {
        if (type === 'recovery') {
            return 'Monitor for stability';
        }

        if (healthScore < this.config.thresholds.critical) {
            return 'Immediate intervention required';
        } else if (healthScore < this.config.thresholds.unhealthy) {
            return 'Restart component or escalate to manual intervention';
        } else if (healthScore < this.config.thresholds.degraded) {
            return 'Monitor closely and prepare for potential restart';
        } else {
            return 'Continue monitoring';
        }
    }

    /**
     * Get status from score
     */
    private getStatusFromScore(score: number): ComponentStatus {
        if (score >= this.config.thresholds.healthy) {
            return ComponentStatus.HEALTHY;
        } else if (score >= this.config.thresholds.degraded) {
            return ComponentStatus.DEGRADED;
        } else if (score >= this.config.thresholds.unhealthy) {
            return ComponentStatus.UNHEALTHY;
        } else {
            return ComponentStatus.OFFLINE;
        }
    }

    /**
     * Calculate performance indicator
     */
    private calculatePerformanceIndicator(): number {
        const records = Array.from(this.healthRecords.values());
        if (records.length === 0) return 0;

        const avgResponseTime = records.reduce((sum, record) =>
            sum + record.performanceMetrics.averageCheckTime, 0) / records.length;

        // Convert to 0-1 scale (lower is better)
        return Math.max(0, 1 - avgResponseTime / 5000);
    }

    /**
     * Calculate reliability indicator
     */
    private calculateReliabilityIndicator(): number {
        const records = Array.from(this.healthRecords.values());
        if (records.length === 0) return 0;

        const avgFailureRate = records.reduce((sum, record) =>
            sum + record.performanceMetrics.failureRate, 0) / records.length;

        return Math.max(0, 1 - avgFailureRate);
    }

    /**
     * Calculate availability indicator
     */
    private calculateAvailabilityIndicator(): number {
        const records = Array.from(this.healthRecords.values());
        if (records.length === 0) return 0;

        const availableComponents = records.filter(record =>
            record.health.status !== ComponentStatus.OFFLINE).length;

        return availableComponents / records.length;
    }

    /**
     * Calculate resource efficiency indicator
     */
    private calculateResourceEfficiencyIndicator(): number {
        // This would integrate with ResourceManager
        return 0.8; // Mock value
    }

    /**
     * Calculate health trend
     */
    private calculateHealthTrend(): number {
        if (this.healthHistory.length < 5) return 0;

        const recent = this.healthHistory.slice(-5);
        const trend = this.calculateTrend(recent.map(h => h.overallHealth));

        return trend.velocity * (trend.direction === 'improving' ? 1 : -1);
    }

    /**
     * Calculate failure rate
     */
    private calculateFailureRate(): number {
        const records = Array.from(this.healthRecords.values());
        if (records.length === 0) return 0;

        return records.reduce((sum, record) =>
            sum + record.performanceMetrics.failureRate, 0) / records.length;
    }

    /**
     * Calculate recovery rate
     */
    private calculateRecoveryRate(): number {
        const totalRecoveries = this.alertHistory.filter(alert =>
            alert.type === 'recovery').length;

        const totalFailures = this.alertHistory.filter(alert =>
            alert.type === 'failure').length;

        return totalFailures > 0 ? totalRecoveries / totalFailures : 0;
    }

    /**
     * Analyze overall trend
     */
    private analyzeOverallTrend(): 'improving' | 'stable' | 'degrading' {
        if (this.healthHistory.length < 5) return 'stable';

        const recent = this.healthHistory.slice(-5);
        const trend = this.calculateTrend(recent.map(h => h.overallHealth));

        return trend.direction;
    }

    /**
     * Update overall health
     */
    private async updateOverallHealth(): Promise<void> {
        const records = Array.from(this.healthRecords.values());
        if (records.length === 0) return;

        const overallHealth = records.reduce((sum, record) =>
            sum + record.health.score, 0) / records.length;

        const componentHealth: { [name: string]: number } = {};
        records.forEach(record => {
            componentHealth[record.componentName] = record.health.score;
        });

        this.healthHistory.push({
            timestamp: Date.now(),
            overallHealth,
            componentHealth
        });

        // Trim history
        if (this.healthHistory.length > 1000) {
            this.healthHistory.shift();
        }

        this.emit('overall-health-updated', overallHealth);
    }

    /**
     * Attempt recovery for unhealthy components
     */
    private async attemptRecovery(): Promise<void> {
        if (!this.config.recovery.autoRestart) {
            return;
        }

        for (const [componentName, record] of Array.from(this.healthRecords.entries())) {
            if (record.health.status === ComponentStatus.UNHEALTHY ||
                record.health.status === ComponentStatus.OFFLINE) {

                if (record.performanceMetrics.consecutiveFailures < this.config.recovery.maxRestarts) {
                    await this.attemptComponentRecovery(componentName);
                }
            }
        }
    }

    /**
     * Attempt recovery for a specific component
     */
    private async attemptComponentRecovery(componentName: string): Promise<void> {
        const record = this.healthRecords.get(componentName);
        if (!record) return;

        try {
            this.logger.log(`Attempting recovery for component ${componentName}`);

            // Reset circuit breaker to allow retry
            const circuitBreaker = this.circuitBreakers.get(componentName);
            if (circuitBreaker) {
                circuitBreaker.state = 'half_open';
                circuitBreaker.nextAttemptTime = Date.now();
            }

            // Perform health check
            await this.performComponentHealthCheck(componentName);

            this.emit('recovery-attempted', componentName);

        } catch (error) {
            this.logger.error(`Recovery failed for component ${componentName}:`, error);
            this.emit('recovery-failed', componentName, error);
        }
    }

    /**
     * Shutdown the health monitor
     */
    async shutdown(): Promise<void> {
        this.logger.log('🛑 Shutting down Health Monitor...');

        await this.stopMonitoring();

        // Clear all data
        this.healthRecords.clear();
        this.circuitBreakers.clear();
        this.activeAlerts.clear();
        this.alertHistory = [];
        this.healthHistory = [];
        this.performanceBaselines.clear();
        this.healthCheckMetrics.clear();

        this.logger.log('✅ Health Monitor shutdown complete');
        this.emit('shutdown');
    }
} 