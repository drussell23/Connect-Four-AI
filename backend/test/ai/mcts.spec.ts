// test/ai/mcts.spec.ts

// Mock dependencies before importing the MCTS module
jest.mock('../../src/ai/utils');
jest.mock('../../src/ai/bitboard');
jest.mock('../../src/ai/evaluate');

import { cloneBoard, softmax, chooseWeighted, playout, expand, backpropagate, mcts } from '../../src/ai/mcts';
import { CellValue } from '../../src/ai/types';
import * as utils from '../../src/ai/utils';
import * as bitboard from '../../src/ai/bitboard';
import * as evaluate from '../../src/ai/evaluate';

describe('MCTS helper functions', () => {
  afterEach(() => jest.clearAllMocks());

  it('cloneBoard returns a deep copy', () => {
    const board: CellValue[][] = [['Empty', 'Red']];
    const clone = cloneBoard(board);
    expect(clone).not.toBe(board);
    expect(clone[0]).not.toBe(board[0]);
    expect(clone).toEqual(board);
  });

  it('softmax produces a valid distribution', () => {
    const scores = [0, 1, 2];
    const probs = softmax(scores);
    expect(probs.length).toBe(3);
    expect(probs.every(p => p > 0)).toBe(true);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('chooseWeighted picks according to weights', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const moves = [10, 20, 30];
    expect(chooseWeighted(moves, [0.33, 0.33, 0.34])).toBe(20);
  });

  it('playout returns "Empty" when no legal moves', () => {
    jest.spyOn(utils, 'legalMoves').mockReturnValue([]);
    const result = playout([['Empty']], 'Red', 'Red');
    expect(result).toBe('Empty');
  });

  it('expand populates children for each move', () => {
    jest.spyOn(utils, 'legalMoves').mockReturnValue([0, 2]);
    jest.spyOn(utils, 'tryDrop').mockImplementation((board: CellValue[][]) => ({ board, row: 0 }));
    const node: any = { board: [[]], player: 'Red', visits: 0, wins: 0, parent: null, children: [], move: null };
    expand(node);
    expect(node.children.map((c: any) => c.move)).toEqual([0, 2]);
  });

  it('backpropagate updates visits and wins', () => {
    const root: any = { visits: 0, wins: 0, parent: null };
    const leaf: any = { visits: 0, wins: 0, parent: root };
    backpropagate(leaf, 'Yellow', 'Yellow');
    expect(leaf.visits).toBe(1);
    expect(leaf.wins).toBe(1);
    expect(root.visits).toBe(1);
    expect(root.wins).toBe(1);
  });
});

describe('mcts()', () => {
  beforeAll(() => {
    // stub Date.now for exactly one iteration
    let calls = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => (++calls <= 2 ? 1000 : 2000));
    // stub core helpers
    jest.spyOn(utils, 'legalMoves').mockReturnValue([5, 6]);
    jest.spyOn(utils, 'tryDrop').mockImplementation((b: CellValue[][]) => ({ board: b, row: 0 }));
    jest.spyOn(evaluate, 'evaluateBoard').mockReturnValue(0);
    jest.spyOn(bitboard, 'boardToBitboards').mockReturnValue({ red: 0n, yellow: 0n });
    jest.spyOn(bitboard, 'bitboardCheckWin').mockReturnValue(false);
    // stub playout to avoid infinite loops
    const mctsModule = require('../../src/ai/mcts');
    jest.spyOn(mctsModule, 'playout').mockImplementation((board: CellValue[][], player: CellValue, ai: CellValue) => ai);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns one of the legal moves under time constraint', () => {
    const board: CellValue[][] = Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);
    const move = mcts(board, 'Red', 10);
    expect([5, 6]).toContain(move);
  });
});
