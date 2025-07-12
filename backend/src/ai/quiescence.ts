import { CellValue, countOpenThree, hashBoard, legalMoves, tryDrop, bitboardCheckWin, getBits, evaluateBoard } from "./connect4AI";

export interface QuiesceNode {
    score: number;
    column: number | null;
    depth: number;
    nodeCount: number;
    cutoffType?: 'beta' | 'futility' | 'delta' | 'depth';
}

export interface QuiescenceStats {
    totalNodes: number;
    betaCutoffs: number;
    deltaCutoffs: number;
    futilityCutoffs: number;
    depthCutoffs: number;
    transpositionHits: number;
    killerMoveHits: number;
    averageDepth: number;
    maxDepth: number;
}

// Enhanced configuration for advanced quiescence search
export interface QuiescenceConfig {
    maxDepth: number;
    threatDepthBonus: number;
    deltaMargin: number;
    futilityMargin: number;
    useTranspositionTable: boolean;
    useKillerMoves: boolean;
    useDeltaPruning: boolean;
    useFutilityPruning: boolean;
    enableAdvancedPatterns: boolean;
    maxMovesToSearch: number;
}

// Default advanced configuration
const DEFAULT_CONFIG: QuiescenceConfig = {
    maxDepth: 4,
    threatDepthBonus: 2,
    deltaMargin: 200,
    futilityMargin: 500,
    useTranspositionTable: true,
    useKillerMoves: true,
    useDeltaPruning: true,
    useFutilityPruning: true,
    enableAdvancedPatterns: true,
    maxMovesToSearch: 6
};

// Advanced quiescence transposition table
interface QuiescenceEntry {
    score: number;
    column: number | null;
    depth: number;
    flag: 'exact' | 'lower' | 'upper';
    age: number;
}

class QuiescenceTranspositionTable {
    private table = new Map<bigint, QuiescenceEntry>();
    private currentAge = 0;
    private readonly maxSize = 100000;

    get(hash: bigint): QuiescenceEntry | undefined {
        return this.table.get(hash);
    }

    store(hash: bigint, entry: QuiescenceEntry): void {
        if (this.table.size >= this.maxSize) {
            this.cleanup();
        }
        entry.age = this.currentAge;
        this.table.set(hash, entry);
    }

    clear(): void {
        this.table.clear();
        this.currentAge = 0;
    }

    ageEntries(): void {
        this.currentAge++;
    }

    private cleanup(): void {
        const entries = Array.from(this.table.entries());
        entries.sort((a, b) => b[1].age - a[1].age);

        // Keep only the newest 50% of entries
        const keepCount = Math.floor(entries.length / 2);
        this.table.clear();

        for (let i = 0; i < keepCount; i++) {
            this.table.set(entries[i][0], entries[i][1]);
        }
    }
}

// Killer moves for enhanced move ordering
class KillerMoveTable {
    private killers: number[][] = [];
    private readonly maxDepth = 20;

    constructor() {
        for (let i = 0; i < this.maxDepth; i++) {
            this.killers[i] = [];
        }
    }

    addKiller(depth: number, move: number): void {
        if (depth >= this.maxDepth) return;

        const killerArray = this.killers[depth];
        if (!killerArray.includes(move)) {
            killerArray.unshift(move);
            if (killerArray.length > 2) {
                killerArray.pop();
            }
        }
    }

    getKillers(depth: number): number[] {
        return depth < this.maxDepth ? this.killers[depth] : [];
    }

    clear(): void {
        for (let i = 0; i < this.maxDepth; i++) {
            this.killers[i] = [];
        }
    }
}

// Global instances for advanced features
const qTranspositionTable = new QuiescenceTranspositionTable();
const killerMoves = new KillerMoveTable();
let globalStats: QuiescenceStats = {
    totalNodes: 0,
    betaCutoffs: 0,
    deltaCutoffs: 0,
    futilityCutoffs: 0,
    depthCutoffs: 0,
    transpositionHits: 0,
    killerMoveHits: 0,
    averageDepth: 0,
    maxDepth: 0
};

/**
 * Advanced quiescence search with cutting-edge optimizations
 */
export function quiesce(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue,
    depth = 0,
    config: QuiescenceConfig = DEFAULT_CONFIG
): QuiesceNode {
    globalStats.totalNodes++;
    globalStats.maxDepth = Math.max(globalStats.maxDepth, depth);

    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const hash = hashBoard(board);

    // 1) Transposition table lookup
    if (config.useTranspositionTable) {
        const entry = qTranspositionTable.get(hash);
        if (entry && entry.depth >= depth) {
            globalStats.transpositionHits++;
            if (entry.flag === 'exact') {
                return { score: entry.score, column: entry.column, depth, nodeCount: 1 };
            }
            if (entry.flag === 'lower') alpha = Math.max(alpha, entry.score);
            if (entry.flag === 'upper') beta = Math.min(beta, entry.score);
            if (alpha >= beta) {
                return { score: entry.score, column: entry.column, depth, nodeCount: 1 };
            }
        }
    }

    // 2) Stand-pat evaluation with enhanced analysis
    const standPat = evaluateBoard(board, aiDisc);

    // Beta cutoff
    if (standPat >= beta) {
        globalStats.betaCutoffs++;
        if (config.useTranspositionTable) {
            qTranspositionTable.store(hash, {
                score: standPat,
                column: null,
                depth,
                flag: 'lower',
                age: 0
            });
        }
        return { score: standPat, column: null, depth, nodeCount: 1, cutoffType: 'beta' };
    }

    // Update alpha
    const originalAlpha = alpha;
    alpha = Math.max(alpha, standPat);

    // 3) Dynamic depth control with advanced threat analysis
    const threatComplexity = analyzePositionComplexity(board, aiDisc);
    const dynamicMaxDepth = config.maxDepth + (threatComplexity.level > 2 ? config.threatDepthBonus : 0);

    if (depth >= dynamicMaxDepth) {
        globalStats.depthCutoffs++;
        return { score: alpha, column: null, depth, nodeCount: 1, cutoffType: 'depth' };
    }

    // 4) Delta pruning - if even the best possible capture can't raise alpha
    if (config.useDeltaPruning && depth > 0) {
        const deltaMargin = config.deltaMargin + (threatComplexity.level * 100);
        if (standPat + deltaMargin < alpha) {
            globalStats.deltaCutoffs++;
            return { score: alpha, column: null, depth, nodeCount: 1, cutoffType: 'delta' };
        }
    }

    // 5) Enhanced tactical move generation
    const tacticalMoves = generateAdvancedTacticalMoves(board, aiDisc, config);

    if (tacticalMoves.length === 0) {
        // Position is quiet
        if (config.useTranspositionTable) {
            qTranspositionTable.store(hash, {
                score: standPat,
                column: null,
                depth,
                flag: 'exact',
                age: 0
            });
        }
        return { score: standPat, column: null, depth, nodeCount: 1 };
    }

    // 6) Advanced move ordering with killer moves
    const orderedMoves = orderMovesAdvanced(tacticalMoves, depth, config);

    // 7) Search tactical moves with advanced pruning
    let bestMove: number | null = null;
    let bestScore = alpha;
    let nodeCount = 1;
    let searchedMoves = 0;
    const maxMoves = Math.min(orderedMoves.length, config.maxMovesToSearch);

    for (const moveData of orderedMoves) {
        if (searchedMoves >= maxMoves) break;

        const col = moveData.column;
        searchedMoves++;

        // Futility pruning for non-critical moves
        if (config.useFutilityPruning && depth > 0 && moveData.priority < 800) {
            const futilityScore = standPat + moveData.priority + config.futilityMargin;
            if (futilityScore <= alpha) {
                globalStats.futilityCutoffs++;
                continue;
            }
        }

        const { board: nextBoard } = tryDrop(board, col, aiDisc);

        // Recursive search
        const result = quiesce(nextBoard, -beta, -bestScore, oppDisc, depth + 1, config);
        const score = -result.score;
        nodeCount += result.nodeCount;

        // Beta cutoff
        if (score >= beta) {
            globalStats.betaCutoffs++;
            if (config.useKillerMoves) {
                killerMoves.addKiller(depth, col);
            }

            if (config.useTranspositionTable) {
                qTranspositionTable.store(hash, {
                    score: beta,
                    column: col,
                    depth,
                    flag: 'lower',
                    age: 0
                });
            }

            return { score: beta, column: col, depth, nodeCount, cutoffType: 'beta' };
        }

        // Update best move
        if (score > bestScore) {
            bestScore = score;
            bestMove = col;
        }
    }

    // 8) Store in transposition table
    if (config.useTranspositionTable) {
        const flag = bestScore <= originalAlpha ? 'upper' :
            bestScore >= beta ? 'lower' : 'exact';
        qTranspositionTable.store(hash, {
            score: bestScore,
            column: bestMove,
            depth,
            flag,
            age: 0
        });
    }

    return { score: bestScore, column: bestMove, depth, nodeCount };
}

/**
 * Advanced position complexity analysis
 */
function analyzePositionComplexity(board: CellValue[][], aiDisc: CellValue): {
    level: number;
    threats: number;
    forks: number;
    immediateWins: number;
    forcedSequences: number;
} {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const moves = legalMoves(board);

    let immediateWins = 0;
    let threats = 0;
    let forks = 0;
    let forcedSequences = 0;

    for (const col of moves) {
        // Check immediate wins
        const { board: afterAI } = tryDrop(board, col, aiDisc);
        if (bitboardCheckWin(getBits(afterAI, aiDisc))) {
            immediateWins++;
        }

        const { board: afterOpp } = tryDrop(board, col, oppDisc);
        if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
            immediateWins++;
        }

        // Count threats
        const aiThreats = countOpenThree(afterAI, aiDisc);
        const oppThreats = countOpenThree(afterOpp, oppDisc);
        threats += aiThreats + oppThreats;

        // Count forks (multiple threats)
        if (aiThreats >= 2) forks++;
        if (oppThreats >= 2) forks++;

        // Check for forced sequences
        if (aiThreats > 0 || oppThreats > 0) {
            forcedSequences++;
        }
    }

    const level = Math.min(5, immediateWins * 2 + forks * 3 + Math.floor(threats / 2));

    return { level, threats, forks, immediateWins, forcedSequences };
}

/**
 * Generate advanced tactical moves with sophisticated pattern recognition
 */
function generateAdvancedTacticalMoves(
    board: CellValue[][],
    aiDisc: CellValue,
    config: QuiescenceConfig
): Array<{ column: number; priority: number; type: string }> {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const moves = legalMoves(board);
    const tacticalMoves: Array<{ column: number; priority: number; type: string }> = [];

    const PRIORITY = {
        IMMEDIATE_WIN: 2000,
        IMMEDIATE_BLOCK: 1900,
        DOUBLE_THREAT: 1800,
        TRIPLE_THREAT: 1850,
        FORK_CREATION: 1700,
        FORK_BLOCK: 1600,
        THREAT_CREATION: 1500,
        COUNTER_THREAT: 1400,
        SETUP_MOVE: 1300,
        ZUGZWANG: 1200,
        ADVANCED_PATTERN: 1100,
        DEFENSIVE_PATTERN: 1000
    };

    for (const col of moves) {
        const moveAnalysis = analyzeMove(board, col, aiDisc);

        if (moveAnalysis.isRelevant) {
            tacticalMoves.push({
                column: col,
                priority: moveAnalysis.priority,
                type: moveAnalysis.type
            });
        }
    }

    return tacticalMoves;
}

/**
 * Advanced move analysis with sophisticated pattern recognition
 */
function analyzeMove(board: CellValue[][], col: number, aiDisc: CellValue): {
    isRelevant: boolean;
    priority: number;
    type: string;
} {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // Simulate move for both players
    const { board: afterAI } = tryDrop(board, col, aiDisc);
    const { board: afterOpp } = tryDrop(board, col, oppDisc);

    // Check for immediate wins
    if (bitboardCheckWin(getBits(afterAI, aiDisc))) {
        return { isRelevant: true, priority: 2000, type: 'IMMEDIATE_WIN' };
    }
    if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
        return { isRelevant: true, priority: 1900, type: 'IMMEDIATE_BLOCK' };
    }

    // Analyze threat patterns
    const currentAIThreats = countOpenThree(board, aiDisc);
    const currentOppThreats = countOpenThree(board, oppDisc);
    const aiThreatsAfter = countOpenThree(afterAI, aiDisc);
    const oppThreatsAfter = countOpenThree(afterAI, oppDisc);

    // Multiple threat creation
    if (aiThreatsAfter >= 3) {
        return { isRelevant: true, priority: 1850, type: 'TRIPLE_THREAT' };
    }
    if (aiThreatsAfter >= 2 && aiThreatsAfter > currentAIThreats) {
        return { isRelevant: true, priority: 1800, type: 'DOUBLE_THREAT' };
    }

    // Fork analysis
    if (aiThreatsAfter > currentAIThreats) {
        return { isRelevant: true, priority: 1700, type: 'FORK_CREATION' };
    }
    if (oppThreatsAfter < currentOppThreats && currentOppThreats > 1) {
        return { isRelevant: true, priority: 1600, type: 'FORK_BLOCK' };
    }

    // Advanced pattern recognition
    const advancedPattern = detectAdvancedPatterns(board, col, aiDisc);
    if (advancedPattern.detected) {
        return {
            isRelevant: true,
            priority: 1100 + advancedPattern.bonus,
            type: 'ADVANCED_PATTERN'
        };
    }

    // Zugzwang detection
    if (detectZugzwang(board, col, aiDisc)) {
        return { isRelevant: true, priority: 1200, type: 'ZUGZWANG' };
    }

    // Setup moves
    if (isSetupMove(board, col, aiDisc)) {
        return { isRelevant: true, priority: 1300, type: 'SETUP_MOVE' };
    }

    return { isRelevant: false, priority: 0, type: 'NONE' };
}

/**
 * Detect advanced Connect 4 patterns
 */
function detectAdvancedPatterns(board: CellValue[][], col: number, aiDisc: CellValue): {
    detected: boolean;
    bonus: number;
    pattern: string;
} {
    const { board: afterMove } = tryDrop(board, col, aiDisc);
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // Check for trapping patterns
    const trappingBonus = detectTrappingPattern(afterMove, aiDisc);
    if (trappingBonus > 0) {
        return { detected: true, bonus: trappingBonus, pattern: 'TRAPPING' };
    }

    // Check for odd-even strategy patterns
    const oddEvenBonus = detectOddEvenPattern(afterMove, col, aiDisc);
    if (oddEvenBonus > 0) {
        return { detected: true, bonus: oddEvenBonus, pattern: 'ODD_EVEN' };
    }

    // Check for basinet patterns
    const basinetBonus = detectBasinetPattern(afterMove, aiDisc);
    if (basinetBonus > 0) {
        return { detected: true, bonus: basinetBonus, pattern: 'BASINET' };
    }

    return { detected: false, bonus: 0, pattern: 'NONE' };
}

/**
 * Detect trapping patterns
 */
function detectTrappingPattern(board: CellValue[][], aiDisc: CellValue): number {
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const rows = board.length;
    const cols = board[0].length;

    // Look for positions where opponent pieces are trapped
    let trappingScore = 0;

    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === oppDisc && board[r + 1][c] === aiDisc) {
                // Opponent piece above AI piece - potential trap
                trappingScore += 50;
            }
        }
    }

    return trappingScore;
}

/**
 * Detect odd-even strategy patterns
 */
function detectOddEvenPattern(board: CellValue[][], col: number, aiDisc: CellValue): number {
    const rows = board.length;
    let emptyCount = 0;

    // Count empty cells in this column
    for (let r = 0; r < rows; r++) {
        if (board[r][col] === 'Empty') {
            emptyCount++;
        }
    }

    // Odd-even control strategy
    return emptyCount % 2 === 1 ? 30 : 0;
}

/**
 * Detect basinet patterns (controlling key squares)
 */
function detectBasinetPattern(board: CellValue[][], aiDisc: CellValue): number {
    const rows = board.length;
    const cols = board[0].length;
    const centerCol = Math.floor(cols / 2);

    // Check for control of center columns
    let centerControl = 0;
    for (let r = 0; r < rows; r++) {
        if (board[r][centerCol] === aiDisc) {
            centerControl += 10;
        }
    }

    return centerControl;
}

/**
 * Detect zugzwang positions
 */
function detectZugzwang(board: CellValue[][], col: number, aiDisc: CellValue): boolean {
    const { board: afterMove } = tryDrop(board, col, aiDisc);
    const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

    // Check if this move forces opponent into a bad position
    const oppMoves = legalMoves(afterMove);
    let badMovesForOpp = 0;

    for (const oppCol of oppMoves) {
        const { board: afterOpp } = tryDrop(afterMove, oppCol, oppDisc);
        const aiThreats = countOpenThree(afterOpp, aiDisc);
        if (aiThreats > 0) {
            badMovesForOpp++;
        }
    }

    return badMovesForOpp > oppMoves.length / 2;
}

/**
 * Check if move is a setup move
 */
function isSetupMove(board: CellValue[][], col: number, aiDisc: CellValue): boolean {
    const { board: afterMove } = tryDrop(board, col, aiDisc);
    const futureMoves = legalMoves(afterMove);

    // Check if any future move creates threats
    for (const futureCol of futureMoves) {
        if (futureCol === col) continue;
        const { board: futureBoard } = tryDrop(afterMove, futureCol, aiDisc);
        if (countOpenThree(futureBoard, aiDisc) > 0) {
            return true;
        }
    }

    return false;
}

/**
 * Advanced move ordering with killer moves and history heuristic
 */
function orderMovesAdvanced(
    moves: Array<{ column: number; priority: number; type: string }>,
    depth: number,
    config: QuiescenceConfig
): Array<{ column: number; priority: number; type: string }> {
    const killers = config.useKillerMoves ? killerMoves.getKillers(depth) : [];

    // Boost priority for killer moves
    for (const move of moves) {
        if (killers.includes(move.column)) {
            move.priority += 100;
            globalStats.killerMoveHits++;
        }
    }

    // Sort by priority (highest first)
    return moves.sort((a, b) => b.priority - a.priority);
}

/**
 * Enhanced quiescence search for endgame positions
 */
export function quiesceEndgame(
    board: CellValue[][],
    alpha: number,
    beta: number,
    aiDisc: CellValue,
    depth = 0
): QuiesceNode {
    const emptyCells = board.flat().filter(cell => cell === 'Empty').length;

    const endgameConfig: QuiescenceConfig = {
        ...DEFAULT_CONFIG,
        maxDepth: emptyCells < 10 ? 6 : 4,
        threatDepthBonus: 3,
        deltaMargin: 100,
        maxMovesToSearch: 8
    };

    return quiesce(board, alpha, beta, aiDisc, depth, endgameConfig);
}

/**
 * Get quiescence search statistics
 */
export function getQuiescenceStats(): QuiescenceStats {
    const stats = { ...globalStats };
    if (stats.totalNodes > 0) {
        stats.averageDepth = stats.maxDepth / Math.max(1, stats.totalNodes);
    }
    return stats;
}

/**
 * Reset quiescence search statistics
 */
export function resetQuiescenceStats(): void {
    globalStats = {
        totalNodes: 0,
        betaCutoffs: 0,
        deltaCutoffs: 0,
        futilityCutoffs: 0,
        depthCutoffs: 0,
        transpositionHits: 0,
        killerMoveHits: 0,
        averageDepth: 0,
        maxDepth: 0
    };
}

/**
 * Clear all quiescence search tables
 */
export function clearQuiescenceTables(): void {
    qTranspositionTable.clear();
    killerMoves.clear();
    resetQuiescenceStats();
}

/**
 * Age transposition table entries
 */
export function ageQuiescenceTable(): void {
    qTranspositionTable.ageEntries();
}

// Export configuration for customization
export { DEFAULT_CONFIG as QuiescenceDefaultConfig };