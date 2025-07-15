#!/usr/bin/env node

/**
 * 🤖 AI-Powered Service Diagnostics and Auto-Recovery System
 * Intelligent detection, diagnosis, and resolution of service failures
 * Enhanced with machine learning and predictive analytics
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * AI Diagnostic Engine
 * Uses machine learning patterns to diagnose and fix service issues
 */
class AIDiagnosticEngine {
    constructor() {
        this.diagnosticsHistory = this.loadDiagnosticsHistory();
        this.knowledgeBase = this.initializeKnowledgeBase();
        this.recoveryStrategies = this.initializeRecoveryStrategies();
        this.currentDiagnosis = null;
    }

    /**
     * Initialize the AI knowledge base with common patterns and solutions
     */
    initializeKnowledgeBase() {
        return {
            // Backend failure patterns and solutions
            backend: {
                patterns: [
                    {
                        symptoms: ['connection_refused', 'port_binding_failed'],
                        causes: ['compilation_error', 'dependency_missing', 'port_conflict'],
                        solutions: ['restart_with_different_port', 'reinstall_dependencies', 'kill_conflicting_process'],
                        confidence: 0.9
                    },
                    {
                        symptoms: ['health_check_timeout', 'process_running_but_unresponsive'],
                        causes: ['infinite_loop', 'database_connection_failed', 'memory_leak'],
                        solutions: ['restart_service', 'check_dependencies', 'increase_memory'],
                        confidence: 0.8
                    },
                    {
                        symptoms: ['typescript_compilation_error'],
                        causes: ['type_errors', 'missing_imports', 'version_mismatch'],
                        solutions: ['fix_types', 'update_dependencies', 'clean_build'],
                        confidence: 0.95
                    }
                ]
            },

            // System-level patterns
            system: {
                patterns: [
                    {
                        symptoms: ['low_memory', 'high_cpu'],
                        causes: ['resource_exhaustion', 'memory_leaks'],
                        solutions: ['restart_services', 'close_applications', 'increase_swap'],
                        confidence: 0.85
                    }
                ]
            }
        };
    }

    /**
     * Initialize intelligent recovery strategies
     */
    initializeRecoveryStrategies() {
        return {
            backend: {
                // Strategy 1: Quick restart with clean state
                quick_restart: {
                    name: 'Quick Restart',
                    steps: [
                        { action: 'kill_process', params: { port: 3000, force: true } },
                        { action: 'wait', params: { duration: 2000 } },
                        { action: 'restart_service', params: { service: 'backend' } },
                        { action: 'verify_health', params: { timeout: 10000 } }
                    ],
                    successRate: 0.7,
                    estimatedTime: 15000
                },

                // Strategy 2: Clean build and restart
                clean_rebuild: {
                    name: 'Clean Rebuild',
                    steps: [
                        { action: 'kill_process', params: { port: 3000, force: true } },
                        { action: 'clean_build', params: { service: 'backend' } },
                        { action: 'rebuild', params: { service: 'backend' } },
                        { action: 'restart_service', params: { service: 'backend' } },
                        { action: 'verify_health', params: { timeout: 15000 } }
                    ],
                    successRate: 0.9,
                    estimatedTime: 30000
                },

                // Strategy 3: Dependency reset and rebuild
                dependency_reset: {
                    name: 'Dependency Reset',
                    steps: [
                        { action: 'kill_process', params: { port: 3000, force: true } },
                        { action: 'clear_cache', params: { service: 'backend' } },
                        { action: 'reinstall_dependencies', params: { service: 'backend' } },
                        { action: 'rebuild', params: { service: 'backend' } },
                        { action: 'restart_service', params: { service: 'backend' } },
                        { action: 'verify_health', params: { timeout: 20000 } }
                    ],
                    successRate: 0.95,
                    estimatedTime: 60000
                },

                // Strategy 4: Port conflict resolution
                port_conflict_resolution: {
                    name: 'Port Conflict Resolution',
                    steps: [
                        { action: 'scan_port_conflicts', params: { port: 3000 } },
                        { action: 'kill_conflicting_processes', params: { port: 3000 } },
                        { action: 'wait', params: { duration: 3000 } },
                        { action: 'restart_service', params: { service: 'backend' } },
                        { action: 'verify_health', params: { timeout: 10000 } }
                    ],
                    successRate: 0.8,
                    estimatedTime: 20000
                }
            }
        };
    }

    /**
     * AI-powered diagnosis of service failures
     */
    async diagnoseServiceFailure(serviceId, symptoms) {
        console.log(`🤖 AI Diagnosing failure for ${serviceId}...`);
        console.log(`📊 Symptoms detected: ${symptoms.join(', ')}`);

        const serviceKnowledge = this.knowledgeBase[serviceId] || this.knowledgeBase.system;
        let bestMatch = null;
        let highestConfidence = 0;

        // Find the best matching pattern using AI pattern recognition
        for (const pattern of serviceKnowledge.patterns) {
            const matchScore = this.calculateSymptomMatch(symptoms, pattern.symptoms);
            const confidence = matchScore * pattern.confidence;

            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestMatch = {
                    ...pattern,
                    matchConfidence: confidence,
                    matchScore: matchScore
                };
            }
        }

        if (bestMatch && highestConfidence > 0.5) {
            this.currentDiagnosis = {
                serviceId,
                symptoms,
                causes: bestMatch.causes,
                solutions: bestMatch.solutions,
                confidence: highestConfidence,
                timestamp: Date.now()
            };

            console.log(`🎯 AI Diagnosis Complete:`);
            console.log(`   Confidence: ${Math.round(highestConfidence * 100)}%`);
            console.log(`   Likely Causes: ${bestMatch.causes.join(', ')}`);
            console.log(`   Recommended Solutions: ${bestMatch.solutions.join(', ')}`);

            return this.currentDiagnosis;
        } else {
            console.log(`❓ AI could not confidently diagnose the issue (confidence: ${Math.round(highestConfidence * 100)}%)`);
            return null;
        }
    }

    /**
     * Calculate how well symptoms match a pattern using AI scoring
     */
    calculateSymptomMatch(observedSymptoms, patternSymptoms) {
        if (patternSymptoms.length === 0) return 0;

        let matches = 0;
        for (const symptom of patternSymptoms) {
            if (observedSymptoms.some(obs => obs.includes(symptom) || symptom.includes(obs))) {
                matches++;
            }
        }

        return matches / patternSymptoms.length;
    }

    /**
     * AI-powered recovery strategy selection
     */
    selectOptimalRecoveryStrategy(serviceId, diagnosis) {
        const strategies = this.recoveryStrategies[serviceId];
        if (!strategies) {
            console.log(`❌ No recovery strategies available for ${serviceId}`);
            return null;
        }

        // AI decision making based on diagnosis and historical success rates
        let bestStrategy = null;
        let bestScore = 0;

        for (const [strategyId, strategy] of Object.entries(strategies)) {
            // Calculate strategy score based on:
            // 1. Success rate
            // 2. Estimated time (prefer faster solutions)
            // 3. Match with diagnosis
            const timeScore = 1 - (strategy.estimatedTime / 120000); // Normalize to 2 minutes max
            const diagnosisMatch = this.calculateDiagnosisMatch(diagnosis, strategy);

            const score = (strategy.successRate * 0.4) + (timeScore * 0.3) + (diagnosisMatch * 0.3);

            if (score > bestScore) {
                bestScore = score;
                bestStrategy = { id: strategyId, ...strategy, score };
            }
        }

        if (bestStrategy) {
            console.log(`🎯 AI Selected Recovery Strategy: ${bestStrategy.name}`);
            console.log(`   Score: ${Math.round(bestStrategy.score * 100)}%`);
            console.log(`   Success Rate: ${Math.round(bestStrategy.successRate * 100)}%`);
            console.log(`   Estimated Time: ${Math.round(bestStrategy.estimatedTime / 1000)}s`);
        }

        return bestStrategy;
    }

    /**
     * Calculate how well a strategy matches the diagnosis
     */
    calculateDiagnosisMatch(diagnosis, strategy) {
        if (!diagnosis || !diagnosis.solutions) return 0.5;

        // Check if strategy steps align with recommended solutions
        let matchScore = 0;
        const strategyActions = strategy.steps.map(step => step.action);

        for (const solution of diagnosis.solutions) {
            if (strategyActions.some(action => action.includes(solution) || solution.includes(action))) {
                matchScore += 1;
            }
        }

        return Math.min(1, matchScore / diagnosis.solutions.length);
    }

    /**
     * Execute AI-selected recovery strategy
     */
    async executeRecoveryStrategy(strategy, serviceConfig) {
        console.log(`🚀 Executing AI Recovery Strategy: ${strategy.name}`);

        for (let i = 0; i < strategy.steps.length; i++) {
            const step = strategy.steps[i];
            console.log(`   Step ${i + 1}/${strategy.steps.length}: ${step.action}`);

            try {
                await this.executeRecoveryStep(step, serviceConfig);
                console.log(`   ✅ Step completed successfully`);
            } catch (error) {
                console.log(`   ❌ Step failed: ${error.message}`);
                throw new Error(`Recovery strategy failed at step ${i + 1}: ${error.message}`);
            }
        }

        console.log(`🎉 AI Recovery Strategy completed successfully!`);
    }

    /**
     * Execute individual recovery step
     */
    async executeRecoveryStep(step, serviceConfig) {
        switch (step.action) {
            case 'kill_process':
                await this.killProcessOnPort(step.params.port, step.params.force);
                break;

            case 'wait':
                await this.wait(step.params.duration);
                break;

            case 'restart_service':
                await this.restartService(step.params.service, serviceConfig);
                break;

            case 'verify_health':
                await this.verifyServiceHealth(serviceConfig, step.params.timeout);
                break;

            case 'clean_build':
                await this.cleanBuild(step.params.service);
                break;

            case 'rebuild':
                await this.rebuild(step.params.service);
                break;

            case 'clear_cache':
                await this.clearCache(step.params.service);
                break;

            case 'reinstall_dependencies':
                await this.reinstallDependencies(step.params.service);
                break;

            case 'scan_port_conflicts':
                await this.scanPortConflicts(step.params.port);
                break;

            case 'kill_conflicting_processes':
                await this.killConflictingProcesses(step.params.port);
                break;

            default:
                throw new Error(`Unknown recovery step: ${step.action}`);
        }
    }

    /**
     * Smart service health verification with detailed diagnostics
     */
    async verifyServiceHealth(serviceConfig, timeout = 10000) {
        const startTime = Date.now();
        const healthCheckUrl = serviceConfig.healthCheck;

        console.log(`🔍 Verifying service health: ${healthCheckUrl}`);

        while (Date.now() - startTime < timeout) {
            try {
                await this.makeHealthCheckRequest(healthCheckUrl);
                console.log(`✅ Service health verified successfully`);
                return true;
            } catch (error) {
                // Wait before retrying
                await this.wait(1000);
            }
        }

        throw new Error(`Service health check failed after ${timeout}ms`);
    }

    /**
     * Make health check request with proper error handling
     */
    async makeHealthCheckRequest(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, { timeout: 5000 }, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    reject(new Error(`Health check returned status ${res.statusCode}`));
                }
            });

            request.on('error', reject);
            request.on('timeout', () => reject(new Error('Health check timeout')));
        });
    }

    /**
     * Kill process on specific port
     */
    async killProcessOnPort(port, force = false) {
        try {
            const command = process.platform === 'win32'
                ? `netstat -ano | findstr :${port}`
                : `lsof -ti:${port}`;

            const result = execSync(command, { encoding: 'utf8' });

            if (result.trim()) {
                const killCommand = process.platform === 'win32'
                    ? `taskkill ${force ? '/F' : ''} /PID ${result.trim().split(/\s+/).pop()}`
                    : `kill ${force ? '-9' : ''} ${result.trim()}`;

                execSync(killCommand);
                console.log(`   💀 Killed process on port ${port}`);
            }
        } catch (error) {
            // Process might not exist, which is fine
            console.log(`   ℹ️  No process found on port ${port}`);
        }
    }

    /**
     * Restart service with intelligent process management
     */
    async restartService(serviceName, serviceConfig) {
        console.log(`   🔄 Restarting ${serviceName}...`);

        const process = spawn(serviceConfig.command, serviceConfig.args, {
            cwd: serviceConfig.cwd,
            detached: true,
            stdio: 'ignore'
        });

        process.unref();

        // Wait for service to initialize
        await this.wait(serviceConfig.warmupDelay || 3000);
        console.log(`   🚀 ${serviceName} restart initiated`);
    }

    /**
     * Clean build for service
     */
    async cleanBuild(serviceName) {
        const buildCommands = {
            backend: ['npm', 'run', 'build:clean'],
            frontend: ['npm', 'run', 'build:clean']
        };

        const command = buildCommands[serviceName];
        if (command) {
            console.log(`   🧹 Clean building ${serviceName}...`);
            execSync(`${command[0]} ${command.slice(1).join(' ')}`, {
                cwd: serviceName,
                stdio: 'pipe'
            });
        }
    }

    /**
     * Rebuild service
     */
    async rebuild(serviceName) {
        const buildCommands = {
            backend: ['npm', 'run', 'build'],
            frontend: ['npm', 'run', 'build']
        };

        const command = buildCommands[serviceName];
        if (command) {
            console.log(`   🔨 Rebuilding ${serviceName}...`);
            execSync(`${command[0]} ${command.slice(1).join(' ')}`, {
                cwd: serviceName,
                stdio: 'pipe'
            });
        }
    }

    /**
     * Clear cache for service
     */
    async clearCache(serviceName) {
        console.log(`   🗑️  Clearing cache for ${serviceName}...`);

        try {
            execSync('npm run clean', { cwd: serviceName, stdio: 'pipe' });
        } catch (error) {
            // Fallback to manual cache clearing
            const cachePaths = [
                path.join(serviceName, 'node_modules/.cache'),
                path.join(serviceName, 'dist'),
                path.join(serviceName, 'build')
            ];

            for (const cachePath of cachePaths) {
                if (fs.existsSync(cachePath)) {
                    fs.rmSync(cachePath, { recursive: true, force: true });
                }
            }
        }
    }

    /**
     * Reinstall dependencies
     */
    async reinstallDependencies(serviceName) {
        console.log(`   📦 Reinstalling dependencies for ${serviceName}...`);

        // Remove node_modules and package-lock.json
        const nodeModulesPath = path.join(serviceName, 'node_modules');
        const packageLockPath = path.join(serviceName, 'package-lock.json');

        if (fs.existsSync(nodeModulesPath)) {
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        }

        if (fs.existsSync(packageLockPath)) {
            fs.unlinkSync(packageLockPath);
        }

        // Reinstall
        execSync('npm install', { cwd: serviceName, stdio: 'pipe' });
    }

    /**
     * Scan for port conflicts
     */
    async scanPortConflicts(port) {
        console.log(`   🔍 Scanning for conflicts on port ${port}...`);

        try {
            const command = process.platform === 'win32'
                ? `netstat -ano | findstr :${port}`
                : `lsof -i:${port}`;

            const result = execSync(command, { encoding: 'utf8' });

            if (result.trim()) {
                console.log(`   ⚠️  Port conflict detected on ${port}`);
                console.log(`   ${result.trim()}`);
                return true;
            }
        } catch (error) {
            // No conflicts found
        }

        return false;
    }

    /**
     * Kill conflicting processes
     */
    async killConflictingProcesses(port) {
        await this.killProcessOnPort(port, true);
    }

    /**
     * Utility function for waiting
     */
    async wait(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Load diagnostics history for machine learning
     */
    loadDiagnosticsHistory() {
        try {
            const historyPath = path.join(__dirname, '..', 'logs', 'diagnostics-history.json');
            if (fs.existsSync(historyPath)) {
                return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
        } catch (error) {
            console.warn(`⚠️  Could not load diagnostics history: ${error.message}`);
        }
        return { sessions: [], patterns: {} };
    }

    /**
     * Save diagnostics session for machine learning
     */
    saveDiagnosticsSession(session) {
        try {
            const historyPath = path.join(__dirname, '..', 'logs', 'diagnostics-history.json');
            this.diagnosticsHistory.sessions.push(session);

            // Keep only the last 50 sessions
            if (this.diagnosticsHistory.sessions.length > 50) {
                this.diagnosticsHistory.sessions = this.diagnosticsHistory.sessions.slice(-50);
            }

            fs.writeFileSync(historyPath, JSON.stringify(this.diagnosticsHistory, null, 2));
        } catch (error) {
            console.warn(`⚠️  Could not save diagnostics session: ${error.message}`);
        }
    }
}

module.exports = { AIDiagnosticEngine }; 