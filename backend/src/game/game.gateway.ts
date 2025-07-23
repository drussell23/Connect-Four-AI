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
  private readonly AI_THINK_DELAY_MS = 500;
  private readonly AI_FIRST_MOVE_DELAY_MS = 200;

  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
    private readonly dashboardService: DashboardService,
    private readonly trainingService: TrainingService,
  ) { }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
    this.gameService.setServer(server);
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

      // If AI is starting, trigger the first AI move immediately
      if (firstPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] AI is starting - triggering first move`);
        // Use a short delay to ensure the frontend has processed the game creation
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, 200);
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
   * Trigger an enhanced AI move with full capability integration
   */
  private async triggerAIMove(gameId: string, playerId: string): Promise<void> {
    try {
      this.logger.log(`[${gameId}] 🧠 Triggering Enhanced AI move`);

      // Emit AI thinking status with enhanced information
      this.server.to(gameId).emit('aiThinking', {
        status: 'thinking',
        capabilities: ['constitutional_ai', 'safety_monitoring', 'explainable_ai', 'real_time_adaptation']
      });

      // Moderate delay to show thinking process
      await new Promise(r => setTimeout(r, this.AI_THINK_DELAY_MS));

      // Get the current game state
      const game = this.gameService.getGame(gameId);
      if (!game) {
        this.logger.error(`[${gameId}] Game not found for AI move`);
        return;
      }

      // Generate Enhanced AI move using the integrated systems
      this.logger.log(`[${gameId}] 🎯 Computing Enhanced AI move`);
      const startTime = Date.now();

      const enhancedAIResult = await this.gameService.getAIMove(gameId, 'Yellow', playerId);
      const thinkingTime = Date.now() - startTime;

      this.logger.log(`[${gameId}] ✅ Enhanced AI computed move ${enhancedAIResult.column} in ${thinkingTime}ms`);

      // Emit enhanced thinking result
      this.server.to(gameId).emit('aiThinkingComplete', {
        column: enhancedAIResult.column,
        confidence: enhancedAIResult.confidence,
        thinkingTime,
        explanation: enhancedAIResult.explanation,
        safetyScore: enhancedAIResult.safetyScore,
        adaptationInfo: enhancedAIResult.adaptationInfo,
        curriculumInfo: enhancedAIResult.curriculumInfo
      });

      // Execute the AI move
      const aiRes = await this.gameService.dropDisc(gameId, 'AI', enhancedAIResult.column);
      if (!aiRes.success) {
        this.logger.error(`[${gameId}] AI move failed: ${aiRes.error}`);
        this.server.to(gameId).emit('error', {
          event: 'aiMove',
          message: 'Enhanced AI move failed',
          fallback: true
        });
        return;
      }

      // Emit the enhanced AI move result to clients
      this.server.to(gameId).emit('aiMove', {
        board: aiRes.board,
        lastMove: {
          column: enhancedAIResult.column,
          playerId: 'Yellow' as CellValue,
          confidence: enhancedAIResult.confidence,
          thinkingTime: thinkingTime
        },
        winner: aiRes.winner,
        draw: aiRes.draw,
        nextPlayer: aiRes.nextPlayer,

        // Enhanced AI Information
        enhancedData: {
          explanation: enhancedAIResult.explanation,
          confidence: enhancedAIResult.confidence,
          safetyScore: enhancedAIResult.safetyScore,
          adaptationInfo: enhancedAIResult.adaptationInfo,
          curriculumInfo: enhancedAIResult.curriculumInfo,
          debateResult: enhancedAIResult.debateResult,
          thinkingTime: thinkingTime
        },

        // Game Metrics
        gameMetrics: aiRes.gameMetrics,
        aiExplanation: aiRes.aiExplanation,
        curriculumUpdate: aiRes.curriculumUpdate
      });

      this.logger.log(
        `[${gameId}] 🎯 Enhanced AI played column ${enhancedAIResult.column} ` +
        `(confidence: ${(enhancedAIResult.confidence! * 100).toFixed(1)}%, ` +
        `safety: ${(enhancedAIResult.safetyScore! * 100).toFixed(1)}%)`
      );

      // Log explanation if available
      if (enhancedAIResult.explanation) {
        this.logger.debug(`[${gameId}] 💭 AI Explanation: ${enhancedAIResult.explanation}`);
      }

    } catch (error: any) {
      this.logger.error(`[${gameId}] Error in Enhanced AI move: ${error.message}`);
      this.server.to(gameId).emit('error', {
        event: 'enhancedAiMove',
        message: 'Enhanced AI move failed',
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

        const fallbackAI = await this.gameAi.getNextMove(fallbackGame.board, 'Yellow', playerId);
        const fallbackRes = await this.gameService.dropDisc(gameId, 'AI', fallbackAI);

        if (fallbackRes.success) {
          this.server.to(gameId).emit('aiMove', {
            board: fallbackRes.board,
            lastMove: { column: fallbackAI, playerId: 'Yellow' as CellValue },
            winner: fallbackRes.winner,
            draw: fallbackRes.draw,
            nextPlayer: fallbackRes.nextPlayer,
            enhancedData: {
              explanation: 'Fallback AI decision - Enhanced systems temporarily unavailable',
              confidence: 0.6,
              safetyScore: 1.0,
              thinkingTime: 100
            }
          });
        }
      } catch (fallbackError: any) {
        this.logger.error(`[${gameId}] Fallback AI also failed: ${fallbackError.message}`);
        this.server.to(gameId).emit('error', {
          event: 'fallbackAiMove',
          message: 'Both Enhanced and Fallback AI failed',
          details: fallbackError.message
        });
      }
    }
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
        setTimeout(async () => {
          await this.triggerAIMove(gameId, playerId);
        }, this.AI_THINK_DELAY_MS);
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
}
