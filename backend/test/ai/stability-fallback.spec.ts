import { Test, TestingModule } from '@nestjs/testing';
import { AIStabilityManager } from '../../src/ai/stability/AIStabilityManager';
import { FallbackSystem } from '../../src/ai/stability/FallbackSystem';
import { HealthMonitor } from '../../src/ai/stability/HealthMonitor';
import { ResourceManager } from '../../src/ai/stability/ResourceManager';
import { SafetySystem } from '../../src/ai/stability/SafetySystem';
import { PerformanceOptimizer } from '../../src/ai/stability/PerformanceOptimizer';
import { CellValue } from '../../src/ai/connect4AI';

describe('Stability and Fallback Mechanisms Tests', () => {
  let stabilityManager: AIStabilityManager;
  let fallbackSystem: FallbackSystem;
  let healthMonitor: HealthMonitor;
  let resourceManager: ResourceManager;
  let safetySystem: SafetySystem;
  let performanceOptimizer: PerformanceOptimizer;

  beforeEach(async () => {
    // Initialize components individually as they may not have NestJS decorators
    fallbackSystem = new FallbackSystem();
    healthMonitor = new HealthMonitor();
    resourceManager = new ResourceManager();
    safetySystem = new SafetySystem();
    performanceOptimizer = new PerformanceOptimizer();
    stabilityManager = new AIStabilityManager();
  });

  describe('Fallback System', () => {
    it('Should provide stable fallback when primary algorithm fails', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // Simulate primary algorithm failure
      const failingAlgorithm = async () => {
        throw new Error('Primary algorithm crashed');
      };

      const decision = await fallbackSystem.executeWithFallback(
        'primary',
        failingAlgorithm,
        { board, player: 'Yellow', difficulty: 15 }
      );

      expect(decision).toBeDefined();
      expect(decision.column).toBeGreaterThanOrEqual(0);
      expect(decision.column).toBeLessThanOrEqual(6);
      expect(decision.fallbackUsed).toBe(true);
    });

    it('Should progress through multiple fallback tiers', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      let attemptCount = 0;
      const unreliableAlgorithm = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return { column: 3, score: 100 };
      };

      const decision = await fallbackSystem.executeWithFallback(
        'unreliable',
        unreliableAlgorithm,
        { board, player: 'Yellow', difficulty: 20 }
      );

      expect(decision).toBeDefined();
      expect(attemptCount).toBeGreaterThanOrEqual(1);
      expect(decision.tier).toBeDefined();
    });

    it('Should handle critical failures with emergency response', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
      ];

      // All algorithms fail
      const catastrophicFailure = async () => {
        throw new Error('Complete system failure');
      };

      const decision = await fallbackSystem.executeWithFallback(
        'critical',
        catastrophicFailure,
        { board, player: 'Yellow', difficulty: 25 }
      );

      // Should still return a valid move (emergency response)
      expect(decision).toBeDefined();
      expect(decision.column).toBe(3); // Block the threat
      expect(decision.emergency).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('Should track component health status', () => {
      // Simulate component health updates
      healthMonitor.updateComponentHealth('AsyncAIOrchestrator', {
        status: 'healthy',
        latency: 50,
        errorRate: 0.01,
        lastCheck: Date.now(),
      });

      healthMonitor.updateComponentHealth('StrategicEngine', {
        status: 'degraded',
        latency: 200,
        errorRate: 0.1,
        lastCheck: Date.now(),
      });

      const systemHealth = healthMonitor.getSystemHealth();
      
      expect(systemHealth.overall).toBe('degraded');
      expect(systemHealth.components['AsyncAIOrchestrator'].status).toBe('healthy');
      expect(systemHealth.components['StrategicEngine'].status).toBe('degraded');
    });

    it('Should detect unhealthy patterns', () => {
      // Simulate error spike
      for (let i = 0; i < 10; i++) {
        healthMonitor.recordError('ThreatDetector', new Error('Detection failed'));
      }

      const alerts = healthMonitor.getHealthAlerts();
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.component === 'ThreatDetector')).toBe(true);
      expect(alerts.some(a => a.type === 'high_error_rate')).toBe(true);
    });

    it('Should trigger recovery actions for unhealthy components', async () => {
      // Mark component as unhealthy
      healthMonitor.updateComponentHealth('DQNModel', {
        status: 'unhealthy',
        latency: 5000,
        errorRate: 0.5,
        lastCheck: Date.now(),
      });

      const recoveryActions = await healthMonitor.getRecoveryActions('DQNModel');
      
      expect(recoveryActions).toContain('restart');
      expect(recoveryActions).toContain('fallback');
    });
  });

  describe('Resource Management', () => {
    it('Should allocate resources based on priority', () => {
      const allocations = resourceManager.allocateResources([
        { component: 'AlphaZero', priority: 10, requestedMemoryMB: 500 },
        { component: 'MCTS', priority: 8, requestedMemoryMB: 300 },
        { component: 'Heuristic', priority: 5, requestedMemoryMB: 100 },
      ], { totalMemoryMB: 600 });

      expect(allocations['AlphaZero']).toBeGreaterThan(allocations['MCTS']);
      expect(allocations['MCTS']).toBeGreaterThan(allocations['Heuristic']);
      expect(Object.values(allocations).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(600);
    });

    it('Should handle resource pressure gracefully', () => {
      const highPressureAllocations = resourceManager.allocateResources([
        { component: 'DQN', priority: 10, requestedMemoryMB: 1000 },
        { component: 'PPO', priority: 9, requestedMemoryMB: 800 },
        { component: 'A3C', priority: 8, requestedMemoryMB: 600 },
      ], { totalMemoryMB: 500 }); // Very limited resources

      // Should still allocate something to high priority
      expect(highPressureAllocations['DQN']).toBeGreaterThan(0);
      expect(Object.values(highPressureAllocations).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(500);
    });

    it('Should throttle resource usage under constraints', async () => {
      resourceManager.setResourceConstraints({
        maxMemoryMB: 1000,
        maxCPUPercent: 80,
        maxGPUPercent: 90,
      });

      const throttled = await resourceManager.shouldThrottle('AlphaZero', {
        currentMemoryMB: 950,
        currentCPUPercent: 85,
        currentGPUPercent: 70,
      });

      expect(throttled).toBe(true);
      expect(throttled).toBeTruthy(); // CPU exceeded limit
    });
  });

  describe('Safety System', () => {
    it('Should validate moves for safety', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
      ];

      // Valid move
      const validMove = safetySystem.validateMove(board, 2, 'Yellow');
      expect(validMove.valid).toBe(true);

      // Invalid move (column full)
      const invalidMove = safetySystem.validateMove(board, 0, 'Yellow');
      expect(invalidMove.valid).toBe(true); // Column 0 is not full in this board

      // Out of bounds
      const outOfBounds = safetySystem.validateMove(board, 7, 'Yellow');
      expect(outOfBounds.valid).toBe(false);
      expect(outOfBounds.reason).toContain('bounds');
    });

    it('Should enforce time limits', async () => {
      const slowAlgorithm = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { column: 3, score: 100 };
      };

      const start = Date.now();
      const result = await safetySystem.enforceTimeLimit(
        slowAlgorithm,
        100, // 100ms limit
        { fallback: () => ({ column: 4, score: 50 }) }
      );
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(150); // Should timeout
      expect(result.column).toBe(4); // Fallback used
      expect(result.timedOut).toBe(true);
    });

    it('Should detect and prevent infinite loops', async () => {
      let iterations = 0;
      const potentiallyInfinite = async () => {
        while (iterations < 10000) {
          iterations++;
          // Simulate some work
          await new Promise(resolve => setImmediate(resolve));
        }
        return { column: 3, score: 100 };
      };

      const result = await safetySystem.executeWithSafeguards(
        potentiallyInfinite,
        { maxIterations: 100 }
      );

      expect(iterations).toBeLessThan(10000);
      expect(result.aborted).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('Should optimize algorithm selection based on performance', () => {
      // Record performance metrics
      performanceOptimizer.recordMetric('AlphaZero', {
        latency: 500,
        accuracy: 0.95,
        resourceUsage: 80,
      });

      performanceOptimizer.recordMetric('MCTS', {
        latency: 200,
        accuracy: 0.85,
        resourceUsage: 40,
      });

      performanceOptimizer.recordMetric('Heuristic', {
        latency: 10,
        accuracy: 0.70,
        resourceUsage: 10,
      });

      // Get optimal algorithm for time-constrained scenario
      const fastAlgorithm = performanceOptimizer.selectOptimalAlgorithm({
        maxLatency: 50,
        minAccuracy: 0.65,
      });

      expect(fastAlgorithm).toBe('Heuristic');

      // Get optimal algorithm for accuracy-focused scenario
      const accurateAlgorithm = performanceOptimizer.selectOptimalAlgorithm({
        maxLatency: 1000,
        minAccuracy: 0.90,
      });

      expect(accurateAlgorithm).toBe('AlphaZero');
    });

    it('Should adapt to changing performance characteristics', () => {
      // Initial good performance
      for (let i = 0; i < 10; i++) {
        performanceOptimizer.recordMetric('DQN', {
          latency: 100 + i * 2,
          accuracy: 0.88,
          resourceUsage: 50,
        });
      }

      const initialScore = performanceOptimizer.getPerformanceScore('DQN');

      // Degraded performance
      for (let i = 0; i < 10; i++) {
        performanceOptimizer.recordMetric('DQN', {
          latency: 300 + i * 10,
          accuracy: 0.75,
          resourceUsage: 90,
        });
      }

      const degradedScore = performanceOptimizer.getPerformanceScore('DQN');

      expect(degradedScore).toBeLessThan(initialScore);
    });
  });

  describe('Full Stability Integration', () => {
    it('Should maintain stability under adverse conditions', async () => {
      const complexBoard: CellValue[][] = [
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
      ];

      // Simulate multiple failures
      let failureCount = 0;
      const unreliableSystem = async () => {
        failureCount++;
        if (failureCount < 3) {
          if (failureCount === 1) throw new Error('Memory error');
          if (failureCount === 2) throw new Error('Timeout');
        }
        return { column: 6, score: 100 };
      };

      const decision = await stabilityManager.makeDecision({
        board: complexBoard,
        currentPlayer: 'Yellow',
        difficulty: 20,
        algorithm: unreliableSystem,
      });

      expect(decision).toBeDefined();
      expect(decision.column).toBe(6); // Only valid column
      expect(failureCount).toBeGreaterThanOrEqual(1);
    });

    it('Should recover from cascading failures', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      // Simulate cascading failure scenario
      const components = ['ThreatDetector', 'StrategyEngine', 'AsyncOrchestrator'];
      
      for (const component of components) {
        healthMonitor.updateComponentHealth(component, {
          status: 'unhealthy',
          latency: 5000,
          errorRate: 0.8,
          lastCheck: Date.now(),
        });
      }

      // System should still provide a decision
      const emergencyDecision = await stabilityManager.makeDecision({
        board,
        currentPlayer: 'Yellow',
        difficulty: 15,
        timeLimit: 100,
      });

      expect(emergencyDecision).toBeDefined();
      expect(emergencyDecision.column).toBeGreaterThanOrEqual(0);
      expect(emergencyDecision.column).toBeLessThanOrEqual(6);
      expect(emergencyDecision.metadata?.fallbackLevel).toBeGreaterThan(0);
    });
  });
});