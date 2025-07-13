import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { getBestAIMove, UltimateConnect4AI, AIDecision, UltimateAIConfig } from '../ai/connect4AI';
import type { CellValue } from '../ai/connect4AI';
import { getAIMoveViaAPI } from '../services/ml_inference';

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

  // Enhanced AI System
  private ultimateAI: UltimateConnect4AI;

  constructor() {
    // Initialize the Ultimate AI with enhanced configuration
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
    this.logger.log('🚀 UltimateConnect4AI initialized with Enhanced Systems');
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
      throw new Error('Game not found');
    }

    this.logger.log(`🧠 Computing Enhanced AI move for game ${gameId}`);

    try {
      const startTime = Date.now();

      // Use the integrated UltimateConnect4AI
      const aiDecision = await this.ultimateAI.getBestMove(
        game.board,
        aiDisc,
        5000, // 5 second thinking time
        undefined, // ability config
        humanPlayerId,
        {
          gameId,
          gamePhase: game.gamePhase,
          difficulty: game.difficulty,
          playerProfile: humanPlayerId ? this.playerProfiles.get(humanPlayerId) : undefined,
          gameHistory: game.moves,
          curriculumInfo: game.curriculumInfo
        }
      );

      const thinkingTime = Date.now() - startTime;

      this.logger.log(`✅ Enhanced AI computed move ${aiDecision.move} in ${thinkingTime}ms`);
      this.logger.log(`🎯 Confidence: ${aiDecision.confidence}, Strategy: ${aiDecision.strategy}`);

      // Update game state with AI decision
      await this.updatePlayerExperienceFromAIDecision(humanPlayerId!, aiDecision, game);

      return {
        column: aiDecision.move,
        explanation: aiDecision.reasoning,
        confidence: aiDecision.confidence,
        thinkingTime,
        safetyScore: aiDecision.performanceMetrics?.safety || 1.0,
        adaptationInfo: aiDecision.metadata.adaptationAnalysis,
        curriculumInfo: aiDecision.metadata.curriculumInfo,
        debateResult: aiDecision.metadata.debateResult
      };
    } catch (error) {
      this.logger.error(`❌ Enhanced AI move failed: ${error}`);

      // Fallback to simple move selection
      const legalMoves = [];
      for (let col = 0; col < GameService.COLS; col++) {
        if (game.board[0][col] === 'Empty') {
          legalMoves.push(col);
        }
      }

      const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];

      return {
        column: fallbackMove,
        explanation: 'Fallback AI decision due to system error',
        confidence: 0.6,
        thinkingTime: 100,
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
}
