/**
 * 🛡️ Defensive AI Mode
 * 
 * Simplified AI strategy that preserves gameplay
 * while minimizing computational load
 */

import { Logger } from '@nestjs/common';
import { CellValue } from '../connect4AI';

export interface DefensiveMoveResult {
  move: number;
  strategy: 'block_win' | 'prevent_loss' | 'center_control' | 'safe_move';
  confidence: number;
  computeTimeMs: number;
}

export class DefensiveAI {
  private readonly logger = new Logger('DefensiveAI');
  private readonly ROWS = 6;
  private readonly COLS = 7;
  
  // Precomputed patterns for fast checking
  private readonly winPatterns = this.precomputeWinPatterns();

  /**
   * Get best defensive move
   */
  getBestMove(
    board: CellValue[][],
    player: 'Red' | 'Yellow' = 'Red',
    maxDepth: number = 1
  ): DefensiveMoveResult {
    const startTime = Date.now();
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Priority 1: Block immediate opponent wins
    const blockMove = this.findWinningMove(board, opponent);
    if (blockMove !== -1) {
      return {
        move: blockMove,
        strategy: 'block_win',
        confidence: 1.0,
        computeTimeMs: Date.now() - startTime
      };
    }
    
    // Priority 2: Take winning move if available
    const winMove = this.findWinningMove(board, player);
    if (winMove !== -1) {
      return {
        move: winMove,
        strategy: 'prevent_loss',
        confidence: 1.0,
        computeTimeMs: Date.now() - startTime
      };
    }
    
    // Priority 3: Control center and prevent future threats
    const validMoves = this.getValidMoves(board);
    const evaluatedMoves = this.evaluateDefensiveMoves(board, validMoves, player, maxDepth);
    
    // Sort by score
    evaluatedMoves.sort((a, b) => b.score - a.score);
    
    const bestMove = evaluatedMoves[0];
    return {
      move: bestMove.col,
      strategy: bestMove.score > 50 ? 'center_control' : 'safe_move',
      confidence: Math.min(bestMove.score / 100, 1.0),
      computeTimeMs: Date.now() - startTime
    };
  }

  /**
   * Find winning move for player
   */
  private findWinningMove(board: CellValue[][], player: 'Red' | 'Yellow'): number {
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      const testBoard = this.makeMove(board, col, player);
      if (this.checkWinFast(testBoard, player)) {
        return col;
      }
    }
    
    return -1;
  }

  /**
   * Evaluate defensive moves
   */
  private evaluateDefensiveMoves(
    board: CellValue[][],
    moves: number[],
    player: 'Red' | 'Yellow',
    maxDepth: number
  ): { col: number; score: number }[] {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    return moves.map(col => {
      let score = 0;
      
      // Center column bonus
      score += (3 - Math.abs(col - 3)) * 10;
      
      // Height penalty (prefer lower moves)
      const row = this.getDropRow(board, col);
      score += (5 - row) * 5;
      
      // Check for creating threats
      const testBoard = this.makeMove(board, col, player);
      score += this.countThreats(testBoard, player) * 15;
      
      // Check for blocking opponent threats
      score += this.countThreats(board, opponent) * 20;
      
      // Simple lookahead if depth > 1
      if (maxDepth > 1) {
        const opponentMoves = this.getValidMoves(testBoard);
        let worstCase = 100;
        
        for (const oppCol of opponentMoves) {
          const oppBoard = this.makeMove(testBoard, oppCol, opponent);
          if (this.checkWinFast(oppBoard, opponent)) {
            worstCase = -100;
            break;
          }
        }
        
        score += worstCase * 0.5;
      }
      
      return { col, score };
    });
  }

  /**
   * Count potential threats (3 in a row with space for 4th)
   */
  private countThreats(board: CellValue[][], player: 'Red' | 'Yellow'): number {
    let threats = 0;
    
    // Simplified threat detection - check horizontal and vertical only
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        // Horizontal
        if (col <= 3) {
          const count = this.countInLine(
            board, row, col, 0, 1, player
          );
          if (count === 3) threats++;
        }
        
        // Vertical
        if (row <= 2) {
          const count = this.countInLine(
            board, row, col, 1, 0, player
          );
          if (count === 3) threats++;
        }
      }
    }
    
    return threats;
  }

  /**
   * Count pieces in a line
   */
  private countInLine(
    board: CellValue[][],
    row: number,
    col: number,
    dRow: number,
    dCol: number,
    player: 'Red' | 'Yellow'
  ): number {
    let count = 0;
    
    for (let i = 0; i < 4; i++) {
      const r = row + i * dRow;
      const c = col + i * dCol;
      
      if (board[r][c] === player) {
        count++;
      } else if (board[r][c] !== 'Empty') {
        return 0; // Blocked by opponent
      }
    }
    
    return count;
  }

  /**
   * Fast win check using precomputed patterns
   */
  private checkWinFast(board: CellValue[][], player: 'Red' | 'Yellow'): boolean {
    // Check each win pattern
    for (const pattern of this.winPatterns) {
      let matches = 0;
      
      for (const [row, col] of pattern) {
        if (board[row][col] === player) {
          matches++;
        } else {
          break;
        }
      }
      
      if (matches === 4) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Precompute all possible win patterns
   */
  private precomputeWinPatterns(): number[][][] {
    const patterns: number[][][] = [];
    
    // Horizontal
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col <= 3; col++) {
        patterns.push([
          [row, col],
          [row, col + 1],
          [row, col + 2],
          [row, col + 3]
        ]);
      }
    }
    
    // Vertical
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col < this.COLS; col++) {
        patterns.push([
          [row, col],
          [row + 1, col],
          [row + 2, col],
          [row + 3, col]
        ]);
      }
    }
    
    // Diagonal (down-right)
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 3; col++) {
        patterns.push([
          [row, col],
          [row + 1, col + 1],
          [row + 2, col + 2],
          [row + 3, col + 3]
        ]);
      }
    }
    
    // Diagonal (down-left)
    for (let row = 0; row <= 2; row++) {
      for (let col = 3; col < this.COLS; col++) {
        patterns.push([
          [row, col],
          [row + 1, col - 1],
          [row + 2, col - 2],
          [row + 3, col - 3]
        ]);
      }
    }
    
    return patterns;
  }

  /**
   * Get valid moves
   */
  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    
    for (let col = 0; col < this.COLS; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    
    return moves;
  }

  /**
   * Get row where piece would drop
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
   * Make a move on a copy of the board
   */
  private makeMove(
    board: CellValue[][],
    col: number,
    player: 'Red' | 'Yellow'
  ): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    const row = this.getDropRow(board, col);
    
    if (row !== -1) {
      newBoard[row][col] = player;
    }
    
    return newBoard;
  }

  /**
   * Get move explanation for UI
   */
  getMoveExplanation(result: DefensiveMoveResult): string {
    switch (result.strategy) {
      case 'block_win':
        return 'Blocking opponent win!';
      case 'prevent_loss':
        return 'Taking winning move!';
      case 'center_control':
        return 'Controlling center position';
      case 'safe_move':
        return 'Playing defensively';
      default:
        return 'Making move';
    }
  }
}

// Singleton instance
export const defensiveAI = new DefensiveAI();