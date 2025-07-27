import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from './connect4AI';
import { LossPattern } from '../game/game.service';

export interface DefenseStrategy {
  pattern: 'horizontal' | 'vertical' | 'diagonal' | 'anti-diagonal';
  criticalPositions: Array<{ row: number; column: number; priority: number }>;
  blockingMoves: number[];
  preventionStrategy: string;
  confidence: number;
  applicableDifficulties?: number[]; // Which difficulty levels this applies to
  sourceLevel?: number; // Which difficulty level discovered this
  transferConfidence?: number; // Confidence when transferred to other levels
}

export interface PatternAnalysis {
  threatLevel: number;
  immediateThreats: Array<{ position: { row: number; column: number }; turns: number }>;
  potentialThreats: Array<{ position: { row: number; column: number }; probability: number }>;
  recommendedDefense: number[];
}

@Injectable()
export class PatternDefenseService {
  private readonly logger = new Logger(PatternDefenseService.name);
  
  // Store defense strategies learned from losses
  private defenseDatabase: Map<string, DefenseStrategy[]> = new Map();
  
  // Pattern-specific heuristics
  private readonly patternWeights = {
    horizontal: { center: 1.5, edge: 0.8, consecutive: 2.0 },
    vertical: { bottom: 1.2, stack: 1.8, setup: 1.5 },
    diagonal: { mainDiag: 1.6, antiDiag: 1.4, intersection: 2.2 },
    'anti-diagonal': { mainDiag: 1.4, antiDiag: 1.6, intersection: 2.2 }
  };
  
  // Defense improvement tracking
  private defenseMetrics = {
    successfulBlocks: 0,
    missedBlocks: 0,
    patternsPrevented: {
      horizontal: 0,
      vertical: 0,
      diagonal: 0,
      'anti-diagonal': 0
    },
    averageResponseTime: 0,
    criticalSaves: 0
  };

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDefenseStrategies();
    this.setupEventListeners();
  }

  /**
   * Initialize base defense strategies
   */
  private initializeDefenseStrategies() {
    // Horizontal defense
    this.defenseDatabase.set('horizontal', [
      {
        pattern: 'horizontal',
        criticalPositions: [
          { row: 5, column: 3, priority: 10 }, // Bottom center
          { row: 5, column: 2, priority: 9 },
          { row: 5, column: 4, priority: 9 }
        ],
        blockingMoves: [3, 2, 4], // Priority columns
        preventionStrategy: 'Control center columns and monitor horizontal connections',
        confidence: 0.85
      }
    ]);
    
    // Vertical defense
    this.defenseDatabase.set('vertical', [
      {
        pattern: 'vertical',
        criticalPositions: Array.from({ length: 7 }, (_, col) => ({
          row: 2, column: col, priority: 7 + (col === 3 ? 3 : 0)
        })),
        blockingMoves: [3, 2, 4, 1, 5, 0, 6],
        preventionStrategy: 'Prevent column stacking by alternating placements',
        confidence: 0.90
      }
    ]);
    
    // Diagonal defense
    this.defenseDatabase.set('diagonal', [
      {
        pattern: 'diagonal',
        criticalPositions: [
          { row: 3, column: 3, priority: 10 },
          { row: 2, column: 2, priority: 8 },
          { row: 4, column: 4, priority: 8 }
        ],
        blockingMoves: [3, 2, 4, 1, 5],
        preventionStrategy: 'Control diagonal lanes and key intersection points',
        confidence: 0.75
      }
    ]);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    // Learn from losses
    this.eventEmitter.on('ai.loss.pattern.detected', (data: any) => {
      this.learnFromLoss(data.lossPattern, data.board, data.moves);
    });
    
    // Provide defense recommendations
    this.eventEmitter.on('ai.request.defense', (data: any) => {
      const defense = this.recommendDefense(data.board, data.threats);
      this.eventEmitter.emit('ai.defense.recommendation', {
        requestId: data.requestId,
        defense
      });
    });
  }

  /**
   * Learn from a loss pattern to improve future defense
   */
  async learnFromLoss(lossPattern: LossPattern, board: CellValue[][], moves: any[]) {
    this.logger.log(`📚 Learning from ${lossPattern.type} loss pattern`);
    
    // Extract key defensive positions that were missed
    const missedDefenses = this.extractMissedDefenses(lossPattern, board);
    
    // Update defense strategy
    const existingStrategies = this.defenseDatabase.get(lossPattern.type) || [];
    const newStrategy: DefenseStrategy = {
      pattern: lossPattern.type,
      criticalPositions: missedDefenses.map((pos, idx) => ({
        ...pos,
        priority: 10 - idx
      })),
      blockingMoves: missedDefenses.map(pos => pos.column),
      preventionStrategy: this.generatePreventionStrategy(lossPattern),
      confidence: 0.7 + (this.defenseMetrics.successfulBlocks / 
                        (this.defenseMetrics.successfulBlocks + this.defenseMetrics.missedBlocks)) * 0.3
    };
    
    existingStrategies.push(newStrategy);
    this.defenseDatabase.set(lossPattern.type, existingStrategies);
    
    // Update metrics
    this.defenseMetrics.missedBlocks++;
    
    // Emit learning event
    this.eventEmitter.emit('pattern.defense.learned', {
      pattern: lossPattern.type,
      newStrategy,
      totalStrategies: existingStrategies.length
    });
  }

  /**
   * Extract positions where defense was needed
   */
  private extractMissedDefenses(lossPattern: LossPattern, board: CellValue[][]): Array<{ row: number; column: number }> {
    const positions: Array<{ row: number; column: number }> = [];
    
    // Add critical positions from loss pattern
    positions.push(...lossPattern.criticalPositions);
    
    // Add positions from winning sequence
    lossPattern.winningSequence.forEach(pos => {
      // Check adjacent positions that could have blocked
      const adjacentPositions = this.getAdjacentPositions(pos, lossPattern.type);
      adjacentPositions.forEach(adj => {
        if (this.isValidPosition(adj) && board[adj.row][adj.column] === 'Empty') {
          positions.push(adj);
        }
      });
    });
    
    // Remove duplicates and sort by importance
    const uniquePositions = Array.from(
      new Map(positions.map(p => [`${p.row},${p.column}`, p])).values()
    );
    
    return uniquePositions.slice(0, 5); // Top 5 positions
  }

  /**
   * Generate prevention strategy based on pattern
   */
  private generatePreventionStrategy(lossPattern: LossPattern): string {
    const strategies = {
      horizontal: `Block horizontal connections early. Focus on columns ${lossPattern.criticalPositions.map(p => p.column).join(', ')}. Watch for setup moves.`,
      vertical: `Prevent vertical stacking in columns ${lossPattern.criticalPositions.map(p => p.column).join(', ')}. Alternate defensive plays.`,
      diagonal: `Control diagonal lanes. Key positions: ${lossPattern.criticalPositions.map(p => `(${p.row},${p.column})`).join(', ')}. Block intersections.`,
      'anti-diagonal': `Monitor anti-diagonal threats. Critical squares: ${lossPattern.criticalPositions.map(p => `(${p.row},${p.column})`).join(', ')}.`
    };
    
    return strategies[lossPattern.type] || 'Improve general defensive awareness';
  }

  /**
   * Recommend defense against current threats
   */
  recommendDefense(board: CellValue[][], threats: any[]): DefenseStrategy {
    // Analyze board for potential patterns
    const analysis = this.analyzeThreats(board);
    
    // Find most dangerous pattern
    let mostDangerousPattern: 'horizontal' | 'vertical' | 'diagonal' | 'anti-diagonal' = 'horizontal';
    let maxThreat = 0;
    
    for (const [pattern, threatLevel] of Object.entries(analysis.patternThreats)) {
      if ((threatLevel as number) > maxThreat) {
        maxThreat = threatLevel as number;
        mostDangerousPattern = pattern as any;
      }
    }
    
    // Get relevant defense strategies
    const strategies = this.defenseDatabase.get(mostDangerousPattern) || [];
    
    // Combine strategies with current board analysis
    const recommendedMoves = this.calculateDefensiveMoves(board, mostDangerousPattern, analysis);
    
    return {
      pattern: mostDangerousPattern,
      criticalPositions: analysis.criticalPositions,
      blockingMoves: recommendedMoves,
      preventionStrategy: strategies[0]?.preventionStrategy || 'Defensive play required',
      confidence: Math.min(0.95, (strategies[0]?.confidence || 0.5) + analysis.urgency * 0.2)
    };
  }

  /**
   * Analyze current threats on the board
   */
  private analyzeThreats(board: CellValue[][]): any {
    const analysis = {
      patternThreats: {
        horizontal: 0,
        vertical: 0,
        diagonal: 0,
        'anti-diagonal': 0
      },
      criticalPositions: [] as Array<{ row: number; column: number; priority: number }>,
      urgency: 0
    };
    
    // Check each position for threat potential
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== 'Empty') continue;
        
        // Simulate opponent move
        board[row][col] = 'Red'; // Assume human is Red
        
        // Check if this creates threats
        const threats = this.checkThreatsAtPosition(board, row, col);
        
        if (threats.immediate) {
          analysis.criticalPositions.push({ row, column: col, priority: 10 });
          analysis.urgency = 1.0;
        } else if (threats.potential > 0) {
          analysis.criticalPositions.push({ 
            row, 
            column: col, 
            priority: Math.min(9, threats.potential * 3)
          });
        }
        
        // Update pattern threats
        for (const pattern of threats.patterns) {
          analysis.patternThreats[pattern] += threats.potential;
        }
        
        board[row][col] = 'Empty'; // Reset
      }
    }
    
    // Sort critical positions by priority
    analysis.criticalPositions.sort((a, b) => b.priority - a.priority);
    
    return analysis;
  }

  /**
   * Check threats at a specific position
   */
  private checkThreatsAtPosition(board: CellValue[][], row: number, col: number): any {
    const threats = {
      immediate: false,
      potential: 0,
      patterns: [] as string[]
    };
    
    const directions = [
      { dr: 0, dc: 1, pattern: 'horizontal' },
      { dr: 1, dc: 0, pattern: 'vertical' },
      { dr: 1, dc: 1, pattern: 'diagonal' },
      { dr: 1, dc: -1, pattern: 'anti-diagonal' }
    ];
    
    for (const { dr, dc, pattern } of directions) {
      const count = this.countInDirection(board, row, col, dr, dc, 'Red');
      
      if (count >= 3) {
        threats.immediate = true;
        threats.patterns.push(pattern);
      } else if (count >= 2) {
        threats.potential += count / 3;
        threats.patterns.push(pattern);
      }
    }
    
    return threats;
  }

  /**
   * Count pieces in a direction
   */
  private countInDirection(board: CellValue[][], row: number, col: number, dr: number, dc: number, player: CellValue): number {
    let count = 1;
    
    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + i * dr;
      const c = col + i * dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
      } else break;
    }
    
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - i * dr;
      const c = col - i * dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
      } else break;
    }
    
    return count;
  }

  /**
   * Calculate defensive moves based on pattern and analysis
   */
  private calculateDefensiveMoves(board: CellValue[][], pattern: string, analysis: any): number[] {
    const moves: number[] = [];
    
    // Add critical positions first
    analysis.criticalPositions.forEach((pos: any) => {
      if (!moves.includes(pos.column)) {
        moves.push(pos.column);
      }
    });
    
    // Add pattern-specific defensive columns
    const patternDefenses = this.defenseDatabase.get(pattern);
    if (patternDefenses && patternDefenses.length > 0) {
      patternDefenses[0].blockingMoves.forEach(col => {
        if (!moves.includes(col) && this.isColumnPlayable(board, col)) {
          moves.push(col);
        }
      });
    }
    
    return moves.slice(0, 3); // Top 3 defensive moves
  }

  /**
   * Get adjacent positions based on pattern type
   */
  private getAdjacentPositions(pos: { row: number; column: number }, pattern: string): Array<{ row: number; column: number }> {
    const positions: Array<{ row: number; column: number }> = [];
    
    switch (pattern) {
      case 'horizontal':
        positions.push({ row: pos.row, column: pos.column - 1 });
        positions.push({ row: pos.row, column: pos.column + 1 });
        break;
      case 'vertical':
        positions.push({ row: pos.row - 1, column: pos.column });
        positions.push({ row: pos.row + 1, column: pos.column });
        break;
      case 'diagonal':
        positions.push({ row: pos.row - 1, column: pos.column - 1 });
        positions.push({ row: pos.row + 1, column: pos.column + 1 });
        break;
      case 'anti-diagonal':
        positions.push({ row: pos.row - 1, column: pos.column + 1 });
        positions.push({ row: pos.row + 1, column: pos.column - 1 });
        break;
    }
    
    return positions;
  }

  /**
   * Check if position is valid
   */
  private isValidPosition(pos: { row: number; column: number }): boolean {
    return pos.row >= 0 && pos.row < 6 && pos.column >= 0 && pos.column < 7;
  }

  /**
   * Check if column is playable
   */
  private isColumnPlayable(board: CellValue[][], column: number): boolean {
    return board[0][column] === 'Empty';
  }

  /**
   * Get defense metrics
   */
  getDefenseMetrics() {
    return {
      ...this.defenseMetrics,
      successRate: this.defenseMetrics.successfulBlocks / 
                   (this.defenseMetrics.successfulBlocks + this.defenseMetrics.missedBlocks) || 0,
      totalStrategies: Array.from(this.defenseDatabase.values()).reduce((sum, strategies) => sum + strategies.length, 0)
    };
  }

  /**
   * Record successful defense
   */
  recordSuccessfulDefense(pattern: string) {
    this.defenseMetrics.successfulBlocks++;
    this.defenseMetrics.patternsPrevented[pattern as keyof typeof this.defenseMetrics.patternsPrevented]++;
    
    this.logger.log(`✅ Successfully defended against ${pattern} pattern`);
  }

  /**
   * Record critical save
   */
  recordCriticalSave() {
    this.defenseMetrics.criticalSaves++;
    this.logger.warn(`🛡️ Critical save! Total saves: ${this.defenseMetrics.criticalSaves}`);
  }
}