export interface DifficultyConfig {
  level: number;
  name: string;
  rlhfEnabled: boolean;
  constitutionalPrinciples: {
    avoidTrivialWins: boolean;
    avoidTrivialWinsProbability: number;
    teachHumans: boolean;
    maintainBalance: boolean;
  };
  performanceTargets: {
    winRate: number; // Target win rate for AI
    avgGameLength: number; // Target game length in moves
    mistakeRate: number; // Intentional mistake probability
  };
  strategicAwareness: {
    detectOpenThrees: boolean; // Detect and respond to open-three threats
    blockOpenThrees: boolean; // Block opponent's open-threes
    createOpenThrees: boolean; // Create own open-three opportunities
    detectForks: boolean; // Detect fork opportunities
    blockForks: boolean; // Block opponent forks
    createForks: boolean; // Create own forks
    lookAhead: number; // How many moves to look ahead
    useAdvancedPatterns: boolean; // Use advanced pattern recognition
  };
  behaviorProfile: {
    aggressiveness: number; // 0-1, how aggressive the AI plays
    defensiveness: number; // 0-1, how defensive the AI plays
    randomness: number; // 0-1, how much randomness in play
    centerPreference: number; // 0-1, preference for center columns
    blockingPriority: number; // 0-1, priority given to blocking vs winning
  };
}

export const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  // Level 1-3: Beginner - Learning the game, but still blocks obvious wins
  {
    level: 1,
    name: 'Beginner',
    rlhfEnabled: false,
    constitutionalPrinciples: {
      avoidTrivialWins: true,
      avoidTrivialWinsProbability: 0.4, // 40% chance to avoid wins
      teachHumans: true,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.15, // AI should win 15% of games
      avgGameLength: 30,
      mistakeRate: 0.3 // 30% chance of suboptimal moves - reduced from 40%
    },
    strategicAwareness: {
      detectOpenThrees: true,  // Can see threats
      blockOpenThrees: true,   // Will block, but with mistakes
      createOpenThrees: false, // Won't create complex threats
      detectForks: false,
      blockForks: false,
      createForks: false,
      lookAhead: 1,
      useAdvancedPatterns: false
    },
    behaviorProfile: {
      aggressiveness: 0.2,
      defensiveness: 0.5,     // More defensive awareness
      randomness: 0.4,        // Less random than before
      centerPreference: 0.3,
      blockingPriority: 0.65  // Much better at blocking immediate threats
    }
  },
  // Level 4-5: Easy - Developing defensive instincts
  {
    level: 4,
    name: 'Easy',
    rlhfEnabled: false,
    constitutionalPrinciples: {
      avoidTrivialWins: true,
      avoidTrivialWinsProbability: 0.25, // 25% chance to avoid wins
      teachHumans: true,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.25, // AI should win 25% of games
      avgGameLength: 28,
      mistakeRate: 0.12 // 12% chance of suboptimal moves
    },
    strategicAwareness: {
      detectOpenThrees: true,  // Better at seeing threats
      blockOpenThrees: true,   // More consistent blocking
      createOpenThrees: false, // Still won't create complex threats
      detectForks: false,
      blockForks: false,
      createForks: false,
      lookAhead: 2,
      useAdvancedPatterns: false
    },
    behaviorProfile: {
      aggressiveness: 0.3,
      defensiveness: 0.65,    // Strong defensive instincts developing
      randomness: 0.25,       // Much less random
      centerPreference: 0.4,
      blockingPriority: 0.8   // Reliable blocking across all directions
    }
  },
  // Level 5-7: Intermediate - Strategic awareness emerges
  {
    level: 5,
    name: 'Intermediate',
    rlhfEnabled: false,
    constitutionalPrinciples: {
      avoidTrivialWins: false,
      avoidTrivialWinsProbability: 0,
      teachHumans: true,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.35, // AI should win 35% of games
      avgGameLength: 25,
      mistakeRate: 0.08 // 8% chance of suboptimal moves
    },
    strategicAwareness: {
      detectOpenThrees: true,  // Detects multi-directional threats
      blockOpenThrees: true,   // Blocks threats consistently
      createOpenThrees: false, // Starting to create opportunities
      detectForks: true,       // Beginning fork awareness
      blockForks: false,
      createForks: false,
      lookAhead: 3,
      useAdvancedPatterns: false
    },
    behaviorProfile: {
      aggressiveness: 0.4,
      defensiveness: 0.7,     // Strong defensive play
      randomness: 0.2,        // More predictable, strategic
      centerPreference: 0.5,
      blockingPriority: 0.85  // Excellent threat recognition
    }
  },
  // Level 8-10: Advanced Intermediate - Balanced offense and defense
  {
    level: 8,
    name: 'Intermediate+',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: false,
      avoidTrivialWinsProbability: 0,
      teachHumans: false,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.5, // AI should win 50% of games
      avgGameLength: 22,
      mistakeRate: 0.05 // 5% chance of suboptimal moves
    },
    strategicAwareness: {
      detectOpenThrees: true,
      blockOpenThrees: true,
      createOpenThrees: true,  // Creates offensive threats
      detectForks: true,
      blockForks: true,        // Blocks complex patterns
      createForks: false,
      lookAhead: 4,
      useAdvancedPatterns: false
    },
    behaviorProfile: {
      aggressiveness: 0.5,
      defensiveness: 0.75,    // Strong defensive foundation
      randomness: 0.15,       // Mostly strategic
      centerPreference: 0.6,
      blockingPriority: 0.88  // Near-perfect threat detection
    }
  },
  // Levels 11-15: Advanced - Competitive strategic play
  {
    level: 11,
    name: 'Advanced',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: false,
      avoidTrivialWinsProbability: 0,
      teachHumans: false,
      maintainBalance: false
    },
    performanceTargets: {
      winRate: 0.65, // AI should win 65% of games
      avgGameLength: 20,
      mistakeRate: 0.03 // 3% chance of suboptimal moves
    },
    strategicAwareness: {
      detectOpenThrees: true,
      blockOpenThrees: true,
      createOpenThrees: true,
      detectForks: true,
      blockForks: true,
      createForks: true,      // Advanced fork creation
      lookAhead: 5,
      useAdvancedPatterns: true // Pattern recognition active
    },
    behaviorProfile: {
      aggressiveness: 0.65,
      defensiveness: 0.8,     // Very strong defense
      randomness: 0.08,       // Minimal randomness
      centerPreference: 0.7,
      blockingPriority: 0.9   // Exceptional blocking ability
    }
  },
  // Levels 16-20: Expert - Near-optimal strategic mastery
  {
    level: 16,
    name: 'Expert',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: false,
      avoidTrivialWinsProbability: 0,
      teachHumans: false,
      maintainBalance: false
    },
    performanceTargets: {
      winRate: 0.8, // AI should win 80% of games
      avgGameLength: 18,
      mistakeRate: 0.01 // 1% chance of suboptimal moves
    },
    strategicAwareness: {
      detectOpenThrees: true,
      blockOpenThrees: true,
      createOpenThrees: true,
      detectForks: true,
      blockForks: true,
      createForks: true,
      lookAhead: 7,
      useAdvancedPatterns: true
    },
    behaviorProfile: {
      aggressiveness: 0.75,
      defensiveness: 0.85,    // Exceptional defense
      randomness: 0.04,       // Almost deterministic
      centerPreference: 0.8,
      blockingPriority: 0.93  // Near-perfect blocking
    }
  },
  // Levels 21-25: Ultimate - Peak human-like intelligence
  {
    level: 21,
    name: 'Ultimate',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: false,
      avoidTrivialWinsProbability: 0,
      teachHumans: false,
      maintainBalance: false
    },
    performanceTargets: {
      winRate: 0.92, // AI should win 92% of games
      avgGameLength: 15,
      mistakeRate: 0.005 // 0.5% rare mistakes for realism
    },
    strategicAwareness: {
      detectOpenThrees: true,
      blockOpenThrees: true,
      createOpenThrees: true,
      detectForks: true,
      blockForks: true,
      createForks: true,
      lookAhead: 9,
      useAdvancedPatterns: true
    },
    behaviorProfile: {
      aggressiveness: 0.85,   // Balanced with defense
      defensiveness: 0.95,    // Supreme defensive awareness
      randomness: 0.02,       // Tiny unpredictability for human feel
      centerPreference: 0.9,
      blockingPriority: 0.97  // Near-perfect threat detection
    }
  }
];

export function getDifficultyConfig(level: number): DifficultyConfig {
  // Find the appropriate config for the level
  let config = DIFFICULTY_CONFIGS[0];
  
  for (const cfg of DIFFICULTY_CONFIGS) {
    if (level >= cfg.level) {
      config = cfg;
    }
  }
  
  // Interpolate values for in-between levels
  const baseLevel = config.level;
  const nextConfig = DIFFICULTY_CONFIGS.find(cfg => cfg.level > baseLevel);
  
  if (nextConfig && level > baseLevel && level < nextConfig.level) {
    const progress = (level - baseLevel) / (nextConfig.level - baseLevel);
    
    return {
      level,
      name: config.name,
      rlhfEnabled: level >= 7, // RLHF enabled from level 7+
      constitutionalPrinciples: {
        avoidTrivialWins: config.constitutionalPrinciples.avoidTrivialWins,
        avoidTrivialWinsProbability: 
          config.constitutionalPrinciples.avoidTrivialWinsProbability * (1 - progress) +
          nextConfig.constitutionalPrinciples.avoidTrivialWinsProbability * progress,
        teachHumans: progress < 0.5 ? config.constitutionalPrinciples.teachHumans : nextConfig.constitutionalPrinciples.teachHumans,
        maintainBalance: progress < 0.5 ? config.constitutionalPrinciples.maintainBalance : nextConfig.constitutionalPrinciples.maintainBalance
      },
      performanceTargets: {
        winRate: 
          config.performanceTargets.winRate * (1 - progress) +
          nextConfig.performanceTargets.winRate * progress,
        avgGameLength:
          config.performanceTargets.avgGameLength * (1 - progress) +
          nextConfig.performanceTargets.avgGameLength * progress,
        mistakeRate:
          config.performanceTargets.mistakeRate * (1 - progress) +
          nextConfig.performanceTargets.mistakeRate * progress
      },
      strategicAwareness: {
        detectOpenThrees: true, // All levels can detect threats
        blockOpenThrees: true,  // All levels will try to block (with varying success based on mistake rate)
        createOpenThrees: level >= 8,
        detectForks: level >= 8,
        blockForks: level >= 8,
        createForks: level >= 11,
        lookAhead: Math.floor(config.strategicAwareness.lookAhead * (1 - progress) + nextConfig.strategicAwareness.lookAhead * progress),
        useAdvancedPatterns: level >= 11
      },
      behaviorProfile: {
        aggressiveness: config.behaviorProfile.aggressiveness * (1 - progress) + nextConfig.behaviorProfile.aggressiveness * progress,
        defensiveness: config.behaviorProfile.defensiveness * (1 - progress) + nextConfig.behaviorProfile.defensiveness * progress,
        randomness: config.behaviorProfile.randomness * (1 - progress) + nextConfig.behaviorProfile.randomness * progress,
        centerPreference: config.behaviorProfile.centerPreference * (1 - progress) + nextConfig.behaviorProfile.centerPreference * progress,
        blockingPriority: config.behaviorProfile.blockingPriority * (1 - progress) + nextConfig.behaviorProfile.blockingPriority * progress
      }
    };
  }
  
  return config;
}