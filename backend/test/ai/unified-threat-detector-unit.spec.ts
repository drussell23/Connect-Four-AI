import { UnifiedThreatDetectorService, Board } from '../../src/ai/unified/unified-threat-detector.service';

describe('UnifiedThreatDetectorService - Unit Tests', () => {
  let threatDetector: UnifiedThreatDetectorService;

  beforeEach(() => {
    threatDetector = new UnifiedThreatDetectorService();
  });

  describe('Immediate Threat Detection', () => {
    it('should detect immediate winning moves for AI', () => {
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

    it('should prioritize blocking opponent wins', () => {
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

    it('should handle the exact scenario from user screenshot', () => {
      // Recreating the board state where AI failed to block vertical threat
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(3); // Must block column 3
    });

    it('should detect horizontal threats', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Yellow', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(3); // Should block horizontal threat
    });

    it('should detect diagonal threats (ascending)', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(0); // Should block diagonal at column 0
    });

    it('should detect diagonal threats (descending)', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(3); // Should block diagonal at column 3
    });

    it('should return -1 when no immediate threats exist', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ];

      const move = threatDetector.getImmediateThreat(board, 'Yellow', 'Red');
      expect(move).toBe(-1); // No immediate threats
    });
  });

  describe('Threat Analysis', () => {
    it('should analyze board for all threat types', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const analysis = threatDetector.analyzeBoardThreats(board, 'Yellow', 'Red');
      
      expect(analysis).toBeDefined();
      expect(analysis.bestMove).toBeGreaterThanOrEqual(-1);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(Array.isArray(analysis.immediateWins)).toBe(true);
      expect(Array.isArray(analysis.immediateBlocks)).toBe(true);
      expect(Array.isArray(analysis.setupMoves)).toBe(true);
      expect(Array.isArray(analysis.forkThreats)).toBe(true);
    });

    it('should identify fork opportunities', () => {
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
      
      // The fork at column 2 creates multiple winning threats
      const forkMove = analysis.forkThreats.find(t => t.column === 2);
      expect(forkMove).toBeDefined();
      if (forkMove) {
        expect(forkMove.type).toBe('fork');
        expect(forkMove.urgency).toBeGreaterThan(0.8);
      }
    });

    it('should calculate appropriate confidence levels', () => {
      // Winning position
      const winBoard: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const winAnalysis = threatDetector.analyzeBoardThreats(winBoard, 'Yellow', 'Red');
      expect(winAnalysis.confidence).toBe(1.0); // Maximum confidence for winning move

      // Must-block position
      const blockBoard: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const blockAnalysis = threatDetector.analyzeBoardThreats(blockBoard, 'Yellow', 'Red');
      expect(blockAnalysis.confidence).toBe(0.95); // High confidence for blocking
    });
  });

  describe('Complex Pattern Detection', () => {
    it('should detect connected threat patterns', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Empty', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];

      const threats = threatDetector.detectComplexThreats(board, 'Red');
      expect(threats.length).toBeGreaterThan(0);
      
      // Should detect the XX_X pattern
      const connectedThreat = threats.find(t => t.column === 2 && t.type === 'setup');
      expect(connectedThreat).toBeDefined();
    });

    it('should detect split threat patterns', () => {
      const board: Board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Red', 'Yellow', 'Yellow', 'Empty'],
      ];

      const threats = threatDetector.detectComplexThreats(board, 'Red');
      
      // Should detect the X__X pattern
      const splitThreat = threats.find(t => 
        (t.column === 1 || t.column === 2) && t.type === 'setup'
      );
      expect(splitThreat).toBeDefined();
    });
  });
});