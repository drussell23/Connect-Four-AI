import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveAIOrchestrator } from '../adaptive/adaptive-ai-orchestrator';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { PerformanceMonitor } from '../async/performance-monitor';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';

describe('AI Difficulty Progression Tests', () => {
  let adaptiveAI: AdaptiveAIOrchestrator;
  let mockAsyncOrchestrator: Partial<AsyncAIOrchestrator>;
  let mockPerformanceMonitor: Partial<PerformanceMonitor>;
  let mockEventEmitter: Partial<EventEmitter2>;

  beforeEach(async () => {
    mockAsyncOrchestrator = {
      getAIMove: jest.fn().mockResolvedValue({ move: 3, confidence: 0.8 }),
      streamAnalysis: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'progress', data: { strategy: 'minimax', depth: 6 } };
          yield { type: 'move', data: { move: 3, confidence: 0.8 } };
        }
      })
    };

    mockPerformanceMonitor = {
      recordMetric: jest.fn(),
      recordError: jest.fn()
    };

    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveAIOrchestrator,
        { provide: AsyncAIOrchestrator, useValue: mockAsyncOrchestrator },
        { provide: PerformanceMonitor, useValue: mockPerformanceMonitor },
        { provide: EventEmitter2, useValue: mockEventEmitter }
      ],
    }).compile();

    adaptiveAI = module.get<AdaptiveAIOrchestrator>(AdaptiveAIOrchestrator);
  });

  describe('Difficulty Level Mapping', () => {
    const testCases = [
      { level: 1, expectedBackend: 1.0, category: 'Beginner' },
      { level: 5, expectedBackend: 3.0, category: 'Beginner' },
      { level: 10, expectedBackend: 5.0, category: 'Intermediate' },
      { level: 15, expectedBackend: 7.0, category: 'Advanced' },
      { level: 20, expectedBackend: 9.0, category: 'Expert' },
      { level: 24, expectedBackend: 9.75, category: 'Master' },
      { level: 25, expectedBackend: 10.0, category: 'Ultimate' }
    ];

    testCases.forEach(({ level, expectedBackend, category }) => {
      it(`Level ${level} (${category}) should map to backend ${expectedBackend}`, async () => {
        const board = createEmptyBoard();
        const result = await adaptiveAI.computeAdaptiveMove(
          'test-game',
          board,
          'Yellow',
          level
        );

        // Check that difficulty mapping was emitted
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'ai.difficulty.mapped',
          expect.objectContaining({
            frontendLevel: level,
            backendDifficulty: expect.closeTo(expectedBackend, 0.1),
            difficultyName: expect.stringContaining(category)
          })
        );
      });
    });
  });

  describe('AI Behavior by Difficulty', () => {
    it('Beginner (1-5): Should make occasional mistakes and use shallow search', async () => {
      const board = createBoardWithWinningMove();
      const moves: number[] = [];

      // Test multiple moves at beginner level
      for (let i = 0; i < 10; i++) {
        const result = await adaptiveAI.computeAdaptiveMove(
          'test-game',
          board,
          'Yellow',
          3 // Level 3 (Beginner)
        );
        moves.push(result.column);
      }

      // At beginner level, AI should not always find the winning move
      const winningMoveCount = moves.filter(m => m === 3).length;
      expect(winningMoveCount).toBeLessThan(10); // Should miss some wins
      expect(moves.length).toBe(10); // Verify we made 10 moves
    });

    it('Intermediate (6-10): Should block obvious threats consistently', async () => {
      const board = createBoardWithThreat();
      const result = await adaptiveAI.computeAdaptiveMove(
        'test-game',
        board,
        'Yellow',
        8 // Level 8 (Intermediate)
      );

      // Should block the threat
      expect(result.column).toBe(2); // Blocking column
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('Advanced (11-15): Should create multiple threats', async () => {
      const board = createStrategicBoard();
      const result = await adaptiveAI.computeAdaptiveMove(
        'test-game',
        board,
        'Yellow',
        13 // Level 13 (Advanced)
      );

      // Should make strategic moves
      expect(result.criticalityScore).toBeGreaterThan(0.5);
      expect(result.servicesUsed).toContain('async_orchestrator');
    });

    it('Expert (16-20): Should look deep and create traps', async () => {
      const board = createEmptyBoard();
      const result = await adaptiveAI.computeAdaptiveMove(
        'test-game',
        board,
        'Yellow',
        18 // Level 18 (Expert)
      );

      // Should use maximum analysis
      expect(result.computationTime).toBeGreaterThan(1500); // Takes time to think
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('Ultimate (25): Should play near-perfect moves', async () => {
      const board = createComplexBoard();
      const result = await adaptiveAI.computeAdaptiveMove(
        'test-game',
        board,
        'Yellow',
        25 // Level 25 (Ultimate)
      );

      // Should use all available resources
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.criticalityScore).toBeGreaterThan(0.7);
      expect(result.computationTime).toBeGreaterThan(2000);
    });
  });

  describe('Response Time Scaling', () => {
    it('Should scale response time with difficulty', async () => {
      const board = createEmptyBoard();
      const timings: { level: number; time: number }[] = [];

      for (const level of [1, 5, 10, 15, 20, 25]) {
        const start = Date.now();
        await adaptiveAI.computeAdaptiveMove('test-game', board, 'Yellow', level);
        const time = Date.now() - start;
        timings.push({ level, time });
      }

      // Higher levels should take more time
      expect(timings[5].time).toBeGreaterThan(timings[0].time);
      expect(timings[4].time).toBeGreaterThan(timings[2].time);
    });
  });

  describe('Search Depth Scaling', () => {
    it('Should increase search depth with difficulty', async () => {
      const testDepths = [
        { level: 1, minDepth: 4, maxDepth: 6 },
        { level: 10, minDepth: 6, maxDepth: 9 },
        { level: 20, minDepth: 10, maxDepth: 13 },
        { level: 25, minDepth: 12, maxDepth: 15 }
      ];

      for (const { level, minDepth, maxDepth } of testDepths) {
        const board = createEmptyBoard();
        
        // Spy on criticality analysis to check recommended depth
        const criticalitySpy = jest.spyOn(adaptiveAI as any, 'analyzeGameCriticality');
        
        await adaptiveAI.computeAdaptiveMove('test-game', board, 'Yellow', level);
        
        const criticality = criticalitySpy.mock.results[0].value;
        expect(criticality.recommendedDepth).toBeGreaterThanOrEqual(minDepth);
        expect(criticality.recommendedDepth).toBeLessThanOrEqual(maxDepth);
      }
    });
  });
});

// Helper functions to create test board states
function createEmptyBoard(): CellValue[][] {
  return Array(6).fill(null).map(() => Array(7).fill(null));
}

function createBoardWithWinningMove(): CellValue[][] {
  const board = createEmptyBoard();
  // Yellow can win by playing column 3
  board[5][0] = 'Yellow';
  board[5][1] = 'Yellow';
  board[5][2] = 'Yellow';
  // Column 3 is empty
  return board;
}

function createBoardWithThreat(): CellValue[][] {
  const board = createEmptyBoard();
  // Red threatens to win in column 2
  board[5][0] = 'Red';
  board[5][1] = 'Red';
  board[5][3] = 'Red';
  // Column 2 is empty
  return board;
}

function createStrategicBoard(): CellValue[][] {
  const board = createEmptyBoard();
  // Complex middle game position
  board[5][3] = 'Yellow';
  board[5][4] = 'Red';
  board[4][3] = 'Red';
  board[5][2] = 'Yellow';
  board[5][5] = 'Red';
  return board;
}

function createComplexBoard(): CellValue[][] {
  const board = createEmptyBoard();
  // Late game with multiple threats
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      if ((i + j) % 2 === 0) {
        board[5 - j][i] = 'Yellow';
      } else {
        board[5 - j][i] = 'Red';
      }
    }
  }
  return board;
}