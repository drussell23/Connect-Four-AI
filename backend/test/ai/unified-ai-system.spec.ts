import { Test, TestingModule } from '@nestjs/testing';
import { UnifiedThreatDetectorService, Board, CellValue } from '../../src/ai/unified/unified-threat-detector.service';
import { UnifiedAIEngineService, AIEngineConfig } from '../../src/ai/unified/unified-ai-engine.service';
import { UnifiedAICoordinatorService } from '../../src/ai/unified/unified-ai-coordinator.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Unified AI System Integration', () => {
  let threatDetector: UnifiedThreatDetectorService;
  let aiEngine: UnifiedAIEngineService;
  let coordinator: UnifiedAICoordinatorService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnifiedThreatDetectorService,
        UnifiedAIEngineService,
        UnifiedAICoordinatorService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    threatDetector = module.get<UnifiedThreatDetectorService>(UnifiedThreatDetectorService);
    aiEngine = module.get<UnifiedAIEngineService>(UnifiedAIEngineService);
    coordinator = module.get<UnifiedAICoordinatorService>(UnifiedAICoordinatorService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('UnifiedThreatDetectorService', () => {
    it('should detect immediate winning moves', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(0); // Should take the winning move
    });

    it('should prioritize blocking over other moves', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(0); // Should block the vertical threat
    });

    it('should analyze complex board states', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeBoardThreats(board, 'Yellow', 'Red');
      
      expect(analysis.immediateWins.length).toBeGreaterThanOrEqual(0);
      expect(analysis.immediateBlocks.length).toBeGreaterThanOrEqual(0);
      expect(analysis.bestMove).toBeGreaterThanOrEqual(-1);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should detect fork opportunities', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeBoardThreats(board, 'Yellow', 'Red');
      expect(analysis.forkThreats.length).toBeGreaterThan(0);
    });
  });

  describe('UnifiedAIEngineService', () => {
    it('should make basic decisions at low difficulty', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ];

      const config: AIEngineConfig = {
        difficulty: 1,
        useCache: false
      };

      const decision = await aiEngine.makeDecision(board, 'Yellow', config);
      
      expect(decision.column).toBeGreaterThanOrEqual(0);
      expect(decision.column).toBeLessThan(7);
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.strategy).toBeDefined();
      expect(decision.explanation).toBeDefined();
    });

    it('should make advanced decisions at high difficulty', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const config: AIEngineConfig = {
        difficulty: 10,
        useCache: true
      };

      const decision = await aiEngine.makeDecision(board, 'Yellow', config);
      
      expect(decision.strategy).toContain('advanced');
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.threatAnalysis).toBeDefined();
    });

    it('should handle time-critical decisions', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await aiEngine.makeQuickDecision(board, 'Yellow');
      expect(move).toBe(0); // Should block the immediate threat
    });

    it('should use cache when enabled', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const config: AIEngineConfig = {
        difficulty: 5,
        useCache: true
      };

      // First call
      const decision1 = await aiEngine.makeDecision(board, 'Yellow', config);
      expect(decision1.cacheHit).toBe(false);

      // Second call with same board
      const decision2 = await aiEngine.makeDecision(board, 'Yellow', config);
      expect(decision2.cacheHit).toBe(true);
      expect(decision2.column).toBe(decision1.column);
    });
  });

  describe('UnifiedAICoordinatorService', () => {
    it('should coordinate AI moves through unified system', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      await coordinator.onModuleInit();

      const response = await coordinator.getAIMove(
        'test-game-id',
        board,
        'Yellow',
        5
      );

      expect(response.move).toBeGreaterThanOrEqual(0);
      expect(response.move).toBeLessThan(7);
      expect(response.decision).toBeDefined();
      expect(response.source).toBe('unified');
      expect(response.metadata.threatDetectionUsed).toBe(true);
    });

    it('should handle quick moves efficiently', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const startTime = Date.now();
      const move = await coordinator.getQuickMove(board, 'Yellow');
      const elapsed = Date.now() - startTime;

      expect(move).toBe(0); // Should block
      expect(elapsed).toBeLessThan(100); // Should be very fast
    });

    it('should provide system status', () => {
      const status = coordinator.getSystemStatus();
      
      expect(status.initialized).toBeDefined();
      expect(status.mode).toBeDefined();
      expect(status.availableSystems).toBeDefined();
      expect(status.availableSystems.unified).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle the exact scenario from user screenshot', async () => {
      // Recreating the board state where AI failed to block vertical threat
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // Test threat detector
      const immediateMove = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(immediateMove).toBe(3); // Must block column 3

      // Test AI engine
      const config: AIEngineConfig = { difficulty: 5, useCache: false };
      const decision = await aiEngine.makeDecision(board, 'Yellow', config);
      expect(decision.column).toBe(3); // Must block column 3

      // Test coordinator
      await coordinator.onModuleInit();
      const response = await coordinator.getAIMove('test-game', board, 'Yellow', 5);
      expect(response.move).toBe(3); // Must block column 3
    });

    it('should handle complex multi-threat scenarios', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeBoardThreats(board, 'Yellow', 'Red');
      
      // Should detect multiple threats
      expect(analysis.immediateBlocks.length + analysis.setupMoves.length).toBeGreaterThan(0);
      
      // AI should make a strategic decision
      const config: AIEngineConfig = { difficulty: 8, useCache: false };
      const decision = await aiEngine.makeDecision(board, 'Yellow', config);
      
      expect(decision.column).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.threatAnalysis).toBeDefined();
    });
  });
});