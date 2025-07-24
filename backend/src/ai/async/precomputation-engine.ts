// backend/src/ai/async/precomputation-engine.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { CellValue } from '../connect4AI';
import { AsyncCacheManager } from './cache-manager';
import { DynamicStrategySelector, AIStrategy } from './strategy-selector';

export interface PrecomputeRequest {
  board: CellValue[][];
  player: CellValue;
  depth: number;
  priority: number;
  strategy?: AIStrategy;
}

export interface PrecomputeResult {
  board: string; // Serialized board state
  player: CellValue;
  bestMove: number;
  score: number;
  confidence: number;
  computeTime: number;
  strategy: AIStrategy;
  variations: Array<{
    move: number;
    score: number;
    continuation: number[];
  }>;
}

export interface PrecomputationStats {
  totalPrecomputed: number;
  cacheHits: number;
  averageComputeTime: number;
  queueSize: number;
  activeComputations: number;
  memoryUsage: number;
}

@Injectable()
export class PrecomputationEngine {
  private readonly logger = new Logger(PrecomputationEngine.name);
  private readonly precomputeQueue: PrecomputeRequest[] = [];
  private readonly activeComputations = new Set<string>();
  private readonly stats = {
    totalPrecomputed: 0,
    totalComputeTime: 0,
    cacheHits: 0
  };
  
  private isProcessing = false;
  private readonly maxQueueSize = 1000;
  private readonly maxConcurrentComputations = 3;
  private readonly batchSize = 10;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheManager: AsyncCacheManager,
    private readonly strategySelector: DynamicStrategySelector
  ) {}

  /**
   * Schedule board positions for precomputation
   */
  async schedulePrecomputation(request: PrecomputeRequest): Promise<void> {
    const boardKey = this.serializeBoard(request.board);
    const cacheKey = `${boardKey}-${request.player}`;

    // Check if already computed or computing
    if (this.activeComputations.has(cacheKey)) {
      return;
    }

    // Check queue size
    if (this.precomputeQueue.length >= this.maxQueueSize) {
      this.logger.warn('Precompute queue full, dropping lowest priority item');
      this.dropLowestPriorityItem();
    }

    // Add to queue
    this.precomputeQueue.push(request);
    
    // Sort by priority (higher first)
    this.precomputeQueue.sort((a, b) => b.priority - a.priority);

    this.eventEmitter.emit('precompute.scheduled', {
      boardKey,
      player: request.player,
      queueSize: this.precomputeQueue.length
    });
  }

  /**
   * Predict likely next positions and precompute them
   */
  async predictAndPrecompute(
    currentBoard: CellValue[][],
    currentPlayer: CellValue,
    lookAhead: number = 2
  ): Promise<void> {
    const predictions = await this.predictLikelyPositions(
      currentBoard,
      currentPlayer,
      lookAhead
    );

    for (const prediction of predictions) {
      await this.schedulePrecomputation({
        board: prediction.board,
        player: prediction.player,
        depth: Math.max(4, 8 - prediction.moveNumber),
        priority: prediction.probability * 10
      });
    }
  }

  /**
   * Get precomputed result if available
   */
  async getPrecomputed(
    board: CellValue[][],
    player: CellValue
  ): Promise<PrecomputeResult | null> {
    const boardKey = this.serializeBoard(board);
    const cacheKey = `precompute:${boardKey}-${player}`;

    // Try to get from cache
    const cached = await this.cacheManager.batchGet<PrecomputeResult>('precompute', [cacheKey]);
    const result = cached.get(cacheKey);

    if (result) {
      this.stats.cacheHits++;
      this.eventEmitter.emit('precompute.hit', { boardKey, player });
      return result;
    }

    return null;
  }

  /**
   * Process precomputation queue in background
   */
  @Interval(100) // Run every 100ms
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.precomputeQueue.length === 0) {
      return;
    }

    if (this.activeComputations.size >= this.maxConcurrentComputations) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get batch of items to process
      const batch = this.precomputeQueue.splice(0, this.batchSize);
      
      // Process in parallel
      const promises = batch.map(request => this.processRequest(request));
      await Promise.allSettled(promises);

    } catch (error) {
      this.logger.error('Error processing precompute queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get precomputation statistics
   */
  getStats(): PrecomputationStats {
    const avgComputeTime = this.stats.totalPrecomputed > 0
      ? this.stats.totalComputeTime / this.stats.totalPrecomputed
      : 0;

    return {
      totalPrecomputed: this.stats.totalPrecomputed,
      cacheHits: this.stats.cacheHits,
      averageComputeTime: avgComputeTime,
      queueSize: this.precomputeQueue.length,
      activeComputations: this.activeComputations.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Clear precomputation queue
   */
  clearQueue(): void {
    this.precomputeQueue.length = 0;
    this.logger.log('Precomputation queue cleared');
  }

  /**
   * Warm up cache with common positions
   */
  async warmupCache(): Promise<void> {
    this.logger.log('Starting cache warmup...');

    // Common opening positions
    const openingPositions = this.generateOpeningPositions();
    
    for (const position of openingPositions) {
      await this.schedulePrecomputation({
        board: position.board,
        player: position.player,
        depth: 8,
        priority: 8
      });
    }

    // Common endgame patterns
    const endgamePatterns = this.generateEndgamePatterns();
    
    for (const pattern of endgamePatterns) {
      await this.schedulePrecomputation({
        board: pattern.board,
        player: pattern.player,
        depth: 12,
        priority: 6
      });
    }

    this.logger.log(`Scheduled ${openingPositions.length + endgamePatterns.length} positions for warmup`);
  }

  private async processRequest(request: PrecomputeRequest): Promise<void> {
    const boardKey = this.serializeBoard(request.board);
    const cacheKey = `${boardKey}-${request.player}`;

    // Mark as computing
    this.activeComputations.add(cacheKey);

    try {
      const startTime = Date.now();

      // Select strategy if not specified
      const strategy = request.strategy || (await this.selectOptimalStrategy(request));

      // Compute best move (this would integrate with actual AI)
      const result = await this.computeBestMove(request, strategy);

      const computeTime = Date.now() - startTime;

      // Create result
      const precomputeResult: PrecomputeResult = {
        board: boardKey,
        player: request.player,
        bestMove: result.bestMove,
        score: result.score,
        confidence: result.confidence,
        computeTime,
        strategy,
        variations: result.variations
      };

      // Cache result
      const fullCacheKey = `precompute:${cacheKey}`;
      await this.cacheManager.preload('precompute', [{
        key: fullCacheKey,
        compute: async () => precomputeResult
      }], { ttl: 3600000 }); // 1 hour TTL

      // Update stats
      this.stats.totalPrecomputed++;
      this.stats.totalComputeTime += computeTime;

      this.eventEmitter.emit('precompute.completed', {
        boardKey,
        player: request.player,
        computeTime,
        strategy
      });

    } catch (error) {
      this.logger.error(`Failed to precompute ${cacheKey}:`, error);
    } finally {
      this.activeComputations.delete(cacheKey);
    }
  }

  private async predictLikelyPositions(
    board: CellValue[][],
    player: CellValue,
    depth: number
  ): Promise<Array<{
    board: CellValue[][];
    player: CellValue;
    probability: number;
    moveNumber: number;
  }>> {
    const predictions: Array<{
      board: CellValue[][];
      player: CellValue;
      probability: number;
      moveNumber: number;
    }> = [];

    // Get valid moves
    const validMoves = this.getValidMoves(board);
    
    // Calculate move probabilities based on position quality
    const moveProbabilities = await this.calculateMoveProbabilities(board, player, validMoves);

    // Generate positions for likely moves
    for (const move of validMoves) {
      const probability = moveProbabilities.get(move) || 0;
      
      if (probability > 0.1) { // Only consider moves with >10% probability
        const newBoard = this.makeMove(board, move, player);
        const nextPlayer = player === 'Red' ? 'Yellow' : 'Red';
        const moveNumber = board.flat().filter(cell => cell !== 'Empty').length + 1;

        predictions.push({
          board: newBoard,
          player: nextPlayer,
          probability,
          moveNumber
        });

        // Recurse for deeper predictions
        if (depth > 1 && probability > 0.3) {
          const deeperPredictions = await this.predictLikelyPositions(
            newBoard,
            nextPlayer,
            depth - 1
          );

          predictions.push(...deeperPredictions.map(p => ({
            ...p,
            probability: p.probability * probability * 0.8 // Decay factor
          })));
        }
      }
    }

    // Sort by probability and take top predictions
    return predictions
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 20);
  }

  private async calculateMoveProbabilities(
    board: CellValue[][],
    player: CellValue,
    moves: number[]
  ): Promise<Map<number, number>> {
    const probabilities = new Map<number, number>();
    
    // Simple heuristic-based probability calculation
    for (const move of moves) {
      let probability = 0.1; // Base probability

      // Center columns are more likely
      if (move === 3) probability += 0.2;
      else if (move === 2 || move === 4) probability += 0.1;

      // Check for immediate wins/blocks
      const testBoard = this.makeMove(board, move, player);
      if (this.checkWin(testBoard, player)) {
        probability = 0.9; // Very likely to play winning move
      } else {
        // Check if opponent would win
        const opponentTestBoard = this.makeMove(board, move, player === 'Red' ? 'Yellow' : 'Red');
        if (this.checkWin(opponentTestBoard, player === 'Red' ? 'Yellow' : 'Red')) {
          probability = 0.8; // Very likely to block
        }
      }

      probabilities.set(move, probability);
    }

    // Normalize probabilities
    const total = Array.from(probabilities.values()).reduce((a, b) => a + b, 0);
    for (const [move, prob] of probabilities) {
      probabilities.set(move, prob / total);
    }

    return probabilities;
  }

  private async selectOptimalStrategy(request: PrecomputeRequest): Promise<AIStrategy> {
    const gameState = {
      board: request.board,
      currentPlayer: request.player,
      moveNumber: request.board.flat().filter(cell => cell !== 'Empty').length,
      difficulty: 10 // Default difficulty for precomputation
    };

    const selection = await this.strategySelector.selectStrategy(gameState);
    return selection.primary;
  }

  private async computeBestMove(
    request: PrecomputeRequest,
    strategy: AIStrategy
  ): Promise<{
    bestMove: number;
    score: number;
    confidence: number;
    variations: Array<{
      move: number;
      score: number;
      continuation: number[];
    }>;
  }> {
    // This would integrate with actual AI implementations
    // For now, return mock data
    const validMoves = this.getValidMoves(request.board);
    
    return {
      bestMove: validMoves[Math.floor(Math.random() * validMoves.length)],
      score: Math.random() * 2 - 1,
      confidence: 0.5 + Math.random() * 0.5,
      variations: validMoves.slice(0, 3).map(move => ({
        move,
        score: Math.random() * 2 - 1,
        continuation: [move, validMoves[0], validMoves[1]]
      }))
    };
  }

  private serializeBoard(board: CellValue[][]): string {
    return board.map(row => row.map(cell => 
      cell === 'Empty' ? '0' : cell === 'Red' ? '1' : '2'
    ).join('')).join('');
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

  private makeMove(board: CellValue[][], column: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][column] === 'Empty') {
        newBoard[row][column] = player;
        break;
      }
    }
    
    return newBoard;
  }

  private checkWin(board: CellValue[][], player: CellValue): boolean {
    // Simplified win check - would use actual game logic
    // Check horizontal, vertical, and diagonal wins
    return false; // Placeholder
  }

  private dropLowestPriorityItem(): void {
    if (this.precomputeQueue.length > 0) {
      this.precomputeQueue.pop();
    }
  }

  private estimateMemoryUsage(): number {
    // Estimate based on queue size and cache size
    const queueMemory = this.precomputeQueue.length * 1024; // ~1KB per request
    const cacheMemory = this.stats.totalPrecomputed * 2048; // ~2KB per cached result
    return queueMemory + cacheMemory;
  }

  private generateOpeningPositions(): Array<{ board: CellValue[][]; player: CellValue }> {
    const positions: Array<{ board: CellValue[][]; player: CellValue }> = [];
    
    // Empty board
    const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill('Empty'));
    positions.push({ board: emptyBoard, player: 'Red' });

    // Common first moves
    for (const col of [2, 3, 4]) {
      const board = this.makeMove(emptyBoard, col, 'Red');
      positions.push({ board, player: 'Yellow' });
    }

    return positions;
  }

  private generateEndgamePatterns(): Array<{ board: CellValue[][]; player: CellValue }> {
    // Generate some common endgame patterns
    // This is simplified - would include actual common patterns
    return [];
  }
}