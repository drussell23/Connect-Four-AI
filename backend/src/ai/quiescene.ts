import { CellValue } from './types';
import { legalMoves, tryDrop, checkWin } from './utils';
import { evaluateBoard } from './evaluate';

/**
 * Quiescence search: extends evaluation in "noisy" positions where the opponent
 * has immediate win threats. Only considers opponent's winning moves to avoid
 * the horizon effect.
 *
 * @param board Current game board
 * @param alpha Alpha bound
 * @param beta  Beta bound
 * @param aiDisc The AI's disc color ('Red' or 'Yellow')
 * @returns A static evaluation or deeper search result
 */
export function quiesce(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue
): number {
    // Stand-pat evaluation
    let stand = evaluateBoard(board, aiDisc);

    if (stand >= beta)
        return beta;

    if (stand > alpha)
        alpha = stand;

    // Opponent disc for threat detection
    const humanDisc: CellValue = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // Only consider opponent's winning moves
    for (const col of legalMoves(board)) {
        let nb: CellValue[][];
        let row: number;

        try {
            ({ board: nb, row } = tryDrop(board, col, humanDisc));
        } catch {
            continue; // column full
        }

        // If opponent can win here, search deeper
        if (checkWin(nb, row, col, humanDisc)) {
            const score = -quiesce(nb, -beta, -alpha, aiDisc);
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
    }

    return alpha;
}
