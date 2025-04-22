// src/ai/evaluate.ts
import { CellValue } from "./types";

const WINDOW = 4;

// Base weights.
const BASE_SCORES: Record<number, number> = { 4: 100, 3: 5, 2: 2 };

// Extra bonuses/penalties.
const OPEN_THREE_BONUS = { bothEnds: 4, oneEnd: 2 };
const CENTER_COLUMN_BONUS = 3;
const TOP_ROW_PENALTY_FACTOR = 0.8;

/**
 * Returns true if `disc` has any “three in a row” on the board
 * with at least one adjacent empty slot (an open flank).
 */
function hasThreeInRowWithOpenEnd(
    board: CellValue[][],
    disc: CellValue
): boolean {
    const rows = board.length;
    const cols = board[0].length;

    // HORIZONTAL
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - 3; c++) {
            if (
                board[r][c] === disc &&
                board[r][c + 1] === disc &&
                board[r][c + 2] === disc
            ) {
                const leftOpen = c - 1 >= 0 && board[r][c - 1] === "Empty";
                const rightOpen = c + 3 < cols && board[r][c + 3] === "Empty";
                if (leftOpen || rightOpen) return true;
            }
        }
    }

    // VERTICAL
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - 3; r++) {
            if (
                board[r][c] === disc &&
                board[r + 1][c] === disc &&
                board[r + 2][c] === disc
            ) {
                const aboveOpen = r - 1 >= 0 && board[r - 1][c] === "Empty";
                const belowOpen = r + 3 < rows && board[r + 3][c] === "Empty";
                if (aboveOpen || belowOpen) return true;
            }
        }
    }

    // DIAGONAL DOWN‑RIGHT
    for (let r = 0; r <= rows - 3; r++) {
        for (let c = 0; c <= cols - 3; c++) {
            if (
                board[r][c] === disc &&
                board[r + 1][c + 1] === disc &&
                board[r + 2][c + 2] === disc
            ) {
                const upLeftOpen =
                    r - 1 >= 0 && c - 1 >= 0 && board[r - 1][c - 1] === "Empty";
                const downRightOpen =
                    r + 3 < rows && c + 3 < cols && board[r + 3][c + 3] === "Empty";
                if (upLeftOpen || downRightOpen) return true;
            }
        }
    }

    // DIAGONAL DOWN‑LEFT
    for (let r = 0; r <= rows - 3; r++) {
        for (let c = 2; c < cols; c++) {
            if (
                board[r][c] === disc &&
                board[r + 1][c - 1] === disc &&
                board[r + 2][c - 2] === disc
            ) {
                const upRightOpen =
                    r - 1 >= 0 && c + 1 < cols && board[r - 1][c + 1] === "Empty";
                const downLeftOpen =
                    r + 3 < rows && c - 3 >= 0 && board[r + 3][c - 3] === "Empty";
                if (upRightOpen || downLeftOpen) return true;
            }
        }
    }

    return false;
}

/**
 * Scores a single 4‑cell window for the AI:
 *  +BASE_SCORES[n] when AI has n discs,
 *  -BASE_SCORES[n]*1.5 when opponent has n discs,
 *  +open‑three bonus,
 *  0 if contested or empty.
 */
export function evaluateWindow(
    cells: CellValue[],
    aiDisc: CellValue
): number {
    const humanDisc = aiDisc === "Red" ? "Yellow" : "Red";
    const aiCount = cells.filter((c) => c === aiDisc).length;
    const humanCount = cells.filter((c) => c === humanDisc).length;

    // Contested or totally empty.
    if ((aiCount > 0 && humanCount > 0) || (aiCount === 0 && humanCount === 0))
        return 0;

    let score = 0;
    if (aiCount > 0) {
        score = BASE_SCORES[aiCount] || 0;
        if (aiCount === 3) {
            const emptyEnds =
                (cells[0] === "Empty" ? 1 : 0) + (cells[3] === "Empty" ? 1 : 0);
            if (emptyEnds === 2) score += OPEN_THREE_BONUS.bothEnds;
            else if (emptyEnds === 1) score += OPEN_THREE_BONUS.oneEnd;
        }
    } else {
        score = -((BASE_SCORES[humanCount] || 0) * 1.5);
    }
    return score;
}

/**
 * Evaluates full board by:
 *  0) If opponent has an open‑three, return huge penalty.
 *  1) Sliding windows (rows, cols, diagonals)
 *  2) Center‑column bonus & top‑row penalty
 */
export function evaluateBoard(
    board: CellValue[][],
    aiDisc: CellValue
): number {
    const opponent: CellValue = aiDisc === "Red" ? "Yellow" : "Red";

    // 0) Immediate threat check
    if (hasThreeInRowWithOpenEnd(board, opponent)) {
        return -1e6;
    }

    // 1) Sliding 4‑cell windows
    const rows = board.length;
    const cols = board[0].length;
    let score = 0;

    // horizontal windows
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const w = board[r].slice(c, c + WINDOW);
            let wScore = evaluateWindow(w, aiDisc);
            if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // vertical windows
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - WINDOW; r++) {
            const w = [0, 1, 2, 3].map((i) => board[r + i][c]);
            let wScore = evaluateWindow(w, aiDisc);
            if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // diag down‑right
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const w = [0, 1, 2, 3].map((i) => board[r + i][c + i]);
            let wScore = evaluateWindow(w, aiDisc);
            if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // diag down‑left
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = WINDOW - 1; c < cols; c++) {
            const w = [0, 1, 2, 3].map((i) => board[r + i][c - i]);
            let wScore = evaluateWindow(w, aiDisc);
            if (r === 0 && wScore > 0) wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // 2) center‑column / top‑row adjustments
    const centerCol = Math.floor(cols / 2);
    for (let r = 0; r < rows; r++) {
        if (board[r][centerCol] === aiDisc) score += CENTER_COLUMN_BONUS;
        else if (board[r][centerCol] === opponent) score -= CENTER_COLUMN_BONUS;
    }

    return score;
}
