// src/ai/evaluate.ts
import { CellValue } from "./types";

const WINDOW = 4;

// Base scores for 2,3,4 in a row
const BASE_SCORES: Record<number, number> = {
  4: 100,
  3: 5,
  2: 2,
};
// Open three bonuses when aiCount === 3
const OPEN_THREE_BONUS = {
  bothEnds: 4,
  oneEnd: 2,
};
// Position bonuses/penalties
const CENTER_COLUMN_BONUS = 3;
const TOP_ROW_PENALTY_FACTOR = 0.8;

/**
 * Scores a single 4-cell window.
 */
export function evaluateWindow(
  cells: CellValue[],
  aiDisc: CellValue
): number {
  const humanDisc = aiDisc === "Red" ? "Yellow" : "Red";
  const aiCount = cells.filter((c) => c === aiDisc).length;
  const humanCount = cells.filter((c) => c === humanDisc).length;
  const emptyCount = cells.filter((c) => c === "Empty").length;

  // contested (both present) or empty
  if ((aiCount > 0 && humanCount > 0) || (aiCount === 0 && humanCount === 0)) {
    return 0;
  }

  if (aiCount > 0) {
    // AI patterns
    let score = BASE_SCORES[aiCount] || 0;
    if (aiCount === 3 && emptyCount === 1) {
      const emptyEnds =
        (cells[0] === "Empty" ? 1 : 0) + (cells[3] === "Empty" ? 1 : 0);
      if (emptyEnds === 2) score += OPEN_THREE_BONUS.bothEnds;
      else if (emptyEnds === 1) score += OPEN_THREE_BONUS.oneEnd;
    }
    return score;
  } else {
    // Opponent patterns (scaled penalty)
    const base = BASE_SCORES[humanCount] || 0;
    return -(base * 1.5);
  }
}

/**
 * Full-board evaluation using sliding windows and positional bonuses.
 */
export function evaluateBoard(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const rows = board.length;
  const cols = board[0].length;
  const humanDisc = aiDisc === "Red" ? "Yellow" : "Red";
  let score = 0;

  // 0) Immediate opponent open-three threat = huge penalty
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const w = board[r].slice(c, c + WINDOW);
      const oppCount = w.filter((x) => x === humanDisc).length;
      const emptyCount = w.filter((x) => x === "Empty").length;
      if (oppCount === 3 && emptyCount === 1) {
        return -1e6;
      }
    }
  }

  // 1) Horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const w = board[r].slice(c, c + WINDOW);
      let wScore = evaluateWindow(w, aiDisc);
      if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
      score += wScore;
    }
  }

  // 2) Vertical
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - WINDOW; r++) {
      const w = [0, 1, 2, 3].map((i) => board[r + i][c]);
      let wScore = evaluateWindow(w, aiDisc);
      if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
      score += wScore;
    }
  }

  // 3) Diagonals
  for (let r = 0; r <= rows - WINDOW; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const dr = [0, 1, 2, 3].map((i) => board[r + i][c + i]);
      let drScore = evaluateWindow(dr, aiDisc);
      if (r === 0 && drScore > 0) drScore *= TOP_ROW_PENALTY_FACTOR;
      score += drScore;

      const dl = [0, 1, 2, 3].map((i) => board[r + i][c + WINDOW - 1 - i]);
      let dlScore = evaluateWindow(dl, aiDisc);
      if (r === 0 && dlScore > 0) dlScore *= TOP_ROW_PENALTY_FACTOR;
      score += dlScore;
    }
  }

  // 4) Center-column bonus
  const center = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    if (board[r][center] === aiDisc) score += CENTER_COLUMN_BONUS;
    else if (board[r][center] === humanDisc) score -= CENTER_COLUMN_BONUS;
  }

  return score;
}
