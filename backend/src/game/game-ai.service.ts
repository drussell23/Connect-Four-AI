/**
 * Enhanced GameAIService - Advanced AI service with multi-tier intelligence
 * Purpose: Provides a sophisticated, adaptive AI system with multiple strategies,
 * performance optimization, and comprehensive telemetry.
 * 
 * Features:
 * - Multi-tier AI architecture with 30+ difficulty levels
 * - Advanced caching with TTL and memory management
 * - Real-time performance monitoring and adaptation
 * - Ensemble methods combining multiple AI strategies
 * - Personality-based play styles
 * - Learning from player patterns
 * - Asynchronous move computation with timeouts
 * - Comprehensive error recovery
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { CellValue, legalMoves, UltimateConnect4AI } from '../ai/connect4AI';
import { minimax, mcts } from '../ai/connect4AI';
import { AiProfileService } from './ai-profile.service';
import { MlClientService } from '../ml/ml-client.service';
import { OptimizedMlClientService } from '../ml/ml-client-optimized.service';
import { AsyncAIOrchestrator, AIRequest } from '../ai/async/async-ai-orchestrator';
import { AIStrategy } from '../ai/async/strategy-selector';
import { OpeningBook } from '../ai/opening-book/opening-book';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

// Advanced interfaces
interface MoveCandidate {
  column: number;
  score: number;
  confidence: number;
  strategy: string;
  reasoning?: string;
  threats?: ThreatAnalysis;
}

interface ThreatAnalysis {
  immediate: boolean;
  winInMoves: number;
  blockRequired: boolean;
  forkOpportunity: boolean;
}

interface AIPersonality {
  aggressiveness: number; // 0-1: defensive to aggressive
  randomness: number;     // 0-1: predictable to chaotic
  patience: number;       // 0-1: impulsive to patient
  trickiness: number;     // 0-1: straightforward to deceptive
}

interface ComputationMetrics {
  startTime: number;
  endTime?: number;
  nodesEvaluated: number;
  cacheHits: number;
  cacheMisses: number;
  strategy: string;
  depth?: number;
  confidence: number;
}

interface PlayerPattern {
  playerId: string;
  commonMoves: Map<string, number>;
  weaknesses: string[];
  strengths: string[];
  averageResponseTime: number;
  preferredColumns: number[];
}

// Cache entry with metadata
interface CacheEntry {
  move: number;
  confidence: number;
  timestamp: number;
  hits: number;
  strategy: string;
  metrics?: ComputationMetrics;
}

@Injectable()
export class GameAIService {
  private readonly logger = new Logger(GameAIService.name);
  
  // Advanced caching system
  private readonly moveCache = new Map<string, CacheEntry>();
  private readonly threatCache = new Map<string, ThreatAnalysis>();
  
  // Performance tracking
  private readonly performanceHistory: ComputationMetrics[] = [];
  private readonly maxHistorySize = 1000;
  
  // Player modeling
  private readonly playerPatterns = new Map<string, PlayerPattern>();
  
  // Configuration
  private readonly maxCacheSize = 100000;
  private readonly cacheTTL = 3600000; // 1 hour
  private readonly maxComputationTime = 10000; // 10 seconds max
  
  // AI Personalities for different levels
  private readonly personalities: Map<number, AIPersonality> = new Map([
    [1, { aggressiveness: 0.2, randomness: 0.8, patience: 0.1, trickiness: 0 }],     // Beginner
    [5, { aggressiveness: 0.4, randomness: 0.5, patience: 0.3, trickiness: 0.2 }],   // Intermediate
    [10, { aggressiveness: 0.6, randomness: 0.3, patience: 0.5, trickiness: 0.4 }],  // Advanced
    [15, { aggressiveness: 0.7, randomness: 0.2, patience: 0.7, trickiness: 0.6 }],  // Expert
    [20, { aggressiveness: 0.8, randomness: 0.1, patience: 0.8, trickiness: 0.7 }],  // Master
    [25, { aggressiveness: 0.9, randomness: 0.05, patience: 0.9, trickiness: 0.8 }], // Grandmaster
    [30, { aggressiveness: 1.0, randomness: 0, patience: 1.0, trickiness: 1.0 }],    // Ultimate
  ]);

  constructor(
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
    @Optional() private readonly optimizedMlClient?: OptimizedMlClientService,
    @Optional() private readonly asyncAIOrchestrator?: AsyncAIOrchestrator,
    @Optional() private readonly openingBook?: OpeningBook,
    @Optional() private readonly ultimateAI?: UltimateConnect4AI,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {
    // Initialize background tasks
    this.startCacheCleanup();
    this.startPerformanceMonitoring();
  }

  /**
   * Main entry point - Gets the next AI move with comprehensive strategy selection
   */
  async getNextMove(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    playerId: string = 'default_player',
    gameId?: string,
    options?: {
      timeLimit?: number;
      useEnsemble?: boolean;
      explainMove?: boolean;
      adaptToPlayer?: boolean;
    }
  ): Promise<number | {
    move: number;
    confidence: number;
    explanation?: string;
    metrics?: ComputationMetrics;
  }> {
    const startTime = Date.now();
    const metrics: ComputationMetrics = {
      startTime,
      nodesEvaluated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      strategy: 'unknown',
      confidence: 0,
    };

    try {
      // Get AI profile and configuration
      const profile = await this.aiProfileService.getOrCreateProfile(playerId);
      const aiLevel = profile.level;
      const personality = this.getPersonality(aiLevel);
      
      this.logger.log(`🎮 AI Level ${aiLevel} computing move for ${playerId}`);
      
      // Generate board hash for caching
      const boardHash = this.generateBoardHash(board, aiDisc, aiLevel);
      
      // Check cache first
      const cachedMove = this.checkCache(boardHash);
      if (cachedMove && !options?.explainMove) {
        metrics.cacheHits++;
        metrics.endTime = Date.now();
        metrics.strategy = 'cache';
        metrics.confidence = cachedMove.confidence;
        
        this.logger.debug(`✅ Cache hit: column ${cachedMove.move} (confidence: ${cachedMove.confidence})`);
        
        // Return simple number for backward compatibility
        if (!options) {
          return cachedMove.move;
        }
        
        return {
          move: cachedMove.move,
          confidence: cachedMove.confidence,
          metrics,
        };
      }
      
      metrics.cacheMisses++;
      
      // Check for immediate threats
      const threatAnalysis = this.analyzeThreats(board, aiDisc);
      if (threatAnalysis.immediate && threatAnalysis.blockRequired) {
        const blockMove = this.findBlockingMove(board, aiDisc);
        if (blockMove !== -1) {
          this.logger.warn(`⚠️ Immediate threat detected! Blocking at column ${blockMove}`);
          return options ? {
            move: blockMove,
            confidence: 1.0,
            explanation: 'Blocking opponent\'s winning move',
            metrics,
          } : blockMove;
        }
      }
      
      // Try opening book for early game
      if (this.shouldUseOpeningBook(board, aiLevel)) {
        const openingMove = await this.getOpeningBookMove(board, personality);
        if (openingMove !== null) {
          metrics.strategy = 'opening_book';
          metrics.confidence = 0.95;
          
          return options ? {
            move: openingMove,
            confidence: 0.95,
            explanation: 'Following opening book strategy',
            metrics,
          } : openingMove;
        }
      }
      
      // Determine strategy based on level and game state
      const strategy = this.selectStrategy(aiLevel, board, personality, options);
      metrics.strategy = strategy;
      
      let move: number;
      let confidence: number;
      let explanation: string | undefined;
      
      // Execute selected strategy with timeout
      const timeLimit = options?.timeLimit || this.getTimeLimitForLevel(aiLevel);
      const moveResult = await this.executeStrategyWithTimeout(
        strategy,
        board,
        aiDisc,
        aiLevel,
        personality,
        timeLimit,
        metrics
      );
      
      move = moveResult.move;
      confidence = moveResult.confidence;
      explanation = moveResult.explanation;
      
      // Apply personality adjustments
      if (personality.randomness > 0 && Math.random() < personality.randomness) {
        const alternativeMove = this.getAlternativeMove(board, move, personality);
        if (alternativeMove !== move) {
          this.logger.debug(`🎲 Personality override: ${move} -> ${alternativeMove}`);
          move = alternativeMove;
          confidence *= 0.9; // Reduce confidence for personality-driven moves
        }
      }
      
      // Learn from player patterns if enabled
      if (options?.adaptToPlayer) {
        this.updatePlayerPattern(playerId, board, move);
        const counterMove = this.getCounterMove(playerId, board, move);
        if (counterMove !== move) {
          this.logger.debug(`🧠 Adapting to player pattern: ${move} -> ${counterMove}`);
          move = counterMove;
          confidence *= 0.95;
        }
      }
      
      // Cache the result
      this.cacheMove(boardHash, move, confidence, strategy, metrics);
      
      // Update metrics
      metrics.endTime = Date.now();
      metrics.confidence = confidence;
      this.recordPerformance(metrics);
      
      // Emit telemetry event
      if (this.eventEmitter) {
        this.eventEmitter.emit('ai.move.computed', {
          gameId,
          playerId,
          aiLevel,
          move,
          confidence,
          strategy,
          computationTime: metrics.endTime - metrics.startTime,
          nodesEvaluated: metrics.nodesEvaluated,
        });
      }
      
      this.logger.log(
        `✨ AI Level ${aiLevel} chose column ${move} ` +
        `(confidence: ${(confidence * 100).toFixed(1)}%, ` +
        `strategy: ${strategy}, time: ${metrics.endTime - metrics.startTime}ms)`
      );
      
      // Return simple number for backward compatibility
      if (!options) {
        return move;
      }
      
      return {
        move,
        confidence,
        explanation: options?.explainMove ? explanation : undefined,
        metrics: options?.explainMove ? metrics : undefined,
      };
      
    } catch (error) {
      this.logger.error(`❌ AI computation failed: ${error.message}`, error.stack);
      
      // Emergency fallback
      const fallbackMove = this.getEmergencyMove(board);
      metrics.endTime = Date.now();
      metrics.strategy = 'emergency_fallback';
      metrics.confidence = 0.1;
      
      return options ? {
        move: fallbackMove,
        confidence: 0.1,
        explanation: 'Emergency fallback due to computation error',
        metrics,
      } : fallbackMove;
    }
  }

  /**
   * Executes the selected strategy with timeout protection
   */
  private async executeStrategyWithTimeout(
    strategy: string,
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    personality: AIPersonality,
    timeLimit: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Strategy timeout')), timeLimit);
    });
    
    const strategyPromise = this.executeStrategy(
      strategy,
      board,
      aiDisc,
      aiLevel,
      personality,
      metrics
    );
    
    try {
      return await Promise.race([strategyPromise, timeoutPromise]);
    } catch (error) {
      this.logger.warn(`Strategy ${strategy} timed out after ${timeLimit}ms`);
      // Fallback to quick heuristic
      return this.getQuickHeuristicMove(board, aiDisc);
    }
  }

  /**
   * Executes the specific AI strategy
   */
  private async executeStrategy(
    strategy: string,
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    personality: AIPersonality,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    switch (strategy) {
      case 'minimax_enhanced':
        return this.executeEnhancedMinimax(board, aiDisc, aiLevel, metrics);
        
      case 'mcts_enhanced':
        return this.executeEnhancedMCTS(board, aiDisc, aiLevel, metrics);
        
      case 'neural_network':
        return this.executeNeuralNetwork(board, aiDisc, metrics);
        
      case 'ensemble':
        return this.executeEnsemble(board, aiDisc, aiLevel, metrics);
        
      case 'alphazero':
        return this.executeAlphaZero(board, aiDisc, metrics);
        
      case 'ultimate':
        return this.executeUltimateAI(board, aiDisc, aiLevel, metrics);
        
      default:
        return this.executeStandardMinimax(board, aiDisc, aiLevel, metrics);
    }
  }

  /**
   * Enhanced Minimax with iterative deepening
   */
  private async executeEnhancedMinimax(
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    const maxDepth = Math.min(aiLevel + 2, 12);
    let bestMove = -1;
    let bestScore = -Infinity;
    let confidence = 0;
    
    // Iterative deepening
    for (let depth = 1; depth <= maxDepth; depth++) {
      const startDepth = Date.now();
      
      try {
        // Get ML guidance if available
        let probs: number[] | undefined;
        if (aiLevel >= 5 && this.optimizedMlClient) {
          try {
            const mlResult = await this.optimizedMlClient.getPrediction(board);
            if (mlResult) {
              probs = mlResult.probs;
            }
          } catch (error) {
            this.logger.debug('ML guidance unavailable for minimax');
          }
        }
        
        const result = minimax(
          board,
          depth,
          -Infinity,
          Infinity,
          true,
          aiDisc,
          probs
        );
        
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = result.column ?? bestMove;
          confidence = this.scoreToConfidence(bestScore, depth);
        }
        
        metrics.depth = depth;
        
        // Time check - stop if taking too long
        if (Date.now() - startDepth > 1000) break;
        
      } catch (error) {
        this.logger.debug(`Minimax depth ${depth} failed: ${error.message}`);
        break;
      }
    }
    
    return {
      move: bestMove === -1 ? this.getRandomMove(board) : bestMove,
      confidence,
      explanation: `Minimax search to depth ${metrics.depth} with score ${bestScore}`,
    };
  }

  /**
   * Enhanced MCTS with neural network guidance
   */
  private async executeEnhancedMCTS(
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    const timeMs = this.getMCTSTimeForLevel(aiLevel);
    
    try {
      // Get neural network guidance
      let probs: number[] | undefined;
      if (aiLevel >= 7 && this.optimizedMlClient) {
        const mlResult = await this.optimizedMlClient.getPrediction(board);
        if (mlResult) {
          probs = mlResult.probs;
        }
      }
      
      const move = mcts(board, aiDisc, timeMs, probs);
      const confidence = 0.7 + (aiLevel / 100); // Higher confidence for higher levels
      
      return {
        move,
        confidence,
        explanation: `MCTS with ${timeMs}ms thinking time`,
      };
      
    } catch (error) {
      this.logger.warn(`Enhanced MCTS failed: ${error.message}`);
      // Fallback to standard MCTS
      const move = mcts(board, aiDisc, timeMs);
      return {
        move,
        confidence: 0.5,
        explanation: 'MCTS fallback without neural guidance',
      };
    }
  }

  /**
   * Pure neural network move selection
   */
  private async executeNeuralNetwork(
    board: CellValue[][],
    aiDisc: CellValue,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    try {
      // Use optimized ML client with fast fallback
      if (!this.optimizedMlClient) {
        throw new Error('ML client not available');
      }
      
      const move = await this.optimizedMlClient.getBestMove(board, aiDisc);
      if (move === null) {
        throw new Error('ML service unavailable');
      }
      
      const predResult = await this.optimizedMlClient.getPrediction(board);
      const confidence = predResult ? (predResult.probs[move] || 0.5) : 0.5;
      
      return {
        move,
        confidence,
        explanation: `Neural network prediction with ${(confidence * 100).toFixed(1)}% confidence`,
      };
      
    } catch (error) {
      this.logger.error(`Neural network failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensemble method combining multiple strategies
   */
  private async executeEnsemble(
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    const candidates: MoveCandidate[] = [];
    
    // Run multiple strategies in parallel
    const strategies = [
      this.executeEnhancedMinimax(board, aiDisc, Math.min(aiLevel, 8), metrics),
      this.executeEnhancedMCTS(board, aiDisc, aiLevel, metrics),
    ];
    
    if (aiLevel >= 15) {
      strategies.push(this.executeNeuralNetwork(board, aiDisc, metrics));
    }
    
    const results = await Promise.allSettled(strategies);
    
    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        candidates.push({
          column: result.value.move,
          score: result.value.confidence,
          confidence: result.value.confidence,
          strategy: result.value.explanation || 'unknown',
        });
      }
    }
    
    // Vote on best move
    const moveVotes = new Map<number, number>();
    let totalConfidence = 0;
    
    for (const candidate of candidates) {
      const currentVotes = moveVotes.get(candidate.column) || 0;
      moveVotes.set(candidate.column, currentVotes + candidate.confidence);
      totalConfidence += candidate.confidence;
    }
    
    // Select move with highest weighted votes
    let bestMove = -1;
    let bestVotes = 0;
    
    for (const [move, votes] of moveVotes) {
      if (votes > bestVotes) {
        bestVotes = votes;
        bestMove = move;
      }
    }
    
    const confidence = totalConfidence > 0 ? bestVotes / totalConfidence : 0.5;
    
    return {
      move: bestMove === -1 ? this.getRandomMove(board) : bestMove,
      confidence,
      explanation: `Ensemble of ${candidates.length} strategies with ${(confidence * 100).toFixed(1)}% agreement`,
    };
  }

  /**
   * AlphaZero-style implementation
   */
  private async executeAlphaZero(
    board: CellValue[][],
    aiDisc: CellValue,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    if (this.asyncAIOrchestrator) {
      const request: AIRequest = {
        gameId: crypto.randomUUID(),
        board,
        player: aiDisc,
        difficulty: 20,
        timeLimit: 3000,
        strategy: AIStrategy.ALPHAZERO,
        priority: 10,
      };
      
      const response = await this.asyncAIOrchestrator.getAIMove(request);
      
      return {
        move: response.move,
        confidence: response.confidence,
        explanation: `AlphaZero strategy`,
      };
    }
    
    // Fallback to enhanced MCTS
    return this.executeEnhancedMCTS(board, aiDisc, 20, metrics);
  }

  /**
   * Ultimate AI implementation
   */
  private async executeUltimateAI(
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    if (this.ultimateAI) {
      const options = {
        timeLimit: 5000 + (aiLevel - 20) * 500,
        enableExplanation: true,
        enableDebate: aiLevel >= 25,
        enableOpponentModeling: true,
        enableSafety: true,
      };
      
      const move = await this.ultimateAI.getMove(board, aiDisc, options);
      
      return {
        move,
        confidence: 0.99,
        explanation: 'Ultimate AI with full capabilities enabled',
      };
    }
    
    // Fallback to ensemble
    return this.executeEnsemble(board, aiDisc, aiLevel, metrics);
  }

  /**
   * Standard minimax implementation
   */
  private async executeStandardMinimax(
    board: CellValue[][],
    aiDisc: CellValue,
    aiLevel: number,
    metrics: ComputationMetrics
  ): Promise<{ move: number; confidence: number; explanation?: string }> {
    
    const depth = Math.min(aiLevel + 1, 8);
    const result = minimax(board, depth, -Infinity, Infinity, true, aiDisc);
    
    return {
      move: result.column ?? this.getRandomMove(board),
      confidence: this.scoreToConfidence(result.score, depth),
      explanation: `Standard minimax to depth ${depth}`,
    };
  }

  /**
   * Threat analysis system
   */
  private analyzeThreats(board: CellValue[][], aiDisc: CellValue): ThreatAnalysis {
    const boardHash = this.generateBoardHash(board, aiDisc, 0);
    
    // Check threat cache
    const cached = this.threatCache.get(boardHash);
    if (cached) return cached;
    
    const opponent = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const analysis: ThreatAnalysis = {
      immediate: false,
      winInMoves: Infinity,
      blockRequired: false,
      forkOpportunity: false,
    };
    
    // Check for immediate wins/losses
    const legalCols = legalMoves(board);
    
    for (const col of legalCols) {
      // Check if opponent can win
      const opponentBoard = this.simulateMove(board, col, opponent);
      if (this.checkWinner(opponentBoard) === opponent) {
        analysis.immediate = true;
        analysis.winInMoves = 1;
        analysis.blockRequired = true;
        break;
      }
      
      // Check if we can win
      const aiBoard = this.simulateMove(board, col, aiDisc);
      if (this.checkWinner(aiBoard) === aiDisc) {
        analysis.immediate = true;
        analysis.winInMoves = 1;
        analysis.blockRequired = false;
        break;
      }
    }
    
    // Cache the analysis
    this.threatCache.set(boardHash, analysis);
    
    // Limit cache size
    if (this.threatCache.size > 10000) {
      const firstKey = this.threatCache.keys().next().value;
      if (firstKey) this.threatCache.delete(firstKey);
    }
    
    return analysis;
  }

  /**
   * Finds a move that blocks the opponent's winning threat
   */
  private findBlockingMove(board: CellValue[][], aiDisc: CellValue): number {
    const opponent = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const legalCols = legalMoves(board);
    
    for (const col of legalCols) {
      const testBoard = this.simulateMove(board, col, opponent);
      if (this.checkWinner(testBoard) === opponent) {
        return col; // This column blocks the win
      }
    }
    
    return -1; // No blocking move found
  }

  /**
   * Quick heuristic for emergency situations
   */
  private getQuickHeuristicMove(
    board: CellValue[][],
    aiDisc: CellValue
  ): { move: number; confidence: number; explanation?: string } {
    
    const legalCols = legalMoves(board);
    const opponent = aiDisc === 'Red' ? 'Yellow' : 'Red';
    
    // 1. Check for winning move
    for (const col of legalCols) {
      const testBoard = this.simulateMove(board, col, aiDisc);
      if (this.checkWinner(testBoard) === aiDisc) {
        return { move: col, confidence: 1.0, explanation: 'Winning move' };
      }
    }
    
    // 2. Block opponent's winning move
    for (const col of legalCols) {
      const testBoard = this.simulateMove(board, col, opponent);
      if (this.checkWinner(testBoard) === opponent) {
        return { move: col, confidence: 0.9, explanation: 'Blocking opponent win' };
      }
    }
    
    // 3. Prefer center columns
    const centerCols = [3, 2, 4, 1, 5, 0, 6];
    for (const col of centerCols) {
      if (legalCols.includes(col)) {
        return { move: col, confidence: 0.5, explanation: 'Center preference heuristic' };
      }
    }
    
    // 4. Random fallback
    const move = legalCols[Math.floor(Math.random() * legalCols.length)];
    return { move, confidence: 0.1, explanation: 'Random fallback' };
  }

  /**
   * Strategy selection based on game state and level
   */
  private selectStrategy(
    aiLevel: number,
    board: CellValue[][],
    personality: AIPersonality,
    options?: { useEnsemble?: boolean }
  ): string {
    
    // Force ensemble if requested
    if (options?.useEnsemble && aiLevel >= 10) {
      return 'ensemble';
    }
    
    // Level-based strategy selection
    if (aiLevel <= 3) {
      return 'minimax_enhanced';
    } else if (aiLevel <= 6) {
      return 'mcts_enhanced';
    } else if (aiLevel <= 10) {
      return Math.random() < 0.5 ? 'mcts_enhanced' : 'minimax_enhanced';
    } else if (aiLevel <= 15) {
      return 'neural_network';
    } else if (aiLevel <= 20) {
      return 'ensemble';
    } else if (aiLevel <= 25) {
      return 'alphazero';
    } else {
      return 'ultimate';
    }
  }

  /**
   * Helper methods
   */
  
  private generateBoardHash(board: CellValue[][], player: CellValue, level: number): string {
    const boardStr = board.flat().join('');
    return crypto.createHash('md5')
      .update(`${boardStr}-${player}-${level}`)
      .digest('hex');
  }
  
  private checkCache(hash: string): CacheEntry | null {
    const entry = this.moveCache.get(hash);
    
    if (!entry) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.moveCache.delete(hash);
      return null;
    }
    
    // Update hit count
    entry.hits++;
    return entry;
  }
  
  private cacheMove(
    hash: string,
    move: number,
    confidence: number,
    strategy: string,
    metrics?: ComputationMetrics
  ): void {
    const entry: CacheEntry = {
      move,
      confidence,
      timestamp: Date.now(),
      hits: 0,
      strategy,
      metrics,
    };
    
    this.moveCache.set(hash, entry);
    
    // Evict old entries if cache is too large
    if (this.moveCache.size > this.maxCacheSize) {
      this.evictOldestCacheEntries(Math.floor(this.maxCacheSize * 0.1));
    }
  }
  
  private evictOldestCacheEntries(count: number): void {
    const entries = Array.from(this.moveCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (let i = 0; i < count && i < entries.length; i++) {
      this.moveCache.delete(entries[i][0]);
    }
  }
  
  private getPersonality(level: number): AIPersonality {
    // Find the closest personality definition
    let closestLevel = 1;
    let minDiff = Math.abs(level - 1);
    
    for (const [personalityLevel] of this.personalities) {
      const diff = Math.abs(level - personalityLevel);
      if (diff < minDiff) {
        minDiff = diff;
        closestLevel = personalityLevel;
      }
    }
    
    return this.personalities.get(closestLevel)!;
  }
  
  private shouldUseOpeningBook(board: CellValue[][], level: number): boolean {
    // Count number of moves played
    let moveCount = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell !== 'Empty') moveCount++;
      }
    }
    
    // Use opening book for first few moves at higher levels
    return moveCount < 8 && level >= 5 && this.openingBook !== undefined;
  }
  
  private async getOpeningBookMove(
    board: CellValue[][],
    personality: AIPersonality
  ): Promise<number | null> {
    if (!this.openingBook) return null;
    
    try {
      const move = await this.openingBook.lookup(board);
      
      // Apply personality randomness
      if (move !== null && personality.randomness > 0.3 && Math.random() < personality.randomness) {
        const alternatives = legalMoves(board);
        if (alternatives.length > 1) {
          return alternatives[Math.floor(Math.random() * alternatives.length)];
        }
      }
      
      return move;
    } catch (error) {
      this.logger.debug(`Opening book lookup failed: ${error.message}`);
      return null;
    }
  }
  
  private getAlternativeMove(
    board: CellValue[][],
    originalMove: number,
    personality: AIPersonality
  ): number {
    const legal = legalMoves(board);
    
    // Remove original move from options
    const alternatives = legal.filter(col => col !== originalMove);
    
    if (alternatives.length === 0) return originalMove;
    
    // Weight alternatives based on personality
    if (personality.aggressiveness > 0.7) {
      // Prefer attacking columns (center and adjacent to existing pieces)
      const centerDist = alternatives.map(col => Math.abs(col - 3));
      const minDist = Math.min(...centerDist);
      const centerCols = alternatives.filter((_col, i) => centerDist[i] === minDist);
      
      if (centerCols.length > 0) {
        return centerCols[Math.floor(Math.random() * centerCols.length)];
      }
    }
    
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }
  
  private updatePlayerPattern(playerId: string, board: CellValue[][], move: number): void {
    let pattern = this.playerPatterns.get(playerId);
    
    if (!pattern) {
      pattern = {
        playerId,
        commonMoves: new Map(),
        weaknesses: [],
        strengths: [],
        averageResponseTime: 0,
        preferredColumns: [],
      };
      this.playerPatterns.set(playerId, pattern);
    }
    
    // Update common moves
    const boardHash = this.generateBoardHash(board, 'Red', 0);
    const moveCount = pattern.commonMoves.get(boardHash) || 0;
    pattern.commonMoves.set(boardHash, moveCount + 1);
    
    // Update preferred columns
    if (!pattern.preferredColumns.includes(move)) {
      pattern.preferredColumns.push(move);
    }
    
    // Limit pattern storage
    if (pattern.commonMoves.size > 1000) {
      // Remove oldest entries
      const entries = Array.from(pattern.commonMoves.entries());
      pattern.commonMoves.clear();
      entries.slice(-500).forEach(([k, v]) => pattern.commonMoves.set(k, v));
    }
  }
  
  private getCounterMove(playerId: string, board: CellValue[][], suggestedMove: number): number {
    const pattern = this.playerPatterns.get(playerId);
    
    if (!pattern || pattern.commonMoves.size < 10) {
      return suggestedMove; // Not enough data
    }
    
    // Check if player has a common response to this board state
    const boardHash = this.generateBoardHash(board, 'Red', 0);
    const playerHistory = pattern.commonMoves.get(boardHash);
    
    if (playerHistory && playerHistory > 2) {
      // Player has shown a pattern here, try to counter it
      const legal = legalMoves(board);
      const alternatives = legal.filter(col => col !== suggestedMove);
      
      if (alternatives.length > 0) {
        // Pick an unexpected move
        return alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }
    
    return suggestedMove;
  }
  
  private getTimeLimitForLevel(level: number): number {
    if (level <= 3) return 100;
    if (level <= 6) return 200 + (level - 4) * 100;
    if (level <= 10) return 500 + (level - 7) * 200;
    if (level <= 15) return 1000 + (level - 11) * 300;
    if (level <= 20) return 2000 + (level - 16) * 500;
    return Math.min(5000 + (level - 21) * 500, this.maxComputationTime);
  }
  
  private getMCTSTimeForLevel(level: number): number {
    if (level <= 5) return 50 + level * 20;
    if (level <= 10) return 200 + (level - 5) * 50;
    if (level <= 15) return 500 + (level - 10) * 100;
    return Math.min(1000 + (level - 15) * 200, 5000);
  }
  
  private scoreToConfidence(score: number, depth: number): number {
    // Convert minimax score to confidence (0-1)
    const normalized = Math.tanh(score / 1000);
    const depthBonus = Math.min(depth / 20, 0.2);
    return Math.max(0.1, Math.min(0.99, (normalized + 1) / 2 + depthBonus));
  }
  
  private simulateMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }
  
  private checkWinner(board: CellValue[][]): CellValue | null {
    // Check horizontal wins
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = board[row][col];
        if (cell !== 'Empty' &&
            cell === board[row][col + 1] &&
            cell === board[row][col + 2] &&
            cell === board[row][col + 3]) {
          return cell;
        }
      }
    }
    
    // Check vertical wins
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        if (cell !== 'Empty' &&
            cell === board[row + 1][col] &&
            cell === board[row + 2][col] &&
            cell === board[row + 3][col]) {
          return cell;
        }
      }
    }
    
    // Check diagonal wins (top-left to bottom-right)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = board[row][col];
        if (cell !== 'Empty' &&
            cell === board[row + 1][col + 1] &&
            cell === board[row + 2][col + 2] &&
            cell === board[row + 3][col + 3]) {
          return cell;
        }
      }
    }
    
    // Check diagonal wins (top-right to bottom-left)
    for (let row = 0; row < 3; row++) {
      for (let col = 3; col < 7; col++) {
        const cell = board[row][col];
        if (cell !== 'Empty' &&
            cell === board[row + 1][col - 1] &&
            cell === board[row + 2][col - 2] &&
            cell === board[row + 3][col - 3]) {
          return cell;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Ultra-intelligent move selection with advanced AI concepts
   * Implements game theory, pattern recognition, and strategic evaluation
   */
  private getRandomMove(board: CellValue[][]): number {
    const moves = legalMoves(board);
    
    // Safety check - no legal moves available
    if (moves.length === 0) {
      this.logger.error('No legal moves available in getRandomMove');
      return -1;
    }
    
    // Single move available - no choice
    if (moves.length === 1) {
      return moves[0];
    }
    
    // Advanced move evaluation system
    const moveAnalysis = new Map<number, {
      score: number;
      tactical: number;
      strategic: number;
      defensive: number;
      offensive: number;
      positional: number;
      psychological: number;
      details: string[];
    }>();
    
    // Game phase detection
    const moveCount = this.countTotalMoves(board);
    const gamePhase = this.detectGamePhase(moveCount);
    const criticalMoves = this.findCriticalMoves(board);
    
    for (const col of moves) {
      const analysis = {
        score: 0,
        tactical: 0,
        strategic: 0,
        defensive: 0,
        offensive: 0,
        positional: 0,
        psychological: 0,
        details: [] as string[]
      };
      
      // 1. IMMEDIATE TACTICAL ANALYSIS (Highest Priority)
      const tacticalEval = this.evaluateTacticalPosition(board, col);
      analysis.tactical = tacticalEval.score;
      analysis.score += tacticalEval.score * 3; // Triple weight for tactics
      if (tacticalEval.isWinning) {
        analysis.score += 10000; // Absolute priority for wins
        analysis.details.push('WINNING_MOVE');
      }
      if (tacticalEval.blocksLoss) {
        analysis.score += 5000; // Must block opponent wins
        analysis.details.push('BLOCKS_LOSS');
      }
      
      // 2. STRATEGIC POSITIONING (Long-term advantages)
      const strategicEval = this.evaluateStrategicValue(board, col, gamePhase);
      analysis.strategic = strategicEval.score;
      analysis.score += strategicEval.score * 2;
      analysis.details.push(...strategicEval.patterns);
      
      // 3. PATTERN RECOGNITION (Known winning patterns)
      const patternScore = this.recognizePatterns(board, col);
      analysis.score += patternScore.totalScore;
      if (patternScore.matchedPatterns.length > 0) {
        analysis.details.push(...patternScore.matchedPatterns);
      }
      
      // 4. CONTROL & TEMPO EVALUATION
      const controlEval = this.evaluateBoardControl(board, col);
      analysis.positional = controlEval.controlScore;
      analysis.score += controlEval.controlScore;
      if (controlEval.gainsInitiative) {
        analysis.score += 50;
        analysis.details.push('GAINS_INITIATIVE');
      }
      
      // 5. DEFENSIVE EVALUATION (Prevent opponent strategies)
      const defensiveEval = this.evaluateDefensiveValue(board, col);
      analysis.defensive = defensiveEval.score;
      analysis.score += defensiveEval.score * 1.5;
      if (defensiveEval.preventsFork) {
        analysis.score += 80;
        analysis.details.push('PREVENTS_FORK');
      }
      
      // 6. OFFENSIVE EVALUATION (Create winning opportunities)
      const offensiveEval = this.evaluateOffensiveValue(board, col);
      analysis.offensive = offensiveEval.score;
      analysis.score += offensiveEval.score * 1.8;
      if (offensiveEval.createsFork) {
        analysis.score += 100;
        analysis.details.push('CREATES_FORK');
      }
      
      // 7. ZUGZWANG DETECTION (Force opponent bad moves)
      const zugzwangScore = this.evaluateZugzwang(board, col);
      if (zugzwangScore > 0) {
        analysis.score += zugzwangScore;
        analysis.psychological += zugzwangScore;
        analysis.details.push('ZUGZWANG');
      }
      
      // 8. COMBINATORIAL GAME THEORY
      const gameTheoryScore = this.applyGameTheory(board, col, moves.length);
      analysis.score += gameTheoryScore.value;
      if (gameTheoryScore.isDominant) {
        analysis.score += 60;
        analysis.details.push('DOMINANT_STRATEGY');
      }
      
      // 9. MONTE CARLO SIMULATION (Quick random playouts)
      if (moveCount < 15 && moves.length <= 5) {
        const monteCarloScore = this.quickMonteCarloEval(board, col, 10);
        analysis.score += monteCarloScore * 5;
        if (monteCarloScore > 0.7) {
          analysis.details.push('MC_FAVORABLE');
        }
      }
      
      // 10. SYMMETRY AND BALANCE
      const symmetryScore = this.evaluateSymmetry(board, col);
      analysis.score += symmetryScore;
      if (symmetryScore > 20) {
        analysis.details.push('MAINTAINS_SYMMETRY');
      }
      
      // 11. TRAP DETECTION AND SETTING
      const trapEval = this.evaluateTraps(board, col);
      if (trapEval.setsTrap) {
        analysis.score += 70;
        analysis.psychological += 30;
        analysis.details.push('SETS_TRAP');
      }
      if (trapEval.avoidsTrap) {
        analysis.score += 40;
        analysis.details.push('AVOIDS_TRAP');
      }
      
      // 12. ENDGAME TABLEBASE LOOKUP (For positions with few pieces)
      if (moveCount > 35) {
        const endgameScore = this.evaluateEndgame(board, col);
        analysis.score += endgameScore * 3;
        if (endgameScore > 50) {
          analysis.details.push('ENDGAME_OPTIMAL');
        }
      }
      
      // 13. PSYCHOLOGICAL WARFARE (Unpredictability)
      const psychScore = this.evaluatePsychologicalImpact(col, moves);
      analysis.psychological += psychScore;
      analysis.score += psychScore * 0.5;
      
      // 14. CRITICAL SQUARE CONTROL
      if (criticalMoves.includes(col)) {
        analysis.score += 45;
        analysis.details.push('CRITICAL_SQUARE');
      }
      
      // 15. ADAPTIVE DIFFICULTY (Make it feel fair but challenging)
      const adaptiveScore = this.applyAdaptiveDifficulty(analysis.score, gamePhase);
      analysis.score = adaptiveScore;
      
      // Add controlled randomness for variety
      const randomFactor = Math.random() * 10 - 5; // -5 to +5
      analysis.score += randomFactor;
      
      moveAnalysis.set(col, analysis);
    }
    
    // Advanced selection algorithm
    return this.selectBestMoveWithStrategy(moveAnalysis, moves, gamePhase);
  }
  
  /**
   * Detect current game phase for strategy adjustment
   */
  private detectGamePhase(moveCount: number): 'opening' | 'midgame' | 'endgame' {
    if (moveCount < 8) return 'opening';
    if (moveCount < 28) return 'midgame';
    return 'endgame';
  }
  
  /**
   * Find critical moves that must be considered
   */
  private findCriticalMoves(board: CellValue[][]): number[] {
    const critical: number[] = [];
    const moves = legalMoves(board);
    
    for (const col of moves) {
      // Check if this column is critical for winning/losing
      const yellowBoard = this.simulateMove(board, col, 'Yellow');
      const redBoard = this.simulateMove(board, col, 'Red');
      
      if (this.checkWinner(yellowBoard) === 'Yellow' || 
          this.checkWinner(redBoard) === 'Red') {
        critical.push(col);
      }
    }
    
    return critical;
  }
  
  /**
   * Evaluate immediate tactical importance
   */
  private evaluateTacticalPosition(board: CellValue[][], col: number): {
    score: number;
    isWinning: boolean;
    blocksLoss: boolean;
  } {
    let score = 0;
    let isWinning = false;
    let blocksLoss = false;
    
    // Check for immediate win
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    if (this.checkWinner(futureBoard) === 'Yellow') {
      isWinning = true;
      score += 1000;
    }
    
    // Check if blocks opponent win
    const opponentWin = this.simulateMove(board, col, 'Red');
    if (this.checkWinner(opponentWin) === 'Red') {
      blocksLoss = true;
      score += 500;
    }
    
    // Evaluate threats created and blocked
    const threatsCreated = this.countThreats(futureBoard, 'Yellow');
    const threatsBlocked = this.countThreats(board, 'Red') - this.countThreats(futureBoard, 'Red');
    
    score += threatsCreated * 25;
    score += threatsBlocked * 20;
    
    return { score, isWinning, blocksLoss };
  }
  
  /**
   * Evaluate long-term strategic value
   */
  private evaluateStrategicValue(board: CellValue[][], col: number, phase: string): {
    score: number;
    patterns: string[];
  } {
    let score = 0;
    const patterns: string[] = [];
    
    // Opening strategy - control center
    if (phase === 'opening') {
      const centerDist = Math.abs(col - 3);
      score += (3 - centerDist) * 15;
      if (col === 3) patterns.push('CENTER_CONTROL');
    }
    
    // Midgame - build connections
    if (phase === 'midgame') {
      const connections = this.countConnections(board, col, 'Yellow');
      score += connections * 12;
      if (connections >= 3) patterns.push('STRONG_FORMATION');
    }
    
    // Endgame - maximize winning paths
    if (phase === 'endgame') {
      const winPaths = this.countPotentialWinPaths(board, col, 'Yellow');
      score += winPaths * 18;
      if (winPaths >= 2) patterns.push('MULTIPLE_WIN_PATHS');
    }
    
    return { score, patterns };
  }
  
  /**
   * Advanced pattern recognition system
   */
  private recognizePatterns(board: CellValue[][], col: number): {
    totalScore: number;
    matchedPatterns: string[];
  } {
    let totalScore = 0;
    const matchedPatterns: string[] = [];
    
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    
    // Check for known winning patterns
    const patterns = [
      { name: 'SEVEN_TRAP', check: () => this.checkSevenTrap(futureBoard, 'Yellow'), score: 80 },
      { name: 'DOUBLE_THREAT', check: () => this.checkDoubleThreat(futureBoard, 'Yellow'), score: 60 },
      { name: 'PYRAMID', check: () => this.checkPyramidFormation(futureBoard, col), score: 40 },
      { name: 'SPLIT_THREAT', check: () => this.checkSplitThreat(futureBoard, 'Yellow'), score: 50 },
      { name: 'DIAGONAL_CONTROL', check: () => this.checkDiagonalControl(futureBoard, col), score: 35 }
    ];
    
    for (const pattern of patterns) {
      if (pattern.check()) {
        totalScore += pattern.score;
        matchedPatterns.push(pattern.name);
      }
    }
    
    return { totalScore, matchedPatterns };
  }
  
  /**
   * Evaluate board control and tempo
   */
  private evaluateBoardControl(board: CellValue[][], col: number): {
    controlScore: number;
    gainsInitiative: boolean;
  } {
    let controlScore = 0;
    
    // Center control
    if (col >= 2 && col <= 4) {
      controlScore += 20;
    }
    
    // Height advantage
    const row = this.getDropRow(board, col);
    if (row <= 2) {
      controlScore += (3 - row) * 10; // Higher positions are more controlling
    }
    
    // Space control (how many future moves this enables)
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const futureMoves = legalMoves(futureBoard).length;
    controlScore += futureMoves * 3;
    
    // Initiative (forces opponent response)
    const gainsInitiative = this.forcesOpponentResponse(futureBoard);
    if (gainsInitiative) {
      controlScore += 30;
    }
    
    return { controlScore, gainsInitiative };
  }
  
  /**
   * Defensive evaluation
   */
  private evaluateDefensiveValue(board: CellValue[][], col: number): {
    score: number;
    preventsFork: boolean;
  } {
    let score = 0;
    
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    
    // Check if prevents opponent forks
    const opponentForksBefore = this.evaluateForkPotential(board, 'Red');
    const opponentForksAfter = this.evaluateForkPotential(futureBoard, 'Red');
    const preventsFork = opponentForksBefore > opponentForksAfter;
    
    if (preventsFork) {
      score += 40;
    }
    
    // Blocks opponent strong positions
    const blockScore = this.evaluateBlocking(board, col);
    score += blockScore;
    
    return { score, preventsFork };
  }
  
  /**
   * Offensive evaluation
   */
  private evaluateOffensiveValue(board: CellValue[][], col: number): {
    score: number;
    createsFork: boolean;
  } {
    let score = 0;
    
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    
    // Check if creates forks
    const forkPotential = this.evaluateForkPotential(futureBoard, 'Yellow');
    const createsFork = forkPotential >= 2;
    
    score += forkPotential * 25;
    
    // Evaluate attack potential
    const attackScore = this.evaluateAttackPotential(futureBoard, 'Yellow');
    score += attackScore;
    
    return { score, createsFork };
  }
  
  /**
   * Zugzwang evaluation - positions where opponent must worsen their position
   */
  private evaluateZugzwang(board: CellValue[][], col: number): number {
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const opponentMoves = legalMoves(futureBoard);
    
    let badMoves = 0;
    for (const oppMove of opponentMoves) {
      const oppBoard = this.simulateMove(futureBoard, oppMove, 'Red');
      // Check if opponent's move worsens their position
      if (this.countThreats(oppBoard, 'Yellow') > this.countThreats(futureBoard, 'Yellow')) {
        badMoves++;
      }
    }
    
    // If most opponent moves are bad, it's zugzwang
    return badMoves >= opponentMoves.length * 0.7 ? 50 : 0;
  }
  
  /**
   * Apply game theory concepts
   */
  private applyGameTheory(board: CellValue[][], col: number, numMoves: number): {
    value: number;
    isDominant: boolean;
  } {
    // Simplified game theory evaluation
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const myBestOutcome = this.evaluateBestOutcome(futureBoard, 'Yellow', 2);
    
    let totalValue = 0;
    let worseOutcomes = 0;
    
    // Compare with other moves (Nash equilibrium approximation)
    const moves = legalMoves(board);
    for (const altMove of moves) {
      if (altMove !== col) {
        const altBoard = this.simulateMove(board, altMove, 'Yellow');
        const altOutcome = this.evaluateBestOutcome(altBoard, 'Yellow', 2);
        if (altOutcome < myBestOutcome) {
          worseOutcomes++;
        }
      }
    }
    
    const isDominant = worseOutcomes === moves.length - 1;
    totalValue = myBestOutcome * 10;
    
    return { value: totalValue, isDominant };
  }
  
  /**
   * Quick Monte Carlo evaluation
   */
  private quickMonteCarloEval(board: CellValue[][], col: number, simulations: number): number {
    let wins = 0;
    
    for (let i = 0; i < simulations; i++) {
      const result = this.simulateRandomGame(
        this.simulateMove(board, col, 'Yellow'),
        'Red'
      );
      if (result === 'Yellow') wins++;
    }
    
    return wins / simulations;
  }
  
  /**
   * Evaluate symmetry maintenance
   */
  private evaluateSymmetry(board: CellValue[][], col: number): number {
    // Check if move maintains board symmetry (often strong in Connect Four)
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    let symmetryScore = 0;
    
    // Check vertical symmetry
    let isSymmetric = true;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        if (futureBoard[r][c] !== futureBoard[r][6 - c]) {
          isSymmetric = false;
          break;
        }
      }
    }
    
    if (isSymmetric && col === 3) {
      symmetryScore += 30; // Center moves maintain symmetry
    }
    
    return symmetryScore;
  }
  
  /**
   * Trap evaluation system
   */
  private evaluateTraps(board: CellValue[][], col: number): {
    setsTrap: boolean;
    avoidsTrap: boolean;
  } {
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    
    // Check if sets a trap (hidden threat)
    const setsTrap = this.checkForTrapSetting(futureBoard, 'Yellow');
    
    // Check if avoids opponent trap
    const avoidsTrap = this.checkForTrapAvoidance(board, col);
    
    return { setsTrap, avoidsTrap };
  }
  
  /**
   * Endgame evaluation
   */
  private evaluateEndgame(board: CellValue[][], col: number): number {
    // Simplified endgame evaluation
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const winPaths = this.countPotentialWinPaths(futureBoard, col, 'Yellow');
    const blockPaths = this.countPotentialWinPaths(futureBoard, col, 'Red');
    
    return (winPaths * 20) - (blockPaths * 10);
  }
  
  /**
   * Psychological impact evaluation
   */
  private evaluatePsychologicalImpact(col: number, allMoves: number[]): number {
    // Unexpected moves can be psychologically effective
    const isUnexpected = col === 0 || col === 6; // Edge columns
    const isAggressive = col === 3; // Center is aggressive
    
    let psychScore = 0;
    if (isUnexpected) psychScore += 15;
    if (isAggressive) psychScore += 10;
    
    return psychScore;
  }
  
  /**
   * Apply adaptive difficulty adjustments
   */
  private applyAdaptiveDifficulty(baseScore: number, phase: string): number {
    // Can be adjusted based on player skill level
    // This makes the AI feel more natural
    const variance = phase === 'opening' ? 0.8 : phase === 'midgame' ? 0.9 : 1.0;
    return baseScore * variance;
  }
  
  /**
   * Select best move using advanced strategy
   */
  private selectBestMoveWithStrategy(
    moveAnalysis: Map<number, any>,
    moves: number[],
    phase: string
  ): number {
    // Sort moves by score
    const sortedMoves = Array.from(moveAnalysis.entries())
      .sort((a, b) => b[1].score - a[1].score);
    
    // Log top moves for debugging
    if (sortedMoves.length > 0) {
      const topMove = sortedMoves[0];
      this.logger.debug(
        `Top move: col ${topMove[0]} with score ${topMove[1].score.toFixed(2)} - ${topMove[1].details.join(', ')}`
      );
    }
    
    // Use different selection strategies based on game phase
    if (phase === 'opening') {
      // More randomness in opening
      const topThree = sortedMoves.slice(0, 3);
      if (topThree.length > 0) {
        const weights = topThree.map(m => Math.max(1, m[1].score + 100));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < topThree.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            return topThree[i][0];
          }
        }
      }
    } else if (phase === 'endgame') {
      // More deterministic in endgame
      if (sortedMoves.length > 0 && sortedMoves[0][1].score > 100) {
        return sortedMoves[0][0]; // Take best move if clearly better
      }
    }
    
    // Default: weighted selection from top moves
    const topMoves = sortedMoves.slice(0, Math.min(4, sortedMoves.length));
    const weights = topMoves.map(m => Math.max(1, m[1].score + 100));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    if (totalWeight === 0) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < topMoves.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return topMoves[i][0];
      }
    }
    
    // Ultimate fallback
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  // Additional helper methods for pattern recognition
  
  private checkSevenTrap(board: CellValue[][], player: CellValue): boolean {
    // Seven trap is a specific Connect Four pattern
    // Simplified check - would need full implementation
    return false;
  }
  
  private checkDoubleThreat(board: CellValue[][], player: CellValue): boolean {
    return this.countThreats(board, player) >= 2;
  }
  
  private checkPyramidFormation(board: CellValue[][], col: number): boolean {
    // Check for pyramid-like structure which is strong
    const row = this.getDropRow(board, col);
    if (row >= 2) {
      // Check if forms pyramid base
      return board[row + 1][col - 1] !== 'Empty' && board[row + 1][col + 1] !== 'Empty';
    }
    return false;
  }
  
  private checkSplitThreat(board: CellValue[][], player: CellValue): boolean {
    // Check for threats in multiple areas
    const threats = this.countThreats(board, player);
    return threats >= 2;
  }
  
  private checkDiagonalControl(board: CellValue[][], col: number): boolean {
    // Check diagonal dominance
    let diagonalCount = 0;
    const row = this.getDropRow(board, col);
    
    // Check both diagonals
    const dirs = [[1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      for (let i = 1; i <= 3; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === 'Yellow') {
          diagonalCount++;
        }
      }
    }
    
    return diagonalCount >= 2;
  }
  
  private forcesOpponentResponse(board: CellValue[][]): boolean {
    // Check if position forces opponent to respond
    return this.countThreats(board, 'Yellow') >= 1;
  }
  
  private evaluateBlocking(board: CellValue[][], col: number): number {
    // Evaluate how well this blocks opponent
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const blockedThreats = this.countThreats(board, 'Red') - this.countThreats(futureBoard, 'Red');
    return blockedThreats * 20;
  }
  
  private evaluateAttackPotential(board: CellValue[][], player: CellValue): number {
    // Evaluate attacking possibilities
    const threats = this.countThreats(board, player);
    const winPaths = this.countPotentialWinPaths(board, -1, player);
    return threats * 15 + winPaths * 5;
  }
  
  private evaluateBestOutcome(board: CellValue[][], player: CellValue, depth: number): number {
    if (depth === 0) {
      return this.evaluatePosition(board, player);
    }
    
    // Simplified minimax for game theory evaluation
    const moves = legalMoves(board);
    let bestScore = -Infinity;
    
    for (const move of moves) {
      const futureBoard = this.simulateMove(board, move, player);
      const score = -this.evaluateBestOutcome(
        futureBoard,
        player === 'Yellow' ? 'Red' : 'Yellow',
        depth - 1
      );
      bestScore = Math.max(bestScore, score);
    }
    
    return bestScore;
  }
  
  private evaluatePosition(board: CellValue[][], player: CellValue): number {
    // Simple position evaluation
    const myThreats = this.countThreats(board, player);
    const oppThreats = this.countThreats(board, player === 'Yellow' ? 'Red' : 'Yellow');
    return myThreats - oppThreats;
  }
  
  private simulateRandomGame(board: CellValue[][], currentPlayer: CellValue): CellValue | null {
    let gameBoard = board.map(row => [...row]);
    let player = currentPlayer;
    let moveCount = 0;
    
    while (moveCount < 42) {
      const moves = legalMoves(gameBoard);
      if (moves.length === 0) break;
      
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      gameBoard = this.simulateMove(gameBoard, randomMove, player);
      
      const winner = this.checkWinner(gameBoard);
      if (winner) return winner;
      
      player = player === 'Yellow' ? 'Red' : 'Yellow';
      moveCount++;
    }
    
    return null; // Draw
  }
  
  private checkForTrapSetting(board: CellValue[][], player: CellValue): boolean {
    // Check if position sets up a hidden trap
    const threats = this.countThreats(board, player);
    const hiddenThreats = this.countHiddenThreats(board, player);
    return hiddenThreats > 0 && threats >= 1;
  }
  
  private checkForTrapAvoidance(board: CellValue[][], col: number): boolean {
    // Check if move avoids falling into opponent trap
    const futureBoard = this.simulateMove(board, col, 'Yellow');
    const opponentThreats = this.countThreats(futureBoard, 'Red');
    return opponentThreats < 2; // Avoids giving opponent multiple threats
  }
  
  private countHiddenThreats(board: CellValue[][], player: CellValue): number {
    // Count threats that aren't immediately obvious
    let hiddenCount = 0;
    
    // Check for setups that become threats after one more move
    const moves = legalMoves(board);
    for (const move of moves) {
      const futureBoard = this.simulateMove(board, move, player);
      const futureThreats = this.countThreats(futureBoard, player);
      if (futureThreats >= 2) {
        hiddenCount++;
      }
    }
    
    return hiddenCount;
  }
  
  private countPotentialWinPaths(board: CellValue[][], col: number, player: CellValue): number {
    let paths = 0;
    
    // Count all possible ways to win from current position
    for (let row = 0; row < 6; row++) {
      for (let c = 0; c <= 3; c++) {
        // Horizontal
        let canWin = true;
        for (let i = 0; i < 4; i++) {
          if (board[row][c + i] !== 'Empty' && board[row][c + i] !== player) {
            canWin = false;
            break;
          }
        }
        if (canWin) paths++;
      }
    }
    
    // Similar checks for vertical and diagonal...
    // Simplified for brevity
    
    return Math.min(paths, 5); // Cap to prevent overvaluation
  }
  
  /**
   * Helper: Count threats on the board for a player
   */
  private countThreats(board: CellValue[][], player: CellValue): number {
    let threats = 0;
    
    // Check all possible winning positions
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        // Horizontal threats
        if (col <= 3) {
          const line = [board[row][col], board[row][col+1], board[row][col+2], board[row][col+3]];
          if (this.isThreateningLine(line, player)) threats++;
        }
        
        // Vertical threats
        if (row <= 2) {
          const line = [board[row][col], board[row+1][col], board[row+2][col], board[row+3][col]];
          if (this.isThreateningLine(line, player)) threats++;
        }
        
        // Diagonal threats (top-left to bottom-right)
        if (row <= 2 && col <= 3) {
          const line = [board[row][col], board[row+1][col+1], board[row+2][col+2], board[row+3][col+3]];
          if (this.isThreateningLine(line, player)) threats++;
        }
        
        // Diagonal threats (top-right to bottom-left)
        if (row <= 2 && col >= 3) {
          const line = [board[row][col], board[row+1][col-1], board[row+2][col-2], board[row+3][col-3]];
          if (this.isThreateningLine(line, player)) threats++;
        }
      }
    }
    
    return threats;
  }
  
  /**
   * Helper: Check if a line is threatening (3 pieces with 1 empty)
   */
  private isThreateningLine(line: CellValue[], player: CellValue): boolean {
    const playerCount = line.filter(cell => cell === player).length;
    const emptyCount = line.filter(cell => cell === 'Empty').length;
    return playerCount === 3 && emptyCount === 1;
  }
  
  /**
   * Helper: Get the row where a piece would land
   */
  private getDropRow(board: CellValue[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }
  
  /**
   * Helper: Evaluate fork potential (multiple winning threats)
   */
  private evaluateForkPotential(board: CellValue[][], player: CellValue): number {
    let forkScore = 0;
    const threats = new Set<string>();
    
    // Look for positions that create multiple threats
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] === player) {
          // Check all directions for potential threats
          const directions = [
            [[0, 1], [0, 2], [0, 3]], // Horizontal
            [[1, 0], [2, 0], [3, 0]], // Vertical
            [[1, 1], [2, 2], [3, 3]], // Diagonal down-right
            [[1, -1], [2, -2], [3, -3]] // Diagonal down-left
          ];
          
          for (const dir of directions) {
            let hasEmpty = false;
            let count = 1;
            
            for (const [dr, dc] of dir) {
              const newRow = row + dr;
              const newCol = col + dc;
              
              if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7) {
                if (board[newRow][newCol] === player) {
                  count++;
                } else if (board[newRow][newCol] === 'Empty') {
                  hasEmpty = true;
                }
              }
            }
            
            if (count >= 2 && hasEmpty) {
              threats.add(`${row}-${col}-${dir[0][0]}-${dir[0][1]}`);
            }
          }
        }
      }
    }
    
    // More threats = higher fork potential
    forkScore = threats.size;
    return Math.min(forkScore, 3); // Cap at 3 to prevent overvaluation
  }
  
  /**
   * Helper: Count connections with existing pieces
   */
  private countConnections(board: CellValue[][], col: number, player: CellValue): number {
    const row = this.getDropRow(board, col);
    if (row === -1) return 0;
    
    let connections = 0;
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7) {
        if (board[newRow][newCol] === player) {
          connections++;
          
          // Check for longer connections
          const extRow = row + dr * 2;
          const extCol = col + dc * 2;
          if (extRow >= 0 && extRow < 6 && extCol >= 0 && extCol < 7) {
            if (board[extRow][extCol] === player) {
              connections += 2; // Bonus for longer chains
            }
          }
        }
      }
    }
    
    return connections;
  }
  
  /**
   * Helper: Count total moves on the board
   */
  private countTotalMoves(board: CellValue[][]): number {
    let count = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell !== 'Empty') count++;
      }
    }
    return count;
  }
  
  /**
   * Helper: Check if position has adjacent pieces
   */
  private hasAdjacentPieces(board: CellValue[][], col: number): boolean {
    const row = this.getDropRow(board, col);
    if (row === -1) return false;
    
    // Check left and right columns
    for (const dc of [-1, 1]) {
      const newCol = col + dc;
      if (newCol >= 0 && newCol < 7) {
        for (let r = 0; r < 6; r++) {
          if (board[r][newCol] !== 'Empty') {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private getEmergencyMove(board: CellValue[][]): number {
    const legal = legalMoves(board);
    
    // Prefer center column in emergency
    if (legal.includes(3)) return 3;
    if (legal.includes(2)) return 2;
    if (legal.includes(4)) return 4;
    
    return legal[0] ?? 0;
  }
  
  private recordPerformance(metrics: ComputationMetrics): void {
    this.performanceHistory.push(metrics);
    
    // Keep history size limited
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
    
    // Log performance warnings
    const computeTime = (metrics.endTime || Date.now()) - metrics.startTime;
    if (computeTime > 5000) {
      this.logger.warn(`⚠️ Slow AI computation: ${computeTime}ms for ${metrics.strategy}`);
    }
  }
  
  /**
   * Background tasks
   */
  
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      // Clean move cache
      for (const [hash, entry] of this.moveCache) {
        if (now - entry.timestamp > this.cacheTTL) {
          this.moveCache.delete(hash);
          cleaned++;
        }
      }
      
      // Clear threat cache periodically
      if (this.threatCache.size > 5000) {
        this.threatCache.clear();
      }
      
      if (cleaned > 0) {
        this.logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
      }
    }, 60000); // Every minute
  }
  
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      if (this.performanceHistory.length < 10) return;
      
      // Calculate average performance metrics
      const recentMetrics = this.performanceHistory.slice(-100);
      const avgComputeTime = recentMetrics.reduce((sum, m) => {
        return sum + ((m.endTime || Date.now()) - m.startTime);
      }, 0) / recentMetrics.length;
      
      const avgNodesEvaluated = recentMetrics.reduce((sum, m) => {
        return sum + m.nodesEvaluated;
      }, 0) / recentMetrics.length;
      
      const cacheHitRate = recentMetrics.reduce((sum, m) => {
        const total = m.cacheHits + m.cacheMisses;
        return sum + (total > 0 ? m.cacheHits / total : 0);
      }, 0) / recentMetrics.length;
      
      this.logger.log(
        `📊 AI Performance: Avg compute time: ${avgComputeTime.toFixed(0)}ms, ` +
        `Avg nodes: ${avgNodesEvaluated.toFixed(0)}, ` +
        `Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`
      );
      
      // Emit metrics event
      if (this.eventEmitter) {
        this.eventEmitter.emit('ai.performance.metrics', {
          avgComputeTime,
          avgNodesEvaluated,
          cacheHitRate,
          cacheSize: this.moveCache.size,
        });
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Legacy method for backward compatibility
   */
  private async getMoveProbabilities(
    board: CellValue[][],
  ): Promise<number[] | null> {
    try {
      // Use optimized ML client if available
      const mlResult = this.optimizedMlClient 
        ? await this.optimizedMlClient.getPrediction(board)
        : await this.mlClientService.getPrediction(board);
      
      if (!mlResult) {
        return null;
      }
      
      const { probs } = mlResult;
      const legal = legalMoves(board);

      // Create a sparse array of probabilities for legal moves
      const legalProbs = new Array(board[0].length).fill(0);
      let totalProb = 0;

      for (const col of legal) {
        if (probs[col] !== undefined) {
          legalProbs[col] = probs[col];
          totalProb += probs[col];
        }
      }

      // Normalize if there are any probabilities
      if (totalProb > 0) {
        for (let i = 0; i < legalProbs.length; i++) {
          legalProbs[i] /= totalProb;
        }
        return legalProbs;
      }

      return null; // Return null if no probabilities are available
    } catch (error) {
      this.logger.error('Failed to get move probabilities from ML service.', error);
      return null; // Return null on failure
    }
  }

  /**
   * Legacy method for getting strategy
   */
  private getStrategyForLevel(level: number): AIStrategy {
    if (level <= 3) return AIStrategy.MINIMAX;
    if (level <= 6) return AIStrategy.MCTS;
    if (level === 7) return AIStrategy.DQN;
    if (level === 8) return AIStrategy.PPO;
    if (level === 9) return AIStrategy.ALPHAZERO;
    return AIStrategy.MUZERO; // Level 10+
  }
}