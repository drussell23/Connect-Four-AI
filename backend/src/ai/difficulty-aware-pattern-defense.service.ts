import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from './connect4AI';
import { LossPattern } from '../game/game.service';
import { PatternDefenseService, DefenseStrategy } from './pattern-defense.service';

export interface DifficultyAwareDefense extends DefenseStrategy {
  difficultyLevel: number;
  crossLevelInsights: string[];
  transferMatrix: Map<number, number>; // How well this transfers to other levels
  effectivenessHistory: Array<{
    level: number;
    gamesDefended: number;
    successRate: number;
  }>;
}

@Injectable()
export class DifficultyAwarePatternDefenseService extends PatternDefenseService {
  protected readonly difficultyLogger = new Logger(DifficultyAwarePatternDefenseService.name);
  
  // Difficulty-segmented defense database
  private difficultyDefenseDatabase: Map<number, Map<string, DifficultyAwareDefense[]>> = new Map();
  
  // Cross-level pattern transfer registry
  private patternTransferRegistry: Map<string, Array<{
    sourceLevel: number;
    targetLevel: number;
    pattern: string;
    transferConfidence: number;
    timestamp: Date;
  }>> = new Map();
  
  // Difficulty-specific metrics
  private difficultyMetrics = new Map<number, {
    patternsLearned: number;
    patternsDefended: number;
    crossLevelDefenses: number;
    winRateImprovement: number;
  }>();

  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter);
    this.initializeDifficultyLevels();
  }

  /**
   * Initialize defense strategies for all difficulty levels
   */
  private initializeDifficultyLevels() {
    for (let level = 1; level <= 10; level++) {
      this.difficultyDefenseDatabase.set(level, new Map());
      this.difficultyMetrics.set(level, {
        patternsLearned: 0,
        patternsDefended: 0,
        crossLevelDefenses: 0,
        winRateImprovement: 0
      });
      
      // Initialize with base strategies that get stronger with level
      this.initializeLevelDefenses(level);
    }
  }

  /**
   * Initialize level-specific base defenses
   */
  private initializeLevelDefenses(level: number) {
    const baseConfidence = 0.5 + (level * 0.05); // Higher confidence at higher levels
    
    // Horizontal defense
    const horizontalDefenses: DifficultyAwareDefense[] = [{
      pattern: 'horizontal',
      difficultyLevel: level,
      criticalPositions: this.generateLevelAwareCriticalPositions('horizontal', level),
      blockingMoves: this.calculateLevelBlockingMoves('horizontal', level),
      preventionStrategy: `Level ${level} horizontal defense: ${this.getStrategyForLevel(level)}`,
      confidence: baseConfidence,
      crossLevelInsights: [],
      transferMatrix: this.createTransferMatrix(level),
      effectivenessHistory: [],
      applicableDifficulties: this.getApplicableDifficulties(level),
      sourceLevel: level
    }];
    
    this.difficultyDefenseDatabase.get(level)!.set('horizontal', horizontalDefenses);
    
    // Similar initialization for other patterns
    this.initializePatternDefense('vertical', level, baseConfidence);
    this.initializePatternDefense('diagonal', level, baseConfidence);
    this.initializePatternDefense('anti-diagonal', level, baseConfidence);
  }

  /**
   * Learn from loss with difficulty awareness
   */
  async learnFromLossWithDifficulty(
    lossPattern: LossPattern, 
    board: CellValue[][], 
    moves: any[],
    difficulty: number
  ): Promise<void> {
    const normalizedDifficulty = Math.max(1, Math.min(10, Math.round(difficulty * 10)));
    
    this.difficultyLogger.log(`📚 Learning from ${lossPattern.type} loss at difficulty ${normalizedDifficulty}`);
    
    // Create difficulty-specific defense
    const newDefense = this.createDifficultyDefense(lossPattern, board, normalizedDifficulty);
    
    // Store for this difficulty level
    const levelDefenses = this.difficultyDefenseDatabase.get(normalizedDifficulty)!;
    const patternDefenses = levelDefenses.get(lossPattern.type) || [];
    patternDefenses.push(newDefense);
    levelDefenses.set(lossPattern.type, patternDefenses);
    
    // Update metrics
    const metrics = this.difficultyMetrics.get(normalizedDifficulty)!;
    metrics.patternsLearned++;
    
    // Transfer learning to higher difficulties
    await this.transferPatternKnowledge(newDefense, normalizedDifficulty);
    
    // Emit difficulty-aware learning event
    (this as any).eventEmitter.emit('pattern.defense.learned.difficulty', {
      pattern: lossPattern.type,
      difficulty: normalizedDifficulty,
      defense: newDefense,
      transferredTo: Array.from(newDefense.transferMatrix.keys())
    });
  }

  /**
   * Create defense strategy for specific difficulty
   */
  private createDifficultyDefense(
    lossPattern: LossPattern,
    board: CellValue[][],
    difficulty: number
  ): DifficultyAwareDefense {
    const missedDefenses = (this as any).extractMissedDefenses(lossPattern, board);
    
    return {
      pattern: lossPattern.type,
      difficultyLevel: difficulty,
      criticalPositions: missedDefenses.map((pos, idx) => ({
        ...pos,
        priority: 10 - idx + difficulty // Higher priority at higher difficulties
      })),
      blockingMoves: this.calculateAdaptiveBlockingMoves(lossPattern, difficulty),
      preventionStrategy: this.generateAdaptiveStrategy(lossPattern, difficulty),
      confidence: 0.7 + (difficulty * 0.03), // Higher confidence at higher levels
      crossLevelInsights: this.generateCrossLevelInsights(lossPattern, difficulty),
      transferMatrix: this.createTransferMatrix(difficulty),
      effectivenessHistory: [],
      applicableDifficulties: this.getApplicableDifficulties(difficulty),
      sourceLevel: difficulty
    };
  }

  /**
   * Transfer pattern knowledge to appropriate difficulty levels
   */
  private async transferPatternKnowledge(
    defense: DifficultyAwareDefense,
    sourceLevel: number
  ): Promise<void> {
    const transferTargets = this.calculateTransferTargets(sourceLevel);
    
    for (const targetLevel of transferTargets) {
      const transferConfidence = defense.transferMatrix.get(targetLevel) || 0;
      
      if (transferConfidence > 0.3) { // Only transfer if significant
        const transferredDefense = this.adaptDefenseForLevel(defense, targetLevel, transferConfidence);
        
        // Store transferred defense
        const targetDefenses = this.difficultyDefenseDatabase.get(targetLevel)!;
        const patternDefenses = targetDefenses.get(defense.pattern) || [];
        patternDefenses.push(transferredDefense);
        targetDefenses.set(defense.pattern, patternDefenses);
        
        // Record transfer
        this.recordPatternTransfer(sourceLevel, targetLevel, defense.pattern, transferConfidence);
        
        // Update metrics
        const metrics = this.difficultyMetrics.get(targetLevel)!;
        metrics.crossLevelDefenses++;
        
        this.difficultyLogger.log(
          `🔄 Transferred ${defense.pattern} defense from level ${sourceLevel} to ${targetLevel} ` +
          `with ${(transferConfidence * 100).toFixed(0)}% confidence`
        );
      }
    }
  }

  /**
   * Calculate which levels should receive pattern knowledge
   */
  private calculateTransferTargets(sourceLevel: number): number[] {
    const targets: number[] = [];
    
    // Always transfer to higher levels (they should know what lower levels know)
    for (let level = sourceLevel + 1; level <= 10; level++) {
      targets.push(level);
    }
    
    // Limited transfer to immediately lower level (for consistency)
    if (sourceLevel > 1) {
      targets.push(sourceLevel - 1);
    }
    
    return targets;
  }

  /**
   * Adapt defense strategy for target difficulty level
   */
  private adaptDefenseForLevel(
    defense: DifficultyAwareDefense,
    targetLevel: number,
    transferConfidence: number
  ): DifficultyAwareDefense {
    return {
      ...defense,
      difficultyLevel: targetLevel,
      confidence: defense.confidence * transferConfidence,
      transferConfidence,
      blockingMoves: this.adjustBlockingMovesForLevel(defense.blockingMoves, targetLevel),
      preventionStrategy: `${defense.preventionStrategy} [Adapted for level ${targetLevel}]`,
      crossLevelInsights: [
        ...defense.crossLevelInsights,
        `Learned from level ${defense.sourceLevel} experience`
      ],
      sourceLevel: defense.sourceLevel // Preserve original source
    };
  }

  /**
   * Get defense recommendation for specific difficulty
   */
  recommendDefenseWithDifficulty(
    board: CellValue[][],
    threats: any[],
    difficulty: number
  ): DefenseStrategy {
    const normalizedDifficulty = Math.max(1, Math.min(10, Math.round(difficulty * 10)));
    
    // First check difficulty-specific defenses
    const levelDefenses = this.getDifficultyDefenses(normalizedDifficulty);
    
    // Analyze current threats with difficulty awareness
    const analysis = this.analyzeThreatsWithDifficulty(board, normalizedDifficulty);
    
    // Find most relevant defense
    let bestDefense: DifficultyAwareDefense | null = null;
    let maxRelevance = 0;
    
    for (const [pattern, defenses] of levelDefenses) {
      for (const defense of defenses) {
        const relevance = this.calculateDefenseRelevance(defense, analysis, normalizedDifficulty);
        if (relevance > maxRelevance) {
          maxRelevance = relevance;
          bestDefense = defense;
        }
      }
    }
    
    if (bestDefense) {
      return {
        pattern: bestDefense.pattern,
        criticalPositions: bestDefense.criticalPositions,
        blockingMoves: bestDefense.blockingMoves,
        preventionStrategy: bestDefense.preventionStrategy,
        confidence: bestDefense.confidence * maxRelevance,
        applicableDifficulties: bestDefense.applicableDifficulties,
        sourceLevel: bestDefense.sourceLevel,
        transferConfidence: bestDefense.transferConfidence
      };
    }
    
    // Fallback to base implementation
    return super.recommendDefense(board, threats);
  }

  /**
   * Get all defenses for a difficulty level including transferred ones
   */
  private getDifficultyDefenses(difficulty: number): Map<string, DifficultyAwareDefense[]> {
    return this.difficultyDefenseDatabase.get(difficulty) || new Map();
  }

  /**
   * Calculate defense relevance for current situation
   */
  private calculateDefenseRelevance(
    defense: DifficultyAwareDefense,
    analysis: any,
    currentDifficulty: number
  ): number {
    let relevance = defense.confidence;
    
    // Boost relevance if defense is from same difficulty
    if (defense.difficultyLevel === currentDifficulty) {
      relevance *= 1.2;
    }
    
    // Consider transfer confidence if from different level
    if (defense.sourceLevel !== currentDifficulty && defense.transferConfidence) {
      relevance *= defense.transferConfidence;
    }
    
    // Factor in pattern match with current threats
    if (analysis.patternThreats[defense.pattern] > 0) {
      relevance *= (1 + analysis.patternThreats[defense.pattern] * 0.3);
    }
    
    // Consider effectiveness history
    const levelHistory = defense.effectivenessHistory.find(h => h.level === currentDifficulty);
    if (levelHistory && levelHistory.successRate > 0) {
      relevance *= (1 + levelHistory.successRate * 0.2);
    }
    
    return Math.min(relevance, 1.0);
  }

  /**
   * Helper methods for difficulty-aware functionality
   */
  
  private createTransferMatrix(sourceLevel: number): Map<number, number> {
    const matrix = new Map<number, number>();
    
    for (let targetLevel = 1; targetLevel <= 10; targetLevel++) {
      if (targetLevel === sourceLevel) {
        matrix.set(targetLevel, 1.0);
      } else if (targetLevel > sourceLevel) {
        // Higher levels get strong transfer from lower levels
        const decay = (targetLevel - sourceLevel) * 0.05;
        matrix.set(targetLevel, Math.max(0.5, 1.0 - decay));
      } else {
        // Lower levels get limited transfer from higher levels
        const decay = (sourceLevel - targetLevel) * 0.15;
        matrix.set(targetLevel, Math.max(0.2, 0.5 - decay));
      }
    }
    
    return matrix;
  }
  
  private getApplicableDifficulties(sourceLevel: number): number[] {
    const applicable: number[] = [];
    
    // Always applicable to same level
    applicable.push(sourceLevel);
    
    // Applicable to higher levels with decreasing effectiveness
    for (let level = sourceLevel + 1; level <= Math.min(10, sourceLevel + 3); level++) {
      applicable.push(level);
    }
    
    // Limited applicability to one level below
    if (sourceLevel > 1) {
      applicable.push(sourceLevel - 1);
    }
    
    return applicable;
  }
  
  private generateLevelAwareCriticalPositions(pattern: string, level: number): Array<{ row: number; column: number; priority: number }> {
    // Higher levels identify more critical positions
    const basePositions = super['getAdjacentPositions']({ row: 5, column: 3 }, pattern);
    const additionalPositions = Math.floor(level / 3);
    
    return basePositions.slice(0, 3 + additionalPositions).map((pos, idx) => ({
      ...pos,
      priority: 10 - idx + Math.floor(level / 2)
    }));
  }
  
  private calculateLevelBlockingMoves(pattern: string, level: number): number[] {
    const baseMoves = [3, 2, 4]; // Center-focused
    
    if (level >= 5) {
      baseMoves.push(1, 5); // Expand to near-center
    }
    
    if (level >= 8) {
      baseMoves.push(0, 6); // Consider edges at high levels
    }
    
    return baseMoves;
  }
  
  private getStrategyForLevel(level: number): string {
    if (level <= 3) {
      return "Basic pattern blocking with center control";
    } else if (level <= 6) {
      return "Advanced pattern recognition with multi-move lookahead";
    } else {
      return "Expert pattern defense with full-board strategic awareness";
    }
  }
  
  private initializePatternDefense(pattern: string, level: number, baseConfidence: number) {
    const defenses: DifficultyAwareDefense[] = [{
      pattern: pattern as any,
      difficultyLevel: level,
      criticalPositions: this.generateLevelAwareCriticalPositions(pattern, level),
      blockingMoves: this.calculateLevelBlockingMoves(pattern, level),
      preventionStrategy: `Level ${level} ${pattern} defense: ${this.getStrategyForLevel(level)}`,
      confidence: baseConfidence,
      crossLevelInsights: [],
      transferMatrix: this.createTransferMatrix(level),
      effectivenessHistory: [],
      applicableDifficulties: this.getApplicableDifficulties(level),
      sourceLevel: level
    }];
    
    this.difficultyDefenseDatabase.get(level)!.set(pattern, defenses);
  }
  
  private calculateAdaptiveBlockingMoves(lossPattern: LossPattern, difficulty: number): number[] {
    const moves = super['extractMissedDefenses'](lossPattern, Array(6).fill(Array(7).fill('Empty')))
      .map(pos => pos.column);
    
    // Higher difficulties consider more moves
    const maxMoves = 3 + Math.floor(difficulty / 3);
    return [...new Set(moves)].slice(0, maxMoves);
  }
  
  private generateAdaptiveStrategy(lossPattern: LossPattern, difficulty: number): string {
    const baseStrategy = super['generatePreventionStrategy'](lossPattern);
    const levelEnhancement = difficulty >= 7 ? 
      " Enhanced with predictive modeling and opponent profiling." :
      difficulty >= 4 ?
      " With proactive threat assessment." :
      "";
    
    return baseStrategy + levelEnhancement;
  }
  
  private generateCrossLevelInsights(lossPattern: LossPattern, difficulty: number): string[] {
    const insights: string[] = [];
    
    if (difficulty <= 3) {
      insights.push("Foundation pattern for higher-level defense strategies");
    } else if (difficulty <= 7) {
      insights.push("Intermediate complexity pattern requiring multi-move analysis");
    } else {
      insights.push("Advanced pattern demonstrating expert-level threat");
    }
    
    if (lossPattern.aiMistakes.length > 0) {
      insights.push(`Key mistakes to avoid: ${lossPattern.aiMistakes.join(', ')}`);
    }
    
    return insights;
  }
  
  private adjustBlockingMovesForLevel(moves: number[], targetLevel: number): number[] {
    if (targetLevel <= 3) {
      // Simpler levels focus on fewer moves
      return moves.slice(0, 2);
    } else if (targetLevel >= 8) {
      // Advanced levels may add adjacent columns
      const enhanced = [...moves];
      moves.forEach(col => {
        if (col > 0 && !enhanced.includes(col - 1)) enhanced.push(col - 1);
        if (col < 6 && !enhanced.includes(col + 1)) enhanced.push(col + 1);
      });
      return enhanced.slice(0, 5);
    }
    
    return moves;
  }
  
  private recordPatternTransfer(
    sourceLevel: number,
    targetLevel: number,
    pattern: string,
    confidence: number
  ): void {
    const key = `${pattern}_${sourceLevel}_to_${targetLevel}`;
    const transfers = this.patternTransferRegistry.get(key) || [];
    
    transfers.push({
      sourceLevel,
      targetLevel,
      pattern,
      transferConfidence: confidence,
      timestamp: new Date()
    });
    
    this.patternTransferRegistry.set(key, transfers);
  }
  
  private analyzeThreatsWithDifficulty(board: CellValue[][], difficulty: number): any {
    const baseAnalysis = super['analyzeThreats'](board);
    
    // Higher difficulties detect more subtle threats
    if (difficulty >= 5) {
      baseAnalysis.urgency *= 1.2;
    }
    
    if (difficulty >= 8) {
      // Expert levels consider setup moves as threats
      baseAnalysis.urgency *= 1.5;
    }
    
    return baseAnalysis;
  }
  
  /**
   * Get metrics for specific difficulty
   */
  getDifficultyMetrics(difficulty?: number) {
    if (difficulty !== undefined) {
      const normalized = Math.max(1, Math.min(10, Math.round(difficulty * 10)));
      return this.difficultyMetrics.get(normalized);
    }
    
    // Return all metrics
    const allMetrics: any = {};
    this.difficultyMetrics.forEach((metrics, level) => {
      allMetrics[`level_${level}`] = metrics;
    });
    
    return allMetrics;
  }
  
  /**
   * Get pattern transfer history
   */
  getPatternTransferHistory(): Array<any> {
    const history: any[] = [];
    
    this.patternTransferRegistry.forEach((transfers, key) => {
      transfers.forEach(transfer => {
        history.push({
          key,
          ...transfer,
          age: Date.now() - transfer.timestamp.getTime()
        });
      });
    });
    
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}