// src/ai/explainability/featureImportance.ts
import { CellValue } from '../connect4AI';
import { DecisionTrace } from './decisionTracer';

export interface FeatureImportance {
    featureName: string;
    importance: number;
    category: 'positional' | 'strategic' | 'tactical' | 'pattern' | 'threat' | 'opportunity';
    description: string;
    confidence: number;
    boardLocation?: [number, number];
    visualWeight?: number;
}

export interface FeatureImportanceAnalysis {
    algorithm: string;
    timestamp: number;
    boardState: CellValue[][];
    selectedMove: number;
    globalFeatures: FeatureImportance[];
    localFeatures: FeatureImportance[];
    patternFeatures: FeatureImportance[];
    strategicFeatures: FeatureImportance[];
    temporalFeatures: FeatureImportance[];
    totalFeatures: number;
    averageImportance: number;
    topFeatures: FeatureImportance[];
    analysis: {
        dominantCategory: string;
        complexityScore: number;
        focusScore: number;
        diversityScore: number;
    };
}

export interface FeatureImportanceConfig {
    method: 'permutation' | 'gradient' | 'shap' | 'lime' | 'integrated_gradients' | 'occlusion';
    samplingSize: number;
    perturbationStrength: number;
    baselineStrategy: 'zero' | 'random' | 'average' | 'noise';
    featureGroups: string[];
    spatialAggregation: 'none' | 'neighborhood' | 'region' | 'global';
    temporalWindow: number;
    confidenceThreshold: number;
}

export interface FeatureExtractor {
    extractPositionalFeatures(board: CellValue[][]): { [key: string]: number };
    extractStrategicFeatures(board: CellValue[][]): { [key: string]: number };
    extractTacticalFeatures(board: CellValue[][]): { [key: string]: number };
    extractPatternFeatures(board: CellValue[][]): { [key: string]: number };
    extractThreatFeatures(board: CellValue[][]): { [key: string]: number };
    extractOpportunityFeatures(board: CellValue[][]): { [key: string]: number };
}

/**
 * Advanced Feature Importance Analysis System
 * 
 * Capabilities:
 * - Multiple importance calculation methods
 * - Multi-scale feature analysis (global, local, pattern)
 * - Algorithm-agnostic importance calculation
 * - Temporal feature tracking
 * - Confidence estimation
 * - Visual weight calculation for saliency maps
 */
export class FeatureImportanceAnalyzer {
    private config: FeatureImportanceConfig;
    private extractor: FeatureExtractor;
    private featureHistory: FeatureImportanceAnalysis[] = [];
    private baselineCache: Map<string, number> = new Map();

    constructor(config: Partial<FeatureImportanceConfig> = {}) {
        this.config = {
            method: 'permutation',
            samplingSize: 100,
            perturbationStrength: 0.1,
            baselineStrategy: 'zero',
            featureGroups: ['positional', 'strategic', 'tactical', 'pattern', 'threat', 'opportunity'],
            spatialAggregation: 'neighborhood',
            temporalWindow: 10,
            confidenceThreshold: 0.1,
            ...config
        };

        this.extractor = new Connect4FeatureExtractor();
    }

    /**
     * Calculate feature importance for a given decision
     */
    async calculateFeatureImportance(
        boardState: CellValue[][],
        selectedMove: number,
        algorithm: string,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace
    ): Promise<FeatureImportanceAnalysis> {
        const startTime = Date.now();

        // Extract all features
        const allFeatures = await this.extractAllFeatures(boardState);

        // Calculate importance based on method
        let importanceScores: { [key: string]: number };
        switch (this.config.method) {
            case 'permutation':
                importanceScores = await this.calculatePermutationImportance(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
                break;
            case 'gradient':
                importanceScores = await this.calculateGradientImportance(
                    boardState, selectedMove, trace, allFeatures
                );
                break;
            case 'shap':
                importanceScores = await this.calculateSHAPImportance(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
                break;
            case 'lime':
                importanceScores = await this.calculateLIMEImportance(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
                break;
            case 'integrated_gradients':
                importanceScores = await this.calculateIntegratedGradients(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
                break;
            case 'occlusion':
                importanceScores = await this.calculateOcclusionImportance(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
                break;
            default:
                importanceScores = await this.calculatePermutationImportance(
                    boardState, selectedMove, decisionFunction, allFeatures
                );
        }

        // Create feature importance objects
        const featureImportances = this.createFeatureImportanceObjects(
            importanceScores, allFeatures, boardState
        );

        // Categorize features
        const categorizedFeatures = this.categorizeFeatures(featureImportances);

        // Calculate analysis metrics
        const analysis = this.calculateAnalysisMetrics(featureImportances);

        // Create comprehensive analysis
        const importanceAnalysis: FeatureImportanceAnalysis = {
            algorithm,
            timestamp: startTime,
            boardState: boardState.map(row => [...row]),
            selectedMove,
            globalFeatures: categorizedFeatures.global,
            localFeatures: categorizedFeatures.local,
            patternFeatures: categorizedFeatures.pattern,
            strategicFeatures: categorizedFeatures.strategic,
            temporalFeatures: this.getTemporalFeatures(boardState),
            totalFeatures: featureImportances.length,
            averageImportance: featureImportances.reduce((sum, f) => sum + f.importance, 0) / featureImportances.length,
            topFeatures: featureImportances.sort((a, b) => b.importance - a.importance).slice(0, 10),
            analysis
        };

        // Store in history
        this.featureHistory.push(importanceAnalysis);
        if (this.featureHistory.length > 100) {
            this.featureHistory.shift();
        }

        return importanceAnalysis;
    }

    /**
     * Extract all types of features from board state
     */
    private async extractAllFeatures(boardState: CellValue[][]): Promise<{ [key: string]: number }> {
        const features: { [key: string]: number } = {};

        // Extract different feature types
        const positionalFeatures = this.extractor.extractPositionalFeatures(boardState);
        const strategicFeatures = this.extractor.extractStrategicFeatures(boardState);
        const tacticalFeatures = this.extractor.extractTacticalFeatures(boardState);
        const patternFeatures = this.extractor.extractPatternFeatures(boardState);
        const threatFeatures = this.extractor.extractThreatFeatures(boardState);
        const opportunityFeatures = this.extractor.extractOpportunityFeatures(boardState);

        // Combine all features
        Object.assign(features, positionalFeatures);
        Object.assign(features, strategicFeatures);
        Object.assign(features, tacticalFeatures);
        Object.assign(features, patternFeatures);
        Object.assign(features, threatFeatures);
        Object.assign(features, opportunityFeatures);

        return features;
    }

    /**
     * Calculate permutation importance
     */
    private async calculatePermutationImportance(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        features: { [key: string]: number }
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};

        // Get baseline score
        const baselineResult = await decisionFunction(boardState);
        const baselineScore = baselineResult.score;

        // Calculate importance for each feature
        for (const [featureName, featureValue] of Object.entries(features)) {
            let totalImportance = 0;

            // Perform multiple permutations
            for (let i = 0; i < this.config.samplingSize; i++) {
                const perturbedBoard = this.perturbBoard(boardState, featureName, featureValue);
                const perturbedResult = await decisionFunction(perturbedBoard);
                const importanceDiff = Math.abs(baselineScore - perturbedResult.score);
                totalImportance += importanceDiff;
            }

            importanceScores[featureName] = totalImportance / this.config.samplingSize;
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Calculate gradient-based importance
     */
    private async calculateGradientImportance(
        boardState: CellValue[][],
        selectedMove: number,
        trace?: DecisionTrace,
        features: { [key: string]: number } = {}
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};

        // Use gradients from neural network if available
        if (trace?.neuralNetworkTrace?.gradients) {
            const gradients = trace.neuralNetworkTrace.gradients;

            // Convert gradients to feature importance
            for (const [layer, gradient] of Object.entries(gradients)) {
                for (let i = 0; i < gradient.length; i++) {
                    const featureName = `${layer}_${i}`;
                    importanceScores[featureName] = Math.abs(gradient[i]);
                }
            }
        } else {
            // Fallback to numerical gradients
            for (const [featureName, featureValue] of Object.entries(features)) {
                const gradient = await this.calculateNumericalGradient(
                    boardState, featureName, featureValue
                );
                importanceScores[featureName] = Math.abs(gradient);
            }
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Calculate SHAP-like importance values
     */
    private async calculateSHAPImportance(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        features: { [key: string]: number }
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};
        const featureNames = Object.keys(features);
        const n = featureNames.length;

        // Calculate SHAP values using sampling approximation
        for (let i = 0; i < n; i++) {
            const featureName = featureNames[i];
            let shapValue = 0;

            // Sample coalitions
            for (let sample = 0; sample < this.config.samplingSize; sample++) {
                const coalitionSize = Math.floor(Math.random() * n);
                const coalition = this.sampleCoalition(featureNames, coalitionSize, i);

                // Calculate marginal contribution
                const withFeature = await this.evaluateCoalition(
                    boardState, [...coalition, featureName], features, decisionFunction
                );
                const withoutFeature = await this.evaluateCoalition(
                    boardState, coalition, features, decisionFunction
                );

                shapValue += (withFeature - withoutFeature) / this.config.samplingSize;
            }

            importanceScores[featureName] = Math.abs(shapValue);
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Calculate LIME-like importance values
     */
    private async calculateLIMEImportance(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        features: { [key: string]: number }
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};
        const featureNames = Object.keys(features);

        // Generate perturbed samples
        const samples: { features: { [key: string]: number }; prediction: number }[] = [];

        for (let i = 0; i < this.config.samplingSize; i++) {
            const perturbedFeatures = this.perturbFeatures(features);
            const perturbedBoard = this.reconstructBoard(boardState, perturbedFeatures);
            const result = await decisionFunction(perturbedBoard);

            samples.push({
                features: perturbedFeatures,
                prediction: result.score
            });
        }

        // Fit linear model
        const coefficients = this.fitLinearModel(samples, featureNames);

        // Use coefficients as importance scores
        for (let i = 0; i < featureNames.length; i++) {
            importanceScores[featureNames[i]] = Math.abs(coefficients[i]);
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Calculate integrated gradients
     */
    private async calculateIntegratedGradients(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        features: { [key: string]: number }
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};
        const steps = 50;

        // Create baseline
        const baselineFeatures = this.createBaseline(features);

        for (const [featureName, featureValue] of Object.entries(features)) {
            let integratedGradient = 0;

            // Integrate along path from baseline to current
            for (let step = 0; step <= steps; step++) {
                const alpha = step / steps;
                const interpolatedValue = baselineFeatures[featureName] +
                    alpha * (featureValue - baselineFeatures[featureName]);

                const gradient = await this.calculateNumericalGradient(
                    boardState, featureName, interpolatedValue
                );

                integratedGradient += gradient;
            }

            importanceScores[featureName] = Math.abs(integratedGradient *
                (featureValue - baselineFeatures[featureName]) / steps);
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Calculate occlusion-based importance
     */
    private async calculateOcclusionImportance(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        features: { [key: string]: number }
    ): Promise<{ [key: string]: number }> {
        const importanceScores: { [key: string]: number } = {};

        // Get baseline score
        const baselineResult = await decisionFunction(boardState);
        const baselineScore = baselineResult.score;

        // Occlude each feature
        for (const [featureName, featureValue] of Object.entries(features)) {
            const occludedBoard = this.occludeFeature(boardState, featureName);
            const occludedResult = await decisionFunction(occludedBoard);
            const importanceDiff = Math.abs(baselineScore - occludedResult.score);

            importanceScores[featureName] = importanceDiff;
        }

        return this.normalizeImportanceScores(importanceScores);
    }

    /**
     * Create feature importance objects with metadata
     */
    private createFeatureImportanceObjects(
        importanceScores: { [key: string]: number },
        features: { [key: string]: number },
        boardState: CellValue[][]
    ): FeatureImportance[] {
        const featureImportances: FeatureImportance[] = [];

        for (const [featureName, importance] of Object.entries(importanceScores)) {
            const featureImportance: FeatureImportance = {
                featureName,
                importance,
                category: this.categorizeFeature(featureName),
                description: this.getFeatureDescription(featureName),
                confidence: this.calculateConfidence(importance, importanceScores),
                boardLocation: this.extractBoardLocation(featureName),
                visualWeight: this.calculateVisualWeight(importance, importanceScores)
            };

            featureImportances.push(featureImportance);
        }

        return featureImportances.sort((a, b) => b.importance - a.importance);
    }

    /**
     * Categorize features by type
     */
    private categorizeFeatures(features: FeatureImportance[]): {
        global: FeatureImportance[];
        local: FeatureImportance[];
        pattern: FeatureImportance[];
        strategic: FeatureImportance[];
    } {
        return {
            global: features.filter(f => f.category === 'positional' || f.category === 'strategic'),
            local: features.filter(f => f.boardLocation !== undefined),
            pattern: features.filter(f => f.category === 'pattern'),
            strategic: features.filter(f => f.category === 'strategic' || f.category === 'tactical')
        };
    }

    /**
     * Calculate analysis metrics
     */
    private calculateAnalysisMetrics(features: FeatureImportance[]): FeatureImportanceAnalysis['analysis'] {
        const categories = features.reduce((acc, f) => {
            acc[f.category] = (acc[f.category] || 0) + f.importance;
            return acc;
        }, {} as { [key: string]: number });

        const dominantCategory = Object.entries(categories)
            .sort(([, a], [, b]) => b - a)[0][0];

        const totalImportance = features.reduce((sum, f) => sum + f.importance, 0);
        const topFeatureImportance = features.slice(0, 5).reduce((sum, f) => sum + f.importance, 0);

        return {
            dominantCategory,
            complexityScore: features.length / 100, // Normalize by typical feature count
            focusScore: topFeatureImportance / totalImportance,
            diversityScore: Object.keys(categories).length / 6 // Normalize by category count
        };
    }

    /**
     * Get temporal features from history
     */
    private getTemporalFeatures(boardState: CellValue[][]): FeatureImportance[] {
        const temporalFeatures: FeatureImportance[] = [];

        if (this.featureHistory.length > 1) {
            const recentHistory = this.featureHistory.slice(-this.config.temporalWindow);

            // Calculate feature trends
            const featureTrends = this.calculateFeatureTrends(recentHistory);

            for (const [featureName, trend] of Object.entries(featureTrends)) {
                temporalFeatures.push({
                    featureName: `trend_${featureName}`,
                    importance: Math.abs(trend),
                    category: 'strategic',
                    description: `Trend analysis for ${featureName}`,
                    confidence: 0.8,
                    visualWeight: Math.abs(trend)
                });
            }
        }

        return temporalFeatures;
    }

    // Helper methods
    private perturbBoard(boardState: CellValue[][], featureName: string, featureValue: number): CellValue[][] {
        const perturbedBoard = boardState.map(row => [...row]);

        // Apply perturbation based on feature type
        if (featureName.includes('position')) {
            const location = this.extractBoardLocation(featureName);
            if (location) {
                const [row, col] = location;
                if (Math.random() < this.config.perturbationStrength) {
                    perturbedBoard[row][col] = this.getRandomCellValue();
                }
            }
        }

        return perturbedBoard;
    }

    private calculateNumericalGradient(
        boardState: CellValue[][],
        featureName: string,
        featureValue: number
    ): Promise<number> {
        // Simplified numerical gradient calculation
        const epsilon = 0.01;
        const perturbedValue = featureValue + epsilon;

        // This would need to be implemented based on specific feature types
        return Promise.resolve(Math.random() * 0.1); // Placeholder
    }

    private sampleCoalition(featureNames: string[], coalitionSize: number, excludeIndex: number): string[] {
        const coalition: string[] = [];
        const availableIndices = featureNames
            .map((_, i) => i)
            .filter(i => i !== excludeIndex);

        for (let i = 0; i < coalitionSize && i < availableIndices.length; i++) {
            const randomIndex = Math.floor(Math.random() * availableIndices.length);
            const featureIndex = availableIndices.splice(randomIndex, 1)[0];
            coalition.push(featureNames[featureIndex]);
        }

        return coalition;
    }

    private async evaluateCoalition(
        boardState: CellValue[][],
        coalition: string[],
        features: { [key: string]: number },
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>
    ): Promise<number> {
        // Create modified board with only coalition features
        const modifiedBoard = this.createCoalitionBoard(boardState, coalition, features);
        const result = await decisionFunction(modifiedBoard);
        return result.score;
    }

    private createCoalitionBoard(
        boardState: CellValue[][],
        coalition: string[],
        features: { [key: string]: number }
    ): CellValue[][] {
        // Simplified coalition board creation
        return boardState.map(row => [...row]);
    }

    private perturbFeatures(features: { [key: string]: number }): { [key: string]: number } {
        const perturbedFeatures: { [key: string]: number } = {};

        for (const [name, value] of Object.entries(features)) {
            const perturbation = (Math.random() - 0.5) * 2 * this.config.perturbationStrength;
            perturbedFeatures[name] = value + perturbation;
        }

        return perturbedFeatures;
    }

    private reconstructBoard(
        originalBoard: CellValue[][],
        features: { [key: string]: number }
    ): CellValue[][] {
        // Simplified board reconstruction
        return originalBoard.map(row => [...row]);
    }

    private fitLinearModel(
        samples: { features: { [key: string]: number }; prediction: number }[],
        featureNames: string[]
    ): number[] {
        // Simplified linear regression
        const coefficients = new Array(featureNames.length).fill(0);

        // This would implement actual linear regression
        for (let i = 0; i < coefficients.length; i++) {
            coefficients[i] = Math.random() * 0.1; // Placeholder
        }

        return coefficients;
    }

    private createBaseline(features: { [key: string]: number }): { [key: string]: number } {
        const baseline: { [key: string]: number } = {};

        for (const [name, value] of Object.entries(features)) {
            switch (this.config.baselineStrategy) {
                case 'zero':
                    baseline[name] = 0;
                    break;
                case 'random':
                    baseline[name] = Math.random();
                    break;
                case 'average':
                    baseline[name] = this.getFeatureAverage(name);
                    break;
                case 'noise':
                    baseline[name] = value + (Math.random() - 0.5) * 0.1;
                    break;
                default:
                    baseline[name] = 0;
            }
        }

        return baseline;
    }

    private occludeFeature(boardState: CellValue[][], featureName: string): CellValue[][] {
        const occludedBoard = boardState.map(row => [...row]);

        // Apply occlusion based on feature type
        const location = this.extractBoardLocation(featureName);
        if (location) {
            const [row, col] = location;
            occludedBoard[row][col] = 'Empty';
        }

        return occludedBoard;
    }

    private normalizeImportanceScores(scores: { [key: string]: number }): { [key: string]: number } {
        const values = Object.values(scores);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const range = maxValue - minValue;

        if (range === 0) return scores;

        const normalized: { [key: string]: number } = {};
        for (const [name, value] of Object.entries(scores)) {
            normalized[name] = (value - minValue) / range;
        }

        return normalized;
    }

    private categorizeFeature(featureName: string): FeatureImportance['category'] {
        if (featureName.includes('position') || featureName.includes('cell')) return 'positional';
        if (featureName.includes('pattern') || featureName.includes('sequence')) return 'pattern';
        if (featureName.includes('threat') || featureName.includes('danger')) return 'threat';
        if (featureName.includes('opportunity') || featureName.includes('win')) return 'opportunity';
        if (featureName.includes('tactical') || featureName.includes('immediate')) return 'tactical';
        return 'strategic';
    }

    private getFeatureDescription(featureName: string): string {
        const descriptions: { [key: string]: string } = {
            'center_control': 'Control of the center columns',
            'connection_strength': 'Strength of piece connections',
            'threat_detection': 'Detection of immediate threats',
            'winning_opportunity': 'Opportunities to win',
            'positional_advantage': 'Overall positional advantage',
            'pattern_recognition': 'Recognition of strategic patterns'
        };

        return descriptions[featureName] || `Feature: ${featureName}`;
    }

    private extractBoardLocation(featureName: string): [number, number] | undefined {
        const match = featureName.match(/position_(\d+)_(\d+)/);
        if (match) {
            return [parseInt(match[1]), parseInt(match[2])];
        }
        return undefined;
    }

    private calculateVisualWeight(importance: number, allImportances: { [key: string]: number }): number {
        const maxImportance = Math.max(...Object.values(allImportances));
        return maxImportance > 0 ? importance / maxImportance : 0;
    }

    private calculateConfidence(importance: number, allImportances: { [key: string]: number }): number {
        const values = Object.values(allImportances);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

        return stdDev > 0 ? Math.min(1, importance / (mean + stdDev)) : 0.5;
    }

    private getFeatureAverage(featureName: string): number {
        if (this.baselineCache.has(featureName)) {
            return this.baselineCache.get(featureName)!;
        }

        // Calculate average from history
        const average = this.featureHistory.length > 0 ?
            this.featureHistory.reduce((sum, analysis) => {
                const feature = analysis.topFeatures.find(f => f.featureName === featureName);
                return sum + (feature ? feature.importance : 0);
            }, 0) / this.featureHistory.length : 0;

        this.baselineCache.set(featureName, average);
        return average;
    }

    private calculateFeatureTrends(history: FeatureImportanceAnalysis[]): { [key: string]: number } {
        const trends: { [key: string]: number } = {};

        if (history.length < 2) return trends;

        // Calculate trends for top features
        const allFeatures = new Set<string>();
        history.forEach(analysis => {
            analysis.topFeatures.forEach(feature => {
                allFeatures.add(feature.featureName);
            });
        });

        for (const featureName of allFeatures) {
            const values = history.map(analysis => {
                const feature = analysis.topFeatures.find(f => f.featureName === featureName);
                return feature ? feature.importance : 0;
            });

            // Calculate linear trend
            const n = values.length;
            const xSum = (n * (n - 1)) / 2;
            const ySum = values.reduce((sum, val) => sum + val, 0);
            const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
            const xSqSum = (n * (n - 1) * (2 * n - 1)) / 6;

            const slope = (n * xySum - xSum * ySum) / (n * xSqSum - xSum * xSum);
            trends[featureName] = slope;
        }

        return trends;
    }

    private getRandomCellValue(): CellValue {
        const values: CellValue[] = ['Empty', 'Red', 'Yellow'];
        return values[Math.floor(Math.random() * values.length)];
    }

    /**
     * Get feature importance history
     */
    getFeatureHistory(): FeatureImportanceAnalysis[] {
        return [...this.featureHistory];
    }

    /**
     * Get top features across all analyses
     */
    getGlobalTopFeatures(count = 20): FeatureImportance[] {
        const featureAggregation: { [key: string]: { total: number; count: number } } = {};

        this.featureHistory.forEach(analysis => {
            analysis.topFeatures.forEach(feature => {
                if (!featureAggregation[feature.featureName]) {
                    featureAggregation[feature.featureName] = { total: 0, count: 0 };
                }
                featureAggregation[feature.featureName].total += feature.importance;
                featureAggregation[feature.featureName].count += 1;
            });
        });

        const globalFeatures: FeatureImportance[] = [];
        for (const [featureName, aggregation] of Object.entries(featureAggregation)) {
            globalFeatures.push({
                featureName,
                importance: aggregation.total / aggregation.count,
                category: this.categorizeFeature(featureName),
                description: this.getFeatureDescription(featureName),
                confidence: aggregation.count / this.featureHistory.length,
                visualWeight: aggregation.total / aggregation.count
            });
        }

        return globalFeatures.sort((a, b) => b.importance - a.importance).slice(0, count);
    }

    /**
     * Clear analysis history
     */
    clearHistory(): void {
        this.featureHistory = [];
        this.baselineCache.clear();
    }

    /**
     * Export analysis data
     */
    exportAnalysis(): string {
        return JSON.stringify({
            config: this.config,
            history: this.featureHistory,
            globalTopFeatures: this.getGlobalTopFeatures()
        }, null, 2);
    }
}

/**
 * Connect Four Feature Extractor
 */
export class Connect4FeatureExtractor implements FeatureExtractor {
    extractPositionalFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract individual cell features
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const cellValue = board[row][col];
                features[`position_${row}_${col}`] = this.cellValueToNumber(cellValue);
            }
        }

        // Extract column heights
        for (let col = 0; col < 7; col++) {
            let height = 0;
            for (let row = 5; row >= 0; row--) {
                if (board[row][col] !== 'Empty') {
                    height = 6 - row;
                    break;
                }
            }
            features[`column_height_${col}`] = height / 6;
        }

        // Extract center control
        features['center_control'] = this.calculateCenterControl(board);

        // Extract balance
        features['balance'] = this.calculateBalance(board);

        return features;
    }

    extractStrategicFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract connectivity features
        features['horizontal_connections'] = this.countConnections(board, 0, 1);
        features['vertical_connections'] = this.countConnections(board, 1, 0);
        features['diagonal_connections_1'] = this.countConnections(board, 1, 1);
        features['diagonal_connections_2'] = this.countConnections(board, 1, -1);

        // Extract territorial features
        features['territory_red'] = this.calculateTerritory(board, 'Red');
        features['territory_yellow'] = this.calculateTerritory(board, 'Yellow');

        // Extract mobility features
        features['mobility_red'] = this.calculateMobility(board, 'Red');
        features['mobility_yellow'] = this.calculateMobility(board, 'Yellow');

        // Extract development features
        features['development_centralization'] = this.calculateCentralization(board);
        features['development_spread'] = this.calculateSpread(board);

        return features;
    }

    extractTacticalFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract immediate tactical features
        features['immediate_win_red'] = this.hasImmediateWin(board, 'Red') ? 1 : 0;
        features['immediate_win_yellow'] = this.hasImmediateWin(board, 'Yellow') ? 1 : 0;

        // Extract blocking features
        features['blocking_opportunities'] = this.countBlockingOpportunities(board);

        // Extract fork features
        features['fork_opportunities_red'] = this.countForkOpportunities(board, 'Red');
        features['fork_opportunities_yellow'] = this.countForkOpportunities(board, 'Yellow');

        // Extract trap features
        features['trap_setups'] = this.countTrapSetups(board);

        return features;
    }

    extractPatternFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract sequence patterns
        features['three_in_row_red'] = this.countThreeInRow(board, 'Red');
        features['three_in_row_yellow'] = this.countThreeInRow(board, 'Yellow');

        // Extract shape patterns
        features['l_shapes_red'] = this.countLShapes(board, 'Red');
        features['l_shapes_yellow'] = this.countLShapes(board, 'Yellow');

        // Extract strategic patterns
        features['diamond_patterns'] = this.countDiamondPatterns(board);
        features['ladder_patterns'] = this.countLadderPatterns(board);

        return features;
    }

    extractThreatFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract threat levels
        features['threat_level_red'] = this.calculateThreatLevel(board, 'Red');
        features['threat_level_yellow'] = this.calculateThreatLevel(board, 'Yellow');

        // Extract specific threat types
        features['horizontal_threats'] = this.countHorizontalThreats(board);
        features['vertical_threats'] = this.countVerticalThreats(board);
        features['diagonal_threats'] = this.countDiagonalThreats(board);

        // Extract threat urgency
        features['urgent_threats'] = this.countUrgentThreats(board);

        return features;
    }

    extractOpportunityFeatures(board: CellValue[][]): { [key: string]: number } {
        const features: { [key: string]: number } = {};

        // Extract winning opportunities
        features['winning_moves_red'] = this.countWinningMoves(board, 'Red');
        features['winning_moves_yellow'] = this.countWinningMoves(board, 'Yellow');

        // Extract setup opportunities
        features['setup_opportunities'] = this.countSetupOpportunities(board);

        // Extract positional advantages
        features['positional_advantage'] = this.calculatePositionalAdvantage(board);

        return features;
    }

    // Helper methods
    private cellValueToNumber(value: CellValue): number {
        switch (value) {
            case 'Red': return 1;
            case 'Yellow': return -1;
            case 'Empty': return 0;
            default: return 0;
        }
    }

    private calculateCenterControl(board: CellValue[][]): number {
        let control = 0;
        const centerCols = [2, 3, 4];

        for (const col of centerCols) {
            for (let row = 0; row < 6; row++) {
                if (board[row][col] === 'Red') control += 1;
                if (board[row][col] === 'Yellow') control -= 1;
            }
        }

        return control / 18; // Normalize
    }

    private calculateBalance(board: CellValue[][]): number {
        let balance = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] === 'Red') balance += 1;
                if (board[row][col] === 'Yellow') balance -= 1;
            }
        }
        return balance / 42; // Normalize
    }

    private countConnections(board: CellValue[][], dr: number, dc: number): number {
        let connections = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== 'Empty') {
                    const player = board[row][col];
                    let count = 1;

                    // Count in positive direction
                    for (let i = 1; i < 4; i++) {
                        const newRow = row + i * dr;
                        const newCol = col + i * dc;
                        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                            board[newRow][newCol] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }

                    if (count >= 2) {
                        connections += count - 1;
                    }
                }
            }
        }

        return connections;
    }

    private calculateTerritory(board: CellValue[][], player: CellValue): number {
        let territory = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] === player) {
                    // Count influenced squares
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const newRow = row + dr;
                            const newCol = col + dc;
                            if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7) {
                                territory += 0.1;
                            }
                        }
                    }
                }
            }
        }

        return territory / 42; // Normalize
    }

    private calculateMobility(board: CellValue[][], player: CellValue): number {
        let mobility = 0;

        // Count available moves
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                mobility++;
            }
        }

        return mobility / 7; // Normalize
    }

    private calculateCentralization(board: CellValue[][]): number {
        let centralization = 0;
        const center = [2, 3, 4];

        for (const col of center) {
            for (let row = 0; row < 6; row++) {
                if (board[row][col] !== 'Empty') {
                    centralization += 1;
                }
            }
        }

        return centralization / 18; // Normalize
    }

    private calculateSpread(board: CellValue[][]): number {
        const occupiedCols = new Set<number>();

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== 'Empty') {
                    occupiedCols.add(col);
                }
            }
        }

        return occupiedCols.size / 7; // Normalize
    }

    private hasImmediateWin(board: CellValue[][], player: CellValue): boolean {
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                // Find landing row
                let row = 5;
                while (row >= 0 && board[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    // Temporarily place piece
                    board[row][col] = player;
                    const hasWin = this.checkWin(board, row, col, player);
                    board[row][col] = 'Empty'; // Restore

                    if (hasWin) return true;
                }
            }
        }

        return false;
    }

    private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            let count = 1;

            // Count in positive direction
            for (let i = 1; i < 4; i++) {
                const newRow = row + i * dr;
                const newCol = col + i * dc;
                if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                    board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            // Count in negative direction
            for (let i = 1; i < 4; i++) {
                const newRow = row - i * dr;
                const newCol = col - i * dc;
                if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                    board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            if (count >= 4) return true;
        }

        return false;
    }

    private countBlockingOpportunities(board: CellValue[][]): number {
        let opportunities = 0;

        // Count opponent threats that can be blocked
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                let row = 5;
                while (row >= 0 && board[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    // Check if placing here blocks opponent win
                    board[row][col] = 'Red';
                    const blocksYellow = this.hasImmediateWin(board, 'Yellow');
                    board[row][col] = 'Yellow';
                    const blocksRed = this.hasImmediateWin(board, 'Red');
                    board[row][col] = 'Empty';

                    if (blocksYellow || blocksRed) {
                        opportunities++;
                    }
                }
            }
        }

        return opportunities;
    }

    private countForkOpportunities(board: CellValue[][], player: CellValue): number {
        let forks = 0;

        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                let row = 5;
                while (row >= 0 && board[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    board[row][col] = player;

                    // Count winning moves created
                    let winningMoves = 0;
                    for (let testCol = 0; testCol < 7; testCol++) {
                        if (testCol !== col && board[0][testCol] === 'Empty') {
                            let testRow = 5;
                            while (testRow >= 0 && board[testRow][testCol] !== 'Empty') {
                                testRow--;
                            }

                            if (testRow >= 0) {
                                board[testRow][testCol] = player;
                                if (this.checkWin(board, testRow, testCol, player)) {
                                    winningMoves++;
                                }
                                board[testRow][testCol] = 'Empty';
                            }
                        }
                    }

                    if (winningMoves >= 2) {
                        forks++;
                    }

                    board[row][col] = 'Empty';
                }
            }
        }

        return forks;
    }

    private countTrapSetups(board: CellValue[][]): number {
        // Simplified trap counting
        return 0;
    }

    private countThreeInRow(board: CellValue[][], player: CellValue): number {
        let count = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] === player) {
                    for (const [dr, dc] of directions) {
                        let connected = 1;
                        for (let i = 1; i < 3; i++) {
                            const newRow = row + i * dr;
                            const newCol = col + i * dc;
                            if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                                board[newRow][newCol] === player) {
                                connected++;
                            } else {
                                break;
                            }
                        }
                        if (connected >= 3) count++;
                    }
                }
            }
        }

        return count;
    }

    private countLShapes(board: CellValue[][], player: CellValue): number {
        let count = 0;

        // Check L-shaped patterns
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 6; col++) {
                if (board[row][col] === player &&
                    board[row][col + 1] === player &&
                    board[row + 1][col] === player) {
                    count++;
                }
            }
        }

        return count;
    }

    private countDiamondPatterns(board: CellValue[][]): number {
        // Simplified diamond pattern counting
        return 0;
    }

    private countLadderPatterns(board: CellValue[][]): number {
        // Simplified ladder pattern counting
        return 0;
    }

    private calculateThreatLevel(board: CellValue[][], player: CellValue): number {
        let threatLevel = 0;

        // Count immediate threats
        if (this.hasImmediateWin(board, player)) {
            threatLevel += 1.0;
        }

        // Count potential threats
        const threeInRow = this.countThreeInRow(board, player);
        threatLevel += threeInRow * 0.3;

        return Math.min(1, threatLevel);
    }

    private countHorizontalThreats(board: CellValue[][]): number {
        return this.countThreats(board, 0, 1);
    }

    private countVerticalThreats(board: CellValue[][]): number {
        return this.countThreats(board, 1, 0);
    }

    private countDiagonalThreats(board: CellValue[][]): number {
        return this.countThreats(board, 1, 1) + this.countThreats(board, 1, -1);
    }

    private countThreats(board: CellValue[][], dr: number, dc: number): number {
        let threats = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (board[row][col] !== 'Empty') {
                    const player = board[row][col];
                    let count = 1;

                    for (let i = 1; i < 4; i++) {
                        const newRow = row + i * dr;
                        const newCol = col + i * dc;
                        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                            board[newRow][newCol] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }

                    if (count >= 3) threats++;
                }
            }
        }

        return threats;
    }

    private countUrgentThreats(board: CellValue[][]): number {
        let urgentThreats = 0;

        // Count threats that must be addressed immediately
        if (this.hasImmediateWin(board, 'Red')) urgentThreats++;
        if (this.hasImmediateWin(board, 'Yellow')) urgentThreats++;

        return urgentThreats;
    }

    private countWinningMoves(board: CellValue[][], player: CellValue): number {
        let winningMoves = 0;

        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                let row = 5;
                while (row >= 0 && board[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    board[row][col] = player;
                    if (this.checkWin(board, row, col, player)) {
                        winningMoves++;
                    }
                    board[row][col] = 'Empty';
                }
            }
        }

        return winningMoves;
    }

    private countSetupOpportunities(board: CellValue[][]): number {
        let setups = 0;

        // Count moves that create multiple threats
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                let row = 5;
                while (row >= 0 && board[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    board[row][col] = 'Red';
                    const threats = this.countThreats(board, 0, 1) +
                        this.countThreats(board, 1, 0) +
                        this.countThreats(board, 1, 1) +
                        this.countThreats(board, 1, -1);

                    if (threats >= 2) setups++;

                    board[row][col] = 'Empty';
                }
            }
        }

        return setups;
    }

    private calculatePositionalAdvantage(board: CellValue[][]): number {
        let advantage = 0;

        // Calculate various positional factors
        advantage += this.calculateCenterControl(board) * 0.3;
        advantage += this.calculateBalance(board) * 0.2;
        advantage += this.calculateCentralization(board) * 0.2;
        advantage += this.calculateSpread(board) * 0.1;

        return advantage;
    }
}

