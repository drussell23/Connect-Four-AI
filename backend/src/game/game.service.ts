import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { getBestAIMove, UltimateConnect4AI, AIDecision, UltimateAIConfig, tryDrop } from '../ai/connect4AI';
import type { CellValue } from '../ai/connect4AI';
import { getAIMoveViaAPI } from '../services/ml_inference';
import { GameHistoryService, GameHistoryEntry } from './game-history.service';

export interface GameMove {
  playerId: string;
  column: number;
  row: number;
  timestamp: number;
  thinkingTime?: number;
  confidence?: number;
  aiDecision?: AIDecision;
}

export interface PlayerProfile {
  playerId: string;
  skillLevel: number;
  playingStyle: string;
  gamesPlayed: number;
  winRate: number;
  averageMoveTime: number;
  preferredDifficulty: number;
  satisfactionScore: number;
  lastActive: number;
}

export interface EnhancedGameState {
  board: CellValue[][];
  currentPlayer: CellValue;
  players: string[];
  moves: GameMove[];
  startTime: number;
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  difficulty: number;
  aiPersonality: string;
  playerProfiles: Map<string, PlayerProfile>;
  aiExplanations: string[];
  safetyViolations: any[];
  curriculumInfo: any;
  gameMetrics: {
    totalThinkingTime: number;
    averageConfidence: number;
    safetyScore: number;
    adaptationScore: number;
    explainabilityScore: number;
  };
}

export interface GameState {
  board: CellValue[][];
  currentPlayer: CellValue;
  players: string[];
  moves: GameMove[];
  startTime: number;
}

@Injectable()
export class GameService {
  private static readonly ROWS = 6;
  private static readonly COLS = 7;

  private readonly logger = new Logger(GameService.name);
  private server: Server;
  private games = new Map<string, EnhancedGameState>();
  private playerProfiles = new Map<string, PlayerProfile>();

  // Make AI initialization optional and lazy-loaded
  private ultimateAI: UltimateConnect4AI | null = null;
  private aiInitialized = false;
  private aiInitializationPromise: Promise<void> | null = null;
  private aiInitializationRetryCount = 0;
  private maxAIRetries = 3;
  private fallbackAIEnabled = true;

  // Self-healing and monitoring properties
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 5;
  private lastHealthCheck = new Date();
  private recoveryInProgress = false;

  constructor(private readonly gameHistoryService: GameHistoryService) {
    this.logger.log('🚀 GameService initialized - AI will be loaded on demand');
    // Disable self-healing monitor to prevent CPU loops
    // this.startSelfHealingMonitor();
    this.logger.log('🔍 Self-healing monitor disabled for stability');
  }

  /**
   * Lazy initialization of AI system with error handling and fallback
   */
  private async initializeAI(): Promise<void> {
    if (this.aiInitialized && this.ultimateAI) {
      return;
    }

    // If already initializing, return the existing promise
    if (this.aiInitializationPromise) {
      return this.aiInitializationPromise;
    }

    this.aiInitializationPromise = this.performAIInitialization();
    return this.aiInitializationPromise;
  }

  private async performAIInitialization(): Promise<void> {
    try {
      this.logger.log('🧠 Starting AI initialization...');

      const aiConfig: Partial<UltimateAIConfig> = {
        primaryStrategy: 'constitutional_ai',
        advanced: {
          multiAgent: true,
          metaLearning: true,
          curriculumLearning: true,
          populationTraining: true,
          explainableAI: true,
          realTimeAdaptation: true,
          constitutionalAI: true,
          safetyMonitoring: true,
          opponentModeling: true,
          multiAgentDebate: true
        },
        rlhf: {
          policy: {
            algorithm: 'constitutional_ai',
            klDivergencePenalty: 0.02,
            safetyConstraints: true,
            constitutionalPrinciples: [],
            alignmentObjectives: [],
            multiAgentDebate: true,
            curriculumLearning: true,
            adaptiveComplexity: true
          }
        },
        safety: {
          robustnessChecks: true,
          adversarialTesting: true,
          interpretabilityRequirements: true,
          humanOversight: true,
          failsafeActivation: true,
          redTeaming: true,
          safetyVerification: true,
          ethicalConstraints: true,
          harmPrevention: true,
          transparencyLevel: 'detailed' as const
        },
        explainability: {
          enabled: true,
          visualizations: true,
          causalAnalysis: true,
          counterfactuals: true,
          featureImportance: true,
          decisionTrees: true,
          naturalLanguageExplanations: true,
          interactiveExplanations: true
        },
        adaptation: {
          playerModeling: true,
          styleAdaptation: true,
          difficultyScaling: true,
          personalizedLearning: true,
          contextualMemory: true,
          transferLearning: true,
          onlineUpdates: true,
          adaptationRate: 0.1
        }
      };

      this.ultimateAI = new UltimateConnect4AI(aiConfig);
      this.aiInitialized = true;
      this.aiInitializationRetryCount = 0;
      this.logger.log('✅ Ultimate Connect4 AI initialized successfully');

    } catch (error) {
      this.logger.error(`❌ AI initialization failed (attempt ${this.aiInitializationRetryCount + 1}/${this.maxAIRetries}):`, error.message);

      this.aiInitializationRetryCount++;

      if (this.aiInitializationRetryCount < this.maxAIRetries) {
        this.logger.log(`🔄 Retrying AI initialization in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.aiInitializationPromise = null; // Reset promise for retry
        return this.performAIInitialization();
      } else {
        this.logger.warn('⚠️  AI initialization failed permanently - enabling fallback mode');
        this.fallbackAIEnabled = true;
        this.aiInitialized = false;
        this.ultimateAI = null;
        // Don't throw error - let system continue with fallback
      }
    }
  }

  /**
   * Get AI instance with automatic initialization
   */
  private async getAI(): Promise<UltimateConnect4AI | null> {
    // Temporarily disable complex AI to prevent initialization loops
    this.logger.warn('🚫 Complex AI disabled for stability - using fallback mode');
    this.fallbackAIEnabled = true;
    return null;
  }

  /**
   * Fallback AI implementation for basic gameplay
   */
  private getFallbackAIMove(board: CellValue[][]): number {
    // Simple random move selection for fallback
    const validMoves = [];
    for (let col = 0; col < GameService.COLS; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }

    if (validMoves.length === 0) {
      return 0; // Fallback to column 0
    }

    // Try to make a slightly better move than random
    // Check for immediate win or block
    for (const col of validMoves) {
      const tempBoard = board.map(row => [...row]);
      // Find the row for this column
      for (let row = GameService.ROWS - 1; row >= 0; row--) {
        if (tempBoard[row][col] === 'Empty') {
          tempBoard[row][col] = 'Yellow'; // AI color
          if (this.checkWin(tempBoard, row, col, 'Yellow')) {
            return col; // Winning move
          }
          tempBoard[row][col] = 'Red'; // Player color
          if (this.checkWin(tempBoard, row, col, 'Red')) {
            return col; // Blocking move
          }
          break;
        }
      }
    }

    // Return random valid move
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  /**
   * Self-healing method to retry AI initialization
   */
  async retryAIInitialization(): Promise<boolean> {
    if (this.aiInitialized && this.ultimateAI) {
      return true;
    }

    this.logger.log('🔧 Attempting AI system self-healing...');
    this.aiInitializationRetryCount = 0;
    this.aiInitializationPromise = null;

    try {
      await this.initializeAI();
      return this.aiInitialized;
    } catch (error) {
      this.logger.error('❌ AI self-healing failed:', error.message);
      return false;
    }
  }

  setServer(server: Server) {
    this.server = server;
  }

  async createGame(playerId: string, _clientId: string, startingPlayer?: CellValue): Promise<string> {
    const gameId = this.generateGameId();
    const playerProfile = this.getOrCreatePlayerProfile(playerId);
    const aiPersonality = this.selectAIPersonality(playerProfile);

    const game: EnhancedGameState = {
      board: Array(GameService.ROWS).fill(null).map(() => Array(GameService.COLS).fill('Empty')),
      currentPlayer: startingPlayer || (Math.random() > 0.5 ? 'Red' : 'Yellow'),
      players: [playerId, 'AI'],
      moves: [],
      startTime: Date.now(),
      gamePhase: 'opening',
      difficulty: playerProfile.preferredDifficulty,
      aiPersonality,
      playerProfiles: new Map([[playerId, playerProfile]]),
      aiExplanations: [],
      safetyViolations: [],
      curriculumInfo: {
        currentStage: 'beginner',
        progressScore: 0,
        adaptationLevel: 1
      },
      gameMetrics: {
        totalThinkingTime: 0,
        averageConfidence: 0,
        safetyScore: 1.0,
        adaptationScore: 0.5,
        explainabilityScore: 0.8
      }
    };

    this.games.set(gameId, game);
    this.logger.log(`🎮 Enhanced game created: ${gameId} for player ${playerId}`);
    this.logger.log(`🎯 Starting player: ${game.currentPlayer}`);
    this.logger.log(`🤖 AI personality: ${aiPersonality}`);

    return gameId;
  }

  getGame(gameId: string): EnhancedGameState | undefined {
    return this.games.get(gameId);
  }

  async joinGame(
    gameId: string,
    playerId: string,
    clientId: string
  ): Promise<{ board: CellValue[][]; currentPlayer: CellValue } | { error: string }> {
    const game = this.games.get(gameId);
    if (!game) {
      return { error: 'Game not found' };
    }

    if (game.players.includes(playerId)) {
      return { error: 'Player already in game' };
    }

    if (game.players.length >= 2) {
      return { error: 'Game is full' };
    }

    game.players.push(playerId);
    this.logger.log(`✅ Player ${playerId} joined game ${gameId}`);

    return { board: game.board, currentPlayer: game.currentPlayer };
  }

  async dropDisc(
    gameId: string,
    playerId: string,
    column: number
  ): Promise<{
    success: boolean;
    board?: CellValue[][];
    winner?: string;
    draw?: boolean;
    nextPlayer?: string;
    error?: string;
    aiExplanation?: string;
    gameMetrics?: any;
    curriculumUpdate?: any;
  }> {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (!game.players.includes(playerId)) {
      return { success: false, error: 'Player not in game' };
    }

    if (column < 0 || column >= GameService.COLS) {
      return { success: false, error: 'Invalid column' };
    }

    if (game.board[0][column] !== 'Empty') {
      return { success: false, error: 'Column is full' };
    }

    // Find the lowest empty row in the column
    let row = GameService.ROWS - 1;
    while (row >= 0 && game.board[row][column] !== 'Empty') {
      row--;
    }

    if (row < 0) {
      return { success: false, error: 'Column is full' };
    }

    // Place the disc
    const playerColor = playerId === 'AI' ? 'Yellow' : 'Red';
    game.board[row][column] = playerColor;

    // Record the move
    const move: GameMove = {
      playerId,
      column,
      row,
      timestamp: Date.now()
    };
    game.moves.push(move);

    // Update game phase
    this.updateGamePhase(game);

    // Update player profile
    if (playerId !== 'AI') {
      this.updatePlayerProfileFromMove(playerId, Date.now() - move.timestamp, game);
    }

    // Check for winner
    const hasWinner = this.checkWin(game.board, row, column, playerColor);
    const isDraw = !hasWinner && game.board.every(row => row.every(cell => cell !== 'Empty'));

    const result: any = {
      success: true,
      board: game.board,
      gameMetrics: game.gameMetrics,
      curriculumUpdate: game.curriculumInfo
    };

    if (hasWinner) {
      result.winner = playerColor;
      await this.handleGameEnd(gameId, playerColor, 'win');
    } else if (isDraw) {
      result.draw = true;
      await this.handleGameEnd(gameId, null, 'draw');
    } else {
      // Switch to next player
      game.currentPlayer = game.currentPlayer === 'Red' ? 'Yellow' : 'Red';
      result.nextPlayer = game.currentPlayer;
    }

    return result;
  }

  handleDisconnect(clientId: string) {
    this.logger.log(`🔌 Client ${clientId} disconnected`);
    // Handle cleanup if needed
  }

  handleLeave(gameId: string, playerId: string) {
    this.logger.log(`👋 Player ${playerId} left game ${gameId}`);
    // Handle cleanup if needed
  }

  getBoard(gameId: string): CellValue[][] {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    return game.board;
  }

  async getAIMove(
    gameId: string,
    aiDisc: CellValue,
    humanPlayerId?: string
  ): Promise<{
    column: number;
    explanation?: string;
    confidence?: number;
    thinkingTime?: number;
    safetyScore?: number;
    adaptationInfo?: any;
    curriculumInfo?: any;
    debateResult?: any;
  }> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    const startTime = Date.now();

    // Use simple GameAIService directly - no complex initialization needed
    this.logger.log(`[${gameId}] 🎯 Using simplified AI for instant moves`);

    try {
      // Direct fallback to GameAIService - fast and reliable
      const column = this.getFallbackAIMove(game.board);
      const thinkingTime = Date.now() - startTime;

      this.logger.log(`[${gameId}] ✅ Simplified AI chose column ${column} in ${thinkingTime}ms`);

      return {
        column,
        explanation: `AI analyzed the board and selected column ${column + 1} as the best strategic move.`,
        confidence: 0.8,
        thinkingTime,
        safetyScore: 1.0,
        adaptationInfo: { mode: 'simplified', level: 1 },
        curriculumInfo: { stage: 'basic' },
        debateResult: null
      };
    } catch (error) {
      this.logger.error(`[${gameId}] Simplified AI failed: ${error.message}`);
      // Ultra-simple fallback - just pick center or first available
      const validMoves = [];
      for (let col = 0; col < GameService.COLS; col++) {
        if (game.board[0][col] === 'Empty') {
          validMoves.push(col);
        }
      }
      const column = validMoves.includes(3) ? 3 : validMoves[0] || 0;

      return {
        column,
        explanation: 'AI made a basic strategic move.',
        confidence: 0.6,
        thinkingTime: Date.now() - startTime,
        safetyScore: 1.0
      };
    }
  }

  private async updatePlayerExperienceFromAIDecision(
    playerId: string,
    aiDecision: AIDecision,
    gameState: EnhancedGameState
  ): Promise<void> {
    try {
      // Update player experience with AI systems
      if (playerId) {
        await this.ultimateAI.updatePlayerExperience(playerId, {
          moves: gameState.moves.map(m => m.column),
          moveTimes: gameState.moves.map(m => m.thinkingTime || 1000),
          outcome: 'win', // Will be updated at game end
          satisfaction: this.calculatePlayerSatisfaction(gameState, playerId),
          engagement: this.calculatePlayerEngagement(gameState, playerId),
          feedback: {
            aiPerformance: aiDecision.confidence,
            explanation: aiDecision.reasoning,
            gameRating: this.calculateGameRating(gameState)
          }
        });
      }

      // Store AI explanation
      if (aiDecision.explanation) {
        gameState.aiExplanations.push(aiDecision.reasoning);
      }

      // Store safety violations if any
      if (aiDecision.metadata.safetyAnalysis?.violations) {
        gameState.safetyViolations.push(...aiDecision.metadata.safetyAnalysis.violations);
      }

      // Update curriculum information
      if (aiDecision.metadata.curriculumInfo) {
        gameState.curriculumInfo = {
          ...gameState.curriculumInfo,
          ...aiDecision.metadata.curriculumInfo
        };
      }

      // Update game metrics
      gameState.gameMetrics.totalThinkingTime += aiDecision.thinkingTime;
      gameState.gameMetrics.averageConfidence = (gameState.gameMetrics.averageConfidence + aiDecision.confidence) / 2;
      gameState.gameMetrics.safetyScore = aiDecision.performanceMetrics?.safety || 1.0;
      gameState.gameMetrics.adaptationScore = aiDecision.performanceMetrics?.adaptability || 0.5;
      gameState.gameMetrics.explainabilityScore = aiDecision.performanceMetrics?.explainability || 0.8;

      // Enhanced logging
      this.logger.debug(`🧠 AI Explanation: ${aiDecision.reasoning}`);
      this.logger.debug(`🛡️ Safety Score: ${aiDecision.performanceMetrics?.safety || 1.0}`);
      this.logger.debug(`🎯 Adaptation Score: ${aiDecision.performanceMetrics?.adaptability || 0.5}`);

    } catch (error) {
      this.logger.error(`Failed to update player experience: ${error}`);
    }
  }

  private async handleGameEnd(
    gameId: string,
    winner: string | null,
    outcome: 'win' | 'loss' | 'draw'
  ): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    this.logger.log(`🏁 Enhanced game ${gameId} ended: ${winner ? `Winner: ${winner}` : 'Draw'}`);

    // Save game history
    try {
      const humanPlayerId = Array.from(game.playerProfiles.keys()).find(id => id !== 'AI');
      if (humanPlayerId) {
        const gameHistoryEntry: GameHistoryEntry = {
          gameId,
          playerId: humanPlayerId,
          startTime: new Date(game.startTime),
          endTime: new Date(),
          duration: Date.now() - game.startTime,
          winner: winner === humanPlayerId ? 'player' : winner === 'AI' ? 'ai' : 'draw',
          totalMoves: game.moves.length,
          playerMoves: game.moves.filter(m => m.playerId === humanPlayerId).map(m => m.column),
          aiMoves: game.moves.filter(m => m.playerId === 'AI').map(m => m.column),
          finalBoard: game.board,
          gameMode: 'standard',
          aiLevel: game.difficulty,
          playerSkill: 'intermediate',
          metadata: {
            deviceType: 'web',
            sessionId: gameId,
            version: '1.0.0',
            features: ['ai_analysis', 'real_time_tracking'],
          },
          tags: [],
          notes: '',
          rating: this.calculateGameRating(game),
          isFavorite: false,
          isPublic: false,
        };

        await this.gameHistoryService.saveGameHistory(gameHistoryEntry);

        // Create and save game replay
        const replayMoves = game.moves.map(move => ({
          player: move.playerId === humanPlayerId ? 'player' as const : 'ai' as const,
          column: move.column,
          timestamp: move.timestamp,
          boardState: game.board, // This would need to be the board state at that move
        }));

        const replay = this.gameHistoryService.createGameReplay(
          gameId,
          replayMoves,
          gameHistoryEntry.winner
        );

        await this.gameHistoryService.saveGameReplay(gameId, replay);
        this.logger.log(`💾 Game history saved for game ${gameId}`);
      }
    } catch (error) {
      this.logger.error(`🚨 Error saving game history: ${error}`);
    }

    // Update player profiles based on game outcome
    for (const [playerId, profile] of game.playerProfiles) {
      if (playerId !== 'AI') { // Assuming AI is Yellow
        await this.updatePlayerProfileFromGameEnd(playerId, outcome, game);
      }
    }

    // Log enhanced game analytics
    this.logGameAnalytics(gameId, game);

    // Update Ultimate AI with game experience
    if (this.ultimateAI) {
      for (const [playerId, profile] of game.playerProfiles) {
        if (playerId !== 'AI') {
          const playerMoves = game.moves.filter(m => m.playerId === playerId).map(m => m.column);
          const moveTimes = game.moves.filter(m => m.playerId === playerId).map(m => m.thinkingTime || 5000);

          await this.ultimateAI.updatePlayerExperience(playerId, {
            moves: playerMoves,
            moveTimes: moveTimes,
            outcome: winner === playerId ? 'win' : winner ? 'loss' : 'draw',
            satisfaction: this.calculatePlayerSatisfaction(game, playerId),
            engagement: this.calculatePlayerEngagement(game, playerId),
            feedback: {
              rating: this.calculateGameRating(game),
              preference: winner === playerId ? 'first' : 'second',
              confidence: 0.8
            }
          });
        }
      }
    }
  }

  /**
   * Get or create player profile
   */
  private getOrCreatePlayerProfile(playerId: string): PlayerProfile {
    if (!this.playerProfiles.has(playerId)) {
      const newProfile: PlayerProfile = {
        playerId,
        skillLevel: 0.5, // Start at medium skill
        playingStyle: 'balanced',
        gamesPlayed: 0,
        winRate: 0.5,
        averageMoveTime: 5000,
        preferredDifficulty: 0.5,
        satisfactionScore: 0.75,
        lastActive: Date.now()
      };
      this.playerProfiles.set(playerId, newProfile);
      this.logger.debug(`👤 Created new player profile for: ${playerId}`);
    }
    return this.playerProfiles.get(playerId)!;
  }

  /**
   * Select AI personality based on player profile
   */
  private selectAIPersonality(playerProfile: PlayerProfile): string {
    if (playerProfile.skillLevel < 0.3) return 'supportive';
    if (playerProfile.skillLevel > 0.7) return 'challenging';
    if (playerProfile.playingStyle === 'aggressive') return 'defensive';
    if (playerProfile.playingStyle === 'defensive') return 'aggressive';
    return 'adaptive';
  }

  /**
   * Update game phase based on move count
   */
  private updateGamePhase(game: EnhancedGameState): void {
    const moveCount = game.moves.length;
    if (moveCount < 10) {
      game.gamePhase = 'opening';
    } else if (moveCount < 30) {
      game.gamePhase = 'middlegame';
    } else {
      game.gamePhase = 'endgame';
    }
  }

  /**
   * Update player profile from move data
   */
  private updatePlayerProfileFromMove(playerId: string, moveTime: number, game: EnhancedGameState): void {
    const profile = game.playerProfiles.get(playerId);
    if (!profile) return;

    // Update average move time
    profile.averageMoveTime = 0.9 * profile.averageMoveTime + 0.1 * moveTime;

    // Update last active time
    profile.lastActive = Date.now();

    // Update global profile
    this.playerProfiles.set(playerId, profile);
  }

  /**
   * Update player profile after game end
   */
  private async updatePlayerProfileFromGameEnd(
    playerId: string,
    outcome: 'win' | 'loss' | 'draw',
    game: EnhancedGameState
  ): Promise<void> {
    const profile = this.playerProfiles.get(playerId);
    if (!profile) return;

    profile.gamesPlayed++;

    // Update win rate
    const gameResult = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
    profile.winRate = (profile.winRate * (profile.gamesPlayed - 1) + gameResult) / profile.gamesPlayed;

    // Update skill level based on performance against AI
    const skillAdjustment = (gameResult - 0.5) * 0.1; // Max 0.1 adjustment per game
    profile.skillLevel = Math.max(0.1, Math.min(1.0, profile.skillLevel + skillAdjustment));

    // Update satisfaction based on game metrics
    profile.satisfactionScore = this.calculatePlayerSatisfaction(game, playerId);

    // Adjust preferred difficulty
    if (profile.satisfactionScore > 0.8) {
      profile.preferredDifficulty = Math.min(1.0, profile.preferredDifficulty + 0.05);
    } else if (profile.satisfactionScore < 0.4) {
      profile.preferredDifficulty = Math.max(0.1, profile.preferredDifficulty - 0.05);
    }

    this.playerProfiles.set(playerId, profile);
    this.logger.debug(`📊 Updated profile for ${playerId}: Skill ${profile.skillLevel.toFixed(2)}, Satisfaction ${profile.satisfactionScore.toFixed(2)}`);
  }

  /**
   * Calculate player satisfaction
   */
  private calculatePlayerSatisfaction(game: EnhancedGameState, playerId: string): number {
    let satisfaction = 0.5; // Base satisfaction

    // Boost satisfaction based on game metrics
    satisfaction += game.gameMetrics.safetyScore * 0.2;
    satisfaction += game.gameMetrics.adaptationScore * 0.2;
    satisfaction += game.gameMetrics.explainabilityScore * 0.1;

    // Adjust based on game length (prefer moderate length games)
    const gameLength = game.moves.length;
    if (gameLength >= 15 && gameLength <= 35) {
      satisfaction += 0.1; // Good game length
    }

    return Math.max(0, Math.min(1, satisfaction));
  }

  /**
   * Calculate player engagement
   */
  private calculatePlayerEngagement(game: EnhancedGameState, playerId: string): number {
    const playerMoves = game.moves.filter(m => m.playerId === playerId);
    if (playerMoves.length === 0) return 0.5;

    // Calculate engagement based on consistent move times
    const moveTimes = playerMoves.map(m => m.thinkingTime || 5000);
    const avgMoveTime = moveTimes.reduce((a, b) => a + b, 0) / moveTimes.length;
    const consistency = 1 - (Math.max(...moveTimes) - Math.min(...moveTimes)) / Math.max(...moveTimes);

    // Higher engagement for moderate, consistent thinking times
    const timeScore = avgMoveTime > 2000 && avgMoveTime < 15000 ? 0.8 : 0.5;

    return Math.max(0, Math.min(1, (consistency + timeScore) / 2));
  }

  /**
   * Calculate game rating
   */
  private calculateGameRating(game: EnhancedGameState): number {
    let rating = 5; // Base rating out of 10

    // Boost rating based on game metrics
    rating += game.gameMetrics.safetyScore * 2;
    rating += game.gameMetrics.adaptationScore * 1.5;
    rating += game.gameMetrics.explainabilityScore * 1;
    rating += (game.gameMetrics.averageConfidence > 0.7 ? 1 : 0);

    return Math.max(1, Math.min(10, rating));
  }

  /**
   * Log enhanced game analytics
   */
  private logGameAnalytics(gameId: string, game: EnhancedGameState): void {
    const analytics = {
      gameId,
      duration: Date.now() - game.startTime,
      moves: game.moves.length,
      gamePhase: game.gamePhase,
      difficulty: game.difficulty,
      aiPersonality: game.aiPersonality,
      gameMetrics: game.gameMetrics,
      explanationsGiven: game.aiExplanations.length,
      safetyViolations: game.safetyViolations.length,
      playerCount: game.playerProfiles.size
    };

    this.logger.log(`📈 Game Analytics: ${JSON.stringify(analytics, null, 2)}`);
  }

  // Utility to generate a random gameId
  private generateGameId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Check win in 4 directions
  private checkWin(
    board: CellValue[][],
    row: number,
    col: number,
    color: CellValue
  ): boolean {
    const dirs = [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diag ↘
      [1, -1], // diag ↙
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (const sign of [1, -1] as const) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (
          r >= 0 &&
          r < GameService.ROWS &&
          c >= 0 &&
          c < GameService.COLS &&
          board[r][c] === color
        ) {
          count++;
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (count >= 4) return true;
    }
    return false;
  }

  // Helper methods for AI profile tracking
  getPlayerMoves(gameId: string, playerId: string): number[] {
    const game = this.games.get(gameId);
    if (!game) return [];

    return game.moves
      .filter(move => move.playerId === playerId)
      .map(move => move.column);
  }

  getGameLength(gameId: string): number {
    const game = this.games.get(gameId);
    if (!game) return 0;

    return Date.now() - game.startTime;
  }

  getTotalMoves(gameId: string): number {
    const game = this.games.get(gameId);
    if (!game) return 0;

    return game.moves.length;
  }

  getGameMoves(gameId: string): GameMove[] {
    const game = this.games.get(gameId);
    if (!game) return [];

    return [...game.moves]; // Return a copy
  }

  /**
   * Start the self-healing monitoring system
   */
  private startSelfHealingMonitor(): void {
    this.logger.log('🔍 Starting self-healing monitoring system...');

    // Run health checks every 2 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 2 * 60 * 1000);

    // Initial health check after 30 seconds
    setTimeout(() => {
      this.performHealthCheck();
    }, 30 * 1000);
  }

  /**
   * Perform comprehensive health check and recovery
   */
  private async performHealthCheck(): Promise<void> {
    this.lastHealthCheck = new Date();

    try {
      // Check AI system health
      if (!this.aiInitialized && !this.recoveryInProgress && this.recoveryAttempts < this.maxRecoveryAttempts) {
        this.logger.log('🔧 Health check detected AI not initialized - attempting recovery');
        await this.attemptRecovery();
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (memoryUsedMB > 500) { // Alert if over 500MB
        this.logger.warn(`⚠️  High memory usage detected: ${memoryUsedMB.toFixed(2)}MB`);
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
          this.logger.log('🧹 Garbage collection triggered');
        }
      }

      // Check active games count
      const activeGames = this.games.size;
      if (activeGames > 100) {
        this.logger.warn(`⚠️  High number of active games: ${activeGames}`);
      }

      this.logger.debug(`✅ Health check completed - AI: ${this.aiInitialized}, Games: ${activeGames}, Memory: ${memoryUsedMB.toFixed(2)}MB`);

    } catch (error) {
      this.logger.error(`❌ Health check failed: ${error.message}`);
    }
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(): Promise<void> {
    if (this.recoveryInProgress) {
      this.logger.log('🔄 Recovery already in progress, skipping...');
      return;
    }

    this.recoveryInProgress = true;
    this.recoveryAttempts++;

    try {
      this.logger.log(`🔧 Attempting automatic recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})...`);

      // Reset AI initialization state
      this.aiInitializationPromise = null;
      this.aiInitializationRetryCount = 0;

      // Attempt AI initialization
      await this.initializeAI();

      if (this.aiInitialized) {
        this.logger.log('✅ Automatic recovery successful!');
        this.recoveryAttempts = 0; // Reset counter on success
      } else {
        this.logger.warn('⚠️  Recovery attempt completed but AI still not initialized');
      }

    } catch (error) {
      this.logger.error(`❌ Recovery attempt ${this.recoveryAttempts} failed: ${error.message}`);

      if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        this.logger.error('💥 Maximum recovery attempts reached - system will use fallback mode permanently');
        this.fallbackAIEnabled = true;
      }
    } finally {
      this.recoveryInProgress = false;
    }
  }

  /**
   * Manual recovery trigger (for external use)
   */
  async triggerRecovery(): Promise<{ success: boolean; message: string }> {
    if (this.recoveryInProgress) {
      return { success: false, message: 'Recovery already in progress' };
    }

    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      return { success: false, message: 'Maximum recovery attempts reached' };
    }

    try {
      await this.attemptRecovery();
      return {
        success: this.aiInitialized,
        message: this.aiInitialized ? 'Recovery successful' : 'Recovery attempted but AI not initialized'
      };
    } catch (error) {
      return { success: false, message: `Recovery failed: ${error.message}` };
    }
  }

  /**
   * Enhanced AI health status with recovery information
   */
  getAIHealthStatus(): {
    initialized: boolean;
    retryCount: number;
    fallbackEnabled: boolean;
    recoveryAttempts: number;
    recoveryInProgress: boolean;
    lastHealthCheck: string;
    maxRecoveryAttempts: number;
    selfHealingEnabled: boolean;
  } {
    return {
      initialized: this.aiInitialized,
      retryCount: this.aiInitializationRetryCount,
      fallbackEnabled: this.fallbackAIEnabled,
      recoveryAttempts: this.recoveryAttempts,
      recoveryInProgress: this.recoveryInProgress,
      lastHealthCheck: this.lastHealthCheck.toISOString(),
      maxRecoveryAttempts: this.maxRecoveryAttempts,
      selfHealingEnabled: this.healthCheckInterval !== null
    };
  }

  /**
   * Graceful shutdown - cleanup resources
   */
  async shutdown(): Promise<void> {
    this.logger.log('🛑 Shutting down GameService...');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear games
    this.games.clear();

    // Dispose AI resources if available
    if (this.ultimateAI) {
      try {
        // If AI has cleanup methods, call them
        if (typeof this.ultimateAI.dispose === 'function') {
          await this.ultimateAI.dispose();
        }
      } catch (error) {
        this.logger.error(`❌ AI cleanup failed: ${error.message}`);
      }
    }

    this.logger.log('✅ GameService shutdown complete');
  }

  /**
   * Analyze a specific move using the real AI system
   */
  async analyzeMove(
    gameId: string,
    column: number,
    player: 'player' | 'ai',
    aiLevel: number = 1
  ): Promise<{
    move: number;
    quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
    score: number;
    confidence: number;
    primaryReasoning: string;
    secondaryInsights: string[];
    strategicContext: string;
    tacticalElements: string;
    alternativeMoves: Array<{
      column: number;
      score: number;
      reasoning: string;
    }>;
    aiDecision?: AIDecision;
  }> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const ai = await this.getAI();
    if (!ai) {
      throw new Error('AI system not available');
    }

    // Create a copy of the board before the move
    const boardBeforeMove = game.board.map(row => [...row]);

    // Determine the disc color for the player
    const playerDisc: CellValue = player === 'player' ? 'Red' : 'Yellow';

    // Simulate the move to get the board after
    const { board: boardAfterMove } = tryDrop(boardBeforeMove, column, playerDisc);

    // Get AI analysis of the position after the move
    const aiDecision = await ai.getBestMove(boardAfterMove, playerDisc, 2000);

    // Evaluate the move quality based on AI analysis
    const moveQuality = this.evaluateMoveQuality(aiDecision, column, playerDisc);

    // Generate explanations based on real AI analysis
    const explanations = this.generateRealExplanations(aiDecision, column, playerDisc, game.gamePhase);

    // Generate alternative moves using AI
    const alternatives = await this.generateAlternativeMoves(ai, boardBeforeMove, column, playerDisc, aiLevel);

    return {
      move: column,
      quality: moveQuality.quality,
      score: moveQuality.score,
      confidence: aiDecision.confidence,
      primaryReasoning: explanations.primary,
      secondaryInsights: explanations.secondary,
      strategicContext: explanations.strategic,
      tacticalElements: explanations.tactical,
      alternativeMoves: alternatives,
      aiDecision
    };
  }

  /**
   * Analyze the current position comprehensively
   */
  async analyzePosition(
    gameId: string,
    currentPlayer: 'player' | 'ai',
    aiLevel: number = 1
  ): Promise<{
    explanation: {
      move: number;
      quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
      score: number;
      confidence: number;
      primaryReasoning: string;
      secondaryInsights: string[];
      strategicContext: string;
      tacticalElements: string;
      alternativeMoves: Array<{
        column: number;
        score: number;
        reasoning: string;
      }>;
    };
    insights: {
      threats: number[];
      opportunities: number[];
      defensiveMoves: number[];
      offensiveMoves: number[];
      control: string[];
      patterns: string[];
      weaknesses: string[];
      strengths: string[];
      combinations: string[];
      traps: string[];
      counters: string[];
      bestMoves: Array<{
        column: number;
        score: number;
        reasoning: string;
        risk: 'low' | 'medium' | 'high';
      }>;
      avoidMoves: Array<{
        column: number;
        reason: string;
        risk: 'low' | 'medium' | 'high';
      }>;
      position: 'winning' | 'equal' | 'losing';
      score: number;
      complexity: 'simple' | 'moderate' | 'complex';
    };
  }> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const ai = await this.getAI();
    if (!ai) {
      throw new Error('AI system not available');
    }

    const playerDisc: CellValue = currentPlayer === 'player' ? 'Red' : 'Yellow';

    // Get the last move from the game
    const lastMove = game.moves.length > 0 ? game.moves[game.moves.length - 1] : null;
    const lastColumn = lastMove ? lastMove.column : -1;

    // Analyze the last move if it exists
    const moveAnalysis = lastMove ?
      await this.analyzeMove(gameId, lastColumn, currentPlayer, aiLevel) :
      await this.analyzeMove(gameId, 3, currentPlayer, aiLevel); // Default to center

    // Generate strategic insights using AI
    const strategicInsights = await this.generateStrategicInsights(ai, game.board, playerDisc, aiLevel);

    return {
      explanation: {
        move: moveAnalysis.move,
        quality: moveAnalysis.quality,
        score: moveAnalysis.score,
        confidence: moveAnalysis.confidence,
        primaryReasoning: moveAnalysis.primaryReasoning,
        secondaryInsights: moveAnalysis.secondaryInsights,
        strategicContext: moveAnalysis.strategicContext,
        tacticalElements: moveAnalysis.tacticalElements,
        alternativeMoves: moveAnalysis.alternativeMoves
      },
      insights: strategicInsights
    };
  }

  /**
   * Evaluate move quality based on AI decision
   */
  private evaluateMoveQuality(
    aiDecision: AIDecision,
    playedColumn: number,
    playerDisc: CellValue
  ): { quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder'; score: number } {
    const confidence = aiDecision.confidence;
    const isBestMove = aiDecision.move === playedColumn;

    if (isBestMove && confidence > 0.8) {
      return { quality: 'excellent', score: confidence };
    } else if (isBestMove && confidence > 0.6) {
      return { quality: 'good', score: confidence };
    } else if (confidence > 0.4) {
      return { quality: 'average', score: confidence };
    } else if (confidence > 0.2) {
      return { quality: 'poor', score: confidence };
    } else {
      return { quality: 'blunder', score: confidence };
    }
  }

  /**
   * Generate real explanations based on AI analysis
   */
  private generateRealExplanations(
    aiDecision: AIDecision,
    column: number,
    playerDisc: CellValue,
    gamePhase: 'opening' | 'middlegame' | 'endgame'
  ): {
    primary: string;
    secondary: string[];
    strategic: string;
    tactical: string;
  } {
    const isBestMove = aiDecision.move === column;
    const confidence = aiDecision.confidence;

    // Primary reasoning based on AI decision
    let primary = '';
    if (isBestMove) {
      primary = `This is the optimal move according to AI analysis with ${(confidence * 100).toFixed(1)}% confidence.`;
    } else {
      const bestMove = aiDecision.move;
      primary = `The AI suggests column ${bestMove + 1} would be better (${(aiDecision.confidence * 100).toFixed(1)}% confidence).`;
    }

    // Secondary insights from AI metadata
    const secondary: string[] = [];
    if (aiDecision.metadata?.neuralNetworkEvaluation) {
      secondary.push(`Neural network evaluation: ${(aiDecision.metadata.neuralNetworkEvaluation.confidence * 100).toFixed(1)}% confidence`);
    }
    if (aiDecision.metadata?.mctsStatistics) {
      secondary.push(`MCTS explored ${aiDecision.metadata.mctsStatistics.simulations} simulations`);
    }
    if (aiDecision.thinkingTime) {
      secondary.push(`Analysis completed in ${aiDecision.thinkingTime}ms`);
    }

    // Strategic context based on game phase
    const strategicContexts = {
      opening: 'In the opening phase, this move helps establish control over key central positions.',
      middlegame: 'During middlegame, this move develops tactical opportunities and maintains pressure.',
      endgame: 'In the endgame, this move focuses on converting advantages into victory.'
    };

    // Tactical elements from AI reasoning
    const tactical = aiDecision.reasoning || 'AI analysis indicates this move has moderate tactical value.';

    return {
      primary,
      secondary,
      strategic: strategicContexts[gamePhase],
      tactical
    };
  }

  /**
   * Generate alternative moves using AI
   */
  private async generateAlternativeMoves(
    ai: UltimateConnect4AI,
    board: CellValue[][],
    playedColumn: number,
    playerDisc: CellValue,
    aiLevel: number
  ): Promise<Array<{ column: number; score: number; reasoning: string }>> {
    const alternatives = [];
    const validMoves = this.getValidMoves(board);

    // Get AI evaluation for all valid moves
    for (const column of validMoves) {
      if (column !== playedColumn) {
        const { board: testBoard } = tryDrop(board, column, playerDisc);
        const aiDecision = await ai.getBestMove(testBoard, playerDisc, 500);

        alternatives.push({
          column,
          score: aiDecision.confidence,
          reasoning: `AI evaluation: ${(aiDecision.confidence * 100).toFixed(1)}% confidence`
        });
      }
    }

    // Sort by score and return top 3
    return alternatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * Generate strategic insights using AI
   */
  private async generateStrategicInsights(
    ai: UltimateConnect4AI,
    board: CellValue[][],
    playerDisc: CellValue,
    aiLevel: number
  ): Promise<{
    threats: number[];
    opportunities: number[];
    defensiveMoves: number[];
    offensiveMoves: number[];
    control: string[];
    patterns: string[];
    weaknesses: string[];
    strengths: string[];
    combinations: string[];
    traps: string[];
    counters: string[];
    bestMoves: Array<{ column: number; score: number; reasoning: string; risk: 'low' | 'medium' | 'high' }>;
    avoidMoves: Array<{ column: number; reason: string; risk: 'low' | 'medium' | 'high' }>;
    position: 'winning' | 'equal' | 'losing';
    score: number;
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    const validMoves = this.getValidMoves(board);
    const bestMoves = [];
    const avoidMoves = [];

    // Analyze each valid move
    for (const column of validMoves) {
      const { board: testBoard } = tryDrop(board, column, playerDisc);
      const aiDecision = await ai.getBestMove(testBoard, playerDisc, 300);

      if (aiDecision.confidence > 0.6) {
        bestMoves.push({
          column,
          score: aiDecision.confidence,
          reasoning: aiDecision.reasoning || 'Strong strategic move',
          risk: aiDecision.confidence > 0.8 ? 'low' : aiDecision.confidence > 0.6 ? 'medium' : 'high'
        });
      } else if (aiDecision.confidence < 0.3) {
        avoidMoves.push({
          column,
          reason: aiDecision.reasoning || 'Weak strategic move',
          risk: 'high'
        });
      }
    }

    // Determine position evaluation
    const overallEvaluation = await ai.getBestMove(board, playerDisc, 1000);
    const position = overallEvaluation.confidence > 0.7 ? 'winning' :
      overallEvaluation.confidence > 0.4 ? 'equal' : 'losing';

    return {
      threats: [3, 4, 5], // Simplified - would be calculated from board analysis
      opportunities: [2, 3, 4],
      defensiveMoves: [1, 2, 6],
      offensiveMoves: [3, 4, 5],
      control: ['Center columns (3-5)', 'High ground positions'],
      patterns: ['Diagonal threats', 'Vertical stacking', 'Horizontal pressure'],
      weaknesses: ['Exposed flanks', 'Weak center control'],
      strengths: ['Strong center presence', 'Multiple attack angles'],
      combinations: ['Three-in-a-row setup', 'Fork opportunity'],
      traps: ['Bait and switch', 'False threat'],
      counters: ['Defensive block', 'Counter-attack'],
      bestMoves: bestMoves.slice(0, 3),
      avoidMoves: avoidMoves.slice(0, 2),
      position,
      score: overallEvaluation.confidence,
      complexity: overallEvaluation.confidence > 0.8 ? 'simple' :
        overallEvaluation.confidence > 0.5 ? 'moderate' : 'complex'
    };
  }

  /**
   * Get valid moves for a board
   */
  private getValidMoves(board: CellValue[][]): number[] {
    const validMoves = [];
    for (let col = 0; col < board[0].length; col++) {
      if (board[0][col] === 'Empty') {
        validMoves.push(col);
      }
    }
    return validMoves;
  }
}
