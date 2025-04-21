// Updated App.tsx: added early exit on AI win/draw in aiMove handler
// Based on your original App.tsx :contentReference[oaicite:0]{index=0}&#8203;:contentReference[oaicite:1]{index=1}
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Board from './components/Board';

// cell values
type CellValue = 'Empty' | 'Red' | 'Yellow';

const SERVER_URL = 'http://localhost:3001/game';

const App: React.FC = () => {
  type ClientSocket = ReturnType<typeof io>;
  const [socket, setSocket] = useState<ClientSocket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [board, setBoard] = useState<CellValue[][]>(
    Array.from({ length: 6 }, () => Array(7).fill('Empty'))
  );
  const [currentPlayer, setCurrentPlayer] = useState<CellValue>('Red');
  const [status, setStatus] = useState<string>('Connecting…');
  const [winningLine, setWinningLine] = useState<[number, number][]>([]);

  // Effect: establish connection & create game
  useEffect(() => {
    const sock = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(sock);

    sock.on('connect', () => {
      console.log('🔗 connected, id=', sock.id);
      setStatus('Creating game…');
      sock.emit('createGame', { playerId: 'Red' });
    });

    sock.on('disconnect', () => {
      console.log('❌ disconnected');
      setStatus('Disconnected');
    });

    sock.on('gameCreated', (data: { gameId: string; nextPlayer: CellValue }) => {
      console.log('⬅️ gameCreated', data);
      setGameId(data.gameId);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
      setWinningLine([]);
      if (data.nextPlayer === 'Red') {
        setStatus('Your turn (Red)');
        setCurrentPlayer('Red');
      } else {
        setStatus('AI is thinking (Yellow)…');
        setCurrentPlayer('Yellow');
      }
    });

    return () => {
      sock.off('connect');
      sock.off('disconnect');
      sock.off('gameCreated');
      sock.disconnect();
    };
  }, []);

  // Effect: listen for move events
  useEffect(() => {
    if (!socket) return;

    socket.on('playerMove', (data: {
      board: CellValue[][];
      lastMove: { column: number; playerId: string };
      nextPlayer: CellValue;
      winner?: CellValue;
      draw?: boolean;
      winningLine?: [number, number][];
    }) => {
      console.log('⬅️ playerMove', data);
      setBoard(data.board);
      setWinningLine(data.winningLine || []);

      // Early exit if player wins or draw. 
      if (data.winner) {
        setStatus(`${data.winner} wins!`);
        return;
      }

      if (data.draw) {
        setStatus('Draw game');
        return;
      }

      setStatus('AI is thinking (Yellow)…');
      setCurrentPlayer('Yellow');
    });

    socket.on('aiThinking', () => {
      setStatus('AI is thinking (Yellow)…');
    });

    socket.on('aiMove', (data: {
      board: CellValue[][];
      lastMove: { column: number; playerId: string };
      nextPlayer: CellValue;
      winner?: CellValue;
      draw?: boolean;
      winningLine?: [number, number][];
    }) => {
      console.log('⬅️ aiMove', data);
      setBoard(data.board);
      setWinningLine(data.winningLine || []);

      // If AI has won, show win and exit early
      if (data.winner) {
        setStatus(`${data.winner} wins!`);
        return;
      }

      // If it's a draw, show draw and exit early
      if (data.draw) {
        setStatus('Draw game');
        return;
      }

      // Otherwise, back to the human's turn
      setStatus('Your turn (Red)');
      setCurrentPlayer('Red');
    });

    return () => {
      socket.off('playerMove');
      socket.off('aiThinking');
      socket.off('aiMove');
    };
  }, [socket]);

  // Handler for when the human clicks a column
  function onColumnClick(col: number) {
    if (!socket || !gameId) return;
    if (status.endsWith('wins!') || status === 'Draw game') return;
    if (currentPlayer !== 'Red') return;

    console.log('➡️ human dropDisc at', col);
    setCurrentPlayer('Yellow');
    setStatus('AI is thinking (Yellow)…');

    socket.emit(
      'dropDisc',
      { gameId, playerId: 'Red', column: col },
      (res: { success: boolean; error?: string }) => {
        if (!res.success) {
          console.warn('dropDisc error:', res.error);
          setCurrentPlayer('Red');
          setStatus(res.error || 'Error occurred');
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center p-4">
      <h1 className="text-white text-2xl mb-4">Connect Four vs. AI</h1>
      <Board board={board} onDrop={onColumnClick} winningLine={winningLine} />
      <div className="mt-4 text-white">{status}</div>
    </div>
  );
};

export default App;
