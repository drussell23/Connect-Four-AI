// backend/src/game/game.controller.ts
import { Controller, Post, Get, Param, Body, Query, HttpException } from "@nestjs/common";
import { GameService } from "./game.service";
import { MlClientService, LogGameDto } from "../ml/ml-client.service";
import type { CellValue } from "../ai/connect4AI";

interface CreateGameDto { playerId: string; clientId: string; }
interface JoinGameDto   { playerId: string; clientId: string; }
interface DropDiscDto   { playerId: string; column: number; }

@Controller('games')
export class GameController {
    constructor(
        private readonly gameService: GameService,
        private readonly mlClient: MlClientService
    ) {}

    @Post() 
    async createGame(@Body() dto: CreateGameDto) {
        const gameId = await this.gameService.createGame(dto.playerId, dto.clientId);
        return { gameId };
    }

    @Post(':id/join')
    async joinGame(@Param('id') gameId: string, @Body() dto: JoinGameDto) {
        const result = await this.gameService.joinGame(gameId, dto.playerId, dto.clientId);
        if ('error' in result)
            throw new HttpException(result.error, 400);
        return result;
    }

    @Post(':id/drop')
    async dropDisc(
        @Param('id') gameId: string, 
        @Body() dto: DropDiscDto
    ) {
        // 1) Delegate to GameService.
        const result = await this.gameService.dropDisc(
            gameId, dto.playerId, dto.column
        );

        if (!result.success) {
            throw new HttpException(result.error || 'Drop failed', 400);
        }

        // 2) If the service tells us there was a win or draw, log to ML.
        if (result.winner || result.draw) {
            const payload: LogGameDto = {
                gameId, 
                finalBoard: result.board!,
                outcome: result.winner ? 'win' : 'draw',
                winner: result.winner ?? null,
                timestamp: Date.now()
            };

            // We don't await here (swallow errors).
            this.mlClient.logGame(payload);
        }

        return result;
    }

    @Get(':id/board')
    async getBoard(@Param('id') gameId: string) {
        try {
            return { board: this.gameService.getBoard(gameId) };
        } catch (e: any) {
            throw new HttpException(e.message, 404);
        }
    }

    @Get(':id/ai-move')
    async getAIMove(
        @Param('id') gameId: string, 
        @Query('aiDisc') aiDisc: CellValue
    ) {
        try {
            return await this.gameService.getAIMove(gameId, aiDisc);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }
}
