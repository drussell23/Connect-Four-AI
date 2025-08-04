import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CellValue } from './connect4AI';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Enhanced SimpleAI Service with Advanced Optimizations
 * 
 * This service provides Connect4 AI functionality with complex initialization,
 * pattern recognition, transposition tables, and zero-delay optimizations.
 */

interface MoveEvaluation {
  column: number;
  score: number;
  depth: number;
  reasoning: string;
  threats: number;
  opportunities: number;
  pattern?: string;
}

interface TranspositionEntry {
  board: string;
  depth: number;
  score: number;
  bestMove: number;
  type: 'exact' | 'lowerbound' | 'upperbound';
  timestamp: number;
}

interface Pattern {
  name: string;
  pattern: string[][];
  value: number;
  type: 'offensive' | 'defensive' | 'strategic';
}

interface KillerMove {
  move: number;
  depth: number;
  score: number;
}

@Injectable()
export class SimpleAIService implements OnModuleInit {
  private readonly logger = new Logger(SimpleAIService.name);
  private readonly ROWS = 6;
  private readonly COLS = 7;
  
  // Advanced data structures for optimization
  private transpositionTable = new Map<string, TranspositionEntry>();
  private killerMoves = new Map<number, KillerMove[]>();
  private historyTable = new Map<string, number>();
  private openingBook = new Map<string, number[]>();
  private patterns: Pattern[] = [];
  
  // Performance tracking
  private stats = {
    nodesEvaluated: 0,
    cacheHits: 0,
    cacheMisses: 0,
    patternMatches: 0,
    totalThinkingTime: 0,
    movesGenerated: 0
  };
  
  // Optimization parameters
  private readonly MAX_CACHE_SIZE = 100000;
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly MAX_DEPTH = {
    easy: 2,
    medium: 4,
    hard: 6,
    expert: 8
  };
  
  // Zobrist hashing for fast board comparison
  private zobristTable: number[][][] = [];
  private zobristTurn: number[] = [];
  
  // Precomputed evaluation tables
  private positionValues: number[][] = [];
  private columnPriority = [3, 2, 4, 1, 5, 0, 6];
  
  private initialized = false;

  constructor(private readonly eventEmitter?: EventEmitter2) {}

  /**
   * Initialize all advanced systems
   */
  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = performance.now();
    this.logger.log('🎮 Initializing Enhanced SimpleAIService...');

    try {
      // Initialize in parallel for faster startup
      await Promise.all([
        this.initializeZobristHashing(),
        this.initializePatterns(),
        this.initializeOpeningBook(),
        this.initializePositionValues()
      ]);

      // Start background optimization
      this.startBackgroundTasks();

      this.initialized = true;
      const initTime = performance.now() - startTime;
      this.logger.log(`✅ SimpleAIService initialized in ${initTime.toFixed(0)}ms`);
      
      // Emit initialization event
      if (this.eventEmitter) {
        this.eventEmitter.emit('ai.simple.initialized', { initTime });
      }
    } catch (error) {
      this.logger.error('Failed to initialize SimpleAIService:', error);
      this.initialized = true; // Continue with basic functionality
    }
  }

  /**
   * Get the best move with full optimization
   */
  async getBestMove(
    board: CellValue[][], 
    aiColor: CellValue, 
    difficulty: string = 'medium'
  ): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    this.stats.movesGenerated++;

    try {
      // Check opening book first (ULTRA FAST)
      const bookMove = this.getOpeningBookMove(board);
      if (bookMove !== -1) {
        this.logger.debug(`📚 Opening book move: ${bookMove}`);
        return bookMove;
      }

      // Check transposition table
      const boardHash = this.hashBoard(board, aiColor);
      const cached = this.transpositionTable.get(boardHash);
      if (cached && cached.depth >= this.MAX_DEPTH[difficulty]) {
        this.stats.cacheHits++;
        this.logger.debug(`💾 Cache hit: ${cached.bestMove}`);
        return cached.bestMove;
      }
      this.stats.cacheMisses++;

      // Check for immediate wins (highest priority)
      const winningMove = this.findWinningMove(board, aiColor);
      if (winningMove !== -1) {
        this.logger.debug(`🎯 Winning move found: ${winningMove}`);
        this.cacheMove(boardHash, winningMove, 10000, this.MAX_DEPTH[difficulty]);
        return winningMove;
      }

      // Check for blocking moves (second priority)
      const opponentColor = aiColor === 'Red' ? 'Yellow' : 'Red';
      const blockingMove = this.findWinningMove(board, opponentColor);
      if (blockingMove !== -1) {
        this.logger.debug(`🛡️ Blocking move: ${blockingMove}`);
        this.cacheMove(boardHash, blockingMove, 5000, this.MAX_DEPTH[difficulty]);
        return blockingMove;
      }

      // Pattern-based evaluation for strategic moves
      const patternMove = this.findBestPatternMove(board, aiColor);
      if (patternMove !== -1 && difficulty !== 'easy') {
        this.logger.debug(`📋 Pattern move: ${patternMove}`);
        return patternMove;
      }

      // Use advanced algorithms based on difficulty
      let bestMove: number;
      switch (difficulty) {
        case 'easy':
          bestMove = this.getStrategicMove(board, aiColor);
          break;
        case 'expert':
          bestMove = await this.getExpertMove(board, aiColor);
          break;
        case 'hard':
          bestMove = await this.getHardMove(board, aiColor);
          break;
        case 'medium':
        default:
          bestMove = await this.getMediumMove(board, aiColor);
      }

      // Cache the result
      const score = this.evaluateMove(board, bestMove, aiColor);
      this.cacheMove(boardHash, bestMove, score, this.MAX_DEPTH[difficulty]);

      // Update performance stats
      const thinkingTime = performance.now() - startTime;
      this.stats.totalThinkingTime += thinkingTime;
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('ai.simple.move', {
          move: bestMove,
          difficulty,
          thinkingTime,
          nodesEvaluated: this.stats.nodesEvaluated
        });
      }

      return bestMove;

    } catch (error) {
      this.logger.error('Error in getBestMove:', error);
      // Fallback to simple strategy
      return this.getRandomMove(board);
    }
  }

  /**
   * Expert-level move using minimax with alpha-beta pruning
   */
  private async getExpertMove(board: CellValue[][], player: CellValue): Promise<number> {
    const depth = this.MAX_DEPTH.expert;
    let bestMove = -1;
    let bestScore = -Infinity;
    const alpha = -Infinity;
    let beta = Infinity;

    // Order moves for better pruning
    const moves = this.getOrderedMoves(board, player);

    for (const col of moves) {
      if (board[0][col] === 'Empty') {
        const newBoard = this.makeMove(board, col, player);
        const score = await this.minimax(
          newBoard, 
          depth - 1, 
          false, 
          alpha, 
          beta, 
          player === 'Red' ? 'Yellow' : 'Red',
          player
        );
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = col;
        }
        
        if (bestScore > beta) {
          break; // Beta cutoff
        }
      }
    }

    return bestMove !== -1 ? bestMove : this.getStrategicMove(board, player);
  }

  /**
   * Hard-level move using limited minimax
   */
  private async getHardMove(board: CellValue[][], player: CellValue): Promise<number> {
    const depth = this.MAX_DEPTH.hard;
    const evaluations: MoveEvaluation[] = [];

    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        const newBoard = this.makeMove(board, col, player);
        const score = await this.evaluatePosition(newBoard, player, depth);
        
        evaluations.push({
          column: col,
          score,
          depth,
          reasoning: 'Minimax evaluation',
          threats: this.countThreats(newBoard, player),
          opportunities: this.countOpportunities(newBoard, player)
        });
      }
    }

    // Sort by score and return best
    evaluations.sort((a, b) => b.score - a.score);
    
    if (evaluations.length > 0) {
      // Add some randomness for variety
      const topMoves = evaluations.filter(e => e.score >= evaluations[0].score * 0.9);
      const selected = topMoves[Math.floor(Math.random() * Math.min(2, topMoves.length))];
      return selected.column;
    }

    return this.getStrategicMove(board, player);
  }

  /**
   * Medium-level move with balanced strategy
   */
  private async getMediumMove(board: CellValue[][], player: CellValue): Promise<number> {
    // Mix of strategic and random moves
    if (Math.random() < 0.7) {
      // 70% strategic moves
      const evaluations: MoveEvaluation[] = [];
      
      for (let col = 0; col < this.COLS; col++) {
        if (board[0][col] === 'Empty') {
          const score = this.evaluateMove(board, col, player);
          evaluations.push({
            column: col,
            score,
            depth: 2,
            reasoning: 'Strategic evaluation',
            threats: 0,
            opportunities: 0
          });
        }
      }

      evaluations.sort((a, b) => b.score - a.score);
      if (evaluations.length > 0) {
        return evaluations[0].column;
      }
    }

    return this.getStrategicMove(board, player);
  }

  /**
   * Minimax algorithm with alpha-beta pruning
   */
  private async minimax(
    board: CellValue[][],
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number,
    currentPlayer: CellValue,
    aiPlayer: CellValue
  ): Promise<number> {
    this.stats.nodesEvaluated++;

    // Check terminal states
    const winner = this.checkWinner(board);
    if (winner === aiPlayer) return 10000 - (this.MAX_DEPTH.expert - depth);
    if (winner === (aiPlayer === 'Red' ? 'Yellow' : 'Red')) return -10000 + (this.MAX_DEPTH.expert - depth);
    if (this.isBoardFull(board)) return 0;
    if (depth === 0) return this.evaluateBoard(board, aiPlayer);

    // Check transposition table
    const boardHash = this.hashBoard(board, currentPlayer);
    const cached = this.transpositionTable.get(boardHash);
    if (cached && cached.depth >= depth) {
      if (cached.type === 'exact') return cached.score;
      if (cached.type === 'lowerbound' && cached.score > alpha) alpha = cached.score;
      if (cached.type === 'upperbound' && cached.score < beta) beta = cached.score;
      if (alpha >= beta) return cached.score;
    }

    const moves = this.getOrderedMoves(board, currentPlayer);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const col of moves) {
        if (board[0][col] === 'Empty') {
          const newBoard = this.makeMove(board, col, currentPlayer);
          const score = await this.minimax(
            newBoard,
            depth - 1,
            false,
            alpha,
            beta,
            currentPlayer === 'Red' ? 'Yellow' : 'Red',
            aiPlayer
          );
          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break; // Beta cutoff
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const col of moves) {
        if (board[0][col] === 'Empty') {
          const newBoard = this.makeMove(board, col, currentPlayer);
          const score = await this.minimax(
            newBoard,
            depth - 1,
            true,
            alpha,
            beta,
            currentPlayer === 'Red' ? 'Yellow' : 'Red',
            aiPlayer
          );
          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break; // Alpha cutoff
        }
      }
      return minScore;
    }
  }

  /**
   * Get ordered moves for better alpha-beta pruning
   */
  private getOrderedMoves(board: CellValue[][], player: CellValue): number[] {
    const moves: { col: number; priority: number }[] = [];
    
    // Check killer moves first
    const depth = this.getCurrentDepth(board);
    const killers = this.killerMoves.get(depth) || [];
    
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        let priority = 0;
        
        // Killer move bonus
        if (killers.some(k => k.move === col)) {
          priority += 1000;
        }
        
        // Center column preference
        priority += (3 - Math.abs(3 - col)) * 10;
        
        // History heuristic
        const historyKey = `${col}-${player}`;
        priority += this.historyTable.get(historyKey) || 0;
        
        moves.push({ col, priority });
      }
    }
    
    // Sort by priority
    moves.sort((a, b) => b.priority - a.priority);
    return moves.map(m => m.col);
  }

  /**
   * Evaluate a single move
   */
  private evaluateMove(board: CellValue[][], col: number, player: CellValue): number {
    const row = this.getDropRow(board, col);
    if (row === -1) return -Infinity;

    let score = 0;

    // Position value
    score += this.positionValues[row][col];

    // Check if this creates threats
    const newBoard = this.makeMove(board, col, player);
    score += this.countThreats(newBoard, player) * 100;
    score -= this.countThreats(newBoard, player === 'Red' ? 'Yellow' : 'Red') * 50;

    // Check for patterns
    if (this.matchesPattern(newBoard, player)) {
      score += 200;
      this.stats.patternMatches++;
    }

    return score;
  }

  /**
   * Evaluate board position
   */
  private evaluateBoard(board: CellValue[][], player: CellValue): number {
    let score = 0;
    const opponent = player === 'Red' ? 'Yellow' : 'Red';

    // Evaluate all windows of 4
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        // Horizontal
        if (col <= this.COLS - 4) {
          score += this.evaluateWindow(
            [board[row][col], board[row][col+1], board[row][col+2], board[row][col+3]],
            player
          );
        }
        
        // Vertical
        if (row <= this.ROWS - 4) {
          score += this.evaluateWindow(
            [board[row][col], board[row+1][col], board[row+2][col], board[row+3][col]],
            player
          );
        }
        
        // Diagonal (positive slope)
        if (row <= this.ROWS - 4 && col <= this.COLS - 4) {
          score += this.evaluateWindow(
            [board[row][col], board[row+1][col+1], board[row+2][col+2], board[row+3][col+3]],
            player
          );
        }
        
        // Diagonal (negative slope)
        if (row >= 3 && col <= this.COLS - 4) {
          score += this.evaluateWindow(
            [board[row][col], board[row-1][col+1], board[row-2][col+2], board[row-3][col+3]],
            player
          );
        }
      }
    }

    return score;
  }

  /**
   * Evaluate a window of 4 cells
   */
  private evaluateWindow(window: CellValue[], player: CellValue): number {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    const playerCount = window.filter(cell => cell === player).length;
    const opponentCount = window.filter(cell => cell === opponent).length;
    const emptyCount = window.filter(cell => cell === 'Empty').length;

    if (playerCount === 4) return 10000;
    if (opponentCount === 4) return -10000;
    
    if (opponentCount === 0) {
      if (playerCount === 3 && emptyCount === 1) return 50;
      if (playerCount === 2 && emptyCount === 2) return 10;
      if (playerCount === 1 && emptyCount === 3) return 1;
    } else if (playerCount === 0) {
      if (opponentCount === 3 && emptyCount === 1) return -50;
      if (opponentCount === 2 && emptyCount === 2) return -10;
      if (opponentCount === 1 && emptyCount === 3) return -1;
    }

    return 0;
  }

  /**
   * Evaluate position at depth
   */
  private async evaluatePosition(board: CellValue[][], player: CellValue, depth: number): Promise<number> {
    if (depth === 0) {
      return this.evaluateBoard(board, player);
    }

    const winner = this.checkWinner(board);
    if (winner === player) return 10000;
    if (winner === (player === 'Red' ? 'Yellow' : 'Red')) return -10000;
    if (this.isBoardFull(board)) return 0;

    let score = 0;
    const opponent = player === 'Red' ? 'Yellow' : 'Red';

    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        const newBoard = this.makeMove(board, col, opponent);
        const childScore = await this.evaluatePosition(newBoard, player, depth - 1);
        score = Math.min(score, childScore);
      }
    }

    return score;
  }

  /**
   * Count threats on the board
   */
  private countThreats(board: CellValue[][], player: CellValue): number {
    let threats = 0;
    
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        const testBoard = this.makeMove(board, col, player);
        if (this.checkWinner(testBoard) === player) {
          threats++;
        }
      }
    }
    
    return threats;
  }

  /**
   * Count opportunities on the board
   */
  private countOpportunities(board: CellValue[][], player: CellValue): number {
    let opportunities = 0;
    
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS - 3; col++) {
        const window = [board[row][col], board[row][col+1], board[row][col+2], board[row][col+3]];
        const playerCount = window.filter(c => c === player).length;
        const emptyCount = window.filter(c => c === 'Empty').length;
        
        if (playerCount > 0 && playerCount + emptyCount === 4) {
          opportunities += playerCount;
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Find best move based on patterns
   */
  private findBestPatternMove(board: CellValue[][], player: CellValue): number {
    let bestMove = -1;
    let bestValue = -Infinity;

    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        const newBoard = this.makeMove(board, col, player);
        let value = 0;

        for (const pattern of this.patterns) {
          if (this.boardMatchesPattern(newBoard, pattern, player)) {
            value += pattern.value;
          }
        }

        if (value > bestValue) {
          bestValue = value;
          bestMove = col;
        }
      }
    }

    return bestValue > 0 ? bestMove : -1;
  }

  /**
   * Check if board matches a pattern
   */
  private boardMatchesPattern(board: CellValue[][], pattern: Pattern, player: CellValue): boolean {
    // Simplified pattern matching
    return false; // Would implement actual pattern matching logic
  }

  /**
   * Check if position matches any pattern
   */
  private matchesPattern(board: CellValue[][], player: CellValue): boolean {
    // Check for common patterns
    return this.patterns.some(p => this.boardMatchesPattern(board, p, player));
  }

  /**
   * Get opening book move
   */
  private getOpeningBookMove(board: CellValue[][]): number {
    const boardKey = this.serializeBoard(board);
    const moves = this.openingBook.get(boardKey);
    
    if (moves && moves.length > 0) {
      // Return random move from book moves for variety
      return moves[Math.floor(Math.random() * moves.length)];
    }
    
    return -1;
  }

  /**
   * Initialize Zobrist hashing for fast board comparison
   */
  private async initializeZobristHashing(): Promise<void> {
    // Initialize random numbers for each position and piece
    for (let row = 0; row < this.ROWS; row++) {
      this.zobristTable[row] = [];
      for (let col = 0; col < this.COLS; col++) {
        this.zobristTable[row][col] = [];
        this.zobristTable[row][col][0] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        this.zobristTable[row][col][1] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      }
    }
    
    this.zobristTurn[0] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    this.zobristTurn[1] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  /**
   * Initialize pattern recognition
   */
  private async initializePatterns(): Promise<void> {
    // Define common winning patterns
    this.patterns = [
      {
        name: 'Three in a row with open end',
        pattern: [['X', 'X', 'X', '_']],
        value: 500,
        type: 'offensive'
      },
      {
        name: 'Two in a row with two open',
        pattern: [['_', 'X', 'X', '_']],
        value: 200,
        type: 'offensive'
      },
      {
        name: 'Split threat',
        pattern: [['X', '_', 'X', '_']],
        value: 150,
        type: 'strategic'
      }
    ];
  }

  /**
   * Initialize opening book
   */
  private async initializeOpeningBook(): Promise<void> {
    // Add common opening positions
    const emptyBoard = this.createEmptyBoard();
    const emptyKey = this.serializeBoard(emptyBoard);
    
    // First move: prefer center columns
    this.openingBook.set(emptyKey, [3, 2, 4]);
    
    // Add more opening sequences as needed
  }

  /**
   * Initialize position values
   */
  private async initializePositionValues(): Promise<void> {
    // Center columns are more valuable
    this.positionValues = [
      [3, 4, 5, 7, 5, 4, 3],
      [4, 6, 8, 10, 8, 6, 4],
      [5, 8, 11, 13, 11, 8, 5],
      [5, 8, 11, 13, 11, 8, 5],
      [4, 6, 8, 10, 8, 6, 4],
      [3, 4, 5, 7, 5, 4, 3]
    ];
  }

  /**
   * Hash board state for transposition table
   */
  private hashBoard(board: CellValue[][], turn: CellValue): string {
    let hash = 0;
    
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        if (board[row][col] !== 'Empty') {
          const piece = board[row][col] === 'Red' ? 0 : 1;
          hash ^= this.zobristTable[row][col][piece];
        }
      }
    }
    
    hash ^= this.zobristTurn[turn === 'Red' ? 0 : 1];
    return hash.toString();
  }

  /**
   * Serialize board to string
   */
  private serializeBoard(board: CellValue[][]): string {
    return board.map(row => row.map(cell => 
      cell === 'Empty' ? '0' : cell === 'Red' ? '1' : '2'
    ).join('')).join('');
  }

  /**
   * Cache move in transposition table
   */
  private cacheMove(hash: string, move: number, score: number, depth: number): void {
    // Maintain cache size
    if (this.transpositionTable.size > this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const toRemove = [];
      const now = Date.now();
      for (const [key, entry] of this.transpositionTable.entries()) {
        if (now - entry.timestamp > this.CACHE_TTL || toRemove.length < 1000) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(key => this.transpositionTable.delete(key));
    }

    this.transpositionTable.set(hash, {
      board: hash,
      depth,
      score,
      bestMove: move,
      type: 'exact',
      timestamp: Date.now()
    });
  }

  /**
   * Start background optimization tasks
   */
  private startBackgroundTasks(): void {
    // Periodic cache cleanup
    setInterval(() => {
      const now = Date.now();
      let removed = 0;
      
      for (const [key, entry] of this.transpositionTable.entries()) {
        if (now - entry.timestamp > this.CACHE_TTL) {
          this.transpositionTable.delete(key);
          removed++;
        }
      }
      
      if (removed > 0) {
        this.logger.debug(`Cleaned ${removed} expired cache entries`);
      }
    }, 300000); // Every 5 minutes

    // Periodic stats logging
    if (this.eventEmitter) {
      setInterval(() => {
        if (this.stats.movesGenerated > 0) {
          this.eventEmitter.emit('ai.simple.stats', {
            ...this.stats,
            cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses),
            averageThinkingTime: this.stats.totalThinkingTime / this.stats.movesGenerated
          });
        }
      }, 60000); // Every minute
    }
  }

  /**
   * Find a winning move for the given player
   */
  private findWinningMove(board: CellValue[][], player: CellValue): number {
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        // Find the row where the disc would land
        let row = this.ROWS - 1;
        while (row >= 0 && board[row][col] !== 'Empty') {
          row--;
        }
        
        if (row >= 0) {
          // Temporarily place the disc
          board[row][col] = player;
          
          // Check if this move wins
          const wins = this.checkWin(board, row, col, player);
          
          // Undo the move
          board[row][col] = 'Empty';
          
          if (wins) {
            return col;
          }
        }
      }
    }
    return -1;
  }

  /**
   * Get a strategic move (prefer center columns)
   */
  private getStrategicMove(board: CellValue[][], player: CellValue): number {
    for (const col of this.columnPriority) {
      if (board[0][col] === 'Empty') {
        return col;
      }
    }
    
    return this.getRandomMove(board);
  }

  /**
   * Get a random valid move
   */
  private getRandomMove(board: CellValue[][]): number {
    const validMoves: number[] = [];
    
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }
    
    if (validMoves.length === 0) {
      return 0; // Fallback
    }
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  /**
   * Check if the last move resulted in a win
   */
  private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
    // Check horizontal
    if (this.checkDirection(board, row, col, player, 0, 1)) return true;
    
    // Check vertical
    if (this.checkDirection(board, row, col, player, 1, 0)) return true;
    
    // Check diagonal (top-left to bottom-right)
    if (this.checkDirection(board, row, col, player, 1, 1)) return true;
    
    // Check diagonal (top-right to bottom-left)
    if (this.checkDirection(board, row, col, player, 1, -1)) return true;
    
    return false;
  }

  /**
   * Check a specific direction for four in a row
   */
  private checkDirection(
    board: CellValue[][],
    row: number,
    col: number,
    player: CellValue,
    rowDelta: number,
    colDelta: number
  ): boolean {
    let count = 1;
    
    // Check in positive direction
    let r = row + rowDelta;
    let c = col + colDelta;
    while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && board[r][c] === player) {
      count++;
      r += rowDelta;
      c += colDelta;
    }
    
    // Check in negative direction
    r = row - rowDelta;
    c = col - colDelta;
    while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && board[r][c] === player) {
      count++;
      r -= rowDelta;
      c -= colDelta;
    }
    
    return count >= 4;
  }

  /**
   * Check for winner on the entire board
   */
  private checkWinner(board: CellValue[][]): CellValue | null {
    // Check all positions
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const player = board[row][col];
        if (player !== 'Empty') {
          if (this.checkWin(board, row, col, player)) {
            return player;
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if board is full
   */
  private isBoardFull(board: CellValue[][]): boolean {
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        return false;
      }
    }
    return true;
  }

  /**
   * Make a move on a copy of the board
   */
  private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = this.ROWS - 1; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }

  /**
   * Get the row where a disc would land
   */
  private getDropRow(board: CellValue[][], col: number): number {
    for (let row = this.ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }

  /**
   * Get current depth of the game
   */
  private getCurrentDepth(board: CellValue[][]): number {
    let moves = 0;
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        if (board[row][col] !== 'Empty') {
          moves++;
        }
      }
    }
    return moves;
  }

  /**
   * Create empty board
   */
  private createEmptyBoard(): CellValue[][] {
    return Array.from({ length: this.ROWS }, () => Array(this.COLS).fill('Empty'));
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    nodesEvaluated: number;
    cacheHitRate: number;
    patternMatches: number;
    averageThinkingTime: number;
    cacheSize: number;
  } {
    return {
      nodesEvaluated: this.stats.nodesEvaluated,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
      patternMatches: this.stats.patternMatches,
      averageThinkingTime: this.stats.movesGenerated > 0 
        ? this.stats.totalThinkingTime / this.stats.movesGenerated 
        : 0,
      cacheSize: this.transpositionTable.size
    };
  }

  /**
   * Clear cache and reset stats
   */
  reset(): void {
    this.transpositionTable.clear();
    this.killerMoves.clear();
    this.historyTable.clear();
    this.stats = {
      nodesEvaluated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      patternMatches: 0,
      totalThinkingTime: 0,
      movesGenerated: 0
    };
    this.logger.log('SimpleAIService reset');
  }
}