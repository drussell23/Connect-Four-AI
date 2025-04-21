// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Board from './components/Board';

// cell values
type CellValue = 'Empty' | 'Red' | 'Yellow';

const SERVER_URL = 'http://localhost:3001/game';

const App: React.FC = () => {
  // Derive the socket type from io()
  type ClientSocket = ReturnType<typeof io>;
  const [socket, setSocket] = useState<ClientSocket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [board, setBoard] = useState<CellValue[][]>(
    Array.from({ length: 6 }, () => Array(7).fill('Empty'))
  );
  const [currentPlayer, setCurrentPlayer] = useState<CellValue>('Red');
  const [status, setStatus] = useState<string>('Connecting…');

  useEffect(() => {
    const sock = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(sock);

    sock.on('connect', () => {
      console.log('🔗 connected, id=', sock.id);
      setStatus('Creating game…');
      sock.emit(
        'createGame',
        { playerId: 'Red' },
        (res: { gameId: string }) => {
          console.log('➡️ createGame →', res.gameId);
          setGameId(res.gameId);
          setStatus('Your turn (Red)');
        }
      );
    });

    sock.on('disconnect', () => {
      console.log('❌ disconnected');
      setStatus('Disconnected');
    });

    sock.on('aiThinking', () => {
      setStatus('AI is thinking (Yellow)…');
    });

    sock.on(
      'gameUpdate',
      (data: {
        board: CellValue[][];
        lastMove: { column: number; playerId: string };
        nextPlayer: CellValue;
        winner?: CellValue;
        draw?: boolean;
      }) => {
        const { board: newBoard, nextPlayer, winner, draw } = data;
        console.log('⬅️ gameUpdate', data);
        setBoard(newBoard);

        if (winner) {
          setStatus(`${winner} wins!`);
        } else if (draw) {
          setStatus('Draw game');
        } else if (nextPlayer === 'Red') {
          setStatus('Your turn (Red)');
        } else {
          setStatus('AI is thinking (Yellow)…');
        }

        setCurrentPlayer(nextPlayer);
      }
    );

    return () => {
      sock.disconnect();
    };
  }, []);

  // ① Define your click‐handler inside the component
  function onColumnClick(col: number) {
    if (!socket || !gameId || currentPlayer !== 'Red') return;
    console.log('➡️ human dropDisc at', col);
    setStatus('Waiting for AI…');
    socket.emit('dropDisc', { gameId, playerId: 'Red', column: col });
  }

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center p-4">
      <h1 className="text-white text-2xl mb-4">Connect Four vs. AI</h1>
      {/* ② Pass it into your Board */}
      <Board board={board} onDrop={onColumnClick} />
      <div className="mt-4 text-white">{status}</div>
    </div>
  );
};

export default App;
