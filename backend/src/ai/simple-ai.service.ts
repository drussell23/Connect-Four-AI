import { Injectable, Logger } from '@nestjs/common';
import { CellValue } from './connect4AI';

/**
 * Simplified AI service that provides basic Connect4 AI functionality
 * without the complex initialization loops
 */
@Injectable()
export class SimpleAIService {
  private readonly logger = new Logger(SimpleAIService.name);
  private readonly ROWS = 6;
  private readonly COLS = 7;

  constructor() {
    this.logger.log('🎮 SimpleAIService initialized');
  }

  /**
   * Get the best move for the AI player
   */
  async getBestMove(board: CellValue[][], aiColor: CellValue, difficulty: string = 'medium'): Promise<number> {
    // First check for winning moves
    const winningMove = this.findWinningMove(board, aiColor);
    if (winningMove !== -1) {
      return winningMove;
    }

    // Check for blocking moves
    const opponentColor = aiColor === 'Red' ? 'Yellow' : 'Red';
    const blockingMove = this.findWinningMove(board, opponentColor);
    if (blockingMove !== -1) {
      return blockingMove;
    }

    // Use different strategies based on difficulty
    switch (difficulty) {
      case 'easy':
        return this.getRandomMove(board);
      case 'hard':
        return this.getStrategicMove(board, aiColor);
      case 'medium':
      default:
        // Mix of random and strategic
        return Math.random() < 0.3 ? this.getRandomMove(board) : this.getStrategicMove(board, aiColor);
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
    const columnPriority = [3, 2, 4, 1, 5, 0, 6]; // Center columns first
    
    for (const col of columnPriority) {
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
}