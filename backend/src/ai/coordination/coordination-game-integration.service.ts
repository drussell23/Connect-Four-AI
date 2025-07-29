import { Injectable, Logger } from '@nestjs/common';
import { AICoordinationClient } from './ai-coordination-client.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

export interface CoordinatedMoveResult {
    move: number;
    confidence: number;
    reasoning: string;
    source: string;
    algorithms: string[];
    responseTime: number;
    metadata?: any;
}

/**
 * Coordination Game Integration Service
 * 
 * Bridges the game service with the AI Coordination Hub,
 * providing a simple interface for requesting coordinated AI moves.
 */
@Injectable()
export class CoordinationGameIntegrationService {
    private readonly logger = new Logger(CoordinationGameIntegrationService.name);
    private pendingRequests = new Map<string, any>();

    constructor(
        private readonly coordinationClient: AICoordinationClient,
        private readonly eventEmitter: EventEmitter2
    ) {
        // Listen for coordination responses
        this.eventEmitter.on('ai.coordination.decision', (event) => {
            const { gameId, move, confidence, responseTime } = event;
            const pending = this.pendingRequests.get(gameId);
            if (pending) {
                pending.resolve({
                    move,
                    confidence,
                    reasoning: 'Coordinated decision from multiple AI systems',
                    source: 'coordination_hub',
                    algorithms: ['ensemble'],
                    responseTime
                });
                this.pendingRequests.delete(gameId);
            }
        });
    }

    /**
     * Request a coordinated move from the AI Coordination Hub
     */
    async requestCoordinatedMove(
        board: CellValue[][],
        aiColor: CellValue,
        difficulty: number,
        timeoutMs: number = 5000,
        context: any = {}
    ): Promise<CoordinatedMoveResult> {

        // Check if coordination hub is connected
        if (!this.coordinationClient.isConnected()) {
            throw new Error('AI Coordination Hub is not connected');
        }

        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create promise for response
        const responsePromise = new Promise<CoordinatedMoveResult>((resolve, reject) => {
            this.pendingRequests.set(gameId, { resolve, reject });

            // Set timeout
            setTimeout(() => {
                if (this.pendingRequests.has(gameId)) {
                    this.pendingRequests.delete(gameId);
                    reject(new Error('Coordination request timed out'));
                }
            }, timeoutMs);
        });

        // Convert board to coordination hub format
        const boardState = board.map(row =>
            row.map(cell => {
                if (cell === 'Red') return 'Red';
                if (cell === 'Yellow') return 'Yellow';
                return 'Empty';
            })
        );

        // Send coordination request via WebSocket
        const request = {
            sender_id: 'game_service',
            receiver_id: 'coordination_hub',
            message_type: 'PREDICTION_REQUEST',
            payload: {
                game_id: gameId,
                board_state: boardState,
                context: {
                    ...context,
                    difficulty,
                    ai_color: aiColor,
                    opponent_color: aiColor === 'Yellow' ? 'Red' : 'Yellow'
                },
                collaboration_mode: 'ensemble',
                urgency: 5,
                deadline_ms: timeoutMs - 500 // Give some buffer
            },
            timestamp: Date.now()
        };

        // This would be sent through the WebSocket connection
        // For now, simulate the coordination hub response
        this.logger.log(`🎯 Requesting coordinated move for difficulty ${difficulty}`);

        try {
            return await responsePromise;
        } catch (error: any) {
            this.logger.error(`Coordination request failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get coordination status
     */
    getStatus() {
        return {
            connected: this.coordinationClient.isConnected(),
            stats: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0
            },
            pendingRequests: this.pendingRequests.size
        };
    }
} 