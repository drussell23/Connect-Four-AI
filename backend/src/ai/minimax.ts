import { CellValue } from './types';
import { transposition, EntryFlag, hashBoard } from './transposition';
import { legalMoves } from './utils';
import { boardToBitboards, bitboardCheckWin } from './bitboard';
import { evaluateBoard } from './evaluate';

export interface Node {
    score: number;
    column: number | null;
}

// How many plies to shave off for null‐move pruning
const NULL_MOVE_REDUCTION = 0;
// history heuristic table: historyTable[col][depth] = score bonus
const historyTable: number[][] = Array.from({ length: 7 }, () => []);

/**
 * Drop a disc in-place and return the row index.
 */
function makeMove(board: CellValue[][], col: number, disc: CellValue): number {
    for (let r = board.length - 1; r >= 0; r--) {
        if (board[r][col] === 'Empty') {
            board[r][col] = disc;
            return r;
        }
    }
    throw new Error(`Column ${col} is full`);
}

/** Undo a disc drop at (row,col). */
function undoMove(board: CellValue[][], col: number, row: number): void {
    board[row][col] = 'Empty';
}

export function minimax(
    board: CellValue[][],
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    aiDisc: CellValue
): Node {
    // clear cache so tests don’t see stale entries
    transposition.clear();

    const opponentDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const currentDisc = maximizingPlayer ? aiDisc : opponentDisc;
    const otherDisc = maximizingPlayer ? opponentDisc : aiDisc;
    const key = hashBoard(board);

    // transposition lookup
    const entry = transposition.get(key);
    if (entry && entry.depth >= depth) {
        if (entry.flag === EntryFlag.Exact) return { score: entry.score, column: entry.column };
        if (entry.flag === EntryFlag.LowerBound) alpha = Math.max(alpha, entry.score);
        if (entry.flag === EntryFlag.UpperBound) beta = Math.min(beta, entry.score);
        if (alpha >= beta) return { score: entry.score, column: entry.column };
    }

    const moves = legalMoves(board);
    if (moves.length === 0) {
        // terminal: no moves
        return { column: null, score: maximizingPlayer ? -Infinity : Infinity };
    }

    // immediate win/block detection using bitboards in-place
    for (const col of moves) {
        const row = makeMove(board, col, currentDisc);
        const { red: rBB, yellow: yBB } = boardToBitboards(board);
        const bits = currentDisc === 'Red' ? rBB : yBB;
        undoMove(board, col, row);

        if (bitboardCheckWin(bits)) {
            return { column: col, score: maximizingPlayer ? Infinity : -Infinity };
        }
    }
    for (const col of moves) {
        const row = makeMove(board, col, otherDisc);
        const { red: r2, yellow: y2 } = boardToBitboards(board);
        const bits2 = otherDisc === 'Red' ? r2 : y2;
        undoMove(board, col, row);
        if (bitboardCheckWin(bits2)) {
            return { column: col, score: -Infinity };
        }
    }

    // static evaluation at horizon
    if (depth === 0) {
        const score = evaluateBoard(board, aiDisc);
        return { column: moves[0], score };
    }

    // null-move pruning (disabled when NULL_MOVE_REDUCTION = 0)
    if (maximizingPlayer && depth > NULL_MOVE_REDUCTION) {
        const row = makeMove(board, moves[0], currentDisc);
        const nm = minimax(board, depth - 1 - NULL_MOVE_REDUCTION, -beta, -beta + 1, false, aiDisc);
        undoMove(board, moves[0], row);
        if (-nm.score >= beta) return { column: null, score: beta };
    }

    // move ordering
    const ordered = moves
        .map(col => {
            const row = makeMove(board, col, currentDisc);
            const stat = 0; // placeholder: replace with real eval if desired
            undoMove(board, col, row);
            const hist = historyTable[col][depth] || 0;
            return { col, key: hist + stat };
        })
        .sort((a, b) => b.key - a.key)
        .map(x => x.col);

    // negamax search
    let best: Node = { column: null, score: maximizingPlayer ? -Infinity : Infinity };
    const alphaOrig = alpha, betaOrig = beta;
    for (const col of ordered) {
        const row = makeMove(board, col, currentDisc);
        const child = minimax(board, depth - 1, -beta, -alpha, !maximizingPlayer, aiDisc);
        undoMove(board, col, row);
        const sc = -child.score;
        if ((maximizingPlayer && sc > best.score) || (!maximizingPlayer && sc < best.score)) {
            best = { column: col, score: sc };
        }
        if (maximizingPlayer) alpha = Math.max(alpha, best.score);
        else beta = Math.min(beta, best.score);
        if (alpha >= beta) {
            historyTable[col][depth] = (historyTable[col][depth] || 0) + depth * depth;
            break;
        }
    }

    // store in cache
    let flag = EntryFlag.Exact;
    if (best.score <= alphaOrig) flag = EntryFlag.UpperBound;
    else if (best.score >= betaOrig) flag = EntryFlag.LowerBound;
    transposition.set(key, { score: best.score, depth, column: best.column, flag });

    return best;
}