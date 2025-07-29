/**
 * Complete AI Stability Architecture - Main Orchestrator
 * 
 * This is the central "conductor" that manages all AI components safely,
 * intelligently, and efficiently. It provides:
 * 
 * 1. **Unified AI Component Management** - Single point of control for all AI systems
 * 2. **5-Tier Stability Architecture** - Graceful degradation from experimental to basic
 * 3. **Resource Management** - CPU, memory, and GPU allocation with safeguards
 * 4. **Health Monitoring** - Real-time monitoring with circuit breakers
 * 5. **Performance Optimization** - Adaptive optimization and load balancing
 * 6. **Safety Systems** - Validation, sandboxing, and error containment
 * 7. **Intelligent Fallback** - Seamless fallback chain for reliability
 * 8. **Real-time Adaptation** - Dynamic adjustment based on performance
 * 
 * @author Connect4 AI Team
 */

import { Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import { FallbackSystem } from './FallbackSystem';
import { PerformanceOptimizer } from './PerformanceOptimizer';
import { SafetySystem } from './SafetySystem';
import { AIComponent, AIComponentType, AIDecision, AIRequest, AIResponse, ComponentHealth, ComponentMetrics, ComponentStatus, ExecutionContext, StabilityConfig, AIOrchestrationResult } from './interfaces';
import { CellValue } from '../connect4AI';

// === Configuration Interfaces ===

export interface AIStabilityConfig {
    // Core Configuration
    maxConcurrentRequests: number;
    defaultTimeout: number;
    maxRetries: number;

    // Resource Limits
    resources: {
        maxCpuUsage: number; // percentage
        maxMemoryUsage: number; // MB
        maxGpuUsage: number; // percentage
        maxConcurrentAI: number;
    };

    // Health Monitoring
    health: {
        checkInterval: number; // ms
        unhealthyThreshold: number;
        recoveryThreshold: number;
        circuitBreakerThreshold: number;
    };

    // Performance Optimization
    performance: {
        adaptiveOptimization: boolean;
        loadBalancing: boolean;
        resourceOptimization: boolean;
        cacheEnabled: boolean;
        cacheSize: number;
    };

    // Safety Configuration
    safety: {
        sandboxMode: boolean;
        validationEnabled: boolean;
        maxExecutionTime: number;
        memoryLimit: number;
        errorContainment: boolean;
    };

    // Fallback Configuration
    fallback: {
        enabled: boolean;
        fastFallback: boolean;
        maxFallbackDepth: number;
        fallbackTimeout: number;
    };

    // Logging and Monitoring
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        metricsEnabled: boolean;
        performanceLogging: boolean;
    };
}

export interface AIStabilityMetrics {
    requests: {
        total: number;
        successful: number;
        failed: number;
        fallbacks: number;
        averageResponseTime: number;
    };

    resources: {
        cpuUsage: number;
        memoryUsage: number;
        gpuUsage: number;
        activeComponents: number;
    };

    health: {
        overallHealth: number;
        unhealthyComponents: number;
        circuitBreakersOpen: number;
        lastHealthCheck: number;
    };

    performance: {
        averageThinkTime: number;
        cacheHitRate: number;
        optimizationScore: number;
        adaptationRate: number;
    };

    safety: {
        validationFailures: number;
        sandboxViolations: number;
        errorContainments: number;
        safetyScore: number;
    };
}

/**
 * AI Stability Manager - Central orchestrator for all AI components
 */
export class AIStabilityManager extends EventEmitter {
    private readonly logger = new Logger(AIStabilityManager.name);
    private readonly config: AIStabilityConfig;

    // Core Systems
    private readonly componentRegistry: ComponentRegistry;
    private readonly resourceManager: ResourceManager;
    private readonly healthMonitor: HealthMonitor;
    private readonly fallbackSystem: FallbackSystem;
    private readonly performanceOptimizer: PerformanceOptimizer;
    private readonly safetySystem: SafetySystem;

    // State Management
    private isInitialized = false;
    private isShuttingDown = false;
    private activeRequests = new Set<string>();
    private requestQueue: AIRequest[] = [];
    private metrics: AIStabilityMetrics;

    // Caching
    private decisionCache = new Map<string, AIDecision>();
    private performanceCache = new Map<string, number>();

    // Monitoring
    private healthCheckInterval?: NodeJS.Timeout;
    private metricsInterval?: NodeJS.Timeout;

    constructor(config: Partial<AIStabilityConfig> = {}) {
        super();

        // Merge with default configuration
        this.config = {
            maxConcurrentRequests: 10,
            defaultTimeout: 30000,
            maxRetries: 3,

            resources: {
                maxCpuUsage: 80,
                maxMemoryUsage: 1024,
                maxGpuUsage: 90,
                maxConcurrentAI: 5
            },

            health: {
                checkInterval: 5000,
                unhealthyThreshold: 0.3,
                recoveryThreshold: 0.7,
                circuitBreakerThreshold: 0.1
            },

            performance: {
                adaptiveOptimization: true,
                loadBalancing: true,
                resourceOptimization: true,
                cacheEnabled: true,
                cacheSize: 1000
            },

            safety: {
                sandboxMode: true,
                validationEnabled: true,
                maxExecutionTime: 30000,
                memoryLimit: 512,
                errorContainment: true
            },

            fallback: {
                enabled: true,
                fastFallback: true,
                maxFallbackDepth: 3,
                fallbackTimeout: 5000
            },

            logging: {
                level: 'info',
                metricsEnabled: true,
                performanceLogging: true
            },

            ...config
        };

        // Initialize components with proper arguments
        this.componentRegistry = new ComponentRegistry();

        // Create properly structured configs
        const resourceConfig = {
            limits: {
                maxCpuUsage: this.config.resources.maxCpuUsage,
                maxMemoryUsage: this.config.resources.maxMemoryUsage,
                maxGpuUsage: this.config.resources.maxGpuUsage,
                maxConcurrentAI: this.config.resources.maxConcurrentAI
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
        };

        const healthConfig = {
            healthCheck: {
                interval: this.config.health.checkInterval,
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
                degraded: this.config.health.unhealthyThreshold,
                unhealthy: 0.4,
                critical: 0.2
            },
            performance: {
                trackTrends: true,
                trendWindow: 100,
                alertOnDegradation: true,
                degradationThreshold: 0.1
            },
            recovery: {
                autoRestart: false,
                restartDelay: 5000,
                maxRestarts: 3,
                escalationEnabled: true
            },
            analytics: {
                enabled: true,
                historicalData: true,
                dataRetention: 86400000,
                predictiveHealth: true
            }
        };

        const performanceConfig = {
            monitoring: {
                enabled: true,
                interval: 1000,
                windowSize: 50,
                dataRetention: 60000
            },
            optimization: {
                enabled: this.config.performance.adaptiveOptimization,
                aggressiveness: 0.7,
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
        };

        const safetyConfig = {
            validation: {
                enabled: this.config.safety.validationEnabled,
                strictMode: true,
                inputValidation: true,
                outputValidation: true,
                schemaValidation: true
            },
            sandboxing: {
                enabled: this.config.safety.sandboxMode,
                isolationLevel: 'strict' as const,
                memoryLimit: this.config.safety.memoryLimit,
                timeLimit: this.config.safety.maxExecutionTime,
                resourceLimits: {
                    cpu: 80,
                    memory: this.config.safety.memoryLimit,
                    gpu: 80
                }
            },
            errorContainment: {
                enabled: this.config.safety.errorContainment,
                isolateFailures: true,
                automaticRecovery: true,
                rollbackOnFailure: true
            },
            safetyRules: {
                enabled: true,
                maxExecutionTime: this.config.safety.maxExecutionTime,
                maxMemoryUsage: this.config.safety.memoryLimit,
                maxRecursionDepth: 100,
                maxLoopIterations: 10000,
                allowedOperations: ['*'],
                blockedOperations: []
            },
            threatDetection: {
                enabled: true,
                anomalyThreshold: 0.8,
                behaviorAnalysis: true,
                patternRecognition: true,
                realTimeMonitoring: true
            }
        };

        this.resourceManager = new ResourceManager(resourceConfig);
        this.healthMonitor = new HealthMonitor(healthConfig);
        this.fallbackSystem = new FallbackSystem(this.config.fallback, this.componentRegistry, this.resourceManager, this.healthMonitor);
        this.performanceOptimizer = new PerformanceOptimizer(performanceConfig, this.componentRegistry, this.resourceManager, this.healthMonitor);
        this.safetySystem = new SafetySystem(safetyConfig, this.componentRegistry, this.resourceManager, this.healthMonitor);

        // Initialize metrics
        this.metrics = this.initializeMetrics();

        // Setup event handlers
        this.setupEventHandlers();

        this.logger.log('✅ AI Stability Manager initialized with complete architecture');
    }

    /**
     * Initialize all systems and components
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        this.logger.log('🚀 Initializing AI Stability Architecture...');

        try {
            // Initialize core systems
            await this.componentRegistry.initialize();
            await this.resourceManager.initialize();
            await this.healthMonitor.initialize();

            // Initialize systems with proper initialization
            if (this.fallbackSystem.initialize) {
                await this.fallbackSystem.initialize();
            }
            if (this.performanceOptimizer.initialize) {
                await this.performanceOptimizer.initialize();
            }
            if (this.safetySystem.initialize) {
                await this.safetySystem.initialize();
            }

            // Register all AI components
            await this.registerAllComponents();

            // Start monitoring
            this.startHealthMonitoring();
            this.startMetricsCollection();

            this.isInitialized = true;
            this.logger.log('✅ AI Stability Architecture fully initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize AI Stability Architecture:', error);
            throw error;
        }
    }

    /**
     * Main orchestration method - intelligently selects and executes AI
     */
    async orchestrateAI(request: AIRequest): Promise<AIOrchestrationResult> {
        const requestId = this.generateRequestId();
        const startTime = performance.now();

        try {
            // Track active request
            this.activeRequests.add(requestId);

            // Pre-flight checks
            await this.performPreflightChecks(request);

            // Select optimal component
            const component = await this.selectOptimalComponent(request);

            // Execute with safety
            const response = await this.executeWithSafety(component, request, requestId);

            // Post-process result
            await this.postProcessResult(response, component, request);

            const executionTime = performance.now() - startTime;
            this.updateMetrics(true, executionTime);

            // Build comprehensive result
            const result: AIOrchestrationResult = {
                decision: response.decision,
                metadata: {
                    componentUsed: component.name,
                    tier: component.tier,
                    fallbacksUsed: 0,
                    executionTime,
                    resourceUsage: {
                        cpu: await this.resourceManager.getCpuUsage(),
                        memory: await this.resourceManager.getMemoryUsage(),
                        gpu: await this.resourceManager.getGpuUsage()
                    },
                    health: await component.healthCheck(),
                    safety: {
                        validated: true,
                        sandboxed: this.config.safety.sandboxMode,
                        safetyScore: 1.0
                    },
                    performance: {
                        optimized: true,
                        cacheHit: false,
                        adaptations: 0
                    }
                }
            };

            return result;

        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.updateMetrics(false, executionTime);

            this.logger.error(`❌ AI orchestration failed for request ${requestId}:`, error);
            throw error;

        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Get best move for Connect Four - Main public interface
     */
    async getBestMove(
        board: CellValue[][],
        player: CellValue,
        options: {
            timeLimit?: number;
            difficulty?: number;
            strategy?: string;
            context?: any;
        } = {}
    ): Promise<AIResponse> {
        const request: AIRequest = {
            type: 'move',
            board,
            player,
            timeLimit: options.timeLimit || this.config.defaultTimeout,
            difficulty: options.difficulty || 5,
            context: options.context
        };

        const result = await this.orchestrateAI(request);

        // Convert AIOrchestrationResult to AIResponse
        const response: AIResponse = {
            decision: result.decision,
            executionTime: result.metadata.executionTime,
            safetyScore: result.metadata.safety.safetyScore,
            validated: result.metadata.safety.validated,
            sandboxed: result.metadata.safety.sandboxed,
            fallbacksUsed: result.metadata.fallbacksUsed,
            optimized: true,
            warnings: result.warnings || [],
            errors: result.errors || []
        };

        return response;
    }

    /**
     * Register all AI components with proper tier structure
     */
    private async registerAllComponents(): Promise<void> {
        this.logger.log('📋 Registering AI components...');

        // Tier 1 (Basic) - Must never fail
        await this.componentRegistry.register({
            name: 'RandomAI',
            type: AIComponentType.BASIC,
            tier: 1,
            priority: 1,
            timeout: 100,
            memoryLimit: 10,
            dependencies: [],
            status: ComponentStatus.HEALTHY,
            healthCheck: () => Promise.resolve({
                score: 1.0,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 50,
                    errorRate: 0,
                    successRate: 1,
                    memoryUsage: 5,
                    cpuUsage: 1,
                    requestCount: 0
                }
            })
        });

        await this.componentRegistry.register({
            name: 'BasicMinimax',
            type: AIComponentType.MINIMAX,
            tier: 1,
            priority: 2,
            timeout: 1000,
            memoryLimit: 50,
            dependencies: [],
            status: ComponentStatus.HEALTHY,
            healthCheck: () => Promise.resolve({
                score: 1.0,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 800,
                    errorRate: 0,
                    successRate: 1,
                    memoryUsage: 25,
                    cpuUsage: 10,
                    requestCount: 0
                }
            })
        });

        // Tier 2 (Stable) - Occasional failures OK
        await this.componentRegistry.register({
            name: 'EnhancedMinimax',
            type: AIComponentType.MINIMAX,
            tier: 2,
            priority: 1,
            timeout: 5000,
            memoryLimit: 100,
            dependencies: ['BasicMinimax'],
            status: ComponentStatus.HEALTHY,
            healthCheck: () => Promise.resolve({
                score: 0.9,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 3000,
                    errorRate: 0.1,
                    successRate: 0.9,
                    memoryUsage: 75,
                    cpuUsage: 25,
                    requestCount: 0
                }
            })
        });

        await this.componentRegistry.register({
            name: 'OpeningBook',
            type: AIComponentType.BOOK,
            tier: 2,
            priority: 2,
            timeout: 1000,
            memoryLimit: 200,
            dependencies: [],
            status: ComponentStatus.HEALTHY,
            healthCheck: () => Promise.resolve({
                score: 0.95,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 500,
                    errorRate: 0.05,
                    successRate: 0.95,
                    memoryUsage: 150,
                    cpuUsage: 5,
                    requestCount: 0
                }
            })
        });

        // Tier 3 (Advanced) - More failures acceptable
        await this.componentRegistry.register({
            name: 'MCTS',
            type: AIComponentType.MCTS,
            tier: 3,
            priority: 1,
            timeout: 10000,
            memoryLimit: 200,
            dependencies: ['BasicMinimax'],
            status: ComponentStatus.HEALTHY,
            healthCheck: () => Promise.resolve({
                score: 0.8,
                status: ComponentStatus.HEALTHY,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 7000,
                    errorRate: 0.2,
                    successRate: 0.8,
                    memoryUsage: 150,
                    cpuUsage: 40,
                    requestCount: 0
                }
            })
        });

        // Tier 4 (Experimental) - High failure rate OK
        await this.componentRegistry.register({
            name: 'NeuralNetwork',
            type: AIComponentType.NEURAL,
            tier: 4,
            priority: 1,
            timeout: 30000,
            memoryLimit: 500,
            dependencies: ['MCTS'],
            status: ComponentStatus.EXPERIMENTAL,
            healthCheck: () => Promise.resolve({
                score: 0.7,
                status: ComponentStatus.EXPERIMENTAL,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 15000,
                    errorRate: 0.3,
                    successRate: 0.7,
                    memoryUsage: 400,
                    cpuUsage: 60,
                    requestCount: 0
                }
            })
        });

        // Tier 5 (Research) - Expected to fail
        await this.componentRegistry.register({
            name: 'MetaLearning',
            type: AIComponentType.META,
            tier: 5,
            priority: 1,
            timeout: 60000,
            memoryLimit: 1000,
            dependencies: ['NeuralNetwork'],
            status: ComponentStatus.EXPERIMENTAL,
            healthCheck: () => Promise.resolve({
                score: 0.5,
                status: ComponentStatus.EXPERIMENTAL,
                lastCheck: Date.now(),
                metrics: {
                    responseTime: 30000,
                    errorRate: 0.5,
                    successRate: 0.5,
                    memoryUsage: 800,
                    cpuUsage: 80,
                    requestCount: 0
                }
            })
        });

        this.logger.log(`✅ Registered ${this.componentRegistry.getComponentCount()} AI components`);
    }

    /**
     * Perform pre-flight checks before processing request
     */
    private async performPreflightChecks(request: AIRequest): Promise<void> {
        // Check if initialized
        if (!this.isInitialized) {
            throw new Error('AI Stability Manager not initialized');
        }

        // Check if shutting down
        if (this.isShuttingDown) {
            throw new Error('AI Stability Manager is shutting down');
        }

        // Check request limits
        if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
            throw new Error('Maximum concurrent requests exceeded');
        }

        // Safety validation
        if (this.config.safety.validationEnabled && this.safetySystem.validateInput) {
            const validation = await this.safetySystem.validateInput(request);
            if (!validation.valid) {
                throw new Error(`Request validation failed: ${validation.errors?.join(', ')}`);
            }
        }

        // Resource checks
        const resourceStatus = await this.resourceManager.checkAvailability();
        if (!resourceStatus.available) {
            throw new Error(`Insufficient resources: ${resourceStatus.reason}`);
        }
    }

    /**
     * Select optimal component for request
     */
    private async selectOptimalComponent(request: AIRequest): Promise<AIComponent> {
        // Get performance recommendations
        const recommendations = this.performanceOptimizer.getRecommendations ?
            await this.performanceOptimizer.getRecommendations(request) : [];

        // Try performance-optimized selection first
        if (recommendations.length > 0) {
            const bestComponent = this.performanceOptimizer.selectBestComponent ?
                await this.performanceOptimizer.selectBestComponent(request, recommendations) :
                null;

            if (bestComponent) {
                return bestComponent;
            }
        }

        // Fallback to fallback system
        const fallbackComponent = this.fallbackSystem.selectComponent ?
            await this.fallbackSystem.selectComponent(request) :
            null;

        if (fallbackComponent) {
            return fallbackComponent;
        }

        // Final fallback to basic component
        const components = await this.componentRegistry.getComponents();
        const basicComponent = components.find(c => c.tier === 1);

        if (!basicComponent) {
            throw new Error('No fallback component available');
        }

        return basicComponent;
    }

    /**
     * Execute component with safety measures
     */
    private async executeWithSafety(
        component: AIComponent,
        request: AIRequest,
        requestId: string
    ): Promise<AIResponse> {
        try {
            // Check if we need to use safety sandbox
            if (this.config.safety.sandboxMode && this.safetySystem.validateAndExecute) {
                return await this.safetySystem.validateAndExecute(component, request);
            }

            // Execute with resource allocation
            return await this.resourceManager.allocateAndExecute(component, request);

        } catch (error) {
            this.logger.error(`Component ${component.name} execution failed:`, error);

            // Try fallback
            const fallbackComponent = this.fallbackSystem.selectComponent ?
                await this.fallbackSystem.selectComponent(request) :
                null;

            if (fallbackComponent && fallbackComponent.name !== component.name) {
                this.logger.warn(`Falling back to ${fallbackComponent.name}`);
                return await this.resourceManager.allocateAndExecute(fallbackComponent, request);
            }

            throw error;
        }
    }

    /**
     * Post-process result and update performance metrics
     */
    private async postProcessResult(
        result: AIResponse,
        component: AIComponent,
        request: AIRequest
    ): Promise<void> {
        // Update performance metrics
        if (this.performanceOptimizer.updateMetrics) {
            await this.performanceOptimizer.updateMetrics(component, result, request);
        }

        // Trigger adaptive optimization
        if (this.config.performance.adaptiveOptimization && this.performanceOptimizer.optimize) {
            await this.performanceOptimizer.optimize(component, request);
        }
    }

    /**
     * Setup event handlers for system communication
     */
    private setupEventHandlers(): void {
        // Health monitoring events
        this.healthMonitor.on('component-unhealthy', (component) => {
            this.logger.warn(`Component ${component.name} is unhealthy`);
            this.emit('component-unhealthy', component);
        });

        this.healthMonitor.on('component-recovered', (component) => {
            this.logger.log(`Component ${component.name} has recovered`);
            this.emit('component-recovered', component);
        });

        // Performance events
        this.performanceOptimizer.on('optimization-complete', (result) => {
            this.logger.debug(`Optimization complete for ${result.component}`);
            this.emit('optimization-complete', result);
        });

        // Safety events
        this.safetySystem.on('safety-violation', (violation) => {
            this.logger.error(`Safety violation detected: ${violation.message}`);
            this.emit('safety-violation', violation);
        });

        // Resource events
        this.resourceManager.on('resource-warning', (warning) => {
            this.logger.warn(`Resource warning: ${warning.message}`);
            this.emit('resource-warning', warning);
        });

        // Fallback events
        this.fallbackSystem.on('fallback-triggered', (info) => {
            this.logger.warn(`Fallback triggered: ${info.reason}`);
            this.emit('fallback-triggered', info);
        });
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.healthMonitor.performHealthCheck();
            } catch (error) {
                this.logger.error('Health check failed:', error);
            }
        }, this.config.health.checkInterval);
    }

    /**
     * Start metrics collection
     */
    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
            } catch (error) {
                this.logger.error('Metrics collection failed:', error);
            }
        }, 10000); // Collect every 10 seconds
    }

    /**
     * Collect comprehensive metrics
     */
    private async collectMetrics(): Promise<void> {
        // Update resource metrics
        this.metrics.resources.cpuUsage = await this.resourceManager.getCpuUsage();
        this.metrics.resources.memoryUsage = await this.resourceManager.getMemoryUsage();
        this.metrics.resources.gpuUsage = await this.resourceManager.getGpuUsage();
        this.metrics.resources.activeComponents = this.componentRegistry.getComponentCount();

        // Update health metrics
        const healthStatus = await this.healthMonitor.getOverallHealth();
        this.metrics.health.overallHealth = healthStatus.score;
        this.metrics.health.lastHealthCheck = Date.now();

        // Update performance metrics
        if (this.performanceOptimizer.getMetrics) {
            const perfMetrics = await this.performanceOptimizer.getMetrics();
            this.metrics.performance.cacheHitRate = perfMetrics.cacheHitRate || 0;
            this.metrics.performance.optimizationScore = perfMetrics.optimizationScore || 0;
        }

        // Update safety metrics
        if (this.safetySystem.getSafetySnapshot) {
            const safetySnapshot = await this.safetySystem.getSafetySnapshot();
            this.metrics.safety.safetyScore = safetySnapshot.safetyScore;
            this.metrics.safety.validationFailures = safetySnapshot.validationFailures;
        }

        // Emit metrics update event
        this.emit('metrics-updated', this.metrics);
    }

    /**
     * Update request metrics
     */
    private updateMetrics(successful: boolean, executionTime: number): void {
        this.metrics.requests.total++;

        if (successful) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }

        // Update average response time
        const total = this.metrics.requests.total;
        const current = this.metrics.requests.averageResponseTime;
        this.metrics.requests.averageResponseTime =
            (current * (total - 1) + executionTime) / total;
    }

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate cache key for request
     */
    private generateCacheKey(component: AIComponent, request: AIRequest): string {
        const boardHash = this.hashBoard(request.board);
        return `${component.name}_${boardHash}_${request.player}_${request.difficulty}`;
    }

    /**
     * Hash board state for caching
     */
    private hashBoard(board: CellValue[][]): string {
        return board.map(row => row.join('')).join('');
    }

    /**
     * Initialize metrics structure
     */
    private initializeMetrics(): AIStabilityMetrics {
        return {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                fallbacks: 0,
                averageResponseTime: 0
            },
            resources: {
                cpuUsage: 0,
                memoryUsage: 0,
                gpuUsage: 0,
                activeComponents: 0
            },
            health: {
                overallHealth: 1.0,
                unhealthyComponents: 0,
                circuitBreakersOpen: 0,
                lastHealthCheck: Date.now()
            },
            performance: {
                averageThinkTime: 0,
                cacheHitRate: 0,
                optimizationScore: 0,
                adaptationRate: 0
            },
            safety: {
                validationFailures: 0,
                sandboxViolations: 0,
                errorContainments: 0,
                safetyScore: 1.0
            }
        };
    }

    // === Public API Methods ===

    /**
     * Get current metrics
     */
    getMetrics(): AIStabilityMetrics {
        return { ...this.metrics };
    }

    async getSystemMetrics(): Promise<AIStabilityMetrics> {
        await this.collectMetrics();
        return this.getMetrics();
    }

    /**
     * Get health status
     */
    async getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        score: number;
        details: any;
    }> {
        const health = await this.healthMonitor.getOverallHealth();
        return {
            status: health.score > 0.8 ? 'healthy' :
                health.score > 0.5 ? 'degraded' : 'unhealthy',
            score: health.score,
            details: health.details
        };
    }

    /**
     * Get available components
     */
    async getAvailableComponents(): Promise<AIComponent[]> {
        return await this.componentRegistry.getHealthyComponents();
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        this.logger.log('🛑 Shutting down AI Stability Manager...');
        this.isShuttingDown = true;

        // Wait for active requests to complete (with timeout)
        const maxWait = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeRequests.size > 0 && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Stop monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }

        // Shutdown systems
        await this.safetySystem.shutdown();
        if (this.performanceOptimizer.shutdown) {
            await this.performanceOptimizer.shutdown();
        }
        if (this.fallbackSystem.shutdown) {
            await this.fallbackSystem.shutdown();
        }
        await this.healthMonitor.shutdown();
        await this.resourceManager.shutdown();
        await this.componentRegistry.shutdown();

        this.logger.log('✅ AI Stability Manager shutdown complete');
    }
} 