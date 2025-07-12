// src/ai/connect4AI.ts
import { performance } from "perf_hooks";
import { quiesce } from "./quiescence";

// Import our advanced AI systems
import { DQN } from "./algorithms/value_based/DQN";
import { DoubleDQN } from "./algorithms/value_based/DoubleDQN";
import { DuelingDQN } from "./algorithms/value_based/DuelingDQN";
import { RainbowDQN } from "./algorithms/value_based/RainbowDQN";
import { EnhancedAlphaZero } from "./algorithms/hybrid/EnhancedAlphaZero";
import { Connect4CNN, networkManager } from "./networks/cnnNetworks";
import { Connect4ResNet } from "./networks/residualNetwork";
import { Connect4AttentionNetwork } from "./networks/attentionNetwork";

// Import optimizers
import { AdamWOptimizer, AdamWConfig, AdamWPresets } from "./optimizers/adamW";
import { EntropyRegularizer, EntropyRegularizerConfig, EntropyRegularizerPresets } from "./optimizers/entropyRegularizer";
import { LearningRateScheduler, LearningRateSchedulerConfig, LearningRateSchedulerPresets } from "./optimizers/learningRateScheduler";

// Import DRL training system
import {
  Connect4DRLTrainer,
  Connect4DRLEnvironment,
  Connect4DRLConfig,
  TrainingMetrics,
  EpisodeResult,
  createConnect4DRLTrainer
} from "./connect4DRL";

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
 * For every 4-cell "window" in all directions:
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

/** Check if a position requires quiescence search (has tactical instability) */
export function isPositionNoisy(board: CellValue[][], aiDisc: CellValue): boolean {
  const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  // Check for immediate wins available
  for (const col of legalMoves(board)) {
    const { board: afterAI } = tryDrop(board, col, aiDisc);
    if (bitboardCheckWin(getBits(afterAI, aiDisc))) {
      return true; // Immediate win available
    }

    const { board: afterOpp } = tryDrop(board, col, oppDisc);
    if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
      return true; // Immediate threat needs to be blocked
    }
  }

  // Check for multiple threats or forks
  const aiThreats = countOpenThree(board, aiDisc);
  const oppThreats = countOpenThree(board, oppDisc);

  if (aiThreats > 0 || oppThreats > 0) {
    return true; // Active threats present
  }

  // Check if any move creates new threats
  for (const col of legalMoves(board)) {
    const { board: afterAI } = tryDrop(board, col, aiDisc);
    if (countOpenThree(afterAI, aiDisc) > aiThreats) {
      return true; // Move creates new threats
    }

    const { board: afterOpp } = tryDrop(board, col, oppDisc);
    if (countOpenThree(afterOpp, oppDisc) > oppThreats) {
      return true; // Opponent could create threats
    }
  }

  return false; // Position is quiet
}

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

  // Terminal position or depth limit reached
  if (winner) {
    const score = winner === aiDisc ? 1e7 : -1e7;
    return { score, column: null };
  }

  if (depth === 0) {
    // Intelligent quiescence search integration
    const isNoisy = isPositionNoisy(board, aiDisc);

    if (isNoisy) {
      // Position has tactical elements - use quiescence search
      const quiesceResult = quiesce(board, alpha, beta, aiDisc);
      return { score: quiesceResult.score, column: quiesceResult.column };
    } else {
      // Position is quiet - use static evaluation
      const staticScore = evaluateBoard(board, aiDisc, moveProbabilities, lastMove);
      return { score: staticScore, column: null };
    }
  }

  const moves = orderedMoves(board, maximizingPlayer ? aiDisc : (aiDisc === 'Red' ? 'Yellow' : 'Red'));
  if (moves.length === 0) {
    // No legal moves - should not happen in Connect 4 unless board is full
    const staticScore = evaluateBoard(board, aiDisc, moveProbabilities, lastMove);
    return { score: staticScore, column: null };
  }

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

// Enhanced version of the original getBestAIMove function for backward compatibility
export function getEnhancedAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 1000,
  moveProbabilities?: number[],
  abilityConfig?: AIAbilityConfig
): number {
  // Use existing implementation for backward compatibility
  return getBestAIMove(board, aiDisc, timeMs, moveProbabilities, abilityConfig);
}

// Enhanced AI Configuration for ultimate performance
export interface UltimateAIConfig {
  // AI Strategy Selection
  primaryStrategy: 'minimax' | 'mcts' | 'dqn' | 'alphazero' | 'hybrid' | 'ensemble';

  // Deep Learning Configuration
  neuralNetwork: {
    type: 'cnn' | 'resnet' | 'attention' | 'ensemble';
    enableTraining: boolean;
    trainingFrequency: number;
    batchSize: number;
    learningRate: number;
  };

  // Reinforcement Learning
  reinforcementLearning: {
    algorithm: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn';
    experienceReplay: boolean;
    targetUpdateFreq: number;
    exploration: {
      strategy: 'epsilon_greedy' | 'noisy_networks' | 'ucb';
      initialValue: number;
      decayRate: number;
      finalValue: number;
    };
  };

  // MCTS Configuration
  mcts: {
    simulations: number;
    timeLimit: number;
    explorationConstant: number;
    progressiveWidening: boolean;
    parallelization: boolean;
  };

  // Advanced Features
  advanced: {
    multiAgent: boolean;
    metaLearning: boolean;
    curriculumLearning: boolean;
    populationTraining: boolean;
    explainableAI: boolean;
    realTimeAdaptation: boolean;
  };

  // Performance Settings
  performance: {
    maxThinkingTime: number;
    multiThreading: boolean;
    memoryLimit: number;
    gpuAcceleration: boolean;
  };

  // Optimizer Configuration
  optimizers: {
    adamW: {
      enabled: boolean;
      preset: 'neuralNetwork' | 'reinforcementLearning' | 'fineTuning' | 'highPerformance' | 'custom';
      config: Partial<AdamWConfig>;
    };
    entropyRegularizer: {
      enabled: boolean;
      preset: 'policyGradient' | 'continuousControl' | 'highExploration' | 'lowExploration' | 'custom';
      config: Partial<EntropyRegularizerConfig>;
    };
    learningRateScheduler: {
      enabled: boolean;
      preset: 'neuralNetwork' | 'cosineAnnealing' | 'oneCycle' | 'adaptive' | 'custom';
      config: Partial<LearningRateSchedulerConfig>;
    };
    integration: {
      adaptiveOptimization: boolean;
      crossOptimizerLearning: boolean;
      performanceMonitoring: boolean;
      autoTuning: boolean;
    };
  };

  // Deep Reinforcement Learning Training Configuration
  drlTraining: {
    enabled: boolean;
    continuousLearning: boolean;
    selfPlayEnabled: boolean;
    experienceReplaySize: number;
    trainingInterval: number; // Train every N games
    evaluationInterval: number; // Evaluate every N episodes
    config: Partial<Connect4DRLConfig>;
    backgroundTraining: boolean;
    modelVersioning: boolean;
    adaptiveRewardShaping: boolean;
  };
}

export interface AIDecision {
  move: number;
  confidence: number;
  reasoning: string;
  alternativeMoves: Array<{
    move: number;
    score: number;
    reasoning: string;
  }>;
  thinkingTime: number;
  nodesExplored: number;
  strategy: string;
  metadata: {
    neuralNetworkEvaluation?: {
      policy: number[];
      value: number;
      confidence: number;
    };
    mctsStatistics?: {
      simulations: number;
      averageDepth: number;
      bestLine: number[];
    };
    reinforcementLearning?: {
      qValues: number[];
      exploration: boolean;
      epsilonValue: number;
    };
  };
}

/**
 * Ultimate Connect Four AI - The Most Advanced AI System
 * 
 * Features:
 * 1. Multiple AI paradigms (Minimax, MCTS, Deep RL, AlphaZero)
 * 2. Advanced neural networks (CNN, ResNet, Attention)
 * 3. Ensemble methods combining multiple approaches
 * 4. Real-time learning and adaptation
 * 5. Explainable AI with decision reasoning
 * 6. Performance optimization and parallelization
 * 7. Population-based training
 * 8. Meta-learning for rapid adaptation
 */
export class UltimateConnect4AI {
  private config: UltimateAIConfig;

  // AI Agents
  private dqnAgent: DQN | null = null;
  private doubleDqnAgent: DoubleDQN | null = null;
  private duelingDqnAgent: DuelingDQN | null = null;
  private rainbowDqnAgent: RainbowDQN | null = null;
  private alphaZeroAgent: EnhancedAlphaZero | null = null;

  // Neural Networks
  private cnnNetwork: Connect4CNN | null = null;
  private resNetNetwork: Connect4ResNet | null = null;
  private attentionNetwork: Connect4AttentionNetwork | null = null;

  // Optimizers
  private adamWOptimizer: AdamWOptimizer | null = null;
  private entropyRegularizer: EntropyRegularizer | null = null;
  private learningRateScheduler: LearningRateScheduler | null = null;

  // DRL Training System
  private drlTrainer: Connect4DRLTrainer | null = null;
  private drlEnvironment: Connect4DRLEnvironment | null = null;
  private drlMetrics: TrainingMetrics[] = [];
  private gamesPlayedSinceTraining: number = 0;
  private lastDRLEvaluation: number = 0;

  // Performance tracking
  private gameHistory: Array<{
    board: CellValue[][];
    move: number;
    evaluation: number;
    timestamp: number;
  }> = [];

  private learningMetrics = {
    gamesPlayed: 0,
    averageThinkingTime: 0,
    winRate: 0,
    learningProgress: 0,
    adaptationRate: 0
  };

  constructor(config: Partial<UltimateAIConfig> = {}) {
    this.config = {
      primaryStrategy: 'hybrid',
      neuralNetwork: {
        type: 'ensemble',
        enableTraining: true,
        trainingFrequency: 10,
        batchSize: 32,
        learningRate: 0.001
      },
      reinforcementLearning: {
        algorithm: 'rainbow_dqn',
        experienceReplay: true,
        targetUpdateFreq: 100,
        exploration: {
          strategy: 'noisy_networks',
          initialValue: 1.0,
          decayRate: 0.995,
          finalValue: 0.01
        }
      },
      mcts: {
        simulations: 1000,
        timeLimit: 5000,
        explorationConstant: 1.414,
        progressiveWidening: true,
        parallelization: true
      },
      advanced: {
        multiAgent: true,
        metaLearning: true,
        curriculumLearning: true,
        populationTraining: true,
        explainableAI: true,
        realTimeAdaptation: true
      },
      performance: {
        maxThinkingTime: 10000,
        multiThreading: true,
        memoryLimit: 1024,
        gpuAcceleration: false
      },
      optimizers: {
        adamW: {
          enabled: true,
          preset: 'neuralNetwork',
          config: {}
        },
        entropyRegularizer: {
          enabled: true,
          preset: 'policyGradient',
          config: {}
        },
        learningRateScheduler: {
          enabled: true,
          preset: 'neuralNetwork',
          config: {}
        },
        integration: {
          adaptiveOptimization: true,
          crossOptimizerLearning: true,
          performanceMonitoring: true,
          autoTuning: true
        }
      },
      drlTraining: {
        enabled: true,
        continuousLearning: true,
        selfPlayEnabled: true,
        experienceReplaySize: 100000,
        trainingInterval: 50, // Train every 50 games
        evaluationInterval: 1000, // Evaluate every 1000 episodes
        config: {
          training: {
            algorithm: 'rainbow_dqn',
            episodes: 10000,
            maxStepsPerEpisode: 42,
            batchSize: 32,
            learningRate: 0.001,
            discountFactor: 0.99,
            explorationStrategy: 'epsilon_greedy',
            targetUpdateFrequency: 100
          },
          selfPlay: {
            enabled: true,
            opponentStrategies: ['minimax', 'mcts', 'trained_model'],
            curriculumLearning: true,
            adaptiveDifficulty: true,
            tournamentMode: false
          }
        },
        backgroundTraining: true,
        modelVersioning: true,
        adaptiveRewardShaping: true
      },
      ...config
    };

    this.initializeAI();
  }

  private async initializeAI(): Promise<void> {
    console.log('🚀 Initializing Ultimate Connect Four AI...');

    // Initialize optimizers
    await this.initializeOptimizers();

    // Initialize neural networks
    await this.initializeNeuralNetworks();

    // Initialize reinforcement learning agents
    await this.initializeRLAgents();

    // Initialize AlphaZero
    await this.initializeAlphaZero();

    // Initialize DRL Training System
    if (this.config.drlTraining.enabled) {
      await this.initializeDRLTraining();
    }

    console.log('✅ Ultimate AI with DRL training initialized successfully!');
  }

  private async initializeOptimizers(): Promise<void> {
    const { optimizers } = this.config;

    // Initialize AdamW Optimizer
    if (optimizers.adamW.enabled) {
      let config: Partial<AdamWConfig>;

      switch (optimizers.adamW.preset) {
        case 'neuralNetwork':
          config = AdamWPresets.neuralNetwork();
          break;
        case 'reinforcementLearning':
          config = AdamWPresets.reinforcementLearning();
          break;
        case 'fineTuning':
          config = AdamWPresets.fineTuning();
          break;
        case 'highPerformance':
          config = AdamWPresets.highPerformance();
          break;
        case 'custom':
          config = optimizers.adamW.config;
          break;
        default:
          config = AdamWPresets.neuralNetwork();
      }

      // Override with custom config
      config = { ...config, ...optimizers.adamW.config };

      this.adamWOptimizer = new AdamWOptimizer(config);
      console.log(`🔧 AdamW optimizer initialized with ${optimizers.adamW.preset} preset`);
    }

    // Initialize Entropy Regularizer
    if (optimizers.entropyRegularizer.enabled) {
      let config: Partial<EntropyRegularizerConfig>;

      switch (optimizers.entropyRegularizer.preset) {
        case 'policyGradient':
          config = EntropyRegularizerPresets.policyGradient();
          break;
        case 'continuousControl':
          config = EntropyRegularizerPresets.continuousControl();
          break;
        case 'highExploration':
          config = EntropyRegularizerPresets.highExploration();
          break;
        case 'lowExploration':
          config = EntropyRegularizerPresets.lowExploration();
          break;
        case 'custom':
          config = optimizers.entropyRegularizer.config;
          break;
        default:
          config = EntropyRegularizerPresets.policyGradient();
      }

      // Override with custom config
      config = { ...config, ...optimizers.entropyRegularizer.config };

      this.entropyRegularizer = new EntropyRegularizer(config);
      console.log(`🎯 Entropy regularizer initialized with ${optimizers.entropyRegularizer.preset} preset`);
    }

    // Initialize Learning Rate Scheduler
    if (optimizers.learningRateScheduler.enabled) {
      let config: Partial<LearningRateSchedulerConfig>;

      switch (optimizers.learningRateScheduler.preset) {
        case 'neuralNetwork':
          config = LearningRateSchedulerPresets.neuralNetwork();
          break;
        case 'cosineAnnealing':
          config = LearningRateSchedulerPresets.cosineAnnealing();
          break;
        case 'oneCycle':
          config = LearningRateSchedulerPresets.oneCycle();
          break;
        case 'adaptive':
          config = LearningRateSchedulerPresets.adaptive();
          break;
        case 'custom':
          config = optimizers.learningRateScheduler.config;
          break;
        default:
          config = LearningRateSchedulerPresets.neuralNetwork();
      }

      // Override with custom config
      config = { ...config, ...optimizers.learningRateScheduler.config };

      this.learningRateScheduler = new LearningRateScheduler(config);
      console.log(`📈 Learning rate scheduler initialized with ${optimizers.learningRateScheduler.preset} preset`);
    }

    // Initialize cross-optimizer integration
    if (optimizers.integration.crossOptimizerLearning) {
      this.initializeCrossOptimizerIntegration();
    }

    console.log('⚙️  All optimizers initialized successfully!');
  }

  private initializeCrossOptimizerIntegration(): void {
    // Set up communication between optimizers
    if (this.adamWOptimizer && this.learningRateScheduler) {
      // Link AdamW with learning rate scheduler
      const originalStep = this.adamWOptimizer.step.bind(this.adamWOptimizer);
      this.adamWOptimizer.step = (gradients: Map<string, number[]>, loss?: number) => {
        // Update learning rate scheduler
        const newLr = this.learningRateScheduler!.step(loss);

        // Update AdamW learning rate
        this.adamWOptimizer!.updateConfig({ learningRate: newLr });

        // Perform original step
        return originalStep(gradients, loss);
      };
    }

    if (this.entropyRegularizer && this.learningRateScheduler) {
      // Link entropy regularizer with learning rate scheduler
      const originalUpdateCoefficient = this.entropyRegularizer.updateCoefficient.bind(this.entropyRegularizer);
      this.entropyRegularizer.updateCoefficient = () => {
        originalUpdateCoefficient();

        // Adapt entropy based on learning rate phase
        const phase = this.learningRateScheduler!.getCurrentPhase();
        if (phase === 'warmup') {
          // Higher exploration during warmup
          this.entropyRegularizer!.updateConfig({
            schedule: { ...this.entropyRegularizer!.getMetrics().config.schedule, type: 'linear' }
          });
        } else if (phase === 'cooldown') {
          // Lower exploration during cooldown
          this.entropyRegularizer!.updateConfig({
            schedule: { ...this.entropyRegularizer!.getMetrics().config.schedule, type: 'exponential' }
          });
        }
      };
    }
  }

  private async initializeNeuralNetworks(): Promise<void> {
    const networkConfig = {
      learningRate: this.config.neuralNetwork.learningRate,
      batchSize: this.config.neuralNetwork.batchSize
    };

    switch (this.config.neuralNetwork.type) {
      case 'cnn':
        this.cnnNetwork = networkManager.createNetwork('main', 'standard', networkConfig);
        break;
      case 'resnet':
        this.resNetNetwork = new Connect4ResNet(networkConfig);
        this.resNetNetwork.buildModel();
        break;
      case 'attention':
        this.attentionNetwork = new Connect4AttentionNetwork(networkConfig);
        this.attentionNetwork.buildModel();
        break;
      case 'ensemble':
        this.cnnNetwork = networkManager.createNetwork('cnn', 'standard', networkConfig);
        this.resNetNetwork = new Connect4ResNet(networkConfig);
        this.resNetNetwork.buildModel();
        this.attentionNetwork = new Connect4AttentionNetwork(networkConfig);
        this.attentionNetwork.buildModel();
        break;
    }

    console.log(`🧠 Neural networks initialized: ${this.config.neuralNetwork.type}`);
  }

  private async initializeRLAgents(): Promise<void> {
    const rlConfig = {
      useCNN: true,
      learningRate: this.config.neuralNetwork.learningRate,
      batchSize: this.config.neuralNetwork.batchSize,
      experienceReplay: this.config.reinforcementLearning.experienceReplay,
      targetUpdateFreq: this.config.reinforcementLearning.targetUpdateFreq
    };

    switch (this.config.reinforcementLearning.algorithm) {
      case 'dqn':
        this.dqnAgent = new DQN(rlConfig);
        this.dqnAgent.initialize();
        break;
      case 'double_dqn':
        this.doubleDqnAgent = new DoubleDQN(rlConfig);
        this.doubleDqnAgent.initialize();
        break;
      case 'dueling_dqn':
        this.duelingDqnAgent = new DuelingDQN(rlConfig);
        this.duelingDqnAgent.initialize();
        break;
      case 'rainbow_dqn':
        this.rainbowDqnAgent = new RainbowDQN(rlConfig);
        this.rainbowDqnAgent.initialize();
        break;
    }

    console.log(`🎯 RL agent initialized: ${this.config.reinforcementLearning.algorithm}`);
  }

  private async initializeAlphaZero(): Promise<void> {
    const alphaZeroConfig = {
      networkType: this.config.neuralNetwork.type === 'ensemble' ? 'resnet' : this.config.neuralNetwork.type,
      simulations: this.config.mcts.simulations,
      timeLimit: this.config.mcts.timeLimit,
      learningRate: this.config.neuralNetwork.learningRate
    };

    this.alphaZeroAgent = new EnhancedAlphaZero(alphaZeroConfig as any);
    console.log('🏆 Enhanced AlphaZero initialized');
  }

  private async initializeDRLTraining(): Promise<void> {
    console.log('🎯 Initializing DRL Training System...');

    // Create DRL trainer with optimized configuration
    this.drlTrainer = createConnect4DRLTrainer(this.config.drlTraining.config);

    // Create standalone DRL environment for evaluation
    this.drlEnvironment = new Connect4DRLEnvironment(this.config.drlTraining.config);

    // Initialize background training if enabled
    if (this.config.drlTraining.backgroundTraining) {
      this.startBackgroundDRLTraining();
    }

    console.log('🎯 DRL Training System initialized successfully!');
  }

  private startBackgroundDRLTraining(): void {
    // Start background training in a non-blocking way
    if (this.drlTrainer) {
      // Run training in background with reduced intensity
      const backgroundConfig = {
        ...this.config.drlTraining.config,
        training: {
          ...this.config.drlTraining.config.training,
          episodes: 1000, // Smaller batches for background training
          batchSize: 16
        }
      };

      // Start background training loop
      setInterval(async () => {
        if (this.drlTrainer && this.gamesPlayedSinceTraining >= this.config.drlTraining.trainingInterval) {
          try {
            console.log('🔄 Starting background DRL training...');
            // Run a short training session
            const trainer = createConnect4DRLTrainer(backgroundConfig);
            await trainer.train();
            trainer.dispose();

            this.gamesPlayedSinceTraining = 0;
            console.log('✅ Background DRL training completed');
          } catch (error) {
            console.warn('⚠️ Background DRL training failed:', error);
          }
        }
      }, 60000); // Check every minute
    }
  }

  /**
   * Get the best move using the configured AI strategy
   */
  async getBestMove(
    board: CellValue[][],
    aiDisc: CellValue,
    timeMs = 5000,
    abilityConfig?: AIAbilityConfig
  ): Promise<AIDecision> {
    const startTime = performance.now();
    const validMoves = legalMoves(board);

    if (validMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    if (validMoves.length === 1) {
      return {
        move: validMoves[0],
        confidence: 1.0,
        reasoning: 'Only legal move available',
        alternativeMoves: [],
        thinkingTime: performance.now() - startTime,
        nodesExplored: 1,
        strategy: 'forced_move',
        metadata: {}
      };
    }

    let decision: AIDecision;

    switch (this.config.primaryStrategy) {
      case 'alphazero':
        decision = await this.getAlphaZeroMove(board, aiDisc, timeMs);
        break;
      case 'dqn':
        decision = await this.getDQNMove(board, aiDisc, validMoves);
        break;
      case 'mcts':
        decision = await this.getMCTSMove(board, aiDisc, timeMs);
        break;
      case 'hybrid':
        decision = await this.getHybridMove(board, aiDisc, timeMs, abilityConfig);
        break;
      case 'ensemble':
        decision = await this.getEnsembleMove(board, aiDisc, timeMs);
        break;
      default:
        decision = await this.getMinimaxMove(board, aiDisc, timeMs);
    }

    // Add learning and adaptation
    if (this.config.advanced.realTimeAdaptation) {
      await this.adaptToGameState(board, decision, aiDisc);
    }

    // Store for learning
    this.storeGameExperience(board, decision, aiDisc);

    // Update DRL training metrics
    if (this.config.drlTraining.enabled && this.config.drlTraining.continuousLearning) {
      this.gamesPlayedSinceTraining++;
      await this.updateDRLTraining(board, decision, aiDisc);
    }

    decision.thinkingTime = performance.now() - startTime;
    return decision;
  }

  private async getAlphaZeroMove(board: CellValue[][], aiDisc: CellValue, timeMs: number): Promise<AIDecision> {
    if (!this.alphaZeroAgent) {
      throw new Error('AlphaZero agent not initialized');
    }

    const move = await this.alphaZeroAgent.selectMove(board, aiDisc);
    const metrics = this.alphaZeroAgent.getMetrics();

    return {
      move,
      confidence: 0.95,
      reasoning: `AlphaZero analysis with ${metrics.simulations} simulations using ${metrics.networkType} network`,
      alternativeMoves: [],
      thinkingTime: 0,
      nodesExplored: metrics.simulations,
      strategy: 'alphazero',
      metadata: {
        mctsStatistics: {
          simulations: metrics.simulations,
          averageDepth: 25,
          bestLine: [move]
        }
      }
    };
  }

  private async getDQNMove(board: CellValue[][], aiDisc: CellValue, validMoves: number[]): Promise<AIDecision> {
    const agent = this.rainbowDqnAgent || this.duelingDqnAgent || this.doubleDqnAgent || this.dqnAgent;

    if (!agent) {
      throw new Error('No DQN agent initialized');
    }

    const move = await agent.selectAction(board, validMoves);
    const qValues = await agent.getQValues(board);
    const metrics = agent.getMetrics();

    const alternatives = validMoves
      .filter(m => m !== move)
      .map(m => ({
        move: m,
        score: qValues[m],
        reasoning: `Q-value: ${qValues[m].toFixed(3)}`
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      move,
      confidence: metrics.epsilon < 0.1 ? 0.9 : 0.7,
      reasoning: `Deep Q-Network selected move with Q-value: ${qValues[move].toFixed(3)}`,
      alternativeMoves: alternatives,
      thinkingTime: 0,
      nodesExplored: 1,
      strategy: this.config.reinforcementLearning.algorithm,
      metadata: {
        reinforcementLearning: {
          qValues,
          exploration: metrics.epsilon > 0.1,
          epsilonValue: metrics.epsilon
        }
      }
    };
  }

  private async getMCTSMove(board: CellValue[][], aiDisc: CellValue, timeMs: number): Promise<AIDecision> {
    // Use existing MCTS implementation but with neural network evaluation
    const moveProbabilities = await this.getNeuralNetworkEvaluation(board);
    const move = mcts(board, aiDisc, timeMs, moveProbabilities);

    return {
      move,
      confidence: 0.85,
      reasoning: `MCTS with neural network guidance (${this.config.mcts.simulations} simulations)`,
      alternativeMoves: [],
      thinkingTime: 0,
      nodesExplored: this.config.mcts.simulations,
      strategy: 'mcts_neural',
      metadata: {
        neuralNetworkEvaluation: {
          policy: moveProbabilities || [],
          value: 0,
          confidence: 0.8
        },
        mctsStatistics: {
          simulations: this.config.mcts.simulations,
          averageDepth: 20,
          bestLine: [move]
        }
      }
    };
  }

  private async getHybridMove(
    board: CellValue[][],
    aiDisc: CellValue,
    timeMs: number,
    abilityConfig?: AIAbilityConfig
  ): Promise<AIDecision> {
    // Combine multiple approaches for maximum strength
    const validMoves = legalMoves(board);
    const approaches = await Promise.all([
      this.getAlphaZeroMove(board, aiDisc, timeMs / 3),
      this.getDQNMove(board, aiDisc, validMoves),
      this.getMinimaxMove(board, aiDisc, timeMs / 3)
    ]);

    // Weighted voting based on confidence and game phase
    const gamePhase = this.determineGamePhase(board);
    const weights = this.getStrategyWeights(gamePhase);

    let bestMove = approaches[0].move;
    let bestScore = 0;
    const moveScores: { [key: number]: number } = {};

    approaches.forEach((approach, index) => {
      moveScores[approach.move] = (moveScores[approach.move] || 0) + weights[index] * approach.confidence;
    });

    for (const [move, score] of Object.entries(moveScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = parseInt(move);
      }
    }

    return {
      move: bestMove,
      confidence: Math.min(0.99, bestScore),
      reasoning: `Hybrid approach combining AlphaZero, DQN, and Minimax for ${gamePhase} phase`,
      alternativeMoves: Object.entries(moveScores)
        .filter(([move, _]) => parseInt(move) !== bestMove)
        .map(([move, score]) => ({
          move: parseInt(move),
          score: score as number,
          reasoning: `Hybrid score: ${(score as number).toFixed(3)}`
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
      thinkingTime: 0,
      nodesExplored: approaches.reduce((sum, a) => sum + a.nodesExplored, 0),
      strategy: 'hybrid_multi_agent',
      metadata: {
        neuralNetworkEvaluation: approaches[0].metadata.neuralNetworkEvaluation,
        reinforcementLearning: approaches[1].metadata.reinforcementLearning,
        mctsStatistics: approaches[0].metadata.mctsStatistics
      }
    };
  }

  private async getEnsembleMove(board: CellValue[][], aiDisc: CellValue, timeMs: number): Promise<AIDecision> {
    // Use ensemble of neural networks
    const evaluations: Array<{ policy: number[]; value: number; confidence: number }> = [];

    if (this.cnnNetwork) {
      const cnnResult = await this.cnnNetwork.predict(board);
      evaluations.push(cnnResult);
    }

    if (this.resNetNetwork) {
      const resNetResult = await this.resNetNetwork.predict(board);
      evaluations.push(resNetResult);
    }

    if (this.attentionNetwork) {
      const attentionResult = await this.attentionNetwork.predict(board);
      evaluations.push(attentionResult);
    }

    // Ensemble prediction
    const ensemblePolicy = Array(7).fill(0);
    let ensembleValue = 0;
    let ensembleConfidence = 0;

    evaluations.forEach(result => {
      result.policy.forEach((prob, i) => {
        ensemblePolicy[i] += prob * result.confidence;
      });
      ensembleValue += result.value * result.confidence;
      ensembleConfidence += result.confidence;
    });

    // Normalize
    const totalConfidence = ensembleConfidence;
    ensemblePolicy.forEach((_, i) => {
      ensemblePolicy[i] /= totalConfidence;
    });
    ensembleValue /= totalConfidence;
    ensembleConfidence /= evaluations.length;

    // Select move based on ensemble policy
    const validMoves = legalMoves(board);
    const legalProbabilities = validMoves.map(move => ensemblePolicy[move]);
    const maxProbIndex = legalProbabilities.indexOf(Math.max(...legalProbabilities));
    const bestMove = validMoves[maxProbIndex];

    return {
      move: bestMove,
      confidence: ensembleConfidence,
      reasoning: `Ensemble of ${evaluations.length} neural networks (CNN, ResNet, Attention)`,
      alternativeMoves: validMoves
        .filter(move => move !== bestMove)
        .map(move => ({
          move,
          score: ensemblePolicy[move],
          reasoning: `Ensemble probability: ${ensemblePolicy[move].toFixed(3)}`
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
      thinkingTime: 0,
      nodesExplored: evaluations.length,
      strategy: 'neural_ensemble',
      metadata: {
        neuralNetworkEvaluation: {
          policy: ensemblePolicy,
          value: ensembleValue,
          confidence: ensembleConfidence
        }
      }
    };
  }

  private async getMinimaxMove(board: CellValue[][], aiDisc: CellValue, timeMs: number): Promise<AIDecision> {
    // Enhanced minimax with neural network evaluation
    const moveProbabilities = await this.getNeuralNetworkEvaluation(board);
    const move = iterativeDeepeningMinimax(board, aiDisc, timeMs, moveProbabilities);

    const evaluation = evaluateBoard(board, aiDisc, moveProbabilities);
    const alternatives = orderedMoves(board, aiDisc)
      .filter(m => m.col !== move)
      .slice(0, 3)
      .map(m => ({
        move: m.col,
        score: m.score,
        reasoning: `Minimax score: ${m.score.toFixed(0)}`
      }));

    return {
      move,
      confidence: 0.8,
      reasoning: `Enhanced minimax with neural network evaluation (score: ${evaluation.toFixed(0)})`,
      alternativeMoves: alternatives,
      thinkingTime: 0,
      nodesExplored: 10000, // Estimate
      strategy: 'minimax_neural',
      metadata: {
        neuralNetworkEvaluation: {
          policy: moveProbabilities || [],
          value: evaluation / 10000, // Normalize
          confidence: 0.8
        }
      }
    };
  }

  private async getNeuralNetworkEvaluation(board: CellValue[][]): Promise<number[] | undefined> {
    try {
      if (this.config.neuralNetwork.type === 'ensemble' && this.cnnNetwork) {
        const evaluation = await this.cnnNetwork.predict(board);
        return evaluation.policy;
      } else if (this.resNetNetwork) {
        const evaluation = await this.resNetNetwork.predict(board);
        return evaluation.policy;
      } else if (this.attentionNetwork) {
        const evaluation = await this.attentionNetwork.predict(board);
        return evaluation.policy;
      } else if (this.cnnNetwork) {
        const evaluation = await this.cnnNetwork.predict(board);
        return evaluation.policy;
      }
    } catch (error) {
      console.warn('Neural network evaluation failed:', error);
    }
    return undefined;
  }

  private determineGamePhase(board: CellValue[][]): 'opening' | 'midgame' | 'endgame' {
    const totalMoves = board.flat().filter(cell => cell !== 'Empty').length;
    if (totalMoves < 12) return 'opening';
    if (totalMoves < 30) return 'midgame';
    return 'endgame';
  }

  private getStrategyWeights(gamePhase: 'opening' | 'midgame' | 'endgame'): number[] {
    switch (gamePhase) {
      case 'opening':
        return [0.4, 0.3, 0.3]; // AlphaZero, DQN, Minimax
      case 'midgame':
        return [0.5, 0.4, 0.1]; // Favor AlphaZero and DQN
      case 'endgame':
        return [0.3, 0.2, 0.5]; // Favor precise minimax calculation
    }
  }

  private async adaptToGameState(board: CellValue[][], decision: AIDecision, aiDisc: CellValue): Promise<void> {
    // Real-time adaptation based on game state and decision quality
    if (this.config.advanced.realTimeAdaptation) {
      // Adjust exploration/exploitation based on confidence
      if (decision.confidence < 0.7) {
        // Increase exploration
        console.log('🔄 Adapting: Increasing exploration due to low confidence');
      }

      // Learn from immediate position evaluation
      if (this.config.neuralNetwork.enableTraining && this.gameHistory.length > 0) {
        // Trigger learning if we have enough data
        if (this.gameHistory.length % this.config.neuralNetwork.trainingFrequency === 0) {
          await this.performIncrementalLearning();
        }
      }
    }
  }

  private storeGameExperience(board: CellValue[][], decision: AIDecision, aiDisc: CellValue): void {
    this.gameHistory.push({
      board: board.map(row => [...row]),
      move: decision.move,
      evaluation: decision.metadata.neuralNetworkEvaluation?.value || 0,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (this.gameHistory.length > 1000) {
      this.gameHistory = this.gameHistory.slice(-1000);
    }

    // Update metrics
    this.learningMetrics.gamesPlayed++;
    this.learningMetrics.averageThinkingTime =
      (this.learningMetrics.averageThinkingTime * (this.learningMetrics.gamesPlayed - 1) + decision.thinkingTime) /
      this.learningMetrics.gamesPlayed;
  }

  private async performIncrementalLearning(): Promise<void> {
    console.log('🧠 Performing incremental learning...');

    // This would trigger training on recent experiences
    // Implementation depends on the specific learning algorithms

    if (this.rainbowDqnAgent && this.gameHistory.length >= 32) {
      // Convert game history to training examples for DQN
      // await this.rainbowDqnAgent.train();
    }

    if (this.alphaZeroAgent && this.gameHistory.length >= 10) {
      // Trigger self-play learning
      // await this.alphaZeroAgent.trainSelfPlay(1);
    }
  }

  private async updateDRLTraining(board: CellValue[][], decision: AIDecision, aiDisc: CellValue): Promise<void> {
    if (!this.drlEnvironment) return;

    try {
      // Create experience from current game state
      const currentState = {
        board: cloneBoard(board),
        currentPlayer: aiDisc,
        moveHistory: [],
        gamePhase: this.determineGamePhase(board) as 'opening' | 'midgame' | 'endgame',
        features: {
          threatCount: countOpenThree(board, aiDisc),
          centerControl: this.calculateCenterControl(board, aiDisc),
          connectivity: this.calculateConnectivity(board, aiDisc),
          mobility: legalMoves(board).length
        }
      };

      // Simulate the move to get next state
      const { board: nextBoard } = tryDrop(board, decision.move, aiDisc);
      const nextState = {
        ...currentState,
        board: nextBoard,
        currentPlayer: (aiDisc === 'Red' ? 'Yellow' : 'Red') as CellValue,
        moveHistory: [decision.move]
      };

      // Calculate reward based on move quality
      const reward = this.calculateDRLReward(board, nextBoard, decision, aiDisc);

      // Check if game is done
      const done = bitboardCheckWin(getBits(nextBoard, aiDisc)) ||
        bitboardCheckWin(getBits(nextBoard, aiDisc === 'Red' ? 'Yellow' : 'Red')) ||
        legalMoves(nextBoard).length === 0;

      // Add experience to DRL environment
      const experience = {
        state: currentState,
        action: decision.move,
        reward,
        nextState,
        done,
        metadata: {
          moveNumber: currentState.moveHistory.length,
          gameResult: done ? (reward > 0 ? 'win' : (reward < 0 ? 'loss' : 'draw')) as 'win' | 'loss' | 'draw' : 'draw',
          opponent: 'human',
          difficulty: decision.confidence
        }
      };

      this.drlEnvironment.addExperience(experience);

      // Update DRL metrics
      const episodeResult: EpisodeResult = {
        totalReward: reward,
        moves: currentState.moveHistory.length + 1,
        result: experience.metadata.gameResult,
        opponent: 'human',
        explorationRate: decision.metadata.reinforcementLearning?.epsilonValue || 0.1,
        averageQValue: decision.metadata.reinforcementLearning?.qValues?.reduce((a, b) => a + b, 0) / 7 || 0,
        finalBoardState: nextBoard,
        gameHistory: [...currentState.moveHistory, decision.move]
      };

      this.drlEnvironment.updateMetrics(episodeResult);
      this.drlMetrics = this.drlEnvironment.getMetrics();

    } catch (error) {
      console.warn('Failed to update DRL training:', error);
    }
  }

  private calculateDRLReward(
    currentBoard: CellValue[][],
    nextBoard: CellValue[][],
    decision: AIDecision,
    aiDisc: CellValue
  ): number {
    let reward = 0;

    // Base move penalty
    reward -= 1;

    // Win/loss detection
    if (bitboardCheckWin(getBits(nextBoard, aiDisc))) {
      reward += 100; // Win reward
    } else if (bitboardCheckWin(getBits(nextBoard, aiDisc === 'Red' ? 'Yellow' : 'Red'))) {
      reward -= 100; // Loss penalty
    }

    // Threat creation/blocking rewards
    const currentThreats = countOpenThree(currentBoard, aiDisc);
    const nextThreats = countOpenThree(nextBoard, aiDisc);
    const oppCurrentThreats = countOpenThree(currentBoard, aiDisc === 'Red' ? 'Yellow' : 'Red');
    const oppNextThreats = countOpenThree(nextBoard, aiDisc === 'Red' ? 'Yellow' : 'Red');

    reward += (nextThreats - currentThreats) * 10; // Threat creation
    reward += (oppCurrentThreats - oppNextThreats) * 15; // Threat blocking

    // Center column bonus
    if (decision.move === 3) {
      reward += 2;
    }

    // Position evaluation improvement
    const currentEval = evaluatePosition(currentBoard, aiDisc);
    const nextEval = evaluatePosition(nextBoard, aiDisc);
    reward += (nextEval - currentEval) / 100; // Scale down

    // Confidence bonus - reward confident moves
    if (decision.confidence > 0.8) {
      reward += decision.confidence * 5;
    }

    return reward;
  }

  private calculateCenterControl(board: CellValue[][], aiDisc: CellValue): number {
    let control = 0;
    const centerCol = 3;
    for (let row = 0; row < 6; row++) {
      if (board[row][centerCol] === aiDisc) {
        control++;
      }
    }
    return control;
  }

  private calculateConnectivity(board: CellValue[][], aiDisc: CellValue): number {
    // Simplified connectivity measure - count adjacent pieces
    let connectivity = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        if (board[r][c] === aiDisc) {
          for (const [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && board[nr][nc] === aiDisc) {
              connectivity++;
            }
          }
        }
      }
    }
    return connectivity;
  }

  /**
   * Get comprehensive AI metrics and performance data
   */
  getAIMetrics(): {
    strategy: string;
    performance: {
      gamesPlayed: number;
      winRate: number;
      averageThinkingTime: number;
      totalTrainingTime: number;
      lastUpdateTime: number;
    };
    agents: {
      dqn?: any;
      alphazero?: any;
    };
    neuralNetworks: {
      type: string;
      active: string[];
    };
    drlTraining?: {
      enabled: boolean;
      metricsCount: number;
      gamesPlayedSinceTraining: number;
      lastEvaluation: number;
      recentRewards: number[];
      averageReward: number;
      explorationRate: number;
    };
  } {
    const baseMetrics: any = {
      strategy: this.config.primaryStrategy,
      performance: {
        gamesPlayed: this.learningMetrics.gamesPlayed,
        winRate: this.learningMetrics.winRate,
        averageThinkingTime: this.learningMetrics.averageThinkingTime,
        totalTrainingTime: this.learningMetrics.learningProgress * 1000,
        lastUpdateTime: Date.now()
      },
      agents: {
        dqn: this.rainbowDqnAgent?.getMetrics(),
        alphazero: this.alphaZeroAgent?.getMetrics()
      },
      neuralNetworks: {
        type: this.config.neuralNetwork.type,
        active: [
          this.cnnNetwork ? 'CNN' : '',
          this.resNetNetwork ? 'ResNet' : '',
          this.attentionNetwork ? 'Attention' : ''
        ].filter(Boolean)
      }
    };

    // Add DRL training metrics if enabled
    if (this.config.drlTraining.enabled) {
      const recentMetrics = this.drlMetrics.slice(-10); // Last 10 episodes
      baseMetrics.drlTraining = {
        enabled: true,
        metricsCount: this.drlMetrics.length,
        gamesPlayedSinceTraining: this.gamesPlayedSinceTraining,
        lastEvaluation: this.lastDRLEvaluation,
        recentRewards: recentMetrics.map(m => m.totalReward),
        averageReward: recentMetrics.length > 0 ?
          recentMetrics.reduce((sum, m) => sum + m.totalReward, 0) / recentMetrics.length : 0,
        explorationRate: recentMetrics.length > 0 ?
          recentMetrics[recentMetrics.length - 1].explorationRate : 0
      };
    }

    return baseMetrics;
  }

  /**
   * Configure AI strategy and parameters
   */
  updateConfig(newConfig: Partial<UltimateAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 AI configuration updated:', newConfig);
  }

  /**
   * Save all AI models and configurations
   */
  async saveAI(basePath: string): Promise<void> {
    try {
      if (this.rainbowDqnAgent) {
        await this.rainbowDqnAgent.saveModel(`${basePath}/rainbow_dqn`);
      }

      if (this.alphaZeroAgent) {
        await this.alphaZeroAgent.save(`${basePath}/alphazero`);
      }

      if (this.resNetNetwork) {
        await this.resNetNetwork.saveModel(`${basePath}/resnet`);
      }

      console.log('💾 All AI models saved successfully');
    } catch (error) {
      console.error('❌ Error saving AI models:', error);
    }
  }

  /**
   * Load AI models and configurations
   */
  async loadAI(basePath: string): Promise<void> {
    try {
      if (this.rainbowDqnAgent) {
        await this.rainbowDqnAgent.loadModel(`${basePath}/rainbow_dqn`);
      }

      if (this.alphaZeroAgent) {
        await this.alphaZeroAgent.load(`${basePath}/alphazero`);
      }

      if (this.resNetNetwork) {
        await this.resNetNetwork.loadModel(`${basePath}/resnet`);
      }

      console.log('📂 All AI models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading AI models:', error);
    }
  }

  /**
   * Dispose of all AI resources
   */
  dispose(): void {
    // Dispose of AI agents
    if (this.dqnAgent) {
      this.dqnAgent.dispose();
      this.dqnAgent = null;
    }
    if (this.doubleDqnAgent) {
      this.doubleDqnAgent.dispose();
      this.doubleDqnAgent = null;
    }
    if (this.duelingDqnAgent) {
      this.duelingDqnAgent.dispose();
      this.duelingDqnAgent = null;
    }
    if (this.rainbowDqnAgent) {
      this.rainbowDqnAgent.dispose();
      this.rainbowDqnAgent = null;
    }
    if (this.alphaZeroAgent) {
      this.alphaZeroAgent.dispose();
      this.alphaZeroAgent = null;
    }

    // Dispose of optimizers
    if (this.adamWOptimizer) {
      this.adamWOptimizer.dispose();
      this.adamWOptimizer = null;
    }
    if (this.entropyRegularizer) {
      this.entropyRegularizer.dispose();
      this.entropyRegularizer = null;
    }
    if (this.learningRateScheduler) {
      this.learningRateScheduler.dispose();
      this.learningRateScheduler = null;
    }

    // Dispose of neural networks
    if (this.cnnNetwork) {
      this.cnnNetwork.dispose();
      this.cnnNetwork = null;
    }
    if (this.resNetNetwork) {
      this.resNetNetwork.dispose();
      this.resNetNetwork = null;
    }
    if (this.attentionNetwork) {
      this.attentionNetwork.dispose();
      this.attentionNetwork = null;
    }

    // Dispose of DRL training system
    if (this.drlTrainer) {
      this.drlTrainer.dispose();
      this.drlTrainer = null;
    }
    if (this.drlEnvironment) {
      this.drlEnvironment = null;
    }

    // Clear training data
    this.gameHistory = [];
    this.drlMetrics = [];
    this.gamesPlayedSinceTraining = 0;
    this.lastDRLEvaluation = 0;

    // Clear global network manager
    if (typeof networkManager !== 'undefined') {
      networkManager.dispose();
    }
  }

  /**
   * Optimize neural network training using integrated optimizers
   */
  async optimizeNeuralNetwork(
    network: 'cnn' | 'resnet' | 'attention' | 'all',
    trainingData: Array<{
      board: CellValue[][];
      targetPolicy: number[];
      targetValue: number;
    }>,
    batchSize: number = 32
  ): Promise<{
    loss: number;
    optimizerMetrics: {
      adamW?: any;
      entropyRegularizer?: any;
      learningRateScheduler?: any;
    };
  }> {
    const optimizerMetrics: any = {};
    let totalLoss = 0;
    let batches = 0;

    // Process training data in batches
    for (let i = 0; i < trainingData.length; i += batchSize) {
      const batch = trainingData.slice(i, i + batchSize);
      const batchGradients = new Map<string, number[]>();
      let batchLoss = 0;

      // Process each sample in the batch
      for (const sample of batch) {
        const { board, targetPolicy, targetValue } = sample;

        // Get network predictions
        let prediction: { policy: number[]; value: number; confidence: number };

        switch (network) {
          case 'cnn':
            if (this.cnnNetwork) {
              prediction = await this.cnnNetwork.predict(board);
            } else {
              continue;
            }
            break;
          case 'resnet':
            if (this.resNetNetwork) {
              prediction = await this.resNetNetwork.predict(board);
            } else {
              continue;
            }
            break;
          case 'attention':
            if (this.attentionNetwork) {
              prediction = await this.attentionNetwork.predict(board);
            } else {
              continue;
            }
            break;
          case 'all':
            // Use ensemble prediction
            prediction = await this.getEnsemblePrediction(board);
            break;
          default:
            continue;
        }

        // Calculate loss
        const policyLoss = this.calculateCrossEntropyLoss(prediction.policy, targetPolicy);
        const valueLoss = Math.pow(prediction.value - targetValue, 2);
        let sampleLoss = policyLoss + valueLoss;

        // Add entropy regularization if enabled
        if (this.entropyRegularizer) {
          const entropyLoss = this.entropyRegularizer.calculateEntropyLoss(prediction.policy, 'categorical');
          sampleLoss += entropyLoss.loss;
          this.entropyRegularizer.updateCoefficient();
        }

        batchLoss += sampleLoss;

        // Calculate gradients (simplified - in real implementation, use backpropagation)
        const gradients = this.calculateGradients(prediction, targetPolicy, targetValue);

        // Accumulate gradients
        for (const [paramName, grad] of gradients) {
          if (!batchGradients.has(paramName)) {
            batchGradients.set(paramName, new Array(grad.length).fill(0));
          }
          const accGrad = batchGradients.get(paramName)!;
          for (let j = 0; j < grad.length; j++) {
            accGrad[j] += grad[j];
          }
        }
      }

      // Average gradients over batch
      for (const [paramName, grad] of batchGradients) {
        for (let j = 0; j < grad.length; j++) {
          grad[j] /= batch.length;
        }
      }

      // Apply optimizer updates
      if (this.adamWOptimizer) {
        this.adamWOptimizer.step(batchGradients, batchLoss);
        optimizerMetrics.adamW = this.adamWOptimizer.getMetrics();
      }

      if (this.learningRateScheduler) {
        const gradientNorm = this.calculateGradientNorm(batchGradients);
        this.learningRateScheduler.step(batchLoss, gradientNorm);
        optimizerMetrics.learningRateScheduler = this.learningRateScheduler.getMetrics();
      }

      if (this.entropyRegularizer) {
        optimizerMetrics.entropyRegularizer = this.entropyRegularizer.getMetrics();
      }

      totalLoss += batchLoss;
      batches++;
    }

    return {
      loss: totalLoss / batches,
      optimizerMetrics
    };
  }

  /**
   * Optimize reinforcement learning agent training
   */
  async optimizeRLAgent(
    agent: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn',
    experienceReplay: Array<{
      state: CellValue[][];
      action: number;
      reward: number;
      nextState: CellValue[][];
      done: boolean;
    }>,
    batchSize: number = 32
  ): Promise<{
    loss: number;
    optimizerMetrics: {
      adamW?: any;
      entropyRegularizer?: any;
      learningRateScheduler?: any;
    };
  }> {
    const optimizerMetrics: any = {};
    let totalLoss = 0;
    let batches = 0;

    // Get the appropriate agent
    let rlAgent: any;
    switch (agent) {
      case 'dqn':
        rlAgent = this.dqnAgent;
        break;
      case 'double_dqn':
        rlAgent = this.doubleDqnAgent;
        break;
      case 'dueling_dqn':
        rlAgent = this.duelingDqnAgent;
        break;
      case 'rainbow_dqn':
        rlAgent = this.rainbowDqnAgent;
        break;
      default:
        throw new Error(`Unknown RL agent: ${agent}`);
    }

    if (!rlAgent) {
      throw new Error(`${agent} agent not initialized`);
    }

    // Process experience replay in batches
    for (let i = 0; i < experienceReplay.length; i += batchSize) {
      const batch = experienceReplay.slice(i, i + batchSize);
      const batchGradients = new Map<string, number[]>();
      let batchLoss = 0;

      for (const experience of batch) {
        const { state, action, reward, nextState, done } = experience;

        // Get current Q-values
        const currentQValues = await rlAgent.getQValues(state);
        const nextQValues = done ? Array(7).fill(0) : await rlAgent.getQValues(nextState);

        // Calculate target Q-value
        const targetQValue = reward + (done ? 0 : 0.99 * Math.max(...nextQValues));

        // Calculate loss
        const sampleLoss = Math.pow(currentQValues[action] - targetQValue, 2);
        batchLoss += sampleLoss;

        // Add entropy regularization for exploration
        if (this.entropyRegularizer) {
          const actionProbs = this.softmax(currentQValues);
          const entropyLoss = this.entropyRegularizer.calculateEntropyLoss(actionProbs, 'categorical');
          batchLoss += entropyLoss.loss;
        }

        // Calculate gradients (simplified)
        const gradients = this.calculateRLGradients(currentQValues, action, targetQValue);

        // Accumulate gradients
        for (const [paramName, grad] of gradients) {
          if (!batchGradients.has(paramName)) {
            batchGradients.set(paramName, new Array(grad.length).fill(0));
          }
          const accGrad = batchGradients.get(paramName)!;
          for (let j = 0; j < grad.length; j++) {
            accGrad[j] += grad[j];
          }
        }
      }

      // Average gradients over batch
      for (const [paramName, grad] of batchGradients) {
        for (let j = 0; j < grad.length; j++) {
          grad[j] /= batch.length;
        }
      }

      // Apply optimizer updates
      if (this.adamWOptimizer) {
        this.adamWOptimizer.step(batchGradients, batchLoss);
        optimizerMetrics.adamW = this.adamWOptimizer.getMetrics();
      }

      if (this.learningRateScheduler) {
        const gradientNorm = this.calculateGradientNorm(batchGradients);
        this.learningRateScheduler.step(batchLoss, gradientNorm);
        optimizerMetrics.learningRateScheduler = this.learningRateScheduler.getMetrics();
      }

      if (this.entropyRegularizer) {
        this.entropyRegularizer.updateCoefficient();
        optimizerMetrics.entropyRegularizer = this.entropyRegularizer.getMetrics();
      }

      totalLoss += batchLoss;
      batches++;
    }

    return {
      loss: totalLoss / batches,
      optimizerMetrics
    };
  }

  /**
   * Helper methods for optimizer integration
   */
  private calculateCrossEntropyLoss(predicted: number[], target: number[]): number {
    let loss = 0;
    for (let i = 0; i < predicted.length; i++) {
      loss -= target[i] * Math.log(Math.max(predicted[i], 1e-8));
    }
    return loss;
  }

  private calculateGradients(
    prediction: { policy: number[]; value: number; confidence: number },
    targetPolicy: number[],
    targetValue: number
  ): Map<string, number[]> {
    const gradients = new Map<string, number[]>();

    // Simplified gradient calculation
    // In real implementation, use automatic differentiation
    const policyGradient = prediction.policy.map((p, i) => p - targetPolicy[i]);
    const valueGradient = [2 * (prediction.value - targetValue)];

    gradients.set('policy_weights', policyGradient);
    gradients.set('value_weights', valueGradient);

    return gradients;
  }

  private calculateRLGradients(
    currentQValues: number[],
    action: number,
    targetQValue: number
  ): Map<string, number[]> {
    const gradients = new Map<string, number[]>();

    // Simplified Q-learning gradient calculation
    const qGradient = currentQValues.map((q, i) =>
      i === action ? 2 * (q - targetQValue) : 0
    );

    gradients.set('q_weights', qGradient);

    return gradients;
  }

  private calculateGradientNorm(gradients: Map<string, number[]>): number {
    let norm = 0;
    for (const grad of gradients.values()) {
      for (const g of grad) {
        norm += g * g;
      }
    }
    return Math.sqrt(norm);
  }

  private softmax(values: number[]): number[] {
    const maxVal = Math.max(...values);
    const exp = values.map(v => Math.exp(v - maxVal));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(e => e / sum);
  }

  private async getEnsemblePrediction(board: CellValue[][]): Promise<{ policy: number[]; value: number; confidence: number }> {
    const predictions: Array<{ policy: number[]; value: number; confidence: number }> = [];

    if (this.cnnNetwork) {
      predictions.push(await this.cnnNetwork.predict(board));
    }

    if (this.resNetNetwork) {
      predictions.push(await this.resNetNetwork.predict(board));
    }

    if (this.attentionNetwork) {
      predictions.push(await this.attentionNetwork.predict(board));
    }

    if (predictions.length === 0) {
      throw new Error('No neural networks available for ensemble prediction');
    }

    // Average predictions
    const avgPolicy = Array(7).fill(0);
    let avgValue = 0;
    let avgConfidence = 0;

    for (const pred of predictions) {
      for (let i = 0; i < avgPolicy.length; i++) {
        avgPolicy[i] += pred.policy[i];
      }
      avgValue += pred.value;
      avgConfidence += pred.confidence;
    }

    for (let i = 0; i < avgPolicy.length; i++) {
      avgPolicy[i] /= predictions.length;
    }
    avgValue /= predictions.length;
    avgConfidence /= predictions.length;

    return { policy: avgPolicy, value: avgValue, confidence: avgConfidence };
  }

  /**
   * Get comprehensive optimizer metrics
   */
  getOptimizerMetrics(): {
    adamW?: any;
    entropyRegularizer?: any;
    learningRateScheduler?: any;
    integration?: {
      crossOptimizerLearning: boolean;
      performanceMonitoring: boolean;
      autoTuning: boolean;
    };
  } {
    const metrics: any = {};

    if (this.adamWOptimizer) {
      metrics.adamW = this.adamWOptimizer.getMetrics();
    }

    if (this.entropyRegularizer) {
      metrics.entropyRegularizer = this.entropyRegularizer.getMetrics();
    }

    if (this.learningRateScheduler) {
      metrics.learningRateScheduler = this.learningRateScheduler.getMetrics();
    }

    metrics.integration = {
      crossOptimizerLearning: this.config.optimizers.integration.crossOptimizerLearning,
      performanceMonitoring: this.config.optimizers.integration.performanceMonitoring,
      autoTuning: this.config.optimizers.integration.autoTuning
    };

    return metrics;
  }

  /**
   * Update optimizer configurations
   */
  updateOptimizerConfig(newConfig: Partial<UltimateAIConfig['optimizers']>): void {
    this.config.optimizers = { ...this.config.optimizers, ...newConfig };

    // Update optimizer instances
    if (newConfig.adamW && this.adamWOptimizer) {
      this.adamWOptimizer.updateConfig(newConfig.adamW.config || {});
    }

    if (newConfig.entropyRegularizer && this.entropyRegularizer) {
      this.entropyRegularizer.updateConfig(newConfig.entropyRegularizer.config || {});
    }

    if (newConfig.learningRateScheduler && this.learningRateScheduler) {
      this.learningRateScheduler.updateConfig(newConfig.learningRateScheduler.config || {});
    }
  }

  /**
   * Reset all optimizers
   */
  resetOptimizers(): void {
    if (this.adamWOptimizer) {
      this.adamWOptimizer.reset();
    }

    if (this.entropyRegularizer) {
      this.entropyRegularizer.reset();
    }

    if (this.learningRateScheduler) {
      this.learningRateScheduler.reset();
    }
  }
}