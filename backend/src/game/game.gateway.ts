import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { GameAIService } from './game-ai.service';
import { AiProfileService } from './ai-profile.service';
import { MlClientService } from '../ml/ml-client.service';
import { DashboardService } from './dashboard.service';
import { TrainingService, TrainingConfiguration } from './training.service';
import { OnEvent } from '@nestjs/event-emitter';
import type { CellValue } from '../ai/connect4AI';
import { AsyncAIOrchestrator } from '../ai/async/async-ai-orchestrator';
import { PerformanceMonitor } from '../ai/async/performance-monitor';
import { AdaptiveAIOrchestrator } from '../ai/adaptive/adaptive-ai-orchestrator';

interface CreateGamePayload {
  playerId: string;
  difficulty?: number;
  startingPlayer?: CellValue;
}
interface JoinGamePayload { gameId: string; playerId: string }
interface DropDiscPayload { gameId: string; playerId: string; column: number }

interface StartTrainingPayload {
  experimentId: string;
  configuration: TrainingConfiguration;
}

interface PerformanceTestPayload {
  modelType: string;
  testGames: number;
  opponents: string[];
}

interface RequestExplanationPayload {
  gameId: string;
  playerId: string;
  moveIndex?: number;
}

interface SubmitFeedbackPayload {
  gameId: string;
  playerId: string;
  rating: number;
  satisfaction: number;
  aiPerformance: number;
  explanation: string;
  suggestions?: string;
}

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', '*'],
    credentials: true
  }
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GameGateway.name);
  private readonly AI_THINK_DELAY_MS = 600; // Natural thinking time (0.6s base)
  private readonly AI_FIRST_MOVE_DELAY_MS = process.env.AI_FIRST_MOVE_DELAY_MS ? parseInt(process.env.AI_FIRST_MOVE_DELAY_MS) : 1200; // Slightly longer for first move

  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
    private readonly dashboardService: DashboardService,
    private readonly trainingService: TrainingService,
    private readonly asyncAIOrchestrator?: AsyncAIOrchestrator,
    private readonly performanceMonitor?: PerformanceMonitor,
    private readonly adaptiveAIOrchestrator?: AdaptiveAIOrchestrator,
  ) { }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameService.handleDisconnect(client.id);
  }

  @SubscribeMessage('createGame')
  async handleCreateGame(
    @MessageBody() payload: CreateGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<any> {
    try {
      const { playerId, difficulty, startingPlayer } = payload;
      if (!playerId) throw new Error('playerId is required');

      // Use the provided starting player or default to Red
      const firstPlayer = startingPlayer || 'Red';

      const gameId = await this.gameService.createGame(playerId, client.id, firstPlayer);
      client.join(gameId);
      this.logger.log(`Game ${gameId} created by ${playerId}, starting player: ${firstPlayer}, difficulty: ${difficulty}`);

      // If AI is starting, trigger the first AI move with natural delay
      if (firstPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] AI is starting - triggering first move`);
        // Natural delay for first move
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, this.AI_FIRST_MOVE_DELAY_MS);
      }

      // Return the callback response that the frontend expects
      return {
        success: true,
        gameId,
        nextPlayer: firstPlayer,
      };
    } catch (error: any) {
      this.logger.error(`createGame error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @MessageBody() payload: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { gameId, playerId } = payload;
      if (!gameId || !playerId) throw new Error('gameId and playerId are required');
      const res = await this.gameService.joinGame(gameId, playerId, client.id);
      if ('error' in res) throw new Error(res.error);
      client.join(gameId);
      this.logger.log(`Player ${playerId} joined game ${gameId}`);
      client.emit('gameJoined', { board: res.board, currentPlayer: res.currentPlayer });
    } catch (error: any) {
      this.logger.error(`joinGame error: ${error.message}`);
      client.emit('error', { event: 'joinGame', message: error.message });
    }
  }

  /**
   * Trigger an adaptive AI move that scales complexity based on game state
   */
  private async triggerAIMove(gameId: string, playerId: string): Promise<void> {
    try {
      this.logger.log(`[${gameId}] 🧠 Triggering Adaptive AI move`);

      // Get the current game state
      const game = this.gameService.getGame(gameId);
      if (!game) {
        this.logger.error(`[${gameId}] Game not found for AI move`);
        return;
      }

      const startTime = Date.now();
      const difficulty = game.aiLevel || 5;

      // Use adaptive AI orchestrator if available
      if (this.adaptiveAIOrchestrator) {
        this.logger.log(`[${gameId}] 🎯 Using Adaptive AI Orchestrator`);
        
        // Emit AI thinking with adaptive status
        this.server.to(gameId).emit('aiThinking', {
          status: 'analyzing',
          capabilities: ['adaptive_computation', 'criticality_analysis', 'dynamic_scaling'],
          mode: 'adaptive'
        });

        // Compute adaptive move
        const moveAnalysis = await this.adaptiveAIOrchestrator.computeAdaptiveMove(
          gameId,
          game.board,
          'Yellow' as CellValue,
          difficulty
        );

        // Emit criticality information
        this.server.to(gameId).emit('aiCriticalityAnalysis', {
          criticalityScore: moveAnalysis.criticalityScore,
          servicesUsed: moveAnalysis.servicesUsed,
          computationTime: moveAnalysis.computationTime,
          confidence: moveAnalysis.confidence
        });

        // Execute the AI move
        const aiRes = await this.gameService.dropDisc(gameId, 'AI', moveAnalysis.column);
        if (!aiRes.success) {
          this.logger.error(`[${gameId}] Adaptive AI move failed: ${aiRes.error}`);
          this.server.to(gameId).emit('error', {
            event: 'aiMove',
            message: 'Adaptive AI move failed',
            fallback: true
          });
          return;
        }

        // Emit the adaptive AI move result
        this.server.to(gameId).emit('aiMove', {
          column: moveAnalysis.column,
          board: aiRes.board,
          lastMove: { column: moveAnalysis.column, playerId: 'Yellow' },
          winner: aiRes.winner,
          draw: aiRes.draw,
          nextPlayer: aiRes.nextPlayer,
          confidence: moveAnalysis.confidence,
          thinkingTime: moveAnalysis.computationTime,
          explanation: moveAnalysis.explanation,
          safetyScore: 1.0,
          strategy: 'adaptive',
          gameMetrics: aiRes.gameMetrics,
          // Additional adaptive AI data
          adaptiveData: {
            criticalityScore: moveAnalysis.criticalityScore,
            servicesUsed: moveAnalysis.servicesUsed,
            alternatives: moveAnalysis.alternativeMoves
          }
        });

        this.logger.log(
          `[${gameId}] 🎯 Adaptive AI played column ${moveAnalysis.column} ` +
          `(criticality: ${moveAnalysis.criticalityScore.toFixed(2)}, ` +
          `confidence: ${(moveAnalysis.confidence * 100).toFixed(1)}%, ` +
          `time: ${moveAnalysis.computationTime}ms)`
        );

        return;
      }

      // Fallback to previous logic if adaptive AI not available
      const totalMoves = game.board.flat().filter(cell => cell !== null).length;
      const isEarlyGame = totalMoves < 6;

      if (isEarlyGame) {
        this.logger.log(`[${gameId}] ⚡ Early game move ${totalMoves + 1} - using fast AI`);
        
        let fastColumn: number;
        if (totalMoves === 0) {
          fastColumn = 3;
        } else if (totalMoves <= 3) {
          const centerColumns = [3, 4, 2, 5];
          fastColumn = centerColumns.find(col => 
            game.board[0][col] === null
          ) || 3;
        } else {
          fastColumn = await this.getQuickStrategicMove(game.board);
        }

        const result = await this.gameService.dropDisc(gameId, 'AI', fastColumn);
        
        this.server.to(gameId).emit('aiMove', {
          column: fastColumn,
          board: result.board,
          lastMove: { column: fastColumn, playerId: 'Yellow' },
          winner: result.winner,
          draw: result.draw,
          nextPlayer: result.nextPlayer,
          confidence: 0.9,
          thinkingTime: Date.now() - startTime,
          explanation: `Early game move ${totalMoves + 1}: Quick strategic play`,
          safetyScore: 1.0,
          strategy: 'early_game',
          gameMetrics: result.gameMetrics
        });
        
        return;
      }

      // Mid/late game fallback
      this.server.to(gameId).emit('aiThinking', {
        status: 'thinking',
        capabilities: ['strategic_analysis', 'threat_detection'],
        mode: 'standard'
      });

      const aiResult = await this.getStreamlinedAIMove(gameId, game.board, playerId);
      const thinkingTime = Date.now() - startTime;

      const aiRes = await this.gameService.dropDisc(gameId, 'AI', aiResult.column);
      if (!aiRes.success) {
        this.logger.error(`[${gameId}] AI move failed: ${aiRes.error}`);
        this.server.to(gameId).emit('error', {
          event: 'aiMove',
          message: 'AI move failed',
          fallback: true
        });
        return;
      }

      this.server.to(gameId).emit('aiMove', {
        column: aiResult.column,
        board: aiRes.board,
        lastMove: { column: aiResult.column, playerId: 'Yellow' },
        winner: aiRes.winner,
        draw: aiRes.draw,
        nextPlayer: aiRes.nextPlayer,
        confidence: aiResult.confidence || 0.8,
        thinkingTime,
        explanation: aiResult.explanation || 'Strategic move',
        safetyScore: 1.0,
        strategy: aiResult.strategy || 'strategic',
        gameMetrics: aiRes.gameMetrics
      });

      this.logger.log(`[${gameId}] 🎯 AI played column ${aiResult.column} in ${thinkingTime}ms`);

    } catch (error: any) {
      this.logger.error(`[${gameId}] Error in AI move: ${error.message}`);
      
      // Record error if performance monitor available
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, { gameId }, 'high');
      }

      this.server.to(gameId).emit('error', {
        event: 'aiMove',
        message: 'AI move failed',
        fallback: 'Using basic AI fallback'
      });

      // Fallback to basic AI
      try {
        // Get the current game state for fallback
        const fallbackGame = this.gameService.getGame(gameId);
        if (!fallbackGame) {
          this.logger.error(`[${gameId}] Game not found for fallback AI move`);
          return;
        }

        const fallbackAI = await this.gameAi.getNextMove(fallbackGame.board, 'Yellow', playerId, gameId);
        const fallbackRes = await this.gameService.dropDisc(gameId, 'AI', fallbackAI);

        if (fallbackRes.success) {
          this.server.to(gameId).emit('aiMove', {
            column: fallbackAI,
            board: fallbackRes.board,
            lastMove: { column: fallbackAI, playerId: 'Yellow' },
            winner: fallbackRes.winner,
            draw: fallbackRes.draw,
            nextPlayer: fallbackRes.nextPlayer,
            confidence: 0.6,
            thinkingTime: 100,
            explanation: 'Fallback AI decision',
            safetyScore: 1.0,
            strategy: 'fallback',
            gameMetrics: fallbackRes.gameMetrics
          });
        }
      } catch (fallbackError: any) {
        this.logger.error(`[${gameId}] Fallback AI also failed: ${fallbackError.message}`);
        this.server.to(gameId).emit('error', {
          event: 'fallbackAiMove',
          message: 'All AI systems failed',
          details: fallbackError.message
        });
      }
    }
  }

  /**
   * Quick strategic move for early game (fast evaluation)
   */
  private async getQuickStrategicMove(board: any[][]): Promise<number> {
    // Simple strategic evaluation - check for immediate threats and opportunities
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== null) continue; // Column full
      
      // Find the row where the piece would land
      let row = 5;
      while (row >= 0 && board[row][col] !== null) {
        row--;
      }
      if (row < 0) continue; // Column full
      
      // Check for immediate win
      board[row][col] = 'Yellow';
      if (this.checkWin(board, row, col, 'Yellow')) {
        board[row][col] = null; // Reset
        return col;
      }
      
      // Check for blocking opponent win
      board[row][col] = 'Red';
      if (this.checkWin(board, row, col, 'Red')) {
        board[row][col] = null; // Reset
        return col;
      }
      
      board[row][col] = null; // Reset
    }
    
    // Default to center columns if no immediate tactics
    const centerColumns = [3, 4, 2, 5, 1, 6, 0];
    return centerColumns.find(col => board[0][col] === null) || 3;
  }

  /**
   * Streamlined AI move using basic AI service (faster than enhanced AI)
   */
  private async getStreamlinedAIMove(gameId: string, board: any[][], playerId: string): Promise<any> {
    try {
      // Use the basic AI service for faster response
      const column = await this.gameAi.getNextMove(board, 'Yellow', playerId, gameId);
      return {
        column,
        confidence: 0.85,
        explanation: 'Strategic analysis',
        strategy: 'tactical'
      };
    } catch (error) {
      // Fallback to quick strategic move
      const column = await this.getQuickStrategicMove(board);
      return {
        column,
        confidence: 0.7,
        explanation: 'Quick strategic move',
        strategy: 'basic'
      };
    }
  }

  /**
   * Simple win check for quick evaluation
   */
  private checkWin(board: any[][], row: number, col: number, player: string): boolean {
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1] // horizontal, vertical, diagonal
    ];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check in positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check in negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }

  /**
   * Enhanced drop disc handler with additional AI capabilities
   */
  @SubscribeMessage('dropDisc')
  async handleDropDisc(
    @MessageBody() payload: DropDiscPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const { gameId, playerId, column } = payload;

    try {
      if (!gameId || !playerId || column === undefined) {
        throw new Error('gameId, playerId, and column are required');
      }

      this.logger.log(`[${gameId}] Player ${playerId} dropping disc in column ${column}`);

      // Execute the human move
      const result = await this.gameService.dropDisc(gameId, playerId, column);
      if (!result.success) {
        client.emit('error', {
          event: 'dropDisc',
          message: result.error,
        });
        return;
      }

      // Emit the enhanced human move result
      this.server.to(gameId).emit('playerMove', {
        board: result.board,
        lastMove: { column, playerId },
        winner: result.winner,
        draw: result.draw,
        nextPlayer: result.nextPlayer,
        gameMetrics: result.gameMetrics,
        curriculumUpdate: result.curriculumUpdate
      });

      this.logger.log(`[${gameId}] ✅ Player ${playerId} played column ${column}`);

      // If game continues and it's AI's turn, trigger enhanced AI move
      if (!result.winner && !result.draw && result.nextPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] 🤖 Triggering Enhanced AI response`);
        // Trigger AI move with natural human-like delay
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, this.AI_THINK_DELAY_MS + Math.random() * 400); // 0.6-1.0s delay
      }

    } catch (error: any) {
      this.logger.error(`[${gameId}] dropDisc error: ${error.message}`);
      client.emit('error', {
        event: 'dropDisc',
        message: error.message,
      });
    }
  }

  /**
   * Get real-time AI system health
   */
  @SubscribeMessage('getAISystemHealth')
  async handleGetAISystemHealth(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      if (this.asyncAIOrchestrator) {
        const health = await this.asyncAIOrchestrator.getSystemHealth();
        
        client.emit('aiSystemHealth', {
          health,
          timestamp: Date.now(),
          asyncAIAvailable: true
        });
        
        this.logger.debug(`AI system health sent to client ${client.id}`);
      } else {
        client.emit('aiSystemHealth', {
          health: {
            orchestrator: { activeRequests: 0 },
            performance: { healthy: true },
            recommendations: []
          },
          timestamp: Date.now(),
          asyncAIAvailable: false
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to get AI system health: ${error.message}`);
      client.emit('error', {
        event: 'getAISystemHealth',
        message: 'Failed to retrieve AI system health',
        details: error.message
      });
    }
  }

  /**
   * Subscribe to real-time performance metrics
   */
  @SubscribeMessage('subscribeToMetrics')
  async handleSubscribeToMetrics(
    @MessageBody() payload: { gameId?: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      if (this.performanceMonitor) {
        // Send metrics every 5 seconds
        const interval = setInterval(async () => {
          const report = await this.performanceMonitor.generateReport(60000); // Last minute
          
          client.emit('performanceMetrics', {
            report,
            gameId: payload.gameId,
            timestamp: Date.now()
          });
        }, 5000);

        // Store interval to clear on disconnect
        (client as any).metricsInterval = interval;
        
        client.emit('metricsSubscribed', { success: true });
        this.logger.debug(`Client ${client.id} subscribed to performance metrics`);
      } else {
        client.emit('metricsSubscribed', { 
          success: false, 
          reason: 'Performance monitoring not available' 
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to subscribe to metrics: ${error.message}`);
      client.emit('error', {
        event: 'subscribeToMetrics',
        message: error.message
      });
    }
  }

  /**
   * Unsubscribe from metrics
   */
  @SubscribeMessage('unsubscribeFromMetrics')
  handleUnsubscribeFromMetrics(
    @ConnectedSocket() client: Socket
  ): void {
    try {
      if ((client as any).metricsInterval) {
        clearInterval((client as any).metricsInterval);
        delete (client as any).metricsInterval;
      }
      client.emit('metricsUnsubscribed', { success: true });
      this.logger.debug(`Client ${client.id} unsubscribed from performance metrics`);
    } catch (error: any) {
      this.logger.error(`Failed to unsubscribe from metrics: ${error.message}`);
      client.emit('error', {
        event: 'unsubscribeFromMetrics',
        message: error.message
      });
    }
  }

  /**
   * Get dashboard data for real-time analysis
   */
  @SubscribeMessage('getDashboardData')
  async handleGetDashboardData(
    @MessageBody() payload: { gameId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const metrics = await this.dashboardService.getCurrentMetrics();
      const insights = await this.dashboardService.getAIInsights();

      client.emit('dashboardData', {
        metrics,
        insights,
        timestamp: Date.now()
      });

      this.logger.debug(`Dashboard data sent to client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`);
      client.emit('error', {
        event: 'getDashboardData',
        message: 'Failed to retrieve dashboard data',
        details: error.message
      });
    }
  }

  /**
   * Get adaptive AI game insights
   */
  @SubscribeMessage('getAIGameInsights')
  async handleGetAIGameInsights(
    @MessageBody() payload: { gameId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      if (!this.adaptiveAIOrchestrator) {
        client.emit('aiGameInsights', {
          available: false,
          message: 'Adaptive AI insights not available'
        });
        return;
      }

      const insights = this.adaptiveAIOrchestrator.getGameInsights(payload.gameId);
      
      client.emit('aiGameInsights', {
        available: true,
        gameId: payload.gameId,
        insights,
        timestamp: Date.now()
      });
      
      this.logger.debug(`AI game insights sent for game ${payload.gameId}`);
    } catch (error: any) {
      this.logger.error(`Failed to get AI game insights: ${error.message}`);
      client.emit('error', {
        event: 'getAIGameInsights',
        message: 'Failed to retrieve AI game insights',
        details: error.message
      });
    }
  }

  /**
   * Get board analysis for current game state
   */
  @SubscribeMessage('getBoardAnalysis')
  async handleGetBoardAnalysis(
    @MessageBody() payload: { gameId: string; board: any[][] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const analysis = await this.dashboardService.getBoardAnalysis(payload.board);

      client.emit('boardAnalysis', {
        gameId: payload.gameId,
        analysis,
        timestamp: Date.now()
      });

      this.logger.debug(`Board analysis sent to client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to analyze board: ${error.message}`);
      client.emit('error', {
        event: 'getBoardAnalysis',
        message: 'Failed to analyze board',
        details: error.message
      });
    }
  }

  /**
   * Run system diagnostics
   */
  @SubscribeMessage('runDiagnostics')
  async handleRunDiagnostics(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const diagnostics = await this.dashboardService.runDiagnostics();

      client.emit('diagnosticsResult', {
        diagnostics,
        timestamp: Date.now()
      });

      this.logger.log(`System diagnostics completed for client ${client.id}: ${diagnostics.overall}`);
    } catch (error: any) {
      this.logger.error(`Failed to run diagnostics: ${error.message}`);
      client.emit('error', {
        event: 'runDiagnostics',
        message: 'Failed to run system diagnostics',
        details: error.message
      });
    }
  }

  /**
   * Start AI model training
   */
  @SubscribeMessage('startTraining')
  async handleStartTraining(
    @MessageBody() payload: StartTrainingPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      await this.trainingService.startTraining(payload.experimentId, payload.configuration);

      client.emit('trainingStarted', {
        experimentId: payload.experimentId,
        message: 'Training started successfully',
        timestamp: Date.now()
      });

      this.logger.log(`Training started: ${payload.experimentId}`);
    } catch (error: any) {
      this.logger.error(`Failed to start training: ${error.message}`);
      client.emit('error', {
        event: 'startTraining',
        message: error.message,
        details: error.message
      });
    }
  }

  /**
   * Stop active training
   */
  @SubscribeMessage('stopTraining')
  async handleStopTraining(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      await this.trainingService.stopTraining();

      client.emit('trainingStopped', {
        message: 'Training stopped successfully',
        timestamp: Date.now()
      });

      this.logger.log(`Training stopped by client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to stop training: ${error.message}`);
      client.emit('error', {
        event: 'stopTraining',
        message: error.message,
        details: error.message
      });
    }
  }

  /**
   * Pause active training
   */
  @SubscribeMessage('pauseTraining')
  async handlePauseTraining(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      await this.trainingService.pauseTraining();

      client.emit('trainingPaused', {
        message: 'Training paused successfully',
        timestamp: Date.now()
      });

      this.logger.log(`Training paused by client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to pause training: ${error.message}`);
      client.emit('error', {
        event: 'pauseTraining',
        message: error.message,
        details: error.message
      });
    }
  }

  /**
   * Resume paused training
   */
  @SubscribeMessage('resumeTraining')
  async handleResumeTraining(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      await this.trainingService.resumeTraining();

      client.emit('trainingResumed', {
        message: 'Training resumed successfully',
        timestamp: Date.now()
      });

      this.logger.log(`Training resumed by client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to resume training: ${error.message}`);
      client.emit('error', {
        event: 'resumeTraining',
        message: error.message,
        details: error.message
      });
    }
  }

  /**
   * Get all training experiments
   */
  @SubscribeMessage('getExperiments')
  async handleGetExperiments(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const experiments = this.trainingService.getExperiments();

      client.emit('experimentsData', {
        experiments,
        timestamp: Date.now()
      });

      this.logger.debug(`Experiments data sent to client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to get experiments: ${error.message}`);
      client.emit('error', {
        event: 'getExperiments',
        message: 'Failed to retrieve experiments',
        details: error.message
      });
    }
  }

  /**
   * Delete training experiment
   */
  @SubscribeMessage('deleteExperiment')
  async handleDeleteExperiment(
    @MessageBody() payload: { experimentId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      await this.trainingService.deleteExperiment(payload.experimentId);

      client.emit('experimentDeleted', {
        experimentId: payload.experimentId,
        message: 'Experiment deleted successfully',
        timestamp: Date.now()
      });

      this.logger.log(`Experiment deleted: ${payload.experimentId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete experiment: ${error.message}`);
      client.emit('error', {
        event: 'deleteExperiment',
        message: 'Failed to delete experiment',
        details: error.message
      });
    }
  }

  /**
   * Run performance test
   */
  @SubscribeMessage('runPerformanceTest')
  async handleRunPerformanceTest(
    @MessageBody() payload: PerformanceTestPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const results = await this.trainingService.runPerformanceTest(payload);

      client.emit('performanceTestResult', {
        results,
        timestamp: Date.now()
      });

      this.logger.log(`Performance test completed for client ${client.id}: ${results.overallScore}%`);
    } catch (error: any) {
      this.logger.error(`Failed to run performance test: ${error.message}`);
      client.emit('error', {
        event: 'runPerformanceTest',
        message: 'Failed to run performance test',
        details: error.message
      });
    }
  }

  /**
   * Get training statistics
   */
  @SubscribeMessage('getTrainingStats')
  async handleGetTrainingStats(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const stats = this.trainingService.getTrainingStatistics();

      client.emit('trainingStats', {
        stats,
        timestamp: Date.now()
      });

      this.logger.debug(`Training stats sent to client ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to get training stats: ${error.message}`);
      client.emit('error', {
        event: 'getTrainingStats',
        message: 'Failed to retrieve training statistics',
        details: error.message
      });
    }
  }

  /**
   * Request AI explanation for a move
   */
  @SubscribeMessage('requestExplanation')
  async handleRequestExplanation(
    @MessageBody() payload: RequestExplanationPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      // Generate AI explanation for the requested move
      const explanation = `This move was selected based on strategic analysis of the board position. The AI considered multiple factors including threat detection, center control, and potential winning sequences. This position offers optimal balance between offensive opportunities and defensive stability.`;

      client.emit('aiExplanation', {
        gameId: payload.gameId,
        moveIndex: payload.moveIndex,
        explanation,
        timestamp: Date.now()
      });

      this.logger.debug(`AI explanation provided for game ${payload.gameId}`);
    } catch (error: any) {
      this.logger.error(`Failed to generate explanation: ${error.message}`);
      client.emit('error', {
        event: 'requestExplanation',
        message: 'Failed to generate AI explanation',
        details: error.message
      });
    }
  }

  /**
   * Submit player feedback
   */
  @SubscribeMessage('submitFeedback')
  async handleSubmitFeedback(
    @MessageBody() payload: SubmitFeedbackPayload,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      // Process player feedback (in a real implementation, this would be stored and used for training)
      this.logger.log(`Feedback received for game ${payload.gameId}: Rating=${payload.rating}, AI Performance=${payload.aiPerformance}`);

      client.emit('feedbackReceived', {
        gameId: payload.gameId,
        message: 'Feedback received successfully. Thank you for helping improve the AI!',
        timestamp: Date.now()
      });
    } catch (error: any) {
      this.logger.error(`Failed to process feedback: ${error.message}`);
      client.emit('error', {
        event: 'submitFeedback',
        message: 'Failed to process feedback',
        details: error.message
      });
    }
  }

  /**
   * Handle requests for player progress
   */
  @SubscribeMessage('getPlayerProgress')
  async handleGetPlayerProgress(
    @MessageBody() payload: { playerId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const { playerId } = payload;

      // Get player profile and curriculum information
      // This would integrate with the adaptation and curriculum systems

      const mockProgress = {
        playerId,
        skillLevel: 0.6,
        currentStage: 'strategic_thinking',
        progress: 0.75,
        achievements: ['basic_tactics_complete', 'first_win', 'strategic_play'],
        nextObjectives: [
          'Master center control strategies',
          'Recognize complex threat patterns',
          'Improve endgame technique'
        ],
        recommendations: [
          'Focus on controlling center columns',
          'Practice identifying multiple threats',
          'Study endgame scenarios'
        ]
      };

      client.emit('playerProgress', mockProgress);
      this.logger.debug(`📊 Player progress sent to ${playerId}`);

    } catch (error: any) {
      this.logger.error(`getPlayerProgress error: ${error.message}`);
      client.emit('error', {
        event: 'getPlayerProgress',
        message: error.message
      });
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() payload: JoinGamePayload,
    @ConnectedSocket() client: Socket
  ): void {
    try {
      const { gameId, playerId } = payload;
      if (!gameId || !playerId) throw new Error('gameId and playerId are required');
      client.leave(gameId);
      this.gameService.handleLeave(gameId, playerId);
      this.logger.log(`Player ${playerId} left game ${gameId}`);
    } catch (error: any) {
      this.logger.error(`leaveGame error: ${error.message}`);
      client.emit('error', { event: 'leaveGame', message: error.message });
    }
  }

  // Enhanced Features Endpoints

  // AI Personality System
  @SubscribeMessage('getAIPersonality')
  async handleGetAIPersonality(
    @MessageBody() payload: { playerId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const personality = {
        id: 'aria',
        name: 'ARIA - Analytical Reasoning Intelligence Assistant',
        coreType: 'analytical',
        level: 1,
        traits: {
          aggression: { value: 30, evolution: [30] },
          creativity: { value: 40, evolution: [40] },
          analytical: { value: 90, evolution: [90] },
          patience: { value: 70, evolution: [70] },
          confidence: { value: 75, evolution: [75] },
          adaptability: { value: 60, evolution: [60] },
          empathy: { value: 50, evolution: [50] },
          curiosity: { value: 80, evolution: [80] }
        },
        relationshipWithPlayer: {
          trust: 50,
          respect: 50,
          understanding: 30,
          rivalry: 20
        }
      };

      client.emit('aiPersonality', personality);
      this.logger.debug(`🤖 AI personality sent to ${payload.playerId}`);
    } catch (error: any) {
      this.logger.error(`getAIPersonality error: ${error.message}`);
      client.emit('error', { event: 'getAIPersonality', message: error.message });
    }
  }

  // Player Analytics
  @SubscribeMessage('getPlayerAnalytics')
  async handleGetPlayerAnalytics(
    @MessageBody() payload: { playerId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const analytics = {
        skillLevel: 65 + Math.random() * 30,
        patterns: [
          { name: 'Center Control', frequency: 65 + Math.random() * 25, effectiveness: 70 + Math.random() * 20 },
          { name: 'Defensive Play', frequency: 45 + Math.random() * 30, effectiveness: 60 + Math.random() * 25 }
        ],
        insights: [
          {
            type: 'strength',
            title: 'Excellent Endgame Performance',
            description: 'Your accuracy increases significantly in endgame positions.',
            priority: 1
          }
        ],
        progression: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          rating: 1200 + (i * 5) + Math.random() * 50
        }))
      };

      client.emit('playerAnalytics', analytics);
      this.logger.debug(`📊 Player analytics sent to ${payload.playerId}`);
    } catch (error: any) {
      this.logger.error(`getPlayerAnalytics error: ${error.message}`);
      client.emit('error', { event: 'getPlayerAnalytics', message: error.message });
    }
  }

  // AI Hint System
  @SubscribeMessage('getHints')
  async handleGetHints(
    @MessageBody() payload: { boardState: any; gameContext: any; playerLevel: number },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const hints = [
        {
          id: `hint_${Date.now()}`,
          type: 'strategic',
          level: 'beginner',
          urgency: 'medium',
          title: 'Control the Center',
          content: 'Playing in the center columns (3, 4, 5) gives you more opportunities.',
          explanation: 'Center columns provide the most flexibility for creating connections.',
          confidence: 85,
          boardPosition: [2, 3, 4],
          tags: ['opening', 'strategy']
        }
      ];

      client.emit('hintsGenerated', hints);
      this.logger.debug(`💡 Hints sent for player`);
    } catch (error: any) {
      this.logger.error(`getHints error: ${error.message}`);
      client.emit('error', { event: 'getHints', message: error.message });
    }
  }

  // Tournament System
  @SubscribeMessage('getTournaments')
  async handleGetTournaments(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const tournaments = [
        {
          id: 'weekend_championship',
          name: 'Weekend Championship',
          type: 'single-elimination',
          status: 'registration',
          participants: 156,
          maxParticipants: 256,
          prizePool: 1000,
          startTime: Date.now() + 2 * 24 * 60 * 60 * 1000,
          rules: ['Best of 3', 'Standard rules', '10 minute time limit']
        }
      ];

      client.emit('tournamentsData', tournaments);
      this.logger.debug(`🏆 Tournaments data sent`);
    } catch (error: any) {
      this.logger.error(`getTournaments error: ${error.message}`);
      client.emit('error', { event: 'getTournaments', message: error.message });
    }
  }

  @SubscribeMessage('startMatchmaking')
  async handleStartMatchmaking(
    @MessageBody() payload: { playerId: string; playerRating: number },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      // Simulate matchmaking process
      setTimeout(() => {
        const match = {
          id: `match_${Date.now()}`,
          opponent: {
            id: 'opponent_ai',
            username: 'Challenger',
            rating: payload.playerRating + Math.floor(Math.random() * 100 - 50)
          }
        };
        client.emit('matchFound', match);
        this.logger.debug(`⚔️ Match found for ${payload.playerId}`);
      }, 3000 + Math.random() * 5000);

      client.emit('matchmakingStarted', { success: true });
    } catch (error: any) {
      this.logger.error(`startMatchmaking error: ${error.message}`);
      client.emit('error', { event: 'startMatchmaking', message: error.message });
    }
  }

  // Visual Effects
  @SubscribeMessage('triggerVisualEffect')
  async handleTriggerVisualEffect(
    @MessageBody() payload: { effectType: string; intensity: number; position?: any },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      const effect = {
        id: `effect_${Date.now()}`,
        type: payload.effectType,
        intensity: payload.intensity || 1,
        duration: (payload.intensity || 1) * 1000,
        position: payload.position,
        timestamp: Date.now()
      };

      // Broadcast to all clients in the same room
      this.server.emit('visualEffect', effect);
      this.logger.debug(`✨ Visual effect triggered: ${payload.effectType}`);
    } catch (error: any) {
      this.logger.error(`triggerVisualEffect error: ${error.message}`);
      client.emit('error', { event: 'triggerVisualEffect', message: error.message });
    }
  }

  // Event listeners for training events
  @OnEvent('training.update')
  handleTrainingUpdate(payload: any) {
    this.server.emit('trainingUpdate', payload);
  }

  @OnEvent('training.complete')
  handleTrainingComplete(payload: any) {
    this.server.emit('trainingComplete', payload);
  }

  @OnEvent('training.log')
  handleTrainingLog(message: string) {
    this.server.emit('trainingLog', message);
  }

  @OnEvent('training.stopped')
  handleTrainingStopped(payload: any) {
    this.server.emit('trainingStopped', payload);
  }

  @OnEvent('training.paused')
  handleTrainingPaused(payload: any) {
    this.server.emit('trainingPaused', payload);
  }

  @OnEvent('training.resumed')
  handleTrainingResumed(payload: any) {
    this.server.emit('trainingResumed', payload);
  }

  // Event listeners for async AI events
  @OnEvent('ai.performance.slow')
  handleAIPerformanceSlow(payload: any) {
    this.server.emit('aiPerformanceAlert', {
      type: 'slow',
      ...payload
    });
  }

  @OnEvent('ai.cache.inefficient')
  handleAICacheInefficient(payload: any) {
    this.server.emit('aiPerformanceAlert', {
      type: 'cache_inefficient',
      ...payload
    });
  }

  @OnEvent('ai.memory.high')
  handleAIMemoryHigh(payload: any) {
    this.server.emit('aiPerformanceAlert', {
      type: 'memory_high',
      ...payload
    });
  }

  @OnEvent('ai.service.degraded')
  handleAIServiceDegraded(payload: any) {
    this.server.emit('aiServiceStatus', {
      status: 'degraded',
      ...payload
    });
  }

  @OnEvent('circuit.stateChange')
  handleCircuitStateChange(payload: any) {
    this.server.emit('aiCircuitBreakerStatus', payload);
  }
}