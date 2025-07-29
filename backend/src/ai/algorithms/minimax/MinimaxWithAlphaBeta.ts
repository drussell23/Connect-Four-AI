/**
 * Minimax with Alpha-Beta Pruning implementation for Connect Four
 */

import { CellValue } from '../../connect4AI';

export interface MinimaxResult {
  move: number;
  score: number;
  nodesExplored: number;
}

export class MinimaxWithAlphaBeta {
  private nodesExplored: number = 0;
  
  getBestMove(board: CellValue[][], player: CellValue, depth: number): MinimaxResult {
    this.nodesExplored = 0;
    
    const validMoves = this.getValidMoves(board);
    if (validMoves.length === 0) {
      return { move: -1, score: 0, nodesExplored: 0 };
    }
    
    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    const alpha = -Infinity;
    const beta = Infinity;
    
    for (const move of validMoves) {
      const newBoard = this.makeMove(board, move, player);
      const score = this.minimax(
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
        bestMove = move;
      }
    }
    
    return {
      move: bestMove,
      score: bestScore,
      nodesExplored: this.nodesExplored
    };
  }
  
  private minimax(
    board: CellValue[][],
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number,
    currentPlayer: CellValue,
    originalPlayer: CellValue
  ): number {
    this.nodesExplored++;
    
    // Check terminal states
    const winner = this.checkWinner(board);
    if (winner === originalPlayer) return 1000 + depth;
    if (winner === (originalPlayer === 'Red' ? 'Yellow' : 'Red')) return -1000 - depth;
    if (this.isBoardFull(board)) return 0;
    if (depth === 0) return this.evaluateBoard(board, originalPlayer);
    
    const validMoves = this.getValidMoves(board);
    
    if (isMaximizing) {
      let maxScore = -Infinity;
      
      for (const move of validMoves) {
        const newBoard = this.makeMove(board, move, currentPlayer);
        const score = this.minimax(
          newBoard,
          depth - 1,
          false,
          alpha,
          beta,
          currentPlayer === 'Red' ? 'Yellow' : 'Red',
          originalPlayer
        );
        
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        
        if (beta <= alpha) {
          break; // Beta cutoff
        }
      }
      
      return maxScore;
    } else {
      let minScore = Infinity;
      
      for (const move of validMoves) {
        const newBoard = this.makeMove(board, move, currentPlayer);
        const score = this.minimax(
          newBoard,
          depth - 1,
          true,
          alpha,
          beta,
          currentPlayer === 'Red' ? 'Yellow' : 'Red',
          originalPlayer
        );
        
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        
        if (beta <= alpha) {
          break; // Alpha cutoff
        }
      }
      
      return minScore;
    }
  }
  
  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < board[0].length; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }
  
  private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = board.length - 1; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }
  
  private checkWinner(board: CellValue[][]): CellValue | null {
    const rows = board.length;
    const cols = board[0].length;
    
    // Check horizontal
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        const player = board[r][c];
        if (player !== 'Empty' &&
            board[r][c + 1] === player &&
            board[r][c + 2] === player &&
            board[r][c + 3] === player) {
          return player;
        }
      }
    }
    
    // Check vertical
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 0; c < cols; c++) {
        const player = board[r][c];
        if (player !== 'Empty' &&
            board[r + 1][c] === player &&
            board[r + 2][c] === player &&
            board[r + 3][c] === player) {
          return player;
        }
      }
    }
    
    // Check diagonal (down-right)
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        const player = board[r][c];
        if (player !== 'Empty' &&
            board[r + 1][c + 1] === player &&
            board[r + 2][c + 2] === player &&
            board[r + 3][c + 3] === player) {
          return player;
        }
      }
    }
    
    // Check diagonal (down-left)
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 3; c < cols; c++) {
        const player = board[r][c];
        if (player !== 'Empty' &&
            board[r + 1][c - 1] === player &&
            board[r + 2][c - 2] === player &&
            board[r + 3][c - 3] === player) {
          return player;
        }
      }
    }
    
    return null;
  }
  
  private isBoardFull(board: CellValue[][]): boolean {
    return board[0].every(cell => cell !== 'Empty');
  }
  
  private evaluateBoard(board: CellValue[][], player: CellValue): number {
    let score = 0;
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Center column preference
    const centerCol = 3;
    for (let row = 0; row < board.length; row++) {
      if (board[row][centerCol] === player) score += 3;
      if (board[row][centerCol] === opponent) score -= 3;
    }
    
    // Check all possible 4-piece windows
    score += this.evaluateWindows(board, player);
    
    return score;
  }
  
  private evaluateWindows(board: CellValue[][], player: CellValue): number {
    let score = 0;
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Horizontal windows
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c <= board[0].length - 4; c++) {
        const window = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
        score += this.evaluateWindow(window, player, opponent);
      }
    }
    
    // Vertical windows
    for (let r = 0; r <= board.length - 4; r++) {
      for (let c = 0; c < board[0].length; c++) {
        const window = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
        score += this.evaluateWindow(window, player, opponent);
      }
    }
    
    // Diagonal windows
    for (let r = 0; r <= board.length - 4; r++) {
      for (let c = 0; c <= board[0].length - 4; c++) {
        const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
        score += this.evaluateWindow(window, player, opponent);
      }
    }
    
    for (let r = 0; r <= board.length - 4; r++) {
      for (let c = 3; c < board[0].length; c++) {
        const window = [board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]];
        score += this.evaluateWindow(window, player, opponent);
      }
    }
    
    return score;
  }
  
  private evaluateWindow(window: CellValue[], player: CellValue, opponent: CellValue): number {
    const playerCount = window.filter(cell => cell === player).length;
    const opponentCount = window.filter(cell => cell === opponent).length;
    const emptyCount = window.filter(cell => cell === 'Empty').length;
    
    if (playerCount === 3 && emptyCount === 1) return 50;
    if (playerCount === 2 && emptyCount === 2) return 10;
    if (playerCount === 1 && emptyCount === 3) return 1;
    
    if (opponentCount === 3 && emptyCount === 1) return -50;
    if (opponentCount === 2 && emptyCount === 2) return -10;
    if (opponentCount === 1 && emptyCount === 3) return -1;
    
    return 0;
  }
}