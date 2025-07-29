import { Injectable, Inject } from '@nestjs/common';
import { UltimateConnect4AI, UltimateAIConfig } from './connect4AI';
import { OpeningBook } from './opening-book/opening-book';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PerformanceMonitor } from './async/performance-monitor';
import { AsyncCacheManager } from './async/cache-manager';

export interface EnhancedUltimateAIConfig extends Partial<UltimateAIConfig> {
  useOpeningBook?: boolean;
  openingBookDepth?: number;
  performanceTracking?: boolean;
  eventDriven?: boolean;
  cacheResults?: boolean;
}

@Injectable()
export class UltimateAIFactory {
  constructor(
    @Inject(OpeningBook) private readonly openingBook: OpeningBook,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
    @Inject(PerformanceMonitor) private readonly performanceMonitor: PerformanceMonitor,
    @Inject(AsyncCacheManager) private readonly cacheManager: AsyncCacheManager,
  ) {}

  create(config: EnhancedUltimateAIConfig = {}): UltimateConnect4AI {
    // Create enhanced configuration with maximum settings
    const ultimateConfig: Partial<UltimateAIConfig> = {
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
      ...config
    };

    // Create the UltimateConnect4AI instance
    const ultimateAI = new UltimateConnect4AI(ultimateConfig);

    // Enhance with opening book integration
    if (config.useOpeningBook !== false) {
      this.enhanceWithOpeningBook(ultimateAI, config.openingBookDepth || 15);
    }

    // Add performance tracking
    if (config.performanceTracking !== false) {
      this.enhanceWithPerformanceTracking(ultimateAI);
    }

    // Add event-driven capabilities
    if (config.eventDriven !== false) {
      this.enhanceWithEventSystem(ultimateAI);
    }

    // Add caching layer
    if (config.cacheResults !== false) {
      this.enhanceWithCaching(ultimateAI);
    }

    return ultimateAI;
  }

  private enhanceWithOpeningBook(ai: UltimateConnect4AI, maxDepth: number): void {
    // Override the getMove method to check opening book first
    const originalGetMove = ai.getMove.bind(ai);
    
    ai.getMove = async (board: any, player: any, options?: any) => {
      // Check if we're within opening book depth
      const moveCount = board.flat().filter((cell: any) => cell !== 'Empty').length;
      
      if (moveCount <= maxDepth) {
        try {
          const openingMove = await this.openingBook.lookup(board);
          if (openingMove !== null) {
            this.eventEmitter.emit('ai.opening-book.used', {
              move: openingMove,
              depth: moveCount,
              board
            });
            return openingMove;
          }
        } catch (error) {
          console.warn('Opening book lookup failed:', error);
        }
      }
      
      // Fallback to original AI
      return originalGetMove(board, player, options);
    };
  }

  private enhanceWithPerformanceTracking(ai: UltimateConnect4AI): void {
    const originalGetMove = ai.getMove.bind(ai);
    
    ai.getMove = async (board: any, player: any, options?: any) => {
      const spanId = this.performanceMonitor.startSpan('ultimate-ai', 'getMove');
      const startTime = Date.now();
      
      try {
        const move = await originalGetMove(board, player, options);
        const computeTime = Date.now() - startTime;
        
        this.performanceMonitor.recordMetric({
          name: 'ultimate-ai.compute-time',
          value: computeTime,
          unit: 'ms',
          timestamp: Date.now()
        });
        this.performanceMonitor.endSpan('ultimate-ai', spanId, {
          computeTime,
          move,
          player
        });
        
        return move;
      } catch (error) {
        this.performanceMonitor.recordError(error as Error);
        this.performanceMonitor.endSpan('ultimate-ai', spanId, { error: true });
        throw error;
      }
    };
  }

  private enhanceWithEventSystem(ai: UltimateConnect4AI): void {
    const originalGetMove = ai.getMove.bind(ai);
    
    ai.getMove = async (board: any, player: any, options?: any) => {
      this.eventEmitter.emit('ultimate-ai.move.start', { board, player, options });
      
      try {
        const move = await originalGetMove(board, player, options);
        
        this.eventEmitter.emit('ultimate-ai.move.complete', {
          board,
          player,
          move,
          options
        });
        
        return move;
      } catch (error) {
        this.eventEmitter.emit('ultimate-ai.move.error', {
          board,
          player,
          error,
          options
        });
        throw error;
      }
    };
  }

  private enhanceWithCaching(ai: UltimateConnect4AI): void {
    const memoizedGetMove = this.cacheManager.memoize(
      ai.getMove.bind(ai),
      'ultimate-ai-moves',
      {
        ttl: 600000, // 10 minutes
        maxSize: 1000,
        keyGenerator: (board: any, player: any) => 
          `${JSON.stringify(board)}-${player}`
      }
    );
    
    ai.getMove = memoizedGetMove;
  }
}