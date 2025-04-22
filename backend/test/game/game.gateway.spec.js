"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const game_gateway_1 = require("../../src/game/game.gateway");
const game_service_1 = require("../../src/game/game.service");
describe('GameGateway Unit Tests', () => {
    let gateway;
    let gameService;
    let mockServer;
    let mockSocket;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                game_gateway_1.GameGateway,
                { provide: game_service_1.GameService, useValue: gameService },
            ],
        }).compile();
        gateway = module.get(game_gateway_1.GameGateway);
        // Attach mock server
        gateway.server = mockServer;
    });
    it('should call gameService.createGame and join room on createGame', async () => {
        const payload = { playerId: 'p1' };
        const result = await gateway.handleCreateGame(payload, mockSocket);
        expect(gameService.createGame).toHaveBeenCalledWith('p1', 'socket1');
        expect(mockSocket.join).toHaveBeenCalledWith('test-game-id');
        expect(result).toEqual({ gameId: 'test-game-id' });
    });
    it('should call gameService.joinGame and join room on joinGame', async () => {
        const payload = { gameId: 'gid', playerId: 'p2' };
        const result = await gateway.handleJoinGame(payload, mockSocket);
        expect(gameService.joinGame).toHaveBeenCalledWith('gid', 'p2', 'socket1');
        expect(mockSocket.join).toHaveBeenCalledWith('gid');
        expect(result).toEqual({ board: [['Empty']], currentPlayer: 'p1' });
    });
    it('should emit gameUpdate on successful dropDisc', async () => {
        const payload = { gameId: 'gid', playerId: 'p1', column: 0 };
        await gateway.handleDropDisc(payload, mockSocket);
        expect(gameService.dropDisc).toHaveBeenCalledWith('gid', 'p1', 0);
        expect(mockServer.to).toHaveBeenCalledWith('gid');
        expect(mockServer.emit).toHaveBeenCalledWith('gameUpdate', expect.objectContaining({
            board: [['Empty']], lastMove: { column: 0, playerId: 'p1' }, nextPlayer: 'p2'
        }));
    });
    it('should handle leaveGame by calling service.handleLeave and socket.leave', () => {
        const payload = { gameId: 'gid', playerId: 'p2' };
        gateway.handleLeaveGame(payload, mockSocket);
        expect(mockSocket.leave).toHaveBeenCalledWith('gid');
        expect(gameService.handleLeave).toHaveBeenCalledWith('gid', 'p2');
    });
    it('should handle disconnect by calling service.handleDisconnect', () => {
        gateway.handleDisconnect(mockSocket);
        expect(gameService.handleDisconnect).toHaveBeenCalledWith('socket1');
    });
});
