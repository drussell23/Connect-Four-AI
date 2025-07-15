/**
 * AI Stability Architecture - Unified Interfaces
 * 
 * This file defines all the common types and interfaces used across
 * the AI stability architecture to ensure consistency and type safety.
 */

import { CellValue } from '../connect4AI';

// Re-export CellValue for use in other stability modules
export { CellValue };

// === Execution Context ===

export interface ExecutionContext {
    requestId: string;
    componentName: string;
    startTime: number;
    timeout: number;
    resources: {
        cpu: number;
        memory: number;
        gpu: number;
    };
    metadata?: any;
}

// === Core AI Component Types ===

export enum AIComponentType {
    BASIC = 'basic',
    MINIMAX = 'minimax',
    MCTS = 'mcts',
    NEURAL = 'neural',
    RL = 'reinforcement_learning',
    HYBRID = 'hybrid',
    META = 'meta_learning',
    EVOLUTION = 'evolution',
    BOOK = 'opening_book',
    ENSEMBLE = 'ensemble'
}

export enum ComponentStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNHEALTHY = 'unhealthy',
    OFFLINE = 'offline',
    EXPERIMENTAL = 'experimental',
    ACTIVE = 'active'
}

export enum ComponentTier {
    CRITICAL = 1,    // <1ms, must never fail
    STABLE = 2,      // <100ms, occasional failures OK
    ADVANCED = 3,    // <1s, more failures acceptable
    EXPERIMENTAL = 4, // <5s, high failure rate OK
    RESEARCH = 5,    // <30s, expected to fail

    // Tier aliases for backward compatibility
    TIER_1 = 1,
    TIER_2 = 2,
    TIER_3 = 3,
    TIER_4 = 4,
    TIER_5 = 5
}

// === AI Component Interface ===

export interface AIComponent {
    name: string;
    type: AIComponentType;
    tier: ComponentTier;
    priority: number;
    timeout: number;
    memoryLimit: number;
    dependencies: string[];
    status: ComponentStatus;

    // Health check function
    healthCheck(): Promise<ComponentHealth>;

    // Execute function
    execute?(request: AIRequest): Promise<AIResponse>;

    // Lifecycle methods
    initialize?(): Promise<void>;
    cleanup?(): Promise<void>;

    // Performance metrics
    getMetrics?(): Promise<ComponentMetrics>;

    // Configuration
    config?: any;

    // Metadata
    metadata?: {
        author?: string;
        version?: string;
        description?: string;
        algorithm?: string;
        performance?: {
            averageThinkTime?: number;
            accuracy?: number;
            reliability?: number;
        };
    };
}

// === Request and Response Types ===

export interface AIRequest {
    type: 'move' | 'evaluate' | 'analyze' | 'predict' | 'train';
    board: CellValue[][];
    player: CellValue;
    timeLimit: number;
    difficulty: number;
    strategy?: string;
    context?: {
        gameId?: string;
        moveHistory?: number[];
        opponentProfile?: any;
        gamePhase?: string;
        threatLevel?: string;
        [key: string]: any;
    };

    // Request metadata
    requestId?: string;
    priority?: number;
    retryCount?: number;
    timestamp?: number;
}

export interface AIResponse {
    decision: AIDecision;
    executionTime?: number;

    // Response metadata
    cacheHit?: boolean;
    fallbacksUsed?: number;
    validated?: boolean;
    sandboxed?: boolean;
    safetyScore?: number;
    optimized?: boolean;
    adaptations?: number;

    // Additional info
    warnings?: string[];
    errors?: string[];
    metadata?: any;
}

export interface AIDecision {
    move: number;
    confidence: number;
    reasoning: string;
    alternativeMoves?: Array<{
        move: number;
        score: number;
        reasoning: string;
    }>;

    // Enhanced decision metadata
    strategy?: string;
    thinkingTime?: number;
    nodesExplored?: number;
    depth?: number;
    evaluation?: number;

    // Performance metrics
    performanceMetrics?: {
        accuracy?: number;
        efficiency?: number;
        reliability?: number;
        safety?: number;
    };

    // Explainability
    explanation?: {
        key_factors?: string[];
        decision_tree?: any;
        feature_importance?: { [key: string]: number };
        confidence_breakdown?: any;
    };
}

// === Health and Monitoring ===

export interface ComponentHealth {
    score: number; // 0.0 to 1.0
    status: ComponentStatus;
    lastCheck: number;

    // Detailed health metrics
    metrics?: {
        responseTime?: number;
        errorRate?: number;
        successRate?: number;
        memoryUsage?: number;
        cpuUsage?: number;
        requestCount?: number;
        lastError?: string;
    };

    // Health indicators
    indicators?: {
        performance?: number;
        reliability?: number;
        resource_usage?: number;
        error_frequency?: number;
    };
}

export interface ComponentMetrics {
    name: string;

    // Performance metrics
    performance: {
        averageResponseTime: number;
        minResponseTime: number;
        maxResponseTime: number;
        throughput: number;
        successRate: number;
        errorRate: number;
    };

    // Resource usage
    resources: {
        cpuUsage: number;
        memoryUsage: number;
        gpuUsage?: number;
        networkUsage?: number;
    };

    // Health metrics
    health: {
        uptime: number;
        availability: number;
        reliability: number;
        lastFailure?: number;
        failureCount: number;
    };

    // Request metrics
    requests: {
        total: number;
        successful: number;
        failed: number;
        retries: number;
        timeouts: number;
    };

    // Timestamp
    timestamp: number;
    collectionPeriod: number;
}

// === Resource Management ===

export interface ResourceUsage {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage: number;
    activeComponents: number;

    // Detailed resource breakdown
    breakdown?: {
        [componentName: string]: {
            cpu: number;
            memory: number;
            gpu?: number;
        };
    };
}

export interface ResourceLimits {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxGpuUsage: number;
    maxConcurrentAI: number;

    // Per-component limits
    componentLimits?: {
        [componentName: string]: {
            maxCpu?: number;
            maxMemory?: number;
            maxGpu?: number;
            maxConcurrent?: number;
        };
    };
}

export interface ResourceAvailability {
    available: boolean;
    reason?: string;

    // Detailed availability
    details?: {
        cpu: { available: boolean; current: number; limit: number };
        memory: { available: boolean; current: number; limit: number };
        gpu: { available: boolean; current: number; limit: number };
        concurrent: { available: boolean; current: number; limit: number };
    };
}

// === Safety and Validation ===

export interface SafetyConfig {
    sandboxMode: boolean;
    validationEnabled: boolean;
    maxExecutionTime: number;
    memoryLimit: number;
    errorContainment: boolean;

    // Safety rules
    rules?: {
        allowedOperations?: string[];
        blockedOperations?: string[];
        maxRecursionDepth?: number;
        maxLoopIterations?: number;
    };
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
    errors?: string[];

    // Detailed validation results
    details?: {
        board_valid?: boolean;
        player_valid?: boolean;
        time_limit_valid?: boolean;
        difficulty_valid?: boolean;
        context_valid?: boolean;
    };
}

export interface SafetyViolation {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    message: string;
    timestamp: number;

    // Violation details
    details?: {
        operation?: string;
        value?: any;
        limit?: any;
        stack_trace?: string;
    };
}

export interface SafetySnapshot {
    validationFailures: number;
    sandboxViolations: number;
    errorContainments: number;
    safetyScore: number;

    // Recent violations
    recentViolations?: SafetyViolation[];

    // Safety trends
    trends?: {
        violation_rate?: number;
        safety_score_trend?: number;
        containment_effectiveness?: number;
    };

    // Metrics for compatibility
    metrics?: {
        validationFailures: number;
        sandboxViolations: number;
        errorContainments: number;
        safetyScore: number;
    };
}

// === Performance Optimization ===

export interface PerformanceSnapshot {
    averageThinkTime: number;
    cacheHitRate: number;
    optimizationScore: number;
    adaptationRate: number;

    // Component performance
    componentPerformance?: {
        [componentName: string]: {
            avgResponseTime: number;
            successRate: number;
            optimizationLevel: number;
        };
    };

    // Optimization suggestions
    suggestions?: {
        component: string;
        optimization: string;
        expectedImprovement: number;
    }[];
}

export interface OptimizationResult {
    applied: boolean;
    optimization: string;
    component: string;

    // Results
    results?: {
        before: number;
        after: number;
        improvement: number;
        confidence: number;
    };

    // Details
    details?: {
        parameters_changed?: any;
        side_effects?: string[];
        rollback_available?: boolean;
    };
}

// === Fallback System ===

export interface FallbackConfig {
    enabled: boolean;
    fastFallback: boolean;
    maxFallbackDepth: number;
    fallbackTimeout: number;

    // Fallback chains
    fallbackChains?: {
        [componentName: string]: string[];
    };

    // Fallback conditions
    conditions?: {
        timeout?: boolean;
        error?: boolean;
        resource_limit?: boolean;
        health_degradation?: boolean;
    };
}

export interface FallbackResult {
    decision: AIDecision;
    fallbackComponent: string;
    originalComponent: string;
    reason: string;

    // Fallback metadata
    metadata?: {
        fallback_depth: number;
        fallback_time: number;
        quality_degradation: number;
    };
}

// === Health Monitoring ===

export interface HealthSnapshot {
    overallHealth: number;
    unhealthyComponents: number;
    circuitBreakersOpen: number;

    // Component health details
    components?: {
        [componentName: string]: ComponentHealth;
    };

    // System health indicators
    indicators?: {
        performance: number;
        reliability: number;
        availability: number;
        resource_efficiency: number;
    };

    // Trends
    trends?: {
        health_trend: number;
        failure_rate: number;
        recovery_rate: number;
    };
}

export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailureTime: number;
    nextAttemptTime: number;

    // Configuration
    config: {
        failureThreshold: number;
        recoveryTimeout: number;
        successThreshold: number;
    };
}

// === Configuration Types ===

export interface StabilityConfig {
    // General settings
    environment: 'development' | 'production' | 'testing';
    debug: boolean;

    // Component configuration
    components: {
        autoRegistration: boolean;
        loadOnDemand: boolean;
        caching: boolean;
        healthChecks: boolean;
    };

    // Monitoring configuration
    monitoring: {
        enabled: boolean;
        interval: number;
        retention: number;
        alerting: boolean;
    };

    // Performance configuration
    performance: {
        optimization: boolean;
        profiling: boolean;
        benchmarking: boolean;
        adaptation: boolean;
    };

    // Security configuration
    security: {
        sandboxing: boolean;
        validation: boolean;
        audit: boolean;
        encryption: boolean;
    };
}

// === Event Types ===

export interface AIEvent {
    type: string;
    timestamp: number;
    component?: string;
    data?: any;
    severity?: 'info' | 'warn' | 'error' | 'critical';
}

export interface PerformanceEvent extends AIEvent {
    type: 'performance';
    data: {
        component: string;
        metric: string;
        value: number;
        threshold?: number;
        trend?: number;
    };
}

export interface HealthEvent extends AIEvent {
    type: 'health';
    data: {
        component: string;
        health: ComponentHealth;
        previous_health?: ComponentHealth;
        change?: number;
    };
}

export interface SafetyEvent extends AIEvent {
    type: 'safety';
    data: {
        violation: SafetyViolation;
        component: string;
        action_taken: string;
    };
}

export interface SafetyRule {
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    validator: (component: AIComponent, request: AIRequest, response?: AIResponse) => Promise<SafetyViolation | null>;
    enforcement: 'warn' | 'block' | 'terminate';
}

export interface ResourceEvent extends AIEvent {
    type: 'resource';
    data: {
        resource: string;
        usage: number;
        limit: number;
        component?: string;
    };
}

// === Utility Types ===

export type ComponentSelector = (components: AIComponent[]) => AIComponent | null;
export type HealthChecker = (component: AIComponent) => Promise<ComponentHealth>;
export type MetricsCollector = (component: AIComponent) => Promise<ComponentMetrics>;
export type PerformanceOptimizer = (component: AIComponent, metrics: ComponentMetrics) => Promise<OptimizationResult>;

// === AI Orchestration Result ===

export interface AIOrchestrationResult {
    decision: AIDecision;
    metadata: {
        componentUsed: string;
        tier: number;
        fallbacksUsed: number;
        executionTime: number;
        resourceUsage: {
            cpu: number;
            memory: number;
            gpu: number;
        };
        health: ComponentHealth;
        safety: {
            validated: boolean;
            sandboxed: boolean;
            safetyScore: number;
        };
        performance: {
            optimized: boolean;
            cacheHit: boolean;
            adaptations: number;
        };
    };
    warnings?: string[];
    errors?: string[];
}

// === Export default interfaces ===

export interface AIStabilityArchitecture {
    manager: any; // Will be AIStabilityManager
    registry: any; // Will be ComponentRegistry
    resourceManager: any; // Will be ResourceManager
    healthMonitor: any; // Will be HealthMonitor
    fallbackSystem: any; // Will be FallbackSystem
    performanceOptimizer: any; // Will be PerformanceOptimizer
    safetySystem: any; // Will be SafetySystem
}

// === Re-export Classes from Other Files ===

export { ComponentRegistry } from './ComponentRegistry';
export { ResourceManager, ResourceManagerConfig } from './ResourceManager';
export { HealthMonitor, HealthMonitorConfig } from './HealthMonitor';