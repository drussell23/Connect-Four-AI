// src/ai/aiEngine.ts
import type { CellValue } from './types';
import { minimax, Node } from './minimax';
import { mcts } from './mcts';
import { legalMoves, tryDrop } from './utils';

// Increase fallback minimax depth from 5 to 6 for a stronger play
const MAX_DEPTH = 6;

/**
 * Chooses the best AI move via hybrid MCTS/minimax:
 * - Early in the game (empty cells > 60% of board): run MCTS
 * - Otherwise: α–β minimax with quiescence, TT, killer/history, bitboards
 */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const totalCells = board.length * board[0].length;

  // Count actual empty slots rather than legal moves
  const emptyCells = board.reduce((sum, row) => sum + row.filter(c => c === 'Empty').length, 0);

  // Early‑game: use MCTS when >60% of board is empty
  if (emptyCells > totalCells * 0.6) {
    return mcts(board, aiDisc, timeMs);
  }

  // Late‑game: Minimax fallback
  const result: Node = minimax(
    board,
    MAX_DEPTH,
    -Infinity,
    Infinity,
    true,
    aiDisc
  );

  // If minimax returns a valid column, use it; otherwise pick random
  if (result.column !== null && moves.includes(result.column)) {
    return result.column;
  }
  return moves[Math.floor(Math.random() * moves.length)];
}