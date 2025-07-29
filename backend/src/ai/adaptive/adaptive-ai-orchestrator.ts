import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { PerformanceMonitor } from '../async/performance-monitor';
import { CellValue } from '../connect4AI';
import { ReinforcementLearningService } from '../learning/reinforcement-learning.service';
import { EnhancedRLService } from '../learning/enhanced-rl.service';
import { AdaptiveThrottleService } from '../resource-management/adaptive-throttle.service';
import { IntelligentResourceManager } from '../resource-management/intelligent-resource-manager';
import { StrategicAIEngine } from '../strategy/strategic-ai-engine';
import { getDifficultyConfig } from '../config/difficulty-config';

export interface GameCriticality {
  score: number; // 0-1, where 1 is most critical
  factors: {
    winningThreat: number;
    losingThreat: number;
    strategicImportance: number;
    gamePhase: number;
    moveComplexity: number;
  };
  recommendedDepth: number;
  useAdvancedAI: boolean;
  timeAllocation: number; // milliseconds
}

export interface MoveAnalysis {
  column: number;
  confidence: number;
  criticalityScore: number;
  computationTime: number;
  servicesUsed: string[];
  explanation: string;
  alternativeMoves?: Array<{
    column: number;
    score: number;
    reason: string;
  }>;
}

@Injectable()
export class AdaptiveAIOrchestrator {
  private readonly logger = new Logger(AdaptiveAIOrchestrator.name);
  private readonly MIN_RESPONSE_TIME = 800; // Natural human-like minimum (0.8s)
  private readonly MAX_RESPONSE_TIME = 2500; // Maximum time for critical moves (2.5s)
  private gameHistory: Map<string, MoveAnalysis[]> = new Map();

  constructor(
    private readonly asyncOrchestrator: AsyncAIOrchestrator,
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly learningService?: ReinforcementLearningService,
    @Optional() private readonly enhancedRLService?: EnhancedRLService,
    @Optional() private readonly throttleService?: AdaptiveThrottleService,
    @Optional() private readonly resourceManager?: IntelligentResourceManager,
    @Optional() private readonly strategicEngine?: StrategicAIEngine,
  ) {}

  /**
   * Intelligently compute the next move based on game criticality
   */
  async computeAdaptiveMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Map frontend difficulty (1-25) to backend scale (1-10)
    const backendDifficulty = this.mapFrontendToBackendDifficulty(difficulty);
    const difficultyName = this.getDifficultyName(difficulty);
    this.logger.log(`[${gameId}] AI Level ${difficulty} (${difficultyName}) → Backend difficulty: ${backendDifficulty.toFixed(1)}/10`);
    
    // Emit difficulty mapping for frontend logging
    this.eventEmitter.emit('ai.difficulty.mapped', {
      gameId,
      frontendLevel: difficulty,
      backendDifficulty,
      difficultyName,
      timestamp: Date.now(),
    });
    
    // Analyze game criticality to determine computational resources
    const criticality = this.analyzeGameCriticality(board, player, backendDifficulty);
    
    // Check resource availability before computing
    if (this.resourceManager) {
      const resourceStatus = this.resourceManager.getResourceStatus();
      if (resourceStatus.current.memory > 95 || resourceStatus.current.cpu > 95) {
        this.logger.warn(`High resource usage detected: CPU ${resourceStatus.current.cpu.toFixed(1)}%, Memory ${resourceStatus.current.memory.toFixed(1)}%`);
        // Reduce criticality to use less resources
        criticality.score = Math.min(criticality.score * 0.7, 0.5);
        criticality.recommendedDepth = Math.min(criticality.recommendedDepth, 4);
        criticality.timeAllocation = Math.min(criticality.timeAllocation, 1000);
      }
    }
    
    this.logger.log(`[${gameId}] Game criticality: ${criticality.score.toFixed(2)}`);
    this.logger.debug(`[${gameId}] Criticality factors:`, criticality.factors);

    // Emit criticality analysis for frontend
    this.eventEmitter.emit('ai.criticality.analyzed', {
      gameId,
      criticality,
      timestamp: Date.now(),
    });

    let moveAnalysis: MoveAnalysis;

    // Adjust thresholds based on difficulty - higher difficulty should use more computation
    const lowThreshold = Math.max(0.1, 0.3 - backendDifficulty * 0.03);
    const highThreshold = Math.max(0.3, 0.6 - backendDifficulty * 0.05);
    
    // Submit move computation through throttle service if available
    if (this.throttleService) {
      const priority = Math.ceil(criticality.score * 10);
      const estimatedResources = this.estimateResourceRequirements(criticality, backendDifficulty);
      
      try {
        moveAnalysis = await this.throttleService.submitRequest({
          id: `ai-move-${gameId}-${Date.now()}`,
          type: 'ai-move-computation',
          priority,
          estimatedDuration: criticality.timeAllocation,
          resourceRequirements: estimatedResources,
          callback: async () => {
            // Compute move based on criticality
            if (backendDifficulty >= 8) {
              return await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty, difficulty);
            } else if (criticality.score < lowThreshold && backendDifficulty < 5) {
              return await this.computeFastMove(gameId, board, player, criticality, backendDifficulty, difficulty);
            } else if (criticality.score < highThreshold) {
              return await this.computeBalancedMove(gameId, board, player, criticality, backendDifficulty, difficulty);
            } else {
              return await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty, difficulty);
            }
          }
        });
      } catch (error) {
        this.logger.warn(`Throttle service error, falling back to direct computation: ${error.message}`);
        // Fallback to direct computation
        if (backendDifficulty >= 8) {
          moveAnalysis = await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty, difficulty);
        } else if (criticality.score < lowThreshold && backendDifficulty < 5) {
          moveAnalysis = await this.computeFastMove(gameId, board, player, criticality, backendDifficulty, difficulty);
        } else if (criticality.score < highThreshold) {
          moveAnalysis = await this.computeBalancedMove(gameId, board, player, criticality, backendDifficulty, difficulty);
        } else {
          moveAnalysis = await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty, difficulty);
        }
      }
    } else {
      // Direct computation without throttling
      if (backendDifficulty >= 8) {
        moveAnalysis = await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty);
      } else if (criticality.score < lowThreshold && backendDifficulty < 5) {
        moveAnalysis = await this.computeFastMove(gameId, board, player, criticality, backendDifficulty, difficulty);
      } else if (criticality.score < highThreshold) {
        moveAnalysis = await this.computeBalancedMove(gameId, board, player, criticality, backendDifficulty);
      } else {
        moveAnalysis = await this.computeDeepMove(gameId, board, player, criticality, backendDifficulty);
      }
    }

    // Ensure appropriate response time based on difficulty
    const elapsed = Date.now() - startTime;
    // Scale minimum time with difficulty (0.8s to 1.8s base)
    const minTimeByDifficulty = this.MIN_RESPONSE_TIME + (backendDifficulty * 100);
    // Add randomness for natural feel
    const targetTime = minTimeByDifficulty + (Math.random() * 400 - 200);
    
    // Ensure we used at least the allocated computation time for higher difficulties
    if (backendDifficulty >= 7 && elapsed < criticality.timeAllocation * 0.6) {
      await this.delay(criticality.timeAllocation * 0.6 - elapsed);
    } else if (elapsed < targetTime) {
      await this.delay(targetTime - elapsed);
    }

    // Store move in history for learning
    this.updateGameHistory(gameId, moveAnalysis);
    
    // Emit move evaluation for learning
    this.eventEmitter.emit('ai.move.evaluated', {
      gameId,
      board,
      column: moveAnalysis.column,
      evaluation: moveAnalysis.confidence,
      difficulty,
    });

    // Emit move completion
    this.eventEmitter.emit('ai.move.computed', {
      gameId,
      moveAnalysis,
      actualTime: Date.now() - startTime,
    });

    return moveAnalysis;
  }

  /**
   * Analyze game criticality to determine resource allocation
   */
  private analyzeGameCriticality(board: CellValue[][], player: CellValue, difficulty: number = 5): GameCriticality {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Difficulty scaling factor (0.5 to 2.0)
    const difficultyFactor = 0.5 + (difficulty / 10) * 1.5;
    
    // Count total moves
    const totalMoves = board.flat().filter(cell => cell !== null).length;
    const gameProgress = totalMoves / 42; // 0 to 1
    
    // Analyze threats
    const winningThreat = this.detectWinningThreat(board, player);
    const losingThreat = this.detectLosingThreat(board, opponent);
    
    // Analyze strategic importance
    const strategicImportance = this.evaluateStrategicImportance(board, totalMoves);
    
    // Determine game phase factor
    const gamePhase = this.getGamePhaseFactor(totalMoves);
    
    // Calculate move complexity
    const moveComplexity = this.calculateMoveComplexity(board);
    
    // Calculate base criticality score
    const baseCriticality = 
      winningThreat * 0.35 +
      losingThreat * 0.35 +
      strategicImportance * 0.15 +
      gamePhase * 0.10 +
      moveComplexity * 0.05;
    
    // Apply difficulty scaling - higher difficulty = higher criticality
    const criticalityScore = Math.min(1, baseCriticality * difficultyFactor + (difficulty / 20));
    
    // Determine computational parameters with difficulty scaling
    const recommendedDepth = this.getRecommendedDepth(criticalityScore, totalMoves, difficulty);
    // Use advanced AI more aggressively at higher difficulties
    const useAdvancedAI = difficulty >= 7 || criticalityScore > 0.4 || winningThreat > 0.6 || losingThreat > 0.6;
    const timeAllocation = this.calculateTimeAllocation(criticalityScore, difficulty);
    
    return {
      score: criticalityScore,
      factors: {
        winningThreat,
        losingThreat,
        strategicImportance,
        gamePhase,
        moveComplexity,
      },
      recommendedDepth,
      useAdvancedAI,
      timeAllocation,
    };
  }

  /**
   * Detect immediate winning opportunities
   */
  private detectWinningThreat(board: CellValue[][], player: CellValue): number {
    let maxThreat = 0;
    let winSetups = 0;
    const threats: Array<{col: number, threat: number}> = [];
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== null) continue;
      
      // Simulate move
      const row = this.getNextRow(board, col);
      if (row === -1) continue;
      
      board[row][col] = player;
      const isWin = this.checkWin(board, row, col, player);
      board[row][col] = null;
      
      if (isWin) return 1.0; // Immediate win available
      
      // Check for multiple win setups
      const threat = this.evaluatePositionThreat(board, row, col, player);
      if (threat > 0.5) {
        winSetups++;
        threats.push({col, threat});
      }
      maxThreat = Math.max(maxThreat, threat);
    }
    
    // Bonus for multiple threats (fork opportunities)
    if (winSetups > 1) {
      // Multiple winning paths = very dangerous
      maxThreat = Math.min(1.0, maxThreat + 0.2 * winSetups);
    }
    
    return maxThreat;
  }

  /**
   * Detect opponent's winning threats
   */
  private detectLosingThreat(board: CellValue[][], opponent: CellValue): number {
    let maxThreat = 0;
    
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== null) continue;
      
      const row = this.getNextRow(board, col);
      if (row === -1) continue;
      
      board[row][col] = opponent;
      const isWin = this.checkWin(board, row, col, opponent);
      board[row][col] = null;
      
      if (isWin) return 1.0; // Must block immediate win
      
      const threat = this.evaluatePositionThreat(board, row, col, opponent);
      maxThreat = Math.max(maxThreat, threat);
    }
    
    return maxThreat;
  }

  /**
   * Fast move computation for low-criticality situations
   */
  private async computeFastMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    backendDifficulty?: number,
    frontendDifficulty?: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Use the frontend difficulty for strategic engine (1-25 scale)
    const strategicDifficulty = frontendDifficulty || Math.round((backendDifficulty || 5) * 2.5);
    const config = getDifficultyConfig(strategicDifficulty);
    
    // Use strategic engine for all difficulty levels (even level 1 has basic awareness)
    if (this.strategicEngine) {
      const strategicMove = await this.strategicEngine.getStrategicMove(board, player, strategicDifficulty);
      
      return {
        column: strategicMove.column,
        confidence: 0.7 + (strategicMove.priority / 10) * 0.2,
        criticalityScore: criticality.score,
        computationTime: Date.now() - startTime,
        servicesUsed: ['strategic_engine', 'threat_detection'],
        explanation: strategicMove.reasoning,
        alternativeMoves: this.convertThreatsToAlternatives(strategicMove.threatAnalysis),
      };
    }
    
    // Fallback to simple heuristic evaluation
    let bestColumn = 3; // Default center
    let bestScore = -Infinity;
    
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      let score = this.quickEvaluate(board, col, player);
      
      // Apply learned adjustments if available
      if (this.learningService) {
        const learnedValue = this.learningService.getPositionEvaluation(board, criticality.score * 10);
        if (learnedValue !== null) {
          score += learnedValue * 100; // Scale learned value
          this.logger.debug(`Applied learned adjustment: ${learnedValue.toFixed(3)}`);
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestColumn = col;
      }
    }
    
    return {
      column: bestColumn,
      confidence: 0.7 + (criticality.score * 0.1),
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: ['heuristic'],
      explanation: 'Quick strategic move based on position evaluation',
    };
  }

  /**
   * Balanced move computation for medium-criticality situations
   */
  private async computeBalancedMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    backendDifficulty: number,
    frontendDifficulty?: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Use frontend difficulty for strategic engine
    const strategicDifficulty = frontendDifficulty || Math.round(backendDifficulty * 2.5);
    
    // First get strategic move if available
    let strategicMove = null;
    // Use strategic engine for all difficulty levels
    if (this.strategicEngine) {
      strategicMove = await this.strategicEngine.getStrategicMove(board, player, strategicDifficulty);
    }
    
    // Use async orchestrator with appropriate depth
    // Note: Pass difficulty which the orchestrator will use to determine depth and strategies
    const result = await this.asyncOrchestrator.getAIMove({
      gameId,
      board,
      player,
      difficulty: Math.max(backendDifficulty, Math.floor(criticality.score * 10)), // Boost difficulty based on criticality
      timeLimit: criticality.timeAllocation,
    });
    
    // Add alternative moves analysis
    const alternatives = await this.analyzeAlternatives(board, player, result.move);
    
    return {
      column: result.move,
      confidence: result.confidence || 0.85,
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: ['async_orchestrator', 'minimax', 'heuristic'],
      explanation: result.explanation || 'Balanced strategic analysis',
      alternativeMoves: alternatives,
    };
  }

  /**
   * Deep move computation for high-criticality situations
   */
  private async computeDeepMove(
    gameId: string,
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    backendDifficulty: number,
    frontendDifficulty?: number,
  ): Promise<MoveAnalysis> {
    const startTime = Date.now();
    
    // Use frontend difficulty for strategic engine
    const strategicDifficulty = frontendDifficulty || Math.round(backendDifficulty * 2.5);
    
    // Get strategic analysis first
    let strategicMove = null;
    // Use strategic engine for all difficulty levels
    if (this.strategicEngine) {
      strategicMove = await this.strategicEngine.getStrategicMove(board, player, strategicDifficulty);
    }
    
    // Configure advanced analysis based on difficulty
    const strategies = strategicDifficulty >= 16 ? 
      ['alpha_beta', 'mcts', 'neural_network', 'minimax', 'dqn', 'alphazero'] :
      strategicDifficulty >= 11 ?
      ['alpha_beta', 'mcts', 'neural_network', 'minimax'] :
      strategicDifficulty >= 8 ?
      ['alpha_beta', 'mcts', 'minimax'] :
      ['minimax', 'alpha_beta'];
    
    // Stream real-time analysis
    const analysisStream = this.asyncOrchestrator.streamAnalysis(
      {
        gameId,
        board,
        player,
        difficulty: Math.max(backendDifficulty, Math.floor(criticality.score * 10)), // Boost difficulty for critical positions
        timeLimit: criticality.timeAllocation,
      },
      {
        includeVariations: true,
        maxDepth: criticality.recommendedDepth,
        updateInterval: 100,
      }
    );
    
    let bestMove = { column: 3, confidence: 0.5 };
    const servicesUsed = new Set<string>();
    
    // Process stream updates
    for await (const update of analysisStream) {
      switch (update.type) {
        case 'progress':
          servicesUsed.add(update.data.strategy);
          this.eventEmitter.emit('ai.analysis.progress', {
            gameId,
            ...update.data,
          });
          break;
          
        case 'move':
          if (update.data.confidence > bestMove.confidence) {
            bestMove = {
              column: update.data.move,
              confidence: update.data.confidence
            };
          }
          break;
          
        case 'variation':
          this.eventEmitter.emit('ai.variation.found', {
            gameId,
            ...update.data,
          });
          break;
      }
    }
    
    // Final deep analysis if time permits
    if (Date.now() - startTime < criticality.timeAllocation * 0.8) {
      const deepResult = await this.performDeepAnalysis(board, player, criticality, backendDifficulty);
      if (deepResult.confidence > bestMove.confidence) {
        bestMove = deepResult;
        servicesUsed.add('deep_analysis');
      }
    }
    
    // Apply enhanced RL if available and difficulty is high
    if (this.enhancedRLService && strategicDifficulty >= 7) {
      try {
        const enhancedMove = await this.enhancedRLService.getEnhancedMove(
          board,
          player,
          gameId,
          bestMove.column
        );
        
        // Use enhanced move if it's safety approved and has reasonable confidence
        // Don't require it to be better than base move, as RLHF may intentionally reduce confidence
        if (enhancedMove.safetyApproved && enhancedMove.confidence > 0.5) {
          bestMove = {
            column: enhancedMove.column,
            confidence: enhancedMove.confidence
          };
          servicesUsed.add('enhanced_rl');
          servicesUsed.add('rlhf');
          
          // Emit enhanced RL analysis
          this.eventEmitter.emit('ai.enhanced_rl.applied', {
            gameId,
            column: enhancedMove.column,
            explanation: enhancedMove.explanation,
            adaptationApplied: enhancedMove.adaptationApplied,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        this.logger.warn(`Enhanced RL failed, using base move: ${error.message}`);
      }
    }
    
    // Check if strategic move overrides deep analysis
    let finalColumn = bestMove.column;
    let finalConfidence = bestMove.confidence;
    let explanation = `Critical move computed with ${servicesUsed.size} AI services`;
    
    if (strategicMove && strategicMove.priority >= 9) {
      // Very high priority move (win or critical block)
      finalColumn = strategicMove.column;
      finalConfidence = Math.max(finalConfidence, 0.95);
      explanation = `Critical: ${strategicMove.reasoning}`;
      servicesUsed.add('strategic_engine');
    } else if (strategicMove && strategicMove.priority >= 7 && strategicDifficulty >= 11) {
      // High priority move at competitive levels
      if (strategicMove.column !== bestMove.column) {
        // Strategic engine found a different threat
        const strategicScore = strategicMove.priority / 10;
        if (strategicScore > bestMove.confidence) {
          finalColumn = strategicMove.column;
          finalConfidence = Math.max(finalConfidence, strategicScore);
          explanation = `Strategic: ${strategicMove.reasoning}`;
          servicesUsed.add('strategic_engine');
        }
      }
    }
    
    return {
      column: finalColumn,
      confidence: finalConfidence,
      criticalityScore: criticality.score,
      computationTime: Date.now() - startTime,
      servicesUsed: Array.from(servicesUsed),
      explanation: explanation,
    };
  }

  /**
   * Helper methods
   */
  private getNextRow(board: CellValue[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === null) return row;
    }
    return -1;
  }

  private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }

  private evaluatePositionThreat(board: CellValue[][], row: number, col: number, player: CellValue): number {
    // Evaluate how threatening a position is (0-1)
    let threatScore = 0;
    let threatsFound = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    board[row][col] = player; // Temporarily place piece
    
    for (const [dr, dc] of directions) {
      let consecutive = 1;
      let openEnds = 0;
      let potentialLength = 1;
      
      // Check in both directions
      for (const mult of [-1, 1]) {
        let pieces = 0;
        let spaces = 0;
        let blocked = false;
        
        for (let i = 1; i <= 3; i++) {
          const r = row + dr * mult * i;
          const c = col + dc * mult * i;
          
          if (r < 0 || r >= 6 || c < 0 || c >= 7) {
            blocked = true;
            break;
          }
          
          if (board[r][c] === player) {
            pieces++;
            consecutive++;
            potentialLength++;
          } else if (board[r][c] === null) {
            spaces++;
            potentialLength++;
            if (spaces === 1 && !blocked) openEnds++;
          } else {
            blocked = true;
            break;
          }
        }
      }
      
      // Evaluate threat level based on pattern
      if (consecutive >= 3 && openEnds >= 1) {
        // Three in a row with space to win
        threatsFound++;
        threatScore = Math.max(threatScore, 0.9);
      } else if (consecutive >= 2 && potentialLength >= 4) {
        // Two in a row with potential to become four
        threatScore = Math.max(threatScore, 0.6 + openEnds * 0.15);
      } else if (potentialLength >= 4) {
        // Space for future development
        threatScore = Math.max(threatScore, 0.3 + consecutive * 0.1);
      }
    }
    
    board[row][col] = null; // Remove temporary piece
    
    // Significant bonus for multiple threats (creating forks)
    if (threatsFound > 1) {
      return 0.95; // Multiple threats = almost certain win
    }
    
    return Math.min(threatScore, 0.9);
  }

  private evaluateStrategicImportance(board: CellValue[][], totalMoves: number): number {
    // Center control importance
    let centerControl = 0;
    const centerCols = [2, 3, 4];
    
    for (const col of centerCols) {
      for (let row = 0; row < 6; row++) {
        if (board[row][col] !== null) {
          centerControl += (6 - row) / 6; // Higher rows are more valuable
        }
      }
    }
    
    // Normalize
    return Math.min(centerControl / 9, 1); // Max 9 center pieces
  }

  private getGamePhaseFactor(totalMoves: number): number {
    if (totalMoves < 8) return 0.3; // Opening
    if (totalMoves < 20) return 0.6; // Middle game
    if (totalMoves < 35) return 0.8; // Late game
    return 1.0; // Endgame
  }

  private calculateMoveComplexity(board: CellValue[][]): number {
    const validMoves = this.getValidMoves(board);
    const complexity = validMoves.length / 7; // More options = more complex
    
    // Add pattern complexity
    let patterns = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== null) {
          patterns += this.countAdjacentPieces(board, row, col) / 8;
        }
      }
    }
    
    return Math.min((complexity + patterns) / 2, 1);
  }

  private countAdjacentPieces(board: CellValue[][], row: number, col: number): number {
    let count = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    
    for (const [dr, dc] of directions) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] !== null) {
        count++;
      }
    }
    
    return count;
  }

  private getRecommendedDepth(criticalityScore: number, totalMoves: number, difficulty: number = 5): number {
    // Base depth scales with difficulty (4-8)
    const baseDepth = Math.floor(4 + (difficulty / 10) * 4);
    const criticalityBonus = Math.floor(criticalityScore * 4);
    const moveBonus = totalMoves > 20 ? 2 : 0;
    const difficultyBonus = Math.floor(difficulty / 2);
    
    // Higher difficulties should look much deeper (up to 15 for difficulty 10)
    return Math.min(baseDepth + criticalityBonus + moveBonus + difficultyBonus, 15);
  }

  private calculateTimeAllocation(criticalityScore: number, difficulty: number = 5): number {
    // Scale time allocation with difficulty
    const minTime = 1000 + (difficulty * 100); // 1-2 seconds minimum
    const maxTime = this.MAX_RESPONSE_TIME + (difficulty * 200); // Up to 4.5s for difficulty 10
    
    const timeAllocation = Math.floor(minTime + (maxTime - minTime) * criticalityScore);
    
    // Ensure high difficulty gets adequate thinking time
    if (difficulty >= 8) {
      return Math.max(timeAllocation, 2000);
    }
    
    return timeAllocation;
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === null) moves.push(col);
    }
    return moves;
  }

  private quickEvaluate(board: CellValue[][], col: number, player: CellValue): number {
    const row = this.getNextRow(board, col);
    if (row === -1) return -Infinity;
    
    // Check for immediate win
    board[row][col] = player;
    const isWin = this.checkWin(board, row, col, player);
    board[row][col] = null;
    
    if (isWin) return 1000;
    
    // Check for blocking opponent win
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    board[row][col] = opponent;
    const isBlock = this.checkWin(board, row, col, opponent);
    board[row][col] = null;
    
    if (isBlock) return 900;
    
    // Prefer center columns
    const centerScore = (3 - Math.abs(col - 3)) * 10;
    
    // Height penalty
    const heightPenalty = row * 2;
    
    return centerScore - heightPenalty + Math.random() * 10;
  }

  private async analyzeAlternatives(
    board: CellValue[][],
    player: CellValue,
    selectedColumn: number,
  ): Promise<MoveAnalysis['alternativeMoves']> {
    const alternatives: MoveAnalysis['alternativeMoves'] = [];
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      if (col === selectedColumn) continue;
      
      const score = this.quickEvaluate(board, col, player);
      alternatives.push({
        column: col,
        score: score / 1000, // Normalize
        reason: this.getMoveReason(board, col, player),
      });
    }
    
    // Sort by score and take top 3
    return alternatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private getMoveReason(board: CellValue[][], col: number, player: CellValue): string {
    const row = this.getNextRow(board, col);
    if (row === -1) return 'Invalid move';
    
    // Check various conditions
    board[row][col] = player;
    const isWin = this.checkWin(board, row, col, player);
    board[row][col] = null;
    
    if (isWin) return 'Winning move';
    
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    board[row][col] = opponent;
    const isBlock = this.checkWin(board, row, col, opponent);
    board[row][col] = null;
    
    if (isBlock) return 'Blocks opponent win';
    
    if (col >= 2 && col <= 4) return 'Center control';
    if (row >= 4) return 'Bottom position';
    
    return 'Strategic position';
  }

  private async performDeepAnalysis(
    board: CellValue[][],
    player: CellValue,
    criticality: GameCriticality,
    difficulty: number,
  ): Promise<{ column: number; confidence: number }> {
    const validMoves = this.getValidMoves(board);
    const scores = new Map<number, number>();
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // Deep analysis with multiple factors
    for (const col of validMoves) {
      let score = 0;
      const row = this.getNextRow(board, col);
      if (row === -1) continue;
      
      // Simulate move
      board[row][col] = player;
      
      // Check immediate win
      if (this.checkWin(board, row, col, player)) {
        board[row][col] = null;
        return { column: col, confidence: 1.0 };
      }
      
      // Evaluate position strength
      const positionStrength = this.evaluatePositionThreat(board, row, col, player);
      score += positionStrength * 1000;
      
      // Check opponent's counter-moves
      let opponentThreats = 0;
      for (const oppCol of validMoves) {
        if (oppCol === col) continue;
        const oppRow = this.getNextRow(board, oppCol);
        if (oppRow === -1) continue;
        
        board[oppRow][oppCol] = opponent;
        if (this.checkWin(board, oppRow, oppCol, opponent)) {
          opponentThreats += 2; // Opponent can win
        } else {
          const threat = this.evaluatePositionThreat(board, oppRow, oppCol, opponent);
          if (threat > 0.7) opponentThreats++;
        }
        board[oppRow][oppCol] = null;
      }
      
      score -= opponentThreats * 200;
      
      // Center preference for higher difficulties
      if (difficulty >= 7) {
        score += (3 - Math.abs(col - 3)) * 50;
      }
      
      board[row][col] = null;
      
      // Apply reinforcement learning adjustments
      if (this.learningService) {
        const boardCopy = board.map(row => [...row]);
        boardCopy[row][col] = player;
        const learnedValue = this.learningService.getPositionEvaluation(boardCopy, difficulty);
        if (learnedValue !== null) {
          score += learnedValue * 500; // Significant weight to learned patterns
          this.logger.debug(`[RL] Position adjustment for col ${col}: ${learnedValue.toFixed(3)}`);
        }
      }
      
      scores.set(col, score);
    }
    
    // Select best move with some randomness at lower difficulties
    const entries = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const topMoves = entries.slice(0, difficulty >= 8 ? 1 : 2);
    const bestMove = topMoves[Math.floor(Math.random() * topMoves.length)];
    
    return {
      column: bestMove[0],
      confidence: Math.min(0.95, 0.8 + (difficulty * 0.02) + (criticality.score * 0.1)),
    };
  }

  private updateGameHistory(gameId: string, move: MoveAnalysis): void {
    if (!this.gameHistory.has(gameId)) {
      this.gameHistory.set(gameId, []);
    }
    
    const history = this.gameHistory.get(gameId)!;
    history.push(move);
    
    // Keep only last 50 moves per game
    if (history.length > 50) {
      history.shift();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Map frontend difficulty (1-25) to backend scale (1-10)
   * Level 1-5: Backend 1-3 (Easy)
   * Level 6-10: Backend 3-5 (Medium)
   * Level 11-15: Backend 5-7 (Hard)
   * Level 16-20: Backend 7-9 (Very Hard)
   * Level 21-25: Backend 9-10 (Ultimate)
   */
  private mapFrontendToBackendDifficulty(frontendDifficulty: number): number {
    // Ensure input is within valid range
    const clampedDifficulty = Math.max(1, Math.min(25, frontendDifficulty));
    
    // Non-linear mapping for smoother progression
    if (clampedDifficulty <= 5) {
      // Levels 1-5: Map to 1-3 (Easy start)
      return 1 + (clampedDifficulty - 1) * 0.5;
    } else if (clampedDifficulty <= 10) {
      // Levels 6-10: Map to 3-5 (Getting challenging)
      return 3 + (clampedDifficulty - 6) * 0.4;
    } else if (clampedDifficulty <= 15) {
      // Levels 11-15: Map to 5-7 (Hard)
      return 5 + (clampedDifficulty - 11) * 0.4;
    } else if (clampedDifficulty <= 20) {
      // Levels 16-20: Map to 7-9 (Very hard)
      return 7 + (clampedDifficulty - 16) * 0.4;
    } else {
      // Levels 21-25: Map to 9-10 (Ultimate challenge)
      return 9 + (clampedDifficulty - 21) * 0.25;
    }
  }

  /**
   * Get human-readable difficulty name based on frontend level
   */
  private getDifficultyName(level: number): string {
    if (level <= 5) return 'Beginner';
    if (level <= 10) return 'Intermediate';
    if (level <= 15) return 'Advanced';
    if (level <= 20) return 'Expert';
    if (level <= 24) return 'Master';
    return 'Ultimate';
  }

  /**
   * Get game insights based on history
   */
  getGameInsights(gameId: string): any {
    const history = this.gameHistory.get(gameId) || [];
    
    if (history.length === 0) return null;
    
    const avgCriticality = history.reduce((sum, m) => sum + m.criticalityScore, 0) / history.length;
    const avgConfidence = history.reduce((sum, m) => sum + m.confidence, 0) / history.length;
    const avgComputationTime = history.reduce((sum, m) => sum + m.computationTime, 0) / history.length;
    
    const servicesUsed = new Set<string>();
    history.forEach(m => m.servicesUsed.forEach(s => servicesUsed.add(s)));
    
    return {
      movesAnalyzed: history.length,
      averageCriticality: avgCriticality,
      averageConfidence: avgConfidence,
      averageComputationTime: Math.round(avgComputationTime),
      uniqueServicesUsed: Array.from(servicesUsed),
      criticalMoves: history.filter(m => m.criticalityScore > 0.7).length,
    };
  }
  
  /**
   * Estimate resource requirements based on criticality and difficulty
   */
  private estimateResourceRequirements(
    criticality: GameCriticality,
    difficulty: number
  ): { cpu: number; memory: number } {
    // Base requirements
    let cpuRequired = 10; // Base 10%
    let memoryRequired = 50 * 1024 * 1024; // Base 50MB
    
    // Scale by criticality
    cpuRequired *= (1 + criticality.score);
    memoryRequired *= (1 + criticality.score * 0.5);
    
    // Scale by difficulty
    cpuRequired *= (1 + difficulty / 10);
    memoryRequired *= (1 + difficulty / 20);
    
    // Factor in recommended depth
    if (criticality.recommendedDepth > 6) {
      cpuRequired *= 1.5;
      memoryRequired *= 2;
    }
    
    // Factor in advanced AI usage
    if (criticality.useAdvancedAI) {
      cpuRequired *= 2;
      memoryRequired *= 2.5;
    }
    
    // Cap at reasonable limits
    cpuRequired = Math.min(cpuRequired, 80); // Max 80% CPU
    memoryRequired = Math.min(memoryRequired, 500 * 1024 * 1024); // Max 500MB
    
    return {
      cpu: Math.ceil(cpuRequired),
      memory: Math.ceil(memoryRequired)
    };
  }
  
  /**
   * Get difficulty level from criticality
   */
  private getDifficultyFromCriticality(criticality: GameCriticality): number {
    // Map criticality score (0-1) to difficulty level (1-25)
    return Math.max(1, Math.min(25, Math.round(criticality.score * 25)));
  }
  
  /**
   * Convert threat analysis to alternative moves
   */
  private convertThreatsToAlternatives(threatAnalysis: any): Array<{
    column: number;
    score: number;
    reason: string;
  }> {
    const alternatives: Array<{ column: number; score: number; reason: string }> = [];
    
    // Add immediate wins
    threatAnalysis.immediateWins?.forEach((threat: any) => {
      alternatives.push({
        column: threat.column,
        score: 1.0,
        reason: 'Winning move'
      });
    });
    
    // Add immediate blocks
    threatAnalysis.immediateBlocks?.forEach((threat: any) => {
      alternatives.push({
        column: threat.column,
        score: 0.9,
        reason: 'Block opponent win'
      });
    });
    
    // Add open-three threats
    threatAnalysis.openThrees?.forEach((threat: any) => {
      alternatives.push({
        column: threat.column,
        score: 0.7,
        reason: threat.player === 'Yellow' ? 'Create open-three' : 'Block open-three'
      });
    });
    
    // Add fork opportunities
    threatAnalysis.forks?.forEach((threat: any) => {
      alternatives.push({
        column: threat.column,
        score: 0.8,
        reason: threat.player === 'Yellow' ? 'Create fork' : 'Block fork'
      });
    });
    
    // Remove duplicates and sort by score
    const uniqueAlternatives = new Map<number, { column: number; score: number; reason: string }>();
    alternatives.forEach(alt => {
      const existing = uniqueAlternatives.get(alt.column);
      if (!existing || existing.score < alt.score) {
        uniqueAlternatives.set(alt.column, alt);
      }
    });
    
    return Array.from(uniqueAlternatives.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Return top 3 alternatives
  }
}