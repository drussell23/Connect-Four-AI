// backend/src/ai/ai-integration.module.ts
import { Module, Global, OnModuleInit, Inject } from '@nestjs/common';
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
import { AdaptiveAIOrchestrator } from './adaptive/adaptive-ai-orchestrator';
import { LearningIntegrationModule } from './learning/learning-integration.module';
import { ReinforcementLearningService } from './learning/reinforcement-learning.service';
import { ResourceManagementModule } from './resource-management/resource-management.module';
import { AIPerformanceAnalyzer } from './diagnostics/ai-performance-analyzer';
import { UltimateConnect4AI } from './connect4AI';
import { SuperAIService } from './super-ai.service';
import { SimpleAIService } from './simple-ai.service';
import { AICoordinationModule } from './coordination/ai-coordination.module';
import { AICoordinationClient } from './coordination/ai-coordination-client.service';
import { CoordinationGameIntegrationService } from './coordination/coordination-game-integration.service';
import { OpeningBook } from './opening-book/opening-book';
import { UltimateAIFactory } from './ultimate-ai.factory';
import { EnhancedAsyncOrchestrator } from './m1-optimized/enhanced-async-orchestrator';
import { ParallelAIOrchestrator } from './m1-optimized/parallel-ai-orchestrator';
import { TensorFlowM1Initializer } from './m1-optimized/tensorflow-webgpu-init';
import { TypeScriptMLModule } from './typescript-ml/typescript-ml.module';
import { TypeScriptMLService } from './typescript-ml/typescript-ml.service';
import { HybridArchitectureModule } from './hybrid-architecture/hybrid-architecture.module';
import { HybridAIService } from './hybrid-architecture/hybrid-ai.service';
import { LocalFirstModule } from './local-first/local-first.module';
import { LocalFirstAIService } from './local-first/local-first-ai.service';

/**
 * Integration module that wires the async AI architecture with the existing AI services
 */
@Global()
@Module({
  imports: [
    AsyncAIModule,
    ScheduleModule.forRoot(),
    LearningIntegrationModule,
    ResourceManagementModule,
    AICoordinationModule,
    TypeScriptMLModule,
    HybridArchitectureModule,
    LocalFirstModule
  ],
  providers: [
    ResourceMonitorService,
    AdaptiveResourceManager,
    AsyncDecisionEngine,
    AIPerformanceCollector,
    SelfTuningOptimizer,
    AdaptiveAIOrchestrator,
    AIPerformanceAnalyzer,
    SuperAIService,
    SimpleAIService,
    OpeningBook,
    UltimateAIFactory,
    ParallelAIOrchestrator,
    // Provide EnhancedAsyncOrchestrator as AsyncAIOrchestrator for M1 optimization
    {
      provide: AsyncAIOrchestrator,
      useClass: EnhancedAsyncOrchestrator
    },
    {
      provide: UltimateConnect4AI,
      useFactory: (factory: UltimateAIFactory) => {
        // Create with maximum difficulty settings and full integration
        return factory.create({
          // Core AI Configuration
          primaryStrategy: 'constitutional_ai',
          neuralNetwork: {
            type: 'ensemble',
            enableTraining: true,
            trainingFrequency: 10,
            batchSize: 64,
            learningRate: 0.001,
            architectureSearch: true
          },
          reinforcementLearning: {
            algorithm: 'rainbow_dqn',
            experienceReplay: true,
            targetUpdateFreq: 100,
            exploration: {
              strategy: 'noisy_networks',
              initialValue: 1.0,
              decayRate: 0.995,
              finalValue: 0.01
            }
          },
          mcts: {
            simulations: 2000,
            timeLimit: 10000,
            explorationConstant: 1.414,
            progressiveWidening: true,
            parallelization: true
          },
          advanced: {
            multiAgent: true,
            metaLearning: true,
            curriculumLearning: true,
            populationTraining: true,
            explainableAI: true,
            realTimeAdaptation: true,
            constitutionalAI: true,
            safetyMonitoring: true,
            opponentModeling: true,
            multiAgentDebate: true
          },
          safety: {
            robustnessChecks: true,
            adversarialTesting: true,
            interpretabilityRequirements: true,
            humanOversight: true,
            failsafeActivation: true,
            redTeaming: true,
            safetyVerification: true,
            ethicalConstraints: true,
            harmPrevention: true,
            transparencyLevel: 'expert' as const
          },
          performance: {
            maxThinkingTime: 10000,
            multiThreading: true,
            memoryLimit: 512 * 1024 * 1024,
            gpuAcceleration: true
          },
          // Enhanced features
          useOpeningBook: true,
          openingBookDepth: 20,
          performanceTracking: true,
          eventDriven: true,
          cacheResults: true
        });
      },
      inject: [UltimateAIFactory]
    },
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
        },
        m1Optimization: {
          enabled: true,
          preferWebGPU: true,
          parallelWorkers: 8,
          sharedMemory: true,
          neuralAcceleration: true
        },
        typescriptML: {
          enabled: true,
          useONNX: true,
          useBrainJS: true,
          useML5: true,
          ensembleStrategy: 'dynamic',
          modelCaching: true
        },
        hybridArchitecture: {
          enabled: true,
          pythonTrainerUrl: process.env.PYTHON_TRAINER_URL || 'http://localhost:8002',
          autoRetraining: true,
          deploymentStrategy: 'canary',
          modelVersioning: true
        },
        localFirst: {
          enabled: true,
          enableOffline: true,
          enableServiceWorker: true,
          enableWebAssembly: true,
          cacheSize: 10000,
          syncInterval: 300000,
          modelStorageQuota: 100 * 1024 * 1024
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
    SelfTuningOptimizer,
    AdaptiveAIOrchestrator,
    UltimateConnect4AI,  // Re-enabled with factory pattern to avoid circular dependency
    SimpleAIService,  // Export the simplified AI service
    SuperAIService,  // Export the super AI service for testing
    OpeningBook,  // Export the opening book for AI services
    UltimateAIFactory,  // Export the factory for creating enhanced AI instances
    LearningIntegrationModule,  // Export the module to provide EnhancedRLService and ReinforcementLearningService
    ResourceManagementModule,  // Export resource management services
    AICoordinationModule,  // Export coordination module (includes CoordinationGameIntegrationService)
    TypeScriptMLModule,  // Export TypeScript ML module (includes TypeScriptMLService)
    HybridArchitectureModule,  // Export Hybrid Architecture module (includes HybridAIService)
    LocalFirstModule  // Export Local-First module (includes LocalFirstAIService)
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
    private readonly stabilityIntegration: AsyncAIStabilityIntegration,
    private readonly openingBook: OpeningBook,
    private readonly typescriptML: TypeScriptMLService,
    private readonly hybridAI: HybridAIService,
    private readonly localFirstAI: LocalFirstAIService,
    @Inject(UltimateConnect4AI) private readonly ultimateAI: UltimateConnect4AI
  ) { }

  async onModuleInit() {
    console.log('🚀 Initializing AI Integration Module...');

    // Check for fast mode
    const isFastMode = process.env.FAST_MODE === 'true' || process.env.SKIP_ML_INIT === 'true';
    
    if (isFastMode) {
      console.log('⚡ Fast mode enabled - skipping heavy AI initialization');
      return;
    }

    // Initialize UltimateConnect4AI first to avoid circular dependencies
    await this.ultimateAI.initialize();
    console.log('✅ UltimateConnect4AI initialized');

    // Initialize opening book
    await this.openingBook.load();
    console.log('📚 Opening book loaded');

    // Initialize TypeScript ML
    await this.typescriptML.initialize();
    console.log('🧠 TypeScript ML initialized');

    // Initialize Local-First AI
    console.log('🌐 Initializing Local-First AI...');
    // Local-First AI initializes in its own onModuleInit

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

    // Listen for game results to update opening book
    this.eventEmitter.on('game.ended', async (event: {
      gameId: string;
      winner: string;
      moves: Array<{ board: any[][]; column: number; player: string }>;
    }) => {
      // Update opening book with game results
      for (const move of event.moves) {
        const result = move.player === event.winner ? 'win' : 
                       event.winner === 'draw' ? 'draw' : 'loss';
        await this.openingBook.updateEntry(move.board, move.column, result);
      }
      
      // Periodically save the opening book
      if (Math.random() < 0.1) { // 10% chance to save after each game
        await this.openingBook.save();
      }
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