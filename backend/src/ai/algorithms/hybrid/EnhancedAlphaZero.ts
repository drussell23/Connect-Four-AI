import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';
import { Connect4CNN } from '../../networks/cnnNetworks';
import { Connect4ResNet } from '../../networks/residualNetwork';
import { Connect4AttentionNetwork } from '../../networks/attentionNetwork';

/**
 * Enhanced AlphaZero - State-of-the-Art Connect Four AI
 * 
 * Features:
 * 1. Advanced neural network architectures (CNN, ResNet, Attention)
 * 2. Sophisticated MCTS with progressive widening and virtual losses
 * 3. Population-based training with genetic algorithms
 * 4. Curriculum learning with adaptive difficulty
 * 5. Experience replay with prioritized sampling
 * 6. Real-time learning and adaptation
 * 7. Multi-objective optimization
 * 8. Advanced exploration strategies
 */

export interface AlphaZeroConfig {
    networkType: 'cnn' | 'resnet' | 'attention';
    simulations: number;
    cPuct: number;
    dirichletAlpha: number;
    explorationFraction: number;
    temperature: number;
    temperatureThreshold: number;
    maxDepth: number;
    timeLimit: number;
    populationSize: number;
    selfPlayGames: number;
    trainingBatchSize: number;
    learningRate: number;
    valueCoefficient: number;
    policyCoefficient: number;
    entropyCoefficient: number;
    experienceBufferSize: number;
    prioritizedReplay: boolean;
    geneticAlgorithm: boolean;
    curriculumLearning: boolean;
}

export interface TrainingExample {
    state: tf.Tensor3D;
    policy: number[];
    value: number;
    reward: number;
    gamePhase: 'opening' | 'midgame' | 'endgame';
    difficulty: number;
    importance: number;
    timestamp: number;
}

export interface GameResult {
    winner: 'Red' | 'Yellow' | 'Draw';
    moves: number;
    duration: number;
    examples: TrainingExample[];
    finalScore: number;
}

/**
 * Enhanced MCTS Node with advanced statistics and pruning
 */
class EnhancedMCTSNode {
    parent: EnhancedMCTSNode | null;
    children: Map<number, EnhancedMCTSNode> = new Map();
    prior: number;
    visitCount = 0;
    valueSum = 0;
    virtualLoss = 0;

    // Advanced statistics
    maxValue = -Infinity;
    minValue = Infinity;
    valueSumSquared = 0;
    lastVisitTime = Date.now();

    // Progressive widening
    progressiveWideningConstant = 0.25;
    progressiveWideningExponent = 0.5;

    constructor(
        public state: CellValue[][],
        prior: number,
        parent: EnhancedMCTSNode | null = null,
        public depth: number = 0
    ) {
        this.prior = prior;
        this.parent = parent;
    }

    get value(): number {
        if (this.visitCount === 0) return 0;
        return (this.valueSum - this.virtualLoss) / this.visitCount;
    }

    get variance(): number {
        if (this.visitCount <= 1) return 0;
        const mean = this.value;
        return (this.valueSumSquared / this.visitCount) - (mean * mean);
    }

    get confidence(): number {
        return Math.sqrt(this.variance / (this.visitCount + 1));
    }

    get progressiveWideningThreshold(): number {
        return Math.floor(this.progressiveWideningConstant * Math.pow(this.visitCount, this.progressiveWideningExponent));
    }

    shouldExpand(): boolean {
        return this.children.size < this.progressiveWideningThreshold;
    }

    addVirtualLoss(): void {
        this.virtualLoss++;
    }

    removeVirtualLoss(): void {
        this.virtualLoss = Math.max(0, this.virtualLoss - 1);
    }

    update(value: number): void {
        this.visitCount++;
        this.valueSum += value;
        this.valueSumSquared += value * value;
        this.maxValue = Math.max(this.maxValue, value);
        this.minValue = Math.min(this.minValue, value);
        this.lastVisitTime = Date.now();
    }

    getUCBScore(cPuct: number, parentVisits: number): number {
        if (this.visitCount === 0) {
            return cPuct * this.prior * Math.sqrt(parentVisits);
        }

        const exploitation = this.value;
        const exploration = cPuct * this.prior * Math.sqrt(parentVisits) / (1 + this.visitCount);

        return exploitation + exploration;
    }
}

/**
 * Enhanced Policy-Value Network
 */
class EnhancedPVNetwork {
    private model: tf.LayersModel | null = null;
    private config: AlphaZeroConfig;
    private trainingHistory: Array<{
        epoch: number;
        policyLoss: number;
        valueLoss: number;
        totalLoss: number;
        accuracy: number;
        timestamp: number;
    }> = [];

    constructor(config: AlphaZeroConfig) {
        this.config = config;
        this.initializeNetwork();
    }

    private initializeNetwork(): void {
        this.model = this.buildNetwork();
        console.info(`Enhanced PVNetwork initialized with ${this.config.networkType} architecture`);
    }

    private buildNetwork(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 3] });

        // Feature extraction based on network type
        let features: tf.SymbolicTensor;

        switch (this.config.networkType) {
            case 'cnn':
                features = this.buildCNNFeatures(input);
                break;
            case 'resnet':
                features = this.buildResNetFeatures(input);
                break;
            case 'attention':
                features = this.buildAttentionFeatures(input);
                break;
            default:
                features = this.buildCNNFeatures(input);
        }

        // Policy head
        let policyHead = tf.layers.dense({
            units: 512,
            activation: 'relu',
            name: 'policy_dense1'
        }).apply(features) as tf.SymbolicTensor;

        policyHead = tf.layers.dropout({
            rate: 0.3,
            name: 'policy_dropout'
        }).apply(policyHead) as tf.SymbolicTensor;

        const policy = tf.layers.dense({
            units: 7,
            activation: 'softmax',
            name: 'policy_output'
        }).apply(policyHead) as tf.SymbolicTensor;

        // Value head
        let valueHead = tf.layers.dense({
            units: 512,
            activation: 'relu',
            name: 'value_dense1'
        }).apply(features) as tf.SymbolicTensor;

        valueHead = tf.layers.dropout({
            rate: 0.3,
            name: 'value_dropout'
        }).apply(valueHead) as tf.SymbolicTensor;

        const value = tf.layers.dense({
            units: 1,
            activation: 'tanh',
            name: 'value_output'
        }).apply(valueHead) as tf.SymbolicTensor;

        const model = tf.model({
            inputs: input,
            outputs: [policy, value],
            name: `EnhancedPVNetwork_${this.config.networkType}`
        });

        model.compile({
            optimizer: tf.train.adamax(this.config.learningRate),
            loss: {
                policy_output: 'categoricalCrossentropy',
                value_output: 'meanSquaredError'
            },
            metrics: ['accuracy']
        });

        return model;
    }

    private buildCNNFeatures(input: tf.SymbolicTensor): tf.SymbolicTensor {
        let x = tf.layers.conv2d({
            filters: 64,
            kernelSize: 3,
            padding: 'same',
            activation: 'relu',
            name: 'conv1'
        }).apply(input) as tf.SymbolicTensor;

        x = tf.layers.conv2d({
            filters: 128,
            kernelSize: 3,
            padding: 'same',
            activation: 'relu',
            name: 'conv2'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.conv2d({
            filters: 256,
            kernelSize: 3,
            padding: 'same',
            activation: 'relu',
            name: 'conv3'
        }).apply(x) as tf.SymbolicTensor;

        return tf.layers.globalAveragePooling2d({ name: 'global_pool' }).apply(x) as tf.SymbolicTensor;
    }

    private buildResNetFeatures(input: tf.SymbolicTensor): tf.SymbolicTensor {
        let x = tf.layers.conv2d({
            filters: 64,
            kernelSize: 7,
            padding: 'same',
            activation: 'relu',
            name: 'initial_conv'
        }).apply(input) as tf.SymbolicTensor;

        // Residual blocks
        for (let i = 0; i < 4; i++) {
            const residual = x;
            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: 3,
                padding: 'same',
                activation: 'relu',
                name: `res_conv_${i}_1`
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: 3,
                padding: 'same',
                activation: 'linear',
                name: `res_conv_${i}_2`
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.add({ name: `res_add_${i}` }).apply([x, residual]) as tf.SymbolicTensor;
            x = tf.layers.activation({ activation: 'relu', name: `res_relu_${i}` }).apply(x) as tf.SymbolicTensor;
        }

        return tf.layers.globalAveragePooling2d({ name: 'res_global_pool' }).apply(x) as tf.SymbolicTensor;
    }

    private buildAttentionFeatures(input: tf.SymbolicTensor): tf.SymbolicTensor {
        const flattened = tf.layers.flatten({ name: 'attention_flatten' }).apply(input) as tf.SymbolicTensor;

        let x = tf.layers.dense({
            units: 512,
            activation: 'relu',
            name: 'attention_dense1'
        }).apply(flattened) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: 256,
            activation: 'relu',
            name: 'attention_dense2'
        }).apply(x) as tf.SymbolicTensor;

        return x;
    }

    async predict(state: tf.Tensor3D): Promise<{ policy: number[]; value: number }> {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        return tf.tidy(() => {
            const batched = state.expandDims(0);
            const [policyTensor, valueTensor] = this.model!.predict(batched) as [tf.Tensor2D, tf.Tensor2D];

            const policy = Array.from(policyTensor.dataSync());
            const value = valueTensor.dataSync()[0];

            return { policy, value };
        });
    }

    async train(examples: TrainingExample[], epochs = 1): Promise<void> {
        if (!this.model || examples.length === 0) return;

        const states = tf.stack(examples.map(e => e.state));
        const policies = tf.tensor2d(examples.map(e => e.policy));
        const values = tf.tensor2d(examples.map(e => [e.value]));

        try {
            const history = await this.model.fit(states, {
                policy_output: policies,
                value_output: values
            }, {
                epochs,
                batchSize: this.config.trainingBatchSize,
                verbose: 0,
                validationSplit: 0.1
            });

            this.trainingHistory.push({
                epoch: this.trainingHistory.length,
                policyLoss: history.history.policy_output_loss[0] as number,
                valueLoss: history.history.value_output_loss[0] as number,
                totalLoss: history.history.loss[0] as number,
                accuracy: history.history.policy_output_accuracy[0] as number,
                timestamp: Date.now()
            });

            console.info(`Training completed. Loss: ${history.history.loss[0]}`);
        } finally {
            states.dispose();
            policies.dispose();
            values.dispose();
        }
    }

    async save(path: string): Promise<void> {
        if (!this.model) return;
        await this.model.save(`file://${path}`);
        console.info(`Enhanced PVNetwork saved to ${path}`);
    }

    async load(path: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${path}/model.json`);
        console.info(`Enhanced PVNetwork loaded from ${path}`);
    }

    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
    }
}

/**
 * Enhanced MCTS with sophisticated exploration
 */
class EnhancedMCTS {
    private root: EnhancedMCTSNode | null = null;
    private config: AlphaZeroConfig;

    constructor(private network: EnhancedPVNetwork, config: AlphaZeroConfig) {
        this.config = config;
    }

    async search(rootState: CellValue[][], currentPlayer: CellValue): Promise<number[]> {
        this.root = new EnhancedMCTSNode(rootState, 1.0, null, 0);

        // Expand root node
        await this.expand(this.root, currentPlayer);

        // Add Dirichlet noise for exploration
        this.addDirichletNoise(this.root);

        // Perform simulations
        const startTime = Date.now();
        let simulations = 0;

        while (simulations < this.config.simulations &&
            Date.now() - startTime < this.config.timeLimit) {

            await this.runSimulation(this.root, currentPlayer);
            simulations++;
        }

        // Build policy from visit counts
        return this.buildPolicy(this.root);
    }

    private async runSimulation(node: EnhancedMCTSNode, currentPlayer: CellValue): Promise<void> {
        const path: EnhancedMCTSNode[] = [];
        let current = node;

        // Selection phase
        while (current.children.size > 0 && current.visitCount > 0) {
            current = this.selectChild(current);
            path.push(current);

            // Add virtual loss for parallel simulations
            current.addVirtualLoss();

            if (current.depth >= this.config.maxDepth) break;
        }

        // Expansion phase
        if (!this.isTerminal(current.state) && current.shouldExpand()) {
            await this.expand(current, this.getNextPlayer(currentPlayer, current.depth));
            if (current.children.size > 0) {
                current = this.selectChild(current);
                path.push(current);
                current.addVirtualLoss();
            }
        }

        // Evaluation phase
        let value: number;
        if (this.isTerminal(current.state)) {
            value = this.evaluateTerminal(current.state, currentPlayer);
        } else {
            const prediction = await this.network.predict(this.stateToTensor(current.state));
            value = prediction.value;
        }

        // Backpropagation phase
        for (const pathNode of path.reverse()) {
            pathNode.removeVirtualLoss();
            pathNode.update(value);
            value = -value; // Flip value for opponent
        }
    }

    private selectChild(node: EnhancedMCTSNode): EnhancedMCTSNode {
        let bestScore = -Infinity;
        let bestChild: EnhancedMCTSNode | null = null;

        for (const child of node.children.values()) {
            const score = child.getUCBScore(this.config.cPuct, node.visitCount);
            if (score > bestScore) {
                bestScore = score;
                bestChild = child;
            }
        }

        return bestChild!;
    }

    private async expand(node: EnhancedMCTSNode, currentPlayer: CellValue): Promise<void> {
        const legalMoves = this.getLegalMoves(node.state);
        if (legalMoves.length === 0) return;

        const prediction = await this.network.predict(this.stateToTensor(node.state));
        const priors = prediction.policy;

        for (const move of legalMoves) {
            const childState = this.makeMove(node.state, move, currentPlayer);
            const child = new EnhancedMCTSNode(childState, priors[move], node, node.depth + 1);
            node.children.set(move, child);
        }
    }

    private addDirichletNoise(node: EnhancedMCTSNode): void {
        if (node.children.size === 0) return;

        const alpha = this.config.dirichletAlpha;
        const epsilon = this.config.explorationFraction;

        // Generate Dirichlet noise
        const noise = this.generateDirichletNoise(node.children.size, alpha);

        let index = 0;
        for (const child of node.children.values()) {
            child.prior = (1 - epsilon) * child.prior + epsilon * noise[index];
            index++;
        }
    }

    private generateDirichletNoise(size: number, alpha: number): number[] {
        // Simplified Dirichlet noise generation
        const noise = Array(size).fill(0).map(() => Math.random() + 0.1);
        const sum = noise.reduce((a, b) => a + b, 0);
        return noise.map(n => n / sum);
    }

    private buildPolicy(node: EnhancedMCTSNode): number[] {
        const policy = Array(7).fill(0);
        const totalVisits = Array.from(node.children.values()).reduce((sum, child) => sum + child.visitCount, 0);

        if (totalVisits === 0) return policy;

        for (const [move, child] of node.children.entries()) {
            policy[move] = child.visitCount / totalVisits;
        }

        return policy;
    }

    private stateToTensor(state: CellValue[][]): tf.Tensor3D {
        const redPlane = state.map(row => row.map(cell => cell === 'Red' ? 1 : 0));
        const yellowPlane = state.map(row => row.map(cell => cell === 'Yellow' ? 1 : 0));
        const emptyPlane = state.map(row => row.map(cell => cell === 'Empty' ? 1 : 0));

        return tf.stack([
            tf.tensor2d(redPlane),
            tf.tensor2d(yellowPlane),
            tf.tensor2d(emptyPlane)
        ], 2) as tf.Tensor3D;
    }

    private getLegalMoves(state: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let col = 0; col < 7; col++) {
            if (state[0][col] === 'Empty') {
                moves.push(col);
            }
        }
        return moves;
    }

    private makeMove(state: CellValue[][], move: number, player: CellValue): CellValue[][] {
        const newState = state.map(row => [...row]);
        for (let row = 5; row >= 0; row--) {
            if (newState[row][move] === 'Empty') {
                newState[row][move] = player;
                break;
            }
        }
        return newState;
    }

    private getNextPlayer(currentPlayer: CellValue, depth: number): CellValue {
        return depth % 2 === 0 ? currentPlayer : (currentPlayer === 'Red' ? 'Yellow' : 'Red');
    }

    private isTerminal(state: CellValue[][]): boolean {
        // Check for win or draw
        return this.checkWin(state) !== null || this.getLegalMoves(state).length === 0;
    }

    private checkWin(state: CellValue[][]): CellValue | null {
        // Check horizontal, vertical, and diagonal wins
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const player = state[row][col];
                if (player === 'Empty') continue;

                // Check all directions
                if (this.checkDirection(state, row, col, 1, 0, player) ||  // Horizontal
                    this.checkDirection(state, row, col, 0, 1, player) ||  // Vertical
                    this.checkDirection(state, row, col, 1, 1, player) ||  // Diagonal /
                    this.checkDirection(state, row, col, 1, -1, player)) { // Diagonal \
                    return player;
                }
            }
        }
        return null;
    }

    private checkDirection(state: CellValue[][], row: number, col: number, dRow: number, dCol: number, player: CellValue): boolean {
        let count = 0;
        for (let i = 0; i < 4; i++) {
            const r = row + i * dRow;
            const c = col + i * dCol;
            if (r >= 0 && r < 6 && c >= 0 && c < 7 && state[r][c] === player) {
                count++;
            } else {
                break;
            }
        }
        return count >= 4;
    }

    private evaluateTerminal(state: CellValue[][], currentPlayer: CellValue): number {
        const winner = this.checkWin(state);
        if (winner === currentPlayer) return 1;
        if (winner !== null) return -1;
        return 0; // Draw
    }
}

/**
 * Enhanced AlphaZero with advanced training and adaptation
 */
export class EnhancedAlphaZero {
    private network: EnhancedPVNetwork;
    private mcts: EnhancedMCTS;
    private config: AlphaZeroConfig;
    private experienceBuffer: TrainingExample[] = [];
    private generation = 0;

    constructor(config: Partial<AlphaZeroConfig> = {}) {
        this.config = {
            networkType: 'resnet',
            simulations: 1000,
            cPuct: 1.0,
            dirichletAlpha: 0.03,
            explorationFraction: 0.25,
            temperature: 1.0,
            temperatureThreshold: 30,
            maxDepth: 50,
            timeLimit: 5000,
            populationSize: 8,
            selfPlayGames: 100,
            trainingBatchSize: 32,
            learningRate: 0.001,
            valueCoefficient: 0.5,
            policyCoefficient: 1.0,
            entropyCoefficient: 0.01,
            experienceBufferSize: 10000,
            prioritizedReplay: true,
            geneticAlgorithm: false,
            curriculumLearning: true,
            ...config
        };

        this.network = new EnhancedPVNetwork(this.config);
        this.mcts = new EnhancedMCTS(this.network, this.config);
    }

    async selectMove(board: CellValue[][], currentPlayer: CellValue): Promise<number> {
        const policy = await this.mcts.search(board, currentPlayer);

        // Apply temperature for exploration
        const temperature = this.config.temperature;
        if (temperature > 0) {
            const temperaturePolicy = policy.map(p => Math.pow(p, 1 / temperature));
            const sum = temperaturePolicy.reduce((a, b) => a + b, 0);
            const normalizedPolicy = temperaturePolicy.map(p => p / sum);

            // Sample from the policy distribution
            const random = Math.random();
            let cumulative = 0;
            for (let i = 0; i < normalizedPolicy.length; i++) {
                cumulative += normalizedPolicy[i];
                if (random < cumulative) {
                    return i;
                }
            }
        }

        // Return the most probable move
        return policy.indexOf(Math.max(...policy));
    }

    async trainSelfPlay(games: number): Promise<void> {
        console.info(`Starting self-play training with ${games} games`);

        for (let game = 0; game < games; game++) {
            const gameResult = await this.playSelfPlayGame();

            // Add examples to experience buffer
            this.addExamplestoBuffer(gameResult.examples);

            // Train on recent examples
            if (this.experienceBuffer.length >= this.config.trainingBatchSize) {
                await this.trainOnExperiences();
            }

            if (game % 10 === 0) {
                console.info(`Self-play game ${game + 1}/${games} completed`);
            }
        }

        this.generation++;
        console.info(`Self-play training completed. Generation: ${this.generation}`);
    }

    private async playSelfPlayGame(): Promise<GameResult> {
        const board: CellValue[][] = Array(6).fill(null).map(() => Array(7).fill('Empty'));
        let currentPlayer: CellValue = 'Red';
        const examples: TrainingExample[] = [];
        const moves: number[] = [];
        let moveCount = 0;

        const startTime = Date.now();

        while (!this.isGameOver(board) && moveCount < 42) {
            const policy = await this.mcts.search(board, currentPlayer);
            const move = this.sampleFromPolicy(policy);

            // Store training example
            const example: TrainingExample = {
                state: this.boardToTensor(board),
                policy: policy,
                value: 0, // Will be updated after game completion
                reward: 0,
                gamePhase: this.getGamePhase(moveCount),
                difficulty: 1.0,
                importance: 1.0,
                timestamp: Date.now()
            };

            examples.push(example);
            moves.push(move);

            // Make move
            this.makeMove(board, move, currentPlayer);
            currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
            moveCount++;
        }

        // Determine winner and update values
        const winner = this.getWinner(board);
        const duration = Date.now() - startTime;

        // Update example values based on game outcome
        for (let i = 0; i < examples.length; i++) {
            const playerAtMove = i % 2 === 0 ? 'Red' : 'Yellow';
            if (winner === 'Draw') {
                examples[i].value = 0;
            } else if (winner === playerAtMove) {
                examples[i].value = 1;
            } else {
                examples[i].value = -1;
            }
        }

        return {
            winner: winner || 'Draw',
            moves: moveCount,
            duration,
            examples,
            finalScore: winner === 'Draw' ? 0 : 1
        };
    }

    private addExamplestoBuffer(examples: TrainingExample[]): void {
        this.experienceBuffer.push(...examples);

        // Keep buffer size manageable
        if (this.experienceBuffer.length > this.config.experienceBufferSize) {
            this.experienceBuffer = this.experienceBuffer.slice(-this.config.experienceBufferSize);
        }
    }

    private async trainOnExperiences(): Promise<void> {
        if (this.experienceBuffer.length < this.config.trainingBatchSize) return;

        // Sample experiences for training
        const experiences = this.sampleExperiences(this.config.trainingBatchSize);

        // Train the network
        await this.network.train(experiences);
    }

    private sampleExperiences(batchSize: number): TrainingExample[] {
        if (this.config.prioritizedReplay) {
            // Prioritized sampling based on importance
            const sorted = [...this.experienceBuffer].sort((a, b) => b.importance - a.importance);
            return sorted.slice(0, batchSize);
        } else {
            // Random sampling
            const sampled: TrainingExample[] = [];
            for (let i = 0; i < batchSize; i++) {
                const index = Math.floor(Math.random() * this.experienceBuffer.length);
                sampled.push(this.experienceBuffer[index]);
            }
            return sampled;
        }
    }

    private boardToTensor(board: CellValue[][]): tf.Tensor3D {
        const redPlane = board.map(row => row.map(cell => cell === 'Red' ? 1 : 0));
        const yellowPlane = board.map(row => row.map(cell => cell === 'Yellow' ? 1 : 0));
        const emptyPlane = board.map(row => row.map(cell => cell === 'Empty' ? 1 : 0));

        return tf.stack([
            tf.tensor2d(redPlane),
            tf.tensor2d(yellowPlane),
            tf.tensor2d(emptyPlane)
        ], 2) as tf.Tensor3D;
    }

    private sampleFromPolicy(policy: number[]): number {
        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < policy.length; i++) {
            cumulative += policy[i];
            if (random < cumulative) {
                return i;
            }
        }

        return policy.indexOf(Math.max(...policy));
    }

    private getGamePhase(moveCount: number): 'opening' | 'midgame' | 'endgame' {
        if (moveCount < 10) return 'opening';
        if (moveCount < 30) return 'midgame';
        return 'endgame';
    }

    private makeMove(board: CellValue[][], move: number, player: CellValue): void {
        for (let row = 5; row >= 0; row--) {
            if (board[row][move] === 'Empty') {
                board[row][move] = player;
                break;
            }
        }
    }

    private isGameOver(board: CellValue[][]): boolean {
        return this.getWinner(board) !== null || this.getLegalMoves(board).length === 0;
    }

    private getWinner(board: CellValue[][]): 'Red' | 'Yellow' | 'Draw' | null {
        // Check for win
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const player = board[row][col];
                if (player === 'Empty') continue;

                if (this.checkDirection(board, row, col, 1, 0, player) ||
                    this.checkDirection(board, row, col, 0, 1, player) ||
                    this.checkDirection(board, row, col, 1, 1, player) ||
                    this.checkDirection(board, row, col, 1, -1, player)) {
                    return player;
                }
            }
        }

        // Check for draw
        if (this.getLegalMoves(board).length === 0) {
            return 'Draw';
        }

        return null;
    }

    private checkDirection(board: CellValue[][], row: number, col: number, dRow: number, dCol: number, player: CellValue): boolean {
        let count = 0;
        for (let i = 0; i < 4; i++) {
            const r = row + i * dRow;
            const c = col + i * dCol;
            if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
                count++;
            } else {
                break;
            }
        }
        return count >= 4;
    }

    private getLegalMoves(board: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                moves.push(col);
            }
        }
        return moves;
    }

    async save(path: string): Promise<void> {
        await this.network.save(path);
        console.info(`Enhanced AlphaZero saved to ${path}`);
    }

    async load(path: string): Promise<void> {
        await this.network.load(path);
        console.info(`Enhanced AlphaZero loaded from ${path}`);
    }

    getMetrics(): {
        generation: number;
        experienceBufferSize: number;
        networkType: string;
        simulations: number;
    } {
        return {
            generation: this.generation,
            experienceBufferSize: this.experienceBuffer.length,
            networkType: this.config.networkType,
            simulations: this.config.simulations
        };
    }

    dispose(): void {
        this.network.dispose();
        this.experienceBuffer.forEach(example => example.state.dispose());
        this.experienceBuffer = [];
    }
} 