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
import { Logger, BadRequestException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import type { CellValue } from '../ai/connect4AI';

// Import the ML inference client for AI moves
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

  // Initialize ML client to call the prediction service
  private readonly mlClient = new MLInferenceClient({
    baseUrl: 'http://localhost:8000',
    timeoutMs: 5000,
    maxRetries: 3,
    retryDelayMs: 200,
  });

  constructor(private readonly gameService: GameService) { }

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
    @MessageBody() { playerId }: CreateGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    if (!playerId) {
      throw new BadRequestException('playerId is required');
    }
    try {
      const gameId = await this.gameService.createGame(playerId, client.id);
      client.join(gameId);
      this.logger.log(`Game ${gameId} created by ${playerId}`);

      client.emit('gameCreated', {
        gameId,
        board: this.gameService.getBoard(gameId),
        nextPlayer: 'Red' as CellValue,
      });
    } catch (error) {
      this.logger.error(`createGame error for ${playerId}: ${error}`);
      client.emit('error', { event: 'createGame', message: 'Failed to create game' });
    }
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<{ board: CellValue[][]; currentPlayer: CellValue }> {
    if (!gameId || !playerId) {
      throw new BadRequestException('gameId and playerId are required');
    }
    try {
      const res = await this.gameService.joinGame(gameId, playerId, client.id);
      if ('error' in res) {
        client.emit('error', { event: 'joinGame', message: res.error });
        return Promise.reject(res.error);
      }
      client.join(gameId);
      this.logger.log(`Player ${playerId} joined game ${gameId}`);
      return { board: res.board, currentPlayer: res.currentPlayer };
    } catch (error) {
      this.logger.error(`joinGame error for ${playerId}@${gameId}: ${error}`);
      client.emit('error', { event: 'joinGame', message: 'Failed to join game' });
      throw error;
    }
  }

  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() { gameId, playerId, column }: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    if (!gameId || !playerId || column == null) {
      throw new BadRequestException('gameId, playerId, and column are required');
    }
    if (column < 0 || column > 6) {
      client.emit('error', { event: 'dropDisc', message: 'Invalid column index' });
      return;
    }

    try {
      this.logger.log(`[${gameId}] dropDisc by ${playerId} at column ${column}`);
      const res = await this.gameService.dropDisc(gameId, playerId, column);
      if (!res.success) {
        client.emit('actionError', { event: 'dropDisc', message: res.error });
        return;
      }
      // Broadcast player move
      this.server.to(gameId).emit('playerMove', {
        board: res.board,
        lastMove: { column, playerId },
        winner: res.winner,
        draw: res.draw,
        nextPlayer: res.nextPlayer,
      });

      // Delay for UI render
      await new Promise((r) => setTimeout(r, this.AI_THINK_DELAY_MS));

      if (res.winner || res.draw) {
        this.logger.log(`[${gameId}] Game ended after human move`);
        return;
      }

      // AI move sequence via MLInferenceClient
      this.server.to(gameId).emit('aiThinking');
      this.logger.log(`[${gameId}] Querying ML API for AI move`);
      const aiResult = await this.mlClient.predict({ board: res.board });
      const aiColumn: number = aiResult.move;
      const aiRes = await this.gameService.dropDisc(gameId, 'Yellow', aiColumn as number);
      this.server.to(gameId).emit('aiMove', {
        board: aiRes.board,
        lastMove: { column: aiColumn, playerId: 'Yellow' as CellValue },
        winner: aiRes.winner,
        draw: aiRes.draw,
        nextPlayer: aiRes.nextPlayer,
      });
    } catch (error) {
      this.logger.error(`dropDisc error for ${playerId}@${gameId}: ${error}`);
      client.emit('error', { event: 'dropDisc', message: 'Failed to drop disc' });
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): void {
    if (!gameId || !playerId) {
      throw new BadRequestException('gameId and playerId are required');
    }
    try {
      client.leave(gameId);
      this.gameService.handleLeave(gameId, playerId);
      this.logger.log(`Player ${playerId} left game ${gameId}`);
    } catch (error) {
      this.logger.error(`leaveGame error for ${playerId}@${gameId}: ${error}`);
      client.emit('error', { event: 'leaveGame', message: 'Failed to leave game' });
    }
  }
}
