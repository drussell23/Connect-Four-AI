// backend/src/ai/async/async-ai-integration.example.ts
import { Injectable, Logger } from '@nestjs/common';
import { AsyncAIOrchestrator, AIRequest, AIResponse } from './async-ai-orchestrator';
import { PerformanceMonitor } from './performance-monitor';
import { DynamicStrategySelector, AIStrategy } from './strategy-selector';
import { CellValue } from '../connect4AI';

/**
 * Example integration showing how to use the async AI system
 */
@Injectable()
export class AsyncAIIntegrationExample {
  private readonly logger = new Logger(AsyncAIIntegrationExample.name);

  constructor(
    private readonly aiOrchestrator: AsyncAIOrchestrator,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly strategySelector: DynamicStrategySelector
  ) {}

  /**
   * Example 1: Simple AI move request with caching and circuit breaker
   */
  async getAIMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number
  ): Promise<AIResponse> {
    try {
      const request: AIRequest = {
        gameId,
        board,
        player,
        difficulty,
        timeLimit: 5000, // 5 second time limit
        priority: difficulty > 15 ? 10 : 5 // Higher priority for harder difficulties
      };

      const response = await this.aiOrchestrator.getAIMove(request);

      this.logger.log(`AI move computed: Column ${response.move} with ${response.confidence.toFixed(2)} confidence`);
      this.logger.log(`Strategy used: ${response.strategy}, Compute time: ${response.computeTime}ms`);

      return response;
    } catch (error) {
      this.logger.error('Failed to get AI move:', error);
      throw error;
    }
  }

  /**
   * Example 2: Batch analyze multiple board positions
   */
  async analyzeMultiplePositions(
    boards: CellValue[][][],
    player: CellValue
  ): Promise<void> {
    try {
      const startTime = Date.now();
      
      const results = await this.aiOrchestrator.analyzeBoardPositions(boards, player);
      
      const totalTime = Date.now() - startTime;
      
      this.logger.log(`Analyzed ${boards.length} positions in ${totalTime}ms`);
      this.logger.log(`Average time per position: ${(totalTime / boards.length).toFixed(2)}ms`);
      
      results.forEach((result, index) => {
        this.logger.log(`Position ${index}: Best move = ${result.bestMove}, Score = ${result.score.toFixed(2)}`);
      });
    } catch (error) {
      this.logger.error('Failed to analyze positions:', error);
    }
  }

  /**
   * Example 3: Stream AI analysis with real-time updates
   */
  async streamAIAnalysis(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number
  ): Promise<void> {
    try {
      const request: AIRequest = {
        gameId,
        board,
        player,
        difficulty
      };

      const stream = this.aiOrchestrator.streamAnalysis(request, {
        includeVariations: true,
        maxDepth: 3,
        updateInterval: 500
      });

      for await (const update of stream) {
        switch (update.type) {
          case 'progress':
            this.logger.log(`Analysis progress: Strategy = ${update.data.strategy}, Confidence = ${update.data.confidence}`);
            break;
          
          case 'move':
            this.logger.log(`Best move found: Column ${update.data.move}`);
            break;
          
          case 'variation':
            this.logger.log(`Variation: ${update.data.moves.join(' -> ')}, Score = ${update.data.score}`);
            break;
          
          case 'complete':
            this.logger.log(`Analysis complete in ${update.data.totalTime}ms`);
            break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to stream analysis:', error);
    }
  }

  /**
   * Example 4: Get strategy recommendations for a position
   */
  async getStrategyRecommendations(
    board: CellValue[][],
    player: CellValue,
    difficulty: number
  ): Promise<void> {
    try {
      const gameState = {
        board,
        currentPlayer: player,
        moveNumber: board.flat().filter(cell => cell !== 'Empty').length,
        difficulty
      };

      const recommendations = await this.strategySelector.getRecommendations(gameState);

      this.logger.log('=== Strategy Recommendations ===');
      
      recommendations.strategies.forEach((strategy, index) => {
        this.logger.log(`${index + 1}. ${strategy.strategy} (${strategy.suitability})`);
        this.logger.log(`   Score: ${strategy.score.toFixed(2)}`);
        this.logger.log(`   Pros: ${strategy.pros.join(', ')}`);
        this.logger.log(`   Cons: ${strategy.cons.join(', ')}`);
      });

      this.logger.log(`\nBest for: ${recommendations.bestFor.join(', ')}`);
      this.logger.log(`Considerations: ${recommendations.considerations.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to get recommendations:', error);
    }
  }

  /**
   * Example 5: Monitor system health and performance
   */
  async monitorSystemHealth(): Promise<void> {
    try {
      const health = await this.aiOrchestrator.getSystemHealth();

      this.logger.log('=== AI System Health ===');
      
      // Cache statistics
      const cacheStats = health.orchestrator.cacheStats;
      if (cacheStats instanceof Map) {
        for (const [namespace, stats] of cacheStats) {
          this.logger.log(`Cache ${namespace}: Hit rate = ${(stats.hitRate * 100).toFixed(1)}%, Entries = ${stats.entries}`);
        }
      }

      // Circuit breaker status
      const circuitStats = health.orchestrator.circuitBreakerStats;
      if (circuitStats instanceof Map) {
        for (const [name, stats] of circuitStats) {
          this.logger.log(`Circuit ${name}: State = ${stats.state}, Error rate = ${(stats.errorRate * 100).toFixed(1)}%`);
        }
      }

      // Performance metrics
      const perf = health.performance;
      this.logger.log(`\nPerformance (last 5 min):`);
      this.logger.log(`  Total operations: ${perf.operations.total}`);
      this.logger.log(`  Success rate: ${((perf.operations.successful / perf.operations.total) * 100).toFixed(1)}%`);
      this.logger.log(`  Avg duration: ${perf.operations.avgDuration.toFixed(2)}ms`);
      this.logger.log(`  P95 duration: ${perf.operations.p95Duration.toFixed(2)}ms`);

      // System resources
      this.logger.log(`\nSystem Resources:`);
      this.logger.log(`  CPU usage: ${perf.systemHealth.cpu.usage.toFixed(1)}%`);
      this.logger.log(`  Memory usage: ${perf.systemHealth.memory.percentUsed.toFixed(1)}%`);

      // Recommendations
      if (health.recommendations.length > 0) {
        this.logger.log(`\nRecommendations:`);
        health.recommendations.forEach(rec => this.logger.log(`  - ${rec}`));
      }
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
    }
  }

  /**
   * Example 6: Set up performance alerts
   */
  setupPerformanceAlerts(): void {
    // Alert on slow AI computations
    this.performanceMonitor.setAlertThreshold(
      'ai.move.computeTime',
      3000,
      'above',
      (metric) => {
        this.logger.warn(`⚠️ Slow AI computation detected: ${metric.value}ms`);
        // Could send notification, scale resources, etc.
      }
    );

    // Alert on high error rate
    this.performanceMonitor.setAlertThreshold(
      'ai.error.rate',
      0.1,
      'above',
      (metric) => {
        this.logger.error(`🚨 High AI error rate: ${(metric.value * 100).toFixed(1)}%`);
        // Could trigger incident response
      }
    );

    // Alert on low cache hit rate
    this.performanceMonitor.setAlertThreshold(
      'cache.hitRate',
      0.3,
      'below',
      (metric) => {
        this.logger.warn(`📉 Low cache hit rate: ${(metric.value * 100).toFixed(1)}%`);
        // Could adjust cache settings
      }
    );

    this.logger.log('Performance alerts configured');
  }

  /**
   * Example 7: Create a hybrid AI strategy
   */
  async createHybridStrategy(): Promise<void> {
    try {
      // Create a hybrid strategy combining multiple approaches
      const hybridStrategy = this.strategySelector.createHybridStrategy(
        [AIStrategy.MINIMAX, AIStrategy.MCTS, AIStrategy.DQN],
        [0.3, 0.5, 0.2] // Weights for each strategy
      );

      // Test the hybrid strategy
      const testBoard: CellValue[][] = Array.from({ length: 6 }, () => Array(7).fill('Empty'));
      testBoard[5][3] = 'Red';
      testBoard[5][4] = 'Yellow';

      const result = await hybridStrategy({
        board: testBoard,
        currentPlayer: 'Red',
        moveNumber: 2,
        difficulty: 10
      });

      this.logger.log(`Hybrid strategy result: Move = ${result.column}, Confidence = ${result.confidence.toFixed(2)}`);
    } catch (error) {
      this.logger.error('Failed to create hybrid strategy:', error);
    }
  }

  /**
   * Example 8: Export metrics for monitoring
   */
  async exportMetrics(): Promise<void> {
    try {
      const prometheusMetrics = this.performanceMonitor.exportPrometheusMetrics();
      
      this.logger.log('=== Prometheus Metrics ===');
      this.logger.log(prometheusMetrics);
      
      // In a real application, you would expose this via an HTTP endpoint
      // app.get('/metrics', (req, res) => res.send(prometheusMetrics));
    } catch (error) {
      this.logger.error('Failed to export metrics:', error);
    }
  }
}