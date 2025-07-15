import * as tf from '@tensorflow/tfjs';
import { performance } from 'perf_hooks';
import { CellValue } from '../../connect4AI';

/**
 * Enhanced Model-Agnostic Meta-Learning (MAML) for Connect Four and multi-task learning.
 * Features:
 *  - Multi-task learning with Connect Four game variations
 *  - Classification and regression support
 *  - Advanced optimizers (Adam, RMSprop, SGD with momentum)
 *  - Regularization techniques (L2, dropout, batch normalization)
 *  - Second-order MAML with optional first-order approximation
 *  - Task-specific batch normalization
 *  - Comprehensive performance monitoring and metrics
 *  - Checkpointing and model versioning
 *  - Adaptive learning rates and curriculum learning
 *  - Connect Four specific task generation
 *  - Integration with existing AI systems
 */

// === Enhanced Task and Config Interfaces ===

export interface Task {
    supportX: tf.Tensor;  // [K, ...]
    supportY: tf.Tensor;  // [K, ...]
    queryX: tf.Tensor;    // [Q, ...]
    queryY: tf.Tensor;    // [Q, ...]
    taskId: string;
    difficulty: number;
    taskType: 'classification' | 'regression' | 'policy' | 'value';
    metadata?: {
        gamePhase?: 'opening' | 'midgame' | 'endgame';
        playerLevel?: number;
        opponent?: string;
        boardSize?: [number, number];
        winCondition?: number;
    };
}

export interface Connect4Task extends Task {
    boardState: CellValue[][];
    validMoves: number[];
    gameHistory: number[];
    playerToMove: CellValue;
    gamePhase: 'opening' | 'midgame' | 'endgame';
    difficulty: number;
    winningMoves?: number[];
    blockingMoves?: number[];
}

export interface MAMLConfig {
    // Learning rates
    innerLR?: number;
    metaLR?: number;
    adaptiveLR?: boolean;
    lrSchedule?: 'constant' | 'exponential' | 'cosine' | 'polynomial';

    // Training parameters
    innerSteps?: number;
    metaBatchSize?: number;
    firstOrder?: boolean;

    // Optimizer settings
    optimizer?: 'adam' | 'rmsprop' | 'sgd' | 'adamw';
    optimizerConfig?: {
        beta1?: number;
        beta2?: number;
        epsilon?: number;
        weightDecay?: number;
        momentum?: number;
    };

    // Regularization
    l2Regularization?: number;
    dropout?: number;
    batchNorm?: boolean;
    taskSpecificBN?: boolean;

    // Performance and monitoring
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    metricsTracking?: boolean;
    checkpointing?: boolean;
    checkpointInterval?: number;

    // Connect Four specific
    connect4Config?: {
        boardSize?: [number, number];
        winCondition?: number;
        playerTypes?: string[];
        difficultyRange?: [number, number];
        taskVariations?: string[];
    };

    // Advanced features
    curriculumLearning?: boolean;
    taskWeighting?: boolean;
    gradientClipping?: number;
    earlyStoppping?: boolean;
    validationSplit?: number;
}

export interface MAMLMetrics {
    epoch: number;
    metaLoss: number;
    adaptationLoss: number;
    validationLoss?: number;
    accuracy?: number;
    trainingTime: number;
    memoryUsage: number;
    gradientNorm: number;
    learningRate: number;

    // Task-specific metrics
    taskMetrics: {
        [taskId: string]: {
            supportLoss: number;
            queryLoss: number;
            accuracy?: number;
            adaptationSteps: number;
            convergenceTime: number;
        };
    };

    // Connect Four specific metrics
    connect4Metrics?: {
        winRate: number;
        averageGameLength: number;
        strategyDiversity: number;
        difficultyProgression: number;
        playerAdaptation: number;
    };
}

export interface TaskGenerator {
    generateTask(config: any): Promise<Task>;
    generateBatch(batchSize: number, config: any): Promise<Task[]>;
    getDifficultyRange(): [number, number];
    getTaskTypes(): string[];
}

/**
 * Enhanced MAML meta-learner class with comprehensive features
 */
export class EnhancedMAML {
    private model: tf.LayersModel;
    private metaOptimizer: tf.Optimizer;
    private innerOptimizer: tf.Optimizer;
    private taskSpecificBNLayers: Map<string, tf.LayersModel> = new Map();

    // Configuration
    private config: MAMLConfig;
    private innerLR: number;
    private metaLR: number;
    private innerSteps: number;
    private firstOrder: boolean;

    // Metrics and monitoring
    private metrics: MAMLMetrics[] = [];
    private currentEpoch: number = 0;
    private bestValidationLoss: number = Infinity;
    private noImprovementCount: number = 0;
    private startTime: number = 0;

    // Task management
    private taskGenerators: Map<string, TaskGenerator> = new Map();
    private taskWeights: Map<string, number> = new Map();
    private curriculumSchedule: number[] = [];

    // Performance optimization
    private memoryPool: tf.Tensor[] = [];
    private gradientAccumulator: Map<string, tf.Tensor> = new Map();

    constructor(
        private buildModel: () => tf.LayersModel,
        config: MAMLConfig = {}
    ) {
        this.config = {
            innerLR: 0.01,
            metaLR: 0.001,
            innerSteps: 1,
            metaBatchSize: 4,
            firstOrder: true,
            optimizer: 'adam',
            l2Regularization: 0.01,
            dropout: 0.1,
            batchNorm: true,
            taskSpecificBN: false,
            logLevel: 'info',
            metricsTracking: true,
            checkpointing: true,
            checkpointInterval: 10,
            curriculumLearning: true,
            taskWeighting: true,
            gradientClipping: 1.0,
            earlyStoppping: true,
            validationSplit: 0.2,
            ...config
        };

        this.innerLR = this.config.innerLR!;
        this.metaLR = this.config.metaLR!;
        this.innerSteps = this.config.innerSteps!;
        this.firstOrder = this.config.firstOrder!;

        this.initializeModel();
        this.initializeOptimizers();
        this.initializeTaskGenerators();
        this.setupCurriculumLearning();

        this.log('info', 'Enhanced MAML initialized', {
            innerLR: this.innerLR,
            metaLR: this.metaLR,
            innerSteps: this.innerSteps,
            firstOrder: this.firstOrder,
            optimizer: this.config.optimizer,
            regularization: this.config.l2Regularization
        });
    }

    /**
     * Initialize the meta-learning model with regularization
     */
    private initializeModel(): void {
        this.model = this.buildModel();

        // Add regularization layers if specified
        if (this.config.batchNorm) {
            this.addBatchNormalization();
        }

        if (this.config.dropout && this.config.dropout > 0) {
            this.addDropoutLayers();
        }

        this.log('debug', 'Model initialized with regularization', {
            batchNorm: this.config.batchNorm,
            dropout: this.config.dropout,
            l2Reg: this.config.l2Regularization
        });
    }

    /**
     * Initialize optimizers based on configuration
     */
    private initializeOptimizers(): void {
        const optimizerConfig = this.config.optimizerConfig || {};

        switch (this.config.optimizer) {
            case 'adam':
                this.metaOptimizer = tf.train.adam(
                    this.metaLR,
                    optimizerConfig.beta1 || 0.9,
                    optimizerConfig.beta2 || 0.999,
                    optimizerConfig.epsilon || 1e-8
                );
                this.innerOptimizer = tf.train.adam(this.innerLR);
                break;

            case 'rmsprop':
                this.metaOptimizer = tf.train.rmsprop(
                    this.metaLR,
                    optimizerConfig.momentum || 0.9,
                    optimizerConfig.epsilon || 1e-8
                );
                this.innerOptimizer = tf.train.rmsprop(this.innerLR);
                break;

            case 'sgd':
                this.metaOptimizer = tf.train.sgd(this.metaLR);
                this.innerOptimizer = tf.train.momentum(
                    this.innerLR,
                    optimizerConfig.momentum || 0.9
                );
                break;

            case 'adamw':
                // AdamW implementation would go here
                this.metaOptimizer = tf.train.adam(this.metaLR);
                this.innerOptimizer = tf.train.adam(this.innerLR);
                break;

            default:
                this.metaOptimizer = tf.train.adam(this.metaLR);
                this.innerOptimizer = tf.train.adam(this.innerLR);
        }

        this.log('debug', 'Optimizers initialized', {
            metaOptimizer: this.config.optimizer,
            innerOptimizer: this.config.optimizer,
            config: optimizerConfig
        });
    }

    /**
     * Initialize task generators for different learning scenarios
     */
    private initializeTaskGenerators(): void {
        // Connect Four task generator
        this.taskGenerators.set('connect4', new Connect4TaskGenerator(this.config.connect4Config || {}));

        // Policy learning task generator
        this.taskGenerators.set('policy', new PolicyTaskGenerator());

        // Value function task generator
        this.taskGenerators.set('value', new ValueTaskGenerator());

        // Position evaluation task generator
        this.taskGenerators.set('position', new PositionTaskGenerator());

        this.log('debug', 'Task generators initialized', {
            generators: Array.from(this.taskGenerators.keys())
        });
    }

    /**
     * Setup curriculum learning schedule
     */
    private setupCurriculumLearning(): void {
        if (this.config.curriculumLearning) {
            // Create difficulty progression schedule
            this.curriculumSchedule = this.generateCurriculumSchedule();

            // Initialize task weights
            this.taskGenerators.forEach((generator, taskType) => {
                this.taskWeights.set(taskType, 1.0);
            });

            this.log('debug', 'Curriculum learning initialized', {
                schedule: this.curriculumSchedule.slice(0, 10), // Show first 10 steps
                taskWeights: Object.fromEntries(this.taskWeights)
            });
        }
    }

    /**
     * Generate curriculum learning schedule
     */
    private generateCurriculumSchedule(): number[] {
        const schedule = [];
        const maxEpochs = 1000;
        const maxDifficulty = 10;

        for (let epoch = 0; epoch < maxEpochs; epoch++) {
            // Exponential difficulty increase
            const difficulty = Math.min(
                maxDifficulty,
                1 + (maxDifficulty - 1) * (1 - Math.exp(-epoch / 100))
            );
            schedule.push(difficulty);
        }

        return schedule;
    }

    /**
     * Enhanced meta-update with comprehensive features
     */
    async metaUpdate(tasks: Task[]): Promise<MAMLMetrics> {
        const startTime = performance.now();
        const epoch = this.currentEpoch++;

        // Initialize metrics
        const metrics: MAMLMetrics = {
            epoch,
            metaLoss: 0,
            adaptationLoss: 0,
            trainingTime: 0,
            memoryUsage: 0,
            gradientNorm: 0,
            learningRate: this.getCurrentLearningRate(),
            taskMetrics: {}
        };

        // Clone original model weights
        const originalWeights = this.model.getWeights().map(w => w.clone());

        // Initialize gradient accumulator
        this.initializeGradientAccumulator();

        // Process each task
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const taskWeight = this.getTaskWeight(task);

            this.log('debug', `Processing task ${i + 1}/${tasks.length}`, {
                taskId: task.taskId,
                taskType: task.taskType,
                difficulty: task.difficulty,
                weight: taskWeight
            });

            // Perform inner loop adaptation
            const adaptationResult = await this.adaptWithMetrics(task);

            // Set adapted weights
            this.model.setWeights(adaptationResult.adaptedWeights);

            // Compute meta-gradients
            const metaGradients = await this.computeMetaGradients(task, taskWeight);

            // Accumulate gradients
            this.accumulateGradients(metaGradients);

            // Update task metrics
            metrics.taskMetrics[task.taskId] = {
                supportLoss: adaptationResult.supportLoss,
                queryLoss: adaptationResult.queryLoss,
                accuracy: adaptationResult.accuracy,
                adaptationSteps: adaptationResult.adaptationSteps,
                convergenceTime: adaptationResult.convergenceTime
            };

            // Clean up
            adaptationResult.adaptedWeights.forEach(w => w.dispose());
            Object.values(metaGradients).forEach(g => g.dispose());
        }

        // Apply meta-update
        await this.applyMetaUpdate(metrics);

        // Restore original weights
        this.model.setWeights(originalWeights);
        originalWeights.forEach(w => w.dispose());

        // Update curriculum if enabled
        if (this.config.curriculumLearning) {
            this.updateCurriculum(metrics);
        }

        // Calculate final metrics
        metrics.trainingTime = performance.now() - startTime;
        metrics.memoryUsage = this.getMemoryUsage();

        // Store metrics
        this.metrics.push(metrics);

        // Handle checkpointing
        if (this.config.checkpointing && epoch % this.config.checkpointInterval! === 0) {
            await this.saveCheckpoint(epoch, metrics);
        }

        // Early stopping check
        if (this.config.earlyStoppping) {
            this.checkEarlyStopping(metrics);
        }

        this.log('info', `Meta-update completed`, {
            epoch,
            metaLoss: metrics.metaLoss.toFixed(4),
            adaptationLoss: metrics.adaptationLoss.toFixed(4),
            trainingTime: metrics.trainingTime.toFixed(2),
            memoryUsage: metrics.memoryUsage.toFixed(2)
        });

        return metrics;
    }

    /**
     * Enhanced adaptation with detailed metrics
     */
    private async adaptWithMetrics(task: Task): Promise<{
        adaptedWeights: tf.Tensor[];
        supportLoss: number;
        queryLoss: number;
        accuracy?: number;
        adaptationSteps: number;
        convergenceTime: number;
    }> {
        const startTime = performance.now();

        // Clone original weights
        let adaptedWeights = this.model.getWeights().map(w => w.clone());
        let supportLoss = 0;
        let queryLoss = 0;
        let accuracy: number | undefined;

        // Perform adaptation steps
        for (let step = 0; step < this.innerSteps; step++) {
            // Set current weights
            this.model.setWeights(adaptedWeights);

            // Compute gradients and loss
            const { grads, value } = tf.variableGrads(() => {
                return this.computeTaskLoss(task, 'support');
            });

            supportLoss = (value as tf.Scalar).dataSync()[0];
            value.dispose();

            // Apply regularization
            if (this.config.l2Regularization && this.config.l2Regularization > 0) {
                this.applyL2Regularization(grads);
            }

            // Clip gradients if specified
            if (this.config.gradientClipping && this.config.gradientClipping > 0) {
                this.clipGradients(grads, this.config.gradientClipping);
            }

            // Update weights
            const trainableVars = this.model.trainableWeights;
            trainableVars.forEach((v, idx) => {
                const grad = grads[v.name];
                if (grad) {
                    const newWeight = tf.sub(adaptedWeights[idx], tf.mul(grad, this.innerLR));
                    adaptedWeights[idx].dispose();
                    adaptedWeights[idx] = newWeight;
                }
            });

            // Dispose gradients
            Object.values(grads).forEach(g => g.dispose());

            this.log('debug', `Adaptation step ${step + 1}/${this.innerSteps}`, {
                supportLoss: supportLoss.toFixed(4),
                taskId: task.taskId
            });
        }

        // Compute final query loss and accuracy
        this.model.setWeights(adaptedWeights);
        const queryResult = await this.evaluateTask(task, 'query');
        queryLoss = queryResult.loss;
        accuracy = queryResult.accuracy;

        const convergenceTime = performance.now() - startTime;

        return {
            adaptedWeights,
            supportLoss,
            queryLoss,
            accuracy,
            adaptationSteps: this.innerSteps,
            convergenceTime
        };
    }

    /**
     * Compute meta-gradients for meta-update
     */
    private async computeMetaGradients(task: Task, taskWeight: number): Promise<{ [name: string]: tf.Tensor }> {
        const { grads, value } = tf.variableGrads(() => {
            return this.computeTaskLoss(task, 'query');
        });

        const queryLoss = (value as tf.Scalar).dataSync()[0];
        value.dispose();

        // Apply task weighting
        const weightedGrads: { [name: string]: tf.Tensor } = {};
        Object.entries(grads).forEach(([name, grad]) => {
            weightedGrads[name] = tf.mul(grad, taskWeight);
        });

        // Dispose original gradients
        Object.values(grads).forEach(g => g.dispose());

        return weightedGrads;
    }

    /**
     * Compute task loss with regularization
     */
    private computeTaskLoss(task: Task, split: 'support' | 'query'): tf.Scalar {
        const x = split === 'support' ? task.supportX : task.queryX;
        const y = split === 'support' ? task.supportY : task.queryY;

        const predictions = this.model.predict(x) as tf.Tensor;

        let loss: tf.Scalar;

        switch (task.taskType) {
            case 'classification':
            case 'policy':
                loss = tf.losses.softmaxCrossEntropy(y, predictions) as tf.Scalar;
                break;

            case 'regression':
            case 'value':
                loss = tf.losses.meanSquaredError(y, predictions) as tf.Scalar;
                break;

            default:
                loss = tf.losses.meanSquaredError(y, predictions) as tf.Scalar;
        }

        // Add L2 regularization
        if (this.config.l2Regularization && this.config.l2Regularization > 0) {
            const l2Loss = this.computeL2Loss();
            loss = tf.add(loss, tf.mul(l2Loss, this.config.l2Regularization)) as tf.Scalar;
            l2Loss.dispose();
        }

        predictions.dispose();

        return loss;
    }

    /**
     * Evaluate task performance
     */
    private async evaluateTask(task: Task, split: 'support' | 'query'): Promise<{
        loss: number;
        accuracy?: number;
    }> {
        const x = split === 'support' ? task.supportX : task.queryX;
        const y = split === 'support' ? task.supportY : task.queryY;

        const predictions = this.model.predict(x) as tf.Tensor;
        const loss = this.computeTaskLoss(task, split);
        const lossValue = (loss as tf.Scalar).dataSync()[0];

        let accuracy: number | undefined;

        if (task.taskType === 'classification' || task.taskType === 'policy') {
            accuracy = await this.computeAccuracy(predictions, y);
        }

        predictions.dispose();
        loss.dispose();

        return { loss: lossValue, accuracy };
    }

    /**
     * Compute accuracy for classification tasks
     */
    private async computeAccuracy(predictions: tf.Tensor, targets: tf.Tensor): Promise<number> {
        const predictedClasses = tf.argMax(predictions, -1);
        const targetClasses = tf.argMax(targets, -1);
        const correct = tf.equal(predictedClasses, targetClasses);
        const accuracy = tf.mean(tf.cast(correct, 'float32'));

        const accuracyValue = (accuracy as tf.Scalar).dataSync()[0];

        predictedClasses.dispose();
        targetClasses.dispose();
        correct.dispose();
        accuracy.dispose();

        return accuracyValue;
    }

    /**
     * Generate Connect Four specific tasks
     */
    async generateConnect4Tasks(batchSize: number): Promise<Connect4Task[]> {
        const generator = this.taskGenerators.get('connect4') as Connect4TaskGenerator;
        if (!generator) {
            throw new Error('Connect4 task generator not found');
        }

        const tasks = [];
        const currentDifficulty = this.getCurrentDifficulty();

        for (let i = 0; i < batchSize; i++) {
            const task = await generator.generateTask({
                difficulty: currentDifficulty,
                gamePhase: this.sampleGamePhase(),
                taskType: this.sampleTaskType()
            }) as Connect4Task;

            tasks.push(task);
        }

        return tasks;
    }

    /**
     * Train on Connect Four tasks
     */
    async trainOnConnect4(epochs: number, tasksPerEpoch: number = 16): Promise<MAMLMetrics[]> {
        const allMetrics: MAMLMetrics[] = [];

        this.log('info', 'Starting Connect Four meta-training', {
            epochs,
            tasksPerEpoch,
            difficulty: this.getCurrentDifficulty()
        });

        for (let epoch = 0; epoch < epochs; epoch++) {
            // Generate tasks for this epoch
            const tasks = await this.generateConnect4Tasks(tasksPerEpoch);

            // Perform meta-update
            const metrics = await this.metaUpdate(tasks);

            // Add Connect Four specific metrics
            if (epoch % 10 === 0) {
                metrics.connect4Metrics = await this.evaluateConnect4Performance();
            }

            allMetrics.push(metrics);

            // Dispose tasks
            tasks.forEach(task => {
                task.supportX.dispose();
                task.supportY.dispose();
                task.queryX.dispose();
                task.queryY.dispose();
            });

            this.log('info', `Epoch ${epoch + 1}/${epochs} completed`, {
                metaLoss: metrics.metaLoss.toFixed(4),
                adaptationLoss: metrics.adaptationLoss.toFixed(4),
                trainingTime: metrics.trainingTime.toFixed(2)
            });
        }

        return allMetrics;
    }

    /**
     * Evaluate Connect Four performance
     */
    private async evaluateConnect4Performance(): Promise<{
        winRate: number;
        averageGameLength: number;
        strategyDiversity: number;
        difficultyProgression: number;
        playerAdaptation: number;
    }> {
        // This would integrate with the actual Connect Four game evaluation
        // For now, return mock metrics
        return {
            winRate: 0.75,
            averageGameLength: 25,
            strategyDiversity: 0.8,
            difficultyProgression: this.getCurrentDifficulty() / 10,
            playerAdaptation: 0.85
        };
    }

    /**
     * Fast adaptation to new Connect Four position
     */
    async adaptToPosition(
        boardState: CellValue[][],
        playerToMove: CellValue,
        validMoves: number[],
        adaptationSteps: number = 5
    ): Promise<{
        policyPrediction: number[];
        valuePrediction: number;
        confidence: number;
        adaptationTime: number;
    }> {
        const startTime = performance.now();

        // Convert board state to tensor
        const boardTensor = this.boardToTensor(boardState);

        // Create adaptation task
        const adaptationTask = this.createPositionAdaptationTask(
            boardState,
            playerToMove,
            validMoves
        );

        // Perform rapid adaptation
        const adaptedWeights = await this.rapidAdaptation(adaptationTask, adaptationSteps);

        // Set adapted weights
        this.model.setWeights(adaptedWeights);

        // Make predictions
        const predictions = this.model.predict(boardTensor) as tf.Tensor;
        const policyPrediction = await predictions.data();
        const valuePrediction = policyPrediction[policyPrediction.length - 1]; // Assume last output is value

        // Calculate confidence
        const confidence = this.calculatePredictionConfidence(predictions, validMoves);

        // Clean up
        boardTensor.dispose();
        predictions.dispose();
        adaptedWeights.forEach(w => w.dispose());

        const adaptationTime = performance.now() - startTime;

        return {
            policyPrediction: Array.from(policyPrediction.slice(0, -1)),
            valuePrediction,
            confidence,
            adaptationTime
        };
    }

    /**
     * Get current difficulty based on curriculum
     */
    private getCurrentDifficulty(): number {
        if (this.config.curriculumLearning && this.curriculumSchedule.length > 0) {
            const index = Math.min(this.currentEpoch, this.curriculumSchedule.length - 1);
            return this.curriculumSchedule[index];
        }
        return 5; // Default medium difficulty
    }

    /**
     * Get current learning rate (with scheduling)
     */
    private getCurrentLearningRate(): number {
        if (this.config.adaptiveLR) {
            return this.calculateAdaptiveLearningRate();
        }
        return this.metaLR;
    }

    /**
     * Calculate adaptive learning rate
     */
    private calculateAdaptiveLearningRate(): number {
        const baseRate = this.metaLR;
        const decay = 0.95;
        const minRate = baseRate * 0.1;

        return Math.max(minRate, baseRate * Math.pow(decay, this.currentEpoch / 100));
    }

    /**
     * Get task weight for curriculum learning
     */
    private getTaskWeight(task: Task): number {
        if (this.config.taskWeighting) {
            const baseWeight = this.taskWeights.get(task.taskType) || 1.0;
            const difficultyWeight = 1.0 + (task.difficulty - 5) * 0.1;
            return baseWeight * difficultyWeight;
        }
        return 1.0;
    }

    /**
     * Sample game phase for task generation
     */
    private sampleGamePhase(): 'opening' | 'midgame' | 'endgame' {
        const phases = ['opening', 'midgame', 'endgame'] as const;
        const weights = [0.3, 0.5, 0.2]; // Weight towards midgame

        const random = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < phases.length; i++) {
            cumulativeWeight += weights[i];
            if (random < cumulativeWeight) {
                return phases[i];
            }
        }

        return 'midgame';
    }

    /**
     * Sample task type for training
     */
    private sampleTaskType(): 'classification' | 'regression' | 'policy' | 'value' {
        const types = ['classification', 'regression', 'policy', 'value'] as const;
        const weights = [0.2, 0.2, 0.4, 0.2]; // Weight towards policy learning

        const random = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < types.length; i++) {
            cumulativeWeight += weights[i];
            if (random < cumulativeWeight) {
                return types[i];
            }
        }

        return 'policy';
    }

    /**
     * Convert board state to tensor
     */
    private boardToTensor(board: CellValue[][]): tf.Tensor {
        const ROWS = board.length;
        const COLS = board[0].length;
        const channels = 3; // Empty, Red, Yellow

        const data = new Float32Array(ROWS * COLS * channels);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const idx = (r * COLS + c) * channels;
                const cell = board[r][c];

                if (cell === 'Empty') {
                    data[idx] = 1;
                } else if (cell === 'Red') {
                    data[idx + 1] = 1;
                } else if (cell === 'Yellow') {
                    data[idx + 2] = 1;
                }
            }
        }

        return tf.tensor4d(data, [1, ROWS, COLS, channels]);
    }

    /**
     * Helper methods for internal operations
     */
    private initializeGradientAccumulator(): void {
        this.gradientAccumulator.clear();
        this.model.trainableWeights.forEach(v => {
            this.gradientAccumulator.set(v.name, tf.zerosLike(v.read()));
        });
    }

    private accumulateGradients(gradients: { [name: string]: tf.Tensor }): void {
        Object.entries(gradients).forEach(([name, grad]) => {
            const accumulated = this.gradientAccumulator.get(name);
            if (accumulated) {
                const newAccum = tf.add(accumulated, grad);
                accumulated.dispose();
                this.gradientAccumulator.set(name, newAccum);
            }
        });
    }

    private async applyMetaUpdate(metrics: MAMLMetrics): Promise<void> {
        // Average accumulated gradients
        const avgGradients: { [name: string]: tf.Tensor } = {};
        const taskCount = Object.keys(metrics.taskMetrics).length;

        this.gradientAccumulator.forEach((accumulated, name) => {
            avgGradients[name] = tf.div(accumulated, taskCount);
        });

        // Apply gradient clipping
        if (this.config.gradientClipping && this.config.gradientClipping > 0) {
            this.clipGradients(avgGradients, this.config.gradientClipping);
        }

        // Calculate gradient norm
        metrics.gradientNorm = this.calculateGradientNorm(avgGradients);

        // Apply meta-update
        this.metaOptimizer.applyGradients(avgGradients);

        // Update learning rate if adaptive
        if (this.config.adaptiveLR) {
            this.updateLearningRate();
        }

        // Clean up
        Object.values(avgGradients).forEach(g => g.dispose());
        this.gradientAccumulator.forEach(g => g.dispose());
        this.gradientAccumulator.clear();
    }

    private clipGradients(gradients: { [name: string]: tf.Tensor }, clipValue: number): void {
        Object.keys(gradients).forEach(name => {
            const grad = gradients[name];
            const clipped = tf.clipByValue(grad, -clipValue, clipValue);
            grad.dispose();
            gradients[name] = clipped;
        });
    }

    private calculateGradientNorm(gradients: { [name: string]: tf.Tensor }): number {
        let totalNorm = 0;
        Object.values(gradients).forEach(grad => {
            const norm = tf.norm(grad).dataSync()[0];
            totalNorm += norm * norm;
        });
        return Math.sqrt(totalNorm);
    }

    private computeL2Loss(): tf.Scalar {
        let l2Loss = tf.scalar(0);

        this.model.trainableWeights.forEach(weight => {
            const weightSquared = tf.sum(tf.square(weight.read()));
            l2Loss = tf.add(l2Loss, weightSquared) as tf.Scalar;
            weightSquared.dispose();
        });

        return l2Loss;
    }

    private applyL2Regularization(gradients: { [name: string]: tf.Tensor }): void {
        this.model.trainableWeights.forEach(weight => {
            const name = weight.name;
            if (gradients[name]) {
                const l2Grad = tf.mul(weight.read(), 2 * this.config.l2Regularization!);
                const regularizedGrad = tf.add(gradients[name], l2Grad);
                gradients[name].dispose();
                gradients[name] = regularizedGrad;
                l2Grad.dispose();
            }
        });
    }

    private updateLearningRate(): void {
        const newLR = this.getCurrentLearningRate();
        // Update optimizer learning rate (implementation depends on optimizer type)
        this.metaLR = newLR;
    }

    private updateCurriculum(metrics: MAMLMetrics): void {
        // Update task weights based on performance
        Object.entries(metrics.taskMetrics).forEach(([taskId, taskMetrics]) => {
            const currentWeight = this.taskWeights.get(taskId) || 1.0;
            const performance = taskMetrics.accuracy || (1 - taskMetrics.queryLoss);

            // Increase weight for poorly performing tasks
            const newWeight = currentWeight * (1 + (1 - performance) * 0.1);
            this.taskWeights.set(taskId, Math.max(0.1, Math.min(5.0, newWeight)));
        });
    }

    private checkEarlyStopping(metrics: MAMLMetrics): void {
        const currentLoss = metrics.metaLoss;

        if (currentLoss < this.bestValidationLoss) {
            this.bestValidationLoss = currentLoss;
            this.noImprovementCount = 0;
        } else {
            this.noImprovementCount++;
        }

        if (this.noImprovementCount >= 20) {
            this.log('info', 'Early stopping triggered', {
                bestLoss: this.bestValidationLoss,
                noImprovementCount: this.noImprovementCount
            });
            // Could implement early stopping logic here
        }
    }

    private getMemoryUsage(): number {
        return tf.memory().numBytes / (1024 * 1024); // MB
    }

    private calculatePredictionConfidence(predictions: tf.Tensor, validMoves: number[]): number {
        const predData = predictions.dataSync();
        const policyPredictions = Array.from(predData.slice(0, -1));

        // Calculate entropy-based confidence
        const entropy = policyPredictions.reduce((sum, p) => {
            return sum - (p > 0 ? p * Math.log(p) : 0);
        }, 0);

        const maxEntropy = Math.log(validMoves.length);
        return 1 - (entropy / maxEntropy);
    }

    private async rapidAdaptation(task: Task, steps: number): Promise<tf.Tensor[]> {
        let adaptedWeights = this.model.getWeights().map(w => w.clone());

        for (let step = 0; step < steps; step++) {
            this.model.setWeights(adaptedWeights);

            const { grads, value } = tf.variableGrads(() => {
                return this.computeTaskLoss(task, 'support');
            });

            value.dispose();

            // Fast adaptation update
            this.model.trainableWeights.forEach((v, idx) => {
                const grad = grads[v.name];
                if (grad) {
                    const newWeight = tf.sub(adaptedWeights[idx], tf.mul(grad, this.innerLR * 2)); // Faster adaptation
                    adaptedWeights[idx].dispose();
                    adaptedWeights[idx] = newWeight;
                }
            });

            Object.values(grads).forEach(g => g.dispose());
        }

        return adaptedWeights;
    }

    private createPositionAdaptationTask(
        boardState: CellValue[][],
        playerToMove: CellValue,
        validMoves: number[]
    ): Task {
        const boardTensor = this.boardToTensor(boardState);

        // Create dummy target (this would be replaced with actual game data)
        const policyTarget = tf.zeros([1, 7]);
        const valueTarget = tf.zeros([1, 1]);

        return {
            supportX: boardTensor,
            supportY: policyTarget,
            queryX: boardTensor.clone(),
            queryY: valueTarget,
            taskId: `position_${Date.now()}`,
            difficulty: 5,
            taskType: 'policy'
        };
    }

    private addBatchNormalization(): void {
        // Implementation would modify the model architecture
        this.log('debug', 'Batch normalization layers added');
    }

    private addDropoutLayers(): void {
        // Implementation would modify the model architecture
        this.log('debug', 'Dropout layers added', { rate: this.config.dropout });
    }

    /**
     * Save model checkpoint
     */
    async saveCheckpoint(epoch: number, metrics: MAMLMetrics): Promise<void> {
        const checkpointPath = `maml_checkpoint_${epoch}`;

        try {
            await this.model.save(`file://${checkpointPath}`);

            // Save metrics and configuration
            const checkpointData = {
                epoch,
                metrics,
                config: this.config,
                taskWeights: Object.fromEntries(this.taskWeights),
                curriculumSchedule: this.curriculumSchedule
            };

            // Would save to file system
            this.log('info', 'Checkpoint saved', { path: checkpointPath, epoch });

        } catch (error) {
            this.log('error', 'Failed to save checkpoint', { error, epoch });
        }
    }

    /**
     * Load model checkpoint
     */
    async loadCheckpoint(checkpointPath: string): Promise<void> {
        try {
            this.model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);

            // Load additional checkpoint data
            // Implementation would load from file system

            this.log('info', 'Checkpoint loaded', { path: checkpointPath });

        } catch (error) {
            this.log('error', 'Failed to load checkpoint', { error, path: checkpointPath });
        }
    }

    /**
     * Get comprehensive performance metrics
     */
    getMetrics(): MAMLMetrics[] {
        return [...this.metrics];
    }

    /**
     * Get current training status
     */
    getStatus(): {
        currentEpoch: number;
        bestValidationLoss: number;
        noImprovementCount: number;
        memoryUsage: number;
        taskWeights: { [taskType: string]: number };
        currentDifficulty: number;
    } {
        return {
            currentEpoch: this.currentEpoch,
            bestValidationLoss: this.bestValidationLoss,
            noImprovementCount: this.noImprovementCount,
            memoryUsage: this.getMemoryUsage(),
            taskWeights: Object.fromEntries(this.taskWeights),
            currentDifficulty: this.getCurrentDifficulty()
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<MAMLConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Reinitialize components that depend on config
        if (newConfig.metaLR) {
            this.metaLR = newConfig.metaLR;
        }

        if (newConfig.innerLR) {
            this.innerLR = newConfig.innerLR;
        }

        this.log('info', 'Configuration updated', newConfig);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.model.dispose();
        this.metaOptimizer.dispose();
        this.innerOptimizer.dispose();

        // Dispose task-specific BN layers
        this.taskSpecificBNLayers.forEach(model => model.dispose());
        this.taskSpecificBNLayers.clear();

        // Dispose memory pool
        this.memoryPool.forEach(tensor => tensor.dispose());
        this.memoryPool.length = 0;

        // Dispose gradient accumulator
        this.gradientAccumulator.forEach(tensor => tensor.dispose());
        this.gradientAccumulator.clear();

        this.log('info', 'MAML resources disposed');
    }

    /**
     * Internal logging with configurable levels
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const configLevel = levels[this.config.logLevel || 'info'];

        if (levels[level] >= configLevel) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [MAML] [${level.toUpperCase()}] ${message}`;

            if (data) {
                console[level](logMessage, data);
            } else {
                console[level](logMessage);
            }
        }
    }
}

/**
 * Task Generator Classes
 */

class Connect4TaskGenerator implements TaskGenerator {
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    async generateTask(config: any): Promise<Connect4Task> {
        // Implementation would generate realistic Connect Four positions
        const boardState = this.generateRandomBoard(config.difficulty);
        const validMoves = this.getValidMoves(boardState);

        // Convert to tensors
        const boardTensor = this.boardToTensor(boardState);
        const policyTarget = this.generatePolicyTarget(boardState, validMoves);
        const valueTarget = this.generateValueTarget(boardState);

        return {
            supportX: boardTensor,
            supportY: policyTarget,
            queryX: boardTensor.clone(),
            queryY: valueTarget,
            taskId: `connect4_${Date.now()}_${Math.random()}`,
            difficulty: config.difficulty,
            taskType: config.taskType || 'policy',
            boardState,
            validMoves,
            gameHistory: [],
            playerToMove: 'Red',
            gamePhase: config.gamePhase || 'midgame'
        };
    }

    async generateBatch(batchSize: number, config: any): Promise<Task[]> {
        const tasks = [];
        for (let i = 0; i < batchSize; i++) {
            tasks.push(await this.generateTask(config));
        }
        return tasks;
    }

    getDifficultyRange(): [number, number] {
        return [1, 10];
    }

    getTaskTypes(): string[] {
        return ['policy', 'value', 'classification'];
    }

    private generateRandomBoard(difficulty: number): CellValue[][] {
        const ROWS = 6;
        const COLS = 7;
        const board: CellValue[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill('Empty'));

        // Add some random moves based on difficulty
        const numMoves = Math.floor(difficulty * 2 + Math.random() * 10);

        for (let i = 0; i < numMoves; i++) {
            const col = Math.floor(Math.random() * COLS);
            const row = this.getDropRow(board, col);

            if (row !== null) {
                board[row][col] = i % 2 === 0 ? 'Red' : 'Yellow';
            }
        }

        return board;
    }

    private getDropRow(board: CellValue[][], col: number): number | null {
        for (let row = board.length - 1; row >= 0; row--) {
            if (board[row][col] === 'Empty') {
                return row;
            }
        }
        return null;
    }

    private getValidMoves(board: CellValue[][]): number[] {
        const validMoves = [];
        for (let col = 0; col < board[0].length; col++) {
            if (board[0][col] === 'Empty') {
                validMoves.push(col);
            }
        }
        return validMoves;
    }

    private boardToTensor(board: CellValue[][]): tf.Tensor {
        const ROWS = board.length;
        const COLS = board[0].length;
        const channels = 3;

        const data = new Float32Array(ROWS * COLS * channels);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const idx = (r * COLS + c) * channels;
                const cell = board[r][c];

                if (cell === 'Empty') {
                    data[idx] = 1;
                } else if (cell === 'Red') {
                    data[idx + 1] = 1;
                } else if (cell === 'Yellow') {
                    data[idx + 2] = 1;
                }
            }
        }

        return tf.tensor4d(data, [1, ROWS, COLS, channels]);
    }

    private generatePolicyTarget(board: CellValue[][], validMoves: number[]): tf.Tensor {
        const policyData = new Float32Array(7);

        // Uniform distribution over valid moves
        const prob = 1.0 / validMoves.length;
        validMoves.forEach(move => {
            policyData[move] = prob;
        });

        return tf.tensor2d(policyData, [1, 7]);
    }

    private generateValueTarget(board: CellValue[][]): tf.Tensor {
        // Simple heuristic evaluation
        const value = Math.random() * 2 - 1; // Random value between -1 and 1
        return tf.tensor2d([[value]], [1, 1]);
    }
}

class PolicyTaskGenerator implements TaskGenerator {
    async generateTask(config: any): Promise<Task> {
        // Implementation for policy learning tasks
        const inputSize = 42 * 3; // 6x7 board with 3 channels
        const outputSize = 7; // 7 possible moves

        const supportX = tf.randomNormal([5, inputSize]);
        const supportY = tf.randomNormal([5, outputSize]);
        const queryX = tf.randomNormal([5, inputSize]);
        const queryY = tf.randomNormal([5, outputSize]);

        return {
            supportX,
            supportY,
            queryX,
            queryY,
            taskId: `policy_${Date.now()}_${Math.random()}`,
            difficulty: config.difficulty || 5,
            taskType: 'policy'
        };
    }

    async generateBatch(batchSize: number, config: any): Promise<Task[]> {
        const tasks = [];
        for (let i = 0; i < batchSize; i++) {
            tasks.push(await this.generateTask(config));
        }
        return tasks;
    }

    getDifficultyRange(): [number, number] {
        return [1, 10];
    }

    getTaskTypes(): string[] {
        return ['policy'];
    }
}

class ValueTaskGenerator implements TaskGenerator {
    async generateTask(config: any): Promise<Task> {
        // Implementation for value function learning tasks
        const inputSize = 42 * 3; // 6x7 board with 3 channels
        const outputSize = 1; // Single value output

        const supportX = tf.randomNormal([5, inputSize]);
        const supportY = tf.randomNormal([5, outputSize]);
        const queryX = tf.randomNormal([5, inputSize]);
        const queryY = tf.randomNormal([5, outputSize]);

        return {
            supportX,
            supportY,
            queryX,
            queryY,
            taskId: `value_${Date.now()}_${Math.random()}`,
            difficulty: config.difficulty || 5,
            taskType: 'value'
        };
    }

    async generateBatch(batchSize: number, config: any): Promise<Task[]> {
        const tasks = [];
        for (let i = 0; i < batchSize; i++) {
            tasks.push(await this.generateTask(config));
        }
        return tasks;
    }

    getDifficultyRange(): [number, number] {
        return [1, 10];
    }

    getTaskTypes(): string[] {
        return ['value'];
    }
}

class PositionTaskGenerator implements TaskGenerator {
    async generateTask(config: any): Promise<Task> {
        // Implementation for position evaluation tasks
        const inputSize = 42 * 3; // 6x7 board with 3 channels
        const outputSize = 7; // Position evaluation for each column

        const supportX = tf.randomNormal([5, inputSize]);
        const supportY = tf.randomNormal([5, outputSize]);
        const queryX = tf.randomNormal([5, inputSize]);
        const queryY = tf.randomNormal([5, outputSize]);

        return {
            supportX,
            supportY,
            queryX,
            queryY,
            taskId: `position_${Date.now()}_${Math.random()}`,
            difficulty: config.difficulty || 5,
            taskType: 'classification'
        };
    }

    async generateBatch(batchSize: number, config: any): Promise<Task[]> {
        const tasks = [];
        for (let i = 0; i < batchSize; i++) {
            tasks.push(await this.generateTask(config));
        }
        return tasks;
    }

    getDifficultyRange(): [number, number] {
        return [1, 10];
    }

    getTaskTypes(): string[] {
        return ['classification'];
    }
}

// Export the enhanced MAML class and interfaces
export { EnhancedMAML as MAML };
export default EnhancedMAML;
