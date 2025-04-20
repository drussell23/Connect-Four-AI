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
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import type { CellValue } from './ai';

interface CreateGamePayload {
  playerId: string;
}

interface JoinGamePayload {
  gameId: string;
  playerId: string;
}

interface DropDiscPayload {
  gameId: string;
  column: number;
  playerId: string;
}

@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server: Server;

  constructor(private readonly gameService: GameService) {}

  afterInit(server: Server) {
    this.gameService.setServer(server);
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.gameService.handleDisconnect(client.id);
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() { playerId }: CreateGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<{ gameId: string }> {
    const gameId = await this.gameService.createGame(playerId, client.id);
    client.join(gameId);
    return { gameId };
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<{ board: CellValue[][]; currentPlayer: CellValue } | { error: string }> {
    const res = await this.gameService.joinGame(gameId, playerId, client.id);
    if ('error' in res) {
      return { error: res.error };
    }
    client.join(gameId);
    return { board: res.board, currentPlayer: res.currentPlayer };
  }

  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() { gameId, playerId, column }: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<{ success: boolean; error?: string }> {
    const res = await this.gameService.dropDisc(gameId, playerId, column);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    this.server.to(gameId).emit('gameUpdate', {
      board: res.board,
      lastMove: { column, playerId },
      winner: res.winner,
      draw: res.draw,
      nextPlayer: res.nextPlayer,
    });
    return { success: true };
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() { gameId, playerId }: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ) {
    client.leave(gameId);
    this.gameService.handleLeave(gameId, playerId);
  }

  @SubscribeMessage('getAIMove')
  async handleGetAIMove(
    @MessageBody() { gameId, aiDisc }: { gameId: string; aiDisc: CellValue }
  ): Promise<{ column: number }> {
    return this.gameService.getAIMove(gameId, aiDisc);
  }
}
