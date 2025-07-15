/**
 * AI Stability Architecture - Performance Optimizer
 * 
 * This system provides adaptive performance tuning and resource optimization,
 * continuously learning from performance data to improve system efficiency.
 */

import {
    AIComponent,
    AIRequest,
    AIResponse,
    ComponentTier,
    ComponentStatus,
    ComponentHealth,
    ComponentMetrics,
    PerformanceSnapshot,
    OptimizationResult,
    PerformanceEvent,
    ResourceUsage,
    ResourceLimits,
    ComponentRegistry,
    ResourceManager,
    HealthMonitor,
    AIEvent
} from './interfaces';
import { EventEmitter } from 'events';

// === Performance Optimization Types ===

export interface PerformanceOptimizerConfig {
    // Monitoring configuration
    monitoring: {
        enabled: boolean;
        interval: number;
        windowSize: number;
        dataRetention: number;
    };

    // Optimization configuration
    optimization: {
        enabled: boolean;
        aggressiveness: number; // 0.0 to 1.0
        learningRate: number;
        adaptationThreshold: number;
        rollbackEnabled: boolean;
    };

    // Analytics configuration
    analytics: {
        enabled: boolean;
        predictiveAnalysis: boolean;
        patternRecognition: boolean;
        anomalyDetection: boolean;
    };

    // Performance thresholds
    thresholds: {
        responseTime: {
            excellent: number;
            good: number;
            acceptable: number;
            poor: number;
        };
        throughput: {
            minimum: number;
            target: number;
            maximum: number;
        };
        resourceUsage: {
            cpu: number;
            memory: number;
            gpu: number;
        };
    };
}

export interface PerformanceProfile {
    componentName: string;
    timestamp: number;

    // Performance metrics
    metrics: {
        responseTime: {
            current: number;
            average: number;
            p95: number;
            p99: number;
            trend: number;
        };
        throughput: {
            current: number;
            average: number;
            peak: number;
            trend: number;
        };
        accuracy: {
            current: number;
            average: number;
            trend: number;
        };
        reliability: {
            current: number;
            average: number;
            trend: number;
        };
    };

    // Resource utilization
    resources: {
        cpu: { usage: number; efficiency: number };
        memory: { usage: number; efficiency: number };
        gpu: { usage: number; efficiency: number };
    };

    // Quality metrics
    quality: {
        decisionQuality: number;
        consistency: number;
        stability: number;
    };

    // Optimization state
    optimization: {
        level: number;
        strategy: string;
        parameters: any;
        lastOptimized: number;
        improvements: number;
    };
}

export interface OptimizationStrategy {
    name: string;
    description: string;
    applicableTiers: ComponentTier[];
    priority: number;

    // Strategy functions
    canApply: (profile: PerformanceProfile) => boolean;
    apply: (component: AIComponent, profile: PerformanceProfile) => Promise<OptimizationResult>;
    rollback: (component: AIComponent, optimization: OptimizationResult) => Promise<void>;

    // Strategy metadata
    metadata: {
        category: string;
        impact: 'low' | 'medium' | 'high';
        risk: 'low' | 'medium' | 'high';
        resources: string[];
    };
}

export interface PerformanceAnalytics {
    // System-wide analytics
    system: {
        averageResponseTime: number;
        totalThroughput: number;
        resourceEfficiency: number;
        optimizationEffectiveness: number;
    };

    // Component analytics
    components: {
        [componentName: string]: {
            performanceScore: number;
            optimizationLevel: number;
            efficiency: number;
            reliability: number;
            trends: {
                performance: 'improving' | 'stable' | 'degrading';
                resources: 'improving' | 'stable' | 'degrading';
                quality: 'improving' | 'stable' | 'degrading';
            };
        };
    };

    // Recommendations
    recommendations: {
        component: string;
        optimization: string;
        expectedImprovement: number;
        confidence: number;
        priority: 'low' | 'medium' | 'high';
        reasoning: string;
    }[];

    // Anomalies
    anomalies: {
        component: string;
        metric: string;
        value: number;
        expectedRange: [number, number];
        severity: 'low' | 'medium' | 'high';
        timestamp: number;
    }[];
}

export interface AdaptationRule {
    id: string;
    condition: (profile: PerformanceProfile) => boolean;
    action: (component: AIComponent, profile: PerformanceProfile) => Promise<OptimizationResult>;
    confidence: number;
    priority: number;
    metadata: {
        description: string;
        category: string;
        learned: boolean;
    };
}

// === Main Performance Optimizer ===

export class PerformanceOptimizer extends EventEmitter {
    private readonly config: PerformanceOptimizerConfig;
    private readonly registry: ComponentRegistry;
    private readonly resourceManager: ResourceManager;
    private readonly healthMonitor: HealthMonitor;

    // Performance tracking
    private performanceProfiles: Map<string, PerformanceProfile> = new Map();
    private performanceHistory: Map<string, PerformanceProfile[]> = new Map();
    private optimizationHistory: Map<string, OptimizationResult[]> = new Map();

    // Optimization strategies
    private optimizationStrategies: Map<string, OptimizationStrategy> = new Map();
    private adaptationRules: Map<string, AdaptationRule> = new Map();

    // Analytics
    private performanceAnalytics: PerformanceAnalytics;
    private monitoringInterval?: NodeJS.Timeout;
    private isOptimizing = false;

    // Learning system
    private learningData: Map<string, any[]> = new Map();
    private patternRecognition: Map<string, any> = new Map();

    constructor(
        config: Partial<PerformanceOptimizerConfig>,
        registry: ComponentRegistry,
        resourceManager: ResourceManager,
        healthMonitor: HealthMonitor
    ) {
        super();

        this.config = {
            monitoring: {
                enabled: true,
                interval: 5000,
                windowSize: 100,
                dataRetention: 86400000, // 24 hours
                ...config.monitoring
            },
            optimization: {
                enabled: true,
                aggressiveness: 0.5,
                learningRate: 0.1,
                adaptationThreshold: 0.8,
                rollbackEnabled: true,
                ...config.optimization
            },
            analytics: {
                enabled: true,
                predictiveAnalysis: true,
                patternRecognition: true,
                anomalyDetection: true,
                ...config.analytics
            },
            thresholds: {
                responseTime: {
                    excellent: 10,
                    good: 50,
                    acceptable: 200,
                    poor: 1000
                },
                throughput: {
                    minimum: 10,
                    target: 100,
                    maximum: 1000
                },
                resourceUsage: {
                    cpu: 80,
                    memory: 85,
                    gpu: 90
                },
                ...config.thresholds
            }
        };

        this.registry = registry;
        this.resourceManager = resourceManager;
        this.healthMonitor = healthMonitor;

        this.performanceAnalytics = {
            system: {
                averageResponseTime: 0,
                totalThroughput: 0,
                resourceEfficiency: 0,
                optimizationEffectiveness: 0
            },
            components: {},
            recommendations: [],
            anomalies: []
        };

        this.initializeOptimizationStrategies();
        this.initializeAdaptationRules();
    }

    // === Initialization ===

    async initialize(): Promise<void> {
        try {
            // Initialize performance profiles for all components
            const components = this.registry.getAllComponents();
            for (const component of components) {
                await this.initializeComponentProfile(component);
            }

            // Start monitoring if enabled
            if (this.config.monitoring.enabled) {
                this.startMonitoring();
            }

            // Set up event listeners
            this.setupEventListeners();

            this.emit('initialized');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    // === Main Optimization Interface ===

    async optimizePerformance(
        component: AIComponent,
        request: AIRequest
    ): Promise<OptimizationResult> {
        const startTime = Date.now();

        try {
            // Get current performance profile
            const profile = await this.updatePerformanceProfile(component);

            // Analyze performance
            const analysis = await this.analyzePerformance(component, profile);

            // Determine optimization strategy
            const strategy = this.selectOptimizationStrategy(profile, analysis);

            if (!strategy) {
                return {
                    applied: false,
                    optimization: 'no_optimization_needed',
                    component: component.name,
                    details: {
                        parameters_changed: {},
                        side_effects: [],
                        rollback_available: false
                    }
                };
            }

            // Apply optimization
            const result = await strategy.apply(component, profile);

            // Track optimization
            await this.trackOptimization(component, result);

            // Update learning data
            await this.updateLearningData(component, profile, result);

            const executionTime = Date.now() - startTime;

            this.emit('optimization_applied', {
                type: 'performance',
                timestamp: Date.now(),
                component: component.name,
                data: {
                    strategy: strategy.name,
                    execution_time: executionTime,
                    result: result
                },
                severity: 'info'
            });

            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;

            this.emit('optimization_failed', {
                type: 'performance',
                timestamp: Date.now(),
                component: component.name,
                data: {
                    error: error,
                    execution_time: executionTime
                },
                severity: 'error'
            });

            throw error;
        }
    }

    async executeWithMonitoring(
        component: AIComponent,
        request: AIRequest,
        allocation: any
    ): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            // Pre-execution optimization
            if (this.config.optimization.enabled) {
                await this.optimizePerformance(component, request);
            }

            // Execute with monitoring
            const response = await component.execute!(request);

            // Post-execution analysis
            const executionTime = Date.now() - startTime;
            await this.recordPerformanceMetrics(component, {
                executionTime,
                success: true,
                response,
                request,
                allocation
            });

            // Adaptive optimization
            await this.adaptiveOptimization(component, request, response);

            return {
                ...response,
                optimized: true,
                executionTime
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Record failure metrics
            await this.recordPerformanceMetrics(component, {
                executionTime,
                success: false,
                error: error.message,
                request,
                allocation
            });

            throw error;
        }
    }

    // === Performance Analysis ===

    private async analyzePerformance(
        component: AIComponent,
        profile: PerformanceProfile
    ): Promise<any> {
        const analysis = {
            score: this.calculatePerformanceScore(profile),
            bottlenecks: this.identifyBottlenecks(profile),
            trends: this.analyzeTrends(profile),
            recommendations: this.generateRecommendations(profile),
            anomalies: this.detectAnomalies(profile)
        };

        return analysis;
    }

    private calculatePerformanceScore(profile: PerformanceProfile): number {
        const weights = {
            responseTime: 0.3,
            throughput: 0.2,
            accuracy: 0.2,
            reliability: 0.15,
            resourceEfficiency: 0.15
        };

        const scores = {
            responseTime: this.normalizeResponseTime(profile.metrics.responseTime.current),
            throughput: this.normalizeThroughput(profile.metrics.throughput.current),
            accuracy: profile.metrics.accuracy.current,
            reliability: profile.metrics.reliability.current,
            resourceEfficiency: this.calculateResourceEfficiency(profile.resources)
        };

        return Object.keys(weights).reduce((total, key) => {
            return total + (weights[key] * scores[key]);
        }, 0);
    }

    private identifyBottlenecks(profile: PerformanceProfile): string[] {
        const bottlenecks: string[] = [];

        // Response time bottleneck
        if (profile.metrics.responseTime.current > this.config.thresholds.responseTime.acceptable) {
            bottlenecks.push('response_time');
        }

        // Resource bottlenecks
        if (profile.resources.cpu.usage > this.config.thresholds.resourceUsage.cpu) {
            bottlenecks.push('cpu_usage');
        }

        if (profile.resources.memory.usage > this.config.thresholds.resourceUsage.memory) {
            bottlenecks.push('memory_usage');
        }

        // Throughput bottleneck
        if (profile.metrics.throughput.current < this.config.thresholds.throughput.minimum) {
            bottlenecks.push('throughput');
        }

        return bottlenecks;
    }

    private analyzeTrends(profile: PerformanceProfile): any {
        return {
            performance: profile.metrics.responseTime.trend < 0 ? 'improving' :
                profile.metrics.responseTime.trend > 0 ? 'degrading' : 'stable',
            throughput: profile.metrics.throughput.trend > 0 ? 'improving' :
                profile.metrics.throughput.trend < 0 ? 'degrading' : 'stable',
            quality: profile.metrics.accuracy.trend > 0 ? 'improving' :
                profile.metrics.accuracy.trend < 0 ? 'degrading' : 'stable'
        };
    }

    private generateRecommendations(profile: PerformanceProfile): any[] {
        const recommendations: any[] = [];

        // Response time recommendations
        if (profile.metrics.responseTime.current > this.config.thresholds.responseTime.good) {
            recommendations.push({
                type: 'response_time_optimization',
                priority: 'high',
                description: 'Optimize response time through parameter tuning',
                expectedImprovement: 0.3
            });
        }

        // Resource optimization recommendations
        if (profile.resources.cpu.efficiency < 0.7) {
            recommendations.push({
                type: 'cpu_optimization',
                priority: 'medium',
                description: 'Improve CPU utilization efficiency',
                expectedImprovement: 0.2
            });
        }

        return recommendations;
    }

    private detectAnomalies(profile: PerformanceProfile): any[] {
        const anomalies: any[] = [];

        // Response time anomalies
        const responseTimeRange = [
            profile.metrics.responseTime.average * 0.5,
            profile.metrics.responseTime.average * 2.0
        ];

        if (profile.metrics.responseTime.current < responseTimeRange[0] ||
            profile.metrics.responseTime.current > responseTimeRange[1]) {
            anomalies.push({
                metric: 'response_time',
                value: profile.metrics.responseTime.current,
                expectedRange: responseTimeRange,
                severity: 'medium'
            });
        }

        return anomalies;
    }

    // === Optimization Strategies ===

    private initializeOptimizationStrategies(): void {
        // Strategy 1: Timeout Optimization
        this.optimizationStrategies.set('timeout_optimization', {
            name: 'Timeout Optimization',
            description: 'Optimize component timeout based on performance patterns',
            applicableTiers: [ComponentTier.STABLE, ComponentTier.ADVANCED, ComponentTier.EXPERIMENTAL],
            priority: 8,
            canApply: (profile) => {
                return profile.metrics.responseTime.average < 1000 && profile.componentName.includes('timeout');
            },
            apply: async (component, profile) => {
                const currentTimeout = component.timeout;
                const avgResponseTime = profile.metrics.responseTime.average;
                const optimalTimeout = Math.max(avgResponseTime * 1.5, 10);

                const oldTimeout = component.timeout;
                component.timeout = optimalTimeout;

                return {
                    applied: true,
                    optimization: 'timeout_optimization',
                    component: component.name,
                    results: {
                        before: oldTimeout,
                        after: optimalTimeout,
                        improvement: (oldTimeout - optimalTimeout) / oldTimeout,
                        confidence: 0.8
                    },
                    details: {
                        parameters_changed: { timeout: optimalTimeout },
                        side_effects: ['response_time_limit_changed'],
                        rollback_available: true
                    }
                };
            },
            rollback: async (component, optimization) => {
                const oldTimeout = optimization.results?.before;
                if (oldTimeout) {
                    component.timeout = oldTimeout;
                }
            },
            metadata: {
                category: 'performance',
                impact: 'medium',
                risk: 'low',
                resources: ['time']
            }
        });

        // Strategy 2: Memory Optimization
        this.optimizationStrategies.set('memory_optimization', {
            name: 'Memory Optimization',
            description: 'Optimize memory allocation based on usage patterns',
            applicableTiers: [ComponentTier.ADVANCED, ComponentTier.EXPERIMENTAL, ComponentTier.RESEARCH],
            priority: 7,
            canApply: (profile) => {
                return profile.resources.memory.efficiency < 0.8;
            },
            apply: async (component, profile) => {
                const currentMemory = component.memoryLimit;
                const avgMemoryUsage = profile.resources.memory.usage;
                const optimalMemory = Math.max(avgMemoryUsage * 1.2, 256);

                const oldMemory = component.memoryLimit;
                component.memoryLimit = optimalMemory;

                return {
                    applied: true,
                    optimization: 'memory_optimization',
                    component: component.name,
                    results: {
                        before: oldMemory,
                        after: optimalMemory,
                        improvement: (oldMemory - optimalMemory) / oldMemory,
                        confidence: 0.7
                    },
                    details: {
                        parameters_changed: { memoryLimit: optimalMemory },
                        side_effects: ['memory_allocation_changed'],
                        rollback_available: true
                    }
                };
            },
            rollback: async (component, optimization) => {
                const oldMemory = optimization.results?.before;
                if (oldMemory) {
                    component.memoryLimit = oldMemory;
                }
            },
            metadata: {
                category: 'resource',
                impact: 'medium',
                risk: 'low',
                resources: ['memory']
            }
        });

        // Strategy 3: Priority Optimization
        this.optimizationStrategies.set('priority_optimization', {
            name: 'Priority Optimization',
            description: 'Adjust component priority based on performance metrics',
            applicableTiers: [ComponentTier.CRITICAL, ComponentTier.STABLE, ComponentTier.ADVANCED],
            priority: 6,
            canApply: (profile) => {
                return profile.metrics.reliability.current > 0.9 && profile.metrics.responseTime.average < 100;
            },
            apply: async (component, profile) => {
                const currentPriority = component.priority;
                const performanceScore = this.calculatePerformanceScore(profile);
                const optimalPriority = Math.min(currentPriority + Math.floor(performanceScore * 10), 100);

                const oldPriority = component.priority;
                component.priority = optimalPriority;

                return {
                    applied: true,
                    optimization: 'priority_optimization',
                    component: component.name,
                    results: {
                        before: oldPriority,
                        after: optimalPriority,
                        improvement: (optimalPriority - oldPriority) / oldPriority,
                        confidence: 0.6
                    },
                    details: {
                        parameters_changed: { priority: optimalPriority },
                        side_effects: ['scheduling_priority_changed'],
                        rollback_available: true
                    }
                };
            },
            rollback: async (component, optimization) => {
                const oldPriority = optimization.results?.before;
                if (oldPriority) {
                    component.priority = oldPriority;
                }
            },
            metadata: {
                category: 'scheduling',
                impact: 'low',
                risk: 'low',
                resources: ['scheduling']
            }
        });

        // Strategy 4: Configuration Optimization
        this.optimizationStrategies.set('configuration_optimization', {
            name: 'Configuration Optimization',
            description: 'Optimize component configuration parameters',
            applicableTiers: [ComponentTier.STABLE, ComponentTier.ADVANCED, ComponentTier.EXPERIMENTAL],
            priority: 5,
            canApply: (profile) => {
                return profile.optimization.lastOptimized < Date.now() - 300000; // 5 minutes
            },
            apply: async (component, profile) => {
                const config = component.config || {};
                const optimizedConfig = { ...config };

                // Optimize based on performance patterns
                if (profile.metrics.responseTime.current > this.config.thresholds.responseTime.good) {
                    optimizedConfig.optimization_level = 'high';
                } else {
                    optimizedConfig.optimization_level = 'balanced';
                }

                component.config = optimizedConfig;

                return {
                    applied: true,
                    optimization: 'configuration_optimization',
                    component: component.name,
                    results: {
                        before: config,
                        after: optimizedConfig,
                        improvement: 0.1,
                        confidence: 0.5
                    },
                    details: {
                        parameters_changed: optimizedConfig,
                        side_effects: ['configuration_changed'],
                        rollback_available: true
                    }
                };
            },
            rollback: async (component, optimization) => {
                const oldConfig = optimization.results?.before;
                if (oldConfig) {
                    component.config = oldConfig;
                }
            },
            metadata: {
                category: 'configuration',
                impact: 'medium',
                risk: 'medium',
                resources: ['configuration']
            }
        });
    }

    private initializeAdaptationRules(): void {
        // Rule 1: Response Time Adaptation
        this.adaptationRules.set('response_time_adaptation', {
            id: 'response_time_adaptation',
            condition: (profile) => {
                return profile.metrics.responseTime.trend > 0.2; // 20% increase
            },
            action: async (component, profile) => {
                const strategy = this.optimizationStrategies.get('timeout_optimization');
                if (strategy && strategy.canApply(profile)) {
                    return strategy.apply(component, profile);
                }
                throw new Error('Cannot apply adaptation rule');
            },
            confidence: 0.8,
            priority: 9,
            metadata: {
                description: 'Adapt to increasing response times',
                category: 'performance',
                learned: false
            }
        });

        // Rule 2: Resource Efficiency Adaptation
        this.adaptationRules.set('resource_efficiency_adaptation', {
            id: 'resource_efficiency_adaptation',
            condition: (profile) => {
                return profile.resources.memory.efficiency < 0.6;
            },
            action: async (component, profile) => {
                const strategy = this.optimizationStrategies.get('memory_optimization');
                if (strategy && strategy.canApply(profile)) {
                    return strategy.apply(component, profile);
                }
                throw new Error('Cannot apply adaptation rule');
            },
            confidence: 0.7,
            priority: 8,
            metadata: {
                description: 'Adapt to low resource efficiency',
                category: 'resource',
                learned: false
            }
        });
    }

    // === Adaptive Optimization ===

    private async adaptiveOptimization(
        component: AIComponent,
        request: AIRequest,
        response: AIResponse
    ): Promise<void> {
        if (!this.config.optimization.enabled) return;

        const profile = this.performanceProfiles.get(component.name);
        if (!profile) return;

        // Check adaptation rules
        for (const rule of this.adaptationRules.values()) {
            if (rule.condition(profile)) {
                try {
                    const result = await rule.action(component, profile);
                    await this.trackOptimization(component, result);

                    this.emit('adaptive_optimization', {
                        type: 'performance',
                        timestamp: Date.now(),
                        component: component.name,
                        data: {
                            rule: rule.id,
                            result: result
                        },
                        severity: 'info'
                    });

                } catch (error) {
                    // Continue with other rules
                }
            }
        }
    }

    private selectOptimizationStrategy(
        profile: PerformanceProfile,
        analysis: any
    ): OptimizationStrategy | null {
        const applicableStrategies = Array.from(this.optimizationStrategies.values())
            .filter(strategy => strategy.canApply(profile))
            .sort((a, b) => b.priority - a.priority);

        return applicableStrategies.length > 0 ? applicableStrategies[0] : null;
    }

    // === Performance Monitoring ===

    private startMonitoring(): void {
        this.monitoringInterval = setInterval(async () => {
            await this.performMonitoringCycle();
        }, this.config.monitoring.interval);
    }

    private async performMonitoringCycle(): Promise<void> {
        try {
            const components = this.registry.getAllComponents();

            for (const component of components) {
                await this.updatePerformanceProfile(component);
            }

            await this.updatePerformanceAnalytics();

        } catch (error) {
            this.emit('monitoring_error', error);
        }
    }

    private async updatePerformanceProfile(component: AIComponent): Promise<PerformanceProfile> {
        const metrics = await this.collectPerformanceMetrics(component);
        const resourceUsage = await this.collectResourceMetrics(component);

        const profile: PerformanceProfile = {
            componentName: component.name,
            timestamp: Date.now(),
            metrics: {
                responseTime: {
                    current: metrics.performance.averageResponseTime,
                    average: metrics.performance.averageResponseTime,
                    p95: metrics.performance.averageResponseTime * 1.5,
                    p99: metrics.performance.averageResponseTime * 2.0,
                    trend: this.calculateTrend(component.name, 'responseTime')
                },
                throughput: {
                    current: metrics.performance.throughput,
                    average: metrics.performance.throughput,
                    peak: metrics.performance.throughput * 1.2,
                    trend: this.calculateTrend(component.name, 'throughput')
                },
                accuracy: {
                    current: metrics.performance.successRate,
                    average: metrics.performance.successRate,
                    trend: this.calculateTrend(component.name, 'accuracy')
                },
                reliability: {
                    current: metrics.health.reliability,
                    average: metrics.health.reliability,
                    trend: this.calculateTrend(component.name, 'reliability')
                }
            },
            resources: {
                cpu: {
                    usage: resourceUsage.cpu,
                    efficiency: resourceUsage.cpu > 0 ? metrics.performance.throughput / resourceUsage.cpu : 0
                },
                memory: {
                    usage: resourceUsage.memory,
                    efficiency: resourceUsage.memory > 0 ? metrics.performance.throughput / resourceUsage.memory : 0
                },
                gpu: {
                    usage: resourceUsage.gpu,
                    efficiency: resourceUsage.gpu > 0 ? metrics.performance.throughput / resourceUsage.gpu : 0
                }
            },
            quality: {
                decisionQuality: metrics.performance.successRate,
                consistency: this.calculateConsistency(component.name),
                stability: this.calculateStability(component.name)
            },
            optimization: {
                level: this.getOptimizationLevel(component.name),
                strategy: this.getLastOptimizationStrategy(component.name),
                parameters: component.config || {},
                lastOptimized: this.getLastOptimizationTime(component.name),
                improvements: this.getOptimizationImprovements(component.name)
            }
        };

        this.performanceProfiles.set(component.name, profile);
        this.recordPerformanceHistory(component.name, profile);

        return profile;
    }

    // === Helper Methods ===

    private async collectPerformanceMetrics(component: AIComponent): Promise<ComponentMetrics> {
        try {
            if (component.getMetrics) {
                return await component.getMetrics();
            }

            // Fallback to default metrics
            return {
                name: component.name,
                performance: {
                    averageResponseTime: 100,
                    minResponseTime: 10,
                    maxResponseTime: 1000,
                    throughput: 10,
                    successRate: 0.95,
                    errorRate: 0.05
                },
                resources: {
                    cpuUsage: 30,
                    memoryUsage: 512,
                    gpuUsage: 0,
                    networkUsage: 0
                },
                health: {
                    uptime: 0.99,
                    availability: 0.99,
                    reliability: 0.95,
                    failureCount: 0
                },
                requests: {
                    total: 100,
                    successful: 95,
                    failed: 5,
                    retries: 2,
                    timeouts: 1
                },
                timestamp: Date.now(),
                collectionPeriod: 60000
            };
        } catch (error) {
            throw new Error(`Failed to collect metrics for ${component.name}: ${error.message}`);
        }
    }

    private async collectResourceMetrics(component: AIComponent): Promise<{ cpu: number; memory: number; gpu: number }> {
        try {
            const resourceUsage = await this.resourceManager.getCurrentResourceUsage();
            const componentUsage = resourceUsage.breakdown?.[component.name] || { cpu: 0, memory: 0, gpu: 0 };

            return {
                cpu: componentUsage.cpu,
                memory: componentUsage.memory,
                gpu: componentUsage.gpu || 0
            };
        } catch (error) {
            return { cpu: 0, memory: 0, gpu: 0 };
        }
    }

    private calculateTrend(componentName: string, metric: string): number {
        const history = this.performanceHistory.get(componentName) || [];
        if (history.length < 2) return 0;

        const recent = history.slice(-10);
        const values = recent.map(h => {
            switch (metric) {
                case 'responseTime': return h.metrics.responseTime.current;
                case 'throughput': return h.metrics.throughput.current;
                case 'accuracy': return h.metrics.accuracy.current;
                case 'reliability': return h.metrics.reliability.current;
                default: return 0;
            }
        });

        if (values.length < 2) return 0;

        const slope = (values[values.length - 1] - values[0]) / (values.length - 1);
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;

        return average > 0 ? slope / average : 0;
    }

    private calculateConsistency(componentName: string): number {
        const history = this.performanceHistory.get(componentName) || [];
        if (history.length < 2) return 1.0;

        const responseTimes = history.slice(-20).map(h => h.metrics.responseTime.current);
        const mean = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
        const variance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / responseTimes.length;
        const stdDev = Math.sqrt(variance);

        return mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 1.0;
    }

    private calculateStability(componentName: string): number {
        const history = this.performanceHistory.get(componentName) || [];
        if (history.length < 2) return 1.0;

        const recentHistory = history.slice(-10);
        const errors = recentHistory.filter(h => h.metrics.accuracy.current < 0.8).length;

        return Math.max(0, 1 - (errors / recentHistory.length));
    }

    private normalizeResponseTime(responseTime: number): number {
        const thresholds = this.config.thresholds.responseTime;
        if (responseTime <= thresholds.excellent) return 1.0;
        if (responseTime <= thresholds.good) return 0.8;
        if (responseTime <= thresholds.acceptable) return 0.6;
        if (responseTime <= thresholds.poor) return 0.4;
        return 0.2;
    }

    private normalizeThroughput(throughput: number): number {
        const thresholds = this.config.thresholds.throughput;
        if (throughput >= thresholds.maximum) return 1.0;
        if (throughput >= thresholds.target) return 0.8;
        if (throughput >= thresholds.minimum) return 0.6;
        return 0.4;
    }

    private calculateResourceEfficiency(resources: any): number {
        const cpuEfficiency = resources.cpu.efficiency;
        const memoryEfficiency = resources.memory.efficiency;
        const gpuEfficiency = resources.gpu.efficiency;

        return (cpuEfficiency + memoryEfficiency + gpuEfficiency) / 3;
    }

    private async recordPerformanceMetrics(component: AIComponent, data: any): Promise<void> {
        // Record metrics for learning and analysis
        const learningEntry = {
            timestamp: Date.now(),
            component: component.name,
            ...data
        };

        const componentLearningData = this.learningData.get(component.name) || [];
        componentLearningData.push(learningEntry);

        // Keep only recent data
        const maxEntries = 1000;
        if (componentLearningData.length > maxEntries) {
            componentLearningData.splice(0, componentLearningData.length - maxEntries);
        }

        this.learningData.set(component.name, componentLearningData);
    }

    private recordPerformanceHistory(componentName: string, profile: PerformanceProfile): void {
        const history = this.performanceHistory.get(componentName) || [];
        history.push(profile);

        // Keep only recent history
        const maxHistory = this.config.monitoring.windowSize;
        if (history.length > maxHistory) {
            history.splice(0, history.length - maxHistory);
        }

        this.performanceHistory.set(componentName, history);
    }

    private async trackOptimization(component: AIComponent, result: OptimizationResult): Promise<void> {
        const history = this.optimizationHistory.get(component.name) || [];
        history.push(result);

        // Keep only recent optimizations
        const maxHistory = 100;
        if (history.length > maxHistory) {
            history.splice(0, history.length - maxHistory);
        }

        this.optimizationHistory.set(component.name, history);
    }

    private async updateLearningData(
        component: AIComponent,
        profile: PerformanceProfile,
        result: OptimizationResult
    ): Promise<void> {
        if (!this.config.analytics.enabled) return;

        // Update pattern recognition
        const patterns = this.patternRecognition.get(component.name) || {};

        // Learn from optimization results
        if (result.applied && result.results) {
            const improvementKey = `${result.optimization}_improvement`;
            patterns[improvementKey] = (patterns[improvementKey] || 0) + result.results.improvement;
        }

        this.patternRecognition.set(component.name, patterns);
    }

    private async updatePerformanceAnalytics(): Promise<void> {
        if (!this.config.analytics.enabled) return;

        const components = this.registry.getAllComponents();
        const analytics: PerformanceAnalytics = {
            system: {
                averageResponseTime: 0,
                totalThroughput: 0,
                resourceEfficiency: 0,
                optimizationEffectiveness: 0
            },
            components: {},
            recommendations: [],
            anomalies: []
        };

        let totalResponseTime = 0;
        let totalThroughput = 0;
        let totalResourceEfficiency = 0;

        for (const component of components) {
            const profile = this.performanceProfiles.get(component.name);
            if (!profile) continue;

            const performanceScore = this.calculatePerformanceScore(profile);

            analytics.components[component.name] = {
                performanceScore,
                optimizationLevel: profile.optimization.level,
                efficiency: this.calculateResourceEfficiency(profile.resources),
                reliability: profile.metrics.reliability.current,
                trends: this.analyzeTrends(profile)
            };

            totalResponseTime += profile.metrics.responseTime.current;
            totalThroughput += profile.metrics.throughput.current;
            totalResourceEfficiency += this.calculateResourceEfficiency(profile.resources);

            // Generate recommendations
            const recommendations = this.generateRecommendations(profile);
            analytics.recommendations.push(...recommendations.map(rec => ({
                component: component.name,
                optimization: rec.type,
                expectedImprovement: rec.expectedImprovement,
                confidence: 0.7,
                priority: rec.priority,
                reasoning: rec.description
            })));

            // Detect anomalies
            const anomalies = this.detectAnomalies(profile);
            analytics.anomalies.push(...anomalies.map(anom => ({
                component: component.name,
                ...anom,
                timestamp: Date.now()
            })));
        }

        // Calculate system-wide metrics
        analytics.system.averageResponseTime = totalResponseTime / components.length;
        analytics.system.totalThroughput = totalThroughput;
        analytics.system.resourceEfficiency = totalResourceEfficiency / components.length;
        analytics.system.optimizationEffectiveness = this.calculateOptimizationEffectiveness();

        this.performanceAnalytics = analytics;
    }

    private calculateOptimizationEffectiveness(): number {
        let totalImprovement = 0;
        let totalOptimizations = 0;

        for (const history of this.optimizationHistory.values()) {
            for (const result of history) {
                if (result.results && result.results.improvement > 0) {
                    totalImprovement += result.results.improvement;
                    totalOptimizations++;
                }
            }
        }

        return totalOptimizations > 0 ? totalImprovement / totalOptimizations : 0;
    }

    private getOptimizationLevel(componentName: string): number {
        const history = this.optimizationHistory.get(componentName) || [];
        return history.length;
    }

    private getLastOptimizationStrategy(componentName: string): string {
        const history = this.optimizationHistory.get(componentName) || [];
        return history.length > 0 ? history[history.length - 1].optimization : 'none';
    }

    private getLastOptimizationTime(componentName: string): number {
        const history = this.optimizationHistory.get(componentName) || [];
        return history.length > 0 ? Date.now() - 60000 : 0; // Mock last optimization time
    }

    private getOptimizationImprovements(componentName: string): number {
        const history = this.optimizationHistory.get(componentName) || [];
        return history.filter(h => h.results && h.results.improvement > 0).length;
    }

    private setupEventListeners(): void {
        // Listen for component registration
        this.registry.on('component_registered', async (component: AIComponent) => {
            await this.initializeComponentProfile(component);
        });

        // Listen for component health changes
        this.healthMonitor.on('health_changed', async (event: any) => {
            const component = this.registry.getComponent(event.component);
            if (component) {
                await this.updatePerformanceProfile(component);
            }
        });
    }

    private async initializeComponentProfile(component: AIComponent): Promise<void> {
        try {
            await this.updatePerformanceProfile(component);
        } catch (error) {
            this.emit('profile_initialization_error', { component: component.name, error: error.message });
        }
    }

    // === Public Interface ===

    async getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
        const analytics = this.performanceAnalytics;

        return {
            averageThinkTime: analytics.system.averageResponseTime,
            cacheHitRate: 0.8, // Mock cache hit rate
            optimizationScore: analytics.system.optimizationEffectiveness,
            adaptationRate: this.calculateAdaptationRate(),
            componentPerformance: Object.keys(analytics.components).reduce((acc, name) => {
                const comp = analytics.components[name];
                acc[name] = {
                    avgResponseTime: analytics.system.averageResponseTime,
                    successRate: comp.reliability,
                    optimizationLevel: comp.optimizationLevel
                };
                return acc;
            }, {} as any),
            suggestions: analytics.recommendations
        };
    }

    private calculateAdaptationRate(): number {
        const totalAdaptations = Array.from(this.optimizationHistory.values())
            .reduce((sum, history) => sum + history.length, 0);
        const timeWindow = 3600000; // 1 hour
        return totalAdaptations / (timeWindow / 1000);
    }

    async getPerformanceAnalytics(): Promise<PerformanceAnalytics> {
        return { ...this.performanceAnalytics };
    }

    async getComponentProfile(componentName: string): Promise<PerformanceProfile | null> {
        return this.performanceProfiles.get(componentName) || null;
    }

    async updateConfig(config: Partial<PerformanceOptimizerConfig>): Promise<void> {
        Object.assign(this.config, config);

        // Restart monitoring if interval changed
        if (this.monitoringInterval && config.monitoring?.interval) {
            clearInterval(this.monitoringInterval);
            this.startMonitoring();
        }
    }

    async getConfig(): Promise<PerformanceOptimizerConfig> {
        return { ...this.config };
    }

    async shutdown(): Promise<void> {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.removeAllListeners();
        this.performanceProfiles.clear();
        this.performanceHistory.clear();
        this.optimizationHistory.clear();
        this.learningData.clear();
        this.patternRecognition.clear();
    }

    // === Health Check ===

    async healthCheck(): Promise<ComponentHealth> {
        const startTime = Date.now();

        try {
            // Test basic functionality
            const testComponent = {
                name: 'test_component',
                type: 'basic' as any,
                tier: ComponentTier.STABLE,
                priority: 1,
                timeout: 100,
                memoryLimit: 256,
                dependencies: []
            };

            await this.collectPerformanceMetrics(testComponent as AIComponent);

            return {
                score: 1.0,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: Date.now() - startTime,
                    successRate: 1.0,
                    requestCount: this.performanceProfiles.size
                }
            };
        } catch (error) {
            return {
                score: 0.0,
                status: ComponentStatus.UNHEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: Date.now() - startTime,
                    lastError: error.message
                }
            };
        }
    }

    /**
     * Get performance recommendations for a given request
     */
    async getRecommendations(request: AIRequest): Promise<string[]> {
        const recommendations: string[] = [];

        // Basic recommendations based on request type
        if (request.timeLimit < 1000) {
            recommendations.push('Consider increasing time limit for better performance');
        }

        if (request.difficulty > 7) {
            recommendations.push('High difficulty may impact performance');
        }

        return recommendations;
    }

    /**
     * Select best component for a given request
     */
    async selectBestComponent(request: AIRequest, recommendations: string[]): Promise<AIComponent> {
        const components = this.registry.getAllComponents();

        // Simple selection based on tier and performance
        const sortedComponents = components.sort((a, b) => {
            const aProfile = this.performanceProfiles.get(a.name);
            const bProfile = this.performanceProfiles.get(b.name);

            if (!aProfile || !bProfile) return 0;

            return aProfile.metrics.responseTime.average - bProfile.metrics.responseTime.average;
        });

        return sortedComponents[0] || components[0];
    }

    /**
     * Update metrics for a component
     */
    async updateMetrics(component: AIComponent, result: AIResponse, request: AIRequest): Promise<void> {
        const profile = this.performanceProfiles.get(component.name);
        if (!profile) return;

        // Update response time metrics
        profile.metrics.responseTime.current = result.executionTime;
        profile.metrics.responseTime.average = (profile.metrics.responseTime.average + result.executionTime) / 2;

        // Update success tracking based on decision existence
        const successRate = result.decision ? 1 : 0;
        profile.metrics.reliability.current = (profile.metrics.reliability.current + successRate) / 2;
        
        // Update the profile in place without returning
        profile.componentName = profile.componentName;
        profile.metrics.responseTime.current = result.executionTime || 0;
        profile.metrics.throughput.current = profile.metrics.throughput.current;
        profile.metrics.accuracy.current = profile.metrics.accuracy.current;
        profile.optimization.level = profile.optimization.level;
    }

    /**
     * Optimize a component
     */
    async optimize(component: AIComponent, request: AIRequest): Promise<void> {
        const profile = this.performanceProfiles.get(component.name);
        if (!profile) return;

        // Simple optimization - adjust timeout based on performance
        if (profile.metrics.responseTime.average > 1000) {
            component.timeout = Math.max(component.timeout * 0.9, 500);
        } else if (profile.metrics.responseTime.average < 100) {
            component.timeout = Math.min(component.timeout * 1.1, 5000);
        }
    }

    /**
     * Get performance metrics
     */
    async getMetrics(): Promise<any> {
        const metrics: any = {};

        for (const [name, profile] of this.performanceProfiles) {
            metrics[name] = {
                responseTime: profile.metrics.responseTime.average,
                successRate: profile.metrics.reliability.current,
                optimizationLevel: profile.optimization.level
            };
        }

        return metrics;
    }
} 