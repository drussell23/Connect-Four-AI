"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GameService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
let GameService = GameService_1 = class GameService {
    constructor() {
        this.games = new Map();
    }
    /**
     * Attach Socket.IO server instance for broadcasting
     */
    setServer(server) {
        this.server = server;
    }
    /**
     * Create a new game and return its generated ID
     */
    async createGame(playerId, clientId) {
        const gameId = this.generateGameId();
        const emptyBoard = Array(6)
            .fill(null)
            .map(() => Array(7).fill('Empty'));
        this.games.set(gameId, {
            board: emptyBoard,
            currentPlayer: playerId,
            players: [playerId],
        });
        return gameId;
    }
    /**
     * Join an existing game, returning board and current player or error
     */
    async joinGame(gameId, playerId, clientId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { error: 'Game not found.' };
        }
        if (game.players.includes(playerId)) {
            return { error: 'Player already joined.' };
        }
        if (game.players.length >= 2) {
            return { error: 'Game is full.' };
        }
        game.players.push(playerId);
        return { board: game.board, currentPlayer: game.currentPlayer };
    }
    /**
     * Handle a disc into a column, update game state, and return new board or status.
     */
    async dropDisc(gameId, playerId, column) {
        // TODO: implement game logic using Game class or inline
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Game not found.' };
        }
        if (!game.players.includes(playerId)) {
            return { success: false, error: 'Player not in game.' };
        }
        if (game.currentPlayer !== playerId) {
            return { success: false, error: 'Not your turn.' };
        }
        if (column < 0 || column >= GameService_1.COLS) {
            return { success: false, error: 'Column out of range.' };
        }
        // Place the disc.
        let placedRow = -1;
        for (let r = GameService_1.ROWS - 1; r >= 0; r--) {
            if (game.board[r][column] == 'Empty') {
                game.board[r][column] = playerId === game.players[0] ? 'Red' : 'Yellow';
                placedRow = r;
                break;
            }
        }
        if (placedRow === -1) {
            return { success: false, error: 'Column is full.' };
        }
        // Check for a win. 
        const color = game.board[placedRow][column];
        const winnerFound = this.checkWin(game.board, placedRow, column, color);
        let winner;
        let draw = false;
        let nextPlayer;
        if (winnerFound) {
            winner = playerId;
        }
        else {
            // Draw if top row is full.
            if (game.board[0].every(cell => cell !== 'Empty')) {
                draw = true;
            }
            else {
                // Switch turn. 
                nextPlayer = game.players.find(p => p !== playerId);
                game.currentPlayer = nextPlayer;
            }
        }
        return { success: true, board: game.board, winner, draw, nextPlayer };
    }
    /**
     * Clean up state on client disconnect.
     */
    handleDisconnect(clientId) {
        // TODO: remove player from any game, or mark as disconnected
        for (const [gid, game] of this.games) {
            const idx = game.players.indexOf(clientId);
            if (idx !== -1) {
                game.players.splice(idx, 1);
                if (game.players.length === 0) {
                    this.games.delete(gid);
                }
                else {
                    game.currentPlayer = game.players[0];
                }
            }
        }
    }
    /**
     * Remove a player who leaves a game.
     */
    handleLeave(gameId, playerId) {
        // TODO: remove player from game and cleanup
        const game = this.games.get(gameId);
        if (!game)
            return;
        const idx = game.players.indexOf(playerId);
        if (idx !== -1) {
            game.players.splice(idx, 1);
            if (game.players.length === 0) {
                this.games.delete(gameId);
            }
            else {
                game.currentPlayer = game.players[0];
            }
        }
    }
    /**
     * Generate a simple random game ID.
     */
    generateGameId() {
        return Math.random().toString(36).substr(2, 9);
    }
    /**
     * Check for four in a row from a starting point.
     */
    checkWin(board, row, col, color) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1],];
        for (const [dr, dc] of directions) {
            let count = 1;
            // Forward
            let r = row + dr;
            let c = col + dc;
            while (this.isBounds(r, c) && board[r][c] === color) {
                count++;
                r += dr;
                c += dc;
            }
            // Backward
            r = row - dr;
            c = col - dc;
            while (this.isBounds(r, c) && board[r][c] === color) {
                count++;
                r -= dr;
                c -= dc;
            }
            if (count >= 4)
                return true;
        }
        return true;
    }
    isBounds(row, col) {
        return row >= 0 && row < GameService_1.ROWS && col >= 0 && col < GameService_1.COLS;
    }
};
// Board dimensions.
GameService.ROWS = 6;
GameService.COLS = 7;
GameService = GameService_1 = __decorate([
    (0, common_1.Injectable)()
], GameService);
exports.GameService = GameService;
