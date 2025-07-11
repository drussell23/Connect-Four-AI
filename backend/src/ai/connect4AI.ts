// src/ai/connect4AI.ts
import { performance } from "perf_hooks";
import { quiesce } from "./quiescence";

// 1) A 6 × 7 heatmap: central & lower cells matter most
const CELL_WEIGHTS: number[][] = [
  [3, 4, 5, 7, 5, 4, 3],
  [4, 6, 8, 10, 8, 6, 4],
  [5, 8, 11, 13, 11, 8, 5],
  [5, 8, 11, 13, 11, 8, 5],
  [4, 6, 8, 10, 8, 6, 4],
  [3, 4, 5, 7, 5, 4, 3],
];

// 2) Weight for opponent's connection potential (so we subtract it).
const OPP_CONN_POT_WEIGHT = 0.8;

// 3) Two-step fork penalty per threat.
const TWO_STEP_FORK_WEIGHT = 4000;

/** Valid values for each cell in the Connect 4 grid **/
export type CellValue = 'Empty' | 'Red' | 'Yellow';

/** Rich move info for ordering and pruning. **/
export interface Move {
  col: number;
  row: number;
  isWinning: boolean;
  isBlocking: boolean;
  futureThreats: number;
  score: number;
}

/**
 * Compute the row index where a disc would land if dropped in the given column.
 * Returns null if the column is already full or on any error/invalid input.
 */
export function getDropRow(
  board: CellValue[][],
  col: number
): number | null {
  try {
    // --- Validate board ---
    if (
      !Array.isArray(board) ||
      board.length === 0 ||
      !Array.isArray(board[0])
    ) {
      return null;
    }

    const ROWS = board.length;
    const COLS = board[0].length;

    // --- Validate column index ---
    if (!Number.isInteger(col) || col < 0 || col >= COLS) {
      return null;
    }

    // --- Find the lowest empty cell in that column ---
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 'Empty') {
        return r;
      }
    }

    // Column is full
    return null;

  } catch (err) {
    // Catch anything unexpected and fail safely
    return null;
  }
}


/**
 * Returns moves sorted by a composite strategic score:
 * 1) Immediate win
 * 2) Immediate block
 * 3) Static board evaluation after move
 * 4) Penalty for handing off opponent forks
 * 5) Center‐column bias
 */
export function orderedMoves(
  board: CellValue[][],
  currentPlayer: CellValue
): Move[] {
  const COLS = board[0].length;
  const center = Math.floor(COLS / 2);
  const opponent: CellValue = currentPlayer === 'Red' ? 'Yellow' : 'Red';

  // 1) Gather all legal moves
  const cols = legalMoves(board);

  const moves: Move[] = cols.map(col => {
    const row = getDropRow(board, col)!;
    // simulate drop
    const { board: afterUs } = tryDrop(board, col, currentPlayer);
    const { board: afterOppSim } = tryDrop(board, col, opponent);

    // 2) Tactical flags
    const isWinning = bitboardCheckWin(getBits(afterUs, currentPlayer));
    const isBlocking = bitboardCheckWin(getBits(afterOppSim, opponent));

    // 3) Positional score
    const posScore = evaluateBoard(afterUs, currentPlayer);

    // 4) Future threat penalty
    //   count how many forks the opponent will have after *our* move
    const futureThreats = countOpenThree(afterUs, opponent);

    // 5) Center bias
    const centerBonus = Math.max(0, 5 - Math.abs(col - center));

    // Composite:
    //  - Immediate win: +1e6
    //  - Immediate block: +1e5
    //  - Then positional minus big penalty per futureThreat
    const score =
      (isWinning ? 1e6 : 0) +
      (isBlocking ? 1e5 : 0) +
      posScore -
      futureThreats * 1e4 +
      centerBonus * 100;

    return { col, row, score, isWinning, isBlocking, futureThreats };
  });

  // 6) Sort by descending composite score
  return moves.sort((a, b) => b.score - a.score);
}

/** Returns an array of column indices (0–6) that are not full. **/
export function legalMoves(board: CellValue[][]): number[] {
  if (!board || !board[0]) return [];
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
export function getBits(board: CellValue[][], disc: CellValue): bigint {
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
  try {
    const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const aiCount = cells.filter(c => c === aiDisc).length;
    const humanCount = cells.filter(c => c === humanDisc).length;
    const emptyCount = cells.filter(c => c === 'Empty').length;

    // 1) Immediate four-in-a-row
    if (aiCount === 4) {
      return 1e6;
    }
    if (humanCount === 4) {
      return -1e6;
    }

    let score = 0;

    // 2) Open-three pattern (3 + 1 empty)
    if (aiCount === 3 && emptyCount === 1) {
      const ends = (cells[0] === 'Empty' ? 1 : 0) + (cells[3] === 'Empty' ? 1 : 0);
      const bonus = ends === 2 ? OPEN_THREE_BONUS.bothEnds * 20 : OPEN_THREE_BONUS.oneEnd * 10;
      score += BASE_SCORES[3] + bonus;
    }

    if (humanCount === 3 && emptyCount === 1) {
      const ends = (cells[0] === 'Empty' ? 1 : 0) + (cells[3] === 'Empty' ? 1 : 0);
      const penalty = ends === 2 ? OPEN_THREE_BONUS.bothEnds * 25 : OPEN_THREE_BONUS.oneEnd * 15;
      score -= BASE_SCORES[3] * 1.5 + penalty;
    }

    // 3) Two-in-a-row with two empties: building threats
    if (aiCount === 2 && emptyCount === 2) {
      const add = BASE_SCORES[2] * 1.2;
      score += add;
    }

    if (humanCount === 2 && emptyCount === 2) {
      const sub = BASE_SCORES[2] * 1.8;
      score -= sub;
    }

    // 4) Center‐cell bonus/penalty within this window
    const centerIdx = Math.floor(cells.length / 2);
    if (cells[centerIdx] === aiDisc) {
      score += CENTER_COLUMN_BONUS;
    }
    if (cells[centerIdx] === humanDisc) {
      score -= CENTER_COLUMN_BONUS;
    }

    return score;

  } catch (err) {
    // fail safe: no bias
    return 0;
  }
}

const DOUBLE_FORK_PENALTY = 1e7;
const SINGLE_FORK_PENALTY = 1e6;

/**
 * For every 4-cell “window” in all directions:
 *   - if there are 0 opponent discs, add (myCount²) * WEIGHT
 */
function evaluateConnectionPotential(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
  let total = 0;

  const addWindow = (cells: CellValue[]) => {
    const myCount = cells.filter(c => c === aiDisc).length;
    const oppCount = cells.filter(c => c === humanDisc).length;

    if (oppCount === 0 && myCount > 0) {
      total += (myCount * myCount) * 10;
    }
  };

  const R = board.length, C = board[0].length, W = 4;

  // Horizontal 
  for (let r = 0; r < R; r++) {
    for (let c = 0; c <= C - W; c++) {
      addWindow(board[r].slice(c, c + W));
    }
  }

  // Vertical 
  for (let c = 0; c < C; c++) {
    for (let r = 0; r <= R - W; r++) {
      addWindow([0, 1, 2, 3].map(i => board[r + i][c]));
    }
  }

  // Diagonals ↘
  for (let r = 0; r <= R - W; r++) {
    for (let c = 0; c <= C - W; c++) {
      addWindow([0, 1, 2, 3].map(i => board[r + i][c + i]));
    }
  }

  // Diagonals ↙
  for (let r = 0; r <= R - W; r++) {
    for (let c = W - 1; c < C; c++) {
      addWindow([0, 1, 2, 3].map(i => board[r + i][c - i]));
    }
  }

  return total;
}

/**
 * Count how many forced‐forks you can set up in two moves:
 * for each legal drop, assume opponent blocks your best threat,
 * then see if you can still create ≥1 open-three. 
 */
export function countTwoStepForks(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const opp = aiDisc === 'Red' ? 'Yellow' : 'Red';
  let forks = 0;
  for (const col of legalMoves(board)) {
    const { board: b1 } = tryDrop(board, col, aiDisc);
    const block = findOpenThreeBlock(b1, aiDisc);
    const b2 = block !== null ? tryDrop(b1, block, opp).board : b1;
    if (countOpenThree(b2, aiDisc) > 0) {
      forks++;
    }
  }
  return forks;
}

/** New helper: Raw cell-control score. */
function evaluateCellControl(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const rows = board.length;
  const cols = board[0].length;
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
  let s = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === aiDisc) s += CELL_WEIGHTS[r][c];
      else if (board[r][c] === humanDisc) s -= CELL_WEIGHTS[r][c];
    }
  }
  return s;
}

// You may want to bump this to match your DOUBLE_FORK_PENALTY scale:
const IMMEDIATE_THREAT_PENALTY = 1_000_000;

export function evaluateBoard(
  board: CellValue[][],
  aiDisc: CellValue,
  moveProbabilities?: number[],
  lastMove?: number, // The column of the move that led to this board state
): number {
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  const win = bitboardCheckWin(getBits(board, aiDisc));
  if (win) return 1e7;
  const loss = bitboardCheckWin(getBits(board, humanDisc));
  if (loss) return -1e7;

  const oppForks = countOpenThree(board, humanDisc);
  if (oppForks >= 2) return -DOUBLE_FORK_PENALTY;
  if (oppForks === 1) return -SINGLE_FORK_PENALTY;

  let score = evaluatePosition(board, aiDisc);

  if (moveProbabilities && lastMove !== undefined && moveProbabilities[lastMove]) {
    score += moveProbabilities[lastMove] * 50;
  }

  return score;
}

/**
 * Sum up all horizontal, vertical, diagonal windows and center‐column bonuses. */
export function evaluatePosition(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  let score = 0;
  const rows = board.length;
  const cols = board[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      score += evaluateWindow(board[r].slice(c, c + WINDOW), aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - WINDOW; r++) {
      const w = [0, 1, 2, 3].map(i => board[r + i][c]);
      score += evaluateWindow(w, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  for (let r = 0; r <= rows - WINDOW; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const dr = [0, 1, 2, 3].map(i => board[r + i][c + i]);
      score += evaluateWindow(dr, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
      const dl = [0, 1, 2, 3].map(i => board[r + i][c + WINDOW - 1 - i]);
      score += evaluateWindow(dl, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  const centerCol = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    if (board[r][centerCol] === aiDisc) score += CENTER_COLUMN_BONUS;
    else if (board[r][centerCol] === (aiDisc === 'Red' ? 'Yellow' : 'Red')) score -= CENTER_COLUMN_BONUS;
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
  const a = BigInt(Math.floor(Math.random() * 0xffffffff));
  const b = BigInt(Math.floor(Math.random() * 0xffffffff));
  return (a << 32n) | b;
}

const ZOBRIST_TABLE: bigint[][][] = Array.from({ length: 6 }, () =>
  Array.from({ length: 7 }, () => [rand64(), rand64(), rand64()])
);

export function hashBoard(board: CellValue[][]): bigint {
  let h = 0n;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const piece = board[r][c];
      if (piece !== 'Empty') {
        const pieceIdx = piece === 'Red' ? 0 : 1;
        h ^= ZOBRIST_TABLE[r][c][pieceIdx];
      }
    }
  }
  return h;
}

export function getEntry(hash: bigint): TranspositionEntry | undefined {
  return transposition.get(hash);
}

export function storeEntry(hash: bigint, entry: TranspositionEntry): void {
  if (transposition.size >= MAX_ENTRIES) {
    const firstKey = transposition.keys().next().value;
    transposition.delete(firstKey);
  }
  transposition.set(hash, entry);
}

export function clearTable(): void {
  transposition.clear();
}

/** Minimax with α–β, null-move pruning, history, transposition, and advanced logging **/
export interface Node {
  score: number;
  column: number | null;
}

const NULL_MOVE_REDUCTION = 2;

export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiDisc: CellValue,
  moveProbabilities?: number[],
  lastMove?: number
): Node {
  const hash = hashBoard(board);
  const entry = getEntry(hash);
  if (entry && entry.depth >= depth) {
    if (entry.flag === EntryFlag.Exact) return { score: entry.score, column: entry.column };
    if (entry.flag === EntryFlag.LowerBound) alpha = Math.max(alpha, entry.score);
    if (entry.flag === EntryFlag.UpperBound) beta = Math.min(beta, entry.score);
    if (alpha >= beta) return { score: entry.score, column: entry.column };
  }

  const winner = bitboardCheckWin(getBits(board, aiDisc)) ? aiDisc : bitboardCheckWin(getBits(board, (aiDisc === 'Red' ? 'Yellow' : 'Red'))) ? (aiDisc === 'Red' ? 'Yellow' : 'Red') : null;
  if (depth === 0 || winner) {
    return { score: evaluateBoard(board, aiDisc, moveProbabilities, lastMove), column: null };
  }

  const moves = orderedMoves(board, maximizingPlayer ? aiDisc : (aiDisc === 'Red' ? 'Yellow' : 'Red'));
  if (moves.length === 0) return { score: evaluateBoard(board, aiDisc, moveProbabilities, lastMove), column: null };

  let bestMove: number | null = moves[0].col;
  let bestScore = maximizingPlayer ? -Infinity : Infinity;
  let flag = EntryFlag.UpperBound;

  for (const move of moves) {
    const { board: nextBoard } = tryDrop(board, move.col, maximizingPlayer ? aiDisc : (aiDisc === 'Red' ? 'Yellow' : 'Red'));
    const result = minimax(nextBoard, depth - 1, alpha, beta, !maximizingPlayer, aiDisc, moveProbabilities, move.col);

    if (maximizingPlayer) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move.col;
      }
      alpha = Math.max(alpha, bestScore);
      if (alpha >= beta) break;
      flag = EntryFlag.LowerBound;
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move.col;
      }
      beta = Math.min(beta, bestScore);
      if (alpha >= beta) break;
    }
  }

  storeEntry(hash, { score: bestScore, depth, column: bestMove, flag });
  return { score: bestScore, column: bestMove };
}

export function hasImmediateWin(board: CellValue[][], disc: CellValue): boolean {
  for (const col of legalMoves(board)) {
    const { board: nextBoard } = tryDrop(board, col, disc);
    if (bitboardCheckWin(getBits(nextBoard, disc))) {
      return true;
    }
  }
  return false;
}

/**
 * Counts the number of open-three threats for a given player.
 * An open-three is a line of three discs with an empty cell at one end,
 * which can be completed to a four-in-a-row on the next turn.
 */
export function countOpenThree(board: CellValue[][], player: CellValue): number {
  const ROWS = board.length;
  const COLS = board[0].length;
  let count = 0;

  const directions = [
    { r: 0, c: 1 }, // Horizontal
    { r: 1, c: 0 }, // Vertical
    { r: 1, c: 1 }, // Diagonal down-right
    { r: 1, c: -1 }, // Diagonal down-left
  ];

  for (const dir of directions) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Check for patterns like OXXX_ or _XXXO
        for (let i = -1; i <= 1; i += 2) {
          const p1 = { r: r, c: c };
          const p2 = { r: r + dir.r, c: c + dir.c };
          const p3 = { r: r + 2 * dir.r, c: c + 2 * dir.c };
          const p4 = { r: r + 3 * dir.r, c: c + 3 * dir.c };

          const empty1 = { r: r - dir.r * i, c: c - dir.c * i };
          const empty2 = { r: r + 4 * dir.r * i, c: c + 4 * dir.c * i };

          const points = [p1, p2, p3, p4, empty1, empty2];
          if (points.some(p => p.r < 0 || p.r >= ROWS || p.c < 0 || p.c >= COLS)) {
            continue;
          }

          const threeDiscs = [p1, p2, p3].every(p => board[p.r][p.c] === player);
          const isEmpty = board[empty1.r][empty1.c] === 'Empty';

          if (threeDiscs && isEmpty) {
            count++;
          }
        }
      }
    }
  }
  return count;
}

/**
 * Finds the best column to block an opponent's open-three threat.
 * It scores threats based on direction and centrality.
 */
export function findOpenThreeBlock(
  board: CellValue[][],
  oppDisc: CellValue
): number | null {
  const ROWS = board.length;
  const COLS = board[0].length;
  if (ROWS === 0 || COLS === 0) {
    return null;
  }

  const center = Math.floor(COLS / 2);
  const DIR_WEIGHTS: Record<string, number> = {
    horiz: 5,
    vert: 3,
    diagDR: 4,
    diagDL: 4,
  };

  const threatScores = new Map<number, number>();

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - WINDOW; c++) {
      const cells = board[r].slice(c, c + WINDOW);
      const oppCount = cells.filter(x => x === oppDisc).length;
      const emptyCount = cells.filter(x => x === 'Empty').length;
      if (oppCount === 3 && emptyCount === 1) {
        const gapIdx = cells.findIndex(x => x === 'Empty');
        const gapCol = c + gapIdx;
        if (getDropRow(board, gapCol) === r) {
          const score = DIR_WEIGHTS['horiz'] * 100 - Math.abs(gapCol - center) * 10;
          threatScores.set(gapCol, Math.max(threatScores.get(gapCol) ?? -Infinity, score));
        }
      }
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - WINDOW; r++) {
      const cells = [0, 1, 2, 3].map(i => board[r + i][c]);
      const oppCount = cells.filter(x => x === oppDisc).length;
      const emptyCount = cells.filter(x => x === 'Empty').length;
      if (oppCount === 3 && emptyCount === 1) {
        const gapIdx = cells.findIndex(x => x === 'Empty');
        const gapRow = r + gapIdx;
        if (getDropRow(board, c) === gapRow) {
          const score = DIR_WEIGHTS['vert'] * 100 - Math.abs(c - center) * 10;
          threatScores.set(c, Math.max(threatScores.get(c) ?? -Infinity, score));
        }
      }
    }
  }

  // Diagonals
  for (let r = 0; r <= ROWS - WINDOW; r++) {
    for (let c = 0; c <= COLS - WINDOW; c++) {
      const diagDR = [0, 1, 2, 3].map(i => board[r + i][c + i]);
      if (diagDR.filter(x => x === oppDisc).length === 3 && diagDR.filter(x => x === 'Empty').length === 1) {
        const gapIdx = diagDR.findIndex(x => x === 'Empty');
        if (getDropRow(board, c + gapIdx) === r + gapIdx) {
          const score = DIR_WEIGHTS['diagDR'] * 100 - Math.abs(c + gapIdx - center) * 10;
          threatScores.set(c + gapIdx, Math.max(threatScores.get(c + gapIdx) ?? -Infinity, score));
        }
      }
    }
  }

  for (let r = 0; r <= ROWS - WINDOW; r++) {
    for (let c = WINDOW - 1; c < COLS; c++) {
      const diagDL = [0, 1, 2, 3].map(i => board[r + i][c - i]);
      if (diagDL.filter(x => x === oppDisc).length === 3 && diagDL.filter(x => x === 'Empty').length === 1) {
        const gapIdx = diagDL.findIndex(x => x === 'Empty');
        if (getDropRow(board, c - gapIdx) === r + gapIdx) {
          const score = DIR_WEIGHTS['diagDL'] * 100 - Math.abs(c - gapIdx - center) * 10;
          threatScores.set(c - gapIdx, Math.max(threatScores.get(c - gapIdx) ?? -Infinity, score));
        }
      }
    }
  }

  if (threatScores.size === 0) {
    return null;
  }

  let bestCol: number | null = null;
  let bestScore = -Infinity;
  for (const [col, score] of threatScores) {
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
}


/** Monte Carlo Tree Search **/
export interface MCTSNode {
  board: CellValue[][];
  player: CellValue;
  visits: number;
  wins: number;
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null; // The move that led to this node
  priorProb: number; // Prior probability from a policy network
}

export function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map(row => [...row]);
}

// Selects a node to expand using the PUCT formula (UCT with prior probabilities)
function select(node: MCTSNode, moveProbabilities?: number[]): MCTSNode {
  let currentNode = node;
  while (currentNode.children.length > 0) {
    let bestChild: MCTSNode | null = null;
    let bestScore = -Infinity;

    for (const child of currentNode.children) {
      if (child.visits === 0) {
        return child; // Prefer unvisited children
      }

      // PUCT formula from AlphaGo
      const qValue = child.wins / child.visits; // Exploitation
      const cPuct = 1.5; // Exploration constant
      const uValue = cPuct * child.priorProb * (Math.sqrt(currentNode.visits) / (1 + child.visits)); // Exploration
      const score = qValue + uValue;

      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }
    currentNode = bestChild!;
  }
  return currentNode;
}

// Expands a node by creating all possible child nodes
function expand(node: MCTSNode, moveProbabilities?: number[]): void {
  const moves = legalMoves(node.board);
  const uniformProb = 1 / moves.length;

  for (const move of moves) {
    const { board: newBoard } = tryDrop(node.board, move, node.player);
    const priorProb = moveProbabilities ? (moveProbabilities[move] ?? 0) : uniformProb;

    const childNode: MCTSNode = {
      board: newBoard,
      player: node.player === 'Red' ? 'Yellow' : 'Red',
      visits: 0,
      wins: 0,
      parent: node,
      children: [],
      move: move,
      priorProb: priorProb,
    };
    node.children.push(childNode);
  }
}

// Simulates a random playout from a node until a terminal state is reached
function playout(node: MCTSNode, aiDisc: CellValue): CellValue {
  let board = cloneBoard(node.board);
  let player = node.player;

  for (let i = 0; i < 42; i++) { // Max playout depth
    if (bitboardCheckWin(getBits(board, player))) {
      return player;
    }
    const moves = legalMoves(board);
    if (moves.length === 0) return 'Empty'; // Draw

    const move = moves[Math.floor(Math.random() * moves.length)];
    board = tryDrop(board, move, player).board;
    player = player === 'Red' ? 'Yellow' : 'Red';
  }
  return 'Empty'; // Draw
}

// Backpropagates the result of a playout up the tree
function backpropagate(node: MCTSNode, winner: CellValue): void {
  let current: MCTSNode | null = node;
  while (current) {
    current.visits++;
    // A win is counted for a node if the winner of the playout is the player
    // whose turn it was at that node. We are always maximizing for the AI player.
    if (winner === current.player) {
      current.wins++;
    }
    current = current.parent;
  }
}


// Main MCTS function
export function mcts(
  rootBoard: CellValue[][],
  aiDisc: CellValue,
  timeMs: number,
  moveProbabilities?: number[],
): number {
  const opponent: CellValue = aiDisc === 'Red' ? 'Yellow' : 'Red';

  const root: MCTSNode = {
    board: rootBoard,
    player: aiDisc,
    visits: 0,
    wins: 0,
    parent: null,
    children: [],
    move: null,
    priorProb: 1.0, // Root node has no prior move
  };

  const startTime = Date.now();
  while (Date.now() - startTime < timeMs) {
    let leaf = select(root, moveProbabilities);

    // If the selected leaf is not a terminal state, expand it.
    const isTerminal = bitboardCheckWin(getBits(leaf.board, opponent)) || bitboardCheckWin(getBits(leaf.board, aiDisc));
    if (!isTerminal) {
      expand(leaf, moveProbabilities);
      // After expansion, the leaf might have children. We select one to playout from.
      if (leaf.children.length > 0) {
        leaf = leaf.children[Math.floor(Math.random() * leaf.children.length)];
      }
    }

    const winner = playout(leaf, aiDisc);
    backpropagate(leaf, winner);
  }

  if (root.children.length === 0) {
    const moves = legalMoves(rootBoard);
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : -1;
  }

  const bestChild = root.children.reduce((best, child) => {
    const childWinRate = (child.wins / (child.visits + 1e-6));
    const bestWinRate = (best.wins / (best.visits + 1e-6));
    return childWinRate > bestWinRate ? child : best;
  });

  return bestChild.move!;
}


const ENGINE_MAX_DEPTH = 42;

export function iterativeDeepeningMinimax(
  board: CellValue[][],
  aiDisc: CellValue,
  timeLimitMs: number,
  moveProbabilities?: number[],
): number {
  clearTable();
  const moves = legalMoves(board);
  if (moves.length === 0) return -1;

  // Immediate win check
  for (const move of moves) {
    const { board: nextBoard } = tryDrop(board, move, aiDisc);
    if (bitboardCheckWin(getBits(nextBoard, aiDisc))) {
      return move;
    }
  }

  const totalCells = board.length * board[0].length;
  const emptyCells = board.flat().filter(c => c === 'Empty').length;
  const gamePhase = (totalCells - emptyCells) / totalCells;

  const startDepth = gamePhase < 0.3 ? 4 : gamePhase < 0.7 ? 6 : 8;

  let bestMove = moves[0];
  const startTime = performance.now();

  for (let d = startDepth; d <= ENGINE_MAX_DEPTH; d += 2) {
    const elapsed = performance.now() - startTime;
    if (elapsed * 3 > timeLimitMs) { // Heuristic to stop before timeout
      break;
    }

    const result = minimax(board, d, -Infinity, Infinity, true, aiDisc, moveProbabilities);
    if (result.column !== null) {
      bestMove = result.column;
      // If a winning move is found at this depth, take it immediately
      if (result.score >= 1e8) {
        return bestMove;
      }
    }
  }

  if (bestMove === undefined || bestMove === null) {
    const legal = legalMoves(board);
    return legal[Math.floor(Math.random() * legal.length)];
  }

  return bestMove;
}

// Special AI Abilities Implementation
export interface AIAbilityConfig {
  specialAbilities: string[];
  playerPatterns: {
    favoriteColumns: number[];
    weaknessesExploited: string[];
    threatRecognitionSpeed: number;
    endgameStrength: number;
  };
  personality: {
    aggressiveness: number;
    patience: number;
  };
  level: number;
}

/**
 * Threat Prediction: AI predicts player's next 2-3 moves based on patterns
 */
export function predictPlayerThreats(
  board: CellValue[][],
  playerDisc: CellValue,
  playerPatterns: AIAbilityConfig['playerPatterns']
): number[] {
  const threats: number[] = [];
  const favoriteColumns = playerPatterns.favoriteColumns;

  // Check each favorite column for potential threats
  for (const col of favoriteColumns) {
    if (getDropRow(board, col) !== null) {
      const { board: testBoard } = tryDrop(board, col, playerDisc);

      // Check if this move creates a threat
      const threatCount = countOpenThree(testBoard, playerDisc);
      if (threatCount > 0) {
        threats.push(col);
      }

      // Check if this move sets up a future threat
      const legal = legalMoves(testBoard);
      for (const nextCol of legal) {
        const { board: futureBoard } = tryDrop(testBoard, nextCol, playerDisc);
        if (countOpenThree(futureBoard, playerDisc) > threatCount) {
          threats.push(col);
          break;
        }
      }
    }
  }

  return [...new Set(threats)]; // Remove duplicates
}

/**
 * Counter-Strategy: AI adapts its move selection based on player patterns
 */
export function applyCounterStrategy(
  board: CellValue[][],
  aiDisc: CellValue,
  playerPatterns: AIAbilityConfig['playerPatterns']
): number | null {
  const playerDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  // Counter favorite columns by playing adjacent or blocking
  const favoriteColumns = playerPatterns.favoriteColumns;
  const moves = legalMoves(board);

  for (const favCol of favoriteColumns) {
    // Try to occupy spaces near player's favorite columns
    const adjacentColumns = [favCol - 1, favCol + 1].filter(c =>
      c >= 0 && c < board[0].length && moves.includes(c)
    );

    for (const adjCol of adjacentColumns) {
      const { board: testBoard } = tryDrop(board, adjCol, aiDisc);
      const score = evaluateBoard(testBoard, aiDisc);

      // If placing here creates a significant advantage, do it
      if (score > 500) {
        return adjCol;
      }
    }
  }

  // Exploit known weaknesses
  const weaknesses = playerPatterns.weaknessesExploited;
  if (weaknesses.some(w => w.includes('side_columns'))) {
    // Player is weak with side columns, force them there
    const sideColumns = [0, 1, 5, 6].filter(c => moves.includes(c));
    if (sideColumns.length > 0) {
      return sideColumns[0];
    }
  }

  return null;
}

/**
 * Perfect Opening: AI uses optimal opening moves based on game theory
 */
export function getPerfectOpening(
  board: CellValue[][],
  aiDisc: CellValue,
  moveNumber: number
): number | null {
  const centerCol = Math.floor(board[0].length / 2);
  const moves = legalMoves(board);

  if (moveNumber === 1) {
    // First move: Always center
    return moves.includes(centerCol) ? centerCol : null;
  }

  if (moveNumber === 2) {
    // Second move: Stay in center area
    const centerArea = [centerCol - 1, centerCol, centerCol + 1];
    for (const col of centerArea) {
      if (moves.includes(col)) {
        return col;
      }
    }
  }

  if (moveNumber <= 6) {
    // Early game: Control center and create threats
    const priorityColumns = [centerCol, centerCol - 1, centerCol + 1, centerCol - 2, centerCol + 2];
    for (const col of priorityColumns) {
      if (moves.includes(col)) {
        const { board: testBoard } = tryDrop(board, col, aiDisc);
        const threats = countOpenThree(testBoard, aiDisc);
        if (threats > 0) {
          return col;
        }
      }
    }

    // Return first available priority column
    return priorityColumns.find(col => moves.includes(col)) || null;
  }

  return null;
}

/**
 * Psychological Warfare: AI uses timing and move selection to pressure player
 */
export function applyPsychologicalWarfare(
  board: CellValue[][],
  aiDisc: CellValue,
  playerPatterns: AIAbilityConfig['playerPatterns'],
  personality: AIAbilityConfig['personality']
): { move: number | null; delayMs: number; message?: string } {
  const moves = legalMoves(board);
  const playerDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  // Calculate psychological pressure
  const playerThreats = countOpenThree(board, playerDisc);
  const aiThreats = countOpenThree(board, aiDisc);

  // If player is under pressure (low threat recognition speed), move quickly to increase pressure
  if (playerPatterns.threatRecognitionSpeed < 0.5 && aiThreats > playerThreats) {
    const aggressiveMove = moves.find(col => {
      const { board: testBoard } = tryDrop(board, col, aiDisc);
      return countOpenThree(testBoard, aiDisc) > aiThreats;
    });

    return {
      move: aggressiveMove || null,
      delayMs: 500, // Quick move to pressure
      message: "I sense your hesitation..."
    };
  }

  // If player is strong in endgame, try to complicate the position early
  if (playerPatterns.endgameStrength > 0.7) {
    const complicatingMove = moves.find(col => {
      const { board: testBoard } = tryDrop(board, col, aiDisc);
      const evaluation = evaluateBoard(testBoard, aiDisc);
      return evaluation > 200; // Moves that create complex positions
    });

    return {
      move: complicatingMove || null,
      delayMs: 2000, // Deliberate pause
      message: "Let's make this interesting..."
    };
  }

  // High aggressiveness: Make threatening moves with confidence
  if (personality.aggressiveness > 0.8) {
    const threateningMove = moves.find(col => {
      const { board: testBoard } = tryDrop(board, col, aiDisc);
      return hasImmediateWin(testBoard, aiDisc);
    });

    if (threateningMove) {
      return {
        move: threateningMove,
        delayMs: 1000,
        message: "This is where you fall."
      };
    }
  }

  return { move: null, delayMs: 1000 };
}

/**
 * Enhanced AI entry point with special abilities
 */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 1000,
  moveProbabilities?: number[],
  abilityConfig?: AIAbilityConfig
): number {
  const emptyCells = board.flat().filter(c => c === 'Empty').length;
  const totalCells = board.length * board[0].length;
  const moveNumber = totalCells - emptyCells + 1;

  let specialMove: number | null = null;

  // Apply special abilities if available
  if (abilityConfig?.specialAbilities) {
    const abilities = abilityConfig.specialAbilities;

    // Perfect Opening (Level 20+)
    if (abilities.includes('perfect_opening') && moveNumber <= 6) {
      specialMove = getPerfectOpening(board, aiDisc, moveNumber);
      if (specialMove !== null) {
        return specialMove;
      }
    }

    // Threat Prediction (Level 10+)
    if (abilities.includes('threat_prediction')) {
      const playerDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
      const predictedThreats = predictPlayerThreats(board, playerDisc, abilityConfig.playerPatterns);

      // If we predict player threats, try to block them preemptively
      for (const threatCol of predictedThreats) {
        if (legalMoves(board).includes(threatCol)) {
          const { board: testBoard } = tryDrop(board, threatCol, aiDisc);
          const score = evaluateBoard(testBoard, aiDisc);
          if (score > 0) {
            return threatCol;
          }
        }
      }
    }

    // Counter-Strategy (Level 15+)
    if (abilities.includes('counter_strategy')) {
      specialMove = applyCounterStrategy(board, aiDisc, abilityConfig.playerPatterns);
      if (specialMove !== null && legalMoves(board).includes(specialMove)) {
        return specialMove;
      }
    }

    // Psychological Warfare (Level 25+)
    if (abilities.includes('psychological_warfare')) {
      const psychResult = applyPsychologicalWarfare(
        board,
        aiDisc,
        abilityConfig.playerPatterns,
        abilityConfig.personality
      );
      if (psychResult.move !== null && legalMoves(board).includes(psychResult.move)) {
        return psychResult.move;
      }
    }
  }

  // Fall back to standard AI logic
  if (emptyCells > 12) {
    return iterativeDeepeningMinimax(board, aiDisc, timeMs, moveProbabilities);
  } else {
    return iterativeDeepeningMinimax(board, aiDisc, timeMs, moveProbabilities);
  }
}
export function blockFloatingOpenThreeDiagonal(
  board: CellValue[][],
  oppDisc: CellValue
): number | null {
  console.log('[blockFloatingOpenThreeDiagonal] ENTER', { rows: board.length, cols: board[0]?.length, oppDisc });
  try {
    const ROWS = board.length;
    const COLS = board[0].length;

    if (!ROWS || !COLS) {
      console.error('[blockFloatingOpenThreeDiagonal] Invalid board shape', board);
      return null;
    }

    // Helper to scan a window
    const scanWindow = (
      coords: [number, number][],
      dir: string
    ): number | null => {
      const cells = coords.map(([r, c]) => board[r][c]);

      console.log(
        `[blockFloatingOpenThreeDiagonal] scanning ${dir}`,
        coords,
        'cells=', cells
      );

      const oppCount = cells.filter(x => x === oppDisc).length;
      const emptyCount = cells.filter(x => x === 'Empty').length;

      if (oppCount === 3 && emptyCount === 1) {
        const idx = cells.findIndex(x => x === 'Empty');
        const gapCol = coords[idx][1];
        console.log(
          `[blockFloatingOpenThreeDiagonal] pattern match ${dir}`,
          'gap at', coords[idx],
          `-> column ${gapCol}`
        );
        return gapCol;
      }
      return null;
    };

    // ↘︎ diagonal
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const coords: [number, number][] = [
          [r, c],
          [r + 1, c + 1],
          [r + 2, c + 2],
          [r + 3, c + 3]
        ];

        const col = scanWindow(coords, 'diagDR');

        if (col !== null) {
          return col;
        }
      }
    }

    // ↙︎ diagonal
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const coords: [number, number][] = [
          [r, c],
          [r - 1, c + 1],
          [r - 2, c + 2],
          [r - 3, c + 3]
        ];

        const col = scanWindow(coords, 'diagDL');

        if (col !== null) {
          return col;
        }
      }
    }

    console.log('[blockFloatingOpenThreeDiagonal] No floating diagonal threat found');
    return null;
  } catch (error) {
    console.error('[blockFloatingOpenThreeDiagonal] Unexpected error:', error);
    return null;
  }
}