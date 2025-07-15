// src/ai/explainability/saliencyMaps.ts
import { CellValue } from '../connect4AI';
import { DecisionTrace } from './decisionTracer';
import { FeatureImportance, FeatureImportanceAnalysis } from './featureImportance';

export interface SaliencyMap {
    algorithm: string;
    timestamp: number;
    boardState: CellValue[][];
    selectedMove: number;
    heatMap: number[][];
    gradientMap?: number[][];
    attentionMap?: number[][];
    occlusionMap?: number[][];
    method: 'gradient' | 'occlusion' | 'attention' | 'integrated_gradients' | 'guided_backprop' | 'feature_importance';
    confidence: number;
    focusRegions: FocusRegion[];
    visualizationData: VisualizationData;
    statistics: SaliencyStatistics;
}

export interface FocusRegion {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    intensity: number;
    type: 'threat' | 'opportunity' | 'strategic' | 'tactical' | 'pattern';
    description: string;
    confidence: number;
}

export interface VisualizationData {
    colorMap: string; // Color scheme for visualization
    normalizationMethod: 'minmax' | 'zscore' | 'sigmoid' | 'softmax';
    intensityRange: [number, number];
    highlightThreshold: number;
    opacity: number;
    overlayData: {
        threats: Array<{ row: number; col: number; level: number }>;
        opportunities: Array<{ row: number; col: number; level: number }>;
        patterns: Array<{ row: number; col: number; type: string }>;
    };
}

export interface SaliencyStatistics {
    maxIntensity: number;
    minIntensity: number;
    meanIntensity: number;
    standardDeviation: number;
    entropy: number;
    focusScore: number;
    spatialVariance: number;
    temporalConsistency?: number;
    coveragePercentage: number;
}

export interface SaliencyConfig {
    method: 'gradient' | 'occlusion' | 'attention' | 'integrated_gradients' | 'guided_backprop' | 'feature_importance';
    smoothingKernel: number;
    normalizeIntensity: boolean;
    highlightThreshold: number;
    colorScheme: 'heat' | 'cool' | 'viridis' | 'plasma' | 'magma';
    showOverlay: boolean;
    overlayOpacity: number;
    temporalSmoothing: boolean;
    spatialSmoothing: boolean;
    adaptiveThreshold: boolean;
}

export interface GradientCalculator {
    calculateGradients(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace
    ): Promise<number[][]>;
}

export interface OcclusionCalculator {
    calculateOcclusion(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        patchSize: number
    ): Promise<number[][]>;
}

export interface AttentionCalculator {
    calculateAttention(
        boardState: CellValue[][],
        selectedMove: number,
        trace?: DecisionTrace
    ): Promise<number[][]>;
}

/**
 * Advanced Saliency Map Generation System
 * 
 * Capabilities:
 * - Multiple saliency calculation methods
 * - Real-time visualization generation
 * - Spatial and temporal smoothing
 * - Focus region detection
 * - Interactive visualization data
 * - Performance optimization
 * - Multi-resolution analysis
 */
export class SaliencyMapGenerator {
    private config: SaliencyConfig;
    private gradientCalculator: GradientCalculator;
    private occlusionCalculator: OcclusionCalculator;
    private attentionCalculator: AttentionCalculator;
    private saliencyHistory: SaliencyMap[] = [];
    private smoothingKernel: number[][];

    constructor(config: Partial<SaliencyConfig> = {}) {
        this.config = {
            method: 'gradient',
            smoothingKernel: 1,
            normalizeIntensity: true,
            highlightThreshold: 0.5,
            colorScheme: 'heat',
            showOverlay: true,
            overlayOpacity: 0.7,
            temporalSmoothing: true,
            spatialSmoothing: true,
            adaptiveThreshold: true,
            ...config
        };

        this.gradientCalculator = new Connect4GradientCalculator();
        this.occlusionCalculator = new Connect4OcclusionCalculator();
        this.attentionCalculator = new Connect4AttentionCalculator();

        this.initializeSmoothingKernel();
    }

    /**
     * Generate saliency map for a decision
     */
    async generateSaliencyMap(
        boardState: CellValue[][],
        selectedMove: number,
        algorithm: string,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace,
        featureImportance?: FeatureImportanceAnalysis
    ): Promise<SaliencyMap> {
        const startTime = Date.now();

        // Calculate base saliency based on method
        let baseHeatMap: number[][];
        let gradientMap: number[][] | undefined;
        let attentionMap: number[][] | undefined;
        let occlusionMap: number[][] | undefined;

        switch (this.config.method) {
            case 'gradient':
                baseHeatMap = await this.gradientCalculator.calculateGradients(
                    boardState, selectedMove, decisionFunction, trace
                );
                gradientMap = baseHeatMap;
                break;

            case 'occlusion':
                baseHeatMap = await this.occlusionCalculator.calculateOcclusion(
                    boardState, selectedMove, decisionFunction, 1
                );
                occlusionMap = baseHeatMap;
                break;

            case 'attention':
                baseHeatMap = await this.attentionCalculator.calculateAttention(
                    boardState, selectedMove, trace
                );
                attentionMap = baseHeatMap;
                break;

            case 'integrated_gradients':
                baseHeatMap = await this.calculateIntegratedGradients(
                    boardState, selectedMove, decisionFunction, trace
                );
                gradientMap = baseHeatMap;
                break;

            case 'guided_backprop':
                baseHeatMap = await this.calculateGuidedBackpropagation(
                    boardState, selectedMove, decisionFunction, trace
                );
                gradientMap = baseHeatMap;
                break;

            case 'feature_importance':
                baseHeatMap = await this.calculateFeatureImportanceSaliency(
                    boardState, selectedMove, featureImportance
                );
                break;

            default:
                baseHeatMap = await this.gradientCalculator.calculateGradients(
                    boardState, selectedMove, decisionFunction, trace
                );
                gradientMap = baseHeatMap;
        }

        // Apply smoothing if enabled
        const smoothedHeatMap = this.config.spatialSmoothing ?
            this.applySpatialSmoothing(baseHeatMap) : baseHeatMap;

        // Apply temporal smoothing if enabled
        const temporallySmoothedHeatMap = this.config.temporalSmoothing ?
            this.applyTemporalSmoothing(smoothedHeatMap, algorithm) : smoothedHeatMap;

        // Normalize intensity if enabled
        const finalHeatMap = this.config.normalizeIntensity ?
            this.normalizeIntensity(temporallySmoothedHeatMap) : temporallySmoothedHeatMap;

        // Detect focus regions
        const focusRegions = this.detectFocusRegions(finalHeatMap, boardState);

        // Generate visualization data
        const visualizationData = this.generateVisualizationData(
            finalHeatMap, boardState, focusRegions, trace
        );

        // Calculate statistics
        const statistics = this.calculateStatistics(finalHeatMap);

        // Calculate confidence
        const confidence = this.calculateConfidence(finalHeatMap, statistics);

        // Create saliency map
        const saliencyMap: SaliencyMap = {
            algorithm,
            timestamp: startTime,
            boardState: boardState.map(row => [...row]),
            selectedMove,
            heatMap: finalHeatMap,
            gradientMap,
            attentionMap,
            occlusionMap,
            method: this.config.method,
            confidence,
            focusRegions,
            visualizationData,
            statistics
        };

        // Add temporal consistency if we have history
        if (this.saliencyHistory.length > 0) {
            statistics.temporalConsistency = this.calculateTemporalConsistency(
                saliencyMap, this.saliencyHistory.slice(-5)
            );
        }

        // Store in history
        this.saliencyHistory.push(saliencyMap);
        if (this.saliencyHistory.length > 100) {
            this.saliencyHistory.shift();
        }

        return saliencyMap;
    }

    /**
     * Calculate integrated gradients saliency
     */
    private async calculateIntegratedGradients(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace
    ): Promise<number[][]> {
        const steps = 50;
        const integratedGradients = this.createEmptyMap();

        // Create baseline (empty board)
        const baseline = this.createEmptyBoard();

        // Integrate gradients along path
        for (let step = 0; step <= steps; step++) {
            const alpha = step / steps;
            const interpolatedBoard = this.interpolateBoards(baseline, boardState, alpha);

            const gradients = await this.gradientCalculator.calculateGradients(
                interpolatedBoard, selectedMove, decisionFunction, trace
            );

            // Accumulate gradients
            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 7; col++) {
                    integratedGradients[row][col] += gradients[row][col];
                }
            }
        }

        // Average and scale by input difference
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const inputDiff = this.cellValueToNumber(boardState[row][col]) -
                    this.cellValueToNumber(baseline[row][col]);
                integratedGradients[row][col] = (integratedGradients[row][col] / steps) * inputDiff;
            }
        }

        return integratedGradients;
    }

    /**
     * Calculate guided backpropagation saliency
     */
    private async calculateGuidedBackpropagation(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace
    ): Promise<number[][]> {
        // Get base gradients
        const baseGradients = await this.gradientCalculator.calculateGradients(
            boardState, selectedMove, decisionFunction, trace
        );

        // Apply guided backpropagation (keep only positive gradients)
        const guidedGradients = this.createEmptyMap();
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                guidedGradients[row][col] = Math.max(0, baseGradients[row][col]);
            }
        }

        return guidedGradients;
    }

    /**
     * Calculate feature importance-based saliency
     */
    private async calculateFeatureImportanceSaliency(
        boardState: CellValue[][],
        selectedMove: number,
        featureImportance?: FeatureImportanceAnalysis
    ): Promise<number[][]> {
        const saliencyMap = this.createEmptyMap();

        if (!featureImportance) {
            return saliencyMap;
        }

        // Map feature importance to board positions
        for (const feature of featureImportance.topFeatures) {
            if (feature.boardLocation) {
                const [row, col] = feature.boardLocation;
                if (row >= 0 && row < 6 && col >= 0 && col < 7) {
                    saliencyMap[row][col] = feature.importance * (feature.visualWeight || 1);
                }
            }
        }

        // Add global feature contributions
        const globalContribution = featureImportance.globalFeatures.reduce(
            (sum, f) => sum + f.importance, 0
        ) / featureImportance.globalFeatures.length;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                saliencyMap[row][col] += globalContribution * 0.1;
            }
        }

        return saliencyMap;
    }

    /**
     * Apply spatial smoothing to reduce noise
     */
    private applySpatialSmoothing(heatMap: number[][]): number[][] {
        const smoothed = this.createEmptyMap();
        const kernelSize = this.config.smoothingKernel;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                let sum = 0;
                let count = 0;

                // Apply smoothing kernel
                for (let kr = -kernelSize; kr <= kernelSize; kr++) {
                    for (let kc = -kernelSize; kc <= kernelSize; kc++) {
                        const newRow = row + kr;
                        const newCol = col + kc;

                        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7) {
                            const weight = this.smoothingKernel[kr + kernelSize][kc + kernelSize];
                            sum += heatMap[newRow][newCol] * weight;
                            count += weight;
                        }
                    }
                }

                smoothed[row][col] = count > 0 ? sum / count : 0;
            }
        }

        return smoothed;
    }

    /**
     * Apply temporal smoothing across recent history
     */
    private applyTemporalSmoothing(heatMap: number[][], algorithm: string): number[][] {
        const recentMaps = this.saliencyHistory
            .filter(map => map.algorithm === algorithm)
            .slice(-3)
            .map(map => map.heatMap);

        if (recentMaps.length === 0) {
            return heatMap;
        }

        const smoothed = this.createEmptyMap();
        const totalWeight = recentMaps.length + 1;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                let sum = heatMap[row][col]; // Current map with weight 1

                // Add weighted contribution from recent maps
                for (let i = 0; i < recentMaps.length; i++) {
                    const weight = 1 / (i + 2); // Decreasing weight for older maps
                    sum += recentMaps[recentMaps.length - 1 - i][row][col] * weight;
                }

                smoothed[row][col] = sum / totalWeight;
            }
        }

        return smoothed;
    }

    /**
     * Normalize intensity values
     */
    private normalizeIntensity(heatMap: number[][]): number[][] {
        const normalized = this.createEmptyMap();
        const values = heatMap.flat();
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const range = maxValue - minValue;

        if (range === 0) {
            return heatMap;
        }

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                normalized[row][col] = (heatMap[row][col] - minValue) / range;
            }
        }

        return normalized;
    }

    /**
     * Detect focus regions in the saliency map
     */
    private detectFocusRegions(heatMap: number[][], boardState: CellValue[][]): FocusRegion[] {
        const focusRegions: FocusRegion[] = [];
        const threshold = this.config.adaptiveThreshold ?
            this.calculateAdaptiveThreshold(heatMap) : this.config.highlightThreshold;

        // Find connected regions above threshold
        const visited = Array(6).fill(null).map(() => Array(7).fill(false));

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (!visited[row][col] && heatMap[row][col] > threshold) {
                    const region = this.expandRegion(heatMap, visited, row, col, threshold);
                    if (region.size > 0) {
                        const focusRegion = this.createFocusRegion(region, heatMap, boardState);
                        focusRegions.push(focusRegion);
                    }
                }
            }
        }

        return focusRegions.sort((a, b) => b.intensity - a.intensity);
    }

    /**
     * Generate visualization data
     */
    private generateVisualizationData(
        heatMap: number[][],
        boardState: CellValue[][],
        focusRegions: FocusRegion[],
        trace?: DecisionTrace
    ): VisualizationData {
        const values = heatMap.flat();
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);

        return {
            colorMap: this.config.colorScheme,
            normalizationMethod: 'minmax',
            intensityRange: [minValue, maxValue],
            highlightThreshold: this.config.highlightThreshold,
            opacity: this.config.overlayOpacity,
            overlayData: {
                threats: this.extractThreats(boardState, trace),
                opportunities: this.extractOpportunities(boardState, trace),
                patterns: this.extractPatterns(boardState, trace)
            }
        };
    }

    /**
     * Calculate saliency statistics
     */
    private calculateStatistics(heatMap: number[][]): SaliencyStatistics {
        const values = heatMap.flat();
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        const variance = values.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);

        // Calculate entropy
        const entropy = this.calculateEntropy(values);

        // Calculate focus score (concentration of high values)
        const topValues = values.sort((a, b) => b - a).slice(0, 10);
        const focusScore = topValues.reduce((sum, val) => sum + val, 0) / values.reduce((sum, val) => sum + val, 0);

        // Calculate spatial variance
        const spatialVariance = this.calculateSpatialVariance(heatMap);

        // Calculate coverage percentage
        const coveragePercentage = values.filter(val => val > 0.1).length / values.length;

        return {
            maxIntensity: maxValue,
            minIntensity: minValue,
            meanIntensity: meanValue,
            standardDeviation,
            entropy,
            focusScore,
            spatialVariance,
            coveragePercentage
        };
    }

    /**
     * Calculate confidence in saliency map
     */
    private calculateConfidence(heatMap: number[][], statistics: SaliencyStatistics): number {
        let confidence = 0;

        // Higher confidence for more focused maps
        confidence += statistics.focusScore * 0.3;

        // Higher confidence for maps with clear patterns
        confidence += (1 - statistics.entropy) * 0.2;

        // Higher confidence for maps with reasonable coverage
        confidence += Math.min(statistics.coveragePercentage * 2, 1) * 0.3;

        // Higher confidence for maps with good spatial structure
        confidence += (1 - statistics.spatialVariance) * 0.2;

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Calculate temporal consistency
     */
    private calculateTemporalConsistency(
        currentMap: SaliencyMap,
        recentMaps: SaliencyMap[]
    ): number {
        if (recentMaps.length === 0) return 0;

        let totalConsistency = 0;
        let count = 0;

        for (const prevMap of recentMaps) {
            const consistency = this.calculateMapSimilarity(
                currentMap.heatMap, prevMap.heatMap
            );
            totalConsistency += consistency;
            count++;
        }

        return count > 0 ? totalConsistency / count : 0;
    }

    // Helper methods
    private initializeSmoothingKernel(): void {
        const size = this.config.smoothingKernel * 2 + 1;
        this.smoothingKernel = Array(size).fill(null).map(() => Array(size).fill(0));

        // Gaussian kernel
        const sigma = this.config.smoothingKernel / 2;
        let sum = 0;

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const x = i - this.config.smoothingKernel;
                const y = j - this.config.smoothingKernel;
                const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
                this.smoothingKernel[i][j] = value;
                sum += value;
            }
        }

        // Normalize
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                this.smoothingKernel[i][j] /= sum;
            }
        }
    }

    private createEmptyMap(): number[][] {
        return Array(6).fill(null).map(() => Array(7).fill(0));
    }

    private createEmptyBoard(): CellValue[][] {
        return Array(6).fill(null).map(() => Array(7).fill('Empty'));
    }

    private interpolateBoards(
        baseline: CellValue[][],
        target: CellValue[][],
        alpha: number
    ): CellValue[][] {
        const interpolated = this.createEmptyBoard();

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const baseValue = this.cellValueToNumber(baseline[row][col]);
                const targetValue = this.cellValueToNumber(target[row][col]);
                const interpolatedValue = baseValue + alpha * (targetValue - baseValue);

                interpolated[row][col] = this.numberToCellValue(interpolatedValue);
            }
        }

        return interpolated;
    }

    private cellValueToNumber(value: CellValue): number {
        switch (value) {
            case 'Red': return 1;
            case 'Yellow': return -1;
            case 'Empty': return 0;
            default: return 0;
        }
    }

    private numberToCellValue(value: number): CellValue {
        if (value > 0.5) return 'Red';
        if (value < -0.5) return 'Yellow';
        return 'Empty';
    }

    private calculateAdaptiveThreshold(heatMap: number[][]): number {
        const values = heatMap.flat();
        const sortedValues = values.sort((a, b) => b - a);
        const topPercentile = Math.floor(sortedValues.length * 0.2); // Top 20%
        return sortedValues[topPercentile];
    }

    private expandRegion(
        heatMap: number[][],
        visited: boolean[][],
        startRow: number,
        startCol: number,
        threshold: number
    ): Set<string> {
        const region = new Set<string>();
        const queue = [[startRow, startCol]];
        visited[startRow][startCol] = true;

        while (queue.length > 0) {
            const [row, col] = queue.shift()!;
            region.add(`${row},${col}`);

            // Check neighbors
            const neighbors = [
                [row - 1, col], [row + 1, col],
                [row, col - 1], [row, col + 1]
            ];

            for (const [newRow, newCol] of neighbors) {
                if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                    !visited[newRow][newCol] && heatMap[newRow][newCol] > threshold) {
                    visited[newRow][newCol] = true;
                    queue.push([newRow, newCol]);
                }
            }
        }

        return region;
    }

    private createFocusRegion(
        region: Set<string>,
        heatMap: number[][],
        boardState: CellValue[][]
    ): FocusRegion {
        const positions = Array.from(region).map(pos => {
            const [row, col] = pos.split(',').map(Number);
            return { row, col, intensity: heatMap[row][col] };
        });

        const minRow = Math.min(...positions.map(p => p.row));
        const maxRow = Math.max(...positions.map(p => p.row));
        const minCol = Math.min(...positions.map(p => p.col));
        const maxCol = Math.max(...positions.map(p => p.col));

        const avgIntensity = positions.reduce((sum, p) => sum + p.intensity, 0) / positions.length;
        const type = this.classifyRegionType(minRow, minCol, maxRow, maxCol, boardState);

        return {
            startRow: minRow,
            startCol: minCol,
            endRow: maxRow,
            endCol: maxCol,
            intensity: avgIntensity,
            type,
            description: this.generateRegionDescription(type, minRow, minCol, maxRow, maxCol),
            confidence: Math.min(1, avgIntensity * positions.length / 10)
        };
    }

    private classifyRegionType(
        minRow: number,
        minCol: number,
        maxRow: number,
        maxCol: number,
        boardState: CellValue[][]
    ): FocusRegion['type'] {
        // Analyze the region to determine its type
        let redCount = 0;
        let yellowCount = 0;
        let emptyCount = 0;

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                switch (boardState[row][col]) {
                    case 'Red': redCount++; break;
                    case 'Yellow': yellowCount++; break;
                    case 'Empty': emptyCount++; break;
                }
            }
        }

        // Simple heuristic classification
        if (emptyCount === 0) return 'tactical';
        if (redCount > yellowCount * 2 || yellowCount > redCount * 2) return 'threat';
        if (minCol >= 2 && maxCol <= 4) return 'strategic';
        if (maxRow - minRow >= 2 || maxCol - minCol >= 2) return 'pattern';
        return 'opportunity';
    }

    private generateRegionDescription(
        type: FocusRegion['type'],
        minRow: number,
        minCol: number,
        maxRow: number,
        maxCol: number
    ): string {
        const descriptions = {
            threat: `Threat region at rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`,
            opportunity: `Opportunity region at rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`,
            strategic: `Strategic region at rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`,
            tactical: `Tactical region at rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`,
            pattern: `Pattern region at rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`
        };

        return descriptions[type];
    }

    private extractThreats(
        boardState: CellValue[][],
        trace?: DecisionTrace
    ): Array<{ row: number; col: number; level: number }> {
        const threats: Array<{ row: number; col: number; level: number }> = [];

        if (trace?.threatAnalysis) {
            for (const threat of trace.threatAnalysis.threateningPositions) {
                const [row, col] = threat.position;
                threats.push({ row, col, level: threat.severity });
            }
        }

        return threats;
    }

    private extractOpportunities(
        boardState: CellValue[][],
        trace?: DecisionTrace
    ): Array<{ row: number; col: number; level: number }> {
        const opportunities: Array<{ row: number; col: number; level: number }> = [];

        if (trace?.opportunityAnalysis) {
            for (const opportunity of trace.opportunityAnalysis.winningPositions) {
                const [row, col] = opportunity.position;
                opportunities.push({ row, col, level: opportunity.probability });
            }
        }

        return opportunities;
    }

    private extractPatterns(
        boardState: CellValue[][],
        trace?: DecisionTrace
    ): Array<{ row: number; col: number; type: string }> {
        const patterns: Array<{ row: number; col: number; type: string }> = [];

        if (trace?.positionalAnalysis) {
            for (const pattern of trace.positionalAnalysis.strategicPatterns) {
                const [row, col] = pattern.location;
                patterns.push({ row, col, type: pattern.pattern });
            }
        }

        return patterns;
    }

    private calculateEntropy(values: number[]): number {
        const histogram = new Map<number, number>();
        const binSize = 0.1;

        // Create histogram
        for (const value of values) {
            const bin = Math.floor(value / binSize) * binSize;
            histogram.set(bin, (histogram.get(bin) || 0) + 1);
        }

        // Calculate entropy
        let entropy = 0;
        const total = values.length;

        for (const count of histogram.values()) {
            const probability = count / total;
            if (probability > 0) {
                entropy -= probability * Math.log2(probability);
            }
        }

        return entropy;
    }

    private calculateSpatialVariance(heatMap: number[][]): number {
        let totalVariance = 0;
        let count = 0;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 6; col++) {
                const neighbors = [
                    heatMap[row][col], heatMap[row][col + 1],
                    heatMap[row + 1][col], heatMap[row + 1][col + 1]
                ];

                const mean = neighbors.reduce((sum, val) => sum + val, 0) / neighbors.length;
                const variance = neighbors.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / neighbors.length;

                totalVariance += variance;
                count++;
            }
        }

        return count > 0 ? totalVariance / count : 0;
    }

    private calculateMapSimilarity(map1: number[][], map2: number[][]): number {
        let totalDifference = 0;
        let count = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const difference = Math.abs(map1[row][col] - map2[row][col]);
                totalDifference += difference;
                count++;
            }
        }

        const avgDifference = totalDifference / count;
        return Math.max(0, 1 - avgDifference); // Convert difference to similarity
    }

    /**
     * Generate interactive visualization HTML
     */
    generateVisualization(saliencyMap: SaliencyMap): string {
        const { heatMap, visualizationData, focusRegions } = saliencyMap;

        let html = `
        <div class="saliency-visualization">
            <div class="board-container">
                <div class="board-grid">
        `;

        // Generate grid cells
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const intensity = heatMap[row][col];
                const opacity = intensity * visualizationData.opacity;
                const color = this.getColorForIntensity(intensity, visualizationData.colorMap);

                html += `
                    <div class="grid-cell" 
                         data-row="${row}" 
                         data-col="${col}" 
                         data-intensity="${intensity.toFixed(3)}"
                         style="background-color: ${color}; opacity: ${opacity};">
                        ${saliencyMap.boardState[row][col] === 'Empty' ? '' :
                        saliencyMap.boardState[row][col].charAt(0)}
                    </div>
                `;
            }
        }

        html += `
                </div>
            </div>
            <div class="focus-regions">
                <h3>Focus Regions</h3>
                <ul>
        `;

        // Add focus regions
        for (const region of focusRegions) {
            html += `
                <li class="focus-region ${region.type}">
                    <strong>${region.type.toUpperCase()}</strong>: ${region.description}
                    <br>Intensity: ${region.intensity.toFixed(3)}, Confidence: ${region.confidence.toFixed(3)}
                </li>
            `;
        }

        html += `
                </ul>
            </div>
            <div class="statistics">
                <h3>Statistics</h3>
                <p>Max Intensity: ${saliencyMap.statistics.maxIntensity.toFixed(3)}</p>
                <p>Focus Score: ${saliencyMap.statistics.focusScore.toFixed(3)}</p>
                <p>Coverage: ${(saliencyMap.statistics.coveragePercentage * 100).toFixed(1)}%</p>
                <p>Confidence: ${saliencyMap.confidence.toFixed(3)}</p>
            </div>
        </div>
        `;

        return html;
    }

    private getColorForIntensity(intensity: number, colorScheme: string): string {
        const schemes = {
            heat: ['#000000', '#440000', '#880000', '#cc0000', '#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffff00'],
            cool: ['#000000', '#001144', '#002288', '#0033cc', '#0044ff', '#4477ff', '#88aaff', '#ccddff', '#ffffff'],
            viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
            plasma: ['#0c0786', '#40039c', '#6a00a7', '#8f0da4', '#b12a90', '#cc4778', '#e16462', '#f2844b', '#fca635'],
            magma: ['#000003', '#0c0926', '#231151', '#410f75', '#5f187f', '#7b2382', '#982d80', '#b73779', '#d3436e']
        };

        const colors = schemes[colorScheme as keyof typeof schemes] || schemes.heat;
        const index = Math.floor(intensity * (colors.length - 1));
        return colors[Math.max(0, Math.min(colors.length - 1, index))];
    }

    /**
     * Export saliency map data
     */
    exportSaliencyMap(saliencyMap: SaliencyMap): string {
        return JSON.stringify(saliencyMap, null, 2);
    }

    /**
     * Get saliency history
     */
    getSaliencyHistory(): SaliencyMap[] {
        return [...this.saliencyHistory];
    }

    /**
     * Clear saliency history
     */
    clearHistory(): void {
        this.saliencyHistory = [];
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SaliencyConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.initializeSmoothingKernel();
    }
}

/**
 * Connect Four Gradient Calculator
 */
export class Connect4GradientCalculator implements GradientCalculator {
    async calculateGradients(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        trace?: DecisionTrace
    ): Promise<number[][]> {
        const gradients = Array(6).fill(null).map(() => Array(7).fill(0));

        // Use neural network gradients if available
        if (trace?.neuralNetworkTrace?.gradients) {
            // Convert neural network gradients to board gradients
            return this.convertNeuralGradients(trace.neuralNetworkTrace.gradients, boardState);
        }

        // Calculate numerical gradients
        const baseResult = await decisionFunction(boardState);
        const epsilon = 0.01;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const originalValue = boardState[row][col];

                // Calculate gradient by perturbation
                const perturbedBoard = boardState.map(r => [...r]);
                perturbedBoard[row][col] = this.perturbCell(originalValue, epsilon);

                const perturbedResult = await decisionFunction(perturbedBoard);
                const gradient = (perturbedResult.score - baseResult.score) / epsilon;

                gradients[row][col] = Math.abs(gradient);
            }
        }

        return gradients;
    }

    private convertNeuralGradients(
        neuralGradients: { [layer: string]: number[] },
        boardState: CellValue[][]
    ): number[][] {
        const gradients = Array(6).fill(null).map(() => Array(7).fill(0));

        // Assuming input layer gradients correspond to board positions
        const inputGradients = neuralGradients['input'] || neuralGradients['layer_0'];

        if (inputGradients && inputGradients.length === 42) {
            for (let i = 0; i < 42; i++) {
                const row = Math.floor(i / 7);
                const col = i % 7;
                gradients[row][col] = Math.abs(inputGradients[i]);
            }
        }

        return gradients;
    }

    private perturbCell(value: CellValue, epsilon: number): CellValue {
        const numValue = this.cellValueToNumber(value);
        const perturbedValue = numValue + epsilon;
        return this.numberToCellValue(perturbedValue);
    }

    private cellValueToNumber(value: CellValue): number {
        switch (value) {
            case 'Red': return 1;
            case 'Yellow': return -1;
            case 'Empty': return 0;
            default: return 0;
        }
    }

    private numberToCellValue(value: number): CellValue {
        if (value > 0.5) return 'Red';
        if (value < -0.5) return 'Yellow';
        return 'Empty';
    }
}

/**
 * Connect Four Occlusion Calculator
 */
export class Connect4OcclusionCalculator implements OcclusionCalculator {
    async calculateOcclusion(
        boardState: CellValue[][],
        selectedMove: number,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>,
        patchSize: number
    ): Promise<number[][]> {
        const occlusion = Array(6).fill(null).map(() => Array(7).fill(0));

        // Get baseline score
        const baseResult = await decisionFunction(boardState);
        const baseScore = baseResult.score;

        // Test occlusion for each position
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const occludedBoard = this.occludePosition(boardState, row, col, patchSize);
                const occludedResult = await decisionFunction(occludedBoard);
                const importanceDiff = Math.abs(baseScore - occludedResult.score);

                occlusion[row][col] = importanceDiff;
            }
        }

        return occlusion;
    }

    private occludePosition(
        boardState: CellValue[][],
        centerRow: number,
        centerCol: number,
        patchSize: number
    ): CellValue[][] {
        const occluded = boardState.map(row => [...row]);
        const halfPatch = Math.floor(patchSize / 2);

        for (let row = centerRow - halfPatch; row <= centerRow + halfPatch; row++) {
            for (let col = centerCol - halfPatch; col <= centerCol + halfPatch; col++) {
                if (row >= 0 && row < 6 && col >= 0 && col < 7) {
                    occluded[row][col] = 'Empty';
                }
            }
        }

        return occluded;
    }
}

/**
 * Connect Four Attention Calculator
 */
export class Connect4AttentionCalculator implements AttentionCalculator {
    async calculateAttention(
        boardState: CellValue[][],
        selectedMove: number,
        trace?: DecisionTrace
    ): Promise<number[][]> {
        const attention = Array(6).fill(null).map(() => Array(7).fill(0));

        // Use attention weights from neural network if available
        if (trace?.neuralNetworkTrace?.attentionWeights) {
            return this.convertAttentionWeights(trace.neuralNetworkTrace.attentionWeights);
        }

        // Fallback: calculate attention based on strategic importance
        return this.calculateStrategicAttention(boardState, selectedMove);
    }

    private convertAttentionWeights(attentionWeights: number[][]): number[][] {
        const attention = Array(6).fill(null).map(() => Array(7).fill(0));

        // Assuming attention weights are in board format
        if (attentionWeights.length === 6 && attentionWeights[0].length === 7) {
            return attentionWeights;
        }

        // Convert from flattened format
        if (attentionWeights[0].length === 42) {
            for (let i = 0; i < 42; i++) {
                const row = Math.floor(i / 7);
                const col = i % 7;
                attention[row][col] = attentionWeights[0][i];
            }
        }

        return attention;
    }

    private calculateStrategicAttention(
        boardState: CellValue[][],
        selectedMove: number
    ): Promise<number[][]> {
        const attention = Array(6).fill(null).map(() => Array(7).fill(0));

        // Calculate attention based on strategic factors
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                let score = 0;

                // Center control
                if (col >= 2 && col <= 4) score += 0.3;

                // Existing pieces
                if (boardState[row][col] !== 'Empty') score += 0.2;

                // Proximity to selected move
                const distance = Math.abs(col - selectedMove);
                score += Math.max(0, 0.5 - distance * 0.1);

                // Threat/opportunity positions
                if (this.isStrategicPosition(boardState, row, col)) {
                    score += 0.4;
                }

                attention[row][col] = score;
            }
        }

        return Promise.resolve(attention);
    }

    private isStrategicPosition(boardState: CellValue[][], row: number, col: number): boolean {
        // Check if position is part of a strategic pattern
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            let count = 0;
            for (let i = -1; i <= 1; i++) {
                const newRow = row + i * dr;
                const newCol = col + i * dc;
                if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                    boardState[newRow][newCol] !== 'Empty') {
                    count++;
                }
            }
            if (count >= 2) return true;
        }

        return false;
    }
}

