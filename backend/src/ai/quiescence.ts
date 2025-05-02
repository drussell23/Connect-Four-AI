import { CellValue, countOpenThree } from "./connect4AI";
import { legalMoves, tryDrop } from "./connect4AI";
import { bitboardCheckWin, getBits } from "./connect4AI";
import { evaluateBoard } from "./connect4AI";

export interface QuiesceNode {
    score: number;
    column: number | null;
}

// Cap how deep quiescence can recurse (beyond the plain minimax leaf).
const MAX_Q_DEPTH = 2;

// "Noisy" positions are those with immediate wins, blocks, or new threats.
export function quiesce(
    board: CellValue[][],
    alpha: number,
    beta: number, 
    aiDisc: CellValue,
    depth = 0
): QuiesceNode {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // 1) Stand-pat 
    const standPat = evaluateBoard(board, aiDisc);

    if (standPat >= beta) {
        return { score: standPat, column: null };
    }

    alpha = Math.max(alpha, standPat);

    // 2) If we've recursed too deep in quiescence, bail.
    if (depth >= MAX_Q_DEPTH) {
        return { score: alpha, column: null };
    }

    // 3) Gather all "tactical" moves.
    const moves = legalMoves(board);
    const noisySet = new Set<number>();
    const priority: Record<number, number> = {};

    for (const col of moves) {
        // a) Immediate win.
        const { board: afterUs } = tryDrop(board, col, aiDisc);

        if (bitboardCheckWin(getBits(afterUs, aiDisc))) {
            noisySet.add(col);
            priority[col] = 100; // Highest priority.
            continue;
        }

        // b) Immediate block.
        const { board: afterOpp } = tryDrop(board, col, oppDisc);

        if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
            noisySet.add(col);
            priority[col] = 90;
            continue;
        }

        // c) Create a new fork/open-three for us.
        const forkUs = countOpenThree(afterUs, aiDisc);

        if (forkUs > 0) {
            noisySet.add(col);
            priority[col] = 80 + forkUs;
        }

        // d) Fail to block opponent forks (i.e. leaves >= 1 open-three).
        const forksOpp = countOpenThree(afterOpp, oppDisc);

        if (forksOpp > 1) {
            noisySet.add(col);
            priority[col] = 50 + forksOpp;
        }
    }

    // 4) If nothing tactical, we're "quiet" -> return standPat.
    if (noisySet.size === 0) {
        return { score: standPat, column: null };
    }

    // 5) Sort noisy moves by descending priority. 
    const noisyMoves = Array.from(noisySet).sort((a, b) => (priority[b] || 0) - (priority[a] || 0));

    // 6) Recursively search each tactical move.
    let bestCol: number | null = null;

    for (const col of noisyMoves) {
        const { board: next } = tryDrop(board, col, aiDisc);
        const node = quiesce(next, -beta, -alpha, aiDisc, depth + 1);
        const score = -node.score;

        if (score >= beta) {
            return { score, column: col };
        }

        if (score > alpha) {
            alpha = score;
            bestCol = col;
        }
    }
    return { score: alpha, column: bestCol };
}