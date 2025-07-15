/**
 * AI Stability Architecture - Complete Integration Demo
 * 
 * This demo showcases the complete AI stability architecture in action,
 * demonstrating how all components work together to provide robust,
 * scalable, and intelligent AI management.
 * 
 * Features Demonstrated:
 * - AIStabilityManager as the central orchestrator
 * - Component registration and lifecycle management
 * - Resource allocation and monitoring
 * - Health monitoring with circuit breakers
 * - Fallback systems and graceful degradation
 * - Performance optimization and adaptation
 * - Safety validation and sandboxing
 * - Real-time monitoring and alerts
 * - Comprehensive error handling
 * 
 * @author Connect4 AI Team
 */

import { Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { AIStabilityManager } from './AIStabilityManager';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import {
    AIComponent,
    AIComponentType,
    ComponentTier,
    ComponentStatus,
    AIRequest,
    AIDecision,
    AIOrchestrationResult
} from './interfaces';
import { CellValue } from '../connect4AI';

/**
 * Demo Configuration
 */
export interface DemoConfig {
    // Demo scenarios
    scenarios: {
        basicUsage: boolean;
        stressTest: boolean;
        failureRecovery: boolean;
        resourceLimits: boolean;
        circuitBreakers: boolean;
        performanceOptimization: boolean;
        multiTierFallback: boolean;
        realTimeMonitoring: boolean;
    };

    // Demo parameters
    parameters: {
        duration: number; // Demo duration in ms
        requestRate: number; // Requests per second
        errorRate: number; // Simulated error rate
        resourcePressure: number; // Resource pressure level
        concurrentRequests: number; // Max concurrent requests
    };

    // Output settings
    output: {
        verbose: boolean;
        metricsInterval: number;
        saveResults: boolean;
        generateReport: boolean;
    };
}

/**
 * Mock AI Components for demonstration
 */
class MockBasicAI implements AIComponent {
    name = 'MockBasicAI';
    type = AIComponentType.BASIC;
    tier = ComponentTier.CRITICAL;
    priority = 1;
    timeout = 100;
    memoryLimit = 10;
    dependencies: string[] = [];
    status = ComponentStatus.HEALTHY;

    async healthCheck() {
        return {
            score: 0.95,
            status: ComponentStatus.HEALTHY,
            lastCheck: Date.now(),
            metrics: {
                responseTime: 50,
                errorRate: 0.01,
                successRate: 0.99
            }
        };
    }

    async execute(request: AIRequest) {
        // Simulate basic AI processing
        await new Promise(resolve => setTimeout(resolve, 50));

        const availableMoves = this.getAvailableMoves(request.board);
        const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];

        return {
            decision: {
                move,
                confidence: 0.6,
                reasoning: 'Random move selection',
                strategy: 'random'
            },
            executionTime: 50
        };
    }

    private getAvailableMoves(board: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let col = 0; col < board[0].length; col++) {
            if (board[0][col] === 'Empty') {
                moves.push(col);
            }
        }
        return moves;
    }
}

class MockAdvancedAI implements AIComponent {
    name = 'MockAdvancedAI';
    type = AIComponentType.NEURAL;
    tier = ComponentTier.ADVANCED;
    priority = 1;
    timeout = 5000;
    memoryLimit = 200;
    dependencies = ['MockBasicAI'];
    status = ComponentStatus.HEALTHY;

    private failureCount = 0;

    async healthCheck() {
        const score = Math.max(0.3, 0.9 - this.failureCount * 0.1);
        return {
            score,
            status: score > 0.7 ? ComponentStatus.HEALTHY : ComponentStatus.DEGRADED,
            lastCheck: Date.now(),
            metrics: {
                responseTime: 2000,
                errorRate: this.failureCount * 0.05,
                successRate: 1 - this.failureCount * 0.05
            }
        };
    }

    async execute(request: AIRequest) {
        // Simulate advanced AI processing with potential failures
        if (Math.random() < 0.1) {
            this.failureCount++;
            throw new Error('Neural network processing failed');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        const availableMoves = this.getAvailableMoves(request.board);
        const move = this.selectBestMove(request.board, availableMoves);

        return {
            decision: {
                move,
                confidence: 0.85,
                reasoning: 'Neural network evaluation',
                strategy: 'neural',
                alternativeMoves: availableMoves.slice(0, 3).map(m => ({
                    move: m,
                    score: Math.random(),
                    reasoning: 'Neural network alternative'
                }))
            },
            executionTime: 2000
        };
    }

    private getAvailableMoves(board: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let col = 0; col < board[0].length; col++) {
            if (board[0][col] === 'Empty') {
                moves.push(col);
            }
        }
        return moves;
    }

    private selectBestMove(board: CellValue[][], availableMoves: number[]): number {
        // Simple heuristic: prefer center columns
        const centerCol = Math.floor(board[0].length / 2);
        const moveScores = availableMoves.map(move => ({
            move,
            score: 1 / (Math.abs(move - centerCol) + 1)
        }));

        moveScores.sort((a, b) => b.score - a.score);
        return moveScores[0].move;
    }
}

class MockExperimentalAI implements AIComponent {
    name = 'MockExperimentalAI';
    type = AIComponentType.META;
    tier = ComponentTier.RESEARCH;
    priority = 1;
    timeout = 30000;
    memoryLimit = 1000;
    dependencies = ['MockAdvancedAI'];
    status = ComponentStatus.EXPERIMENTAL;

    private crashProbability = 0.3;

    async healthCheck() {
        const score = Math.random() * 0.8; // Highly variable
        return {
            score,
            status: score > 0.5 ? ComponentStatus.EXPERIMENTAL : ComponentStatus.UNHEALTHY,
            lastCheck: Date.now(),
            metrics: {
                responseTime: 15000,
                errorRate: this.crashProbability,
                successRate: 1 - this.crashProbability
            }
        };
    }

    async execute(request: AIRequest) {
        // Simulate experimental AI with high failure rate
        if (Math.random() < this.crashProbability) {
            throw new Error('Experimental AI crashed during meta-learning');
        }

        await new Promise(resolve => setTimeout(resolve, 15000));

        const availableMoves = this.getAvailableMoves(request.board);
        const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];

        return {
            decision: {
                move,
                confidence: 0.95,
                reasoning: 'Meta-learning optimal strategy',
                strategy: 'meta_learning',
                performanceMetrics: {
                    accuracy: 0.95,
                    efficiency: 0.7,
                    reliability: 0.6
                }
            },
            executionTime: 15000
        };
    }

    private getAvailableMoves(board: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let col = 0; col < board[0].length; col++) {
            if (board[0][col] === 'Empty') {
                moves.push(col);
            }
        }
        return moves;
    }
}

/**
 * Demo Results
 */
export interface DemoResults {
    // Execution summary
    summary: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageResponseTime: number;
        totalDuration: number;
    };

    // Component performance
    componentPerformance: {
        [componentName: string]: {
            usageCount: number;
            successRate: number;
            averageResponseTime: number;
            healthScore: number;
            circuitBreakerTrips: number;
        };
    };

    // System metrics
    systemMetrics: {
        maxConcurrentRequests: number;
        maxResourceUsage: {
            cpu: number;
            memory: number;
            gpu: number;
        };
        fallbacksTriggered: number;
        optimizationsApplied: number;
    };

    // Stability analysis
    stability: {
        overallStabilityScore: number;
        reliabilityScore: number;
        performanceScore: number;
        recoveryScore: number;
        adaptabilityScore: number;
    };

    // Detailed logs
    logs: Array<{
        timestamp: number;
        level: string;
        message: string;
        component?: string;
        metadata?: any;
    }>;
}

/**
 * AI Stability Architecture Demo
 */
export class StabilityArchitectureDemo {
    private readonly logger = new Logger(StabilityArchitectureDemo.name);
    private readonly config: DemoConfig;

    private stabilityManager: AIStabilityManager;
    private demoComponents: AIComponent[] = [];
    private demoResults: DemoResults;
    private demoLogs: DemoResults['logs'] = [];

    private isRunning = false;
    private startTime = 0;
    private requestCount = 0;
    private successCount = 0;
    private failureCount = 0;

    constructor(config: Partial<DemoConfig> = {}) {
        this.config = {
            scenarios: {
                basicUsage: true,
                stressTest: true,
                failureRecovery: true,
                resourceLimits: true,
                circuitBreakers: true,
                performanceOptimization: true,
                multiTierFallback: true,
                realTimeMonitoring: true,
                ...config.scenarios
            },
            parameters: {
                duration: 60000, // 1 minute
                requestRate: 2, // 2 requests per second
                errorRate: 0.1, // 10% error rate
                resourcePressure: 0.5, // 50% resource pressure
                concurrentRequests: 5,
                ...config.parameters
            },
            output: {
                verbose: true,
                metricsInterval: 5000,
                saveResults: true,
                generateReport: true,
                ...config.output
            }
        };

        this.stabilityManager = new AIStabilityManager();
        this.demoResults = this.initializeDemoResults();
    }

    /**
     * Run the complete demo
     */
    async runDemo(): Promise<DemoResults> {
        try {
            this.logger.log('🎭 Starting AI Stability Architecture Demo...');
            this.log('info', 'Demo started');

            // Initialize the stability manager
            await this.initializeStabilityManager();

            // Register demo components
            await this.registerDemoComponents();

            // Run demo scenarios
            await this.runDemoScenarios();

            // Generate final results
            await this.generateFinalResults();

            this.logger.log('🎉 Demo completed successfully!');
            this.log('info', 'Demo completed');

            return this.demoResults;

        } catch (error) {
            this.logger.error('❌ Demo failed:', error);
            this.log('error', 'Demo failed', undefined, { error: error.message });
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Initialize the stability manager
     */
    private async initializeStabilityManager(): Promise<void> {
        this.log('info', 'Initializing AI Stability Manager...');

        await this.stabilityManager.initialize();

        // Setup event listeners
        this.setupEventListeners();

        this.log('info', 'AI Stability Manager initialized');
    }

    /**
     * Register demo components
     */
    private async registerDemoComponents(): Promise<void> {
        this.log('info', 'Registering demo components...');

        // Create mock components
        this.demoComponents = [
            new MockBasicAI(),
            new MockAdvancedAI(),
            new MockExperimentalAI()
        ];

        // Register each component
        for (const component of this.demoComponents) {
            await this.stabilityManager['componentRegistry'].register(component);
            this.log('info', `Registered component: ${component.name}`);
        }

        this.log('info', `Registered ${this.demoComponents.length} demo components`);
    }

    /**
     * Run demo scenarios
     */
    private async runDemoScenarios(): Promise<void> {
        this.startTime = Date.now();
        this.isRunning = true;

        // Start metrics collection
        const metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.output.metricsInterval);

        try {
            // Run scenarios in sequence
            if (this.config.scenarios.basicUsage) {
                await this.runBasicUsageScenario();
            }

            if (this.config.scenarios.stressTest) {
                await this.runStressTestScenario();
            }

            if (this.config.scenarios.failureRecovery) {
                await this.runFailureRecoveryScenario();
            }

            if (this.config.scenarios.resourceLimits) {
                await this.runResourceLimitsScenario();
            }

            if (this.config.scenarios.circuitBreakers) {
                await this.runCircuitBreakerScenario();
            }

            if (this.config.scenarios.performanceOptimization) {
                await this.runPerformanceOptimizationScenario();
            }

            if (this.config.scenarios.multiTierFallback) {
                await this.runMultiTierFallbackScenario();
            }

            if (this.config.scenarios.realTimeMonitoring) {
                await this.runRealTimeMonitoringScenario();
            }

        } finally {
            clearInterval(metricsInterval);
            this.isRunning = false;
        }
    }

    /**
     * Basic usage scenario
     */
    private async runBasicUsageScenario(): Promise<void> {
        this.log('info', '🔧 Running Basic Usage Scenario...');

        const board = this.createEmptyBoard();
        const requests = 20;

        for (let i = 0; i < requests; i++) {
            try {
                const request: AIRequest = {
                    type: 'move',
                    board,
                    player: 'Red',
                    timeLimit: 1000,
                    difficulty: 0.5
                };

                const result = await this.stabilityManager.orchestrateAI(request);

                this.requestCount++;
                this.successCount++;

                this.log('info', `Request ${i + 1}/${requests} completed`, result.metadata.componentUsed, {
                    move: result.decision.move,
                    executionTime: result.metadata.executionTime
                });

            } catch (error) {
                this.failureCount++;
                this.log('error', `Request ${i + 1}/${requests} failed`, undefined, { error: error.message });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.log('info', '✅ Basic Usage Scenario completed');
    }

    /**
     * Stress test scenario
     */
    private async runStressTestScenario(): Promise<void> {
        this.log('info', '🚀 Running Stress Test Scenario...');

        const board = this.createEmptyBoard();
        const concurrentRequests = 10;
        const totalRequests = 50;

        const promises: Promise<void>[] = [];

        for (let i = 0; i < totalRequests; i++) {
            const promise = this.makeStressTestRequest(board, i);
            promises.push(promise);

            // Control concurrency
            if (promises.length >= concurrentRequests) {
                await Promise.allSettled(promises.splice(0, concurrentRequests));
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for remaining requests
        await Promise.allSettled(promises);

        this.log('info', '✅ Stress Test Scenario completed');
    }

    /**
     * Failure recovery scenario
     */
    private async runFailureRecoveryScenario(): Promise<void> {
        this.log('info', '🔄 Running Failure Recovery Scenario...');

        const board = this.createEmptyBoard();

        // Force failures in advanced AI
        const advancedAI = this.demoComponents.find(c => c.name === 'MockAdvancedAI') as MockAdvancedAI;
        if (advancedAI) {
            advancedAI['failureCount'] = 10; // Force failures
        }

        // Make requests that should trigger fallbacks
        for (let i = 0; i < 15; i++) {
            try {
                const request: AIRequest = {
                    type: 'move',
                    board,
                    player: 'Red',
                    timeLimit: 3000,
                    difficulty: 0.8
                };

                const result = await this.stabilityManager.orchestrateAI(request);

                this.requestCount++;
                this.successCount++;

                this.log('info', `Recovery request ${i + 1}/15 completed`, result.metadata.componentUsed, {
                    fallbacksUsed: result.metadata.fallbacksUsed,
                    tier: result.metadata.tier
                });

            } catch (error) {
                this.failureCount++;
                this.log('error', `Recovery request ${i + 1}/15 failed`, undefined, { error: error.message });
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.log('info', '✅ Failure Recovery Scenario completed');
    }

    /**
     * Resource limits scenario
     */
    private async runResourceLimitsScenario(): Promise<void> {
        this.log('info', '💾 Running Resource Limits Scenario...');

        const board = this.createEmptyBoard();

        // Create resource-intensive requests
        const promises: Promise<void>[] = [];

        for (let i = 0; i < 20; i++) {
            const promise = this.makeResourceIntensiveRequest(board, i);
            promises.push(promise);

            // Don't await - let them run concurrently to stress resources
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        await Promise.allSettled(promises);

        this.log('info', '✅ Resource Limits Scenario completed');
    }

    /**
     * Circuit breaker scenario
     */
    private async runCircuitBreakerScenario(): Promise<void> {
        this.log('info', '⚡ Running Circuit Breaker Scenario...');

        const board = this.createEmptyBoard();

        // Force experimental AI to fail repeatedly
        const experimentalAI = this.demoComponents.find(c => c.name === 'MockExperimentalAI') as MockExperimentalAI;
        if (experimentalAI) {
            experimentalAI['crashProbability'] = 0.9; // Force failures
        }

        // Make requests that should trigger circuit breakers
        for (let i = 0; i < 25; i++) {
            try {
                const request: AIRequest = {
                    type: 'move',
                    board,
                    player: 'Red',
                    timeLimit: 30000,
                    difficulty: 1.0 // High difficulty to prefer experimental AI
                };

                const result = await this.stabilityManager.orchestrateAI(request);

                this.requestCount++;
                this.successCount++;

                this.log('info', `Circuit breaker request ${i + 1}/25 completed`, result.metadata.componentUsed, {
                    tier: result.metadata.tier,
                    fallbacksUsed: result.metadata.fallbacksUsed
                });

            } catch (error) {
                this.failureCount++;
                this.log('error', `Circuit breaker request ${i + 1}/25 failed`, undefined, { error: error.message });
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        this.log('info', '✅ Circuit Breaker Scenario completed');
    }

    /**
     * Performance optimization scenario
     */
    private async runPerformanceOptimizationScenario(): Promise<void> {
        this.log('info', '⚡ Running Performance Optimization Scenario...');

        const board = this.createEmptyBoard();

        // Make repeated requests to trigger optimization
        for (let i = 0; i < 30; i++) {
            try {
                const request: AIRequest = {
                    type: 'move',
                    board,
                    player: 'Red',
                    timeLimit: 2000,
                    difficulty: 0.7
                };

                const result = await this.stabilityManager.orchestrateAI(request);

                this.requestCount++;
                this.successCount++;

                this.log('info', `Optimization request ${i + 1}/30 completed`, result.metadata.componentUsed, {
                    executionTime: result.metadata.executionTime,
                    optimized: result.metadata.performance.optimized,
                    cacheHit: result.metadata.performance.cacheHit
                });

            } catch (error) {
                this.failureCount++;
                this.log('error', `Optimization request ${i + 1}/30 failed`, undefined, { error: error.message });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        this.log('info', '✅ Performance Optimization Scenario completed');
    }

    /**
     * Multi-tier fallback scenario
     */
    private async runMultiTierFallbackScenario(): Promise<void> {
        this.log('info', '🎯 Running Multi-Tier Fallback Scenario...');

        const board = this.createEmptyBoard();

        // Create a cascade of failures
        const scenarios = [
            { timeLimit: 50, difficulty: 0.1 },   // Should use Tier 1
            { timeLimit: 1000, difficulty: 0.5 }, // Should use Tier 2
            { timeLimit: 5000, difficulty: 0.8 }, // Should use Tier 3
            { timeLimit: 30000, difficulty: 1.0 } // Should use Tier 4/5
        ];

        for (const scenario of scenarios) {
            for (let i = 0; i < 5; i++) {
                try {
                    const request: AIRequest = {
                        type: 'move',
                        board,
                        player: 'Red',
                        timeLimit: scenario.timeLimit,
                        difficulty: scenario.difficulty
                    };

                    const result = await this.stabilityManager.orchestrateAI(request);

                    this.requestCount++;
                    this.successCount++;

                    this.log('info', `Fallback request completed`, result.metadata.componentUsed, {
                        tier: result.metadata.tier,
                        timeLimit: scenario.timeLimit,
                        difficulty: scenario.difficulty
                    });

                } catch (error) {
                    this.failureCount++;
                    this.log('error', `Fallback request failed`, undefined, { error: error.message });
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        this.log('info', '✅ Multi-Tier Fallback Scenario completed');
    }

    /**
     * Real-time monitoring scenario
     */
    private async runRealTimeMonitoringScenario(): Promise<void> {
        this.log('info', '📊 Running Real-Time Monitoring Scenario...');

        const board = this.createEmptyBoard();

        // Start monitoring display
        const monitoringInterval = setInterval(() => {
            this.displayRealtimeMetrics();
        }, 2000);

        try {
            // Generate varied load
            for (let i = 0; i < 40; i++) {
                const intensity = Math.sin(i / 10) * 0.5 + 0.5; // Sine wave intensity

                const request: AIRequest = {
                    type: 'move',
                    board,
                    player: 'Red',
                    timeLimit: 1000 + intensity * 4000,
                    difficulty: intensity
                };

                try {
                    const result = await this.stabilityManager.orchestrateAI(request);

                    this.requestCount++;
                    this.successCount++;

                    this.log('info', `Monitoring request ${i + 1}/40 completed`, result.metadata.componentUsed, {
                        intensity: intensity.toFixed(2),
                        executionTime: result.metadata.executionTime
                    });

                } catch (error) {
                    this.failureCount++;
                    this.log('error', `Monitoring request ${i + 1}/40 failed`, undefined, { error: error.message });
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } finally {
            clearInterval(monitoringInterval);
        }

        this.log('info', '✅ Real-Time Monitoring Scenario completed');
    }

    /**
     * Make stress test request
     */
    private async makeStressTestRequest(board: CellValue[][], index: number): Promise<void> {
        try {
            const request: AIRequest = {
                type: 'move',
                board,
                player: 'Red',
                timeLimit: 2000,
                difficulty: 0.6
            };

            const result = await this.stabilityManager.orchestrateAI(request);

            this.requestCount++;
            this.successCount++;

            if (this.config.output.verbose) {
                this.log('info', `Stress test request ${index + 1} completed`, result.metadata.componentUsed);
            }

        } catch (error) {
            this.failureCount++;
            if (this.config.output.verbose) {
                this.log('error', `Stress test request ${index + 1} failed`, undefined, { error: error.message });
            }
        }
    }

    /**
     * Make resource-intensive request
     */
    private async makeResourceIntensiveRequest(board: CellValue[][], index: number): Promise<void> {
        try {
            const request: AIRequest = {
                type: 'move',
                board,
                player: 'Red',
                timeLimit: 10000,
                difficulty: 0.9
            };

            const result = await this.stabilityManager.orchestrateAI(request);

            this.requestCount++;
            this.successCount++;

            this.log('info', `Resource-intensive request ${index + 1} completed`, result.metadata.componentUsed, {
                resourceUsage: result.metadata.resourceUsage
            });

        } catch (error) {
            this.failureCount++;
            this.log('error', `Resource-intensive request ${index + 1} failed`, undefined, { error: error.message });
        }
    }

    /**
     * Create empty Connect Four board
     */
    private createEmptyBoard(): CellValue[][] {
        return Array(6).fill(null).map(() => Array(7).fill('Empty'));
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        this.stabilityManager.on('component-unhealthy', (componentName: string, health: any) => {
            this.log('warn', `Component ${componentName} became unhealthy`, componentName, { health });
        });

        this.stabilityManager.on('component-recovered', (componentName: string, health: any) => {
            this.log('info', `Component ${componentName} recovered`, componentName, { health });
        });

        this.stabilityManager.on('resource-limit-reached', (resource: string, usage: number) => {
            this.log('warn', `Resource limit reached: ${resource} at ${usage}%`, undefined, { resource, usage });
        });

        this.stabilityManager.on('safety-violation', (component: string, violation: any) => {
            this.log('error', `Safety violation in ${component}`, component, { violation });
        });

        this.stabilityManager.on('fallback-triggered', (original: string, fallback: string) => {
            this.log('warn', `Fallback triggered: ${original} -> ${fallback}`, original, { fallback });
        });
    }

    /**
     * Collect metrics
     */
    private async collectMetrics(): Promise<void> {
        try {
            const metrics = this.stabilityManager.getMetrics();
            const healthStatus = await this.stabilityManager.getHealthStatus();

            this.log('info', 'Metrics collected', undefined, {
                totalRequests: this.requestCount,
                successRate: this.successCount / this.requestCount,
                healthStatus: healthStatus.status,
                resourceUsage: metrics.resources
            });

        } catch (error) {
            this.log('error', 'Failed to collect metrics', undefined, { error: error.message });
        }
    }

    /**
     * Display real-time metrics
     */
    private displayRealtimeMetrics(): void {
        const metrics = this.stabilityManager.getMetrics();

        this.logger.log('📊 Real-time Metrics:');
        this.logger.log(`  • Total Requests: ${this.requestCount}`);
        this.logger.log(`  • Success Rate: ${((this.successCount / this.requestCount) * 100).toFixed(1)}%`);
        this.logger.log(`  • CPU Usage: ${metrics.resources.cpuUsage.toFixed(1)}%`);
        this.logger.log(`  • Memory Usage: ${metrics.resources.memoryUsage.toFixed(1)}MB`);
        this.logger.log(`  • Active Components: ${metrics.resources.activeComponents}`);
        this.logger.log(`  • Health Score: ${(metrics.health.overallHealth * 100).toFixed(1)}%`);
    }

    /**
     * Generate final results
     */
    private async generateFinalResults(): Promise<void> {
        this.log('info', 'Generating final results...');

        const totalDuration = Date.now() - this.startTime;
        const metrics = this.stabilityManager.getMetrics();
        const healthStatus = await this.stabilityManager.getHealthStatus();

        // Update summary
        this.demoResults.summary = {
            totalRequests: this.requestCount,
            successfulRequests: this.successCount,
            failedRequests: this.failureCount,
            averageResponseTime: metrics.requests.averageResponseTime,
            totalDuration
        };

        // Update stability analysis
        this.demoResults.stability = {
            overallStabilityScore: healthStatus.score,
            reliabilityScore: this.successCount / this.requestCount,
            performanceScore: metrics.performance.optimizationScore,
            recoveryScore: metrics.performance.adaptationRate,
            adaptabilityScore: metrics.performance.adaptationRate
        };

        // Add logs
        this.demoResults.logs = this.demoLogs;

        this.log('info', 'Final results generated');

        // Display summary
        this.displaySummary();
    }

    /**
     * Display summary
     */
    private displaySummary(): void {
        const results = this.demoResults;

        this.logger.log('🎉 Demo Summary:');
        this.logger.log(`  • Total Requests: ${results.summary.totalRequests}`);
        this.logger.log(`  • Success Rate: ${((results.summary.successfulRequests / results.summary.totalRequests) * 100).toFixed(1)}%`);
        this.logger.log(`  • Average Response Time: ${results.summary.averageResponseTime.toFixed(0)}ms`);
        this.logger.log(`  • Total Duration: ${(results.summary.totalDuration / 1000).toFixed(1)}s`);
        this.logger.log(`  • Stability Score: ${(results.stability.overallStabilityScore * 100).toFixed(1)}%`);
        this.logger.log(`  • Reliability Score: ${(results.stability.reliabilityScore * 100).toFixed(1)}%`);
        this.logger.log(`  • Performance Score: ${(results.stability.performanceScore * 100).toFixed(1)}%`);
        this.logger.log(`  • Total Log Entries: ${results.logs.length}`);
    }

    /**
     * Log helper
     */
    private log(level: string, message: string, component?: string, metadata?: any): void {
        this.demoLogs.push({
            timestamp: Date.now(),
            level,
            message,
            component,
            metadata
        });

        if (this.config.output.verbose) {
            this.logger.log(`[${level.toUpperCase()}] ${message}${component ? ` (${component})` : ''}`);
        }
    }

    /**
     * Initialize demo results
     */
    private initializeDemoResults(): DemoResults {
        return {
            summary: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                totalDuration: 0
            },
            componentPerformance: {},
            systemMetrics: {
                maxConcurrentRequests: 0,
                maxResourceUsage: {
                    cpu: 0,
                    memory: 0,
                    gpu: 0
                },
                fallbacksTriggered: 0,
                optimizationsApplied: 0
            },
            stability: {
                overallStabilityScore: 0,
                reliabilityScore: 0,
                performanceScore: 0,
                recoveryScore: 0,
                adaptabilityScore: 0
            },
            logs: []
        };
    }

    /**
     * Cleanup
     */
    private async cleanup(): Promise<void> {
        this.log('info', 'Cleaning up demo...');

        try {
            await this.stabilityManager.shutdown();
            this.log('info', 'Demo cleanup completed');
        } catch (error) {
            this.log('error', 'Demo cleanup failed', undefined, { error: error.message });
        }
    }
}

/**
 * Demo runner function
 */
export async function runStabilityArchitectureDemo(config?: Partial<DemoConfig>): Promise<DemoResults> {
    const demo = new StabilityArchitectureDemo(config);
    return await demo.runDemo();
}

/**
 * Example usage
 */
export async function exampleUsage(): Promise<void> {
    const logger = new Logger('StabilityArchitectureDemo');

    try {
        logger.log('🎭 Starting AI Stability Architecture Demo...');

        const results = await runStabilityArchitectureDemo({
            scenarios: {
                basicUsage: true,
                stressTest: true,
                failureRecovery: true,
                resourceLimits: true,
                circuitBreakers: true,
                performanceOptimization: true,
                multiTierFallback: true,
                realTimeMonitoring: true
            },
            parameters: {
                duration: 120000, // 2 minutes
                requestRate: 3,
                errorRate: 0.15,
                resourcePressure: 0.6,
                concurrentRequests: 8
            },
            output: {
                verbose: true,
                metricsInterval: 10000,
                saveResults: true,
                generateReport: true
            }
        });

        logger.log('🎉 Demo completed successfully!');
        logger.log(`Final stability score: ${(results.stability.overallStabilityScore * 100).toFixed(1)}%`);

    } catch (error) {
        logger.error('❌ Demo failed:', error);
    }
} 