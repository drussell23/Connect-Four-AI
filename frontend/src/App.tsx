// src/App.tsx
import React, { useEffect, useState } from 'react';
import Board from './components/Board';
import apiSocket from './api/socket';

// cell values
type CellValue = 'Empty' | 'Red' | 'Yellow';

const App: React.FC = () => {
  // Use the same socket you configure in src/api/socket.ts
  type ClientSocket = typeof apiSocket;
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
    // hook up our singleton socket
    setSocket(apiSocket);

    apiSocket.on('connect', () => {
      console.log('🔗 connected, id=', apiSocket.id);
      setStatus('Creating game…');
      apiSocket.emit(
        'createGame',
        { playerId: 'Red' },
        (res: {
          success: boolean;
          error?: string;
          gameId?: string;
          nextPlayer?: CellValue;
        }) => {
          if (!res.success) {
            console.error('createGame failed:', res.error);
            setStatus(res.error || 'Failed to create game');
            return;
          }
          if (res.gameId && res.nextPlayer) {
            setGameId(res.gameId);
            setCurrentPlayer(res.nextPlayer);
            setStatus(
              res.nextPlayer === 'Red'
                ? 'Your turn (Red)'
                : 'AI is thinking (Yellow)…'
            );
          }
        }
      );
    });

    apiSocket.on('disconnect', () => {
      console.log('❌ disconnected');
      setStatus('Disconnected');
    });

    apiSocket.on(
      'gameCreated',
      (data: { gameId: string; nextPlayer: CellValue }) => {
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
      }
    );

    return () => {
      apiSocket.off('connect');
      apiSocket.off('disconnect');
      apiSocket.off('gameCreated');
      // note: we do NOT call apiSocket.disconnect() here, so the same socket
      // stays alive if you remount App or navigate around
    };
  }, []);

  // Effect: listen for move events
  useEffect(() => {
    if (!socket) return;

    socket.on(
      'playerMove',
      (data: {
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
      }
    );

    socket.on('aiThinking', () => {
      setStatus('AI is thinking (Yellow)…');
    });

    socket.on(
      'aiMove',
      (data: {
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
      }
    );

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
          // Reset to your turn if it failed.
          setCurrentPlayer('Red');
          setStatus(res.error || 'Error occurred');
        }
      }
    );
  }

  // Play Again button handler
  const handlePlayAgain = () => {
    if (!socket) return;
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setStatus('Creating game…');
    socket.emit('createGame', { playerId: 'Red' });
  };

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center p-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {status.endsWith('wins!') && (
  <div className="fixed top-0 left-0 w-full flex justify-center z-50">
    <div className="slide-down pulse bg-black bg-opacity-75 text-white font-bold text-3xl py-4 px-8 rounded-b-lg">
      {status.startsWith('Red') ? 'You Win!' : 'AI Wins!'}
    </div>
  </div>
)}
<h1 className="text-white text-2xl mb-4">Connect Four vs. AI</h1>
      <Board board={board} onDrop={onColumnClick} winningLine={winningLine} />
      <div className="mt-4">
        <span className="bg-white bg-opacity-20 text-white font-semibold rounded-full px-4 py-2 fade-text">{status}</span>
      </div>
      {(status.endsWith('wins!') || status === 'Draw game') && (
        <button
          onClick={handlePlayAgain}
          className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded px-4 py-2 transition transform duration-200 ease-in-out hover:scale-105 fade-in"
        >
          Play Again
        </button>
      )}
    </div>
  );
};

export default App;
