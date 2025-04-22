// src/ai/aiEngine.ts
import type { CellValue } from './types';
import { minimax, Node } from './minimax';
import { mcts } from './mcts';
import { legalMoves, tryDrop } from './utils';
import { boardToBitboards, bitboardCheckWin } from './bitboard';

// Increase fallback minimax depth for stronger play
const MAX_DEPTH = 12;

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
  const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  //
  // 0a) IMMEDIATE‑WIN PRE‑CHECK: take any direct 4‑in‑a‑row yourself
  //
  for (const col of moves) {
    const { board: afterAI } = tryDrop(board, col, aiDisc);
    const { red, yellow } = boardToBitboards(afterAI);
    const bbAI = aiDisc === 'Red' ? red : yellow;
    if (bitboardCheckWin(bbAI)) {
      return col;
    }
  }

  //
  // 0b) IMMEDIATE‑BLOCK PRE‑CHECK: stop any direct 4‑in‑a‑row by the human
  //
  for (const col of moves) {
    const { board: afterOpp } = tryDrop(board, col, oppDisc);
    const { red, yellow } = boardToBitboards(afterOpp);
    const bbOpp = oppDisc === 'Red' ? red : yellow;
    if (bitboardCheckWin(bbOpp)) {
      return col;
    }
  }

  //
  // 1) Count how many immediate‑winning replies the human has for each AI move
  //
  const threatCounts = moves.map((col) => {
    const { board: b1 } = tryDrop(board, col, aiDisc);
    let cnt = 0;
    for (const oppCol of legalMoves(b1)) {
      const { board: b2 } = tryDrop(b1, oppCol, oppDisc);
      const { red, yellow } = boardToBitboards(b2);
      const bb = oppDisc === 'Red' ? red : yellow;
      if (bitboardCheckWin(bb)) cnt++;
    }
    return { col, cnt };
  });

  //
  // 2) Keep only those with zero threats; if none, keep the minimal‑threat moves
  //
  const pureSafe = threatCounts.filter((t) => t.cnt === 0).map((t) => t.col);
  const minThreat = Math.min(...threatCounts.map((t) => t.cnt));
  const candidates =
    pureSafe.length > 0
      ? pureSafe
      : threatCounts.filter((t) => t.cnt === minThreat).map((t) => t.col);

  //
  // 3) Late‑game: when few options remain, use Minimax on the candidate set
  //
  if (candidates.length <= 5) {
    const { column } = minimax(
      board,
      MAX_DEPTH,
      -Infinity,
      Infinity,
      true,
      aiDisc
    );
    if (column !== null && candidates.includes(column)) {
      return column;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  //
  // 4) Early‑game: MCTS when >60% of cells are empty
  //
  if (emptyCells > totalCells * 0.6) {
    const col = mcts(board, aiDisc, timeMs);
    return candidates.includes(col)
      ? col
      : candidates[Math.floor(Math.random() * candidates.length)];
  }

  //
  // 5) Mid‑game fallback: standard Minimax on candidates
  //
  {
    const { column } = minimax(
      board,
      MAX_DEPTH,
      -Infinity,
      Infinity,
      true,
      aiDisc
    );
    if (column !== null && candidates.includes(column)) {
      return column;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
