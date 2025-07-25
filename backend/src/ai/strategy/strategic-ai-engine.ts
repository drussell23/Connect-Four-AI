import { Injectable, Logger } from '@nestjs/common';
import { CellValue } from '../connect4AI';
import { EnhancedThreatDetector, ThreatAnalysis } from '../threat-detection/enhanced-threat-detector';
import { getDifficultyConfig, DifficultyConfig } from '../config/difficulty-config';

export interface StrategicMove {
  column: number;
  score: number;
  reasoning: string;
  threatAnalysis: ThreatAnalysis;
  priority: number;
}

@Injectable()
export class StrategicAIEngine {
  private readonly logger = new Logger(StrategicAIEngine.name);
  private readonly threatDetector = new EnhancedThreatDetector();
  
  /**
   * Get the best strategic move based on difficulty level
   */
  async getStrategicMove(
    board: CellValue[][],
    player: CellValue,
    difficulty: number,
    baseMove?: number
  ): Promise<StrategicMove> {
    const config = getDifficultyConfig(difficulty);
    const threatAnalysis = this.threatDetector.analyzeThreat(board, player);
    
    // Enhanced threat logging for debugging
    this.logger.debug(`[Level ${difficulty}] Threat analysis:`, {
      wins: threatAnalysis.immediateWins.length,
      blocks: threatAnalysis.immediateBlocks.length,
      blockDetails: threatAnalysis.immediateBlocks.map(b => ({
        col: b.column,
        dir: b.direction,
        priority: b.priority
      })),
      open3s: threatAnalysis.openThrees.length,
      forks: threatAnalysis.forks.length
    });
    
    // Get all possible moves with scores
    const candidateMoves = this.evaluateAllMoves(board, player, threatAnalysis, config);
    
    // Apply difficulty-based selection
    const selectedMove = this.selectMoveByDifficulty(candidateMoves, config, difficulty, baseMove);
    
    return selectedMove;
  }
  
  /**
   * Evaluate all possible moves
   */
  private evaluateAllMoves(
    board: CellValue[][],
    player: CellValue,
    threatAnalysis: ThreatAnalysis,
    config: DifficultyConfig
  ): StrategicMove[] {
    const moves: StrategicMove[] = [];
    
    for (let col = 0; col < 7; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue;
      
      const move = this.evaluateMove(board, row, col, player, threatAnalysis, config);
      moves.push(move);
    }
    
    // Sort by priority and score
    moves.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.score - a.score;
    });
    
    return moves;
  }
  
  /**
   * Evaluate a single move
   */
  private evaluateMove(
    board: CellValue[][],
    row: number,
    col: number,
    player: CellValue,
    threatAnalysis: ThreatAnalysis,
    config: DifficultyConfig
  ): StrategicMove {
    let score = 0;
    let priority = 5;
    const reasons: string[] = [];
    
    // Check if this is a winning move
    const win = threatAnalysis.immediateWins.find(t => t.column === col);
    if (win) {
      score += 10000;
      priority = 10;
      reasons.push('Winning move');
    }
    
    // Check if this blocks an opponent win - ALWAYS prioritize blocking wins
    const block = threatAnalysis.immediateBlocks.find(t => t.column === col);
    if (block) {
      // Prioritize threats based on human perception difficulty
      let threatScore = 9000;
      let threatUrgency = 9;
      
      switch (block.direction) {
        case 'vertical':
          // Vertical threats are hardest to see for humans
          threatScore = 9600;
          threatUrgency = 9.5;
          break;
        case 'diagonal-left':
        case 'diagonal-right':
          // Diagonal threats are moderately difficult
          threatScore = 9400;
          threatUrgency = 9.3;
          break;
        case 'horizontal':
          // Horizontal threats are easiest to spot
          threatScore = 9200;
          threatUrgency = 9.1;
          break;
      }
      
      // Additional bonus for blocking at higher difficulty levels
      if (config.behaviorProfile.blockingPriority >= 0.85) {
        threatScore += 200;
      }
      
      score += threatScore;
      priority = Math.max(priority, threatUrgency);
      reasons.push(`CRITICAL: Blocks ${block.direction} win`);
    }
    
    // Check if this creates or blocks open-threes
    if (config.strategicAwareness.detectOpenThrees) {
      const createsOpenThree = threatAnalysis.openThrees.filter(t => 
        t.player === player && t.column === col
      ).length;
      const blocksOpenThree = threatAnalysis.openThrees.filter(t => 
        t.player !== player && t.column === col
      ).length;
      
      if (createsOpenThree > 0 && config.strategicAwareness.createOpenThrees) {
        score += 500 * createsOpenThree;
        priority = Math.max(priority, 7);
        reasons.push(`Creates ${createsOpenThree} open-three(s)`);
      }
      
      if (blocksOpenThree > 0 && config.strategicAwareness.blockOpenThrees) {
        score += 400 * blocksOpenThree;
        priority = Math.max(priority, 7);
        reasons.push(`Blocks ${blocksOpenThree} open-three(s)`);
      }
    }
    
    // Check for fork creation/blocking
    if (config.strategicAwareness.detectForks) {
      const createsFork = threatAnalysis.forks.filter(t => 
        t.player === player && t.column === col
      ).length;
      const blocksFork = threatAnalysis.forks.filter(t => 
        t.player !== player && t.column === col
      ).length;
      
      if (createsFork > 0 && config.strategicAwareness.createForks) {
        score += 800 * createsFork;
        priority = Math.max(priority, 8);
        reasons.push(`Creates ${createsFork} fork(s)`);
      }
      
      if (blocksFork > 0 && config.strategicAwareness.blockForks) {
        score += 700 * blocksFork;
        priority = Math.max(priority, 8);
        reasons.push(`Blocks ${blocksFork} fork(s)`);
      }
    }
    
    // Positional scoring based on behavior profile
    score += this.getPositionalScore(col, config.behaviorProfile);
    
    // Setup moves
    const setups = threatAnalysis.setups.filter(t => t.column === col).length;
    if (setups > 0) {
      score += 100 * setups;
      reasons.push(`${setups} setup move(s)`);
    }
    
    return {
      column: col,
      score,
      reasoning: reasons.length > 0 ? reasons.join(', ') : 'Standard move',
      threatAnalysis,
      priority
    };
  }
  
  /**
   * Select move based on difficulty configuration
   */
  private selectMoveByDifficulty(
    moves: StrategicMove[],
    config: DifficultyConfig,
    difficulty: number,
    baseMove?: number
  ): StrategicMove {
    if (moves.length === 0) {
      // No valid moves
      return {
        column: 3,
        score: 0,
        reasoning: 'No valid moves',
        threatAnalysis: {
          immediateWins: [],
          immediateBlocks: [],
          openThrees: [],
          openTwos: [],
          forks: [],
          setups: [],
          totalThreatScore: 0
        },
        priority: 0
      };
    }
    
    // Apply mistake rate (for levels 1-3, increase chance of missing critical moves)
    const effectiveMistakeRate = difficulty <= 3 && moves[0].priority >= 9 ? 
      config.performanceTargets.mistakeRate * 0.7 : // 30% less likely to miss critical moves at low levels
      config.performanceTargets.mistakeRate;
      
    if (Math.random() < effectiveMistakeRate) {
      // Make an intentional mistake
      const mistakeTypes = ['random', 'suboptimal', 'miss_threat'];
      const mistakeType = mistakeTypes[Math.floor(Math.random() * mistakeTypes.length)];
      
      switch (mistakeType) {
        case 'random':
          // Pick a random valid move
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          randomMove.reasoning = 'Intentional mistake (random)';
          return randomMove;
          
        case 'suboptimal':
          // Pick a lower-ranked move
          if (moves.length > 2) {
            const suboptimalIndex = Math.floor(moves.length / 2 + Math.random() * (moves.length / 2));
            const suboptimalMove = moves[suboptimalIndex];
            suboptimalMove.reasoning = 'Intentional mistake (suboptimal)';
            return suboptimalMove;
          }
          break;
          
        case 'miss_threat':
          // Ignore high-priority threats
          const lowPriorityMoves = moves.filter(m => m.priority < 7);
          if (lowPriorityMoves.length > 0) {
            const missedThreat = lowPriorityMoves[0];
            missedThreat.reasoning = 'Intentional mistake (missed threat)';
            return missedThreat;
          }
          break;
      }
    }
    
    // ALWAYS block immediate wins first, regardless of other settings
    const criticalBlocks = moves.filter(m => m.reasoning.includes('CRITICAL: Blocks'));
    if (criticalBlocks.length > 0) {
      // Sort by priority (vertical > diagonal > horizontal)
      criticalBlocks.sort((a, b) => b.priority - a.priority);
      
      // At highest difficulties, also consider position quality
      if (config.behaviorProfile.blockingPriority >= 0.9 && criticalBlocks.length > 1) {
        // Among equally critical blocks, prefer center columns
        const centerDistance = (col: number) => Math.abs(col - 3);
        criticalBlocks.sort((a, b) => {
          const priorityDiff = b.priority - a.priority;
          if (Math.abs(priorityDiff) < 0.1) {
            return centerDistance(a.column) - centerDistance(b.column);
          }
          return priorityDiff;
        });
      }
      
      return criticalBlocks[0];
    }
    
    // Apply blocking priority adjustment for other threats
    if (config.behaviorProfile.blockingPriority > 0.5) {
      // Prefer blocking moves
      const blockingMoves = moves.filter(m => m.reasoning.includes('Blocks'));
      if (blockingMoves.length > 0) {
        return blockingMoves[0];
      }
    }
    
    // Apply aggressiveness
    if (config.behaviorProfile.aggressiveness > 0.7) {
      // Prefer aggressive moves (wins, open-threes, forks)
      const aggressiveMoves = moves.filter(m => 
        m.reasoning.includes('Winning') || 
        m.reasoning.includes('Creates') ||
        m.reasoning.includes('fork')
      );
      if (aggressiveMoves.length > 0) {
        return aggressiveMoves[0];
      }
    }
    
    // Apply randomness
    if (Math.random() < config.behaviorProfile.randomness) {
      // Add some randomness to move selection
      const topMoves = moves.slice(0, Math.min(3, moves.length));
      return topMoves[Math.floor(Math.random() * topMoves.length)];
    }
    
    // Default: pick the best move
    return moves[0];
  }
  
  /**
   * Get positional score based on behavior profile
   */
  private getPositionalScore(col: number, behaviorProfile: any): number {
    let score = 0;
    
    // Center preference
    const centerDistance = Math.abs(col - 3);
    score += (3 - centerDistance) * 10 * behaviorProfile.centerPreference;
    
    // Base positional value
    const positionValues = [30, 40, 50, 70, 50, 40, 30]; // Center columns are more valuable
    score += positionValues[col];
    
    return score;
  }
  
  /**
   * Helper to get drop row
   */
  private getDropRow(board: CellValue[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === null || board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }
  
  /**
   * Get a human-readable explanation of the AI's strategy at this difficulty
   */
  getStrategyExplanation(difficulty: number): string {
    const config = getDifficultyConfig(difficulty);
    const features: string[] = [];
    
    // Basic awareness (all levels)
    if (difficulty <= 3) {
      features.push('basic threat awareness (sometimes misses)');
    } else if (difficulty <= 5) {
      features.push('consistent threat detection');
    } else {
      features.push('advanced threat detection');
    }
    
    if (config.strategicAwareness.createOpenThrees) {
      features.push('creates own threats');
    }
    if (config.strategicAwareness.detectForks) {
      features.push('recognizes forks');
    }
    if (config.strategicAwareness.createForks) {
      features.push('creates strategic forks');
    }
    if (config.strategicAwareness.useAdvancedPatterns) {
      features.push('uses advanced patterns');
    }
    
    const mistakeRate = Math.round(config.performanceTargets.mistakeRate * 100);
    const winRate = Math.round(config.performanceTargets.winRate * 100);
    
    return `Level ${difficulty} (${config.name}): AI ${features.join(', ')}. ` +
           `Target win rate: ${winRate}%, Mistake rate: ${mistakeRate}%. ` +
           `Look-ahead: ${config.strategicAwareness.lookAhead} moves.`;
  }
}