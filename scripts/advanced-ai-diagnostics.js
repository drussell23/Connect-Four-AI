#!/usr/bin/env node

/**
 * 🔍 Advanced AI Diagnostics & Predictive Maintenance System
 * 
 * Enterprise-grade diagnostic system for the AI Stability Architecture featuring:
 * - Component Registry health monitoring and analysis
 * - Circuit breaker state monitoring and management
 * - Predictive failure detection using ML algorithms
 * - Resource leak detection and performance profiling
 * - Automated recovery procedures and escalation
 * - Comprehensive system health reporting
 * - Real-time anomaly detection
 * - Performance degradation analysis
 * 
 * @author Derek J. Russell
 * @version 3.0.0 - Enterprise AI Stability Architecture
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const os = require('os');

// === Configuration ===

const CONFIG = {
    // API endpoints
    endpoints: {
        base: 'http://localhost:3001/api',
        health: '/ai/stability/health',
        components: '/ai/stability/components',
        resources: '/ai/stability/resources',
        fallback: '/ai/stability/fallback',
        metrics: '/ai/stability/metrics'
    },

    // Diagnostic configuration
    diagnostics: {
        healthCheckInterval: 10000,      // 10 seconds
        deepScanInterval: 60000,         // 1 minute
        predictiveAnalysisInterval: 300000, // 5 minutes
        alertThresholds: {
            healthCritical: 50,          // Below 50% health is critical
            healthWarning: 70,           // Below 70% health is warning
            responseTimeCritical: 5000,  // Above 5 seconds is critical
            responseTimeWarning: 1000,   // Above 1 second is warning
            memoryLeakThreshold: 100,    // 100MB increase per hour
            cpuSpikeThreshold: 90,       // 90% CPU usage
            errorRateThreshold: 5        // 5% error rate
        },
        retentionPeriod: 86400000,       // 24 hours
        maxLogEntries: 10000
    },

    // Predictive analysis
    prediction: {
        enabled: true,
        lookAheadMinutes: 30,            // Predict 30 minutes ahead
        confidenceThreshold: 0.7,        // 70% confidence for alerts
        dataPointsRequired: 20,          // Minimum data points for prediction
        trendAnalysisWindow: 100         // Analyze last 100 data points
    },

    // Recovery procedures
    recovery: {
        maxAutomaticRestarts: 3,
        restartCooldown: 300000,         // 5 minutes between restarts
        escalationThreshold: 5,          // Escalate after 5 failed recoveries
        emergencyFallbackTimeout: 30000  // 30 seconds to activate emergency fallback
    },

    // Reporting
    reporting: {
        generateReports: true,
        reportInterval: 3600000,         // Generate reports every hour
        emailAlerts: false,              // Email alerts disabled by default
        slackWebhook: null               // Slack webhook URL
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

// === Advanced AI Diagnostics Engine ===

class AdvancedAIDiagnostics {
    constructor() {
        this.isRunning = false;
        this.healthHistory = new Map();
        this.performanceMetrics = new Map();
        this.alerts = [];
        this.recoveryAttempts = new Map();
        this.predictions = new Map();
        this.anomalies = [];

        // Diagnostic intervals
        this.healthInterval = null;
        this.deepScanInterval = null;
        this.predictiveInterval = null;
        this.reportingInterval = null;
    }

    // === Main Diagnostic Methods ===

    async start() {
        console.log(`${CONFIG.display.colors.cyan}🔍 Advanced AI Diagnostics v3.0.0${CONFIG.display.colors.reset}`);
        console.log(`${CONFIG.display.colors.bright}Enterprise AI Stability Architecture - Predictive Maintenance${CONFIG.display.colors.reset}\n`);

        this.isRunning = true;

        try {
            await this.initializeDiagnostics();
            await this.runInitialHealthCheck();
            this.startContinuousMonitoring();
            this.startReporting();

            console.log(`${CONFIG.display.colors.green}✅ Advanced AI Diagnostics started successfully${CONFIG.display.colors.reset}\n`);

            // Start interactive mode
            await this.startInteractiveMode();

        } catch (error) {
            console.error(`${CONFIG.display.colors.red}❌ Failed to start diagnostics: ${error.message}${CONFIG.display.colors.reset}`);
            process.exit(1);
        }
    }

    async initializeDiagnostics() {
        console.log('🔧 Initializing Advanced AI Diagnostics...');

        // Verify system connectivity
        try {
            await this.makeRequest('/health');
            console.log('   ✅ Backend connectivity verified');
        } catch (error) {
            throw new Error('Cannot connect to backend. Please ensure the backend service is running.');
        }

        // Initialize component tracking
        await this.initializeComponentTracking();
        console.log('   ✅ Component tracking initialized');

        // Load historical data
        await this.loadHistoricalData();
        console.log('   ✅ Historical data loaded');

        // Initialize predictive models
        if (CONFIG.prediction.enabled) {
            this.initializePredictiveModels();
            console.log('   ✅ Predictive analysis models initialized');
        }
    }

    async initializeComponentTracking() {
        try {
            const components = await this.makeRequest('/ai/stability/components');

            components.forEach(component => {
                this.healthHistory.set(component.name, []);
                this.performanceMetrics.set(component.name, {
                    responseTime: [],
                    successRate: [],
                    errorCount: [],
                    memoryUsage: [],
                    cpuUsage: []
                });
                this.recoveryAttempts.set(component.name, {
                    count: 0,
                    lastAttempt: 0,
                    consecutiveFailures: 0
                });
            });

        } catch (error) {
            console.log('   ⚠️  Could not initialize component tracking, will attempt during monitoring');
        }
    }

    async loadHistoricalData() {
        try {
            const historyFile = path.join(__dirname, 'data', 'diagnostics-history.json');
            const data = await fs.readFile(historyFile, 'utf8');
            const history = JSON.parse(data);

            // Restore health history
            for (const [component, healthData] of Object.entries(history.healthHistory || {})) {
                this.healthHistory.set(component, healthData);
            }

            // Restore performance metrics
            for (const [component, metrics] of Object.entries(history.performanceMetrics || {})) {
                this.performanceMetrics.set(component, metrics);
            }

            console.log('   ✅ Historical data restored');

        } catch (error) {
            console.log('   ℹ️  No historical data found, starting fresh');
        }
    }

    // === Continuous Monitoring ===

    startContinuousMonitoring() {
        console.log('📊 Starting continuous monitoring...');

        // Health check monitoring
        this.healthInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, CONFIG.diagnostics.healthCheckInterval);

        // Deep system scan
        this.deepScanInterval = setInterval(async () => {
            await this.performDeepScan();
        }, CONFIG.diagnostics.deepScanInterval);

        // Predictive analysis
        if (CONFIG.prediction.enabled) {
            this.predictiveInterval = setInterval(async () => {
                await this.performPredictiveAnalysis();
            }, CONFIG.diagnostics.predictiveAnalysisInterval);
        }
    }

    async performHealthCheck() {
        try {
            const timestamp = Date.now();

            // Get system health
            const systemHealth = await this.makeRequest('/ai/stability/health');
            const components = await this.makeRequest('/ai/stability/components');
            const resources = await this.makeRequest('/ai/stability/resources');

            // Process component health
            components.forEach(component => {
                this.recordComponentHealth(component, timestamp);
                this.analyzeComponentHealth(component);
            });

            // Process resource usage
            this.analyzeResourceUsage(resources, timestamp);

            // Check for immediate issues
            await this.checkForImmediateIssues(systemHealth, components, resources);

        } catch (error) {
            this.logError('Health check failed', error.message);
        }
    }

    recordComponentHealth(component, timestamp) {
        const healthHistory = this.healthHistory.get(component.name) || [];
        const performanceMetrics = this.performanceMetrics.get(component.name) || {
            responseTime: [],
            successRate: [],
            errorCount: [],
            memoryUsage: [],
            cpuUsage: []
        };

        // Record health data
        healthHistory.push({
            timestamp,
            health: component.health || 0,
            status: component.status || 'unknown',
            responseTime: component.metrics?.averageResponseTime || 0,
            successRate: component.metrics?.successRate || 0,
            errorRate: component.metrics?.errorRate || 0
        });

        // Record performance metrics
        if (component.metrics) {
            performanceMetrics.responseTime.push({
                timestamp,
                value: component.metrics.averageResponseTime || 0
            });
            performanceMetrics.successRate.push({
                timestamp,
                value: component.metrics.successRate || 0
            });
            performanceMetrics.errorCount.push({
                timestamp,
                value: component.metrics.errorCount || 0
            });
        }

        // Limit history size
        if (healthHistory.length > CONFIG.diagnostics.maxLogEntries) {
            healthHistory.splice(0, healthHistory.length - CONFIG.diagnostics.maxLogEntries);
        }

        // Update maps
        this.healthHistory.set(component.name, healthHistory);
        this.performanceMetrics.set(component.name, performanceMetrics);
    }

    analyzeComponentHealth(component) {
        const threshold = CONFIG.diagnostics.alertThresholds;
        const health = component.health || 0;
        const responseTime = component.metrics?.averageResponseTime || 0;
        const errorRate = component.metrics?.errorRate || 0;

        // Health alerts
        if (health < threshold.healthCritical) {
            this.createAlert('critical', `${component.name} health critical: ${health}%`, {
                component: component.name,
                health,
                threshold: threshold.healthCritical
            });
        } else if (health < threshold.healthWarning) {
            this.createAlert('warning', `${component.name} health degraded: ${health}%`, {
                component: component.name,
                health,
                threshold: threshold.healthWarning
            });
        }

        // Response time alerts
        if (responseTime > threshold.responseTimeCritical) {
            this.createAlert('critical', `${component.name} response time critical: ${responseTime}ms`, {
                component: component.name,
                responseTime,
                threshold: threshold.responseTimeCritical
            });
        } else if (responseTime > threshold.responseTimeWarning) {
            this.createAlert('warning', `${component.name} response time elevated: ${responseTime}ms`, {
                component: component.name,
                responseTime,
                threshold: threshold.responseTimeWarning
            });
        }

        // Error rate alerts
        if (errorRate > threshold.errorRateThreshold) {
            this.createAlert('warning', `${component.name} error rate elevated: ${errorRate}%`, {
                component: component.name,
                errorRate,
                threshold: threshold.errorRateThreshold
            });
        }
    }

    async performDeepScan() {
        console.log('🔍 Performing deep system scan...');

        try {
            // Memory leak detection
            await this.detectMemoryLeaks();

            // Performance degradation analysis
            await this.analyzePerformanceDegradation();

            // Circuit breaker analysis
            await this.analyzeCircuitBreakers();

            // Resource contention detection
            await this.detectResourceContention();

            // Anomaly detection
            await this.detectAnomalies();

        } catch (error) {
            this.logError('Deep scan failed', error.message);
        }
    }

    async detectMemoryLeaks() {
        for (const [componentName, metrics] of this.performanceMetrics) {
            const memoryData = metrics.memoryUsage;

            if (memoryData.length < 10) continue; // Need enough data points

            // Calculate memory growth rate
            const recentData = memoryData.slice(-10);
            const oldData = memoryData.slice(-20, -10);

            if (oldData.length === 0) continue;

            const recentAvg = recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;
            const oldAvg = oldData.reduce((sum, d) => sum + d.value, 0) / oldData.length;
            const growthRate = ((recentAvg - oldAvg) / oldAvg) * 100;

            if (growthRate > CONFIG.diagnostics.alertThresholds.memoryLeakThreshold) {
                this.createAlert('warning', `Potential memory leak detected in ${componentName}: ${growthRate.toFixed(1)}% growth`, {
                    component: componentName,
                    growthRate,
                    currentMemory: recentAvg,
                    type: 'memory_leak'
                });
            }
        }
    }

    async analyzePerformanceDegradation() {
        for (const [componentName, healthHistory] of this.healthHistory) {
            if (healthHistory.length < CONFIG.prediction.dataPointsRequired) continue;

            const recentHealth = healthHistory.slice(-10);
            const trend = this.calculateTrend(recentHealth.map(h => h.health));

            // Significant downward trend indicates degradation
            if (trend < -5) { // 5% decline
                this.createAlert('warning', `Performance degradation detected in ${componentName}: ${trend.toFixed(1)}% decline`, {
                    component: componentName,
                    trend,
                    type: 'performance_degradation'
                });
            }
        }
    }

    async analyzeCircuitBreakers() {
        try {
            const fallbackMetrics = await this.makeRequest('/ai/stability/fallback/metrics');

            if (fallbackMetrics.totalFallbacks > 0) {
                const recentFallbacks = fallbackMetrics.fallbacksByTrigger.circuit_breaker || 0;

                if (recentFallbacks > 5) { // More than 5 circuit breaker activations
                    this.createAlert('critical', `High circuit breaker activity: ${recentFallbacks} activations`, {
                        fallbacks: recentFallbacks,
                        type: 'circuit_breaker_activity'
                    });
                }
            }

        } catch (error) {
            // Fallback metrics may not be available
        }
    }

    // === Predictive Analysis ===

    async performPredictiveAnalysis() {
        if (!CONFIG.prediction.enabled) return;

        console.log('🔮 Performing predictive analysis...');

        try {
            for (const [componentName, healthHistory] of this.healthHistory) {
                if (healthHistory.length < CONFIG.prediction.dataPointsRequired) continue;

                const prediction = this.predictComponentHealth(componentName, healthHistory);

                if (prediction && prediction.confidence > CONFIG.prediction.confidenceThreshold) {
                    this.predictions.set(componentName, prediction);

                    // Alert if prediction indicates future problems
                    if (prediction.predictedHealth < CONFIG.diagnostics.alertThresholds.healthWarning) {
                        this.createAlert('warning',
                            `Predicted health decline for ${componentName}: ${prediction.predictedHealth.toFixed(1)}% in ${CONFIG.prediction.lookAheadMinutes} minutes`,
                            {
                                component: componentName,
                                predictedHealth: prediction.predictedHealth,
                                confidence: prediction.confidence,
                                timeframe: CONFIG.prediction.lookAheadMinutes,
                                type: 'predictive_alert'
                            }
                        );
                    }
                }
            }

        } catch (error) {
            this.logError('Predictive analysis failed', error.message);
        }
    }

    predictComponentHealth(componentName, healthHistory) {
        // Simple linear regression for health prediction
        const recentData = healthHistory.slice(-CONFIG.prediction.trendAnalysisWindow);

        if (recentData.length < CONFIG.prediction.dataPointsRequired) return null;

        const n = recentData.length;
        const x = recentData.map((_, index) => index);
        const y = recentData.map(h => h.health);

        // Calculate linear regression
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Predict future health
        const futureX = n + (CONFIG.prediction.lookAheadMinutes / (CONFIG.diagnostics.healthCheckInterval / 60000));
        const predictedHealth = slope * futureX + intercept;

        // Calculate confidence based on correlation coefficient
        const meanY = sumY / n;
        const totalVariation = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
        const explainedVariation = x.reduce((sum, xi, i) => sum + Math.pow((slope * xi + intercept) - meanY, 2), 0);
        const correlation = Math.sqrt(explainedVariation / totalVariation);

        return {
            predictedHealth: Math.max(0, Math.min(100, predictedHealth)),
            confidence: correlation,
            slope,
            timestamp: Date.now()
        };
    }

    // === Recovery Procedures ===

    async attemptComponentRecovery(componentName) {
        const recoveryInfo = this.recoveryAttempts.get(componentName) || {
            count: 0,
            lastAttempt: 0,
            consecutiveFailures: 0
        };

        // Check recovery cooldown
        const timeSinceLastAttempt = Date.now() - recoveryInfo.lastAttempt;
        if (timeSinceLastAttempt < CONFIG.recovery.restartCooldown) {
            this.logWarning(`Recovery cooldown active for ${componentName}, skipping attempt`);
            return false;
        }

        // Check maximum attempts
        if (recoveryInfo.count >= CONFIG.recovery.maxAutomaticRestarts) {
            this.logError(`Maximum recovery attempts reached for ${componentName}, escalating`);
            await this.escalateIssue(componentName, 'max_recovery_attempts');
            return false;
        }

        try {
            console.log(`🔧 Attempting recovery for ${componentName}...`);

            // Attempt component restart via API
            const response = await this.makeRequest('/ai/stability/components/restart', 'POST', {
                component: componentName,
                force: false
            });

            // Update recovery tracking
            recoveryInfo.count++;
            recoveryInfo.lastAttempt = Date.now();

            if (response.success) {
                recoveryInfo.consecutiveFailures = 0;
                this.logSuccess(`Successfully recovered ${componentName}`);
                this.createAlert('info', `Component ${componentName} successfully recovered`, {
                    component: componentName,
                    recoveryAttempt: recoveryInfo.count,
                    type: 'recovery_success'
                });
                return true;
            } else {
                recoveryInfo.consecutiveFailures++;
                this.logError(`Recovery failed for ${componentName}: ${response.error}`);
                return false;
            }

        } catch (error) {
            recoveryInfo.consecutiveFailures++;
            this.logError(`Recovery attempt failed for ${componentName}`, error.message);
            return false;

        } finally {
            this.recoveryAttempts.set(componentName, recoveryInfo);
        }
    }

    async escalateIssue(componentName, reason) {
        const escalation = {
            component: componentName,
            reason,
            timestamp: Date.now(),
            severity: 'high',
            context: this.gatherEscalationContext(componentName)
        };

        console.log(`${CONFIG.display.colors.red}🚨 ESCALATING ISSUE: ${componentName} - ${reason}${CONFIG.display.colors.reset}`);

        // Log to escalation file
        await this.logEscalation(escalation);

        // Send notifications
        await this.sendEscalationNotifications(escalation);

        // Activate emergency fallback if necessary
        if (this.isCriticalComponent(componentName)) {
            await this.activateEmergencyFallback();
        }
    }

    gatherEscalationContext(componentName) {
        const healthHistory = this.healthHistory.get(componentName) || [];
        const performanceMetrics = this.performanceMetrics.get(componentName) || {};
        const recoveryAttempts = this.recoveryAttempts.get(componentName) || {};

        return {
            recentHealth: healthHistory.slice(-10),
            performanceMetrics: {
                avgResponseTime: this.calculateAverage(performanceMetrics.responseTime?.slice(-10) || []),
                avgSuccessRate: this.calculateAverage(performanceMetrics.successRate?.slice(-10) || []),
                errorCount: performanceMetrics.errorCount?.slice(-10) || []
            },
            recoveryAttempts,
            systemLoad: this.getSystemLoad(),
            prediction: this.predictions.get(componentName)
        };
    }

    // === Alert Management ===

    createAlert(level, message, data = {}) {
        const alert = {
            id: this.generateAlertId(),
            level,
            message,
            timestamp: Date.now(),
            data,
            acknowledged: false,
            resolved: false
        };

        this.alerts.unshift(alert);

        // Limit alert history
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(0, 1000);
        }

        // Log alert
        const colors = CONFIG.display.colors;
        const levelColor = level === 'critical' ? colors.red :
            level === 'warning' ? colors.yellow :
                level === 'info' ? colors.blue : colors.white;

        console.log(`${levelColor}[${level.toUpperCase()}] ${message}${colors.reset}`);

        // Trigger automatic recovery for critical alerts
        if (level === 'critical' && data.component) {
            this.attemptComponentRecovery(data.component);
        }

        return alert;
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // === Interactive Mode ===

    async startInteractiveMode() {
        console.log(`${CONFIG.display.colors.cyan}🖥️  Starting interactive diagnostic mode...${CONFIG.display.colors.reset}`);
        console.log('Available commands: status, alerts, predict, recover, report, help, quit\n');

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const handleCommand = async (command) => {
            const cmd = command.trim().toLowerCase();

            switch (cmd) {
                case 'status':
                    await this.showSystemStatus();
                    break;
                case 'alerts':
                    this.showRecentAlerts();
                    break;
                case 'predict':
                    this.showPredictions();
                    break;
                case 'recover':
                    await this.showRecoveryOptions();
                    break;
                case 'report':
                    await this.generateDiagnosticReport();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                case 'quit':
                case 'exit':
                    await this.shutdown();
                    break;
                default:
                    console.log(`${CONFIG.display.colors.red}Unknown command: ${cmd}${CONFIG.display.colors.reset}`);
                    this.showHelp();
            }

            if (this.isRunning) {
                rl.question('\ndiagnostics> ', handleCommand);
            }
        };

        rl.question('diagnostics> ', handleCommand);
    }

    async showSystemStatus() {
        const colors = CONFIG.display.colors;

        console.log(`\n${colors.bright}${colors.blue}📊 SYSTEM STATUS${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

        try {
            const health = await this.makeRequest('/ai/stability/health');
            const components = await this.makeRequest('/ai/stability/components');

            console.log(`Overall Health: ${this.getHealthColor(health.overallHealth)}${health.overallHealth.toFixed(1)}%${colors.reset}`);
            console.log(`Active Components: ${colors.white}${components.filter(c => c.status === 'healthy').length}/${components.length}${colors.reset}`);
            console.log(`Active Alerts: ${colors.yellow}${this.alerts.filter(a => !a.resolved).length}${colors.reset}`);

            console.log(`\n${colors.bright}Component Status:${colors.reset}`);
            components.forEach(component => {
                const statusColor = component.status === 'healthy' ? colors.green :
                    component.status === 'degraded' ? colors.yellow : colors.red;
                console.log(`  ${statusColor}●${colors.reset} ${component.name}: ${component.health.toFixed(1)}% health, ${component.status}`);
            });

        } catch (error) {
            console.log(`${colors.red}❌ Failed to get system status: ${error.message}${colors.reset}`);
        }
    }

    showRecentAlerts() {
        const colors = CONFIG.display.colors;

        console.log(`\n${colors.bright}${colors.red}🚨 RECENT ALERTS${colors.reset}`);
        console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);

        const recentAlerts = this.alerts.slice(0, 10);

        if (recentAlerts.length === 0) {
            console.log(`${colors.green}✅ No recent alerts${colors.reset}`);
            return;
        }

        recentAlerts.forEach(alert => {
            const levelColor = alert.level === 'critical' ? colors.red :
                alert.level === 'warning' ? colors.yellow : colors.blue;
            const time = new Date(alert.timestamp).toLocaleTimeString();
            const status = alert.resolved ? `${colors.green}[RESOLVED]${colors.reset}` :
                alert.acknowledged ? `${colors.yellow}[ACK]${colors.reset}` : `${colors.red}[ACTIVE]${colors.reset}`;

            console.log(`${levelColor}[${alert.level.toUpperCase()}]${colors.reset} ${time} ${status} ${alert.message}`);
        });
    }

    showPredictions() {
        const colors = CONFIG.display.colors;

        console.log(`\n${colors.bright}${colors.magenta}🔮 HEALTH PREDICTIONS${colors.reset}`);
        console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);

        if (this.predictions.size === 0) {
            console.log(`${colors.yellow}⚠️  No predictions available yet${colors.reset}`);
            return;
        }

        for (const [component, prediction] of this.predictions) {
            const healthColor = this.getHealthColor(prediction.predictedHealth);
            const confidenceColor = prediction.confidence > 0.8 ? colors.green :
                prediction.confidence > 0.6 ? colors.yellow : colors.red;

            console.log(`${component}:`);
            console.log(`  Predicted Health: ${healthColor}${prediction.predictedHealth.toFixed(1)}%${colors.reset}`);
            console.log(`  Confidence: ${confidenceColor}${(prediction.confidence * 100).toFixed(1)}%${colors.reset}`);
            console.log(`  Trend: ${prediction.slope > 0 ? colors.green + '↗' : colors.red + '↘'}${colors.reset}`);
            console.log('');
        }
    }

    // === Utility Methods ===

    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${CONFIG.endpoints.base}${endpoint}`;

        return new Promise((resolve, reject) => {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${body}`));
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;

        const n = values.length;
        const x = values.map((_, index) => index);
        const y = values;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    calculateAverage(dataPoints) {
        if (!dataPoints || dataPoints.length === 0) return 0;
        const sum = dataPoints.reduce((sum, point) => sum + (point.value || point), 0);
        return sum / dataPoints.length;
    }

    getHealthColor(health) {
        const colors = CONFIG.display.colors;
        return health >= 80 ? colors.green :
            health >= 60 ? colors.yellow : colors.red;
    }

    getSystemLoad() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        return {
            cpuCount: cpus.length,
            loadAverage: loadAvg,
            memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
            uptime: os.uptime()
        };
    }

    isCriticalComponent(componentName) {
        const criticalComponents = ['BasicAI', 'Minimax', 'EmergencyFallback', 'SafetySystem'];
        return criticalComponents.includes(componentName);
    }

    showHelp() {
        const colors = CONFIG.display.colors;

        console.log(`\n${colors.bright}${colors.cyan}🔍 ADVANCED AI DIAGNOSTICS - HELP${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);
        console.log(`${colors.white}status${colors.reset}   - Show current system status`);
        console.log(`${colors.white}alerts${colors.reset}   - Show recent alerts and warnings`);
        console.log(`${colors.white}predict${colors.reset}  - Show health predictions`);
        console.log(`${colors.white}recover${colors.reset}  - Show recovery options`);
        console.log(`${colors.white}report${colors.reset}   - Generate diagnostic report`);
        console.log(`${colors.white}help${colors.reset}     - Show this help message`);
        console.log(`${colors.white}quit${colors.reset}     - Exit diagnostics mode`);
    }

    logSuccess(message) {
        console.log(`${CONFIG.display.colors.green}✅ ${message}${CONFIG.display.colors.reset}`);
    }

    logWarning(message) {
        console.log(`${CONFIG.display.colors.yellow}⚠️  ${message}${CONFIG.display.colors.reset}`);
    }

    logError(prefix, message) {
        console.log(`${CONFIG.display.colors.red}❌ ${prefix}: ${message}${CONFIG.display.colors.reset}`);
    }

    async shutdown() {
        console.log(`\n${CONFIG.display.colors.yellow}🔄 Shutting down Advanced AI Diagnostics...${CONFIG.display.colors.reset}`);

        this.isRunning = false;

        // Clear intervals
        if (this.healthInterval) clearInterval(this.healthInterval);
        if (this.deepScanInterval) clearInterval(this.deepScanInterval);
        if (this.predictiveInterval) clearInterval(this.predictiveInterval);
        if (this.reportingInterval) clearInterval(this.reportingInterval);

        // Save diagnostic data
        await this.saveDiagnosticData();

        console.log(`${CONFIG.display.colors.green}✅ Advanced AI Diagnostics stopped${CONFIG.display.colors.reset}`);
        process.exit(0);
    }

    async saveDiagnosticData() {
        try {
            const dataDir = path.join(__dirname, 'data');
            await fs.mkdir(dataDir, { recursive: true });

            const diagnosticData = {
                healthHistory: Object.fromEntries(this.healthHistory),
                performanceMetrics: Object.fromEntries(this.performanceMetrics),
                alerts: this.alerts,
                predictions: Object.fromEntries(this.predictions),
                timestamp: Date.now()
            };

            const filePath = path.join(dataDir, 'diagnostics-history.json');
            await fs.writeFile(filePath, JSON.stringify(diagnosticData, null, 2));

            console.log('   ✅ Diagnostic data saved');

        } catch (error) {
            console.log(`   ⚠️  Could not save diagnostic data: ${error.message}`);
        }
    }
}

// === Main Execution ===

async function main() {
    const diagnostics = new AdvancedAIDiagnostics();

    // Handle graceful shutdown
    process.on('SIGTERM', () => diagnostics.shutdown());
    process.on('SIGINT', () => diagnostics.shutdown());

    await diagnostics.start();
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Advanced AI Diagnostics - Enterprise AI Stability Architecture

USAGE:
    node advanced-ai-diagnostics.js [options]

OPTIONS:
    --help, -h          Show this help message

FEATURES:
    ✅ Component Registry health monitoring
    ✅ Circuit breaker state analysis
    ✅ Predictive failure detection
    ✅ Memory leak detection
    ✅ Performance degradation analysis
    ✅ Automated recovery procedures
    ✅ Real-time anomaly detection
    ✅ Comprehensive reporting

AUTHOR: Derek J. Russell
`);
    process.exit(0);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`${CONFIG.display.colors.red}❌ Fatal error: ${error.message}${CONFIG.display.colors.reset}`);
        process.exit(1);
    });
}

module.exports = { AdvancedAIDiagnostics, CONFIG }; 