import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedThreatDetector } from '../../src/ai/threat-detection/enhanced-threat-detector';
import { StrategicAIEngine } from '../../src/ai/strategy/strategic-ai-engine';
import { AdaptiveAIOrchestrator } from '../../src/ai/adaptive/adaptive-ai-orchestrator';
import { DIFFICULTY_CONFIGS, getDifficultyConfig, DifficultyConfig } from '../../src/ai/config/difficulty-config';
import { CellValue } from '../../src/ai/connect4AI';

// Helper to convert numeric board representation to CellValue
function convertBoard(numBoard: number[][]): CellValue[][] {
  return numBoard.map(row => row.map(cell => {
    if (cell === 0) return 'Empty';
    if (cell === 1) return 'Red';
    if (cell === 2) return 'Yellow';
    return 'Empty';
  }));
}

// Helper to convert player number to CellValue
function convertPlayer(player: number): CellValue {
  return player === 1 ? 'Red' : 'Yellow';
}

describe('AI Blocking Comprehensive Tests', () => {
  let threatDetector: EnhancedThreatDetector;
  let strategicEngine: StrategicAIEngine;
  let aiOrchestrator: AdaptiveAIOrchestrator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedThreatDetector,
        StrategicAIEngine,
        AdaptiveAIOrchestrator,
      ],
    }).compile();

    threatDetector = module.get<EnhancedThreatDetector>(EnhancedThreatDetector);
    strategicEngine = module.get<StrategicAIEngine>(StrategicAIEngine);
    aiOrchestrator = module.get<AdaptiveAIOrchestrator>(AdaptiveAIOrchestrator);
  });

  describe('Vertical Threat Blocking', () => {
    // Test each difficulty level's ability to block vertical threats
    for (let level = 1; level <= 25; level++) {
      it(`Level ${level} should block immediate vertical win threats`, async () => {
        // Setup: Opponent has 3 in a column with space on top
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0], // Row 3
          [0, 0, 0, 1, 0, 0, 0], // Row 4
          [0, 0, 0, 1, 0, 0, 0], // Row 5 (bottom)
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 3, col: 3, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // AI should block at column 3, row 2
        expect(move.column).toBe(3);
        expect(move.score).toBeGreaterThan(0.9);
        
        // Verify the blocking priority is appropriate for this level
        const minBlockingPriority = getMinBlockingPriorityForLevel(level);
        expect(config.behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(minBlockingPriority);
      });

      it(`Level ${level} should detect and block setup vertical threats`, async () => {
        // Setup: Opponent has 2 in a column with spaces
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 2, 1, 2, 0, 0], // Row 4
          [0, 0, 2, 1, 2, 0, 0], // Row 5 (bottom)
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 4, col: 3, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // For higher levels, AI should block the developing threat
        if (level >= 10) {
          expect(move.column).toBe(3);
        }
      });
    }
  });

  describe('Horizontal Threat Blocking', () => {
    for (let level = 1; level <= 25; level++) {
      it(`Level ${level} should block immediate horizontal win threats`, async () => {
        // Setup: Opponent has 3 in a row with space on the right
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 0, 2, 2, 0], // Bottom row
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 5, col: 2, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // AI should block at column 3
        expect(move.column).toBe(3);
        expect(move.score).toBeGreaterThan(0.85);
      });

      it(`Level ${level} should handle split horizontal threats`, async () => {
        // Setup: Opponent has split threat (X_XX pattern)
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 1, 0, 1, 1, 2, 0], // Bottom row
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 5, col: 4, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // For higher levels, AI should block at column 2
        if (level >= 15) {
          expect(move.column).toBe(2);
        }
      });
    }
  });

  describe('Diagonal Threat Blocking', () => {
    for (let level = 1; level <= 25; level++) {
      it(`Level ${level} should block immediate diagonal-right win threats`, async () => {
        // Setup: Opponent has 3 in diagonal-right with space
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0], // Row 2
          [0, 0, 1, 2, 0, 0, 0], // Row 3
          [0, 1, 2, 2, 0, 0, 0], // Row 4
          [0, 2, 1, 1, 2, 0, 0], // Row 5 (bottom)
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 2, col: 3, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // AI should block at column 4, row 1
        expect(move.column).toBe(4);
        expect(move.score).toBeGreaterThan(0.9);
      });

      it(`Level ${level} should block immediate diagonal-left win threats`, async () => {
        // Setup: Opponent has 3 in diagonal-left with space
        const board = [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0], // Row 2
          [0, 0, 0, 2, 1, 0, 0], // Row 3
          [0, 0, 0, 2, 2, 1, 0], // Row 4
          [0, 0, 0, 1, 1, 2, 1], // Row 5 (bottom)
        ];
        
        const gameState = {
          board,
          currentPlayer: 2,
          lastMove: { row: 2, col: 3, player: 1 },
          moveHistory: [],
          winner: null,
          isDraw: false,
        };

        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), level);
        
        // AI should block at column 2
        expect(move.column).toBe(2);
        expect(move.score).toBeGreaterThan(0.9);
      });
    }
  });

  describe('Multi-Threat Scenarios', () => {
    it('Should prioritize immediate wins over blocks', async () => {
      // Setup: AI can win OR block opponent win
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 2, 0, 0],
        [0, 2, 2, 1, 2, 0, 0], // AI can win at col 0 or 5
      ];
      
      const gameState = {
        board,
        currentPlayer: 2,
        lastMove: { row: 3, col: 3, player: 1 },
        moveHistory: [],
        winner: null,
        isDraw: false,
      };

      const config = getDifficultyConfig(20); // High level
      const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), 20);
      
      // AI should choose to win rather than block
      expect([0, 5]).toContain(move.column);
    });

    it('Should handle multiple simultaneous threats intelligently', async () => {
      // Setup: Opponent has threats in multiple directions
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 0], // Horizontal setup
        [0, 0, 1, 2, 1, 0, 0], // Vertical and horizontal threats
        [0, 0, 2, 2, 2, 1, 0], // Bottom row
      ];
      
      const gameState = {
        board,
        currentPlayer: 2,
        lastMove: { row: 4, col: 4, player: 1 },
        moveHistory: [],
        winner: null,
        isDraw: false,
      };

      const threats = threatDetector.analyzeThreat(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer));
      expect(threats.immediateBlocks.length + threats.openThrees.length).toBeGreaterThan(1);

      const config = getDifficultyConfig(25); // Ultimate level
      const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), 25);
      
      // AI should block one of the critical threats
      expect(move.score).toBeGreaterThan(9000);
    });
  });

  describe('Difficulty Progression Validation', () => {
    it('Should show increasing blocking priority across levels', () => {
      let previousPriority = 0;
      
      for (let level = 1; level <= 25; level++) {
        const config = getDifficultyConfig(level);
        expect(config.behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(previousPriority);
        previousPriority = config.behaviorProfile.blockingPriority;
      }
    });

    it('Should show decreasing mistake rates across levels', () => {
      let previousMistakeRate = 1;
      
      for (let level = 1; level <= 25; level++) {
        const config = getDifficultyConfig(level);
        expect(config.performanceTargets.mistakeRate).toBeLessThanOrEqual(previousMistakeRate);
        previousMistakeRate = config.performanceTargets.mistakeRate;
      }
    });

    it('Should maintain minimum blocking thresholds', () => {
      // Verify minimum blocking priorities
      expect(getDifficultyConfig(1).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.65);
      expect(getDifficultyConfig(5).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.70);
      expect(getDifficultyConfig(10).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.77);
      expect(getDifficultyConfig(15).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.83);
      expect(getDifficultyConfig(20).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.90);
      expect(getDifficultyConfig(25).behaviorProfile.blockingPriority).toBeGreaterThanOrEqual(0.97);
    });
  });

  describe('Performance Benchmarks', () => {
    it('Should make decisions within acceptable time limits', async () => {
      const board = createComplexBoard();
      const gameState = {
        board,
        currentPlayer: 2,
        lastMove: { row: 3, col: 3, player: 1 },
        moveHistory: [],
        winner: null,
        isDraw: false,
      };

      for (let level = 1; level <= 25; level++) {
        const config = getDifficultyConfig(level);
        const startTime = Date.now();
        const move = await strategicEngine.getStrategicMove(gameState.board, convertPlayer(gameState.currentPlayer), level);
        const elapsed = Date.now() - startTime;
        
        // Verify decision time is reasonable
        expect(elapsed).toBeLessThan(1000); // Should decide within 1 second
        
        // Higher levels may take slightly longer but should still be fast
        if (level >= 20) {
          expect(elapsed).toBeLessThan(500); // Elite AI should be optimized
        }
      }
    });
  });

  describe('Edge Cases and Special Scenarios', () => {
    it('Should handle full columns gracefully', async () => {
      const board = [
        [1, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 1, 0, 0, 0],
        [1, 0, 0, 1, 0, 0, 0],
        [2, 0, 0, 1, 0, 0, 0], // Column 0 is full, col 3 has winning threat
      ];
      
      const gameState = {
        board,
        currentPlayer: 2,
        lastMove: { row: 3, col: 3, player: 1 },
        moveHistory: [],
        winner: null,
        isDraw: false,
      };

      const config = getDifficultyConfig(15);
      const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), 15);
      
      // Should not try to play in full column
      expect(move.column).not.toBe(0);
      // Should block the threat
      expect(move.column).toBe(3);
    });

    it('Should handle near-draw situations intelligently', async () => {
      // Almost full board with limited options
      const board = [
        [1, 2, 1, 0, 2, 1, 2],
        [2, 1, 2, 0, 1, 2, 1],
        [1, 2, 1, 0, 2, 1, 2],
        [2, 1, 2, 1, 1, 2, 1],
        [1, 2, 1, 2, 2, 1, 2],
        [2, 1, 2, 1, 1, 2, 1],
      ];
      
      const gameState = {
        board,
        currentPlayer: 2,
        lastMove: { row: 3, col: 3, player: 1 },
        moveHistory: [],
        winner: null,
        isDraw: false,
      };

      const config = getDifficultyConfig(20);
      const move = await strategicEngine.getStrategicMove(convertBoard(gameState.board), convertPlayer(gameState.currentPlayer), 20);
      
      // Should play in one of the available columns
      expect(move.column).toBe(3);
    });
  });
});

// Helper functions

function getMinBlockingPriorityForLevel(level: number): number {
  if (level <= 5) return 0.65;
  if (level <= 10) return 0.70;
  if (level <= 15) return 0.80;
  if (level <= 20) return 0.85;
  return 0.90;
}

function createComplexBoard(): CellValue[][] {
  // Create a complex mid-game board state for performance testing
  const numBoard = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 2, 1, 0, 0, 0],
    [0, 1, 1, 2, 2, 0, 0],
    [0, 2, 2, 1, 1, 0, 0],
    [1, 1, 2, 2, 1, 2, 0],
  ];
  return convertBoard(numBoard);
}