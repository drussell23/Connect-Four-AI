import { CellValue } from "./types";

const WINDOW = 4;

// Base weights.
const BASE_SCORES: Record<number, number> = { 4: 100, 3: 5, 2: 2 };

// Extra bonuses/penalties.
const OPEN_THREE_BONUS = { bothEnds: 4, oneEnd: 2 };
const CENTER_COLUMN_BONUS = 3;
const TOP_ROW_PENALTY_FACTOR = 0.8;

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
    const aiCount = cells.filter(c => c === aiDisc).length;
    const humanCount = cells.filter(c => c === humanDisc).length;

    // Contested or totally empty.
    if (aiCount > 0 && humanCount > 0) 
        return 0;

    if (aiCount === 0 && humanCount === 0) 
        return 0;

    // Pick base score.
    let score = 0;

    if (aiCount > 0) {
        score = BASE_SCORES[aiCount] || 0;

        // If exactly three AI discs, check “open‑three” flanks.
        if (aiCount === 3) {
            const emptyEnds =
                (cells[0] === "Empty" ? 1 : 0) + (cells[3] === "Empty" ? 1 : 0);
            if (emptyEnds === 2) 
                score += OPEN_THREE_BONUS.bothEnds;
            else if (emptyEnds === 1) 
                score += OPEN_THREE_BONUS.oneEnd;
        }
    } else {
        // Opponent window: penalize more heavily.
        score = -((BASE_SCORES[humanCount] || 0) * 1.5);
    }

    return score;
}

/**
 * Evaluates full board by sliding a 4‑cell window
 * plus adding center‑column control and penalizing
 * any top‑row windows.
 */
export function evaluateBoard(
    board: CellValue[][],
    aiDisc: CellValue
): number {
    const rows = board.length;
    const cols = board[0].length;
    let score = 0;

    // 1) Sliding windows
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const window = board[r].slice(c, c + WINDOW);
            let wScore = evaluateWindow(window, aiDisc);

            // If this is a “top‑row” window, it’s harder to fill—penalize.
            if (r === 0 && wScore > 0) {
                wScore *= TOP_ROW_PENALTY_FACTOR;
            }

            score += wScore;
        }
    }

    // Vertial
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - WINDOW; r++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c]);
            let wScore = evaluateWindow(window, aiDisc);

            if (r === 0 && wScore > 0)
                wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // Diagonal down‑right
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = 0; c <= cols - WINDOW; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c + i]);
            let wScore = evaluateWindow(window, aiDisc);

            if (r === 0 && wScore > 0)
                wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // Diagonal down‑left
    for (let r = 0; r <= rows - WINDOW; r++) {
        for (let c = WINDOW - 1; c < cols; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c - i]);

            let wScore = evaluateWindow(window, aiDisc);

            if (r === 0 && wScore > 0)
                wScore *= TOP_ROW_PENALTY_FACTOR;
            score += wScore;
        }
    }

    // 2) center‑column control bonus
    const centerCol = Math.floor(cols / 2);
    const humanDisc = aiDisc === "Red" ? "Yellow" : "Red";

    for (let r = 0; r < rows; r++) {
        if (board[r][centerCol] === aiDisc)
            score += CENTER_COLUMN_BONUS;

        else if (board[r][centerCol] === humanDisc)
            score -= CENTER_COLUMN_BONUS;
    }

    return score;
}
