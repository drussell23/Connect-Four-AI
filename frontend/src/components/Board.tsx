import React from 'react';
import { Cell } from './Cell';

export interface BoardProps {
  /**
   * 2D array representing the game board.
   * Each cell is 'Empty', 'Red', or 'Yellow'.
   */
  board: ('Empty' | 'Red' | 'Yellow')[][];

  /**
   * Called when a column is clicked, passing the column index (0-6).
   */
  onDrop: (column: number) => void;
}

/**
 * Renders the Connect Four board using the Cell component.
 */
export const Board: React.FC<BoardProps> = ({ board, onDrop }) => {
  return (
    <div className="grid grid-rows-6 grid-cols-7 gap-2 p-4 bg-blue-900 rounded-lg">
      {board.map((row, rowIndex) =>
        row.map((cellValue, colIndex) => (
          <Cell
            key={`${rowIndex}-${colIndex}`}
            value={cellValue}
            onClick={() => onDrop(colIndex)}
          />
        )),
      )}
    </div>
  );
};
