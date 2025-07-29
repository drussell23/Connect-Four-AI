"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDifficultyConfig = exports.DIFFICULTY_CONFIGS = void 0;
exports.DIFFICULTY_CONFIGS = [
    // Level 1-3: Beginner - Learning the game, but still blocks obvious wins
    {
        level: 1,
        name: 'Beginner',
        rlhfEnabled: false,
        constitutionalPrinciples: {
            avoidTrivialWins: true,
            avoidTrivialWinsProbability: 0.4,
            teachHumans: true,
            maintainBalance: true
        },
        performanceTargets: {
            winRate: 0.15,
            avgGameLength: 30,
            mistakeRate: 0.3 // 30% chance of suboptimal moves - reduced from 40%
        },
        strategicAwareness: {
            detectOpenThrees: true,
            blockOpenThrees: true,
            createOpenThrees: false,
            detectForks: false,
            blockForks: false,
            createForks: false,
            lookAhead: 1,
            useAdvancedPatterns: false
        },
        behaviorProfile: {
            aggressiveness: 0.2,
            defensiveness: 0.5,
            randomness: 0.4,
            centerPreference: 0.3,
            blockingPriority: 0.65 // Much better at blocking immediate threats
        }
    },
    // Level 4-5: Easy - Developing defensive instincts
    {
        level: 4,
        name: 'Easy',
        rlhfEnabled: false,
        constitutionalPrinciples: {
            avoidTrivialWins: true,
            avoidTrivialWinsProbability: 0.25,
            teachHumans: true,
            maintainBalance: true
        },
        performanceTargets: {
            winRate: 0.25,
            avgGameLength: 28,
            mistakeRate: 0.12 // 12% chance of suboptimal moves
        },
        strategicAwareness: {
            detectOpenThrees: true,
            blockOpenThrees: true,
            createOpenThrees: false,
            detectForks: false,
            blockForks: false,
            createForks: false,
            lookAhead: 2,
            useAdvancedPatterns: false
        },
        behaviorProfile: {
            aggressiveness: 0.3,
            defensiveness: 0.65,
            randomness: 0.25,
            centerPreference: 0.4,
            blockingPriority: 0.8 // Reliable blocking across all directions
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
            winRate: 0.35,
            avgGameLength: 25,
            mistakeRate: 0.08 // 8% chance of suboptimal moves
        },
        strategicAwareness: {
            detectOpenThrees: true,
            blockOpenThrees: true,
            createOpenThrees: false,
            detectForks: true,
            blockForks: false,
            createForks: false,
            lookAhead: 3,
            useAdvancedPatterns: false
        },
        behaviorProfile: {
            aggressiveness: 0.4,
            defensiveness: 0.7,
            randomness: 0.2,
            centerPreference: 0.5,
            blockingPriority: 0.85 // Excellent threat recognition
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
            winRate: 0.5,
            avgGameLength: 22,
            mistakeRate: 0.05 // 5% chance of suboptimal moves
        },
        strategicAwareness: {
            detectOpenThrees: true,
            blockOpenThrees: true,
            createOpenThrees: true,
            detectForks: true,
            blockForks: true,
            createForks: false,
            lookAhead: 4,
            useAdvancedPatterns: false
        },
        behaviorProfile: {
            aggressiveness: 0.5,
            defensiveness: 0.75,
            randomness: 0.15,
            centerPreference: 0.6,
            blockingPriority: 0.88 // Near-perfect threat detection
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
            winRate: 0.65,
            avgGameLength: 20,
            mistakeRate: 0.03 // 3% chance of suboptimal moves
        },
        strategicAwareness: {
            detectOpenThrees: true,
            blockOpenThrees: true,
            createOpenThrees: true,
            detectForks: true,
            blockForks: true,
            createForks: true,
            lookAhead: 5,
            useAdvancedPatterns: true // Pattern recognition active
        },
        behaviorProfile: {
            aggressiveness: 0.65,
            defensiveness: 0.8,
            randomness: 0.08,
            centerPreference: 0.7,
            blockingPriority: 0.9 // Exceptional blocking ability
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
            winRate: 0.8,
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
            defensiveness: 0.85,
            randomness: 0.04,
            centerPreference: 0.8,
            blockingPriority: 0.93 // Near-perfect blocking
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
            winRate: 0.92,
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
            aggressiveness: 0.85,
            defensiveness: 0.95,
            randomness: 0.02,
            centerPreference: 0.9,
            blockingPriority: 0.97 // Near-perfect threat detection
        }
    }
];
function getDifficultyConfig(level) {
    // Find the appropriate config for the level
    let config = exports.DIFFICULTY_CONFIGS[0];
    for (const cfg of exports.DIFFICULTY_CONFIGS) {
        if (level >= cfg.level) {
            config = cfg;
        }
    }
    // Interpolate values for in-between levels
    const baseLevel = config.level;
    const nextConfig = exports.DIFFICULTY_CONFIGS.find(cfg => cfg.level > baseLevel);
    if (nextConfig && level > baseLevel && level < nextConfig.level) {
        const progress = (level - baseLevel) / (nextConfig.level - baseLevel);
        return {
            level,
            name: config.name,
            rlhfEnabled: level >= 7,
            constitutionalPrinciples: {
                avoidTrivialWins: config.constitutionalPrinciples.avoidTrivialWins,
                avoidTrivialWinsProbability: config.constitutionalPrinciples.avoidTrivialWinsProbability * (1 - progress) +
                    nextConfig.constitutionalPrinciples.avoidTrivialWinsProbability * progress,
                teachHumans: progress < 0.5 ? config.constitutionalPrinciples.teachHumans : nextConfig.constitutionalPrinciples.teachHumans,
                maintainBalance: progress < 0.5 ? config.constitutionalPrinciples.maintainBalance : nextConfig.constitutionalPrinciples.maintainBalance
            },
            performanceTargets: {
                winRate: config.performanceTargets.winRate * (1 - progress) +
                    nextConfig.performanceTargets.winRate * progress,
                avgGameLength: config.performanceTargets.avgGameLength * (1 - progress) +
                    nextConfig.performanceTargets.avgGameLength * progress,
                mistakeRate: config.performanceTargets.mistakeRate * (1 - progress) +
                    nextConfig.performanceTargets.mistakeRate * progress
            },
            strategicAwareness: {
                detectOpenThrees: true,
                blockOpenThrees: true,
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
exports.getDifficultyConfig = getDifficultyConfig;
