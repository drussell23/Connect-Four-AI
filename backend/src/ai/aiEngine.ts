import type { CellValue } from './types';
import { minimax, Node } from './minimax';
import { mcts } from './mcts';
import { legalMoves } from './utils';

const MAX_DEPTH = 5;

/**
 * Chooses the best AI move via hybrid MCTS/minimax:
 * - Early in the game (moves > 60% of board): bias‑MCTS
 * - Otherwise: α–β minimax with quiescence, TT, killer/history, bitboards
 */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const totalCells = board.length * board[0].length;

  // Early‐game: MCTS
  if (moves.length > totalCells * 0.6) {
    return mcts(board, aiDisc, timeMs);
  }

  // Late‐game: Minimax
  const result: Node = minimax(
    board,
    MAX_DEPTH,
    -Infinity,
    Infinity,
    true,
    aiDisc
  );

  // Fallback to a uniformly random legal move (fixed!)
  if (result.column !== null && moves.includes(result.column)) {
    return result.column;
  } else {
    return moves[Math.floor(Math.random() * moves.length)];
  }
}
