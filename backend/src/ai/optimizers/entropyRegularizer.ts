/**
 * Entropy Regularization Implementation
 * 
 * Entropy regularization is a technique used in reinforcement learning to encourage
 * exploration by adding an entropy term to the loss function. This prevents the
 * policy from becoming overly deterministic too quickly, leading to better exploration
 * and improved final performance.
 * 
 * Features:
 * - Multiple entropy calculation methods
 * - Adaptive entropy coefficient scheduling
 * - Support for discrete and continuous action spaces
 * - Policy diversity monitoring
 * - Temperature-based scaling
 * - Curriculum learning integration
 * - Comprehensive statistics tracking
 * 
 * @author Connect4 AI Team
 */

export interface EntropyRegularizerConfig {
    // Core entropy parameters
    initialCoefficient: number;     // Initial entropy coefficient
    targetEntropy: number;          // Target entropy value

    // Scheduling strategy
    schedule: {
        type: 'constant' | 'linear' | 'exponential' | 'cosine' | 'adaptive';
        startStep: number;
        endStep: number;
        minCoefficient: number;
        maxCoefficient: number;
        decayRate: number;
    };

    // Entropy calculation method
    entropyMethod: {
        type: 'categorical' | 'gaussian' | 'beta' | 'mixed';
        temperature: number;            // Temperature for softmax
        clampMin: number;              // Minimum probability for numerical stability
        clampMax: number;              // Maximum probability
        normalizeWeights: boolean;     // Whether to normalize action weights
    };

    // Adaptive mechanisms
    adaptive: {
        enabled: boolean;
        targetKLDivergence: number;    // Target KL divergence for adaptation
        adaptationRate: number;        // How quickly to adapt coefficient
        windowSize: number;            // Window size for moving averages
        toleranceRange: number;        // Tolerance range around target
    };

    // Monitoring and statistics
    monitoring: {
        enabled: boolean;
        logInterval: number;           // Steps between logging
        trackDiversity: boolean;       // Track policy diversity metrics
        trackConvergence: boolean;     // Track convergence metrics
        historySize: number;           // Size of history buffer
    };

    // Performance optimization
    performance: {
        batchSize: number;             // Batch size for calculations
        useApproximation: boolean;     // Use approximation for speed
        parallelization: boolean;      // Enable parallel processing
        memoryOptimization: boolean;   // Optimize memory usage
    };
}

export interface EntropyState {
    // Current state
    currentCoefficient: number;
    currentEntropy: number;
    targetEntropy: number;
    step: number;

    // History tracking
    history: {
        coefficients: number[];
        entropies: number[];
        klDivergences: number[];
        policyDiversities: number[];
        convergenceMetrics: number[];
        timestamps: number[];
    };

    // Statistics
    statistics: {
        averageEntropy: number;
        entropyVariance: number;
        policyDiversity: number;
        explorationRate: number;
        convergenceRate: number;
        adaptationRate: number;
        lastUpdateTime: number;
    };

    // Performance metrics
    metrics: {
        totalCalculations: number;
        totalTime: number;
        averageCalculationTime: number;
        memoryUsage: number;
        approximationError: number;
    };
}

export class EntropyRegularizer {
    private config: EntropyRegularizerConfig;
    private state: EntropyState;
    private movingAverages: Map<string, number[]>;

    constructor(config: Partial<EntropyRegularizerConfig> = {}) {
        this.config = {
            initialCoefficient: 0.01,
            targetEntropy: -1.0,
            schedule: {
                type: 'exponential',
                startStep: 0,
                endStep: 100000,
                minCoefficient: 0.001,
                maxCoefficient: 0.1,
                decayRate: 0.995
            },
            entropyMethod: {
                type: 'categorical',
                temperature: 1.0,
                clampMin: 1e-8,
                clampMax: 1.0,
                normalizeWeights: true
            },
            adaptive: {
                enabled: true,
                targetKLDivergence: 0.01,
                adaptationRate: 0.001,
                windowSize: 100,
                toleranceRange: 0.1
            },
            monitoring: {
                enabled: true,
                logInterval: 1000,
                trackDiversity: true,
                trackConvergence: true,
                historySize: 10000
            },
            performance: {
                batchSize: 64,
                useApproximation: false,
                parallelization: false,
                memoryOptimization: true
            },
            ...config
        };

        this.state = {
            currentCoefficient: this.config.initialCoefficient,
            currentEntropy: 0,
            targetEntropy: this.config.targetEntropy,
            step: 0,
            history: {
                coefficients: [],
                entropies: [],
                klDivergences: [],
                policyDiversities: [],
                convergenceMetrics: [],
                timestamps: []
            },
            statistics: {
                averageEntropy: 0,
                entropyVariance: 0,
                policyDiversity: 0,
                explorationRate: 0,
                convergenceRate: 0,
                adaptationRate: 0,
                lastUpdateTime: 0
            },
            metrics: {
                totalCalculations: 0,
                totalTime: 0,
                averageCalculationTime: 0,
                memoryUsage: 0,
                approximationError: 0
            }
        };

        this.movingAverages = new Map();
    }

    /**
     * Calculate entropy for categorical (discrete) action distributions
     */
    calculateCategoricalEntropy(probabilities: number[]): number {
        const startTime = performance.now();

        try {
            const { clampMin, clampMax, temperature } = this.config.entropyMethod;

            // Apply temperature scaling
            const scaledProbs = probabilities.map(p => Math.pow(p, 1 / temperature));
            const sum = scaledProbs.reduce((a, b) => a + b, 0);
            const normalizedProbs = scaledProbs.map(p => p / sum);

            // Calculate entropy: H = -sum(p * log(p))
            let entropy = 0;
            for (const p of normalizedProbs) {
                const clampedP = Math.max(clampMin, Math.min(clampMax, p));
                entropy -= clampedP * Math.log(clampedP);
            }

            this.updateMetrics(performance.now() - startTime);
            return entropy;

        } catch (error) {
            console.warn('Error calculating categorical entropy:', error);
            return 0;
        }
    }

    /**
     * Calculate entropy for continuous action distributions (Gaussian)
     */
    calculateGaussianEntropy(means: number[], stdDevs: number[]): number {
        const startTime = performance.now();

        try {
            // For multivariate Gaussian: H = 0.5 * log(2π * e * det(Σ))
            // For diagonal covariance: H = 0.5 * sum(log(2π * e * σ²))
            let entropy = 0;
            const constant = 0.5 * Math.log(2 * Math.PI * Math.E);

            for (let i = 0; i < means.length; i++) {
                const variance = stdDevs[i] * stdDevs[i];
                entropy += constant + 0.5 * Math.log(variance);
            }

            this.updateMetrics(performance.now() - startTime);
            return entropy;

        } catch (error) {
            console.warn('Error calculating Gaussian entropy:', error);
            return 0;
        }
    }

    /**
     * Calculate entropy for beta distributions
     */
    calculateBetaEntropy(alphas: number[], betas: number[]): number {
        const startTime = performance.now();

        try {
            // Beta entropy: H = log(B(α,β)) - (α-1)*ψ(α) - (β-1)*ψ(β) + (α+β-2)*ψ(α+β)
            let entropy = 0;

            for (let i = 0; i < alphas.length; i++) {
                const alpha = alphas[i];
                const beta = betas[i];

                // Approximate calculation using simpler formula
                const logBeta = this.logBetaFunction(alpha, beta);
                const digammaAlpha = this.digammaApproximation(alpha);
                const digammaBeta = this.digammaApproximation(beta);
                const digammaSum = this.digammaApproximation(alpha + beta);

                entropy += logBeta - (alpha - 1) * digammaAlpha - (beta - 1) * digammaBeta + (alpha + beta - 2) * digammaSum;
            }

            this.updateMetrics(performance.now() - startTime);
            return entropy;

        } catch (error) {
            console.warn('Error calculating Beta entropy:', error);
            return 0;
        }
    }

    /**
     * Calculate entropy regularization loss
     */
    calculateEntropyLoss(
        actionDistribution: number[] | { means: number[], stdDevs: number[] } | { alphas: number[], betas: number[] },
        actionType: 'categorical' | 'gaussian' | 'beta' = 'categorical'
    ): { loss: number; entropy: number; coefficient: number } {
        let entropy = 0;

        // Calculate entropy based on action type
        switch (actionType) {
            case 'categorical':
                entropy = this.calculateCategoricalEntropy(actionDistribution as number[]);
                break;
            case 'gaussian':
                const gaussian = actionDistribution as { means: number[], stdDevs: number[] };
                entropy = this.calculateGaussianEntropy(gaussian.means, gaussian.stdDevs);
                break;
            case 'beta':
                const beta = actionDistribution as { alphas: number[], betas: number[] };
                entropy = this.calculateBetaEntropy(beta.alphas, beta.betas);
                break;
        }

        // Update current entropy
        this.state.currentEntropy = entropy;

        // Get current coefficient
        const coefficient = this.getCurrentCoefficient();

        // Calculate entropy loss (negative entropy for maximization)
        const loss = -coefficient * entropy;

        return { loss, entropy, coefficient };
    }

    /**
     * Update entropy coefficient based on scheduling strategy
     */
    updateCoefficient(): void {
        this.state.step++;

        const { schedule } = this.config;
        const { step } = this.state;

        let newCoefficient = this.state.currentCoefficient;

        switch (schedule.type) {
            case 'constant':
                newCoefficient = this.config.initialCoefficient;
                break;

            case 'linear':
                if (step >= schedule.startStep && step <= schedule.endStep) {
                    const progress = (step - schedule.startStep) / (schedule.endStep - schedule.startStep);
                    newCoefficient = schedule.maxCoefficient - progress * (schedule.maxCoefficient - schedule.minCoefficient);
                }
                break;

            case 'exponential':
                if (step >= schedule.startStep) {
                    newCoefficient = Math.max(
                        schedule.minCoefficient,
                        this.config.initialCoefficient * Math.pow(schedule.decayRate, step - schedule.startStep)
                    );
                }
                break;

            case 'cosine':
                if (step >= schedule.startStep && step <= schedule.endStep) {
                    const progress = (step - schedule.startStep) / (schedule.endStep - schedule.startStep);
                    newCoefficient = schedule.minCoefficient +
                        0.5 * (schedule.maxCoefficient - schedule.minCoefficient) * (1 + Math.cos(Math.PI * progress));
                }
                break;

            case 'adaptive':
                newCoefficient = this.adaptiveUpdate();
                break;
        }

        this.state.currentCoefficient = newCoefficient;

        // Update statistics
        this.updateStatistics();
    }

    /**
     * Adaptive coefficient update based on KL divergence
     */
    private adaptiveUpdate(): number {
        const { adaptive } = this.config;
        const { history } = this.state;

        if (!adaptive.enabled || history.klDivergences.length < adaptive.windowSize) {
            return this.state.currentCoefficient;
        }

        // Calculate average KL divergence over window
        const recentKLs = history.klDivergences.slice(-adaptive.windowSize);
        const avgKL = recentKLs.reduce((a, b) => a + b, 0) / recentKLs.length;

        // Calculate adaptation direction
        const klError = avgKL - adaptive.targetKLDivergence;
        const adaptationStep = adaptive.adaptationRate * klError;

        // Update coefficient
        const newCoefficient = Math.max(
            this.config.schedule.minCoefficient,
            Math.min(
                this.config.schedule.maxCoefficient,
                this.state.currentCoefficient - adaptationStep
            )
        );

        return newCoefficient;
    }

    /**
     * Add KL divergence measurement for adaptive scheduling
     */
    addKLDivergence(klDivergence: number): void {
        const { history } = this.state;
        const { historySize } = this.config.monitoring;

        if (history.klDivergences.length >= historySize) {
            history.klDivergences.shift();
        }

        history.klDivergences.push(klDivergence);
    }

    /**
     * Calculate policy diversity metrics
     */
    calculatePolicyDiversity(
        actionDistributions: number[][],
        previousDistributions?: number[][]
    ): number {
        if (!this.config.monitoring.trackDiversity) {
            return 0;
        }

        try {
            // Calculate average entropy across all distributions
            const entropies = actionDistributions.map(dist => this.calculateCategoricalEntropy(dist));
            const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;

            // Calculate KL divergence between distributions
            let totalKL = 0;
            let comparisons = 0;

            for (let i = 0; i < actionDistributions.length; i++) {
                for (let j = i + 1; j < actionDistributions.length; j++) {
                    totalKL += this.calculateKLDivergence(actionDistributions[i], actionDistributions[j]);
                    comparisons++;
                }
            }

            const avgKL = comparisons > 0 ? totalKL / comparisons : 0;

            // Combine entropy and KL divergence for diversity score
            const diversity = avgEntropy + avgKL;

            this.state.statistics.policyDiversity = diversity;
            return diversity;

        } catch (error) {
            console.warn('Error calculating policy diversity:', error);
            return 0;
        }
    }

    /**
     * Calculate KL divergence between two probability distributions
     */
    private calculateKLDivergence(p: number[], q: number[]): number {
        const { clampMin } = this.config.entropyMethod;
        let kl = 0;

        for (let i = 0; i < p.length; i++) {
            const pi = Math.max(clampMin, p[i]);
            const qi = Math.max(clampMin, q[i]);
            kl += pi * Math.log(pi / qi);
        }

        return kl;
    }

    /**
     * Get current entropy coefficient
     */
    getCurrentCoefficient(): number {
        return this.state.currentCoefficient;
    }

    /**
     * Get current entropy value
     */
    getCurrentEntropy(): number {
        return this.state.currentEntropy;
    }

    /**
     * Update statistics
     */
    private updateStatistics(): void {
        const { history, statistics } = this.state;
        const { historySize } = this.config.monitoring;

        // Add to history
        if (history.coefficients.length >= historySize) {
            history.coefficients.shift();
            history.entropies.shift();
            history.timestamps.shift();
        }

        history.coefficients.push(this.state.currentCoefficient);
        history.entropies.push(this.state.currentEntropy);
        history.timestamps.push(Date.now());

        // Calculate statistics
        if (history.entropies.length > 0) {
            const entropies = history.entropies;
            statistics.averageEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;

            const variance = entropies.reduce((sum, e) => sum + Math.pow(e - statistics.averageEntropy, 2), 0) / entropies.length;
            statistics.entropyVariance = variance;

            // Calculate exploration rate (based on entropy relative to maximum)
            const maxEntropy = Math.log(7); // For Connect4 (7 columns)
            statistics.explorationRate = Math.max(0, Math.min(1, statistics.averageEntropy / maxEntropy));
        }

        statistics.lastUpdateTime = Date.now();
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(calculationTime: number): void {
        const { metrics } = this.state;

        metrics.totalCalculations++;
        metrics.totalTime += calculationTime;
        metrics.averageCalculationTime = metrics.totalTime / metrics.totalCalculations;

        // Estimate memory usage
        const baseMemory = 1024; // Base memory usage
        const historyMemory = this.state.history.entropies.length * 8; // 8 bytes per number
        metrics.memoryUsage = baseMemory + historyMemory;
    }

    /**
     * Helper functions for mathematical calculations
     */
    private logBetaFunction(alpha: number, beta: number): number {
        return this.logGamma(alpha) + this.logGamma(beta) - this.logGamma(alpha + beta);
    }

    private logGamma(x: number): number {
        // Stirling's approximation for log(Γ(x))
        return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI);
    }

    private digammaApproximation(x: number): number {
        // Simple approximation for digamma function
        return Math.log(x) - 1 / (2 * x);
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics(): {
        config: EntropyRegularizerConfig;
        state: {
            step: number;
            currentCoefficient: number;
            currentEntropy: number;
            targetEntropy: number;
        };
        statistics: EntropyState['statistics'];
        performance: EntropyState['metrics'];
        history: {
            coefficients: number[];
            entropies: number[];
            recentTrend: 'increasing' | 'decreasing' | 'stable';
        };
    } {
        const { history } = this.state;

        // Calculate recent trend
        let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (history.entropies.length >= 10) {
            const recent = history.entropies.slice(-10);
            const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const secondHalf = recent.slice(5).reduce((a, b) => a + b, 0) / 5;

            if (secondHalf > firstHalf * 1.1) {
                recentTrend = 'increasing';
            } else if (secondHalf < firstHalf * 0.9) {
                recentTrend = 'decreasing';
            }
        }

        return {
            config: this.config,
            state: {
                step: this.state.step,
                currentCoefficient: this.state.currentCoefficient,
                currentEntropy: this.state.currentEntropy,
                targetEntropy: this.state.targetEntropy
            },
            statistics: this.state.statistics,
            performance: this.state.metrics,
            history: {
                coefficients: [...history.coefficients],
                entropies: [...history.entropies],
                recentTrend
            }
        };
    }

    /**
     * Reset regularizer state
     */
    reset(): void {
        this.state = {
            currentCoefficient: this.config.initialCoefficient,
            currentEntropy: 0,
            targetEntropy: this.config.targetEntropy,
            step: 0,
            history: {
                coefficients: [],
                entropies: [],
                klDivergences: [],
                policyDiversities: [],
                convergenceMetrics: [],
                timestamps: []
            },
            statistics: {
                averageEntropy: 0,
                entropyVariance: 0,
                policyDiversity: 0,
                explorationRate: 0,
                convergenceRate: 0,
                adaptationRate: 0,
                lastUpdateTime: 0
            },
            metrics: {
                totalCalculations: 0,
                totalTime: 0,
                averageCalculationTime: 0,
                memoryUsage: 0,
                approximationError: 0
            }
        };

        this.movingAverages.clear();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<EntropyRegularizerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.movingAverages.clear();
    }
}

/**
 * Factory function for creating entropy regularizer instances
 */
export function createEntropyRegularizer(config: Partial<EntropyRegularizerConfig> = {}): EntropyRegularizer {
    return new EntropyRegularizer(config);
}

/**
 * Utility function for creating common entropy regularizer configurations
 */
export const EntropyRegularizerPresets = {
    /**
     * Configuration for policy gradient methods (PPO, A3C)
     */
    policyGradient: (): Partial<EntropyRegularizerConfig> => ({
        initialCoefficient: 0.01,
        targetEntropy: -1.0,
        schedule: {
            type: 'exponential',
            startStep: 0,
            endStep: 100000,
            minCoefficient: 0.001,
            maxCoefficient: 0.1,
            decayRate: 0.995
        },
        entropyMethod: {
            type: 'categorical',
            temperature: 1.0,
            clampMin: 1e-8,
            clampMax: 1.0,
            normalizeWeights: true
        }
    }),

    /**
     * Configuration for continuous control tasks
     */
    continuousControl: (): Partial<EntropyRegularizerConfig> => ({
        initialCoefficient: 0.1,
        targetEntropy: -2.0,
        schedule: {
            type: 'adaptive',
            startStep: 0,
            endStep: 200000,
            minCoefficient: 0.001,
            maxCoefficient: 0.5,
            decayRate: 0.99
        },
        entropyMethod: {
            type: 'gaussian',
            temperature: 1.0,
            clampMin: 1e-6,
            clampMax: 1.0,
            normalizeWeights: false
        },
        adaptive: {
            enabled: true,
            targetKLDivergence: 0.01,
            adaptationRate: 0.001,
            windowSize: 100,
            toleranceRange: 0.1
        }
    }),

    /**
     * Configuration for exploration-heavy tasks
     */
    highExploration: (): Partial<EntropyRegularizerConfig> => ({
        initialCoefficient: 0.1,
        targetEntropy: -0.5,
        schedule: {
            type: 'linear',
            startStep: 0,
            endStep: 50000,
            minCoefficient: 0.01,
            maxCoefficient: 0.2,
            decayRate: 0.99
        },
        entropyMethod: {
            type: 'categorical',
            temperature: 2.0,
            clampMin: 1e-8,
            clampMax: 1.0,
            normalizeWeights: true
        }
    }),

    /**
     * Configuration for fine-tuning with low exploration
     */
    lowExploration: (): Partial<EntropyRegularizerConfig> => ({
        initialCoefficient: 0.001,
        targetEntropy: -2.0,
        schedule: {
            type: 'constant',
            startStep: 0,
            endStep: 10000,
            minCoefficient: 0.0001,
            maxCoefficient: 0.01,
            decayRate: 0.999
        },
        entropyMethod: {
            type: 'categorical',
            temperature: 0.5,
            clampMin: 1e-8,
            clampMax: 1.0,
            normalizeWeights: true
        }
    })
};
