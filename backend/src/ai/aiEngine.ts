import type { CellValue } from './types';
export type { CellValue } from './types';
import { minimax, Node } from './minimax';
import { mcts } from './mcts';
import { legalMoves } from './utils';

// Default depth for minimax search
const MAX_DEPTH = 5;

/**
 * Chooses the best AI move via hybrid MCTS/minimax strategy.
 * - Early game (many options): Monte Carlo Tree Search
 * - Late game/time-critical: Depth‐limited Minimax
 *
 * @param board  Current 2D board state
 * @param aiDisc AI's disc (‘Red’ or ‘Yellow’)
 * @param timeMs Time budget for MCTS (ms)
 * @returns Column index (0–COLS-1) for the AI’s move
 */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const totalCells = board.length * board[0].length;

  // Early‐game: use MCTS when plenty of moves remain
  if (moves.length > totalCells * 0.6) {
    return mcts(board, aiDisc, timeMs);
  }

  // Fallback: depth‐limited minimax
  const result: Node = minimax(
    board,
    MAX_DEPTH,
    -Infinity,
    Infinity,
    true,
    aiDisc
  );
  // Ensure a valid move
  return result.column !== null && moves.includes(result.column)
    ? result.column
    : moves[Math.floor(Math.random() * moves.length)];
}
