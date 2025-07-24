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
}

export const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  // Levels 1-5: Beginner
  {
    level: 1,
    name: 'Beginner',
    rlhfEnabled: false,
    constitutionalPrinciples: {
      avoidTrivialWins: true,
      avoidTrivialWinsProbability: 0.8, // 80% chance to avoid early wins
      teachHumans: true,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.2, // AI should win 20% of games
      avgGameLength: 25,
      mistakeRate: 0.3 // 30% chance of suboptimal moves
    }
  },
  // Levels 6-10: Intermediate
  {
    level: 6,
    name: 'Intermediate',
    rlhfEnabled: false,
    constitutionalPrinciples: {
      avoidTrivialWins: true,
      avoidTrivialWinsProbability: 0.4, // 40% chance to avoid early wins
      teachHumans: true,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.4, // AI should win 40% of games
      avgGameLength: 22,
      mistakeRate: 0.15 // 15% chance of suboptimal moves
    }
  },
  // Levels 11-15: Advanced
  {
    level: 11,
    name: 'Advanced',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: true,
      avoidTrivialWinsProbability: 0.2, // 20% chance to avoid early wins
      teachHumans: false,
      maintainBalance: true
    },
    performanceTargets: {
      winRate: 0.6, // AI should win 60% of games
      avgGameLength: 20,
      mistakeRate: 0.05 // 5% chance of suboptimal moves
    }
  },
  // Levels 16-20: Expert
  {
    level: 16,
    name: 'Expert',
    rlhfEnabled: true,
    constitutionalPrinciples: {
      avoidTrivialWins: false, // Don't avoid wins
      avoidTrivialWinsProbability: 0,
      teachHumans: false,
      maintainBalance: false
    },
    performanceTargets: {
      winRate: 0.8, // AI should win 80% of games
      avgGameLength: 18,
      mistakeRate: 0.02 // 2% chance of suboptimal moves
    }
  },
  // Levels 21-25: Ultimate
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
      winRate: 0.95, // AI should win 95% of games
      avgGameLength: 15,
      mistakeRate: 0 // No intentional mistakes
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
      }
    };
  }
  
  return config;
}