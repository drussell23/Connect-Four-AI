// backend/src/ai/async/strategy-selector.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

export enum AIStrategy {
  MINIMAX = 'MINIMAX',
  ALPHA_BETA = 'ALPHA_BETA',
  MCTS = 'MCTS',
  DQN = 'DQN',
  ALPHAZERO = 'ALPHAZERO',
  MUZERO = 'MUZERO',
  PPO = 'PPO',
  SAC = 'SAC',
  TD3 = 'TD3',
  A3C = 'A3C',
  RAINBOW = 'RAINBOW',
  IMPALA = 'IMPALA',
  HYBRID = 'HYBRID'
}

export interface GameState {
  board: CellValue[][];
  currentPlayer: CellValue;
  moveNumber: number;
  timeRemaining?: number;
  difficulty: number;
}

export interface StrategyMetrics {
  winRate: number;
  avgMoveTime: number;
  avgDepthReached: number;
  confidenceScore: number;
  resourceUsage: number;
}

export interface StrategySelection {
  primary: AIStrategy;
  fallback?: AIStrategy;
  confidence: number;
  reasoning: string;
  estimatedTime: number;
  resourceRequirements: {
    cpu: number;
    memory: number;
    gpu?: boolean;
  };
}

export interface StrategyPerformance {
  strategy: AIStrategy;
  gamesPlayed: number;
  wins: number;
  avgMoveTime: number;
  avgConfidence: number;
  lastUsed: number;
  successRate: number;
}

@Injectable()
export class DynamicStrategySelector {
  private readonly logger = new Logger(DynamicStrategySelector.name);
  private readonly strategyMetrics = new Map<AIStrategy, StrategyMetrics>();
  private readonly strategyPerformance = new Map<AIStrategy, StrategyPerformance>();
  private readonly contextualWeights = new Map<string, number>();
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeStrategies();
  }

  /**
   * Select the best AI strategy based on game state and context
   */
  async selectStrategy(gameState: GameState): Promise<StrategySelection> {
    const startTime = Date.now();
    
    // Analyze game phase
    const gamePhase = this.analyzeGamePhase(gameState);
    
    // Get candidate strategies
    const candidates = this.getCandidateStrategies(gameState, gamePhase);
    
    // Score each candidate
    const scores = new Map<AIStrategy, number>();
    for (const strategy of candidates) {
      const score = await this.scoreStrategy(strategy, gameState, gamePhase);
      scores.set(strategy, score);
    }

    // Log all strategy scores
    this.logger.log(`📈 [Strategy Evaluation] Game Phase: ${gamePhase}, Move #${gameState.moveNumber}`);
    for (const [strategy, score] of scores) {
      this.logger.log(`  • ${strategy}: ${(score * 100).toFixed(1)}%`);
    }
    
    // Select best strategy
    let bestStrategy = AIStrategy.MINIMAX;
    let bestScore = -Infinity;
    
    for (const [strategy, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    // Determine fallback strategy
    const fallbackStrategy = this.selectFallbackStrategy(bestStrategy, gameState);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(bestScore, scores);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(bestStrategy, gameState, gamePhase);
    
    // Estimate resource requirements
    const resourceRequirements = this.estimateResources(bestStrategy, gameState);
    
    const selection: StrategySelection = {
      primary: bestStrategy,
      fallback: fallbackStrategy,
      confidence,
      reasoning,
      estimatedTime: this.estimateExecutionTime(bestStrategy, gameState),
      resourceRequirements
    };

    // Emit selection event
    this.eventEmitter.emit('strategy.selected', {
      gameState,
      selection,
      selectionTime: Date.now() - startTime
    });

    this.logger.log(`🎯 [Strategy Selected] ${bestStrategy} with ${(confidence * 100).toFixed(1)}% confidence`);
    if (fallbackStrategy) {
      this.logger.log(`  ↳ Fallback: ${fallbackStrategy}`);
    }
    this.logger.log(`  ↳ Reasoning: ${reasoning}`);
    
    return selection;
  }

  /**
   * Update strategy performance based on game outcome
   */
  updatePerformance(
    strategy: AIStrategy,
    outcome: 'win' | 'loss' | 'draw',
    moveTime: number,
    confidence: number
  ): void {
    const perf = this.strategyPerformance.get(strategy) || this.createDefaultPerformance(strategy);
    
    perf.gamesPlayed++;
    if (outcome === 'win') {
      perf.wins++;
    }
    
    // Update moving averages
    perf.avgMoveTime = (perf.avgMoveTime * (perf.gamesPlayed - 1) + moveTime) / perf.gamesPlayed;
    perf.avgConfidence = (perf.avgConfidence * (perf.gamesPlayed - 1) + confidence) / perf.gamesPlayed;
    perf.lastUsed = Date.now();
    perf.successRate = perf.wins / perf.gamesPlayed;
    
    this.strategyPerformance.set(strategy, perf);
    
    this.eventEmitter.emit('strategy.performance.updated', {
      strategy,
      performance: perf
    });
  }

  /**
   * Get strategy recommendations for a specific game context
   */
  async getRecommendations(gameState: GameState): Promise<{
    strategies: Array<{
      strategy: AIStrategy;
      score: number;
      pros: string[];
      cons: string[];
      suitability: 'excellent' | 'good' | 'fair' | 'poor';
    }>;
    bestFor: string[];
    considerations: string[];
  }> {
    const gamePhase = this.analyzeGamePhase(gameState);
    const strategies: Array<{
      strategy: AIStrategy;
      score: number;
      pros: string[];
      cons: string[];
      suitability: 'excellent' | 'good' | 'fair' | 'poor';
    }> = [];

    // Analyze each strategy
    for (const strategy of Object.values(AIStrategy)) {
      if (strategy === AIStrategy.HYBRID) continue;
      
      const score = await this.scoreStrategy(strategy, gameState, gamePhase);
      const analysis = this.analyzeStrategySuitability(strategy, gameState, gamePhase);
      
      strategies.push({
        strategy,
        score,
        pros: analysis.pros,
        cons: analysis.cons,
        suitability: this.categorizeSuitability(score)
      });
    }

    // Sort by score
    strategies.sort((a, b) => b.score - a.score);

    // Generate recommendations
    const bestFor = this.generateBestForRecommendations(gameState, gamePhase);
    const considerations = this.generateConsiderations(gameState);

    return {
      strategies,
      bestFor,
      considerations
    };
  }

  /**
   * Create a hybrid strategy combining multiple approaches
   */
  createHybridStrategy(
    strategies: AIStrategy[],
    weights: number[]
  ): (gameState: GameState) => Promise<{ column: number; confidence: number }> {
    return async (gameState: GameState) => {
      const results: Array<{ column: number; confidence: number; weight: number }> = [];

      // Execute each strategy
      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        const weight = weights[i];
        
        try {
          const result = await this.executeStrategy(strategy, gameState);
          results.push({ ...result, weight });
        } catch (error) {
          this.logger.error(`Strategy ${strategy} failed:`, error);
        }
      }

      // Combine results
      const columnVotes = new Map<number, number>();
      let totalConfidence = 0;

      for (const result of results) {
        const score = result.confidence * result.weight;
        columnVotes.set(
          result.column,
          (columnVotes.get(result.column) || 0) + score
        );
        totalConfidence += result.confidence * result.weight;
      }

      // Select best column
      let bestColumn = 0;
      let bestScore = -Infinity;

      for (const [column, score] of columnVotes) {
        if (score > bestScore) {
          bestScore = score;
          bestColumn = column;
        }
      }

      const confidence = totalConfidence / weights.reduce((a, b) => a + b, 0);

      this.eventEmitter.emit('hybrid.move', {
        strategies,
        weights,
        selectedColumn: bestColumn,
        confidence
      });

      return { column: bestColumn, confidence };
    };
  }

  private initializeStrategies(): void {
    // Initialize default metrics for each strategy
    const defaultMetrics: Record<AIStrategy, StrategyMetrics> = {
      [AIStrategy.MINIMAX]: { winRate: 0.6, avgMoveTime: 50, avgDepthReached: 6, confidenceScore: 0.7, resourceUsage: 0.2 },
      [AIStrategy.ALPHA_BETA]: { winRate: 0.65, avgMoveTime: 30, avgDepthReached: 8, confidenceScore: 0.75, resourceUsage: 0.2 },
      [AIStrategy.MCTS]: { winRate: 0.75, avgMoveTime: 200, avgDepthReached: 20, confidenceScore: 0.85, resourceUsage: 0.4 },
      [AIStrategy.DQN]: { winRate: 0.7, avgMoveTime: 100, avgDepthReached: 10, confidenceScore: 0.8, resourceUsage: 0.6 },
      [AIStrategy.ALPHAZERO]: { winRate: 0.9, avgMoveTime: 300, avgDepthReached: 30, confidenceScore: 0.95, resourceUsage: 0.8 },
      [AIStrategy.MUZERO]: { winRate: 0.92, avgMoveTime: 400, avgDepthReached: 35, confidenceScore: 0.96, resourceUsage: 0.9 },
      [AIStrategy.PPO]: { winRate: 0.72, avgMoveTime: 150, avgDepthReached: 12, confidenceScore: 0.82, resourceUsage: 0.5 },
      [AIStrategy.SAC]: { winRate: 0.73, avgMoveTime: 180, avgDepthReached: 14, confidenceScore: 0.83, resourceUsage: 0.55 },
      [AIStrategy.TD3]: { winRate: 0.74, avgMoveTime: 170, avgDepthReached: 13, confidenceScore: 0.84, resourceUsage: 0.52 },
      [AIStrategy.A3C]: { winRate: 0.71, avgMoveTime: 120, avgDepthReached: 11, confidenceScore: 0.81, resourceUsage: 0.45 },
      [AIStrategy.RAINBOW]: { winRate: 0.76, avgMoveTime: 250, avgDepthReached: 16, confidenceScore: 0.86, resourceUsage: 0.65 },
      [AIStrategy.IMPALA]: { winRate: 0.77, avgMoveTime: 220, avgDepthReached: 18, confidenceScore: 0.87, resourceUsage: 0.6 },
      [AIStrategy.HYBRID]: { winRate: 0.85, avgMoveTime: 300, avgDepthReached: 25, confidenceScore: 0.9, resourceUsage: 0.7 }
    };

    for (const [strategy, metrics] of Object.entries(defaultMetrics)) {
      this.strategyMetrics.set(strategy as AIStrategy, metrics);
    }
  }

  private analyzeGamePhase(gameState: GameState): 'opening' | 'midgame' | 'endgame' {
    const filledCells = gameState.board.flat().filter(cell => cell !== 'Empty').length;
    const totalCells = 42;
    const fillRatio = filledCells / totalCells;

    if (fillRatio < 0.25) return 'opening';
    if (fillRatio < 0.75) return 'midgame';
    return 'endgame';
  }

  private getCandidateStrategies(gameState: GameState, gamePhase: string): AIStrategy[] {
    const candidates: AIStrategy[] = [];
    
    // Always include basic strategies as candidates
    candidates.push(AIStrategy.MINIMAX, AIStrategy.ALPHA_BETA);

    // Add advanced strategies based on difficulty
    if (gameState.difficulty >= 5) {
      candidates.push(AIStrategy.MCTS);
    }
    
    if (gameState.difficulty >= 10) {
      candidates.push(AIStrategy.DQN, AIStrategy.PPO);
    }
    
    if (gameState.difficulty >= 15) {
      candidates.push(AIStrategy.ALPHAZERO, AIStrategy.SAC, AIStrategy.TD3);
    }
    
    if (gameState.difficulty >= 20) {
      candidates.push(AIStrategy.MUZERO, AIStrategy.RAINBOW, AIStrategy.IMPALA);
    }

    return candidates;
  }

  private async scoreStrategy(
    strategy: AIStrategy,
    gameState: GameState,
    gamePhase: string
  ): Promise<number> {
    const metrics = this.strategyMetrics.get(strategy)!;
    const performance = this.strategyPerformance.get(strategy);
    
    let score = 0;

    // Base score from metrics
    score += metrics.winRate * 100;
    score += (1 - metrics.avgMoveTime / 1000) * 50; // Favor faster strategies
    score += metrics.confidenceScore * 80;

    // Adjust for game phase
    if (gamePhase === 'opening') {
      if (strategy === AIStrategy.MINIMAX || strategy === AIStrategy.ALPHA_BETA) {
        score += 20; // Simple strategies work well in opening
      }
    } else if (gamePhase === 'endgame') {
      if (strategy === AIStrategy.ALPHAZERO || strategy === AIStrategy.MUZERO) {
        score += 30; // Deep strategies excel in endgame
      }
    }

    // Adjust for difficulty
    if (gameState.difficulty < 10 && metrics.resourceUsage > 0.5) {
      score -= 20; // Penalize resource-heavy strategies for low difficulty
    }

    // Boost based on recent performance
    if (performance && performance.gamesPlayed > 0) {
      score += performance.successRate * 50;
      score += performance.avgConfidence * 30;
      
      // Recency bonus
      const hoursSinceLastUse = (Date.now() - performance.lastUsed) / (1000 * 60 * 60);
      if (hoursSinceLastUse < 1) {
        score += 10; // Recently successful strategy
      }
    }

    // Time constraint adjustment
    if (gameState.timeRemaining && gameState.timeRemaining < 5000) {
      score -= metrics.avgMoveTime / 10; // Penalize slow strategies under time pressure
    }

    return Math.max(0, score);
  }

  private selectFallbackStrategy(primary: AIStrategy, gameState: GameState): AIStrategy {
    // Select a simpler, faster strategy as fallback
    if (primary === AIStrategy.MUZERO || primary === AIStrategy.ALPHAZERO) {
      return AIStrategy.MCTS;
    }
    if (primary === AIStrategy.MCTS || primary === AIStrategy.DQN) {
      return AIStrategy.ALPHA_BETA;
    }
    return AIStrategy.MINIMAX;
  }

  private calculateConfidence(bestScore: number, scores: Map<AIStrategy, number>): number {
    if (scores.size <= 1) return 0.5;

    const scoreValues = Array.from(scores.values()).sort((a, b) => b - a);
    const gap = bestScore - (scoreValues[1] || 0);
    const maxPossibleScore = 300; // Approximate max score

    return Math.min(0.95, 0.5 + (gap / maxPossibleScore));
  }

  private generateReasoning(strategy: AIStrategy, gameState: GameState, gamePhase: string): string {
    const reasons: string[] = [];
    
    reasons.push(`Selected ${strategy} for ${gamePhase} phase`);
    
    if (gameState.difficulty >= 15) {
      reasons.push('High difficulty requires advanced strategy');
    }
    
    if (gameState.timeRemaining && gameState.timeRemaining < 10000) {
      reasons.push('Time pressure considered');
    }

    const metrics = this.strategyMetrics.get(strategy)!;
    reasons.push(`Expected win rate: ${(metrics.winRate * 100).toFixed(0)}%`);

    return reasons.join('. ');
  }

  private estimateExecutionTime(strategy: AIStrategy, gameState: GameState): number {
    const metrics = this.strategyMetrics.get(strategy)!;
    let baseTime = metrics.avgMoveTime;

    // Adjust for board complexity
    const filledCells = gameState.board.flat().filter(cell => cell !== 'Empty').length;
    const complexityMultiplier = 1 + (filledCells / 42) * 0.5;

    return Math.round(baseTime * complexityMultiplier);
  }

  private estimateResources(strategy: AIStrategy, gameState: GameState): {
    cpu: number;
    memory: number;
    gpu?: boolean;
  } {
    const metrics = this.strategyMetrics.get(strategy)!;
    
    return {
      cpu: Math.round(metrics.resourceUsage * 100),
      memory: Math.round(metrics.resourceUsage * 1024), // MB
      gpu: metrics.resourceUsage > 0.7
    };
  }

  private createDefaultPerformance(strategy: AIStrategy): StrategyPerformance {
    return {
      strategy,
      gamesPlayed: 0,
      wins: 0,
      avgMoveTime: 0,
      avgConfidence: 0,
      lastUsed: Date.now(),
      successRate: 0
    };
  }

  private analyzeStrategySuitability(
    strategy: AIStrategy,
    gameState: GameState,
    gamePhase: string
  ): { pros: string[]; cons: string[] } {
    const pros: string[] = [];
    const cons: string[] = [];
    const metrics = this.strategyMetrics.get(strategy)!;

    // Analyze pros
    if (metrics.winRate > 0.8) pros.push('High win rate');
    if (metrics.avgMoveTime < 100) pros.push('Fast execution');
    if (metrics.confidenceScore > 0.85) pros.push('High confidence');
    if (metrics.avgDepthReached > 15) pros.push('Deep analysis');

    // Analyze cons
    if (metrics.resourceUsage > 0.7) cons.push('Resource intensive');
    if (metrics.avgMoveTime > 300) cons.push('Slow execution');
    if (gameState.difficulty < 10 && metrics.resourceUsage > 0.5) {
      cons.push('Overkill for current difficulty');
    }

    return { pros, cons };
  }

  private categorizeSuitability(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score > 200) return 'excellent';
    if (score > 150) return 'good';
    if (score > 100) return 'fair';
    return 'poor';
  }

  private generateBestForRecommendations(gameState: GameState, gamePhase: string): string[] {
    const recommendations: string[] = [];
    
    if (gamePhase === 'opening') {
      recommendations.push('Quick pattern recognition');
      recommendations.push('Strategic positioning');
    } else if (gamePhase === 'midgame') {
      recommendations.push('Complex tactical calculations');
      recommendations.push('Multi-threat creation');
    } else {
      recommendations.push('Deep endgame analysis');
      recommendations.push('Perfect play calculation');
    }

    if (gameState.difficulty >= 15) {
      recommendations.push('Championship-level play');
    }

    return recommendations;
  }

  private generateConsiderations(gameState: GameState): string[] {
    const considerations: string[] = [];
    
    if (gameState.timeRemaining && gameState.timeRemaining < 30000) {
      considerations.push('Time management is critical');
    }

    const filledCells = gameState.board.flat().filter(cell => cell !== 'Empty').length;
    if (filledCells > 30) {
      considerations.push('Board is highly complex');
    }

    if (gameState.difficulty >= 20) {
      considerations.push('Maximum AI capability required');
    }

    return considerations;
  }

  private async executeStrategy(
    strategy: AIStrategy,
    gameState: GameState
  ): Promise<{ column: number; confidence: number }> {
    // This would integrate with actual AI implementations
    // For now, return a mock response
    this.logger.debug(`Executing strategy ${strategy}`);
    
    return {
      column: Math.floor(Math.random() * 7),
      confidence: 0.5 + Math.random() * 0.5
    };
  }
}