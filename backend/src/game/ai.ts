export type CellValue = 'Empty' | 'Red' | 'Yellow';

const ROWS = 6;
const COLS = 7;
const MAX_DEPTH = 5;  // tune for performance vs. strength

// Score a single window of 4 cells. 
function evaluateWindow(cells: CellValue[], aiDisc: CellValue): number {
    const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const aiCount = cells.filter(c => c === aiDisc).length;
    const humanCount = cells.filter(c => c === humanDisc).length;

    // If both have pieces here, this window is contested -> 0
    if (aiCount > 0 && humanCount > 0) {
        return 0;
    }

    // Weights - tweak these to tune your AI
    const SCORES = {
        4: 100, // Win.
        3: 5,   // Strong.
        2: 2,   // Weak.
    };

    if (aiCount > 0) {
        return SCORES[aiCount as keyof typeof SCORES] || 0;
    }

    if (humanCount > 0) {
        // Penalize opponent's threats a bit more heavily.
        const oppScore = SCORES[humanCount as keyof typeof SCORES] || 0;
        return -oppScore * 1.5;
    }
    return 0;
}

// Full board evaluation by scanning every 4-cell window.
function evaluateBoard(board: CellValue[][], aiDisc: CellValue): number {
    const numRows = board.length;      // <- Shadows global
    const numCols = board[0].length;   // <- Shadows global
    const WINDOW = 4;
    let score = 0;

    // Horizontal windows.
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c <= numCols - WINDOW; c++) {
            const window = board[r].slice(c, c + WINDOW);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Vertical windows. 
    for (let c = 0; c < numCols; c++) {
        for (let r = 0; r <= numRows - WINDOW; r++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c]);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Diagonal (down-right)
    for (let r = 0; r <= numRows - WINDOW; r++) {
        for (let c = 0; c <= numCols - WINDOW; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c + i]);
            score += evaluateWindow(window, aiDisc);
        }
    }

    // Diagonal (down-left)
    for (let r = 0; r <= numRows - WINDOW; r++) {
        for (let c = WINDOW - 1; c < numCols; c++) {
            const window = [0, 1, 2, 3].map(i => board[r + i][c - i]);
            score += evaluateWindow(window, aiDisc);
        }
    }
    return score;
}

// Generate a list of legal columns (i.e. not full)
function legalMoves(board: CellValue[][]): number[] {
    return Array.from({ length: COLS }, (_, c) => c).filter(
        c => board[0][c] === 'Empty'
    );
}

// Drop a disc in a column (mutates a copy of the board)
function tryDrop(
    board: CellValue[][],
    column: number,
    disc: CellValue
): { board: CellValue[][]; row: number } {
    const b = board.map(r => [...r]);
    for (let r = ROWS - 1; r >= 0; r--) {
        if (b[r][column] === 'Empty') {
            b[r][column] = disc;
            return { board: b, row: r };
        }
    }
    throw new Error('Column full');
}

// Check for a win starting at (r,c)
function checkWin(
    board: CellValue[][],
    r: number,
    c: number,
    disc: CellValue
): boolean {
    const dirs = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
    ];
    for (const [dr, dc] of dirs) {
        let count = 1;
        for (let sign of [1, -1]) {
            let rr = r + dr * sign,
                cc = c + dc * sign;
            while (
                rr >= 0 &&
                rr < ROWS &&
                cc >= 0 &&
                cc < COLS &&
                board[rr][cc] === disc
            ) {
                count++;
                rr += dr * sign;
                cc += dc * sign;
            }
        }
        if (count >= 4) return true;
    }
    return false;
}

interface Node {
    score: number;
    column: number | null;
}

function minimax(
    board: CellValue[][],
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    aiDisc: CellValue
): Node {
    const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const moves = legalMoves(board);

    // Terminal or depth‑limit
    if (depth === 0 || moves.length === 0) {
        return { score: evaluateBoard(board, aiDisc), column: null };
    }

    let best: Node = maximizingPlayer
        ? { score: -Infinity, column: null }
        : { score: +Infinity, column: null };

    for (let col of moves) {
        const { board: newBoard, row } = tryDrop(
            board,
            col,
            maximizingPlayer ? aiDisc : humanDisc
        );
        // If this move wins immediately, give it a huge score
        if (checkWin(newBoard, row, col, maximizingPlayer ? aiDisc : humanDisc)) {
            return {
                score: maximizingPlayer ? +Infinity : -Infinity,
                column: col,
            };
        }
        const node = minimax(
            newBoard,
            depth - 1,
            alpha,
            beta,
            !maximizingPlayer,
            aiDisc
        );
        node.column = col;

        if (maximizingPlayer) {
            if (node.score > best.score) best = node;
            alpha = Math.max(alpha, node.score);
        } else {
            if (node.score < best.score) best = node;
            beta = Math.min(beta, node.score);
        }
        if (beta <= alpha) break; // α–β cutoff
    }
    return best;
}

export function getBestAIMove(
    board: CellValue[][],
    aiDisc: CellValue
): number {
    const { column } = minimax(
        board,
        MAX_DEPTH,
        -Infinity,
        +Infinity,
        true,
        aiDisc
    );
    // fallback to random legal move
    const moves = legalMoves(board);
    return column !== null && moves.includes(column)
        ? column
        : moves[Math.floor(Math.random() * moves.length)];
}

