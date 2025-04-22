// src/ai/aiEngine.ts
import type { CellValue } from './types';
import { minimax, Node } from './minimax';
import { mcts } from './mcts';
import { legalMoves } from './utils';

// Increase fallback minimax depth from 5 to 6 for stronger play
const MAX_DEPTH = 7;

export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const totalCells = board.length * board[0].length;
  const emptyCells = board.reduce(
    (sum, row) => sum + row.filter((c) => c === 'Empty').length,
    0
  );

  // 1) Late‑game “few options left”: use minimax as soon as ≤5 moves remain
  if (moves.length <= 5) {
    const { column } = minimax(board, MAX_DEPTH, -Infinity, Infinity, true, aiDisc);
    if (column !== null && moves.includes(column)) {
      return column;
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // 2) Early‑game: MCTS when >60% of the board is still empty
  if (emptyCells > totalCells * 0.6) {
    return mcts(board, aiDisc, timeMs);
  }

  // 3) Mid‑game fallback to minimax
  {
    const { column } = minimax(board, MAX_DEPTH, -Infinity, Infinity, true, aiDisc);
    if (column !== null && moves.includes(column)) {
      return column;
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }
}
