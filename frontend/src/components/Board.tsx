import React, { useRef, useEffect } from 'react';

export type CellValue = 'Empty' | 'Red' | 'Yellow';

interface BoardProps {
  /** 6×7 matrix representing the current board state */
  board?: CellValue[][];
  /** Called with the column index when a slot is clicked */
  onDrop: (column: number) => void;
  /** Optional list of [row, col] pairs to highlight the winning line */
  winningLine?: [number, number][];
}

// Grid container style
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'repeat(6, 60px)',
  gridTemplateColumns: 'repeat(7, 60px)',
  gap: '8px',
  background: '#1e2a47',
  padding: '12px',
  borderRadius: '8px',
};

// Individual slot style (ring)
const cellStyle: React.CSSProperties = {
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  border: '4px solid #26418f',
  background: '#1e2a47',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

// Disc style matching slot interior (60px - 2*4px border = 52px)
const discStyle = (color: 'red' | 'yellow'): React.CSSProperties => ({
  width: '52px',
  height: '52px',
  borderRadius: '50%',
  backgroundColor: color,
  pointerEvents: 'none',
});

/**
 * Board renders the 6×7 Connect Four grid and discs,
 * always reflecting the last passed-in board state,
 * even when `board` prop temporarily becomes undefined.
 */
const Board: React.FC<BoardProps> = ({ board, onDrop, winningLine = [] }) => {
  // Persist the last known board in a ref
  const lastBoardRef = useRef<CellValue[][]>(board || []);
  useEffect(() => {
    if (board) lastBoardRef.current = board;
  }, [board]);

  const displayBoard = lastBoardRef.current;

  // helper to check if a cell is in the winning line
  const isWinningCell = (r: number, c: number) =>
    winningLine.some(([wr, wc]) => wr === r && wc === c);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: '2rem',
      }}
    >
      <div style={gridStyle}>
        {displayBoard.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const highlight = isWinningCell(rowIndex, colIndex);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{
                  ...cellStyle,
                  border: highlight ? '4px solid #06d6a0' : cellStyle.border,
                  boxShadow: highlight
                    ? '0 0 8px 4px rgba(6,214,160,0.7)'
                    : undefined,
                  cursor: displayBoard[rowIndex][colIndex] === 'Empty' ? 'pointer' : 'default',
                }}
                onClick={() => onDrop(colIndex)}
              >
                {cell !== 'Empty' && (
                  <div
                    style={discStyle(cell === 'Red' ? 'red' : 'yellow')}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Board;