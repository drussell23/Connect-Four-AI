import { OpeningBook, Board, CellValue } from './opening-book';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');

describe('OpeningBook', () => {
  let openingBook: OpeningBook;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    openingBook = new OpeningBook();
    jest.clearAllMocks();
  });

  const createEmptyBoard = (): Board => {
    return Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue));
  };

  const createBoardFromMoves = (moves: Array<[number, CellValue]>): Board => {
    const board = createEmptyBoard();
    for (const [col, player] of moves) {
      for (let row = 5; row >= 0; row--) {
        if (board[row][col] === 'Empty') {
          board[row][col] = player;
          break;
        }
      }
    }
    return board;
  };

  describe('load', () => {
    it('should load opening book data from file if exists', async () => {
      const mockData = {
        '000000|000000|000000|000000|000000|000000': [{
          column: 3,
          score: 0.6,
          winRate: 0.52,
          drawRate: 0.31,
          lossRate: 0.17,
          playCount: 10000,
          depth: 0,
          lastUpdated: new Date().toISOString()
        }]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      await openingBook.load();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('opening-book-data.json'),
        'utf-8'
      );
    });

    it('should initialize with standard openings if file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await openingBook.load();

      const emptyBoard = createEmptyBoard();
      const move = await openingBook.lookup(emptyBoard);
      expect(move).toBe(3); // Center column is best opening
    });
  });

  describe('lookup', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should return center column for empty board', async () => {
      const board = createEmptyBoard();
      const move = await openingBook.lookup(board);
      expect(move).toBe(3);
    });

    it('should return null for unknown position', async () => {
      const board = createBoardFromMoves([
        [0, 'Red'], [1, 'Yellow'], [2, 'Red'], [4, 'Yellow']
      ]);
      const move = await openingBook.lookup(board);
      expect(move).toBe(null);
    });

    it('should handle horizontally flipped positions', async () => {
      // Create a position that's known when flipped
      const board = createBoardFromMoves([[6, 'Red']]);
      const move = await openingBook.lookup(board);
      expect(move).toBe(3); // Should suggest center as response
    });
  });

  describe('lookupWithStats', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should return detailed statistics for known position', async () => {
      const board = createEmptyBoard();
      const stats = await openingBook.lookupWithStats(board);
      
      expect(stats).toBeDefined();
      expect(stats![0]).toMatchObject({
        column: 3,
        score: 0.6,
        winRate: 0.52,
        drawRate: 0.31,
        lossRate: 0.17
      });
    });

    it('should return null for unknown position', async () => {
      const board = createBoardFromMoves([
        [0, 'Red'], [1, 'Yellow'], [2, 'Red'], [4, 'Yellow']
      ]);
      const stats = await openingBook.lookupWithStats(board);
      expect(stats).toBeNull();
    });

    it('should sort entries by score descending', async () => {
      const board = createBoardFromMoves([[3, 'Red'], [2, 'Yellow']]);
      const stats = await openingBook.lookupWithStats(board);
      
      if (stats && stats.length > 1) {
        for (let i = 1; i < stats.length; i++) {
          expect(stats[i - 1].score).toBeGreaterThanOrEqual(stats[i].score);
        }
      }
    });
  });

  describe('updateEntry', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should create new entry for unknown position', async () => {
      const board = createBoardFromMoves([[0, 'Red'], [1, 'Yellow']]);
      await openingBook.updateEntry(board, 2, 'win');
      
      const stats = await openingBook.lookupWithStats(board);
      expect(stats).toBeDefined();
      expect(stats![0]).toMatchObject({
        column: 2,
        winRate: 1,
        playCount: 1
      });
    });

    it('should update existing entry statistics', async () => {
      const board = createEmptyBoard();
      
      // Multiple updates
      await openingBook.updateEntry(board, 3, 'win');
      await openingBook.updateEntry(board, 3, 'loss');
      await openingBook.updateEntry(board, 3, 'draw');
      
      const stats = await openingBook.lookupWithStats(board);
      const entry = stats!.find(e => e.column === 3);
      
      expect(entry!.playCount).toBeGreaterThan(10000); // Original + 3
      expect(entry!.winRate).toBeGreaterThan(0.52);
      expect(entry!.drawRate).toBeGreaterThan(0.31);
    });

    it('should calculate correct score from win/draw/loss rates', async () => {
      const board = createBoardFromMoves([[5, 'Red'], [5, 'Yellow']]);
      
      // 2 wins, 1 draw, 1 loss
      await openingBook.updateEntry(board, 4, 'win');
      await openingBook.updateEntry(board, 4, 'win');
      await openingBook.updateEntry(board, 4, 'draw');
      await openingBook.updateEntry(board, 4, 'loss');
      
      const stats = await openingBook.lookupWithStats(board);
      const entry = stats![0];
      
      expect(entry.winRate).toBeCloseTo(0.5, 2);
      expect(entry.drawRate).toBeCloseTo(0.25, 2);
      expect(entry.lossRate).toBeCloseTo(0.25, 2);
      expect(entry.score).toBeCloseTo(0.625, 2); // 0.5 + 0.25*0.5
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should save opening book data to file', async () => {
      await openingBook.save();
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('opening-book-data.json'),
        expect.any(String),
        'utf-8'
      );
      
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[0][1] as string);
      expect(Object.keys(savedData).length).toBeGreaterThan(0);
    });
  });

  describe('getOpeningStats', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should return statistics about opening book', () => {
      const stats = openingBook.getOpeningStats();
      
      expect(stats.totalPositions).toBeGreaterThan(0);
      expect(stats.averageDepth).toBeGreaterThanOrEqual(0);
      expect(stats.mostPlayedPositions).toBeDefined();
      expect(stats.mostPlayedPositions.length).toBeGreaterThan(0);
    });
  });

  describe('prune', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should remove entries with low play count', async () => {
      const board = createBoardFromMoves([[1, 'Red'], [2, 'Yellow']]);
      
      // Add entry with low play count
      await openingBook.updateEntry(board, 3, 'win');
      
      const statsBefore = await openingBook.lookupWithStats(board);
      expect(statsBefore).toBeDefined();
      
      // Prune with high minimum play count
      await openingBook.prune(100, 365);
      
      const statsAfter = await openingBook.lookupWithStats(board);
      expect(statsAfter).toBeNull();
    });
  });

  describe('exportToCSV', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
    });

    it('should export opening book data to CSV format', async () => {
      const csvPath = '/tmp/opening-book.csv';
      await openingBook.exportToCSV(csvPath);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        csvPath,
        expect.stringContaining('BoardKey,Column,Score,WinRate'),
        'utf-8'
      );
      
      const csvContent = mockFs.writeFile.mock.calls[0][1] as string;
      expect(csvContent).toContain('000000|000000|000000|000000|000000|000000');
      expect(csvContent).toContain(',3,0.600,');
    });
  });

  describe('board key generation', () => {
    it('should generate consistent keys for same board', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
      
      const board1 = createBoardFromMoves([[3, 'Red'], [3, 'Yellow']]);
      const board2 = createBoardFromMoves([[3, 'Red'], [3, 'Yellow']]);
      
      await openingBook.updateEntry(board1, 2, 'win');
      const stats = await openingBook.lookupWithStats(board2);
      
      expect(stats).toBeDefined();
      expect(stats![0].column).toBe(2);
    });

    it('should handle symmetry correctly', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await openingBook.load();
      
      // Position on left side
      const boardLeft = createBoardFromMoves([[0, 'Red']]);
      
      // Mirror position on right side
      const boardRight = createBoardFromMoves([[6, 'Red']]);
      
      const moveLeft = await openingBook.lookup(boardLeft);
      const moveRight = await openingBook.lookup(boardRight);
      
      // Both should suggest center
      expect(moveLeft).toBe(3);
      expect(moveRight).toBe(3);
    });
  });
});