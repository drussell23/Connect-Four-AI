export type CellValue = 'Empty' | 'Red' | 'Yellow';

const ROWS = 6;
const COLS = 7;
const MAX_DEPTH = 5;  // tune for performance vs. strength

// Simple evaluation: count 2‑in‑a‑rows, 3‑in‑a‑rows, etc.
function evaluateBoard(board: CellValue[][], aiDisc: CellValue): number {
    const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    let score = 0;
    // TODO: scan every window of 4 cells (horizontal, vertical, diag)
    // add +X for aiDisc count, −X for humanDisc count
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

