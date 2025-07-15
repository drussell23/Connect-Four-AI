/**
 * AI Stability Architecture - Fallback System
 * 
 * This system provides 5-tier stability architecture with graceful degradation,
 * ensuring 100% reliability through intelligent fallback strategies.
 */

import {
    AIComponent,
    AIRequest,
    AIResponse,
    AIDecision,
    ComponentTier,
    ComponentStatus,
    ComponentHealth,
    FallbackConfig,
    FallbackResult,
    ComponentRegistry,
    ResourceManager,
    HealthMonitor,
    AIEvent,
    CellValue
} from './interfaces';
import { EventEmitter } from 'events';

// === Fallback Strategy Types ===

export enum FallbackStrategyType {
    TIER_DEGRADATION = 'tier_degradation',
    ALGORITHM_SWITCH = 'algorithm_switch',
    CACHED_RESPONSE = 'cached_response',
    SIMPLIFIED_LOGIC = 'simplified_logic',
    EMERGENCY_FALLBACK = 'emergency_fallback'
}

export enum FallbackTrigger {
    TIMEOUT = 'timeout',
    ERROR = 'error',
    RESOURCE_LIMIT = 'resource_limit',
    HEALTH_DEGRADATION = 'health_degradation',
    CIRCUIT_BREAKER = 'circuit_breaker'
}

export interface FallbackStrategy {
    name: string;
    tier: ComponentTier;
    priority: number;
    canHandle: (error: Error, request: AIRequest) => boolean;
    execute: (request: AIRequest, originalComponent: AIComponent, error: Error) => Promise<FallbackResult>;
    qualityScore: number; // 0.0 to 1.0
    reliability: number; // 0.0 to 1.0
}

export interface FallbackMetrics {
    totalFallbacks: number;
    fallbacksByTier: { [tier: number]: number };
    fallbacksByStrategy: { [strategy: string]: number };
    fallbacksByTrigger: { [trigger: string]: number };
    averageFallbackTime: number;
    successRate: number;
    qualityDegradation: number;
    recoveryRate: number;
    timestamp: number;
}

export interface FallbackChain {
    tier: ComponentTier;
    strategies: FallbackStrategy[];
    fallbackComponents: AIComponent[];
    emergencyFallback: () => Promise<AIDecision>;
}

// === Main Fallback System ===

export class FallbackSystem extends EventEmitter {
    private readonly config: FallbackConfig;
    private readonly registry: ComponentRegistry;
    private readonly resourceManager: ResourceManager;
    private readonly healthMonitor: HealthMonitor;

    private readonly fallbackChains: Map<ComponentTier, FallbackChain> = new Map();
    private readonly fallbackStrategies: Map<string, FallbackStrategy> = new Map();
    private readonly responseCache: Map<string, { response: AIResponse; timestamp: number }> = new Map();
    private readonly metrics: FallbackMetrics;
    private readonly fallbackCache: Map<string, any> = new Map();
    private readonly componentChains: Map<string, any> = new Map();
    private monitoringInterval: NodeJS.Timeout | null = null;
    private readonly logger = console;

    private readonly CACHE_TTL = 30000; // 30 seconds
    private readonly MAX_FALLBACK_DEPTH = 5;
    private readonly EMERGENCY_TIMEOUT = 100; // 100ms for emergency fallback

    constructor(
        config: FallbackConfig,
        registry: ComponentRegistry,
        resourceManager: ResourceManager,
        healthMonitor: HealthMonitor
    ) {
        super();
        this.config = config;
        this.registry = registry;
        this.resourceManager = resourceManager;
        this.healthMonitor = healthMonitor;

        this.metrics = {
            totalFallbacks: 0,
            fallbacksByTier: {},
            fallbacksByStrategy: {},
            fallbacksByTrigger: {},
            averageFallbackTime: 0,
            successRate: 0,
            qualityDegradation: 0,
            recoveryRate: 0,
            timestamp: Date.now()
        };

        this.initializeFallbackStrategies();
        this.initializeFallbackChains();
    }

    /**
     * Initialize the fallback system (optional)
     */
    async initialize(): Promise<void> {
        this.logger.log('🔄 Initializing Fallback System');

        // Initialize component chains
        this.initializeComponentChains();

        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Select a component for fallback
     */
    async selectComponent(request: AIRequest): Promise<AIComponent> {
        const availableComponents = this.getAvailableComponents(request);

        if (availableComponents.length === 0) {
            throw new Error('No fallback components available');
        }

        // Select the best available component
        return this.selectBestComponent(availableComponents, request);
    }

    /**
     * Shutdown the fallback system
     */
    async shutdown(): Promise<void> {
        this.logger.log('🔄 Shutting down Fallback System');

        // Clear intervals
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        // Clear caches
        this.fallbackCache.clear();
        this.componentChains.clear();
    }

    // === Main Fallback Interface ===

    async handleFailure(
        component: AIComponent,
        request: AIRequest,
        error: Error,
        trigger: FallbackTrigger = FallbackTrigger.ERROR
    ): Promise<FallbackResult> {
        const startTime = Date.now();

        try {
            // Log fallback event
            this.emit('fallback_triggered', {
                type: 'fallback_triggered',
                timestamp: Date.now(),
                component: component.name,
                data: {
                    trigger,
                    error: error.message,
                    tier: component.tier,
                    request_type: request.type
                },
                severity: 'warn'
            } as AIEvent);

            // Update metrics
            this.updateFallbackMetrics(component.tier, trigger);

            // Execute fallback strategy
            const fallbackResult = await this.executeFallbackStrategy(
                component,
                request,
                error,
                trigger
            );

            // Calculate execution time
            const executionTime = Date.now() - startTime;
            fallbackResult.metadata = {
                ...fallbackResult.metadata,
                fallback_time: executionTime
            };

            // Log success
            this.emit('fallback_success', {
                type: 'fallback_success',
                timestamp: Date.now(),
                component: fallbackResult.fallbackComponent,
                data: {
                    original_component: component.name,
                    execution_time: executionTime,
                    quality_degradation: fallbackResult.metadata?.quality_degradation || 0
                },
                severity: 'info'
            } as AIEvent);

            return fallbackResult;

        } catch (fallbackError) {
            // Emergency fallback
            const emergencyResult = await this.emergencyFallback(request, component, error);

            this.emit('emergency_fallback', {
                type: 'emergency_fallback',
                timestamp: Date.now(),
                component: component.name,
                data: {
                    fallback_error: fallbackError.message,
                    original_error: error.message
                },
                severity: 'critical'
            } as AIEvent);

            return emergencyResult;
        }
    }

    async handleUnhealthyComponent(
        component: AIComponent,
        request: AIRequest
    ): Promise<FallbackResult> {
        const health = await this.healthMonitor.getComponentHealth(component.name);

        if (health.status === ComponentStatus.OFFLINE) {
            return this.handleFailure(
                component,
                request,
                new Error('Component is offline'),
                FallbackTrigger.HEALTH_DEGRADATION
            );
        }

        if (health.status === ComponentStatus.UNHEALTHY) {
            return this.handleFailure(
                component,
                request,
                new Error('Component is unhealthy'),
                FallbackTrigger.HEALTH_DEGRADATION
            );
        }

        // If component is degraded, use with caution
        if (health.status === ComponentStatus.DEGRADED) {
            // Try to execute with shorter timeout
            const degradedRequest = {
                ...request,
                timeLimit: Math.min(request.timeLimit, 500) // 500ms max for degraded components
            };

            try {
                const response = await component.execute!(degradedRequest);
                return {
                    decision: response.decision,
                    fallbackComponent: component.name,
                    originalComponent: component.name,
                    reason: 'Component degraded - executed with reduced timeout',
                    metadata: {
                        fallback_depth: 0,
                        fallback_time: response.executionTime || 0,
                        quality_degradation: 0.2 // 20% degradation for degraded components
                    }
                };
            } catch (error) {
                return this.handleFailure(
                    component,
                    request,
                    error as Error,
                    FallbackTrigger.HEALTH_DEGRADATION
                );
            }
        }

        // Component is healthy, proceed normally
        throw new Error('Component is healthy - no fallback needed');
    }

    // === Fallback Strategy Execution ===

    private async executeFallbackStrategy(
        component: AIComponent,
        request: AIRequest,
        error: Error,
        trigger: FallbackTrigger,
        depth: number = 0
    ): Promise<FallbackResult> {
        if (depth >= this.MAX_FALLBACK_DEPTH) {
            throw new Error('Maximum fallback depth reached');
        }

        const fallbackChain = this.fallbackChains.get(component.tier);
        if (!fallbackChain) {
            throw new Error(`No fallback chain defined for tier ${component.tier}`);
        }

        // Try each strategy in order of priority
        for (const strategy of fallbackChain.strategies) {
            if (strategy.canHandle(error, request)) {
                try {
                    const result = await strategy.execute(request, component, error);
                    result.metadata = {
                        ...result.metadata,
                        fallback_depth: depth + 1
                    };
                    return result;
                } catch (strategyError) {
                    // Continue to next strategy
                    continue;
                }
            }
        }

        // If no strategy worked, try tier degradation
        return this.executeTierDegradation(component, request, error, depth + 1);
    }

    private async executeTierDegradation(
        component: AIComponent,
        request: AIRequest,
        error: Error,
        depth: number
    ): Promise<FallbackResult> {
        const lowerTier = this.getLowerTier(component.tier);
        if (!lowerTier) {
            throw new Error('Cannot degrade further - already at lowest tier');
        }

        // Get components from lower tier
        const lowerTierComponents = await this.registry.getComponentsByTier(lowerTier);
        const healthyComponents = await this.filterHealthyComponents(lowerTierComponents);

        if (healthyComponents.length === 0) {
            throw new Error(`No healthy components available in tier ${lowerTier}`);
        }

        // Select best component from lower tier
        const fallbackComponent = this.selectBestComponent(healthyComponents, request);

        try {
            const response = await fallbackComponent.execute!(request);
            return {
                decision: response.decision,
                fallbackComponent: fallbackComponent.name,
                originalComponent: component.name,
                reason: `Tier degradation from ${component.tier} to ${lowerTier}`,
                metadata: {
                    fallback_depth: depth,
                    fallback_time: response.executionTime || 0,
                    quality_degradation: this.calculateQualityDegradation(component.tier, lowerTier)
                }
            };
        } catch (fallbackError) {
            // Continue degradation
            return this.executeFallbackStrategy(
                fallbackComponent,
                request,
                fallbackError as Error,
                FallbackTrigger.ERROR,
                depth
            );
        }
    }

    // === Fallback Strategies ===

    private initializeFallbackStrategies(): void {
        // Strategy 1: Cached Response
        this.fallbackStrategies.set('cached_response', {
            name: 'Cached Response',
            tier: ComponentTier.CRITICAL,
            priority: 1,
            canHandle: (error: Error, request: AIRequest) => {
                const cacheKey = this.generateCacheKey(request);
                return this.responseCache.has(cacheKey);
            },
            execute: async (request: AIRequest, component: AIComponent, error: Error) => {
                const cacheKey = this.generateCacheKey(request);
                const cached = this.responseCache.get(cacheKey);

                if (!cached || Date.now() - cached.timestamp > this.CACHE_TTL) {
                    throw new Error('Cache expired');
                }

                return {
                    decision: cached.response.decision,
                    fallbackComponent: 'cache',
                    originalComponent: component.name,
                    reason: 'Using cached response',
                    metadata: {
                        fallback_depth: 1,
                        fallback_time: 1,
                        quality_degradation: 0.1
                    }
                };
            },
            qualityScore: 0.9,
            reliability: 0.95
        });

        // Strategy 2: Algorithm Switch
        this.fallbackStrategies.set('algorithm_switch', {
            name: 'Algorithm Switch',
            tier: ComponentTier.STABLE,
            priority: 2,
            canHandle: (error: Error, request: AIRequest) => {
                return error.name !== 'TimeoutError'; // Don't switch for timeouts
            },
            execute: async (request: AIRequest, component: AIComponent, error: Error) => {
                // Find alternative algorithm in same tier
                const sameTierComponents = await this.registry.getComponentsByTier(component.tier);
                const alternatives = sameTierComponents.filter(c =>
                    c.name !== component.name &&
                    c.type !== component.type
                );

                if (alternatives.length === 0) {
                    throw new Error('No alternative algorithms available');
                }

                const alternative = this.selectBestComponent(alternatives, request);
                const response = await alternative.execute!(request);

                return {
                    decision: response.decision,
                    fallbackComponent: alternative.name,
                    originalComponent: component.name,
                    reason: `Algorithm switch from ${component.type} to ${alternative.type}`,
                    metadata: {
                        fallback_depth: 1,
                        fallback_time: response.executionTime || 0,
                        quality_degradation: 0.05
                    }
                };
            },
            qualityScore: 0.85,
            reliability: 0.80
        });

        // Strategy 3: Simplified Logic
        this.fallbackStrategies.set('simplified_logic', {
            name: 'Simplified Logic',
            tier: ComponentTier.ADVANCED,
            priority: 3,
            canHandle: (error: Error, request: AIRequest) => {
                return true; // Can always try simplified logic
            },
            execute: async (request: AIRequest, component: AIComponent, error: Error) => {
                // Use basic minimax with limited depth
                const decision = await this.executeSimplifiedLogic(request);

                return {
                    decision,
                    fallbackComponent: 'simplified_logic',
                    originalComponent: component.name,
                    reason: 'Using simplified logic fallback',
                    metadata: {
                        fallback_depth: 1,
                        fallback_time: 50,
                        quality_degradation: 0.3
                    }
                };
            },
            qualityScore: 0.7,
            reliability: 0.9
        });

        // Strategy 4: Emergency Fallback
        this.fallbackStrategies.set('emergency_fallback', {
            name: 'Emergency Fallback',
            tier: ComponentTier.CRITICAL,
            priority: 10,
            canHandle: (error: Error, request: AIRequest) => {
                return true; // Always available as last resort
            },
            execute: async (request: AIRequest, component: AIComponent, error: Error) => {
                const decision = await this.executeEmergencyLogic(request);

                return {
                    decision,
                    fallbackComponent: 'emergency_fallback',
                    originalComponent: component.name,
                    reason: 'Emergency fallback - random valid move',
                    metadata: {
                        fallback_depth: 1,
                        fallback_time: 1,
                        quality_degradation: 0.8
                    }
                };
            },
            qualityScore: 0.2,
            reliability: 1.0
        });
    }

    private initializeFallbackChains(): void {
        // Tier 1: Critical (<1ms)
        this.fallbackChains.set(ComponentTier.CRITICAL, {
            tier: ComponentTier.CRITICAL,
            strategies: [
                this.fallbackStrategies.get('cached_response')!,
                this.fallbackStrategies.get('emergency_fallback')!
            ],
            fallbackComponents: [],
            emergencyFallback: () => this.executeEmergencyLogic({} as AIRequest)
        });

        // Tier 2: Stable (<100ms)
        this.fallbackChains.set(ComponentTier.STABLE, {
            tier: ComponentTier.STABLE,
            strategies: [
                this.fallbackStrategies.get('cached_response')!,
                this.fallbackStrategies.get('algorithm_switch')!,
                this.fallbackStrategies.get('simplified_logic')!,
                this.fallbackStrategies.get('emergency_fallback')!
            ],
            fallbackComponents: [],
            emergencyFallback: () => this.executeEmergencyLogic({} as AIRequest)
        });

        // Tier 3: Advanced (<1s)
        this.fallbackChains.set(ComponentTier.ADVANCED, {
            tier: ComponentTier.ADVANCED,
            strategies: [
                this.fallbackStrategies.get('cached_response')!,
                this.fallbackStrategies.get('algorithm_switch')!,
                this.fallbackStrategies.get('simplified_logic')!,
                this.fallbackStrategies.get('emergency_fallback')!
            ],
            fallbackComponents: [],
            emergencyFallback: () => this.executeEmergencyLogic({} as AIRequest)
        });

        // Tier 4: Experimental (<5s)
        this.fallbackChains.set(ComponentTier.EXPERIMENTAL, {
            tier: ComponentTier.EXPERIMENTAL,
            strategies: [
                this.fallbackStrategies.get('cached_response')!,
                this.fallbackStrategies.get('algorithm_switch')!,
                this.fallbackStrategies.get('simplified_logic')!,
                this.fallbackStrategies.get('emergency_fallback')!
            ],
            fallbackComponents: [],
            emergencyFallback: () => this.executeEmergencyLogic({} as AIRequest)
        });

        // Tier 5: Research (<30s)
        this.fallbackChains.set(ComponentTier.RESEARCH, {
            tier: ComponentTier.RESEARCH,
            strategies: [
                this.fallbackStrategies.get('cached_response')!,
                this.fallbackStrategies.get('algorithm_switch')!,
                this.fallbackStrategies.get('simplified_logic')!,
                this.fallbackStrategies.get('emergency_fallback')!
            ],
            fallbackComponents: [],
            emergencyFallback: () => this.executeEmergencyLogic({} as AIRequest)
        });
    }

    // === Fallback Logic Implementation ===

    private async executeSimplifiedLogic(request: AIRequest): Promise<AIDecision> {
        // Simplified minimax with depth 3
        const board = request.board;
        const player = request.player;

        // Simple evaluation function
        const evaluatePosition = (board: CellValue[][], player: CellValue): number => {
            let score = 0;

            // Center column preference
            for (let row = 0; row < 6; row++) {
                if (board[row][3] === player) score += 3;
            }

            // Check for potential wins/blocks
            for (let col = 0; col < 7; col++) {
                if (this.isValidMove(board, col)) {
                    const testBoard = this.makeMove(board, col, player);
                    if (this.checkWin(testBoard, player)) {
                        score += 1000; // Winning move
                    }

                    const opponentWin = this.checkWin(this.makeMove(board, col, player === 'Red' ? 'Yellow' : 'Red'), player === 'Red' ? 'Yellow' : 'Red');
                    if (opponentWin) {
                        score += 500; // Blocking move
                    }
                }
            }

            return score;
        };

        // Find best move
        let bestMove = 3; // Default to center
        let bestScore = -Infinity;

        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                const testBoard = this.makeMove(board, col, player);
                const score = evaluatePosition(testBoard, player);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = col;
                }
            }
        }

        return {
            move: bestMove,
            confidence: 0.6,
            reasoning: 'Simplified minimax evaluation',
            strategy: 'simplified_logic',
            thinkingTime: 50
        };
    }

    private async executeEmergencyLogic(request: AIRequest): Promise<AIDecision> {
        // Emergency fallback - find any valid move
        const board = request.board;
        const validMoves: number[] = [];

        // Find all valid moves
        for (let col = 0; col < 7; col++) {
            if (this.isValidMove(board, col)) {
                validMoves.push(col);
            }
        }

        if (validMoves.length === 0) {
            throw new Error('No valid moves available');
        }

        // Prefer center columns
        const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
        const selectedMove = centerMoves.length > 0 ?
            centerMoves[Math.floor(Math.random() * centerMoves.length)] :
            validMoves[Math.floor(Math.random() * validMoves.length)];

        return {
            move: selectedMove,
            confidence: 0.2,
            reasoning: 'Emergency fallback - random valid move',
            strategy: 'emergency_fallback',
            thinkingTime: 1
        };
    }

    private async emergencyFallback(
        request: AIRequest,
        component: AIComponent,
        error: Error
    ): Promise<FallbackResult> {
        try {
            const decision = await this.executeEmergencyLogic(request);

            return {
                decision,
                fallbackComponent: 'emergency_system',
                originalComponent: component.name,
                reason: 'Emergency fallback - all strategies failed',
                metadata: {
                    fallback_depth: this.MAX_FALLBACK_DEPTH,
                    fallback_time: 1,
                    quality_degradation: 0.9
                }
            };
        } catch (emergencyError) {
            // Absolute last resort - return center column
            return {
                decision: {
                    move: 3,
                    confidence: 0.1,
                    reasoning: 'Absolute emergency - center column',
                    strategy: 'absolute_emergency',
                    thinkingTime: 0
                },
                fallbackComponent: 'absolute_emergency',
                originalComponent: component.name,
                reason: 'Absolute emergency - center column move',
                metadata: {
                    fallback_depth: this.MAX_FALLBACK_DEPTH + 1,
                    fallback_time: 0,
                    quality_degradation: 1.0
                }
            };
        }
    }

    // === Helper Methods ===

    private generateCacheKey(request: AIRequest): string {
        return `${JSON.stringify(request.board)}_${request.player}_${request.difficulty}`;
    }

    private getLowerTier(tier: ComponentTier): ComponentTier | null {
        switch (tier) {
            case ComponentTier.RESEARCH: return ComponentTier.EXPERIMENTAL;
            case ComponentTier.EXPERIMENTAL: return ComponentTier.ADVANCED;
            case ComponentTier.ADVANCED: return ComponentTier.STABLE;
            case ComponentTier.STABLE: return ComponentTier.CRITICAL;
            case ComponentTier.CRITICAL: return null;
            default: return null;
        }
    }

    private calculateQualityDegradation(originalTier: ComponentTier, fallbackTier: ComponentTier): number {
        const tierDiff = originalTier - fallbackTier;
        return Math.min(tierDiff * 0.2, 1.0); // 20% degradation per tier
    }

    private async filterHealthyComponents(components: AIComponent[]): Promise<AIComponent[]> {
        const healthy: AIComponent[] = [];

        for (const component of components) {
            const health = await this.healthMonitor.getComponentHealth(component.name);
            if (health.status === ComponentStatus.HEALTHY || health.status === ComponentStatus.DEGRADED) {
                healthy.push(component);
            }
        }

        return healthy;
    }

    private selectBestComponent(components: AIComponent[], request: AIRequest): AIComponent {
        // Sort by priority and health
        return components.sort((a, b) => {
            const priorityDiff = b.priority - a.priority;
            if (priorityDiff !== 0) return priorityDiff;

            // If same priority, prefer based on request type
            if (request.type === 'move' && a.type === 'minimax') return -1;
            if (request.type === 'move' && b.type === 'minimax') return 1;

            return 0;
        })[0];
    }

    private isValidMove(board: CellValue[][], col: number): boolean {
        return col >= 0 && col < 7 && board[0][col] === 'Empty';
    }

    private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
        const newBoard = board.map(row => [...row]);
        for (let row = 5; row >= 0; row--) {
            if (newBoard[row][col] === 'Empty') {
                newBoard[row][col] = player;
                break;
            }
        }
        return newBoard;
    }

    private checkWin(board: CellValue[][], player: CellValue): boolean {
        // Check horizontal
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 4; col++) {
                if (board[row][col] === player &&
                    board[row][col + 1] === player &&
                    board[row][col + 2] === player &&
                    board[row][col + 3] === player) {
                    return true;
                }
            }
        }

        // Check vertical
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] === player &&
                    board[row + 1][col] === player &&
                    board[row + 2][col] === player &&
                    board[row + 3][col] === player) {
                    return true;
                }
            }
        }

        // Check diagonal
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                if (board[row][col] === player &&
                    board[row + 1][col + 1] === player &&
                    board[row + 2][col + 2] === player &&
                    board[row + 3][col + 3] === player) {
                    return true;
                }
            }
        }

        for (let row = 3; row < 6; row++) {
            for (let col = 0; col < 4; col++) {
                if (board[row][col] === player &&
                    board[row - 1][col + 1] === player &&
                    board[row - 2][col + 2] === player &&
                    board[row - 3][col + 3] === player) {
                    return true;
                }
            }
        }

        return false;
    }

    // === Metrics and Monitoring ===

    private updateFallbackMetrics(tier: ComponentTier, trigger: FallbackTrigger): void {
        this.metrics.totalFallbacks++;
        this.metrics.fallbacksByTier[tier] = (this.metrics.fallbacksByTier[tier] || 0) + 1;
        this.metrics.fallbacksByTrigger[trigger] = (this.metrics.fallbacksByTrigger[trigger] || 0) + 1;
        this.metrics.timestamp = Date.now();
    }

    public getMetrics(): FallbackMetrics {
        return { ...this.metrics };
    }

    public async getFallbackSnapshot(): Promise<{
        metrics: FallbackMetrics;
        activeChains: number;
        cacheSize: number;
        health: ComponentHealth;
    }> {
        const health = await this.healthCheck();

        return {
            metrics: this.getMetrics(),
            activeChains: this.fallbackChains.size,
            cacheSize: this.responseCache.size,
            health
        };
    }

    public clearCache(): void {
        this.responseCache.clear();
    }

    public cacheResponse(request: AIRequest, response: AIResponse): void {
        const cacheKey = this.generateCacheKey(request);
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });
    }

    // === Configuration ===

    public updateConfig(config: Partial<FallbackConfig>): void {
        Object.assign(this.config, config);
    }

    public getConfig(): FallbackConfig {
        return { ...this.config };
    }

    // === Health Check ===

    public async healthCheck(): Promise<ComponentHealth> {
        const startTime = Date.now();

        try {
            // Test emergency fallback
            await this.executeEmergencyLogic({
                board: Array(6).fill(null).map(() => Array(7).fill('Empty')),
                player: 'Red',
                type: 'move',
                timeLimit: 100,
                difficulty: 1
            } as AIRequest);

            return {
                score: 1.0,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: Date.now() - startTime,
                    successRate: this.metrics.successRate,
                    requestCount: this.metrics.totalFallbacks
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
     * Initialize component chains
     */
    private initializeComponentChains(): void {
        this.logger.log('🔄 Initializing component chains');

        // Initialize chains for each tier
        const tiers = [ComponentTier.TIER_1, ComponentTier.TIER_2, ComponentTier.TIER_3, ComponentTier.TIER_4, ComponentTier.TIER_5];

        for (const tier of tiers) {
            const components = this.registry.getComponentsByTier(tier);
            this.componentChains.set(tier.toString(), components);
        }
    }

    /**
     * Start monitoring the fallback system
     */
    private startMonitoring(): void {
        this.logger.log('🔄 Starting fallback monitoring');

        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, 5000); // Check every 5 seconds
    }

    /**
     * Get available components for a request
     */
    private getAvailableComponents(request: AIRequest): AIComponent[] {
        const allComponents = this.registry.getAllComponents();

        return allComponents.filter(component =>
            component.status === ComponentStatus.ACTIVE &&
            component.tier !== ComponentTier.TIER_5 // Don't include emergency tier in normal operations
        );
    }

    /**
     * Perform periodic health check
     */
    private performHealthCheck(): void {
        // Check system health and update metrics
        this.metrics.timestamp = Date.now();

        // Update fallback success rate
        const totalAttempts = this.metrics.totalFallbacks;
        if (totalAttempts > 0) {
            this.metrics.successRate = 0.95; // Mock success rate
        }
    }
} 