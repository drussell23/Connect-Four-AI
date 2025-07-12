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
import type { CellValue } from '../ai/connect4AI';
import { MLInferenceClient } from '../ai/MLInferenceClient';

interface CreateGamePayload { playerId: string }
interface JoinGamePayload { gameId: string; playerId: string }
interface DropDiscPayload { gameId: string; playerId: string; column: number }

@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GameGateway.name);
  private readonly AI_THINK_DELAY_MS = 500;

  private readonly mlClient = new MLInferenceClient({
    baseUrl: 'http://localhost:8000',
    timeoutMs: 5000,
    maxRetries: 3,
    retryDelayMs: 200,
  });

  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly aiProfileService: AiProfileService,
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
      const { playerId } = payload;
      if (!playerId) throw new Error('playerId is required');
      const gameId = await this.gameService.createGame(playerId, client.id);
      client.join(gameId);
      this.logger.log(`Game ${gameId} created by ${playerId}`);

      // Return the callback response that the frontend expects
      return {
        success: true,
        gameId,
        nextPlayer: 'Red' as CellValue,
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

  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() payload: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { gameId, playerId, column } = payload;
      if (!gameId || !playerId || column == null) {
        throw new Error('gameId, playerId, and column are required');
      }
      if (column < 0 || column > 6) {
        throw new Error('Invalid column index');
      }

      this.logger.log(`[${gameId}] Human dropDisc by ${playerId} at column ${column}`);
      const res = await this.gameService.dropDisc(gameId, playerId, column);
      if (!res.success) throw new Error(res.error);

      this.server.to(gameId).emit('playerMove', {
        board: res.board,
        lastMove: { column, playerId },
        winner: res.winner,
        draw: res.draw,
        nextPlayer: res.nextPlayer,
      });

      // If the human player won, record the game result to level up the AI.
      if (res.winner && res.winner !== 'Yellow') {
        this.logger.log(`[${gameId}] Human player ${res.winner} won. Recording game result.`);
        try {
          await this.aiProfileService.recordGameResult(playerId, {
            gameId: gameId,
            playerMoves: this.gameService.getPlayerMoves(gameId, playerId),
            aiMoves: this.gameService.getPlayerMoves(gameId, 'Yellow'),
            winner: 'player',
            gameLength: this.gameService.getGameLength(gameId),
            playerMistakes: 0, // TODO: Implement mistake counting
            aiThreatsMissed: 0, // TODO: Implement threat analysis
            analysisNotes: ['Player victory']
          });
        } catch (error: any) {
          this.logger.error(`Error recording game result: ${error.message}`);
        }
      } else if (res.winner === 'Yellow') {
        this.logger.log(`[${gameId}] AI won. Recording game result.`);
        try {
          await this.aiProfileService.recordGameResult(playerId, {
            gameId: gameId,
            playerMoves: this.gameService.getPlayerMoves(gameId, playerId),
            aiMoves: this.gameService.getPlayerMoves(gameId, 'Yellow'),
            winner: 'ai',
            gameLength: this.gameService.getGameLength(gameId),
            playerMistakes: 0, // TODO: Implement mistake counting
            aiThreatsMissed: 0, // TODO: Implement threat analysis
            analysisNotes: ['AI victory']
          });
        } catch (error: any) {
          this.logger.error(`Error recording game result: ${error.message}`);
        }
      }

      await new Promise(r => setTimeout(r, this.AI_THINK_DELAY_MS));
      if (res.winner || res.draw) {
        this.logger.log(`[${gameId}] Game ended after human move`);
        return;
      }

      this.server.to(gameId).emit('aiThinking');
      this.logger.log(`[${gameId}] Computing AI move via GameAIService`);
      const startLogic = Date.now();
      let aiColumn = await this.gameAi.getNextMove(res.board, 'Yellow', playerId);
      this.logger.log(`AI logic time: ${Date.now() - startLogic}ms`);

      if (process.env.USE_ML_MODEL === 'true') {
        this.logger.log(`[${gameId}] ML override active`);
        const mlRes = await this.mlClient.predict({ board: res.board });
        aiColumn = mlRes.move;
        this.logger.log(`ML selected column ${aiColumn}`);
      }

      const aiRes = await this.gameService.dropDisc(gameId, 'Yellow', aiColumn);
      if (!aiRes.success) throw new Error(aiRes.error);
      this.server.to(gameId).emit('aiMove', {
        board: aiRes.board,
        lastMove: { column: aiColumn, playerId: 'Yellow' as CellValue },
        winner: aiRes.winner,
        draw: aiRes.draw,
        nextPlayer: aiRes.nextPlayer,
      });
    } catch (error: any) {
      this.logger.error(`dropDisc error: ${error.message}`);
      client.emit('error', { event: 'dropDisc', message: error.message });
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
