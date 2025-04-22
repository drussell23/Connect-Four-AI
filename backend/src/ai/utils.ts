import { CellValue } from "./types";

/**
 * Returns an array of column indices (0–6) that are not full.
 */
export function legalMoves(board: CellValue[][]): number[] {
  const cols = board[0].length;
  return Array.from({ length: cols }, (_, c) => c).filter(
    c => board[0][c] === "Empty"
  );
}

/**
 * Drops a disc in the given column, returning the new board and the row index.
 * Does not modify the original board.
 */
export function tryDrop(
  board: CellValue[][],
  column: number,
  disc: CellValue
): { board: CellValue[][]; row: number } {
  const newBoard = board.map(row => [...row]);
  for (let r = newBoard.length - 1; r >= 0; r--) {
    if (newBoard[r][column] === "Empty") {
      newBoard[r][column] = disc;
      return { board: newBoard, row: r };
    }
  }
  throw new Error(`Column ${column} is full`);
}

/**
 * Checks if placing `disc` at (r,c) produces a connect-four.
 */
export function checkWin(
  board: CellValue[][],
  r: number,
  c: number,
  disc: CellValue
): boolean {
  const ROWS = board.length;
  const COLS = board[0].length;
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diag down-right
    [1, -1]  // diag down-left
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    // check forward and backward
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (
        rr >= 0 && rr < ROWS &&
        cc >= 0 && cc < COLS &&
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
