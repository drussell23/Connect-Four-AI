// src/ai/connect4AI.ts

/** Valid values for each cell in the Connect 4 grid **/
export type CellValue = 'Empty' | 'Red' | 'Yellow';

/** Returns an array of column indices (0–6) that are not full. **/
export function legalMoves(board: CellValue[][]): number[] {
  const cols = board[0].length;
  return Array.from({ length: cols }, (_, c) => c).filter(
    (c) => board[0][c] === 'Empty'
  );
}

/** Drops a disc in the given column, returning the new board and the row index. **/
export function tryDrop(
  board: CellValue[][],
  column: number,
  disc: CellValue
): { board: CellValue[][]; row: number } {
  const newBoard = board.map((row) => [...row]);
  for (let r = newBoard.length - 1; r >= 0; r--) {
    if (newBoard[r][column] === 'Empty') {
      newBoard[r][column] = disc;
      return { board: newBoard, row: r };
    }
  }
  throw new Error(`Column ${column} is full`);
}

/** Bitboard utilities **/
export function boardToBitboards(board: CellValue[][]): { red: bigint; yellow: bigint } {
  let red = 0n;
  let yellow = 0n;
  const COLS = BigInt(board[0].length);
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const idx = BigInt(r) * COLS + BigInt(c);
      if (board[r][c] === 'Red') red |= 1n << idx;
      else if (board[r][c] === 'Yellow') yellow |= 1n << idx;
    }
  }
  return { red, yellow };
}

/** Helper to pick the correct bitboard for a disc **/
function getBits(board: CellValue[][], disc: CellValue): bigint {
  const { red, yellow } = boardToBitboards(board);
  return disc === 'Red' ? red : yellow;
}

export function bitboardCheckWin(bb: bigint): boolean {
  // horizontal
  let m = bb & (bb >> 1n);
  if ((m & (m >> 2n)) !== 0n) return true;
  // vertical
  m = bb & (bb >> 7n);
  if ((m & (m >> (14n))) !== 0n) return true;
  // diag down-right
  m = bb & (bb >> 8n);
  if ((m & (m >> (16n))) !== 0n) return true;
  // diag down-left
  m = bb & (bb >> 6n);
  if ((m & (m >> (12n))) !== 0n) return true;
  return false;
}

/** Static board evaluation **/
const WINDOW = 4;
const BASE_SCORES: Record<number, number> = { 4: 100, 3: 5, 2: 2 };
const OPEN_THREE_BONUS = { bothEnds: 4, oneEnd: 2 };
const CENTER_COLUMN_BONUS = 3;
const TOP_ROW_PENALTY_FACTOR = 0.8;

export function evaluateWindow(
  cells: CellValue[],
  aiDisc: CellValue
): number {
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
  const aiCount = cells.filter((c) => c === aiDisc).length;
  const humanCount = cells.filter((c) => c === humanDisc).length;
  const emptyCount = cells.filter((c) => c === 'Empty').length;
  if ((aiCount > 0 && humanCount > 0) || (aiCount === 0 && humanCount === 0)) return 0;
  if (aiCount > 0) {
    let score = BASE_SCORES[aiCount] || 0;
    if (aiCount === 3 && emptyCount === 1) {
      const ends = (cells[0] === 'Empty' ? 1 : 0) + (cells[3] === 'Empty' ? 1 : 0);
      score += ends === 2 ? OPEN_THREE_BONUS.bothEnds : OPEN_THREE_BONUS.oneEnd;
    }
    return score;
  } else {
    return -(BASE_SCORES[humanCount] || 0) * 1.5;
  }
}

export function evaluateBoard(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const rows = board.length;
  const cols = board[0].length;
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
  let score = 0;
  // immediate open-three penalty
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const w = board[r].slice(c, c + WINDOW);
      if (
        w.filter((x) => x === humanDisc).length === 3 &&
        w.filter((x) => x === 'Empty').length === 1
      ) {
        return -1e6;
      }
    }
  }
  // horizontal, vertical, diags
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      score += evaluateWindow(board[r].slice(c, c + WINDOW), aiDisc) *
        (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - WINDOW; r++) {
      const w = [0, 1, 2, 3].map((i) => board[r + i][c]);
      score += evaluateWindow(w, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }
  for (let r = 0; r <= rows - WINDOW; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const dr = [0, 1, 2, 3].map((i) => board[r + i][c + i]);
      score += evaluateWindow(dr, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
      const dl = [0, 1, 2, 3].map(
        (i) => board[r + i][c + WINDOW - 1 - i]
      );
      score += evaluateWindow(dl, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }
  const center = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    score += board[r][center] === aiDisc
      ? CENTER_COLUMN_BONUS
      : board[r][center] === humanDisc
      ? -CENTER_COLUMN_BONUS
      : 0;
  }
  return score;
}

/** Transposition table with Zobrist hashing **/
export enum EntryFlag { Exact, LowerBound, UpperBound }
export interface TranspositionEntry {
  score: number;
  depth: number;
  column: number | null;
  flag: EntryFlag;
}
const MAX_ENTRIES = 1_000_000;
const transposition = new Map<bigint, TranspositionEntry>();
function rand64(): bigint {
  const buf = require('crypto').randomBytes(8);
  let n = 0n;
  buf.forEach((b: number) => {
    n = (n << 8n) | BigInt(b);
  });
  return n;
}
const ZOBRIST_TABLE: bigint[][][] = Array.from({ length: 6 }, () =>
  Array.from({ length: 7 }, () => [rand64(), rand64(), rand64()])
);
export function hashBoard(board: CellValue[][]): bigint {
  let h = 0n;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = board[r][c] === 'Red' ? 1 : board[r][c] === 'Yellow' ? 2 : 0;
      h ^= ZOBRIST_TABLE[r][c][idx];
    }
  }
  return h;
}
export function clearTable(): void {
  transposition.clear();
}
export function getEntry(
  hash: bigint
): TranspositionEntry | undefined {
  return transposition.get(hash);
}
export function storeEntry(
  hash: bigint,
  entry: TranspositionEntry
): void {
  const existing = transposition.get(hash);
  if (
    !existing ||
    entry.depth > existing.depth ||
    entry.flag === EntryFlag.Exact
  ) {
    if (transposition.size > MAX_ENTRIES) {
      let toEvict = Math.floor(MAX_ENTRIES * 0.1);
      for (const key of transposition.keys()) {
        transposition.delete(key);
        toEvict--;
        if (toEvict <= 0) break;
      }
    }
    transposition.set(hash, entry);
  }
}

/** Minimax with α–β, null‐move pruning, history, transposition **/
interface Node { score: number; column: number | null; }
const NULL_MOVE_REDUCTION = 0;
const historyTable: number[][] = Array.from({ length: 7 }, () => []);
export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiDisc: CellValue
): Node {
  clearTable();
  const key = hashBoard(board);
  const entry = getEntry(key);
  if (entry && entry.depth >= depth) {
    if (entry.flag === EntryFlag.Exact)
      return { score: entry.score, column: entry.column };
    if (entry.flag === EntryFlag.LowerBound)
      alpha = Math.max(alpha, entry.score);
    if (entry.flag === EntryFlag.UpperBound)
      beta = Math.min(beta, entry.score);
    if (alpha >= beta)
      return { score: entry.score, column: entry.column };
  }
  const moves = legalMoves(board);
  if (moves.length === 0)
    return {
      column: null,
      score: maximizingPlayer ? -Infinity : Infinity
    };
  const current = maximizingPlayer
    ? aiDisc
    : aiDisc === 'Red'
    ? 'Yellow'
    : 'Red';
  const other = maximizingPlayer
    ? aiDisc === 'Red'
      ? 'Yellow'
      : 'Red'
    : aiDisc;
  // immediate win
  for (const col of moves) {
    const { board: b1 } = tryDrop(board, col, current);
    if (bitboardCheckWin(getBits(b1, current)))
      return { column: col, score: maximizingPlayer ? Infinity : -Infinity };
  }
  // immediate block
  for (const col of moves) {
    const { board: b2 } = tryDrop(board, col, other);
    if (bitboardCheckWin(getBits(b2, other)))
      return { column: col, score: maximizingPlayer ? -Infinity : Infinity };
  }
  if (depth === 0)
    return { column: moves[0], score: evaluateBoard(board, aiDisc) };
  // null-move pruning
  if (maximizingPlayer && depth > NULL_MOVE_REDUCTION) {
    const col0 = moves[0];
    const { board: nb } = tryDrop(board, col0, current);
    const nm = minimax(
      nb,
      depth - 1 - NULL_MOVE_REDUCTION,
      -beta,
      -beta + 1,
      false,
      aiDisc
    );
    if (-nm.score >= beta)
      return { column: null, score: beta };
  }
  // move ordering
  const ordered = moves
    .map((col) => ({ col, key: historyTable[col][depth] || 0 }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.col);
  let best: Node = {
    column: null,
    score: maximizingPlayer ? -Infinity : Infinity
  };
  const alphaOrig = alpha;
  const betaOrig = beta;
  for (const col of ordered) {
    const { board: nb } = tryDrop(board, col, current);
    const child = minimax(
      nb,
      depth - 1,
      -beta,
      -alpha,
      !maximizingPlayer,
      aiDisc
    );
    const sc = -child.score;
    if (
      (maximizingPlayer && sc > best.score) ||
      (!maximizingPlayer && sc < best.score)
    ) {
      best = { column: col, score: sc };
    }
    if (maximizingPlayer) alpha = Math.max(alpha, sc);
    else beta = Math.min(beta, sc);
    if (alpha >= beta) {
      historyTable[col][depth] =
        (historyTable[col][depth] || 0) + depth * depth;
      break;
    }
  }
  let flag = EntryFlag.Exact;
  if (best.score <= alphaOrig) flag = EntryFlag.UpperBound;
  else if (best.score >= betaOrig) flag = EntryFlag.LowerBound;
  storeEntry(key, {
    score: best.score,
    depth,
    column: best.column,
    flag
  });
  return best;
}

/** Monte Carlo Tree Search **/
export interface MCTSNode {
  board: CellValue[][];
  player: CellValue;
  visits: number;
  wins: number;
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null;
}
export function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map((r) => [...r]);
}
export function softmax(scores: number[], temperature = 1): number[] {
  const exps = scores.map((s) => Math.exp(s / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
export function chooseWeighted(
  moves: number[],
  weights: number[]
): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < moves.length; i++) {
    cum += weights[i];
    if (r < cum) return moves[i];
  }
  return moves[moves.length - 1];
}
export function playout(
  startBoard: CellValue[][],
  startingPlayer: CellValue,
  aiDisc: CellValue
): CellValue {
  let board = cloneBoard(startBoard);
  let current = startingPlayer;
  while (true) {
    const moves = legalMoves(board);
    if (!moves.length) return 'Empty';
    const scores = moves.map((c) => {
      const nextBoard = tryDrop(board, c, current).board;
      return evaluateBoard(nextBoard, current);
    });
    const col = chooseWeighted(moves, softmax(scores));
    const nextRes = tryDrop(board, col, current);
    board = nextRes.board;
    if (bitboardCheckWin(getBits(board, current))) return current;
    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}
function select(node: MCTSNode): MCTSNode {
  let cur = node;
  while (cur.children.length) {
    cur = cur.children.reduce((best, child) => {
      const uct =
        child.wins / (child.visits + 1e-9) +
        Math.sqrt(2 * Math.log(cur.visits + 1) / (child.visits + 1e-9));
      const ubest =
        best.wins / (best.visits + 1e-9) +
        Math.sqrt(2 * Math.log(cur.visits + 1) / (best.visits + 1e-9));
      return uct > ubest ? child : best;
    });
  }
  return cur;
}
export function expand(node: MCTSNode): void {
  const moves = legalMoves(node.board);
  const next = node.player === 'Red' ? 'Yellow' : 'Red';
  moves.forEach((col) => {
    const res = tryDrop(node.board, col, next);
    node.children.push({
      board: res.board,
      player: next,
      visits: 0,
      wins: 0,
      parent: node,
      children: [],
      move: col,
    });
  });
}
export function backpropagate(
  node: MCTSNode,
  winner: CellValue,
  aiDisc: CellValue
): void {
  let cur: MCTSNode | null = node;
  while (cur) {
    cur.visits++;
    if (winner === aiDisc) cur.wins++;
    cur = cur.parent;
  }
}
export function mcts(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number {
  const moves = legalMoves(board);
  // immediate win
  for (const col of moves) {
    const res = tryDrop(board, col, aiDisc);
    if (bitboardCheckWin(getBits(res.board, aiDisc))) return col;
  }
  // immediate block
  const opp = aiDisc === 'Red' ? 'Yellow' : 'Red';
  for (const col of moves) {
    const res = tryDrop(board, col, opp);
    if (bitboardCheckWin(getBits(res.board, opp))) return col;
  }
  const root: MCTSNode = {
    board: cloneBoard(board),
    player: opp,
    visits: 0,
    wins: 0,
    parent: null,
    children: [],
    move: null,
  };
  const MAX_NODES = 10000;
  let nodeCount = 1;
  const endTime = Date.now() + Math.max(timeMs, 500);
  while (Date.now() < endTime) {
    let node = select(root);
    if (node.visits > 0 && node.children.length === 0 && nodeCount < MAX_NODES) {
      expand(node);
      nodeCount += node.children.length;
    }
    const leaf =
      node.children.length > 0
        ? node.children[Math.floor(Math.random() * node.children.length)]
        : node;
    const winner = playout(leaf.board, leaf.player, aiDisc);
    backpropagate(leaf, winner, aiDisc);
  }
  let bestMove = moves[0];
  let bestVisits = -1;
  for (const child of root.children) {
    if (child.visits > bestVisits && child.move !== null) {
      bestVisits = child.visits;
      bestMove = child.move;
    }
  }
  return bestMove;
}

/** Hybrid AI **/
const ENGINE_MAX_DEPTH = 12;
const THREAT_THRESHOLD = 1;
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const total = board.length * board[0].length;
  const empty = board.reduce(
    (s, r) => s + r.filter((c) => c === 'Empty').length,
    0
  );
  const opp = aiDisc === 'Red' ? 'Yellow' : 'Red';
  // immediate win/block
  for (const col of moves) {
    const res = tryDrop(board, col, aiDisc);
    if (bitboardCheckWin(getBits(res.board, aiDisc))) return col;
  }
  for (const col of moves) {
    const res = tryDrop(board, col, opp);
    if (bitboardCheckWin(getBits(res.board, opp))) return col;
  }
  // threat count
  const threats: Record<number, number> = {};
  moves.forEach((col) => {
    const b1 = tryDrop(board, col, aiDisc).board;
    threats[col] = legalMoves(b1).filter((c2) => {
      const b2 = tryDrop(b1, c2, opp).board;
      return bitboardCheckWin(getBits(b2, opp));
    }).length;
  });
  let cands = moves.filter((c) => threats[c] <= THREAT_THRESHOLD);
  if (cands.length === 0) {
    const minT = Math.min(...moves.map((c) => threats[c]));
    cands = moves.filter((c) => threats[c] === minT);
  }
  cands.sort(
    (a, b) =>
      threats[a] - threats[b] || Math.abs(3 - a) - Math.abs(3 - b)
  );
  const isEarly = empty > total * 0.6;
  const isLate = cands.length <= 5;
  // late-game iterative deepening
  if (isLate) {
    let best: number | null = null;
    for (
      let d = 4;
      d <= Math.min(ENGINE_MAX_DEPTH, empty);
      d += 2
    ) {
      const col = minimax(
        board,
        d,
        -Infinity,
        Infinity,
        true,
        aiDisc
      ).column;
      if (col !== null && cands.includes(col)) {
        best = col;
      }
    }
    return best !== null ? best : cands[0];
  }
  // early-game MCTS
  if (isEarly) {
    const col = mcts(board, aiDisc, timeMs);
    return cands.includes(col) ? col : cands[0];
  }
  // mid-game minimax fallback
  const depth = Math.min(ENGINE_MAX_DEPTH, empty);
  const col = minimax(board, depth, -Infinity, Infinity, true, aiDisc).column;
  return col !== null && cands.includes(col) ? col : cands[0];
}
