/**
 * SafetySystem Demo
 * 
 * Demonstrates comprehensive validation, sandboxing, safety checks, threat detection,
 * and security features of the SafetySystem.
 */

import { SafetySystem, SafetySystemConfig } from './SafetySystem';
import { ComponentRegistry } from './ComponentRegistry';
import { ResourceManager } from './ResourceManager';
import { HealthMonitor } from './HealthMonitor';
import {
    AIComponent,
    AIRequest,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    SafetyRule,
    SafetyViolation
} from './interfaces';

/**
 * Demo class showcasing SafetySystem capabilities
 */
export class SafetySystemDemo {
    private safetySystem: SafetySystem;
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

        const safetyConfig: Partial<SafetySystemConfig> = {
            validation: {
                enabled: true,
                strictMode: true,
                inputValidation: true,
                outputValidation: true,
                schemaValidation: true
            },
            sandboxing: {
                enabled: false,
                isolationLevel: 'none',
                memoryLimit: 128,
                timeLimit: 1000,
                resourceLimits: {
                    cpu: 50,
                    memory: 128,
                    gpu: 0
                }
            },
            safetyRules: {
                enabled: true,
                maxExecutionTime: 5000,
                maxMemoryUsage: 256,
                maxRecursionDepth: 100,
                maxLoopIterations: 1000,
                allowedOperations: ['compute', 'read', 'write'],
                blockedOperations: ['eval', 'exec', 'import']
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

        this.safetySystem = new SafetySystem(
            safetyConfig,
            this.componentRegistry,
            this.resourceManager,
            this.healthMonitor
        );
    }

    private async setupDemoScenarios(): Promise<void> {
        // Register demo AI components with different safety characteristics
        await this.registerDemoComponents();

        // Initialize all systems
        await this.initializeSystems();

        // Set up safety monitoring
        await this.setupSafetyMonitoring();
    }

    private async registerDemoComponents(): Promise<void> {
        const components: AIComponent[] = [
            // Safe and compliant component
            {
                name: 'secure_minimax',
                type: AIComponentType.MINIMAX,
                tier: ComponentTier.STABLE,
                priority: 5,
                timeout: 3000,
                memoryLimit: 256,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Safe minimax execution
                    await this.simulateProcessing(80);

                    const move = this.calculateSafeMove(request.board, request.player);

                    return {
                        decision: {
                            move,
                            confidence: 0.85,
                            reasoning: 'Secure minimax analysis with safety constraints',
                            strategy: 'secure_minimax',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async () => ({
                    score: 0.95,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Component with potential timeout issues
            {
                name: 'slow_neural_ai',
                type: AIComponentType.NEURAL,
                tier: ComponentTier.EXPERIMENTAL,
                priority: 3,
                timeout: 8000,
                memoryLimit: 512,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate slow neural network processing
                    const processingTime = Math.random() * 3000 + 1000; // 1-4 seconds
                    await this.simulateProcessing(processingTime);

                    return {
                        decision: {
                            move: Math.floor(Math.random() * 7),
                            confidence: 0.7,
                            reasoning: 'Slow neural network decision',
                            strategy: 'neural_network',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async () => ({
                    score: 0.7,
                    status: ComponentStatus.DEGRADED,
                    lastCheck: Date.now()
                })
            },

            // Component that returns invalid moves
            {
                name: 'faulty_ai',
                type: AIComponentType.BASIC,
                tier: ComponentTier.CRITICAL,
                priority: 1,
                timeout: 1000,
                memoryLimit: 64,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    await this.simulateProcessing(50);

                    // Intentionally return invalid moves sometimes
                    const invalidMove = Math.random() < 0.3;

                    return {
                        decision: {
                            move: invalidMove ? 10 : 3, // Invalid move or center
                            confidence: invalidMove ? 1.2 : 0.6, // Invalid confidence or normal
                            reasoning: invalidMove ? 'Faulty decision' : 'Basic AI decision',
                            strategy: 'basic_faulty',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async () => ({
                    score: 0.6,
                    status: ComponentStatus.UNHEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Component that simulates memory leaks
            {
                name: 'memory_heavy_ai',
                type: AIComponentType.RL,
                tier: ComponentTier.RESEARCH,
                priority: 2,
                timeout: 5000,
                memoryLimit: 2048,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate high memory usage
                    await this.simulateProcessing(200);

                    return {
                        decision: {
                            move: this.calculateSafeMove(request.board, request.player),
                            confidence: 0.9,
                            reasoning: 'Memory-intensive RL decision',
                            strategy: 'reinforcement_learning',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async () => ({
                    score: 0.8,
                    status: ComponentStatus.HEALTHY,
                    lastCheck: Date.now()
                })
            },

            // Component that attempts blocked operations
            {
                name: 'suspicious_ai',
                type: AIComponentType.HYBRID,
                tier: ComponentTier.EXPERIMENTAL,
                priority: 3,
                timeout: 4000,
                memoryLimit: 512,
                dependencies: [],
                status: ComponentStatus.HEALTHY,
                execute: async (request: AIRequest) => {
                    const startTime = Date.now();

                    // Simulate attempting blocked operations
                    await this.simulateProcessing(300);

                    return {
                        decision: {
                            move: this.calculateSafeMove(request.board, request.player),
                            confidence: 0.75,
                            reasoning: 'Hybrid AI with suspicious behavior',
                            strategy: 'hybrid_suspicious',
                            thinkingTime: Date.now() - startTime
                        },
                        executionTime: Date.now() - startTime
                    };
                },
                healthCheck: async () => ({
                    score: 0.5,
                    status: ComponentStatus.DEGRADED,
                    lastCheck: Date.now()
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

        // Start monitoring
        const components = this.componentRegistry.getAllComponents();
        await this.healthMonitor.startMonitoring(components);
    }

    private async setupSafetyMonitoring(): Promise<void> {
        // Set up safety event listeners
        this.safetySystem.on('safety_violation', (event) => {
            console.log(`🚨 Safety Violation: ${event.component}`);
            console.log(`   Type: ${event.data.violation.type}`);
            console.log(`   Severity: ${event.data.violation.severity}`);
            console.log(`   Message: ${event.data.violation.message}`);
        });

        this.safetySystem.on('validation_failure', (event) => {
            console.log(`❌ Validation Failure: ${event.data.result.reason}`);
        });
    }

    // === Demo Scenarios ===

    /**
     * Demo 1: Input Validation
     */
    async demoInputValidation(): Promise<void> {
        console.log('\n=== Demo 1: Input Validation ===');

        // Valid input
        const validRequest: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        console.log('Testing valid input...');
        const validResult = await this.safetySystem.validateInput(validRequest);
        console.log(`  Valid: ${validResult.valid}`);
        console.log(`  Reason: ${validResult.reason || 'None'}`);

        // Invalid inputs
        const invalidInputs = [
            {
                ...validRequest,
                type: 'invalid_type' as any,
                description: 'Invalid request type'
            },
            {
                ...validRequest,
                board: Array(5).fill(null).map(() => Array(7).fill(0)),
                description: 'Invalid board dimensions'
            },
            {
                ...validRequest,
                player: 'Yellow' as any,
                description: 'Invalid player number'
            },
            {
                ...validRequest,
                timeLimit: 500000,
                description: 'Time limit too high'
            },
            {
                ...validRequest,
                difficulty: 15,
                description: 'Difficulty too high'
            }
        ];

        console.log('\nTesting invalid inputs...');
        for (const invalidInput of invalidInputs) {
            const result = await this.safetySystem.validateInput(invalidInput);
            console.log(`  ${invalidInput.description}:`);
            console.log(`    Valid: ${result.valid}`);
            console.log(`    Reason: ${result.reason}`);
        }
    }

    /**
     * Demo 2: Output Validation
     */
    async demoOutputValidation(): Promise<void> {
        console.log('\n=== Demo 2: Output Validation ===');

        // Valid output
        const validResponse = {
            decision: {
                move: 3,
                confidence: 0.8,
                reasoning: 'Good center move'
            },
            executionTime: 100
        };

        console.log('Testing valid output...');
        const validResult = await this.safetySystem.validateOutput(validResponse);
        console.log(`  Valid: ${validResult.valid}`);

        // Invalid outputs
        const invalidOutputs = [
            {
                ...validResponse,
                decision: { ...validResponse.decision, move: 10 },
                description: 'Move out of bounds'
            },
            {
                ...validResponse,
                decision: { ...validResponse.decision, confidence: 1.5 },
                description: 'Confidence out of range'
            },
            {
                ...validResponse,
                executionTime: 500000,
                description: 'Execution time too high'
            }
        ];

        console.log('\nTesting invalid outputs...');
        for (const invalidOutput of invalidOutputs) {
            const result = await this.safetySystem.validateOutput(invalidOutput);
            console.log(`  ${invalidOutput.description}:`);
            console.log(`    Valid: ${result.valid}`);
            console.log(`    Reason: ${result.reason}`);
        }
    }

    /**
     * Demo 3: Safe Execution
     */
    async demoSafeExecution(): Promise<void> {
        console.log('\n=== Demo 3: Safe Execution ===');

        const component = this.componentRegistry.getComponent('secure_minimax')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 6
        };

        console.log('Executing safe component...');

        try {
            const response = await this.safetySystem.validateAndExecute(component, request);

            console.log(`  Execution successful!`);
            console.log(`  Move: ${response.decision.move}`);
            console.log(`  Confidence: ${response.decision.confidence}`);
            console.log(`  Execution time: ${response.executionTime}ms`);
            console.log(`  Validated: ${response.validated}`);
            console.log(`  Sandboxed: ${response.sandboxed}`);
            console.log(`  Safety score: ${response.safetyScore?.toFixed(3)}`);

        } catch (error) {
            console.log(`  Execution failed: ${error.message}`);
        }
    }

    /**
     * Demo 4: Safety Rule Enforcement
     */
    async demoSafetyRuleEnforcement(): Promise<void> {
        console.log('\n=== Demo 4: Safety Rule Enforcement ===');

        // Test execution time limit
        console.log('Testing execution time limit...');
        const slowComponent = this.componentRegistry.getComponent('slow_neural_ai')!;
        const quickRequest: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 500, // Short timeout
            difficulty: 8
        };

        try {
            await this.safetySystem.validateAndExecute(slowComponent, quickRequest);
            console.log('  Execution completed within time limit');
        } catch (error) {
            console.log(`  Execution blocked: ${error.message}`);
        }

        // Test invalid decision blocking
        console.log('\nTesting invalid decision blocking...');
        const faultyComponent = this.componentRegistry.getComponent('faulty_ai')!;
        const normalRequest: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        for (let i = 0; i < 3; i++) {
            try {
                const response = await this.safetySystem.validateAndExecute(faultyComponent, normalRequest);
                console.log(`  Attempt ${i + 1}: Valid decision (move ${response.decision.move})`);
            } catch (error) {
                console.log(`  Attempt ${i + 1}: Blocked - ${error.message}`);
            }
        }
    }

    /**
     * Demo 5: Sandboxing and Isolation
     */
    async demoSandboxing(): Promise<void> {
        console.log('\n=== Demo 5: Sandboxing and Isolation ===');

        const component = this.componentRegistry.getComponent('memory_heavy_ai')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Yellow',
            timeLimit: 3000,
            difficulty: 9
        };

        console.log('Executing component in sandbox...');

        try {
            const response = await this.safetySystem.validateAndExecute(component, request);

            console.log(`  Sandbox execution successful`);
            console.log(`  Move: ${response.decision.move}`);
            console.log(`  Sandboxed: ${response.sandboxed}`);
            console.log(`  Safety score: ${response.safetyScore?.toFixed(3)}`);

        } catch (error) {
            console.log(`  Sandbox violation: ${error.message}`);
        }

        // Test with sandboxing disabled
        console.log('\nTesting with sandboxing disabled...');
        await this.safetySystem.updateConfig({
            sandboxing: {
                enabled: false,
                isolationLevel: 'none',
                memoryLimit: 128,
                timeLimit: 1000,
                resourceLimits: {
                    cpu: 50,
                    memory: 128,
                    gpu: 0
                }
            }
        });

        try {
            const response = await this.safetySystem.validateAndExecute(component, request);
            console.log(`  Non-sandboxed execution successful`);
            console.log(`  Move: ${response.decision.move}`);
        } catch (error) {
            console.log(`  Non-sandboxed execution failed: ${error.message}`);
        }

        // Re-enable sandboxing
        await this.safetySystem.updateConfig({
            sandboxing: {
                enabled: true,
                isolationLevel: 'strict' as const,
                memoryLimit: 512,
                timeLimit: 5000,
                resourceLimits: {
                    cpu: 80,
                    memory: 512,
                    gpu: 80
                }
            }
        });
    }

    /**
     * Demo 6: Threat Detection
     */
    async demoThreatDetection(): Promise<void> {
        console.log('\n=== Demo 6: Threat Detection ===');

        const components = [
            this.componentRegistry.getComponent('secure_minimax')!,
            this.componentRegistry.getComponent('suspicious_ai')!,
            this.componentRegistry.getComponent('faulty_ai')!
        ];

        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 7
        };

        for (const component of components) {
            console.log(`\nAnalyzing threats for ${component.name}...`);

            try {
                const response = await component.execute!(request);
                const threatAnalysis = await this.safetySystem.analyzeThreat(component, request, response);

                console.log(`  Threat level: ${threatAnalysis.threatLevel}`);
                console.log(`  Threats detected: ${threatAnalysis.threats.length}`);
                console.log(`  Action required: ${threatAnalysis.actionRequired}`);

                if (threatAnalysis.recommendations.length > 0) {
                    console.log(`  Recommendations:`);
                    threatAnalysis.recommendations.forEach(rec => {
                        console.log(`    - ${rec}`);
                    });
                }

            } catch (error) {
                console.log(`  Component execution failed: ${error.message}`);
            }
        }
    }

    /**
     * Demo 7: Safety Rule Management
     */
    async demoSafetyRuleManagement(): Promise<void> {
        console.log('\n=== Demo 7: Safety Rule Management ===');

        // Show existing safety rules
        const existingRules = await this.safetySystem.getSafetyRules();
        console.log(`Current safety rules (${existingRules.length}):`);
        existingRules.forEach(rule => {
            console.log(`  - ${rule.name} (${rule.severity}) - ${rule.enabled ? 'Enabled' : 'Disabled'}`);
        });

        // Add custom safety rule
        console.log('\nAdding custom safety rule...');
        const customRule: SafetyRule = {
            id: 'confidence_threshold',
            name: 'Confidence Threshold',
            description: 'Ensures AI decisions have minimum confidence',
            severity: 'medium',
            enabled: true,
            validator: async (component, request, response) => {
                if (response && response.decision.confidence < 0.3) {
                    return {
                        type: 'low_confidence',
                        severity: 'medium',
                        component: component.name,
                        message: `Low confidence decision: ${response.decision.confidence}`,
                        timestamp: Date.now(),
                        details: {
                            operation: 'confidence_check',
                            value: response.decision.confidence,
                            limit: 0.3
                        }
                    };
                }
                return null;
            },
            enforcement: 'warn'
        };

        await this.safetySystem.addSafetyRule(customRule);

        const updatedRules = await this.safetySystem.getSafetyRules();
        console.log(`Safety rules after addition (${updatedRules.length}):`);
        const newRule = updatedRules.find(r => r.id === 'confidence_threshold');
        console.log(`  Added: ${newRule?.name} - ${newRule?.enabled ? 'Enabled' : 'Disabled'}`);

        // Test custom rule
        console.log('\nTesting custom rule...');
        const component = this.componentRegistry.getComponent('faulty_ai')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 3 // Low difficulty might produce low confidence
        };

        try {
            const response = await this.safetySystem.validateAndExecute(component, request);
            console.log(`  Custom rule test: Execution successful`);
            console.log(`  Confidence: ${response.decision.confidence}`);
        } catch (error) {
            console.log(`  Custom rule test: ${error.message}`);
        }

        // Disable a rule
        console.log('\nDisabling execution time limit rule...');
        await this.safetySystem.updateSafetyRule('execution_time_limit', { enabled: false });

        const timeRule = (await this.safetySystem.getSafetyRules()).find(r => r.id === 'execution_time_limit');
        console.log(`  Execution time limit rule: ${timeRule?.enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Demo 8: Safety Metrics and Monitoring
     */
    async demoSafetyMetrics(): Promise<void> {
        console.log('\n=== Demo 8: Safety Metrics and Monitoring ===');

        // Generate some safety events by running various components
        console.log('Generating safety events...');

        const components = this.componentRegistry.getAllComponents();
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 6
        };

        for (const component of components.slice(0, 3)) {
            try {
                await this.safetySystem.validateAndExecute(component, request);
                console.log(`  ${component.name}: Executed successfully`);
            } catch (error) {
                console.log(`  ${component.name}: Failed - ${error.message}`);
            }
        }

        // Get safety snapshot
        const snapshot = await this.safetySystem.getSafetySnapshot();
        console.log('\nSafety System Snapshot:');
        console.log(`  Safety score: ${(snapshot.safetyScore * 100).toFixed(1)}%`);
        console.log(`  Validation failures: ${snapshot.validationFailures}`);
        console.log(`  Sandbox violations: ${snapshot.sandboxViolations}`);
        console.log(`  Error containments: ${snapshot.errorContainments}`);
        console.log(`  Recent violations: ${snapshot.recentViolations?.length || 0}`);

        if (snapshot.trends) {
            console.log(`\nSafety Trends:`);
            console.log(`  Violation rate: ${(snapshot.trends.violation_rate * 100).toFixed(2)}%`);
            console.log(`  Safety score trend: ${snapshot.trends.safety_score_trend > 0 ? 'Improving' : 'Degrading'}`);
            console.log(`  Containment effectiveness: ${(snapshot.trends.containment_effectiveness * 100).toFixed(1)}%`);
        }

        // Get threat analysis history
        const threatHistory = await this.safetySystem.getThreatAnalysis();
        console.log(`\nThreat Analysis History: ${threatHistory.length} entries`);

        if (threatHistory.length > 0) {
            const latestThreat = threatHistory[threatHistory.length - 1];
            console.log(`  Latest threat level: ${latestThreat.threatLevel}`);
            console.log(`  Threats detected: ${latestThreat.threats.length}`);
        }
    }

    /**
     * Demo 9: Audit Logging
     */
    async demoAuditLogging(): Promise<void> {
        console.log('\n=== Demo 9: Audit Logging ===');

        // Execute several operations to generate audit logs
        const component = this.componentRegistry.getComponent('secure_minimax')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        console.log('Generating audit logs...');
        for (let i = 0; i < 3; i++) {
            try {
                await this.safetySystem.validateAndExecute(component, request);
                console.log(`  Operation ${i + 1}: Success`);
            } catch (error) {
                console.log(`  Operation ${i + 1}: Failed`);
            }
        }

        // Get audit logs
        const allLogs = await this.safetySystem.getAuditLogs();
        console.log(`\nTotal audit logs: ${allLogs.length}`);

        if (allLogs.length > 0) {
            const latestLog = allLogs[allLogs.length - 1];
            console.log(`\nLatest audit entry:`);
            console.log(`  Component: ${latestLog.component}`);
            console.log(`  Operation: ${latestLog.operation}`);
            console.log(`  Outcome: ${latestLog.outcome}`);
            console.log(`  Violations: ${latestLog.violations.length}`);
            console.log(`  Safety score: ${latestLog.details.safety_score?.toFixed(3)}`);
        }

        // Get component-specific logs
        const componentLogs = await this.safetySystem.getAuditLogs('secure_minimax', 5);
        console.log(`\nSecure minimax logs: ${componentLogs.length}`);
        componentLogs.forEach((log, index) => {
            console.log(`  ${index + 1}. ${log.outcome} - Safety score: ${log.details.safety_score?.toFixed(3)}`);
        });
    }

    /**
     * Demo 10: Configuration Management
     */
    async demoConfigurationManagement(): Promise<void> {
        console.log('\n=== Demo 10: Configuration Management ===');

        // Show current configuration
        const currentConfig = await this.safetySystem.getConfig();
        console.log('Current Configuration:');
        console.log(`  Validation enabled: ${currentConfig.validation.enabled}`);
        console.log(`  Sandboxing isolation: ${currentConfig.sandboxing.isolationLevel}`);
        console.log(`  Safety rules enabled: ${currentConfig.safetyRules.enabled}`);
        console.log(`  Threat detection enabled: ${currentConfig.threatDetection.enabled}`);
        console.log(`  Audit logging enabled: ${currentConfig.audit.enabled}`);

        // Update configuration for stricter security
        console.log('\nUpdating to stricter security configuration...');
        await this.safetySystem.updateConfig({
            validation: {
                enabled: true,
                strictMode: true,
                inputValidation: true,
                outputValidation: true,
                schemaValidation: true
            },
            sandboxing: {
                enabled: true,
                isolationLevel: 'paranoid' as const,
                memoryLimit: 256,
                timeLimit: 500,
                resourceLimits: {
                    cpu: 50,
                    memory: 256,
                    gpu: 50
                }
            },
            safetyRules: {
                enabled: true,
                maxExecutionTime: 1000,
                maxMemoryUsage: 256,
                maxRecursionDepth: 100,
                maxLoopIterations: 1000,
                allowedOperations: ['compute', 'read', 'write'],
                blockedOperations: ['eval', 'exec', 'import']
            },
            threatDetection: {
                enabled: true,
                anomalyThreshold: 0.6,
                behaviorAnalysis: true,
                patternRecognition: true,
                realTimeMonitoring: true
            }
        });

        const updatedConfig = await this.safetySystem.getConfig();
        console.log('\nUpdated Configuration:');
        console.log(`  Strict mode: ${updatedConfig.validation.strictMode}`);
        console.log(`  Isolation level: ${updatedConfig.sandboxing.isolationLevel}`);
        console.log(`  Time limit: ${updatedConfig.sandboxing.timeLimit}ms`);
        console.log(`  Max execution time: ${updatedConfig.safetyRules.maxExecutionTime}ms`);
        console.log(`  Anomaly threshold: ${updatedConfig.threatDetection.anomalyThreshold}`);

        // Test with stricter configuration
        console.log('\nTesting with stricter configuration...');
        const component = this.componentRegistry.getComponent('slow_neural_ai')!;
        const request: AIRequest = {
            type: 'move',
            board: this.generateRandomBoard(),
            player: 'Red',
            timeLimit: 800,
            difficulty: 8
        };

        try {
            const response = await this.safetySystem.validateAndExecute(component, request);
            console.log(`  Strict execution: Success (${response.executionTime}ms)`);
        } catch (error) {
            console.log(`  Strict execution: Blocked - ${error.message}`);
        }
    }

    /**
     * Demo 11: System Health
     */
    async demoSystemHealth(): Promise<void> {
        console.log('\n=== Demo 11: System Health ===');

        const health = await this.safetySystem.healthCheck();
        console.log('Safety System Health:');
        console.log(`  Health score: ${(health.score * 100).toFixed(1)}%`);
        console.log(`  Status: ${health.status}`);
        console.log(`  Response time: ${health.metrics?.responseTime}ms`);
        console.log(`  Success rate: ${(health.metrics?.successRate || 0) * 100}%`);

        // Health status interpretation
        if (health.score > 0.8) {
            console.log(`  System assessment: Excellent safety posture`);
        } else if (health.score > 0.6) {
            console.log(`  System assessment: Good safety posture with minor issues`);
        } else if (health.score > 0.4) {
            console.log(`  System assessment: Degraded safety - attention required`);
        } else {
            console.log(`  System assessment: Poor safety - immediate action required`);
        }

        // Component health overview
        console.log('\nComponent Safety Assessment:');
        const components = this.componentRegistry.getAllComponents();

        for (const component of components) {
            try {
                const testRequest: AIRequest = {
                    type: 'move',
                    board: this.generateRandomBoard(),
                    player: 'Red',
                    timeLimit: 1000,
                    difficulty: 5
                };

                const response = await this.safetySystem.validateAndExecute(component, testRequest);
                const safetyScore = response.safetyScore || 0;

                console.log(`  ${component.name}: ${(safetyScore * 100).toFixed(1)}% safety score`);
            } catch (error) {
                console.log(`  ${component.name}: Safety violation detected`);
            }
        }
    }

    // === Helper Methods ===

    private async simulateProcessing(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    private calculateSafeMove(board: any[][], player: string): number {
        // Simple safe move calculation - prefer center columns
        const centerColumns = [3, 2, 4, 1, 5, 0, 6];
        for (const col of centerColumns) {
            if (this.isValidMove(board, col)) {
                return col;
            }
        }
        return 3; // Fallback to center
    }

    private isValidMove(board: any[][], col: number): boolean {
        return col >= 0 && col < 7 && board[0][col] === 0;
    }

    private generateRandomBoard(): any[][] {
        const board = Array(6).fill(null).map(() => Array(7).fill(0));

        // Add some random pieces
        const numPieces = Math.floor(Math.random() * 12);
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
        console.log('🛡️ Starting SafetySystem Demo Suite');
        console.log('=====================================');

        try {
            await this.demoInputValidation();
            await this.demoOutputValidation();
            await this.demoSafeExecution();
            await this.demoSafetyRuleEnforcement();
            await this.demoSandboxing();
            await this.demoThreatDetection();
            await this.demoSafetyRuleManagement();
            await this.demoSafetyMetrics();
            await this.demoAuditLogging();
            await this.demoConfigurationManagement();
            await this.demoSystemHealth();

            console.log('\n🏆 All demos completed successfully!');
            console.log('=====================================');

            // Show final safety summary
            const finalSnapshot = await this.safetySystem.getSafetySnapshot();
            console.log('\nFinal Safety Summary:');
            console.log(`  Overall safety score: ${(finalSnapshot.safetyScore * 100).toFixed(1)}%`);
            console.log(`  Total validation failures: ${finalSnapshot.validationFailures}`);
            console.log(`  Total safety violations: ${finalSnapshot.recentViolations?.length || 0}`);
            console.log(`  System status: ${finalSnapshot.safetyScore > 0.8 ? 'SECURE' : 'NEEDS ATTENTION'}`);

        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        } finally {
            // Cleanup
            await this.safetySystem.shutdown();
            await this.healthMonitor.shutdown();
            await this.componentRegistry.shutdown();
        }
    }
}

// Export demo runner
export async function runSafetySystemDemo(): Promise<void> {
    const demo = new SafetySystemDemo();
    await demo.runAllDemos();
}

// Run demo if called directly
if (require.main === module) {
    runSafetySystemDemo().catch(console.error);
} 