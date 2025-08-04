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
        if (aiLevel >= 5) {
          try {
            const mlResult = await this.mlClientService.getPrediction(board);
            probs = mlResult.probs;
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
      if (aiLevel >= 7) {
        const mlResult = await this.mlClientService.getPrediction(board);
        probs = mlResult.probs;
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
      const move = await this.mlClientService.getBestMove(board, aiDisc);
      const { probs } = await this.mlClientService.getPrediction(board);
      
      const confidence = probs[move] || 0.5;
      
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
  
  private getRandomMove(board: CellValue[][]): number {
    const moves = legalMoves(board);
    return moves[Math.floor(Math.random() * moves.length)] ?? 0;
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
      const { probs } = await this.mlClientService.getPrediction(board);
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