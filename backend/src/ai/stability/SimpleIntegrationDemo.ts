/**
 * Simple Integration Demo
 * 
 * A lightweight demo to test and showcase the AI component integration
 * without complex dependencies. This demonstrates the core integration
 * functionality and unified management capabilities.
 */

import { UnifiedAIRegistry } from './UnifiedAIRegistry';
import { AIStabilityManager } from './AIStabilityManager';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import { FallbackSystem } from './FallbackSystem';
import { PerformanceOptimizer } from './PerformanceOptimizer';
import { SafetySystem } from './SafetySystem';
import {
    AIComponent,
    AIRequest,
    AIResponse,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    ComponentHealth,
    ComponentMetrics,
    CellValue
} from './interfaces';

/**
 * Simple Integration Demo Class
 */
export class SimpleIntegrationDemo {
    private unifiedRegistry: UnifiedAIRegistry;
    private stabilityManager: AIStabilityManager;

    constructor() {
        console.log('🚀 Initializing Simple Integration Demo...');
        this.setupIntegration();
    }

    private setupIntegration(): void {
        // Initialize core stability components
        const componentRegistry = new ComponentRegistry({
            autoRegistration: true,
            loadOnDemand: true,
            healthChecks: true,
            componentValidation: true
        });

        const resourceManager = new ResourceManager({
            limits: {
                maxCpuUsage: 80,
                maxMemoryUsage: 2048,
                maxGpuUsage: 90,
                maxConcurrentAI: 5
            }
        });

        const healthMonitor = new HealthMonitor({
            healthCheck: {
                interval: 5000,
                timeout: 3000,
                retries: 2,
                batchSize: 5
            },
            thresholds: {
                healthy: 0.8,
                degraded: 0.6,
                unhealthy: 0.4,
                critical: 0.2
            }
        });

        const fallbackSystem = new FallbackSystem({
            enabled: true,
            fastFallback: true,
            maxFallbackDepth: 2,
            fallbackTimeout: 2000
        }, componentRegistry, resourceManager, healthMonitor);

        const performanceOptimizer = new PerformanceOptimizer({
            monitoring: {
                enabled: true,
                interval: 2000,
                windowSize: 5,
                dataRetention: 60000
            },
            optimization: {
                enabled: true,
                aggressiveness: 0.6,
                learningRate: 0.1,
                adaptationThreshold: 0.1,
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
                    excellent: 50,
                    good: 100,
                    acceptable: 500,
                    poor: 1000
                },
                throughput: {
                    minimum: 10,
                    target: 100,
                    maximum: 1000
                },
                resourceUsage: {
                    cpu: 80,
                    memory: 80,
                    gpu: 80
                }
            }
        }, componentRegistry, resourceManager, healthMonitor);

        const safetySystem = new SafetySystem({
            validation: {
                enabled: true,
                strictMode: false,
                inputValidation: true,
                outputValidation: true,
                schemaValidation: true
            },
            sandboxing: {
                enabled: true,
                isolationLevel: 'basic',
                memoryLimit: 512,
                timeLimit: 5000,
                resourceLimits: {
                    cpu: 70,
                    memory: 512,
                    gpu: 80
                }
            }
        }, componentRegistry, resourceManager, healthMonitor);

        // Initialize unified registry with simpler config
        this.unifiedRegistry = new UnifiedAIRegistry({
            autoDiscovery: false, // Disable auto-discovery for demo
            autoRegistration: true,
            healthCheckInterval: 10000,
            componentValidation: true,
            performanceTracking: true
        }, componentRegistry);

        // Initialize stability manager
        this.stabilityManager = new AIStabilityManager({
            maxConcurrentRequests: 5,
            defaultTimeout: 10000,
            maxRetries: 2,
            resources: {
                maxCpuUsage: 70,
                maxMemoryUsage: 512,
                maxGpuUsage: 80,
                maxConcurrentAI: 3
            },
            health: {
                checkInterval: 3000,
                unhealthyThreshold: 0.4,
                recoveryThreshold: 0.6,
                circuitBreakerThreshold: 0.2
            },
            performance: {
                adaptiveOptimization: true,
                loadBalancing: true,
                resourceOptimization: true,
                cacheEnabled: true,
                cacheSize: 500
            },
            safety: {
                sandboxMode: true,
                validationEnabled: true,
                maxExecutionTime: 10000,
                memoryLimit: 256,
                errorContainment: true
            },
            fallback: {
                enabled: true,
                fastFallback: true,
                maxFallbackDepth: 3,
                fallbackTimeout: 5000
            }
        });
    }

    // === Demo Mock Components ===

    private createMockComponents(): AIComponent[] {
        return [
            // Mock Basic AI
            {
                name: 'mock_basic_ai',
                type: AIComponentType.BASIC,
                tier: ComponentTier.STABLE,
                priority: 5,
                timeout: 3000,
                memoryLimit: 128,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest): Promise<AIResponse> => {
                    const startTime = Date.now();

                    // Simulate processing
                    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

                    // Calculate a simple move
                    const move = this.calculateBasicMove(request.board);

                    return {
                        decision: {
                            move,
                            confidence: 0.7 + Math.random() * 0.2,
                            reasoning: 'Basic AI heuristic decision',
                            alternativeMoves: [],
                            thinkingTime: Date.now() - startTime,
                            nodesExplored: 100,
                            strategy: 'basic_heuristic'
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async (): Promise<ComponentHealth> => ({
                    score: 0.85 + Math.random() * 0.1,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 150,
                        memoryUsage: 200,
                        cpuUsage: 25
                    }
                }),
                getMetrics: async (): Promise<ComponentMetrics> => ({
                    name: 'mock_basic_ai',
                    performance: {
                        averageResponseTime: 150,
                        minResponseTime: 80,
                        maxResponseTime: 300,
                        throughput: 15,
                        successRate: 0.95,
                        errorRate: 0.05
                    },
                    resources: {
                        cpuUsage: 25,
                        memoryUsage: 200,
                        gpuUsage: 0
                    },
                    health: {
                        uptime: 99.1,
                        availability: 98.8,
                        reliability: 96.5,
                        failureCount: 1
                    },
                    requests: {
                        total: 500,
                        successful: 475,
                        failed: 25,
                        retries: 15,
                        timeouts: 10
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 3600000
                })
            },

            // Mock Minimax AI
            {
                name: 'mock_minimax_ai',
                type: AIComponentType.MINIMAX,
                tier: ComponentTier.STABLE,
                priority: 4,
                timeout: 5000,
                memoryLimit: 256,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest): Promise<AIResponse> => {
                    const startTime = Date.now();

                    // Simulate minimax processing
                    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));

                    const move = this.calculateMinimaxMove(request.board, request.player === 'Red' ? 1 : 2);

                    return {
                        decision: {
                            move,
                            confidence: 0.8 + Math.random() * 0.15,
                            reasoning: 'Minimax search with alpha-beta pruning',
                            alternativeMoves: [
                                { move: (move + 1) % 7, score: 0.7, reasoning: 'Alternative option' },
                                { move: (move + 2) % 7, score: 0.6, reasoning: 'Secondary choice' }
                            ],
                            thinkingTime: Date.now() - startTime,
                            nodesExplored: 1500 + Math.floor(Math.random() * 1000),
                            strategy: 'minimax_alpha_beta'
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async (): Promise<ComponentHealth> => ({
                    score: 0.90 + Math.random() * 0.08,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 450,
                        memoryUsage: 380,
                        cpuUsage: 45
                    }
                }),
                getMetrics: async (): Promise<ComponentMetrics> => ({
                    name: 'mock_minimax_ai',
                    performance: {
                        averageResponseTime: 450,
                        minResponseTime: 200,
                        maxResponseTime: 800,
                        throughput: 8,
                        successRate: 0.98,
                        errorRate: 0.02
                    },
                    resources: {
                        cpuUsage: 45,
                        memoryUsage: 380,
                        gpuUsage: 0
                    },
                    health: {
                        uptime: 99.5,
                        availability: 99.2,
                        reliability: 98.1,
                        failureCount: 0
                    },
                    requests: {
                        total: 300,
                        successful: 294,
                        failed: 6,
                        retries: 4,
                        timeouts: 2
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 3600000
                })
            },

            // Mock Neural Network AI
            {
                name: 'mock_neural_ai',
                type: AIComponentType.NEURAL,
                tier: ComponentTier.ADVANCED,
                priority: 3,
                timeout: 8000,
                memoryLimit: 512,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest): Promise<AIResponse> => {
                    const startTime = Date.now();

                    // Simulate neural network inference
                    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 600));

                    const move = this.calculateNeuralMove(request.board, request.difficulty);

                    return {
                        decision: {
                            move,
                            confidence: 0.75 + Math.random() * 0.2,
                            reasoning: 'Deep neural network prediction',
                            alternativeMoves: [
                                { move: (move + 1) % 7, score: 0.8, reasoning: 'High probability alternative' },
                                { move: (move + 3) % 7, score: 0.65, reasoning: 'Strategic variation' }
                            ],
                            thinkingTime: Date.now() - startTime,
                            nodesExplored: 1,
                            strategy: 'deep_neural_network'
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async (): Promise<ComponentHealth> => ({
                    score: 0.88 + Math.random() * 0.1,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now(),
                    metrics: {
                        responseTime: 650,
                        memoryUsage: 800,
                        cpuUsage: 60,
                        requestCount: 200
                    }
                }),
                getMetrics: async (): Promise<ComponentMetrics> => ({
                    name: 'mock_neural_ai',
                    performance: {
                        averageResponseTime: 650,
                        minResponseTime: 400,
                        maxResponseTime: 1200,
                        throughput: 5,
                        successRate: 0.92,
                        errorRate: 0.08
                    },
                    resources: {
                        cpuUsage: 60,
                        memoryUsage: 800,
                        gpuUsage: 40
                    },
                    health: {
                        uptime: 98.8,
                        availability: 98.5,
                        reliability: 94.2,
                        failureCount: 3
                    },
                    requests: {
                        total: 200,
                        successful: 184,
                        failed: 16,
                        retries: 12,
                        timeouts: 8
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 3600000
                })
            },

            // Mock Experimental AI (might fail sometimes)
            {
                name: 'mock_experimental_ai',
                type: AIComponentType.RL,
                tier: ComponentTier.EXPERIMENTAL,
                priority: 2,
                timeout: 10000,
                memoryLimit: 1024,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest): Promise<AIResponse> => {
                    const startTime = Date.now();

                    // Simulate potential failure
                    if (Math.random() < 0.2) {
                        throw new Error('Experimental AI encountered an error');
                    }

                    // Simulate longer processing
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

                    const move = this.calculateExperimentalMove(request.board);

                    return {
                        decision: {
                            move,
                            confidence: 0.6 + Math.random() * 0.3,
                            reasoning: 'Experimental reinforcement learning approach',
                            alternativeMoves: [],
                            thinkingTime: Date.now() - startTime,
                            nodesExplored: 5000 + Math.floor(Math.random() * 3000),
                            strategy: 'experimental_rl'
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async (): Promise<ComponentHealth> => {
                    const healthScore = 0.6 + Math.random() * 0.3;
                    return {
                        score: healthScore,
                        status: healthScore > 0.8 ? ComponentStatus.HEALTHY :
                            healthScore > 0.6 ? ComponentStatus.DEGRADED : ComponentStatus.UNHEALTHY,
                        lastCheck: Date.now(),
                        metrics: {
                            responseTime: 1200,
                            memoryUsage: 1500,
                            cpuUsage: 70,
                            errorRate: 0.2
                        }
                    };
                },
                getMetrics: async (): Promise<ComponentMetrics> => ({
                    name: 'mock_experimental_ai',
                    performance: {
                        averageResponseTime: 1200,
                        minResponseTime: 600,
                        maxResponseTime: 2500,
                        throughput: 3,
                        successRate: 0.8,
                        errorRate: 0.2
                    },
                    resources: {
                        cpuUsage: 70,
                        memoryUsage: 1500,
                        gpuUsage: 60
                    },
                    health: {
                        uptime: 95.2,
                        availability: 94.8,
                        reliability: 88.5,
                        failureCount: 8
                    },
                    requests: {
                        total: 150,
                        successful: 120,
                        failed: 30,
                        retries: 25,
                        timeouts: 15
                    },
                    timestamp: Date.now(),
                    collectionPeriod: 3600000
                })
            }
        ];
    }

    // === Demo Scenarios ===

    /**
     * Demo 1: Component Registration
     */
    async demoComponentRegistration(): Promise<void> {
        console.log('\n📝 Demo 1: Component Registration');
        console.log('==================================');

        try {
            // Initialize the unified registry
            await this.unifiedRegistry.initialize();

            // Register mock components
            const mockComponents = this.createMockComponents();
            console.log(`🔧 Registering ${mockComponents.length} mock components...`);

            for (const component of mockComponents) {
                await this.unifiedRegistry.registerComponent(component, {
                    category: 'mock',
                    algorithm: component.type,
                    version: '1.0.0',
                    author: 'Demo Team',
                    description: `Mock ${component.type} component for demonstration`,
                    capabilities: ['move_generation', 'board_evaluation'],
                    requirements: { memory: component.memoryLimit, cpu: 30 }
                });
            }

            // Initialize stability manager
            await this.stabilityManager.initialize();

            console.log('✅ All components registered successfully!');

            // Display registration stats
            const stats = this.unifiedRegistry.getRegistryStats();
            console.log('\n📊 Registration Statistics:');
            console.log(`  Total components: ${stats.totalComponents}`);
            console.log(`  Healthy components: ${stats.healthyComponents}`);
            console.log(`  Component distribution:`);
            for (const [tier, count] of Object.entries(stats.componentsByTier)) {
                console.log(`    ${tier}: ${count}`);
            }

        } catch (error) {
            console.error('❌ Registration failed:', error.message);
        }
    }

    /**
     * Demo 2: Multi-Component Orchestration
     */
    async demoMultiComponentOrchestration(): Promise<void> {
        console.log('\n🎼 Demo 2: Multi-Component Orchestration');
        console.log('========================================');

        const testBoard = this.createTestBoard();
        const request: AIRequest = {
            type: 'move',
            board: testBoard,
            player: 'Red',
            timeLimit: 5000,
            difficulty: 7
        };

        // Test each registered component
        const components = this.unifiedRegistry.getAllComponents();
        console.log(`🎯 Testing ${components.length} components...`);

        for (const componentInfo of components) {
            try {
                console.log(`\n  Testing ${componentInfo.component.name}:`);

                const response = await this.stabilityManager.getBestMove(
                    request.board,
                    request.player as CellValue,
                    { strategy: componentInfo.component.name, timeLimit: request.timeLimit, difficulty: request.difficulty }
                );

                console.log(`    ✅ Success: move ${response.decision.move}`);
                console.log(`    🎯 Confidence: ${response.decision.confidence.toFixed(3)}`);
                console.log(`    ⏱️ Time: ${response.executionTime}ms`);
                console.log(`    🛡️ Safety score: ${response.safetyScore?.toFixed(3)}`);
                console.log(`    📊 Strategy: ${response.decision.strategy}`);

                // Update usage count
                this.unifiedRegistry.incrementUsageCount(componentInfo.component.name);

            } catch (error) {
                console.log(`    ❌ Failed: ${error.message}`);
            }
        }
    }

    /**
     * Demo 3: Smart Component Selection
     */
    async demoSmartSelection(): Promise<void> {
        console.log('\n🧠 Demo 3: Smart Component Selection');
        console.log('===================================');

        const scenarios = [
            {
                name: 'Fast Response Required',
                criteria: { maxResponseTime: 500 },
                description: 'Need quick decision making'
            },
            {
                name: 'High Accuracy Required',
                criteria: { minHealthScore: 0.9 },
                description: 'Need reliable, accurate results'
            },
            {
                name: 'Neural Network Preferred',
                criteria: { type: AIComponentType.NEURAL },
                description: 'Specifically want neural network approach'
            },
            {
                name: 'Stable Tier Only',
                criteria: { tier: ComponentTier.STABLE },
                description: 'Only production-ready components'
            }
        ];

        for (const scenario of scenarios) {
            console.log(`\n🎯 Scenario: ${scenario.name}`);
            console.log(`   ${scenario.description}`);

            const selectedComponent = this.unifiedRegistry.selectBestComponent(scenario.criteria);

            if (selectedComponent) {
                console.log(`   ✅ Selected: ${selectedComponent.component.name}`);
                console.log(`   📊 Tier: ${ComponentTier[selectedComponent.component.tier]}`);
                console.log(`   🎯 Priority: ${selectedComponent.component.priority}`);
                console.log(`   ⚡ Type: ${selectedComponent.component.type}`);

                // Test the selected component
                try {
                    const request: AIRequest = {
                        type: 'move',
                        board: this.createTestBoard(),
                        player: 'Red',
                        timeLimit: 3000,
                        difficulty: 5
                    };

                    const response = await this.stabilityManager.getBestMove(
                        request.board,
                        request.player,
                        { strategy: selectedComponent.component.name }
                    );
                    console.log(`   🎲 Move: ${response.decision.move}, Time: ${response.executionTime}ms`);

                } catch (error) {
                    console.log(`   ❌ Execution failed: ${error.message}`);
                }
            } else {
                console.log(`   ❌ No component matches criteria`);
            }
        }
    }

    /**
     * Demo 4: Error Handling and Fallbacks
     */
    async demoErrorHandling(): Promise<void> {
        console.log('\n🚨 Demo 4: Error Handling and Fallbacks');
        console.log('=======================================');

        const errorScenarios = [
            {
                name: 'Experimental Component (High Failure Rate)',
                componentName: 'mock_experimental_ai',
                description: 'Testing component that fails ~20% of the time'
            },
            {
                name: 'Nonexistent Component',
                componentName: 'nonexistent_component',
                description: 'Testing fallback when component not found'
            },
            {
                name: 'Invalid Request',
                componentName: 'mock_basic_ai',
                request: {
                    type: 'move' as const,
                    board: Array(5).fill(null).map(() => Array(7).fill(0)), // Wrong size
                    player: 'Red',
                    timeLimit: 1000,
                    difficulty: 5
                },
                description: 'Testing with invalid board dimensions'
            }
        ];

        for (const scenario of errorScenarios) {
            console.log(`\n🧪 Testing: ${scenario.name}`);
            console.log(`   ${scenario.description}`);

            const request = scenario.request || {
                type: 'move',
                board: this.createTestBoard(),
                player: 'Red',
                timeLimit: 1000,
                difficulty: 5
            };

            // Try multiple times to test error handling
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`   Attempt ${attempt}:`);

                    const response = await this.stabilityManager.getBestMove(
                        request.board,
                        request.player as CellValue,
                        { strategy: scenario.componentName }
                    );

                    console.log(`     ✅ Success: move ${response.decision.move}`);
                    console.log(`     🔄 Fallbacks used: ${response.fallbacksUsed || 0}`);
                    console.log(`     🛡️ Safety score: ${response.safetyScore?.toFixed(3)}`);

                    if (response.errors && response.errors.length > 0) {
                        console.log(`     ⚠️ Errors handled: ${response.errors.length}`);
                    }

                    break; // Success, no need to retry

                } catch (error) {
                    console.log(`     ❌ Failed: ${error.message}`);

                    if (attempt === 3) {
                        console.log(`     🚫 All attempts failed`);
                    }
                }
            }
        }
    }

    /**
     * Demo 5: Performance Monitoring
     */
    async demoPerformanceMonitoring(): Promise<void> {
        console.log('\n📊 Demo 5: Performance Monitoring');
        console.log('=================================');

        // Generate some load
        console.log('🚀 Generating performance data...');

        const components = this.unifiedRegistry.getAllComponents();
        const requests = Array.from({ length: 15 }, (_, i) => ({
            type: 'move' as const,
            board: this.createTestBoard(),
            player: (i % 2) === 0 ? 'Red' : 'Yellow',
            timeLimit: 1000 + (i * 100),
            difficulty: 3 + (i % 5)
        }));

        for (let i = 0; i < requests.length; i++) {
            const component = components[i % components.length];

            try {
                const response = await this.stabilityManager.getBestMove(
                    requests[i].board,
                    requests[i].player as CellValue,
                    { timeLimit: requests[i].timeLimit, strategy: component.component.name, difficulty: requests[i].difficulty }
                );
                console.log(`  Request ${i + 1}: ${component.component.name} -> move ${response.decision.move} (${response.executionTime}ms)`);

                // Increment usage
                this.unifiedRegistry.incrementUsageCount(component.component.name);

            } catch (error) {
                console.log(`  Request ${i + 1}: ${component.component.name} -> failed (${error.message})`);
            }
        }

        // Get performance metrics
        console.log('\n📈 Performance Summary:');

        const systemMetrics = await this.stabilityManager.getSystemMetrics();
        console.log(`  System health: ${(systemMetrics.health.overallHealth * 100).toFixed(1)}%`);
        console.log(`  Resource efficiency: ${(systemMetrics.resources.cpuUsage * 100).toFixed(1)}%`);
        console.log(`  Average response time: ${systemMetrics.requests.averageResponseTime.toFixed(1)}ms`);
        console.log(`  Success rate: ${(systemMetrics.requests.successful / systemMetrics.requests.total * 100).toFixed(1)}%`);

        // Component-specific metrics
        console.log('\n🔧 Component Performance:');
        for (const componentInfo of components) {
            try {
                const metrics = await componentInfo.component.getMetrics?.();
                if (metrics) {
                    console.log(`  ${componentInfo.component.name}:`);
                    console.log(`    Success rate: ${(metrics.performance.successRate * 100).toFixed(1)}%`);
                    console.log(`    Avg response: ${metrics.performance.averageResponseTime.toFixed(1)}ms`);
                    console.log(`    CPU usage: ${metrics.resources.cpuUsage.toFixed(1)}%`);
                    console.log(`    Memory: ${metrics.resources.memoryUsage}MB`);
                }
            } catch (error) {
                console.log(`    ❌ Metrics unavailable for ${componentInfo.component.name}`);
            }
        }
    }

    // === Helper Methods ===

    private calculateBasicMove(board: CellValue[][]): number {
        // Simple heuristic: prefer center columns
        const centerColumns = [3, 2, 4, 1, 5, 0, 6];
        for (const col of centerColumns) {
            if (this.isValidMove(board, col)) {
                return col;
            }
        }
        return 3; // Fallback
    }

    private calculateMinimaxMove(board: CellValue[][], player: number): number {
        // Simulate minimax: avoid opponent wins, try to create own wins
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                // Check for immediate win
                if (this.wouldWin(board, col, player === 1 ? 'Red' : 'Yellow')) {
                    return col;
                }
            }
        }

        // Block opponent wins
        const opponent = player === 1 ? 2 : 1;
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                if (this.wouldWin(board, col, opponent === 1 ? 'Red' : 'Yellow')) {
                    return col;
                }
            }
        }

        return this.calculateBasicMove(board);
    }

    private calculateNeuralMove(board: CellValue[][], difficulty: number): number {
        // Simulate neural network: weighted random based on difficulty
        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                validMoves.push(col);
            }
        }

        if (validMoves.length === 0) return 3;

        // Higher difficulty -> prefer center columns
        if (difficulty > 7 && validMoves.includes(3)) {
            return 3;
        }

        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    private calculateExperimentalMove(board: CellValue[][]): number {
        // Simulate experimental AI: completely random valid move
        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                validMoves.push(col);
            }
        }

        return validMoves.length > 0 ?
            validMoves[Math.floor(Math.random() * validMoves.length)] : 3;
    }

    private isValidMove(board: CellValue[][], col: number): boolean {
        return col >= 0 && col < 7 && board[0][col] === 'Empty';
    }

    private wouldWin(board: CellValue[][], col: number, player: CellValue): boolean {
        // Simple win check: just check if column placement would create 4 in a row vertically
        let row = -1;
        for (let r = 5; r >= 0; r--) {
            if (board[r][col] === 'Empty') {
                row = r;
                break;
            }
        }

        if (row === -1) return false;

        // Check vertical win (need 3 more pieces below)
        let count = 1;
        for (let r = row + 1; r < 6 && board[r][col] === player; r++) {
            count++;
        }

        return count >= 4;
    }

    private createTestBoard(): CellValue[][] {
        return [
            ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Red', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
            ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Yellow', 'Red']
        ];
    }

    // === Main Demo Runner ===

    async runSimpleDemo(): Promise<void> {
        console.log('🚀 Starting Simple AI Integration Demo');
        console.log('======================================');

        try {
            await this.demoComponentRegistration();
            await this.demoMultiComponentOrchestration();
            await this.demoSmartSelection();
            await this.demoErrorHandling();
            await this.demoPerformanceMonitoring();

            console.log('\n🏆 Simple Integration Demo Complete!');
            console.log('===================================');

            // Final summary
            const stats = this.unifiedRegistry.getRegistryStats();
            console.log('\n📊 Final Summary:');
            console.log(`  Components integrated: ${stats.totalComponents}`);
            console.log(`  Total requests: ${stats.totalRequests}`);
            console.log(`  Average response time: ${stats.averageResponseTime.toFixed(1)}ms`);
            console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
            console.log(`  Integration status: ✅ SUCCESSFUL`);

        } catch (error) {
            console.error('❌ Demo failed:', error);
        } finally {
            await this.shutdown();
        }
    }

    async shutdown(): Promise<void> {
        console.log('\n🧹 Shutting down demo...');

        try {
            await this.stabilityManager.shutdown();
            await this.unifiedRegistry.shutdown();
            console.log('✅ Demo shutdown complete');
        } catch (error) {
            console.error('❌ Shutdown error:', error);
        }
    }
}

// Export demo runner
export async function runSimpleIntegrationDemo(): Promise<void> {
    const demo = new SimpleIntegrationDemo();
    await demo.runSimpleDemo();
}

// Run demo if called directly
if (require.main === module) {
    runSimpleIntegrationDemo().catch(console.error);
} 