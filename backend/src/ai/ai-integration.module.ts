// backend/src/ai/ai-integration.module.ts
import { Module, Global, OnModuleInit } from '@nestjs/common';
import { AsyncAIModule } from './async/async-ai.module';
import { AdaptiveAIService } from './adaptive-ai.service';
import { AsyncAIOrchestrator } from './async/async-ai-orchestrator';
import { PerformanceMonitor } from './async/performance-monitor';
import { DynamicStrategySelector } from './async/strategy-selector';
import { AsyncCacheManager } from './async/cache-manager';
import { CircuitBreaker } from './async/circuit-breaker';
import { PrecomputationEngine } from './async/precomputation-engine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import { AsyncAIStabilityIntegration } from './stability/AsyncAIStabilityIntegration';
import { RequestBatcher } from './async/request-batcher';
import { ResourceMonitorService } from './resource-monitor.service';
import { AdaptiveResourceManager } from './adaptive-resource-manager';
import { AsyncDecisionEngine } from './async-decision-engine';
import { AIPerformanceCollector } from './ai-performance-collector';
import { SelfTuningOptimizer } from './self-tuning-optimizer';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Integration module that wires the async AI architecture with the existing AI services
 */
@Global()
@Module({
  imports: [
    AsyncAIModule,
    ScheduleModule.forRoot()
  ],
  providers: [
    ResourceMonitorService,
    AdaptiveResourceManager,
    AsyncDecisionEngine,
    AIPerformanceCollector,
    SelfTuningOptimizer,
    {
      provide: AdaptiveAIService,
      useFactory: (
        orchestrator: AsyncAIOrchestrator,
        performanceMonitor: PerformanceMonitor,
        strategySelector: DynamicStrategySelector
      ) => {
        return new AdaptiveAIService(orchestrator, performanceMonitor, strategySelector);
      },
      inject: [AsyncAIOrchestrator, PerformanceMonitor, DynamicStrategySelector]
    },
    {
      provide: AsyncAIStabilityIntegration,
      useFactory: (
        orchestrator: AsyncAIOrchestrator,
        performanceMonitor: PerformanceMonitor,
        circuitBreaker: CircuitBreaker,
        cacheManager: AsyncCacheManager,
        precomputationEngine: PrecomputationEngine,
        strategySelector: DynamicStrategySelector
      ) => {
        return new AsyncAIStabilityIntegration(
          orchestrator,
          performanceMonitor,
          circuitBreaker,
          cacheManager,
          precomputationEngine,
          strategySelector
        );
      },
      inject: [
        AsyncAIOrchestrator,
        PerformanceMonitor,
        CircuitBreaker,
        AsyncCacheManager,
        PrecomputationEngine,
        DynamicStrategySelector
      ]
    },
    {
      provide: 'AI_SYSTEM_CONFIG',
      useValue: {
        enableAsyncArchitecture: true,
        caching: {
          defaultTTL: 60000, // 1 minute (reduced from 5)
          maxSize: 1000, // Drastically reduced from 5000
          memoryLimit: 64 * 1024 * 1024 // 64MB, reduced from 256MB
        },
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 30000,
          halfOpenRequests: 2
        },
        precomputation: {
          enabled: true,
          maxDepth: 2, // Reduced from 3
          workerPoolSize: 2, // Reduced from 4
          cacheWarmupSize: 50 // Reduced from 100
        },
        monitoring: {
          metricsRetention: 1800000, // 30 minutes, reduced from 1 hour
          alertingEnabled: true,
          exportInterval: 60000 // 1 minute
        }
      }
    }
  ],
  exports: [
    AdaptiveAIService, 
    AsyncAIModule,  // Export the module instead of individual providers
    AsyncAIStabilityIntegration, 
    ResourceMonitorService,
    AdaptiveResourceManager,
    AsyncDecisionEngine,
    AIPerformanceCollector,
    SelfTuningOptimizer
  ]
})
export class AIIntegrationModule implements OnModuleInit {
  constructor(
    private readonly adaptiveAI: AdaptiveAIService,
    private readonly orchestrator: AsyncAIOrchestrator,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly cacheManager: AsyncCacheManager,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly precomputationEngine: PrecomputationEngine,
    private readonly eventEmitter: EventEmitter2,
    private readonly stabilityIntegration: AsyncAIStabilityIntegration
  ) {}

  async onModuleInit() {
    console.log('🚀 Initializing AI Integration Module...');
    
    // Initialize adaptive AI with async components
    await this.adaptiveAI.initialize();
    
    // Initialize stability integration
    await this.stabilityIntegration.initialize();
    
    // Set up global error handling
    this.setupErrorHandling();
    
    // Configure performance monitoring
    this.configurePerformanceMonitoring();
    
    // Initialize precomputation engine
    await this.initializePrecomputation();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('✅ AI Integration Module initialized successfully');
  }

  private setupErrorHandling() {
    // Global circuit breaker for ML services
    this.circuitBreaker.wrapWithRetry(
      async () => axios.get('http://localhost:8000/health'),
      'ml-service-health',
      {
        failureThreshold: 5,
        resetTimeout: 60000,
        fallback: async () => ({ status: 'degraded' })
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        factor: 2
      }
    );

    this.circuitBreaker.wrapWithRetry(
      async () => axios.get('http://localhost:8001/health'),
      'ml-inference-health',
      {
        failureThreshold: 5,
        resetTimeout: 60000,
        fallback: async () => ({ status: 'degraded' })
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        factor: 2
      }
    );
  }

  private configurePerformanceMonitoring() {
    // Monitor AI prediction latency
    this.performanceMonitor.setAlertThreshold(
      'ai.prediction.latency',
      2000,
      'above',
      (metric) => {
        this.eventEmitter.emit('ai.performance.slow', {
          metric: metric.name,
          value: metric.value,
          timestamp: metric.timestamp
        });
      }
    );

    // Monitor cache efficiency
    this.performanceMonitor.setAlertThreshold(
      'cache.hit.rate',
      0.5,
      'below',
      (metric) => {
        this.eventEmitter.emit('ai.cache.inefficient', {
          hitRate: metric.value,
          timestamp: metric.timestamp
        });
      }
    );

    // Monitor memory usage
    this.performanceMonitor.setAlertThreshold(
      'system.memory.usage',
      0.85,
      'above',
      (metric) => {
        this.eventEmitter.emit('ai.memory.high', {
          usage: metric.value,
          timestamp: metric.timestamp
        });
      }
    );
  }

  private async initializePrecomputation() {
    // Warm up cache with common opening positions
    await this.precomputationEngine.warmupCache();
    
    // Schedule periodic cache optimization
    setInterval(async () => {
      const stats = await this.cacheManager.getStats();
      
      // Handle if stats is a Map
      if (stats instanceof Map) {
        const totalHitRate = Array.from(stats.values())
          .reduce((sum, stat) => sum + stat.hitRate, 0) / stats.size;
        
        if (totalHitRate < 0.3) {
          // Clear least used entries if hit rate is too low
          await this.cacheManager.invalidate('precomputed');
          await this.precomputationEngine.warmupCache();
        }
      } else {
        // Handle single CacheStats object
        if (stats.hitRate < 0.3) {
          await this.cacheManager.invalidate('precomputed');
          await this.precomputationEngine.warmupCache();
        }
      }
    }, 300000); // Every 5 minutes
  }

  private setupEventListeners() {
    // Listen for game events to trigger precomputation
    this.eventEmitter.on('game.move.made', async (event: {
      gameId: string;
      board: any[][];
      player: string;
      move: number;
    }) => {
      // Trigger background precomputation for likely next positions
      await this.precomputationEngine.predictAndPrecompute(
        event.board,
        event.player === 'Red' ? 'Yellow' : 'Red',
        2
      );
    });

    // Listen for performance alerts
    this.eventEmitter.on('ai.performance.slow', (event) => {
      console.warn(`⚠️ Slow AI performance detected: ${event.metric} = ${event.value}ms`);
    });

    // Listen for circuit breaker events
    this.eventEmitter.on('circuit.stateChange', (event) => {
      console.log(`🔌 Circuit breaker ${event.name} changed to ${event.newState}`);
      
      if (event.newState === 'OPEN') {
        // Notify about degraded service
        this.eventEmitter.emit('ai.service.degraded', {
          service: event.name,
          reason: 'Circuit breaker opened'
        });
      }
    });

    // Listen for cache events
    this.eventEmitter.on('cache.eviction', (event) => {
      console.log(`📦 Cache eviction: ${event.namespace} evicted ${event.count} entries`);
    });

    // Listen for stability integration events
    this.eventEmitter.on('stability.fallback.triggered', (event) => {
      console.warn(`⚠️ Stability fallback triggered: ${event.reason}`);
    });

    this.eventEmitter.on('stability.health.degraded', async (event) => {
      console.error(`🚨 System health degraded: ${event.score}`);
      
      // Get combined health status
      const health = await this.stabilityIntegration.getCombinedHealth();
      console.log('Combined health status:', health);
    });
  }
}