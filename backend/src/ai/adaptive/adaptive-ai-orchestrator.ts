import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { PerformanceMonitor } from '../async/performance-monitor';
import { CellValue } from '../connect4AI';

export interface GameCriticality {
  score: number; // 0-1, where 1 is most critical
  factors: {
    winningThreat: number;
    losingThreat: number;
    strategicImportance: number;
    gamePhase: number;
    moveComplexity: number;
  };
  recommendedDepth: number;
  useAdvancedAI: boolean;
  timeAllocation: number; // milliseconds
}

export interface MoveAnalysis {
  column: number;
  confidence: number;
  criticalityScore: number;
  computationTime: number;
  servicesUsed: string[];
  explanation: string;
  alternativeMoves?: Array<{
    column: number;
    score: number;
    reason: string;
  }>;
}

@Injectable()
export class AdaptiveAIOrchestrator {
  private readonly logger = new Logger(AdaptiveAIOrchestrator.name);
  private readonly MIN_RESPONSE_TIME = 800; // Natural human-like minimum (0.8s)
  private readonly MAX_RESPONSE_TIME = 2500; // Maximum time for critical moves (2.5s)
  private gameHistory: Map<string, MoveAnalysis[]> = new Map();

  constructor(
    private readonly asyncOrchestrator: AsyncAIOrchestrator,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Intelligently compute the next move based on game criticality
   */
  async computeAdaptiveMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Analyze game criticality to determine computational resources
    const criticality = this.analyzeGameCriticality(board, player);
    
    this.logger.log(`[${gameId}] Game criticality: ${criticality.score.toFixed(2)}`);
    this.logger.debug(`[${gameId}] Criticality factors:`, criticality.factors);

    // Emit criticality analysis for frontend
    this.eventEmitter.emit('ai.criticality.analyzed', {
      gameId,
      criticality,
      timestamp: Date.now(),
    });

    let moveAnalysis: MoveAnalysis;

    if (criticality.score < 0.3) {
      // Low criticality: Use fast, simple evaluation
      moveAnalysis = await this.computeFastMove(gameId, board, player, criticality);
    } else if (criticality.score < 0.7) {
      // Medium criticality: Use balanced approach
      moveAnalysis = await this.computeBalancedMove(gameId, board, player, criticality, difficulty);
    } else {
      // High criticality: Use full computational power
      moveAnalysis = await this.computeDeepMove(gameId, board, player, criticality, difficulty);
    }

    // Ensure natural human-like response time
    const elapsed = Date.now() - startTime;
    // Add slight randomness for more natural feel (±200ms)
    const targetTime = this.MIN_RESPONSE_TIME + (Math.random() * 400 - 200);
    if (elapsed < targetTime) {
      await this.delay(targetTime - elapsed);
    }

    // Store move in history for learning
    this.updateGameHistory(gameId, moveAnalysis);

    // Emit move completion
    this.eventEmitter.emit('ai.move.computed', {
      gameId,
      moveAnalysis,
      actualTime: Date.now() - startTime,
    });

    return moveAnalysis;
  }

  /**
   * Analyze game criticality to determine resource allocation
   */
  private analyzeGameCriticality(board: CellValue[][], player: CellValue): GameCriticality {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Count total moves
    const totalMoves = board.flat().filter(cell => cell !== null).length;
    const gameProgress = totalMoves / 42; // 0 to 1
    
    // Analyze threats
    const winningThreat = this.detectWinningThreat(board, player);
    const losingThreat = this.detectLosingThreat(board, opponent);
    
    // Analyze strategic importance
    const strategicImportance = this.evaluateStrategicImportance(board, totalMoves);
    
    // Determine game phase factor
    const gamePhase = this.getGamePhaseFactor(totalMoves);
    
    // Calculate move complexity
    const moveComplexity = this.calculateMoveComplexity(board);
    
    // Calculate overall criticality score
    const criticalityScore = Math.min(1, 
      winningThreat * 0.35 +
      losingThreat * 0.35 +
      strategicImportance * 0.15 +
      gamePhase * 0.10 +
      moveComplexity * 0.05
    );
    
    // Determine computational parameters
    const recommendedDepth = this.getRecommendedDepth(criticalityScore, totalMoves);
    const useAdvancedAI = criticalityScore > 0.5 || winningThreat > 0.8 || losingThreat > 0.8;
    const timeAllocation = this.calculateTimeAllocation(criticalityScore);
    
    return {
      score: criticalityScore,
      factors: {
        winningThreat,
        losingThreat,
        strategicImportance,
        gamePhase,
        moveComplexity,
      },
      recommendedDepth,
      useAdvancedAI,
      timeAllocation,
    };
  }

  /**
   * Detect immediate winning opportunities
   */
  private detectWinningThreat(board: CellValue[][], player: CellValue): number {
    let maxThreat = 0;
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== null) continue;
      
      // Simulate move
      const row = this.getNextRow(board, col);
      if (row === -1) continue;
      
      board[row][col] = player;
      const isWin = this.checkWin(board, row, col, player);
      board[row][col] = null;
      
      if (isWin) return 1.0; // Immediate win available
      
      // Check for multiple win setups
      const threat = this.evaluatePositionThreat(board, row, col, player);
      maxThreat = Math.max(maxThreat, threat);
    }
    
    return maxThreat;
  }

  /**
   * Detect opponent's winning threats
   */
  private detectLosingThreat(board: CellValue[][], opponent: CellValue): number {
    let maxThreat = 0;
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== null) continue;
      
      const row = this.getNextRow(board, col);
      if (row === -1) continue;
      
      board[row][col] = opponent;
      const isWin = this.checkWin(board, row, col, opponent);
      board[row][col] = null;
      
      if (isWin) return 1.0; // Must block immediate win
      
      const threat = this.evaluatePositionThreat(board, row, col, opponent);
      maxThreat = Math.max(maxThreat, threat);
    }
    
    return maxThreat;
  }

  /**
   * Fast move computation for low-criticality situations
   */
  private async computeFastMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Simple heuristic evaluation
    let bestColumn = 3; // Default center
    let bestScore = -Infinity;
    
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      const score = this.quickEvaluate(board, col, player);
      if (score > bestScore) {
        bestScore = score;
        bestColumn = col;
      }
    }
    
    return {
      column: bestColumn,
      confidence: 0.7 + (criticality.score * 0.1),
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: ['heuristic'],
      explanation: 'Quick strategic move based on position evaluation',
    };
  }

  /**
   * Balanced move computation for medium-criticality situations
   */
  private async computeBalancedMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    difficulty: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Use async orchestrator with limited depth
    const result = await this.asyncOrchestrator.getAIMove({
      gameId,
      board,
      player,
      difficulty,
      timeLimit: criticality.timeAllocation,
    });
    
    // Add alternative moves analysis
    const alternatives = await this.analyzeAlternatives(board, player, result.move);
    
    return {
      column: result.move,
      confidence: result.confidence || 0.85,
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: ['async_orchestrator', 'minimax', 'heuristic'],
      explanation: result.explanation || 'Balanced strategic analysis',
      alternativeMoves: alternatives,
    };
  }

  /**
   * Deep move computation for high-criticality situations
   */
  private async computeDeepMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    difficulty: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Stream real-time analysis
    const analysisStream = this.asyncOrchestrator.streamAnalysis(
      {
        gameId,
        board,
        player,
        difficulty,
        timeLimit: criticality.timeAllocation,
      },
      {
        includeVariations: true,
        maxDepth: criticality.recommendedDepth,
        updateInterval: 100,
      }
    );
    
    let bestMove = { column: 3, confidence: 0.5 };
    const servicesUsed = new Set<string>();
    
    // Process stream updates
    for await (const update of analysisStream) {
      switch (update.type) {
        case 'progress':
          servicesUsed.add(update.data.strategy);
          this.eventEmitter.emit('ai.analysis.progress', {
            gameId,
            ...update.data,
          });
          break;
          
        case 'move':
          if (update.data.confidence > bestMove.confidence) {
            bestMove = {
              column: update.data.move,
              confidence: update.data.confidence
            };
          }
          break;
          
        case 'variation':
          this.eventEmitter.emit('ai.variation.found', {
            gameId,
            ...update.data,
          });
          break;
      }
    }
    
    // Final deep analysis if time permits
    if (Date.now() - startTime < criticality.timeAllocation * 0.8) {
      const deepResult = await this.performDeepAnalysis(board, player, criticality);
      if (deepResult.confidence > bestMove.confidence) {
        bestMove = deepResult;
        servicesUsed.add('deep_analysis');
      }
    }
    
    return {
      column: bestMove.column,
      confidence: bestMove.confidence,
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: Array.from(servicesUsed),
      explanation: `Critical move computed with ${servicesUsed.size} AI services`,
    };
  }

  /**
   * Helper methods
   */
  private getNextRow(board: CellValue[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === null) return row;
    }
    return -1;
  }

  private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }

  private evaluatePositionThreat(board: CellValue[][], row: number, col: number, player: CellValue): number {
    // Evaluate how threatening a position is (0-1)
    let threatScore = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let count = 0;
      let openEnds = 0;
      
      // Count in both directions
      for (const mult of [-1, 1]) {
        let r = row + dr * mult;
        let c = col + dc * mult;
        
        while (r >= 0 && r < 6 && c >= 0 && c < 7) {
          if (board[r][c] === player) {
            count++;
          } else if (board[r][c] === null) {
            openEnds++;
            break;
          } else {
            break;
          }
          r += dr * mult;
          c += dc * mult;
        }
      }
      
      // Higher threat for more pieces with open ends
      if (count >= 2 && openEnds > 0) {
        threatScore = Math.max(threatScore, (count + openEnds) / 6);
      }
    }
    
    return Math.min(threatScore, 0.9);
  }

  private evaluateStrategicImportance(board: CellValue[][], totalMoves: number): number {
    // Center control importance
    let centerControl = 0;
    const centerCols = [2, 3, 4];
    
    for (const col of centerCols) {
      for (let row = 0; row < 6; row++) {
        if (board[row][col] !== null) {
          centerControl += (6 - row) / 6; // Higher rows are more valuable
        }
      }
    }
    
    // Normalize
    return Math.min(centerControl / 9, 1); // Max 9 center pieces
  }

  private getGamePhaseFactor(totalMoves: number): number {
    if (totalMoves < 8) return 0.3; // Opening
    if (totalMoves < 20) return 0.6; // Middle game
    if (totalMoves < 35) return 0.8; // Late game
    return 1.0; // Endgame
  }

  private calculateMoveComplexity(board: CellValue[][]): number {
    const validMoves = this.getValidMoves(board);
    const complexity = validMoves.length / 7; // More options = more complex
    
    // Add pattern complexity
    let patterns = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== null) {
          patterns += this.countAdjacentPieces(board, row, col) / 8;
        }
      }
    }
    
    return Math.min((complexity + patterns) / 2, 1);
  }

  private countAdjacentPieces(board: CellValue[][], row: number, col: number): number {
    let count = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    
    for (const [dr, dc] of directions) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] !== null) {
        count++;
      }
    }
    
    return count;
  }

  private getRecommendedDepth(criticalityScore: number, totalMoves: number): number {
    const baseDepth = 4;
    const criticalityBonus = Math.floor(criticalityScore * 4);
    const moveBonus = totalMoves > 20 ? 2 : 0;
    
    return Math.min(baseDepth + criticalityBonus + moveBonus, 10);
  }

  private calculateTimeAllocation(criticalityScore: number): number {
    // Scale from natural human speed to slightly longer for critical moves
    const minTime = 1000; // 1 second for low criticality
    const maxTime = this.MAX_RESPONSE_TIME;
    
    return Math.floor(minTime + (maxTime - minTime) * criticalityScore);
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === null) moves.push(col);
    }
    return moves;
  }

  private quickEvaluate(board: CellValue[][], col: number, player: CellValue): number {
    const row = this.getNextRow(board, col);
    if (row === -1) return -Infinity;
    
    // Check for immediate win
    board[row][col] = player;
    const isWin = this.checkWin(board, row, col, player);
    board[row][col] = null;
    
    if (isWin) return 1000;
    
    // Check for blocking opponent win
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    board[row][col] = opponent;
    const isBlock = this.checkWin(board, row, col, opponent);
    board[row][col] = null;
    
    if (isBlock) return 900;
    
    // Prefer center columns
    const centerScore = (3 - Math.abs(col - 3)) * 10;
    
    // Height penalty
    const heightPenalty = row * 2;
    
    return centerScore - heightPenalty + Math.random() * 10;
  }

  private async analyzeAlternatives(
    board: CellValue[][],
    player: CellValue,
    selectedColumn: number,
  ): Promise<MoveAnalysis['alternativeMoves']> {
    const alternatives: MoveAnalysis['alternativeMoves'] = [];
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      if (col === selectedColumn) continue;
      
      const score = this.quickEvaluate(board, col, player);
      alternatives.push({
        column: col,
        score: score / 1000, // Normalize
        reason: this.getMoveReason(board, col, player),
      });
    }
    
    // Sort by score and take top 3
    return alternatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private getMoveReason(board: CellValue[][], col: number, player: CellValue): string {
    const row = this.getNextRow(board, col);
    if (row === -1) return 'Invalid move';
    
    // Check various conditions
    board[row][col] = player;
    const isWin = this.checkWin(board, row, col, player);
    board[row][col] = null;
    
    if (isWin) return 'Winning move';
    
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    board[row][col] = opponent;
    const isBlock = this.checkWin(board, row, col, opponent);
    board[row][col] = null;
    
    if (isBlock) return 'Blocks opponent win';
    
    if (col >= 2 && col <= 4) return 'Center control';
    if (row >= 4) return 'Bottom position';
    
    return 'Strategic position';
  }

  private async performDeepAnalysis(
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
  ): Promise<{ column: number; confidence: number }> {
    // Placeholder for deep neural network or ML-based analysis
    // In production, this would call your ML service
    const validMoves = this.getValidMoves(board);
    const scores = new Map<number, number>();
    
    for (const col of validMoves) {
      const score = this.quickEvaluate(board, col, player) + Math.random() * 50;
      scores.set(col, score);
    }
    
    const bestCol = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
      column: bestCol,
      confidence: 0.9 + (criticality.score * 0.1),
    };
  }

  private updateGameHistory(gameId: string, move: MoveAnalysis): void {
    if (!this.gameHistory.has(gameId)) {
      this.gameHistory.set(gameId, []);
    }
    
    const history = this.gameHistory.get(gameId)!;
    history.push(move);
    
    // Keep only last 50 moves per game
    if (history.length > 50) {
      history.shift();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get game insights based on history
   */
  getGameInsights(gameId: string): any {
    const history = this.gameHistory.get(gameId) || [];
    
    if (history.length === 0) return null;
    
    const avgCriticality = history.reduce((sum, m) => sum + m.criticalityScore, 0) / history.length;
    const avgConfidence = history.reduce((sum, m) => sum + m.confidence, 0) / history.length;
    const avgComputationTime = history.reduce((sum, m) => sum + m.computationTime, 0) / history.length;
    
    const servicesUsed = new Set<string>();
    history.forEach(m => m.servicesUsed.forEach(s => servicesUsed.add(s)));
    
    return {
      movesAnalyzed: history.length,
      averageCriticality: avgCriticality,
      averageConfidence: avgConfidence,
      averageComputationTime: Math.round(avgComputationTime),
      uniqueServicesUsed: Array.from(servicesUsed),
      criticalMoves: history.filter(m => m.criticalityScore > 0.7).length,
    };
  }
}