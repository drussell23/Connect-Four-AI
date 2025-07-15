/**
 * FallbackSystem Demo
 * 
 * Demonstrates the 5-tier stability architecture with graceful degradation
 * and comprehensive error handling capabilities.
 */

import { FallbackSystem, FallbackTrigger } from './FallbackSystem';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import {
    AIComponent,
    AIRequest,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    FallbackConfig
} from './interfaces';

/**
 * Demo class showcasing FallbackSystem capabilities
 */
export class FallbackSystemDemo {
    private fallbackSystem: FallbackSystem;
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
            componentValidation: true
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
                interval: 1000,
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

        const fallbackConfig: FallbackConfig = {
            enabled: true,
            fastFallback: true,
            maxFallbackDepth: 5,
            fallbackTimeout: 1000,
            conditions: {
                timeout: true,
                error: true,
                resource_limit: true,
                health_degradation: true
            }
        };

        this.fallbackSystem = new FallbackSystem(
            fallbackConfig,
            this.componentRegistry,
            this.resourceManager,
            this.healthMonitor
        );
    }

    private async setupDemoScenarios(): Promise<void> {
        // Register demo AI components across all tiers
        await this.registerDemoComponents();

        // Initialize monitoring
        await this.initializeMonitoring();
    }

    private async registerDemoComponents(): Promise<void> {
        const components: AIComponent[] = [
            // Tier 1: Critical (<1ms)
            {
                name: 'emergency_ai',
                type: AIComponentType.BASIC,
                tier: ComponentTier.CRITICAL,
                priority: 100,
                timeout: 1,
                memoryLimit: 64,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => ({
                    decision: {
                        move: 3, // Always center column
                        confidence: 0.5,
                        reasoning: 'Emergency fallback - center column',
                        strategy: 'emergency',
                        thinkingTime: 0.1
                    },
                    executionTime: 0.1
                }),
                healthCheck: async () => ({
                    score: 1.0,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Tier 2: Stable (<100ms)
            {
                name: 'minimax_basic',
                type: AIComponentType.MINIMAX,
                tier: ComponentTier.STABLE,
                priority: 90,
                timeout: 100,
                memoryLimit: 256,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    // Simulate minimax with depth 3
                    await this.simulateProcessing(50);
                    return {
                        decision: {
                            move: this.calculateBasicMove(request.board, request.player),
                            confidence: 0.8,
                            reasoning: 'Minimax depth 3 analysis',
                            strategy: 'minimax',
                            thinkingTime: 50,
                            depth: 3
                        },
                        executionTime: 50
                    };
                },
                healthCheck: async () => ({
                    score: 0.95,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Tier 3: Advanced (<1s)
            {
                name: 'mcts_standard',
                type: AIComponentType.MCTS,
                tier: ComponentTier.ADVANCED,
                priority: 80,
                timeout: 1000,
                memoryLimit: 512,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    // Simulate MCTS with 100 simulations
                    await this.simulateProcessing(400);
                    return {
                        decision: {
                            move: this.calculateAdvancedMove(request.board, request.player),
                            confidence: 0.9,
                            reasoning: 'MCTS with 100 simulations',
                            strategy: 'mcts',
                            thinkingTime: 400,
                            nodesExplored: 100
                        },
                        executionTime: 400
                    };
                },
                healthCheck: async () => ({
                    score: 0.85,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Tier 4: Experimental (<10s)
            {
                name: 'neural_network',
                type: AIComponentType.NEURAL,
                tier: ComponentTier.EXPERIMENTAL,
                priority: 70,
                timeout: 10000,
                memoryLimit: 1024,
                dependencies: [],
                status: ComponentStatus.EXPERIMENTAL,
                execute: async (request: AIRequest) => {
                    // Simulate neural network inference
                    await this.simulateProcessing(2000);
                    return {
                        decision: {
                            move: this.calculateNeuralMove(request.board, request.player),
                            confidence: 0.95,
                            reasoning: 'Neural network prediction',
                            strategy: 'neural',
                            thinkingTime: 2000
                        },
                        executionTime: 2000
                    };
                },
                healthCheck: async () => ({
                    score: 0.75,
                    status: ComponentStatus.DEGRADED,
                    lastCheck: Date.now()
                })
            },

            // Tier 5: Research (<30s)
            {
                name: 'alphazero_research',
                type: AIComponentType.HYBRID,
                tier: ComponentTier.RESEARCH,
                priority: 60,
                timeout: 30000,
                memoryLimit: 2048,
                dependencies: [],
                status: ComponentStatus.EXPERIMENTAL,
                execute: async (request: AIRequest) => {
                    // Simulate complex research algorithm
                    await this.simulateProcessing(15000);
                    return {
                        decision: {
                            move: this.calculateResearchMove(request.board, request.player),
                            confidence: 0.98,
                            reasoning: 'AlphaZero-style analysis',
                            strategy: 'alphazero',
                            thinkingTime: 15000,
                            nodesExplored: 10000
                        },
                        executionTime: 15000
                    };
                },
                healthCheck: async () => ({
                    score: 0.6,
                    status: ComponentStatus.UNHEALTHY,
                    lastCheck: Date.now()
                })
            }
        ];

        // Register all components
        for (const component of components) {
            await this.componentRegistry.register(component);
        }
    }

    private async initializeMonitoring(): Promise<void> {
        // Initialize health monitoring
        await this.healthMonitor.initialize();

        // Start monitoring all components
        const components = this.componentRegistry.getAllComponents();
        await this.healthMonitor.startMonitoring(components);

        // Set up fallback event listeners
        this.fallbackSystem.on('fallback_triggered', (event) => {
            console.log(`🚨 Fallback triggered: ${event.component} - ${event.data.trigger}`);
        });

        this.fallbackSystem.on('fallback_success', (event) => {
            console.log(`✅ Fallback successful: ${event.component} took over from ${event.data.original_component}`);
        });

        this.fallbackSystem.on('emergency_fallback', (event) => {
            console.log(`🆘 Emergency fallback: ${event.component} - ${event.data.fallback_error}`);
        });
    }

    // === Demo Scenarios ===

    /**
     * Demo 1: Basic Tier Degradation
     */
    async demoTierDegradation(): Promise<void> {
        console.log('\n=== Demo 1: Tier Degradation ===');

        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 5000,
            difficulty: 7
        };

        // Simulate failure in Tier 4 component
        const neuralComponent = this.componentRegistry.getComponent('neural_network')!;
        const error = new Error('Neural network out of memory');

        console.log('Simulating neural network failure...');
        const result = await this.fallbackSystem.handleFailure(
            neuralComponent,
            request,
            error,
            FallbackTrigger.RESOURCE_LIMIT
        );

        console.log(`Original component: ${result.originalComponent}`);
        console.log(`Fallback component: ${result.fallbackComponent}`);
        console.log(`Quality degradation: ${(result.metadata?.quality_degradation || 0) * 100}%`);
        console.log(`Execution time: ${result.metadata?.fallback_time}ms`);
        console.log(`Reason: ${result.reason}`);
    }

    /**
     * Demo 2: Health-Based Fallback
     */
    async demoHealthBasedFallback(): Promise<void> {
        console.log('\n=== Demo 2: Health-Based Fallback ===');

        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Yellow',
            timeLimit: 3000,
            difficulty: 6
        };

        // Simulate degraded component
        const mctsComponent = this.componentRegistry.getComponent('mcts_standard')!;

        console.log('Handling degraded MCTS component...');
        const result = await this.fallbackSystem.handleUnhealthyComponent(
            mctsComponent,
            request
        );

        console.log(`Component used: ${result.fallbackComponent}`);
        console.log(`Quality degradation: ${(result.metadata?.quality_degradation || 0) * 100}%`);
        console.log(`Reason: ${result.reason}`);
    }

    /**
     * Demo 3: Multiple Fallback Layers
     */
    async demoMultipleFallbackLayers(): Promise<void> {
        console.log('\n=== Demo 3: Multiple Fallback Layers ===');

        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 2000,
            difficulty: 8
        };

        // Simulate failure in research component
        const researchComponent = this.componentRegistry.getComponent('alphazero_research')!;
        const error = new Error('Research algorithm crashed');

        console.log('Simulating research algorithm failure...');
        const result = await this.fallbackSystem.handleFailure(
            researchComponent,
            request,
            error,
            FallbackTrigger.ERROR
        );

        console.log(`Fallback chain: ${result.originalComponent} → ${result.fallbackComponent}`);
        console.log(`Quality degradation: ${(result.metadata?.quality_degradation || 0) * 100}%`);
        console.log(`Fallback depth: ${result.metadata?.fallback_depth}`);
    }

    /**
     * Demo 4: Emergency Fallback
     */
    async demoEmergencyFallback(): Promise<void> {
        console.log('\n=== Demo 4: Emergency Fallback ===');

        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1,
            difficulty: 1
        };

        // Simulate critical system failure
        const emergencyComponent = this.componentRegistry.getComponent('emergency_ai')!;
        const error = new Error('Critical system failure');

        console.log('Simulating critical system failure...');
        const result = await this.fallbackSystem.handleFailure(
            emergencyComponent,
            request,
            error,
            FallbackTrigger.ERROR
        );

        console.log(`Emergency fallback: ${result.fallbackComponent}`);
        console.log(`Move selected: ${result.decision.move}`);
        console.log(`Confidence: ${result.decision.confidence}`);
        console.log(`Reasoning: ${result.decision.reasoning}`);
    }

    /**
     * Demo 5: Performance Metrics
     */
    async demoPerformanceMetrics(): Promise<void> {
        console.log('\n=== Demo 5: Performance Metrics ===');

        // Trigger several fallbacks
        for (let i = 0; i < 5; i++) {
            const request: AIRequest = {
                type: 'move',
                board: this.generateRandomBoard(),
                player: (i % 2) === 0 ? 'Red' : 'Yellow',
                timeLimit: 1000,
                difficulty: 5 + i
            };

            const component = this.componentRegistry.getComponent('mcts_standard')!;
            const error = new Error(`Test failure ${i + 1}`);

            await this.fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );
        }

        // Display metrics
        const metrics = this.fallbackSystem.getMetrics();
        console.log('Fallback System Metrics:');
        console.log(`Total fallbacks: ${metrics.totalFallbacks}`);
        console.log(`Fallbacks by tier:`, metrics.fallbacksByTier);
        console.log(`Fallbacks by trigger:`, metrics.fallbacksByTrigger);
        console.log(`Average fallback time: ${metrics.averageFallbackTime}ms`);
        console.log(`Success rate: ${metrics.successRate * 100}%`);
    }

    /**
     * Demo 6: Configuration Management
     */
    async demoConfigurationManagement(): Promise<void> {
        console.log('\n=== Demo 6: Configuration Management ===');

        // Show current configuration
        const currentConfig = this.fallbackSystem.getConfig();
        console.log('Current configuration:');
        console.log(JSON.stringify(currentConfig, null, 2));

        // Update configuration
        this.fallbackSystem.updateConfig({
            maxFallbackDepth: 3,
            fallbackTimeout: 500
        });

        const updatedConfig = this.fallbackSystem.getConfig();
        console.log('Updated configuration:');
        console.log(`Max fallback depth: ${updatedConfig.maxFallbackDepth}`);
        console.log(`Fallback timeout: ${updatedConfig.fallbackTimeout}ms`);
    }

    /**
     * Demo 7: System Health Check
     */
    async demoSystemHealthCheck(): Promise<void> {
        console.log('\n=== Demo 7: System Health Check ===');

        const health = await this.fallbackSystem.healthCheck();
        console.log('Fallback System Health:');
        console.log(`Health score: ${health.score * 100}%`);
        console.log(`Status: ${health.status}`);
        console.log(`Response time: ${health.metrics?.responseTime}ms`);
        console.log(`Success rate: ${health.metrics?.successRate * 100}%`);
    }

    // === Helper Methods ===

    private async simulateProcessing(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    private calculateBasicMove(board: any[][], player: string): number {
        // Simple heuristic: prefer center columns
        const centerColumns = [3, 2, 4, 1, 5, 0, 6];
        for (const col of centerColumns) {
            if (this.isValidMove(board, col)) {
                return col;
            }
        }
        return 3; // Fallback to center
    }

    private calculateAdvancedMove(board: any[][], player: string): number {
        // More sophisticated logic
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                return col;
            }
        }
        return 3;
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

    private calculateResearchMove(board: any[][], player: string): number {
        // Simulate research algorithm
        return this.calculateNeuralMove(board, player);
    }

    private isValidMove(board: any[][], col: number): boolean {
        return col >= 0 && col < 7 && board[0][col] === 0;
    }

    private generateRandomBoard(): any[][] {
        const board = Array(6).fill(null).map(() => Array(7).fill(0));

        // Add some random pieces
        const numPieces = Math.floor(Math.random() * 10);
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
        console.log('🎯 Starting FallbackSystem Demo Suite');
        console.log('=====================================');

        try {
            await this.demoTierDegradation();
            await this.demoHealthBasedFallback();
            await this.demoMultipleFallbackLayers();
            await this.demoEmergencyFallback();
            await this.demoPerformanceMetrics();
            await this.demoConfigurationManagement();
            await this.demoSystemHealthCheck();

            console.log('\n🏆 All demos completed successfully!');
            console.log('=====================================');
        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        }
    }
}

// Export demo runner
export async function runFallbackSystemDemo(): Promise<void> {
    const demo = new FallbackSystemDemo();
    await demo.runAllDemos();
}

// Run demo if called directly
if (require.main === module) {
    runFallbackSystemDemo().catch(console.error);
} 