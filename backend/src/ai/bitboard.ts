import { CellValue } from "./types";

/**
 * Converts a 6x7 CellValue board into two bitboards (one for Red, one for Yellow).
 * Each bit position corresponds to row*7 + col (0-41).
 */
export function boardToBitboards(board: CellValue[][]): { red: bigint; yellow: bigint } {
    let red = 0n;
    let yellow = 0n;
    const COLS = BigInt(board[0].length);

    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const idx = BigInt(r) * COLS + BigInt(c);

            if (board[r][c] === "Red") {
                red |= 1n << idx;
            } else if (board[r][c] === "Yellow") {
                yellow |= 1n << idx;
            }
        }
    }
    return { red, yellow };
}

/**
 * Checks a single-color bitboard for any Connect-4 (four in a row). 
 */
export function bitboardCheckWin(bb: bigint): boolean {
    // Horizontal (shift by 1)
    let m = bb & (bb >> 1n);

    if ((m & (m >> 2n)) !== 0n)
        return true;

    // Vertical (shift by 7)
    m = bb & (bb >> 7n);

    if ((m & (m >> (2n * 7n))) !== 0n)
        return true;

    // Diagonal down-right (shift by 8)
    m = bb & (bb >> 8n);

    if ((m & (m >> (2n * 8n))) !== 0n)
        return true;

    // Diagonal down-left (shift by 6)
    m = bb & (bb >> 6n);

    if ((m & (m >> (2n * 6n))) !== 0n)
        return true;

    return false;
}