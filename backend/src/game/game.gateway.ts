import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnGatewayConnection,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { GameService } from './game.service';
  
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
  export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    constructor(private readonly gameService: GameService) {}
  
    afterInit(server: Server) {
      // optional initialization logic
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
      @MessageBody() payload: CreateGamePayload,
      @ConnectedSocket() client: Socket
    ): Promise<{ gameId: string }> {
      const gameId = await this.gameService.createGame(payload.playerId, client.id);
      client.join(gameId);
      return { gameId };
    }
  
    @SubscribeMessage('joinGame')
    async handleJoinGame(
      @MessageBody() payload: JoinGamePayload,
      @ConnectedSocket() client: Socket
    ): Promise<{ board: string[][]; currentPlayer: string } | { error: string }> {
      const joinResult = await this.gameService.joinGame(
        payload.gameId,
        payload.playerId,
        client.id
      );
      if ('error' in joinResult) {
        return { error: joinResult.error };
      }
      client.join(payload.gameId);
      // return initial board state and current player
      return {
        board: joinResult.board,
        currentPlayer: joinResult.currentPlayer,
      };
    }
  
    @SubscribeMessage('dropDisc')
    async handleDropDisc(
      @MessageBody() payload: DropDiscPayload,
      @ConnectedSocket() client: Socket
    ): Promise<{ success: boolean; board?: string[][]; winner?: string; draw?: boolean; nextPlayer?: string; error?: string }> {
      const result = await this.gameService.dropDisc(
        payload.gameId,
        payload.playerId,
        payload.column
      );
      if (!result.success) {
        return { success: false, error: result.error };
      }
  
      // Broadcast updated board to all in room
      this.server.to(payload.gameId).emit('gameUpdate', {
        board: result.board,
        lastMove: { column: payload.column, playerId: payload.playerId },
        winner: result.winner,
        draw: result.draw,
        nextPlayer: result.nextPlayer,
      });
  
      return { success: true };
    }
  
    @SubscribeMessage('leaveGame')
    handleLeaveGame(
      @MessageBody() payload: JoinGamePayload,
      @ConnectedSocket() client: Socket
    ) {
      client.leave(payload.gameId);
      this.gameService.handleLeave(payload.gameId, payload.playerId);
    }
  }
  