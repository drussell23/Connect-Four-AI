import {
  CellValue,
  getDropRow,
  orderedMoves,
  legalMoves,
  tryDrop,
  cloneBoard,
  boardToBitboards,
  getBits,
  bitboardCheckWin,
  evaluateWindow,
  evaluateBoard,
  softmax,
  chooseWeighted,
  rand64,
  hashBoard,
  clearTable,
  getEntry,
  storeEntry,
  minimax,
  playout,
  select,
  expand,
  backpropagate,
  mcts,
  getBestAIMove,
  findOpenThreeBlock,
  countOpenThree,
  blockVerticalThreeIfAny,
  blockFloatingOpenThree,
  EntryFlag,
  TranspositionEntry,
  MCTSNode
} from '../../src/ai/connect4AI';

// Helper for an empty board
const emptyBoard: CellValue[][] = Array.from({ length: 6 }, () => Array(7).fill('Empty'));

// ---------------------------------------------
// Utility Functions
// ---------------------------------------------
describe('Utility Functions', () => {
  describe('getDropRow', () => {
    it('returns bottom row for empty column', () => {
      expect(getDropRow(emptyBoard, 3)).toBe(5);
    });
    it('returns null when column is full', () => {
      const board = cloneBoard(emptyBoard);
      for (let r = 0; r < 6; r++) board[r][0] = 'Red';
      expect(getDropRow(board, 0)).toBeNull();
    });
    it('returns next available row after a drop', () => {
      const { board: b } = tryDrop(emptyBoard, 2, 'Yellow');
      expect(getDropRow(b, 2)).toBe(4);
    });
  });

  describe('legalMoves', () => {
    it('returns all columns on empty board', () => {
      expect(legalMoves(emptyBoard)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    it('excludes full columns', () => {
      const board = cloneBoard(emptyBoard);
      for (let r = 0; r < 6; r++) board[r][1] = 'Red';
      expect(legalMoves(board)).not.toContain(1);
    });
  });

  describe('tryDrop', () => {
    it('drops disc in correct position', () => {
      const { board: b, row } = tryDrop(emptyBoard, 4, 'Red');
      expect(row).toBe(5);
      expect(b[5][4]).toBe('Red');
    });
    it('throws error on full column', () => {
      const board = cloneBoard(emptyBoard);
      for (let r = 0; r < 6; r++) board[r][4] = 'Yellow';
      expect(() => tryDrop(board, 4, 'Red')).toThrow('Column 4 is full');
    });
  });

  describe('cloneBoard', () => {
    it('deep clones the board', () => {
      const b = cloneBoard(emptyBoard);
      b[0][0] = 'Red';
      expect(emptyBoard[0][0]).toBe('Empty');
      expect(b[0][0]).toBe('Red');
    });
  });
});

// ---------------------------------------------
// Bitboard Functions
// ---------------------------------------------
describe('Bitboard Functions', () => {
  it('boardToBitboards and getBits are consistent', () => {
    const b = cloneBoard(emptyBoard);
    b[0][0] = 'Red';
    b[1][1] = 'Yellow';
    const { red, yellow } = boardToBitboards(b);
    expect(getBits(b, 'Red')).toBe(red);
    expect(getBits(b, 'Yellow')).toBe(yellow);
  });

  it('bitboardCheckWin detects horizontal wins', () => {
    const b = cloneBoard(emptyBoard);
    for (let c = 0; c < 4; c++) b[5][c] = 'Red';
    expect(bitboardCheckWin(getBits(b, 'Red'))).toBe(true);
  });
});

// ---------------------------------------------
// Evaluation Functions
// ---------------------------------------------
describe('Evaluation Functions', () => {
  it('evaluateWindow gives higher score for three in a row', () => {
    const w3 = evaluateWindow(['Red', 'Red', 'Red', 'Empty'], 'Red');
    const w2 = evaluateWindow(['Red', 'Red', 'Empty', 'Empty'], 'Red');
    expect(w3).toBeGreaterThan(w2);
  });

  it('evaluateBoard favors more advantageous boards', () => {
    const b1 = cloneBoard(emptyBoard);
    b1[5][0] = b1[5][1] = b1[5][2] = 'Yellow';
    const b2 = cloneBoard(b1);
    b2[5][3] = 'Yellow';
    expect(evaluateBoard(b2, 'Yellow')).toBeGreaterThan(evaluateBoard(b1, 'Yellow'));
  });
});

// ---------------------------------------------
// Probability & Hashing
// ---------------------------------------------
describe('Probability & Hashing', () => {
  it('softmax output sums to ~1', () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1);
  });

  it('chooseWeighted selects according to weights', () => {
    expect(chooseWeighted([0, 1, 2], [0, 0, 1])).toBe(2);
  });

  it('rand64 returns a bigint', () => {
    expect(typeof rand64()).toBe('bigint');
  });

  it('hashBoard is deterministic', () => {
    const h1 = hashBoard(emptyBoard);
    const h2 = hashBoard(emptyBoard);
    expect(h1).toBe(h2);
  });
});

// ---------------------------------------------
// Transposition Table
// ---------------------------------------------
describe('Transposition Table', () => {
  it('storeEntry and getEntry work correctly', () => {
    clearTable();
    const h = hashBoard(emptyBoard);
    const entry: TranspositionEntry = { score: 5, depth: 1, flag: EntryFlag.Exact, column: 2 };
    storeEntry(h, entry);
    expect(getEntry(h)).toMatchObject(entry);
  });
});

// ---------------------------------------------
// Search Algorithms
// ---------------------------------------------
describe('Search Algorithms', () => {
  it('minimax returns valid column', () => {
    const { column } = minimax(emptyBoard, 1, -Infinity, Infinity, true, 'Red');
    expect(legalMoves(emptyBoard)).toContain(column!);
  });

  it('playout returns a CellValue', () => {
    const node: MCTSNode = {
      board: emptyBoard,
      player: 'Red',
      visits: 0,
      wins: 0,
      parent: null,
      children: [],
      move: null,
      priorProb: 1.0
    };
    const result = playout(node, 'Red');
    expect(['Empty', 'Red', 'Yellow']).toContain(result);
  });

  it('select does not throw', () => {
    const root: MCTSNode = {
      board: emptyBoard,
      player: 'Red',
      visits: 0,
      wins: 0,
      parent: null,
      children: [],
      move: null,
      priorProb: 1.0
    };
    expect(() => select(root)).not.toThrow();
  });

  it('expand populates children', () => {
    const node: MCTSNode = {
      board: emptyBoard,
      player: 'Red',
      visits: 0,
      wins: 0,
      parent: null,
      children: [],
      move: null,
      priorProb: 1.0
    };
    expand(node);
    expect(node.children.length).toBeGreaterThan(0);
  });

  it('backpropagate updates visits and wins', () => {
    const root: MCTSNode = {
      board: emptyBoard,
      player: 'Red',
      visits: 0,
      wins: 0,
      parent: null,
      children: [],
      move: null,
      priorProb: 1.0
    };
    const child: MCTSNode = {
      board: emptyBoard,
      player: 'Yellow',
      visits: 0,
      wins: 0,
      parent: root,
      children: [],
      move: 0,
      priorProb: 0.14
    };
    root.children = [child];
    backpropagate(child, 'Red');
    expect(root.visits).toBe(1);
    expect(root.wins).toBe(1);
    expect(child.visits).toBe(1);
    expect(child.wins).toBe(1);
  });

  it('mcts returns legal move', () => {
    const move = mcts(emptyBoard, 'Yellow', 50);
    expect(legalMoves(emptyBoard)).toContain(move);
  });

  it('getBestAIMove blocks immediate wins', () => {
    const b = cloneBoard(emptyBoard);
    b[5][0] = b[5][1] = b[5][2] = 'Red';
    expect(getBestAIMove(b, 'Red')).toBe(3);
  });
});

// ---------------------------------------------
// Strategic Blocks (Advanced Tests)
// ---------------------------------------------
describe('Strategic Blocks', () => {
  describe('blockVerticalThreeIfAny', () => {
    it('returns null when no vertical threat', () => {
      expect(blockVerticalThreeIfAny(emptyBoard, 'Yellow')).toBeNull();
    });
    it('blocks mid-board vertical threat for opponent', () => {
      const board = cloneBoard(emptyBoard);
      board[4][6] = board[3][6] = board[2][6] = 'Red';
      expect(blockVerticalThreeIfAny(board, 'Yellow')).toBe(6);
    });
    it('blocks bottom-board vertical threat when support exists', () => {
      const board = cloneBoard(emptyBoard);
      board[5][0] = board[4][0] = board[3][0] = 'Yellow';
      expect(blockVerticalThreeIfAny(board, 'Red')).toBe(0);
    });
  });

  describe('blockFloatingOpenThree', () => {
    it('returns null when no floating threat', () => {
      expect(blockFloatingOpenThree(emptyBoard, 'Yellow')).toBeNull();
    });
    it('blocks floating pattern two rows up', () => {
      const board = cloneBoard(emptyBoard);
      board[5][2] = 'Red';
      board[3][1] = board[3][2] = board[3][4] = 'Yellow';
      expect(blockFloatingOpenThree(board, 'Red')).toBe(3);
    });
    it('blocks deepest floating pattern among multiple', () => {
      const board = cloneBoard(emptyBoard);
      board[5][0] = board[5][2] = board[5][3] = 'Yellow';
      board[4][1] = board[4][3] = board[4][4] = 'Red';
      // Two floating windows at rows 5 and 4: lowest gap is (5,1)
      expect(blockFloatingOpenThree(board, 'Red')).toBe(1);
    });
  });
});
