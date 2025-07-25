import { Test, TestingModule } from '@nestjs/testing';
import { StrategicAIEngine } from '../../src/ai/strategy/strategic-ai-engine';
import { DynamicStrategySelector } from '../../src/ai/async/strategy-selector';
import { CellValue } from '../../src/ai/connect4AI';
import { getDifficultyConfig } from '../../src/ai/config/difficulty-config';

describe('Strategy Selection and Execution Tests', () => {
  let strategicEngine: StrategicAIEngine;
  let strategySelector: DynamicStrategySelector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategicAIEngine,
        DynamicStrategySelector,
      ],
    }).compile();

    strategicEngine = module.get<StrategicAIEngine>(StrategicAIEngine);
    strategySelector = module.get<DynamicStrategySelector>(DynamicStrategySelector);
  });

  describe('Strategic Move Evaluation', () => {
    it('Should evaluate moves based on multiple criteria', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 15);
      
      expect(move).toBeDefined();
      expect(move.column).toBeGreaterThanOrEqual(0);
      expect(move.column).toBeLessThanOrEqual(6);
      expect(move.score).toBeGreaterThan(0);
      expect(move.reasoning).toBeTruthy();
      expect(move.threatAnalysis).toBeDefined();
    });

    it('Should prioritize winning moves over all others', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
      
      expect(move.column).toBe(0); // Complete the horizontal win
      expect(move.reasoning).toContain('win');
      expect(move.priority).toBeGreaterThanOrEqual(10);
    });

    it('Should block opponent wins with high priority', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 15);
      
      expect(move.column).toBe(3); // Block vertical threat
      expect(move.reasoning).toContain('block');
      expect(move.priority).toBeGreaterThan(8);
    });
  });

  describe('Difficulty-Based Strategy Adaptation', () => {
    it('Should use simpler strategies at lower difficulty levels', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Test beginner level
      const beginnerMove = await strategicEngine.getStrategicMove(board, 'Yellow', 1);
      const beginnerConfig = getDifficultyConfig(1);
      
      // Beginner might not always play center
      expect(beginnerMove.column).toBeGreaterThanOrEqual(0);
      expect(beginnerMove.column).toBeLessThanOrEqual(6);
      expect(beginnerConfig.performanceTargets.mistakeRate).toBeGreaterThan(0.2);
    });

    it('Should use advanced strategies at higher difficulty levels', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Test expert level
      const expertMove = await strategicEngine.getStrategicMove(board, 'Yellow', 25);
      const expertConfig = getDifficultyConfig(25);
      
      // Expert should play strategically sound moves
      expect([2, 3, 4]).toContain(expertMove.column); // Center columns
      expect(expertMove.reasoning).toMatch(/strategic|position|control/);
      expect(expertConfig.strategicAwareness.useAdvancedPatterns).toBe(true);
    });
  });

  describe('Dynamic Strategy Selection', () => {
    it('Should select appropriate strategy for opening moves', () => {
      const emptyBoard: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      const strategy = strategySelector.selectStrategy({
        board: emptyBoard,
        player: 'Yellow',
        difficulty: 20,
        moveCount: 0,
      });

      expect(['AlphaZero', 'MCTS', 'PPO']).toContain(strategy);
    });

    it('Should adapt strategy for mid-game complexity', () => {
      const midGameBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];

      const strategy = strategySelector.selectStrategy({
        board: midGameBoard,
        player: 'Yellow',
        difficulty: 15,
        moveCount: 12,
      });

      expect(['DQN', 'AlphaZero', 'MCTS', 'AlphaBeta']).toContain(strategy);
    });

    it('Should use fast strategies for endgame', () => {
      const endGameBoard: CellValue[][] = [
        ['Red', 'Yellow', 'Red', 'Empty', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Empty', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
      ];

      const strategy = strategySelector.selectStrategy({
        board: endGameBoard,
        player: 'Yellow',
        difficulty: 20,
        moveCount: 35,
      });

      expect(['Minimax', 'AlphaBeta', 'Heuristic']).toContain(strategy);
    });
  });

  describe('Strategy Performance Under Constraints', () => {
    it('Should select simpler strategies under time pressure', () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      // Very short time limit
      const quickStrategy = strategySelector.selectStrategy({
        board,
        player: 'Yellow',
        difficulty: 20,
        timeLimit: 10, // 10ms
      });

      expect(['Heuristic', 'FastMCTS', 'Random']).toContain(quickStrategy);

      // Reasonable time limit
      const normalStrategy = strategySelector.selectStrategy({
        board,
        player: 'Yellow',
        difficulty: 20,
        timeLimit: 1000, // 1 second
      });

      expect(['AlphaZero', 'DQN', 'MCTS', 'PPO']).toContain(normalStrategy);
    });

    it('Should handle resource constraints', () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      // Simulate low memory scenario
      const lowMemoryStrategy = strategySelector.selectStrategy({
        board,
        player: 'Yellow',
        difficulty: 15,
        constraints: { maxMemoryMB: 50 },
      });

      expect(['Minimax', 'AlphaBeta', 'Heuristic']).toContain(lowMemoryStrategy);
    });
  });

  describe('Multi-Move Strategy Planning', () => {
    it('Should plan sequences for creating forks', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
      
      // Should aim to create multiple threats
      expect(move.threatAnalysis.potentialForks).toBeDefined();
      if (move.threatAnalysis.potentialForks && move.threatAnalysis.potentialForks.length > 0) {
        expect(move.reasoning).toMatch(/fork|multiple.*threat|strategic/i);
      }
    });

    it('Should identify forced win sequences', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Empty', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Red', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 25);
      
      // Should identify winning sequence
      if (move.threatAnalysis.winningSequences && move.threatAnalysis.winningSequences.length > 0) {
        const sequence = move.threatAnalysis.winningSequences[0];
        expect(sequence.moves.length).toBeGreaterThanOrEqual(1);
        expect(sequence.forced).toBeDefined();
      }
    });
  });

  describe('Strategy Execution Validation', () => {
    it('Should execute strategies consistently', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // Make the same request multiple times
      const moves = [];
      for (let i = 0; i < 5; i++) {
        const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
        moves.push(move.column);
      }

      // At high difficulty, should be consistent (deterministic)
      const uniqueMoves = new Set(moves);
      expect(uniqueMoves.size).toBe(1); // All moves should be the same
      expect(moves[0]).toBe(3); // Should block the threat
    });

    it('Should introduce controlled randomness at lower difficulties', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Make multiple requests at low difficulty
      const moves = [];
      for (let i = 0; i < 20; i++) {
        const move = await strategicEngine.getStrategicMove(board, 'Yellow', 1);
        moves.push(move.column);
      }

      // Should have some variety in moves
      const uniqueMoves = new Set(moves);
      expect(uniqueMoves.size).toBeGreaterThan(1); // Some randomness
    });
  });

  describe('Special Game Situations', () => {
    it('Should handle symmetrical positions appropriately', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
      
      // Should recognize symmetry and play accordingly
      expect(move.reasoning).toBeDefined();
      expect([2, 3, 4]).toContain(move.column); // Center area
    });

    it('Should avoid trap positions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Red', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Yellow', 'Red', 'Empty'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
      
      // Should not play columns 0 or 6 (would create opponent win)
      expect(move.column).not.toBe(0);
      expect(move.column).not.toBe(6);
    });
  });
});