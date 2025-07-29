import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Board, CellValue, UnifiedThreatDetectorService } from './unified-threat-detector.service';

export interface UnifiedAIConfig {
  difficulty: number; // 1-10
  personality?: string;
  timeLimit?: number;
  useCache?: boolean;
  learningEnabled?: boolean;
  explanationLevel?: 'none' | 'basic' | 'detailed';
}

export interface UnifiedAIDecision {
  move: number;
  confidence: number;
  strategy: string;
  explanation: string;
  alternatives: Array<{
    move: number;
    score: number;
    reason: string;
  }>;
  metadata: {
    algorithm: string;
    computationTime: number;
    nodesEvaluated?: number;
    cacheHit: boolean;
    threatAnalysis: any;
  };
}

/**
 * Simplified Unified AI System - Focus on threat detection consistency
 */
@Injectable()
export class UnifiedAISystem implements OnModuleInit {
  private readonly logger = new Logger(UnifiedAISystem.name);
  private decisionCache = new Map<string, UnifiedAIDecision>();

  constructor(
    private readonly unifiedThreatDetector: UnifiedThreatDetectorService,
    private readonly eventEmitter: EventEmitter2
  ) {
    // EventEmitter is used for emitting AI decision events
  }

  async onModuleInit() {
    this.logger.log('🚀 Initializing Simplified Unified AI System...');
    this.logger.log('✅ Unified AI System ready with consistent threat detection');
  }

  /**
   * Main entry point for all AI decisions
   */
  async makeMove(
    board: Board,
    aiColor: CellValue,
    config: UnifiedAIConfig
  ): Promise<UnifiedAIDecision> {
    const startTime = Date.now();
    const boardKey = this.getBoardKey(board);
    
    // Check cache
    if (config.useCache && this.decisionCache.has(boardKey)) {
      const cached = this.decisionCache.get(boardKey)!;
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cacheHit: true,
          computationTime: Date.now() - startTime
        }
      };
    }

    try {
      // Step 1: Unified threat analysis
      const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
      const threatAnalysis = this.unifiedThreatDetector.analyzeBoardThreats(
        board,
        aiColor,
        opponentColor
      );

      // Step 2: Check for critical moves (wins/blocks)
      if (threatAnalysis.immediateWins.length > 0) {
        return this.createDecision(
          threatAnalysis.immediateWins[0].column,
          'immediate_win',
          'Taking winning move!',
          1.0,
          threatAnalysis,
          startTime
        );
      }

      if (threatAnalysis.immediateBlocks.length > 0) {
        return this.createDecision(
          threatAnalysis.immediateBlocks[0].column,
          'immediate_block',
          'Blocking opponent\'s winning threat!',
          0.95,
          threatAnalysis,
          startTime
        );
      }

      // Step 3: Use difficulty-based strategy
      const move = this.selectMoveByDifficulty(
        board,
        aiColor,
        threatAnalysis,
        config.difficulty
      );

      const decision = this.createDecision(
        move,
        this.getStrategyName(config.difficulty),
        this.getExplanation(config.difficulty, threatAnalysis),
        this.getConfidence(config.difficulty, threatAnalysis),
        threatAnalysis,
        startTime
      );

      // Cache decision
      if (config.useCache) {
        this.cacheDecision(boardKey, decision);
      }

      return decision;

    } catch (error) {
      this.logger.error(`AI decision error: ${error.message}`);
      return this.createFallbackDecision(board, startTime);
    }
  }

  /**
   * Quick move for time-critical situations
   */
  async quickMove(board: Board, aiColor: CellValue): Promise<number> {
    const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
    
    // Use unified threat detector for immediate threats only
    const immediateMove = this.unifiedThreatDetector.getImmediateThreat(
      board,
      aiColor,
      opponentColor
    );
    
    if (immediateMove !== -1) {
      return immediateMove;
    }

    // Simple heuristic: prefer center
    const validMoves = this.getValidMoves(board);
    const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
    
    if (centerMoves.length > 0) {
      return centerMoves[Math.floor(Math.random() * centerMoves.length)];
    }
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  private selectMoveByDifficulty(
    board: Board,
    _aiColor: CellValue,
    threatAnalysis: any,
    difficulty: number
  ): number {
    // Fork threats at higher difficulties
    if (difficulty >= 6 && threatAnalysis.forkThreats.length > 0) {
      return threatAnalysis.forkThreats[0].column;
    }

    // Setup moves at medium difficulties
    if (difficulty >= 4 && threatAnalysis.setupMoves.length > 0) {
      return threatAnalysis.setupMoves[0].column;
    }

    // Use best move from threat analysis
    if (threatAnalysis.bestMove !== -1) {
      return threatAnalysis.bestMove;
    }

    // Fallback to position-based selection
    return this.selectPositionalMove(board, difficulty);
  }

  private selectPositionalMove(board: Board, difficulty: number): number {
    const validMoves = this.getValidMoves(board);
    
    if (difficulty <= 3) {
      // Random with slight center bias
      const centerBias = Math.random() < 0.6;
      if (centerBias) {
        const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
        if (centerMoves.length > 0) {
          return centerMoves[Math.floor(Math.random() * centerMoves.length)];
        }
      }
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
      // Strong center preference
      const columnPriority = [3, 2, 4, 1, 5, 0, 6];
      for (const col of columnPriority) {
        if (validMoves.includes(col)) {
          return col;
        }
      }
      return validMoves[0];
    }
  }

  private createDecision(
    move: number,
    strategy: string,
    explanation: string,
    confidence: number,
    threatAnalysis: any,
    startTime: number
  ): UnifiedAIDecision {
    return {
      move,
      confidence,
      strategy,
      explanation,
      alternatives: [],
      metadata: {
        algorithm: 'unified_threat_detector',
        computationTime: Date.now() - startTime,
        cacheHit: false,
        threatAnalysis
      }
    };
  }

  private createFallbackDecision(board: Board, startTime: number): UnifiedAIDecision {
    const validMoves = this.getValidMoves(board);
    const move = validMoves.length > 0 ? validMoves[Math.floor(validMoves.length / 2)] : 3;
    
    return {
      move,
      confidence: 0.3,
      strategy: 'fallback',
      explanation: 'Emergency fallback move',
      alternatives: [],
      metadata: {
        algorithm: 'fallback',
        computationTime: Date.now() - startTime,
        cacheHit: false,
        threatAnalysis: null
      }
    };
  }

  private getValidMoves(board: Board): number[] {
    const valid: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        valid.push(col);
      }
    }
    return valid;
  }

  private getStrategyName(difficulty: number): string {
    if (difficulty <= 3) return 'basic_strategy';
    if (difficulty <= 6) return 'intermediate_strategy';
    return 'advanced_strategy';
  }

  private getExplanation(difficulty: number, threatAnalysis: any): string {
    if (threatAnalysis.forkThreats.length > 0) {
      return 'Creating multiple threats';
    }
    if (threatAnalysis.setupMoves.length > 0) {
      return 'Setting up future opportunities';
    }
    if (difficulty >= 7) {
      return 'Executing optimal strategy';
    }
    return 'Strategic positioning';
  }

  private getConfidence(difficulty: number, threatAnalysis: any): number {
    if (threatAnalysis.immediateWins.length > 0) return 1.0;
    if (threatAnalysis.immediateBlocks.length > 0) return 0.95;
    if (threatAnalysis.forkThreats.length > 0) return 0.85;
    if (threatAnalysis.setupMoves.length > 0) return 0.75;
    return 0.5 + (difficulty * 0.05);
  }

  private getBoardKey(board: Board): string {
    return board.map(row => row.join('')).join('|');
  }

  private cacheDecision(key: string, decision: UnifiedAIDecision): void {
    if (this.decisionCache.size >= 5000) {
      const firstKey = this.decisionCache.keys().next().value;
      this.decisionCache.delete(firstKey);
    }
    this.decisionCache.set(key, decision);
  }

  getSystemStatus() {
    return {
      version: 'simplified',
      cacheSize: this.decisionCache.size,
      components: {
        threatDetection: true,
        caching: true,
        difficultyAdaptation: true
      }
    };
  }
}