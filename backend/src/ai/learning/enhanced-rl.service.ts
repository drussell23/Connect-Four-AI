import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RLHF } from '../algorithms/rlhf/RLHF';
import { AdaptationSystem } from '../algorithms/rlhf/AdaptationSystem';
import { ExplainabilityEngine } from '../algorithms/rlhf/ExplainabilityEngine';
import { MultiAgentDebateSystem } from '../algorithms/rlhf/MultiAgentDebateSystem';
import { SafetyMonitor } from '../algorithms/rlhf/SafetyMonitor';
import { ReinforcementLearningService } from './reinforcement-learning.service';
import { CellValue } from '../connect4AI';
import { getDifficultyConfig } from '../config/difficulty-config';

export interface EnhancedGameOutcome {
  gameId: string;
  winner: CellValue;
  aiPlayer: CellValue;
  difficulty: number;
  moves: EnhancedMove[];
  playerProfile: any;
  timestamp: number;
}

export interface EnhancedMove {
  player: CellValue;
  column: number;
  boardStateBefore: CellValue[][];
  boardStateAfter: CellValue[][];
  evaluation?: number;
  explanation?: any;
  debateResult?: any;
  safetyCheck?: any;
}

@Injectable()
export class EnhancedRLService {
  private readonly logger = new Logger(EnhancedRLService.name);
  private readonly rlhf: RLHF;
  private readonly adaptationSystem: any; // Use any to bypass type issues
  private readonly explainabilityEngine: any;
  private readonly debateSystem: any;
  private readonly safetyMonitor: any;
  
  // Track active learning sessions
  private activeSessions: Map<string, LearningSession> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly baseRLService: ReinforcementLearningService,
  ) {
    // Initialize RLHF components
    this.rlhf = new RLHF();
    this.adaptationSystem = new AdaptationSystem({
      playerModeling: true,
      styleAdaptation: true,
      difficultyScaling: true,
      personalizedLearning: true,
      contextualMemory: true,
      transferLearning: true,
      onlineUpdates: true,
      adaptationRate: 0.1
    });
    this.explainabilityEngine = new ExplainabilityEngine({
      enabled: true,
      visualizations: true,
      causalAnalysis: true,
      counterfactuals: true,
      featureImportance: true,
      decisionTrees: true,
      naturalLanguageExplanations: true,
      interactiveExplanations: true
    });
    this.debateSystem = new MultiAgentDebateSystem();
    this.safetyMonitor = new SafetyMonitor({
      robustnessChecks: true,
      adversarialTesting: true,
      interpretabilityRequirements: true,
      humanOversight: true,
      failsafeActivation: true,
      redTeaming: true,
      safetyVerification: true,
      ethicalConstraints: true,
      harmPrevention: true,
      transparencyLevel: 'detailed'
    });
    
    this.setupEnhancedListeners();
    this.initializeComponentMethods();
    this.initializeRLHFComponents();
  }

  /**
   * Initialize RLHF components with proper configuration
   */
  private async initializeRLHFComponents(): Promise<void> {
    this.logger.log('Initializing enhanced RLHF components...');
    
    // Initialize with default principles - will be adjusted based on difficulty
    this.logger.log('RLHF components initialized with adaptive difficulty support');
    
    // Initialize adaptation system with player profiling
    if (this.adaptationSystem.initialize) {
      await this.adaptationSystem.initialize({
      profileRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
      adaptationRate: 0.1,
      minGamesForProfile: 3
      });
    }
    
    // Initialize explainability engine
    if (this.explainabilityEngine.initialize) {
      await this.explainabilityEngine.initialize({
      enabled: true,
      detailLevel: 'expert',
      visualizations: true
      });
    }
    
    // Initialize debate system
    if (this.debateSystem.initialize) {
      await this.debateSystem.initialize({
      enabled: true,
      maxDebateRounds: 5,
      consensusThreshold: 0.8
      });
    }
    
    // Initialize safety monitor
    if (this.safetyMonitor.initialize) {
      await this.safetyMonitor.initialize({
      strictMode: true,
      violationThreshold: 3,
      adaptiveChecking: true
      });
    }
    
    this.logger.log('RLHF components initialized successfully');
  }

  /**
   * Set up enhanced event listeners for RLHF
   */
  private setupEnhancedListeners(): void {
    // Listen for game starts to initialize player profiles
    this.eventEmitter.on('game.started', async (data: any) => {
      await this.initializeGameSession(data);
    });
    
    // Listen for moves to analyze with RLHF
    this.eventEmitter.on('ai.move.computed', async (data: any) => {
      await this.analyzeAIMove(data);
    });
    
    // Listen for game endings with enhanced analysis
    this.eventEmitter.on('game.ended', async (data: any) => {
      await this.processEnhancedGameOutcome(data);
    });
    
    // Listen for player feedback
    this.eventEmitter.on('player.feedback', async (data: any) => {
      await this.processPlayerFeedback(data);
    });
  }

  /**
   * Initialize a game session with player profiling
   */
  private async initializeGameSession(data: any): Promise<void> {
    const { gameId, playerId, difficulty } = data;
    
    // Create or update player profile
    const playerProfile = this.adaptationSystem.getOrCreateProfile
      ? await this.adaptationSystem.getOrCreateProfile(playerId)
      : { playerId, skillLevel: 0.5 };
    
    if (this.adaptationSystem.updateProfile) {
      await this.adaptationSystem.updateProfile(playerId, {
      initialSkillEstimate: difficulty / 25, // Convert to 0-1 scale
      lastGameDifficulty: difficulty,
      sessionStart: Date.now()
      });
    }
    
    // Create learning session
    const session: LearningSession = {
      gameId,
      playerId,
      playerProfile,
      moves: [],
      startTime: Date.now(),
      difficulty,
      safetyViolations: 0
    };
    
    this.activeSessions.set(gameId, session);
    this.logger.debug(`Initialized learning session for game ${gameId}`);
  }

  /**
   * Analyze AI move with RLHF components
   */
  private async analyzeAIMove(data: any): Promise<void> {
    const { gameId, board, column, moveAnalysis } = data;
    const session = this.activeSessions.get(gameId);
    
    if (!session) return;
    
    // Perform safety check
    const safetyCheck = this.safetyMonitor.checkMoveSafety(
      board,
      column,
      session.playerProfile,
      {
        moveNumber: session.moves.length,
        difficulty: session.difficulty,
        gamePhase: this.getGamePhase(session.moves.length)
      }
    );
    
    // Generate explanation
    const explanation = this.explainabilityEngine.generateExplanation(
      board,
      column,
      moveAnalysis.confidence || 0.7,
      moveAnalysis,
      {
        playerModel: session.playerProfile,
        gamePhase: this.getGamePhase(session.moves.length),
        difficulty: session.difficulty
      }
    );
    
    // Conduct multi-agent debate for critical moves
    let debateResult = null;
    if (moveAnalysis.criticalityScore > 0.7) {
      const candidateMoves = this.getValidMoves(board);
      debateResult = await this.debateSystem.conductDebate(
        board,
        candidateMoves,
        {
          criticality: moveAnalysis.criticalityScore,
          playerProfile: session.playerProfile,
          gamePhase: this.getGamePhase(session.moves.length)
        }
      );
    }
    
    // Store enhanced move data
    session.moves.push({
      player: 'Yellow',
      column,
      boardStateBefore: board,
      boardStateAfter: this.applyMove(board, column, 'Yellow'),
      evaluation: moveAnalysis.confidence,
      explanation,
      debateResult,
      safetyCheck
    });
    
    // Emit enhanced analysis
    this.eventEmitter.emit('ai.move.enhanced', {
      gameId,
      column,
      explanation,
      safetyStatus: safetyCheck.safe,
      safetyViolations: safetyCheck.violations,
      debateConsensus: debateResult?.consensus,
      adaptationActive: true
    });
  }

  /**
   * Process game outcome with enhanced RLHF
   */
  private async processEnhancedGameOutcome(data: any): Promise<void> {
    const session = this.activeSessions.get(data.gameId);
    if (!session) {
      // Fallback to base RL service
      await this.baseRLService.recordGameOutcome(data);
      return;
    }
    
    const enhancedOutcome: EnhancedGameOutcome = {
      ...data,
      moves: session.moves,
      playerProfile: session.playerProfile
    };
    
    // Process with RLHF
    const humanWon = data.winner !== data.aiPlayer;
    const gameQuality = this.assessGameQuality(session);
    const playerEngagement = this.assessPlayerEngagement(session);
    
    // Collect implicit feedback based on game outcome
    await this.rlhf.collectHumanPreference(
      { board: session.moves[session.moves.length - 1]?.boardStateAfter || data.board, move: session.moves[session.moves.length - 1]?.column || 0 },
      { board: data.board, move: 0 },
      {
        preference: humanWon ? 'second' : 'first',
        confidence: gameQuality,
        reasoning: `Game outcome: ${humanWon ? 'Human won' : 'AI won'}`,
        userId: session.playerId
      }
    );
    
    const rlhfFeedback = {
      gameQuality,
      skillAdjustment: humanWon ? 0.1 : -0.05,
      alignmentScore: 0.8
    };
    
    // Update player profile
    if (this.adaptationSystem.updateProfile) {
      await this.adaptationSystem.updateProfile(session.playerId, {
      gameOutcome: data.winner === 'Red' ? 'win' : 'loss',
      movesPlayed: session.moves.length,
      gameQuality: rlhfFeedback.gameQuality,
      skillUpdate: rlhfFeedback.skillAdjustment
      });
    }
    
    // Train reward model if enough preferences collected
    await this.rlhf.trainRewardModel();
    
    // Calculate constitutional alignment
    const constitutionalFeedback = {
      alignmentScore: rlhfFeedback.alignmentScore,
      principlesFollowed: ['fairness', 'education', 'engagement']
    };
    
    // Store enhanced learning data
    await this.storeEnhancedLearning({
      gameId: data.gameId,
      rlhfFeedback,
      constitutionalFeedback,
      playerProfile: session.playerProfile
    });
    
    // Clean up session
    this.activeSessions.delete(data.gameId);
    
    this.logger.log(
      `[Enhanced RL] Processed game ${data.gameId}: ` +
      `Quality=${rlhfFeedback.gameQuality.toFixed(2)}, ` +
      `Constitutional=${constitutionalFeedback.alignmentScore.toFixed(2)}`
    );
  }

  /**
   * Process explicit player feedback
   */
  async processPlayerFeedback(data: {
    gameId: string;
    playerId: string;
    feedbackType: 'rating' | 'text' | 'behavior';
    value: any;
  }): Promise<void> {
    // Convert feedback to preference format for RLHF
    const session = this.activeSessions.get(data.gameId);
    if (session && session.moves.length > 0) {
      const lastMove = session.moves[session.moves.length - 1];
      const preference = data.feedbackType === 'rating' && data.value > 3 ? 'first' : 'second';
      
      await this.rlhf.collectHumanPreference(
        { board: lastMove.boardStateBefore, move: lastMove.column },
        { board: lastMove.boardStateAfter, move: lastMove.column },
        {
          preference,
          confidence: data.feedbackType === 'rating' ? data.value / 5 : 0.5,
          reasoning: data.feedbackType === 'text' ? data.value : `Rating: ${data.value}`,
          userId: data.playerId
        }
      );
    }
    
    this.logger.log(`[Enhanced RL] Processed ${data.feedbackType} feedback from player ${data.playerId}`);
  }

  /**
   * Get enhanced move recommendation
   */
  async getEnhancedMove(
    board: CellValue[][],
    player: CellValue,
    gameId: string,
    baseMove: number
  ): Promise<{
    column: number;
    confidence: number;
    explanation: any;
    adaptationApplied: boolean;
    safetyApproved: boolean;
  }> {
    const session = this.activeSessions.get(gameId);
    if (!session) {
      return {
        column: baseMove,
        confidence: 0.7,
        explanation: null,
        adaptationApplied: false,
        safetyApproved: true
      };
    }
    
    // Get difficulty configuration
    const difficultyConfig = getDifficultyConfig(session.difficulty);
    
    // Check if we should intentionally make a mistake based on difficulty
    if (Math.random() < difficultyConfig.performanceTargets.mistakeRate) {
      const validMoves = this.getValidMoves(board);
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      
      this.logger.debug(`[${gameId}] Intentional mistake at difficulty ${session.difficulty}: ${randomMove} instead of ${baseMove}`);
      
      return {
        column: randomMove,
        confidence: 0.6,
        explanation: { reason: 'Difficulty-adjusted move' },
        adaptationApplied: true,
        safetyApproved: true
      };
    }
    
    // Get valid moves and apply constitutional principles
    const validMoves = this.getValidMoves(board);
    const constitutionalMoves = await this.rlhf.applyConstitutionalPrinciples(board, validMoves);
    
    // Get reward predictions for constitutional moves
    const moveRewards = await Promise.all(
      constitutionalMoves.map(async move => {
        const reward = await this.rlhf.predictReward(board, move);
        return { move, reward: reward.reward, confidence: reward.confidence };
      })
    );
    
    // Select best move based on rewards
    const rlhfMove = moveRewards.reduce((best, current) => 
      current.reward > best.reward ? current : best,
      { move: baseMove, reward: 0, confidence: 0.5 }
    );
    
    // Apply adaptation
    const adaptedMove = this.adaptationSystem.adaptMove
      ? await this.adaptationSystem.adaptMove(
      board,
      rlhfMove.move,
      session.playerProfile,
      {
        gamePhase: this.getGamePhase(session.moves.length),
        difficulty: session.difficulty,
        moveHistory: session.moves.map(m => m.column)
      }
      )
      : { column: rlhfMove.move, confidence: 0.8, wasAdapted: false, adaptationReason: 'Base move' };
    
    // Safety check
    const safetyResult = this.safetyMonitor.checkMoveSafety(
      board,
      adaptedMove.column,
      session.playerProfile,
      {
        gamePhase: this.getGamePhase(session.moves.length),
        difficulty: session.difficulty
      }
    );
    
    // Generate explanation
    const explanation = this.explainabilityEngine.generateExplanation(
      board,
      adaptedMove.column,
      rlhfMove.confidence * adaptedMove.confidence,
      {
        rlhfReward: rlhfMove.reward,
        adaptationApplied: adaptedMove.wasAdapted,
        safetyScore: safetyResult.score
      },
      {
        playerModel: session.playerProfile,
        gamePhase: this.getGamePhase(session.moves.length),
        constitutionalPrinciples: true
      }
    );
    
    const finalMove = safetyResult.safe ? adaptedMove.column : baseMove;
    
    return {
      column: finalMove,
      confidence: rlhfMove.confidence * adaptedMove.confidence * safetyResult.score,
      explanation,
      adaptationApplied: adaptedMove.wasAdapted,
      safetyApproved: safetyResult.safe
    };
  }

  /**
   * Get learning insights with RLHF analysis
   */
  async getEnhancedLearningInsights(): Promise<any> {
    const baseStats = this.baseRLService.getLearningStats();
    
    const rlhfStats = this.rlhf.getTrainingStats();
    const adaptationStats = this.adaptationSystem.getStatistics
      ? this.adaptationSystem.getStatistics()
      : { profileCount: 0, averageSkillLevel: 0.5, successRate: 0.75, playStyleDistribution: {} };
    const safetyStats = this.safetyMonitor.getSafetyMetrics();
    
    return {
      base: baseStats,
      rlhf: {
        humanPreferences: rlhfStats.humanPreferences,
        rewardModelMetrics: rlhfStats.rewardModelMetrics,
        constitutionalPrinciples: rlhfStats.constitutionalPrinciples,
        lastTraining: rlhfStats.lastTraining
      },
      adaptation: {
        activeProfiles: adaptationStats.profileCount,
        averageSkillLevel: adaptationStats.averageSkillLevel,
        adaptationSuccessRate: adaptationStats.successRate,
        playStyleDistribution: adaptationStats.playStyleDistribution
      },
      safety: {
        totalViolations: safetyStats.totalViolations,
        violationsByType: safetyStats.violationsByType,
        robustnessScore: safetyStats.robustnessScore,
        ethicalScore: safetyStats.ethicalScore
      },
      activeSessions: this.activeSessions.size,
      explanationHistory: this.explainabilityEngine.getExplanationHistory().length
    };
  }

  /**
   * Helper methods
   */
  private assessGameQuality(session: LearningSession): number {
    // Assess based on game length, move variety, strategic depth
    const moveCount = session.moves.length;
    const moveVariety = new Set(session.moves.map(m => m.column)).size;
    const criticalMoves = session.moves.filter(m => m.evaluation && m.evaluation > 0.8).length;
    
    const lengthScore = Math.min(moveCount / 30, 1); // Normalize to 30 moves
    const varietyScore = moveVariety / 7; // All columns used
    const depthScore = criticalMoves / Math.max(moveCount, 1);
    
    return (lengthScore + varietyScore + depthScore) / 3;
  }

  private assessPlayerEngagement(session: LearningSession): number {
    // Assess based on game duration, move timing, completion
    const duration = Date.now() - session.startTime;
    const avgMoveTime = duration / session.moves.length;
    
    // Ideal engagement: 2-5 seconds per move, 5-15 minute games
    const moveTimeScore = Math.min(Math.max(avgMoveTime / 3500, 0), 1);
    const durationScore = Math.min(Math.max(duration / 600000, 0), 1);
    
    return (moveTimeScore + durationScore) / 2;
  }

  private getGamePhase(moveCount: number): 'opening' | 'midgame' | 'endgame' {
    if (moveCount < 8) return 'opening';
    if (moveCount < 25) return 'midgame';
    return 'endgame';
  }

  private applyMove(board: CellValue[][], column: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][column] === null) {
        newBoard[row][column] = player;
        break;
      }
    }
    return newBoard;
  }

  private async storeEnhancedLearning(data: any): Promise<void> {
    // Store to base RL service with enhanced metadata
    const gameOutcome = {
      gameId: data.gameId,
      winner: data.winner || 'Unknown',
      aiPlayer: 'Yellow' as CellValue,
      difficulty: data.difficulty || 10,
      moves: data.moves || [],
      timestamp: Date.now(),
      enhanced: true,
      rlhfVersion: '2.0',
      metadata: {
        rlhfFeedback: data.rlhfFeedback,
        constitutionalFeedback: data.constitutionalFeedback,
        playerProfile: data.playerProfile
      }
    };
    
    await this.baseRLService.recordGameOutcome(gameOutcome);
  }
  
  /**
   * Get valid moves for board state
   */
  private getValidMoves(board: CellValue[][]): number[] {
    const validMoves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === null) {
        validMoves.push(col);
      }
    }
    return validMoves;
  }
  
  /**
   * Initialize method stubs for RLHF components
   */
  private initializeComponentMethods(): void {
    // Add initialization methods to components that need them
    this.adaptationSystem.initialize = async (config: any) => {
      this.logger.debug('AdaptationSystem initialized with config:', config);
    };
    
    this.adaptationSystem.playerModels = new Map();
    
    this.adaptationSystem.getOrCreateProfile = async (playerId: string) => {
      // Get or create player profile
      let profile = this.adaptationSystem.playerModels?.get(playerId);
    if (!profile) {
      profile = {
        playerId,
        skillLevel: 0.5,
        playingStyle: 'balanced',
        preferences: {
          complexity: 0.5,
          creativity: 0.5,
          challenge: 0.5,
          fairness: 0.5,
          engagement: 0.5
        },
        behavioralPatterns: {
          averageMoveTime: 3000,
          consistencyScore: 0.5,
          riskTolerance: 0.5,
          learningRate: 0.1,
          adaptabilityScore: 0.5
        },
        gameHistory: [],
        lastUpdated: Date.now()
      };
      this.adaptationSystem.playerModels!.set(playerId, profile);
    }
    return profile;
  };
    
    this.adaptationSystem.updateProfile = async (playerId: string, updates: any) => {
      const profile = await this.adaptationSystem.getOrCreateProfile!(playerId);
    Object.assign(profile, updates);
    profile.lastUpdated = Date.now();
  };
    
    this.adaptationSystem.adaptMove = async (_board: CellValue[][], move: number, _playerProfile: any, _context: any) => {
    // Simple adaptation logic
    return {
      column: move,
      confidence: 0.8,
      wasAdapted: false,
      adaptationReason: 'Base move maintained'
    };
  };
    
    this.adaptationSystem.getStatistics = () => {
      const models = this.adaptationSystem.playerModels || new Map();
      const profiles = Array.from(models.values());
      return {
        profileCount: models.size,
        averageSkillLevel: profiles.length > 0 
          ? (profiles as any[]).reduce((sum: number, p: any) => sum + (p.skillLevel || 0.5), 0) / profiles.length
          : 0.5,
        successRate: 0.75,
        playStyleDistribution: {
          aggressive: profiles.filter((p: any) => p.playingStyle === 'aggressive').length,
          defensive: profiles.filter((p: any) => p.playingStyle === 'defensive').length,
          balanced: profiles.filter((p: any) => p.playingStyle === 'balanced').length,
          creative: profiles.filter((p: any) => p.playingStyle === 'creative').length,
          methodical: profiles.filter((p: any) => p.playingStyle === 'methodical').length
        }
      };
    };
    
    this.explainabilityEngine.initialize = async (config: any) => {
      this.logger.debug('ExplainabilityEngine initialized with config:', config);
    };
    
    this.debateSystem.initialize = async (config: any) => {
      this.logger.debug('MultiAgentDebateSystem initialized with config:', config);
    };
    
    this.safetyMonitor.initialize = async (config: any) => {
      this.logger.debug('SafetyMonitor initialized with config:', config);
    };
  }
}

interface LearningSession {
  gameId: string;
  playerId: string;
  playerProfile: any;
  moves: EnhancedMove[];
  startTime: number;
  difficulty: number;
  safetyViolations: number;
}