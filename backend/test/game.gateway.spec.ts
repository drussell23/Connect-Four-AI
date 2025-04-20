import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from '../src/game/game.gateway';
import { GameService } from '../src/game/game.service';
import { Server, Socket } from 'socket.io';

describe('GameGateway Unit Tests', () => {
  let gateway: GameGateway;
  let gameService: Partial<Record<keyof GameService, jest.Mock>>;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // Create mock GameService methods
    gameService = {
      createGame: jest.fn().mockResolvedValue('test-game-id'),
      joinGame: jest.fn().mockResolvedValue({ board: [['Empty']], currentPlayer: 'p1' }),
      dropDisc: jest.fn().mockResolvedValue({ success: true, board: [['Empty']], nextPlayer: 'p2' }),
      handleDisconnect: jest.fn(),
      handleLeave: jest.fn(),
      setServer: jest.fn(),
    };

    // Mock Server and Socket
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

  it('should call gameService.createGame and join room on createGame', async () => {
    const payload = { playerId: 'p1' };
    const result = await gateway.handleCreateGame(payload, mockSocket as Socket);
    expect(gameService.createGame).toHaveBeenCalledWith('p1', 'socket1');
    expect(mockSocket.join).toHaveBeenCalledWith('test-game-id');
    expect(result).toEqual({ gameId: 'test-game-id' });
  });

  it('should call gameService.joinGame and join room on joinGame', async () => {
    const payload = { gameId: 'gid', playerId: 'p2' };
    const result = await gateway.handleJoinGame(payload, mockSocket as Socket);
    expect(gameService.joinGame).toHaveBeenCalledWith('gid', 'p2', 'socket1');
    expect(mockSocket.join).toHaveBeenCalledWith('gid');
    expect(result).toEqual({ board: [['Empty']], currentPlayer: 'p1' });
  });

  it('should emit gameUpdate on successful dropDisc', async () => {
    const payload = { gameId: 'gid', playerId: 'p1', column: 0 };
    await gateway.handleDropDisc(payload, mockSocket as Socket);
    expect(gameService.dropDisc).toHaveBeenCalledWith('gid', 'p1', 0);
    expect(mockServer.to).toHaveBeenCalledWith('gid');
    expect(mockServer.emit).toHaveBeenCalledWith('gameUpdate', expect.objectContaining({
      board: [['Empty']], lastMove: { column: 0, playerId: 'p1' }, nextPlayer: 'p2'
    }));
  });

  it('should handle leaveGame by calling service.handleLeave and socket.leave', () => {
    const payload = { gameId: 'gid', playerId: 'p2' };
    gateway.handleLeaveGame(payload, mockSocket as Socket);
    expect(mockSocket.leave).toHaveBeenCalledWith('gid');
    expect(gameService.handleLeave).toHaveBeenCalledWith('gid', 'p2');
  });

  it('should handle disconnect by calling service.handleDisconnect', () => {
    gateway.handleDisconnect(mockSocket as Socket);
    expect(gameService.handleDisconnect).toHaveBeenCalledWith('socket1');
  });
});
