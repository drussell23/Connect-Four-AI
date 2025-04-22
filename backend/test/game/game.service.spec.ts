import { GameService } from '../../src/game/game.service';

describe('GameService', () => {
    let service: GameService;

    beforeEach(() => {
        service = new GameService();
    });

    it('should create a new game with correct initial state', async () => {
        const player1 = 'player1';
        const gameId = await service.createGame(player1, 'client1');
        const state = (service as any).games.get(gameId);
        expect(state).toBeDefined();
        expect(state.currentPlayer).toBe(player1);
        expect(state.players).toEqual([player1]);
        expect(state.board.length).toBe(6);
        expect(state.board[0].length).toBe(7);
        expect(state.board.flat().every(cell => cell === 'Empty')).toBe(true);
    });

    it('should allow a second player to join', async () => {
        const p1 = 'p1';
        const p2 = 'p2';
        const gameId = await service.createGame(p1, 'c1');
        const result = await service.joinGame(gameId, p2, 'c2');
        expect((result as any).board).toBeDefined();
        expect((result as any).currentPlayer).toBe(p1);
        const state = (service as any).games.get(gameId);
        expect(state.players).toContain(p2);
    });

    it('should prevent more than two players from joining', async () => {
        const p1 = 'p1', p2 = 'p2', p3 = 'p3';
        const gameId = await service.createGame(p1, 'c1');
        await service.joinGame(gameId, p2, 'c2');
        const result = await service.joinGame(gameId, p3, 'c3');
        expect((result as any).error).toBe('Game is full.');
    });

    it('should reject moves out of turn or out of range', async () => {
        const p1 = 'p1', p2 = 'p2';
        const gameId = await service.createGame(p1, 'c1');
        await service.joinGame(gameId, p2, 'c2');

        // p2 tries to play first.
        let res = await service.dropDisc(gameId, p2, 0);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Not your turn.');

        // p1 tries invalid column.
        res = await service.dropDisc(gameId, p1, 99);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Column out of range.');
    });
});
