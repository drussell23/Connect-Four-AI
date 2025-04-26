import {
  CellValue,
  getDropRow,
  legalMoves,
  tryDrop,
  boardToBitboards,
  getBits,
  bitboardCheckWin,
  evaluateWindow,
  evaluateBoard,
  cloneBoard,
  softmax,
  chooseWeighted,
  orderedMoves,
  findOpenThreeBlock,
  countOpenThree,
  minimax,
  select,
  expand,
  backpropagate,
  mcts,
  getBestAIMove,
  MCTSNode
} from '../../src/ai/connect4AI';

describe('Connect4AI Comprehensive Unit Tests', () => {
  const emptyRow: CellValue[] = Array(7).fill('Empty');
  const emptyBoard: CellValue[][] = Array.from({ length: 6 }, () => [...emptyRow]);

  describe('getDropRow()', () => {
    test('returns bottom row for an empty column', () => {
      expect(getDropRow(emptyBoard, 3)).toBe(5);
    });
    test('returns null for a full column', () => {
      const board = emptyBoard.map(row => [...row]);
      for (let r = 0; r < 6; r++) board[r][0] = 'Red';
      expect(getDropRow(board, 0)).toBeNull();
    });
  });

  describe('legalMoves()', () => {
    test('all columns on empty board', () => {
      expect(legalMoves(emptyBoard)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    test('excludes filled columns', () => {
      const board = emptyBoard.map(row => [...row]);
      board.forEach((row, r) => board[r][4] = 'Yellow');
      expect(legalMoves(board)).not.toContain(4);
    });
  });

  describe('tryDrop()', () => {
    test('drops into lowest empty cell', () => {
      const result = tryDrop(emptyBoard, 2, 'Red');
      expect(result.row).toBe(5);
      expect(result.board[5][2]).toBe('Red');
    });
    test('throws on full column', () => {
      const board = emptyBoard.map(row => [...row]);
      for (let r = 0; r < 6; r++) board[r][3] = 'Red';
      expect(() => tryDrop(board, 3, 'Yellow')).toThrow(/Column 3 is full/);
    });
  });

  describe('bitboard utilities', () => {
    test('boardToBitboards and getBits consistency', () => {
      const board = emptyBoard.map(row => [...row]);
      board[5][1] = 'Red'; board[4][2] = 'Yellow';
      const { red, yellow } = boardToBitboards(board);
      expect(getBits(board, 'Red')).toBe(red);
      expect(getBits(board, 'Yellow')).toBe(yellow);
    });
    test('bitboardCheckWin horizontal, vertical, diagonal', () => {
      // horizontal
      let b = emptyBoard.map(r => [...r]);
      for (let c = 0; c < 4; c++) b[5][c] = 'Red';
      expect(bitboardCheckWin(getBits(b, 'Red'))).toBe(true);
      // vertical
      b = emptyBoard.map(r => [...r]);
      for (let r = 2; r < 6; r++) b[r][3] = 'Yellow';
      b[1][3] = 'Yellow';
      expect(bitboardCheckWin(getBits(b, 'Yellow'))).toBe(true);
      // diagonal
      b = emptyBoard.map(r => [...r]);
      b[2][0] = 'Red'; b[3][1] = 'Red'; b[4][2] = 'Red'; b[5][3] = 'Red';
      expect(bitboardCheckWin(getBits(b, 'Red'))).toBe(true);
    });
  });

  describe('evaluateWindow()', () => {
    test('positive for three and empty', () => {
      expect(evaluateWindow(['Red', 'Red', 'Red', 'Empty'], 'Red')).toBeGreaterThan(0);
    });
    test('zero for mixed colors', () => {
      expect(evaluateWindow(['Red', 'Yellow', 'Empty', 'Empty'], 'Red')).toBe(0);
    });
  });

  describe('evaluateBoard()', () => {
    test('positive when AI has advantage', () => {
      const b = emptyBoard.map(r => [...r]);
      b[5][3] = 'Yellow';
      expect(evaluateBoard(b, 'Yellow')).toBeGreaterThan(0);
    });
    test('negative when opponent has advantage', () => {
      const b = emptyBoard.map(r => [...r]);
      b[5][3] = 'Yellow';
      expect(evaluateBoard(b, 'Red')).toBeLessThan(0);
    });
  });

  describe('cloneBoard, softmax, chooseWeighted', () => {
    test('cloneBoard is deep copy', () => {
      const copy = cloneBoard(emptyBoard);
      copy[5][5] = 'Red';
      expect(emptyBoard[5][5]).toBe('Empty');
    });
    test('softmax sums to 1', () => {
      const arr = softmax([2, 1, 0], 1);
      const sum = arr.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1);
    });
    test('chooseWeighted returns valid move', () => {
      const choice = chooseWeighted([0, 1, 2], [0.1, 0.2, 0.7]);
      expect([0, 1, 2]).toContain(choice);
    });
  });

  describe('orderedMoves()', () => {
    test('center bias on empty board', () => {
      const moves = orderedMoves(emptyBoard, 'Red');
      expect(moves[0].col).toBe(3);
    });
    test('immediate win prioritized', () => {
      const b = emptyBoard.map(r => [...r]);
      for (let c = 0; c < 3; c++) b[5][c] = 'Red';
      const moves = orderedMoves(b, 'Red');
      expect(moves[0].isWinning).toBe(true);
    });
    test('block opponent prioritized', () => {
      const b = emptyBoard.map(r => [...r]);
      for (let c = 0; c < 3; c++) b[5][c] = 'Yellow';
      const moves = orderedMoves(b, 'Red');
      expect(moves[0].isBlocking).toBe(true);
    });
  });

  describe('findOpenThreeBlock & countOpenThree()', () => {
    test('finds correct block', () => {
      const b = emptyBoard.map(r => [...r]);
      b[5][0] = b[5][1] = b[5][2] = 'Yellow';
      expect(findOpenThreeBlock(b, 'Yellow')).toBe(3);
    });

    test('counts forks correctly (exact count)', () => {
      const b = emptyBoard.map(r => [...r]);
      // Make exactly two distinct forks:
      // a) 0-2 with gap at 3
      b[5][0] = b[5][1] = b[5][2] = 'Yellow';
      // b) vertical fork at col 6 with gap at row 2
      b[5][6] = b[4][6] = b[3][6] = 'Yellow';
      expect(countOpenThree(b, 'Yellow')).toBe(2);
    });
  });

  describe('minimax()', () => {
    test('selects one of the immediate winning moves', () => {
      const b = emptyBoard.map(r => [...r]);
      // three Reds in cols 1–3, so wins at 0 or 4
      b[5][1] = b[5][2] = b[5][3] = 'Red';
  
      // what are the winning moves?
      const winningCols = orderedMoves(b, 'Red')
        .filter(m => m.isWinning)
        .map(m => m.col);
      expect(winningCols.length).toBeGreaterThan(0);
  
      const { column } = minimax(b, 4, -Infinity, Infinity, true, 'Red');
      expect(winningCols).toContain(column);
    });
  
    test('chooses a blocking move under direct threat', () => {
      const b = emptyBoard.map(r => [...r]);
      // Yellow threatens connect-4 at cols 2–4
      b[5][2] = b[5][3] = b[5][4] = 'Yellow';
  
      // gather all valid blocking moves
      const blockingCols = orderedMoves(b, 'Red')
        .filter(m => m.isBlocking)
        .map(m => m.col);
      expect(blockingCols.length).toBeGreaterThan(0);
  
      const { column } = minimax(b, 4, -Infinity, Infinity, true, 'Red');
      expect(blockingCols).toContain(column);
    });
  });  

  describe('MCTS functions', () => {
    test('select chooses highest UCT', () => {
      const parent: MCTSNode = { board: emptyBoard, player: 'Red', visits: 10, wins: 0, parent: null, children: [], move: null };
      const a: MCTSNode = { board: emptyBoard, player: 'Yellow', visits: 5, wins: 5, parent: parent, children: [], move: 0 };
      const b: MCTSNode = { board: emptyBoard, player: 'Yellow', visits: 5, wins: 0, parent: parent, children: [], move: 1 };
      parent.children = [a, b];
      expect(select(parent)).toBe(a);
    });
    test('expand generates children', () => {
      const node: MCTSNode = { board: emptyBoard, player: 'Red', visits: 0, wins: 0, parent: null, children: [], move: null };
      expand(node);
      const moves = legalMoves(emptyBoard);
      expect(node.children.map(c => c.move)).toEqual(moves);
    });
    test('backpropagate updates visits and wins', () => {
      const root: MCTSNode = { board: emptyBoard, player: 'Red', visits: 0, wins: 0, parent: null, children: [], move: null };
      const child: MCTSNode = { board: emptyBoard, player: 'Yellow', visits: 0, wins: 0, parent: root, children: [], move: 0 };
      root.children = [child];
      backpropagate(child, 'Red', 'Red');
      expect(child.visits).toBe(1);
      expect(child.wins).toBe(1);
      expect(root.visits).toBe(1);
      expect(root.wins).toBe(1);
    });
    test('mcts returns a legal move', () => {
      const move = mcts(emptyBoard, 'Red', 10);
      expect(legalMoves(emptyBoard)).toContain(move);
    });
  });

  describe('getBestAIMove()', () => {
    test('returns legal move on empty board', () => {
      const move = getBestAIMove(emptyBoard, 'Red', 10);
      expect(legalMoves(emptyBoard)).toContain(move);
    });
    test('executes immediate win strategy', () => {
      const b = emptyBoard.map(r => [...r]);
      b[5][0] = b[5][1] = b[5][2] = 'Red';
      expect(getBestAIMove(b, 'Red', 10)).toBe(3);
    });
  });
});
