/**
 * SafetySystem Test Suite
 * 
 * Tests for validation, sandboxing, and safety checks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { SafetySystem, SafetySystemConfig } from '../../../src/ai/stability/SafetySystem';
import {
    AIComponent,
    AIRequest,
    AIResponse,
    ComponentTier,
    ComponentStatus,
    ComponentHealth,
    AIComponentType,
    ValidationResult,
    SafetyViolation,
    SafetySnapshot,
    SafetyRule,
    CellValue
} from '../../../src/ai/stability/interfaces';

// Mock implementations
class MockComponentRegistry extends EventEmitter {
    private components: Map<string, AIComponent> = new Map();

    constructor() {
        super();
        this.initializeMockComponents();
    }

    private initializeMockComponents(): void {
        // Safe component
        const safeComponent: AIComponent = {
            name: 'safe_ai',
            type: AIComponentType.MINIMAX,
            tier: ComponentTier.STABLE,
            priority: 80,
            timeout: 100,
            memoryLimit: 256,
            dependencies: [],
            status: ComponentStatus.HEALTHY,
            execute: async (request: AIRequest) => ({
                decision: { move: 3, confidence: 0.8, reasoning: 'Safe minimax decision' },
                executionTime: 50
            } as AIResponse),
            healthCheck: async () => ({ score: 0.9, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
        };

        // Unsafe component (long execution time)
        const unsafeComponent: AIComponent = {
            name: 'unsafe_ai',
            type: AIComponentType.NEURAL,
            tier: ComponentTier.EXPERIMENTAL,
            priority: 40,
            timeout: 5000,
            memoryLimit: 1024,
            dependencies: [],
            status: ComponentStatus.EXPERIMENTAL,
            execute: async (request: AIRequest) => {
                // Simulate long execution
                await new Promise(resolve => setTimeout(resolve, 2000));
                return {
                    decision: { move: 1, confidence: 0.6, reasoning: 'Slow neural decision' },
                    executionTime: 2000
                } as AIResponse;
            },
            healthCheck: async () => ({ score: 0.6, status: ComponentStatus.DEGRADED, lastCheck: Date.now() })
        };

        // Invalid component (returns invalid moves)
        const invalidComponent: AIComponent = {
            name: 'invalid_ai',
            type: AIComponentType.BASIC,
            tier: ComponentTier.CRITICAL,
            priority: 50,
            timeout: 50,
            memoryLimit: 128,
            dependencies: [],
            status: ComponentStatus.UNHEALTHY,
            execute: async (request: AIRequest) => ({
                decision: { move: 10, confidence: 1.5, reasoning: 'Invalid decision' }, // Invalid move and confidence
                executionTime: 25
            } as AIResponse),
            healthCheck: async () => ({ score: 0.8, status: ComponentStatus.HEALTHY, lastCheck: Date.now() })
        };

        this.components.set('safe_ai', safeComponent);
        this.components.set('unsafe_ai', unsafeComponent);
        this.components.set('invalid_ai', invalidComponent);
    }

    getComponent(name: string): AIComponent | null {
        return this.components.get(name) || null;
    }

    getAllComponents(): AIComponent[] {
        return Array.from(this.components.values());
    }
}

class MockResourceManager {
    async getCurrentResourceUsage(): Promise<any> {
        return {
            cpuUsage: 40,
            memoryUsage: 512,
            gpuUsage: 20,
            activeComponents: 3
        };
    }
}

class MockHealthMonitor extends EventEmitter {
    async getComponentHealth(componentName: string): Promise<ComponentHealth> {
        const healthStates = {
            'safe_ai': { score: 0.9, status: ComponentStatus.HEALTHY, lastCheck: Date.now() },
            'unsafe_ai': { score: 0.6, status: ComponentStatus.DEGRADED, lastCheck: Date.now() },
            'invalid_ai': { score: 0.8, status: ComponentStatus.HEALTHY, lastCheck: Date.now() }
        };

        return healthStates[componentName] || {
            score: 0.5,
            status: ComponentStatus.DEGRADED,
            lastCheck: Date.now()
        };
    }
}

// Test suite
describe('SafetySystem', () => {
    let safetySystem: SafetySystem;
    let mockRegistry: MockComponentRegistry;
    let mockResourceManager: MockResourceManager;
    let mockHealthMonitor: MockHealthMonitor;
    let mockConfig: Partial<SafetySystemConfig>;

    beforeEach(() => {
        mockRegistry = new MockComponentRegistry();
        mockResourceManager = new MockResourceManager();
        mockHealthMonitor = new MockHealthMonitor();

        mockConfig = {
            validation: {
                enabled: true,
                strictMode: false,
                inputValidation: true,
                outputValidation: true,
                schemaValidation: true
            },
            sandboxing: {
                enabled: true,
                isolationLevel: 'strict',
                memoryLimit: 512,
                timeLimit: 1000,
                resourceLimits: {
                    cpu: 80,
                    memory: 512,
                    gpu: 90
                }
            },
            safetyRules: {
                enabled: true,
                maxExecutionTime: 1000,
                maxMemoryUsage: 1024,
                maxRecursionDepth: 100,
                maxLoopIterations: 10000,
                allowedOperations: ['board_analysis', 'move_calculation'],
                blockedOperations: ['file_system_access', 'network_access']
            },
            threatDetection: {
                enabled: true,
                anomalyThreshold: 0.8,
                behaviorAnalysis: true,
                patternRecognition: true,
                realTimeMonitoring: true
            },
            errorContainment: {
                enabled: true,
                isolateFailures: true,
                automaticRecovery: true,
                rollbackOnFailure: true
            },
            audit: {
                enabled: true,
                logAllOperations: false,
                logValidationFailures: true,
                logSecurityViolations: true,
                retentionPeriod: 86400000 // 24 hours
            }
        };

        safetySystem = new SafetySystem(
            mockConfig,
            mockRegistry as any,
            mockResourceManager as any,
            mockHealthMonitor as any
        );
    });

    afterEach(async () => {
        await safetySystem.shutdown();
        safetySystem.removeAllListeners();
    });

    describe('Initialization', () => {
        it('should initialize with correct configuration', async () => {
            const config = await safetySystem.getConfig();
            expect(config.validation.enabled).toBe(true);
            expect(config.sandboxing.enabled).toBe(true);
            expect(config.safetyRules.enabled).toBe(true);
            expect(config.threatDetection.enabled).toBe(true);
        });

        it('should initialize safety rules', async () => {
            const rules = await safetySystem.getSafetyRules();
            expect(rules.length).toBeGreaterThan(0);

            const ruleIds = rules.map(r => r.id);
            expect(ruleIds).toContain('execution_time_limit');
            expect(ruleIds).toContain('memory_usage_limit');
            expect(ruleIds).toContain('decision_validity');
            expect(ruleIds).toContain('blocked_operations');
        });
    });

    describe('Input Validation', () => {
        it('should validate correct input', async () => {
            const validRequest: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue)),
                player: 'Red' as CellValue,
                timeLimit: 1000,
                difficulty: 5
            };

            const result = await safetySystem.validateInput(validRequest);
            expect(result.valid).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should reject invalid request type', async () => {
            const invalidRequest: AIRequest = {
                type: 'invalid_type' as any,
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const result = await safetySystem.validateInput(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid request type');
        });

        it('should reject invalid board format', async () => {
            const invalidRequest: AIRequest = {
                type: 'move',
                board: Array(5).fill(null).map(() => Array(7).fill(0)), // Wrong dimensions
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const result = await safetySystem.validateInput(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid board state');
        });

        it('should reject invalid player', async () => {
            const invalidRequest: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 3, // Invalid player
                timeLimit: 1000,
                difficulty: 5
            };

            const result = await safetySystem.validateInput(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid player');
        });

        it('should reject invalid time limit', async () => {
            const invalidRequest: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 500000, // Too high
                difficulty: 5
            };

            const result = await safetySystem.validateInput(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid time limit');
        });

        it('should reject invalid difficulty', async () => {
            const invalidRequest: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 15 // Too high
            };

            const result = await safetySystem.validateInput(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid difficulty');
        });
    });

    describe('Output Validation', () => {
        it('should validate correct output', async () => {
            const validResponse: AIResponse = {
                decision: {
                    move: 3,
                    confidence: 0.8,
                    reasoning: 'Good move'
                },
                executionTime: 100
            };

            const result = await safetySystem.validateOutput(validResponse);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid move', async () => {
            const invalidResponse: AIResponse = {
                decision: {
                    move: 10, // Invalid move
                    confidence: 0.8,
                    reasoning: 'Bad move'
                },
                executionTime: 100
            };

            const result = await safetySystem.validateOutput(invalidResponse);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid move');
        });

        it('should reject invalid confidence', async () => {
            const invalidResponse: AIResponse = {
                decision: {
                    move: 3,
                    confidence: 1.5, // Invalid confidence
                    reasoning: 'Over-confident'
                },
                executionTime: 100
            };

            const result = await safetySystem.validateOutput(invalidResponse);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid confidence');
        });

        it('should reject invalid execution time', async () => {
            const invalidResponse: AIResponse = {
                decision: {
                    move: 3,
                    confidence: 0.8,
                    reasoning: 'Too slow'
                },
                executionTime: 400000 // Too high
            };

            const result = await safetySystem.validateOutput(invalidResponse);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Invalid execution time');
        });
    });

    describe('Safe Execution', () => {
        it('should execute safe component successfully', async () => {
            const component = mockRegistry.getComponent('safe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const response = await safetySystem.validateAndExecute(component, request);

            expect(response.validated).toBe(true);
            expect(response.sandboxed).toBe(true);
            expect(response.safetyScore).toBeDefined();
            expect(response.safetyScore).toBeGreaterThan(0.5);
            expect(response.decision.move).toBe(3);
        });

        it('should handle component with validation disabled', async () => {
            // Disable validation
            await safetySystem.updateConfig({
                validation: { enabled: false }
            });

            const component = mockRegistry.getComponent('invalid_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const response = await safetySystem.validateAndExecute(component, request);
            expect(response.decision.move).toBe(10); // Invalid move allowed when validation disabled
        });

        it('should handle component with sandboxing disabled', async () => {
            // Disable sandboxing
            await safetySystem.updateConfig({
                sandboxing: { enabled: false }
            });

            const component = mockRegistry.getComponent('safe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const response = await safetySystem.validateAndExecute(component, request);
            expect(response.sandboxed).toBe(true); // Still marked as sandboxed even with mock sandbox
        });
    });

    describe('Safety Rules', () => {
        it('should enforce execution time limit', async () => {
            const component = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 500, // Short time limit
                difficulty: 8
            };

            await expect(
                safetySystem.validateAndExecute(component, request)
            ).rejects.toThrow();
        });

        it('should block invalid decisions', async () => {
            const component = mockRegistry.getComponent('invalid_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            await expect(
                safetySystem.validateAndExecute(component, request)
            ).rejects.toThrow();
        });

        it('should validate board and block invalid moves', async () => {
            const component = mockRegistry.getComponent('safe_ai')!;

            // Create a board where column 3 is full
            const fullBoard = Array(6).fill(null).map(() => Array(7).fill(0));
            for (let row = 0; row < 6; row++) {
                fullBoard[row][3] = 1; // Fill column 3
            }

            const request: AIRequest = {
                type: 'move',
                board: fullBoard,
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            // Mock the component to return move 3 (which should be invalid)
            const originalExecute = component.execute!;
            component.execute = async () => ({
                decision: { move: 3, confidence: 0.8, reasoning: 'Invalid move to full column' },
                executionTime: 50
            });

            await expect(
                safetySystem.validateAndExecute(component, request)
            ).rejects.toThrow();

            // Restore original execute
            component.execute = originalExecute;
        });
    });

    describe('Safety Rule Management', () => {
        it('should add new safety rule', async () => {
            const newRule: SafetyRule = {
                id: 'test_rule',
                name: 'Test Rule',
                description: 'Test safety rule',
                severity: 'medium',
                enabled: true,
                validator: async () => null,
                enforcement: 'warn'
            };

            await safetySystem.addSafetyRule(newRule);

            const rules = await safetySystem.getSafetyRules();
            const testRule = rules.find(r => r.id === 'test_rule');

            expect(testRule).toBeDefined();
            expect(testRule!.name).toBe('Test Rule');
        });

        it('should update existing safety rule', async () => {
            await safetySystem.updateSafetyRule('execution_time_limit', {
                enabled: false
            });

            const rules = await safetySystem.getSafetyRules();
            const timeRule = rules.find(r => r.id === 'execution_time_limit');

            expect(timeRule!.enabled).toBe(false);
        });

        it('should remove safety rule', async () => {
            await safetySystem.removeSafetyRule('resource_efficiency');

            const rules = await safetySystem.getSafetyRules();
            const resourceRule = rules.find(r => r.id === 'resource_efficiency');

            expect(resourceRule).toBeUndefined();
        });
    });

    describe('Threat Detection', () => {
        it('should analyze threats for safe component', async () => {
            const component = mockRegistry.getComponent('safe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            const response = await component.execute!(request);
            const threatAnalysis = await safetySystem.analyzeThreat(component, request, response);

            expect(threatAnalysis.threatLevel).toBeDefined();
            expect(threatAnalysis.threats).toBeDefined();
            expect(threatAnalysis.recommendations).toBeDefined();
            expect(threatAnalysis.actionRequired).toBeDefined();
        });

        it('should detect threats when enabled', async () => {
            const component = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 5000,
                difficulty: 9
            };

            const threatAnalysis = await safetySystem.analyzeThreat(component, request);

            expect(threatAnalysis.threatLevel).toBeDefined();
            expect(['none', 'low', 'medium', 'high', 'critical']).toContain(threatAnalysis.threatLevel);
        });

        it('should skip threat detection when disabled', async () => {
            // Disable threat detection
            await safetySystem.updateConfig({
                threatDetection: { enabled: false }
            });

            const component = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 5000,
                difficulty: 9
            };

            const threatAnalysis = await safetySystem.analyzeThreat(component, request);

            expect(threatAnalysis.threatLevel).toBe('none');
            expect(threatAnalysis.threats).toHaveLength(0);
            expect(threatAnalysis.actionRequired).toBe(false);
        });
    });

    describe('Safety Metrics and Monitoring', () => {
        it('should provide safety snapshot', async () => {
            const snapshot = await safetySystem.getSafetySnapshot();

            expect(snapshot.validationFailures).toBeDefined();
            expect(snapshot.sandboxViolations).toBeDefined();
            expect(snapshot.errorContainments).toBeDefined();
            expect(snapshot.safetyScore).toBeDefined();
            expect(snapshot.safetyScore).toBeGreaterThanOrEqual(0);
            expect(snapshot.safetyScore).toBeLessThanOrEqual(1);
        });

        it('should track safety violations', async () => {
            const component = mockRegistry.getComponent('invalid_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            // This should trigger safety violations
            try {
                await safetySystem.validateAndExecute(component, request);
            } catch (error) {
                // Expected to fail
            }

            const snapshot = await safetySystem.getSafetySnapshot();
            expect(snapshot.recentViolations).toBeDefined();
        });

        it('should emit safety events', async () => {
            const safetyViolationEvents: any[] = [];
            const validationFailureEvents: any[] = [];

            safetySystem.on('safety_violation', (event) => {
                safetyViolationEvents.push(event);
            });

            safetySystem.on('validation_failure', (event) => {
                validationFailureEvents.push(event);
            });

            // Trigger validation failure
            const invalidRequest: AIRequest = {
                type: 'invalid_type' as any,
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            await safetySystem.validateInput(invalidRequest);

            expect(validationFailureEvents.length).toBeGreaterThan(0);
            expect(validationFailureEvents[0].type).toBe('validation_failure');
        });
    });

    describe('Audit Logging', () => {
        it('should log successful executions', async () => {
            const component = mockRegistry.getComponent('safe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            await safetySystem.validateAndExecute(component, request);

            const auditLogs = await safetySystem.getAuditLogs();
            expect(auditLogs.length).toBeGreaterThan(0);

            const successLog = auditLogs.find(log => log.outcome === 'success');
            expect(successLog).toBeDefined();
            expect(successLog!.component).toBe('safe_ai');
        });

        it('should log failed executions', async () => {
            const component = mockRegistry.getComponent('invalid_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            try {
                await safetySystem.validateAndExecute(component, request);
            } catch (error) {
                // Expected to fail
            }

            const auditLogs = await safetySystem.getAuditLogs();
            const errorLog = auditLogs.find(log => log.outcome === 'error');
            expect(errorLog).toBeDefined();
            expect(errorLog!.component).toBe('invalid_ai');
        });

        it('should filter audit logs by component', async () => {
            const component1 = mockRegistry.getComponent('safe_ai')!;
            const component2 = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            await safetySystem.validateAndExecute(component1, request);

            try {
                await safetySystem.validateAndExecute(component2, request);
            } catch (error) {
                // Expected to fail for unsafe_ai
            }

            const safeAiLogs = await safetySystem.getAuditLogs('safe_ai');
            const unsafeAiLogs = await safetySystem.getAuditLogs('unsafe_ai');

            expect(safeAiLogs.every(log => log.component === 'safe_ai')).toBe(true);
            expect(unsafeAiLogs.every(log => log.component === 'unsafe_ai')).toBe(true);
        });
    });

    describe('Configuration Management', () => {
        it('should update configuration', async () => {
            const newConfig = {
                validation: {
                    strictMode: true
                },
                sandboxing: {
                    isolationLevel: 'paranoid' as const
                }
            };

            await safetySystem.updateConfig(newConfig);
            const config = await safetySystem.getConfig();

            expect(config.validation.strictMode).toBe(true);
            expect(config.sandboxing.isolationLevel).toBe('paranoid');
        });

        it('should maintain existing configuration when partially updated', async () => {
            const originalConfig = await safetySystem.getConfig();

            await safetySystem.updateConfig({
                validation: {
                    strictMode: true
                }
            });

            const updatedConfig = await safetySystem.getConfig();

            expect(updatedConfig.validation.strictMode).toBe(true);
            expect(updatedConfig.validation.enabled).toBe(originalConfig.validation.enabled);
            expect(updatedConfig.sandboxing.enabled).toBe(originalConfig.sandboxing.enabled);
        });
    });

    describe('Error Containment', () => {
        it('should contain errors when enabled', async () => {
            const component = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100, // Very short timeout to force error
                difficulty: 8
            };

            await expect(
                safetySystem.validateAndExecute(component, request)
            ).rejects.toThrow();

            const snapshot = await safetySystem.getSafetySnapshot();
            expect(snapshot.errorContainments).toBeGreaterThan(0);
        });

        it('should handle containment when disabled', async () => {
            // Disable error containment
            await safetySystem.updateConfig({
                errorContainment: { enabled: false }
            });

            const component = mockRegistry.getComponent('unsafe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 100,
                difficulty: 8
            };

            await expect(
                safetySystem.validateAndExecute(component, request)
            ).rejects.toThrow();
        });
    });

    describe('Health Check', () => {
        it('should perform health check successfully', async () => {
            const health = await safetySystem.healthCheck();

            expect(health.score).toBeGreaterThan(0);
            expect(health.status).toBeDefined();
            expect(['healthy', 'degraded', 'unhealthy', 'offline']).toContain(health.status);
            expect(health.metrics?.responseTime).toBeDefined();
        });

        it('should report healthy status with good safety score', async () => {
            const health = await safetySystem.healthCheck();

            if (health.score > 0.8) {
                expect(health.status).toBe(ComponentStatus.HEALTHY);
            } else if (health.score > 0.6) {
                expect(health.status).toBe(ComponentStatus.DEGRADED);
            } else {
                expect(health.status).toBe(ComponentStatus.UNHEALTHY);
            }
        });
    });

    describe('Shutdown', () => {
        it('should shutdown gracefully', async () => {
            const component = mockRegistry.getComponent('safe_ai')!;
            const request: AIRequest = {
                type: 'move',
                board: Array(6).fill(null).map(() => Array(7).fill(0)),
                player: 1,
                timeLimit: 1000,
                difficulty: 5
            };

            // Execute something to create context
            await safetySystem.validateAndExecute(component, request);

            // Shutdown should clean up resources
            await safetySystem.shutdown();

            // Verify cleanup
            expect(safetySystem.listenerCount('safety_violation')).toBe(0);
            expect(safetySystem.listenerCount('validation_failure')).toBe(0);
        });
    });
}); 