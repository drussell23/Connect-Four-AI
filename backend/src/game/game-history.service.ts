import { Injectable, Logger } from '@nestjs/common';
import type { CellValue } from '../ai/connect4AI';

export interface GameHistoryEntry {
    gameId: string;
    playerId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    winner: 'player' | 'ai' | 'draw';
    totalMoves: number;
    playerMoves: number[];
    aiMoves: number[];
    finalBoard: CellValue[][];
    gameMode: string;
    aiLevel: number;
    playerSkill: string;
    metadata: {
        deviceType: string;
        sessionId: string;
        version: string;
        features: string[];
    };
    tags: string[];
    notes: string;
    rating: number;
    isFavorite: boolean;
    isPublic: boolean;
}

export interface GameReplay {
    gameId: string;
    moves: {
        moveNumber: number;
        player: 'player' | 'ai';
        column: number;
        timestamp: number;
        boardState: CellValue[][];
        analysis?: {
            quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
            score: number;
            explanation: string;
        };
    }[];
    highlights: {
        moveNumber: number;
        type: 'brilliant' | 'mistake' | 'critical' | 'interesting';
        description: string;
        impact: 'high' | 'medium' | 'low';
    }[];
    statistics: {
        totalMoves: number;
        averageMoveTime: number;
        longestMove: number;
        shortestMove: number;
        accuracyRate: number;
    };
    commentary: {
        moveNumber: number;
        text: string;
        type: 'analysis' | 'commentary' | 'highlight';
    }[];
}

export interface GameSearchFilters {
    playerId?: string;
    winner?: 'player' | 'ai' | 'draw';
    dateRange?: {
        start: Date;
        end: Date;
    };
    gameMode?: string;
    aiLevel?: number;
    minMoves?: number;
    maxMoves?: number;
    minDuration?: number;
    maxDuration?: number;
    tags?: string[];
    isFavorite?: boolean;
    isPublic?: boolean;
    rating?: {
        min: number;
        max: number;
    };
}

export interface GameSearchResult {
    games: GameHistoryEntry[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    filters: GameSearchFilters;
}

@Injectable()
export class GameHistoryService {
    private readonly logger = new Logger(GameHistoryService.name);
    private gameHistory: Map<string, GameHistoryEntry> = new Map();
    private gameReplays: Map<string, GameReplay> = new Map();
    private playerGameHistory: Map<string, string[]> = new Map(); // playerId -> gameIds

    /**
     * Save a completed game to history
     */
    async saveGameHistory(entry: GameHistoryEntry): Promise<void> {
        try {
            this.gameHistory.set(entry.gameId, entry);

            // Track games by player
            if (!this.playerGameHistory.has(entry.playerId)) {
                this.playerGameHistory.set(entry.playerId, []);
            }
            this.playerGameHistory.get(entry.playerId)!.push(entry.gameId);

            this.logger.log(`💾 Saved game history: ${entry.gameId} for player ${entry.playerId}`);
        } catch (error) {
            this.logger.error(`🚨 Error saving game history: ${error}`);
            throw error;
        }
    }

    /**
     * Get game history for a player
     */
    async getGameHistory(playerId: string, limit: number = 50): Promise<GameHistoryEntry[]> {
        try {
            const playerGames = this.playerGameHistory.get(playerId) || [];
            const games = playerGames
                .map(gameId => this.gameHistory.get(gameId))
                .filter(game => game !== undefined)
                .sort((a, b) => new Date(b!.endTime).getTime() - new Date(a!.endTime).getTime())
                .slice(0, limit);

            this.logger.log(`📚 Retrieved ${games.length} games for player ${playerId} (total stored: ${this.gameHistory.size} games, ${this.playerGameHistory.size} players)`);
            
            // Debug logging
            if (games.length === 0) {
                this.logger.log(`🔍 Player game IDs for ${playerId}: ${JSON.stringify(playerGames)}`);
                this.logger.log(`🔍 All stored players: ${JSON.stringify(Array.from(this.playerGameHistory.keys()))}`);
            }
            
            return games as GameHistoryEntry[];
        } catch (error) {
            this.logger.error(`🚨 Error getting game history: ${error}`);
            throw error;
        }
    }

    /**
     * Get game replay
     */
    async getGameReplay(gameId: string): Promise<GameReplay> {
        try {
            const replay = this.gameReplays.get(gameId);
            if (!replay) {
                throw new Error(`Game replay not found: ${gameId}`);
            }

            this.logger.log(`🎬 Retrieved game replay: ${gameId}`);
            return replay;
        } catch (error) {
            this.logger.error(`🚨 Error getting game replay: ${error}`);
            throw error;
        }
    }

    /**
     * Save game replay
     */
    async saveGameReplay(gameId: string, replay: GameReplay): Promise<void> {
        try {
            this.gameReplays.set(gameId, replay);
            this.logger.log(`💾 Saved game replay: ${gameId}`);
        } catch (error) {
            this.logger.error(`🚨 Error saving game replay: ${error}`);
            throw error;
        }
    }

    /**
     * Search games with filters
     */
    async searchGames(
        filters: GameSearchFilters,
        page: number = 1,
        pageSize: number = 20
    ): Promise<GameSearchResult> {
        try {
            let filteredGames = Array.from(this.gameHistory.values());

            // Apply filters
            if (filters.playerId) {
                filteredGames = filteredGames.filter(game => game.playerId === filters.playerId);
            }

            if (filters.winner) {
                filteredGames = filteredGames.filter(game => game.winner === filters.winner);
            }

            if (filters.dateRange) {
                filteredGames = filteredGames.filter(game => {
                    const gameDate = new Date(game.endTime);
                    return gameDate >= filters.dateRange!.start && gameDate <= filters.dateRange!.end;
                });
            }

            if (filters.gameMode) {
                filteredGames = filteredGames.filter(game => game.gameMode === filters.gameMode);
            }

            if (filters.aiLevel !== undefined) {
                filteredGames = filteredGames.filter(game => game.aiLevel === filters.aiLevel);
            }

            if (filters.minMoves) {
                filteredGames = filteredGames.filter(game => game.totalMoves >= filters.minMoves!);
            }

            if (filters.maxMoves) {
                filteredGames = filteredGames.filter(game => game.totalMoves <= filters.maxMoves!);
            }

            if (filters.minDuration) {
                filteredGames = filteredGames.filter(game => game.duration >= filters.minDuration!);
            }

            if (filters.maxDuration) {
                filteredGames = filteredGames.filter(game => game.duration <= filters.maxDuration!);
            }

            if (filters.isFavorite !== undefined) {
                filteredGames = filteredGames.filter(game => game.isFavorite === filters.isFavorite);
            }

            if (filters.isPublic !== undefined) {
                filteredGames = filteredGames.filter(game => game.isPublic === filters.isPublic);
            }

            if (filters.rating) {
                filteredGames = filteredGames.filter(game =>
                    game.rating >= filters.rating!.min && game.rating <= filters.rating!.max
                );
            }

            // Sort by end time (newest first)
            filteredGames.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

            // Apply pagination
            const total = filteredGames.length;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedGames = filteredGames.slice(startIndex, endIndex);

            this.logger.log(`🔍 Search returned ${paginatedGames.length} games (total: ${total})`);

            return {
                games: paginatedGames,
                total,
                page,
                pageSize,
                hasMore: endIndex < total,
                filters
            };
        } catch (error) {
            this.logger.error(`🚨 Error searching games: ${error}`);
            throw error;
        }
    }

    /**
     * Get game statistics for a player
     */
    async getGameStatistics(playerId: string): Promise<any> {
        try {
            const playerGames = this.playerGameHistory.get(playerId) || [];
            const games = playerGames
                .map(gameId => this.gameHistory.get(gameId))
                .filter(game => game !== undefined) as GameHistoryEntry[];

            if (games.length === 0) {
                return {
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0,
                    averageGameLength: 0,
                    averageDuration: 0,
                    favoriteAILevel: 0,
                    totalPlayTime: 0
                };
            }

            const wins = games.filter(game => game.winner === 'player').length;
            const losses = games.filter(game => game.winner === 'ai').length;
            const draws = games.filter(game => game.winner === 'draw').length;
            const totalPlayTime = games.reduce((sum, game) => sum + game.duration, 0);
            const averageGameLength = games.reduce((sum, game) => sum + game.totalMoves, 0) / games.length;
            const averageDuration = totalPlayTime / games.length;

            // Find favorite AI level
            const aiLevelCounts = new Map<number, number>();
            games.forEach(game => {
                aiLevelCounts.set(game.aiLevel, (aiLevelCounts.get(game.aiLevel) || 0) + 1);
            });
            const favoriteAILevel = Array.from(aiLevelCounts.entries())
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 1;

            this.logger.log(`📊 Retrieved statistics for player ${playerId}: ${games.length} games`);

            return {
                totalGames: games.length,
                wins,
                losses,
                draws,
                winRate: (wins / games.length) * 100,
                averageGameLength: Math.round(averageGameLength),
                averageDuration: Math.round(averageDuration),
                favoriteAILevel,
                totalPlayTime: Math.round(totalPlayTime / 1000) // Convert to seconds
            };
        } catch (error) {
            this.logger.error(`🚨 Error getting game statistics: ${error}`);
            throw error;
        }
    }

    /**
     * Create game replay from game moves
     */
    createGameReplay(
        gameId: string,
        moves: Array<{
            player: 'player' | 'ai';
            column: number;
            timestamp: number;
            boardState: CellValue[][];
        }>,
        winner: 'player' | 'ai' | 'draw'
    ): GameReplay {
        try {
            const moveHistory = moves.map((move, index) => ({
                moveNumber: index + 1,
                player: move.player,
                column: move.column,
                timestamp: move.timestamp,
                boardState: move.boardState,
                analysis: {
                    quality: 'average' as const,
                    score: 0.5,
                    explanation: `${move.player === 'ai' ? 'AI' : 'Player'} moved in column ${move.column}`
                }
            }));

            // Generate highlights based on game outcome
            const highlights = [];
            if (winner !== 'draw') {
                highlights.push({
                    moveNumber: moves.length,
                    type: 'critical' as const,
                    description: `${winner === 'player' ? 'Player' : 'AI'} wins the game!`,
                    impact: 'high' as const
                });
            }

            // Calculate statistics
            const moveTimes = moves.map((move, index) => {
                if (index === 0) return 0;
                return move.timestamp - moves[index - 1].timestamp;
            }).filter(time => time > 0);

            const averageMoveTime = moveTimes.length > 0
                ? moveTimes.reduce((sum, time) => sum + time, 0) / moveTimes.length
                : 0;

            const replay: GameReplay = {
                gameId,
                moves: moveHistory,
                highlights,
                statistics: {
                    totalMoves: moves.length,
                    averageMoveTime: Math.round(averageMoveTime),
                    longestMove: Math.max(...moveTimes, 0),
                    shortestMove: Math.min(...moveTimes, Infinity),
                    accuracyRate: 75 // Default accuracy rate
                },
                commentary: []
            };

            this.logger.log(`🎬 Created game replay: ${gameId} with ${moves.length} moves`);
            return replay;
        } catch (error) {
            this.logger.error(`🚨 Error creating game replay: ${error}`);
            throw error;
        }
    }

    /**
     * Get all game history (for admin purposes)
     */
    async getAllGameHistory(): Promise<GameHistoryEntry[]> {
        return Array.from(this.gameHistory.values());
    }

    /**
     * Clear game history (for testing purposes)
     */
    async clearGameHistory(): Promise<void> {
        this.gameHistory.clear();
        this.gameReplays.clear();
        this.playerGameHistory.clear();
        this.logger.log('🗑️ Game history cleared');
    }

    /**
 * Get service status
 */
    getStatus(): any {
        return {
            totalGames: this.gameHistory.size,
            totalReplays: this.gameReplays.size,
            totalPlayers: this.playerGameHistory.size,
            memoryUsage: process.memoryUsage()
        };
    }

} 