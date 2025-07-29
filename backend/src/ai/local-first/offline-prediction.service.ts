/**
 * Offline Prediction Service
 * Manages offline AI predictions with multiple fallback strategies
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import { LocalModelStore } from './local-model-store';

export interface PredictionStrategy {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  predict(board: CellValue[][], player: 'Red' | 'Yellow'): Promise<PredictionResult>;
}

export interface PredictionResult {
  move: number;
  confidence: number;
  strategy: string;
  features?: any;
  latency: number;
}

export interface OfflineCapabilities {
  strategies: string[];
  modelsAvailable: number;
  cacheSize: number;
  lastSync: Date | null;
  offlineHours: number;
}

@Injectable()
export class OfflinePredictionService {
  private strategies: Map<string, PredictionStrategy> = new Map();
  private predictionCache: Map<string, PredictionResult> = new Map();
  private offlineSince: Date | null = null;
  private readonly maxCacheSize = 5000;

  constructor(
    private eventEmitter: EventEmitter2,
    private modelStore: LocalModelStore
  ) {
    this.initializeStrategies();
  }

  /**
   * Initialize prediction strategies
   */
  private initializeStrategies() {
    // Pattern matching strategy
    this.addStrategy({
      name: 'pattern-matching',
      priority: 1,
      isAvailable: async () => true,
      predict: async (board, player) => this.patternMatchingStrategy(board, player)
    });

    // Opening book strategy
    this.addStrategy({
      name: 'opening-book',
      priority: 2,
      isAvailable: async () => this.hasOpeningBook(),
      predict: async (board, player) => this.openingBookStrategy(board, player)
    });

    // Neural network strategy
    this.addStrategy({
      name: 'neural-network',
      priority: 3,
      isAvailable: async () => {
        const models = await this.modelStore.queryModels({ type: 'onnx' });
        return models.length > 0;
      },
      predict: async (board, player) => this.neuralNetworkStrategy(board, player)
    });

    // Monte Carlo strategy
    this.addStrategy({
      name: 'monte-carlo',
      priority: 4,
      isAvailable: async () => true,
      predict: async (board, player) => this.monteCarloStrategy(board, player)
    });

    // Minimax strategy
    this.addStrategy({
      name: 'minimax',
      priority: 5,
      isAvailable: async () => true,
      predict: async (board, player) => this.minimaxStrategy(board, player)
    });
  }

  /**
   * Add a prediction strategy
   */
  addStrategy(strategy: PredictionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get offline prediction
   */
  async getOfflinePrediction(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    
    // Check cache
    const cacheKey = this.getBoardHash(board);
    const cached = this.predictionCache.get(cacheKey);
    
    if (cached) {
      this.eventEmitter.emit('offline.prediction.cache.hit', {
        strategy: cached.strategy,
        confidence: cached.confidence
      });
      
      return {
        ...cached,
        latency: performance.now() - startTime
      };
    }
    
    // Try strategies in order of priority
    const sortedStrategies = Array.from(this.strategies.values())
      .sort((a, b) => b.priority - a.priority);
    
    for (const strategy of sortedStrategies) {
      try {
        if (await strategy.isAvailable()) {
          const result = await strategy.predict(board, player);
          
          // Validate result
          if (this.isValidMove(board, result.move)) {
            // Cache result
            this.predictionCache.set(cacheKey, result);
            this.pruneCache();
            
            // Emit event
            this.eventEmitter.emit('offline.prediction.success', {
              strategy: strategy.name,
              confidence: result.confidence,
              latency: result.latency
            });
            
            return result;
          }
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }
    
    // Emergency fallback
    return this.emergencyFallback(board, player);
  }

  /**
   * Pattern matching strategy
   */
  private async patternMatchingStrategy(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    const patterns = this.detectPatterns(board, player);
    
    // Score each valid move based on patterns
    const validMoves = this.getValidMoves(board);
    const scores = new Map<number, number>();
    
    for (const move of validMoves) {
      let score = 0;
      
      // Check if move creates winning pattern
      const testBoard = this.makeMove(board, move, player);
      if (this.hasWinningPattern(testBoard, player)) {
        score += 1000;
      }
      
      // Check if move blocks opponent winning pattern
      const opponent = player === 'Red' ? 'Yellow' : 'Red';
      const opponentBoard = this.makeMove(board, move, opponent);
      if (this.hasWinningPattern(opponentBoard, opponent)) {
        score += 900;
      }
      
      // Score based on pattern strength
      score += this.evaluatePatterns(testBoard, player);
      
      scores.set(move, score);
    }
    
    // Select best move
    const bestMove = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      move: bestMove[0],
      confidence: Math.min(bestMove[1] / 1000, 1),
      strategy: 'pattern-matching',
      features: { patterns },
      latency: performance.now() - startTime
    };
  }

  /**
   * Opening book strategy
   */
  private async openingBookStrategy(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    
    // Load opening book from storage
    const openingBook = await this.loadOpeningBook();
    const boardHash = this.getBoardHash(board);
    
    if (openingBook[boardHash]) {
      const entry = openingBook[boardHash];
      return {
        move: entry.bestMove,
        confidence: entry.winRate,
        strategy: 'opening-book',
        features: { depth: entry.depth, games: entry.gameCount },
        latency: performance.now() - startTime
      };
    }
    
    throw new Error('Position not in opening book');
  }

  /**
   * Neural network strategy
   */
  private async neuralNetworkStrategy(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    
    // Load best available model
    const models = await this.modelStore.queryModels({ 
      type: 'onnx',
      minAccuracy: 0.7 
    });
    
    if (models.length === 0) {
      throw new Error('No neural network models available');
    }
    
    const model = models[0];
    const boardTensor = this.boardToTensor(board, player);
    
    // Simulate inference (actual implementation would use ONNX runtime)
    const policy = new Float32Array(7);
    const validMoves = this.getValidMoves(board);
    
    // Generate pseudo-probabilities
    let sum = 0;
    for (const move of validMoves) {
      policy[move] = Math.random();
      sum += policy[move];
    }
    
    // Normalize
    for (const move of validMoves) {
      policy[move] /= sum;
    }
    
    // Select best move
    const bestMove = validMoves.reduce((best, move) => 
      policy[move] > policy[best] ? move : best
    );
    
    return {
      move: bestMove,
      confidence: policy[bestMove],
      strategy: 'neural-network',
      features: { modelId: model.id, modelAccuracy: model.metadata.accuracy },
      latency: performance.now() - startTime
    };
  }

  /**
   * Monte Carlo strategy
   */
  private async monteCarloStrategy(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    const simulations = 100; // Limited for offline performance
    const validMoves = this.getValidMoves(board);
    const wins = new Map<number, number>();
    
    // Initialize wins
    for (const move of validMoves) {
      wins.set(move, 0);
    }
    
    // Run simulations
    for (let i = 0; i < simulations; i++) {
      const move = validMoves[i % validMoves.length];
      const result = this.simulateGame(
        this.makeMove(board, move, player),
        player === 'Red' ? 'Yellow' : 'Red'
      );
      
      if (result === player) {
        wins.set(move, wins.get(move)! + 1);
      }
    }
    
    // Select best move
    const bestMove = Array.from(wins.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      move: bestMove[0],
      confidence: bestMove[1] / simulations,
      strategy: 'monte-carlo',
      features: { simulations, winRate: bestMove[1] / simulations },
      latency: performance.now() - startTime
    };
  }

  /**
   * Minimax strategy
   */
  private async minimaxStrategy(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const startTime = performance.now();
    const depth = 4; // Limited depth for offline performance
    
    const result = this.minimax(board, depth, -Infinity, Infinity, player === 'Red');
    
    return {
      move: result.move,
      confidence: Math.abs(result.score) / 100,
      strategy: 'minimax',
      features: { depth, score: result.score },
      latency: performance.now() - startTime
    };
  }

  /**
   * Minimax implementation
   */
  private minimax(
    board: CellValue[][],
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): { move: number; score: number } {
    // Check terminal states
    const winner = this.checkWinner(board);
    if (winner === 'Red') return { move: -1, score: 100 - depth };
    if (winner === 'Yellow') return { move: -1, score: -100 + depth };
    if (this.isBoardFull(board) || depth === 0) {
      return { move: -1, score: this.evaluateBoard(board) };
    }
    
    const validMoves = this.getValidMoves(board);
    let bestMove = validMoves[0];
    let bestScore = maximizing ? -Infinity : Infinity;
    
    for (const move of validMoves) {
      const newBoard = this.makeMove(
        board, 
        move, 
        maximizing ? 'Red' : 'Yellow'
      );
      
      const result = this.minimax(newBoard, depth - 1, alpha, beta, !maximizing);
      
      if (maximizing) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        beta = Math.min(beta, bestScore);
      }
      
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    
    return { move: bestMove, score: bestScore };
  }

  /**
   * Emergency fallback
   */
  private async emergencyFallback(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<PredictionResult> {
    const validMoves = this.getValidMoves(board);
    const centerBias = [3, 2, 4, 1, 5, 0, 6];
    
    for (const col of centerBias) {
      if (validMoves.includes(col)) {
        return {
          move: col,
          confidence: 0.1,
          strategy: 'emergency-fallback',
          latency: 0
        };
      }
    }
    
    return {
      move: validMoves[0],
      confidence: 0.1,
      strategy: 'emergency-fallback',
      latency: 0
    };
  }

  /**
   * Get offline capabilities
   */
  async getOfflineCapabilities(): Promise<OfflineCapabilities> {
    const models = await this.modelStore.queryModels({});
    const strategies = [];
    
    for (const [name, strategy] of this.strategies) {
      if (await strategy.isAvailable()) {
        strategies.push(name);
      }
    }
    
    return {
      strategies,
      modelsAvailable: models.length,
      cacheSize: this.predictionCache.size,
      lastSync: null, // Would track actual sync time
      offlineHours: this.offlineSince ? 
        (Date.now() - this.offlineSince.getTime()) / 3600000 : 0
    };
  }

  /**
   * Set offline mode
   */
  setOfflineMode(offline: boolean): void {
    if (offline && !this.offlineSince) {
      this.offlineSince = new Date();
    } else if (!offline) {
      this.offlineSince = null;
    }
  }

  /**
   * Helper methods
   */

  private getBoardHash(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }

  private isValidMove(board: CellValue[][], col: number): boolean {
    return col >= 0 && col < 7 && board[0][col] === 'Empty';
  }

  private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }

  private checkWinner(board: CellValue[][]): CellValue | null {
    // Implementation of winner checking logic
    // Simplified for brevity
    return null;
  }

  private isBoardFull(board: CellValue[][]): boolean {
    return board[0].every(cell => cell !== 'Empty');
  }

  private evaluateBoard(board: CellValue[][]): number {
    // Simple board evaluation
    let score = 0;
    
    // Center column preference
    for (let row = 0; row < 6; row++) {
      if (board[row][3] === 'Red') score += 3;
      else if (board[row][3] === 'Yellow') score -= 3;
    }
    
    return score;
  }

  private detectPatterns(board: CellValue[][], player: CellValue): any[] {
    // Pattern detection logic
    return [];
  }

  private hasWinningPattern(board: CellValue[][], player: CellValue): boolean {
    return this.checkWinner(board) === player;
  }

  private evaluatePatterns(board: CellValue[][], player: CellValue): number {
    // Pattern evaluation logic
    return Math.random() * 100;
  }

  private async hasOpeningBook(): Promise<boolean> {
    try {
      const book = await this.modelStore.queryModels({ name: 'opening-book' });
      return book.length > 0;
    } catch {
      return false;
    }
  }

  private async loadOpeningBook(): Promise<any> {
    // Load opening book from storage
    return {};
  }

  private boardToTensor(board: CellValue[][], player: 'Red' | 'Yellow'): Float32Array {
    const tensor = new Float32Array(3 * 6 * 7);
    let idx = 0;
    
    for (let channel = 0; channel < 3; channel++) {
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
          const cell = board[row][col];
          if (channel === 0 && cell === 'Red') tensor[idx] = 1;
          else if (channel === 1 && cell === 'Yellow') tensor[idx] = 1;
          else if (channel === 2 && cell === 'Empty') tensor[idx] = 1;
          idx++;
        }
      }
    }
    
    return tensor;
  }

  private simulateGame(board: CellValue[][], currentPlayer: CellValue): CellValue | 'draw' {
    let player = currentPlayer;
    let boardCopy = board.map(row => [...row]);
    
    while (true) {
      const winner = this.checkWinner(boardCopy);
      if (winner) return winner;
      if (this.isBoardFull(boardCopy)) return 'draw';
      
      // Random move
      const validMoves = this.getValidMoves(boardCopy);
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      boardCopy = this.makeMove(boardCopy, move, player);
      
      player = player === 'Red' ? 'Yellow' : 'Red';
    }
  }

  private pruneCache(): void {
    if (this.predictionCache.size > this.maxCacheSize) {
      const toRemove = Math.floor(this.predictionCache.size * 0.2);
      const keys = Array.from(this.predictionCache.keys());
      
      for (let i = 0; i < toRemove; i++) {
        this.predictionCache.delete(keys[i]);
      }
    }
  }
}