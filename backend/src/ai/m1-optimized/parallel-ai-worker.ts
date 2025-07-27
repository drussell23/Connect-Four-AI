/**
 * Web Worker for parallel AI computation on M1
 * Utilizes all 8 cores for distributed AI processing
 */

import { parentPort, workerData } from 'worker_threads';
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { MCTS } from '../algorithms/mcts/MCTS';
import { MinimaxWithAlphaBeta } from '../algorithms/minimax/MinimaxWithAlphaBeta';

export interface WorkerTask {
  taskId: string;
  type: 'mcts' | 'minimax' | 'neural' | 'evaluate';
  board: CellValue[][];
  player: CellValue;
  config: any;
}

export interface WorkerResult {
  taskId: string;
  result: any;
  computeTime: number;
  error?: string;
}

class ParallelAIWorker {
  private workerId: number;
  private mcts: MCTS;
  private minimax: MinimaxWithAlphaBeta;

  constructor(workerId: number) {
    this.workerId = workerId;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize TensorFlow.js for this worker
    await tf.ready();
    
    // Initialize AI algorithms
    this.mcts = new MCTS({
      simulationsPerMove: 1000,
      explorationConstant: 1.41,
      maxDepth: 20
    });

    this.minimax = new MinimaxWithAlphaBeta();

    console.log(`Worker ${this.workerId} initialized with backend: ${tf.getBackend()}`);
  }

  async processTask(task: WorkerTask): Promise<WorkerResult> {
    const startTime = performance.now();
    
    try {
      let result: any;

      switch (task.type) {
        case 'mcts':
          result = await this.runMCTS(task.board, task.player, task.config);
          break;
          
        case 'minimax':
          result = await this.runMinimax(task.board, task.player, task.config);
          break;
          
        case 'neural':
          result = await this.runNeuralEvaluation(task.board, task.player, task.config);
          break;
          
        case 'evaluate':
          result = await this.evaluatePosition(task.board, task.player);
          break;
          
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      const computeTime = performance.now() - startTime;

      return {
        taskId: task.taskId,
        result,
        computeTime
      };
    } catch (error) {
      return {
        taskId: task.taskId,
        result: null,
        computeTime: performance.now() - startTime,
        error: error.message
      };
    }
  }

  private async runMCTS(
    board: CellValue[][],
    player: CellValue,
    config: any
  ): Promise<{ move: number; visits: number; winRate: number }> {
    const move = await this.mcts.selectMove(board, player);
    const stats = this.mcts.getStats(move);
    
    return {
      move,
      visits: stats?.visits || 0,
      winRate: stats?.winRate || 0
    };
  }

  private async runMinimax(
    board: CellValue[][],
    player: CellValue,
    config: any
  ): Promise<{ move: number; score: number; nodesExplored: number }> {
    const depth = config.depth || 7;
    const result = this.minimax.getBestMove(board, player, depth);
    
    return {
      move: result.move,
      score: result.score,
      nodesExplored: result.nodesExplored || 0
    };
  }

  private async runNeuralEvaluation(
    board: CellValue[][],
    player: CellValue,
    config: any
  ): Promise<{ policy: number[]; value: number }> {
    // Convert board to tensor
    const boardTensor = this.boardToTensor(board);
    
    // Run neural network inference
    // This would use a pre-loaded model in production
    const policy = new Array(7).fill(0).map(() => Math.random());
    const sum = policy.reduce((a, b) => a + b, 0);
    const normalizedPolicy = policy.map(p => p / sum);
    
    const value = Math.random() * 2 - 1; // [-1, 1]
    
    boardTensor.dispose();
    
    return {
      policy: normalizedPolicy,
      value
    };
  }

  private async evaluatePosition(
    board: CellValue[][],
    player: CellValue
  ): Promise<{ score: number; features: Record<string, number> }> {
    // Extract position features
    const features = {
      centerControl: this.evaluateCenterControl(board, player),
      connectivity: this.evaluateConnectivity(board, player),
      threats: this.evaluateThreats(board, player),
      mobility: this.evaluateMobility(board)
    };
    
    // Combine features into final score
    const score = 
      features.centerControl * 0.3 +
      features.connectivity * 0.4 +
      features.threats * 0.2 +
      features.mobility * 0.1;
    
    return { score, features };
  }

  private boardToTensor(board: CellValue[][]): tf.Tensor4D {
    const height = board.length;
    const width = board[0].length;
    const data = new Float32Array(height * width * 3);
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const idx = (r * width + c) * 3;
        const cell = board[r][c];
        
        data[idx] = cell === 'Red' ? 1 : 0;
        data[idx + 1] = cell === 'Yellow' ? 1 : 0;
        data[idx + 2] = cell === 'Empty' ? 1 : 0;
      }
    }
    
    return tf.tensor4d(data, [1, height, width, 3]);
  }

  private evaluateCenterControl(board: CellValue[][], player: CellValue): number {
    const centerCols = [2, 3, 4];
    let score = 0;
    
    for (let r = 0; r < board.length; r++) {
      for (const c of centerCols) {
        if (board[r][c] === player) {
          score += (5 - r) * 0.2; // Higher rows worth less
        }
      }
    }
    
    return score;
  }

  private evaluateConnectivity(board: CellValue[][], player: CellValue): number {
    // Simplified connectivity evaluation
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] === player) {
          for (const [dr, dc] of directions) {
            let length = 1;
            let nr = r + dr;
            let nc = c + dc;
            
            while (
              nr >= 0 && nr < board.length &&
              nc >= 0 && nc < board[0].length &&
              board[nr][nc] === player
            ) {
              length++;
              nr += dr;
              nc += dc;
            }
            
            score += Math.pow(length, 2) * 0.1;
          }
        }
      }
    }
    
    return score;
  }

  private evaluateThreats(board: CellValue[][], player: CellValue): number {
    // Count potential winning positions
    let threats = 0;
    
    for (let c = 0; c < board[0].length; c++) {
      for (let r = board.length - 1; r >= 0; r--) {
        if (board[r][c] === 'Empty') {
          // Simulate placing a piece
          board[r][c] = player;
          
          // Check if this creates a winning position
          if (this.checkWin(board, r, c, player)) {
            threats++;
          }
          
          // Restore board
          board[r][c] = 'Empty';
          break;
        }
      }
    }
    
    return threats;
  }

  private evaluateMobility(board: CellValue[][]): number {
    // Count available moves
    let moves = 0;
    
    for (let c = 0; c < board[0].length; c++) {
      if (board[0][c] === 'Empty') {
        moves++;
      }
    }
    
    return moves / board[0].length;
  }

  private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
    // Simplified win check
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr;
      let c = col + dc;
      while (
        r >= 0 && r < board.length &&
        c >= 0 && c < board[0].length &&
        board[r][c] === player
      ) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (
        r >= 0 && r < board.length &&
        c >= 0 && c < board[0].length &&
        board[r][c] === player
      ) {
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
}

// Worker thread entry point
if (parentPort) {
  const worker = new ParallelAIWorker(workerData.workerId);
  
  parentPort.on('message', async (task: WorkerTask) => {
    const result = await worker.processTask(task);
    parentPort!.postMessage(result);
  });
}