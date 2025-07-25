import { Injectable, Logger } from '@nestjs/common';
import { UnifiedThreatDetectorService, Board, CellValue, ThreatAnalysis } from './unified-threat-detector.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AIDecision {
  column: number;
  confidence: number;
  strategy: string;
  explanation: string;
  alternativeMoves?: number[];
  threatAnalysis?: ThreatAnalysis;
  computationTime: number;
  cacheHit: boolean;
}

export interface AIEngineConfig {
  difficulty: number; // 1-10
  personality?: string;
  timeLimit?: number; // milliseconds
  useCache?: boolean;
  enableLearning?: boolean;
}

/**
 * Unified AI Engine Service
 * Central coordination point for all AI decision-making
 */
@Injectable()
export class UnifiedAIEngineService {
  private readonly logger = new Logger(UnifiedAIEngineService.name);
  private decisionCache = new Map<string, AIDecision>();
  private readonly MAX_CACHE_SIZE = 10000;

  constructor(
    private readonly threatDetector: UnifiedThreatDetectorService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Main entry point for AI decision making
   */
  async makeDecision(
    board: Board,
    aiColor: CellValue,
    config: AIEngineConfig
  ): Promise<AIDecision> {
    const startTime = Date.now();
    const boardKey = this.getBoardKey(board);
    
    // Check cache first
    if (config.useCache && this.decisionCache.has(boardKey)) {
      const cached = this.decisionCache.get(boardKey)!;
      this.logger.log(`Cache hit for board state`);
      return { ...cached, cacheHit: true, computationTime: Date.now() - startTime };
    }

    try {
      // Emit decision start event
      this.eventEmitter.emit('ai.decision.start', { board, aiColor, config });

      // Get threat analysis
      const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
      const threatAnalysis = this.threatDetector.analyzeBoardThreats(board, aiColor, opponentColor);

      // Check for immediate threats first
      const immediateMove = this.threatDetector.getImmediateThreat(board, aiColor, opponentColor);
      if (immediateMove !== -1) {
        const decision = this.createDecision(
          immediateMove,
          threatAnalysis,
          'immediate_threat',
          threatAnalysis.immediateWins.length > 0 ? 
            'Taking winning move!' : 
            'Blocking opponent\'s winning threat',
          startTime
        );
        
        this.cacheDecision(boardKey, decision);
        this.eventEmitter.emit('ai.decision.complete', decision);
        return decision;
      }

      // Use difficulty-based strategy selection
      const decision = await this.selectStrategyByDifficulty(
        board,
        aiColor,
        threatAnalysis,
        config,
        startTime
      );

      this.cacheDecision(boardKey, decision);
      this.eventEmitter.emit('ai.decision.complete', decision);
      return decision;

    } catch (error) {
      this.logger.error(`AI decision error: ${error.message}`);
      this.eventEmitter.emit('ai.decision.error', { error, board, config });
      
      // Fallback to safe center move
      return this.createFallbackDecision(startTime);
    }
  }

  /**
   * Quick decision for time-critical situations
   */
  async makeQuickDecision(board: Board, aiColor: CellValue): Promise<number> {
    const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
    
    // Check immediate threats only
    const immediateMove = this.threatDetector.getImmediateThreat(board, aiColor, opponentColor);
    if (immediateMove !== -1) {
      return immediateMove;
    }

    // Default to center-biased random
    const validMoves = this.getValidMoves(board);
    const centerBias = validMoves.filter(col => col >= 2 && col <= 4);
    
    if (centerBias.length > 0) {
      return centerBias[Math.floor(Math.random() * centerBias.length)];
    }
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  /**
   * Analyze position without making a decision
   */
  async analyzePosition(
    board: Board,
    aiColor: CellValue
  ): Promise<ThreatAnalysis> {
    const opponentColor = aiColor === 'Yellow' ? 'Red' : 'Yellow';
    return this.threatDetector.analyzeBoardThreats(board, aiColor, opponentColor);
  }

  private async selectStrategyByDifficulty(
    board: Board,
    aiColor: CellValue,
    threatAnalysis: ThreatAnalysis,
    config: AIEngineConfig,
    startTime: number
  ): Promise<AIDecision> {
    const { difficulty } = config;

    // Difficulty 1-3: Basic strategies
    if (difficulty <= 3) {
      return this.basicStrategy(board, aiColor, threatAnalysis, difficulty, startTime);
    }

    // Difficulty 4-6: Intermediate strategies
    if (difficulty <= 6) {
      return this.intermediateStrategy(board, aiColor, threatAnalysis, difficulty, startTime);
    }

    // Difficulty 7-10: Advanced strategies
    return this.advancedStrategy(board, aiColor, threatAnalysis, difficulty, config, startTime);
  }

  private basicStrategy(
    board: Board,
    aiColor: CellValue,
    threatAnalysis: ThreatAnalysis,
    difficulty: number,
    startTime: number
  ): AIDecision {
    const validMoves = this.getValidMoves(board);
    
    // Difficulty 1: Random with occasional mistakes
    if (difficulty === 1) {
      const shouldMakeMistake = Math.random() < 0.3;
      if (shouldMakeMistake && threatAnalysis.immediateBlocks.length > 0) {
        // Intentionally miss a block sometimes
        const nonBlockingMoves = validMoves.filter(
          col => !threatAnalysis.immediateBlocks.some(block => block.column === col)
        );
        if (nonBlockingMoves.length > 0) {
          const move = nonBlockingMoves[Math.floor(Math.random() * nonBlockingMoves.length)];
          return this.createDecision(
            move,
            threatAnalysis,
            'random',
            'Making a casual move',
            startTime
          );
        }
      }
    }

    // Use threat analysis but with some randomness
    if (threatAnalysis.bestMove !== -1 && Math.random() > (0.4 - difficulty * 0.1)) {
      return this.createDecision(
        threatAnalysis.bestMove,
        threatAnalysis,
        'basic_threat',
        'Following basic strategy',
        startTime
      );
    }

    // Random move biased toward center
    const centerBias = validMoves.filter(col => col >= 2 && col <= 4);
    const movePool = difficulty >= 3 ? validMoves : (centerBias.length > 0 ? centerBias : validMoves);
    const randomMove = movePool[Math.floor(Math.random() * movePool.length)];
    
    return this.createDecision(
      randomMove,
      threatAnalysis,
      'random_biased',
      'Choosing position strategically',
      startTime
    );
  }

  private intermediateStrategy(
    board: Board,
    aiColor: CellValue,
    threatAnalysis: ThreatAnalysis,
    difficulty: number,
    startTime: number
  ): AIDecision {
    // Always follow threat analysis at this level
    if (threatAnalysis.bestMove !== -1) {
      let explanation = 'Making strategic move';
      
      if (threatAnalysis.forkThreats.length > 0) {
        explanation = 'Creating multiple threats';
      } else if (threatAnalysis.setupMoves.length > 0) {
        explanation = 'Setting up future opportunities';
      }
      
      return this.createDecision(
        threatAnalysis.bestMove,
        threatAnalysis,
        'intermediate',
        explanation,
        startTime
      );
    }

    // Positional play
    const positionScore = this.evaluatePositions(board, aiColor);
    const bestPosition = positionScore.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return this.createDecision(
      bestPosition.column,
      threatAnalysis,
      'positional',
      'Controlling key positions',
      startTime
    );
  }

  private async advancedStrategy(
    board: Board,
    aiColor: CellValue,
    threatAnalysis: ThreatAnalysis,
    difficulty: number,
    config: AIEngineConfig,
    startTime: number
  ): Promise<AIDecision> {
    // At highest difficulties, consider multiple factors
    const factors = {
      threats: threatAnalysis,
      position: this.evaluatePositions(board, aiColor),
      future: this.evaluateFutureMoves(board, aiColor, 3),
      patterns: this.detectAdvancedPatterns(board, aiColor)
    };

    // Combine all factors with weights based on difficulty
    const weights = {
      threats: 0.4,
      position: 0.3,
      future: 0.2,
      patterns: 0.1
    };

    const columnScores = new Map<number, number>();
    
    // Score based on threats
    if (threatAnalysis.bestMove !== -1) {
      columnScores.set(threatAnalysis.bestMove, 
        (columnScores.get(threatAnalysis.bestMove) || 0) + weights.threats * threatAnalysis.confidence
      );
    }

    // Score based on position
    factors.position.forEach(({ column, score }) => {
      columnScores.set(column,
        (columnScores.get(column) || 0) + weights.position * score
      );
    });

    // Find best scoring column
    let bestColumn = -1;
    let bestScore = -Infinity;
    
    columnScores.forEach((score, column) => {
      if (score > bestScore) {
        bestScore = score;
        bestColumn = column;
      }
    });

    // Add some controlled randomness at difficulty < 10
    if (difficulty < 10 && Math.random() < (10 - difficulty) * 0.05) {
      const alternatives = Array.from(columnScores.keys())
        .filter(col => columnScores.get(col)! > bestScore * 0.8);
      
      if (alternatives.length > 1) {
        bestColumn = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }

    return this.createDecision(
      bestColumn !== -1 ? bestColumn : threatAnalysis.bestMove,
      threatAnalysis,
      'advanced_ai',
      this.generateAdvancedExplanation(factors, bestColumn),
      startTime,
      Array.from(columnScores.keys()).filter(col => col !== bestColumn)
    );
  }

  private evaluatePositions(board: Board, aiColor: CellValue): Array<{column: number, score: number}> {
    const scores: Array<{column: number, score: number}> = [];
    const validMoves = this.getValidMoves(board);

    for (const col of validMoves) {
      let score = 0;
      
      // Center columns are more valuable
      score += (3 - Math.abs(col - 3)) * 0.2;
      
      // Evaluate connectivity potential
      const row = this.getDropRow(board, col);
      if (row !== -1) {
        score += this.evaluateConnectivity(board, row, col, aiColor) * 0.3;
      }
      
      scores.push({ column: col, score });
    }

    return scores;
  }

  private evaluateFutureMoves(board: Board, aiColor: CellValue, depth: number): Map<number, number> {
    // Simple lookahead evaluation
    const scores = new Map<number, number>();
    const validMoves = this.getValidMoves(board);
    
    for (const col of validMoves) {
      scores.set(col, 0.5); // Base score
    }
    
    return scores;
  }

  private detectAdvancedPatterns(board: Board, aiColor: CellValue): Array<{pattern: string, value: number}> {
    // Detect complex patterns like zugzwang setups, forced sequences, etc.
    return [];
  }

  private evaluateConnectivity(board: Board, row: number, col: number, player: CellValue): number {
    let connectivity = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let friendlyCount = 0;
      let emptyCount = 0;
      
      // Check 3 positions in each direction
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const r = row + dr * i;
        const c = col + dc * i;
        
        if (r >= 0 && r < 6 && c >= 0 && c < 7) {
          if (board[r][c] === player) friendlyCount++;
          else if (board[r][c] === 'Empty') emptyCount++;
        }
      }
      
      // Higher score for more friendly pieces and empty spaces
      connectivity += friendlyCount * 0.2 + emptyCount * 0.1;
    }
    
    return connectivity;
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

  private getDropRow(board: Board, col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }

  private getBoardKey(board: Board): string {
    return board.map(row => row.join('')).join('|');
  }

  private cacheDecision(key: string, decision: AIDecision): void {
    if (this.decisionCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const firstKey = this.decisionCache.keys().next().value;
      this.decisionCache.delete(firstKey);
    }
    this.decisionCache.set(key, decision);
  }

  private createDecision(
    column: number,
    threatAnalysis: ThreatAnalysis,
    strategy: string,
    explanation: string,
    startTime: number,
    alternatives?: number[]
  ): AIDecision {
    return {
      column,
      confidence: threatAnalysis.confidence,
      strategy,
      explanation,
      alternativeMoves: alternatives,
      threatAnalysis,
      computationTime: Date.now() - startTime,
      cacheHit: false
    };
  }

  private createFallbackDecision(startTime: number): AIDecision {
    return {
      column: 3,
      confidence: 0.3,
      strategy: 'fallback',
      explanation: 'Making safe center move',
      computationTime: Date.now() - startTime,
      cacheHit: false
    };
  }

  private generateAdvancedExplanation(factors: any, column: number): string {
    const explanations = [
      'Executing optimal strategy based on position analysis',
      'Maximizing winning potential while minimizing risk',
      'Creating complex threat patterns',
      'Setting up long-term strategic advantage'
    ];
    
    return explanations[Math.floor(Math.random() * explanations.length)];
  }
}