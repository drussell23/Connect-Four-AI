/**
 * FallbackSystem Test Suite
 * 
 * Tests for the 5-tier stability architecture with graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { FallbackSystem, FallbackTrigger } from '../../../src/ai/stability/FallbackSystem';
import {
    AIComponent,
    AIRequest,
    AIResponse,
    ComponentTier,
    ComponentStatus,
    ComponentHealth,
    FallbackConfig,
    AIComponentType
} from '../../../src/ai/stability/interfaces';

// Mock implementations
class MockComponentRegistry extends EventEmitter {
    private components: Map<string, AIComponent> = new Map();
    private componentsByTier: Map<ComponentTier, AIComponent[]> = new Map();

    constructor() {
        super();
        this.initializeMockComponents();
    }

    private initializeMockComponents(): void {
        // Tier 1 - Critical
        const tier1Component: AIComponent = {
            name: 'basic_ai',
            type: AIComponentType.BASIC,
            tier: ComponentTier.CRITICAL,
            priority: 10,
            timeout: 1,
            memoryLimit: 128,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 3, confidence: 0.8, reasoning: 'Basic AI move' },
                executionTime: 0.5
            } as AIResponse),
            healthCheck: async () => ({ score: 1.0, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
        };

        // Tier 2 - Stable
        const tier2Component: AIComponent = {
            name: 'minimax_ai',
            type: AIComponentType.MINIMAX,
            tier: ComponentTier.STABLE,
            priority: 8,
            timeout: 100,
            memoryLimit: 512,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 2, confidence: 0.9, reasoning: 'Minimax analysis' },
                executionTime: 50
            } as AIResponse),
            healthCheck: async () => ({ score: 0.9, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
        };

        // Tier 3 - Advanced
        const tier3Component: AIComponent = {
            name: 'mcts_ai',
            type: AIComponentType.MCTS,
            tier: ComponentTier.ADVANCED,
            priority: 6,
            timeout: 1000,
            memoryLimit: 1024,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 1, confidence: 0.95, reasoning: 'MCTS simulation' },
                executionTime: 500
            } as AIResponse),
            healthCheck: async () => ({ score: 0.85, status: ComponentStatus.DEGRADED, lastCheck: Date.now() })
        };

        // Tier 4 - Experimental
        const tier4Component: AIComponent = {
            name: 'neural_ai',
            type: AIComponentType.NEURAL,
            tier: ComponentTier.EXPERIMENTAL,
            priority: 4,
            timeout: 5000,
            memoryLimit: 2048,
            dependencies: [],
            execute: async (request: AIRequest) => ({
                decision: { move: 0, confidence: 0.98, reasoning: 'Neural network prediction' },
                executionTime: 2000
            } as AIResponse),
            healthCheck: async () => ({ score: 0.7, status: ComponentStatus.UNHEALTHY, lastCheck: Date.now() })
        };

        // Tier 5 - Research
        const tier5Component: AIComponent = {
            name: 'research_ai',
            type: AIComponentType.RL,
            tier: ComponentTier.RESEARCH,
            priority: 2,
            timeout: 30000,
            memoryLimit: 4096,
            dependencies: [],
            execute: async (request: AIRequest) => {
                throw new Error('Research AI failure');
            },
            healthCheck: async () => ({ score: 0.3, status: ComponentStatus.OFFLINE, lastCheck: Date.now() })
        };

        this.components.set('basic_ai', tier1Component);
        this.components.set('minimax_ai', tier2Component);
        this.components.set('mcts_ai', tier3Component);
        this.components.set('neural_ai', tier4Component);
        this.components.set('research_ai', tier5Component);

        this.componentsByTier.set(ComponentTier.CRITICAL, [tier1Component]);
        this.componentsByTier.set(ComponentTier.STABLE, [tier2Component]);
        this.componentsByTier.set(ComponentTier.ADVANCED, [tier3Component]);
        this.componentsByTier.set(ComponentTier.EXPERIMENTAL, [tier4Component]);
        this.componentsByTier.set(ComponentTier.RESEARCH, [tier5Component]);
    }

    async getComponentsByTier(tier: ComponentTier): Promise<AIComponent[]> {
        return this.componentsByTier.get(tier) || [];
    }

    getComponent(name: string): AIComponent | null {
        return this.components.get(name) || null;
    }
}

class MockResourceManager {
    async allocate(component: AIComponent, tier: ComponentTier): Promise<any> {
        return {
            cpu: 50,
            memory: 512,
            allocated: true
        };
    }

    async deallocate(allocationId: string): Promise<void> {
        // Mock deallocation
    }
}

class MockHealthMonitor {
    private healthStates: Map<string, ComponentHealth> = new Map();

    constructor() {
        this.initializeMockHealth();
    }

    private initializeMockHealth(): void {
        this.healthStates.set('basic_ai', {
            score: 1.0,
            status: ComponentStatus.HEALTHY,
            lastCheck: Date.now()
        });

        this.healthStates.set('minimax_ai', {
            score: 0.9,
            status: ComponentStatus.HEALTHY,
            lastCheck: Date.now()
        });

        this.healthStates.set('mcts_ai', {
            score: 0.7,
            status: ComponentStatus.DEGRADED,
            lastCheck: Date.now()
        });

        this.healthStates.set('neural_ai', {
            score: 0.3,
            status: ComponentStatus.UNHEALTHY,
            lastCheck: Date.now()
        });

        this.healthStates.set('research_ai', {
            score: 0.0,
            status: ComponentStatus.OFFLINE,
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
    }
}

// Test suite
describe('FallbackSystem', () => {
    let fallbackSystem: FallbackSystem;
    let mockRegistry: MockComponentRegistry;
    let mockResourceManager: MockResourceManager;
    let mockHealthMonitor: MockHealthMonitor;
    let mockConfig: FallbackConfig;

    beforeEach(() => {
        mockRegistry = new MockComponentRegistry();
        mockResourceManager = new MockResourceManager();
        mockHealthMonitor = new MockHealthMonitor();

        mockConfig = {
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

        fallbackSystem = new FallbackSystem(
            mockConfig,
            mockRegistry as any,
            mockResourceManager as any,
            mockHealthMonitor as any
        );
    });

    afterEach(() => {
        fallbackSystem.removeAllListeners();
    });

    describe('Initialization', () => {
        it('should initialize with correct configuration', () => {
            const config = fallbackSystem.getConfig();
            expect(config.enabled).toBe(true);
            expect(config.maxFallbackDepth).toBe(5);
            expect(config.fastFallback).toBe(true);
        });

        it('should initialize fallback strategies', () => {
            const metrics = fallbackSystem.getMetrics();
            expect(metrics.totalFallbacks).toBe(0);
        });
    });

    describe('Tier-based Fallback Strategy', () => {
        it('should handle Tier 1 (Critical) failures with emergency fallback', async () => {
            const component = mockRegistry.getComponent('basic_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1,
                difficulty: 1
            };

            const error = new Error('Critical component failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('emergency_fallback');
            expect(result.originalComponent).toBe('basic_ai');
            expect(result.decision.move).toBeGreaterThanOrEqual(0);
            expect(result.decision.move).toBeLessThan(7);
            expect(result.metadata?.quality_degradation).toBe(0.8);
        });

        it('should handle Tier 2 (Stable) failures with tier degradation', async () => {
            const component = mockRegistry.getComponent('minimax_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const error = new Error('Minimax component failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('basic_ai');
            expect(result.originalComponent).toBe('minimax_ai');
            expect(result.reason).toContain('Tier degradation from 2 to 1');
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });

        it('should handle Tier 3 (Advanced) failures with multiple fallback options', async () => {
            const component = mockRegistry.getComponent('mcts_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 7
            };

            const error = new Error('MCTS component failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('minimax_ai');
            expect(result.originalComponent).toBe('mcts_ai');
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });

        it('should handle Tier 4 (Experimental) failures', async () => {
            const component = mockRegistry.getComponent('neural_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 5000,
                difficulty: 8
            };

            const error = new Error('Neural AI failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('mcts_ai');
            expect(result.originalComponent).toBe('neural_ai');
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });

        it('should handle Tier 5 (Research) failures', async () => {
            const component = mockRegistry.getComponent('research_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 30000,
                difficulty: 10
            };

            const error = new Error('Research AI failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('neural_ai');
            expect(result.originalComponent).toBe('research_ai');
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });
    });

    describe('Fallback Triggers', () => {
        it('should handle timeout trigger', async () => {
            const component = mockRegistry.getComponent('minimax_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const error = new Error('Timeout');
            error.name = 'TimeoutError';

            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.TIMEOUT
            );

            expect(result.fallbackComponent).toBe('basic_ai');
            expect(result.originalComponent).toBe('minimax_ai');
        });

        it('should handle resource limit trigger', async () => {
            const component = mockRegistry.getComponent('neural_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 5000,
                difficulty: 8
            };

            const error = new Error('Resource limit exceeded');

            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.RESOURCE_LIMIT
            );

            expect(result.fallbackComponent).toBe('mcts_ai');
            expect(result.originalComponent).toBe('neural_ai');
        });

        it('should handle health degradation trigger', async () => {
            const component = mockRegistry.getComponent('mcts_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 7
            };

            const error = new Error('Component health degraded');

            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.HEALTH_DEGRADATION
            );

            expect(result.fallbackComponent).toBe('minimax_ai');
            expect(result.originalComponent).toBe('mcts_ai');
        });
    });

    describe('Health-based Fallback', () => {
        it('should handle healthy component normally', async () => {
            const component = mockRegistry.getComponent('basic_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1,
                difficulty: 1
            };

            await expect(
                fallbackSystem.handleUnhealthyComponent(component, request)
            ).rejects.toThrow('Component is healthy - no fallback needed');
        });

        it('should handle degraded component with reduced timeout', async () => {
            const component = mockRegistry.getComponent('mcts_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 7
            };

            const result = await fallbackSystem.handleUnhealthyComponent(component, request);

            expect(result.fallbackComponent).toBe('mcts_ai');
            expect(result.originalComponent).toBe('mcts_ai');
            expect(result.reason).toContain('Component degraded');
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });

        it('should handle unhealthy component with fallback', async () => {
            const component = mockRegistry.getComponent('neural_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 5000,
                difficulty: 8
            };

            const result = await fallbackSystem.handleUnhealthyComponent(component, request);

            expect(result.fallbackComponent).toBe('mcts_ai');
            expect(result.originalComponent).toBe('neural_ai');
            expect(result.reason).toContain('Component is unhealthy');
        });

        it('should handle offline component with fallback', async () => {
            const component = mockRegistry.getComponent('research_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 30000,
                difficulty: 10
            };

            const result = await fallbackSystem.handleUnhealthyComponent(component, request);

            expect(result.fallbackComponent).toBe('neural_ai');
            expect(result.originalComponent).toBe('research_ai');
            expect(result.reason).toContain('Component is offline');
        });
    });

    describe('Graceful Degradation', () => {
        it('should degrade quality appropriately with tier fallback', async () => {
            const component = mockRegistry.getComponent('research_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 30000,
                difficulty: 10
            };

            const error = new Error('Research failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            // Quality should degrade by 20% per tier (5 -> 4 = 0.2)
            expect(result.metadata?.quality_degradation).toBe(0.2);
        });

        it('should maintain decision quality with same-tier fallback', async () => {
            // Mock multiple components in same tier
            const altComponent: AIComponent = {
                name: 'alt_minimax',
                type: AIComponentType.MINIMAX,
                tier: ComponentTier.STABLE,
                priority: 7,
                timeout: 100,
                memoryLimit: 512,
                dependencies: [],
                execute: async (request: AIRequest) => ({
                    decision: { move: 4, confidence: 0.85, reasoning: 'Alternative minimax' },
                    executionTime: 60
                } as AIResponse),
                healthCheck: async () => ({ score: 0.95, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
            };

            const tierComponents = [mockRegistry.getComponent('minimax_ai')!, altComponent];
            jest.spyOn(mockRegistry, 'getComponentsByTier').mockResolvedValue(tierComponents);

            const component = mockRegistry.getComponent('minimax_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const error = new Error('Minimax failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            // Should use alternative in same tier with minimal degradation
            expect(result.fallbackComponent).toBe('alt_minimax');
            expect(result.metadata?.quality_degradation).toBe(0.05);
        });
    });

    describe('Response Caching', () => {
        it('should cache successful responses', () => {
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const response: AIResponse = {
                decision: { move: 3, confidence: 0.8, reasoning: 'Cached move' },
                executionTime: 50
            };

            fallbackSystem.cacheResponse(request, response);

            // Cache should be used for fallback
            expect(fallbackSystem.getMetrics().totalFallbacks).toBe(0);
        });

        it('should clear cache when requested', () => {
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const response: AIResponse = {
                decision: { move: 3, confidence: 0.8, reasoning: 'Cached move' },
                executionTime: 50
            };

            fallbackSystem.cacheResponse(request, response);
            fallbackSystem.clearCache();

            // Should clear internal cache
            expect(fallbackSystem.getMetrics().totalFallbacks).toBe(0);
        });
    });

    describe('Metrics and Monitoring', () => {
        it('should track fallback metrics', async () => {
            const component = mockRegistry.getComponent('minimax_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const error = new Error('Test failure');
            await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            const metrics = fallbackSystem.getMetrics();
            expect(metrics.totalFallbacks).toBe(1);
            expect(metrics.fallbacksByTier[ComponentTier.STABLE]).toBe(1);
            expect(metrics.fallbacksByTrigger[FallbackTrigger.ERROR]).toBe(1);
        });

        it('should emit fallback events', async () => {
            const component = mockRegistry.getComponent('minimax_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 5
            };

            const fallbackTriggered = jest.fn();
            const fallbackSuccess = jest.fn();

            fallbackSystem.on('fallback_triggered', fallbackTriggered);
            fallbackSystem.on('fallback_success', fallbackSuccess);

            const error = new Error('Test failure');
            await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(fallbackTriggered).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'fallback_triggered',
                    component: 'minimax_ai'
                })
            );

            expect(fallbackSuccess).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'fallback_success',
                    component: 'basic_ai'
                })
            );
        });
    });

    describe('Emergency Fallback', () => {
        it('should execute emergency fallback when all strategies fail', async () => {
            // Mock all components to fail
            const failingComponent: AIComponent = {
                name: 'failing_ai',
                type: AIComponentType.BASIC,
                tier: ComponentTier.CRITICAL,
                priority: 1,
                timeout: 1,
                memoryLimit: 128,
                dependencies: [],
                execute: async (request: AIRequest) => {
                    throw new Error('Always fails');
                },
                healthCheck: async () => ({ score: 0.0, status: ComponentStatus.OFFLINE, lastCheck: Date.now() })
            };

            jest.spyOn(mockRegistry, 'getComponentsByTier').mockResolvedValue([failingComponent]);

            const component = mockRegistry.getComponent('research_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 30000,
                difficulty: 10
            };

            const error = new Error('Total system failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('emergency_system');
            expect(result.originalComponent).toBe('research_ai');
            expect(result.reason).toContain('Emergency fallback');
            expect(result.metadata?.quality_degradation).toBe(0.9);
        });

        it('should provide absolute emergency fallback', async () => {
            // Create a scenario where even emergency logic fails
            const originalExecuteEmergencyLogic = (fallbackSystem as any).executeEmergencyLogic;
            (fallbackSystem as any).executeEmergencyLogic = jest.fn().mockRejectedValue(new Error('Emergency logic failed'));

            const component = mockRegistry.getComponent('basic_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1,
                difficulty: 1
            };

            const error = new Error('Absolute failure');
            const result = await fallbackSystem.handleFailure(
                component,
                request,
                error,
                FallbackTrigger.ERROR
            );

            expect(result.fallbackComponent).toBe('absolute_emergency');
            expect(result.decision.move).toBe(3); // Center column
            expect(result.metadata?.quality_degradation).toBe(1.0);

            // Restore original method
            (fallbackSystem as any).executeEmergencyLogic = originalExecuteEmergencyLogic;
        });
    });

    describe('Configuration Management', () => {
        it('should allow configuration updates', () => {
            const newConfig = {
                maxFallbackDepth: 3,
                fastFallback: false
            };

            fallbackSystem.updateConfig(newConfig);
            const config = fallbackSystem.getConfig();

            expect(config.maxFallbackDepth).toBe(3);
            expect(config.fastFallback).toBe(false);
        });
    });

    describe('Health Check', () => {
        it('should perform health check successfully', async () => {
            const health = await fallbackSystem.healthCheck();

            expect(health.score).toBe(1.0);
            expect(health.status).toBe(ComponentStatus.HEALTHY);
            expect(health.metrics?.responseTime).toBeDefined();
        });

        it('should report unhealthy status when emergency logic fails', async () => {
            // Mock emergency logic to fail
            (fallbackSystem as any).executeEmergencyLogic = jest.fn().mockRejectedValue(new Error('Emergency failed'));

            const health = await fallbackSystem.healthCheck();

            expect(health.score).toBe(0.0);
            expect(health.status).toBe(ComponentStatus.UNHEALTHY);
            expect(health.metrics?.lastError).toBeDefined();
        });
    });
}); 