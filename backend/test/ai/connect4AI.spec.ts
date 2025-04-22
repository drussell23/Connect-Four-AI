// __tests__/connect4AI.spec.ts
import {
    CellValue,
    legalMoves,
    tryDrop,
    boardToBitboards,
    bitboardCheckWin,
    evaluateBoard,
    minimax,
    getBestAIMove,
  } from '../../src/ai/connect4AI';
  
  /**
   * Helper to build an empty Connect4 board (6×7)
   */
  const createEmptyBoard = (): CellValue[][] =>
    Array.from({ length: 6 }, () => Array(7).fill('Empty'));
  
  describe('Connect4AI Core Functions', () => {
    let board: CellValue[][];
  
    beforeEach(() => {
      board = createEmptyBoard();
    });
  
    it('legalMoves: returns all columns on empty board', () => {
      expect(legalMoves(board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  
    it('tryDrop: places disc at bottom without mutating input', () => {
      const original = board.map((r) => [...r]);
      const { board: next, row } = tryDrop(board, 3, 'Red');
      expect(row).toBe(5);
      expect(next[5][3]).toBe('Red');
      expect(board).toEqual(original);
    });
  
    describe('bitboardCheckWin', () => {
      const makeBB = (cells: [number, number][], disc: CellValue) => {
        let b = createEmptyBoard();
        cells.forEach(([r, c]) => (b[r][c] = disc));
        return boardToBitboards(b)[disc === 'Red' ? 'red' : 'yellow'];
      };
  
      it('detects horizontal wins', () => {
        const bb = makeBB([[5, 0], [5, 1], [5, 2], [5, 3]], 'Red');
        expect(bitboardCheckWin(bb)).toBe(true);
      });
  
      it('detects vertical wins', () => {
        const bb = makeBB([[2, 4], [3, 4], [4, 4], [5, 4]], 'Yellow');
        expect(bitboardCheckWin(bb)).toBe(true);
      });
  
      it('detects diagonal down-right wins', () => {
        const bb = makeBB([[2, 0], [3, 1], [4, 2], [5, 3]], 'Red');
        expect(bitboardCheckWin(bb)).toBe(true);
      });
  
      it('detects diagonal down-left wins', () => {
        const bb = makeBB([[2, 6], [3, 5], [4, 4], [5, 3]], 'Yellow');
        expect(bitboardCheckWin(bb)).toBe(true);
      });
  
      it('returns false when no win present', () => {
        const bb = boardToBitboards(board).red;
        expect(bitboardCheckWin(bb)).toBe(false);
      });
    });
  
    it('evaluateBoard: penalizes immediate open-three threats', () => {
      // Yellow has three in a row with one gap
      board[5][0] = 'Yellow';
      board[5][1] = 'Yellow';
      board[5][2] = 'Yellow';
      const score = evaluateBoard(board, 'Red');
      expect(score).toBeLessThan(-1e5);
    });
  
    it('minimax: on empty board returns first legal column', () => {
      const { column } = minimax(board, 1, -Infinity, Infinity, true, 'Red');
      expect(column).toBe(0);
    });
  });
  
  /**
   * Regression tests: known tactical patterns the AI must block
   */
  describe('Connect4AI Regression Patterns', () => {
    let board: CellValue[][];
  
    beforeEach(() => {
      board = createEmptyBoard();
    });
  
    it('blocks vertical threat', () => {
      // Opponent (Yellow) has three in col 2
      [2, 2, 2].forEach((c) => (board = tryDrop(board, c, 'Yellow').board));
      const move = getBestAIMove(board, 'Red', 10);
      expect(move).toBe(2);
    });
  
    it('blocks diagonal down-right threat', () => {
      // Support stack for diagonal
      board = tryDrop(board, 1, 'Red').board;
      board = tryDrop(board, 2, 'Red').board;
      board = tryDrop(board, 2, 'Red').board;
      // Opponent diagonal
      board = tryDrop(board, 0, 'Yellow').board;
      board = tryDrop(board, 1, 'Yellow').board;
      board = tryDrop(board, 2, 'Yellow').board;
      const move = getBestAIMove(board, 'Red', 10);
      expect(move).toBe(3);
    });
  
    it('blocks diagonal down-left threat', () => {
      // Support stack for diagonal
      board = tryDrop(board, 5, 'Red').board;
      board = tryDrop(board, 4, 'Red').board;
      board = tryDrop(board, 4, 'Red').board;
      // Opponent diagonal
      board = tryDrop(board, 6, 'Yellow').board;
      board = tryDrop(board, 5, 'Yellow').board;
      board = tryDrop(board, 4, 'Yellow').board;
      const move = getBestAIMove(board, 'Red', 10);
      expect(move).toBe(3);
    });
  
    it('regression: AI should not allow a forced win line', () => {
      const forcedWinBoard: CellValue[][] = [
        ['Empty','Empty','Empty','Empty','Empty','Empty','Empty'],
        ['Empty','Empty','Empty','Empty','Empty','Empty','Empty'],
        ['Empty','Empty','Red'  ,'Yellow','Empty','Empty','Empty'],
        ['Empty','Yellow','Red'  ,'Red'   ,'Empty','Empty','Empty'],
        ['Yellow','Red'   ,'Yellow','Yellow','Empty','Empty','Empty'],
        ['Red'   ,'Yellow','Red'  ,'Red'   ,'Yellow','Empty','Empty'],
      ];
      const move = getBestAIMove(forcedWinBoard, 'Yellow', 10);
      // ensure the AI does not play into the winning line (col 3)
      expect(move).not.toBe(3);
    });
  });
  
  /**
   * Basic immediate tactics: wins and blocks
   */
  describe('Connect4AI Immediate Tactics', () => {
    let board: CellValue[][];
  
    beforeEach(() => {
      board = createEmptyBoard();
    });
  
    it('takes winning move when available', () => {
      [0, 1, 2].forEach((c) => (board = tryDrop(board, c, 'Red').board));
      const move = getBestAIMove(board, 'Red');
      expect(move).toBe(3);
    });
  
    it('blocks immediate opponent win', () => {
      [4, 5, 6].forEach((c) => (board = tryDrop(board, c, 'Yellow').board));
      const move = getBestAIMove(board, 'Red');
      expect(move).toBe(3);
    });
  });
  