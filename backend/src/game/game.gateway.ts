// backend/src/game/game.gateway.ts
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
import type { CellValue } from './ai';

interface CreateGamePayload { playerId: string }
interface JoinGamePayload   { gameId: string; playerId: string }
interface DropDiscPayload   { gameId: string; playerId: string; column: number }

const AI_THINK_TIME_MS = 200;

@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly gameService: GameService) {}

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
  ): Promise<{ gameId: string }> {
    const gameId = await this.gameService.createGame(playerId, client.id);
    client.join(gameId);
    this.logger.log(`Game ${gameId} created by ${playerId}`);
    return { gameId };
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<
    | { board: CellValue[][]; currentPlayer: CellValue }
    | { error: string }
  > {
    const res = await this.gameService.joinGame(gameId, playerId, client.id);
    if ('error' in res) return { error: res.error };

    client.join(gameId);
    this.logger.log(`Player ${playerId} joined game ${gameId}`);
    return { board: res.board, currentPlayer: res.currentPlayer };
  }

  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() { gameId, playerId, column }: DropDiscPayload
  ): Promise<{ success: boolean; error?: string }> {
    // 1) Human move
    const res = await this.gameService.dropDisc(gameId, playerId, column);
    if (!res.success) {
      this.logger.warn(`dropDisc failed for ${playerId} in ${gameId}: ${res.error}`);
      return { success: false, error: res.error };
    }

    // Broadcast the human move
    this.server.to(gameId).emit('gameUpdate', {
      board: res.board,
      lastMove: { column, playerId },
      winner: res.winner,
      draw: res.draw,
      nextPlayer: res.nextPlayer,
    });

    // 2) If game still going, trigger AI
    if (!res.winner && !res.draw) {
      this.server.to(gameId).emit('aiThinking');

      setTimeout(async () => {
        // Ask the service for the AI’s column
        const { column: aiColumn } = await this.gameService.getAIMove(
          gameId,
          'Yellow'
        );

        // Apply the AI move (we use “AI” as the playerId here)
        const aiRes = await this.gameService.dropDisc(gameId, 'AI', aiColumn);

        this.logger.log(`AI dropped in column ${aiColumn} for game ${gameId}`);

        // Broadcast the AI move
        this.server.to(gameId).emit('gameUpdate', {
          board: aiRes.board,
          lastMove: { column: aiColumn, playerId: 'AI' },
          winner: aiRes.winner,
          draw: aiRes.draw,
          nextPlayer: aiRes.nextPlayer,
        });
      }, AI_THINK_TIME_MS);
    }

    return { success: true };
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ) {
    client.leave(gameId);
    this.gameService.handleLeave(gameId, playerId);
    this.logger.log(`Player ${playerId} left game ${gameId}`);
  }
}
