import React from 'react';

/**
 * Represents the value of a single board cell.
 */
export type CellValue = 'Empty' | 'Red' | 'Yellow';

export interface CellProps {
    /**
     * The current value of the cell.
     */
    value: CellValue;

    /**
     * Click handler for when the cell is clicked.
     * Typically used to drop a disc in this cell's column. 
     */
    onClick: () => void;
}

/**
 * Displays a single Connect Four cell with optional disc.
 */
export const Cell: React.FC<CellProps> = ({ value, onClick }) => {
    return (
      <div
        className="relative w-12 h-12 flex items-center justify-center cursor-pointer"
        onClick={onClick}
      >
        {/* Base slot background */}
        <div className="w-full h-full bg-blue-500 rounded-full" />
  
        {/* Disc overlay if not empty */}
        {value !== 'Empty' && (
          <div
            className={`absolute w-10 h-10 rounded-full
              ${value === 'Red' ? 'bg-red-500' : 'bg-yellow-500'}`}
          />
        )}
      </div>
    );
  };  