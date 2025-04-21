// frontend/src/components/Board.tsx
import React from 'react';

export type CellValue = 'Empty' | 'Red' | 'Yellow';

interface BoardProps {
  /** 6×7 matrix; if undefined we fall back to an empty grid */
  board?: CellValue[][];
  /** Called with the column index when a slot is clicked */
  onDrop: (column: number) => void;
}

// default to an empty board so we never hit undefined
const defaultBoard: CellValue[][] = Array.from(
  { length: 6 },
  () => Array(7).fill('Empty')
);

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'repeat(6, 60px)',
  gridTemplateColumns: 'repeat(7, 60px)',
  gap: '8px',
  background: '#1e2a47',
  padding: '12px',
  borderRadius: '8px',
};

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

const discStyle = (color: 'red' | 'yellow'): React.CSSProperties => ({
  width: '50px',
  height: '50px',
  borderRadius: '50%',
  backgroundColor: color,
  pointerEvents: 'none',  // ← let clicks pass straight through
});

const Board: React.FC<BoardProps> = ({ board = defaultBoard, onDrop }) => {
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
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              role="button"         // accessibility
              tabIndex={0}
              style={cellStyle}
              onClick={() => onDrop(colIndex)}
              onKeyPress={e => {
                if (e.key === 'Enter') onDrop(colIndex);
              }}
            >
              {cell !== 'Empty' && (
                <div
                  style={discStyle(cell === 'Red' ? 'red' : 'yellow')}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Board;
