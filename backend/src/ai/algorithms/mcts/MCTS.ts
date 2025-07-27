/**
 * Monte Carlo Tree Search implementation for Connect Four
 */

import { CellValue } from '../../connect4AI';

export interface MCTSConfig {
  simulationsPerMove: number;
  explorationConstant: number;
  maxDepth: number;
}

interface MCTSNode {
  state: CellValue[][];
  player: CellValue;
  move: number | null;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: number[];
}

export class MCTS {
  private config: MCTSConfig;
  private root: MCTSNode | null = null;

  constructor(config: MCTSConfig) {
    this.config = config;
  }

  async selectMove(board: CellValue[][], player: CellValue): Promise<number> {
    // Initialize root node
    this.root = this.createNode(board, player, null, null);
    
    const startTime = Date.now();
    let simulations = 0;
    
    // Run simulations
    while (simulations < this.config.simulationsPerMove && Date.now() - startTime < 5000) {
      await this.runSimulation();
      simulations++;
    }
    
    // Select best move based on visit count
    if (!this.root.children.length) {
      return Math.floor(Math.random() * 7);
    }
    
    const bestChild = this.root.children.reduce((best, child) => 
      child.visits > best.visits ? child : best
    );
    
    return bestChild.move || 0;
  }

  private async runSimulation(): Promise<void> {
    if (!this.root) return;
    
    // Selection phase
    let node = this.root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = this.selectChild(node);
    }
    
    // Expansion phase
    if (node.untriedMoves.length > 0) {
      const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
      const move = node.untriedMoves[moveIndex];
      node.untriedMoves.splice(moveIndex, 1);
      
      const newBoard = this.makeMove(node.state, move, node.player);
      const newPlayer = node.player === 'Red' ? 'Yellow' : 'Red';
      const child = this.createNode(newBoard, newPlayer, move, node);
      node.children.push(child);
      node = child;
    }
    
    // Simulation phase
    const result = await this.simulate(node.state, node.player);
    
    // Backpropagation phase
    while (node !== null) {
      node.visits++;
      if (result === node.player) {
        node.wins++;
      }
      node = node.parent!;
    }
  }

  private selectChild(node: MCTSNode): MCTSNode {
    const c = this.config.explorationConstant;
    const logParentVisits = Math.log(node.visits);
    
    return node.children.reduce((best, child) => {
      const exploitation = child.wins / child.visits;
      const exploration = c * Math.sqrt(logParentVisits / child.visits);
      const ucb = exploitation + exploration;
      
      const bestUcb = best.wins / best.visits + c * Math.sqrt(logParentVisits / best.visits);
      
      return ucb > bestUcb ? child : best;
    });
  }

  private createNode(
    state: CellValue[][],
    player: CellValue,
    move: number | null,
    parent: MCTSNode | null
  ): MCTSNode {
    return {
      state,
      player,
      move,
      parent,
      children: [],
      visits: 0,
      wins: 0,
      untriedMoves: this.getValidMoves(state)
    };
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

  private async simulate(board: CellValue[][], startPlayer: CellValue): Promise<CellValue | 'draw'> {
    let currentBoard = board.map(row => [...row]);
    let currentPlayer = startPlayer;
    let moves = 0;
    
    while (moves < 42) {
      const validMoves = this.getValidMoves(currentBoard);
      
      if (validMoves.length === 0) {
        return 'draw';
      }
      
      // Random playout
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      currentBoard = this.makeMove(currentBoard, move, currentPlayer);
      
      // Check for win
      if (this.checkWin(currentBoard, move, currentPlayer)) {
        return currentPlayer;
      }
      
      currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
      moves++;
    }
    
    return 'draw';
  }

  private checkWin(board: CellValue[][], lastCol: number, player: CellValue): boolean {
    // Find the row where the piece was placed
    let lastRow = -1;
    for (let row = 0; row < board.length; row++) {
      if (board[row][lastCol] === player) {
        lastRow = row;
        break;
      }
    }
    
    if (lastRow === -1) return false;
    
    // Check all four directions
    const directions = [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diagonal down-right
      [1, -1]  // diagonal down-left
    ];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = lastRow + dr;
      let c = lastCol + dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = lastRow - dr;
      c = lastCol - dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) {
        return true;
      }
    }
    
    return false;
  }

  getStats(move: number): { visits: number; winRate: number } | undefined {
    if (!this.root) return undefined;
    
    const child = this.root.children.find(c => c.move === move);
    if (!child) return undefined;
    
    return {
      visits: child.visits,
      winRate: child.visits > 0 ? child.wins / child.visits : 0
    };
  }
}