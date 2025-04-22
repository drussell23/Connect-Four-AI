import { CellValue } from "./types";
import { transposition, EntryFlag, hashBoard } from "./transposition";
import { quiesce } from "./quiescene";
import { legalMoves, tryDrop, checkWin } from "./utils";

export interface Node {
  score: number;
  column: number | null;
}

// How many plies to skip in null-move pruning
const NULL_MOVE_REDUCTION = 2;

// Killer moves per search depth
const killerMoves: Record<number, number[]> = {};

// History heuristic: frequency-based scores
const historyScores = new Map<number, number>();

/**
 * Orders moves by center proximity, killer moves, and history scores
 */
function orderMoves(moves: number[], depth: number, cols: number): number[] {
  const center = Math.floor(cols / 2);
  return moves
    .map(col => {
      const centerDist = Math.abs(center - col);
      const history = historyScores.get(col) || 0;
      const killer = killerMoves[depth]?.includes(col) ? 1e6 : 0;
      return { col, score: -centerDist + history + killer };
    })
    .sort((a, b) => b.score - a.score)
    .map(o => o.col);
}

/**
 * Minimax with α–β, transposition table, null-move, quiescence, killer & history heuristics
 */
export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiDisc: CellValue
): Node {
  const humanDisc = aiDisc === "Red" ? "Yellow" : "Red";
  const alphaOrig = alpha;
  const betaOrig = beta;

  // Transposition lookup
  const key = hashBoard(board);
  const entry = transposition.get(key);
  if (entry && entry.depth >= depth) {
    if (entry.flag === EntryFlag.Exact) {
      return { score: entry.score, column: entry.column };
    }
    if (entry.flag === EntryFlag.LowerBound) alpha = Math.max(alpha, entry.score);
    if (entry.flag === EntryFlag.UpperBound) beta = Math.min(beta, entry.score);
    if (alpha >= beta) {
      return { score: entry.score, column: entry.column };
    }
  }

  // Null-move pruning
  if (depth > NULL_MOVE_REDUCTION) {
    const nm = minimax(
      board,
      depth - 1 - NULL_MOVE_REDUCTION,
      -beta,
      -alpha,
      !maximizing,
      aiDisc
    );
    if (-nm.score >= beta) {
      return { score: beta, column: null };
    }
  }

  // Terminal or quiescence
  const moves0 = legalMoves(board);
  if (depth === 0 || moves0.length === 0) {
    return { score: quiesce(board, alpha, beta, aiDisc), column: null };
  }

  let best: Node = maximizing
    ? { score: -Infinity, column: null }
    : { score: +Infinity, column: null };

  // Ordered moves
  const cols = board[0].length;
  const moves = orderMoves(moves0, depth, cols);
  for (const col of moves) {
    const disc = maximizing ? aiDisc : humanDisc;
    const { board: nb, row } = tryDrop(board, col, disc);

    let node: Node;
    if (checkWin(nb, row, col, disc)) {
      node = { score: maximizing ? Infinity : -Infinity, column: col };
    } else {
      node = minimax(nb, depth - 1, -beta, -alpha, !maximizing, aiDisc);
      node.column = col;
    }

    // Update best & α/β
    if (maximizing) {
      if (node.score > best.score) best = node;
      alpha = Math.max(alpha, node.score);
      if (alpha >= beta) {
        killerMoves[depth] = [...(killerMoves[depth] || []), col];
        break;
      }
    } else {
      if (node.score < best.score) best = node;
      beta = Math.min(beta, node.score);
      if (beta <= alpha) {
        killerMoves[depth] = [...(killerMoves[depth] || []), col];
        break;
      }
    }

    // History heuristic
    historyScores.set(col, (historyScores.get(col) || 0) + depth * depth);
  }

  // Store in transposition
  let flag = EntryFlag.Exact;
  if (best.score <= alphaOrig) flag = EntryFlag.UpperBound;
  else if (best.score >= betaOrig) flag = EntryFlag.LowerBound;
  transposition.set(key, { score: best.score, depth, column: best.column, flag });

  return best;
}
