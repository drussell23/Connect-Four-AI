import { Injectable, HttpException } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';   // now resolves correctly
import { lastValueFrom, Observable } from 'rxjs';
import type { CellValue } from '../ai/connect4AI';

/**
 * Payload sent to the ML service after each completed game.
 */
export interface LogGameDto {
    /** Unique identifier for the game */
    gameId: string;
    /** Final board state as a 6×7 matrix of cell values */
    finalBoard: CellValue[][];
    /** Outcome of the game: AI win or draw */
    outcome: 'win' | 'draw';
    /** ID of the winning player, or null if a draw */
    winner: string | null;
    /** Timestamp (in ms since Unix epoch) when the game ended */
    timestamp: number;
}

@Injectable()
export class MlClientService {
    private readonly endpoint = process.env.ML_SERVICE_URL ?? 'http://localhost:8001/log_game';

    constructor(private readonly httpService: HttpService) { }

    /**
     * Send end-of-game data to the ML service. Swallows errors to avoid blocking game flow.
     */
    async logGame(payload: LogGameDto): Promise<void> {
        try {
            const response$: Observable<AxiosResponse<any>> =
                this.httpService.post<any>(this.endpoint, payload);
            const response: AxiosResponse<any> = await lastValueFrom(response$);
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
