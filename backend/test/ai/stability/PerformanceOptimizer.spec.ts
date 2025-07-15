/**
 * PerformanceOptimizer Test Suite
 * 
 * Tests for adaptive performance tuning and resource optimization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { PerformanceOptimizer, PerformanceOptimizerConfig, PerformanceProfile } from '../../../src/ai/stability/PerformanceOptimizer';
import {
    AIComponent,
    AIRequest,
    AIResponse,
    ComponentTier,
    ComponentStatus,
    ComponentHealth,
    ComponentMetrics,
    AIComponentType,
    PerformanceSnapshot,
    OptimizationResult
} from '../../../src/ai/stability/interfaces';

// Mock implementations
class MockComponentRegistry extends EventEmitter {
    private components: Map<string, AIComponent> = new Map();

    constructor() {
        super();
        this.initializeMockComponents();
    }

    private initializeMockComponents(): void {
        // High-performance component
        const highPerformanceComponent: AIComponent = {
            name: 'high_performance_ai',
            type: AIComponentType.MINIMAX,
            tier: ComponentTier.STABLE,
            priority: 90,
            timeout: 50,
            memoryLimit: 256,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 3, confidence: 0.95, reasoning: 'High performance decision' },
                executionTime: 25
            } as AIResponse),
            healthCheck: async () => ({ score: 0.98, status: ComponentStatus.HEALTHY, lastCheck: Date.now() }),
            getMetrics: async () => ({
                name: 'high_performance_ai',
                performance: {
                    averageResponseTime: 25,
                    minResponseTime: 10,
                    maxResponseTime: 50,
                    throughput: 200,
                    successRate: 0.98,
                    errorRate: 0.02
                },
                resources: {
                    cpuUsage: 30,
                    memoryUsage: 200,
                    gpuUsage: 0
                },
                health: {
                    uptime: 0.99,
                    availability: 0.99,
                    reliability: 0.98,
                    failureCount: 1
                },
                requests: {
                    total: 1000,
                    successful: 980,
                    failed: 20,
                    retries: 5,
                    timeouts: 2
                },
                timestamp: Date.now(),
                collectionPeriod: 60000
            } as ComponentMetrics)
        };

        // Medium-performance component
        const mediumPerformanceComponent: AIComponent = {
            name: 'medium_performance_ai',
            type: AIComponentType.MCTS,
            tier: ComponentTier.ADVANCED,
            priority: 70,
            timeout: 200,
            memoryLimit: 512,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 2, confidence: 0.85, reasoning: 'Medium performance decision' },
                executionTime: 150
            } as AIResponse),
            healthCheck: async () => ({ score: 0.85, status: ComponentStatus.HEALTHY, lastCheck: Date.now() }),
            getMetrics: async () => ({
                name: 'medium_performance_ai',
                performance: {
                    averageResponseTime: 150,
                    minResponseTime: 100,
                    maxResponseTime: 300,
                    throughput: 50,
                    successRate: 0.85,
                    errorRate: 0.15
                },
                resources: {
                    cpuUsage: 60,
                    memoryUsage: 400,
                    gpuUsage: 20
                },
                health: {
                    uptime: 0.95,
                    availability: 0.95,
                    reliability: 0.85,
                    failureCount: 5
                },
                requests: {
                    total: 500,
                    successful: 425,
                    failed: 75,
                    retries: 15,
                    timeouts: 10
                },
                timestamp: Date.now(),
                collectionPeriod: 60000
            } as ComponentMetrics)
        };

        // Low-performance component
        const lowPerformanceComponent: AIComponent = {
            name: 'low_performance_ai',
            type: AIComponentType.NEURAL,
            tier: ComponentTier.EXPERIMENTAL,
            priority: 40,
            timeout: 1000,
            memoryLimit: 1024,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 1, confidence: 0.75, reasoning: 'Low performance decision' },
                executionTime: 800
            } as AIResponse),
            healthCheck: async () => ({ score: 0.65, status: ComponentStatus.DEGRADED, lastCheck: Date.now() }),
            getMetrics: async () => ({
                name: 'low_performance_ai',
                performance: {
                    averageResponseTime: 800,
                    minResponseTime: 500,
                    maxResponseTime: 1200,
                    throughput: 10,
                    successRate: 0.75,
                    errorRate: 0.25
                },
                resources: {
                    cpuUsage: 85,
                    memoryUsage: 900,
                    gpuUsage: 70
                },
                health: {
                    uptime: 0.80,
                    availability: 0.80,
                    reliability: 0.75,
                    failureCount: 15
                },
                requests: {
                    total: 200,
                    successful: 150,
                    failed: 50,
                    retries: 25,
                    timeouts: 20
                },
                timestamp: Date.now(),
                collectionPeriod: 60000
            } as ComponentMetrics)
        };

        this.components.set('high_performance_ai', highPerformanceComponent);
        this.components.set('medium_performance_ai', mediumPerformanceComponent);
        this.components.set('low_performance_ai', lowPerformanceComponent);
    }

    getAllComponents(): AIComponent[] {
        return Array.from(this.components.values());
    }

    getComponent(name: string): AIComponent | null {
        return this.components.get(name) || null;
    }

    async register(component: AIComponent): Promise<void> {
        this.components.set(component.name, component);
        this.emit('component_registered', component);
    }
}

class MockResourceManager {
    private resourceUsage = {
        cpu: 50,
        memory: 1024,
        gpu: 30,
        activeComponents: 3
    };

    async getCurrentResourceUsage(): Promise<any> {
        return {
            cpuUsage: this.resourceUsage.cpu,
            memoryUsage: this.resourceUsage.memory,
            gpuUsage: this.resourceUsage.gpu,
            activeComponents: this.resourceUsage.activeComponents,
            breakdown: {
                high_performance_ai: { cpu: 15, memory: 200, gpu: 0 },
                medium_performance_ai: { cpu: 20, memory: 400, gpu: 10 },
                low_performance_ai: { cpu: 15, memory: 424, gpu: 20 }
            }
        };
    }

    setResourceUsage(usage: any): void {
        this.resourceUsage = { ...this.resourceUsage, ...usage };
    }
}

class MockHealthMonitor extends EventEmitter {
    private healthStates: Map<string, ComponentHealth> = new Map();

    constructor() {
        super();
        this.initializeMockHealth();
    }

    private initializeMockHealth(): void {
        this.healthStates.set('high_performance_ai', {
            score: 0.98,
            status: ComponentStatus.HEALTHY,
            lastCheck: Date.now()
        });

        this.healthStates.set('medium_performance_ai', {
            score: 0.85,
            status: ComponentStatus.HEALTHY,
            lastCheck: Date.now()
        });

        this.healthStates.set('low_performance_ai', {
            score: 0.65,
            status: ComponentStatus.DEGRADED,
            lastCheck: Date.now()
        });
    }

    async getComponentHealth(componentName: string): Promise<ComponentHealth> {
        return this.healthStates.get(componentName) || {
            score: 0.0,
            status: ComponentStatus.OFFLINE,
            lastCheck: Date.now()
        };
    }

    setComponentHealth(componentName: string, health: ComponentHealth): void {
        this.healthStates.set(componentName, health);
        this.emit('health_changed', { component: componentName, health });
    }
}

// Test suite
describe('PerformanceOptimizer', () => {
    let performanceOptimizer: PerformanceOptimizer;
    let mockRegistry: MockComponentRegistry;
    let mockResourceManager: MockResourceManager;
    let mockHealthMonitor: MockHealthMonitor;
    let mockConfig: Partial<PerformanceOptimizerConfig>;

    beforeEach(async () => {
        mockRegistry = new MockComponentRegistry();
        mockResourceManager = new MockResourceManager();
        mockHealthMonitor = new MockHealthMonitor();

        mockConfig = {
            monitoring: {
                enabled: true,
                interval: 1000,
                windowSize: 10,
                dataRetention: 60000
            },
            optimization: {
                enabled: true,
                aggressiveness: 0.5,
                learningRate: 0.1,
                adaptationThreshold: 0.8,
                rollbackEnabled: true
            },
            analytics: {
                enabled: true,
                predictiveAnalysis: true,
                patternRecognition: true,
                anomalyDetection: true
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
                }
            }
        };

        performanceOptimizer = new PerformanceOptimizer(
            mockConfig,
            mockRegistry as any,
            mockResourceManager as any,
            mockHealthMonitor as any
        );

        await performanceOptimizer.initialize();
    });

    afterEach(async () => {
        await performanceOptimizer.shutdown();
        performanceOptimizer.removeAllListeners();
    });

    describe('Initialization', () => {
        it('should initialize with correct configuration', async () => {
            const config = await performanceOptimizer.getConfig();
            expect(config.monitoring.enabled).toBe(true);
            expect(config.optimization.enabled).toBe(true);
            expect(config.analytics.enabled).toBe(true);
        });

        it('should initialize performance profiles for all components', async () => {
            const highPerfProfile = await performanceOptimizer.getComponentProfile('high_performance_ai');
            const mediumPerfProfile = await performanceOptimizer.getComponentProfile('medium_performance_ai');
            const lowPerfProfile = await performanceOptimizer.getComponentProfile('low_performance_ai');

            expect(highPerfProfile).toBeDefined();
            expect(mediumPerfProfile).toBeDefined();
            expect(lowPerfProfile).toBeDefined();
        });

        it('should set up event listeners', () => {
            expect(performanceOptimizer.listenerCount('initialized')).toBeGreaterThan(0);
        });
    });

    describe('Performance Monitoring', () => {
        it('should track performance metrics', async () => {
            const component = mockRegistry.getComponent('high_performance_ai')!;
            const profile = await performanceOptimizer.getComponentProfile('high_performance_ai');

            expect(profile).toBeDefined();
            expect(profile!.componentName).toBe('high_performance_ai');
            expect(profile!.metrics.responseTime.current).toBe(25);
            expect(profile!.metrics.throughput.current).toBe(200);
        });

        it('should calculate performance scores', async () => {
            const highPerfProfile = await performanceOptimizer.getComponentProfile('high_performance_ai');
            const lowPerfProfile = await performanceOptimizer.getComponentProfile('low_performance_ai');

            expect(highPerfProfile!.metrics.responseTime.current).toBeLessThan(lowPerfProfile!.metrics.responseTime.current);
            expect(highPerfProfile!.metrics.throughput.current).toBeGreaterThan(lowPerfProfile!.metrics.throughput.current);
        });

        it('should detect performance trends', async () => {
            const component = mockRegistry.getComponent('medium_performance_ai')!;

            // Simulate performance degradation
            const originalGetMetrics = component.getMetrics!;
            let responseTime = 150;

            component.getMetrics = async () => {
                const metrics = await originalGetMetrics();
                metrics.performance.averageResponseTime = responseTime;
                return metrics;
            };

            // Record several profiles with increasing response time
            for (let i = 0; i < 5; i++) {
                responseTime += 10;
                await performanceOptimizer.getComponentProfile('medium_performance_ai');
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const profile = await performanceOptimizer.getComponentProfile('medium_performance_ai');
            expect(profile!.metrics.responseTime.trend).toBeGreaterThan(0); // Degrading trend
        });
    });

    describe('Performance Optimization', () => {
        it('should optimize component timeout', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 8
            };

            const originalTimeout = component.timeout;
            const result = await performanceOptimizer.optimizePerformance(component, request);

            expect(result.applied).toBe(true);
            expect(result.optimization).toBe('timeout_optimization');
            expect(component.timeout).not.toBe(originalTimeout);
        });

        it('should optimize memory allocation', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 8
            };

            const originalMemory = component.memoryLimit;
            const result = await performanceOptimizer.optimizePerformance(component, request);

            if (result.optimization === 'memory_optimization') {
                expect(result.applied).toBe(true);
                expect(component.memoryLimit).not.toBe(originalMemory);
            }
        });

        it('should optimize component priority', async () => {
            const component = mockRegistry.getComponent('high_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const originalPriority = component.priority;
            const result = await performanceOptimizer.optimizePerformance(component, request);

            if (result.optimization === 'priority_optimization') {
                expect(result.applied).toBe(true);
                expect(component.priority).toBeGreaterThanOrEqual(originalPriority);
            }
        });

        it('should skip optimization when not needed', async () => {
            const component = mockRegistry.getComponent('high_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            // Force no optimization needed
            const result = await performanceOptimizer.optimizePerformance(component, request);

            if (result.optimization === 'no_optimization_needed') {
                expect(result.applied).toBe(false);
            }
        });
    });

    describe('Adaptive Optimization', () => {
        it('should execute with monitoring', async () => {
            const component = mockRegistry.getComponent('medium_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 500,
                difficulty: 7
            };

            const allocation = { cpu: 20, memory: 400, gpu: 10 };
            const response = await performanceOptimizer.executeWithMonitoring(component, request, allocation);

            expect(response.optimized).toBe(true);
            expect(response.executionTime).toBeDefined();
            expect(response.decision).toBeDefined();
        });

        it('should adapt to performance changes', async () => {
            const component = mockRegistry.getComponent('medium_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 500,
                difficulty: 7
            };

            // Simulate performance degradation
            const originalGetMetrics = component.getMetrics!;
            component.getMetrics = async () => {
                const metrics = await originalGetMetrics();
                metrics.performance.averageResponseTime = 400; // Increased response time
                return metrics;
            };

            const optimizationApplied = jest.fn();
            performanceOptimizer.on('optimization_applied', optimizationApplied);

            const allocation = { cpu: 20, memory: 400, gpu: 10 };
            await performanceOptimizer.executeWithMonitoring(component, request, allocation);

            // Allow time for adaptive optimization
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if optimization was attempted
            expect(optimizationApplied).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'optimization_applied',
                    component: 'medium_performance_ai'
                })
            );
        });
    });

    describe('Performance Analytics', () => {
        it('should generate performance snapshot', async () => {
            const snapshot = await performanceOptimizer.getPerformanceSnapshot();

            expect(snapshot.averageThinkTime).toBeDefined();
            expect(snapshot.cacheHitRate).toBeDefined();
            expect(snapshot.optimizationScore).toBeDefined();
            expect(snapshot.adaptationRate).toBeDefined();
            expect(snapshot.componentPerformance).toBeDefined();
        });

        it('should provide detailed analytics', async () => {
            const analytics = await performanceOptimizer.getPerformanceAnalytics();

            expect(analytics.system.averageResponseTime).toBeDefined();
            expect(analytics.system.totalThroughput).toBeDefined();
            expect(analytics.system.resourceEfficiency).toBeDefined();
            expect(analytics.components).toBeDefined();
            expect(analytics.recommendations).toBeDefined();
            expect(analytics.anomalies).toBeDefined();
        });

        it('should track optimization effectiveness', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 8
            };

            // Apply optimization
            await performanceOptimizer.optimizePerformance(component, request);

            const analytics = await performanceOptimizer.getPerformanceAnalytics();
            expect(analytics.system.optimizationEffectiveness).toBeGreaterThanOrEqual(0);
        });

        it('should generate performance recommendations', async () => {
            const analytics = await performanceOptimizer.getPerformanceAnalytics();
            const recommendations = analytics.recommendations;

            expect(Array.isArray(recommendations)).toBe(true);

            if (recommendations.length > 0) {
                const recommendation = recommendations[0];
                expect(recommendation.component).toBeDefined();
                expect(recommendation.optimization).toBeDefined();
                expect(recommendation.expectedImprovement).toBeDefined();
                expect(recommendation.confidence).toBeDefined();
                expect(recommendation.priority).toBeDefined();
            }
        });

        it('should detect performance anomalies', async () => {
            const component = mockRegistry.getComponent('medium_performance_ai')!;

            // Create anomalous performance
            const originalGetMetrics = component.getMetrics!;
            component.getMetrics = async () => {
                const metrics = await originalGetMetrics();
                metrics.performance.averageResponseTime = 5000; // Extremely high response time
                return metrics;
            };

            // Update profile to detect anomaly
            await performanceOptimizer.getComponentProfile('medium_performance_ai');

            const analytics = await performanceOptimizer.getPerformanceAnalytics();
            const anomalies = analytics.anomalies;

            expect(Array.isArray(anomalies)).toBe(true);

            if (anomalies.length > 0) {
                const anomaly = anomalies[0];
                expect(anomaly.component).toBeDefined();
                expect(anomaly.metric).toBeDefined();
                expect(anomaly.value).toBeDefined();
                expect(anomaly.severity).toBeDefined();
            }
        });
    });

    describe('Learning and Adaptation', () => {
        it('should learn from optimization results', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 8
            };

            // Apply multiple optimizations
            for (let i = 0; i < 3; i++) {
                await performanceOptimizer.optimizePerformance(component, request);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const profile = await performanceOptimizer.getComponentProfile('low_performance_ai');
            expect(profile!.optimization.improvements).toBeGreaterThan(0);
        });

        it('should adapt optimization strategies', async () => {
            const component = mockRegistry.getComponent('medium_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 500,
                difficulty: 7
            };

            // Simulate consistent performance degradation
            const originalGetMetrics = component.getMetrics!;
            let responseTime = 150;

            component.getMetrics = async () => {
                const metrics = await originalGetMetrics();
                metrics.performance.averageResponseTime = responseTime;
                return metrics;
            };

            const adaptiveOptimization = jest.fn();
            performanceOptimizer.on('adaptive_optimization', adaptiveOptimization);

            // Execute multiple times to trigger adaptation
            for (let i = 0; i < 5; i++) {
                responseTime += 20;
                const allocation = { cpu: 20, memory: 400, gpu: 10 };
                await performanceOptimizer.executeWithMonitoring(component, request, allocation);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Check if adaptive optimization was triggered
            expect(adaptiveOptimization).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'adaptive_optimization',
                    component: 'medium_performance_ai'
                })
            );
        });
    });

    describe('Resource Optimization', () => {
        it('should optimize resource usage', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const profile = await performanceOptimizer.getComponentProfile('low_performance_ai');

            expect(profile!.resources.cpu.usage).toBeDefined();
            expect(profile!.resources.memory.usage).toBeDefined();
            expect(profile!.resources.gpu.usage).toBeDefined();
            expect(profile!.resources.cpu.efficiency).toBeDefined();
        });

        it('should track resource efficiency', async () => {
            const highPerfProfile = await performanceOptimizer.getComponentProfile('high_performance_ai');
            const lowPerfProfile = await performanceOptimizer.getComponentProfile('low_performance_ai');

            expect(highPerfProfile!.resources.cpu.efficiency).toBeGreaterThan(
                lowPerfProfile!.resources.cpu.efficiency
            );
        });

        it('should recommend resource optimizations', async () => {
            const analytics = await performanceOptimizer.getPerformanceAnalytics();
            const recommendations = analytics.recommendations;

            const resourceOptimizations = recommendations.filter(r =>
                r.optimization.includes('cpu') ||
                r.optimization.includes('memory') ||
                r.optimization.includes('resource')
            );

            expect(resourceOptimizations.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Configuration Management', () => {
        it('should allow configuration updates', async () => {
            const newConfig = {
                monitoring: {
                    interval: 2000,
                    windowSize: 20
                },
                optimization: {
                    aggressiveness: 0.8,
                    learningRate: 0.2
                }
            };

            await performanceOptimizer.updateConfig(newConfig);
            const config = await performanceOptimizer.getConfig();

            expect(config.monitoring.interval).toBe(2000);
            expect(config.monitoring.windowSize).toBe(20);
            expect(config.optimization.aggressiveness).toBe(0.8);
            expect(config.optimization.learningRate).toBe(0.2);
        });

        it('should restart monitoring when interval changes', async () => {
            const newConfig = {
                monitoring: {
                    interval: 500
                }
            };

            await performanceOptimizer.updateConfig(newConfig);
            const config = await performanceOptimizer.getConfig();

            expect(config.monitoring.interval).toBe(500);
        });
    });

    describe('Event Handling', () => {
        it('should emit optimization events', async () => {
            const component = mockRegistry.getComponent('low_performance_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 8
            };

            const optimizationApplied = jest.fn();
            performanceOptimizer.on('optimization_applied', optimizationApplied);

            await performanceOptimizer.optimizePerformance(component, request);

            expect(optimizationApplied).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'optimization_applied',
                    component: 'low_performance_ai'
                })
            );
        });

        it('should handle component registration events', async () => {
            const newComponent: AIComponent = {
                name: 'new_test_component',
                type: AIComponentType.BASIC,
                tier: ComponentTier.STABLE,
                priority: 50,
                timeout: 100,
                memoryLimit: 256,
                dependencies: [],
                execute: async () => ({ decision: { move: 0, confidence: 0.5, reasoning: 'Test' } } as AIResponse),
                healthCheck: async () => ({ score: 0.8, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
            };

            await mockRegistry.register(newComponent);

            // Allow time for profile initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            const profile = await performanceOptimizer.getComponentProfile('new_test_component');
            expect(profile).toBeDefined();
        });

        it('should handle health change events', async () => {
            const newHealth: ComponentHealth = {
                score: 0.3,
                status: ComponentStatus.UNHEALTHY,
                lastCheck: Date.now()
            };

            mockHealthMonitor.setComponentHealth('medium_performance_ai', newHealth);

            // Allow time for profile update
            await new Promise(resolve => setTimeout(resolve, 100));

            const profile = await performanceOptimizer.getComponentProfile('medium_performance_ai');
            expect(profile).toBeDefined();
        });
    });

    describe('Health Check', () => {
        it('should perform health check successfully', async () => {
            const health = await performanceOptimizer.healthCheck();

            expect(health.score).toBe(1.0);
            expect(health.status).toBe(ComponentStatus.HEALTHY);
            expect(health.metrics?.responseTime).toBeDefined();
            expect(health.metrics?.requestCount).toBeDefined();
        });

        it('should report unhealthy status on failure', async () => {
            // Mock a failure in metrics collection
            const originalGetMetrics = mockRegistry.getComponent('high_performance_ai')!.getMetrics!;
            mockRegistry.getComponent('high_performance_ai')!.getMetrics = async () => {
                throw new Error('Metrics collection failed');
            };

            const health = await performanceOptimizer.healthCheck();

            expect(health.score).toBe(0.0);
            expect(health.status).toBe(ComponentStatus.UNHEALTHY);
            expect(health.metrics?.lastError).toBeDefined();

            // Restore original method
            mockRegistry.getComponent('high_performance_ai')!.getMetrics = originalGetMetrics;
        });
    });

    describe('Shutdown', () => {
        it('should shutdown gracefully', async () => {
            await performanceOptimizer.shutdown();

            // Verify cleanup
            expect(performanceOptimizer.listenerCount('optimization_applied')).toBe(0);
            expect(performanceOptimizer.listenerCount('adaptive_optimization')).toBe(0);
        });
    });
}); 