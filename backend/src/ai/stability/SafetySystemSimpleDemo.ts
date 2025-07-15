/**
 * Simple SafetySystem Demo
 * 
 * A simplified demo to test the SafetySystem functionality
 */

import {
    SafetyConfig,
    AIComponent,
    AIRequest,
    ComponentTier,
    ComponentStatus,
    AIComponentType,
    ValidationResult,
    ComponentHealth
} from './interfaces';
import { SafetySystem } from './SafetySystem';

// Mock dependencies for demo
class MockComponentRegistry {
    async initialize() { }
    async shutdown() { }
    getAllComponents() { return []; }
    getComponent(name: string) { return null; }
}

class MockResourceManager {
    async initialize() { }
    async shutdown() { }
    async getCurrentResourceUsage() {
        return { cpuUsage: 40, memoryUsage: 512, gpuUsage: 20, activeComponents: 3 };
    }
}

class MockHealthMonitor {
    async initialize() { }
    async shutdown() { }
    async startMonitoring() { }
    async getComponentHealth() {
        return { score: 0.9, status: ComponentStatus.HEALTHY, lastCheck: Date.now() };
    }
}

async function runSimpleDemo() {
    console.log('🛡️ SafetySystem Simple Demo');
    console.log('=============================');

    // Initialize mock dependencies
    const mockRegistry = new MockComponentRegistry();
    const mockResourceManager = new MockResourceManager();
    const mockHealthMonitor = new MockHealthMonitor();

    // Create SafetySystem with minimal configuration
    const safetyConfig = {
        validation: {
            enabled: true,
            strictMode: false,
            inputValidation: true,
            outputValidation: true,
            schemaValidation: true
        },
        sandboxing: {
            enabled: true,
            isolationLevel: 'strict' as const,
            memoryLimit: 1024,
            timeLimit: 5000,
            resourceLimits: {
                cpu: 80,
                memory: 1024,
                gpu: 90
            }
        },
        safetyRules: {
            enabled: true,
            maxExecutionTime: 3000,
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
            retentionPeriod: 86400000
        }
    };

    const safetySystem = new SafetySystem(
        safetyConfig,
        mockRegistry as any,
        mockResourceManager as any,
        mockHealthMonitor as any
    );

    try {
        // Test 1: Input Validation
        console.log('\n1. Testing Input Validation');
        console.log('----------------------------');

        // Valid input
        const validRequest: AIRequest = {
            type: 'move',
            board: Array(6).fill(null).map(() => Array(7).fill('Empty')),
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        const validResult = await safetySystem.validateInput(validRequest);
        console.log(`✅ Valid input: ${validResult.valid}`);

        // Invalid input (bad board)
        const invalidRequest: AIRequest = {
            type: 'move',
            board: Array(5).fill(null).map(() => Array(7).fill('Empty')), // Wrong dimensions
            player: 'Red',
            timeLimit: 1000,
            difficulty: 5
        };

        const invalidResult = await safetySystem.validateInput(invalidRequest);
        console.log(`❌ Invalid input: ${invalidResult.valid} - ${invalidResult.reason}`);

        // Test 2: Output Validation
        console.log('\n2. Testing Output Validation');
        console.log('-----------------------------');

        // Valid output
        const validResponse = {
            decision: {
                move: 3,
                confidence: 0.8,
                reasoning: 'Good center move'
            },
            executionTime: 100
        };

        const validOutputResult = await safetySystem.validateOutput(validResponse);
        console.log(`✅ Valid output: ${validOutputResult.valid}`);

        // Invalid output (bad move)
        const invalidResponse = {
            decision: {
                move: 10, // Invalid move
                confidence: 0.8,
                reasoning: 'Bad move'
            },
            executionTime: 100
        };

        const invalidOutputResult = await safetySystem.validateOutput(invalidResponse);
        console.log(`❌ Invalid output: ${invalidOutputResult.valid} - ${invalidOutputResult.reason}`);

        // Test 3: Safety Rules
        console.log('\n3. Testing Safety Rules');
        console.log('------------------------');

        const rules = await safetySystem.getSafetyRules();
        console.log(`📋 Loaded ${rules.length} safety rules:`);
        rules.forEach(rule => {
            console.log(`  - ${rule.name} (${rule.severity}) - ${rule.enabled ? 'Enabled' : 'Disabled'}`);
        });

        // Test 4: Safety Metrics
        console.log('\n4. Testing Safety Metrics');
        console.log('--------------------------');

        const snapshot = await safetySystem.getSafetySnapshot();
        console.log(`📊 Safety System Status:`);
        console.log(`   Safety score: ${(snapshot.safetyScore * 100).toFixed(1)}%`);
        console.log(`   Validation failures: ${snapshot.validationFailures}`);
        console.log(`   Sandbox violations: ${snapshot.sandboxViolations}`);
        console.log(`   Error containments: ${snapshot.errorContainments}`);

        // Test 5: Threat Detection
        console.log('\n5. Testing Threat Detection');
        console.log('----------------------------');

        // Mock component for threat analysis
        const mockComponent: AIComponent = {
            name: 'mock_minimax',
            type: AIComponentType.MINIMAX,
            tier: ComponentTier.STABLE,
            priority: 5,
            timeout: 3000,
            memoryLimit: 256,
            dependencies: [],
            status: ComponentStatus.HEALTHY,
            healthCheck: async (): Promise<ComponentHealth> => {
                return { score: 0.9, status: ComponentStatus.HEALTHY, lastCheck: Date.now() };
            }
        };

        const threatAnalysis = await safetySystem.analyzeThreat(mockComponent, validRequest);
        console.log(`🔍 Threat analysis for ${mockComponent.name}:`);
        console.log(`   Threat level: ${threatAnalysis.threatLevel}`);
        console.log(`   Threats detected: ${threatAnalysis.threats.length}`);
        console.log(`   Action required: ${threatAnalysis.actionRequired}`);

        // Test 6: System Health
        console.log('\n6. Testing System Health');
        console.log('-------------------------');

        const health = await safetySystem.healthCheck();
        console.log(`💚 SafetySystem Health:`);
        console.log(`   Health score: ${(health.score * 100).toFixed(1)}%`);
        console.log(`   Status: ${health.status}`);
        console.log(`   Response time: ${health.metrics?.responseTime}ms`);

        // Test 7: Configuration Management
        console.log('\n7. Testing Configuration Management');
        console.log('------------------------------------');

        const config = await safetySystem.getConfig();
        console.log(`⚙️ Current Configuration:`);
        console.log(`   Validation enabled: ${config.validation.enabled}`);
        console.log(`   Sandboxing level: ${config.sandboxing.isolationLevel}`);
        console.log(`   Safety rules enabled: ${config.safetyRules.enabled}`);
        console.log(`   Threat detection enabled: ${config.threatDetection.enabled}`);

        // Update configuration
        await safetySystem.updateConfig({
            validation: {
                ...config.validation,
                strictMode: true
            }
        });

        const updatedConfig = await safetySystem.getConfig();
        console.log(`   Updated strict mode: ${updatedConfig.validation.strictMode}`);

        console.log('\n✅ All tests completed successfully!');
        console.log('====================================');

        // Final summary
        const finalSnapshot = await safetySystem.getSafetySnapshot();
        console.log(`\n🏆 Final Safety Summary:`);
        console.log(`   Overall safety score: ${(finalSnapshot.safetyScore * 100).toFixed(1)}%`);
        console.log(`   System status: ${finalSnapshot.safetyScore > 0.8 ? 'SECURE' : 'NEEDS ATTENTION'}`);

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Cleanup
        await safetySystem.shutdown();
        console.log('\n🧹 SafetySystem shut down successfully');
    }
}

// Run the demo
if (require.main === module) {
    runSimpleDemo().catch(console.error);
}

export { runSimpleDemo }; 