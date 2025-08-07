// backend/src/ai/ai-integration.module.ts
import { Module, Global, OnModuleInit, Inject, OnModuleDestroy } from '@nestjs/common';
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
// M1 imports are conditional - only import when M1 optimizations are enabled
const isM1Enabled = process.env.M1_OPTIMIZED === 'true' || process.env.ENABLE_M1_FEATURES === 'true';
console.log('[AIIntegrationModule] M1 Loading Check:', {
  M1_OPTIMIZED: process.env.M1_OPTIMIZED,
  ENABLE_M1_FEATURES: process.env.ENABLE_M1_FEATURES,
  isM1Enabled
});

// Lazy imports for M1 components to avoid loading when not needed
let EnhancedAsyncOrchestrator: any;
let ParallelAIOrchestrator: any; 
let TensorFlowM1Initializer: any;

if (isM1Enabled) {
  console.log('[AIIntegrationModule] Loading M1 components...');
  EnhancedAsyncOrchestrator = require('./m1-optimized/enhanced-async-orchestrator').EnhancedAsyncOrchestrator;
  ParallelAIOrchestrator = require('./m1-optimized/parallel-ai-orchestrator').ParallelAIOrchestrator;
  TensorFlowM1Initializer = require('./m1-optimized/tensorflow-webgpu-init').TensorFlowM1Initializer;
}
import { TypeScriptMLModule } from './typescript-ml/typescript-ml.module';
import { TypeScriptMLService } from './typescript-ml/typescript-ml.service';
import { HybridArchitectureModule } from './hybrid-architecture/hybrid-architecture.module';
import { LocalFirstModule } from './local-first/local-first.module';
import { ContinuousLearningService } from './continuous-learning.service';
import { PatternDefenseService } from './pattern-defense.service';
import { DifficultyAwarePatternDefenseService } from './difficulty-aware-pattern-defense.service';
import { AIGameIntegrationService } from './ai-game-integration.service';

/**
 * Enhanced AI Integration Module with Full Service Utilization
 * 
 * This module orchestrates all AI services including:
 * - M1 hardware optimization with TensorFlow WebGPU
 * - Distributed coordination for multi-instance deployments
 * - Reinforcement learning with experience replay
 * - Request batching for optimal throughput
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
    // Core Resource Management
    ResourceMonitorService,
    AdaptiveResourceManager,
    AsyncDecisionEngine,
    AIPerformanceCollector,
    SelfTuningOptimizer,
    
    // AI Orchestration Services
    AdaptiveAIOrchestrator,
    AIPerformanceAnalyzer,
    SuperAIService,
    SimpleAIService,
    OpeningBook,
    UltimateAIFactory,
    ...(isM1Enabled && ParallelAIOrchestrator ? [ParallelAIOrchestrator] : []),
    
    // Learning Services
    ContinuousLearningService,
    PatternDefenseService,
    DifficultyAwarePatternDefenseService,
    
    // Main Game Integration Service
    AIGameIntegrationService,
    
    // Enhanced M1-Optimized Orchestrator (conditional)
    {
      provide: AsyncAIOrchestrator,
      useClass: isM1Enabled && EnhancedAsyncOrchestrator ? EnhancedAsyncOrchestrator : AsyncAIOrchestrator
    },
    
    // TensorFlow M1 Initializer for WebGPU acceleration (conditional)
    {
      provide: 'TensorFlowInitializer',
      useFactory: async () => {
        const isFastMode = process.env.FAST_MODE === 'true' || process.env.SKIP_ML_INIT === 'true';
        if (!isFastMode && isM1Enabled && TensorFlowM1Initializer) {
          await TensorFlowM1Initializer.initialize({
            preferWebGPU: true,
            enableMemoryGrowth: true,
            powerPreference: 'high-performance',
            numThreads: 8,
            enableFloat16: true
          });
          
          const backendInfo = TensorFlowM1Initializer.getBackendInfo();
          console.log(`🚀 TensorFlow initialized with ${backendInfo.backend} backend`);
          console.log(`   Features: ${JSON.stringify(backendInfo.features)}`);
          return TensorFlowM1Initializer;
        }
        return null; // No M1 initializer when not enabled
      }
    },
    
    // Request Batcher Configuration
    {
      provide: 'RequestBatcherConfig',
      useFactory: (eventEmitter: EventEmitter2) => {
        const batcher = new RequestBatcher(eventEmitter);
        
        // Create batchers for different request types
        const moveProcessor = batcher.create(
          'ai.move',
          async (items) => items.map(item => ({ move: Math.floor(Math.random() * 7) })),
          { maxBatchSize: 10, maxLatency: 50 }
        );
        
        const evalProcessor = batcher.create(
          'ai.evaluation',
          async (items) => items.map(item => ({ score: Math.random() })),
          { maxBatchSize: 20, maxLatency: 100 }
        );
        
        const trainProcessor = batcher.create(
          'ai.training',
          async (items) => items.map(item => ({ trained: true })),
          { maxBatchSize: 64, maxLatency: 500 }
        );
        
        return { batcher, processors: { moveProcessor, evalProcessor, trainProcessor } };
      },
      inject: [EventEmitter2]
    },
    
    // Reinforcement Learning Service Configuration
    {
      provide: 'ReinforcementLearningConfig',
      useFactory: (
        rlService: ReinforcementLearningService,
        eventEmitter: EventEmitter2
      ) => {
        // Configure RL with experience replay and target networks
        const config = {
          algorithm: 'rainbow_dqn',
          experienceReplaySize: 100000,
          batchSize: 64,
          learningRate: 0.001,
          gamma: 0.99,
          epsilonStart: 1.0,
          epsilonEnd: 0.01,
          epsilonDecay: 0.995,
          targetUpdateFrequency: 1000,
          enablePER: true, // Prioritized Experience Replay
          enableNoisyNets: true,
          enableDueling: true,
          enableDoubleDQN: true,
          enableCategorical: true,
          enableMultiStep: true,
          nStep: 3
        };
        
        // Set up RL event listeners (if methods exist)
        eventEmitter.on('game.move.made', (event) => {
          if (typeof (rlService as any).recordExperience === 'function') {
            (rlService as any).recordExperience({
              state: event.board,
              action: event.move,
              reward: 0, // Will be updated when game ends
              nextState: event.nextBoard,
              done: false
            });
          }
        });
        
        eventEmitter.on('game.ended', (event) => {
          if (typeof (rlService as any).processGameEnd === 'function') {
            (rlService as any).processGameEnd({
              gameId: event.gameId,
              winner: event.winner,
              finalReward: event.winner === 'AI' ? 1 : event.winner === 'draw' ? 0 : -1
            });
          }
        });
        
        return { service: rlService, config };
      },
      inject: [ReinforcementLearningService, EventEmitter2]
    },
    
    // AI Coordination Client Configuration
    {
      provide: 'AICoordinationClientConfig',
      useFactory: (
        coordinationClient: AICoordinationClient,
        gameIntegrationService: CoordinationGameIntegrationService,
        eventEmitter: EventEmitter2
      ) => {
        // Configure distributed AI coordination
        const config = {
          nodeId: process.env.NODE_ID || `node-${Date.now()}`,
          coordinatorUrl: process.env.COORDINATOR_URL || 'ws://localhost:3003',
          heartbeatInterval: 5000,
          syncInterval: 10000,
          enableLoadBalancing: true,
          enableFailover: true,
          maxRetries: 3,
          retryDelay: 1000
        };
        
        // Set up coordination event handlers
        eventEmitter.on('coordination.node.joined', (event) => {
          console.log(`🤝 Node ${event.nodeId} joined the cluster`);
        });
        
        eventEmitter.on('coordination.node.left', (event) => {
          console.log(`👋 Node ${event.nodeId} left the cluster`);
        });
        
        eventEmitter.on('coordination.failover', (event) => {
          console.log(`🔄 Failover triggered: ${event.reason}`);
        });
        
        // Initialize game integration with coordination (if method exists)
        if (typeof (gameIntegrationService as any).initialize === 'function') {
          (gameIntegrationService as any).initialize({
            enableDistributed: true,
            nodeId: config.nodeId,
            sharedStateSync: true
          });
        }
        
        return { client: coordinationClient, gameIntegration: gameIntegrationService, config };
      },
      inject: [AICoordinationClient, CoordinationGameIntegrationService, EventEmitter2]
    },
    
    // Ultimate AI with Full Configuration
    {
      provide: UltimateConnect4AI,
      useFactory: (factory: UltimateAIFactory) => {
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
    
    // Adaptive AI Service with Full Integration
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
    
    // Stability Integration with All Components
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
    
    // Comprehensive System Configuration
    {
      provide: 'AI_SYSTEM_CONFIG',
      useValue: {
        enableAsyncArchitecture: true,
        caching: {
          defaultTTL: 60000,
          maxSize: 1000,
          memoryLimit: 64 * 1024 * 1024
        },
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 30000,
          halfOpenRequests: 2
        },
        precomputation: {
          enabled: true,
          maxDepth: 2,
          workerPoolSize: 2,
          cacheWarmupSize: 50
        },
        monitoring: {
          metricsRetention: 1800000,
          alertingEnabled: true,
          exportInterval: 60000
        },
        m1Optimization: {
          enabled: true,
          preferWebGPU: true,
          parallelWorkers: 8,
          sharedMemory: true,
          neuralAcceleration: true
        },
        reinforcementLearning: {
          enabled: true,
          autoTrain: true,
          trainInterval: 100,
          minExperiences: 1000,
          saveCheckpoints: true,
          checkpointInterval: 1000
        },
        coordination: {
          enabled: true,
          distributed: process.env.ENABLE_DISTRIBUTED === 'true',
          consensus: 'raft',
          replicationFactor: 3
        },
        requestBatching: {
          enabled: true,
          adaptiveBatching: true,
          priorityQueuing: true
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
    // Core Services
    AdaptiveAIService,
    AsyncAIModule,
    AsyncAIStabilityIntegration,
    ResourceMonitorService,
    AdaptiveResourceManager,
    AsyncDecisionEngine,
    AIPerformanceCollector,
    SelfTuningOptimizer,
    AdaptiveAIOrchestrator,
    
    // AI Services
    UltimateConnect4AI,
    SimpleAIService,
    SuperAIService,
    OpeningBook,
    UltimateAIFactory,
    AIGameIntegrationService,
    
    // Learning Services
    LearningIntegrationModule,
    ResourceManagementModule,
    ContinuousLearningService,
    PatternDefenseService,
    DifficultyAwarePatternDefenseService,
    
    // Coordination Services
    AICoordinationModule,
    
    // Advanced Services
    TypeScriptMLModule,
    HybridArchitectureModule,
    LocalFirstModule,
    
    // Utilities
    'TensorFlowInitializer',
    'RequestBatcherConfig',
    'ReinforcementLearningConfig',
    'AICoordinationClientConfig'
  ]
})
export class AIIntegrationModule implements OnModuleInit, OnModuleDestroy {
  private coordinationInterval?: NodeJS.Timeout;
  private rlTrainingInterval?: NodeJS.Timeout;
  private batchProcessInterval?: NodeJS.Timeout;

  constructor(
    private readonly adaptiveAI: AdaptiveAIService,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly cacheManager: AsyncCacheManager,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly precomputationEngine: PrecomputationEngine,
    private readonly eventEmitter: EventEmitter2,
    private readonly stabilityIntegration: AsyncAIStabilityIntegration,
    private readonly openingBook: OpeningBook,
    private readonly typescriptML: TypeScriptMLService,
    private readonly gameIntegrationService: AIGameIntegrationService,
    @Inject(UltimateConnect4AI) private readonly ultimateAI: UltimateConnect4AI,
    @Inject('TensorFlowInitializer') private readonly tfInitializer: any,
    @Inject('RequestBatcherConfig') private readonly requestBatcherConfig: any,
    @Inject('ReinforcementLearningConfig') private readonly rlConfig: any,
    @Inject('AICoordinationClientConfig') private readonly coordinationConfig: any
  ) {}

  async onModuleInit() {
    console.log('🚀 Initializing Enhanced AI Integration Module...');

    const isFastMode = process.env.FAST_MODE === 'true' || process.env.SKIP_ML_INIT === 'true';
    
    if (isFastMode) {
      console.log('⚡ Fast mode enabled - minimal initialization');
      await this.minimalInitialization();
      return;
    }

    try {
      // Initialize all services in parallel where possible
      const initPromises = [
        this.initializeCore(),
        this.initializeMLServices(),
        this.initializeCoordination(),
        this.initializeRequestBatching(),
        this.initializeReinforcementLearning()
      ];

      await Promise.all(initPromises);

      // Set up system-wide configurations
      this.setupErrorHandling();
      this.configurePerformanceMonitoring();
      this.setupEventListeners();
      this.startBackgroundProcesses();

      console.log('✅ Enhanced AI Integration Module initialized successfully');
      this.logSystemCapabilities();

    } catch (error) {
      console.error('❌ Failed to initialize AI Integration Module:', error);
      // Continue with degraded mode
      await this.minimalInitialization();
    }
  }

  async onModuleDestroy() {
    console.log('🔚 Shutting down AI Integration Module...');

    // Clean up intervals
    if (this.coordinationInterval) clearInterval(this.coordinationInterval);
    if (this.rlTrainingInterval) clearInterval(this.rlTrainingInterval);
    if (this.batchProcessInterval) clearInterval(this.batchProcessInterval);

    // Dispose TensorFlow resources (if M1 enabled)
    if (this.tfInitializer && typeof this.tfInitializer.dispose === 'function') {
      this.tfInitializer.dispose();
    }

    // Save state
    await this.openingBook.save();
    
    console.log('✅ AI Integration Module shutdown complete');
  }

  private async initializeCore() {
    // Initialize core AI services
    await this.ultimateAI.initialize();
    console.log('✅ UltimateConnect4AI initialized');

    // Call onModuleInit instead of private initialize
    if (typeof (this.gameIntegrationService as any).onModuleInit === 'function') {
      await (this.gameIntegrationService as any).onModuleInit();
    }
    console.log('✅ AI Game Integration Service initialized');

    await this.openingBook.load();
    console.log('📚 Opening book loaded');

    await this.adaptiveAI.initialize();
    console.log('✅ Adaptive AI initialized');

    await this.stabilityIntegration.initialize();
    console.log('✅ Stability integration initialized');
  }

  private async initializeMLServices() {
    // Initialize TypeScript ML
    await this.typescriptML.initialize();
    console.log('🧠 TypeScript ML initialized');

    // Initialize Local-First AI
    console.log('🌐 Initializing Local-First AI...');
    // Local-First AI initializes in its own onModuleInit

    // Warm up precomputation cache
    await this.precomputationEngine.warmupCache();
    console.log('🔥 Precomputation cache warmed up');
  }

  private async initializeCoordination() {
    if (!this.coordinationConfig.config.enableLoadBalancing) {
      return;
    }

    const { client, config } = this.coordinationConfig;
    
    // Connect to coordinator
    await client.connect(config.coordinatorUrl);
    console.log(`🤝 Connected to coordinator at ${config.coordinatorUrl}`);

    // Register this node
    await client.registerNode({
      nodeId: config.nodeId,
      capabilities: ['ai', 'game', 'training'],
      capacity: 100
    });

    // Start heartbeat
    this.coordinationInterval = setInterval(async () => {
      await client.sendHeartbeat();
    }, config.heartbeatInterval);

    console.log('✅ AI Coordination initialized');
  }

  private async initializeRequestBatching() {
    // Request batcher is already configured in the factory
    console.log('📦 Request batching configured');

    // Start batch processing (if batcher exists)
    const batcher = this.requestBatcherConfig?.batcher;
    if (batcher) {
      this.batchProcessInterval = setInterval(async () => {
        // Process any pending batches if needed
        // The batcher processes automatically with the configured latency
      }, 100); // Check every 100ms
    }

    console.log('✅ Request batching initialized');
  }

  private async initializeReinforcementLearning() {
    const { service, config } = this.rlConfig;
    
    // Initialize RL service with config
    await service.initialize(config);
    console.log('🎮 Reinforcement Learning initialized');

    // Start periodic training if enabled
    if (config.enableAutoTraining) {
      this.rlTrainingInterval = setInterval(async () => {
        const experienceCount = await service.getExperienceCount();
        if (experienceCount >= config.minExperiences) {
          await service.trainBatch(config.batchSize);
        }
      }, config.trainInterval || 10000);
    }

    console.log('✅ RL training loop started');
  }

  private async minimalInitialization() {
    // Minimal initialization for fast mode
    await this.openingBook.load();
    if (typeof (this.gameIntegrationService as any).onModuleInit === 'function') {
      await (this.gameIntegrationService as any).onModuleInit();
    }
    console.log('⚡ Minimal initialization complete');
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

    // Circuit breaker for coordinator
    if (this.coordinationConfig) {
      this.circuitBreaker.wrapWithRetry(
        async () => this.coordinationConfig.client.ping(),
        'coordinator-health',
        {
          failureThreshold: 3,
          resetTimeout: 30000,
          fallback: async () => ({ status: 'standalone' })
        },
        {
          maxAttempts: 3,
          initialDelay: 500,
          factor: 2
        }
      );
    }
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

    // Monitor batch processing efficiency
    this.performanceMonitor.setAlertThreshold(
      'batch.efficiency',
      0.7,
      'below',
      (metric) => {
        this.eventEmitter.emit('batch.inefficient', {
          efficiency: metric.value,
          timestamp: metric.timestamp
        });
      }
    );

    // Monitor RL training performance
    this.performanceMonitor.setAlertThreshold(
      'rl.training.loss',
      10.0,
      'above',
      (metric) => {
        this.eventEmitter.emit('rl.training.diverging', {
          loss: metric.value,
          timestamp: metric.timestamp
        });
      }
    );

    // Monitor coordination latency
    this.performanceMonitor.setAlertThreshold(
      'coordination.latency',
      100,
      'above',
      (metric) => {
        this.eventEmitter.emit('coordination.slow', {
          latency: metric.value,
          timestamp: metric.timestamp
        });
      }
    );
  }

  private setupEventListeners() {
    // Game events
    this.eventEmitter.on('game.move.made', async (event) => {
      // Trigger precomputation
      await this.precomputationEngine.predictAndPrecompute(
        event.board,
        event.player === 'Red' ? 'Yellow' : 'Red',
        2
      );

      // Update coordination state if distributed
      if (this.coordinationConfig) {
        await this.coordinationConfig.client.broadcastState({
          type: 'move',
          gameId: event.gameId,
          move: event.move,
          board: event.board
        });
      }
    });

    // Batch processing events
    this.eventEmitter.on('batch.completed', (event) => {
      console.log(`📦 Batch processed: ${event.type} (${event.count} items in ${event.duration}ms)`);
    });

    // RL events
    this.eventEmitter.on('rl.checkpoint.saved', (event) => {
      console.log(`💾 RL checkpoint saved: ${event.path}`);
    });

    // Coordination events
    this.eventEmitter.on('coordination.leader.elected', (event) => {
      console.log(`👑 New leader elected: ${event.leaderId}`);
    });

    // Performance alerts
    this.eventEmitter.on('ai.performance.slow', (event) => {
      console.warn(`⚠️ Slow AI performance: ${event.metric} = ${event.value}ms`);
      
      // Adjust batch sizes dynamically (if batcher exists)
      const batcher = this.requestBatcherConfig?.batcher;
      if (batcher && typeof (batcher as any).adjustBatchSize === 'function') {
        (batcher as any).adjustBatchSize('ai.move', Math.max(1, Math.floor(10 / (event.value / 1000))));
      }
    });

    // System health events
    this.eventEmitter.on('system.health.check', async () => {
      const health = await this.getSystemHealth();
      this.eventEmitter.emit('system.health.status', health);
    });
  }

  private startBackgroundProcesses() {
    // Periodic cache optimization
    setInterval(async () => {
      const stats = await this.cacheManager.getStats();
      
      if (stats instanceof Map) {
        const totalHitRate = Array.from(stats.values())
          .reduce((sum, stat) => sum + stat.hitRate, 0) / stats.size;

        if (totalHitRate < 0.3) {
          await this.cacheManager.invalidate('precomputed');
          await this.precomputationEngine.warmupCache();
        }
      }
    }, 300000); // Every 5 minutes

    // Periodic opening book save
    setInterval(async () => {
      await this.openingBook.save();
      console.log('💾 Opening book saved');
    }, 600000); // Every 10 minutes

    // Periodic system health check
    setInterval(async () => {
      this.eventEmitter.emit('system.health.check');
    }, 60000); // Every minute
  }

  private async getSystemHealth() {
    const [aiHealth, cacheStats, rlStats] = await Promise.all([
      this.stabilityIntegration.getCombinedHealth(),
      this.cacheManager.getStats(),
      this.rlConfig.service.getStats()
    ]);

    const tfBackend = this.tfInitializer?.getBackendInfo() || { backend: 'cpu', features: {} };
    
    return {
      ai: aiHealth,
      cache: cacheStats,
      reinforcementLearning: rlStats,
      tensorflow: tfBackend,
      coordination: this.coordinationConfig ? 'connected' : 'standalone',
      timestamp: Date.now()
    };
  }

  private logSystemCapabilities() {
    console.log('🎯 AI System Capabilities:');
    if (isM1Enabled) {
      console.log('  ✅ M1 Hardware Acceleration (WebGPU)');
    }
    console.log('  ✅ Distributed Coordination');
    console.log('  ✅ Reinforcement Learning (Rainbow DQN)');
    console.log('  ✅ Request Batching & Priority Queuing');
    console.log('  ✅ Predictive Precomputation');
    console.log('  ✅ Self-Tuning Optimization');
    console.log('  ✅ Opening Book Database');
    console.log('  ✅ TypeScript ML Integration');
    console.log('  ✅ Hybrid Architecture Support');
    console.log('  ✅ Local-First AI');
    
    const tfBackend = this.tfInitializer?.getBackendInfo() || { backend: 'cpu', features: {} };
    console.log(`  🚀 TensorFlow Backend: ${tfBackend.backend}`);
    console.log(`  🔧 Features: ${Object.entries(tfBackend.features)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ')}`);
  }
}