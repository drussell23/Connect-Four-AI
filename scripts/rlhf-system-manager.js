#!/usr/bin/env node

/**
 * 🧠 RLHF System Manager - Human-AI Alignment Management Platform
 * 
 * Comprehensive management system for Reinforcement Learning from Human Feedback:
 * - Reward model training and validation
 * - Multi-modal feedback collection and analysis
 * - Constitutional AI principle management
 * - Human preference learning and optimization
 * - Safety monitoring and violation detection
 * - Explainability engine management
 * - Real-time alignment monitoring
 * - Performance benchmarking and A/B testing
 * 
 * @author Derek J. Russell
 * @version 2.0.0 - Enterprise RLHF Management Platform
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const readline = require('readline');

// === Configuration ===

const CONFIG = {
    // API endpoints
    endpoints: {
        base: 'http://localhost:3001/api',
        rlhf: '/ai/rlhf',
        feedback: '/ai/rlhf/feedback',
        training: '/ai/rlhf/train',
        stats: '/ai/rlhf/stats',
        predict: '/ai/rlhf/predict',
        constitutional: '/ai/rlhf/constitutional',
        safety: '/ai/safety',
        explainability: '/ai/explainability'
    },

    // Training configuration
    training: {
        batchSize: 32,
        learningRate: 0.0001,
        epochs: 100,
        validationSplit: 0.2,
        patienceEpochs: 10,
        minFeedbackSamples: 100,
        rewardModelUpdateInterval: 1000, // Update every 1000 feedback samples
        constitutionalUpdateInterval: 500 // Update constitutional principles every 500 samples
    },

    // Feedback collection
    feedback: {
        collectInterval: 60000,          // Collect feedback every minute
        batchSize: 50,                   // Process feedback in batches of 50
        qualityThreshold: 0.7,           // Minimum feedback quality score
        diversityTargets: {
            gamePhases: ['opening', 'midgame', 'endgame'],
            difficulties: [1, 3, 5, 8, 10],
            playerTypes: ['beginner', 'intermediate', 'expert']
        }
    },

    // Constitutional AI
    constitutional: {
        principles: [
            'Make moves that create enjoyable gameplay',
            'Avoid moves that frustrate players',
            'Provide educational value when possible',
            'Respect player skill level and adapt accordingly',
            'Maintain competitive integrity',
            'Avoid exploiting obvious player mistakes unless educational',
            'Encourage creative and interesting play patterns'
        ],
        updateThreshold: 0.8,            // Update principles when confidence > 80%
        violationThreshold: 0.3,         // Alert when violation probability > 30%
        reviewInterval: 86400000         // Review principles daily
    },

    // Safety monitoring
    safety: {
        enabled: true,
        alertThresholds: {
            alignmentScore: 0.7,         // Alert if alignment score < 70%
            violationRate: 0.05,         // Alert if violation rate > 5%
            feedbackQuality: 0.6,        // Alert if feedback quality < 60%
            rewardModelAccuracy: 0.8     // Alert if model accuracy < 80%
        },
        monitoringInterval: 30000        // Monitor every 30 seconds
    },

    // Performance tracking
    performance: {
        metricsInterval: 60000,          // Update metrics every minute
        benchmarkInterval: 3600000,      // Run benchmarks every hour
        a_b_testDuration: 86400000,      // A/B tests run for 24 hours
        retentionPeriod: 604800000       // Keep metrics for 7 days
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

// === RLHF System Manager ===

class RLHFSystemManager {
    constructor() {
        this.isRunning = false;
        this.feedbackBuffer = [];
        this.rewardModelMetrics = {};
        this.constitutionalViolations = [];
        this.alignmentMetrics = {};
        this.activeExperiments = new Map();

        // Monitoring intervals
        this.feedbackInterval = null;
        this.safetyInterval = null;
        this.metricsInterval = null;
        this.benchmarkInterval = null;
    }

    // === Main Management Methods ===

    async start() {
        console.log(`${CONFIG.display.colors.cyan}🧠 RLHF System Manager v2.0.0${CONFIG.display.colors.reset}`);
        console.log(`${CONFIG.display.colors.bright}Enterprise Human-AI Alignment Management Platform${CONFIG.display.colors.reset}\n`);

        this.isRunning = true;

        try {
            await this.initializeRLHFSystem();
            await this.loadSystemState();
            this.startMonitoring();
            await this.showMainMenu();

        } catch (error) {
            console.error(`${CONFIG.display.colors.red}❌ Failed to start RLHF System Manager: ${error.message}${CONFIG.display.colors.reset}`);
            process.exit(1);
        }
    }

    async initializeRLHFSystem() {
        console.log('🔧 Initializing RLHF System...');

        // Verify backend connection
        try {
            await this.makeRequest('/health');
            console.log('   ✅ Backend connection verified');
        } catch (error) {
            throw new Error('Backend not accessible. Please start the backend service first.');
        }

        // Check RLHF system status
        try {
            const stats = await this.makeRequest('/ai/rlhf/stats');
            console.log(`   ✅ RLHF system online (${stats.totalFeedback || 0} feedback samples)`);
        } catch (error) {
            console.log('   ⚠️  RLHF system not fully initialized, will attempt initialization...');
            await this.initializeRLHFComponents();
        }

        // Load constitutional principles
        await this.loadConstitutionalPrinciples();
        console.log('   ✅ Constitutional AI principles loaded');

        // Initialize safety monitoring
        if (CONFIG.safety.enabled) {
            await this.initializeSafetyMonitoring();
            console.log('   ✅ Safety monitoring initialized');
        }
    }

    async initializeRLHFComponents() {
        console.log('🚀 Initializing RLHF components...');

        try {
            // Initialize reward model
            await this.makeRequest('/ai/rlhf/init', 'POST', {
                modelType: 'reward_model',
                config: {
                    architecture: 'transformer',
                    hiddenSize: 512,
                    numLayers: 6,
                    numHeads: 8
                }
            });

            // Initialize constitutional AI
            await this.makeRequest('/ai/rlhf/constitutional/init', 'POST', {
                principles: CONFIG.constitutional.principles
            });

            console.log('   ✅ RLHF components initialized');

        } catch (error) {
            console.log(`   ⚠️  Could not initialize RLHF components: ${error.message}`);
        }
    }

    async loadConstitutionalPrinciples() {
        try {
            const principles = await this.makeRequest('/ai/rlhf/constitutional/principles');
            this.constitutionalPrinciples = principles.principles || CONFIG.constitutional.principles;
        } catch (error) {
            this.constitutionalPrinciples = CONFIG.constitutional.principles;
        }
    }

    // === Menu System ===

    async showMainMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        while (this.isRunning) {
            this.clearScreen();
            this.renderHeader();

            console.log(`${CONFIG.display.colors.bright}${CONFIG.display.colors.blue}🧠 RLHF SYSTEM MENU${CONFIG.display.colors.reset}`);
            console.log(`${CONFIG.display.colors.blue}${'─'.repeat(60)}${CONFIG.display.colors.reset}`);
            console.log('1. 📊 System Status & Metrics');
            console.log('2. 💬 Feedback Management');
            console.log('3. 🎯 Reward Model Training');
            console.log('4. ⚖️  Constitutional AI Management');
            console.log('5. 🛡️  Safety Monitoring');
            console.log('6. 📈 Performance Analytics');
            console.log('7. 🧪 A/B Testing & Experiments');
            console.log('8. 🔍 Explainability Analysis');
            console.log('9. ⚙️  System Configuration');
            console.log('0. ❌ Exit');
            console.log('');

            const choice = await this.getUserInput(rl, 'Select an option: ');
            await this.handleMenuChoice(choice);
        }

        rl.close();
    }

    async handleMenuChoice(choice) {
        switch (choice) {
            case '1':
                await this.showSystemStatus();
                break;
            case '2':
                await this.showFeedbackManagement();
                break;
            case '3':
                await this.showRewardModelTraining();
                break;
            case '4':
                await this.showConstitutionalAI();
                break;
            case '5':
                await this.showSafetyMonitoring();
                break;
            case '6':
                await this.showPerformanceAnalytics();
                break;
            case '7':
                await this.showExperiments();
                break;
            case '8':
                await this.showExplainabilityAnalysis();
                break;
            case '9':
                await this.showSystemConfiguration();
                break;
            case '0':
                await this.shutdown();
                break;
            default:
                console.log(`${CONFIG.display.colors.red}Invalid option. Please try again.${CONFIG.display.colors.reset}`);
                await this.waitForKeyPress();
        }
    }

    // === System Status ===

    async showSystemStatus() {
        this.clearScreen();
        this.renderHeader();

        console.log(`${CONFIG.display.colors.bright}${CONFIG.display.colors.green}📊 RLHF SYSTEM STATUS${CONFIG.display.colors.reset}`);
        console.log(`${CONFIG.display.colors.green}${'='.repeat(70)}${CONFIG.display.colors.reset}\n`);

        try {
            const stats = await this.makeRequest('/ai/rlhf/stats');
            const safety = await this.makeRequest('/ai/safety/status');

            // System Overview
            await this.renderSystemOverview(stats, safety);
            console.log('');

            // Reward Model Status
            await this.renderRewardModelStatus(stats);
            console.log('');

            // Constitutional AI Status
            await this.renderConstitutionalStatus(stats);
            console.log('');

            // Safety Status
            await this.renderSafetyStatus(safety);

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to get system status: ${error.message}${CONFIG.display.colors.reset}`);
        }

        await this.waitForKeyPress();
    }

    async renderSystemOverview(stats, safety) {
        const colors = CONFIG.display.colors;

        console.log(`${colors.bright}${colors.cyan}🎯 System Overview${colors.reset}`);
        console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);

        const totalFeedback = stats.totalFeedback || 0;
        const alignmentScore = stats.alignmentScore || 0;
        const safetyScore = safety.overallSafetyScore || 0;

        console.log(`Total Feedback Samples: ${colors.white}${totalFeedback.toLocaleString()}${colors.reset}`);
        console.log(`Alignment Score: ${this.getScoreColor(alignmentScore)}${(alignmentScore * 100).toFixed(1)}%${colors.reset}`);
        console.log(`Safety Score: ${this.getScoreColor(safetyScore)}${(safetyScore * 100).toFixed(1)}%${colors.reset}`);
        console.log(`Active Experiments: ${colors.white}${this.activeExperiments.size}${colors.reset}`);

        // Training status
        const trainingStatus = stats.rewardModelTraining?.status || 'idle';
        const statusColor = trainingStatus === 'training' ? colors.yellow :
            trainingStatus === 'completed' ? colors.green : colors.white;
        console.log(`Training Status: ${statusColor}${trainingStatus}${colors.reset}`);
    }

    async renderRewardModelStatus(stats) {
        const colors = CONFIG.display.colors;

        console.log(`${colors.bright}${colors.magenta}🎯 Reward Model Status${colors.reset}`);
        console.log(`${colors.magenta}${'─'.repeat(40)}${colors.reset}`);

        const model = stats.rewardModel || {};
        const accuracy = model.accuracy || 0;
        const loss = model.loss || 0;
        const lastTrained = model.lastTrained ? new Date(model.lastTrained).toLocaleString() : 'Never';

        console.log(`Model Accuracy: ${this.getScoreColor(accuracy)}${(accuracy * 100).toFixed(1)}%${colors.reset}`);
        console.log(`Training Loss: ${colors.white}${loss.toFixed(4)}${colors.reset}`);
        console.log(`Last Trained: ${colors.white}${lastTrained}${colors.reset}`);
        console.log(`Training Samples: ${colors.white}${(model.trainingSamples || 0).toLocaleString()}${colors.reset}`);
    }

    async renderConstitutionalStatus(stats) {
        const colors = CONFIG.display.colors;

        console.log(`${colors.bright}${colors.blue}⚖️  Constitutional AI Status${colors.reset}`);
        console.log(`${colors.blue}${'─'.repeat(40)}${colors.reset}`);

        const constitutional = stats.constitutional || {};
        const violations = constitutional.recentViolations || 0;
        const compliance = constitutional.complianceRate || 0;

        console.log(`Active Principles: ${colors.white}${this.constitutionalPrinciples.length}${colors.reset}`);
        console.log(`Compliance Rate: ${this.getScoreColor(compliance)}${(compliance * 100).toFixed(1)}%${colors.reset}`);
        console.log(`Recent Violations: ${violations > 0 ? colors.red : colors.green}${violations}${colors.reset}`);

        if (violations > 0) {
            console.log(`${colors.yellow}⚠️  Review constitutional principles for recent violations${colors.reset}`);
        }
    }

    async renderSafetyStatus(safety) {
        const colors = CONFIG.display.colors;

        console.log(`${colors.bright}${colors.red}🛡️  Safety Status${colors.reset}`);
        console.log(`${colors.red}${'─'.repeat(40)}${colors.reset}`);

        const activeAlerts = safety.activeAlerts || 0;
        const safetyScore = safety.overallSafetyScore || 0;
        const lastIncident = safety.lastIncident ? new Date(safety.lastIncident).toLocaleString() : 'None';

        console.log(`Active Alerts: ${activeAlerts > 0 ? colors.red : colors.green}${activeAlerts}${colors.reset}`);
        console.log(`Safety Score: ${this.getScoreColor(safetyScore)}${(safetyScore * 100).toFixed(1)}%${colors.reset}`);
        console.log(`Last Incident: ${colors.white}${lastIncident}${colors.reset}`);

        if (activeAlerts > 0) {
            console.log(`${colors.red}🚨 Active safety alerts require attention${colors.reset}`);
        }
    }

    // === Feedback Management ===

    async showFeedbackManagement() {
        this.clearScreen();
        this.renderHeader();

        console.log(`${CONFIG.display.colors.bright}${CONFIG.display.colors.yellow}💬 FEEDBACK MANAGEMENT${CONFIG.display.colors.reset}`);
        console.log(`${CONFIG.display.colors.yellow}${'='.repeat(60)}${CONFIG.display.colors.reset}\n`);

        console.log('1. 📊 View Feedback Statistics');
        console.log('2. 💾 Collect Recent Feedback');
        console.log('3. 🔍 Analyze Feedback Quality');
        console.log('4. 📈 Feedback Trends');
        console.log('5. ✨ Generate Synthetic Feedback');
        console.log('6. 🧹 Clean Feedback Data');
        console.log('0. ← Back to Main Menu');
        console.log('');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const choice = await this.getUserInput(rl, 'Select an option: ');

        switch (choice) {
            case '1':
                await this.showFeedbackStatistics();
                break;
            case '2':
                await this.collectRecentFeedback();
                break;
            case '3':
                await this.analyzeFeedbackQuality();
                break;
            case '4':
                await this.showFeedbackTrends();
                break;
            case '5':
                await this.generateSyntheticFeedback();
                break;
            case '6':
                await this.cleanFeedbackData();
                break;
            case '0':
                rl.close();
                return;
            default:
                console.log(`${CONFIG.display.colors.red}Invalid option.${CONFIG.display.colors.reset}`);
        }

        rl.close();
        await this.waitForKeyPress();
    }

    async showFeedbackStatistics() {
        console.log('\n📊 Feedback Statistics\n');

        try {
            const stats = await this.makeRequest('/ai/rlhf/feedback/stats');
            const colors = CONFIG.display.colors;

            console.log(`Total Feedback: ${colors.white}${stats.total || 0}${colors.reset}`);
            console.log(`Recent (24h): ${colors.white}${stats.recent24h || 0}${colors.reset}`);
            console.log(`Average Quality: ${this.getScoreColor(stats.averageQuality || 0)}${((stats.averageQuality || 0) * 100).toFixed(1)}%${colors.reset}`);
            console.log(`Positive Feedback: ${colors.green}${stats.positive || 0}${colors.reset}`);
            console.log(`Negative Feedback: ${colors.red}${stats.negative || 0}${colors.reset}`);

            if (stats.byGamePhase) {
                console.log('\nFeedback by Game Phase:');
                for (const [phase, count] of Object.entries(stats.byGamePhase)) {
                    console.log(`  ${phase}: ${colors.white}${count}${colors.reset}`);
                }
            }

            if (stats.byDifficulty) {
                console.log('\nFeedback by Difficulty:');
                for (const [difficulty, count] of Object.entries(stats.byDifficulty)) {
                    console.log(`  Level ${difficulty}: ${colors.white}${count}${colors.reset}`);
                }
            }

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to get feedback statistics: ${error.message}${CONFIG.display.colors.reset}`);
        }
    }

    async collectRecentFeedback() {
        console.log('\n💾 Collecting Recent Feedback...\n');

        try {
            const response = await this.makeRequest('/ai/rlhf/feedback/collect', 'POST', {
                batchSize: CONFIG.feedback.batchSize,
                qualityThreshold: CONFIG.feedback.qualityThreshold
            });

            console.log(`${CONFIG.display.colors.green}✅ Collected ${response.collected || 0} new feedback samples${CONFIG.display.colors.reset}`);

            if (response.filtered > 0) {
                console.log(`${CONFIG.display.colors.yellow}⚠️  Filtered out ${response.filtered} low-quality samples${CONFIG.display.colors.reset}`);
            }

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to collect feedback: ${error.message}${CONFIG.display.colors.reset}`);
        }
    }

    // === Reward Model Training ===

    async showRewardModelTraining() {
        this.clearScreen();
        this.renderHeader();

        console.log(`${CONFIG.display.colors.bright}${CONFIG.display.colors.magenta}🎯 REWARD MODEL TRAINING${CONFIG.display.colors.reset}`);
        console.log(`${CONFIG.display.colors.magenta}${'='.repeat(60)}${CONFIG.display.colors.reset}\n`);

        try {
            const stats = await this.makeRequest('/ai/rlhf/stats');
            const modelStats = stats.rewardModel || {};

            console.log('Current Model Status:');
            console.log(`  Accuracy: ${this.getScoreColor(modelStats.accuracy || 0)}${((modelStats.accuracy || 0) * 100).toFixed(1)}%${CONFIG.display.colors.reset}`);
            console.log(`  Loss: ${CONFIG.display.colors.white}${(modelStats.loss || 0).toFixed(4)}${CONFIG.display.colors.reset}`);
            console.log(`  Training Samples: ${CONFIG.display.colors.white}${(modelStats.trainingSamples || 0).toLocaleString()}${CONFIG.display.colors.reset}`);
            console.log(`  Last Trained: ${CONFIG.display.colors.white}${modelStats.lastTrained ? new Date(modelStats.lastTrained).toLocaleString() : 'Never'}${CONFIG.display.colors.reset}`);
            console.log('');

            console.log('Training Options:');
            console.log('1. 🚀 Start Training');
            console.log('2. ⏸️  Pause Training');
            console.log('3. 🔄 Resume Training');
            console.log('4. 📊 View Training Progress');
            console.log('5. 🎯 Test Model Performance');
            console.log('6. 💾 Save Model Checkpoint');
            console.log('7. 📈 Training History');
            console.log('0. ← Back to Main Menu');
            console.log('');

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const choice = await this.getUserInput(rl, 'Select an option: ');

            switch (choice) {
                case '1':
                    await this.startRewardModelTraining();
                    break;
                case '2':
                    await this.pauseRewardModelTraining();
                    break;
                case '3':
                    await this.resumeRewardModelTraining();
                    break;
                case '4':
                    await this.showTrainingProgress();
                    break;
                case '5':
                    await this.testModelPerformance();
                    break;
                case '6':
                    await this.saveModelCheckpoint();
                    break;
                case '7':
                    await this.showTrainingHistory();
                    break;
                case '0':
                    rl.close();
                    return;
            }

            rl.close();

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to get training status: ${error.message}${CONFIG.display.colors.reset}`);
        }

        await this.waitForKeyPress();
    }

    async startRewardModelTraining() {
        console.log('\n🚀 Starting Reward Model Training...\n');

        try {
            const response = await this.makeRequest('/ai/rlhf/train', 'POST', {
                epochs: CONFIG.training.epochs,
                batchSize: CONFIG.training.batchSize,
                learningRate: CONFIG.training.learningRate,
                validationSplit: CONFIG.training.validationSplit
            });

            console.log(`${CONFIG.display.colors.green}✅ Training started successfully${CONFIG.display.colors.reset}`);
            console.log(`Training ID: ${CONFIG.display.colors.white}${response.trainingId}${CONFIG.display.colors.reset}`);
            console.log(`Estimated Duration: ${CONFIG.display.colors.white}${response.estimatedDuration}${CONFIG.display.colors.reset}`);

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to start training: ${error.message}${CONFIG.display.colors.reset}`);
        }
    }

    // === Monitoring ===

    startMonitoring() {
        console.log('📊 Starting RLHF monitoring...');

        // Feedback collection monitoring
        this.feedbackInterval = setInterval(async () => {
            await this.collectAndProcessFeedback();
        }, CONFIG.feedback.collectInterval);

        // Safety monitoring
        if (CONFIG.safety.enabled) {
            this.safetyInterval = setInterval(async () => {
                await this.performSafetyCheck();
            }, CONFIG.safety.monitoringInterval);
        }

        // Performance metrics
        this.metricsInterval = setInterval(async () => {
            await this.updatePerformanceMetrics();
        }, CONFIG.performance.metricsInterval);

        // Benchmarking
        this.benchmarkInterval = setInterval(async () => {
            await this.runPerformanceBenchmark();
        }, CONFIG.performance.benchmarkInterval);
    }

    async collectAndProcessFeedback() {
        try {
            // Collect new feedback
            const response = await this.makeRequest('/ai/rlhf/feedback/collect', 'POST', {
                batchSize: CONFIG.feedback.batchSize,
                qualityThreshold: CONFIG.feedback.qualityThreshold
            });

            if (response.collected > 0) {
                this.feedbackBuffer.push(...(response.feedback || []));

                // Check if we have enough feedback for training
                if (this.feedbackBuffer.length >= CONFIG.training.minFeedbackSamples) {
                    await this.triggerRewardModelUpdate();
                }
            }

        } catch (error) {
            // Silently continue if feedback collection fails
        }
    }

    async performSafetyCheck() {
        try {
            const safety = await this.makeRequest('/ai/safety/check');

            const thresholds = CONFIG.safety.alertThresholds;

            // Check alignment score
            if (safety.alignmentScore < thresholds.alignmentScore) {
                this.createSafetyAlert('warning', `Low alignment score: ${(safety.alignmentScore * 100).toFixed(1)}%`);
            }

            // Check violation rate
            if (safety.violationRate > thresholds.violationRate) {
                this.createSafetyAlert('critical', `High violation rate: ${(safety.violationRate * 100).toFixed(1)}%`);
            }

            // Check reward model accuracy
            if (safety.rewardModelAccuracy < thresholds.rewardModelAccuracy) {
                this.createSafetyAlert('warning', `Low reward model accuracy: ${(safety.rewardModelAccuracy * 100).toFixed(1)}%`);
            }

        } catch (error) {
            // Silently continue if safety check fails
        }
    }

    async triggerRewardModelUpdate() {
        try {
            console.log('🎯 Triggering reward model update...');

            await this.makeRequest('/ai/rlhf/train/incremental', 'POST', {
                feedbackSamples: this.feedbackBuffer,
                updateType: 'incremental'
            });

            // Clear feedback buffer
            this.feedbackBuffer = [];

            console.log('✅ Reward model updated successfully');

        } catch (error) {
            console.log(`${CONFIG.display.colors.red}❌ Failed to update reward model: ${error.message}${CONFIG.display.colors.reset}`);
        }
    }

    createSafetyAlert(level, message) {
        const alert = {
            level,
            message,
            timestamp: Date.now(),
            type: 'safety'
        };

        const colors = CONFIG.display.colors;
        const levelColor = level === 'critical' ? colors.red : colors.yellow;

        console.log(`${levelColor}🛡️  [SAFETY ${level.toUpperCase()}] ${message}${colors.reset}`);
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

    getScoreColor(score) {
        const colors = CONFIG.display.colors;
        return score >= 0.8 ? colors.green :
            score >= 0.6 ? colors.yellow : colors.red;
    }

    clearScreen() {
        process.stdout.write('\x1b[2J\x1b[H');
    }

    renderHeader() {
        const colors = CONFIG.display.colors;
        const width = 80;

        console.log(`${colors.cyan}${'='.repeat(width)}${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}🧠 RLHF SYSTEM MANAGER - Human-AI Alignment Platform${colors.reset}`);
        console.log(`${colors.bright}${colors.white}Derek J. Russell | Constitutional AI | Reward Model Training${colors.reset}`);
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
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await this.getUserInput(rl, '\nPress Enter to continue...');
        rl.close();
    }

    async shutdown() {
        console.log(`\n${CONFIG.display.colors.yellow}🔄 Shutting down RLHF System Manager...${CONFIG.display.colors.reset}`);

        this.isRunning = false;

        // Clear intervals
        if (this.feedbackInterval) clearInterval(this.feedbackInterval);
        if (this.safetyInterval) clearInterval(this.safetyInterval);
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.benchmarkInterval) clearInterval(this.benchmarkInterval);

        console.log(`${CONFIG.display.colors.green}✅ RLHF System Manager stopped${CONFIG.display.colors.reset}`);
        process.exit(0);
    }
}

// === Main Execution ===

async function main() {
    const manager = new RLHFSystemManager();

    // Handle graceful shutdown
    process.on('SIGTERM', () => manager.shutdown());
    process.on('SIGINT', () => manager.shutdown());

    await manager.start();
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧠 RLHF System Manager - Human-AI Alignment Management Platform

USAGE:
    node rlhf-system-manager.js [options]

OPTIONS:
    --help, -h          Show this help message

FEATURES:
    ✅ Reward model training and validation
    ✅ Multi-modal feedback collection
    ✅ Constitutional AI management
    ✅ Safety monitoring and alerts
    ✅ Performance benchmarking
    ✅ A/B testing framework
    ✅ Explainability analysis
    ✅ Real-time alignment monitoring

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

module.exports = { RLHFSystemManager, CONFIG }; 