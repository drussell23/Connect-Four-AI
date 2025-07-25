import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { AIIntegrationModule } from '../../src/ai/ai-integration.module';
import { AdaptiveAIOrchestrator } from '../../src/ai/adaptive/adaptive-ai-orchestrator';
import { AsyncAIOrchestrator } from '../../src/ai/async/async-ai-orchestrator';
import { StrategicAIEngine } from '../../src/ai/strategy/strategic-ai-engine';
import { EnhancedThreatDetector } from '../../src/ai/threat-detection/enhanced-threat-detector';
import { AIStabilityManager } from '../../src/ai/stability/AIStabilityManager';
import { CellValue } from '../../src/ai/connect4AI';
import { getDifficultyConfig } from '../../src/ai/config/difficulty-config';

describe('AI System Integration Tests', () => {
  let module: TestingModule;
  let adaptiveOrchestrator: AdaptiveAIOrchestrator;
  let asyncOrchestrator: AsyncAIOrchestrator;
  let strategicEngine: StrategicAIEngine;
  let threatDetector: EnhancedThreatDetector;
  let stabilityManager: AIStabilityManager;

  beforeAll(async () => {
    // Create a test module with all AI components
    module = await Test.createTestingModule({
      imports: [AIIntegrationModule],
      providers: [
        {
          provide: EventEmitter,
          useValue: new EventEmitter(),
        },
      ],
    }).compile();

    // Get instances of key components
    adaptiveOrchestrator = module.get<AdaptiveAIOrchestrator>(AdaptiveAIOrchestrator);
    asyncOrchestrator = module.get<AsyncAIOrchestrator>(AsyncAIOrchestrator);
    strategicEngine = module.get<StrategicAIEngine>(StrategicAIEngine);
    threatDetector = module.get<EnhancedThreatDetector>(EnhancedThreatDetector);
    stabilityManager = module.get<AIStabilityManager>(AIStabilityManager);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Core Component Integration', () => {
    it('Should have all core AI components initialized', () => {
      expect(adaptiveOrchestrator).toBeDefined();
      expect(asyncOrchestrator).toBeDefined();
      expect(strategicEngine).toBeDefined();
      expect(threatDetector).toBeDefined();
      expect(stabilityManager).toBeDefined();
    });

    it('Should integrate adaptive and async orchestrators', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // Test adaptive orchestrator
      const adaptiveMove = await adaptiveOrchestrator.getOptimalMove(board, 'Yellow', 15);
      expect(adaptiveMove).toBeDefined();
      expect(adaptiveMove.column).toBeGreaterThanOrEqual(0);
      expect(adaptiveMove.column).toBeLessThanOrEqual(6);

      // Test async orchestrator
      const asyncMove = await asyncOrchestrator.getMove(board, 'Yellow', 15);
      expect(asyncMove).toBeDefined();
      expect(asyncMove.column).toBeGreaterThanOrEqual(0);
      expect(asyncMove.column).toBeLessThanOrEqual(6);
    });
  });

  describe('Threat Detection Integration', () => {
    it('Should detect and prioritize immediate threats', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const threats = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(threats).toBeDefined();
      expect(threats.immediateBlocks.length).toBeGreaterThan(0);
      expect(threats.immediateBlocks[0].column).toBe(3); // Should block column 3
      expect(threats.immediateBlocks[0].direction).toBe('vertical');
    });

    it('Should integrate threat detection with strategic engine', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Empty', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Yellow', 'Yellow', 'Empty', 'Empty'],
        ['Red', 'Red', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
      ];

      const move = await strategicEngine.getStrategicMove(board, 'Yellow', 20);
      
      // Should either win (column 1 or 5) or block opponent threat
      expect([1, 5]).toContain(move.column);
      expect(move.reasoning).toMatch(/win|block/i);
    });
  });

  describe('Stability System Integration', () => {
    it('Should handle component failures gracefully', async () => {
      // Simulate a complex board state that might cause issues
      const complexBoard: CellValue[][] = [
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Empty', 'Yellow', 'Red', 'Yellow'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
      ];

      // Should still return a valid move even with complex state
      const move = await adaptiveOrchestrator.getOptimalMove(complexBoard, 'Yellow', 25);
      expect(move).toBeDefined();
      expect(move.column).toBe(3); // Only valid move
    });

    it('Should utilize fallback mechanisms when needed', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Test stability manager's decision making
      const decision = await stabilityManager.makeDecision({
        board,
        currentPlayer: 'Yellow' as CellValue,
        difficulty: 15,
        timeLimit: 100, // Very short time limit to trigger fallback
      });

      expect(decision).toBeDefined();
      expect(decision.column).toBeGreaterThanOrEqual(0);
      expect(decision.column).toBeLessThanOrEqual(6);
    });
  });

  describe('Difficulty Configuration Integration', () => {
    it('Should apply difficulty settings across all components', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // Test different difficulty levels
      const levels = [1, 10, 20, 25];
      const moves = [];

      for (const level of levels) {
        const config = getDifficultyConfig(level);
        const move = await strategicEngine.getStrategicMove(board, 'Yellow', level);
        
        moves.push({
          level,
          column: move.column,
          score: move.score,
          blockingPriority: config.behaviorProfile.blockingPriority,
        });
      }

      // Higher levels should consistently block the threat
      expect(moves[0].blockingPriority).toBeLessThan(moves[3].blockingPriority);
      
      // Level 20+ should always block column 3
      expect(moves[2].column).toBe(3);
      expect(moves[3].column).toBe(3);
    });
  });

  describe('Performance and Caching Integration', () => {
    it('Should utilize caching for repeated positions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      // First call - should compute
      const start1 = Date.now();
      const move1 = await asyncOrchestrator.getMove(board, 'Yellow', 15);
      const time1 = Date.now() - start1;

      // Second call - should use cache
      const start2 = Date.now();
      const move2 = await asyncOrchestrator.getMove(board, 'Yellow', 15);
      const time2 = Date.now() - start2;

      expect(move1.column).toBe(move2.column);
      expect(time2).toBeLessThanOrEqual(time1 * 0.5); // Cache should be faster
    });
  });

  describe('Multi-Strategy Integration', () => {
    it('Should select appropriate strategies based on game state', async () => {
      // Early game
      const earlyBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Mid game
      const midBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];

      // End game
      const endBoard: CellValue[][] = [
        ['Red', 'Yellow', 'Red', 'Empty', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Empty', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Empty', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
      ];

      const earlyMove = await adaptiveOrchestrator.getOptimalMove(earlyBoard, 'Yellow', 20);
      const midMove = await adaptiveOrchestrator.getOptimalMove(midBoard, 'Yellow', 20);
      const endMove = await adaptiveOrchestrator.getOptimalMove(endBoard, 'Yellow', 20);

      // Early game should focus on center columns
      expect([2, 3, 4]).toContain(earlyMove.column);
      
      // Mid game should be more strategic
      expect(midMove.reasoning).toMatch(/strategic|position|control/i);
      
      // End game should find the only valid column
      expect(endMove.column).toBe(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('Should recover from invalid board states', async () => {
      // Invalid board with floating pieces
      const invalidBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'], // Floating piece
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      // Should handle gracefully and return a valid move
      const move = await adaptiveOrchestrator.getOptimalMove(invalidBoard, 'Yellow', 15);
      expect(move).toBeDefined();
      expect(move.column).toBeGreaterThanOrEqual(0);
      expect(move.column).toBeLessThanOrEqual(6);
    });
  });
});