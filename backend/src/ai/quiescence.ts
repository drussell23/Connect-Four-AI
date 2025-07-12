import { CellValue, countOpenThree } from "./connect4AI";
import { legalMoves, tryDrop } from "./connect4AI";
import { bitboardCheckWin, getBits } from "./connect4AI";
import { evaluateBoard } from "./connect4AI";

export interface QuiesceNode {
    score: number;
    column: number | null;
}

// Enhanced quiescence depth control based on game complexity
const MAX_Q_DEPTH = 3; // Increased for better tactical analysis
const THREAT_DEPTH_BONUS = 1; // Extra depth for high-threat positions

/**
 * Enhanced quiescence search optimized for Connect 4 tactical patterns
 * Handles immediate wins, blocks, forks, and multi-threat situations
 */
export function quiesce(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue,
    depth = 0
): QuiesceNode {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // 1) Stand-pat evaluation
    const standPat = evaluateBoard(board, aiDisc);

    // Beta cutoff - position is already too good for opponent
    if (standPat >= beta) {
        return { score: standPat, column: null };
    }

    // Update alpha with stand-pat score
    alpha = Math.max(alpha, standPat);

    // 2) Dynamic depth control based on position complexity
    const currentThreats = countOpenThree(board, aiDisc) + countOpenThree(board, oppDisc);
    const maxDepth = currentThreats > 1 ? MAX_Q_DEPTH + THREAT_DEPTH_BONUS : MAX_Q_DEPTH;

    if (depth >= maxDepth) {
        return { score: alpha, column: null };
    }

    // 3) Enhanced tactical move generation
    const moves = legalMoves(board);
    const tacticalMoves = new Map<number, number>(); // column -> priority

    // Priority levels for different move types
    const PRIORITY = {
        IMMEDIATE_WIN: 1000,
        IMMEDIATE_BLOCK: 900,
        DOUBLE_THREAT: 800,
        CREATE_FORK: 700,
        BLOCK_FORK: 600,
        CREATE_THREAT: 500,
        COUNTER_THREAT: 400
    };

    for (const col of moves) {
        let priority = 0;
        let isRelevant = false;

        // a) Immediate win - highest priority
        const { board: afterAI } = tryDrop(board, col, aiDisc);
        if (bitboardCheckWin(getBits(afterAI, aiDisc))) {
            tacticalMoves.set(col, PRIORITY.IMMEDIATE_WIN);
            continue;
        }

        // b) Immediate block - very high priority
        const { board: afterOpp } = tryDrop(board, col, oppDisc);
        if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
            tacticalMoves.set(col, PRIORITY.IMMEDIATE_BLOCK);
            continue;
        }

        // c) Analyze threat creation and blocking
        const aiThreatsAfter = countOpenThree(afterAI, aiDisc);
        const oppThreatsAfter = countOpenThree(afterAI, oppDisc);
        const currentAIThreats = countOpenThree(board, aiDisc);
        const currentOppThreats = countOpenThree(board, oppDisc);

        // Create multiple threats (fork)
        if (aiThreatsAfter >= 2 && aiThreatsAfter > currentAIThreats) {
            priority = PRIORITY.DOUBLE_THREAT;
            isRelevant = true;
        }
        // Create single threat
        else if (aiThreatsAfter > currentAIThreats) {
            priority = PRIORITY.CREATE_THREAT;
            isRelevant = true;
        }

        // Block opponent's multiple threats
        if (oppThreatsAfter < currentOppThreats && currentOppThreats > 1) {
            priority = Math.max(priority, PRIORITY.BLOCK_FORK);
            isRelevant = true;
        }
        // Counter opponent threat creation
        else if (oppThreatsAfter < currentOppThreats) {
            priority = Math.max(priority, PRIORITY.COUNTER_THREAT);
            isRelevant = true;
        }

        // d) Special Connect 4 patterns
        // Check for setup moves that enable future tactics
        if (isConnectFourSetupMove(board, col, aiDisc)) {
            priority = Math.max(priority, PRIORITY.CREATE_THREAT - 100);
            isRelevant = true;
        }

        // Only include moves that have tactical significance
        if (isRelevant) {
            tacticalMoves.set(col, priority);
        }
    }

    // 4) If no tactical moves found, position is quiet
    if (tacticalMoves.size === 0) {
        return { score: standPat, column: null };
    }

    // 5) Sort tactical moves by priority (highest first)
    const sortedMoves = Array.from(tacticalMoves.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([col, _]) => col);

    // 6) Search tactical moves with enhanced pruning
    let bestCol: number | null = null;
    let moveCount = 0;
    const MAX_MOVES_TO_SEARCH = Math.min(sortedMoves.length, 5); // Limit search width

    for (const col of sortedMoves) {
        if (moveCount >= MAX_MOVES_TO_SEARCH) break;
        moveCount++;

        const { board: nextBoard } = tryDrop(board, col, aiDisc);

        // Recursive quiescence search
        const result = quiesce(nextBoard, -beta, -alpha, oppDisc, depth + 1);
        const score = -result.score;

        // Beta cutoff
        if (score >= beta) {
            return { score, column: col };
        }

        // Update best move
        if (score > alpha) {
            alpha = score;
            bestCol = col;
        }
    }

    return { score: alpha, column: bestCol };
}

/**
 * Detect Connect 4-specific setup moves that enable future tactical opportunities
 */
function isConnectFourSetupMove(board: CellValue[][], col: number, disc: CellValue): boolean {
    const { board: afterMove } = tryDrop(board, col, disc);
    const opponent = disc === 'Red' ? 'Yellow' : 'Red';

    // Check if this move sets up a potential fork in the next few moves
    const futureMoves = legalMoves(afterMove);

    for (const futureCol of futureMoves) {
        if (futureCol === col) continue; // Skip same column

        const { board: futureBoard } = tryDrop(afterMove, futureCol, disc);
        const futureThreats = countOpenThree(futureBoard, disc);

        // If we can create threats in the future, this might be a setup move
        if (futureThreats > 0) {
            return true;
        }
    }

    return false;
}

/**
 * Enhanced quiescence search for endgame positions
 * Uses deeper search when few pieces remain
 */
export function quiesceEndgame(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue,
    depth = 0
): QuiesceNode {
    const emptyCells = board.flat().filter(cell => cell === 'Empty').length;

    // In endgame (< 10 empty cells), use deeper quiescence
    if (emptyCells < 10) {
        const enhancedMaxDepth = MAX_Q_DEPTH + 2;
        return quiesceWithDepth(board, alpha, beta, aiDisc, depth, enhancedMaxDepth);
    }

    return quiesce(board, alpha, beta, aiDisc, depth);
}

/**
 * Quiescence search with custom depth limit
 */
function quiesceWithDepth(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue,
    depth: number,
    maxDepth: number
): QuiesceNode {
    // Same logic as main quiesce but with custom depth limit
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const standPat = evaluateBoard(board, aiDisc);

    if (standPat >= beta) {
        return { score: standPat, column: null };
    }

    alpha = Math.max(alpha, standPat);

    if (depth >= maxDepth) {
        return { score: alpha, column: null };
    }

    // Rest follows same pattern as main quiesce function
    return quiesce(board, alpha, beta, aiDisc, depth);
}