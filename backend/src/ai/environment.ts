import * as tf from '@tensorflow/tfjs';
import { performance } from 'perf_hooks';

/**
 * Comprehensive Connect Four Environment for AI Training and Gameplay
 * 
 * Features:
 *  - Complete Connect Four game logic with win detection
 *  - Multiple state representations (board, tensor, bitboard)
 *  - Configurable board sizes and win conditions
 *  - Advanced reward shaping and game analysis
 *  - Integration with AI agents and training systems
 *  - Performance optimization and memory management
 *  - Comprehensive logging and metrics tracking
 *  - Support for different game variants and rules
 */

// === Core Types and Interfaces ===

export type CellValue = 'Empty' | 'Red' | 'Yellow';
export type GamePhase = 'opening' | 'midgame' | 'endgame';
export type PlayerType = 'human' | 'ai' | 'random';

export interface GameState {
    board: CellValue[][];
    currentPlayer: CellValue;
    gamePhase: GamePhase;
    moveHistory: Move[];
    gameOver: boolean;
    winner: CellValue | null;
    isDraw: boolean;
    moveCount: number;
    gameId: string;
    timestamp: number;
}

export interface Move {
    column: number;
    row: number;
    player: CellValue;
    timestamp: number;
    moveNumber: number;
    evaluation?: number;
    confidence?: number;
}

export interface EnvironmentConfig {
    // Board configuration
    rows?: number;
    cols?: number;
    winCondition?: number;

    // Game rules
    allowUndo?: boolean;
    timeLimit?: number;
    maxMoves?: number;

    // Reward shaping
    rewardConfig?: {
        win: number;
        loss: number;
        draw: number;
        invalidMove: number;
        centerBonus: number;
        connectionBonus: number;
        blockingBonus: number;
        timeBonus: number;
    };

    // AI integration
    observationFormat?: 'board' | 'tensor' | 'bitboard' | 'hybrid';
    includeHistory?: boolean;
    historyLength?: number;

    // Performance
    enableCaching?: boolean;
    enableMetrics?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';

    // Variants
    gravityEnabled?: boolean;
    customWinConditions?: number[][];
    powerUps?: boolean;
}

export interface EnvironmentMetrics {
    gamesPlayed: number;
    averageGameLength: number;
    winRates: { [player: string]: number };
    averageMoveTime: number;
    invalidMoveCount: number;
    drawRate: number;
    gamePhaseDistribution: { [phase: string]: number };
    positionComplexity: number;
    branchingFactor: number;
    performanceMetrics: {
        averageStepTime: number;
        averageResetTime: number;
        memoryUsage: number;
        cacheHitRate: number;
    };
}

export interface EnvironmentObservation {
    board: tf.Tensor;
    legalMoves: number[];
    gameState: Partial<GameState>;
    features: {
        moveCount: number;
        gamePhase: number; // encoded as number
        currentPlayer: number; // encoded as number
        threatLevel: number;
        connectivity: number;
        centerControl: number;
    };
    history?: tf.Tensor;
}

export interface StepResult {
    observation: EnvironmentObservation;
    reward: number;
    done: boolean;
    info: {
        winner?: CellValue;
        moveValid: boolean;
        gamePhase: GamePhase;
        evaluation: number;
        threats: number[];
        opportunities: number[];
        moveQuality: number;
    };
}

/**
 * Main Connect Four Environment Class
 */
export class Connect4Environment {
    private config: Required<EnvironmentConfig>;
    private gameState: GameState;
    private metrics: EnvironmentMetrics;

    // Caching and optimization
    private stateCache: Map<string, any> = new Map();
    private evaluationCache: Map<string, number> = new Map();
    private legalMovesCache: Map<string, number[]> = new Map();

    // Bitboard representations for fast operations
    private redBitboard: bigint = 0n;
    private yellowBitboard: bigint = 0n;
    private filledBitboard: bigint = 0n;

    // Precomputed win patterns
    private winPatterns: bigint[] = [];
    private threatPatterns: bigint[] = [];

    constructor(config: EnvironmentConfig = {}) {
        this.config = {
            rows: 6,
            cols: 7,
            winCondition: 4,
            allowUndo: false,
            timeLimit: 0,
            maxMoves: 42,
            rewardConfig: {
                win: 1.0,
                loss: -1.0,
                draw: 0.0,
                invalidMove: -0.1,
                centerBonus: 0.1,
                connectionBonus: 0.05,
                blockingBonus: 0.02,
                timeBonus: 0.01
            },
            observationFormat: 'tensor',
            includeHistory: true,
            historyLength: 8,
            enableCaching: true,
            enableMetrics: true,
            logLevel: 'info',
            gravityEnabled: true,
            customWinConditions: [],
            powerUps: false,
            ...config
        };

        this.initializeMetrics();
        this.initializeWinPatterns();
        this.reset();

        this.log('info', 'Connect4Environment initialized', {
            rows: this.config.rows,
            cols: this.config.cols,
            winCondition: this.config.winCondition,
            observationFormat: this.config.observationFormat
        });
    }

    /**
     * Reset the environment to initial state
     */
    reset(): EnvironmentObservation {
        this.gameState = {
            board: this.createEmptyBoard(),
            currentPlayer: 'Red',
            gamePhase: 'opening',
            moveHistory: [],
            gameOver: false,
            winner: null,
            isDraw: false,
            moveCount: 0,
            gameId: this.generateGameId(),
            timestamp: Date.now()
        };

        // Reset bitboards
        this.redBitboard = 0n;
        this.yellowBitboard = 0n;
        this.filledBitboard = 0n;

        // Clear caches
        if (this.config.enableCaching) {
            this.clearCaches();
        }

        this.log('debug', 'Environment reset', { gameId: this.gameState.gameId });

        return this.getObservation();
    }

    /**
     * Execute a move in the environment
     */
    step(action: number): StepResult {
        const startTime = performance.now();

        // Validate action
        if (!this.isValidMove(action)) {
            return this.handleInvalidMove(action);
        }

        // Execute move
        const moveResult = this.executeMove(action);

        // Update game state
        this.updateGameState(moveResult);

        // Calculate reward
        const reward = this.calculateReward(moveResult);

        // Create step result
        const result: StepResult = {
            observation: this.getObservation(),
            reward,
            done: this.gameState.gameOver,
            info: {
                winner: this.gameState.winner,
                moveValid: true,
                gamePhase: this.gameState.gamePhase,
                evaluation: this.evaluatePosition(),
                threats: this.detectThreats(),
                opportunities: this.detectOpportunities(),
                moveQuality: this.evaluateMoveQuality(action)
            }
        };

        // Update metrics
        if (this.config.enableMetrics) {
            this.updateMetrics(performance.now() - startTime);
        }

        this.log('debug', 'Step executed', {
            action,
            reward,
            done: result.done,
            moveCount: this.gameState.moveCount
        });

        return result;
    }

    /**
     * Get current observation
     */
    getObservation(): EnvironmentObservation {
        const observation: EnvironmentObservation = {
            board: this.getBoardTensor(),
            legalMoves: this.getLegalMoves(),
            gameState: {
                currentPlayer: this.gameState.currentPlayer,
                gamePhase: this.gameState.gamePhase,
                moveCount: this.gameState.moveCount,
                gameOver: this.gameState.gameOver
            },
            features: this.extractFeatures()
        };

        if (this.config.includeHistory) {
            observation.history = this.getHistoryTensor();
        }

        return observation;
    }

    /**
     * Get legal moves for current state
     */
    getLegalMoves(): number[] {
        const stateKey = this.getStateKey();

        if (this.config.enableCaching && this.legalMovesCache.has(stateKey)) {
            return this.legalMovesCache.get(stateKey)!;
        }

        const legalMoves: number[] = [];

        for (let col = 0; col < this.config.cols; col++) {
            if (this.gameState.board[0][col] === 'Empty') {
                legalMoves.push(col);
            }
        }

        if (this.config.enableCaching) {
            this.legalMovesCache.set(stateKey, legalMoves);
        }

        return legalMoves;
    }

    /**
     * Check if a move is valid
     */
    isValidMove(column: number): boolean {
        if (column < 0 || column >= this.config.cols) {
            return false;
        }

        if (this.gameState.gameOver) {
            return false;
        }

        return this.gameState.board[0][column] === 'Empty';
    }

    /**
     * Execute a move and return move details
     */
    private executeMove(column: number): Move {
        // Find the row where the piece will land
        let row = -1;
        for (let r = this.config.rows - 1; r >= 0; r--) {
            if (this.gameState.board[r][column] === 'Empty') {
                row = r;
                break;
            }
        }

        // Place the piece
        this.gameState.board[row][column] = this.gameState.currentPlayer;

        // Update bitboards
        this.updateBitboards(row, column, this.gameState.currentPlayer);

        // Create move object
        const move: Move = {
            column,
            row,
            player: this.gameState.currentPlayer,
            timestamp: Date.now(),
            moveNumber: this.gameState.moveCount + 1
        };

        return move;
    }

    /**
     * Update game state after a move
     */
    private updateGameState(move: Move): void {
        // Add move to history
        this.gameState.moveHistory.push(move);
        this.gameState.moveCount++;

        // Check for win
        if (this.checkWin(move.row, move.column, move.player)) {
            this.gameState.gameOver = true;
            this.gameState.winner = move.player;
        }
        // Check for draw
        else if (this.gameState.moveCount >= this.config.maxMoves || this.isBoardFull()) {
            this.gameState.gameOver = true;
            this.gameState.isDraw = true;
        }
        // Continue game
        else {
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'Red' ? 'Yellow' : 'Red';
            this.gameState.gamePhase = this.determineGamePhase();
        }
    }

    /**
     * Calculate reward for a move
     */
    private calculateReward(move: Move): number {
        let reward = 0;

        // Win/Loss/Draw rewards
        if (this.gameState.winner === move.player) {
            reward += this.config.rewardConfig.win;
        } else if (this.gameState.winner && this.gameState.winner !== move.player) {
            reward += this.config.rewardConfig.loss;
        } else if (this.gameState.isDraw) {
            reward += this.config.rewardConfig.draw;
        }

        // Positional rewards
        if (!this.gameState.gameOver) {
            // Center column bonus
            const centerCol = Math.floor(this.config.cols / 2);
            if (Math.abs(move.column - centerCol) <= 1) {
                reward += this.config.rewardConfig.centerBonus;
            }

            // Connection bonus
            const connections = this.countConnections(move.row, move.column, move.player);
            reward += connections * this.config.rewardConfig.connectionBonus;

            // Blocking bonus
            if (this.isBlockingMove(move)) {
                reward += this.config.rewardConfig.blockingBonus;
            }

            // Time bonus (for faster moves)
            reward += this.config.rewardConfig.timeBonus;
        }

        return reward;
    }

    /**
     * Check for win condition
     */
    private checkWin(row: number, col: number, player: CellValue): boolean {
        const directions = [
            [0, 1],   // horizontal
            [1, 0],   // vertical
            [1, 1],   // diagonal /
            [1, -1]   // diagonal \
        ];

        for (const [dr, dc] of directions) {
            let count = 1;

            // Check positive direction
            for (let i = 1; i < this.config.winCondition; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;

                if (this.isValidPosition(newRow, newCol) &&
                    this.gameState.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            // Check negative direction
            for (let i = 1; i < this.config.winCondition; i++) {
                const newRow = row - dr * i;
                const newCol = col - dc * i;

                if (this.isValidPosition(newRow, newCol) &&
                    this.gameState.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }

            if (count >= this.config.winCondition) {
                return true;
            }
        }

        return false;
    }

    /**
     * Convert board to tensor representation
     */
    private getBoardTensor(): tf.Tensor {
        const channels = 3; // Empty, Red, Yellow
        const data = new Float32Array(this.config.rows * this.config.cols * channels);

        for (let r = 0; r < this.config.rows; r++) {
            for (let c = 0; c < this.config.cols; c++) {
                const idx = (r * this.config.cols + c) * channels;
                const cell = this.gameState.board[r][c];

                if (cell === 'Empty') {
                    data[idx] = 1;
                } else if (cell === 'Red') {
                    data[idx + 1] = 1;
                } else if (cell === 'Yellow') {
                    data[idx + 2] = 1;
                }
            }
        }

        return tf.tensor4d(data, [1, this.config.rows, this.config.cols, channels]);
    }

    /**
     * Extract game features for AI agents
     */
    private extractFeatures(): EnvironmentObservation['features'] {
        return {
            moveCount: this.gameState.moveCount,
            gamePhase: this.encodeGamePhase(this.gameState.gamePhase),
            currentPlayer: this.gameState.currentPlayer === 'Red' ? 0 : 1,
            threatLevel: this.calculateThreatLevel(),
            connectivity: this.calculateConnectivity(),
            centerControl: this.calculateCenterControl()
        };
    }

    /**
     * Get history tensor for sequence models
     */
    private getHistoryTensor(): tf.Tensor {
        const historyLength = Math.min(this.config.historyLength, this.gameState.moveHistory.length);
        const channels = 3;
        const data = new Float32Array(historyLength * this.config.rows * this.config.cols * channels);

        // Create historical board states
        for (let h = 0; h < historyLength; h++) {
            const boardState = this.getBoardStateAtMove(this.gameState.moveHistory.length - historyLength + h);

            for (let r = 0; r < this.config.rows; r++) {
                for (let c = 0; c < this.config.cols; c++) {
                    const idx = ((h * this.config.rows + r) * this.config.cols + c) * channels;
                    const cell = boardState[r][c];

                    if (cell === 'Empty') {
                        data[idx] = 1;
                    } else if (cell === 'Red') {
                        data[idx + 1] = 1;
                    } else if (cell === 'Yellow') {
                        data[idx + 2] = 1;
                    }
                }
            }
        }

        return tf.tensor4d(data, [1, historyLength, this.config.rows * this.config.cols, channels]);
    }

    /**
     * Evaluate current position
     */
    evaluatePosition(): number {
        const stateKey = this.getStateKey();

        if (this.config.enableCaching && this.evaluationCache.has(stateKey)) {
            return this.evaluationCache.get(stateKey)!;
        }

        let evaluation = 0;

        // Material evaluation (piece placement)
        evaluation += this.evaluateMaterial();

        // Positional evaluation (center control, connectivity)
        evaluation += this.evaluatePosition_Internal();

        // Tactical evaluation (threats, opportunities)
        evaluation += this.evaluateTactics();

        // Strategic evaluation (long-term planning)
        evaluation += this.evaluateStrategy();

        if (this.config.enableCaching) {
            this.evaluationCache.set(stateKey, evaluation);
        }

        return evaluation;
    }

    /**
     * Detect immediate threats
     */
    private detectThreats(): number[] {
        const threats: number[] = [];
        const opponent = this.gameState.currentPlayer === 'Red' ? 'Yellow' : 'Red';

        for (let col = 0; col < this.config.cols; col++) {
            if (this.isValidMove(col)) {
                // Simulate opponent move
                const row = this.getDropRow(col);
                if (row !== -1) {
                    this.gameState.board[row][col] = opponent;

                    if (this.checkWin(row, col, opponent)) {
                        threats.push(col);
                    }

                    // Restore board
                    this.gameState.board[row][col] = 'Empty';
                }
            }
        }

        return threats;
    }

    /**
     * Detect winning opportunities
     */
    private detectOpportunities(): number[] {
        const opportunities: number[] = [];

        for (let col = 0; col < this.config.cols; col++) {
            if (this.isValidMove(col)) {
                // Simulate current player move
                const row = this.getDropRow(col);
                if (row !== -1) {
                    this.gameState.board[row][col] = this.gameState.currentPlayer;

                    if (this.checkWin(row, col, this.gameState.currentPlayer)) {
                        opportunities.push(col);
                    }

                    // Restore board
                    this.gameState.board[row][col] = 'Empty';
                }
            }
        }

        return opportunities;
    }

    /**
     * Clone current state for simulation
     */
    clone(): Connect4Environment {
        const clonedEnv = new Connect4Environment(this.config);
        clonedEnv.gameState = {
            ...this.gameState,
            board: this.gameState.board.map(row => [...row]),
            moveHistory: [...this.gameState.moveHistory]
        };
        clonedEnv.redBitboard = this.redBitboard;
        clonedEnv.yellowBitboard = this.yellowBitboard;
        clonedEnv.filledBitboard = this.filledBitboard;

        return clonedEnv;
    }

    /**
     * Get game state for external access
     */
    getGameState(): GameState {
        return { ...this.gameState };
    }

    /**
     * Get environment metrics
     */
    getMetrics(): EnvironmentMetrics {
        return { ...this.metrics };
    }

    /**
     * Render board to console (for debugging)
     */
    render(): void {
        console.log('\n' + '='.repeat(this.config.cols * 4 + 1));

        for (let row = 0; row < this.config.rows; row++) {
            let rowStr = '|';
            for (let col = 0; col < this.config.cols; col++) {
                const cell = this.gameState.board[row][col];
                const symbol = cell === 'Red' ? ' R ' : cell === 'Yellow' ? ' Y ' : '   ';
                rowStr += symbol + '|';
            }
            console.log(rowStr);
        }

        console.log('='.repeat(this.config.cols * 4 + 1));

        // Column numbers
        let colStr = ' ';
        for (let col = 0; col < this.config.cols; col++) {
            colStr += ` ${col}  `;
        }
        console.log(colStr);

        console.log(`\nCurrent Player: ${this.gameState.currentPlayer}`);
        console.log(`Move Count: ${this.gameState.moveCount}`);
        console.log(`Game Phase: ${this.gameState.gamePhase}`);

        if (this.gameState.gameOver) {
            if (this.gameState.winner) {
                console.log(`Winner: ${this.gameState.winner}`);
            } else {
                console.log('Game ended in a draw');
            }
        }
    }

    // === Private Helper Methods ===

    private createEmptyBoard(): CellValue[][] {
        return Array(this.config.rows).fill(null).map(() =>
            Array(this.config.cols).fill('Empty')
        );
    }

    private generateGameId(): string {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getDropRow(column: number): number {
        for (let row = this.config.rows - 1; row >= 0; row--) {
            if (this.gameState.board[row][column] === 'Empty') {
                return row;
            }
        }
        return -1;
    }

    private isValidPosition(row: number, col: number): boolean {
        return row >= 0 && row < this.config.rows && col >= 0 && col < this.config.cols;
    }

    private isBoardFull(): boolean {
        for (let col = 0; col < this.config.cols; col++) {
            if (this.gameState.board[0][col] === 'Empty') {
                return false;
            }
        }
        return true;
    }

    private determineGamePhase(): GamePhase {
        const moveCount = this.gameState.moveCount;
        const totalCells = this.config.rows * this.config.cols;

        if (moveCount < totalCells * 0.3) {
            return 'opening';
        } else if (moveCount < totalCells * 0.7) {
            return 'midgame';
        } else {
            return 'endgame';
        }
    }

    private updateBitboards(row: number, col: number, player: CellValue): void {
        const position = BigInt(row * this.config.cols + col);
        const mask = 1n << position;

        if (player === 'Red') {
            this.redBitboard |= mask;
        } else if (player === 'Yellow') {
            this.yellowBitboard |= mask;
        }

        this.filledBitboard |= mask;
    }

    private countConnections(row: number, col: number, player: CellValue): number {
        let connections = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            for (const dir of [-1, 1]) {
                const newRow = row + dr * dir;
                const newCol = col + dc * dir;

                if (this.isValidPosition(newRow, newCol) &&
                    this.gameState.board[newRow][newCol] === player) {
                    connections++;
                }
            }
        }

        return connections;
    }

    private isBlockingMove(move: Move): boolean {
        const opponent = move.player === 'Red' ? 'Yellow' : 'Red';

        // Check if this move blocks an opponent threat
        this.gameState.board[move.row][move.column] = 'Empty'; // Temporarily remove

        // Check if opponent could win with this position
        this.gameState.board[move.row][move.column] = opponent;
        const wouldWin = this.checkWin(move.row, move.column, opponent);

        // Restore the move
        this.gameState.board[move.row][move.column] = move.player;

        return wouldWin;
    }

    private evaluateMoveQuality(column: number): number {
        // Simple move quality evaluation
        const centerCol = Math.floor(this.config.cols / 2);
        const centerDistance = Math.abs(column - centerCol);

        // Prefer center moves
        let quality = 1.0 - (centerDistance / this.config.cols);

        // Check if this creates threats or blocks opponent
        const row = this.getDropRow(column);
        if (row !== -1) {
            // Temporarily place piece
            this.gameState.board[row][column] = this.gameState.currentPlayer;

            // Check for immediate win
            if (this.checkWin(row, column, this.gameState.currentPlayer)) {
                quality += 0.5;
            }

            // Check connections
            const connections = this.countConnections(row, column, this.gameState.currentPlayer);
            quality += connections * 0.1;

            // Restore board
            this.gameState.board[row][column] = 'Empty';
        }

        return Math.min(1.0, quality);
    }

    private handleInvalidMove(action: number): StepResult {
        this.log('warn', 'Invalid move attempted', { action, gameState: this.gameState });

        return {
            observation: this.getObservation(),
            reward: this.config.rewardConfig.invalidMove,
            done: false,
            info: {
                moveValid: false,
                gamePhase: this.gameState.gamePhase,
                evaluation: this.evaluatePosition(),
                threats: [],
                opportunities: [],
                moveQuality: 0
            }
        };
    }

    private getStateKey(): string {
        return this.gameState.board.map(row => row.join('')).join('|');
    }

    private clearCaches(): void {
        this.stateCache.clear();
        this.evaluationCache.clear();
        this.legalMovesCache.clear();
    }

    private getBoardStateAtMove(moveIndex: number): CellValue[][] {
        const board = this.createEmptyBoard();

        for (let i = 0; i <= moveIndex && i < this.gameState.moveHistory.length; i++) {
            const move = this.gameState.moveHistory[i];
            board[move.row][move.column] = move.player;
        }

        return board;
    }

    private encodeGamePhase(phase: GamePhase): number {
        switch (phase) {
            case 'opening': return 0;
            case 'midgame': return 1;
            case 'endgame': return 2;
            default: return 1;
        }
    }

    private calculateThreatLevel(): number {
        const threats = this.detectThreats();
        const opportunities = this.detectOpportunities();

        return (threats.length * 0.8 + opportunities.length * 0.2) / this.config.cols;
    }

    private calculateConnectivity(): number {
        let totalConnectivity = 0;
        let pieceCount = 0;

        for (let r = 0; r < this.config.rows; r++) {
            for (let c = 0; c < this.config.cols; c++) {
                if (this.gameState.board[r][c] !== 'Empty') {
                    totalConnectivity += this.countConnections(r, c, this.gameState.board[r][c]);
                    pieceCount++;
                }
            }
        }

        return pieceCount > 0 ? totalConnectivity / pieceCount : 0;
    }

    private calculateCenterControl(): number {
        const centerCol = Math.floor(this.config.cols / 2);
        const centerCols = [centerCol - 1, centerCol, centerCol + 1].filter(c => c >= 0 && c < this.config.cols);

        let currentPlayerControl = 0;
        let totalPieces = 0;

        for (const col of centerCols) {
            for (let row = 0; row < this.config.rows; row++) {
                if (this.gameState.board[row][col] !== 'Empty') {
                    totalPieces++;
                    if (this.gameState.board[row][col] === this.gameState.currentPlayer) {
                        currentPlayerControl++;
                    }
                }
            }
        }

        return totalPieces > 0 ? currentPlayerControl / totalPieces : 0.5;
    }

    private evaluateMaterial(): number {
        // Simple material evaluation based on piece count and position
        let evaluation = 0;
        const centerCol = Math.floor(this.config.cols / 2);

        for (let r = 0; r < this.config.rows; r++) {
            for (let c = 0; c < this.config.cols; c++) {
                const cell = this.gameState.board[r][c];
                if (cell !== 'Empty') {
                    const value = 1 + (this.config.cols - Math.abs(c - centerCol)) * 0.1;

                    if (cell === this.gameState.currentPlayer) {
                        evaluation += value;
                    } else {
                        evaluation -= value;
                    }
                }
            }
        }

        return evaluation;
    }

    private evaluatePosition_Internal(): number {
        // Positional evaluation considering control and potential
        return this.calculateCenterControl() * 0.5 + this.calculateConnectivity() * 0.3;
    }

    private evaluateTactics(): number {
        const threats = this.detectThreats();
        const opportunities = this.detectOpportunities();

        return opportunities.length * 2 - threats.length * 1.5;
    }

    private evaluateStrategy(): number {
        // Long-term strategic evaluation
        const gamePhaseMultiplier = this.gameState.gamePhase === 'endgame' ? 1.5 : 1.0;
        const mobilityScore = this.getLegalMoves().length / this.config.cols;

        return mobilityScore * gamePhaseMultiplier * 0.2;
    }

    private initializeMetrics(): void {
        this.metrics = {
            gamesPlayed: 0,
            averageGameLength: 0,
            winRates: { Red: 0, Yellow: 0, Draw: 0 },
            averageMoveTime: 0,
            invalidMoveCount: 0,
            drawRate: 0,
            gamePhaseDistribution: { opening: 0, midgame: 0, endgame: 0 },
            positionComplexity: 0,
            branchingFactor: 0,
            performanceMetrics: {
                averageStepTime: 0,
                averageResetTime: 0,
                memoryUsage: 0,
                cacheHitRate: 0
            }
        };
    }

    private updateMetrics(stepTime: number): void {
        this.metrics.performanceMetrics.averageStepTime =
            (this.metrics.performanceMetrics.averageStepTime + stepTime) / 2;

        this.metrics.branchingFactor = this.getLegalMoves().length;

        // Update other metrics when game ends
        if (this.gameState.gameOver) {
            this.metrics.gamesPlayed++;
            this.metrics.averageGameLength =
                (this.metrics.averageGameLength + this.gameState.moveCount) / 2;

            if (this.gameState.winner) {
                this.metrics.winRates[this.gameState.winner]++;
            } else {
                this.metrics.winRates.Draw++;
            }
        }
    }

    private initializeWinPatterns(): void {
        // Initialize precomputed win patterns for bitboard operations
        // This is a simplified version - full implementation would compute all possible win patterns
        this.winPatterns = [];
        this.threatPatterns = [];

        // Horizontal patterns
        for (let row = 0; row < this.config.rows; row++) {
            for (let col = 0; col <= this.config.cols - this.config.winCondition; col++) {
                let pattern = 0n;
                for (let i = 0; i < this.config.winCondition; i++) {
                    pattern |= 1n << BigInt(row * this.config.cols + col + i);
                }
                this.winPatterns.push(pattern);
            }
        }

        // Vertical patterns
        for (let col = 0; col < this.config.cols; col++) {
            for (let row = 0; row <= this.config.rows - this.config.winCondition; row++) {
                let pattern = 0n;
                for (let i = 0; i < this.config.winCondition; i++) {
                    pattern |= 1n << BigInt((row + i) * this.config.cols + col);
                }
                this.winPatterns.push(pattern);
            }
        }

        // Diagonal patterns would be added here in a full implementation
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const configLevel = levels[this.config.logLevel];

        if (levels[level] >= configLevel) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [Environment] [${level.toUpperCase()}] ${message}`;

            if (data) {
                console[level](logMessage, data);
            } else {
                console[level](logMessage);
            }
        }
    }

    /**
     * Dispose of TensorFlow resources
     */
    dispose(): void {
        // Clean up any cached tensors
        this.clearCaches();

        this.log('info', 'Environment disposed');
    }
}

// === Utility Functions ===

/**
 * Create a Connect Four environment with default configuration
 */
export function createConnect4Environment(config?: EnvironmentConfig): Connect4Environment {
    return new Connect4Environment(config);
}

/**
 * Create multiple environments for parallel training
 */
export function createEnvironmentPool(count: number, config?: EnvironmentConfig): Connect4Environment[] {
    return Array(count).fill(null).map(() => new Connect4Environment(config));
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): boolean {
    if (config.rows && (config.rows < 4 || config.rows > 20)) {
        return false;
    }

    if (config.cols && (config.cols < 4 || config.cols > 20)) {
        return false;
    }

    if (config.winCondition && config.rows && config.cols) {
        if (config.winCondition > Math.min(config.rows, config.cols)) {
            return false;
        }
    }

    return true;
}

export default Connect4Environment;
