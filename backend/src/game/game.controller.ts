// backend/src/game/game.controller.ts
import { Controller, Post, Get, Param, Body, Query, HttpException } from "@nestjs/common";
import { GameService } from "./game.service";
import { GameHistoryService, GameSearchFilters } from "./game-history.service";
import { SettingsService } from "./settings.service";
import { MlClientService, LogGameDto } from "../ml/ml-client.service";
import { AIGameIntegrationService } from "../ai/ai-game-integration.service";
import { AdaptiveResourceManager } from "../ai/adaptive-resource-manager";
import { AIPerformanceCollector } from "../ai/ai-performance-collector";
import { SelfTuningOptimizer } from "../ai/self-tuning-optimizer";
import { AsyncDecisionEngine } from "../ai/async-decision-engine";
import type { CellValue } from "../ai/connect4AI";
import { MemoryManagementService } from "./memory-management.service";

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
        private readonly mlClient: MlClientService,
        private readonly aiIntegration: AIGameIntegrationService,
        private readonly adaptiveResourceManager?: AdaptiveResourceManager,
        private readonly performanceCollector?: AIPerformanceCollector,
        private readonly selfTuningOptimizer?: SelfTuningOptimizer,
        private readonly asyncDecisionEngine?: AsyncDecisionEngine,
        private readonly memoryManagement?: MemoryManagementService
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

    @Get('ai/status')
    async getAIStatus() {
        try {
            return this.gameService.getAIHealthStatus();
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('memory/status')
    async getMemoryStatus() {
        if (!this.memoryManagement) {
            return { 
                enabled: false, 
                message: 'Memory management not enabled',
                tip: 'Run with M1 optimizations enabled for memory management'
            };
        }
        
        try {
            return {
                enabled: true,
                ...this.memoryManagement.getMemoryStats()
            };
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Post('memory/cleanup')
    async forceMemoryCleanup() {
        if (!this.memoryManagement) {
            throw new HttpException('Memory management not enabled', 404);
        }
        
        try {
            this.memoryManagement.forceCleanup();
            return { 
                success: true, 
                message: 'Memory cleanup triggered',
                stats: this.memoryManagement.getMemoryStats()
            };
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('ai/resources')
    async getAIResourceStatus() {
        try {
            const resourceStatus = this.aiIntegration.getResourceStatus();
            const performanceStats = await this.aiIntegration.getPerformanceStats();
            
            return {
                resources: resourceStatus,
                performance: performanceStats,
                timestamp: new Date().toISOString()
            };
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('ai/adaptive/status')
    async getAdaptiveAIStatus() {
        try {
            const response: any = {
                timestamp: new Date().toISOString(),
                adaptive: {
                    enabled: true,
                    features: []
                }
            };
            
            // Learning metrics from adaptive resource manager
            if (this.adaptiveResourceManager) {
                const learningMetrics = this.adaptiveResourceManager.getLearningMetrics();
                response.adaptive.learning = {
                    patternsLearned: learningMetrics.patternsLearned,
                    accuracy: learningMetrics.adaptationAccuracy,
                    resourceSavings: `${(learningMetrics.resourceSavings * 100).toFixed(1)}%`,
                    performanceImprovement: `${(learningMetrics.performanceImprovement * 100).toFixed(1)}%`,
                    lastTraining: new Date(learningMetrics.lastTrainingTime).toISOString()
                };
                response.adaptive.features.push('ML-based resource adaptation');
            }
            
            // Performance trends
            if (this.performanceCollector) {
                const trends = this.performanceCollector.getPerformanceTrends();
                const currentLoad = this.performanceCollector.getCurrentLoad();
                
                response.performance = {
                    trends: Object.entries(trends).map(([strategy, trend]) => ({
                        strategy,
                        avgResponseTime: `${trend.averageThinkingTime.toFixed(0)}ms`,
                        successRate: `${(trend.successRate * 100).toFixed(1)}%`,
                        trend: trend.trend,
                        totalMoves: trend.totalMoves
                    })),
                    currentLoad: {
                        activeRequests: currentLoad.activeRequests,
                        avgResponseTime: `${currentLoad.averageResponseTime.toFixed(0)}ms`,
                        peakCpu: `${(currentLoad.peakCpuUsage * 100).toFixed(1)}%`,
                        peakMemory: `${(currentLoad.peakMemoryUsage * 100).toFixed(1)}%`
                    }
                };
                response.adaptive.features.push('Performance trend analysis');
            }
            
            // Self-tuning optimization
            if (this.selfTuningOptimizer) {
                const optimizationState = this.selfTuningOptimizer.getOptimizationState();
                const parameters = this.selfTuningOptimizer.getCurrentParameters();
                
                response.optimization = {
                    objective: optimizationState.currentObjective,
                    performanceScore: `${(optimizationState.performanceScore * 100).toFixed(1)}%`,
                    lastOptimization: optimizationState.lastOptimization.toISOString(),
                    improvements: optimizationState.improvements,
                    totalOptimizations: optimizationState.optimizationCount,
                    currentParameters: {
                        cacheSize: parameters.cacheSize.current,
                        batchSize: parameters.batchSize.current,
                        workerThreads: parameters.workerThreads.current,
                        thinkingTimeMultiplier: parameters.thinkingTimeMultiplier.current
                    }
                };
                response.adaptive.features.push('Self-tuning optimization');
            }
            
            // Async decision engine
            if (this.asyncDecisionEngine) {
                const queueMetrics = this.asyncDecisionEngine.getQueueMetrics();
                
                response.asyncProcessing = {
                    queue: {
                        pending: queueMetrics.pending,
                        processing: queueMetrics.processing,
                        completed: queueMetrics.completed,
                        failed: queueMetrics.failed
                    },
                    performance: {
                        avgWaitTime: `${queueMetrics.averageWaitTime.toFixed(0)}ms`,
                        avgProcessingTime: `${queueMetrics.averageProcessingTime.toFixed(0)}ms`
                    }
                };
                response.adaptive.features.push('Asynchronous decision processing');
            }
            
            return response;
        } catch (e: any) {
            throw new HttpException(e.message, 500);
        }
    }

    @Get('ai/adaptive/report')
    async getAdaptiveAIReport(@Query('hours') hours: string = '24') {
        try {
            const periodHours = parseInt(hours) || 24;
            
            if (!this.performanceCollector) {
                throw new HttpException('Performance collector not available', 503);
            }
            
            const report = this.performanceCollector.generateReport(periodHours);
            
            return {
                ...report,
                generated: new Date().toISOString()
            };
        } catch (e: any) {
            throw new HttpException(e.message, 500);
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
            console.error(`Move analysis failed for game ${gameId}:`, e.message);

            // If game not found, return a more specific error
            if (e.message === 'Game not found') {
                throw new HttpException('Game not found. The game may have been cleared after a server restart.', 400);
            }

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

    @Post('history/clear')
    async clearGameHistory() {
        try {
            await this.gameHistoryService.clearGameHistory();
            return { success: true, message: 'Game history cleared successfully' };
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
