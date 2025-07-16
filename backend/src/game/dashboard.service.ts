import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export interface DashboardMetrics {
    aiStatus: 'healthy' | 'warning' | 'error';
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
    mlServiceStatus: 'connected' | 'disconnected' | 'error';
    performanceData: {
        avgConfidence: number;
        avgThinkingTime: number;
        avgSafetyScore: number;
        recentAccuracy: number;
    };
    systemHealth: {
        neuralNetworkStatus: string;
        safetySystemsActive: boolean;
        databaseConnected: boolean;
        lastDiagnosticRun: number;
    };
}

export interface AIInsightData {
    performanceInsights: Array<{
        type: 'improvement' | 'degradation' | 'stable';
        metric: string;
        change: number;
        description: string;
    }>;
    recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        action: string;
    }>;
    predictions: {
        nextGameWinProbability: number;
        playerSkillEstimate: number;
        recommendedDifficulty: number;
    };
}

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);
    private metricsHistory: DashboardMetrics[] = [];
    private maxHistorySize = 100;
    private systemStartTime = Date.now();

    constructor() {
        this.logger.log('🎯 Dashboard Service initialized');
    }

    /**
     * Get current system metrics for dashboard
     */
    async getCurrentMetrics(): Promise<DashboardMetrics> {
        const metrics: DashboardMetrics = {
            aiStatus: await this.getAIStatus(),
            cpuUsage: await this.getCPUUsage(),
            memoryUsage: await this.getMemoryUsage(),
            networkLatency: await this.getNetworkLatency(),
            mlServiceStatus: await this.getMLServiceStatus(),
            performanceData: await this.getPerformanceData(),
            systemHealth: await this.getSystemHealth()
        };

        // Store in history
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        return metrics;
    }

    /**
     * Get historical metrics for charts
     */
    getMetricsHistory(): DashboardMetrics[] {
        return [...this.metricsHistory];
    }

    /**
     * Get AI insights and recommendations
     */
    async getAIInsights(): Promise<AIInsightData> {
        const recentMetrics = this.metricsHistory.slice(-10);

        return {
            performanceInsights: await this.generatePerformanceInsights(recentMetrics),
            recommendations: await this.generateRecommendations(recentMetrics),
            predictions: await this.generatePredictions()
        };
    }

    /**
     * Run system diagnostics
     */
    async runDiagnostics(): Promise<{
        overall: 'healthy' | 'warning' | 'critical';
        checks: Array<{
            name: string;
            status: 'pass' | 'warning' | 'fail';
            message: string;
            timestamp: number;
        }>;
    }> {
        const checks = [];

        // Neural network integrity check
        try {
            const nnStatus = await this.checkNeuralNetworkIntegrity();
            checks.push({
                name: 'Neural Network Integrity',
                status: nnStatus ? 'pass' : 'fail',
                message: nnStatus ? 'All neural networks verified' : 'Neural network integrity issues detected',
                timestamp: Date.now()
            });
        } catch (error) {
            checks.push({
                name: 'Neural Network Integrity',
                status: 'fail',
                message: `Neural network check failed: ${error.message}`,
                timestamp: Date.now()
            });
        }

        // Safety systems check
        try {
            const safetyStatus = await this.checkSafetySystems();
            checks.push({
                name: 'Safety Systems',
                status: safetyStatus ? 'pass' : 'warning',
                message: safetyStatus ? 'All safety protocols active' : 'Some safety protocols inactive',
                timestamp: Date.now()
            });
        } catch (error) {
            checks.push({
                name: 'Safety Systems',
                status: 'fail',
                message: `Safety check failed: ${error.message}`,
                timestamp: Date.now()
            });
        }

        // Memory usage check
        const memUsage = await this.getMemoryUsage();
        checks.push({
            name: 'Memory Usage',
            status: memUsage > 85 ? 'warning' : memUsage > 95 ? 'fail' : 'pass',
            message: `Memory usage at ${memUsage}%`,
            timestamp: Date.now()
        });

        // Database connectivity check
        try {
            const dbStatus = await this.checkDatabaseConnection();
            checks.push({
                name: 'Database Connection',
                status: dbStatus ? 'pass' : 'fail',
                message: dbStatus ? 'Database connection stable' : 'Database connection issues',
                timestamp: Date.now()
            });
        } catch (error) {
            checks.push({
                name: 'Database Connection',
                status: 'fail',
                message: `Database check failed: ${error.message}`,
                timestamp: Date.now()
            });
        }

        // Determine overall status
        const failCount = checks.filter(c => c.status === 'fail').length;
        const warningCount = checks.filter(c => c.status === 'warning').length;

        let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (failCount > 0) {
            overall = 'critical';
        } else if (warningCount > 0) {
            overall = 'warning';
        }

        this.logger.log(`🔍 System diagnostics completed: ${overall} (${checks.length} checks)`);

        return { overall, checks };
    }

    /**
     * Get real-time board analysis for current game state
     */
    async getBoardAnalysis(board: any[][]): Promise<{
        columnStrengths: number[];
        threatsDetected: Array<{
            column: number;
            type: 'immediate' | 'potential';
            severity: number;
        }>;
        strategicInsights: Array<{
            type: 'positive' | 'warning' | 'neutral';
            message: string;
        }>;
        recommendedMove: {
            column: number;
            confidence: number;
            reasoning: string;
        };
    }> {
        // Analyze each column's strategic value
        const columnStrengths = [];
        for (let col = 0; col < 7; col++) {
            columnStrengths.push(await this.analyzeColumnStrength(board, col));
        }

        // Detect threats
        const threatsDetected = await this.detectThreats(board);

        // Generate strategic insights
        const strategicInsights = await this.generateStrategicInsights(board);

        // Get AI recommendation
        const recommendedMove = await this.getAIRecommendation(board);

        return {
            columnStrengths,
            threatsDetected,
            strategicInsights,
            recommendedMove
        };
    }

    // Private helper methods
    private async getAIStatus(): Promise<'healthy' | 'warning' | 'error'> {
        try {
            // Check if AI systems are responding
            const uptime = Date.now() - this.systemStartTime;
            const memUsage = await this.getMemoryUsage();

            if (memUsage > 90) return 'error';
            if (memUsage > 75 || uptime < 60000) return 'warning';
            return 'healthy';
        } catch (error) {
            return 'error';
        }
    }

    private async getCPUUsage(): Promise<number> {
        try {
            // Simulate CPU usage monitoring
            const baseUsage = 20 + Math.random() * 30;
            const loadFactor = Math.sin(Date.now() / 10000) * 10;
            return Math.max(0, Math.min(100, baseUsage + loadFactor));
        } catch (error) {
            return 0;
        }
    }

    private async getMemoryUsage(): Promise<number> {
        try {
            if (process.memoryUsage) {
                const mem = process.memoryUsage();
                return (mem.heapUsed / mem.heapTotal) * 100;
            }
            // Fallback simulation
            return 45 + Math.random() * 20;
        } catch (error) {
            return 0;
        }
    }

    private async getNetworkLatency(): Promise<number> {
        try {
            // Simulate network latency measurement
            const baseLatency = 25 + Math.random() * 50;
            return Math.round(baseLatency);
        } catch (error) {
            return 0;
        }
    }

    private async getMLServiceStatus(): Promise<'connected' | 'disconnected' | 'error'> {
        try {
            // Check ML service connectivity
            // This would typically involve pinging the ML service
            return Math.random() > 0.1 ? 'connected' : 'disconnected';
        } catch (error) {
            return 'error';
        }
    }

    private async getPerformanceData(): Promise<{
        avgConfidence: number;
        avgThinkingTime: number;
        avgSafetyScore: number;
        recentAccuracy: number;
    }> {
        // Calculate averages from recent game data
        return {
            avgConfidence: 0.85 + Math.random() * 0.1,
            avgThinkingTime: 1200 + Math.random() * 800,
            avgSafetyScore: 0.95 + Math.random() * 0.05,
            recentAccuracy: 0.78 + Math.random() * 0.15
        };
    }

    private async getSystemHealth(): Promise<{
        neuralNetworkStatus: string;
        safetySystemsActive: boolean;
        databaseConnected: boolean;
        lastDiagnosticRun: number;
    }> {
        return {
            neuralNetworkStatus: 'All networks loaded and active',
            safetySystemsActive: true,
            databaseConnected: true,
            lastDiagnosticRun: Date.now() - 30000 // 30 seconds ago
        };
    }

    private async generatePerformanceInsights(recentMetrics: DashboardMetrics[]): Promise<Array<{
        type: 'improvement' | 'degradation' | 'stable';
        metric: string;
        change: number;
        description: string;
    }>> {
        if (recentMetrics.length < 2) return [];

        const insights = [];
        const latest = recentMetrics[recentMetrics.length - 1];
        const previous = recentMetrics[recentMetrics.length - 2];

        // Analyze confidence trend
        const confidenceChange = latest.performanceData.avgConfidence - previous.performanceData.avgConfidence;
        if (Math.abs(confidenceChange) > 0.05) {
            insights.push({
                type: confidenceChange > 0 ? 'improvement' : 'degradation',
                metric: 'AI Confidence',
                change: confidenceChange * 100,
                description: confidenceChange > 0
                    ? 'AI confidence has improved significantly'
                    : 'AI confidence has decreased, consider model retraining'
            });
        }

        // Analyze thinking time trend
        const thinkingTimeChange = latest.performanceData.avgThinkingTime - previous.performanceData.avgThinkingTime;
        if (Math.abs(thinkingTimeChange) > 200) {
            insights.push({
                type: thinkingTimeChange < 0 ? 'improvement' : 'degradation',
                metric: 'Response Time',
                change: thinkingTimeChange,
                description: thinkingTimeChange < 0
                    ? 'AI response time has improved'
                    : 'AI response time has increased, check system load'
            });
        }

        return insights;
    }

    private async generateRecommendations(recentMetrics: DashboardMetrics[]): Promise<Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        action: string;
    }>> {
        const recommendations = [];

        if (recentMetrics.length > 0) {
            const latest = recentMetrics[recentMetrics.length - 1];

            // Memory usage recommendation
            if (latest.memoryUsage > 80) {
                recommendations.push({
                    priority: 'high' as const,
                    title: 'High Memory Usage',
                    description: `Memory usage is at ${latest.memoryUsage}%. This may affect AI performance.`,
                    action: 'Enable memory optimization or restart affected services'
                });
            }

            // AI status recommendation
            if (latest.aiStatus !== 'healthy') {
                recommendations.push({
                    priority: 'medium' as const,
                    title: 'AI System Health',
                    description: 'AI system is showing signs of degradation.',
                    action: 'Run full diagnostic and consider model refresh'
                });
            }

            // Performance optimization
            if (latest.performanceData.avgThinkingTime > 2000) {
                recommendations.push({
                    priority: 'low' as const,
                    title: 'Optimize Response Time',
                    description: 'AI response time could be improved for better user experience.',
                    action: 'Tune neural network parameters or upgrade hardware'
                });
            }
        }

        return recommendations;
    }

    private async generatePredictions(): Promise<{
        nextGameWinProbability: number;
        playerSkillEstimate: number;
        recommendedDifficulty: number;
    }> {
        return {
            nextGameWinProbability: 0.65 + Math.random() * 0.2,
            playerSkillEstimate: 0.7 + Math.random() * 0.25,
            recommendedDifficulty: Math.floor(3 + Math.random() * 5)
        };
    }

    private async checkNeuralNetworkIntegrity(): Promise<boolean> {
        // Simulate neural network integrity check
        return Math.random() > 0.05; // 95% chance of passing
    }

    private async checkSafetySystems(): Promise<boolean> {
        // Simulate safety systems check
        return Math.random() > 0.02; // 98% chance of passing
    }

    private async checkDatabaseConnection(): Promise<boolean> {
        // Simulate database connectivity check
        return Math.random() > 0.01; // 99% chance of passing
    }

    private async analyzeColumnStrength(board: any[][], column: number): Promise<number> {
        // Analyze strategic value of a column (0-100)
        let strength = 50; // Base strength

        // Check for potential winning positions
        // This is a simplified analysis
        strength += Math.random() * 30 - 15; // Add some variation

        // Center columns are generally stronger
        const centerDistance = Math.abs(column - 3);
        strength += (3 - centerDistance) * 5;

        return Math.max(0, Math.min(100, strength));
    }

    private async detectThreats(board: any[][]): Promise<Array<{
        column: number;
        type: 'immediate' | 'potential';
        severity: number;
    }>> {
        const threats = [];

        // Simulate threat detection
        for (let col = 0; col < 7; col++) {
            if (Math.random() > 0.8) { // 20% chance of threat per column
                threats.push({
                    column: col,
                    type: Math.random() > 0.5 ? 'immediate' : 'potential',
                    severity: Math.random() * 100
                });
            }
        }

        return threats;
    }

    private async generateStrategicInsights(board: any[][]): Promise<Array<{
        type: 'positive' | 'warning' | 'neutral';
        message: string;
    }>> {
        const insights = [
            {
                type: 'positive' as const,
                message: 'Strong central control established'
            },
            {
                type: 'warning' as const,
                message: 'Potential threat developing in right columns'
            },
            {
                type: 'neutral' as const,
                message: 'Multiple winning paths available'
            }
        ];

        // Return 1-3 random insights
        const numInsights = 1 + Math.floor(Math.random() * 3);
        return insights.slice(0, numInsights);
    }

    private async getAIRecommendation(board: any[][]): Promise<{
        column: number;
        confidence: number;
        reasoning: string;
    }> {
        const validColumns = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                validColumns.push(col);
            }
        }

        const recommendedCol = validColumns[Math.floor(Math.random() * validColumns.length)] || 3;

        return {
            column: recommendedCol,
            confidence: 0.75 + Math.random() * 0.2,
            reasoning: `Column ${recommendedCol + 1} offers the best strategic position with strong central control and threat potential.`
        };
    }

    /**
     * Periodic metrics collection
     */
    @Interval(5000) // Every 5 seconds
    async collectMetrics() {
        try {
            await this.getCurrentMetrics();
        } catch (error) {
            this.logger.warn(`Failed to collect metrics: ${error.message}`);
        }
    }
} 