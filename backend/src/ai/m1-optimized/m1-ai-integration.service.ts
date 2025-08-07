/**
 * 🎯 M1 AI Integration Service
 * 
 * Integrates all M1 optimization phases with the main AI system
 * Provides a unified interface for memory-aware AI operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs';
import { M1OptimizedAIService } from './m1-optimized-ai.module';
import { PythonMLOffloadService } from './python-ml-offload.service';
import { LightweightInferenceService } from './lightweight-inference.service';
import { DynamicMemoryMonitor, MemoryPressureLevel } from './dynamic-memory-monitor';
import { TensorOps } from '../shared/tensor-ops';
import { CellValue } from '../connect4AI';

export interface AIInferenceOptions {
  useOffload?: boolean;
  forceLightweight?: boolean;
  timeoutMs?: number;
  modelType?: 'dqn' | 'alphazero' | 'hybrid';
}

export interface AIInferenceResult {
  move: number;
  confidence: number;
  inferenceTimeMs: number;
  method: 'normal' | 'lightweight' | 'offloaded';
  device?: string;
  memoryPressure: MemoryPressureLevel;
}

@Injectable()
export class M1AIIntegrationService {
  private readonly logger = new Logger('M1AIIntegration');
  private currentMemoryPressure: MemoryPressureLevel = MemoryPressureLevel.NORMAL;
  private offloadEnabled = true;
  private lightweightEnabled = false;

  constructor(
    private readonly m1AIService: M1OptimizedAIService,
    private readonly pythonOffload: PythonMLOffloadService,
    private readonly lightweightInference: LightweightInferenceService,
    private readonly memoryMonitor: DynamicMemoryMonitor,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.setupEventListeners();
  }

  /**
   * Main inference method with automatic optimization selection
   */
  async getBestMove(
    board: CellValue[][],
    options: AIInferenceOptions = {}
  ): Promise<AIInferenceResult> {
    const startTime = Date.now();
    const memoryState = this.memoryMonitor.getCurrentState();
    this.currentMemoryPressure = memoryState.level;

    let move: number;
    let confidence = 1.0;
    let method: 'normal' | 'lightweight' | 'offloaded' = 'normal';
    let device: string | undefined;

    try {
      // Force lightweight mode if requested or memory critical
      if (options.forceLightweight || this.lightweightEnabled || 
          memoryState.level === MemoryPressureLevel.CRITICAL) {
        
        this.logger.debug('Using lightweight inference');
        move = await this.lightweightInference.getBestMove(board);
        method = 'lightweight';
        
      } 
      // Try Python offload if enabled and beneficial
      else if (this.shouldUseOffload(memoryState, options)) {
        
        this.logger.debug('Attempting Python ML offload');
        // Convert board to number array for Python service
        const numericBoard = this.boardToNumeric(board);
        const offloadResult = await this.pythonOffload.performInference(
          numericBoard,
          async () => this.performNormalInference(board, options)
        );
        
        move = offloadResult.move;
        method = offloadResult.offloaded ? 'offloaded' : 'normal';
        device = offloadResult.device;
        
      }
      // Normal inference with TensorFlow.js
      else {
        move = await this.performNormalInference(board, options);
        method = 'normal';
      }

      const inferenceTimeMs = Date.now() - startTime;

      // Log performance metrics
      this.eventEmitter.emit('ai.inference.complete', {
        method,
        inferenceTimeMs,
        memoryPressure: memoryState.level,
        device
      });

      return {
        move,
        confidence,
        inferenceTimeMs,
        method,
        device,
        memoryPressure: memoryState.level
      };

    } catch (error) {
      this.logger.error('AI inference failed:', error);
      
      // Fallback to lightweight mode on error
      if (method !== 'lightweight') {
        this.logger.warn('Falling back to lightweight inference');
        move = await this.lightweightInference.getBestMove(board);
        method = 'lightweight';
      } else {
        // Last resort: center column preference
        move = this.getEmergencyMove(board);
      }

      return {
        move,
        confidence: 0.5,
        inferenceTimeMs: Date.now() - startTime,
        method,
        memoryPressure: memoryState.level
      };
    }
  }

  /**
   * Perform normal TensorFlow.js inference
   */
  private async performNormalInference(
    board: CellValue[][],
    options: AIInferenceOptions
  ): Promise<number> {
    // Use prediction cache if available
    const boardKey = this.getBoardKey(board);
    
    const predictions = await this.m1AIService.getPrediction(
      boardKey,
      async () => {
        // Simplified inference - replace with actual AI model call
        const validMoves = this.getValidMoves(board);
        
        // For now, return move scores for each column
        // In practice, this would call your DQN/AlphaZero models
        const scores = new Array(7).fill(0);
        validMoves.forEach(move => {
          scores[move] = Math.random();
        });
        return scores;
      }
    );
    
    // Extract best valid move from predictions
    const validMoves = this.getValidMoves(board);
    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    
    for (const move of validMoves) {
      if (predictions[move] > bestScore) {
        bestScore = predictions[move];
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  /**
   * Determine if we should use Python offload
   */
  private shouldUseOffload(
    memoryState: any,
    options: AIInferenceOptions
  ): boolean {
    // Always offload if explicitly requested
    if (options.useOffload) return true;
    
    // Don't offload if disabled
    if (!this.offloadEnabled) return false;
    
    // Offload based on memory pressure
    if (memoryState.level === MemoryPressureLevel.HIGH) return true;
    if (memoryState.heapUsagePercent > 75) return true;
    
    // Offload for complex models
    if (options.modelType === 'alphazero' || options.modelType === 'hybrid') {
      return true;
    }
    
    return false;
  }

  /**
   * Get emergency move when all else fails
   */
  private getEmergencyMove(board: CellValue[][]): number {
    const validMoves = this.getValidMoves(board);
    
    // Prefer center columns
    const centerPreference = [3, 2, 4, 1, 5, 0, 6];
    
    for (const col of centerPreference) {
      if (validMoves.includes(col)) {
        return col;
      }
    }
    
    return validMoves[0] || 3;
  }

  /**
   * Get valid moves from board
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
   * Get board key for caching
   */
  private getBoardKey(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Empty' ? '0' : cell === 'Red' ? '1' : '2'
    ).join('');
  }

  /**
   * Convert board to numeric representation
   */
  private boardToNumeric(board: CellValue[][]): number[][] {
    return board.map(row => 
      row.map(cell => 
        cell === 'Empty' ? 0 : cell === 'Red' ? 1 : 2
      )
    );
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Memory pressure events
    this.eventEmitter.on('memory.state.changed', (state) => {
      this.currentMemoryPressure = state.level;
    });

    // Lightweight mode events
    this.eventEmitter.on('inference.lightweight.enable', () => {
      this.lightweightEnabled = true;
    });

    this.eventEmitter.on('inference.lightweight.disable', () => {
      this.lightweightEnabled = false;
    });

    // Offload control events
    this.eventEmitter.on('ml.offload.disable', () => {
      this.offloadEnabled = false;
    });

    this.eventEmitter.on('ml.offload.enable', () => {
      this.offloadEnabled = true;
    });
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    const offloadStats = this.pythonOffload.getStatistics();
    const lightweightStats = this.lightweightInference.getStatus();
    const memoryStats = this.memoryMonitor.getStatistics();

    return {
      currentMethod: this.lightweightEnabled ? 'lightweight' : 
                     (this.offloadEnabled && this.currentMemoryPressure !== MemoryPressureLevel.NORMAL) ? 
                     'offloaded' : 'normal',
      memoryPressure: this.currentMemoryPressure,
      offload: offloadStats,
      lightweight: lightweightStats,
      memory: memoryStats,
      recommendations: this.getOptimizationRecommendations()
    };
  }

  /**
   * Get optimization recommendations
   */
  private getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.currentMemoryPressure === MemoryPressureLevel.HIGH) {
      recommendations.push('Consider enabling Python ML offload for better performance');
    }

    if (!this.offloadEnabled && this.pythonOffload.getStatistics().capabilities?.hasMPS) {
      recommendations.push('Metal Performance Shaders available - enable offload for GPU acceleration');
    }

    if (this.lightweightEnabled) {
      recommendations.push('Lightweight mode active - performance may be reduced');
    }

    return recommendations;
  }
}