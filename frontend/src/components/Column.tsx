import React from 'react';
import { Cell, CellValue } from './Cell';

export interface ColumnProps {
    /**
     * The index of this column (0-based).
     */
    colIndex: number;

    /**
     * Array of 6 values representing each row in this column.
     * Index 0 is the top row; index 5 is the bottom.
     */
    cells: CellValue[];

    /**
     * Handler invoked when the user clicks anywhere in this column.
     */
    onDrop: (column: number) => void;
}

/**
 * Renders a single column of the Connect Four board as a veritcal stack of Cells.
 */
export const Column: React.FC<ColumnProps> = ({ colIndex, cells, onDrop }) => {
    return (
      <div className="flex flex-col-reverse items-center space-y-1" onClick={() => onDrop(colIndex)}>
        {cells.map((cellValue, rowIndex) => (
          <Cell
            key={rowIndex}
            value={cellValue}
            onClick={() => onDrop(colIndex)}
          />
        ))}
      </div>
    );
  };