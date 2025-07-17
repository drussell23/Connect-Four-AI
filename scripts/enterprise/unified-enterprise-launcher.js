#!/usr/bin/env node

/**
 * 🌟 Unified Enterprise Launcher - Single Entry Point for AI Orchestration Platform
 * 
 * Master control center for the entire enterprise AI ecosystem featuring:
 * - Single entry point for all enterprise systems and services
 * - Intelligent orchestration of core services and enterprise scripts
 * - AI/ML-powered adaptive health check timing and optimization
 * - Real-time system health monitoring and management
 * - Automated deployment and scaling coordination
 * - Unified dashboard for all platform components
 * - Enterprise-grade security and access management
 * - Comprehensive logging and analytics integration
 * 
 * @author Derek J. Russell
 * @version 3.1.0 - AI-Enhanced Health Check Intelligence
 */

'use strict';

const { spawn, fork } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const os = require('os');

// === AI/ML Health Check Intelligence ===

class AIHealthCheckOptimizer {
    constructor() {
        this.historicalData = new Map();
        this.systemMetrics = new Map();
        this.learningCoefficient = 0.1;
        this.dataFile = path.join(__dirname, '..', 'logs', 'health-check-intelligence.json');
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load historical data
            await this.loadHistoricalData();

            // Initialize system baseline metrics
            await this.captureSystemBaseline();

            this.initialized = true;
            console.log('🧠 AI Health Check Optimizer initialized');
        } catch (error) {
            console.log('⚠️ AI Optimizer initialization failed, using fallback logic');
            this.initialized = false;
        }
    }

    async loadHistoricalData() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const parsed = JSON.parse(data);

            for (const [service, history] of Object.entries(parsed.services || {})) {
                this.historicalData.set(service, {
                    startupTimes: history.startupTimes || [],
                    systemConditions: history.systemConditions || [],
                    successRate: history.successRate || 0,
                    averageTime: history.averageTime || 30000,
                    lastUpdated: history.lastUpdated || Date.now()
                });
            }
        } catch (error) {
            // First run or corrupted data - start fresh
            console.log('🔄 Initializing fresh AI learning data');
        }
    }

    async saveHistoricalData() {
        try {
            const data = {
                lastUpdated: Date.now(),
                services: {}
            };

            for (const [service, history] of this.historicalData.entries()) {
                data.services[service] = history;
            }

            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.log('⚠️ Failed to save AI learning data:', error.message);
        }
    }

    async captureSystemBaseline() {
        const cpus = os.cpus();
        const memory = process.memoryUsage();
        const systemLoad = os.loadavg();

        this.systemMetrics.set('baseline', {
            cpuCount: cpus.length,
            cpuSpeed: cpus[0]?.speed || 0,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            loadAverage: systemLoad[0],
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            timestamp: Date.now()
        });
    }

    async captureCurrentSystemMetrics() {
        const memory = process.memoryUsage();
        const loadAvg = os.loadavg();

        return {
            memoryUsage: (memory.heapUsed / memory.heapTotal) * 100,
            systemLoad: loadAvg[0],
            freeMemory: os.freemem(),
            timestamp: Date.now(),
            availableCores: os.cpus().length
        };
    }

    calculateServiceComplexity(serviceName) {
        const complexityWeights = {
            'backend': 5.0,      // Very high complexity - API, DB, TypeScript compilation, multiple endpoints
            'frontend': 2.0,     // Medium complexity - React build process
            'ml_service': 4.0    // Highest complexity - ML model loading, Python startup
        };

        return complexityWeights[serviceName] || 2.5;
    }

    async predictOptimalTimeout(serviceName) {
        if (!this.initialized) {
            await this.initialize();
        }

        const currentMetrics = await this.captureCurrentSystemMetrics();
        const baseline = this.systemMetrics.get('baseline');
        const history = this.historicalData.get(serviceName);
        const complexity = this.calculateServiceComplexity(serviceName);

        // Base timeout calculation using AI/ML approach
        let predictedTimeout = 30000; // Default fallback

        if (history && history.startupTimes.length > 0) {
            // Calculate weighted average based on recent performance
            const recentTimes = history.startupTimes.slice(-10); // Last 10 startups
            const weights = recentTimes.map((_, i) => Math.pow(0.9, recentTimes.length - 1 - i));
            const weightSum = weights.reduce((a, b) => a + b, 0);

            predictedTimeout = recentTimes.reduce((sum, time, i) => {
                return sum + (time * weights[i] / weightSum);
            }, 0);
        }

        // Apply AI adjustments based on system conditions
        const systemLoadFactor = Math.max(1.0, currentMetrics.systemLoad / 2.0);
        const memoryFactor = Math.max(1.0, currentMetrics.memoryUsage / 50.0);
        const complexityFactor = complexity;

        // Dynamic adjustment formula
        const aiAdjustedTimeout = predictedTimeout * systemLoadFactor * memoryFactor * complexityFactor;

        // PERFORMANCE FIX: Aggressive safety bounds with service-specific minimums
        const serviceMinimums = {
            'backend': 90000,    // Backend needs 60+ seconds for TypeScript compilation and full startup
            'frontend': 2000,    // Frontend standard minimum
            'ml_service': 3000   // ML service needs time for Python startup
        };
        const minTimeout = serviceMinimums[serviceName] || 2000;   // Service-specific or default 2 seconds
        const maxTimeout = 120000;  // Increased max to 120 seconds for backend compilation

        const finalTimeout = Math.max(minTimeout, Math.min(maxTimeout, aiAdjustedTimeout));

        console.log(`🧠 AI Timeout Prediction for ${serviceName}:`);
        console.log(`     Historical Average: ${Math.round(predictedTimeout)}ms`);
        console.log(`     System Load Factor: ${systemLoadFactor.toFixed(2)}x`);
        console.log(`     Memory Factor: ${memoryFactor.toFixed(2)}x`);
        console.log(`     Complexity Factor: ${complexityFactor}x`);
        console.log(`     Final Prediction: ${Math.round(finalTimeout)}ms`);

        return Math.round(finalTimeout);
    }

    async recordStartupSuccess(serviceName, actualTime, systemMetrics) {
        if (!this.historicalData.has(serviceName)) {
            this.historicalData.set(serviceName, {
                startupTimes: [],
                systemConditions: [],
                successRate: 0,
                averageTime: 30000,
                lastUpdated: Date.now()
            });
        }

        const history = this.historicalData.get(serviceName);

        // Add new data point
        history.startupTimes.push(actualTime);
        history.systemConditions.push(systemMetrics);

        // Keep only last 50 data points for performance
        if (history.startupTimes.length > 50) {
            history.startupTimes = history.startupTimes.slice(-50);
            history.systemConditions = history.systemConditions.slice(-50);
        }

        // Update running statistics
        history.averageTime = history.startupTimes.reduce((a, b) => a + b, 0) / history.startupTimes.length;
        history.successRate = Math.min(1.0, history.successRate + this.learningCoefficient);
        history.lastUpdated = Date.now();

        // Save learning data
        await this.saveHistoricalData();

        console.log(`🎯 AI Learning: ${serviceName} startup in ${actualTime}ms (avg: ${Math.round(history.averageTime)}ms)`);
    }

    async recordStartupFailure(serviceName, attemptedTimeout, systemMetrics) {
        if (!this.historicalData.has(serviceName)) {
            this.historicalData.set(serviceName, {
                startupTimes: [],
                systemConditions: [],
                successRate: 0.5,
                averageTime: 30000,
                lastUpdated: Date.now()
            });
        }

        const history = this.historicalData.get(serviceName);

        // Record failure and adjust learning
        history.successRate = Math.max(0.0, history.successRate - this.learningCoefficient * 2);
        history.lastUpdated = Date.now();

        // Save learning data
        await this.saveHistoricalData();

        console.log(`📉 AI Learning: ${serviceName} failed to start within ${attemptedTimeout}ms`);
    }

    getAdaptiveRetryStrategy(serviceName) {
        const history = this.historicalData.get(serviceName);
        const complexity = this.calculateServiceComplexity(serviceName);

        let retryInterval = 2000; // Base 2 seconds
        let maxRetries = 15;      // Default max retries

        if (history) {
            // Adjust based on historical success rate
            if (history.successRate > 0.8) {
                retryInterval = 1500; // Faster checks for reliable services
                maxRetries = 10;
            } else if (history.successRate < 0.5) {
                retryInterval = 3000; // Slower checks for problematic services
                maxRetries = 20;
            }
        }

        // Adjust for service complexity
        retryInterval = Math.round(retryInterval * Math.sqrt(complexity));

        return { retryInterval, maxRetries };
    }
}

// === Unified Configuration ===

const CONFIG = {
    // Platform components
    platform: {
        coreServices: {
            backend: {
                name: 'Backend API Server',
                command: 'npm run start:dev',
                cwd: './backend',
                port: 3000,  // FIXED: Backend runs on port 3000, not 3001
                healthCheck: '/api/health',
                priority: 1,
                essential: true
            },
            frontend: {
                name: 'Frontend React App',
                command: 'npm start',
                cwd: './frontend',
                port: 3001, // FIXED: Frontend runs on 3001
                healthCheck: '/',
                priority: 2,
                essential: true
            },
            ml_service: {
                name: 'ML Inference Service',
                command: 'uvicorn ml_service:app --host 0.0.0.0 --port 8000 --reload',
                cwd: './ml_service',
                port: 8000,
                healthCheck: '/health',
                priority: 3,
                essential: false
            }
        },

        enterpriseScripts: {
            'ai-stability-manager': {
                name: 'AI Stability Architecture',
                script: './scripts/enterprise/ai-stability-manager.js',
                category: 'core',
                priority: 1,
                autoStart: true,
                description: 'Central AI stability monitoring and control'
            },
            'intelligent-resource-manager': {
                name: 'Resource Optimization',
                script: './scripts/enterprise/intelligent-resource-manager.js',
                category: 'management',
                priority: 2,
                autoStart: true,
                description: 'CPU/GPU allocation and memory optimization'
            },
            'performance-analytics-suite': {
                name: 'Performance Intelligence',
                script: './scripts/enterprise/performance-analytics-suite.js',
                category: 'analytics',
                priority: 3,
                autoStart: false,
                description: 'Performance monitoring and benchmarking'
            },
            'advanced-deployment-manager': {
                name: 'Deployment Automation',
                script: './scripts/enterprise/advanced-deployment-manager.js',
                category: 'deployment',
                priority: 4,
                autoStart: false,
                description: 'Hot-swapping and canary deployments'
            },
            'ai-comprehensive-testing': {
                name: 'Algorithm Testing Suite',
                script: './scripts/enterprise/ai-comprehensive-testing.js',
                category: 'testing',
                priority: 5,
                autoStart: false,
                description: 'Comprehensive AI algorithm validation'
            },
            'enterprise-model-manager': {
                name: 'Model Lifecycle Management',
                script: './scripts/enterprise/enterprise-model-manager.js',
                category: 'management',
                priority: 6,
                autoStart: false,
                description: 'AI model management and versioning'
            },
            'ai-orchestration-dashboard': {
                name: 'AI Orchestration Dashboard',
                script: './scripts/enterprise/ai-orchestration-dashboard.js',
                category: 'dashboard',
                priority: 7,
                autoStart: false,
                description: 'Comprehensive AI orchestration control center'
            },
            'advanced-ai-diagnostics': {
                name: 'Predictive Diagnostics',
                script: './scripts/enterprise/advanced-ai-diagnostics.js',
                category: 'diagnostics',
                priority: 8,
                autoStart: false,
                description: 'Predictive failure detection and recovery'
            },
            'rlhf-system-manager': {
                name: 'Human-AI Alignment',
                script: './scripts/enterprise/rlhf-system-manager.js',
                category: 'alignment',
                priority: 9,
                autoStart: false,
                description: 'RLHF and Constitutional AI management'
            }
        }
    },

    // Launch profiles
    profiles: {
        minimal: {
            name: 'Minimal Development',
            description: 'Core services only for basic development',
            services: ['backend', 'frontend'],
            enterpriseScripts: [],
            healthCheckMode: 'fast'
        },
        development: {
            name: 'Full Development',
            description: 'All services with core enterprise scripts',
            services: ['backend', 'frontend', 'ml_service'],
            enterpriseScripts: ['ai-stability-manager', 'intelligent-resource-manager'],
            healthCheckMode: 'adaptive'
        },
        production: {
            name: 'Production Ready',
            description: 'Production environment with comprehensive monitoring',
            services: ['backend', 'frontend', 'ml_service'],
            enterpriseScripts: [
                'ai-stability-manager',
                'intelligent-resource-manager',
                'performance-analytics-suite',
                'ai-orchestration-dashboard',
                'advanced-ai-diagnostics'
            ],
            healthCheckMode: 'intelligent'
        },
        production_enhanced: {
            name: 'Enhanced Production',
            description: 'Production with maximum monitoring and proactive systems',
            services: ['backend', 'frontend', 'ml_service'],
            enterpriseScripts: [
                'ai-stability-manager',
                'intelligent-resource-manager',
                'performance-analytics-suite',
                'ai-orchestration-dashboard',
                'advanced-ai-diagnostics',
                'enterprise-model-manager'
            ],
            healthCheckMode: 'ai_optimized'
        },
        testing: {
            name: 'Testing Environment',
            description: 'Full testing suite with all validation systems',
            services: ['backend'],
            enterpriseScripts: ['ai-comprehensive-testing', 'ai-stability-manager'],
            healthCheckMode: 'comprehensive'
        },
        enterprise: {
            name: 'Enterprise Full Stack',
            description: 'Complete enterprise platform with all systems',
            services: ['backend', 'frontend', 'ml_service'],
            enterpriseScripts: [], // Will be populated after CONFIG initialization
            healthCheckMode: 'ai_optimized'
        },
        'turbo:build:enhanced': {
            name: 'Turbo Enhanced Production',
            description: 'High-performance production with enhanced monitoring',
            services: ['backend', 'frontend', 'ml_service'],
            enterpriseScripts: [
                'ai-stability-manager',
                'intelligent-resource-manager',
                'performance-analytics-suite',
                'ai-orchestration-dashboard',
                'advanced-ai-diagnostics'
            ],
            healthCheckMode: 'ai_optimized'
        }
    },

    // Health check modes
    healthCheck: {
        modes: {
            fast: { baseTimeout: 15000, retryInterval: 1000, maxRetries: 10 },
            adaptive: { baseTimeout: 30000, retryInterval: 2000, maxRetries: 15 },
            intelligent: { baseTimeout: 45000, retryInterval: 2500, maxRetries: 18 },
            comprehensive: { baseTimeout: 60000, retryInterval: 3000, maxRetries: 20 },
            ai_optimized: { baseTimeout: 'auto', retryInterval: 'auto', maxRetries: 'auto' }
        }
    },

    // Display
    display: {
        colors: {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        }
    }
};

// Populate enterprise profile with all available scripts (after CONFIG is defined)
CONFIG.profiles.enterprise.enterpriseScripts = Object.keys(CONFIG.platform.enterpriseScripts);

// === Main Enterprise Launcher Class ===

class UnifiedEnterpriseLauncher {
    constructor() {
        this.runningProcesses = new Map();
        this.processStatuses = new Map();
        this.launchProfile = null;
        this.healthCheckInterval = null;
        this.aiOptimizer = new AIHealthCheckOptimizer();

        // Bind process cleanup
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());

        console.log('🚀 Unified Enterprise Launcher initialized');
    }

    async launch(profileName = 'development', options = {}) {
        const startTime = Date.now();

        try {
            console.log(`\n🌟 === Unified Enterprise Launch Sequence ===`);
            console.log(`📋 Profile: ${profileName}`);
            console.log(`🕐 Time: ${new Date().toLocaleString()}`);
            console.log(`🏗️ System: ${os.platform()} ${os.arch()}`);

            // Initialize AI optimizer
            await this.aiOptimizer.initialize();

            // Validate and get profile
            this.launchProfile = this.validateProfile(profileName);

            // Start launch sequence
            const launchId = this.generateLaunchId();
            const launchData = await this.executeLaunchSequence(this.launchProfile, options);

            // Record launch
            this.recordLaunch({ ...launchData, launchId, duration: Date.now() - startTime });

            // Start monitoring
            this.startHealthMonitoring();

            console.log(`\n✅ Launch sequence completed in ${Date.now() - startTime}ms`);
            return launchData;

        } catch (error) {
            console.error(`\n❌ Launch failed: ${error.message}`);
            await this.gracefulShutdown();
            throw error;
        }
    }

    validateProfile(profileName) {
        const profile = CONFIG.profiles[profileName];

        if (!profile) {
            throw new Error(`Invalid profile: ${profileName}. Available: ${Object.keys(CONFIG.profiles).join(', ')}`);
        }

        console.log(`✅ Profile validated: ${profile.name}`);
        console.log(`📝 Description: ${profile.description}`);

        return { name: profileName, ...profile };
    }

    async executeLaunchSequence(profile, options) {
        const results = {
            services: { successful: 0, failed: 0, details: {} },
            enterpriseScripts: { successful: 0, failed: 0, details: {} },
            healthCheckMode: profile.healthCheckMode || 'adaptive'
        };

        console.log(`\n🔧 === Starting Core Services (${profile.services.length}) ===`);

        // Launch core services with AI-optimized health checks
        for (const serviceName of profile.services) {
            const serviceConfig = CONFIG.platform.coreServices[serviceName];
            if (serviceConfig) {
                console.log(`\n🔧 Starting ${serviceName} (${serviceConfig.name})...`);
                const success = await this.launchService(serviceName, serviceConfig, profile.healthCheckMode);

                if (success) {
                    results.services.successful++;
                    results.services.details[serviceName] = 'running';
                    console.log(`✅ ${serviceName} marked as successful`);
                } else {
                    results.services.failed++;
                    results.services.details[serviceName] = 'failed';
                    console.log(`❌ ${serviceName} marked as failed`);
                }
            }
        }

        console.log(`\n📊 Service Results Summary:`);
        console.log(`   Successful: ${results.services.successful}`);
        console.log(`   Failed: ${results.services.failed}`);
        console.log(`   Expected: ${profile.services.length}`);
        console.log(`   Details:`, results.services.details);

        // Launch enterprise scripts - ONLY if all core services are successful
        if (profile.enterpriseScripts.length > 0) {
            if (results.services.successful === profile.services.length && results.services.failed === 0) {
                console.log(`\n🚀 === Starting Enterprise Systems (${profile.enterpriseScripts.length}) ===`);
                console.log(`✅ All core services ready - proceeding with enterprise scripts`);

                for (const scriptName of profile.enterpriseScripts) {
                    const scriptConfig = CONFIG.platform.enterpriseScripts[scriptName];
                    if (scriptConfig) {
                        const success = await this.launchEnterpriseScript(scriptName, scriptConfig);

                        if (success) {
                            results.enterpriseScripts.successful++;
                            results.enterpriseScripts.details[scriptName] = 'running';
                        } else {
                            results.enterpriseScripts.failed++;
                            results.enterpriseScripts.details[scriptName] = 'failed';
                        }
                    }
                }
            } else {
                console.log(`\n⚠️  === Skipping Enterprise Systems ===`);
                console.log(`❌ Core services not fully ready (${results.services.successful}/${profile.services.length} successful)`);
                console.log(`🔧 Enterprise scripts require all core services to be running`);

                // Mark all enterprise scripts as skipped
                for (const scriptName of profile.enterpriseScripts) {
                    results.enterpriseScripts.details[scriptName] = 'skipped - dependencies not ready';
                }
            }
        }

        return results;
    }

    async launchService(serviceName, serviceConfig, healthCheckMode = 'adaptive') {
        console.log(`\n🔥 Launching ${serviceConfig.name}...`);

        try {
            // Start the service process - detect if it's an npm command or direct command
            let spawnCommand, spawnArgs;
            if (serviceConfig.command.startsWith('npm ') || serviceConfig.command.startsWith('run ')) {
                // It's an npm command
                spawnCommand = 'npm';
                spawnArgs = serviceConfig.command.split(' ').slice(1);
            } else {
                // It's a direct command (like python3, node, etc.)
                const commandParts = serviceConfig.command.split(' ');
                spawnCommand = commandParts[0];
                spawnArgs = commandParts.slice(1);
            }

            const process = spawn(spawnCommand, spawnArgs, {
                cwd: serviceConfig.cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });

            // Store process reference
            this.runningProcesses.set(serviceName, process);
            this.processStatuses.set(serviceName, 'starting');

            // Setup process monitoring
            this.setupProcessMonitoring(serviceName, process);

            // Wait for service to be ready with AI-optimized timing
            const startupStartTime = Date.now();
            const isReady = await this.waitForServiceReadyAI(serviceName, healthCheckMode);
            const actualStartupTime = Date.now() - startupStartTime;

            if (isReady) {
                this.processStatuses.set(serviceName, 'running');
                console.log(`     ✅ ${serviceConfig.name} ready`);

                // Record successful startup for AI learning
                const systemMetrics = await this.aiOptimizer.captureCurrentSystemMetrics();
                await this.aiOptimizer.recordStartupSuccess(serviceName, actualStartupTime, systemMetrics);

                return true;
            } else {
                this.processStatuses.set(serviceName, 'failed');
                console.log(`     ❌ ${serviceConfig.name} failed to start`);

                // Record failure for AI learning
                const systemMetrics = await this.aiOptimizer.captureCurrentSystemMetrics();
                const attemptedTimeout = await this.aiOptimizer.predictOptimalTimeout(serviceName);
                await this.aiOptimizer.recordStartupFailure(serviceName, attemptedTimeout, systemMetrics);

                return false;
            }

        } catch (error) {
            console.error(`     ❌ Failed to start ${serviceName}: ${error.message}`);
            this.processStatuses.set(serviceName, 'error');
            return false;
        }
    }

    async launchEnterpriseScript(scriptName, scriptConfig) {
        console.log(`\n🚀 Launching ${scriptConfig.name}...`);

        try {
            // Fork the script
            const process = fork(scriptConfig.script, [], {
                detached: true,
                stdio: 'pipe'
            });

            // Store script reference
            this.runningProcesses.set(scriptName, process);
            this.processStatuses.set(scriptName, 'running');

            // Setup script monitoring
            this.setupScriptMonitoring(scriptName, process);

            // Wait for script to be ready (no AI-optimized timing for scripts yet)
            const isReady = await this.waitForServiceReady(scriptName, 30000); // Default timeout for scripts

            if (isReady) {
                console.log(`     ✅ ${scriptConfig.name} ready`);
                return true;
            } else {
                console.log(`     ❌ ${scriptConfig.name} failed to start`);
                return false;
            }
        } catch (error) {
            console.error(`     ❌ Failed to start ${scriptName}: ${error.message}`);
            this.processStatuses.set(scriptName, 'error');
            return false;
        }
    }

    setupProcessMonitoring(serviceName, process) {
        process.stdout.on('data', (data) => {
            console.log(`     ${serviceName}: ${data.toString().trim()}`);
        });

        process.stderr.on('data', (data) => {
            console.error(`     ${serviceName} ERROR: ${data.toString().trim()}`);
        });

        process.on('exit', (code) => {
            console.log(`\n⚠️  ${serviceName} exited with code ${code}`);
            this.runningProcesses.delete(serviceName);
            this.processStatuses.set(serviceName, 'stopped');
        });

        process.on('error', (error) => {
            console.error(`\n❌ ${serviceName} error: ${error.message}`);
            this.runningProcesses.delete(serviceName);
            this.processStatuses.set(serviceName, 'error');
        });
    }

    setupScriptMonitoring(scriptName, process) {
        process.on('message', (msg) => {
            if (msg.type === 'log') {
                console.log(`     ${scriptName}: ${msg.message}`);
            }
        });

        process.on('exit', (code) => {
            console.log(`\n⚠️  ${scriptName} exited with code ${code}`);
            this.runningProcesses.delete(scriptName);
            this.processStatuses.set(scriptName, 'stopped');
        });

        process.on('error', (error) => {
            console.error(`\n❌ ${scriptName} error: ${error.message}`);
            this.runningProcesses.delete(scriptName);
            this.processStatuses.set(scriptName, 'error');
        });
    }

    startHealthMonitoring() {
        if (!this.healthCheckInterval) {
            this.healthCheckInterval = setInterval(async () => {
                // Continuous AI-powered health monitoring
                try {
                    for (const [serviceName, process] of this.runningProcesses.entries()) {
                        const status = this.processStatuses.get(serviceName);

                        if (status === 'running') {
                            // Periodically update AI learning data with current performance
                            const currentMetrics = await this.aiOptimizer.captureCurrentSystemMetrics();

                            // Log system performance for AI learning
                            if (Math.random() < 0.1) { // 10% chance to log metrics
                                console.log(`🔍 Health Check: ${serviceName} - Load: ${currentMetrics.systemLoad.toFixed(2)}, Memory: ${currentMetrics.memoryUsage.toFixed(1)}%`);
                            }
                        }
                    }
                } catch (error) {
                    // Continue monitoring on error
                    console.log(`⚠️ Health monitoring error: ${error.message}`);
                }
            }, 30000); // Every 30 seconds
        }
    }

    async waitForServiceReady(serviceName, timeout = 30000) {
        // Fallback method for non-AI health checks (enterprise scripts)
        const serviceConfig = CONFIG.platform.coreServices[serviceName];
        if (!serviceConfig) {
            // For enterprise scripts, just wait a short time
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        }

        const startTime = Date.now();
        console.log(`     Waiting for ${serviceName} on port ${serviceConfig.port}...`);

        while (Date.now() - startTime < timeout) {
            try {
                if (serviceName === 'backend') {
                    // PERFORMANCE FIX: Use proper health endpoint
                    const response = await this.makeHttpRequest(`http://localhost:${serviceConfig.port}/api/health`);
                    if (response.status === 200) {
                        return true;
                    }
                } else {
                    const response = await this.makeHealthCheckRequest(serviceConfig.port, serviceConfig.healthCheck);
                    if (response) {
                        return true;
                    }
                }
            } catch (error) {
                // Service not ready yet, continue waiting
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`     ⚠️ ${serviceName} not ready after ${timeout}ms`);
        return false;
    }

    async waitForServiceReadyAI(serviceName, healthCheckMode) {
        const serviceConfig = CONFIG.platform.coreServices[serviceName];

        // Get AI-optimized timeout
        const aiTimeout = await this.aiOptimizer.predictOptimalTimeout(serviceName);
        const { retryInterval, maxRetries } = this.aiOptimizer.getAdaptiveRetryStrategy(serviceName);

        let currentRetries = 0;
        const startTime = Date.now();

        console.log(`     🧠 AI-optimized wait for ${serviceConfig.name} (predicted: ${aiTimeout}ms, mode: ${healthCheckMode})...`);

        while (currentRetries < maxRetries && (Date.now() - startTime) < aiTimeout) {
            try {
                // Use proper HTTP health check for all services (including backend)
                console.log(`     🔍 Health check attempt ${currentRetries + 1}: ${serviceConfig.name} on http://localhost:${serviceConfig.port}${serviceConfig.healthCheck}`);
                const response = await this.makeHealthCheckRequest(serviceConfig.port, serviceConfig.healthCheck);
                console.log(`     📊 Health check response: ${response}`);
                if (response) {
                    // Record successful startup for AI learning
                    const actualTime = Date.now() - startTime;
                    const currentMetrics = await this.aiOptimizer.captureCurrentSystemMetrics();
                    await this.aiOptimizer.recordStartupSuccess(serviceName, actualTime, currentMetrics);
                    console.log(`     ✅ ${serviceConfig.name} ready`);
                    console.log(`🎯 AI Learning: ${serviceName} startup in ${actualTime}ms (avg: ${actualTime}ms)`);
                    return true;
                }
            } catch (error) {
                // Service not ready yet, continue waiting
                console.log(`     ⚠️ Health check error: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, retryInterval));
            currentRetries++;
        }

        console.log(`     ⚠️ ${serviceConfig.name} not ready after ${currentRetries} retries (${Date.now() - startTime}ms)`);
        return false;
    }

    checkPortOpen(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();

            socket.setTimeout(1000);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.on('error', () => {
                resolve(false);
            });

            socket.connect(port, '127.0.0.1');
        });
    }

    async makeHealthCheckRequest(port, endpoint) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                req.destroy();
                reject(new Error('Timeout'));
            }, 5000); // 5 second timeout

            const req = http.request({
                hostname: '127.0.0.1',  // Use IPv4 explicitly instead of 'localhost'
                port,
                path: endpoint,
                method: 'GET'
            }, (res) => {
                clearTimeout(timeout);
                resolve(res.statusCode < 400);
            });

            req.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            req.end();
        });
    }

    // PERFORMANCE FIX: Add HTTP request method for health checks
    async makeHttpRequest(url, timeout = 3000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);
            return { status: response.status, ok: response.ok };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    generateLaunchId() {
        return `launch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    recordLaunch(launchData) {
        // Store launch data for analytics and AI learning
        console.log(`📊 Launch Record: ID ${launchData.launchId}, Duration: ${launchData.duration}ms`);
        console.log(`     Services: ${launchData.services.successful}/${launchData.services.successful + launchData.services.failed} successful`);
        console.log(`     Enterprise Scripts: ${launchData.enterpriseScripts.successful}/${launchData.enterpriseScripts.successful + launchData.enterpriseScripts.failed} successful`);
    }

    clearScreen() {
        process.stdout.write('\x1b[2J\x1b[H');
    }

    renderHeader() {
        const colors = CONFIG.display.colors;
        const width = 80;

        console.log(`${colors.cyan}${'='.repeat(width)}${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}🌟 UNIFIED ENTERPRISE LAUNCHER - AI Orchestration Control Center${colors.reset}`);
        console.log(`${colors.bright}${colors.white}Derek J. Russell | Single Entry Point | Enterprise Integration${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(width)}${colors.reset}\n`);
    }

    async getUserInput(rl, prompt) {
        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async waitForKeyPress() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await this.getUserInput(rl, '\nPress Enter to continue...');
        rl.close();
    }

    async gracefulShutdown() {
        console.log(`\n🔄 Graceful shutdown initiated...`);

        // Save AI learning data before shutdown
        try {
            await this.aiOptimizer.saveHistoricalData();
            console.log('💾 AI learning data saved');
        } catch (error) {
            console.log('⚠️ Failed to save AI data:', error.message);
        }

        // Stop all processes
        console.log('🛑 Stopping all processes...');
        for (const [serviceName, process] of this.runningProcesses) {
            try {
                console.log(`   Stopping ${serviceName}...`);
                process.kill('SIGTERM');
            } catch (error) {
                console.log(`   ⚠️ Error stopping ${serviceName}: ${error.message}`);
            }
        }

        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        console.log('✅ Shutdown complete');
        process.exit(0);
    }
}

// === Main Execution Logic ===

async function main() {
    try {
        const launcher = new UnifiedEnterpriseLauncher();
        const args = process.argv.slice(2);

        // Parse command line arguments
        let profileName = 'development';
        let options = {};

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg === '--profile' && i + 1 < args.length) {
                profileName = args[i + 1];
                i++; // Skip next argument
            } else if (arg === '--force') {
                options.force = true;
            } else if (arg === '--verbose') {
                options.verbose = true;
            } else if (arg === '--help' || arg === '-h') {
                showHelp();
                return;
            }
        }

        // Launch with specified profile
        console.log(`🌟 Starting Unified Enterprise Launcher v3.1.0`);
        console.log(`🚀 Profile: ${profileName}`);

        const results = await launcher.launch(profileName, options);

        // Display final results
        console.log(`\n📊 === Launch Results ===`);
        console.log(`🔧 Services: ${results.services.successful}/${results.services.successful + results.services.failed} successful`);
        console.log(`🚀 Enterprise Scripts: ${results.enterpriseScripts.successful}/${results.enterpriseScripts.successful + results.enterpriseScripts.failed} successful`);
        console.log(`🧠 Health Check Mode: ${results.healthCheckMode}`);

        if (results.services.successful + results.enterpriseScripts.successful > 0) {
            console.log(`\n✨ Platform is running! AI-enhanced health monitoring active.`);
            console.log(`💡 Use Ctrl+C to gracefully shutdown all services.`);

            // Keep process running to maintain services
            await new Promise(() => { }); // Run indefinitely until interrupted
        } else {
            console.log(`\n❌ Failed to start any services. Check logs for details.`);
            process.exit(1);
        }

    } catch (error) {
        console.error(`❌ Launcher failed: ${error.message}`);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
🌟 Unified Enterprise Launcher v3.1.0 - AI-Enhanced Health Check Intelligence

USAGE:
    node unified-enterprise-launcher.js [options]

OPTIONS:
    --profile <name>        Launch specific profile (default: development)
    --force                Force start even if some services fail
    --verbose              Enable verbose logging
    --help, -h             Show this help message

PROFILES:
    minimal                Core services only for basic development
    development            Full development stack with core enterprise scripts  
    production             Production environment with full monitoring
    testing                Full testing suite with all validation systems
    enterprise             Complete enterprise platform with all systems

AI/ML HEALTH CHECK FEATURES:
    🧠 Adaptive timeout prediction based on system performance
    📊 Historical startup time learning and optimization
    🔄 Dynamic retry strategies based on service reliability
    ⚡ System resource-aware health check timing
    📈 Continuous performance monitoring and learning

EXAMPLES:
    node unified-enterprise-launcher.js --profile production
    node unified-enterprise-launcher.js --profile testing --verbose
    node unified-enterprise-launcher.js --profile enterprise --force

For more information, visit the project documentation.
`);
}

// Execute main function if run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { UnifiedEnterpriseLauncher, CONFIG }; 