/**
 * AdamW Optimizer Implementation
 * 
 * AdamW is a variant of Adam optimizer that decouples weight decay from gradient descent.
 * It's particularly effective for training neural networks and is widely used in modern deep learning.
 * 
 * Features:
 * - Adaptive learning rates per parameter
 * - Momentum tracking with bias correction
 * - Proper weight decay (decoupled from gradients)
 * - Gradient clipping for stability
 * - Warmup scheduling support
 * - Comprehensive statistics tracking
 * - Multiple precision support
 * 
 * @author Connect4 AI Team
 */

export interface AdamWConfig {
    // Core optimizer parameters
    learningRate: number;
    beta1: number;          // Exponential decay rate for first moment
    beta2: number;          // Exponential decay rate for second moment
    epsilon: number;        // Small constant for numerical stability
    weightDecay: number;    // Weight decay coefficient

    // Advanced features
    gradientClipping: {
        enabled: boolean;
        maxNorm: number;
        normType: 'l2' | 'l1' | 'inf';
    };

    // Warmup scheduling
    warmup: {
        enabled: boolean;
        steps: number;
        initialLr: number;
    };

    // Precision and performance
    precision: 'float32' | 'float64';
    amsgrad: boolean;       // Use AMSGrad variant

    // Monitoring
    trackStatistics: boolean;
    historySize: number;
}

export interface AdamWState {
    // Parameter tracking
    parameters: Map<string, Float32Array | Float64Array>;
    gradients: Map<string, Float32Array | Float64Array>;

    // Momentum states
    firstMoments: Map<string, Float32Array | Float64Array>;
    secondMoments: Map<string, Float32Array | Float64Array>;
    maxSecondMoments?: Map<string, Float32Array | Float64Array>; // For AMSGrad

    // Step counter
    step: number;

    // Statistics
    statistics: {
        averageGradientNorm: number;
        averageParameterNorm: number;
        averageUpdateNorm: number;
        learningRateHistory: number[];
        lossHistory: number[];
        gradientNormHistory: number[];
        updateNormHistory: number[];
        lastUpdateTime: number;
    };

    // Performance metrics
    metrics: {
        totalUpdates: number;
        totalTime: number;
        averageUpdateTime: number;
        memoryUsage: number;
        convergenceRate: number;
    };
}

export class AdamWOptimizer {
    private config: AdamWConfig;
    private state: AdamWState;

    constructor(config: Partial<AdamWConfig> = {}) {
        this.config = {
            learningRate: 0.001,
            beta1: 0.9,
            beta2: 0.999,
            epsilon: 1e-8,
            weightDecay: 0.01,
            gradientClipping: {
                enabled: true,
                maxNorm: 1.0,
                normType: 'l2'
            },
            warmup: {
                enabled: false,
                steps: 1000,
                initialLr: 1e-6
            },
            precision: 'float32',
            amsgrad: false,
            trackStatistics: true,
            historySize: 1000,
            ...config
        };

        this.state = {
            parameters: new Map(),
            gradients: new Map(),
            firstMoments: new Map(),
            secondMoments: new Map(),
            step: 0,
            statistics: {
                averageGradientNorm: 0,
                averageParameterNorm: 0,
                averageUpdateNorm: 0,
                learningRateHistory: [],
                lossHistory: [],
                gradientNormHistory: [],
                updateNormHistory: [],
                lastUpdateTime: 0
            },
            metrics: {
                totalUpdates: 0,
                totalTime: 0,
                averageUpdateTime: 0,
                memoryUsage: 0,
                convergenceRate: 0
            }
        };

        if (this.config.amsgrad) {
            this.state.maxSecondMoments = new Map();
        }
    }

    /**
     * Register parameters for optimization
     */
    registerParameter(name: string, values: number[]): void {
        const ArrayType = this.config.precision === 'float64' ? Float64Array : Float32Array;

        this.state.parameters.set(name, new ArrayType(values));
        this.state.gradients.set(name, new ArrayType(values.length));
        this.state.firstMoments.set(name, new ArrayType(values.length));
        this.state.secondMoments.set(name, new ArrayType(values.length));

        if (this.config.amsgrad) {
            this.state.maxSecondMoments!.set(name, new ArrayType(values.length));
        }
    }

    /**
     * Update parameters with gradients
     */
    step(gradients: Map<string, number[]>, loss?: number): void {
        const startTime = performance.now();

        // Increment step counter
        this.state.step++;

        // Store gradients
        for (const [name, grad] of gradients) {
            const gradArray = this.state.gradients.get(name);
            if (gradArray) {
                for (let i = 0; i < grad.length; i++) {
                    gradArray[i] = grad[i];
                }
            }
        }

        // Apply gradient clipping if enabled
        if (this.config.gradientClipping.enabled) {
            this.clipGradients();
        }

        // Get current learning rate (with warmup if enabled)
        const currentLr = this.getCurrentLearningRate();

        // Update parameters
        for (const [name, gradArray] of this.state.gradients) {
            const params = this.state.parameters.get(name)!;
            const m = this.state.firstMoments.get(name)!;
            const v = this.state.secondMoments.get(name)!;
            const vMax = this.state.maxSecondMoments?.get(name);

            this.updateParameterGroup(params, gradArray, m, v, vMax, currentLr);
        }

        // Update statistics
        if (this.config.trackStatistics) {
            this.updateStatistics(currentLr, loss);
        }

        // Update metrics
        const updateTime = performance.now() - startTime;
        this.updateMetrics(updateTime);
    }

    /**
     * Update a single parameter group
     */
    private updateParameterGroup(
        params: Float32Array | Float64Array,
        gradients: Float32Array | Float64Array,
        firstMoments: Float32Array | Float64Array,
        secondMoments: Float32Array | Float64Array,
        maxSecondMoments: Float32Array | Float64Array | undefined,
        learningRate: number
    ): void {
        const { beta1, beta2, epsilon, weightDecay } = this.config;
        const step = this.state.step;

        // Bias correction
        const biasCorrection1 = 1 - Math.pow(beta1, step);
        const biasCorrection2 = 1 - Math.pow(beta2, step);

        for (let i = 0; i < params.length; i++) {
            const grad = gradients[i];

            // Update first moment (momentum)
            firstMoments[i] = beta1 * firstMoments[i] + (1 - beta1) * grad;

            // Update second moment (squared gradients)
            secondMoments[i] = beta2 * secondMoments[i] + (1 - beta2) * grad * grad;

            // Bias-corrected moments
            const mHat = firstMoments[i] / biasCorrection1;
            let vHat = secondMoments[i] / biasCorrection2;

            // AMSGrad variant
            if (this.config.amsgrad && maxSecondMoments) {
                maxSecondMoments[i] = Math.max(maxSecondMoments[i], secondMoments[i]);
                vHat = maxSecondMoments[i] / biasCorrection2;
            }

            // Parameter update
            const update = learningRate * mHat / (Math.sqrt(vHat) + epsilon);

            // Apply weight decay (decoupled from gradients)
            params[i] = params[i] * (1 - learningRate * weightDecay) - update;
        }
    }

    /**
     * Clip gradients to prevent gradient explosion
     */
    private clipGradients(): void {
        const { maxNorm, normType } = this.config.gradientClipping;

        // Calculate total gradient norm
        let totalNorm = 0;

        for (const gradArray of this.state.gradients.values()) {
            for (let i = 0; i < gradArray.length; i++) {
                const grad = gradArray[i];
                switch (normType) {
                    case 'l2':
                        totalNorm += grad * grad;
                        break;
                    case 'l1':
                        totalNorm += Math.abs(grad);
                        break;
                    case 'inf':
                        totalNorm = Math.max(totalNorm, Math.abs(grad));
                        break;
                }
            }
        }

        if (normType === 'l2') {
            totalNorm = Math.sqrt(totalNorm);
        }

        // Clip if necessary
        if (totalNorm > maxNorm) {
            const clipCoeff = maxNorm / totalNorm;

            for (const gradArray of this.state.gradients.values()) {
                for (let i = 0; i < gradArray.length; i++) {
                    gradArray[i] *= clipCoeff;
                }
            }
        }
    }

    /**
     * Get current learning rate with warmup
     */
    private getCurrentLearningRate(): number {
        const { learningRate, warmup } = this.config;

        if (warmup.enabled && this.state.step <= warmup.steps) {
            // Linear warmup
            const warmupProgress = this.state.step / warmup.steps;
            return warmup.initialLr + (learningRate - warmup.initialLr) * warmupProgress;
        }

        return learningRate;
    }

    /**
     * Update statistics for monitoring
     */
    private updateStatistics(currentLr: number, loss?: number): void {
        const stats = this.state.statistics;

        // Calculate gradient norm
        let gradNorm = 0;
        for (const gradArray of this.state.gradients.values()) {
            for (let i = 0; i < gradArray.length; i++) {
                gradNorm += gradArray[i] * gradArray[i];
            }
        }
        gradNorm = Math.sqrt(gradNorm);

        // Calculate parameter norm
        let paramNorm = 0;
        for (const paramArray of this.state.parameters.values()) {
            for (let i = 0; i < paramArray.length; i++) {
                paramNorm += paramArray[i] * paramArray[i];
            }
        }
        paramNorm = Math.sqrt(paramNorm);

        // Update running averages
        const alpha = 0.99; // Exponential moving average decay
        stats.averageGradientNorm = alpha * stats.averageGradientNorm + (1 - alpha) * gradNorm;
        stats.averageParameterNorm = alpha * stats.averageParameterNorm + (1 - alpha) * paramNorm;

        // Store history
        if (stats.learningRateHistory.length >= this.config.historySize) {
            stats.learningRateHistory.shift();
        }
        stats.learningRateHistory.push(currentLr);

        if (stats.gradientNormHistory.length >= this.config.historySize) {
            stats.gradientNormHistory.shift();
        }
        stats.gradientNormHistory.push(gradNorm);

        if (loss !== undefined) {
            if (stats.lossHistory.length >= this.config.historySize) {
                stats.lossHistory.shift();
            }
            stats.lossHistory.push(loss);
        }

        stats.lastUpdateTime = Date.now();
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(updateTime: number): void {
        const metrics = this.state.metrics;

        metrics.totalUpdates++;
        metrics.totalTime += updateTime;
        metrics.averageUpdateTime = metrics.totalTime / metrics.totalUpdates;

        // Estimate memory usage
        let memoryUsage = 0;
        for (const [name, arr] of this.state.parameters) {
            memoryUsage += arr.length * (this.config.precision === 'float64' ? 8 : 4);
        }
        // Multiply by 4 for parameters, gradients, first moments, second moments
        memoryUsage *= 4;
        if (this.config.amsgrad) {
            memoryUsage *= 1.25; // Additional memory for max second moments
        }

        metrics.memoryUsage = memoryUsage;

        // Calculate convergence rate (based on loss improvement)
        if (this.state.statistics.lossHistory.length >= 2) {
            const recentLosses = this.state.statistics.lossHistory.slice(-10);
            if (recentLosses.length >= 2) {
                const oldLoss = recentLosses[0];
                const newLoss = recentLosses[recentLosses.length - 1];
                metrics.convergenceRate = (oldLoss - newLoss) / oldLoss;
            }
        }
    }

    /**
     * Get current parameter values
     */
    getParameters(): Map<string, number[]> {
        const result = new Map<string, number[]>();

        for (const [name, arr] of this.state.parameters) {
            result.set(name, Array.from(arr));
        }

        return result;
    }

    /**
     * Set parameter values
     */
    setParameters(parameters: Map<string, number[]>): void {
        for (const [name, values] of parameters) {
            const arr = this.state.parameters.get(name);
            if (arr) {
                for (let i = 0; i < values.length; i++) {
                    arr[i] = values[i];
                }
            }
        }
    }

    /**
     * Get optimizer state for checkpointing
     */
    getState(): AdamWState {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Load optimizer state from checkpoint
     */
    loadState(state: AdamWState): void {
        this.state = state;
    }

    /**
     * Reset optimizer state
     */
    reset(): void {
        this.state.step = 0;

        // Reset moments
        for (const arr of this.state.firstMoments.values()) {
            arr.fill(0);
        }
        for (const arr of this.state.secondMoments.values()) {
            arr.fill(0);
        }
        if (this.state.maxSecondMoments) {
            for (const arr of this.state.maxSecondMoments.values()) {
                arr.fill(0);
            }
        }

        // Reset statistics
        this.state.statistics = {
            averageGradientNorm: 0,
            averageParameterNorm: 0,
            averageUpdateNorm: 0,
            learningRateHistory: [],
            lossHistory: [],
            gradientNormHistory: [],
            updateNormHistory: [],
            lastUpdateTime: 0
        };

        // Reset metrics
        this.state.metrics = {
            totalUpdates: 0,
            totalTime: 0,
            averageUpdateTime: 0,
            memoryUsage: 0,
            convergenceRate: 0
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<AdamWConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get comprehensive optimizer metrics
     */
    getMetrics(): {
        config: AdamWConfig;
        state: {
            step: number;
            parametersCount: number;
            gradientNorm: number;
            parameterNorm: number;
            currentLearningRate: number;
        };
        statistics: AdamWState['statistics'];
        performance: AdamWState['metrics'];
    } {
        return {
            config: this.config,
            state: {
                step: this.state.step,
                parametersCount: Array.from(this.state.parameters.values()).reduce((sum, arr) => sum + arr.length, 0),
                gradientNorm: this.state.statistics.averageGradientNorm,
                parameterNorm: this.state.statistics.averageParameterNorm,
                currentLearningRate: this.getCurrentLearningRate()
            },
            statistics: this.state.statistics,
            performance: this.state.metrics
        };
    }

    /**
     * Dispose of optimizer resources
     */
    dispose(): void {
        this.state.parameters.clear();
        this.state.gradients.clear();
        this.state.firstMoments.clear();
        this.state.secondMoments.clear();
        this.state.maxSecondMoments?.clear();
    }
}

/**
 * Factory function for creating AdamW optimizer instances
 */
export function createAdamWOptimizer(config: Partial<AdamWConfig> = {}): AdamWOptimizer {
    return new AdamWOptimizer(config);
}

/**
 * Utility function for creating common AdamW configurations
 */
export const AdamWPresets = {
    /**
     * Default configuration for neural network training
     */
    neuralNetwork: (): Partial<AdamWConfig> => ({
        learningRate: 0.001,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        weightDecay: 0.01,
        gradientClipping: {
            enabled: true,
            maxNorm: 1.0,
            normType: 'l2'
        },
        warmup: {
            enabled: true,
            steps: 1000,
            initialLr: 1e-6
        }
    }),

    /**
     * Configuration for reinforcement learning
     */
    reinforcementLearning: (): Partial<AdamWConfig> => ({
        learningRate: 0.0003,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        weightDecay: 0.0001,
        gradientClipping: {
            enabled: true,
            maxNorm: 0.5,
            normType: 'l2'
        },
        amsgrad: true
    }),

    /**
     * Configuration for fine-tuning
     */
    fineTuning: (): Partial<AdamWConfig> => ({
        learningRate: 0.00001,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        weightDecay: 0.001,
        gradientClipping: {
            enabled: true,
            maxNorm: 0.1,
            normType: 'l2'
        },
        warmup: {
            enabled: true,
            steps: 500,
            initialLr: 1e-7
        }
    }),

    /**
     * High-performance configuration
     */
    highPerformance: (): Partial<AdamWConfig> => ({
        learningRate: 0.001,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        weightDecay: 0.01,
        precision: 'float32',
        trackStatistics: false,
        historySize: 100
    })
};
