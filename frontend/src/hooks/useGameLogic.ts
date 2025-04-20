import { useState, useCallback } from 'react';

// Types
export type Player = 'Red' | 'Yellow';
export type CellValue = 'Empty' | Player;

// Constants
const ROWS = 6;
const COLS = 7;

export interface GameState {
  board: CellValue[][];
  currentPlayer: Player;
  winner: Player | null;
  draw: boolean;
}

export interface UseGameLogicReturn extends GameState {
  dropDisc: (column: number) => boolean;
  reset: () => void;
}

/**
 * Custom hook to manage Connect Four game logic.
 */
export function useGameLogic(
  startingPlayer: Player = 'Red'
): UseGameLogicReturn {
  const createEmptyBoard = (): CellValue[][] =>
    Array.from({ length: ROWS }, () => Array(COLS).fill('Empty'));

  const [board, setBoard] = useState<CellValue[][]>(createEmptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(startingPlayer);
  const [winner, setWinner] = useState<Player | null>(null);
  const [draw, setDraw] = useState<boolean>(false);

  // Reset the game to initial state
  const reset = useCallback(() => {
    setBoard(createEmptyBoard);
    setCurrentPlayer(startingPlayer);
    setWinner(null);
    setDraw(false);
  }, [startingPlayer]);

  // Helper: check win sequence from a cell in a direction
  const isWinningSequence = (
    startRow: number,
    startCol: number,
    deltaRow: number,
    deltaCol: number,
    player: Player
  ): boolean => {
    let r = startRow;
    let c = startCol;
    for (let i = 0; i < 4; i++) {
      if (
        r < 0 || r >= ROWS ||
        c < 0 || c >= COLS ||
        board[r][c] !== player
      ) {
        return false;
      }
      r += deltaRow;
      c += deltaCol;
    }
    return true;
  };

  // Check if given player has a winning four-in-a-row
  const checkWin = useCallback((player: Player): boolean => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== player) continue;
        if (
          isWinningSequence(r, c, 0, 1, player) ||    // horizontal
          isWinningSequence(r, c, 1, 0, player) ||    // vertical
          isWinningSequence(r, c, 1, 1, player) ||    // diag down-right
          isWinningSequence(r, c, 1, -1, player)      // diag down-left
        ) {
          return true;
        }
      }
    }
    return false;
  }, [board]);

  // Check if the board is full (draw)
  const checkDraw = useCallback((): boolean => {
    return board[0].every(cell => cell !== 'Empty');
  }, [board]);

  // Attempt to drop a disc into the column
  const dropDisc = useCallback((column: number): boolean => {
    if (winner || draw || column < 0 || column >= COLS) {
      return false;
    }
    // Find lowest empty row
    const newBoard = board.map(row => [...row]);
    let placedRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (newBoard[r][column] === 'Empty') {
        newBoard[r][column] = currentPlayer;
        placedRow = r;
        break;
      }
    }
    if (placedRow === -1) {
      return false; // column full
    }

    setBoard(newBoard);

    // Check for win
    if (checkWin(currentPlayer)) {
      setWinner(currentPlayer);
      return true;
    }

    // Check for draw
    if (checkDraw()) {
      setDraw(true);
      return true;
    }

    // Switch player
    setCurrentPlayer(prev => (prev === 'Red' ? 'Yellow' : 'Red'));
    return true;
  }, [board, currentPlayer, winner, draw, checkWin, checkDraw]);

  return {
    board,
    currentPlayer,
    winner,
    draw,
    dropDisc,
    reset,
  };
}
