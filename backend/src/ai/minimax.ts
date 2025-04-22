// src/ai/minimax.ts
import { CellValue } from './types';
import { transposition, EntryFlag, hashBoard } from './transposition';
import { quiesce } from './quiescene';
import { legalMoves, tryDrop } from './utils';
import { boardToBitboards, bitboardCheckWin } from './bitboard';
import { evaluateBoard } from './evaluate';

export interface Node {
    score: number;
    column: number | null;
}

// How many plies to shave off for null‐move pruning
const NULL_MOVE_REDUCTION = 2;

// history heuristic table: historyTable[col][depth] = score bonus
const historyTable: number[][] = Array.from({ length: 7 }, () => []);

export function minimax(
    board: CellValue[][],
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    aiDisc: CellValue
): Node {
    // ← ADD THIS LINE TO AVOID STALE CACHE BETWEEN TESTS
    transposition.clear();

    const opponentDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const currentDisc = maximizingPlayer ? aiDisc : opponentDisc;
    const otherDisc = maximizingPlayer ? opponentDisc : aiDisc;
    const key = hashBoard(board);

    // 1) Transposition lookup (now always empty during tests)
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

    // 2) Generate moves
    const moves = legalMoves(board);
    if (moves.length === 0) {
        // no moves = terminal
        return {
            column: null,
            score: maximizingPlayer ? -Infinity : Infinity
        };
    }

    // 3) Immediate win‐loss detection for the *current* and then the *other* player
    for (const col of moves) {
        // (a) can current player win?
        {
            const { board: b1 } = tryDrop(board, col, currentDisc);
            const { red: r1, yellow: y1 } = boardToBitboards(b1);
            const bits1 = currentDisc === 'Red' ? r1 : y1;
            if (bitboardCheckWin(bits1)) {
                return {
                    column: col,
                    score: maximizingPlayer ? Infinity : -Infinity
                };
            }
        }
        // (b) can other player win if we don’t block?
        {
            const { board: b2 } = tryDrop(board, col, otherDisc);
            const { red: r2, yellow: y2 } = boardToBitboards(b2);
            const bits2 = otherDisc === 'Red' ? r2 : y2;
            if (bitboardCheckWin(bits2)) {
                return {
                    column: col,
                    score: -Infinity
                };
            }
        }
    }

    // 4) Depth‑0: quiescence
    if (depth === 0) {
        const score = quiesce(board, alpha, beta, aiDisc);
        return { column: moves[0], score };
    }

    // 5) Null‐move pruning
    if (maximizingPlayer && depth > NULL_MOVE_REDUCTION) {
        const nm = minimax(
            board,
            depth - 1 - NULL_MOVE_REDUCTION,
            -beta,
            -beta + 1,
            false,
            aiDisc
        );
        if (-nm.score >= beta) {
            return { column: null, score: beta };
        }
    }

    // 6) Move ordering via static eval + history
    const ordered = moves
        .map(col => {
            const { board: nb } = tryDrop(
                board,
                col,
                maximizingPlayer ? aiDisc : opponentDisc
            );
            const stat = evaluateBoard(nb, aiDisc) * (maximizingPlayer ? 1 : -1);
            const hist = historyTable[col][depth] || 0;
            return { col, key: stat + hist };
        })
        .sort((a, b) => b.key - a.key)
        .map(x => x.col);

    // 7) Negamax
    let best: Node = {
        column: null,
        score: maximizingPlayer ? -Infinity : Infinity
    };
    const alphaOrig = alpha,
        betaOrig = beta;

    for (const col of ordered) {
        const { board: nb } = tryDrop(
            board,
            col,
            maximizingPlayer ? aiDisc : opponentDisc
        );
        const child = minimax(nb, depth - 1, -beta, -alpha, !maximizingPlayer, aiDisc);
        const sc = -child.score;

        if (
            (maximizingPlayer && sc > best.score) ||
            (!maximizingPlayer && sc < best.score)
        ) {
            best = { column: col, score: sc };
        }

        if (maximizingPlayer) alpha = Math.max(alpha, best.score);
        else beta = Math.min(beta, best.score);

        if (alpha >= beta) {
            historyTable[col][depth] = (historyTable[col][depth] || 0) + depth * depth;
            break;
        }
    }

    // 8) Store in transposition
    let flag = EntryFlag.Exact;
    if (best.score <= alphaOrig) flag = EntryFlag.UpperBound;
    else if (best.score >= betaOrig) flag = EntryFlag.LowerBound;
    transposition.set(key, {
        score: best.score,
        depth,
        column: best.column,
        flag
    });

    return best;
}
