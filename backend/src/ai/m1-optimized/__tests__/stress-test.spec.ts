/**
 * 🧪 M1 Optimization Stress Test Suite
 * 
 * Comprehensive tests for all 8 phases under heavy load
 */

import { Test, TestingModule } from '@nestjs/testing';
import { M1StressTestService } from './m1-stress-test.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('M1 Optimization Stress Tests', () => {
  let service: M1StressTestService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        M1StressTestService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            once: jest.fn()
          }
        }
      ],
    }).compile();

    service = module.get<M1StressTestService>(M1StressTestService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('Phase 1-2: Tensor Management & Adaptive Runtime', () => {
    it('should handle high tensor allocation without memory leaks', async () => {
      const config = {
        durationMs: 30000, // 30 seconds
        concurrentGames: 5,
        aiRequestsPerSecond: 10,
        cacheOperationsPerSecond: 50,
        enableSelfPlay: false,
        enableBackgroundTraining: false,
        targetMemoryPressure: 'normal' as const
      };

      const metrics = await service.runStressTest(config);

      expect(metrics.tensorLeaks).toBe(0);
      expect(metrics.successfulRequests).toBeGreaterThan(metrics.failedRequests);
      expect(metrics.avgResponseTime).toBeLessThan(200); // Under 200ms
    });

    it('should respect buffer size limits under load', async () => {
      const config = {
        durationMs: 20000,
        concurrentGames: 10,
        aiRequestsPerSecond: 20,
        cacheOperationsPerSecond: 100,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'moderate' as const
      };

      const metrics = await service.runStressTest(config);

      // Should maintain reasonable memory usage
      expect(metrics.peakMemoryMB).toBeLessThan(2048); // Under 2GB
      expect(metrics.timeInNormalMode).toBeGreaterThan(metrics.timeInEmergencyMode);
    });
  });

  describe('Phase 3-4: Memory Monitor & Background Throttle', () => {
    it('should trigger memory monitor at correct thresholds', async () => {
      const config = {
        durationMs: 30000,
        concurrentGames: 20,
        aiRequestsPerSecond: 30,
        cacheOperationsPerSecond: 200,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'high' as const
      };

      const metrics = await service.runStressTest(config);

      // Should spend time in different modes
      expect(metrics.timeInReducedMode).toBeGreaterThan(0);
      expect(metrics.timeInMinimalMode).toBeGreaterThan(0);
      
      // Background tasks should be throttled
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'training.pause',
        expect.any(Object)
      );
    });

    it('should defer tasks when system load is high', async () => {
      const config = {
        durationMs: 20000,
        concurrentGames: 15,
        aiRequestsPerSecond: 25,
        cacheOperationsPerSecond: 150,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'high' as const
      };

      const metrics = await service.runStressTest(config);

      // Tasks should be deferred
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'background.tasks.suspend.all',
        expect.any(Object)
      );
    });
  });

  describe('Phase 5-6: Emergency Cleanup & Python Offload', () => {
    it('should trigger emergency cleanup at critical memory', async () => {
      const config = {
        durationMs: 15000,
        concurrentGames: 30,
        aiRequestsPerSecond: 50,
        cacheOperationsPerSecond: 300,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'critical' as const
      };

      const metrics = await service.runStressTest(config);

      expect(metrics.timeInEmergencyMode).toBeGreaterThan(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'emergency.cleanup.start',
        expect.any(Object)
      );
    });

    it('should offload to Python/Metal under memory pressure', async () => {
      const config = {
        durationMs: 20000,
        concurrentGames: 15,
        aiRequestsPerSecond: 20,
        cacheOperationsPerSecond: 100,
        enableSelfPlay: false,
        enableBackgroundTraining: false,
        targetMemoryPressure: 'high' as const
      };

      const metrics = await service.runStressTest(config);

      // Should have high offload rate when memory is high
      expect(metrics.offloadRate).toBeGreaterThan(0.5); // >50% offloaded
    });
  });

  describe('Phase 7-8: Smart Caching & Graceful Degradation', () => {
    it('should maintain good cache hit rates under pressure', async () => {
      const config = {
        durationMs: 30000,
        concurrentGames: 10,
        aiRequestsPerSecond: 15,
        cacheOperationsPerSecond: 500, // High cache load
        enableSelfPlay: false,
        enableBackgroundTraining: false,
        targetMemoryPressure: 'moderate' as const
      };

      const metrics = await service.runStressTest(config);

      expect(metrics.cacheHitRate).toBeGreaterThan(0.7); // >70% hit rate
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.resize',
        expect.any(Object)
      );
    });

    it('should apply rate limiting under heavy load', async () => {
      const config = {
        durationMs: 20000,
        concurrentGames: 50, // Very high load
        aiRequestsPerSecond: 100,
        cacheOperationsPerSecond: 200,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'high' as const
      };

      const metrics = await service.runStressTest(config);

      expect(metrics.rateLimitErrors).toBeGreaterThan(0);
      expect(metrics.avgResponseTime).toBeLessThan(1000); // Still responsive
    });
  });

  describe('Integration: All Phases Together', () => {
    it('should handle sustained heavy load without crashing', async () => {
      const config = {
        durationMs: 60000, // 1 minute sustained load
        concurrentGames: 25,
        aiRequestsPerSecond: 40,
        cacheOperationsPerSecond: 250,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'high' as const
      };

      const metrics = await service.runStressTest(config);

      // System should remain stable
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.failedRequests / metrics.totalRequests).toBeLessThan(0.1); // <10% failure
      
      // Should use all optimization phases
      expect(metrics.timeInReducedMode + metrics.timeInMinimalMode).toBeGreaterThan(0);
      expect(metrics.offloadRate).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should recover gracefully after memory pressure', async () => {
      // First apply high pressure
      const highPressureConfig = {
        durationMs: 15000,
        concurrentGames: 40,
        aiRequestsPerSecond: 60,
        cacheOperationsPerSecond: 400,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'critical' as const
      };

      await service.runStressTest(highPressureConfig);

      // Then reduce load
      const recoveryConfig = {
        durationMs: 15000,
        concurrentGames: 5,
        aiRequestsPerSecond: 5,
        cacheOperationsPerSecond: 50,
        enableSelfPlay: false,
        enableBackgroundTraining: false,
        targetMemoryPressure: 'normal' as const
      };

      const recoveryMetrics = await service.runStressTest(recoveryConfig);

      // Should return to normal operation
      expect(recoveryMetrics.timeInNormalMode).toBeGreaterThan(
        recoveryMetrics.timeInReducedMode + 
        recoveryMetrics.timeInMinimalMode + 
        recoveryMetrics.timeInEmergencyMode
      );
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets on 16GB M1', async () => {
      const config = {
        durationMs: 30000,
        concurrentGames: 10,
        aiRequestsPerSecond: 15,
        cacheOperationsPerSecond: 100,
        enableSelfPlay: true,
        enableBackgroundTraining: true,
        targetMemoryPressure: 'moderate' as const
      };

      const metrics = await service.runStressTest(config);

      // Performance targets for 16GB M1
      expect(metrics.avgResponseTime).toBeLessThan(100); // <100ms avg
      expect(metrics.p95ResponseTime).toBeLessThan(200); // <200ms p95
      expect(metrics.p99ResponseTime).toBeLessThan(500); // <500ms p99
      expect(metrics.peakMemoryMB).toBeLessThan(2500); // <2.5GB peak
      expect(metrics.avgCpuUsage).toBeLessThan(0.7); // <70% CPU
    });
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running M1 Optimization Stress Tests...');
  console.log('This will simulate heavy load to validate all optimization phases.');
  console.log('Expected duration: ~5 minutes');
  
  // In a real scenario, you'd use Jest or another test runner
  // This is just for demonstration
}