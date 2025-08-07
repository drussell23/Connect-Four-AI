/**
 * 🪶 Lightweight Inference Service
 * 
 * Ultra-efficient AI inference mode for critical memory situations
 * Maintains real-time responsiveness during high memory pressure
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../connect4AI';
import { TensorOps } from '../shared/tensor-ops';

export interface LightweightConfig {
  maxSearchDepth: number;
  maxBranchingFactor: number;
  disableNeuralNetwork: boolean;
  useCachedMovesOnly: boolean;
  simplifiedEvaluation: boolean;
}

@Injectable()
export class LightweightInferenceService {
  private readonly logger = new Logger('LightweightInference');
  private isLightweightMode = false;
  private normalModel: tf.LayersModel | null = null;
  private moveCache = new Map<string, number>();
  private readonly maxCacheSize = 1000;
  
  private lightweightConfig: LightweightConfig = {
    maxSearchDepth: 2,        // Reduced from 6+
    maxBranchingFactor: 3,    // Only consider top 3 moves
    disableNeuralNetwork: false,
    useCachedMovesOnly: false,
    simplifiedEvaluation: true
  };
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.logger.log('Lightweight Inference Service initialized');
  }
  
  /**
   * Enable lightweight mode
   */
  @OnEvent('inference.lightweight.enable')
  enableLightweightMode(payload: { reason: string }): void {
    if (this.isLightweightMode) return;
    
    this.logger.warn(`🪶 Enabling lightweight inference mode (reason: ${payload.reason})`);
    this.isLightweightMode = true;
    
    // Adjust configuration based on reason
    if (payload.reason === 'critical_memory_pressure') {
      this.lightweightConfig = {
        maxSearchDepth: 1,
        maxBranchingFactor: 2,
        disableNeuralNetwork: true,
        useCachedMovesOnly: false,
        simplifiedEvaluation: true
      };
    }
    
    // Clear large caches
    if (this.moveCache.size > this.maxCacheSize / 2) {
      this.moveCache.clear();
    }
    
    // Emit event for other services
    this.eventEmitter.emit('inference.mode.changed', {
      mode: 'lightweight',
      config: this.lightweightConfig
    });
  }
  
  /**
   * Disable lightweight mode
   */
  @OnEvent('inference.lightweight.disable')
  disableLightweightMode(payload: { reason: string }): void {
    if (!this.isLightweightMode) return;
    
    this.logger.log(`✅ Disabling lightweight mode (reason: ${payload.reason})`);
    this.isLightweightMode = false;
    
    // Restore normal configuration
    this.lightweightConfig = {
      maxSearchDepth: 4,
      maxBranchingFactor: 5,
      disableNeuralNetwork: false,
      useCachedMovesOnly: false,
      simplifiedEvaluation: false
    };
    
    // Emit event
    this.eventEmitter.emit('inference.mode.changed', {
      mode: 'normal',
      config: this.lightweightConfig
    });
  }
  
  /**
   * Get best move using lightweight inference
   */
  async getBestMove(board: CellValue[][]): Promise<number> {
    const boardKey = this.getBoardKey(board);
    
    // Check cache first
    if (this.moveCache.has(boardKey)) {
      const cachedMove = this.moveCache.get(boardKey)!;
      this.logger.debug(`Cache hit for board state`);
      return cachedMove;
    }
    
    // Use appropriate strategy based on mode
    let bestMove: number;
    
    if (this.isLightweightMode && this.lightweightConfig.disableNeuralNetwork) {
      bestMove = await this.getHeuristicMove(board);
    } else {
      bestMove = await this.getSimplifiedNeuralMove(board);
    }
    
    // Cache the result
    this.cacheMove(boardKey, bestMove);
    
    return bestMove;
  }
  
  /**
   * Get move using simple heuristics (no neural network)
   */
  private async getHeuristicMove(board: CellValue[][]): Promise<number> {
    const validMoves = this.getValidMoves(board);
    
    // Priority 1: Win if possible
    for (const col of validMoves) {
      if (this.isWinningMove(board, col, 'Red')) {
        return col;
      }
    }
    
    // Priority 2: Block opponent win
    for (const col of validMoves) {
      if (this.isWinningMove(board, col, 'Yellow')) {
        return col;
      }
    }
    
    // Priority 3: Center column preference
    const centerCols = [3, 2, 4, 1, 5, 0, 6];
    for (const col of centerCols) {
      if (validMoves.includes(col)) {
        // Simple lookahead if not in critical mode
        if (this.lightweightConfig.maxSearchDepth > 1) {
          const testBoard = this.makeMove(board, col, 'Red');
          const score = this.quickEvaluate(testBoard);
          if (score > 0) return col;
        } else {
          return col;
        }
      }
    }
    
    // Fallback: Random valid move
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
  
  /**
   * Get move using simplified neural network evaluation
   */
  private async getSimplifiedNeuralMove(board: CellValue[][]): Promise<number> {
    if (!this.normalModel) {
      // Fallback to heuristics if no model
      return this.getHeuristicMove(board);
    }
    
    return TensorOps.tidy('lightweight:neural', () => {
      const validMoves = this.getValidMoves(board);
      
      // Only evaluate top N moves based on heuristics
      const movesToEvaluate = this.lightweightConfig.maxBranchingFactor
        ? validMoves.slice(0, this.lightweightConfig.maxBranchingFactor)
        : validMoves;
      
      // Quick evaluation without full search
      const scores = movesToEvaluate.map(col => {
        const testBoard = this.makeMove(board, col, 'Red');
        return this.quickEvaluate(testBoard);
      });
      
      // Find best score
      let bestScore = -Infinity;
      let bestMove = movesToEvaluate[0];
      
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestMove = movesToEvaluate[i];
        }
      }
      
      return bestMove;
    });
  }
  
  /**
   * Quick position evaluation
   */
  private quickEvaluate(board: CellValue[][]): number {
    let score = 0;
    
    // Center control bonus
    const centerCol = 3;
    for (let row = 0; row < 6; row++) {
      if (board[row][centerCol] === 'Red') score += 3;
      else if (board[row][centerCol] === 'Yellow') score -= 3;
    }
    
    // Check for threats
    const redThreats = this.countThreats(board, 'Red');
    const yellowThreats = this.countThreats(board, 'Yellow');
    
    score += redThreats * 10;
    score -= yellowThreats * 10;
    
    return score;
  }
  
  /**
   * Count potential threats
   */
  private countThreats(board: CellValue[][], player: 'Red' | 'Yellow'): number {
    let threats = 0;
    
    // Simplified threat detection
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] === player) {
          // Check horizontal
          if (col <= 3) {
            let count = 0;
            for (let i = 0; i < 4; i++) {
              if (board[row][col + i] === player || board[row][col + i] === 'Empty') {
                count++;
              }
            }
            if (count === 4) threats++;
          }
          
          // Vertical check (simplified)
          if (row <= 2) {
            let count = 0;
            for (let i = 0; i < 4 && row + i < 6; i++) {
              if (board[row + i][col] === player || board[row + i][col] === 'Empty') {
                count++;
              }
            }
            if (count === 4) threats++;
          }
        }
      }
    }
    
    return threats;
  }
  
  /**
   * Get valid moves
   */
  private getValidMoves(board: CellValue[][]): number[] {
    const validMoves: number[] = [];
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }
    
    return validMoves;
  }
  
  /**
   * Check if a move wins the game
   */
  private isWinningMove(board: CellValue[][], col: number, player: 'Red' | 'Yellow'): boolean {
    const testBoard = this.makeMove(board, col, player);
    return this.checkWinner(testBoard) === player;
  }
  
  /**
   * Make a move on a copy of the board
   */
  private makeMove(board: CellValue[][], col: number, player: 'Red' | 'Yellow'): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }
  
  /**
   * Simple winner check
   */
  private checkWinner(board: CellValue[][]): 'Red' | 'Yellow' | null {
    // Check all possible winning positions
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        if (cell === 'Empty') continue;
        
        // Horizontal
        if (col <= 3) {
          if (board[row][col + 1] === cell &&
              board[row][col + 2] === cell &&
              board[row][col + 3] === cell) {
            return cell as 'Red' | 'Yellow';
          }
        }
        
        // Vertical
        if (row <= 2) {
          if (board[row + 1][col] === cell &&
              board[row + 2][col] === cell &&
              board[row + 3][col] === cell) {
            return cell as 'Red' | 'Yellow';
          }
        }
        
        // Diagonal (down-right)
        if (row <= 2 && col <= 3) {
          if (board[row + 1][col + 1] === cell &&
              board[row + 2][col + 2] === cell &&
              board[row + 3][col + 3] === cell) {
            return cell as 'Red' | 'Yellow';
          }
        }
        
        // Diagonal (down-left)
        if (row <= 2 && col >= 3) {
          if (board[row + 1][col - 1] === cell &&
              board[row + 2][col - 2] === cell &&
              board[row + 3][col - 3] === cell) {
            return cell as 'Red' | 'Yellow';
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get board key for caching
   */
  private getBoardKey(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Empty' ? '0' : cell === 'Red' ? '1' : '2'
    ).join('');
  }
  
  /**
   * Cache a move
   */
  private cacheMove(boardKey: string, move: number): void {
    // Limit cache size
    if (this.moveCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.moveCache.keys().next().value;
      this.moveCache.delete(firstKey);
    }
    
    this.moveCache.set(boardKey, move);
  }
  
  /**
   * Set the normal model for fallback
   */
  setModel(model: tf.LayersModel): void {
    this.normalModel = model;
  }
  
  /**
   * Get current mode and statistics
   */
  getStatus() {
    return {
      mode: this.isLightweightMode ? 'lightweight' : 'normal',
      config: this.lightweightConfig,
      cacheSize: this.moveCache.size,
      maxCacheSize: this.maxCacheSize,
      hasModel: this.normalModel !== null
    };
  }
  
  /**
   * Clear cache (for memory pressure)
   */
  @OnEvent('cache.clear.all')
  clearCache(): void {
    const previousSize = this.moveCache.size;
    this.moveCache.clear();
    this.logger.log(`Cleared move cache (freed ${previousSize} entries)`);
  }
}