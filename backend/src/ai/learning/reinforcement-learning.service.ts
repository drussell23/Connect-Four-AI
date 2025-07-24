import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GameOutcome {
  gameId: string;
  winner: CellValue;
  aiPlayer: CellValue;
  difficulty: number;
  moves: Move[];
  boardStates: CellValue[][][];
  timestamp: number;
}

export interface Move {
  player: CellValue;
  column: number;
  boardStateBefore: CellValue[][];
  boardStateAfter: CellValue[][];
  evaluation?: number;
}

export interface LearningUpdate {
  positionHash: string;
  outcome: 'win' | 'loss' | 'draw';
  difficulty: number;
  moveQuality: number;
}

@Injectable()
export class ReinforcementLearningService {
  private readonly logger = new Logger(ReinforcementLearningService.name);
  private readonly LEARNING_RATE = 0.01;
  private readonly DISCOUNT_FACTOR = 0.95;
  private readonly EXPLORATION_RATE = 0.1;
  
  // In-memory position evaluations (in production, use a database)
  private positionEvaluations: Map<string, PositionEvaluation> = new Map();
  private gameHistory: Map<string, GameOutcome> = new Map();
  private learningQueue: LearningUpdate[] = [];
  private isProcessing = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
    this.loadStoredEvaluations();
    this.startBackgroundLearning();
  }

  /**
   * Set up event listeners for game outcomes
   */
  private setupEventListeners(): void {
    // Listen for game endings
    this.eventEmitter.on('game.ended', async (data: any) => {
      if (data.aiPlayer && data.winner !== data.aiPlayer) {
        // AI lost - time to learn!
        await this.recordGameOutcome(data);
      }
    });

    // Listen for move evaluations
    this.eventEmitter.on('ai.move.evaluated', (data: any) => {
      this.recordMoveEvaluation(data);
    });
  }

  /**
   * Record a game outcome for learning
   */
  async recordGameOutcome(gameData: any): Promise<void> {
    const outcome: GameOutcome = {
      gameId: gameData.gameId,
      winner: gameData.winner,
      aiPlayer: gameData.aiPlayer,
      difficulty: gameData.difficulty || 5,
      moves: gameData.moves || [],
      boardStates: gameData.boardStates || [],
      timestamp: Date.now(),
    };

    this.gameHistory.set(outcome.gameId, outcome);
    
    // Queue learning updates for this game
    await this.queueLearningFromGame(outcome);
    
    this.logger.log(`[RL] Recorded game outcome: ${outcome.gameId}, AI lost as ${outcome.aiPlayer}`);
  }

  /**
   * Queue learning updates from a completed game
   */
  private async queueLearningFromGame(outcome: GameOutcome): Promise<void> {
    const aiLost = outcome.winner !== outcome.aiPlayer;
    
    // Analyze each AI move in the game
    for (let i = 0; i < outcome.moves.length; i++) {
      const move = outcome.moves[i];
      
      if (move.player === outcome.aiPlayer) {
        const positionHash = this.hashPosition(move.boardStateBefore);
        
        // Calculate move quality based on game outcome and move timing
        const moveQuality = this.calculateMoveQuality(i, outcome.moves.length, aiLost);
        
        const update: LearningUpdate = {
          positionHash,
          outcome: aiLost ? 'loss' : (outcome.winner ? 'win' : 'draw'),
          difficulty: outcome.difficulty,
          moveQuality,
        };
        
        this.learningQueue.push(update);
      }
    }
    
    this.logger.debug(`[RL] Queued ${this.learningQueue.length} learning updates`);
  }

  /**
   * Calculate move quality based on position in game and outcome
   */
  private calculateMoveQuality(moveIndex: number, totalMoves: number, aiLost: boolean): number {
    const gameProgress = moveIndex / totalMoves;
    
    if (aiLost) {
      // Penalize moves more heavily as they get closer to the loss
      return -1 * (0.5 + 0.5 * gameProgress);
    } else {
      // Reward moves, with higher rewards for decisive moves
      return 0.5 + 0.5 * gameProgress;
    }
  }

  /**
   * Background learning process using RLHF techniques
   */
  private async startBackgroundLearning(): Promise<void> {
    setInterval(async () => {
      if (!this.isProcessing && this.learningQueue.length > 0) {
        await this.processLearningQueue();
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process queued learning updates
   */
  private async processLearningQueue(): Promise<void> {
    this.isProcessing = true;
    const batchSize = Math.min(this.learningQueue.length, 50);
    const batch = this.learningQueue.splice(0, batchSize);
    
    this.logger.log(`[RL] Processing ${batch.length} learning updates`);
    
    for (const update of batch) {
      await this.applyLearningUpdate(update);
    }
    
    // Periodically save to disk
    if (this.positionEvaluations.size % 100 === 0) {
      await this.saveEvaluations();
    }
    
    this.isProcessing = false;
    
    // Emit learning progress
    this.eventEmitter.emit('ai.learning.progress', {
      positionsLearned: this.positionEvaluations.size,
      queueSize: this.learningQueue.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Apply a single learning update using Q-learning
   */
  private async applyLearningUpdate(update: LearningUpdate): Promise<void> {
    let evaluation = this.positionEvaluations.get(update.positionHash);
    
    if (!evaluation) {
      evaluation = {
        positionHash: update.positionHash,
        value: 0,
        visits: 0,
        wins: 0,
        losses: 0,
        lastUpdated: Date.now(),
        difficultyAdjustments: new Map(),
      };
    }
    
    // Update visit count
    evaluation.visits++;
    
    // Update outcome statistics
    if (update.outcome === 'win') {
      evaluation.wins++;
    } else if (update.outcome === 'loss') {
      evaluation.losses++;
    }
    
    // Q-learning update
    const oldValue = evaluation.value;
    const reward = update.moveQuality;
    const learningRate = this.LEARNING_RATE / Math.sqrt(evaluation.visits);
    
    // Update value using temporal difference learning
    evaluation.value = oldValue + learningRate * (reward - oldValue);
    
    // Store difficulty-specific adjustments
    const diffAdjustment = evaluation.difficultyAdjustments.get(update.difficulty) || 0;
    evaluation.difficultyAdjustments.set(
      update.difficulty,
      diffAdjustment + learningRate * (reward - diffAdjustment)
    );
    
    evaluation.lastUpdated = Date.now();
    this.positionEvaluations.set(update.positionHash, evaluation);
    
    this.logger.debug(
      `[RL] Updated position ${update.positionHash}: ` +
      `value ${oldValue.toFixed(3)} → ${evaluation.value.toFixed(3)}`
    );
  }

  /**
   * Get learned evaluation for a position
   */
  getPositionEvaluation(board: CellValue[][], difficulty: number): number | null {
    const hash = this.hashPosition(board);
    const evaluation = this.positionEvaluations.get(hash);
    
    if (!evaluation) return null;
    
    // Combine base value with difficulty-specific adjustment
    const diffAdjustment = evaluation.difficultyAdjustments.get(difficulty) || 0;
    const confidence = Math.min(evaluation.visits / 10, 1); // Confidence based on visits
    
    return evaluation.value + diffAdjustment * confidence;
  }

  /**
   * Get learning statistics
   */
  getLearningStats(): any {
    const totalPositions = this.positionEvaluations.size;
    const totalVisits = Array.from(this.positionEvaluations.values())
      .reduce((sum, posEval) => sum + posEval.visits, 0);
    
    const winPositions = Array.from(this.positionEvaluations.values())
      .filter(posEval => posEval.wins > posEval.losses).length;
    
    return {
      totalPositions,
      totalVisits,
      winPositions,
      lossPositions: totalPositions - winPositions,
      queueSize: this.learningQueue.length,
      averageVisitsPerPosition: totalVisits / totalPositions || 0,
    };
  }

  /**
   * Record move evaluation for immediate learning
   */
  private recordMoveEvaluation(data: any): void {
    if (data.board && data.evaluation !== undefined) {
      const hash = this.hashPosition(data.board);
      const evaluation = this.positionEvaluations.get(hash) || {
        positionHash: hash,
        value: 0,
        visits: 0,
        wins: 0,
        losses: 0,
        lastUpdated: Date.now(),
        difficultyAdjustments: new Map(),
      };
      
      // Immediate update based on AI's own evaluation
      evaluation.value = (evaluation.value * evaluation.visits + data.evaluation) / (evaluation.visits + 1);
      evaluation.visits++;
      evaluation.lastUpdated = Date.now();
      
      this.positionEvaluations.set(hash, evaluation);
    }
  }

  /**
   * Hash a board position for storage
   */
  private hashPosition(board: CellValue[][]): string {
    return board.map(row => 
      row.map(cell => cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '-').join('')
    ).join('|');
  }

  /**
   * Load stored evaluations from disk
   */
  private async loadStoredEvaluations(): Promise<void> {
    try {
      const filePath = path.join(__dirname, 'learned-positions.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const stored = JSON.parse(data);
      
      // Convert stored data back to Map structure
      for (const [hash, evalData] of Object.entries(stored)) {
        const evaluation = evalData as any;
        evaluation.difficultyAdjustments = new Map(evaluation.difficultyAdjustments || []);
        this.positionEvaluations.set(hash, evaluation);
      }
      
      this.logger.log(`[RL] Loaded ${this.positionEvaluations.size} learned positions`);
    } catch (error) {
      this.logger.debug('[RL] No stored evaluations found, starting fresh');
    }
  }

  /**
   * Save evaluations to disk
   */
  private async saveEvaluations(): Promise<void> {
    try {
      const filePath = path.join(__dirname, 'learned-positions.json');
      
      // Convert Map to serializable format
      const toSave: any = {};
      for (const [hash, evaluation] of this.positionEvaluations.entries()) {
        toSave[hash] = {
          ...evaluation,
          difficultyAdjustments: Array.from(evaluation.difficultyAdjustments.entries()),
        };
      }
      
      await fs.writeFile(filePath, JSON.stringify(toSave, null, 2));
      this.logger.debug(`[RL] Saved ${this.positionEvaluations.size} learned positions`);
    } catch (error) {
      this.logger.error('[RL] Failed to save evaluations:', error);
    }
  }

  /**
   * Export learning data for analysis
   */
  async exportLearningData(): Promise<any> {
    const stats = this.getLearningStats();
    const recentGames = Array.from(this.gameHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    return {
      stats,
      recentGames: recentGames.map(game => ({
        gameId: game.gameId,
        winner: game.winner,
        aiPlayer: game.aiPlayer,
        difficulty: game.difficulty,
        moveCount: game.moves.length,
        timestamp: new Date(game.timestamp).toISOString(),
      })),
      topPositions: Array.from(this.positionEvaluations.entries())
        .sort((a, b) => b[1].visits - a[1].visits)
        .slice(0, 20)
        .map(([hash, posEval]) => ({
          hash,
          value: posEval.value,
          visits: posEval.visits,
          winRate: posEval.visits > 0 ? posEval.wins / posEval.visits : 0,
        })),
    };
  }
}

interface PositionEvaluation {
  positionHash: string;
  value: number;
  visits: number;
  wins: number;
  losses: number;
  lastUpdated: number;
  difficultyAdjustments: Map<number, number>;
}