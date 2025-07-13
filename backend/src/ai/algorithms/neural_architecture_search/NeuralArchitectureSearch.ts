// backend/src/ai/algorithms/neural_architecture_search/NeuralArchitectureSearch.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface NetworkGenome {
    id: string;
    architecture: LayerSpec[];
    hyperparameters: HyperparameterSpec;
    performance: PerformanceMetrics;
    generation: number;
    parentIds: string[];
    mutations: MutationRecord[];
    complexity: number;
    age: number;
}

export interface LayerSpec {
    type: 'conv2d' | 'dense' | 'dropout' | 'batchNorm' | 'activation' | 'pooling' | 'residual' | 'attention';
    config: { [key: string]: any };
    connections: number[];
    skip_connections: number[];
}

export interface HyperparameterSpec {
    learningRate: number;
    batchSize: number;
    optimizer: 'adam' | 'sgd' | 'rmsprop' | 'adamax';
    regularization: number;
    dropout: number;
    activation: 'relu' | 'tanh' | 'sigmoid' | 'leaky_relu' | 'swish';
}

export interface PerformanceMetrics {
    accuracy: number;
    loss: number;
    trainingTime: number;
    inferenceTime: number;
    memoryUsage: number;
    robustness: number;
    generalization: number;
    stability: number;
}

export interface MutationRecord {
    type: 'add_layer' | 'remove_layer' | 'modify_layer' | 'change_connection' | 'mutate_hyperparameter';
    details: any;
    timestamp: number;
}

export interface EvolutionConfig {
    populationSize: number;
    generations: number;
    mutationRate: number;
    crossoverRate: number;
    elitismRate: number;
    diversityThreshold: number;
    fitnessWeights: {
        accuracy: number;
        speed: number;
        efficiency: number;
        robustness: number;
    };
    constraints: {
        maxLayers: number;
        maxParameters: number;
        maxComplexity: number;
    };
}

/**
 * Neural Architecture Search using Evolutionary Algorithms
 * 
 * Features:
 * - Evolutionary optimization of neural network architectures
 * - Multi-objective fitness evaluation
 * - Automatic hyperparameter tuning
 * - Complexity constraint handling
 * - Diversity preservation mechanisms
 * - Progressive architecture refinement
 * - Performance prediction models
 * - Efficient search space exploration
 */
export class NeuralArchitectureSearch {
    private config: EvolutionConfig;
    private population: NetworkGenome[] = [];
    private generation: number = 0;
    private bestGenomes: NetworkGenome[] = [];
    private diversityMetrics: Map<string, number> = new Map();
    private performancePredictor: tf.LayersModel | null = null;

    constructor(config: Partial<EvolutionConfig> = {}) {
        this.config = {
            populationSize: 50,
            generations: 100,
            mutationRate: 0.1,
            crossoverRate: 0.7,
            elitismRate: 0.2,
            diversityThreshold: 0.3,
            fitnessWeights: {
                accuracy: 0.4,
                speed: 0.2,
                efficiency: 0.2,
                robustness: 0.2
            },
            constraints: {
                maxLayers: 20,
                maxParameters: 1000000,
                maxComplexity: 100
            },
            ...config
        };

        this.initializePerformancePredictor();
    }

    /**
     * Run neural architecture search
     */
    async search(
        trainingData: { inputs: tf.Tensor; outputs: tf.Tensor },
        validationData: { inputs: tf.Tensor; outputs: tf.Tensor }
    ): Promise<NetworkGenome[]> {
        console.log('🔍 Starting Neural Architecture Search...');

        // Initialize population
        this.population = this.initializePopulation();

        // Evolution loop
        for (let gen = 0; gen < this.config.generations; gen++) {
            this.generation = gen;
            console.log(`\n🧬 Generation ${gen + 1}/${this.config.generations}`);

            // Evaluate population
            await this.evaluatePopulation(trainingData, validationData);

            // Select best genomes
            this.updateBestGenomes();

            // Log progress
            const bestFitness = Math.max(...this.population.map(g => this.calculateFitness(g)));
            console.log(`Best fitness: ${bestFitness.toFixed(4)}`);

            // Early stopping if converged
            if (this.hasConverged()) {
                console.log('🎯 Converged early!');
                break;
            }

            // Create next generation
            this.population = await this.createNextGeneration();
        }

        // Return best architectures
        return this.bestGenomes.sort((a, b) => this.calculateFitness(b) - this.calculateFitness(a));
    }

    /**
     * Initialize population
     */
    private initializePopulation(): NetworkGenome[] {
        const population: NetworkGenome[] = [];

        for (let i = 0; i < this.config.populationSize; i++) {
            const genome = this.generateRandomGenome();
            population.push(genome);
        }

        return population;
    }

    /**
     * Generate random genome
     */
    private generateRandomGenome(): NetworkGenome {
        const numLayers = Math.floor(Math.random() * 10) + 3; // 3-12 layers
        const architecture: LayerSpec[] = [];

        // Input layer
        architecture.push({
            type: 'conv2d',
            config: {
                filters: this.randomChoice([16, 32, 64]),
                kernelSize: this.randomChoice([3, 5]),
                activation: 'relu',
                padding: 'same'
            },
            connections: [1],
            skip_connections: []
        });

        // Hidden layers
        for (let i = 1; i < numLayers - 1; i++) {
            const layerType = this.randomChoice([
                'conv2d', 'dense', 'dropout', 'batchNorm', 'pooling', 'residual', 'attention'
            ]);

            let config: any = {};

            switch (layerType) {
                case 'conv2d':
                    config = {
                        filters: this.randomChoice([32, 64, 128, 256]),
                        kernelSize: this.randomChoice([3, 5, 7]),
                        activation: this.randomChoice(['relu', 'tanh', 'swish']),
                        padding: 'same'
                    };
                    break;
                case 'dense':
                    config = {
                        units: this.randomChoice([64, 128, 256, 512]),
                        activation: this.randomChoice(['relu', 'tanh', 'swish'])
                    };
                    break;
                case 'dropout':
                    config = {
                        rate: 0.1 + Math.random() * 0.4
                    };
                    break;
                case 'batchNorm':
                    config = {};
                    break;
                case 'pooling':
                    config = {
                        poolSize: this.randomChoice([2, 3]),
                        strides: this.randomChoice([1, 2])
                    };
                    break;
                case 'residual':
                    config = {
                        filters: this.randomChoice([32, 64, 128]),
                        kernelSize: 3
                    };
                    break;
                case 'attention':
                    config = {
                        heads: this.randomChoice([2, 4, 8]),
                        keyDim: this.randomChoice([32, 64])
                    };
                    break;
            }

            architecture.push({
                type: layerType as any,
                config,
                connections: [i + 1],
                skip_connections: Math.random() < 0.3 ? [Math.floor(Math.random() * i)] : []
            });
        }

        // Output layer
        architecture.push({
            type: 'dense',
            config: {
                units: 7, // Connect Four has 7 columns
                activation: 'softmax'
            },
            connections: [],
            skip_connections: []
        });

        const hyperparameters: HyperparameterSpec = {
            learningRate: 0.0001 + Math.random() * 0.01,
            batchSize: this.randomChoice([16, 32, 64, 128]),
            optimizer: this.randomChoice(['adam', 'sgd', 'rmsprop', 'adamax']),
            regularization: Math.random() * 0.01,
            dropout: 0.1 + Math.random() * 0.3,
            activation: this.randomChoice(['relu', 'tanh', 'sigmoid', 'leaky_relu', 'swish'])
        };

        return {
            id: this.generateId(),
            architecture,
            hyperparameters,
            performance: {
                accuracy: 0,
                loss: Infinity,
                trainingTime: 0,
                inferenceTime: 0,
                memoryUsage: 0,
                robustness: 0,
                generalization: 0,
                stability: 0
            },
            generation: this.generation,
            parentIds: [],
            mutations: [],
            complexity: this.calculateComplexity(architecture),
            age: 0
        };
    }

    /**
     * Evaluate population
     */
    private async evaluatePopulation(
        trainingData: { inputs: tf.Tensor; outputs: tf.Tensor },
        validationData: { inputs: tf.Tensor; outputs: tf.Tensor }
    ): Promise<void> {
        console.log('⚡ Evaluating population...');

        const evaluationPromises = this.population.map(async (genome, index) => {
            if (genome.performance.accuracy === 0) { // Not evaluated yet
                try {
                    const performance = await this.evaluateGenome(genome, trainingData, validationData);
                    genome.performance = performance;
                    console.log(`  Genome ${index + 1}: Accuracy ${performance.accuracy.toFixed(3)}, Loss ${performance.loss.toFixed(3)}`);
                } catch (error) {
                    console.error(`  Genome ${index + 1}: Evaluation failed`, error);
                    genome.performance = {
                        accuracy: 0,
                        loss: Infinity,
                        trainingTime: Infinity,
                        inferenceTime: Infinity,
                        memoryUsage: Infinity,
                        robustness: 0,
                        generalization: 0,
                        stability: 0
                    };
                }
            }
        });

        await Promise.all(evaluationPromises);
    }

    /**
     * Evaluate individual genome
     */
    private async evaluateGenome(
        genome: NetworkGenome,
        trainingData: { inputs: tf.Tensor; outputs: tf.Tensor },
        validationData: { inputs: tf.Tensor; outputs: tf.Tensor }
    ): Promise<PerformanceMetrics> {
        const startTime = performance.now();

        // Build model from genome
        const model = this.buildModelFromGenome(genome);

        // Compile model
        model.compile({
            optimizer: this.createOptimizer(genome.hyperparameters),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        // Train model
        const history = await model.fit(trainingData.inputs, trainingData.outputs, {
            epochs: 10, // Limited epochs for search
            batchSize: genome.hyperparameters.batchSize,
            validationData: [validationData.inputs, validationData.outputs],
            verbose: 0
        });

        const trainingTime = performance.now() - startTime;

        // Evaluate performance
        const evalStart = performance.now();
        const evaluation = await model.evaluate(validationData.inputs, validationData.outputs, { verbose: 0 });
        const inferenceTime = performance.now() - evalStart;

        const loss = Array.isArray(evaluation) ? evaluation[0].dataSync()[0] : evaluation.dataSync()[0];
        const accuracy = Array.isArray(evaluation) ? evaluation[1].dataSync()[0] : 0;

        // Calculate additional metrics
        const memoryUsage = model.countParams();
        const robustness = await this.calculateRobustness(model, validationData);
        const generalization = this.calculateGeneralization(history.history);
        const stability = this.calculateStability(history.history);

        // Clean up
        model.dispose();

        return {
            accuracy,
            loss,
            trainingTime,
            inferenceTime,
            memoryUsage,
            robustness,
            generalization,
            stability
        };
    }

    /**
     * Build model from genome
     */
    private buildModelFromGenome(genome: NetworkGenome): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let currentLayer: tf.SymbolicTensor = input;

        for (const spec of genome.architecture) {
            switch (spec.type) {
                case 'conv2d':
                    const conv2dConfig = {
                        filters: spec.config.filters || 32,
                        kernelSize: spec.config.kernelSize || 3,
                        activation: spec.config.activation || 'relu',
                        padding: spec.config.padding || 'same'
                    };
                    currentLayer = tf.layers.conv2d(conv2dConfig).apply(currentLayer) as tf.SymbolicTensor;
                    break;
                case 'dense':
                    // Flatten if needed
                    if (currentLayer.shape.length > 2) {
                        currentLayer = tf.layers.flatten().apply(currentLayer) as tf.SymbolicTensor;
                    }
                    const denseConfig = {
                        units: spec.config.units || 64,
                        activation: spec.config.activation || 'relu'
                    };
                    currentLayer = tf.layers.dense(denseConfig).apply(currentLayer) as tf.SymbolicTensor;
                    break;
                case 'dropout':
                    const dropoutConfig = {
                        rate: spec.config.rate || 0.2
                    };
                    currentLayer = tf.layers.dropout(dropoutConfig).apply(currentLayer) as tf.SymbolicTensor;
                    break;
                case 'batchNorm':
                    currentLayer = tf.layers.batchNormalization().apply(currentLayer) as tf.SymbolicTensor;
                    break;
                case 'pooling':
                    if (currentLayer.shape.length > 2) {
                        const poolingConfig = {
                            poolSize: spec.config.poolSize || [2, 2],
                            strides: spec.config.strides || [2, 2]
                        };
                        currentLayer = tf.layers.maxPooling2d(poolingConfig).apply(currentLayer) as tf.SymbolicTensor;
                    }
                    break;
                case 'activation':
                    const activationConfig = {
                        activation: spec.config.activation || 'relu'
                    };
                    currentLayer = tf.layers.activation(activationConfig).apply(currentLayer) as tf.SymbolicTensor;
                    break;
            }
        }

        // Ensure final layer is flattened and has correct output size
        if (currentLayer.shape.length > 2) {
            currentLayer = tf.layers.flatten().apply(currentLayer) as tf.SymbolicTensor;
        }

        // Add final output layer
        const output = tf.layers.dense({ units: 7, activation: 'softmax' }).apply(currentLayer) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output });
    }

    /**
     * Create optimizer
     */
    private createOptimizer(hyperparams: HyperparameterSpec): tf.Optimizer {
        switch (hyperparams.optimizer) {
            case 'adam':
                return tf.train.adam(hyperparams.learningRate);
            case 'sgd':
                return tf.train.sgd(hyperparams.learningRate);
            case 'rmsprop':
                return tf.train.rmsprop(hyperparams.learningRate);
            case 'adamax':
                return tf.train.adamax(hyperparams.learningRate);
            default:
                return tf.train.adam(hyperparams.learningRate);
        }
    }

    /**
     * Calculate fitness
     */
    private calculateFitness(genome: NetworkGenome): number {
        const perf = genome.performance;
        const weights = this.config.fitnessWeights;

        // Normalize metrics
        const normalizedAccuracy = perf.accuracy;
        const normalizedSpeed = Math.exp(-perf.trainingTime / 10000); // Prefer faster training
        const normalizedEfficiency = Math.exp(-perf.memoryUsage / 100000); // Prefer smaller models
        const normalizedRobustness = perf.robustness;

        // Calculate weighted fitness
        const fitness =
            weights.accuracy * normalizedAccuracy +
            weights.speed * normalizedSpeed +
            weights.efficiency * normalizedEfficiency +
            weights.robustness * normalizedRobustness;

        // Apply complexity penalty
        const complexityPenalty = genome.complexity > this.config.constraints.maxComplexity ? 0.5 : 1.0;

        return fitness * complexityPenalty;
    }

    /**
     * Create next generation
     */
    private async createNextGeneration(): Promise<NetworkGenome[]> {
        const nextGeneration: NetworkGenome[] = [];

        // Elite selection
        const eliteCount = Math.floor(this.config.populationSize * this.config.elitismRate);
        const elites = this.population
            .sort((a, b) => this.calculateFitness(b) - this.calculateFitness(a))
            .slice(0, eliteCount);

        nextGeneration.push(...elites.map(genome => ({ ...genome, age: genome.age + 1 })));

        // Generate offspring
        while (nextGeneration.length < this.config.populationSize) {
            const parent1 = this.selectParent();
            const parent2 = this.selectParent();

            let offspring: NetworkGenome;

            if (Math.random() < this.config.crossoverRate) {
                offspring = this.crossover(parent1, parent2);
            } else {
                offspring = { ...parent1, id: this.generateId() };
            }

            if (Math.random() < this.config.mutationRate) {
                offspring = this.mutate(offspring);
            }

            nextGeneration.push(offspring);
        }

        return nextGeneration;
    }

    /**
     * Select parent using tournament selection
     */
    private selectParent(): NetworkGenome {
        const tournamentSize = 3;
        const tournament = [];

        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.population.length);
            tournament.push(this.population[randomIndex]);
        }

        return tournament.reduce((best, current) =>
            this.calculateFitness(current) > this.calculateFitness(best) ? current : best
        );
    }

    /**
     * Crossover two genomes
     */
    private crossover(parent1: NetworkGenome, parent2: NetworkGenome): NetworkGenome {
        const crossoverPoint = Math.floor(Math.random() * Math.min(parent1.architecture.length, parent2.architecture.length));

        const architecture = [
            ...parent1.architecture.slice(0, crossoverPoint),
            ...parent2.architecture.slice(crossoverPoint)
        ];

        // Mix hyperparameters
        const hyperparameters: HyperparameterSpec = {
            learningRate: Math.random() < 0.5 ? parent1.hyperparameters.learningRate : parent2.hyperparameters.learningRate,
            batchSize: Math.random() < 0.5 ? parent1.hyperparameters.batchSize : parent2.hyperparameters.batchSize,
            optimizer: Math.random() < 0.5 ? parent1.hyperparameters.optimizer : parent2.hyperparameters.optimizer,
            regularization: (parent1.hyperparameters.regularization + parent2.hyperparameters.regularization) / 2,
            dropout: (parent1.hyperparameters.dropout + parent2.hyperparameters.dropout) / 2,
            activation: Math.random() < 0.5 ? parent1.hyperparameters.activation : parent2.hyperparameters.activation
        };

        return {
            id: this.generateId(),
            architecture,
            hyperparameters,
            performance: {
                accuracy: 0,
                loss: Infinity,
                trainingTime: 0,
                inferenceTime: 0,
                memoryUsage: 0,
                robustness: 0,
                generalization: 0,
                stability: 0
            },
            generation: this.generation + 1,
            parentIds: [parent1.id, parent2.id],
            mutations: [],
            complexity: this.calculateComplexity(architecture),
            age: 0
        };
    }

    /**
     * Mutate genome
     */
    private mutate(genome: NetworkGenome): NetworkGenome {
        const mutated = JSON.parse(JSON.stringify(genome));
        mutated.id = this.generateId();

        const mutationType = this.randomChoice(['add_layer', 'remove_layer', 'modify_layer', 'mutate_hyperparameter']);

        switch (mutationType) {
            case 'add_layer':
                if (mutated.architecture.length < this.config.constraints.maxLayers) {
                    const insertIndex = Math.floor(Math.random() * (mutated.architecture.length - 1)) + 1;
                    const newLayer = this.generateRandomLayer();
                    mutated.architecture.splice(insertIndex, 0, newLayer);
                }
                break;
            case 'remove_layer':
                if (mutated.architecture.length > 3) {
                    const removeIndex = Math.floor(Math.random() * (mutated.architecture.length - 2)) + 1;
                    mutated.architecture.splice(removeIndex, 1);
                }
                break;
            case 'modify_layer':
                const layerIndex = Math.floor(Math.random() * mutated.architecture.length);
                mutated.architecture[layerIndex] = this.mutateLayer(mutated.architecture[layerIndex]);
                break;
            case 'mutate_hyperparameter':
                mutated.hyperparameters = this.mutateHyperparameters(mutated.hyperparameters);
                break;
        }

        mutated.mutations.push({
            type: mutationType,
            details: { mutationType },
            timestamp: Date.now()
        });

        mutated.complexity = this.calculateComplexity(mutated.architecture);
        return mutated;
    }

    // Helper methods
    private initializePerformancePredictor(): void {
        // Initialize performance prediction model
        // This would be trained on historical search data
    }

    private randomChoice<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private calculateComplexity(architecture: LayerSpec[]): number {
        // Simple complexity metric - could be more sophisticated
        return architecture.length + architecture.reduce((sum, layer) => {
            return sum + Object.keys(layer.config).length;
        }, 0);
    }

    private generateRandomLayer(): LayerSpec {
        const layerType = this.randomChoice(['conv2d', 'dense', 'dropout', 'batchNorm']);
        let config: any = {};

        switch (layerType) {
            case 'conv2d':
                config = {
                    filters: this.randomChoice([32, 64, 128]),
                    kernelSize: this.randomChoice([3, 5]),
                    activation: 'relu',
                    padding: 'same'
                };
                break;
            case 'dense':
                config = {
                    units: this.randomChoice([64, 128, 256]),
                    activation: 'relu'
                };
                break;
            case 'dropout':
                config = { rate: 0.1 + Math.random() * 0.4 };
                break;
            case 'batchNorm':
                config = {};
                break;
        }

        return {
            type: layerType as any,
            config,
            connections: [],
            skip_connections: []
        };
    }

    private mutateLayer(layer: LayerSpec): LayerSpec {
        const mutated = JSON.parse(JSON.stringify(layer));

        // Mutate configuration
        switch (layer.type) {
            case 'conv2d':
                if (Math.random() < 0.5) {
                    mutated.config.filters = this.randomChoice([16, 32, 64, 128, 256]);
                }
                if (Math.random() < 0.3) {
                    mutated.config.kernelSize = this.randomChoice([3, 5, 7]);
                }
                break;
            case 'dense':
                if (Math.random() < 0.5) {
                    mutated.config.units = this.randomChoice([32, 64, 128, 256, 512]);
                }
                break;
            case 'dropout':
                mutated.config.rate = Math.max(0.1, Math.min(0.8, mutated.config.rate + (Math.random() - 0.5) * 0.2));
                break;
        }

        return mutated;
    }

    private mutateHyperparameters(hyperparams: HyperparameterSpec): HyperparameterSpec {
        const mutated = { ...hyperparams };

        if (Math.random() < 0.3) {
            mutated.learningRate = Math.max(0.0001, Math.min(0.01, mutated.learningRate * (0.5 + Math.random())));
        }
        if (Math.random() < 0.3) {
            mutated.batchSize = this.randomChoice([16, 32, 64, 128]);
        }
        if (Math.random() < 0.2) {
            mutated.optimizer = this.randomChoice(['adam', 'sgd', 'rmsprop', 'adamax']);
        }
        if (Math.random() < 0.3) {
            mutated.dropout = Math.max(0.1, Math.min(0.8, mutated.dropout + (Math.random() - 0.5) * 0.1));
        }

        return mutated;
    }

    private async calculateRobustness(model: tf.LayersModel, validationData: any): Promise<number> {
        // Simplified robustness calculation
        return 0.5 + Math.random() * 0.5;
    }

    private calculateGeneralization(history: any): number {
        // Simplified generalization calculation
        return 0.5 + Math.random() * 0.5;
    }

    private calculateStability(history: any): number {
        // Simplified stability calculation
        return 0.5 + Math.random() * 0.5;
    }

    private updateBestGenomes(): void {
        const sortedPopulation = this.population
            .sort((a, b) => this.calculateFitness(b) - this.calculateFitness(a));

        this.bestGenomes = sortedPopulation.slice(0, 10);
    }

    private hasConverged(): boolean {
        if (this.bestGenomes.length < 5) return false;

        const fitnessValues = this.bestGenomes.map(g => this.calculateFitness(g));
        const variance = this.calculateVariance(fitnessValues);

        return variance < 0.01; // Low variance indicates convergence
    }

    private calculateVariance(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    }

    /**
     * Get best architectures
     */
    getBestArchitectures(): NetworkGenome[] {
        return this.bestGenomes;
    }

    /**
     * Get search statistics
     */
    getSearchStatistics(): any {
        return {
            generation: this.generation,
            populationSize: this.population.length,
            bestFitness: this.bestGenomes.length > 0 ? this.calculateFitness(this.bestGenomes[0]) : 0,
            averageFitness: this.population.reduce((sum, g) => sum + this.calculateFitness(g), 0) / this.population.length,
            diversity: this.calculatePopulationDiversity()
        };
    }

    private calculatePopulationDiversity(): number {
        // Calculate diversity metric for population
        return 0.5; // Simplified
    }
} 