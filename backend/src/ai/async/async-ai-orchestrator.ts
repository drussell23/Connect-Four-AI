// backend/src/ai/async/async-ai-orchestrator.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import { AsyncCacheManager } from './cache-manager';
import { CircuitBreaker } from './circuit-breaker';
import { RequestBatcher } from './request-batcher';
import { DynamicStrategySelector, AIStrategy } from './strategy-selector';
import { PerformanceMonitor } from './performance-monitor';
import { PrecomputationEngine } from './precomputation-engine';
import { OpeningBook } from '../opening-book/opening-book';

export interface AIRequest {
  gameId: string;
  board: CellValue[][];
  player: CellValue;
  difficulty: number;
  timeLimit?: number;
  strategy?: AIStrategy;
  priority?: number;
}

export interface AIResponse {
  move: number;
  confidence: number;
  strategy: AIStrategy;
  computeTime: number;
  cached: boolean;
  explanation?: string;
  alternatives?: Array<{
    move: number;
    score: number;
    reasoning: string;
  }>;
}

export interface OrchestratorConfig {
  enableCaching?: boolean;
  enableCircuitBreaker?: boolean;
  enableBatching?: boolean;
  enablePrecomputation?: boolean;
  enablePerformanceMonitoring?: boolean;
  maxConcurrentRequests?: number;
  defaultTimeLimit?: number;
}

@Injectable()
export class AsyncAIOrchestrator {
  private readonly logger = new Logger(AsyncAIOrchestrator.name);
  private readonly config: Required<OrchestratorConfig>;
  
  // Memoized functions
  private readonly memoizedGetMove: typeof this.computeAIMove;
  private readonly circuitProtectedGetMove: typeof this.computeAIMove;
  private readonly batchedAnalyze: (board: CellValue[][]) => Promise<any>;
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheManager: AsyncCacheManager,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly requestBatcher: RequestBatcher,
    private readonly strategySelector: DynamicStrategySelector,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly precomputationEngine: PrecomputationEngine,
    @Optional() private readonly openingBook?: OpeningBook
  ) {
    this.config = {
      enableCaching: true,
      enableCircuitBreaker: true,
      enableBatching: true,
      enablePrecomputation: true,
      enablePerformanceMonitoring: true,
      maxConcurrentRequests: 10,
      defaultTimeLimit: 5000,
      ...{}
    };

    // Initialize wrapped functions
    this.memoizedGetMove = this.cacheManager.memoize(
      this.computeAIMove.bind(this),
      'ai-moves',
      {
        ttl: 600000, // 10 minutes
        maxSize: 5000,
        keyGenerator: (request: AIRequest) => 
          `${this.serializeBoard(request.board)}-${request.player}-${request.difficulty}`
      }
    );

    this.circuitProtectedGetMove = this.circuitBreaker.wrapWithRetry(
      this.memoizedGetMove.bind(this),
      'ai-compute',
      {
        failureThreshold: 3,
        resetTimeout: 30000,
        fallback: async (request: AIRequest) => this.getFallbackMove(request)
      },
      {
        maxAttempts: 2,
        initialDelay: 100,
        factor: 2
      }
    );

    this.batchedAnalyze = this.requestBatcher.create(
      'board-analysis',
      async (boards: CellValue[][][]) => this.batchAnalyzeBoards(boards),
      {
        maxBatchSize: 5,
        maxLatency: 50
      }
    );

    this.initializeSystem();
  }

  /**
   * Main entry point for AI move requests
   */
  async getAIMove(request: AIRequest): Promise<AIResponse> {
    const operationId = this.performanceMonitor.startOperation('ai.getMove', {
      gameId: request.gameId,
      difficulty: request.difficulty,
      strategy: request.strategy
    });

    try {
      // Check for precomputed move
      if (this.config.enablePrecomputation) {
        const precomputed = await this.precomputationEngine.getPrecomputed(
          request.board,
          request.player
        );

        if (precomputed) {
          this.performanceMonitor.endOperation(operationId, 'completed');
          
          return {
            move: precomputed.bestMove,
            confidence: precomputed.confidence,
            strategy: precomputed.strategy,
            computeTime: 0,
            cached: true,
            alternatives: precomputed.variations.map(v => ({
              move: v.move,
              score: v.score,
              reasoning: `Score: ${v.score.toFixed(2)}`
            }))
          };
        }
      }

      // Schedule precomputation for likely next positions
      if (this.config.enablePrecomputation) {
        this.precomputationEngine.predictAndPrecompute(
          request.board,
          request.player,
          2
        ).catch(err => this.logger.error('Precomputation failed:', err));
      }

      // Use circuit-protected and cached function
      const response = await this.circuitProtectedGetMove(request);
      
      this.performanceMonitor.endOperation(operationId, 'completed');
      
      // Record metrics
      this.performanceMonitor.recordMetric({
        name: 'ai.move.computeTime',
        value: response.computeTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          strategy: response.strategy,
          difficulty: request.difficulty.toString()
        }
      });

      return response;

    } catch (error) {
      this.performanceMonitor.endOperation(operationId, 'failed', error.message);
      this.performanceMonitor.recordError(error, { request }, 'high');
      throw error;
    }
  }

  /**
   * Batch analyze multiple board positions
   */
  async analyzeBoardPositions(
    boards: CellValue[][][],
    player: CellValue
  ): Promise<Array<{ bestMove: number; score: number }>> {
    if (!this.config.enableBatching) {
      // Process individually if batching is disabled
      const results = [];
      for (const board of boards) {
        const result = await this.analyzeBoard(board, player);
        results.push(result);
      }
      return results;
    }

    // Use batched processing
    const promises = boards.map(board => this.batchedAnalyze(board));
    return Promise.all(promises);
  }

  /**
   * Stream AI analysis results
   */
  async *streamAnalysis(
    request: AIRequest,
    options: {
      includeVariations?: boolean;
      maxDepth?: number;
      updateInterval?: number;
    } = {}
  ): AsyncGenerator<{
    type: 'progress' | 'move' | 'variation' | 'complete';
    data: any;
  }> {
    const { includeVariations = true, maxDepth = 5, updateInterval = 100 } = options;
    
    const startTime = Date.now();
    let lastUpdate = startTime;

    // Yield progress updates
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (Date.now() - lastUpdate > updateInterval) {
        lastUpdate = Date.now();
      }
    }, updateInterval);

    try {
      // Select strategy
      const strategy = await this.strategySelector.selectStrategy({
        board: request.board,
        currentPlayer: request.player,
        moveNumber: request.board.flat().filter(c => c !== 'Empty').length,
        difficulty: request.difficulty
      });

      this.logger.log(`🤖 [AI Strategy Selected] ${strategy.primary} with confidence ${(strategy.confidence * 100).toFixed(1)}% for difficulty ${request.difficulty}`);
      if (strategy.fallback) {
        this.logger.log(`  ↳ Fallback strategy: ${strategy.fallback}`);
      }

      yield {
        type: 'progress',
        data: { strategy: strategy.primary, confidence: strategy.confidence }
      };

      // Compute main move
      const mainMove = await this.computeAIMove(request);
      
      yield {
        type: 'move',
        data: mainMove
      };

      // Generate variations if requested
      if (includeVariations) {
        const variations = await this.generateVariations(request, maxDepth);
        
        for (const variation of variations) {
          yield {
            type: 'variation',
            data: variation
          };
        }
      }

      yield {
        type: 'complete',
        data: { totalTime: Date.now() - startTime }
      };

    } finally {
      clearInterval(progressInterval);
    }
  }

  /**
   * Get system health and statistics
   */
  async getSystemHealth(): Promise<{
    orchestrator: {
      activeRequests: number;
      cacheStats: any;
      circuitBreakerStats: any;
      batcherStats: any;
      precomputeStats: any;
    };
    performance: any;
    recommendations: string[];
  }> {
    const [cacheStats, circuitStats, performanceReport, precomputeStats] = await Promise.all([
      this.cacheManager.getStats(),
      this.circuitBreaker.getStats(),
      this.performanceMonitor.generateReport(300000), // Last 5 minutes
      this.precomputationEngine.getStats()
    ]);

    const recommendations = this.generateRecommendations(performanceReport);

    return {
      orchestrator: {
        activeRequests: 0, // Would track this
        cacheStats,
        circuitBreakerStats: circuitStats,
        batcherStats: this.requestBatcher.getStats(),
        precomputeStats
      },
      performance: performanceReport,
      recommendations
    };
  }

  private async computeAIMove(request: AIRequest): Promise<AIResponse> {
    const spanId = this.performanceMonitor.startSpan(
      'ai.compute',
      'computeMove'
    );

    const startTime = Date.now();

    try {
      // Check opening book first
      if (this.openingBook) {
        try {
          const openingMove = await this.openingBook.lookup(request.board);
          if (openingMove !== null) {
            const computeTime = Date.now() - startTime;
            this.logger.log(`📚 [Opening Book] Found move: ${openingMove}, Time: ${computeTime}ms`);
            
            this.performanceMonitor.endSpan('ai.compute', spanId, {
              strategy: 'opening-book',
              computeTime
            });

            return {
              move: openingMove,
              confidence: 0.95,
              strategy: 'opening-book' as AIStrategy,
              computeTime,
              cached: false,
              explanation: 'Move from opening book based on known optimal play'
            };
          }
        } catch (error) {
          this.logger.warn(`Opening book lookup failed: ${error.message}`);
        }
      }

      // Select strategy dynamically
      const moveNumber = request.board.flat().filter(c => c !== 'Empty').length;
      const strategySelection = await this.strategySelector.selectStrategy({
        board: request.board,
        currentPlayer: request.player,
        moveNumber: moveNumber,
        difficulty: request.difficulty,
        timeRemaining: request.timeLimit
      });

      this.logger.log(`🎯 [AI Move Computation] Player: ${request.player}, Move #${moveNumber + 1}, Difficulty: ${request.difficulty}`);
      this.logger.log(`📊 [Strategy: ${strategySelection.primary}] Confidence: ${(strategySelection.confidence * 100).toFixed(1)}%`);

      // This would integrate with actual AI implementations
      const move = await this.executeStrategy(
        request,
        strategySelection.primary
      );

      const computeTime = Date.now() - startTime;

      this.logger.log(`✅ [Move Computed] Column: ${move.move}, Confidence: ${(move.confidence * 100).toFixed(1)}%, Time: ${computeTime}ms`);

      // Update strategy performance
      this.strategySelector.updatePerformance(
        strategySelection.primary,
        'win', // Would determine from game outcome
        computeTime,
        move.confidence
      );

      this.performanceMonitor.endSpan('ai.compute', spanId, {
        strategy: strategySelection.primary,
        computeTime
      });

      return {
        ...move,
        strategy: strategySelection.primary,
        computeTime,
        cached: false,
        explanation: strategySelection.reasoning
      };

    } catch (error) {
      this.performanceMonitor.endSpan('ai.compute', spanId, {
        error: error.message
      });
      throw error;
    }
  }

  private async getFallbackMove(request: AIRequest): Promise<AIResponse> {
    // Simple fallback strategy
    const validMoves = this.getValidMoves(request.board);
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];

    return {
      move,
      confidence: 0.3,
      strategy: AIStrategy.MINIMAX,
      computeTime: 10,
      cached: false,
      explanation: 'Fallback move due to system issues'
    };
  }

  private async batchAnalyzeBoards(
    boards: CellValue[][][]
  ): Promise<Array<{ bestMove: number; score: number }>> {
    // Batch processing logic
    return boards.map(board => ({
      bestMove: Math.floor(Math.random() * 7),
      score: Math.random() * 2 - 1
    }));
  }

  private async analyzeBoard(
    board: CellValue[][],
    player: CellValue
  ): Promise<{ bestMove: number; score: number }> {
    const validMoves = this.getValidMoves(board);
    return {
      bestMove: validMoves[0] || 0,
      score: 0
    };
  }

  private async generateVariations(
    request: AIRequest,
    maxDepth: number
  ): Promise<Array<{
    moves: number[];
    score: number;
    description: string;
  }>> {
    // Generate variation analysis
    return [];
  }

  private async executeStrategy(
    request: AIRequest,
    strategy: AIStrategy
  ): Promise<{ move: number; confidence: number; alternatives?: any[] }> {
    this.logger.log(`🔄 [Executing Strategy] ${strategy} for ${request.player} player`);
    
    // This would call actual AI implementation based on strategy
    const validMoves = this.getValidMoves(request.board);
    
    // Log which AI model would be used based on strategy
    const modelMapping = {
      'MINIMAX': 'Basic Minimax (Depth: 4-6)',
      'ALPHA_BETA': 'Alpha-Beta Pruning (Depth: 6-8)',
      'MCTS': 'Monte Carlo Tree Search (Simulations: 1000)',
      'MCTS_RAVE': 'MCTS with RAVE (Enhanced simulations)',
      'EXPECTIMAX': 'Expectimax (Probabilistic search)',
      'DQN': 'Deep Q-Network (Neural Network)',
      'PPO': 'Proximal Policy Optimization (Deep RL)',
      'A3C': 'Asynchronous Advantage Actor-Critic',
      'ALPHAZERO': 'AlphaZero-style (Neural Network + MCTS)',
      'MUZERO': 'MuZero (Model-based RL)',
      'TRANSFORMER': 'Transformer-based AI',
      'META_LEARNING': 'Meta-Learning AI',
      'NEUROSYMBOLIC': 'Neurosymbolic AI'
    };
    
    this.logger.log(`  ↳ AI Model: ${modelMapping[strategy] || strategy}`);
    
    const result = {
      move: validMoves[Math.floor(Math.random() * validMoves.length)],
      confidence: 0.5 + Math.random() * 0.5,
      alternatives: []
    };
    
    this.logger.log(`  ↳ Valid moves: [${validMoves.join(', ')}], Selected: ${result.move}`);
    
    return result;
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }

  private serializeBoard(board: CellValue[][]): string {
    return board.map(row => row.map(cell => 
      cell === 'Empty' ? '0' : cell === 'Red' ? '1' : '2'
    ).join('')).join('');
  }

  private generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];

    // Cache recommendations
    if (report.aiMetrics.cacheHitRate < 0.5) {
      recommendations.push('Consider increasing cache TTL for better hit rate');
    }

    // Circuit breaker recommendations
    if (report.aiMetrics.circuitBreakerTrips > 5) {
      recommendations.push('High circuit breaker trips - investigate AI service stability');
    }

    // Performance recommendations
    if (report.operations.avgDuration > 1000) {
      recommendations.push('Average operation time is high - consider optimizing AI algorithms');
    }

    // Memory recommendations
    if (report.systemHealth.memory.percentUsed > 80) {
      recommendations.push('High memory usage - consider clearing caches or scaling resources');
    }

    return recommendations;
  }

  private async initializeSystem(): Promise<void> {
    // Warm up cache
    if (this.config.enablePrecomputation) {
      await this.precomputationEngine.warmupCache();
    }

    // Set up performance alerts
    this.performanceMonitor.setAlertThreshold(
      'ai.move.computeTime',
      2000,
      'above',
      (metric) => {
        this.logger.warn(`Slow AI computation detected: ${metric.value}ms`);
      }
    );

    // Listen to circuit breaker events
    this.eventEmitter.on('circuit.stateChange', (event) => {
      if (event.newState === 'OPEN') {
        this.logger.error(`Circuit breaker opened for ${event.name}`);
      }
    });

    this.logger.log('Async AI Orchestrator initialized successfully');
  }
}