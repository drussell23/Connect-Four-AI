import { Injectable, HttpException } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import type { CellValue } from '../ai/connect4AI';

/**
 * Payload sent to the ML service after each completed game.
 */
export interface LogGameDto {
    /** Unique identifier for the game */
    gameId: string;
    /** Final board state as a 6×7 matrix of cell values */
    finalBoard: CellValue[][];
    /** Outcome of the game: AI win, loss or draw */
    outcome: 'win' | 'draw' | 'loss';
    /** ID of the winning player, or null if a draw */
    winner: string | null;
    /** Timestamp (in ms since Unix epoch) when the game ended */
    timestamp: number;
    /** Optional extended data for continuous learning */
    moves?: any[];
    difficulty?: number;
    lossPattern?: any;
    gameMetrics?: any;
    playerProfile?: any;
}

@Injectable()
export class MlClientService {
    private readonly logGameEndpoint: string;
    private readonly predictMoveEndpoint: string;
    private readonly predictEndpoint: string;

    constructor(
        private readonly configService: ConfigService
    ) {
        const baseUrl = this.configService.get('mlServiceUrl');
        this.logGameEndpoint = `${baseUrl}/log_game`;
        this.predictMoveEndpoint = `${baseUrl}/predict_move`;
        this.predictEndpoint = `${baseUrl}/predict`;

        // Enterprise logging
        console.log(`🧠 ML Client configured with base URL: ${baseUrl}`);
    }

    /**
     * Send end-of-game data to the ML service. Swallows errors to avoid blocking game flow.
     */
    /**
     * Gets the best move from the ML model.
     * @param board The current board state.
     * @param player The disc of the player whose turn it is.
     * @returns The column number for the best move.
     */
    async getBestMove(board: CellValue[][], player: CellValue): Promise<number> {
        try {
            const response = await axios.post<{ move: number }>(
                this.predictMoveEndpoint,
                { board, player },
            );
            return response.data.move;
        } catch (err: any) {
            console.error('MlClientService.getBestMove error:', err.message ?? err);
            // Re-throw to be handled by the caller (GameAIService)
            throw new HttpException(
                `ML service request failed: ${err.message}`,
                err.response?.status ?? 503,
            );
        }
    }

    /**
     * Gets move probabilities from the ML model.
     * @param board The current board state.
     * @returns An object containing the probabilities for each move.
     */
    async getPrediction(board: CellValue[][]): Promise<{ probs: number[] }> {
        try {
            const response = await axios.post<{ probs: number[] }>(
                this.predictEndpoint,
                { board },
            );
            return response.data;
        } catch (err: any) {
            console.error('MlClientService.getPrediction error:', err.message ?? err);
            throw new HttpException(
                `ML service /predict request failed: ${err.message}`,
                err.response?.status ?? 503,
            );
        }
    }

    /**
     * Send end-of-game data to the ML service. Swallows errors to avoid blocking game flow.
     */
    async logGame(payload: LogGameDto): Promise<void> {
        try {
            const response = await axios.post<any>(this.logGameEndpoint, payload);
            if (response.status !== 200) {
                throw new HttpException(
                    `Failed to log game: ${response.status}`,
                    response.status
                );
            }
        } catch (err: any) {
            console.warn('MlClientService.logGame error:', err.message ?? err);
            // Errors are swallowed so they don't interrupt gameplay
        }
    }
}
