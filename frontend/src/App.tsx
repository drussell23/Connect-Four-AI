import React, { useState } from 'react';
import { Board } from './components/Board';

// Define the type for cell values
type CellValue = 'Empty' | 'Red' | 'Yellow';

const App: React.FC = () => {
  // Initialize empty board
  const emptyBoard: CellValue[][] = Array(6)
    .fill(null)
    .map(() => Array(7).fill('Empty'));

  const [board, setBoard] = useState<CellValue[][]>(emptyBoard);

  const handleDrop = (column: number) => {
    setBoard(prev => {
      const newBoard = prev.map(row => [...row]);
      for (let r = newBoard.length - 1; r >= 0; r--) {
        if (newBoard[r][column] === 'Empty') {
          newBoard[r][column] = 'Red'; // TODO: alternate players
          break;
        }
      }
      return newBoard;
    });
  };

  return (
    <div className="min-h-screen bg-blue-800 flex items-center justify-center">
      <Board board={board} onDrop={handleDrop} />
    </div>
  );
};

export default App;
