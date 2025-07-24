// src/game/game-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CellValue, legalMoves } from '../ai/connect4AI';
import { minimax, mcts } from '../ai/connect4AI';
import { AiProfileService } from './ai-profile.service';
import { MlClientService } from '../ml/ml-client.service';
import { AsyncAIOrchestrator, AIRequest } from '../ai/async/async-ai-orchestrator';
import { AIStrategy } from '../ai/async/strategy-selector';

@Injectable()
export class GameAIService {
  private readonly logger = new Logger(GameAIService.name);
  private cache = new Map<string, number>();

  constructor(
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
    private readonly asyncAIOrchestrator?: AsyncAIOrchestrator,
  ) { }

  /**
   * Dynamically selects the AI's next move based on its current adaptive level.
   * The AI's level determines its difficulty and strategy.
   * Levels 1-3: Minimax with increasing depth.
   * Levels 4-6: MCTS with increasing iterations.
   * Levels 7-8: ML-guided MCTS.
   * Level 9+: Full ML model via ml-service.
   */
  async getNextMove(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    playerId: string = 'default_player',
    gameId?: string,
  ): Promise<number> {
    const profile = await this.aiProfileService.getOrCreateProfile(playerId);
    const aiLevel = profile.level;
    
    // Use async orchestrator if available and level > 3
    if (this.asyncAIOrchestrator && aiLevel > 3 && gameId) {
      try {
        const request: AIRequest = {
          gameId,
          board,
          player: aiDisc,
          difficulty: aiLevel,
          timeLimit: this.getTimeLimitForLevel(aiLevel),
          strategy: this.getStrategyForLevel(aiLevel),
          priority: aiLevel >= 7 ? 10 : 5,
        };

        const response = await this.asyncAIOrchestrator.getAIMove(request);
        
        this.logger.log(
          `Async AI chose column ${response.move} with ${response.confidence.toFixed(2)} confidence ` +
          `using ${response.strategy} strategy (cached: ${response.cached})`
        );
        
        return response.move;
      } catch (error) {
        this.logger.warn(`Async AI failed, falling back to standard implementation: ${error.message}`);
        // Fall through to standard implementation
      }
    }
    
    // Standard implementation (levels 1-3 or fallback)
    const key = JSON.stringify(board) + aiDisc + aiLevel;

    if (this.cache.has(key)) {
      this.logger.debug(`Cache hit for level ${aiLevel} -> returning column ${this.cache.get(key)}`);
      return this.cache.get(key)!;
    }

    this.logger.log(`Current AI Level: ${aiLevel} -> Executing Hybrid Strategy`);

    let move: number;

    // --- Level-Based Hybrid AI Strategy ---

    if (aiLevel <= 3) {
      // Levels 1-3: Minimax with Quiescence Search
      // Depth increases with level.
      const depth = aiLevel + 1; // Level 1 -> depth 2, Level 2 -> depth 3, etc.
      this.logger.log(`Using Minimax with depth ${depth}, enhanced by ML.`);
      try {
        const { probs } = await this.mlClientService.getPrediction(board);
        const result = minimax(board, depth, -Infinity, Infinity, true, aiDisc, probs);
        move = result.column ?? this.getRandomMove(board);
      } catch (error) {
        this.logger.warn(`Minimax enhancement failed: ${error.message}. Falling back to standard Minimax.`);
        const result = minimax(board, depth, -Infinity, Infinity, true, aiDisc);
        move = result.column ?? this.getRandomMove(board);
      }
    } else if (aiLevel <= 6) {
      // Levels 4-6: Enhanced MCTS
      // Iterations increase with level.
      const timeMs = 50 + (aiLevel - 4) * 50; // 50ms, 100ms, 150ms - 10x faster
      this.logger.log(`Using MCTS with time ${timeMs}ms, enhanced by ML.`);
      try {
        const { probs } = await this.mlClientService.getPrediction(board);
        move = mcts(board, aiDisc, timeMs, probs);
      } catch (error) {
        this.logger.warn(`MCTS enhancement failed: ${error.message}. Falling back to standard MCTS.`);
        move = mcts(board, aiDisc, timeMs);
      }

    } else if (aiLevel <= 8) {
      // Levels 7-8: ML-Guided MCTS
      // Fetches move probabilities from the ML model to guide MCTS.
      this.logger.log('Using ML-Guided MCTS');
      try {
        const moveProbs = await this.getMoveProbabilities(board);
        if (moveProbs) {
          const iterations = 200 * (aiLevel - 6); // Level 7 -> 200, Level 8 -> 400 - 5x faster
          // Pass probabilities to MCTS
          move = mcts(board, aiDisc, iterations, moveProbs);
        } else {
          this.logger.warn('ML-guided MCTS failed to get probs, falling back to standard MCTS');
          move = mcts(board, aiDisc, 400); // Fallback iterations - 5x faster
        }
      } catch (error) {
        this.logger.error('Error in ML-Guided MCTS, falling back to standard MCTS', error);
        move = mcts(board, aiDisc, 400); // 5x faster
      }
    } else {
      // Level 9+ (Nightmare Mode): Full ML Model
      this.logger.log('Engaging Nightmare Mode: Fetching move from ML model...');
      try {
        if (process.env.USE_ML_MODEL === 'true') {
          move = await this.mlClientService.getBestMove(board, aiDisc);
          this.logger.log(`ML Model chose column: ${move}`);
        } else {
          this.logger.warn('ML Model is disabled. Falling back to advanced MCTS.');
          // Fallback to a very high iteration MCTS if ML is off
          move = mcts(board, aiDisc, 1000); // 10x faster
        }
      } catch (error) {
        this.logger.error('Failed to get move from ML service, falling back to advanced MCTS.', error);
        move = mcts(board, aiDisc, 10000);
      }
    }

    this.cache.set(key, move);
    this.logger.log(`AI chose column: ${move}`);
    return move;
  }

  /**
   * Gets the appropriate time limit for the given AI level
   */
  private getTimeLimitForLevel(level: number): number {
    // Much faster time limits for responsive gameplay
    if (level <= 3) return 50;  // 10x faster
    if (level <= 6) return 100 + (level - 4) * 50; // 100ms, 150ms, 200ms
    if (level <= 8) return 300; // 10x faster
    return 500; // Level 9+ - still fast but accurate
  }

  /**
   * Gets the appropriate AI strategy for the given level
   */
  private getStrategyForLevel(level: number): AIStrategy {
    if (level <= 3) return AIStrategy.MINIMAX;
    if (level <= 6) return AIStrategy.MCTS;
    if (level === 7) return AIStrategy.DQN;
    if (level === 8) return AIStrategy.PPO;
    if (level === 9) return AIStrategy.ALPHAZERO;
    return AIStrategy.MUZERO; // Level 10+
  }

  /**
   * Gets a random legal move from the board.
   */
  private getRandomMove(board: CellValue[][]): number {
    const moves = legalMoves(board);
    if (moves.length === 0) {
      this.logger.error('No legal moves available, cannot get random move.');
      // This case should ideally not be reached in a normal game.
      // Returning an invalid move index to signal an issue.
      return -1;
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /**
   * Fetches move probabilities from the ML service and returns them.
   * This is used for the ML-guided MCTS.
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
}