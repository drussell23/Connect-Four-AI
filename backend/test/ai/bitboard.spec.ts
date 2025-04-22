import { boardToBitboards, bitboardCheckWin } from '../../src/ai/bitboard';
import { CellValue } from '../../src/ai/types';

describe('boardToBitboards', () => {
  const emptyBoard = (): CellValue[][] =>
    Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);

  test('should produce zero bitboards for an empty board', () => {
    const board = emptyBoard();
    const { red, yellow } = boardToBitboards(board);
    expect(red).toBe(0n);
    expect(yellow).toBe(0n);
  });

  test('should set bit for a single Red disc at (row, col)', () => {
    const board = emptyBoard();
    board[5][6] = 'Red'; // bottom-right corner
    const { red, yellow } = boardToBitboards(board);
    const idx = BigInt(5 * 7 + 6);
    expect(red).toBe(1n << idx);
    expect(yellow).toBe(0n);
  });

  test('should set bits for multiple discs correctly', () => {
    const board = emptyBoard();
    board[2][3] = 'Yellow';
    board[0][0] = 'Red';
    board[4][5] = 'Yellow';
    const { red, yellow } = boardToBitboards(board);
    const redIdx = BigInt(0 * 7 + 0);
    const yellowIdx1 = BigInt(2 * 7 + 3);
    const yellowIdx2 = BigInt(4 * 7 + 5);
    expect(red).toBe(1n << redIdx);
    expect(yellow).toBe((1n << yellowIdx1) | (1n << yellowIdx2));
  });

  test('should not mix Red and Yellow bits', () => {
    const board = emptyBoard();
    board[3][1] = 'Red';
    board[3][2] = 'Yellow';
    const { red, yellow } = boardToBitboards(board);
    const redIdx = BigInt(3 * 7 + 1);
    const yellowIdx = BigInt(3 * 7 + 2);
    expect(red & (1n << yellowIdx)).toBe(0n);
    expect(yellow & (1n << redIdx)).toBe(0n);
  });

  test('should handle a full board correctly', () => {
    const board = emptyBoard();
    // Fill every cell: even indices Red, odd indices Yellow
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        board[r][c] = ((r * 7 + c) % 2 === 0) ? 'Red' : 'Yellow';
      }
    }
    const { red, yellow } = boardToBitboards(board);
    const allBits = (1n << 42n) - 1n;
    expect((red | yellow) & allBits).toBe(allBits);
    expect(red & yellow).toBe(0n);
  });
});

describe('bitboardCheckWin', () => {
  const emptyBoard = (): CellValue[][] =>
    Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);

  test('should not detect a win on an empty board', () => {
    const board = emptyBoard();
    const { red, yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(false);
    expect(bitboardCheckWin(yellow)).toBe(false);
  });

  test('should detect horizontal wins at bottom and middle rows', () => {
    const board = emptyBoard();
    [0, 1, 2, 3].forEach(col => board[5][col] = 'Red');
    [2, 3, 4, 5].forEach(col => board[3][col] = 'Yellow');
    const { red, yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(true);
    expect(bitboardCheckWin(yellow)).toBe(true);
  });

  test('should not wrap around edges (no bogus horizontal win)', () => {
    const board = emptyBoard();
    [5, 6, 0, 1].forEach(col => board[2][col] = 'Red');
    const { red } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(false);
  });

  test('should detect vertical wins at both edges', () => {
    const board = emptyBoard();
    [0, 1, 2, 3].forEach(row => board[row][0] = 'Red');
    [2, 3, 4, 5].forEach(row => board[row][6] = 'Yellow');
    const { red, yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(true);
    expect(bitboardCheckWin(yellow)).toBe(true);
  });

  test('should detect down-right diagonal wins', () => {
    const board = emptyBoard();
    [[0, 0], [1, 1], [2, 2], [3, 3]].forEach(([r, c]) => board[r][c] = 'Red');
    const { red } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(true);
  });

  test('should detect down-left diagonal wins', () => {
    const board = emptyBoard();
    [[0, 6], [1, 5], [2, 4], [3, 3]].forEach(([r, c]) => board[r][c] = 'Yellow');
    const { yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(yellow)).toBe(true);
  });

  test('should detect up-right diagonal wins', () => {
    const board = emptyBoard();
    [[5, 0], [4, 1], [3, 2], [2, 3]].forEach(([r, c]) => board[r][c] = 'Red');
    const { red } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(true);
  });

  test('should detect up-left diagonal wins', () => {
    const board = emptyBoard();
    [[5, 6], [4, 5], [3, 4], [2, 3]].forEach(([r, c]) => board[r][c] = 'Yellow');
    const { yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(yellow)).toBe(true);
  });

  test('should detect wins with direct bitboard input', () => {
    const horizontalBB = (1n << 0n) | (1n << 1n) | (1n << 2n) | (1n << 3n);
    const verticalBB = (1n << 0n) | (1n << 7n) | (1n << 14n) | (1n << 21n);
    expect(bitboardCheckWin(horizontalBB)).toBe(true);
    expect(bitboardCheckWin(verticalBB)).toBe(true);
  });

  test('should detect multiple win lines in same board', () => {
    const board = emptyBoard();
    [1, 2, 3, 4].forEach(col => board[0][col] = 'Red');
    [2, 3, 4, 5].forEach(row => board[row][6] = 'Red');
    const { red } = boardToBitboards(board);
    expect(bitboardCheckWin(red)).toBe(true);
  });

  test('should not detect a win for interrupted diagonal', () => {
    const board = emptyBoard();
    [[0, 0], [1, 1], [3, 3], [4, 4]].forEach(([r, c]) => board[r][c] = 'Yellow');
    const { yellow } = boardToBitboards(board);
    expect(bitboardCheckWin(yellow)).toBe(false);
  });
});
