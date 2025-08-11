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
import { OptimizedMlClientService } from '../ml/ml-client-optimized.service';
import { DashboardService } from './dashboard.service';
import { TrainingService, TrainingConfiguration } from './training.service';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import type { CellValue } from '../ai/connect4AI';
import { AsyncAIOrchestrator } from '../ai/async/async-ai-orchestrator';
import { PerformanceMonitor } from '../ai/async/performance-monitor';
import { AdaptiveAIOrchestrator } from '../ai/adaptive/adaptive-ai-orchestrator';
import { UnifiedAICoordinatorService } from '../ai/unified/unified-ai-coordinator.service';
import { Board, CellValue as UnifiedCellValue } from '../ai/unified/unified-threat-detector.service';
import { UnifiedAISystem, UnifiedAIConfig } from '../ai/unified/unified-ai-system-simple';
import { UltimateConnect4AI } from '../ai/connect4AI';
import { SimpleAIService } from '../ai/simple-ai.service';
import { CoordinationGameIntegrationService } from '../ai/coordination/coordination-game-integration.service';
import { AICoordinationClient } from '../ai/coordination/ai-coordination-client.service';
import { GameHistoryService, GameHistoryEntry } from './game-history.service';
import { OrganicAITimingService } from '../ai/organic-ai-timing.service';
import { GameAIOrganicService } from './game-ai-organic.service';
import { EventThrottle } from '../utils/event-throttle';
import { MemoryManagementService } from './memory-management.service';

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
  private readonly AI_THINK_DELAY_MS = 200; // Natural thinking time (0.20s base) - faster but still human-like
  private readonly AI_FIRST_MOVE_DELAY_MS = process.env.AI_FIRST_MOVE_DELAY_MS ? parseInt(process.env.AI_FIRST_MOVE_DELAY_MS) : 500; // Slightly longer for first move (0.5s)

  constructor(
    private readonly gameService: GameService,
    private readonly gameAi: GameAIService,
    private readonly aiProfileService: AiProfileService,
    private readonly mlClientService: MlClientService,
    private readonly optimizedMlClient: OptimizedMlClientService,
    private readonly dashboardService: DashboardService,
    private readonly trainingService: TrainingService,
    private readonly gameHistoryService: GameHistoryService,
    private readonly organicTiming: OrganicAITimingService,
    private readonly gameAIOrganicService: GameAIOrganicService,
    private readonly eventEmitter: EventEmitter2,
    private readonly asyncAIOrchestrator?: AsyncAIOrchestrator,
    private readonly performanceMonitor?: PerformanceMonitor,
    private readonly adaptiveAIOrchestrator?: AdaptiveAIOrchestrator,
    private readonly unifiedAICoordinator?: UnifiedAICoordinatorService,
    private readonly unifiedAISystem?: UnifiedAISystem,
    private readonly simpleAI?: SimpleAIService,
    private readonly coordinationIntegration?: CoordinationGameIntegrationService,
    private readonly aiCoordinationClient?: AICoordinationClient,
    private readonly eventThrottle?: EventThrottle,
    private readonly memoryManagement?: MemoryManagementService,
  ) {
    // Subscribe to AI thinking events and forward to frontend
    this.setupAIEventListeners();
  }

  /**
   * Get cached AI move if available
   */
  private getCachedAIMove(board: any[][], difficulty: number): number | null {
    if (!this.memoryManagement) return null;
    
    const cache = this.memoryManagement.getCacheManager();
    if (!cache) return null;
    
    // Create a cache key from board state and difficulty
    const boardKey = board.flat().join('');
    const cacheKey = `ai-move-${boardKey}-${difficulty}`;
    
    const cached = cache.get(cacheKey);
    if (cached && typeof cached === 'number') {
      this.logger.debug(`Cache hit for AI move: column ${cached}`);
      return cached;
    }
    
    return null;
  }
  
  /**
   * Cache AI move for future use
   */
  private cacheAIMove(board: any[][], difficulty: number, column: number): void {
    if (!this.memoryManagement) return;
    
    const cache = this.memoryManagement.getCacheManager();
    if (!cache) return;
    
    const boardKey = board.flat().join('');
    const cacheKey = `ai-move-${boardKey}-${difficulty}`;
    
    cache.set(cacheKey, column);
    this.logger.debug(`Cached AI move: column ${column}`);
  }

  /**
   * Emit aiThinking event with throttling to prevent spam
   */
  private emitAIThinking(gameId: string, data: any): void {
    if (!this.eventThrottle) {
      // Fallback to direct emission if throttle is not available
      this.server.to(gameId).emit('aiThinking', data);
      return;
    }
    
    const eventKey = `aiThinking-${gameId}`;
    this.eventThrottle.throttle(
      eventKey,
      (eventData) => {
        this.server.to(gameId).emit('aiThinking', eventData);
      },
      data
    );
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
    
    // Log ML service status
    const mlStatus = this.optimizedMlClient.getServiceStatus();
    this.logger.log(`🧠 ML Service Status: ${mlStatus.available ? '✅ Available' : '❌ Unavailable'}`);
    if (!mlStatus.available) {
      this.logger.warn('⚠️ AI will use local algorithms for faster response times');
    }
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

      // If AI is starting, trigger the first AI move with organic timing
      if (firstPlayer === 'Yellow') {
        this.logger.log(`[${gameId}] AI is starting - triggering first move`);
        // Use organic AI service for consistent timing
        setTimeout(async () => {
          await this.gameAIOrganicService.executeOrganicAIMove({
            gameId,
            playerId,
            difficulty: difficulty || 5,
          });
        }, 300); // Small delay to let UI settle
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
      
      // CRITICAL DEFENSIVE CHECK: Must block opponent wins immediately
      const validMoves = [];
      for (let col = 0; col < 7; col++) {
        if (game.board[0][col] === 'Empty') {
          validMoves.push(col);
        }
      }
      
      for (const col of validMoves) {
        // Find the row for this column
        let row = 5;
        while (row >= 0 && game.board[row][col] !== 'Empty') row--;
        
        if (row >= 0) {
          // Check if opponent (Red) wins with this move
          game.board[row][col] = 'Red';
          const opponentWins = this.checkWin(game.board, row, col, 'Red');
          game.board[row][col] = 'Empty'; // Restore
          
          if (opponentWins) {
            this.logger.warn(`[${gameId}] 🚨 CRITICAL: Blocking opponent win at column ${col}`);
            
            // Execute the blocking move immediately
            const aiRes = await this.gameService.dropDisc(gameId, 'AI', col);
            if (aiRes.success) {
              this.server.to(gameId).emit('aiMove', {
                column: col,
                board: aiRes.board,
                lastMove: { column: col, playerId: 'Yellow' },
                winner: aiRes.winner,
                draw: aiRes.draw,
                nextPlayer: aiRes.nextPlayer,
                confidence: 1.0,
                thinkingTime: Date.now() - startTime,
                explanation: 'Blocking critical threat',
                safetyScore: 1.0,
                strategy: 'defensive_critical',
                gameMetrics: aiRes.gameMetrics
              });
              
              this.logger.log(`[${gameId}] ✅ Blocked opponent win in ${Date.now() - startTime}ms`);
              return;
            }
          }
        }
      }
      
      // Enforce minimum difficulty of 20
      const requestedDifficulty = game.aiLevel || 5;
      const difficulty = Math.max(20, requestedDifficulty);
      this.logger.log(`[${gameId}] AI Level: ${difficulty} (enforced min 20, requested: ${requestedDifficulty})`);
      
      // Check cache first for instant response (if not in lightweight mode)
      if (!this.memoryManagement?.isLightweightModeActive()) {
        const cachedMove = this.getCachedAIMove(game.board, difficulty);
        if (cachedMove !== null && game.board[0][cachedMove] === 'Empty') {
          this.logger.log(`[${gameId}] ⚡ Using cached AI move: column ${cachedMove}`);
          
          const aiRes = await this.gameService.dropDisc(gameId, 'AI', cachedMove);
          if (aiRes.success) {
            this.server.to(gameId).emit('aiMove', {
              column: cachedMove,
              board: aiRes.board,
              lastMove: { column: cachedMove, playerId: 'Yellow' },
              winner: aiRes.winner,
              draw: aiRes.draw,
              nextPlayer: aiRes.nextPlayer,
              thinkingTime: Date.now() - startTime,
              confidence: 0.95,
              explanation: 'Cached optimal move',
              strategy: 'cached',
              fromCache: true
            });
            return;
          }
        }
      }

      // PRIORITY 1: Use AI Coordination Hub for ensemble decision making
      if (this.coordinationIntegration) {
        this.logger.log(`[${gameId}] 🌐 Using AI Coordination Hub for ensemble decision`);
        this.logger.log(`[${gameId}] 📊 Game State Analysis:`);
        this.logger.log(`  • Current Player: ${game.currentPlayer}`);
        this.logger.log(`  • Move Count: ${game.board.flat().filter(cell => cell !== 'Empty').length}`);
        this.logger.log(`  • AI Difficulty: ${difficulty} (min enforced: 20)`);

        // Log board state
        this.logger.log(`[${gameId}] 📋 Board State:`);
        game.board.forEach((row, idx) => {
          this.logger.log(`  Row ${idx}: [${row.map(cell =>
            cell === 'Empty' ? '.' : cell === 'Red' ? 'R' : 'Y'
          ).join(' ')}]`);
        });

        // Emit AI thinking with coordination hub status
        this.emitAIThinking(gameId, {
          status: 'coordinating',
          capabilities: [
            'ensemble_decision',
            'multi_agent_coordination',
            'pattern_recognition',
            'threat_detection',
            'adaptive_learning',
            'strategic_planning'
          ],
          mode: 'coordination_hub'
        });

        try {
          // Get coordinated AI decision with aggressive timeout
          const boardComplexity = game.board.flat().filter(cell => cell !== 'Empty').length / 42;
          const maxTimeout = boardComplexity < 0.2 ? 200 : boardComplexity < 0.4 ? 400 : 800; // Much faster timeouts
          
          const coordResult = await this.coordinationIntegration.requestCoordinatedMove(
            game.board,
            'Yellow' as CellValue,
            difficulty,
            maxTimeout, // Aggressive timeout based on board complexity
            {
              moveHistory: [], // TODO: Add move history tracking
              gamePhase: this.determineGamePhase(game.board)
            }
          );

          // Execute the coordinated move
          const aiRes = await this.gameService.dropDisc(gameId, 'AI', coordResult.move);

          if (!aiRes.success) {
            throw new Error(aiRes.error || 'Coordinated AI move execution failed');
          }

          // Cache the successful move
          this.cacheAIMove(game.board, difficulty, coordResult.move);
          
          // Emit the coordinated AI move result
          this.server.to(gameId).emit('aiMove', {
            column: coordResult.move,
            board: aiRes.board,
            lastMove: {
              column: coordResult.move,
              playerId: 'Yellow',
              confidence: coordResult.confidence,
              strategy: 'ensemble',
              explanation: coordResult.reasoning
            },
            winner: aiRes.winner,
            draw: aiRes.draw,
            nextPlayer: aiRes.nextPlayer,
            gameMetrics: aiRes.gameMetrics,
            aiExplanation: coordResult.reasoning,
            aiMetadata: {
              algorithm: 'AI Coordination Hub',
              processingTime: Date.now() - startTime,
              source: coordResult.source,
              thinkingTime: Date.now() - startTime,
              strategy: 'ensemble',
              coordinationMode: true
            },
            confidence: coordResult.confidence,
            thinkingTime: Date.now() - startTime,
            safetyScore: 1.0,
            strategy: 'coordinated'
          });

          this.logger.log(
            `[${gameId}] 🌐 Coordination Hub played column ${coordResult.move} ` +
            `(confidence: ${(coordResult.confidence * 100).toFixed(1)}%, ` +
            `source: ${coordResult.source}, time: ${Date.now() - startTime}ms)`
          );

          return;
        } catch (coordError: any) {
          this.logger.error(`[${gameId}] ❌ Coordination Hub error: ${coordError.message}`);
          this.logger.warn(`[${gameId}] ⚠️ Falling back to SimpleAI...`);
          // Fall through to SimpleAI
        }
      }

      // PRIORITY 2: Use SimpleAI for basic gameplay (fallback)
      if (this.simpleAI) {
        this.logger.log(`[${gameId}] 🚀 Using SimpleAI for gameplay`);

        // Emit AI thinking with simple status
        this.emitAIThinking(gameId, {
          status: 'analyzing',
          capabilities: [
            'basic_minimax',
            'immediate_threats',
            'quick_wins'
          ],
          mode: 'simple_ai'
        });

        try {
          // Get the best move from UltimateConnect4AI
          const aiMove = await this.simpleAI.getBestMove(
            game.board,
            'Yellow' as CellValue,
            'hard' // difficulty
          );

          // Execute the move
          const aiRes = await this.gameService.dropDisc(gameId, 'AI', aiMove);

          if (!aiRes.success) {
            throw new Error(aiRes.error || 'Ultimate AI move execution failed');
          }

          // Emit the ultimate AI move result
          this.server.to(gameId).emit('aiMove', {
            column: aiMove,
            board: aiRes.board,
            lastMove: {
              column: aiMove,
              playerId: 'Yellow',
              confidence: 0.8,
              strategy: 'simplified',
              explanation: 'AI made a strategic move'
            },
            winner: aiRes.winner,
            draw: aiRes.draw,
            nextPlayer: aiRes.nextPlayer,
            gameMetrics: aiRes.gameMetrics,
            aiExplanation: 'AI made a strategic move',
            aiMetadata: {
              algorithm: 'SimpleAI',
              processingTime: Date.now() - startTime,
              nodesExplored: 0,
              thinkingTime: Date.now() - startTime,
              strategy: 'simplified',
              alternatives: []
            },
            confidence: 0.8,
            thinkingTime: Date.now() - startTime,
            safetyScore: 1.0,
            strategy: 'simplified'
          });

          this.logger.log(
            `[${gameId}] 🚀 SimpleAI played column ${aiMove} ` +
            `(time: ${Date.now() - startTime}ms)`
          );

          return;
        } catch (ultimateAIError: any) {
          this.logger.error(`[${gameId}] ❌ UltimateConnect4AI error: ${ultimateAIError.message}`);
          this.logger.error(`[${gameId}] Stack trace: ${ultimateAIError.stack}`);
          this.logger.warn(`[${gameId}] ⚠️ Falling back to alternative AI system...`);
          // Fall through to next AI system
        }
      }

      // Use adaptive AI orchestrator if available
      if (this.adaptiveAIOrchestrator) {
        this.logger.log(`[${gameId}] 🎯 Using Adaptive AI Orchestrator for level ${difficulty}`);

        // Emit AI thinking with adaptive status
        this.emitAIThinking(gameId, {
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

      // Try Unified AI Coordinator before other fallbacks
      if (this.unifiedAICoordinator) {
        this.logger.log(`[${gameId}] 🎯 Using Unified AI Coordinator for level ${difficulty}`);

        // Convert board to unified format
        const unifiedBoard: Board = game.board.map((row: any[]) =>
          row.map((cell: any) => {
            if (cell === 'Red') return 'Red' as UnifiedCellValue;
            if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
            return 'Empty' as UnifiedCellValue;
          })
        );

        // Emit AI thinking status
        this.emitAIThinking(gameId, {
          status: 'analyzing',
          capabilities: ['unified_threat_detection', 'adaptive_strategy', 'pattern_recognition'],
          mode: 'unified'
        });

        try {
          // Get AI decision from unified system
          const response = await this.unifiedAICoordinator.getAIMove(
            gameId,
            unifiedBoard,
            'Yellow' as UnifiedCellValue,
            difficulty,
            {
              timeLimit: Math.min(2000, 1000 + Math.floor((difficulty/25) * 500)), // Reduced from 3-4s to 1-2s
              useCache: true
            }
          );

          // Log decision details
          this.logger.log(`[${gameId}] 🤖 Unified AI Decision:`);
          this.logger.log(`  • Column: ${response.move}`);
          this.logger.log(`  • Confidence: ${(response.decision.confidence * 100).toFixed(1)}%`);
          this.logger.log(`  • Strategy: ${response.decision.strategy}`);
          this.logger.log(`  • Source: ${response.source}`);
          this.logger.log(`  • Time: ${response.metadata.processingTime}ms`);

          // Execute the move
          const aiRes = await this.gameService.dropDisc(gameId, 'AI', response.move);

          if (!aiRes.success) {
            throw new Error(aiRes.error || 'Move execution failed');
          }

          // Emit the unified AI move result
          this.server.to(gameId).emit('aiMove', {
            column: response.move,
            board: aiRes.board,
            lastMove: { column: response.move, playerId: 'Yellow' },
            winner: aiRes.winner,
            draw: aiRes.draw,
            nextPlayer: aiRes.nextPlayer,
            confidence: response.decision.confidence,
            thinkingTime: response.metadata.processingTime,
            explanation: response.decision.explanation,
            safetyScore: 1.0,
            strategy: response.decision.strategy,
            gameMetrics: aiRes.gameMetrics,
            // Additional unified AI data
            unifiedData: {
              source: response.source,
              threatDetectionUsed: response.metadata.threatDetectionUsed,
              cacheHit: response.metadata.cacheUtilized,
              alternatives: response.decision.alternativeMoves
            }
          });

          this.logger.log(
            `[${gameId}] ✅ Unified AI played column ${response.move} ` +
            `(confidence: ${(response.decision.confidence * 100).toFixed(1)}%, ` +
            `time: ${response.metadata.processingTime}ms)`
          );

          return;
        } catch (unifiedError: any) {
          this.logger.error(`[${gameId}] Unified AI error, falling back: ${unifiedError.message}`);
          // Continue to other fallbacks
        }
      }

      // Try Unified AI System (most comprehensive solution)
      if (this.unifiedAISystem) {
        this.logger.log(`[${gameId}] 🚀 Using Unified AI System for level ${difficulty}`);

        try {
          // Convert board to unified format
          const unifiedBoard: Board = game.board.map((row: any[]) =>
            row.map((cell: any) => {
              if (cell === 'Red') return 'Red' as UnifiedCellValue;
              if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
              return 'Empty' as UnifiedCellValue;
            })
          );

          // Emit AI thinking status
          this.emitAIThinking(gameId, {
            status: 'analyzing',
            capabilities: [
              'unified_threat_detection',
              'multi_algorithm_support',
              'pattern_recognition',
              'opening_book',
              'endgame_tablebase'
            ],
            mode: 'unified_ai_system'
          });

          // Configure AI based on difficulty
          const config: UnifiedAIConfig = {
            difficulty,
            personality: game.aiPersonality || 'balanced',
            timeLimit: Math.min(4000, 3000 + Math.floor((difficulty/25) * 1000)),
            useCache: true,
            learningEnabled: true,
            explanationLevel: 'detailed'
          };

          // Get AI decision
          const decision = await this.unifiedAISystem.makeMove(
            unifiedBoard,
            'Yellow' as UnifiedCellValue,
            config
          );

          // Log decision details
          this.logger.log(`[${gameId}] 🤖 Unified AI System Decision:`);
          this.logger.log(`  • Column: ${decision.move}`);
          this.logger.log(`  • Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
          this.logger.log(`  • Strategy: ${decision.strategy}`);
          this.logger.log(`  • Algorithm: ${decision.metadata.algorithm}`);
          this.logger.log(`  • Time: ${decision.metadata.computationTime}ms`);

          // Execute the move
          const aiRes = await this.gameService.dropDisc(gameId, 'AI', decision.move);

          if (!aiRes.success) {
            throw new Error(aiRes.error || 'Move execution failed');
          }

          // Emit the AI move result
          this.server.to(gameId).emit('aiMove', {
            column: decision.move,
            board: aiRes.board,
            lastMove: {
              column: decision.move,
              playerId: 'Yellow',
              confidence: decision.confidence,
              strategy: decision.strategy,
              explanation: decision.explanation
            },
            winner: aiRes.winner,
            draw: aiRes.draw,
            nextPlayer: aiRes.nextPlayer,
            gameMetrics: aiRes.gameMetrics,
            aiExplanation: decision.explanation,
            aiMetadata: {
              algorithm: decision.metadata.algorithm,
              processingTime: decision.metadata.computationTime,
              nodesEvaluated: decision.metadata.nodesEvaluated,
              cacheHit: decision.metadata.cacheHit,
              threatAnalysis: decision.metadata.threatAnalysis,
              alternatives: decision.alternatives
            }
          });

          this.logger.log(
            `[${gameId}] ✅ Unified AI System played column ${decision.move} ` +
            `(${decision.metadata.algorithm}, ${(decision.confidence * 100).toFixed(1)}% confidence)`
          );

          return;
        } catch (unifiedSystemError: any) {
          this.logger.error(`[${gameId}] Unified AI System error: ${unifiedSystemError.message}`);
          // Continue to other fallbacks
        }
      }

      // Fallback to previous logic if adaptive AI not available
      const totalMoves = game.board.flat().filter(cell => cell !== null).length;
      // Only use fast early game for low difficulties
      const isEarlyGame = totalMoves < 6 && difficulty < 6;

      if (isEarlyGame) {
        this.logger.log(`[${gameId}] ⚡ Early game move ${totalMoves + 1} - using fast AI`);

        this.emitAIThinking(gameId, {
          type: 'systemActivation',
          message: '⚡ Early Game AI activated',
          details: {
            system: 'EarlyGameAI',
            moveNumber: totalMoves + 1,
            strategy: 'fast_strategic',
            description: 'Quick strategic moves for early game positions',
            difficulty
          },
          timestamp: Date.now()
        });

        let fastColumn: number;
        if (totalMoves === 0) {
          // For higher difficulties, randomize opening slightly
          fastColumn = difficulty >= 4 ? [3, 4, 2][Math.floor(Math.random() * 3)] : 3;
        } else {
          // ALWAYS check for threats after the first move, regardless of move count
          fastColumn = await this.getQuickStrategicMove(game.board);

          // If no immediate threats/opportunities found, use center-focused strategy
          if (fastColumn === -1 && totalMoves <= 3) {
            const centerColumns = difficulty >= 4 ?
              [3, 4, 2, 5, 1, 6, 0] : // More varied for higher difficulty
              [3, 4, 2, 5];
            fastColumn = centerColumns.find(col =>
              game.board[0][col] === 'Empty'
            ) || 3;
          }
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
      this.emitAIThinking(gameId, {
        type: 'systemActivation',
        message: '🎲 Streamlined Strategic AI activated',
        details: {
          system: 'StreamlinedAI',
          moveNumber: totalMoves + 1,
          capabilities: ['strategic_analysis', 'threat_detection'],
          description: 'Efficient mid/late game analysis'
        },
        timestamp: Date.now()
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
        // Handle both number and object return types
        const aiColumn = typeof fallbackAI === 'number' ? fallbackAI : fallbackAI.move;
        const fallbackRes = await this.gameService.dropDisc(gameId, 'AI', aiColumn);

        if (fallbackRes.success) {
          this.server.to(gameId).emit('aiMove', {
            column: aiColumn,
            board: fallbackRes.board,
            lastMove: { column: aiColumn, playerId: 'Yellow' },
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
    // Use Unified AI System if available
    if (this.unifiedAISystem) {
      try {
        const unifiedBoard: Board = board.map(row =>
          row.map(cell => {
            if (cell === 'Red') return 'Red' as UnifiedCellValue;
            if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
            return 'Empty' as UnifiedCellValue;
          })
        );

        const move = await this.unifiedAISystem.quickMove(unifiedBoard, 'Yellow' as UnifiedCellValue);
        this.logger.log(`🎯 [Unified AI] Quick move selected: column ${move}`);

        // Log threat detection reasoning
        const opponentColor = 'Red' as UnifiedCellValue;
        const threats = this.unifiedAISystem['unifiedThreatDetector'].analyzeBoardThreats(
          unifiedBoard,
          'Yellow' as UnifiedCellValue,
          opponentColor
        );

        if (threats.immediateWins.length > 0) {
          this.logger.log(`⚡ [Unified AI] WINNING MOVE detected at column ${move}!`);
        } else if (threats.immediateBlocks.length > 0) {
          this.logger.log(`🛡️ [Unified AI] BLOCKING opponent threat at column ${move}!`);
        } else {
          this.logger.log(`📍 [Unified AI] Strategic positioning at column ${move}`);
        }

        return move;
      } catch (error) {
        this.logger.error(`Unified AI quick move error: ${error.message}`);
        // Fall through to legacy implementation
      }
    }

    // Legacy implementation as fallback
    this.logger.log(`🤔 [Quick AI] Evaluating board for threats and opportunities`);

    // Log board state for debugging
    const occupiedCells = board.flat().filter(cell => cell !== null).length;
    const cellTypes = board.flat().filter(cell => cell !== null);
    const uniqueValues = [...new Set(cellTypes)];
    this.logger.log(`📊 [Quick AI] Board has ${occupiedCells} pieces. Cell values: ${uniqueValues.join(', ')}`);

    // Simple strategic evaluation - check for immediate threats and opportunities
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== 'Empty') continue; // Column full

      // Find the row where the piece would land
      let row = 5;
      while (row >= 0 && board[row][col] !== 'Empty') {
        row--;
      }
      if (row < 0) continue; // Column full

      // Check for immediate win
      board[row][col] = 'Yellow';
      if (this.checkWin(board, row, col, 'Yellow')) {
        board[row][col] = 'Empty'; // Reset
        this.logger.log(`🎯 [Quick AI] Taking winning move at column ${col}`);
        return col;
      }
      board[row][col] = 'Empty'; // Reset

      // Check for blocking opponent win
      board[row][col] = 'Red';
      const wouldWin = this.checkWin(board, row, col, 'Red');
      board[row][col] = 'Empty'; // Reset

      if (wouldWin) {
        this.logger.log(`🚨 [Quick AI] Blocking opponent win at column ${col}, row ${row}`);
        return col;
      }
    }

    // Return -1 to indicate no immediate threats/opportunities found
    return -1;
  }

  /**
   * Streamlined AI move using basic AI service (faster than enhanced AI)
   */
  private async getStreamlinedAIMove(gameId: string, board: any[][], playerId: string): Promise<any> {
    try {
      // First, ALWAYS check for immediate threats/opportunities
      const quickCheck = await this.getQuickStrategicMove(board);
      if (quickCheck !== -1) {
        this.logger.log(`🚀 [Streamlined AI] Quick threat detection found critical move at column ${quickCheck}`);
        return {
          column: quickCheck,
          confidence: 0.95,
          explanation: 'Critical threat/opportunity detected',
          strategy: 'threat_response'
        };
      }

      // Emit progress update
      this.emitAIThinking(gameId, {
        type: 'progress',
        message: 'Analyzing with tactical AI strategy (depth: 6, confidence: building...)',
        details: {
          strategy: 'tactical',
          depth: 6,
          phase: 'threat_detection'
        },
        timestamp: Date.now()
      });

      // Use the basic AI service for strategic moves
      const aiResult = await this.gameAi.getNextMove(board, 'Yellow', playerId, gameId);
      // Handle both number and object return types
      const column = typeof aiResult === 'number' ? aiResult : aiResult.move;
      const confidence = typeof aiResult === 'number' ? 0.85 : aiResult.confidence;

      // Analyze the move
      const moveAnalysis = this.analyzeMove(board, column);

      return {
        column,
        confidence,
        explanation: moveAnalysis,
        strategy: 'tactical'
      };
    } catch (error) {
      // Emit fallback notice
      this.emitAIThinking(gameId, {
        type: 'progress',
        message: 'Switching to basic heuristic analysis',
        details: {
          strategy: 'basic',
          reason: 'Primary analysis failed'
        },
        timestamp: Date.now()
      });

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
   * Analyze a move to provide explanation
   */
  private analyzeMove(board: any[][], column: number): string {
    const row = this.getNextRow(board, column);
    if (row === -1) return 'Invalid move';

    // Check for winning move
    board[row][column] = 'Yellow';
    const isWin = this.checkWin(board, row, column, 'Yellow');
    board[row][column] = null;
    if (isWin) return 'Winning move!';

    // Check for blocking
    board[row][column] = 'Red';
    const isBlock = this.checkWin(board, row, column, 'Red');
    board[row][column] = null;
    if (isBlock) return 'Blocking opponent win';

    // Center control
    if (column >= 2 && column <= 4) {
      return 'Controlling center position';
    }

    // Default
    return 'Strategic positioning';
  }

  /**
   * Get the next available row for a column
   */
  private getNextRow(board: any[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 'Empty') return row;
    }
    return -1;
  }

  /**
   * Check if a move results in a win
   */
  private checkWin(board: any[][], row: number, col: number, player: string): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;

      // Check positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }

      // Check negative direction
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
   * Simple win check for quick evaluation
   */
  private checkWinOld(board: any[][], row: number, col: number, player: string): boolean {
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

      // Check for game end
      if (result.winner || result.draw) {
        const game = this.gameService.getGame(gameId);
        if (game) {
          // Save game history
          try {
            const endTime = new Date();
            const startTime = new Date(Date.now() - (game.moves?.length || 0) * 30000); // Estimate start time
            
            const gameHistory: GameHistoryEntry = {
              gameId,
              playerId,
              startTime,
              endTime,
              duration: endTime.getTime() - startTime.getTime(),
              winner: result.winner === 'Red' ? 'player' : result.winner === 'Yellow' ? 'ai' : 'draw',
              totalMoves: game.moves?.length || 0,
              playerMoves: game.moves?.filter((m: any) => m.player === 'Red').map((m: any) => m.column) || [],
              aiMoves: game.moves?.filter((m: any) => m.player === 'Yellow').map((m: any) => m.column) || [],
              finalBoard: result.board!,
              gameMode: 'classic',
              aiLevel: game.aiLevel || 5,
              playerSkill: 'intermediate',
              metadata: {
                deviceType: 'web',
                sessionId: client.id,
                version: '1.0.0',
                features: ['ai-enhanced', 'real-time'],
              },
              tags: [],
              notes: '',
              rating: 0,
              isFavorite: false,
              isPublic: false,
            };
            
            await this.gameHistoryService.saveGameHistory(gameHistory);
            
            // Also save game replay if moves are available
            if (game.moves && game.moves.length > 0) {
              const replay = this.gameHistoryService.createGameReplay(
                gameId,
                game.moves.map((move: any, index: number) => ({
                  player: move.player === 'Red' ? 'player' : 'ai',
                  column: move.column,
                  timestamp: startTime.getTime() + (index * 30000), // Estimate timestamps
                  boardState: move.boardState || result.board,
                })),
                result.winner === 'Red' ? 'player' : result.winner === 'Yellow' ? 'ai' : 'draw'
              );
              
              await this.gameHistoryService.saveGameReplay(gameId, replay);
            }
            
            this.logger.log(`[${gameId}] 💾 Game history saved for player ${playerId}`);
          } catch (error) {
            this.logger.error(`[${gameId}] Failed to save game history: ${error}`);
          }

          // Emit game ended event for learning
          this.eventEmitter.emit('game.ended', {
            gameId,
            winner: result.winner,
            draw: result.draw,
            aiPlayer: 'Yellow',
            difficulty: game.aiLevel || 5,
            moves: game.moves || [],
            boardStates: [], // Will be tracked in future updates
            timestamp: Date.now(),
          });

          this.logger.log(`[${gameId}] Game ended: ${result.winner ? `${result.winner} wins` : 'Draw'}`);
          
          // Trigger memory cleanup after game ends
          if (this.memoryManagement) {
            this.logger.debug(`[${gameId}] Triggering post-game memory cleanup`);
            setTimeout(() => {
              this.memoryManagement.forceCleanup();
            }, 2000); // Cleanup after 2 seconds
          }
        }
      }

      // If game continues and it's AI's turn, use organic timing
      // IMPORTANT: Only trigger AI if this was a HUMAN move (not an AI move)
      this.logger.log(`[${gameId}] After move: nextPlayer=${result.nextPlayer}, playerId=${playerId}, checking if AI should play`);
      if (!result.winner && !result.draw && result.nextPlayer === 'Yellow' && playerId !== 'AI') {
        this.logger.log(`[${gameId}] 🤖 Triggering AI response with organic timing`);
        // Use organic AI service for smooth, consistent timing
        await this.gameAIOrganicService.executeOrganicAIMove({
          gameId,
          playerId,
          difficulty: 5, // Default difficulty
        });
      } else {
        this.logger.log(`[${gameId}] Not triggering AI: winner=${result.winner}, draw=${result.draw}, nextPlayer=${result.nextPlayer}, playerId=${playerId}`);
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
   * Request dashboard metrics manually
   */
  @SubscribeMessage('requestDashboardMetrics')
  async handleRequestDashboardMetrics(
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      this.logger.log('📊 Manual dashboard metrics request from client');
      
      // Emit a test metric immediately
      const testMetric = {
        timestamp: Date.now(),
        test: true,
        message: 'Manual metrics request received'
      };
      
      client.emit('metrics:update', testMetric);
      this.logger.log('📊 Sent test metric to client');
      
      // Also trigger a real metrics emit
      this.eventEmitter.emit('dashboard.metrics.request');
      
    } catch (error: any) {
      this.logger.error(`Failed to send dashboard metrics: ${error.message}`);
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

  @OnEvent('service.status.update')
  handleServiceStatusUpdate(payload: any) {
    this.server.emit('serviceStatusUpdate', payload);
  }
  
  @SubscribeMessage('requestServiceStatus')
  async handleServiceStatusRequest(@ConnectedSocket() client: Socket) {
    // Request current status from the orchestrator
    this.eventEmitter.emit('service.status.request', { clientId: client.id });
    return { event: 'serviceStatusRequested', data: { message: 'Status update requested' } };
  }

  /**
   * Determine the current game phase based on board state
   */
  private determineGamePhase(board: any[][]): string {
    const totalMoves = board.flat().filter(cell => cell !== 'Empty' && cell !== null).length;

    if (totalMoves < 8) return 'opening';
    if (totalMoves < 24) return 'midgame';
    return 'endgame';
  }

  /**
   * Handle AI move through AI Coordination Hub (if connected)
   */
  private async handleCoordinatedAIMove(gameId: string, game: any, difficulty: number): Promise<boolean> {
    if (!this.aiCoordinationClient || !this.aiCoordinationClient.isConnected()) {
      return false;
    }

    const startTime = Date.now();
    this.logger.log(`[${gameId}] 🔗 Using AI Coordination Hub for ensemble decision`);

    try {
      // Emit coordination status
      this.emitAIThinking(gameId, {
        status: 'coordinating',
        capabilities: [
          'multi_agent_ensemble',
          'collective_intelligence',
          'emergency_coordination',
          'cross_model_learning'
        ],
        mode: 'coordination_hub'
      });

      // Convert board for coordination hub
      const boardState = game.board.map((row: any[]) =>
        row.map((cell: any) => {
          if (cell === 'Red') return 'Red';
          if (cell === 'Yellow') return 'Yellow';
          return 'Empty';
        })
      );

      // Request coordinated decision
      const coordinationRequest = {
        game_id: gameId,
        board_state: boardState,
        context: {
          difficulty,
          game_phase: this.determineGamePhase(game.board),
          move_count: boardState.flat().filter((c: string) => c !== 'Empty').length,
          ai_color: 'Yellow',
          opponent_color: 'Red'
        },
        collaboration_mode: 'ensemble',
        urgency: 5,
        deadline_ms: 3000
      };

      // Send request and wait for coordinated response
      // This would be handled by the AICoordinationClient's WebSocket connection
      // For now, return false to use fallback
      return false;

    } catch (error: any) {
      this.logger.error(`[${gameId}] Coordination Hub error: ${error.message}`);
      return false;
    }
  }

  /**
   * Set up listeners for AI thinking events to forward to frontend
   */
  private setupAIEventListeners(): void {
    // Subscribe to throttled AI thinking progress events
    this.eventEmitter.on('ai.thinking.progress', (data) => {
      // Only emit to the specific game room
      if (data.gameId && this.server) {
        this.emitAIThinking(data.gameId, {
          phase: data.phase,
          progress: data.progress,
          message: data.message,
          estimatedTime: data.estimatedTimeRemaining,
          organic: true,
        });
      }
    });

    // Subscribe to AI move completion
    this.eventEmitter.on('aiMove', (data) => {
      this.server.to(data.gameId).emit('aiMove', {
        column: data.column,
        board: data.board,
        lastMove: data.lastMove,
        winner: data.winner,
        draw: data.draw,
        nextPlayer: data.nextPlayer,
        thinkingTime: data.thinkingTime,
        naturalTiming: data.naturalTiming,
        gameMetrics: data.gameMetrics,
      });
    });

    // Subscribe to AI errors
    this.eventEmitter.on('aiMoveError', (data) => {
      this.server.to(data.gameId).emit('gameError', {
        message: 'AI failed to make a move',
        error: data.error,
      });
    });
    
    // Forward criticality analysis
    this.eventEmitter.on('ai.criticality.analyzed', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'criticality',
          message: `Game criticality: ${data.criticality.score.toFixed(2)} - ${this.getCriticalityLevel(data.criticality.score)}`,
          details: {
            score: data.criticality.score,
            factors: data.criticality.factors,
            recommendedDepth: data.criticality.recommendedDepth,
            timeAllocation: data.criticality.timeAllocation,
            useAdvancedAI: data.criticality.useAdvancedAI
          },
          timestamp: Date.now()
        });
      }
    });

    // Forward AI analysis progress
    this.eventEmitter.on('ai.analysis.progress', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'progress',
          message: `Analyzing with ${data.strategy} strategy (depth: ${data.depth}, confidence: ${data.confidence?.toFixed(2) || 'N/A'})`,
          details: data,
          timestamp: Date.now()
        });
      }
    });

    // Forward variation found
    this.eventEmitter.on('ai.variation.found', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'variation',
          message: `Found variation: ${data.variation} with score ${data.score}`,
          details: data,
          timestamp: Date.now()
        });
      }
    });

    // Forward move computation complete
    this.eventEmitter.on('ai.move.computed', (data: any) => {
      if (data.gameId) {
        const { moveAnalysis, actualTime } = data;
        this.emitAIThinking(data.gameId, {
          type: 'moveDecision',
          message: `AI decided on column ${moveAnalysis.column} with ${(moveAnalysis.confidence * 100).toFixed(1)}% confidence`,
          details: {
            column: moveAnalysis.column,
            confidence: moveAnalysis.confidence,
            criticalityScore: moveAnalysis.criticalityScore,
            computationTime: moveAnalysis.computationTime,
            servicesUsed: moveAnalysis.servicesUsed,
            explanation: moveAnalysis.explanation,
            alternativeMoves: moveAnalysis.alternativeMoves,
            actualTime
          },
          timestamp: Date.now()
        });
      }
    });

    // Forward difficulty mapping
    this.eventEmitter.on('ai.difficulty.mapped', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'difficultyMapping',
          message: `Difficulty: Level ${data.frontendLevel} (${data.difficultyName}) → ${data.backendDifficulty.toFixed(1)}/10 backend scale`,
          details: {
            frontendLevel: data.frontendLevel,
            backendDifficulty: data.backendDifficulty,
            difficultyName: data.difficultyName
          },
          timestamp: data.timestamp
        });
      }
    });

    // Forward enhanced RL events
    this.eventEmitter.on('ai.enhanced_rl.applied', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'enhancedRL',
          message: `🧠 Enhanced RLHF system applied constitutional AI principles`,
          details: {
            column: data.column,
            explanation: data.explanation,
            adaptationApplied: data.adaptationApplied,
            systems: ['RLHF', 'Constitutional AI', 'Adaptation System', 'Safety Monitor'],
            capabilities: [
              'Human feedback learning',
              'Ethical decision making',
              'Player profiling',
              'Multi-agent consensus'
            ]
          },
          timestamp: data.timestamp
        });
      }
    });

    // Forward enhanced AI move analysis
    this.eventEmitter.on('ai.move.enhanced', (data: any) => {
      if (data.gameId) {
        this.emitAIThinking(data.gameId, {
          type: 'enhancedAnalysis',
          message: `🎯 Enhanced analysis: ${data.explanation?.naturalLanguageExplanation || 'Advanced strategic evaluation'}`,
          details: {
            column: data.column,
            safetyStatus: data.safetyStatus,
            safetyViolations: data.safetyViolations,
            debateConsensus: data.debateConsensus,
            adaptationActive: data.adaptationActive,
            explanation: data.explanation
          },
          timestamp: Date.now()
        });
      }
    });

    // Forward memory dashboard metrics
    this.eventEmitter.on('dashboard.metrics', (metrics: any) => {
      this.logger.log('📊 Broadcasting memory metrics to all clients');
      if (this.server) {
        this.server.emit('metrics:update', metrics);
        this.logger.debug('📊 Metrics broadcasted');
      } else {
        this.logger.warn('📊 Server not initialized, cannot broadcast metrics');
      }
    });

    // Forward memory state changes
    this.eventEmitter.on('memory.state.changed', (state: any) => {
      this.server.emit('memory:alert', {
        level: state.level,
        timestamp: Date.now(),
        message: this.getMemoryAlertMessage(state.level)
      });
    });

    // Forward degradation level changes
    this.eventEmitter.on('degradation.level.changed', (data: any) => {
      this.server.emit('degradation:change', {
        previousLevel: data.previousLevel,
        currentLevel: data.currentLevel,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get human-readable criticality level
   */
  private getCriticalityLevel(score: number): string {
    if (score < 0.3) return 'Low (quick strategic move)';
    if (score < 0.7) return 'Medium (balanced analysis)';
    return 'High (deep critical analysis)';
  }

  /**
   * Get human-readable memory alert message
   */
  private getMemoryAlertMessage(level: string): string {
    switch (level) {
      case 'low':
        return 'Memory usage is normal';
      case 'moderate':
        return 'Memory usage is elevated - optimizations active';
      case 'high':
        return 'High memory pressure - degradation active';
      case 'critical':
        return 'Critical memory pressure - emergency measures active';
      default:
        return `Memory alert: ${level}`;
    }
  }
}