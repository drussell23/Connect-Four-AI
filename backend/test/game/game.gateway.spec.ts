import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from '../../src/game/game.gateway';
import { GameService } from '../../src/game/game.service';
import { Server, Socket } from 'socket.io';
import type { CellValue } from '../../src/ai/types';

interface CreateGamePayload { playerId: string }
interface JoinGamePayload { gameId: string; playerId: string }
interface DropDiscPayload { gameId: string; playerId: string; column: number }

describe('GameGateway Unit Tests', () => {
  let gateway: GameGateway;
  let gameService: Partial<Record<keyof GameService, jest.Mock>>;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // Mock GameService with all required methods
    gameService = {
      createGame: jest.fn().mockResolvedValue('test-game-id'),
      getBoard: jest.fn().mockReturnValue([['Empty']]),
      joinGame: jest.fn().mockResolvedValue({ board: [['Empty']], currentPlayer: 'p1' }),
      dropDisc: jest.fn()
        .mockResolvedValueOnce({ success: true, board: [['Empty']], winner: undefined, draw: false, nextPlayer: 'p2' })
        .mockResolvedValueOnce({ success: true, board: [['Empty']], winner: undefined, draw: false, nextPlayer: 'p2' }),
      getAIMove: jest.fn().mockResolvedValue({ column: 1 }),
      handleDisconnect: jest.fn(),
      handleLeave: jest.fn(),
      setServer: jest.fn(),
    };

    // Mock server and socket
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    mockSocket = {
      id: 'socket1',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: GameService, useValue: gameService },
      ],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
    // Attach mock server
    (gateway as any).server = mockServer as Server;
  });

  it('should create game, join room, and emit gameCreated', async () => {
    const payload: CreateGamePayload = { playerId: 'p1' };
    await gateway.handleCreateGame(payload, mockSocket as Socket);

    expect(gameService.createGame).toHaveBeenCalledWith('p1', 'socket1');
    expect(mockSocket.join).toHaveBeenCalledWith('test-game-id');
    expect(mockSocket.emit).toHaveBeenCalledWith('gameCreated', {
      gameId: 'test-game-id',
      board: [['Empty']],
      nextPlayer: 'Red',
    });
  });

  it('should join game, join room, and return board and currentPlayer', async () => {
    const payload: JoinGamePayload = { gameId: 'gid', playerId: 'p2' };
    const result = await gateway.handleJoinGame(payload, mockSocket as Socket);

    expect(gameService.joinGame).toHaveBeenCalledWith('gid', 'p2', 'socket1');
    expect(mockSocket.join).toHaveBeenCalledWith('gid');
    expect(result).toEqual({ board: [['Empty']], currentPlayer: 'p1' });
  });

  it('should emit playerMove, aiThinking, and aiMove on dropDisc', async () => {
    const payload: DropDiscPayload = { gameId: 'gid', playerId: 'p1', column: 0 };
    await gateway.handleDropDisc(payload, mockSocket as Socket);

    // Human move broadcast
    expect(gameService.dropDisc).toHaveBeenCalledWith('gid', 'p1', 0);
    expect(mockServer.to).toHaveBeenCalledWith('gid');
    expect(mockServer.emit).toHaveBeenCalledWith('playerMove', expect.objectContaining({
      board: [['Empty']], lastMove: { column: 0, playerId: 'p1' }, nextPlayer: 'p2'
    }));

    // AI thinking & move
    expect(mockServer.emit).toHaveBeenCalledWith('aiThinking');
    expect(gameService.getAIMove).toHaveBeenCalledWith('gid', 'Yellow');
    expect(gameService.dropDisc).toHaveBeenCalledWith('gid', 'Yellow', 1);
    expect(mockServer.emit).toHaveBeenCalledWith('aiMove', expect.objectContaining({
      board: [['Empty']], lastMove: { column: 1, playerId: 'Yellow' }, nextPlayer: 'p2'
    }));
  });

  it('should handle leaveGame by calling service.handleLeave and socket.leave', () => {
    const payload: JoinGamePayload = { gameId: 'gid', playerId: 'p2' };
    gateway.handleLeaveGame(payload, mockSocket as Socket);
    expect(mockSocket.leave).toHaveBeenCalledWith('gid');
    expect(gameService.handleLeave).toHaveBeenCalledWith('gid', 'p2');
  });

  it('should handle disconnect by calling service.handleDisconnect', () => {
    gateway.handleDisconnect(mockSocket as Socket);
    expect(gameService.handleDisconnect).toHaveBeenCalledWith('socket1');
  });
});