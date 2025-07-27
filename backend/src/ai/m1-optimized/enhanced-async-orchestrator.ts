/**
 * Enhanced Async AI Orchestrator with M1 Optimizations
 * Integrates WebGPU, parallel processing, and shared memory for maximum performance
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import { AsyncCacheManager } from '../async/cache-manager';
import { CircuitBreaker } from '../async/circuit-breaker';
import { RequestBatcher } from '../async/request-batcher';
import { DynamicStrategySelector, AIStrategy } from '../async/strategy-selector';
import { PerformanceMonitor } from '../async/performance-monitor';
import { PrecomputationEngine } from '../async/precomputation-engine';
import { OpeningBook } from '../opening-book/opening-book';
import { ParallelAIOrchestrator } from './parallel-ai-orchestrator';
import { WebGPUOptimizedCNN } from './webgpu-optimized-cnn';
import { TensorFlowM1Initializer } from './tensorflow-webgpu-init';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { AIRequest, AIResponse } from '../async/async-ai-orchestrator';

export interface M1OptimizedConfig {
  enableWebGPU: boolean;
  enableParallelProcessing: boolean;
  enableSharedMemory: boolean;
  enableNeuralAcceleration: boolean;
  maxParallelWorkers: number;
  preferredBackend: 'webgpu' | 'webgl' | 'cpu';
}

@Injectable()
export class EnhancedAsyncOrchestrator extends AsyncAIOrchestrator implements OnModuleInit, OnModuleDestroy {
  protected readonly enhancedLogger = new Logger(EnhancedAsyncOrchestrator.name);
  private readonly m1Config: M1OptimizedConfig;
  private parallelOrchestrator: ParallelAIOrchestrator;
  private webgpuCNN: WebGPUOptimizedCNN | null = null;
  private isM1Optimized: boolean = false;
  
  // Performance metrics
  private gpuUtilization: number = 0;
  private parallelEfficiency: number = 0;
  private lastOptimizationCheck: number = 0;

  constructor(
    eventEmitter: EventEmitter2,
    cacheManager: AsyncCacheManager,
    circuitBreaker: CircuitBreaker,
    requestBatcher: RequestBatcher,
    strategySelector: DynamicStrategySelector,
    performanceMonitor: PerformanceMonitor,
    precomputationEngine: PrecomputationEngine,
    @Optional() openingBook?: OpeningBook
  ) {
    super(
      eventEmitter,
      cacheManager,
      circuitBreaker,
      requestBatcher,
      strategySelector,
      performanceMonitor,
      precomputationEngine,
      openingBook
    );

    this.m1Config = {
      enableWebGPU: true,
      enableParallelProcessing: true,
      enableSharedMemory: true,
      enableNeuralAcceleration: true,
      maxParallelWorkers: 8, // M1 has 8 cores
      preferredBackend: 'webgpu'
    };

    this.parallelOrchestrator = new ParallelAIOrchestrator(eventEmitter);
  }

  async onModuleInit(): Promise<void> {
    await this.initializeM1Optimizations();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.webgpuCNN) {
      this.webgpuCNN.dispose();
    }
    await this.parallelOrchestrator.onModuleDestroy();
  }

  /**
   * Initialize M1-specific optimizations
   */
  private async initializeM1Optimizations(): Promise<void> {
    this.enhancedLogger.log('🚀 Initializing M1 optimizations...');

    try {
      // Initialize TensorFlow.js with WebGPU
      if (this.m1Config.enableWebGPU) {
        await TensorFlowM1Initializer.initialize({
          preferWebGPU: true,
          enableMemoryGrowth: true,
          powerPreference: 'high-performance',
          numThreads: 8,
          enableFloat16: true
        });

        const backendInfo = TensorFlowM1Initializer.getBackendInfo();
        this.enhancedLogger.log(`TensorFlow backend: ${backendInfo.backend}`);
        this.enhancedLogger.log(`Features: ${JSON.stringify(backendInfo.features)}`);
        
        this.isM1Optimized = backendInfo.backend === 'webgpu' || backendInfo.backend === 'webgl';
      }

      // Initialize WebGPU-optimized CNN
      if (this.m1Config.enableNeuralAcceleration && this.isM1Optimized) {
        this.webgpuCNN = new WebGPUOptimizedCNN({
          useFloat16: true,
          enableFusedOps: true,
          enableParallelExecution: true
        });
        
        await this.webgpuCNN.buildModel();
        await this.webgpuCNN.warmUp();
        
        this.enhancedLogger.log('✅ WebGPU-optimized CNN initialized');
      }

      // Initialize parallel processing
      if (this.m1Config.enableParallelProcessing) {
        await this.parallelOrchestrator.onModuleInit();
        this.enhancedLogger.log('✅ Parallel processing initialized');
      }

      this.enhancedLogger.log('✅ M1 optimizations complete');
    } catch (error) {
      this.enhancedLogger.error('Failed to initialize M1 optimizations:', error);
      this.isM1Optimized = false;
    }
  }

  /**
   * Enhanced AI move computation with M1 optimizations
   */
  async getAIMove(request: AIRequest): Promise<AIResponse> {
    const operationId = (this as any).performanceMonitor.startOperation('m1.enhanced.getMove', {
      gameId: request.gameId,
      difficulty: request.difficulty,
      m1Optimized: this.isM1Optimized
    });

    try {
      // Check if we should use M1 optimizations
      if (this.shouldUseM1Optimizations(request)) {
        return await this.getM1OptimizedMove(request);
      }

      // Fall back to standard processing
      return await super.getAIMove(request);
    } finally {
      (this as any).performanceMonitor.endOperation(operationId, 'completed');
    }
  }

  /**
   * M1-optimized move computation
   */
  private async getM1OptimizedMove(request: AIRequest): Promise<AIResponse> {
    const startTime = performance.now();

    // Use parallel processing for complex positions
    if (this.shouldUseParallelProcessing(request)) {
      const parallelResult = await this.parallelOrchestrator.runEnsemble(
        request.board,
        request.player,
        {
          timeLimit: request.timeLimit || 5000,
          difficulty: request.difficulty
        }
      );

      // Enhance with neural network if available
      let neuralEnhancement = null;
      if (this.webgpuCNN && this.m1Config.enableNeuralAcceleration) {
        neuralEnhancement = await this.webgpuCNN.predict(request.board);
      }

      return {
        move: parallelResult.bestMove,
        confidence: parallelResult.confidence,
        strategy: 'm1-parallel-ensemble' as AIStrategy,
        computeTime: performance.now() - startTime,
        cached: false,
        explanation: `M1-optimized ensemble decision with ${parallelResult.algorithmVotes.size} algorithms`,
        alternatives: this.generateAlternatives(parallelResult.algorithmVotes, neuralEnhancement)
      };
    }

    // Use WebGPU neural network for fast inference
    if (this.webgpuCNN && request.difficulty >= 15) {
      const prediction = await this.webgpuCNN.predict(request.board);
      const validMoves = this.getM1ValidMoves(request.board);
      
      // Apply valid move mask and select best move
      const maskedPolicy = prediction.policy.map((p, i) => 
        validMoves.includes(i) ? p : 0
      );
      
      const bestMove = maskedPolicy.indexOf(Math.max(...maskedPolicy));

      return {
        move: bestMove,
        confidence: maskedPolicy[bestMove],
        strategy: 'webgpu-neural' as AIStrategy,
        computeTime: prediction.computeTimeMs,
        cached: false,
        explanation: 'WebGPU-accelerated neural network decision',
        alternatives: this.policyToAlternatives(prediction.policy, validMoves)
      };
    }

    // Fall back to standard processing
    return await super.getAIMove(request);
  }

  /**
   * Determine if M1 optimizations should be used
   */
  private shouldUseM1Optimizations(request: AIRequest): boolean {
    // Skip for very low difficulties
    if (request.difficulty < 10) {
      return false;
    }

    // Use M1 optimizations if available and beneficial
    return this.isM1Optimized && (
      request.difficulty >= 15 ||
      (request.timeLimit && request.timeLimit > 1000) ||
      this.isComplexPosition(request.board)
    );
  }

  /**
   * Determine if parallel processing should be used
   */
  private shouldUseParallelProcessing(request: AIRequest): boolean {
    // Use parallel processing for high difficulty or complex positions
    return this.m1Config.enableParallelProcessing && (
      request.difficulty >= 20 ||
      this.isComplexPosition(request.board) ||
      (request.timeLimit && request.timeLimit > 2000)
    );
  }

  /**
   * Check if position is complex enough to benefit from parallel processing
   */
  private isComplexPosition(board: CellValue[][]): boolean {
    let filledCells = 0;
    let threats = 0;

    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c] !== 'Empty') {
          filledCells++;
        }
      }
    }

    // Check for threats (simplified)
    const validMoves = this.getM1ValidMoves(board);
    for (const move of validMoves) {
      if (this.isWinningMove(board, move, 'Red') || 
          this.isWinningMove(board, move, 'Yellow')) {
        threats++;
      }
    }

    // Complex if many pieces or multiple threats
    return filledCells > 15 || threats > 1;
  }

  /**
   * Get valid moves for current board state (M1 optimized version)
   */
  private getM1ValidMoves(board: CellValue[][]): number[] {
    const validMoves: number[] = [];
    
    for (let col = 0; col < board[0].length; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }
    
    return validMoves;
  }

  /**
   * Check if a move is winning
   */
  private isWinningMove(board: CellValue[][], col: number, player: CellValue): boolean {
    // Find drop row
    let row = -1;
    for (let r = board.length - 1; r >= 0; r--) {
      if (board[r][col] === 'Empty') {
        row = r;
        break;
      }
    }
    
    if (row === -1) return false;

    // Temporarily place piece
    board[row][col] = player;
    
    // Check for win (simplified)
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let isWinning = false;
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) {
        isWinning = true;
        break;
      }
    }
    
    // Restore board
    board[row][col] = 'Empty';
    
    return isWinning;
  }

  /**
   * Generate alternatives from parallel results
   */
  private generateAlternatives(
    algorithmVotes: Map<string, number>,
    neuralEnhancement: any
  ): Array<{ move: number; score: number; reasoning: string }> {
    const alternatives: Array<{ move: number; score: number; reasoning: string }> = [];
    const moveScores = new Map<number, { count: number; algorithms: string[] }>();

    // Aggregate votes
    for (const [algorithm, move] of algorithmVotes.entries()) {
      if (!moveScores.has(move)) {
        moveScores.set(move, { count: 0, algorithms: [] });
      }
      const entry = moveScores.get(move)!;
      entry.count++;
      entry.algorithms.push(algorithm);
    }

    // Add neural network scores if available
    if (neuralEnhancement) {
      neuralEnhancement.policy.forEach((score: number, move: number) => {
        if (score > 0.1) { // Only consider significant scores
          if (!moveScores.has(move)) {
            moveScores.set(move, { count: 0, algorithms: [] });
          }
          const entry = moveScores.get(move)!;
          entry.algorithms.push('neural-network');
        }
      });
    }

    // Convert to alternatives
    for (const [move, data] of moveScores.entries()) {
      alternatives.push({
        move,
        score: data.count / algorithmVotes.size,
        reasoning: `Supported by: ${data.algorithms.join(', ')}`
      });
    }

    // Sort by score
    alternatives.sort((a, b) => b.score - a.score);
    
    return alternatives.slice(0, 5); // Top 5 alternatives
  }

  /**
   * Convert neural network policy to alternatives
   */
  private policyToAlternatives(
    policy: number[],
    validMoves: number[]
  ): Array<{ move: number; score: number; reasoning: string }> {
    return validMoves
      .map(move => ({
        move,
        score: policy[move],
        reasoning: `Neural network confidence: ${(policy[move] * 100).toFixed(1)}%`
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * Get M1 optimization status
   */
  getM1OptimizationStatus(): {
    enabled: boolean;
    backend: string;
    features: Record<string, boolean>;
    parallelWorkers: number;
    gpuUtilization: number;
    parallelEfficiency: number;
  } {
    const backendInfo = TensorFlowM1Initializer.getBackendInfo();
    const workerStats = this.parallelOrchestrator.getWorkerStats();

    return {
      enabled: this.isM1Optimized,
      backend: backendInfo.backend,
      features: backendInfo.features,
      parallelWorkers: workerStats.totalWorkers,
      gpuUtilization: this.gpuUtilization,
      parallelEfficiency: this.parallelEfficiency
    };
  }

  /**
   * Dynamically adjust optimization settings based on performance
   */
  private async optimizeSettings(): Promise<void> {
    const now = Date.now();
    
    // Only optimize every 60 seconds
    if (now - this.lastOptimizationCheck < 60000) {
      return;
    }

    this.lastOptimizationCheck = now;

    // Get performance metrics
    const metrics = (this as any).performanceMonitor.getAggregatedMetrics?.() || { operations: [] };
    const avgComputeTime = metrics.operations
      .filter(op => op.type === 'm1.enhanced.getMove')
      .reduce((sum, op) => sum + op.duration, 0) / metrics.operations.length;

    // Adjust settings based on performance
    if (avgComputeTime > 2000) {
      // Reduce quality for faster response
      this.enhancedLogger.warn('Performance degradation detected, adjusting settings');
      // Implement dynamic adjustment logic
    }

    // Update utilization metrics
    if (this.webgpuCNN) {
      const memInfo = this.webgpuCNN.getMemoryInfo();
      this.gpuUtilization = Math.min(memInfo.numBytes / (512 * 1024 * 1024), 1); // Assume 512MB GPU memory
    }

    const workerStats = this.parallelOrchestrator.getWorkerStats();
    this.parallelEfficiency = workerStats.busyWorkers / workerStats.totalWorkers;
  }
}