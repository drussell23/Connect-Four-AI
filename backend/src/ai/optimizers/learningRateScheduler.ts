/**
 * Learning Rate Scheduler Implementation
 * 
 * Learning rate scheduling is crucial for optimal training performance in neural networks
 * and reinforcement learning. This implementation provides multiple scheduling strategies
 * and adaptive mechanisms to automatically adjust learning rates during training.
 * 
 * Features:
 * - Multiple scheduling strategies (step, exponential, cosine, polynomial, cyclic, etc.)
 * - Warmup and cooldown phases
 * - Adaptive scheduling based on metrics
 * - Plateau detection and response
 * - Multiple learning rate groups
 * - Comprehensive monitoring and statistics
 * - Integration with optimizers
 * 
 * @author Connect4 AI Team
 */

export interface LearningRateSchedulerConfig {
    // Base learning rate configuration
    baseLearningRate: number;

    // Scheduling strategy
    strategy: {
        type: 'step' | 'exponential' | 'cosine' | 'polynomial' | 'cyclic' | 'one_cycle' | 'plateau' | 'adaptive';

        // Step scheduling parameters
        stepSize: number;
        stepGamma: number;

        // Exponential scheduling parameters
        exponentialGamma: number;

        // Cosine scheduling parameters
        cosineT0: number;              // Period of first restart
        cosineTMult: number;           // Multiplication factor for period
        cosineEtaMin: number;          // Minimum learning rate

        // Polynomial scheduling parameters
        polynomialPower: number;
        polynomialTotalSteps: number;

        // Cyclic scheduling parameters
        cyclicBaseLr: number;
        cyclicMaxLr: number;
        cyclicStepSize: number;
        cyclicMode: 'triangular' | 'triangular2' | 'exp_range';
        cyclicGamma: number;

        // One-cycle scheduling parameters
        oneCycleMaxLr: number;
        oneCycleTotalSteps: number;
        oneCyclePctStart: number;
        oneCycleAnnealStrategy: 'cos' | 'linear';
        oneCycleDivFactor: number;
        oneCycleFinalDivFactor: number;

        // Plateau scheduling parameters
        plateauMode: 'min' | 'max';
        plateauFactor: number;
        plateauPatience: number;
        plateauThreshold: number;
        plateauThresholdMode: 'rel' | 'abs';
        plateauCooldown: number;
        plateauMinLr: number;

        // Adaptive scheduling parameters
        adaptiveMetric: 'loss' | 'accuracy' | 'gradient_norm' | 'custom';
        adaptivePatience: number;
        adaptiveFactor: number;
        adaptiveMinLr: number;
        adaptiveMaxLr: number;
    };

    // Warmup configuration
    warmup: {
        enabled: boolean;
        steps: number;
        startFactor: number;
        endFactor: number;
        method: 'linear' | 'constant' | 'exponential';
    };

    // Cooldown configuration
    cooldown: {
        enabled: boolean;
        startStep: number;
        endStep: number;
        endFactor: number;
        method: 'linear' | 'exponential';
    };

    // Multiple learning rate groups
    groups: {
        enabled: boolean;
        parameterGroups: Array<{
            name: string;
            baseLr: number;
            strategy: string;
            parameters: string[];
        }>;
    };

    // Monitoring and statistics
    monitoring: {
        enabled: boolean;
        logInterval: number;
        trackMetrics: boolean;
        trackGradients: boolean;
        historySize: number;
        saveCheckpoints: boolean;
    };

    // Performance optimization
    performance: {
        updateFrequency: number;       // Update every N steps
        batchOptimization: boolean;    // Optimize for batch processing
        memoryOptimization: boolean;   // Optimize memory usage
        parallelization: boolean;      // Enable parallel processing
    };
}

export interface LearningRateState {
    // Current state
    currentStep: number;
    currentLearningRate: number;
    baselineLearningRate: number;

    // Phase tracking
    phase: 'warmup' | 'training' | 'cooldown' | 'plateau';
    phaseStep: number;

    // Metric tracking for adaptive scheduling
    metrics: {
        values: number[];
        bestValue: number;
        bestStep: number;
        stepsWithoutImprovement: number;
        plateauCount: number;
    };

    // History tracking
    history: {
        learningRates: number[];
        metrics: number[];
        gradientNorms: number[];
        phases: string[];
        timestamps: number[];
    };

    // Statistics
    statistics: {
        averageLearningRate: number;
        learningRateVariance: number;
        totalReductions: number;
        totalIncreases: number;
        convergenceRate: number;
        efficiencyScore: number;
        lastUpdateTime: number;
    };

    // Performance metrics
    performance: {
        totalUpdates: number;
        totalTime: number;
        averageUpdateTime: number;
        memoryUsage: number;
        cacheHitRate: number;
    };

    // Multi-group state
    groups: Map<string, {
        currentLr: number;
        baseLr: number;
        step: number;
        phase: string;
    }>;
}

export class LearningRateScheduler {
    private config: LearningRateSchedulerConfig;
    private state: LearningRateState;
    private cache: Map<string, number>;

    constructor(config: Partial<LearningRateSchedulerConfig> = {}) {
        this.config = {
            baseLearningRate: 0.001,
            strategy: {
                type: 'exponential',
                stepSize: 1000,
                stepGamma: 0.95,
                exponentialGamma: 0.99,
                cosineT0: 10000,
                cosineTMult: 2.0,
                cosineEtaMin: 0.00001,
                polynomialPower: 1.0,
                polynomialTotalSteps: 100000,
                cyclicBaseLr: 0.0001,
                cyclicMaxLr: 0.01,
                cyclicStepSize: 2000,
                cyclicMode: 'triangular',
                cyclicGamma: 1.0,
                oneCycleMaxLr: 0.01,
                oneCycleTotalSteps: 100000,
                oneCyclePctStart: 0.25,
                oneCycleAnnealStrategy: 'cos',
                oneCycleDivFactor: 25.0,
                oneCycleFinalDivFactor: 10000.0,
                plateauMode: 'min',
                plateauFactor: 0.1,
                plateauPatience: 10,
                plateauThreshold: 0.0001,
                plateauThresholdMode: 'rel',
                plateauCooldown: 0,
                plateauMinLr: 0.00001,
                adaptiveMetric: 'loss',
                adaptivePatience: 5,
                adaptiveFactor: 0.5,
                adaptiveMinLr: 0.00001,
                adaptiveMaxLr: 0.1
            },
            warmup: {
                enabled: true,
                steps: 1000,
                startFactor: 0.1,
                endFactor: 1.0,
                method: 'linear'
            },
            cooldown: {
                enabled: false,
                startStep: 90000,
                endStep: 100000,
                endFactor: 0.1,
                method: 'linear'
            },
            groups: {
                enabled: false,
                parameterGroups: []
            },
            monitoring: {
                enabled: true,
                logInterval: 1000,
                trackMetrics: true,
                trackGradients: true,
                historySize: 10000,
                saveCheckpoints: false
            },
            performance: {
                updateFrequency: 1,
                batchOptimization: true,
                memoryOptimization: true,
                parallelization: false
            },
            ...config
        };

        this.state = {
            currentStep: 0,
            currentLearningRate: this.config.baseLearningRate,
            baselineLearningRate: this.config.baseLearningRate,
            phase: 'warmup',
            phaseStep: 0,
            metrics: {
                values: [],
                bestValue: this.config.strategy.plateauMode === 'min' ? Infinity : -Infinity,
                bestStep: 0,
                stepsWithoutImprovement: 0,
                plateauCount: 0
            },
            history: {
                learningRates: [],
                metrics: [],
                gradientNorms: [],
                phases: [],
                timestamps: []
            },
            statistics: {
                averageLearningRate: this.config.baseLearningRate,
                learningRateVariance: 0,
                totalReductions: 0,
                totalIncreases: 0,
                convergenceRate: 0,
                efficiencyScore: 0,
                lastUpdateTime: 0
            },
            performance: {
                totalUpdates: 0,
                totalTime: 0,
                averageUpdateTime: 0,
                memoryUsage: 0,
                cacheHitRate: 0
            },
            groups: new Map()
        };

        this.cache = new Map();

        // Initialize parameter groups if enabled
        if (this.config.groups.enabled) {
            this.initializeGroups();
        }
    }

    /**
     * Initialize parameter groups
     */
    private initializeGroups(): void {
        for (const group of this.config.groups.parameterGroups) {
            this.state.groups.set(group.name, {
                currentLr: group.baseLr,
                baseLr: group.baseLr,
                step: 0,
                phase: 'warmup'
            });
        }
    }

    /**
     * Update learning rate based on current step and strategy
     */
    step(metric?: number, gradientNorm?: number): number {
        const startTime = performance.now();

        // Update step counter
        this.state.currentStep++;

        // Store metric if provided
        if (metric !== undefined) {
            this.addMetric(metric);
        }

        // Store gradient norm if provided
        if (gradientNorm !== undefined) {
            this.addGradientNorm(gradientNorm);
        }

        // Update learning rate based on strategy
        const newLearningRate = this.calculateLearningRate();

        // Update state
        const prevLr = this.state.currentLearningRate;
        this.state.currentLearningRate = newLearningRate;

        // Track changes
        if (newLearningRate > prevLr) {
            this.state.statistics.totalIncreases++;
        } else if (newLearningRate < prevLr) {
            this.state.statistics.totalReductions++;
        }

        // Update phase
        this.updatePhase();

        // Update statistics
        if (this.config.monitoring.enabled) {
            this.updateStatistics();
        }

        // Update performance metrics
        const updateTime = performance.now() - startTime;
        this.updatePerformanceMetrics(updateTime);

        return newLearningRate;
    }

    /**
     * Calculate learning rate based on strategy
     */
    private calculateLearningRate(): number {
        const cacheKey = `${this.config.strategy.type}_${this.state.currentStep}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            this.state.performance.cacheHitRate++;
            return this.cache.get(cacheKey)!;
        }

        let lr = this.config.baseLearningRate;

        // Apply warmup if in warmup phase
        if (this.state.phase === 'warmup' && this.config.warmup.enabled) {
            lr = this.calculateWarmupLearningRate();
        }
        // Apply cooldown if in cooldown phase
        else if (this.state.phase === 'cooldown' && this.config.cooldown.enabled) {
            lr = this.calculateCooldownLearningRate();
        }
        // Apply main strategy
        else {
            lr = this.calculateStrategyLearningRate();
        }

        // Cache result
        if (this.config.performance.batchOptimization) {
            this.cache.set(cacheKey, lr);
        }

        return lr;
    }

    /**
     * Calculate warmup learning rate
     */
    private calculateWarmupLearningRate(): number {
        const { warmup } = this.config;
        const progress = this.state.currentStep / warmup.steps;
        const clampedProgress = Math.min(1.0, progress);

        switch (warmup.method) {
            case 'linear':
                return this.config.baseLearningRate * (warmup.startFactor + (warmup.endFactor - warmup.startFactor) * clampedProgress);
            case 'constant':
                return this.config.baseLearningRate * warmup.startFactor;
            case 'exponential':
                return this.config.baseLearningRate * Math.pow(warmup.endFactor / warmup.startFactor, clampedProgress) * warmup.startFactor;
            default:
                return this.config.baseLearningRate;
        }
    }

    /**
     * Calculate cooldown learning rate
     */
    private calculateCooldownLearningRate(): number {
        const { cooldown } = this.config;
        const progress = (this.state.currentStep - cooldown.startStep) / (cooldown.endStep - cooldown.startStep);
        const clampedProgress = Math.max(0, Math.min(1.0, progress));

        switch (cooldown.method) {
            case 'linear':
                return this.config.baseLearningRate * (1.0 - (1.0 - cooldown.endFactor) * clampedProgress);
            case 'exponential':
                return this.config.baseLearningRate * Math.pow(cooldown.endFactor, clampedProgress);
            default:
                return this.config.baseLearningRate;
        }
    }

    /**
     * Calculate learning rate based on main strategy
     */
    private calculateStrategyLearningRate(): number {
        const { strategy } = this.config;
        const step = this.state.currentStep;

        switch (strategy.type) {
            case 'step':
                return this.calculateStepLearningRate(step);
            case 'exponential':
                return this.calculateExponentialLearningRate(step);
            case 'cosine':
                return this.calculateCosineLearningRate(step);
            case 'polynomial':
                return this.calculatePolynomialLearningRate(step);
            case 'cyclic':
                return this.calculateCyclicLearningRate(step);
            case 'one_cycle':
                return this.calculateOneCycleLearningRate(step);
            case 'plateau':
                return this.calculatePlateauLearningRate();
            case 'adaptive':
                return this.calculateAdaptiveLearningRate();
            default:
                return this.config.baseLearningRate;
        }
    }

    /**
     * Step decay scheduling
     */
    private calculateStepLearningRate(step: number): number {
        const { stepSize, stepGamma } = this.config.strategy;
        const epochs = Math.floor(step / stepSize);
        return this.config.baseLearningRate * Math.pow(stepGamma, epochs);
    }

    /**
     * Exponential decay scheduling
     */
    private calculateExponentialLearningRate(step: number): number {
        const { exponentialGamma } = this.config.strategy;
        return this.config.baseLearningRate * Math.pow(exponentialGamma, step);
    }

    /**
     * Cosine annealing with restarts
     */
    private calculateCosineLearningRate(step: number): number {
        const { cosineT0, cosineTMult, cosineEtaMin } = this.config.strategy;

        let Ti = cosineT0;
        let currentStep = step;

        // Find current cycle
        while (currentStep >= Ti) {
            currentStep -= Ti;
            Ti *= cosineTMult;
        }

        const progress = currentStep / Ti;
        return cosineEtaMin + (this.config.baseLearningRate - cosineEtaMin) * (1 + Math.cos(Math.PI * progress)) / 2;
    }

    /**
     * Polynomial decay scheduling
     */
    private calculatePolynomialLearningRate(step: number): number {
        const { polynomialPower, polynomialTotalSteps } = this.config.strategy;

        if (step >= polynomialTotalSteps) {
            return 0;
        }

        const progress = step / polynomialTotalSteps;
        return this.config.baseLearningRate * Math.pow(1 - progress, polynomialPower);
    }

    /**
     * Cyclic learning rate
     */
    private calculateCyclicLearningRate(step: number): number {
        const { cyclicBaseLr, cyclicMaxLr, cyclicStepSize, cyclicMode, cyclicGamma } = this.config.strategy;

        const cycle = Math.floor(1 + step / (2 * cyclicStepSize));
        const x = Math.abs(step / cyclicStepSize - 2 * cycle + 1);

        let amplitude: number;
        switch (cyclicMode) {
            case 'triangular':
                amplitude = 1;
                break;
            case 'triangular2':
                amplitude = 1 / Math.pow(2, cycle - 1);
                break;
            case 'exp_range':
                amplitude = Math.pow(cyclicGamma, step);
                break;
            default:
                amplitude = 1;
        }

        return cyclicBaseLr + (cyclicMaxLr - cyclicBaseLr) * Math.max(0, 1 - x) * amplitude;
    }

    /**
     * One-cycle learning rate policy
     */
    private calculateOneCycleLearningRate(step: number): number {
        const { oneCycleMaxLr, oneCycleTotalSteps, oneCyclePctStart, oneCycleAnnealStrategy, oneCycleDivFactor, oneCycleFinalDivFactor } = this.config.strategy;

        const stepUp = Math.floor(oneCycleTotalSteps * oneCyclePctStart);
        const stepDown = oneCycleTotalSteps - stepUp;

        const initialLr = oneCycleMaxLr / oneCycleDivFactor;
        const finalLr = initialLr / oneCycleFinalDivFactor;

        if (step <= stepUp) {
            // Ascending phase
            const progress = step / stepUp;
            return initialLr + (oneCycleMaxLr - initialLr) * progress;
        } else {
            // Descending phase
            const progress = (step - stepUp) / stepDown;

            if (oneCycleAnnealStrategy === 'cos') {
                return finalLr + (oneCycleMaxLr - finalLr) * (1 + Math.cos(Math.PI * progress)) / 2;
            } else {
                return oneCycleMaxLr - (oneCycleMaxLr - finalLr) * progress;
            }
        }
    }

    /**
     * Plateau-based learning rate reduction
     */
    private calculatePlateauLearningRate(): number {
        const { plateauMode, plateauFactor, plateauPatience, plateauThreshold, plateauThresholdMode, plateauCooldown, plateauMinLr } = this.config.strategy;

        if (this.state.metrics.values.length === 0) {
            return this.state.currentLearningRate;
        }

        const currentMetric = this.state.metrics.values[this.state.metrics.values.length - 1];
        let isImprovement = false;

        // Check for improvement
        if (plateauMode === 'min') {
            if (plateauThresholdMode === 'rel') {
                isImprovement = currentMetric < this.state.metrics.bestValue * (1 - plateauThreshold);
            } else {
                isImprovement = currentMetric < this.state.metrics.bestValue - plateauThreshold;
            }
        } else {
            if (plateauThresholdMode === 'rel') {
                isImprovement = currentMetric > this.state.metrics.bestValue * (1 + plateauThreshold);
            } else {
                isImprovement = currentMetric > this.state.metrics.bestValue + plateauThreshold;
            }
        }

        if (isImprovement) {
            this.state.metrics.bestValue = currentMetric;
            this.state.metrics.bestStep = this.state.currentStep;
            this.state.metrics.stepsWithoutImprovement = 0;
        } else {
            this.state.metrics.stepsWithoutImprovement++;
        }

        // Check if we should reduce learning rate
        if (this.state.metrics.stepsWithoutImprovement >= plateauPatience) {
            if (this.state.currentStep - this.state.metrics.bestStep >= plateauCooldown) {
                const newLr = Math.max(plateauMinLr, this.state.currentLearningRate * plateauFactor);
                this.state.metrics.stepsWithoutImprovement = 0;
                this.state.metrics.plateauCount++;
                return newLr;
            }
        }

        return this.state.currentLearningRate;
    }

    /**
     * Adaptive learning rate adjustment
     */
    private calculateAdaptiveLearningRate(): number {
        const { adaptivePatience, adaptiveFactor, adaptiveMinLr, adaptiveMaxLr } = this.config.strategy;

        if (this.state.metrics.values.length < adaptivePatience) {
            return this.state.currentLearningRate;
        }

        const recentMetrics = this.state.metrics.values.slice(-adaptivePatience);
        const avgMetric = recentMetrics.reduce((a, b) => a + b, 0) / recentMetrics.length;
        const trend = recentMetrics[recentMetrics.length - 1] - recentMetrics[0];

        // Adjust learning rate based on trend
        let newLr = this.state.currentLearningRate;

        if (trend > 0) {
            // Increasing trend (potentially getting worse)
            newLr *= adaptiveFactor;
        } else {
            // Decreasing trend (potentially improving)
            newLr /= adaptiveFactor;
        }

        return Math.max(adaptiveMinLr, Math.min(adaptiveMaxLr, newLr));
    }

    /**
     * Update current phase
     */
    private updatePhase(): void {
        const { warmup, cooldown } = this.config;

        if (warmup.enabled && this.state.currentStep <= warmup.steps) {
            this.state.phase = 'warmup';
            this.state.phaseStep = this.state.currentStep;
        } else if (cooldown.enabled && this.state.currentStep >= cooldown.startStep) {
            this.state.phase = 'cooldown';
            this.state.phaseStep = this.state.currentStep - cooldown.startStep;
        } else {
            this.state.phase = 'training';
            this.state.phaseStep = this.state.currentStep - (warmup.enabled ? warmup.steps : 0);
        }
    }

    /**
     * Add metric for adaptive scheduling
     */
    addMetric(metric: number): void {
        const { historySize } = this.config.monitoring;

        if (this.state.metrics.values.length >= historySize) {
            this.state.metrics.values.shift();
        }

        this.state.metrics.values.push(metric);
    }

    /**
     * Add gradient norm for monitoring
     */
    addGradientNorm(gradientNorm: number): void {
        const { historySize } = this.config.monitoring;

        if (this.state.history.gradientNorms.length >= historySize) {
            this.state.history.gradientNorms.shift();
        }

        this.state.history.gradientNorms.push(gradientNorm);
    }

    /**
     * Update statistics
     */
    private updateStatistics(): void {
        const { history, statistics } = this.state;
        const { historySize } = this.config.monitoring;

        // Add to history
        if (history.learningRates.length >= historySize) {
            history.learningRates.shift();
            history.phases.shift();
            history.timestamps.shift();
        }

        history.learningRates.push(this.state.currentLearningRate);
        history.phases.push(this.state.phase);
        history.timestamps.push(Date.now());

        // Calculate statistics
        if (history.learningRates.length > 0) {
            const lrs = history.learningRates;
            statistics.averageLearningRate = lrs.reduce((a, b) => a + b, 0) / lrs.length;

            const variance = lrs.reduce((sum, lr) => sum + Math.pow(lr - statistics.averageLearningRate, 2), 0) / lrs.length;
            statistics.learningRateVariance = variance;

            // Calculate convergence rate
            if (lrs.length >= 10) {
                const recent = lrs.slice(-10);
                const old = lrs.slice(-20, -10);
                if (old.length > 0) {
                    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                    const oldAvg = old.reduce((a, b) => a + b, 0) / old.length;
                    statistics.convergenceRate = (oldAvg - recentAvg) / oldAvg;
                }
            }
        }

        statistics.lastUpdateTime = Date.now();
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(updateTime: number): void {
        const { performance } = this.state;

        performance.totalUpdates++;
        performance.totalTime += updateTime;
        performance.averageUpdateTime = performance.totalTime / performance.totalUpdates;

        // Calculate cache hit rate
        const totalCacheChecks = performance.totalUpdates;
        const cacheHits = performance.cacheHitRate;
        performance.cacheHitRate = totalCacheChecks > 0 ? cacheHits / totalCacheChecks : 0;

        // Estimate memory usage
        const baseMemory = 1024; // Base memory usage
        const historyMemory = this.state.history.learningRates.length * 8; // 8 bytes per number
        const cacheMemory = this.cache.size * 16; // Estimated cache memory
        performance.memoryUsage = baseMemory + historyMemory + cacheMemory;
    }

    /**
     * Get current learning rate
     */
    getCurrentLearningRate(): number {
        return this.state.currentLearningRate;
    }

    /**
     * Get current phase
     */
    getCurrentPhase(): string {
        return this.state.phase;
    }

    /**
     * Get learning rate for specific parameter group
     */
    getGroupLearningRate(groupName: string): number {
        const group = this.state.groups.get(groupName);
        return group ? group.currentLr : this.state.currentLearningRate;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics(): {
        config: LearningRateSchedulerConfig;
        state: {
            currentStep: number;
            currentLearningRate: number;
            phase: string;
            phaseStep: number;
        };
        statistics: LearningRateState['statistics'];
        performance: LearningRateState['performance'];
        history: {
            learningRates: number[];
            phases: string[];
            recentTrend: 'increasing' | 'decreasing' | 'stable';
        };
    } {
        const { history } = this.state;

        // Calculate recent trend
        let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (history.learningRates.length >= 10) {
            const recent = history.learningRates.slice(-10);
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
                currentStep: this.state.currentStep,
                currentLearningRate: this.state.currentLearningRate,
                phase: this.state.phase,
                phaseStep: this.state.phaseStep
            },
            statistics: this.state.statistics,
            performance: this.state.performance,
            history: {
                learningRates: [...history.learningRates],
                phases: [...history.phases],
                recentTrend
            }
        };
    }

    /**
     * Reset scheduler state
     */
    reset(): void {
        this.state = {
            currentStep: 0,
            currentLearningRate: this.config.baseLearningRate,
            baselineLearningRate: this.config.baseLearningRate,
            phase: 'warmup',
            phaseStep: 0,
            metrics: {
                values: [],
                bestValue: this.config.strategy.plateauMode === 'min' ? Infinity : -Infinity,
                bestStep: 0,
                stepsWithoutImprovement: 0,
                plateauCount: 0
            },
            history: {
                learningRates: [],
                metrics: [],
                gradientNorms: [],
                phases: [],
                timestamps: []
            },
            statistics: {
                averageLearningRate: this.config.baseLearningRate,
                learningRateVariance: 0,
                totalReductions: 0,
                totalIncreases: 0,
                convergenceRate: 0,
                efficiencyScore: 0,
                lastUpdateTime: 0
            },
            performance: {
                totalUpdates: 0,
                totalTime: 0,
                averageUpdateTime: 0,
                memoryUsage: 0,
                cacheHitRate: 0
            },
            groups: new Map()
        };

        this.cache.clear();

        if (this.config.groups.enabled) {
            this.initializeGroups();
        }
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<LearningRateSchedulerConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Update baseline learning rate
        if (newConfig.baseLearningRate) {
            this.state.baselineLearningRate = newConfig.baseLearningRate;
        }

        // Reinitialize groups if needed
        if (newConfig.groups) {
            this.initializeGroups();
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.cache.clear();
        this.state.groups.clear();
    }
}

/**
 * Factory function for creating learning rate scheduler instances
 */
export function createLearningRateScheduler(config: Partial<LearningRateSchedulerConfig> = {}): LearningRateScheduler {
    return new LearningRateScheduler(config);
}

/**
 * Utility function for creating common learning rate scheduler configurations
 */
export const LearningRateSchedulerPresets = {
    /**
     * Standard exponential decay for neural networks
     */
    neuralNetwork: (): Partial<LearningRateSchedulerConfig> => ({
        baseLearningRate: 0.001,
        strategy: {
            type: 'exponential',
            exponentialGamma: 0.95,
            stepSize: 1000,
            stepGamma: 0.9,
            cosineT0: 10000,
            cosineTMult: 2.0,
            cosineEtaMin: 0.00001,
            polynomialPower: 1.0,
            polynomialTotalSteps: 100000,
            cyclicBaseLr: 0.0001,
            cyclicMaxLr: 0.01,
            cyclicStepSize: 2000,
            cyclicMode: 'triangular',
            cyclicGamma: 1.0,
            oneCycleMaxLr: 0.01,
            oneCycleTotalSteps: 100000,
            oneCyclePctStart: 0.25,
            oneCycleAnnealStrategy: 'cos',
            oneCycleDivFactor: 25.0,
            oneCycleFinalDivFactor: 10000.0,
            plateauMode: 'min',
            plateauFactor: 0.1,
            plateauPatience: 10,
            plateauThreshold: 0.0001,
            plateauThresholdMode: 'rel',
            plateauCooldown: 0,
            plateauMinLr: 0.00001,
            adaptiveMetric: 'loss',
            adaptivePatience: 5,
            adaptiveFactor: 0.5,
            adaptiveMinLr: 0.00001,
            adaptiveMaxLr: 0.1
        },
        warmup: {
            enabled: true,
            steps: 1000,
            startFactor: 0.1,
            endFactor: 1.0,
            method: 'linear'
        }
    }),

    /**
     * Cosine annealing with restarts for deep learning
     */
    cosineAnnealing: (): Partial<LearningRateSchedulerConfig> => ({
        baseLearningRate: 0.001,
        strategy: {
            type: 'cosine',
            cosineT0: 10000,
            cosineTMult: 2.0,
            cosineEtaMin: 0.00001,
            stepSize: 1000,
            stepGamma: 0.9,
            exponentialGamma: 0.95,
            polynomialPower: 1.0,
            polynomialTotalSteps: 100000,
            cyclicBaseLr: 0.0001,
            cyclicMaxLr: 0.01,
            cyclicStepSize: 2000,
            cyclicMode: 'triangular',
            cyclicGamma: 1.0,
            oneCycleMaxLr: 0.01,
            oneCycleTotalSteps: 100000,
            oneCyclePctStart: 0.25,
            oneCycleAnnealStrategy: 'cos',
            oneCycleDivFactor: 25.0,
            oneCycleFinalDivFactor: 10000.0,
            plateauMode: 'min',
            plateauFactor: 0.1,
            plateauPatience: 10,
            plateauThreshold: 0.0001,
            plateauThresholdMode: 'rel',
            plateauCooldown: 0,
            plateauMinLr: 0.00001,
            adaptiveMetric: 'loss',
            adaptivePatience: 5,
            adaptiveFactor: 0.5,
            adaptiveMinLr: 0.00001,
            adaptiveMaxLr: 0.1
        },
        warmup: {
            enabled: true,
            steps: 2000,
            startFactor: 0.01,
            endFactor: 1.0,
            method: 'linear'
        }
    }),

    /**
     * One-cycle policy for fast convergence
     */
    oneCycle: (): Partial<LearningRateSchedulerConfig> => ({
        baseLearningRate: 0.001,
        strategy: {
            type: 'one_cycle',
            oneCycleMaxLr: 0.01,
            oneCycleTotalSteps: 100000,
            oneCyclePctStart: 0.25,
            oneCycleAnnealStrategy: 'cos',
            oneCycleDivFactor: 25.0,
            oneCycleFinalDivFactor: 10000.0,
            stepSize: 1000,
            stepGamma: 0.9,
            exponentialGamma: 0.95,
            cosineT0: 10000,
            cosineTMult: 2.0,
            cosineEtaMin: 0.00001,
            polynomialPower: 1.0,
            polynomialTotalSteps: 100000,
            cyclicBaseLr: 0.0001,
            cyclicMaxLr: 0.01,
            cyclicStepSize: 2000,
            cyclicMode: 'triangular',
            cyclicGamma: 1.0,
            plateauMode: 'min',
            plateauFactor: 0.1,
            plateauPatience: 10,
            plateauThreshold: 0.0001,
            plateauThresholdMode: 'rel',
            plateauCooldown: 0,
            plateauMinLr: 0.00001,
            adaptiveMetric: 'loss',
            adaptivePatience: 5,
            adaptiveFactor: 0.5,
            adaptiveMinLr: 0.00001,
            adaptiveMaxLr: 0.1
        },
        warmup: {
            enabled: false,
            steps: 1000,
            startFactor: 0.1,
            endFactor: 1.0,
            method: 'linear'
        }
    }),

    /**
     * Adaptive scheduling based on loss plateaus
     */
    adaptive: (): Partial<LearningRateSchedulerConfig> => ({
        baseLearningRate: 0.001,
        strategy: {
            type: 'plateau',
            plateauMode: 'min',
            plateauFactor: 0.5,
            plateauPatience: 10,
            plateauThreshold: 0.001,
            plateauThresholdMode: 'rel',
            plateauCooldown: 5,
            plateauMinLr: 0.00001,
            stepSize: 1000,
            stepGamma: 0.9,
            exponentialGamma: 0.95,
            cosineT0: 10000,
            cosineTMult: 2.0,
            cosineEtaMin: 0.00001,
            polynomialPower: 1.0,
            polynomialTotalSteps: 100000,
            cyclicBaseLr: 0.0001,
            cyclicMaxLr: 0.01,
            cyclicStepSize: 2000,
            cyclicMode: 'triangular',
            cyclicGamma: 1.0,
            oneCycleMaxLr: 0.01,
            oneCycleTotalSteps: 100000,
            oneCyclePctStart: 0.25,
            oneCycleAnnealStrategy: 'cos',
            oneCycleDivFactor: 25.0,
            oneCycleFinalDivFactor: 10000.0,
            adaptiveMetric: 'loss',
            adaptivePatience: 5,
            adaptiveFactor: 0.5,
            adaptiveMinLr: 0.00001,
            adaptiveMaxLr: 0.1
        },
        warmup: {
            enabled: true,
            steps: 1000,
            startFactor: 0.1,
            endFactor: 1.0,
            method: 'linear'
        }
    })
};
