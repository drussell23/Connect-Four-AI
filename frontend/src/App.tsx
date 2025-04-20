// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Board from './components/Board';

// cell values
type CellValue = 'Empty' | 'Red' | 'Yellow';

// Point your client at the correct game namespace
const SERVER_URL = 'http://localhost:3000/game';

const App: React.FC = () => {
  // Use any for socket to sidestep Socket type conflicts.
  const [socket, setSocket] = useState<any>(null);
  const [gameId, setGameId] = useState<string>();
  const [board, setBoard] = useState<CellValue[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(7).fill('Empty'))
  );
  const [currentPlayer, setCurrentPlayer] = useState<'Red' | 'Yellow'>('Red');

  const humanDisc: CellValue = 'Red';
  const aiDisc: CellValue = 'Yellow'; // AI will play Yellow

  // initialize socket & create game
  useEffect(() => {
    const sock = io(SERVER_URL, { transports: ['websocket'] });

    // log when connected to the server
    sock.on('connect', () => console.log('✅ connected to game server', sock.id));

    // log incoming board updates (includes AI moves)
    sock.on('gameUpdate', ({ board: newBoard, nextPlayer }: any) => {
      console.log('⬅️ gameUpdate', newBoard, nextPlayer);
      setBoard(newBoard);
      // nextPlayer is the disc that will play next
      setCurrentPlayer(nextPlayer === humanDisc ? 'Red' : 'Yellow');
    });

    // create a new game as human player
    sock.emit(
      'createGame',
      { playerId: humanDisc },
      (res: { gameId: string }) => {
        console.log('➡️ createGame response', res.gameId);
        setGameId(res.gameId);
      }
    );

    setSocket(sock);
    return () => {
      sock.disconnect();
    };
  }, []);

  // ask server for AI move
  const handleAIMove = async () => {
    if (!socket || !gameId) return;
    const column: number = await new Promise(resolve => {
      socket.timeout(5000).emit(
        'getAIMove',
        { gameId, aiDisc },
        (err: any, res: { column: number }) => resolve(res.column)
      );
    });
    console.log('➡️ AI dropDisc at', column);
    socket.emit('dropDisc', {
      gameId,
      playerId: aiDisc,
      column,
    });
  };

  // when human clicks a column
  const handleDrop = (column: number) => {
    if (!socket || !gameId || currentPlayer !== humanDisc) return;
    console.log('➡️ human dropDisc at', column);
    socket.emit('dropDisc', { gameId, playerId: humanDisc, column });
    setTimeout(handleAIMove, 300);
  };

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center space-y-4">
      <h1 className="text-white text-2xl">Connect Four vs. AI</h1>
      <Board board={board} onDrop={handleDrop} />
      <div className="text-white">
        {currentPlayer === humanDisc
          ? 'Your turn (Red)'
          : 'AI is thinking (Yellow)…'}
      </div>
    </div>
  );
};

export default App;
