import { getDifficultyConfig } from '../../src/ai/config/difficulty-config';

describe('AI Difficulty Configuration Tests', () => {
  describe('Blocking Priority Progression', () => {
    it('Should have increasing blocking priorities from level 1 to 25', () => {
      let previousPriority = 0;
      
      for (let level = 1; level <= 25; level++) {
        const config = getDifficultyConfig(level);
        const blockingPriority = config.behaviorProfile.blockingPriority;
        
        // Verify blocking priority increases or stays the same
        expect(blockingPriority).toBeGreaterThanOrEqual(previousPriority);
        
        // Log the progression
        console.log(`Level ${level}: Blocking Priority = ${blockingPriority.toFixed(3)}`);
        
        previousPriority = blockingPriority;
      }
    });

    it('Should meet minimum blocking priority thresholds', () => {
      // Test specific levels for minimum values
      const thresholds = [
        { level: 1, minPriority: 0.65 },
        { level: 5, minPriority: 0.70 },
        { level: 10, minPriority: 0.77 },
        { level: 15, minPriority: 0.83 },
        { level: 20, minPriority: 0.90 },
        { level: 25, minPriority: 0.97 }
      ];
      
      for (const { level, minPriority } of thresholds) {
        const config = getDifficultyConfig(level);
        expect(config.behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(minPriority);
        console.log(`Level ${level}: Expected >= ${minPriority}, Got ${config.behaviorProfile.blockingPriority.toFixed(3)}`);
      }
    });
  });

  describe('Mistake Rate Progression', () => {
    it('Should have decreasing mistake rates from level 1 to 25', () => {
      let previousMistakeRate = 1;
      
      for (let level = 1; level <= 25; level++) {
        const config = getDifficultyConfig(level);
        const mistakeRate = config.performanceTargets.mistakeRate;
        
        // Verify mistake rate decreases or stays the same
        expect(mistakeRate).toBeLessThanOrEqual(previousMistakeRate);
        
        // Log the progression
        console.log(`Level ${level}: Mistake Rate = ${(mistakeRate * 100).toFixed(1)}%`);
        
        previousMistakeRate = mistakeRate;
      }
    });

    it('Should have significantly reduced mistake rates at higher levels', () => {
      const config1 = getDifficultyConfig(1);
      const config10 = getDifficultyConfig(10);
      const config20 = getDifficultyConfig(20);
      const config25 = getDifficultyConfig(25);
      
      // Beginner makes mistakes often
      expect(config1.performanceTargets.mistakeRate).toBeGreaterThanOrEqual(0.25);
      
      // Intermediate makes fewer mistakes
      expect(config10.performanceTargets.mistakeRate).toBeLessThanOrEqual(0.15);
      
      // Expert rarely makes mistakes
      expect(config20.performanceTargets.mistakeRate).toBeLessThanOrEqual(0.05);
      
      // Ultimate almost never makes mistakes
      expect(config25.performanceTargets.mistakeRate).toBeLessThanOrEqual(0.01);
    });
  });

  describe('Strategic Awareness', () => {
    it('Should enable advanced features at higher levels', () => {
      const beginnerConfig = getDifficultyConfig(1);
      const intermediateConfig = getDifficultyConfig(10);
      const expertConfig = getDifficultyConfig(20);
      
      // Beginners don't use advanced patterns
      expect(beginnerConfig.strategicAwareness.useAdvancedPatterns).toBe(false);
      expect(beginnerConfig.strategicAwareness.createForks).toBe(false);
      
      // Intermediate players start using some advanced features
      expect(intermediateConfig.strategicAwareness.detectForks).toBe(true);
      expect(intermediateConfig.strategicAwareness.blockForks).toBe(true);
      
      // Experts use all advanced features
      expect(expertConfig.strategicAwareness.useAdvancedPatterns).toBe(true);
      expect(expertConfig.strategicAwareness.createForks).toBe(true);
      expect(expertConfig.strategicAwareness.lookAhead).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Behavior Profile', () => {
    it('Should balance aggressiveness and defensiveness appropriately', () => {
      for (let level = 1; level <= 25; level += 5) {
        const config = getDifficultyConfig(level);
        const { aggressiveness, defensiveness, randomness } = config.behaviorProfile;
        
        // Verify total doesn't exceed reasonable bounds
        expect(aggressiveness + defensiveness).toBeLessThanOrEqual(2);
        
        // Higher levels should have less randomness
        if (level >= 15) {
          expect(randomness).toBeLessThanOrEqual(0.1);
        }
        
        console.log(`Level ${level}: Aggr=${aggressiveness.toFixed(2)}, Def=${defensiveness.toFixed(2)}, Rand=${randomness.toFixed(2)}`);
      }
    });
  });

  describe('Interpolation Between Levels', () => {
    it('Should smoothly interpolate between defined levels', () => {
      // Test interpolation between levels 5 and 10
      const level5 = getDifficultyConfig(5);
      const level7 = getDifficultyConfig(7); // Interpolated
      const level10 = getDifficultyConfig(10);
      
      // Blocking priority should be between level 5 and 10
      expect(level7.behaviorProfile.blockingPriority).toBeGreaterThan(level5.behaviorProfile.blockingPriority);
      expect(level7.behaviorProfile.blockingPriority).toBeLessThan(level10.behaviorProfile.blockingPriority);
      
      // Mistake rate should be between level 5 and 10
      expect(level7.performanceTargets.mistakeRate).toBeLessThan(level5.performanceTargets.mistakeRate);
      expect(level7.performanceTargets.mistakeRate).toBeGreaterThan(level10.performanceTargets.mistakeRate);
    });
  });
});