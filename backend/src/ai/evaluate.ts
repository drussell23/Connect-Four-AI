import { CellValue } from "./types";

const WINDOW = 4;

/**
 * Scores a single 4-cell window for the AI:
 *  +SCORES[n] when AI has n discs,
 *  -SCORES[n]*1.5 when opponent has n discs, 0 if contested or empty.
 */
export function evaluateWindow(cells: CellValue[], aiDisc: CellValue): number {
    const humanDisc: CellValue = aiDisc === "Red" ? "Yellow" : "Red";
    const aiCount = cells.filter(c => c === aiDisc).length;
    const humanCount = cells.filter(c => c === humanDisc).length;

    // Contested window.
    if (aiCount > 0 && humanCount > 0) return 0;

    // Scoring weights.
    const SCORES: Record<number, number> = { 4: 100, 3: 5, 2: 2 };

    if (aiCount > 0) {
        return SCORES[aiCount] || 0;
    }

    if (humanCount > 0) {
        return -(SCORES[humanCount] || 0) * 1.5;
    }

    return 0;
}

/**
 * Evaluates the entire board by sliding a 4-cell window
 * across all horizontal, vertical, and diagonal lines.
 */
export function evaluateBoard(board: CellValue[][], aiDisc: CellValue): number {
    const rows = board.length;
    const cols = board[0].length;
    let score = 0;

    // Horizontal.
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const window = board[r].slice(c, c + WINDOW);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Vertical.
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - WINDOW; r++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c]);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Diagonal (down-right).
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c + i]);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Diagonal (down-left).
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = WINDOW - 1; c < cols; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c - i]);
            score += evaluateWindow(window, aiDisc);
        }
    }

    return score;
}
