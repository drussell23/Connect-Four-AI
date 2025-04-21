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
interface JoinGamePayload { gameId: string; playerId: string }
interface DropDiscPayload { gameId: string; playerId: string; column: number }

@WebSocketGateway({ namespace: '/game', cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GameGateway.name);

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
    // 1) Create the game and join the socket room
    const gameId = await this.gameService.createGame(playerId, client.id);
    client.join(gameId);
    this.logger.log(`Game ${gameId} created by ${playerId}`);
  
    // 2) Emit only the game ID (no getBoard call)
    client.emit('gameCreated', {
      gameId,
      board: this.gameService.getBoard(gameId),
      nextPlayer: 'Red',
    });
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
    this.logger.log(`[${gameId}] dropDisc called by ${playerId} at column ${column}`);
  
    // 1) Apply the human move
    const res = await this.gameService.dropDisc(gameId, playerId, column);
    if (!res.success) {
      this.logger.warn(`[${gameId}] dropDisc failed for ${playerId}: ${res.error}`);
      return { success: false, error: res.error };
    }
    this.logger.log(
      `[${gameId}] Human move applied: player=${playerId}, column=${column}, placedBoardState=\n${JSON.stringify(
        res.board,
        null,
        2
      )}`
    );
  
    // 2) Emit just the player's move
    this.logger.log(`[${gameId}] Emitting playerMove event`);
    this.server.to(gameId).emit('playerMove', {
      board:      res.board,
      lastMove:   { column, playerId },
      winner:     res.winner,
      draw:       res.draw,
      nextPlayer: res.nextPlayer,
    });
  
    // 2.5) Give the client a brief moment to render the red disc
    this.logger.log(`[${gameId}] Waiting 2000ms before AI move`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    // 3) If the game is still ongoing, trigger only the AI logic
    if (!res.winner && !res.draw) {
      this.logger.log(`[${gameId}] No win/draw—starting AI move`);
  
      // Let clients show a “thinking” indicator
      this.logger.log(`[${gameId}] Emitting aiThinking event`);
      this.server.to(gameId).emit('aiThinking');
  
      // Choose AI’s disc/color
      const aiDisc: CellValue = 'Yellow';
  
      // Compute best column for AI
      this.logger.log(`[${gameId}] Computing AI move for color ${aiDisc}`);
      const { column: aiColumn } = await this.gameService.getAIMove(gameId, aiDisc);
      this.logger.log(`[${gameId}] AI chose column ${aiColumn}`);
  
      // Apply the AI move
      const aiRes = await this.gameService.dropDisc(gameId, aiDisc, aiColumn);
      this.logger.log(
        `[${gameId}] AI move applied: disc=${aiDisc}, column=${aiColumn}, placedBoardState=\n${JSON.stringify(
          aiRes.board,
          null,
          2
        )}`
      );
  
      // Emit exactly one aiMove event
      this.logger.log(`[${gameId}] Emitting aiMove event`);
      this.server.to(gameId).emit('aiMove', {
        board:      aiRes.board,
        lastMove:   { column: aiColumn, playerId: aiDisc },
        winner:     aiRes.winner,
        draw:       aiRes.draw,
        nextPlayer: aiRes.nextPlayer,
      });
    } else {
      this.logger.log(
        `[${gameId}] Game ended after human move: winner=${res.winner}, draw=${res.draw}`
      );
    }
  
    this.logger.log(`[${gameId}] handleDropDisc complete`);
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
