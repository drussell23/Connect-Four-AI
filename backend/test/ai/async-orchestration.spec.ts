import { Test, TestingModule } from '@nestjs/testing';
import { AsyncAIOrchestrator } from '../../src/ai/async/async-ai-orchestrator';
import { AsyncCacheManager } from '../../src/ai/async/cache-manager';
import { CircuitBreaker } from '../../src/ai/async/circuit-breaker';
import { RequestBatcher } from '../../src/ai/async/request-batcher';
import { DynamicStrategySelector } from '../../src/ai/async/strategy-selector';
import { PerformanceMonitor } from '../../src/ai/async/performance-monitor';
import { PrecomputationEngine } from '../../src/ai/async/precomputation-engine';
import { CellValue } from '../../src/ai/connect4AI';

describe('Async AI Orchestration Tests', () => {
  let module: TestingModule;
  let orchestrator: AsyncAIOrchestrator;
  let cacheManager: AsyncCacheManager;
  let circuitBreaker: CircuitBreaker;
  let batcher: RequestBatcher;
  let strategySelector: DynamicStrategySelector;
  let performanceMonitor: PerformanceMonitor;
  let precomputationEngine: PrecomputationEngine;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AsyncAIOrchestrator,
        AsyncCacheManager,
        CircuitBreaker,
        RequestBatcher,
        DynamicStrategySelector,
        PerformanceMonitor,
        PrecomputationEngine,
      ],
    }).compile();

    orchestrator = module.get<AsyncAIOrchestrator>(AsyncAIOrchestrator);
    cacheManager = module.get<AsyncCacheManager>(AsyncCacheManager);
    circuitBreaker = module.get<CircuitBreaker>(CircuitBreaker);
    batcher = module.get<RequestBatcher>(RequestBatcher);
    strategySelector = module.get<DynamicStrategySelector>(DynamicStrategySelector);
    performanceMonitor = module.get<PerformanceMonitor>(PerformanceMonitor);
    precomputationEngine = module.get<PrecomputationEngine>(PrecomputationEngine);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Cache Manager Integration', () => {
    it('Should cache and retrieve board positions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // First call should compute
      const move1 = await orchestrator.getMove(board, 'Yellow', 15);
      
      // Second call should hit cache
      const cacheStats1 = cacheManager.getStats();
      const move2 = await orchestrator.getMove(board, 'Yellow', 15);
      const cacheStats2 = cacheManager.getStats();

      expect(move1.column).toBe(move2.column);
      expect(cacheStats2.hits).toBeGreaterThan(cacheStats1.hits);
    });

    it('Should handle cache eviction properly', async () => {
      // Fill cache with multiple positions
      for (let i = 0; i < 100; i++) {
        const board: CellValue[][] = Array(6).fill(null).map(() => 
          Array(7).fill('Empty' as CellValue)
        );
        board[5][i % 7] = 'Red';
        
        await cacheManager.get(JSON.stringify(board), async () => ({
          column: i % 7,
          score: Math.random(),
        }));
      }

      const stats = cacheManager.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(50); // Default max size
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('Should handle failures gracefully', async () => {
      let callCount = 0;
      const failingOperation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Simulated failure');
        }
        return { column: 3, score: 100 };
      };

      const result = await circuitBreaker.execute('test-operation', failingOperation);
      
      expect(result).toBeDefined();
      expect(result.column).toBe(3);
      expect(callCount).toBe(3); // Should retry
    });

    it('Should open circuit after threshold failures', async () => {
      const failingOperation = async () => {
        throw new Error('Always fails');
      };

      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('failing-op', failingOperation);
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be open
      await expect(
        circuitBreaker.execute('failing-op', failingOperation)
      ).rejects.toThrow(/Circuit breaker is OPEN/);
    });
  });

  describe('Request Batching', () => {
    it('Should batch multiple requests efficiently', async () => {
      const boards: CellValue[][][] = [];
      
      // Create similar board states
      for (let i = 0; i < 5; i++) {
        const board: CellValue[][] = Array(6).fill(null).map(() => 
          Array(7).fill('Empty' as CellValue)
        );
        board[5][3] = 'Red';
        board[5][i] = 'Yellow';
        boards.push(board);
      }

      // Submit multiple requests simultaneously
      const promises = boards.map((board, i) => 
        batcher.addRequest({
          board,
          player: 'Yellow' as CellValue,
          difficulty: 15,
          priority: i === 0 ? 'high' : 'normal',
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.column >= 0 && r.column <= 6)).toBe(true);
    });

    it('Should prioritize high-priority requests', async () => {
      const executionOrder: string[] = [];
      
      // Add low priority request first
      const lowPriority = batcher.addRequest({
        board: Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue)),
        player: 'Yellow',
        difficulty: 10,
        priority: 'low',
        metadata: { id: 'low' },
      }).then(() => executionOrder.push('low'));

      // Add high priority request
      const highPriority = batcher.addRequest({
        board: Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue)),
        player: 'Yellow',
        difficulty: 10,
        priority: 'high',
        metadata: { id: 'high' },
      }).then(() => executionOrder.push('high'));

      await Promise.all([lowPriority, highPriority]);
      
      // High priority should complete first
      expect(executionOrder[0]).toBe('high');
    });
  });

  describe('Dynamic Strategy Selection', () => {
    it('Should select appropriate strategy based on game phase', () => {
      // Early game
      const earlyBoard: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      earlyBoard[5][3] = 'Red';
      
      const earlyStrategy = strategySelector.selectStrategy({
        board: earlyBoard,
        player: 'Yellow',
        difficulty: 20,
        moveCount: 1,
      });
      
      expect(['AlphaZero', 'MCTS']).toContain(earlyStrategy);

      // End game
      const endBoard: CellValue[][] = Array(6).fill(null).map((_, row) => 
        Array(7).fill(null).map((_, col) => {
          if (row > 2) return (row + col) % 2 === 0 ? 'Red' : 'Yellow';
          return 'Empty';
        }) as CellValue[]
      );
      
      const endStrategy = strategySelector.selectStrategy({
        board: endBoard,
        player: 'Yellow',
        difficulty: 20,
        moveCount: 30,
      });
      
      expect(['Minimax', 'AlphaBeta']).toContain(endStrategy);
    });

    it('Should adapt strategy based on time constraints', () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      
      // Quick decision needed
      const quickStrategy = strategySelector.selectStrategy({
        board,
        player: 'Yellow',
        difficulty: 15,
        timeLimit: 50,
      });
      
      expect(['Heuristic', 'FastMCTS']).toContain(quickStrategy);
      
      // More time available
      const deepStrategy = strategySelector.selectStrategy({
        board,
        player: 'Yellow',
        difficulty: 15,
        timeLimit: 5000,
      });
      
      expect(['AlphaZero', 'DQN', 'MCTS']).toContain(deepStrategy);
    });
  });

  describe('Performance Monitoring', () => {
    it('Should track performance metrics accurately', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      
      // Make several moves
      for (let i = 0; i < 10; i++) {
        await orchestrator.getMove(board, 'Yellow', 15);
      }
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(10);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0.9);
    });

    it('Should detect performance degradation', async () => {
      // Simulate slow operations
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { column: 3, score: 100 };
      };
      
      // Track slow operations
      for (let i = 0; i < 5; i++) {
        await performanceMonitor.trackOperation('slow-op', slowOperation);
      }
      
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.some(a => a.type === 'high_latency')).toBe(true);
    });
  });

  describe('Precomputation Engine', () => {
    it('Should precompute likely next positions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];
      
      // Start precomputation
      await precomputationEngine.precomputePositions(board, 'Yellow', 15);
      
      // Wait for background computation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if positions were precomputed
      const stats = precomputationEngine.getStats();
      expect(stats.precomputedPositions).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Full Orchestration Integration', () => {
    it('Should coordinate all components for optimal performance', async () => {
      const testBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];
      
      // First move - cold start
      const start1 = Date.now();
      const move1 = await orchestrator.getMove(testBoard, 'Yellow', 20);
      const time1 = Date.now() - start1;
      
      // Trigger precomputation
      await precomputationEngine.precomputePositions(testBoard, 'Yellow', 20);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Second move - should benefit from caching and precomputation
      const start2 = Date.now();
      const move2 = await orchestrator.getMove(testBoard, 'Yellow', 20);
      const time2 = Date.now() - start2;
      
      expect(move1.column).toBe(move2.column);
      expect(time2).toBeLessThan(time1); // Should be faster
      
      // Check overall system health
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.errorRate).toBeLessThan(0.1);
      expect(metrics.successRate).toBeGreaterThan(0.9);
    });
  });
});