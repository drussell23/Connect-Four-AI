/**
 * 🎮 M1-Optimized Game Gateway
 * 
 * WebSocket gateway with M1 optimizations including
 * rate limiting and graceful degradation
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GracefulDegradationService } from '../ai/m1-optimized/graceful-degradation.service';
import { M1AIIntegrationService } from '../ai/m1-optimized/m1-ai-integration.service';
import { defensiveAI } from '../ai/m1-optimized/defensive-ai-mode';

interface DropDiscPayload {
  gameId: string;
  column: number;
  playerId: string;
}

interface AIRequest {
  gameId: string;
  board: any[][];
  difficulty: 'easy' | 'medium' | 'hard';
}

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class M1OptimizedGameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('M1GameGateway');
  private connectedClients = new Map<string, { id: string; gameId?: string }>();

  constructor(
    private readonly degradationService: GracefulDegradationService,
    private readonly aiIntegration: M1AIIntegrationService
  ) {}

  /**
   * Handle client connection
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, { id: client.id });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Handle drop disc with rate limiting
   */
  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() payload: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Check rate limit
      const rateLimit = this.degradationService.checkRateLimit(client.id, 'dropDisc');
      
      if (!rateLimit.allowed) {
        client.emit('error', {
          message: rateLimit.reason,
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Apply delay if needed
      if (rateLimit.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, rateLimit.delayMs));
      }

      // Process the move (simplified)
      this.logger.debug(`Processing move: column ${payload.column} for game ${payload.gameId}`);
      
      // Emit move confirmation
      this.server.to(payload.gameId).emit('moveProcessed', {
        column: payload.column,
        playerId: payload.playerId,
        processingTimeMs: Date.now() - startTime
      });

    } catch (error) {
      this.logger.error('Error processing drop disc:', error);
      client.emit('error', {
        message: 'Failed to process move',
        code: 'PROCESSING_ERROR'
      });
    }
  }

  /**
   * Handle AI move request with degradation
   */
  @SubscribeMessage('requestAIMove')
  async handleAIMove(
    @MessageBody() payload: AIRequest,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Check rate limit for AI requests
      const rateLimit = this.degradationService.checkRateLimit(client.id, 'aiMove');
      
      if (!rateLimit.allowed) {
        client.emit('error', {
          message: 'Too many AI requests. Please wait.',
          code: 'AI_RATE_LIMIT'
        });
        return;
      }

      // Apply delay
      if (rateLimit.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, rateLimit.delayMs));
      }

      // Check if we should use defensive mode
      const degradationStats = this.degradationService.getStatistics();
      let aiResult;

      if (degradationStats.defensiveMode) {
        // Use defensive AI for quick response
        const defensiveConfig = this.degradationService.getDefensiveAIConfig();
        const result = defensiveAI.getBestMove(
          payload.board,
          'Red',
          defensiveConfig.maxSearchDepth
        );
        
        aiResult = {
          move: result.move,
          confidence: result.confidence,
          inferenceTimeMs: result.computeTimeMs,
          method: 'defensive' as const,
          memoryPressure: 'high' as const
        };

        this.logger.debug(`Defensive AI move: ${result.move} (${result.strategy})`);

      } else {
        // Use full AI with all optimizations
        aiResult = await this.aiIntegration.getBestMove(payload.board, {
          modelType: this.mapDifficultyToModel(payload.difficulty),
          timeoutMs: degradationStats.aiConfig.responseTimeTarget
        });
      }

      // Send AI move response
      client.emit('aiMove', {
        column: aiResult.move,
        confidence: aiResult.confidence,
        processingTimeMs: Date.now() - startTime,
        mode: aiResult.method,
        degraded: degradationStats.currentLevel !== 'normal'
      });

    } catch (error) {
      this.logger.error('Error getting AI move:', error);
      
      // Fallback to center column
      client.emit('aiMove', {
        column: 3,
        confidence: 0.1,
        processingTimeMs: Date.now() - startTime,
        mode: 'emergency',
        error: true
      });
    }
  }

  /**
   * Handle game state request with caching
   */
  @SubscribeMessage('getGameState')
  async handleGetGameState(
    @MessageBody() { gameId }: { gameId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    // Check rate limit for state requests
    const rateLimit = this.degradationService.checkRateLimit(client.id, 'gameState');
    
    if (!rateLimit.allowed) {
      client.emit('error', {
        message: 'Too many state requests',
        code: 'STATE_RATE_LIMIT'
      });
      return;
    }

    // In production, this would fetch from cache/database
    client.emit('gameState', {
      gameId,
      board: this.createEmptyBoard(),
      currentPlayer: 'Red',
      status: 'active'
    });
  }

  /**
   * Broadcast system status to all clients
   */
  broadcastSystemStatus(): void {
    const degradationStats = this.degradationService.getStatistics();
    
    this.server.emit('systemStatus', {
      degradationLevel: degradationStats.currentLevel,
      defensiveMode: degradationStats.defensiveMode,
      responseTimeTarget: degradationStats.aiConfig.responseTimeTarget,
      timestamp: Date.now()
    });
  }

  /**
   * Map difficulty to AI model type
   */
  private mapDifficultyToModel(difficulty: string): 'dqn' | 'alphazero' | 'hybrid' {
    switch (difficulty) {
      case 'easy':
        return 'dqn';
      case 'medium':
        return 'alphazero';
      case 'hard':
        return 'hybrid';
      default:
        return 'dqn';
    }
  }

  /**
   * Create empty board
   */
  private createEmptyBoard(): any[][] {
    return Array(6).fill(null).map(() => Array(7).fill('Empty'));
  }
}