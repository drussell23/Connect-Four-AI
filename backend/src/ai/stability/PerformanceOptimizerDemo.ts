/**
 * PerformanceOptimizer Demo
 * 
 * Demonstrates adaptive performance tuning, resource optimization, and intelligent
 * learning capabilities of the PerformanceOptimizer system.
 */

import { PerformanceOptimizer, PerformanceOptimizerConfig } from './PerformanceOptimizer';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import {
    AIComponent,
    AIRequest,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    PerformanceSnapshot,
    OptimizationResult
} from './interfaces';

/**
 * Demo class showcasing PerformanceOptimizer capabilities
 */
export class PerformanceOptimizerDemo {
    private performanceOptimizer: PerformanceOptimizer;
    private componentRegistry: ComponentRegistry;
    private resourceManager: ResourceManager;
    private healthMonitor: HealthMonitor;

    constructor() {
        this.initializeComponents();
        this.setupDemoScenarios();
    }

    private initializeComponents(): void {
        // Initialize core components
        this.componentRegistry = new ComponentRegistry({
            autoRegistration: true,
            loadOnDemand: true,
            healthChecks: true,
            componentValidation: true,
            componentRanking: true,
            adaptiveSelection: true
        });

        this.resourceManager = new ResourceManager({
            limits: {
                maxCpuUsage: 80,
                maxMemoryUsage: 2048,
                maxGpuUsage: 90,
                maxConcurrentAI: 5
            },
            monitoring: {
                interval: 5000,
                historySize: 100,
                alertThresholds: {
                    cpu: 80,
                    memory: 80,
                    gpu: 80
                },
                criticalThresholds: {
                    cpu: 90,
                    memory: 90,
                    gpu: 90
                }
            },
            optimization: {
                enabled: true,
                aggressiveMode: false,
                autoScaling: true,
                loadBalancing: true,
                predictiveAllocation: false
            },
            safety: {
                emergencyMode: false,
                killUnresponsive: false,
                maxResourceWait: 10000,
                memoryLeakDetection: true,
                resourceQuarantine: false
            },
            performance: {
                cachingEnabled: true,
                batchProcessing: true,
                priorityScheduling: true,
                resourcePooling: true
            }
        });

        this.healthMonitor = new HealthMonitor({
            healthCheck: {
                interval: 2000,
                timeout: 5000,
                retries: 3,
                batchSize: 10
            },
            circuitBreaker: {
                failureThreshold: 5,
                recoveryTimeout: 30000,
                successThreshold: 3,
                halfOpenTimeout: 10000
            },
            thresholds: {
                healthy: 0.8,
                degraded: 0.6,
                unhealthy: 0.4,
                critical: 0.2
            }
        });

        const performanceConfig: Partial<PerformanceOptimizerConfig> = {
            monitoring: {
                enabled: true,
                interval: 3000,
                windowSize: 50,
                dataRetention: 300000 // 5 minutes
            },
            optimization: {
                enabled: true,
                aggressiveness: 0.7,
                learningRate: 0.15,
                adaptationThreshold: 0.75,
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
                    excellent: 20,
                    good: 100,
                    acceptable: 500,
                    poor: 2000
                },
                throughput: {
                    minimum: 5,
                    target: 50,
                    maximum: 500
                },
                resourceUsage: {
                    cpu: 75,
                    memory: 80,
                    gpu: 85
                }
            }
        };

        this.performanceOptimizer = new PerformanceOptimizer(
            performanceConfig,
            this.componentRegistry,
            this.resourceManager,
            this.healthMonitor
        );
    }

    private async setupDemoScenarios(): Promise<void> {
        // Register demo AI components with varying performance characteristics
        await this.registerDemoComponents();

        // Initialize all systems
        await this.initializeSystems();

        // Set up performance monitoring
        await this.setupPerformanceMonitoring();
    }

    private async registerDemoComponents(): Promise<void> {
        const components: AIComponent[] = [
            // High-performance optimized component
            {
                name: 'optimized_minimax',
                type: AIComponentType.MINIMAX,
                tier: ComponentTier.STABLE,
                priority: 5,
                timeout: 3000,
                memoryLimit: 128,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                config: {
                    depth: 8,
                    optimization_level: 'aggressive',
                    pruning: true
                },
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate optimized minimax execution
                    await this.simulateProcessing(30);

                    return {
                        decision: {
                            move: this.calculateOptimalMove(request.board, request.player),
                            confidence: 0.95,
                            reasoning: 'Optimized minimax with alpha-beta pruning',
                            strategy: 'minimax_optimized',
                            thinkingTime: Date.now() - startTime,
                            depth: 6,
                            nodesExplored: 1000
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                getMetrics: async () => ({
                    name: 'optimized_minimax',
                    performance: {
                        averageResponseTime: 30,
                        minResponseTime: 15,
                        maxResponseTime: 60,
                        throughput: 150,
                        successRate: 0.98,
                        errorRate: 0.02
                    },
                    resources: {
                        cpuUsage: 25,
                        memoryUsage: 200,
                        gpuUsage: 0,
                        networkUsage: 0
                    },
                    health: {
                        uptime: 0.99,
                        availability: 0.99,
                        reliability: 0.98,
                        failureCount: 1
                    },
                    requests: {
                        total: 500,
                        successful: 490,
                        failed: 10,
                        retries: 3,
                        timeouts: 1
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 60000
                }),
                healthCheck: async () => ({
                    score: 0.98,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 30,
                        successRate: 0.98,
                        memoryUsage: 200,
                        cpuUsage: 25
                    }
                })
            },

            // Medium-performance component that needs optimization
            {
                name: 'standard_mcts',
                type: AIComponentType.MCTS,
                tier: ComponentTier.ADVANCED,
                priority: 4,
                timeout: 5000,
                memoryLimit: 256,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                config: {
                    simulations: 50000,
                    exploration_constant: 1.4,
                    optimization_level: 'medium'
                },
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate MCTS execution with variable performance
                    const processingTime = Math.random() * 200 + 100; // 100-300ms
                    await this.simulateProcessing(processingTime);

                    return {
                        decision: {
                            move: this.calculateMCTSMove(request.board, request.player),
                            confidence: 0.85,
                            reasoning: 'MCTS with UCB1 exploration',
                            strategy: 'mcts_standard',
                            thinkingTime: Date.now() - startTime,
                            nodesExplored: 500
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                getMetrics: async () => ({
                    name: 'standard_mcts',
                    performance: {
                        averageResponseTime: 200,
                        minResponseTime: 100,
                        maxResponseTime: 400,
                        throughput: 30,
                        successRate: 0.85,
                        errorRate: 0.15
                    },
                    resources: {
                        cpuUsage: 50,
                        memoryUsage: 400,
                        gpuUsage: 10,
                        networkUsage: 0
                    },
                    health: {
                        uptime: 0.95,
                        availability: 0.95,
                        reliability: 0.85,
                        failureCount: 8
                    },
                    requests: {
                        total: 200,
                        successful: 170,
                        failed: 30,
                        retries: 15,
                        timeouts: 5
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 60000
                }),
                healthCheck: async () => ({
                    score: 0.85,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 200,
                        successRate: 0.85,
                        memoryUsage: 400,
                        cpuUsage: 50
                    }
                })
            },

            // Low-performance component that needs significant optimization
            {
                name: 'resource_heavy_neural',
                type: AIComponentType.NEURAL,
                tier: ComponentTier.EXPERIMENTAL,
                priority: 3,
                timeout: 10000,
                memoryLimit: 1024,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                config: {
                    layers: 10,
                    batch_size: 256,
                    optimization_level: 'conservative'
                },
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate resource-heavy neural network
                    const processingTime = Math.random() * 1000 + 500; // 500-1500ms
                    await this.simulateProcessing(processingTime);

                    return {
                        decision: {
                            move: this.calculateNeuralMove(request.board, request.player),
                            confidence: 0.75,
                            reasoning: 'Deep neural network prediction',
                            strategy: 'neural_network',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                getMetrics: async () => ({
                    name: 'resource_heavy_neural',
                    performance: {
                        averageResponseTime: 800,
                        minResponseTime: 500,
                        maxResponseTime: 1500,
                        throughput: 8,
                        successRate: 0.75,
                        errorRate: 0.25
                    },
                    resources: {
                        cpuUsage: 80,
                        memoryUsage: 900,
                        gpuUsage: 60,
                        networkUsage: 0
                    },
                    health: {
                        uptime: 0.80,
                        availability: 0.80,
                        reliability: 0.75,
                        failureCount: 25
                    },
                    requests: {
                        total: 100,
                        successful: 75,
                        failed: 25,
                        retries: 20,
                        timeouts: 15
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 60000
                }),
                healthCheck: async () => ({
                    score: 0.65,
                    status: ComponentStatus.DEGRADED,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 800,
                        successRate: 0.75,
                        memoryUsage: 900,
                        cpuUsage: 80
                    }
                })
            },

            // Adaptive component that improves with optimization
            {
                name: 'adaptive_hybrid',
                type: AIComponentType.HYBRID,
                tier: ComponentTier.ADVANCED,
                priority: 4,
                timeout: 7000,
                memoryLimit: 512,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                config: {
                    minimax_depth: 5,
                    mcts_simulations: 10000,
                    neural_weight: 0.6,
                    optimization_level: 'adaptive'
                },
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate adaptive hybrid approach
                    const processingTime = Math.random() * 300 + 150; // 150-450ms
                    await this.simulateProcessing(processingTime);

                    return {
                        decision: {
                            move: this.calculateHybridMove(request.board, request.player),
                            confidence: 0.88,
                            reasoning: 'Hybrid minimax-MCTS with neural guidance',
                            strategy: 'hybrid_adaptive',
                            thinkingTime: Date.now() - startTime,
                            depth: 4,
                            nodesExplored: 300
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                getMetrics: async () => ({
                    name: 'adaptive_hybrid',
                    performance: {
                        averageResponseTime: 300,
                        minResponseTime: 150,
                        maxResponseTime: 600,
                        throughput: 20,
                        successRate: 0.88,
                        errorRate: 0.12
                    },
                    resources: {
                        cpuUsage: 60,
                        memoryUsage: 600,
                        gpuUsage: 25,
                        networkUsage: 0
                    },
                    health: {
                        uptime: 0.92,
                        availability: 0.92,
                        reliability: 0.88,
                        failureCount: 12
                    },
                    requests: {
                        total: 150,
                        successful: 132,
                        failed: 18,
                        retries: 8,
                        timeouts: 3
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 60000
                }),
                healthCheck: async () => ({
                    score: 0.88,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 300,
                        successRate: 0.88,
                        memoryUsage: 600,
                        cpuUsage: 60
                    }
                })
            }
        ];

        // Register all components
        for (const component of components) {
            await this.componentRegistry.register(component);
        }
    }

    private async initializeSystems(): Promise<void> {
        // Initialize all systems
        await this.componentRegistry.initialize();
        await this.resourceManager.initialize();
        await this.healthMonitor.initialize();
        await this.performanceOptimizer.initialize();

        // Start monitoring
        const components = this.componentRegistry.getAllComponents();
        await this.healthMonitor.startMonitoring(components);
    }

    private async setupPerformanceMonitoring(): Promise<void> {
        // Set up performance event listeners
        this.performanceOptimizer.on('optimization_applied', (event) => {
            console.log(`🎯 Optimization Applied: ${event.component} - ${event.data.strategy}`);
            console.log(`   Execution time: ${event.data.execution_time}ms`);
            console.log(`   Improvement: ${(event.data.result.results?.improvement || 0) * 100}%`);
        });

        this.performanceOptimizer.on('adaptive_optimization', (event) => {
            console.log(`🔄 Adaptive Optimization: ${event.component} - ${event.data.rule}`);
            console.log(`   Trigger: Performance degradation detected`);
        });

        this.performanceOptimizer.on('optimization_failed', (event) => {
            console.log(`❌ Optimization Failed: ${event.component} - ${event.data.error}`);
        });
    }

    // === Demo Scenarios ===

    /**
     * Demo 1: Basic Performance Optimization
     */
    async demoBasicOptimization(): Promise<void> {
        console.log('\n=== Demo 1: Basic Performance Optimization ===');

        const component = this.componentRegistry.getComponent('standard_mcts')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 500,
            difficulty: 7
        };

        console.log('Component before optimization:');
        console.log(`  Timeout: ${component.timeout}ms`);
        console.log(`  Memory limit: ${component.memoryLimit}MB`);
        console.log(`  Priority: ${component.priority}`);

        const result = await this.performanceOptimizer.optimizePerformance(component, request);

        console.log('\nOptimization result:');
        console.log(`  Applied: ${result.applied}`);
        console.log(`  Strategy: ${result.optimization}`);
        console.log(`  Improvement: ${(result.results?.improvement || 0) * 100}%`);
        console.log(`  Confidence: ${(result.results?.confidence || 0) * 100}%`);

        console.log('\nComponent after optimization:');
        console.log(`  Timeout: ${component.timeout}ms`);
        console.log(`  Memory limit: ${component.memoryLimit}MB`);
        console.log(`  Priority: ${component.priority}`);
    }

    /**
     * Demo 2: Adaptive Performance Tuning
     */
    async demoAdaptivePerformanceTuning(): Promise<void> {
        console.log('\n=== Demo 2: Adaptive Performance Tuning ===');

        const component = this.componentRegistry.getComponent('adaptive_hybrid')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        console.log('Running adaptive performance tuning...');

        // Execute multiple requests to trigger adaptive optimization
        for (let i = 0; i < 5; i++) {
            console.log(`\nExecution ${i + 1}:`);

            const allocation = { cpu: 60, memory: 600, gpu: 25 };
            const response = await this.performanceOptimizer.executeWithMonitoring(
                component,
                request,
                allocation
            );

            console.log(`  Response time: ${response.executionTime}ms`);
            console.log(`  Optimized: ${response.optimized}`);
            console.log(`  Decision: Move ${response.decision.move} (${response.decision.confidence})`);

            // Introduce slight delay
            await this.simulateProcessing(100);
        }

        // Show adaptation results
        const profile = await this.performanceOptimizer.getComponentProfile('adaptive_hybrid');
        console.log('\nAdaptive tuning results:');
        console.log(`  Optimization level: ${profile?.optimization.level}`);
        console.log(`  Strategy: ${profile?.optimization.strategy}`);
        console.log(`  Improvements: ${profile?.optimization.improvements}`);
    }

    /**
     * Demo 3: Resource Optimization
     */
    async demoResourceOptimization(): Promise<void> {
        console.log('\n=== Demo 3: Resource Optimization ===');

        const component = this.componentRegistry.getComponent('resource_heavy_neural')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Yellow',
            timeLimit: 2000,
            difficulty: 8
        };

        console.log('Resource usage before optimization:');
        const profileBefore = await this.performanceOptimizer.getComponentProfile('resource_heavy_neural');
        console.log(`  CPU usage: ${profileBefore?.resources.cpu.usage}%`);
        console.log(`  Memory usage: ${profileBefore?.resources.memory.usage}MB`);
        console.log(`  GPU usage: ${profileBefore?.resources.gpu.usage}%`);
        console.log(`  CPU efficiency: ${profileBefore?.resources.cpu.efficiency.toFixed(2)}`);

        // Apply optimization
        const result = await this.performanceOptimizer.optimizePerformance(component, request);

        console.log('\nResource optimization result:');
        console.log(`  Applied: ${result.applied}`);
        console.log(`  Strategy: ${result.optimization}`);

        if (result.optimization === 'memory_optimization') {
            console.log(`  Memory before: ${result.results?.before}MB`);
            console.log(`  Memory after: ${result.results?.after}MB`);
            console.log(`  Improvement: ${(result.results?.improvement || 0) * 100}%`);
        }

        // Show updated resource usage
        const profileAfter = await this.performanceOptimizer.getComponentProfile('resource_heavy_neural');
        console.log('\nResource usage after optimization:');
        console.log(`  CPU usage: ${profileAfter?.resources.cpu.usage}%`);
        console.log(`  Memory usage: ${profileAfter?.resources.memory.usage}MB`);
        console.log(`  GPU usage: ${profileAfter?.resources.gpu.usage}%`);
        console.log(`  CPU efficiency: ${profileAfter?.resources.cpu.efficiency.toFixed(2)}`);
    }

    /**
     * Demo 4: Performance Analytics
     */
    async demoPerformanceAnalytics(): Promise<void> {
        console.log('\n=== Demo 4: Performance Analytics ===');

        // Get performance snapshot
        const snapshot = await this.performanceOptimizer.getPerformanceSnapshot();

        console.log('Performance Snapshot:');
        console.log(`  Average think time: ${snapshot.averageThinkTime.toFixed(2)}ms`);
        console.log(`  Cache hit rate: ${(snapshot.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  Optimization score: ${(snapshot.optimizationScore * 100).toFixed(1)}%`);
        console.log(`  Adaptation rate: ${snapshot.adaptationRate.toFixed(2)} opt/sec`);

        console.log('\nComponent Performance:');
        Object.entries(snapshot.componentPerformance || {}).forEach(([name, perf]) => {
            console.log(`  ${name}:`);
            console.log(`    Response time: ${perf.avgResponseTime.toFixed(2)}ms`);
            console.log(`    Success rate: ${(perf.successRate * 100).toFixed(1)}%`);
            console.log(`    Optimization level: ${perf.optimizationLevel}`);
        });

        // Get detailed analytics
        const analytics = await this.performanceOptimizer.getPerformanceAnalytics();

        console.log('\nSystem Analytics:');
        console.log(`  Total throughput: ${analytics.system.totalThroughput.toFixed(2)} req/sec`);
        console.log(`  Resource efficiency: ${(analytics.system.resourceEfficiency * 100).toFixed(1)}%`);
        console.log(`  Optimization effectiveness: ${(analytics.system.optimizationEffectiveness * 100).toFixed(1)}%`);

        console.log('\nRecommendations:');
        analytics.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec.component}: ${rec.optimization}`);
            console.log(`     Expected improvement: ${(rec.expectedImprovement * 100).toFixed(1)}%`);
            console.log(`     Priority: ${rec.priority}`);
            console.log(`     Reasoning: ${rec.reasoning}`);
        });

        if (analytics.anomalies.length > 0) {
            console.log('\nAnomalies Detected:');
            analytics.anomalies.forEach((anomaly, index) => {
                console.log(`  ${index + 1}. ${anomaly.component}: ${anomaly.metric}`);
                console.log(`     Value: ${anomaly.value}`);
                console.log(`     Expected range: ${anomaly.expectedRange[0]} - ${anomaly.expectedRange[1]}`);
                console.log(`     Severity: ${anomaly.severity}`);
            });
        }
    }

    /**
     * Demo 5: Learning and Pattern Recognition
     */
    async demoLearningAndPatternRecognition(): Promise<void> {
        console.log('\n=== Demo 5: Learning and Pattern Recognition ===');

        const component = this.componentRegistry.getComponent('standard_mcts')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 3000,
            difficulty: 6
        };

        console.log('Running learning cycle...');

        // Apply optimizations multiple times to build learning data
        for (let i = 0; i < 10; i++) {
            console.log(`Learning iteration ${i + 1}:`);

            const result = await this.performanceOptimizer.optimizePerformance(component, request);

            if (result.applied) {
                console.log(`  Applied ${result.optimization} with ${(result.results?.improvement || 0) * 100}% improvement`);
            } else {
                console.log(`  No optimization applied`);
            }

            // Simulate some execution
            const allocation = { cpu: 50, memory: 400, gpu: 10 };
            await this.performanceOptimizer.executeWithMonitoring(component, request, allocation);

            await this.simulateProcessing(50);
        }

        // Show learning results
        const profile = await this.performanceOptimizer.getComponentProfile('standard_mcts');
        console.log('\nLearning Results:');
        console.log(`  Total optimizations: ${profile?.optimization.level}`);
        console.log(`  Successful improvements: ${profile?.optimization.improvements}`);
        console.log(`  Current strategy: ${profile?.optimization.strategy}`);

        // Show performance trends
        console.log('\nPerformance Trends:');
        console.log(`  Response time trend: ${profile?.metrics.responseTime.trend > 0 ? 'Improving' : 'Degrading'}`);
        console.log(`  Throughput trend: ${profile?.metrics.throughput.trend > 0 ? 'Improving' : 'Degrading'}`);
        console.log(`  Quality consistency: ${(profile?.quality.consistency || 0) * 100}%`);
        console.log(`  System stability: ${(profile?.quality.stability || 0) * 100}%`);
    }

    /**
     * Demo 6: Configuration Management
     */
    async demoConfigurationManagement(): Promise<void> {
        console.log('\n=== Demo 6: Configuration Management ===');

        // Show current configuration
        const currentConfig = await this.performanceOptimizer.getConfig();
        console.log('Current Configuration:');
        console.log(`  Optimization aggressiveness: ${currentConfig.optimization.aggressiveness}`);
        console.log(`  Learning rate: ${currentConfig.optimization.learningRate}`);
        console.log(`  Monitoring interval: ${currentConfig.monitoring.interval}ms`);
        console.log(`  Analytics enabled: ${currentConfig.analytics.enabled}`);

        // Update configuration
        console.log('\nUpdating configuration for more aggressive optimization...');

        await this.performanceOptimizer.updateConfig({
            optimization: {
                enabled: true,
                aggressiveness: 0.9,
                learningRate: 0.2,
                adaptationThreshold: 0.6,
                rollbackEnabled: true
            },
            monitoring: {
                enabled: true,
                interval: 1000,
                windowSize: 20,
                dataRetention: 60000
            }
        });

        const updatedConfig = await this.performanceOptimizer.getConfig();
        console.log('\nUpdated Configuration:');
        console.log(`  Optimization aggressiveness: ${updatedConfig.optimization.aggressiveness}`);
        console.log(`  Learning rate: ${updatedConfig.optimization.learningRate}`);
        console.log(`  Monitoring interval: ${updatedConfig.monitoring.interval}ms`);
        console.log(`  Window size: ${updatedConfig.monitoring.windowSize}`);

        // Test with new configuration
        const component = this.componentRegistry.getComponent('adaptive_hybrid')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 2500,
            difficulty: 9
        };

        console.log('\nTesting with new configuration...');
        const result = await this.performanceOptimizer.optimizePerformance(component, request);

        console.log(`  Optimization applied: ${result.applied}`);
        console.log(`  Strategy: ${result.optimization}`);
        if (result.results) {
            console.log(`  Improvement: ${(result.results.improvement * 100).toFixed(1)}%`);
        }
    }

    /**
     * Demo 7: System Health and Monitoring
     */
    async demoSystemHealthAndMonitoring(): Promise<void> {
        console.log('\n=== Demo 7: System Health and Monitoring ===');

        // System health check
        const health = await this.performanceOptimizer.healthCheck();
        console.log('Performance Optimizer Health:');
        console.log(`  Health score: ${(health.score * 100).toFixed(1)}%`);
        console.log(`  Status: ${health.status}`);
        console.log(`  Response time: ${health.metrics?.responseTime}ms`);
        console.log(`  Request count: ${health.metrics?.requestCount}`);

        // Component profiles
        console.log('\nComponent Profiles:');
        const components = this.componentRegistry.getAllComponents();

        for (const component of components) {
            const profile = await this.performanceOptimizer.getComponentProfile(component.name);
            if (profile) {
                console.log(`\n  ${component.name}:`);
                console.log(`    Response time: ${profile.metrics.responseTime.current.toFixed(2)}ms`);
                console.log(`    Throughput: ${profile.metrics.throughput.current.toFixed(2)} req/sec`);
                console.log(`    Reliability: ${(profile.metrics.reliability.current * 100).toFixed(1)}%`);
                console.log(`    CPU efficiency: ${profile.resources.cpu.efficiency.toFixed(2)}`);
                console.log(`    Memory efficiency: ${profile.resources.memory.efficiency.toFixed(2)}`);
                console.log(`    Quality score: ${(profile.quality.decisionQuality * 100).toFixed(1)}%`);
            }
        }

        // Real-time monitoring demonstration
        console.log('\n  Real-time monitoring (5 seconds)...');

        const monitoringEvents: string[] = [];

        const eventHandler = (event: any) => {
            monitoringEvents.push(`${event.type}: ${event.component} - ${event.data.metric || event.data.strategy}`);
        };

        this.performanceOptimizer.on('optimization_applied', eventHandler);
        this.performanceOptimizer.on('adaptive_optimization', eventHandler);

        // Simulate some activity
        const testComponent = this.componentRegistry.getComponent('standard_mcts')!;
        const testRequest: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1500,
            difficulty: 7
        };

        for (let i = 0; i < 3; i++) {
            const allocation = { cpu: 50, memory: 400, gpu: 10 };
            await this.performanceOptimizer.executeWithMonitoring(testComponent, testRequest, allocation);
            await this.simulateProcessing(200);
        }

        await this.simulateProcessing(2000);

        console.log('\nMonitoring Events:');
        monitoringEvents.forEach((event, index) => {
            console.log(`  ${index + 1}. ${event}`);
        });

        this.performanceOptimizer.off('optimization_applied', eventHandler);
        this.performanceOptimizer.off('adaptive_optimization', eventHandler);
    }

    // === Helper Methods ===

    private async simulateProcessing(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    private calculateOptimalMove(board: any[][], player: string): number {
        // Simple heuristic: prefer center columns
        const centerColumns = [3, 2, 4, 1, 5, 0, 6];
        for (const col of centerColumns) {
            if (this.isValidMove(board, col)) {
                return col;
            }
        }
        return 3;
    }

    private calculateMCTSMove(board: any[][], player: string): number {
        // Simulate MCTS decision
        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                validMoves.push(col);
            }
        }
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    private calculateNeuralMove(board: any[][], player: string): number {
        // Simulate neural network decision
        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                validMoves.push(col);
            }
        }
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    private calculateHybridMove(board: any[][], player: string): number {
        // Combine multiple strategies
        const minmaxMove = this.calculateOptimalMove(board, player);
        const mctsMove = this.calculateMCTSMove(board, player);

        // Weighted decision
        return Math.random() < 0.7 ? minmaxMove : mctsMove;
    }

    private isValidMove(board: any[][], col: number): boolean {
        return col >= 0 && col < 7 && board[0][col] === 0;
    }

    private generateRandomBoard(): any[][] {
        const board = Array(6).fill(null).map(() => Array(7).fill(0));

        // Add some random pieces
        const numPieces = Math.floor(Math.random() * 15);
        for (let i = 0; i < numPieces; i++) {
            const col = Math.floor(Math.random() * 7);
            const player = (i % 2) + 1;

            // Find bottom-most empty row
            for (let row = 5; row >= 0; row--) {
                if (board[row][col] === 0) {
                    board[row][col] = player;
                    break;
                }
            }
        }

        return board;
    }

    // === Main Demo Runner ===

    async runAllDemos(): Promise<void> {
        console.log('🎯 Starting PerformanceOptimizer Demo Suite');
        console.log('==========================================');

        try {
            await this.demoBasicOptimization();
            await this.demoAdaptivePerformanceTuning();
            await this.demoResourceOptimization();
            await this.demoPerformanceAnalytics();
            await this.demoLearningAndPatternRecognition();
            await this.demoConfigurationManagement();
            await this.demoSystemHealthAndMonitoring();

            console.log('\n🏆 All demos completed successfully!');
            console.log('==========================================');

            // Show final system state
            const finalSnapshot = await this.performanceOptimizer.getPerformanceSnapshot();
            console.log('\nFinal System State:');
            console.log(`  Average response time: ${finalSnapshot.averageThinkTime.toFixed(2)}ms`);
            console.log(`  Optimization score: ${(finalSnapshot.optimizationScore * 100).toFixed(1)}%`);
            console.log(`  System efficiency: ${(finalSnapshot.cacheHitRate * 100).toFixed(1)}%`);

        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        } finally {
            // Cleanup
            await this.performanceOptimizer.shutdown();
            await this.healthMonitor.shutdown();
            await this.componentRegistry.shutdown();
        }
    }
}

// Export demo runner
export async function runPerformanceOptimizerDemo(): Promise<void> {
    const demo = new PerformanceOptimizerDemo();
    await demo.runAllDemos();
}

// Run demo if called directly
if (require.main === module) {
    runPerformanceOptimizerDemo().catch(console.error);
} 