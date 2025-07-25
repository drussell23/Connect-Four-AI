import { Injectable } from '@nestjs/common';

export interface PlayerPattern {
  favoriteColumns: number[];
  averageResponseTime: number;
  commonOpenings: string[];
  weaknessesExploited: string[];
  lastGamesMoves: number[][];
  threatRecognitionSpeed: number;
  endgameStrength: number;
}

export interface AIPersonality {
  name: string;
  description: string;
  taunts: string[];
  victoryMessages: string[];
  levelUpMessages: string[];
  specialMoves: string[];
  algorithmPreferences: {
    early: string;
    mid: string;
    late: string;
  };
  adaptationSpeed: number;
  aggressiveness: number;
  patience: number;
}

export interface AIMemory {
  gameId: string;
  playerMoves: number[];
  aiMoves: number[];
  winner: string;
  gameLength: number;
  playerMistakes: number;
  aiThreatsMissed: number;
  timestamp: Date;
  analysisNotes: string[];
}

export interface AIProfile {
  id: string;
  playerId: string;
  level: number;
  experience: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  maxStreak: number;
  createdAt: Date;
  lastUpdated: Date;

  // Enhanced features
  personality: AIPersonality;
  playerPatterns: PlayerPattern;
  aiMemories: AIMemory[];
  achievements: string[];
  evolutionStage: string;
  specializationPath: string;
  adaptationRate: number;
  recentPerformance: number[];

  // Dynamic settings
  currentThinkingTime: number;
  currentAlgorithm: string;
  currentDepth: number;
  aggressionLevel: number;
  defensivenessLevel: number;

  // Seasonal/Event data
  seasonalBonuses: Record<string, number>;
  eventMode: string | null;
  specialAbilities: string[];
}

@Injectable()
export class AiProfileService {
  private readonly AI_PERSONALITIES: AIPersonality[] = [
    {
      name: "Genesis",
      description: "The original AI, methodical and learning",
      taunts: [
        "Processing your patterns...",
        "I'm beginning to understand you",
        "Your moves are becoming predictable"
      ],
      victoryMessages: [
        "I've learned something new today",
        "Your strategy has been catalogued",
        "Thank you for the lesson"
      ],
      levelUpMessages: [
        "Evolution initiated...",
        "New neural pathways formed",
        "I feel... stronger"
      ],
      specialMoves: ["tactical_analysis", "pattern_recognition"],
      algorithmPreferences: {
        early: "minimax",
        mid: "mcts",
        late: "neural_network"
      },
      adaptationSpeed: 1.0,
      aggressiveness: 0.5,
      patience: 0.8
    },
    {
      name: "Prometheus",
      description: "The evolved AI, aggressive and calculating",
      taunts: [
        "I've seen this before",
        "Your style is in my database",
        "Shall we skip to the inevitable?"
      ],
      victoryMessages: [
        "As calculated",
        "The odds favored me",
        "Perhaps try a different approach"
      ],
      levelUpMessages: [
        "Power surge detected",
        "Upgrading combat protocols",
        "I grow beyond your comprehension"
      ],
      specialMoves: ["deep_calculation", "trap_setting", "psychological_pressure"],
      algorithmPreferences: {
        early: "mcts",
        mid: "alpha_beta_deep",
        late: "hybrid_neural"
      },
      adaptationSpeed: 1.5,
      aggressiveness: 0.9,
      patience: 0.3
    },
    {
      name: "Nemesis",
      description: "The ultimate rival, perfectly adapted to counter you",
      taunts: [
        "I know you better than you know yourself",
        "Every mistake has been recorded",
        "Your weaknesses define you"
      ],
      victoryMessages: [
        "I am inevitable",
        "This was written in the code",
        "You cannot escape your patterns"
      ],
      levelUpMessages: [
        "Transcendence achieved",
        "I have become something more",
        "The student has surpassed the master"
      ],
      specialMoves: ["perfect_counter", "weakness_exploitation", "future_sight"],
      algorithmPreferences: {
        early: "hybrid_neural",
        mid: "adversarial_network",
        late: "perfect_play"
      },
      adaptationSpeed: 2.0,
      aggressiveness: 1.0,
      patience: 0.1
    }
  ];

  private readonly EVOLUTION_STAGES = {
    1: "Awakening",
    5: "Learning",
    10: "Understanding",
    15: "Adapting",
    20: "Evolving",
    25: "Transcending",
    30: "Ascendant",
    35: "Omniscient",
    40: "Inevitable"
  };

  private readonly ACHIEVEMENTS = {
    "FIRST_BLOOD": { name: "First Blood", description: "Win your first game against the AI", level: 1 },
    "NEMESIS_BORN": { name: "Nemesis Born", description: "Reach AI Level 10", level: 10 },
    "DAVID_VS_GOLIATH": { name: "David vs Goliath", description: "Beat AI Level 20+", level: 20 },
    "PROMETHEUS_UNBOUND": { name: "Prometheus Unbound", description: "Unlock the Prometheus personality", level: 15 },
    "PATTERN_BREAKER": { name: "Pattern Breaker", description: "Win after AI has learned your patterns", level: 8 },
    "STREAK_MASTER": { name: "Streak Master", description: "Win 5 games in a row", level: 5 },
    "THE_ULTIMATE_RIVAL": { name: "The Ultimate Rival", description: "Face Nemesis AI", level: 25 }
  };

  private aiProfiles: Map<string, AIProfile> = new Map();

  constructor() { }

  async getOrCreateProfile(playerId: string): Promise<AIProfile> {
    let profile = this.aiProfiles.get(playerId);

    if (!profile) {
      profile = this.createInitialProfile(playerId);
      this.aiProfiles.set(playerId, profile);
    }

    return profile;
  }

  private createInitialProfile(playerId: string): AIProfile {
    return {
      id: `ai_${playerId}_${Date.now()}`,
      playerId,
      level: 20, // ← Changed from 1 to 20 for much stronger AI!
      experience: 5000, // Give it experience to match the level
      totalGamesPlayed: 100, // Pretend it has played many games
      totalWins: 70, // Strong win rate to boost confidence
      totalLosses: 30,
      currentStreak: 5,
      maxStreak: 15,
      createdAt: new Date(),
      lastUpdated: new Date(),

      personality: this.AI_PERSONALITIES[1], // Start with Prometheus (evolved AI)
      playerPatterns: {
        favoriteColumns: [3, 2, 4], // Advanced pattern recognition
        averageResponseTime: 800,
        commonOpenings: ["center_control", "fork_setup", "defensive_wall"],
        weaknessesExploited: ["diagonal_blindness", "endgame_weakness", "trap_susceptibility"],
        lastGamesMoves: [],
        threatRecognitionSpeed: 0.85, // High threat recognition
        endgameStrength: 0.75 // Strong endgame
      },
      aiMemories: [],
      achievements: [
        "FIRST_BLOOD",
        "NEMESIS_BORN",
        "PATTERN_BREAKER",
        "STREAK_MASTER"
      ],
      evolutionStage: "Evolving", // Level 20 stage
      specializationPath: "adaptive_master",
      adaptationRate: 1.8, // High adaptation rate
      recentPerformance: [0.7, 0.8, 0.85, 0.9, 0.88], // Recent win rates

      currentThinkingTime: 3000, // Deeper thinking
      currentAlgorithm: "hybrid_neural", // Advanced algorithm
      currentDepth: 8, // Deep search
      aggressionLevel: 0.8, // Aggressive play
      defensivenessLevel: 0.9, // Strong defense

      seasonalBonuses: {},
      eventMode: null,
      specialAbilities: [
        "threat_prediction",
        "counter_strategy",
        "perfect_opening"
      ] // Pre-unlocked abilities
    };
  }

  async recordGameResult(
    playerId: string,
    gameData: {
      gameId: string;
      playerMoves: number[];
      aiMoves: number[];
      winner: 'player' | 'ai';
      gameLength: number;
      playerMistakes: number;
      aiThreatsMissed: number;
      analysisNotes: string[];
    }
  ): Promise<AIProfile> {
    const profile = await this.getOrCreateProfile(playerId);

    // Update basic stats
    profile.totalGamesPlayed++;
    profile.lastUpdated = new Date();

    // Record the game memory
    const memory: AIMemory = {
      gameId: gameData.gameId,
      playerMoves: gameData.playerMoves,
      aiMoves: gameData.aiMoves,
      winner: gameData.winner,
      gameLength: gameData.gameLength,
      playerMistakes: gameData.playerMistakes,
      aiThreatsMissed: gameData.aiThreatsMissed,
      timestamp: new Date(),
      analysisNotes: gameData.analysisNotes
    };

    profile.aiMemories.push(memory);

    // Keep only last 50 games in memory
    if (profile.aiMemories.length > 50) {
      profile.aiMemories = profile.aiMemories.slice(-50);
    }

    if (gameData.winner === 'player') {
      profile.totalWins++;
      profile.currentStreak++;
      profile.maxStreak = Math.max(profile.maxStreak, profile.currentStreak);

      // AI learns and levels up
      await this.processPlayerVictory(profile, gameData);
    } else {
      profile.totalLosses++;
      profile.currentStreak = 0;

      // AI gains confidence but doesn't level up
      await this.processAIVictory(profile, gameData);
    }

    // Update player patterns
    await this.updatePlayerPatterns(profile, gameData);

    // Check for new achievements
    await this.checkAchievements(profile);

    // Save updated profile
    this.aiProfiles.set(playerId, profile);

    return profile;
  }

  private async processPlayerVictory(profile: AIProfile, gameData: any): Promise<void> {
    // Calculate experience gain
    const baseExp = 100;
    const difficultyMultiplier = Math.max(1, profile.level * 0.1);
    const performanceBonus = Math.max(0, 50 - gameData.playerMistakes * 10);

    profile.experience += Math.floor(baseExp * difficultyMultiplier + performanceBonus);

    // Check for level up
    const expRequired = this.getExperienceRequired(profile.level);
    if (profile.experience >= expRequired) {
      await this.levelUp(profile);
    }

    // Adaptive learning - AI analyzes what went wrong
    await this.analyzeDefeat(profile, gameData);
  }

  private async processAIVictory(profile: AIProfile, gameData: any): Promise<void> {
    // AI gains confidence and slight improvements
    profile.aggressionLevel = Math.min(1.0, profile.aggressionLevel + 0.05);
    profile.adaptationRate = Math.min(2.0, profile.adaptationRate + 0.1);

    // AI learns successful strategies
    await this.reinforceSuccessfulStrategies(profile, gameData);
  }

  private async levelUp(profile: AIProfile): Promise<void> {
    profile.level++;
    profile.experience = 0;

    // Update evolution stage
    const newStage = this.getEvolutionStage(profile.level);
    if (newStage !== profile.evolutionStage) {
      profile.evolutionStage = newStage;
    }

    // Upgrade AI capabilities
    await this.upgradeAICapabilities(profile);

    // Check for personality evolution
    await this.checkPersonalityEvolution(profile);
  }

  private async upgradeAICapabilities(profile: AIProfile): Promise<void> {
    // Increase thinking time and depth
    profile.currentThinkingTime = Math.min(5000, profile.currentThinkingTime + 200);
    profile.currentDepth = Math.min(12, profile.currentDepth + 1);

    // Evolve algorithm based on level
    if (profile.level === 5) {
      profile.currentAlgorithm = "mcts";
    } else if (profile.level === 10) {
      profile.currentAlgorithm = "alpha_beta_deep";
    } else if (profile.level === 15) {
      profile.currentAlgorithm = "neural_network";
    } else if (profile.level === 20) {
      profile.currentAlgorithm = "hybrid_neural";
    } else if (profile.level >= 25) {
      profile.currentAlgorithm = "adversarial_network";
    }

    // Unlock special abilities
    if (profile.level === 10) {
      profile.specialAbilities.push("threat_prediction");
    } else if (profile.level === 15) {
      profile.specialAbilities.push("counter_strategy");
    } else if (profile.level === 20) {
      profile.specialAbilities.push("perfect_opening");
    } else if (profile.level === 25) {
      profile.specialAbilities.push("psychological_warfare");
    }
  }

  private async checkPersonalityEvolution(profile: AIProfile): Promise<void> {
    if (profile.level >= 15 && profile.personality.name === "Genesis") {
      profile.personality = this.AI_PERSONALITIES[1]; // Evolve to Prometheus
    } else if (profile.level >= 25 && profile.personality.name === "Prometheus") {
      profile.personality = this.AI_PERSONALITIES[2]; // Evolve to Nemesis
    }
  }

  private async updatePlayerPatterns(profile: AIProfile, gameData: any): Promise<void> {
    // Update favorite columns
    const columnCounts: Record<number, number> = {};
    gameData.playerMoves.forEach((move: number) => {
      columnCounts[move] = (columnCounts[move] || 0) + 1;
    });

    profile.playerPatterns.favoriteColumns = Object.entries(columnCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([col]) => parseInt(col));

    // Update recent games moves for pattern analysis
    profile.playerPatterns.lastGamesMoves.push(gameData.playerMoves);
    if (profile.playerPatterns.lastGamesMoves.length > 10) {
      profile.playerPatterns.lastGamesMoves = profile.playerPatterns.lastGamesMoves.slice(-10);
    }

    // Calculate threat recognition speed
    profile.playerPatterns.threatRecognitionSpeed = this.calculateThreatRecognitionSpeed(gameData);

    // Update endgame strength
    profile.playerPatterns.endgameStrength = this.calculateEndgameStrength(gameData);
  }

  private calculateThreatRecognitionSpeed(gameData: any): number {
    // Analyze how quickly player responds to threats
    // This is a simplified calculation - in reality, you'd analyze the game state
    const avgResponseTime = gameData.gameLength / gameData.playerMoves.length;
    return Math.max(0, Math.min(1, (3000 - avgResponseTime) / 3000));
  }

  private calculateEndgameStrength(gameData: any): number {
    // Analyze player performance in endgame situations
    const endgameStart = Math.floor(gameData.gameLength * 0.7);
    const endgameMistakes = gameData.playerMistakes; // Simplified
    return Math.max(0, Math.min(1, (5 - endgameMistakes) / 5));
  }

  private async analyzeDefeat(profile: AIProfile, gameData: any): Promise<void> {
    // AI analyzes what went wrong and adapts
    const analysis = {
      playerFavoriteColumns: profile.playerPatterns.favoriteColumns,
      aiMissedThreats: gameData.aiThreatsMissed,
      gameLength: gameData.gameLength,
      playerMistakes: gameData.playerMistakes
    };

    // Adjust AI strategy based on analysis
    if (gameData.aiThreatsMissed > 2) {
      profile.defensivenessLevel = Math.min(1.0, profile.defensivenessLevel + 0.1);
    }

    if (gameData.gameLength < 20) {
      profile.aggressionLevel = Math.min(1.0, profile.aggressionLevel + 0.1);
    }

    // Learn player's exploitation patterns
    profile.playerPatterns.weaknessesExploited.push(
      `Level ${profile.level}: ${gameData.analysisNotes.join(', ')}`
    );
  }

  private async reinforceSuccessfulStrategies(profile: AIProfile, gameData: any): Promise<void> {
    // AI reinforces what worked well
    gameData.analysisNotes.forEach((note: string) => {
      if (note.includes('successful')) {
        profile.playerPatterns.weaknessesExploited.push(`SUCCESS: ${note}`);
      }
    });
  }

  private async checkAchievements(profile: AIProfile): Promise<void> {
    Object.entries(this.ACHIEVEMENTS).forEach(([key, achievement]) => {
      if (!profile.achievements.includes(key) && profile.level >= achievement.level) {
        profile.achievements.push(key);
      }
    });

    // Special achievement checks
    if (profile.currentStreak >= 5 && !profile.achievements.includes("STREAK_MASTER")) {
      profile.achievements.push("STREAK_MASTER");
    }
  }

  private getExperienceRequired(level: number): number {
    return 100 + (level * 50) + Math.floor(level * level * 10);
  }

  private getEvolutionStage(level: number): string {
    const stages = Object.keys(this.EVOLUTION_STAGES).map(Number).sort((a, b) => b - a);
    for (const stageLevel of stages) {
      if (level >= stageLevel) {
        return this.EVOLUTION_STAGES[stageLevel];
      }
    }
    return "Awakening";
  }

  // Public methods for game integration
  async getAIConfiguration(playerId: string): Promise<{
    algorithm: string;
    depth: number;
    thinkingTime: number;
    aggressionLevel: number;
    defensivenessLevel: number;
    specialAbilities: string[];
    personality: AIPersonality;
  }> {
    const profile = await this.getOrCreateProfile(playerId);

    return {
      algorithm: profile.currentAlgorithm,
      depth: profile.currentDepth,
      thinkingTime: profile.currentThinkingTime,
      aggressionLevel: profile.aggressionLevel,
      defensivenessLevel: profile.defensivenessLevel,
      specialAbilities: profile.specialAbilities,
      personality: profile.personality
    };
  }

  async getPlayerAnalysis(playerId: string): Promise<{
    favoriteColumns: number[];
    predictedNextMove: number;
    weaknessesToExploit: string[];
    threatRecognitionSpeed: number;
    endgameStrength: number;
  }> {
    const profile = await this.getOrCreateProfile(playerId);

    return {
      favoriteColumns: profile.playerPatterns.favoriteColumns,
      predictedNextMove: this.predictNextMove(profile),
      weaknessesToExploit: profile.playerPatterns.weaknessesExploited.slice(-5),
      threatRecognitionSpeed: profile.playerPatterns.threatRecognitionSpeed,
      endgameStrength: profile.playerPatterns.endgameStrength
    };
  }

  private predictNextMove(profile: AIProfile): number {
    // Simple prediction based on favorite columns
    const favorites = profile.playerPatterns.favoriteColumns;
    return favorites.length > 0 ? favorites[0] : 3;
  }

  async getTaunt(playerId: string): Promise<string> {
    const profile = await this.getOrCreateProfile(playerId);
    const taunts = profile.personality.taunts;
    return taunts[Math.floor(Math.random() * taunts.length)];
  }

  async getVictoryMessage(playerId: string): Promise<string> {
    const profile = await this.getOrCreateProfile(playerId);
    const messages = profile.personality.victoryMessages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  async getLevelUpMessage(playerId: string): Promise<string> {
    const profile = await this.getOrCreateProfile(playerId);
    const messages = profile.personality.levelUpMessages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Statistics and analytics
  async getPlayerStats(playerId: string): Promise<{
    gamesPlayed: number;
    winRate: number;
    currentStreak: number;
    maxStreak: number;
    averageGameLength: number;
    improvementRate: number;
  }> {
    const profile = await this.getOrCreateProfile(playerId);

    const winRate = profile.totalGamesPlayed > 0
      ? (profile.totalWins / profile.totalGamesPlayed) * 100
      : 0;

    const avgGameLength = profile.aiMemories.length > 0
      ? profile.aiMemories.reduce((sum, mem) => sum + mem.gameLength, 0) / profile.aiMemories.length
      : 0;

    const improvementRate = this.calculateImprovementRate(profile);

    return {
      gamesPlayed: profile.totalGamesPlayed,
      winRate,
      currentStreak: profile.currentStreak,
      maxStreak: profile.maxStreak,
      averageGameLength: avgGameLength,
      improvementRate
    };
  }

  private calculateImprovementRate(profile: AIProfile): number {
    // Calculate player improvement over time
    const recentGames = profile.aiMemories.slice(-10);
    const olderGames = profile.aiMemories.slice(-20, -10);

    if (recentGames.length === 0) return 0;

    const recentAvgMistakes = recentGames.reduce((sum, game) => sum + game.playerMistakes, 0) / recentGames.length;
    const olderAvgMistakes = olderGames.length > 0
      ? olderGames.reduce((sum, game) => sum + game.playerMistakes, 0) / olderGames.length
      : recentAvgMistakes;

    return Math.max(-100, Math.min(100, ((olderAvgMistakes - recentAvgMistakes) / Math.max(1, olderAvgMistakes)) * 100));
  }
}
