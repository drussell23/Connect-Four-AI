import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from '../src/game/game.gateway';
import { GameService } from '../src/game/game.service';
import { Logger } from '@nestjs/common';

describe('AI Threat Detection Fix', () => {
  let gateway: GameGateway;
  let mockLogger: Logger;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        {
          provide: GameService,
          useValue: {
            createGame: jest.fn(),
            getGame: jest.fn(),
            dropDisc: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
  });

  describe('getQuickStrategicMove', () => {
    it('should detect and block vertical threats', async () => {
      // Setup a board with a vertical threat (Red has 3 in a row vertically)
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await (gateway as any).getQuickStrategicMove(board);
      
      // AI should block at column 0, row 2
      expect(move).toBe(0);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Blocking opponent win at column 0')
      );
    });

    it('should detect and block horizontal threats', async () => {
      // Setup a board with a horizontal threat (Red has 3 in a row horizontally)
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Yellow', 'Empty'],
      ];

      const move = await (gateway as any).getQuickStrategicMove(board);
      
      // AI should block at column 3
      expect(move).toBe(3);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Blocking opponent win at column 3')
      );
    });

    it('should detect and block diagonal threats', async () => {
      // Setup a board with a diagonal threat
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const move = await (gateway as any).getQuickStrategicMove(board);
      
      // AI should block at column 0 (completing the diagonal)
      expect(move).toBe(0);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Blocking opponent win at column 0')
      );
    });

    it('should prioritize winning over blocking', async () => {
      // Setup a board where AI can win
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Yellow', 'Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await (gateway as any).getQuickStrategicMove(board);
      
      // AI should win at column 0 instead of blocking at column 4
      expect(move).toBe(0);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Taking winning move at column 0')
      );
    });

    it('should return -1 when no threats or opportunities exist', async () => {
      // Setup a board with no immediate threats
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ];

      const move = await (gateway as any).getQuickStrategicMove(board);
      
      // Should return -1 to indicate no immediate threats/opportunities
      expect(move).toBe(-1);
    });

    it('should handle boards with mixed cell values correctly', async () => {
      // Verify the fix handles 'Empty' string values correctly
      const board = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Red', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ];

      // This test verifies the fix we made (checking for 'Empty' instead of null)
      const move = await (gateway as any).getQuickStrategicMove(board);
      expect(move).toBe(0); // Should successfully detect the threat
    });
  });
});