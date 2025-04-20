"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const game_service_1 = require("./game.service");
let GameGateway = class GameGateway {
    constructor(gameService) {
        this.gameService = gameService;
    }
    afterInit(server) {
        // optional initialization logic
        this.gameService.setServer(server);
    }
    handleConnection(client) {
        console.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        this.gameService.handleDisconnect(client.id);
    }
    async handleCreateGame(payload, client) {
        const gameId = await this.gameService.createGame(payload.playerId, client.id);
        client.join(gameId);
        return { gameId };
    }
    async handleJoinGame(payload, client) {
        const joinResult = await this.gameService.joinGame(payload.gameId, payload.playerId, client.id);
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
    async handleDropDisc(payload, client) {
        const result = await this.gameService.dropDisc(payload.gameId, payload.playerId, payload.column);
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
    handleLeaveGame(payload, client) {
        client.leave(payload.gameId);
        this.gameService.handleLeave(payload.gameId, payload.playerId);
    }
};
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('createGame'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCreateGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinGame'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('dropDisc'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleDropDisc", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveGame'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleLeaveGame", null);
GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/game', cors: { origin: '*' } }),
    __metadata("design:paramtypes", [game_service_1.GameService])
], GameGateway);
exports.GameGateway = GameGateway;
