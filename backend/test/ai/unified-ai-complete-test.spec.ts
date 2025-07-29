import { UnifiedThreatDetectorService, Board } from '../../src/ai/unified/unified-threat-detector.service';
import { UnifiedAISystem, UnifiedAIConfig } from '../../src/ai/unified/unified-ai-system';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Unified AI System - Complete Integration Test', () => {
  let unifiedAISystem: UnifiedAISystem;
  let threatDetector: UnifiedThreatDetectorService;
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    threatDetector = new UnifiedThreatDetectorService();
    eventEmitter = new EventEmitter2();
    
    // Create unified AI system with minimal dependencies
    unifiedAISystem = new UnifiedAISystem(
      threatDetector,
      eventEmitter
    );
  });

  describe('Core Functionality', () => {
    it('should detect and block vertical threats (user reported issue)', async () => {
      // Recreate exact scenario from user screenshot
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 5,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      
      expect(decision.move).toBe(3); // Must block column 3
      expect(decision.strategy).toContain('block');
      expect(decision.confidence).toBeGreaterThan(0.9);
    });

    it('should use quick move for time-critical situations', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const startTime = Date.now();
      const move = await unifiedAISystem.quickMove(board, 'Yellow');
      const elapsed = Date.now() - startTime;
      
      expect(move).toBe(0); // Should block
      expect(elapsed).toBeLessThan(100); // Should be very fast
    });

    it('should handle horizontal threats', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Yellow', 'Empty'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 5,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      expect(decision.move).toBe(3); // Should block horizontal threat
    });

    it('should handle diagonal threats', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 5,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      expect(decision.move).toBe(0); // Should block diagonal
    });
  });

  describe('Difficulty Levels', () => {
    it('should adapt strategy based on difficulty', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ];

      // Low difficulty
      const easyConfig: UnifiedAIConfig = {
        difficulty: 2,
        useCache: false
      };
      const easyDecision = await unifiedAISystem.makeMove(board, 'Yellow', easyConfig);
      expect(easyDecision.metadata.algorithm).toMatch(/minimax|basic/);

      // High difficulty
      const hardConfig: UnifiedAIConfig = {
        difficulty: 9,
        useCache: false
      };
      const hardDecision = await unifiedAISystem.makeMove(board, 'Yellow', hardConfig);
      expect(hardDecision.metadata.algorithm).toMatch(/alphazero|dqn|ppo|advanced/);
    });
  });

  describe('Caching', () => {
    it('should cache decisions when enabled', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 5,
        useCache: true
      };

      // First call
      const decision1 = await unifiedAISystem.makeMove(board, 'Yellow', config);
      expect(decision1.metadata.cacheHit).toBe(false);

      // Second call with same board
      const decision2 = await unifiedAISystem.makeMove(board, 'Yellow', config);
      expect(decision2.metadata.cacheHit).toBe(true);
      expect(decision2.move).toBe(decision1.move);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle fork threats', async () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 7,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      
      // Should create a fork threat
      expect(decision.move).toBe(2);
      expect(decision.metadata.threatAnalysis.forkThreats.length).toBeGreaterThan(0);
    });

    it('should handle endgame positions', async () => {
      // Nearly full board
      const board: Board = [
        ['Empty', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
        ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Red', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Red', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 8,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      
      // Should make a valid move in limited space
      expect([0, 6]).toContain(decision.move);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid board states gracefully', async () => {
      // All columns full
      const board: Board = [
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow'],
      ];

      const config: UnifiedAIConfig = {
        difficulty: 5,
        useCache: false
      };

      const decision = await unifiedAISystem.makeMove(board, 'Yellow', config);
      
      // Should return fallback decision
      expect(decision.strategy).toBe('fallback');
    });
  });

  describe('System Status', () => {
    it('should provide comprehensive system status', () => {
      const status = unifiedAISystem.getSystemStatus();
      
      expect(status).toBeDefined();
      expect(status.algorithms).toBeInstanceOf(Array);
      expect(status.activeStrategies).toBeInstanceOf(Array);
      expect(status.components).toBeDefined();
      expect(status.components.threatDetection).toBe(true);
      expect(status.components.patternRecognition).toBe(true);
    });
  });
});