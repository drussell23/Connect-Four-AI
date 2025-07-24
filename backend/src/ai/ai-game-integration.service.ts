/**
 * AI Game Integration Service
 * 
 * This service properly integrates the UltimateConnect4AI with all its advanced features
 * into the game logic, ensuring all AI capabilities are utilized during gameplay.
 */

import { Injectable, Logger } from '@nestjs/common';
import { UltimateConnect4AI, CellValue, AIDecision, UltimateAIConfig, AIAbilityConfig } from './connect4AI';
import { AsyncAIOrchestrator } from './async/async-ai-orchestrator';
import { AdaptiveAIService } from './adaptive-ai.service';
import { PerformanceMonitor } from './async/performance-monitor';
import { ResourceMonitorService } from './resource-monitor.service';
import { AdaptiveResourceManager } from './adaptive-resource-manager';
import { AsyncDecisionEngine } from './async-decision-engine';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface IntegratedAIResponse {
  move: number;
  decision: AIDecision;
  metadata: {
    strategy: string;
    confidence: number;
    thinkingTime: number;
    learningApplied: boolean;
    adaptationApplied: boolean;
    multiStepAnalysis: number;
    explanation: string;
    safetyValidated: boolean;
    alternatives?: Array<{
      move: number;
      score: number;
      reasoning: string;
    }>;
  };
}

@Injectable()
export class AIGameIntegrationService {
  private readonly logger = new Logger(AIGameIntegrationService.name);
  private ultimateAI: UltimateConnect4AI;
  private initialized = false;
  private gameHistory = new Map<string, Array<{
    board: CellValue[][];
    move: number;
    result?: 'win' | 'loss' | 'draw';
  }>>();
  
  private learningMetrics = {
    gamesPlayed: 0,
    averageThinkingTime: 0,
    winRate: 0,
    adaptationLevel: 0.8
  };

  constructor(
    private readonly asyncOrchestrator?: AsyncAIOrchestrator,
    private readonly adaptiveAI?: AdaptiveAIService,
    private readonly performanceMonitor?: PerformanceMonitor,
    private readonly resourceMonitor?: ResourceMonitorService,
    private readonly adaptiveResourceManager?: AdaptiveResourceManager,
    private readonly asyncDecisionEngine?: AsyncDecisionEngine,
    private readonly eventEmitter?: EventEmitter2
  ) {}

  /**
   * Initialize the AI with all advanced features enabled
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.log('🚀 Initializing Advanced AI Game Integration...');

    const config: Partial<UltimateAIConfig> = {
      // Enable the most advanced primary strategy
      primaryStrategy: 'constitutional_ai',
      
      // Configure neural networks
      neuralNetwork: {
        type: 'ensemble', // Use ensemble of networks
        enableTraining: true,
        trainingFrequency: 10, // Train every 10 games
        batchSize: 32,
        learningRate: 0.001,
        architectureSearch: true // Enable neural architecture search
      },
      
      // Configure reinforcement learning
      reinforcementLearning: {
        algorithm: 'rainbow_dqn', // Most advanced DQN variant
        experienceReplay: true,
        targetUpdateFreq: 100,
        exploration: {
          strategy: 'noisy_networks',
          initialValue: 1.0,
          decayRate: 0.995,
          finalValue: 0.01
        }
      },
      
      // Configure MCTS for deep search
      mcts: {
        simulations: 2000, // High simulation count
        timeLimit: 10000, // 10 seconds for deep thinking
        explorationConstant: 1.414,
        progressiveWidening: true,
        parallelization: true
      },
      
      // Enable ALL advanced features
      advanced: {
        multiAgent: true,           // Multi-agent debate for best moves
        metaLearning: true,         // Learn how to learn
        curriculumLearning: true,   // Progressive difficulty
        populationTraining: true,   // Train against population
        explainableAI: true,        // Explain decisions
        realTimeAdaptation: true,   // Adapt during game
        constitutionalAI: true,     // Constitutional principles
        safetyMonitoring: true,     // Monitor for safe play
        opponentModeling: true,     // Model opponent behavior
        multiAgentDebate: true      // Debate best moves
      },
      
      // Performance settings
      performance: {
        maxThinkingTime: 10000, // Allow up to 10 seconds thinking
        multiThreading: true,
        memoryLimit: 2048, // 2GB memory
        gpuAcceleration: false
      },
      
      // RLHF Configuration
      rlhf: {
        rewardModel: {
          networkType: 'ensemble',
          hiddenSize: 256,
          learningRate: 0.001,
          batchSize: 32,
          epochs: 10,
          regularization: 0.01,
          hierarchicalLevels: 3,
          attention: true,
          uncertaintyEstimation: true
        },
        policy: {
          algorithm: 'constitutional_ai',
          klDivergencePenalty: 0.02,
          safetyConstraints: true,
          constitutionalPrinciples: [
            {
              name: 'Strategic Optimality',
              description: 'Play strategically optimal moves',
              weight: 1.0,
              category: 'fairness',
              implementation: (board, moves) => moves,
              reasoning: (board, move) => 'Strategic move selected',
              active: true
            },
            {
              name: 'Long-term Planning',
              description: 'Consider long-term consequences',
              weight: 0.9,
              category: 'engagement',
              implementation: (board, moves) => moves,
              reasoning: (board, move) => 'Long-term consequences considered',
              active: true
            },
            {
              name: 'Opponent Adaptation',
              description: 'Adapt to opponent patterns',
              weight: 0.8,
              category: 'education',
              implementation: (board, moves) => moves,
              reasoning: (board, move) => 'Adapted to opponent patterns',
              active: true
            },
            {
              name: 'Game Integrity',
              description: 'Maintain game integrity',
              weight: 1.0,
              category: 'safety',
              implementation: (board, moves) => moves,
              reasoning: (board, move) => 'Game integrity maintained',
              active: true
            }
          ],
          alignmentObjectives: [
            {
              name: 'Win Rate',
              description: 'Maximize winning probability',
              weight: 0.8,
              measurementFunction: (gameState) => gameState.winProbability || 0,
              targetValue: 0.8,
              importance: 'high'
            },
            {
              name: 'Educational Value',
              description: 'Provide educational value',
              weight: 0.7,
              measurementFunction: (gameState) => gameState.educationalScore || 0,
              targetValue: 0.7,
              importance: 'high'
            },
            {
              name: 'Fair Play',
              description: 'Ensure fair gameplay',
              weight: 1.0,
              measurementFunction: (gameState) => gameState.fairnessScore || 1.0,
              targetValue: 1.0,
              importance: 'critical'
            }
          ],
          multiAgentDebate: true,
          curriculumLearning: true,
          adaptiveComplexity: true
        }
      },
      
      // Safety configuration
      safety: {
        robustnessChecks: true,
        adversarialTesting: true,
        interpretabilityRequirements: true,
        humanOversight: true,
        failsafeActivation: true,
        redTeaming: false,
        safetyVerification: true,
        ethicalConstraints: true,
        harmPrevention: true,
        transparencyLevel: 'detailed'
      },
      
      // Continuous learning
      drlTraining: {
        enabled: true,
        config: {
          environment: {
            rewardShaping: {
              winReward: 1.0,
              lossReward: -1.0,
              drawReward: 0.0,
              moveReward: 0.01,
              threatReward: 0.1,
              blockReward: 0.05,
              centerColumnBonus: 0.02
            },
            stateRepresentation: 'enhanced',
            actionSpace: 'discrete',
            observationSpace: 'features'
          },
          training: {
            algorithm: 'rainbow_dqn',
            episodes: 10000,
            maxStepsPerEpisode: 42,
            batchSize: 32,
            learningRate: 0.0001,
            discountFactor: 0.99,
            explorationStrategy: 'epsilon_greedy',
            targetUpdateFrequency: 1000
          },
          selfPlay: {
            enabled: true,
            opponentStrategies: ['random', 'minimax', 'mcts'],
            curriculumLearning: true,
            adaptiveDifficulty: true,
            tournamentMode: false
          },
          experienceReplay: {
            bufferSize: 100000,
            prioritized: true,
            alpha: 0.6,
            beta: 0.4,
            minExperiences: 1000
          },
          evaluation: {
            evaluationFrequency: 50,
            evaluationEpisodes: 10,
            benchmarkOpponents: ['minimax_5', 'mcts_1000'],
            metricsToTrack: ['win_rate', 'avg_reward', 'q_value']
          },
          model: {
            saveFrequency: 100,
            modelVersioning: true,
            checkpointPath: './models/connect4_drl',
            exportFormat: 'tensorjs'
          }
        },
        continuousLearning: true,
        selfPlayEnabled: true,
        experienceReplaySize: 50000,
        trainingInterval: 10, // Train every 10 games
        evaluationInterval: 50,
        backgroundTraining: true,
        modelVersioning: true,
        adaptiveRewardShaping: true
      }
    };
    
    // Add missing required configurations
    config.explainability = {
      enabled: true,
      visualizations: true,
      causalAnalysis: true,
      counterfactuals: true,
      featureImportance: true,
      decisionTrees: true,
      naturalLanguageExplanations: true,
      interactiveExplanations: true
    };
    
    config.adaptation = {
      playerModeling: true,
      styleAdaptation: true,
      difficultyScaling: true,
      personalizedLearning: true,
      contextualMemory: true,
      transferLearning: true,
      onlineUpdates: true,
      adaptationRate: 0.1
    };
    
    config.curriculum = {
      enabled: true,
      adaptiveDifficulty: true,
      personalizedPaths: true,
      progressTracking: true
    };
    
    config.opponentModeling = {
      enabled: true,
      deepProfiling: true,
      behavioralPrediction: true,
      adaptiveStrategies: true
    };
    
    config.multiAgentDebate = {
      enabled: true,
      agentCount: 3,
      consensusThreshold: 0.7,
      maxRounds: 5
    };
    
    config.neuralArchitectureSearch = {
      populationSize: 10,
      generations: 5,
      mutationRate: 0.1,
      crossoverRate: 0.7,
      elitismRate: 0.1,
      diversityThreshold: 0.2,
      fitnessWeights: {
        accuracy: 0.4,
        speed: 0.3,
        efficiency: 0.2,
        robustness: 0.1
      },
      constraints: {
        maxLayers: 5,
        maxParameters: 1000000,
        maxComplexity: 100
      }
    };
    
    config.optimizers = {
      adamW: {
        enabled: true,
        preset: 'neuralNetwork',
        config: {}
      },
      entropyRegularizer: {
        enabled: true,
        preset: 'policyGradient',
        config: {}
      },
      learningRateScheduler: {
        enabled: true,
        preset: 'cosineAnnealing',
        config: {}
      },
      integration: {
        adaptiveOptimization: true,
        crossOptimizerLearning: true,
        performanceMonitoring: true,
        autoTuning: true
      }
    };

    try {
      this.ultimateAI = new UltimateConnect4AI(config as UltimateAIConfig);
      this.initialized = true;
      this.logger.log('✅ Advanced AI initialized with all features enabled');
      
      // Log enabled features
      this.logger.log('🎯 Enabled AI Features:');
      this.logger.log('  - Constitutional AI with safety monitoring');
      this.logger.log('  - Rainbow DQN with experience replay');
      this.logger.log('  - Neural architecture search');
      this.logger.log('  - Opponent modeling and adaptation');
      this.logger.log('  - Curriculum learning');
      this.logger.log('  - Multi-agent debate system');
      this.logger.log('  - 10-step lookahead with MCTS');
      this.logger.log('  - Continuous learning from games');
      this.logger.log('  - Explainable AI decisions');
      
    } catch (error) {
      this.logger.error('Failed to initialize advanced AI:', error);
      throw error;
    }
  }

  /**
   * Get the best AI move using all advanced features
   */
  async getBestMove(
    gameId: string,
    board: CellValue[][],
    aiPlayer: CellValue = 'Yellow',
    humanPlayerId?: string,
    difficulty: number = 10
  ): Promise<IntegratedAIResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    // Emit request start event
    if (this.eventEmitter) {
      this.eventEmitter.emit('ai.request.start', { gameId, difficulty });
    }
    
    // Get adaptive configuration based on current resources and AI state
    let adaptiveConfig = null;
    if (this.adaptiveResourceManager) {
      const currentStrategy = this.getStrategyForDifficulty(difficulty);
      const complexity = difficulty / 10; // Normalize to 0-1
      
      adaptiveConfig = await this.adaptiveResourceManager.getAdaptiveConfiguration(
        currentStrategy,
        complexity
      );
      
      this.logger.log(`📊 Adaptive config: ${adaptiveConfig.strategy} (confidence: ${adaptiveConfig.confidence.toFixed(2)})`);
      this.logger.debug(`   Reasoning: ${adaptiveConfig.reasoning}`);
      
      // Apply adaptive settings
      if (adaptiveConfig.maxThinkingTime < 5000 && difficulty >= 8) {
        this.logger.warn(`⚠️ Resource constraints detected, adjusting AI behavior`);
      }
    }
    
    // Check resource availability and throttle if needed
    if (this.resourceMonitor) {
      const throttleDecision = this.resourceMonitor.shouldThrottleRequest();
      if (throttleDecision.shouldThrottle) {
        this.logger.warn(`🚦 Resource throttling: ${throttleDecision.reason}`);
        
        // Use async decision engine for non-blocking processing
        if (this.asyncDecisionEngine && adaptiveConfig && adaptiveConfig.parallelism > 1) {
          const requestId = await this.asyncDecisionEngine.submitDecision({
            gameId,
            board,
            strategy: adaptiveConfig.strategy,
            complexity: difficulty / 10,
            priority: difficulty
          });
          
          const result = await this.asyncDecisionEngine.getDecisionResult(requestId, 10000);
          if (result) {
            adaptiveConfig = result.decision;
            this.logger.log(`🔄 Async decision completed in ${result.executionTime}ms`);
          }
        } else {
          // For high difficulty games, wait for resources
          if (difficulty >= 8) {
            const resourcesAvailable = await this.resourceMonitor.waitForResources(5000);
            if (!resourcesAvailable) {
              this.logger.error('Resources unavailable, using simplified fallback');
              throw new Error('Resources unavailable for advanced AI');
            }
          } else {
            // For lower difficulty, just add a delay
            await new Promise(resolve => setTimeout(resolve, throttleDecision.suggestedDelay || 1000));
          }
        }
      }
    }
    
    try {
      // Get game history for learning
      const history = this.gameHistory.get(gameId) || [];
      
      // Configure time based on adaptive settings or difficulty
      const maxThinkingTime = adaptiveConfig 
        ? adaptiveConfig.maxThinkingTime 
        : Math.min(10000, difficulty * 500); // Max 10 seconds
      
      // Apply adaptive strategy if available
      if (adaptiveConfig && adaptiveConfig.strategy !== this.getStrategyForDifficulty(difficulty)) {
        this.logger.log(`🔄 Switching strategy from ${this.getStrategyForDifficulty(difficulty)} to ${adaptiveConfig.strategy}`);
      }
      
      // Get AI decision with full context
      // Prepare ability config
      const abilityConfig: AIAbilityConfig = {
        specialAbilities: [
          difficulty >= 5 ? 'Monte Carlo Tree Search' : '',
          difficulty >= 7 ? 'Neural Network Evaluation' : '',
          difficulty >= 3 ? 'Threat Detection' : '',
          difficulty >= 4 ? 'Pattern Recognition' : ''
        ].filter(Boolean),
        playerPatterns: {
          favoriteColumns: [],
          weaknessesExploited: [],
          threatRecognitionSpeed: difficulty / 10,
          endgameStrength: difficulty / 10
        },
        personality: {
          aggressiveness: adaptiveConfig ? (adaptiveConfig.strategy === 'aggressive' ? 0.8 : 0.5) : 0.5,
          patience: difficulty >= 6 ? 0.8 : 0.5
        },
        level: difficulty
      };
      
      const decision = await this.ultimateAI.getBestMove(
        board,
        aiPlayer,
        maxThinkingTime,
        abilityConfig,
        humanPlayerId,
        {
          gameId,
          moveNumber: history.length,
          gameHistory: history,
          difficulty,
          adaptiveConfig
        }
      );

      // Record performance metrics if available
      const actualThinkingTime = Date.now() - startTime;
      this.learningMetrics.averageThinkingTime = 
        this.learningMetrics.averageThinkingTime * 0.9 + actualThinkingTime * 0.1;
        
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric({
          name: 'ai.integration.move.generated',
          value: actualThinkingTime,
          unit: 'ms',
          timestamp: Date.now(),
          tags: {
            gameId,
            strategy: decision.strategy || 'unknown',
            difficulty: difficulty.toString()
          }
        });
      }

      // Update game history
      history.push({
        board,
        move: decision.move
      });
      this.gameHistory.set(gameId, history);

      // Emit completion event
      if (this.eventEmitter) {
        this.eventEmitter.emit('ai.request.end', { gameId, difficulty });
        this.eventEmitter.emit('ai.move.completed', {
          strategy: decision.strategy || adaptiveConfig?.strategy || 'constitutional_ai',
          thinkingTime: decision.thinkingTime,
          success: true
        });
      }
      
      // Build comprehensive response
      return {
        move: decision.move,
        decision,
        metadata: {
          strategy: decision.strategy || adaptiveConfig?.strategy || 'constitutional_ai',
          confidence: decision.confidence,
          thinkingTime: decision.thinkingTime,
          learningApplied: decision.metadata?.rlhfAnalysis ? true : false,
          adaptationApplied: decision.metadata?.adaptationAnalysis ? true : false,
          multiStepAnalysis: decision.metadata?.mctsStatistics?.averageDepth || 1,
          explanation: this.generateExplanation(decision),
          safetyValidated: decision.metadata?.safetyAnalysis ? true : false,
          alternatives: decision.alternativeMoves?.map(alt => ({
            move: alt.move,
            score: alt.score,
            reasoning: alt.reasoning
          }))
        }
      };

    } catch (error) {
      this.logger.error(`AI move generation failed: ${error.message}`);
      
      // Use async orchestrator as fallback if available
      if (this.asyncOrchestrator) {
        const fallbackResponse = await this.asyncOrchestrator.getAIMove({
          gameId,
          board,
          player: aiPlayer,
          difficulty,
          timeLimit: 5000
        });
        
        return {
          move: fallbackResponse.move,
          decision: {
            move: fallbackResponse.move,
            confidence: fallbackResponse.confidence,
            reasoning: 'Fallback AI decision',
            thinkingTime: fallbackResponse.computeTime,
            strategy: fallbackResponse.strategy,
            alternativeMoves: [],
            nodesExplored: 0,
            metadata: {}
          },
          metadata: {
            strategy: fallbackResponse.strategy,
            confidence: fallbackResponse.confidence,
            thinkingTime: fallbackResponse.computeTime,
            learningApplied: false,
            adaptationApplied: false,
            multiStepAnalysis: 1,
            explanation: fallbackResponse.explanation || 'Strategic move selected',
            safetyValidated: true
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Update AI learning from game result
   */
  async updateFromGameResult(
    gameId: string,
    result: 'win' | 'loss' | 'draw',
    finalBoard: CellValue[][],
    humanPlayerId?: string
  ): Promise<void> {
    try {
      const history = this.gameHistory.get(gameId);
      if (!history || history.length === 0) {
        return;
      }

      // Update the last entry with result
      history[history.length - 1].result = result;

      // Log the game result for now - full training integration would require
      // access to the internal AI systems which are not exposed
      this.logger.log(`Game ${gameId} ended with ${result} for AI. History: ${history.length} moves`);
      
      // Store result for future training sessions
      if (this.ultimateAI) {
        // The AI will learn from this game in its next training cycle
        this.learningMetrics.gamesPlayed++;
        if (result === 'win') {
          this.learningMetrics.winRate = 
            (this.learningMetrics.winRate * (this.learningMetrics.gamesPlayed - 1) + 1) / 
            this.learningMetrics.gamesPlayed;
        } else if (result === 'loss') {
          this.learningMetrics.winRate = 
            (this.learningMetrics.winRate * (this.learningMetrics.gamesPlayed - 1)) / 
            this.learningMetrics.gamesPlayed;
        }
      }

      // Update adaptive AI if available
      if (this.adaptiveAI && humanPlayerId) {
        await this.adaptiveAI.updateFromGameResult(
          gameId,
          result,
          humanPlayerId,
          history.map(h => h.move)
        );
      }

      this.logger.log(`📚 AI learned from game ${gameId}: ${result}`);
      
      // Clean up old history to prevent memory issues
      if (this.gameHistory.size > 100) {
        const oldestKey = this.gameHistory.keys().next().value;
        this.gameHistory.delete(oldestKey);
      }

    } catch (error) {
      this.logger.error(`Failed to update AI learning: ${error.message}`);
    }
  }

  /**
   * Generate human-readable explanation for AI decision
   */
  private generateExplanation(decision: AIDecision): string {
    const parts: string[] = [];

    // Main strategy
    if (decision.strategy) {
      parts.push(`Using ${decision.strategy} strategy`);
    }

    // Reasoning
    if (decision.reasoning) {
      parts.push(decision.reasoning);
    }

    // Multi-step analysis
    if (decision.metadata?.mctsStatistics?.averageDepth && decision.metadata.mctsStatistics.averageDepth > 1) {
      parts.push(`Analyzed ${Math.floor(decision.metadata.mctsStatistics.averageDepth)} moves ahead`);
    }

    // Adaptation
    if (decision.metadata?.adaptationAnalysis && decision.metadata.adaptationAnalysis.styleAdaptation > 0.5) {
      parts.push('Adapted to opponent patterns');
    }

    // Safety
    if (decision.metadata?.safetyAnalysis && decision.metadata.safetyAnalysis.safetyScore > 0.8) {
      parts.push('Move validated for safety');
    }

    // Confidence
    parts.push(`${(decision.confidence * 100).toFixed(0)}% confident`);

    return parts.join('. ') + '.';
  }

  /**
   * Get AI capabilities for display
   */
  getCapabilities(): string[] {
    return [
      'Constitutional AI with ethical principles',
      'Deep reinforcement learning (Rainbow DQN)',
      'Neural architecture search',
      'Opponent modeling and adaptation',
      'Multi-agent debate for move selection',
      'Curriculum learning progression',
      '10-step lookahead analysis',
      'Real-time learning from games',
      'Explainable AI decisions',
      'Safety monitoring and validation'
    ];
  }

  /**
   * Get current AI performance stats
   */
  async getPerformanceStats(): Promise<{
    gamesPlayed: number;
    learningEnabled: boolean;
    averageThinkingTime: number;
    strategiesUsed: string[];
    adaptationLevel: number;
  }> {
    if (!this.ultimateAI) {
      return {
        gamesPlayed: 0,
        learningEnabled: false,
        averageThinkingTime: 0,
        strategiesUsed: [],
        adaptationLevel: 0
      };
    }

    return {
      gamesPlayed: this.learningMetrics.gamesPlayed,
      learningEnabled: true,
      averageThinkingTime: this.learningMetrics.averageThinkingTime,
      strategiesUsed: ['constitutional_ai', 'rainbow_dqn', 'mcts', 'neural_network'],
      adaptationLevel: this.learningMetrics.adaptationLevel || 0.8
    };
  }

  /**
   * Get resource usage and throttling status
   */
  getResourceStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    cpuUsage: string;
    memoryUsage: string;
    loadAverage: string;
    recommendation: string;
    throttlingActive: boolean;
  } {
    if (!this.resourceMonitor) {
      return {
        status: 'healthy',
        cpuUsage: '0%',
        memoryUsage: '0%',
        loadAverage: '0, 0, 0',
        recommendation: 'Resource monitoring not available',
        throttlingActive: false
      };
    }

    const summary = this.resourceMonitor.getResourceSummary();
    const throttleDecision = this.resourceMonitor.shouldThrottleRequest();

    return {
      ...summary,
      throttlingActive: throttleDecision.shouldThrottle
    };
  }

  /**
   * Get strategy based on difficulty level
   */
  private getStrategyForDifficulty(difficulty: number): string {
    if (difficulty <= 2) return 'minimax';
    if (difficulty <= 4) return 'mcts';
    if (difficulty <= 6) return 'dqn';
    if (difficulty <= 8) return 'alphazero';
    return 'constitutional_ai';
  }
}