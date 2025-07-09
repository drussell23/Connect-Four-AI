import React, { useState, useEffect, useRef } from 'react';

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
  gridTemplateRows: 'repeat(6, 80px)',
  gridTemplateColumns: 'repeat(7, 80px)',
  gap: '12px',
  background: '#1e2a47',
  padding: '16px',
  borderRadius: '8px',
};

// Individual slot style (ring)
const cellStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  border: '6px solid #26418f',
  background: '#1e2a47',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s ease, transform 0.2s ease',
  cursor: 'pointer',
};

// Disc style matching slot interior (60px - 2*4px border = 52px)
const discStyle = (color: 'red' | 'yellow'): React.CSSProperties => ({
  width: '68px',
  height: '68px',
  borderRadius: '50%',
  backgroundColor: color,
  pointerEvents: 'none',
});

/**
 * Board renders the 6×7 Connect Four grid and discs,
 * using local state synced from the `board` prop.
 */
const Board: React.FC<BoardProps> = ({ board, onDrop, winningLine = [] }) => {
  // Local state for the board, initialized from props
  const [localBoard, setLocalBoard] = useState<CellValue[][]>(
    board ?? Array.from({ length: 6 }, () => Array(7).fill('Empty'))
  );

  // Animate disc dropping when the board prop changes
  const prevBoardRef = useRef<CellValue[][]>(localBoard);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [bounceCoord, setBounceCoord] = useState<{ row: number; col: number } | null>(null);
  useEffect(() => {
    if (!board) return;
    const prevBoard = prevBoardRef.current;
    // Find the new disc position
    let newPos: { row: number; col: number; color: CellValue } | null = null;
    for (let r = 0; r < prevBoard.length; r++) {
      for (let c = 0; c < prevBoard[r].length; c++) {
        if (prevBoard[r][c] === 'Empty' && board[r][c] !== 'Empty') {
          newPos = { row: r, col: c, color: board[r][c] };
          break;
        }
      }
      if (newPos) break;
    }
    if (!newPos) {
      setLocalBoard(board);
      prevBoardRef.current = board;
      return;
    }
    const { row: targetRow, col, color } = newPos;
    // Generate intermediate frames for animation
    const frames: CellValue[][][] = [];
    for (let i = 0; i <= targetRow; i++) {
      const frame = prevBoard.map(rArr => rArr.slice());
      frame[i][col] = color;
      frames.push(frame);
    }
    // Apply frames with timeouts
    frames.forEach((frameBoard, idx) => {
      setTimeout(() => {
        setLocalBoard(frameBoard);
      }, idx * 100);
    });
    // After animation, set to final board state
    setTimeout(() => {
      prevBoardRef.current = board;
      setLocalBoard(board);
      // trigger disc bounce
      setBounceCoord({ row: targetRow, col });
      setTimeout(() => setBounceCoord(null), 400);
    }, (targetRow + 1) * 100);
  }, [board]);

  const displayBoard = localBoard;

  // helper to check if a cell is in the winning line
  const isWinningCell = (r: number, c: number) =>
    winningLine.some(([wr, wc]) => wr === r && wc === c);

  return (
    <div className="fade-in"
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
                  background: displayBoard[rowIndex][colIndex] === 'Empty' && hoveredCol === colIndex ? 'rgba(255,255,255,0.2)' : cellStyle.background,
                   transform: displayBoard[rowIndex][colIndex] === 'Empty' && hoveredCol === colIndex ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: highlight
                    ? '0 0 8px 4px rgba(6,214,160,0.7)'
                    : undefined,
                   animation: highlight ? 'glow 1s ease-in-out infinite alternate' : undefined,
                  cursor:
                    displayBoard[rowIndex][colIndex] === 'Empty'
                      ? 'pointer'
                      : 'default',
                }}
                onMouseEnter={() => setHoveredCol(colIndex)} onMouseLeave={() => setHoveredCol(null)} onClick={() => onDrop(colIndex)}
              >
                {cell !== 'Empty' && (
                  <div
                    style={{
                      ...discStyle(cell === 'Red' ? 'red' : 'yellow'),
                      animation: bounceCoord?.row === rowIndex && bounceCoord?.col === colIndex ? 'bounce 0.4s ease-out' : undefined,
                    }}
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
