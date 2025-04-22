import { CellValue } from "./types";

/**
 * Flags for stored transposition entries indicating how the score should be interpreted. 
 */
export enum EntryFlag {
    Exact,
    LowerBound,
    UpperBound
}

/**
 * A cached search result in the transposition table. 
 *  - score: The evaluated score or bound
 *  - depth: The search depth at which this was stored
 *  - column: The best move (column) found at that depth, or null
 *  - flag: How to interpret the score (Exact, LowerBound, UpperBound)
 */
export interface TranspositionEntry {
    score: number;
    depth: number;
    column: number | null;
    flag: EntryFlag;
}

// The global transposition table mapping Zobrist hashes to cached entries.
export const transposition = new Map<bigint, TranspositionEntry>();

// Board dimensions (6 rows x 7 columns)
const ROWS = 6;
const COLS = 7;

/**
 * Zobrist table: random BigInt keys for each [row][col][state].
 * state = 0 (Empty), 1 (Red), 2 (Yellow)
 */
const ZOBRIST_TABLE: bigint[][][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () =>
        Array.from({ length: 3 }, () => BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)))
    )
);

/**
 * Computes a Zobrist hash for the given board state.
 * @param board A 6x7 matrix of CellValue
 * @returns A BigInt hash unique to this configuration
 */
export function hashBoard(board: CellValue[][]): bigint {
    let h = 0n;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // Map CellValue to index: Empty = 0, Red = 1, Yellow = 2
            const stateIndex = board[r][c] == 'Red' ? 1 : board[r][c] === 'Yellow' ? 2 : 0;
            h ^= ZOBRIST_TABLE[r][c][stateIndex];
        }
    }
    return h;
}