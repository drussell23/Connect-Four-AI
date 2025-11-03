import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameService } from './game.service';
import { GameAIService } from './game-ai.service';
import { OrganicAITimingService } from '../ai/organic-ai-timing.service';
import { CellValue } from '../ai/connect4AI';

export interface OrganicAIMove {
  gameId: string;
  playerId: string;
  difficulty: number;
}

@Injectable()
export class GameAIOrganicService {
  private readonly logger = new Logger(GameAIOrganicService.name);
  
  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly organicTiming: OrganicAITimingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  
  /**
   * Execute AI move with organic, consistent timing
   */
  async executeOrganicAIMove(request: OrganicAIMove): Promise<void> {
    const { gameId, difficulty } = request;
    const startTime = Date.now();
    
    try {
      // Get game state
      const game = this.gameService.getGame(gameId);
      if (!game) {
        this.logger.error(`Game ${gameId} not found`);
        return;
      }
      
      // Calculate move complexity
      const moveNumber = game.board.flat().filter(cell => cell !== 'Empty').length / 2 + 1;
      const boardComplexity = this.organicTiming.calculateBoardComplexity(game.board);
      const isCriticalMove = this.checkForCriticalMoves(game.board);
      
      // Determine natural thinking time
      const thinkingTime = this.organicTiming.calculateThinkingTime(
        moveNumber,
        difficulty,
        boardComplexity,
        isCriticalMove,
        'balanced'
      );
      
      this.logger.log(`[${gameId}] AI thinking time: ${thinkingTime}ms (move ${moveNumber}, complexity ${boardComplexity.toFixed(2)})`);
      
      // Start AI computation in parallel with timing simulation
      const aiMovePromise = this.computeAIMove(game.board, difficulty, gameId);
      
      // Simulate natural thinking progression (events are throttled internally)
      const timingPromise = this.organicTiming.simulateThinking(
        thinkingTime,
        gameId
      );
      
      // Wait for both AI computation and minimum thinking time
      const [aiResult] = await Promise.all([
        aiMovePromise,
        timingPromise,
      ]);
      
      // Ensure we've waited the full thinking time
      await this.organicTiming.ensureMinimumThinkingTime(startTime, thinkingTime, aiResult.computationTime);
      
      // Execute the move
      const moveResult = await this.gameService.dropDisc(gameId, 'AI', aiResult.column);
      
      if (!moveResult.success) {
        throw new Error(moveResult.error || 'Failed to execute AI move');
      }
      
      // Emit the completed move
      this.logger.log(`[${gameId}] Emitting aiMove event with nextPlayer=${moveResult.nextPlayer}`);
      this.eventEmitter.emit('aiMove', {
        gameId,
        column: aiResult.column,
        board: moveResult.board,
        lastMove: {
          column: aiResult.column,
          playerId: 'Yellow',
          confidence: aiResult.confidence,
          strategy: aiResult.strategy,
        },
        winner: moveResult.winner,
        draw: moveResult.draw,
        nextPlayer: moveResult.nextPlayer,
        thinkingTime: Date.now() - startTime,
        naturalTiming: true,
        gameMetrics: moveResult.gameMetrics,
      });
      
      this.logger.log(`[${gameId}] AI move completed naturally in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      this.logger.error(`[${gameId}] AI move error:`, error);
      
      // Even on error, ensure consistent timing
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }
      
      // Emit error
      this.eventEmitter.emit('aiMoveError', {
        gameId,
        error: error.message,
      });
    }
  }
  
  /**
   * Compute AI move with timeout protection
   */
  private async computeAIMove(
    board: CellValue[][],
    difficulty: number,
    gameId: string
  ): Promise<{ column: number; confidence: number; strategy: string; computationTime: number }> {
    const computeStart = Date.now();
    
    try {
      // Set a hard timeout of 3 seconds for AI computation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI computation timeout')), 3000);
      });
      
      const aiPromise = this.gameAi.getNextMove(board, 'Yellow', 'AI', gameId, {
        timeLimit: 2500, // Give AI 2.5s max
        explainMove: false,
      });
      
      const result = await Promise.race([aiPromise, timeoutPromise]);
      const computationTime = Date.now() - computeStart;
      
      if (typeof result === 'number') {
        return {
          column: result,
          confidence: 0.8,
          strategy: 'standard',
          computationTime,
        };
      } else {
        return {
          column: result.move,
          confidence: result.confidence || 0.8,
          strategy: 'advanced',
          computationTime,
        };
      }
    } catch (error) {
      this.logger.warn(`AI computation failed, using fallback: ${error.message}`);
      
      // Quick fallback move
      const validMoves = [];
      for (let col = 0; col < 7; col++) {
        if (board[0][col] === 'Empty') {
          validMoves.push(col);
        }
      }
      
      // Prefer center columns
      const centerCol = validMoves.find(col => col === 3) ?? 
                       validMoves.find(col => col === 2 || col === 4) ??
                       validMoves[Math.floor(validMoves.length / 2)];
      
      return {
        column: centerCol,
        confidence: 0.5,
        strategy: 'fallback',
        computationTime: Date.now() - computeStart,
      };
    }
  }
  
  /**
   * Check if the current board state requires critical defensive moves
   */
  private checkForCriticalMoves(board: CellValue[][]): boolean {
    // Simplified check - just look for 3-in-a-row threats
    // In a real implementation, this would be more sophisticated
    const pieceCount = board.flat().filter(cell => cell !== 'Empty').length;
    return pieceCount > 6; // Threats possible after 6 moves
  }
}