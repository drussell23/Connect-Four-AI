import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UnifiedAIEngineService, AIDecision, AIEngineConfig } from './unified-ai-engine.service';
import { UnifiedThreatDetectorService, Board, CellValue } from './unified-threat-detector.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface UnifiedAIResponse {
  move: number;
  decision: AIDecision;
  source: 'unified' | 'legacy' | 'fallback';
  metadata: {
    orchestrator?: string;
    processingTime: number;
    threatDetectionUsed: boolean;
    cacheUtilized: boolean;
  };
}

/**
 * Unified AI Coordinator Service
 * Manages integration between unified AI system and existing AI components
 */
@Injectable()
export class UnifiedAICoordinatorService implements OnModuleInit {
  private readonly logger = new Logger(UnifiedAICoordinatorService.name);
  private initialized = false;
  private legacySystemsAvailable = false;

  constructor(
    private readonly unifiedEngine: UnifiedAIEngineService,
    private readonly threatDetector: UnifiedThreatDetectorService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    this.logger.log('🎯 Initializing Unified AI Coordinator...');
    
    // Simplified version without legacy dependencies
    this.legacySystemsAvailable = false;

    if (this.legacySystemsAvailable) {
      this.logger.log('📦 Legacy AI systems detected - enabling hybrid mode');
    } else {
      this.logger.log('✨ Operating in pure unified mode');
    }

    // Register event listeners
    this.setupEventListeners();
    
    this.initialized = true;
    this.logger.log('✅ Unified AI Coordinator initialized successfully');
  }

  /**
   * Main entry point for AI move requests
   * Routes to appropriate AI system based on configuration and availability
   */
  async getAIMove(
    gameId: string,
    board: Board,
    aiColor: CellValue,
    difficulty: number = 5,
    options: {
      timeLimit?: number;
      useCache?: boolean;
      forceLegacy?: boolean;
      forceUnified?: boolean;
    } = {}
  ): Promise<UnifiedAIResponse> {
    const startTime = Date.now();

    try {
      // Force unified system if requested or legacy not available
      if (options.forceUnified || !this.legacySystemsAvailable) {
        return await this.getUnifiedMove(board, aiColor, difficulty, options, startTime);
      }

      // Force legacy system if requested
      if (options.forceLegacy && this.legacySystemsAvailable) {
        return await this.getLegacyMove(gameId, board, aiColor, difficulty, startTime);
      }

      // Hybrid approach: Use unified for threat detection, legacy for complex decisions
      return await this.getHybridMove(gameId, board, aiColor, difficulty, options, startTime);

    } catch (error) {
      this.logger.error(`AI Coordinator error: ${error.message}`);
      return this.getFallbackMove(board, aiColor, startTime);
    }
  }

  /**
   * Quick move for time-critical situations
   */
  async getQuickMove(board: Board, aiColor: CellValue): Promise<number> {
    try {
      return await this.unifiedEngine.makeQuickDecision(board, aiColor);
    } catch (error) {
      this.logger.error(`Quick move error: ${error.message}`);
      // Fallback to first valid move
      for (let col = 0; col < 7; col++) {
        if (board[0][col] === 'Empty') return col;
      }
      return 3; // Center as last resort
    }
  }

  /**
   * Analyze board state without making a move
   */
  async analyzeBoard(board: Board, aiColor: CellValue) {
    return this.unifiedEngine.analyzePosition(board, aiColor);
  }

  private async getUnifiedMove(
    board: Board,
    aiColor: CellValue,
    difficulty: number,
    options: any,
    startTime: number
  ): Promise<UnifiedAIResponse> {
    const config: AIEngineConfig = {
      difficulty,
      timeLimit: options.timeLimit,
      useCache: options.useCache ?? true,
      enableLearning: true
    };

    const decision = await this.unifiedEngine.makeDecision(board, aiColor, config);

    return {
      move: decision.column,
      decision,
      source: 'unified',
      metadata: {
        processingTime: Date.now() - startTime,
        threatDetectionUsed: true,
        cacheUtilized: decision.cacheHit
      }
    };
  }

  private async getLegacyMove(
    gameId: string,
    board: Board,
    aiColor: CellValue,
    difficulty: number,
    startTime: number
  ): Promise<UnifiedAIResponse> {
    try {
      // Simplified version - no legacy systems available
      throw new Error('Legacy systems not available in simplified version');
    } catch (error) {
      this.logger.error(`Legacy AI error: ${error.message}`);
      throw error;
    }
  }

  private async getHybridMove(
    gameId: string,
    board: Board,
    aiColor: CellValue,
    difficulty: number,
    options: any,
    startTime: number
  ): Promise<UnifiedAIResponse> {
    // First, use unified threat detection
    const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
    const immediateMove = this.threatDetector.getImmediateThreat(board, aiColor, opponentColor);
    
    if (immediateMove !== -1) {
      // Immediate threat found - use unified system's response
      this.logger.log('🚨 Immediate threat detected - using unified response');
      
      const threatAnalysis = await this.unifiedEngine.analyzePosition(board, aiColor);
      const decision: AIDecision = {
        column: immediateMove,
        confidence: 1.0,
        strategy: 'hybrid_threat',
        explanation: threatAnalysis.immediateWins.length > 0 ? 
          'Taking winning move!' : 
          'Blocking opponent threat!',
        threatAnalysis,
        computationTime: Date.now() - startTime,
        cacheHit: false
      };

      return {
        move: immediateMove,
        decision,
        source: 'unified',
        metadata: {
          orchestrator: 'hybrid',
          processingTime: Date.now() - startTime,
          threatDetectionUsed: true,
          cacheUtilized: false
        }
      };
    }

    // No immediate threats - use legacy system for complex decision
    this.logger.log('🎯 No immediate threats - delegating to legacy system');
    const legacyResponse = await this.getLegacyMove(gameId, board, aiColor, difficulty, startTime);
    
    // Validate legacy move with threat detector
    const validationAnalysis = await this.unifiedEngine.analyzePosition(board, aiColor);
    if (validationAnalysis.immediateBlocks.length > 0) {
      this.logger.warn('⚠️  Legacy system missed a threat - overriding with safe move');
      legacyResponse.move = validationAnalysis.immediateBlocks[0].column;
      legacyResponse.decision.explanation = 'Corrected move to block threat';
    }

    legacyResponse.metadata.threatDetectionUsed = true;
    return legacyResponse;
  }

  private getFallbackMove(
    board: Board,
    aiColor: CellValue,
    startTime: number
  ): UnifiedAIResponse {
    // Simple fallback: center-biased random
    const validMoves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }

    const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
    const move = centerMoves.length > 0 ? 
      centerMoves[Math.floor(Math.random() * centerMoves.length)] :
      validMoves[Math.floor(Math.random() * validMoves.length)];

    const decision: AIDecision = {
      column: move,
      confidence: 0.3,
      strategy: 'fallback',
      explanation: 'Emergency fallback move',
      computationTime: Date.now() - startTime,
      cacheHit: false
    };

    return {
      move,
      decision,
      source: 'fallback',
      metadata: {
        processingTime: Date.now() - startTime,
        threatDetectionUsed: false,
        cacheUtilized: false
      }
    };
  }

  private setupEventListeners() {
    // Listen for AI performance events
    this.eventEmitter.on('ai.decision.complete', (decision: AIDecision) => {
      this.logger.debug(`AI Decision: Column ${decision.column}, Strategy: ${decision.strategy}`);
    });

    this.eventEmitter.on('ai.decision.error', (data: any) => {
      this.logger.error(`AI Decision Error: ${data.error.message}`);
    });

    // Listen for game events to clear cache
    this.eventEmitter.on('game.ended', () => {
      this.logger.debug('Game ended - considering cache clear');
    });
  }

  /**
   * Get system status and statistics
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      mode: this.legacySystemsAvailable ? 'hybrid' : 'unified',
      availableSystems: {
        unified: true,
        adaptive: false,
        async: false,
        gameAI: false
      }
    };
  }
}