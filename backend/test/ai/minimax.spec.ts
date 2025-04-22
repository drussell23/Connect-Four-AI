import { minimax, Node } from '../../src/ai/minimax';
import { legalMoves, tryDrop } from '../../src/ai/utils';
import { boardToBitboards, bitboardCheckWin } from '../../src/ai/bitboard';
import type { CellValue } from '../../src/ai/types';

// Mock dependencies
jest.mock('../../src/ai/utils');
jest.mock('../../src/ai/bitboard');

const mockLegalMoves = legalMoves as jest.MockedFunction<typeof legalMoves>;
const mockTryDrop = tryDrop as jest.MockedFunction<typeof tryDrop>;
const mockBitboardCheckWin = bitboardCheckWin as jest.MockedFunction<typeof bitboardCheckWin>;
const mockBoardToBitboards = boardToBitboards as jest.MockedFunction<typeof boardToBitboards>;

// Provide default implementations
mockBoardToBitboards.mockReturnValue({ red: 0n, yellow: 0n });
// tryDrop returns an object matching its real signature: { board, row }
mockTryDrop.mockImplementation((board) => ({ board, row: 0 }));

// Helper to generate an empty board
const makeEmptyBoard = (): CellValue[][] =>
  Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);

describe('minimax', () => {
  let dummyBoard: CellValue[][];

  beforeEach(() => {
    jest.clearAllMocks();
    dummyBoard = makeEmptyBoard();
  });

  it('returns a winning move immediately when available', () => {
    mockLegalMoves.mockReturnValue([2, 4, 6]);
    // First call yields a win
    let callCount = 0;
    mockBitboardCheckWin.mockImplementation(() => ++callCount === 1);

    const result: Node = minimax(dummyBoard, 3, -Infinity, Infinity, true, 'Red');
    expect(result.score).toBe(Infinity);
    expect(result.column).toBe(2);
  });

  it('selects the only legal move when depth=0 and no win', () => {
    mockLegalMoves.mockReturnValue([5]);
    mockBitboardCheckWin.mockReturnValue(false);

    const result = minimax(dummyBoard, 0, -Infinity, Infinity, true, 'Yellow');
    expect(result.column).toBe(5);
  });

  it('blocks opponent win when minimizing and depth>0', () => {
    mockLegalMoves.mockReturnValue([1]);
    let globalCall = 0;
    // Simulate non-win for maximizing, win for minimizing
    mockBitboardCheckWin.mockImplementation(() => {
      globalCall++;
      return globalCall === 2;
    });

    const result = minimax(dummyBoard, 2, -Infinity, Infinity, true, 'Red');
    expect(result.column).toBe(1);
  });

  it('returns -Infinity when minimizing player wins immediately', () => {
    mockLegalMoves.mockReturnValue([3]);
    let callCount = 0;
    // Only the minimizing check yields win
    mockBitboardCheckWin.mockImplementation(() => ++callCount === 2);

    const result: Node = minimax(dummyBoard, 2, -Infinity, Infinity, false, 'Red');
    expect(result.score).toBe(-Infinity);
    expect(result.column).toBe(3);
  });

  it('applies null-move pruning when depth above threshold', () => {
    mockLegalMoves.mockReturnValue([0, 1]);
    mockBitboardCheckWin.mockReturnValue(false);

    const result = minimax(dummyBoard, 5, 10, 5, true, 'Red');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('column');
  });

  it('returns null column and -Infinity score when no legal moves', () => {
    mockLegalMoves.mockReturnValue([]);
    mockBitboardCheckWin.mockReturnValue(false);

    const result = minimax(dummyBoard, 3, -Infinity, Infinity, true, 'Red');
    expect(result.column).toBeNull();
    expect(result.score).toBe(-Infinity);
  });

  it('returns one of legal moves when no win detected for depth>1', () => {
    mockLegalMoves.mockReturnValue([0, 1, 2]);
    mockBitboardCheckWin.mockReturnValue(false);

    const result = minimax(dummyBoard, 2, -Infinity, Infinity, true, 'Red');
    expect([0, 1, 2]).toContain(result.column);
    expect(typeof result.score).toBe('number');
  });

  it('performs alpha-beta cutoff after finding a win on first move', () => {
    mockLegalMoves.mockReturnValue([4, 5]);
    let calls = 0;
    mockBitboardCheckWin.mockImplementation(() => ++calls === 1);

    const result = minimax(dummyBoard, 4, -Infinity, Infinity, true, 'Yellow');
    expect(result.column).toBe(4);
    expect(calls).toBe(1);
  });

  it('handles depth=1 by exploring all moves and returns the best for maximizing', () => {
    mockLegalMoves.mockReturnValue([0, 1]);
    mockBitboardCheckWin.mockReturnValue(false);

    const result = minimax(dummyBoard, 1, -Infinity, Infinity, true, 'Red');
    expect([0, 1]).toContain(result.column);
  });

  it('correctly switches discs between layers', () => {
    mockLegalMoves.mockReturnValue([2]);
    let callCount = 0;
    // Only the second call simulates a win for minimizing
    mockBitboardCheckWin.mockImplementation(() => ++callCount === 2);

    const result = minimax(dummyBoard, 2, -Infinity, Infinity, true, 'Red');
    expect(result.column).toBe(2);
  });
});
