import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedThreatDetector } from '../../src/ai/threat-detection/enhanced-threat-detector';
import { CellValue } from '../../src/ai/connect4AI';

describe('Threat Detection and Pattern Recognition Tests', () => {
  let threatDetector: EnhancedThreatDetector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnhancedThreatDetector],
    }).compile();

    threatDetector = module.get<EnhancedThreatDetector>(EnhancedThreatDetector);
  });

  describe('Immediate Win Detection', () => {
    it('Should detect horizontal wins', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Yellow', 'Yellow', 'Empty', 'Red', 'Red', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins).toHaveLength(1);
      expect(analysis.immediateWins[0].column).toBe(3);
      expect(analysis.immediateWins[0].direction).toBe('horizontal');
    });

    it('Should detect vertical wins', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins).toHaveLength(1);
      expect(analysis.immediateWins[0].column).toBe(3);
      expect(analysis.immediateWins[0].direction).toBe('vertical');
    });

    it('Should detect diagonal-right wins', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Red', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins).toHaveLength(1);
      expect(analysis.immediateWins[0].column).toBe(4);
      expect(analysis.immediateWins[0].direction).toBe('diagonal-right');
    });

    it('Should detect diagonal-left wins', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Red', 'Yellow', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Red', 'Red', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins).toHaveLength(1);
      expect(analysis.immediateWins[0].column).toBe(2);
      expect(analysis.immediateWins[0].direction).toBe('diagonal-left');
    });
  });

  describe('Immediate Block Detection', () => {
    it('Should detect and prioritize multiple blocking needs', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Red', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateBlocks.length).toBeGreaterThanOrEqual(2);
      
      // Should prioritize the horizontal threat (more immediate)
      const horizontalBlock = analysis.immediateBlocks.find(b => b.direction === 'horizontal');
      const verticalBlock = analysis.immediateBlocks.find(b => b.direction === 'vertical');
      
      expect(horizontalBlock).toBeDefined();
      expect(verticalBlock).toBeDefined();
      expect(horizontalBlock!.priority).toBeGreaterThan(verticalBlock!.priority);
    });

    it('Should detect split threats (X_XX pattern)', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Empty', 'Red', 'Red', 'Yellow', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      const splitThreat = analysis.immediateBlocks.find(b => b.column === 2);
      expect(splitThreat).toBeDefined();
      expect(splitThreat!.pattern).toBe('split');
    });
  });

  describe('Open Three Detection', () => {
    it('Should detect open threes in all directions', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.openThrees.length).toBeGreaterThan(0);
      const verticalOpenThree = analysis.openThrees.find(o => o.direction === 'vertical');
      expect(verticalOpenThree).toBeDefined();
    });

    it('Should differentiate between blocked and open threes', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'], // Blocked three
        ['Red', 'Red', 'Yellow', 'Red', 'Empty', 'Yellow', 'Yellow'], // Open pattern
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      // Blocked three should not be in open threes
      const blockedThree = analysis.openThrees.find(o => 
        o.positions.some(p => p.row === 4 && p.col >= 1 && p.col <= 3)
      );
      expect(blockedThree).toBeUndefined();
    });
  });

  describe('Fork Detection', () => {
    it('Should detect simple forks (two ways to win)', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Empty', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.forks.length).toBeGreaterThan(0);
      const fork = analysis.forks[0];
      expect(fork.threats.length).toBeGreaterThanOrEqual(2);
    });

    it('Should detect complex forks with multiple threat combinations', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.forks.length).toBeGreaterThan(0);
      
      // Should identify the critical fork positions
      const criticalFork = analysis.forks.find(f => 
        f.threats.some(t => t.direction === 'diagonal-right') &&
        f.threats.some(t => t.direction === 'diagonal-left')
      );
      expect(criticalFork).toBeDefined();
    });
  });

  describe('Pattern Priority and Scoring', () => {
    it('Should prioritize immediate wins over blocks', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins.length).toBeGreaterThan(0);
      expect(analysis.immediateBlocks.length).toBeGreaterThan(0);
      
      const winPriority = analysis.immediateWins[0].priority;
      const blockPriority = analysis.immediateBlocks[0].priority;
      
      expect(winPriority).toBeGreaterThan(blockPriority);
    });

    it('Should score threats based on urgency and impact', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      // Vertical threat (3 in a row) should have highest urgency
      const verticalThreat = analysis.immediateBlocks.find(b => 
        b.direction === 'vertical' && b.column === 2
      );
      
      expect(verticalThreat).toBeDefined();
      expect(verticalThreat!.urgency).toBeGreaterThan(8);
    });
  });

  describe('Complex Board Analysis', () => {
    it('Should handle boards with multiple simultaneous threats', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.immediateWins.length + analysis.immediateBlocks.length).toBeGreaterThan(3);
      expect(analysis.openThrees.length).toBeGreaterThan(0);
      expect(analysis.complexity).toBeGreaterThan(5); // Complex position
    });

    it('Should identify forced win sequences', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Empty', 'Yellow', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Red', 'Empty'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      // Should identify that Yellow can create a winning fork
      expect(analysis.winningSequences).toBeDefined();
      expect(analysis.winningSequences.length).toBeGreaterThan(0);
      
      const sequence = analysis.winningSequences[0];
      expect(sequence.moves.length).toBeGreaterThanOrEqual(1);
      expect(sequence.forced).toBe(true); // Opponent can't prevent it
    });
  });

  describe('Edge Cases and Special Patterns', () => {
    it('Should handle nearly full boards', () => {
      const board: CellValue[][] = [
        ['Red', 'Yellow', 'Red', 'Empty', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow'],
        ['Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Red'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      expect(analysis.availableMoves).toHaveLength(1);
      expect(analysis.availableMoves[0]).toBe(3);
    });

    it('Should detect wrap-around threats at board edges', () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Yellow'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Yellow', 'Red'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Yellow', 'Red', 'Red'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Red', 'Yellow', 'Red'],
      ];

      const analysis = threatDetector.analyzeThreat(board, 'Yellow');
      
      // Should detect the diagonal threat
      const diagonalThreat = analysis.openThrees.find(t => 
        t.direction === 'diagonal-right'
      );
      expect(diagonalThreat).toBeDefined();
    });
  });
});