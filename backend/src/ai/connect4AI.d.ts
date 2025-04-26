/** Valid values for each cell in the Connect 4 grid. */
export type CellValue = 'Empty' | 'Red' | 'Yellow';

/**
 * Detailed move information for ordering and pruning in search algorithms.
 */
export interface Move {
  /** Column index (0–6) where the disc is dropped. */
  col: number;
  /** Row index (0–5) where the disc lands after drop. */
  row: number;
  /** True if this move results in an immediate win for the current player. */
  isWinning: boolean;
  /** True if this move blocks an opponent’s winning threat. */
  isBlocking: boolean;
  /** Heuristic score: 1000=win, 900=block, 800−=center bias. */
  priority: number;
}

/**
 * Compute the row index where a disc would land if dropped in a column.
 * @param board 6×7 grid of CellValue
 * @param col Column index (0–6)
 * @returns Row index (0–5) or null if the column is full.
 */
export function getDropRow(board: CellValue[][], col: number): number | null;

/**
 * Generate all legal moves sorted by priority:
 * 1000 = immediate win; 900 = block; 800–0 = center bias.
 * @param board Current game board
 * @param currentPlayer 'Red' or 'Yellow' whose turn it is
 * @returns Array of Move objects sorted descending by priority
 */
export function orderedMoves(board: CellValue[][], currentPlayer: CellValue): Move[];

/**
 * List all non-full columns on the board.
 * @param board Current game board
 * @returns Array of column indices (0–6) that are not full
 */
export function legalMoves(board: CellValue[][]): number[];

/**
 * Drop a disc into the given column, returning the new board and row.
 * @param board Current game board
 * @param column Column index to drop into
 * @param disc 'Red' or 'Yellow' disc color
 * @returns Object containing the updated board and the row index where the disc landed
 */
export function tryDrop(
  board: CellValue[][],
  column: number,
  disc: CellValue
): { board: CellValue[][]; row: number };

/**
 * Convert the board into separate red and yellow bitboards.
 * @param board Current game board
 * @returns Object with 'red' and 'yellow' bitboards as BigInt
 */
export function boardToBitboards(board: CellValue[][]): { red: bigint; yellow: bigint };

/**
 * Get a single bitboard for the specified disc color.
 * @param board Current game board
 * @param disc 'Red' or 'Yellow'
 * @returns BigInt representing the bitboard for that disc
 */
export function getBits(board: CellValue[][], disc: CellValue): bigint;

/**
 * Check a bitboard for any Connect-4 (four in a row).
 * @param bb Bitboard to check
 * @returns True if a win is detected, else false
 */
export function bitboardCheckWin(bb: bigint): boolean;

/**
 * Evaluate a window of 4 cells for static board scoring.
 * @param cells Array of 4 CellValue entries
 * @param aiDisc 'Red' or 'Yellow' for the AI
 * @returns Numeric score contribution for this window
 */
export function evaluateWindow(cells: CellValue[], aiDisc: CellValue): number;

/**
 * Static evaluation of the entire board for a given AI disc.
 * @param board Current game board
 * @param aiDisc 'Red' or 'Yellow'
 * @returns Heuristic score: positive favors AI, negative favors opponent
 */
export function evaluateBoard(board: CellValue[][], aiDisc: CellValue): number;

/** Flags for transposition table entries. */
export enum EntryFlag { Exact, LowerBound, UpperBound }

/**
 * A stored entry in the transposition table.
 */
export interface TranspositionEntry {
  /** Evaluated score of the position. */
  score: number;
  /** Depth at which this score was computed. */
  depth: number;
  /** Best column index found, or null. */
  column: number | null;
  /** Type of bound: Exact, LowerBound, or UpperBound. */
  flag: EntryFlag;
}

/** Generate a random 64-bit BigInt for Zobrist hashing. */
export function rand64(): bigint;

/** Compute a Zobrist hash for the given board. */
export function hashBoard(board: CellValue[][]): bigint;

/** Clear all entries from the transposition table. */
export function clearTable(): void;

/** Retrieve an entry from the transposition table by hash. */
export function getEntry(hash: bigint): TranspositionEntry | undefined;

/** Store or update an entry in the transposition table. */
export function storeEntry(hash: bigint, entry: TranspositionEntry): void;

/** Result of a minimax search node. */
interface Node { score: number; column: number | null; }

/**
 * Minimax search with α–β pruning, null-move pruning, history heuristic, and transposition.
 * @param board Current game board
 * @param depth Search depth
 * @param alpha Alpha bound
 * @param beta Beta bound
 * @param maximizingPlayer True if maximizing (AI's turn)
 * @param aiDisc 'Red' or 'Yellow' for the AI
 * @returns Node with best score and chosen column
 */
export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiDisc: CellValue
): Node;

/** Data structure for Monte Carlo Tree Search nodes. */
export interface MCTSNode {
  board: CellValue[][];
  player: CellValue;
  visits: number;
  wins: number;
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null;
}

/** Deep-clone a board. */
export function cloneBoard(board: CellValue[][]): CellValue[][];

/** Compute softmax probabilities over an array of scores. */
export function softmax(scores: number[], temperature: number): number[];

/** Choose a move index based on weighted probabilities. */
export function chooseWeighted(moves: number[], weights: number[]): number;

/**
 * Run a playout (simulation) from a starting position until game over.
 * @param startBoard Initial game board
 * @param startingPlayer 'Red' or 'Yellow' who moves first in simulation
 * @param aiDisc AI's disc color
 * @returns Winner disc ('Red' | 'Yellow') or 'Empty' for draw
 */
export function playout(
  startBoard: CellValue[][],
  startingPlayer: CellValue,
  aiDisc: CellValue
): CellValue;

/** Select the most promising MCTS child via UCT formula. */
export function select(node: MCTSNode): MCTSNode;

/** Expand a leaf node by generating all children moves. */
export function expand(node: MCTSNode): void;

/** Backpropagate simulation results up the MCTS tree. */
export function backpropagate(
  node: MCTSNode,
  winner: CellValue,
  aiDisc: CellValue
): void;

/**
 * Monte Carlo Tree Search entrypoint.
 * @param board Current game board
 * @param aiDisc 'Red' or 'Yellow'
 * @param timeMs Time budget in milliseconds
 * @returns Selected column index
 */
export function mcts(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number;

/** Detect and return the column for an opponent's open-three fork block. */
export function findOpenThreeBlock(
  board: CellValue[][],
  opp: CellValue
): number | null;

/** Count all opponent open-three fork threats. */
export function countOpenThree(
  board: CellValue[][],
  opp: CellValue
): number;

/** Revised getBestAIMove integrating immediate logic, search, and MCTS. */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number;
