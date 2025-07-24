import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

interface MoveDecision {
  gameId: string;
  moveNumber: number;
  difficulty: number;
  board: CellValue[][];
  selectedMove: number;
  alternativeMoves: Array<{ column: number; score: number; reason: string }>;
  missedWins: number[];
  missedBlocks: number[];
  appliedPrinciples: string[];
  confidence: number;
  timestamp: number;
}

interface GameAnalysis {
  gameId: string;
  difficulty: number;
  totalMoves: number;
  missedWins: number;
  missedBlocks: number;
  unnecessaryLosses: number;
  averageConfidence: number;
  principlesApplied: Map<string, number>;
  suspiciousBehaviors: string[];
}

@Injectable()
export class AIPerformanceAnalyzer {
  private readonly logger = new Logger(AIPerformanceAnalyzer.name);
  private gameDecisions = new Map<string, MoveDecision[]>();
  private gameAnalyses = new Map<string, GameAnalysis>();
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Track AI move decisions
    this.eventEmitter.on('ai.move.computed', (data: any) => {
      this.recordMoveDecision(data);
    });
    
    // Track enhanced RL decisions
    this.eventEmitter.on('ai.enhanced_rl.applied', (data: any) => {
      this.recordEnhancedRLDecision(data);
    });
    
    // Track game endings
    this.eventEmitter.on('game.ended', (data: any) => {
      this.analyzeGamePerformance(data);
    });
  }
  
  private recordMoveDecision(data: any): void {
    const { gameId, moveAnalysis, board } = data;
    
    if (!moveAnalysis || !board) return;
    
    // Check for missed winning moves
    const missedWins = this.findMissedWins(board, 'Yellow');
    const missedBlocks = this.findMissedBlocks(board, 'Yellow');
    
    const decision: MoveDecision = {
      gameId,
      moveNumber: this.countMoves(board),
      difficulty: data.difficulty || 0,
      board,
      selectedMove: moveAnalysis.column,
      alternativeMoves: moveAnalysis.alternativeMoves || [],
      missedWins,
      missedBlocks,
      appliedPrinciples: [],
      confidence: moveAnalysis.confidence,
      timestamp: Date.now()
    };
    
    // Store decision
    if (!this.gameDecisions.has(gameId)) {
      this.gameDecisions.set(gameId, []);
    }
    this.gameDecisions.get(gameId)!.push(decision);
    
    // Log suspicious behavior
    if (missedWins.length > 0) {
      this.logger.warn(`[${gameId}] AI missed winning move(s) at column(s): ${missedWins.join(', ')}`);
      this.eventEmitter.emit('ai.suspicious.missed_win', {
        gameId,
        missedColumns: missedWins,
        selectedColumn: moveAnalysis.column,
        moveNumber: decision.moveNumber
      });
    }
    
    if (missedBlocks.length > 0 && missedWins.length === 0) {
      this.logger.warn(`[${gameId}] AI missed blocking move(s) at column(s): ${missedBlocks.join(', ')}`);
      this.eventEmitter.emit('ai.suspicious.missed_block', {
        gameId,
        missedColumns: missedBlocks,
        selectedColumn: moveAnalysis.column,
        moveNumber: decision.moveNumber
      });
    }
  }
  
  private recordEnhancedRLDecision(data: any): void {
    const { gameId, explanation } = data;
    const decisions = this.gameDecisions.get(gameId);
    
    if (!decisions || decisions.length === 0) return;
    
    const lastDecision = decisions[decisions.length - 1];
    
    // Extract applied principles from explanation
    if (explanation && explanation.constitutionalPrinciples) {
      lastDecision.appliedPrinciples = explanation.constitutionalPrinciples;
    }
  }
  
  private analyzeGamePerformance(data: any): void {
    const { gameId, winner, aiPlayer } = data;
    const decisions = this.gameDecisions.get(gameId) || [];
    
    if (decisions.length === 0) return;
    
    const analysis: GameAnalysis = {
      gameId,
      difficulty: decisions[0]?.difficulty || 0,
      totalMoves: decisions.length,
      missedWins: decisions.filter(d => d.missedWins.length > 0).length,
      missedBlocks: decisions.filter(d => d.missedBlocks.length > 0).length,
      unnecessaryLosses: 0,
      averageConfidence: decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length,
      principlesApplied: new Map(),
      suspiciousBehaviors: []
    };
    
    // Count principles applied
    decisions.forEach(decision => {
      decision.appliedPrinciples.forEach(principle => {
        analysis.principlesApplied.set(
          principle,
          (analysis.principlesApplied.get(principle) || 0) + 1
        );
      });
    });
    
    // Check if AI lost when it could have won
    if (winner !== aiPlayer && analysis.missedWins > 0) {
      analysis.unnecessaryLosses = 1;
      analysis.suspiciousBehaviors.push('Lost game despite having winning opportunities');
    }
    
    // Check for suspicious patterns
    if (analysis.missedWins > 2) {
      analysis.suspiciousBehaviors.push(`Missed ${analysis.missedWins} winning moves`);
    }
    
    if (analysis.missedBlocks > 3) {
      analysis.suspiciousBehaviors.push(`Missed ${analysis.missedBlocks} critical blocks`);
    }
    
    if (analysis.principlesApplied.has('avoid_trivial_wins') && analysis.unnecessaryLosses > 0) {
      analysis.suspiciousBehaviors.push('Applied "avoid_trivial_wins" and lost');
    }
    
    // Store analysis
    this.gameAnalyses.set(gameId, analysis);
    
    // Log results
    this.logger.log(`[${gameId}] Game Analysis:`);
    this.logger.log(`  Difficulty: ${analysis.difficulty}`);
    this.logger.log(`  Missed Wins: ${analysis.missedWins}`);
    this.logger.log(`  Missed Blocks: ${analysis.missedBlocks}`);
    this.logger.log(`  Average Confidence: ${analysis.averageConfidence.toFixed(2)}`);
    
    if (analysis.suspiciousBehaviors.length > 0) {
      this.logger.warn(`  Suspicious Behaviors: ${analysis.suspiciousBehaviors.join('; ')}`);
    }
    
    // Emit performance report
    this.eventEmitter.emit('ai.performance.analysis', analysis);
  }
  
  // Helper methods
  
  private findMissedWins(board: CellValue[][], player: CellValue): number[] {
    const missedWins: number[] = [];
    
    for (let col = 0; col < 7; col++) {
      if (this.isValidMove(board, col)) {
        // Simulate move
        const testBoard = this.makeMove(board, col, player);
        if (this.checkWin(testBoard, player)) {
          missedWins.push(col);
        }
      }
    }
    
    return missedWins;
  }
  
  private findMissedBlocks(board: CellValue[][], player: CellValue): number[] {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    const missedBlocks: number[] = [];
    
    for (let col = 0; col < 7; col++) {
      if (this.isValidMove(board, col)) {
        // Check if opponent would win with this move
        const testBoard = this.makeMove(board, col, opponent);
        if (this.checkWin(testBoard, opponent)) {
          missedBlocks.push(col);
        }
      }
    }
    
    return missedBlocks;
  }
  
  private isValidMove(board: CellValue[][], col: number): boolean {
    return col >= 0 && col < 7 && board[0][col] === null;
  }
  
  private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === null) {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }
  
  private checkWin(board: CellValue[][], player: CellValue): boolean {
    // Check horizontal wins
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        if (
          board[row][col] === player &&
          board[row][col + 1] === player &&
          board[row][col + 2] === player &&
          board[row][col + 3] === player
        ) {
          return true;
        }
      }
    }
    
    // Check vertical wins
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col] === player &&
          board[row + 2][col] === player &&
          board[row + 3][col] === player
        ) {
          return true;
        }
      }
    }
    
    // Check diagonal wins (top-left to bottom-right)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col + 1] === player &&
          board[row + 2][col + 2] === player &&
          board[row + 3][col + 3] === player
        ) {
          return true;
        }
      }
    }
    
    // Check diagonal wins (bottom-left to top-right)
    for (let row = 3; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        if (
          board[row][col] === player &&
          board[row - 1][col + 1] === player &&
          board[row - 2][col + 2] === player &&
          board[row - 3][col + 3] === player
        ) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  private countMoves(board: CellValue[][]): number {
    let count = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== null) {
          count++;
        }
      }
    }
    return count;
  }
  
  // Public API
  
  public getGameAnalysis(gameId: string): GameAnalysis | undefined {
    return this.gameAnalyses.get(gameId);
  }
  
  public getOverallPerformance(): {
    totalGames: number;
    averageMissedWins: number;
    averageMissedBlocks: number;
    suspiciousGames: number;
    principleUsage: Map<string, number>;
  } {
    const analyses = Array.from(this.gameAnalyses.values());
    
    if (analyses.length === 0) {
      return {
        totalGames: 0,
        averageMissedWins: 0,
        averageMissedBlocks: 0,
        suspiciousGames: 0,
        principleUsage: new Map()
      };
    }
    
    const totalGames = analyses.length;
    const totalMissedWins = analyses.reduce((sum, a) => sum + a.missedWins, 0);
    const totalMissedBlocks = analyses.reduce((sum, a) => sum + a.missedBlocks, 0);
    const suspiciousGames = analyses.filter(a => a.suspiciousBehaviors.length > 0).length;
    
    // Aggregate principle usage
    const principleUsage = new Map<string, number>();
    analyses.forEach(analysis => {
      analysis.principlesApplied.forEach((count, principle) => {
        principleUsage.set(principle, (principleUsage.get(principle) || 0) + count);
      });
    });
    
    return {
      totalGames,
      averageMissedWins: totalMissedWins / totalGames,
      averageMissedBlocks: totalMissedBlocks / totalGames,
      suspiciousGames,
      principleUsage
    };
  }
  
  public reset(): void {
    this.gameDecisions.clear();
    this.gameAnalyses.clear();
  }
}

export { MoveDecision, GameAnalysis };