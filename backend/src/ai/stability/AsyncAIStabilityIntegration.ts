/**
 * Async AI Stability Integration
 * 
 * Integrates the async AI architecture with the stability manager
 * to provide unified AI orchestration with enhanced capabilities
 */

import { Injectable, Logger } from '@nestjs/common';
import { AIStabilityManager } from './AIStabilityManager';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { PerformanceMonitor } from '../async/performance-monitor';
import { CircuitBreaker } from '../async/circuit-breaker';
import { AsyncCacheManager } from '../async/cache-manager';
import { PrecomputationEngine } from '../async/precomputation-engine';
import { DynamicStrategySelector } from '../async/strategy-selector';
import { AIComponent, AIComponentType, ComponentStatus, AIRequest, AIResponse, AIDecision } from './interfaces';
import { CellValue } from '../connect4AI';

/**
 * Async-enabled AI Component wrapper
 */
class AsyncAIComponent implements AIComponent {
    name: string;
    type: AIComponentType;
    tier: number;
    priority: number;
    timeout: number;
    memoryLimit: number;
    dependencies: string[];
    status: ComponentStatus;
    
    constructor(
        private orchestrator: AsyncAIOrchestrator,
        private strategyName: string,
        tier: number = 3
    ) {
        this.name = `AsyncAI_${strategyName}`;
        this.type = AIComponentType.NEURAL; // Most async strategies are neural/advanced
        this.tier = tier;
        this.priority = 1;
        this.timeout = 10000;
        this.memoryLimit = 500;
        this.dependencies = [];
        this.status = ComponentStatus.HEALTHY;
    }

    async execute(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();
        
        try {
            const asyncRequest = {
                gameId: `stability_${Date.now()}`,
                board: request.board,
                player: request.player,
                difficulty: request.difficulty || 10,
                timeLimit: request.timeLimit,
                strategy: this.strategyName as any
            };

            const result = await this.orchestrator.getAIMove(asyncRequest);
            
            const decision: AIDecision = {
                move: result.move,
                confidence: result.confidence,
                reasoning: result.explanation || `${result.strategy} strategy decision`,
                strategy: result.strategy,
                alternativeMoves: result.alternatives?.map(alt => ({
                    move: alt.move,
                    score: alt.score,
                    reasoning: alt.reasoning
                })) || [],
                thinkingTime: result.computeTime || 0,
                nodesExplored: 0
            };

            return {
                decision,
                executionTime: Date.now() - startTime,
                safetyScore: 1.0,
                validated: true,
                sandboxed: false,
                fallbacksUsed: 0,
                optimized: result.cached,
                warnings: [],
                errors: []
            };
        } catch (error) {
            throw new Error(`Async AI component ${this.name} failed: ${error.message}`);
        }
    }

    async healthCheck() {
        const health = await this.orchestrator.getSystemHealth();
        const score = health.performance.healthy ? 1.0 : 0.5;
        
        return {
            score,
            status: score > 0.8 ? ComponentStatus.HEALTHY : ComponentStatus.DEGRADED,
            lastCheck: Date.now(),
            metrics: {
                responseTime: health.performance.operations?.avgDuration || 1000,
                errorRate: 1 - (health.performance.operations?.successful || 0) / Math.max(1, health.performance.operations?.total || 1),
                successRate: (health.performance.operations?.successful || 0) / Math.max(1, health.performance.operations?.total || 1),
                memoryUsage: health.performance.systemHealth?.memory?.percentUsed || 50,
                cpuUsage: health.performance.systemHealth?.cpu?.usage || 50,
                requestCount: health.performance.operations?.total || 0
            }
        };
    }
}

@Injectable()
export class AsyncAIStabilityIntegration {
    private readonly logger = new Logger(AsyncAIStabilityIntegration.name);
    private stabilityManager: AIStabilityManager;
    private asyncComponents: Map<string, AsyncAIComponent> = new Map();

    constructor(
        private readonly asyncOrchestrator: AsyncAIOrchestrator,
        private readonly performanceMonitor: PerformanceMonitor,
        private readonly circuitBreaker: CircuitBreaker,
        private readonly cacheManager: AsyncCacheManager,
        private readonly precomputationEngine: PrecomputationEngine,
        private readonly strategySelector: DynamicStrategySelector
    ) {}

    /**
     * Initialize the integration between stability manager and async AI
     */
    async initialize(): Promise<AIStabilityManager> {
        this.logger.log('🔗 Initializing Async AI Stability Integration...');

        // Create stability manager with async-optimized config
        this.stabilityManager = new AIStabilityManager({
            maxConcurrentRequests: 20,
            defaultTimeout: 10000,
            maxRetries: 2,
            
            resources: {
                maxCpuUsage: 85,
                maxMemoryUsage: 2048,
                maxGpuUsage: 95,
                maxConcurrentAI: 10
            },
            
            health: {
                checkInterval: 3000,
                unhealthyThreshold: 0.4,
                recoveryThreshold: 0.8,
                circuitBreakerThreshold: 0.2
            },
            
            performance: {
                adaptiveOptimization: true,
                loadBalancing: true,
                resourceOptimization: true,
                cacheEnabled: true,
                cacheSize: 5000
            },
            
            safety: {
                sandboxMode: false, // Async components handle their own safety
                validationEnabled: true,
                maxExecutionTime: 15000,
                memoryLimit: 1024,
                errorContainment: true
            },
            
            fallback: {
                enabled: true,
                fastFallback: true,
                maxFallbackDepth: 5,
                fallbackTimeout: 3000
            }
        });

        // Initialize stability manager
        await this.stabilityManager.initialize();

        // Register async AI components
        await this.registerAsyncComponents();

        // Set up event listeners
        this.setupEventListeners();

        // Set up performance monitoring integration
        this.setupPerformanceMonitoring();

        this.logger.log('✅ Async AI Stability Integration initialized');
        
        return this.stabilityManager;
    }

    /**
     * Register async AI components with the stability manager
     */
    private async registerAsyncComponents(): Promise<void> {
        this.logger.log('📦 Registering async AI components...');

        // Get all available strategies
        const strategies = [
            { name: 'MINIMAX', tier: 2 },
            { name: 'ALPHA_BETA', tier: 2 },
            { name: 'MCTS', tier: 3 },
            { name: 'MCTS_RAVE', tier: 3 },
            { name: 'EXPECTIMAX', tier: 3 },
            { name: 'DQN', tier: 4 },
            { name: 'PPO', tier: 4 },
            { name: 'A3C', tier: 4 },
            { name: 'ALPHAZERO', tier: 4 },
            { name: 'MUZERO', tier: 5 },
            { name: 'TRANSFORMER', tier: 5 },
            { name: 'META_LEARNING', tier: 5 },
            { name: 'NEUROSYMBOLIC', tier: 5 }
        ];

        for (const { name, tier } of strategies) {
            const component = new AsyncAIComponent(this.asyncOrchestrator, name, tier);
            this.asyncComponents.set(name, component);
            
            // Register with stability manager's component registry
            await this.registerComponentWithStability(component);
        }

        this.logger.log(`✅ Registered ${this.asyncComponents.size} async AI components`);
    }

    /**
     * Register a component with the stability manager
     */
    private async registerComponentWithStability(component: AsyncAIComponent): Promise<void> {
        // Access the component registry through the stability manager
        const componentRegistry = (this.stabilityManager as any).componentRegistry;
        
        if (componentRegistry && componentRegistry.register) {
            await componentRegistry.register(component);
        }
    }

    /**
     * Set up event listeners for cross-system communication
     */
    private setupEventListeners(): void {
        // Listen to stability manager events
        this.stabilityManager.on('component-unhealthy', async (component) => {
            this.logger.warn(`Async component ${component.name} unhealthy, checking circuit breaker...`);
            
            // Check if circuit breaker is open
            const circuitStats = await this.circuitBreaker.getStats();
            if (circuitStats instanceof Map) {
                for (const [name, stats] of circuitStats) {
                    if (stats.state === 'OPEN' && name.includes(component.name)) {
                        this.logger.error(`Circuit breaker open for ${name}`);
                    }
                }
            }
        });

        this.stabilityManager.on('fallback-triggered', async (info) => {
            this.logger.warn(`Fallback triggered: ${info.reason}`);
            
            // Record in performance monitor
            this.performanceMonitor.recordMetric({
                name: 'stability.fallback.triggered',
                value: 1,
                unit: 'count',
                timestamp: Date.now(),
                tags: {
                    reason: info.reason,
                    component: info.from
                }
            });
        });

        // Note: AsyncAIOrchestrator and CircuitBreaker use EventEmitter2 internally
        // but don't expose event listening methods directly
        // Event handling would be done through the EventEmitter2 service
    }

    /**
     * Set up performance monitoring integration
     */
    private setupPerformanceMonitoring(): void {
        // Monitor stability manager metrics
        setInterval(async () => {
            const stabilityMetrics = await this.stabilityManager.getSystemMetrics();
            
            // Record in performance monitor
            this.performanceMonitor.recordMetric({
                name: 'stability.requests.total',
                value: stabilityMetrics.requests.total,
                unit: 'count',
                timestamp: Date.now()
            });

            this.performanceMonitor.recordMetric({
                name: 'stability.requests.success_rate',
                value: stabilityMetrics.requests.successful / Math.max(1, stabilityMetrics.requests.total),
                unit: 'ratio',
                timestamp: Date.now()
            });

            this.performanceMonitor.recordMetric({
                name: 'stability.health.overall',
                value: stabilityMetrics.health.overallHealth,
                unit: 'score',
                timestamp: Date.now()
            });

            // Check for performance issues
            if (stabilityMetrics.requests.averageResponseTime > 5000) {
                this.logger.warn(`High average response time: ${stabilityMetrics.requests.averageResponseTime}ms`);
            }

            if (stabilityMetrics.health.overallHealth < 0.7) {
                this.logger.error(`Low overall health: ${stabilityMetrics.health.overallHealth}`);
            }
        }, 10000); // Every 10 seconds
    }

    /**
     * Get AI move using the integrated system
     */
    async getAIMove(
        board: CellValue[][],
        player: CellValue,
        options: {
            timeLimit?: number;
            difficulty?: number;
            strategy?: string;
            gameId?: string;
        } = {}
    ): Promise<AIResponse> {
        const spanId = this.performanceMonitor.startSpan(
            'stability.integration',
            'getAIMove'
        );

        try {
            // Use stability manager for orchestration
            const response = await this.stabilityManager.getBestMove(
                board,
                player,
                {
                    timeLimit: options.timeLimit,
                    difficulty: options.difficulty,
                    strategy: options.strategy,
                    context: { gameId: options.gameId }
                }
            );

            this.performanceMonitor.endSpan('stability.integration', spanId, {
                strategy: response.decision.strategy,
                cached: response.optimized
            });

            return response;

        } catch (error) {
            this.performanceMonitor.endSpan('stability.integration', spanId, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get system health combining both stability and async metrics
     */
    async getCombinedHealth(): Promise<{
        stability: any;
        async: any;
        overall: {
            status: string;
            score: number;
            recommendations: string[];
        };
    }> {
        const [stabilityHealth, asyncHealth] = await Promise.all([
            this.stabilityManager.getHealthStatus(),
            this.asyncOrchestrator.getSystemHealth()
        ]);

        const overallScore = (stabilityHealth.score + (asyncHealth.performance.healthy ? 1.0 : 0.5)) / 2;
        
        const recommendations: string[] = [];
        
        if (overallScore < 0.7) {
            recommendations.push('System health is degraded, consider scaling resources');
        }
        
        if (asyncHealth.recommendations.length > 0) {
            recommendations.push(...asyncHealth.recommendations);
        }

        return {
            stability: stabilityHealth,
            async: asyncHealth,
            overall: {
                status: overallScore > 0.8 ? 'healthy' : overallScore > 0.5 ? 'degraded' : 'unhealthy',
                score: overallScore,
                recommendations
            }
        };
    }

    /**
     * Shutdown the integrated system
     */
    async shutdown(): Promise<void> {
        this.logger.log('Shutting down Async AI Stability Integration...');
        
        // Clear intervals
        // ... clear any intervals set up
        
        // Shutdown stability manager
        await this.stabilityManager.shutdown();
        
        this.logger.log('✅ Async AI Stability Integration shutdown complete');
    }
}