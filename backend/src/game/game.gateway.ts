import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { GameAIService } from './game-ai.service';
import { AiProfileService } from './ai-profile.service';
import { MlClientService } from '../ml/ml-client.service';
import type { CellValue } from '../ai/connect4AI';

interface CreateGamePayload {
  playerId: string;
  difficulty?: number;
  startingPlayer?: CellValue;
}
interface JoinGamePayload { gameId: string; playerId: string }
interface DropDiscPayload { gameId: string; playerId: string; column: number }

@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GameGateway.name);
  private readonly AI_THINK_DELAY_MS = 500;
  private readonly AI_FIRST_MOVE_DELAY_MS = 200;

  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
  ) { }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
    this.gameService.setServer(server);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameService.handleDisconnect(client.id);
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() payload: CreateGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<any> {
    try {
      const { playerId, difficulty, startingPlayer } = payload;
      if (!playerId) throw new Error('playerId is required');

      // Use the provided starting player or default to Red
      const firstPlayer = startingPlayer || 'Red';

      const gameId = await this.gameService.createGame(playerId, client.id, firstPlayer);
      client.join(gameId);
      this.logger.log(`Game ${gameId} created by ${playerId}, starting player: ${firstPlayer}, difficulty: ${difficulty}`);

      // If AI is starting, trigger the first AI move immediately
      if (firstPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] AI is starting - triggering first move`);
        // Use a short delay to ensure the frontend has processed the game creation
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, 200);
      }

      // Return the callback response that the frontend expects
      return {
        success: true,
        gameId,
        nextPlayer: firstPlayer,
      };
    } catch (error: any) {
      this.logger.error(`createGame error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() payload: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { gameId, playerId } = payload;
      if (!gameId || !playerId) throw new Error('gameId and playerId are required');
      const res = await this.gameService.joinGame(gameId, playerId, client.id);
      if ('error' in res) throw new Error(res.error);
      client.join(gameId);
      this.logger.log(`Player ${playerId} joined game ${gameId}`);
      client.emit('gameJoined', { board: res.board, currentPlayer: res.currentPlayer });
    } catch (error: any) {
      this.logger.error(`joinGame error: ${error.message}`);
      client.emit('error', { event: 'joinGame', message: error.message });
    }
  }

  /**
   * Trigger an enhanced AI move with full capability integration
   */
  private async triggerAIMove(gameId: string, playerId: string): Promise<void> {
    try {
      this.logger.log(`[${gameId}] 🧠 Triggering Enhanced AI move`);

      // Emit AI thinking status with enhanced information
      this.server.to(gameId).emit('aiThinking', {
        status: 'thinking',
        capabilities: ['constitutional_ai', 'safety_monitoring', 'explainable_ai', 'real_time_adaptation']
      });

      // Moderate delay to show thinking process
      await new Promise(r => setTimeout(r, this.AI_THINK_DELAY_MS));

      // Get the current game state
      const game = this.gameService.getGame(gameId);
      if (!game) {
        this.logger.error(`[${gameId}] Game not found for AI move`);
        return;
      }

      // Generate Enhanced AI move using the integrated systems
      this.logger.log(`[${gameId}] 🎯 Computing Enhanced AI move`);
      const startTime = Date.now();

      const enhancedAIResult = await this.gameService.getAIMove(gameId, 'Yellow', playerId);
      const thinkingTime = Date.now() - startTime;

      this.logger.log(`[${gameId}] ✅ Enhanced AI computed move ${enhancedAIResult.column} in ${thinkingTime}ms`);

      // Emit enhanced thinking result
      this.server.to(gameId).emit('aiThinkingComplete', {
        column: enhancedAIResult.column,
        confidence: enhancedAIResult.confidence,
        thinkingTime,
        explanation: enhancedAIResult.explanation,
        safetyScore: enhancedAIResult.safetyScore,
        adaptationInfo: enhancedAIResult.adaptationInfo,
        curriculumInfo: enhancedAIResult.curriculumInfo
      });

      // Execute the AI move
      const aiRes = await this.gameService.dropDisc(gameId, 'AI', enhancedAIResult.column);
      if (!aiRes.success) {
        this.logger.error(`[${gameId}] AI move failed: ${aiRes.error}`);
        this.server.to(gameId).emit('error', {
          event: 'aiMove',
          message: 'Enhanced AI move failed',
          fallback: true
        });
        return;
      }

      // Emit the enhanced AI move result to clients
      this.server.to(gameId).emit('aiMove', {
        board: aiRes.board,
        lastMove: {
          column: enhancedAIResult.column,
          playerId: 'Yellow' as CellValue,
          confidence: enhancedAIResult.confidence,
          thinkingTime: thinkingTime
        },
        winner: aiRes.winner,
        draw: aiRes.draw,
        nextPlayer: aiRes.nextPlayer,

        // Enhanced AI Information
        enhancedData: {
          explanation: enhancedAIResult.explanation,
          confidence: enhancedAIResult.confidence,
          safetyScore: enhancedAIResult.safetyScore,
          adaptationInfo: enhancedAIResult.adaptationInfo,
          curriculumInfo: enhancedAIResult.curriculumInfo,
          debateResult: enhancedAIResult.debateResult,
          thinkingTime: thinkingTime
        },

        // Game Metrics
        gameMetrics: aiRes.gameMetrics,
        aiExplanation: aiRes.aiExplanation,
        curriculumUpdate: aiRes.curriculumUpdate
      });

      this.logger.log(
        `[${gameId}] 🎯 Enhanced AI played column ${enhancedAIResult.column} ` +
        `(confidence: ${(enhancedAIResult.confidence! * 100).toFixed(1)}%, ` +
        `safety: ${(enhancedAIResult.safetyScore! * 100).toFixed(1)}%)`
      );

      // Log explanation if available
      if (enhancedAIResult.explanation) {
        this.logger.debug(`[${gameId}] 💭 AI Explanation: ${enhancedAIResult.explanation}`);
      }

    } catch (error: any) {
      this.logger.error(`[${gameId}] Error in Enhanced AI move: ${error.message}`);
      this.server.to(gameId).emit('error', {
        event: 'enhancedAiMove',
        message: 'Enhanced AI move failed',
        fallback: 'Using basic AI fallback'
      });

      // Fallback to basic AI
      try {
        // Get the current game state for fallback
        const fallbackGame = this.gameService.getGame(gameId);
        if (!fallbackGame) {
          this.logger.error(`[${gameId}] Game not found for fallback AI move`);
          return;
        }

        const fallbackAI = await this.gameAi.getNextMove(fallbackGame.board, 'Yellow', playerId);
        const fallbackRes = await this.gameService.dropDisc(gameId, 'AI', fallbackAI);

        if (fallbackRes.success) {
          this.server.to(gameId).emit('aiMove', {
            board: fallbackRes.board,
            lastMove: { column: fallbackAI, playerId: 'Yellow' as CellValue },
            winner: fallbackRes.winner,
            draw: fallbackRes.draw,
            nextPlayer: fallbackRes.nextPlayer,
            enhancedData: {
              explanation: 'Fallback AI decision - Enhanced systems temporarily unavailable',
              confidence: 0.6,
              safetyScore: 1.0,
              thinkingTime: 100
            }
          });
        }
      } catch (fallbackError: any) {
        this.logger.error(`[${gameId}] Fallback AI also failed: ${fallbackError.message}`);
        this.server.to(gameId).emit('error', {
          event: 'fallbackAiMove',
          message: 'Both Enhanced and Fallback AI failed',
          details: fallbackError.message
        });
      }
    }
  }

  /**
   * Enhanced drop disc handler with additional AI capabilities
   */
  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() payload: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const { gameId, playerId, column } = payload;

    try {
      if (!gameId || !playerId || column === undefined) {
        throw new Error('gameId, playerId, and column are required');
      }

      this.logger.log(`[${gameId}] Player ${playerId} dropping disc in column ${column}`);

      // Execute the human move
      const result = await this.gameService.dropDisc(gameId, playerId, column);
      if (!result.success) {
        client.emit('error', {
          event: 'dropDisc',
          message: result.error,
        });
        return;
      }

      // Emit the enhanced human move result
      this.server.to(gameId).emit('playerMove', {
        board: result.board,
        lastMove: { column, playerId },
        winner: result.winner,
        draw: result.draw,
        nextPlayer: result.nextPlayer,
        gameMetrics: result.gameMetrics,
        curriculumUpdate: result.curriculumUpdate
      });

      this.logger.log(`[${gameId}] ✅ Player ${playerId} played column ${column}`);

      // If game continues and it's AI's turn, trigger enhanced AI move
      if (!result.winner && !result.draw && result.nextPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] 🤖 Triggering Enhanced AI response`);
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, this.AI_THINK_DELAY_MS);
      }

    } catch (error: any) {
      this.logger.error(`[${gameId}] dropDisc error: ${error.message}`);
      client.emit('error', {
        event: 'dropDisc',
        message: error.message,
      });
    }
  }

  /**
   * Handle requests for AI explanation
   */
  @SubscribeMessage('requestExplanation')
  async handleRequestExplanation(
    @MessageBody() payload: { gameId: string; playerId: string; moveIndex?: number },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { gameId, playerId, moveIndex } = payload;
      const game = this.gameService.getGame(gameId);

      if (!game) {
        client.emit('error', { event: 'requestExplanation', message: 'Game not found' });
        return;
      }

      // Get enhanced explanation for the move
      let explanation = 'No explanation available for this move.';

      if (moveIndex !== undefined && game.aiExplanations && game.aiExplanations[moveIndex]) {
        explanation = game.aiExplanations[moveIndex];
      } else if (game.aiExplanations && game.aiExplanations.length > 0) {
        explanation = game.aiExplanations[game.aiExplanations.length - 1];
      }

      client.emit('aiExplanation', {
        gameId,
        moveIndex,
        explanation,
        timestamp: Date.now()
      });

      this.logger.debug(`[${gameId}] 📖 Explanation provided to ${playerId}`);

    } catch (error: any) {
      this.logger.error(`requestExplanation error: ${error.message}`);
      client.emit('error', {
        event: 'requestExplanation',
        message: error.message
      });
    }
  }

  /**
   * Handle player feedback for RLHF
   */
  @SubscribeMessage('submitFeedback')
  async handleSubmitFeedback(
    @MessageBody() payload: {
      gameId: string;
      playerId: string;
      feedback: {
        rating: number;
        satisfaction: number;
        aiPerformance: number;
        explanation: string;
        suggestions?: string;
      };
    },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { gameId, playerId, feedback } = payload;

      this.logger.log(`[${gameId}] 📝 Received feedback from ${playerId}: Rating ${feedback.rating}/10`);

      // Process feedback for RLHF improvement
      // This would integrate with the Enhanced RLHF system

      client.emit('feedbackReceived', {
        gameId,
        message: 'Thank you for your feedback! It helps improve the AI.',
        timestamp: Date.now()
      });

    } catch (error: any) {
      this.logger.error(`submitFeedback error: ${error.message}`);
      client.emit('error', {
        event: 'submitFeedback',
        message: error.message
      });
    }
  }

  /**
   * Handle requests for player progress
   */
  @SubscribeMessage('getPlayerProgress')
  async handleGetPlayerProgress(
    @MessageBody() payload: { playerId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { playerId } = payload;

      // Get player profile and curriculum information
      // This would integrate with the adaptation and curriculum systems

      const mockProgress = {
        playerId,
        skillLevel: 0.6,
        currentStage: 'strategic_thinking',
        progress: 0.75,
        achievements: ['basic_tactics_complete', 'first_win', 'strategic_play'],
        nextObjectives: [
          'Master center control strategies',
          'Recognize complex threat patterns',
          'Improve endgame technique'
        ],
        recommendations: [
          'Focus on controlling center columns',
          'Practice identifying multiple threats',
          'Study endgame scenarios'
        ]
      };

      client.emit('playerProgress', mockProgress);
      this.logger.debug(`📊 Player progress sent to ${playerId}`);

    } catch (error: any) {
      this.logger.error(`getPlayerProgress error: ${error.message}`);
      client.emit('error', {
        event: 'getPlayerProgress',
        message: error.message
      });
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() payload: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): void {
    try {
      const { gameId, playerId } = payload;
      if (!gameId || !playerId) throw new Error('gameId and playerId are required');
      client.leave(gameId);
      this.gameService.handleLeave(gameId, playerId);
      this.logger.log(`Player ${playerId} left game ${gameId}`);
    } catch (error: any) {
      this.logger.error(`leaveGame error: ${error.message}`);
      client.emit('error', { event: 'leaveGame', message: error.message });
    }
  }
}
