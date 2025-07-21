// backend/src/game/game.controller.ts
import { Controller, Post, Get, Param, Body, Query, HttpException } from "@nestjs/common";
import { GameService } from "./game.service";
import { GameHistoryService, GameSearchFilters } from "./game-history.service";
import { SettingsService } from "./settings.service";
import { MlClientService, LogGameDto } from "../ml/ml-client.service";
import type { CellValue } from "../ai/connect4AI";

interface CreateGameDto {
    playerId: string;
    clientId: string;
    startingPlayer?: CellValue;
}
interface JoinGameDto { playerId: string; clientId: string; }
interface DropDiscDto { playerId: string; column: number; }

@Controller('games')
export class GameController {
    constructor(
        private readonly gameService: GameService,
        private readonly gameHistoryService: GameHistoryService,
        private readonly settingsService: SettingsService,
        private readonly mlClient: MlClientService
    ) { }

    @Post()
    async createGame(@Body() dto: CreateGameDto) {
        const gameId = await this.gameService.createGame(dto.playerId, dto.clientId, dto.startingPlayer);
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

    @Post(':id/analyze-move')
    async analyzeMove(
        @Param('id') gameId: string,
        @Body() dto: {
            column: number;
            player: 'player' | 'ai';
            aiLevel?: number;
        }
    ) {
        try {
            return await this.gameService.analyzeMove(gameId, dto.column, dto.player, dto.aiLevel);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post(':id/analyze-position')
    async analyzePosition(
        @Param('id') gameId: string,
        @Body() dto: {
            currentPlayer: 'player' | 'ai';
            aiLevel?: number;
        }
    ) {
        try {
            return await this.gameService.analyzePosition(gameId, dto.currentPlayer, dto.aiLevel);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    // Game History Endpoints
    @Get('history/:playerId')
    async getGameHistory(
        @Param('playerId') playerId: string,
        @Query('limit') limit: number = 50
    ) {
        try {
            return await this.gameHistoryService.getGameHistory(playerId, limit);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('replay/:gameId')
    async getGameReplay(@Param('gameId') gameId: string) {
        try {
            return await this.gameHistoryService.getGameReplay(gameId);
        } catch (e: any) {
            throw new HttpException(e.message, 404);
        }
    }

    @Post('search')
    async searchGames(
        @Body() filters: GameSearchFilters,
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20
    ) {
        try {
            return await this.gameHistoryService.searchGames(filters, page, pageSize);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('statistics/:playerId')
    async getGameStatistics(@Param('playerId') playerId: string) {
        try {
            return await this.gameHistoryService.getGameStatistics(playerId);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('history/status')
    async getHistoryStatus() {
        try {
            return this.gameHistoryService.getStatus();
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Post('history/sample-data')
    async createSampleData() {
        try {
            await this.gameHistoryService.createSampleData();
            return { success: true, message: 'Sample data created successfully' };
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    // Settings Endpoints
    @Get('settings/user/:playerId')
    async getUserSettings(@Param('playerId') playerId: string) {
        try {
            return await this.settingsService.getUserSettings(playerId);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/user/:playerId')
    async updateUserSettings(
        @Param('playerId') playerId: string,
        @Body() settings: any
    ) {
        try {
            return await this.settingsService.updateUserSettings(playerId, settings);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('settings/game/:playerId')
    async getGameSettings(@Param('playerId') playerId: string) {
        try {
            return await this.settingsService.getGameSettings(playerId);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/game/:playerId')
    async updateGameSettings(
        @Param('playerId') playerId: string,
        @Body() settings: any
    ) {
        try {
            return await this.settingsService.updateGameSettings(playerId, settings);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('settings/ui/:playerId')
    async getUISettings(@Param('playerId') playerId: string) {
        try {
            return await this.settingsService.getUISettings(playerId);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/ui/:playerId')
    async updateUISettings(
        @Param('playerId') playerId: string,
        @Body() settings: any
    ) {
        try {
            return await this.settingsService.updateUISettings(playerId, settings);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('settings/ai/:playerId')
    async getAIPreferences(@Param('playerId') playerId: string) {
        try {
            return await this.settingsService.getAIPreferences(playerId);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/ai/:playerId')
    async updateAIPreferences(
        @Param('playerId') playerId: string,
        @Body() preferences: any
    ) {
        try {
            return await this.settingsService.updateAIPreferences(playerId, preferences);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/reset/:playerId')
    async resetSettings(
        @Param('playerId') playerId: string,
        @Body() dto: { type: 'user' | 'game' | 'ui' | 'ai' | 'all' }
    ) {
        try {
            await this.settingsService.resetSettings(playerId, dto.type);
            return { success: true, message: 'Settings reset successfully' };
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Get('settings/export/:playerId')
    async exportSettings(
        @Param('playerId') playerId: string,
        @Query('format') format: 'json' | 'xml' = 'json'
    ) {
        try {
            return await this.settingsService.exportSettings(playerId, format);
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }

    @Post('settings/import/:playerId')
    async importSettings(
        @Param('playerId') playerId: string,
        @Body() dto: { data: string; format: 'json' | 'xml' }
    ) {
        try {
            await this.settingsService.importSettings(playerId, dto.data, dto.format);
            return { success: true, message: 'Settings imported successfully' };
        } catch (e: any) {
            throw new HttpException(e.message, 400);
        }
    }
}
