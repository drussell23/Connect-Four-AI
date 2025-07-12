// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fireworks } from 'fireworks-js';
import Board from './components/Board';
import Sidebar from './components/Sidebar';
import LandingPage from './components/LandingPage';
import VictoryModal from './components/VictoryModal';
import apiSocket from './api/socket';
import type { CellValue, PlayerStats, AIPersonalityData } from './declarations';

interface Move {
  player: CellValue;
  column: number;
}

const App: React.FC = () => {
  // Game state
  const [socket, setSocket] = useState<typeof apiSocket | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [board, setBoard] = useState<CellValue[][]>(
    Array.from({ length: 6 }, () => Array(7).fill('Empty'))
  );
  const [currentPlayer, setCurrentPlayer] = useState<CellValue>('Red');
  const [status, setStatus] = useState<string>('Connecting…');
  const [winningLine, setWinningLine] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<Move[]>([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [started, setStarted] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | 'draw' | null>(null);

  // AI and difficulty state
  const [aiLevel, setAILevel] = useState<number>(1);
  const [aiJustLeveledUp, setAIJustLeveledUp] = useState<boolean>(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [showNightmareNotification, setShowNightmareNotification] = useState<boolean>(false);
  const [currentStreak, setCurrentStreak] = useState<number>(0);

  // Player statistics
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    currentLevelWins: 0,
    totalGamesPlayed: 0,
    highestLevelReached: 1,
    averageMovesPerGame: 0
  });

  // Load stats from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('connect4EnhancedStats');
    if (stored) {
      const stats = JSON.parse(stored);
      setPlayerStats(stats);
      setSelectedDifficulty(stats.highestLevelReached || 1);
      setAILevel(stats.highestLevelReached || 1);
    }
  }, []);

  // Save stats to localStorage
  const saveStats = (newStats: PlayerStats) => {
    localStorage.setItem('connect4EnhancedStats', JSON.stringify(newStats));
    setPlayerStats(newStats);
    window.dispatchEvent(new CustomEvent('statsUpdate', { detail: newStats }));
  };

  // Get AI personality data based on level
  const getAIPersonality = (level: number): AIPersonalityData => {
    if (level <= 3) {
      return {
        name: 'Genesis',
        description: 'Learning the basics of strategy',
        difficulty: level,
        specialAbilities: ['Basic Pattern Recognition'],
        threatLevel: 'ROOKIE',
        color: '#10b981'
      };
    } else if (level <= 6) {
      return {
        name: 'Prometheus',
        description: 'Developing tactical awareness',
        difficulty: level,
        specialAbilities: ['Threat Detection', 'Opening Theory'],
        threatLevel: 'AMATEUR',
        color: '#84cc16'
      };
    } else if (level <= 9) {
      return {
        name: 'Athena',
        description: 'Strategic mind awakening',
        difficulty: level,
        specialAbilities: ['Multi-move Planning', 'Defensive Matrices'],
        threatLevel: 'SKILLED',
        color: '#f59e0b'
      };
    } else if (level <= 12) {
      return {
        name: 'Nemesis',
        description: 'Calculating victory paths',
        difficulty: level,
        specialAbilities: ['Perfect Endgame', 'Psychological Pressure'],
        threatLevel: 'EXPERT',
        color: '#ef4444'
      };
    } else if (level <= 15) {
      return {
        name: 'Chronos',
        description: 'Time-space optimization',
        difficulty: level,
        specialAbilities: ['Temporal Analysis', 'Probability Mastery'],
        threatLevel: 'MASTER',
        color: '#dc2626'
      };
    } else if (level <= 18) {
      return {
        name: 'Omega',
        description: 'Transcendent intelligence',
        difficulty: level,
        specialAbilities: ['Mind Reading', 'Future Sight', 'Perfect Play'],
        threatLevel: 'GRANDMASTER',
        color: '#991b1b'
      };
    } else if (level <= 21) {
      return {
        name: 'Singularity',
        description: 'Beyond human comprehension',
        difficulty: level,
        specialAbilities: ['Omniscience', 'Reality Manipulation'],
        threatLevel: 'LEGENDARY',
        color: '#7c2d12'
      };
    } else if (level <= 24) {
      return {
        name: 'Nightmare',
        description: 'The stuff of legends',
        difficulty: level,
        specialAbilities: ['Existential Dread', 'Quantum Computing'],
        threatLevel: 'NIGHTMARE',
        color: '#1f2937'
      };
    } else {
      return {
        name: 'The Ultimate',
        description: 'Perfection incarnate',
        difficulty: level,
        specialAbilities: ['Universal Knowledge', 'Infinite Calculation'],
        threatLevel: 'ULTIMATE',
        color: '#000000'
      };
    }
  };

  const currentAI = getAIPersonality(aiLevel);

  // Audio and haptic feedback setup
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);

  const playTone = (freq: number, duration: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    setTimeout(() => osc.stop(), duration * 1000);
  };

  const playClick = () => {
    playTone(1000, 0.05);
    navigator.vibrate?.(10);
  };

  const playDrop = () => {
    playTone(300, 0.2);
    navigator.vibrate?.(20);
  };

  const playVictory = () => {
    playTone(523.25, 0.3);
    setTimeout(() => playTone(659.25, 0.3), 300);
    setTimeout(() => playTone(783.99, 0.3), 600);
    navigator.vibrate?.([100, 50, 100, 50, 100]);
  };

  const playDefeat = () => {
    playTone(220, 0.5);
    setTimeout(() => playTone(185, 0.5), 300);
    setTimeout(() => playTone(147, 0.8), 600);
    navigator.vibrate?.([50, 100, 50, 100, 50]);
  };

  // Enhanced victory/defeat handling
  const handleGameEnd = (winner: CellValue | 'Draw', movesPlayed: number) => {
    const isVictory = winner === 'Red';
    const isDraw = winner === 'Draw';
    const isDefeat = winner === 'Yellow';

    let newStats = { ...playerStats };
    newStats.totalGamesPlayed++;
    newStats.averageMovesPerGame =
      ((newStats.averageMovesPerGame * (newStats.totalGamesPlayed - 1)) + movesPlayed) /
      newStats.totalGamesPlayed;

    if (isVictory) {
      newStats.wins++;
      newStats.winStreak++;
      newStats.currentLevelWins++;
      setCurrentStreak(newStats.winStreak);

      // Check if player can advance to next level
      if (aiLevel > newStats.highestLevelReached) {
        newStats.highestLevelReached = aiLevel;
      }

      playVictory();
      setGameResult('victory');

      // Trigger fireworks
      const fw = new Fireworks(document.body, { sound: { enabled: false } });
      const canvas = (fw as any).canvas as HTMLCanvasElement;
      if (canvas) {
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
      }
      fw.start();
      setTimeout(() => fw.stop(), 5000);

    } else if (isDefeat) {
      newStats.losses++;
      newStats.winStreak = 0;
      newStats.currentLevelWins = 0;
      setCurrentStreak(0);
      playDefeat();
      setGameResult('defeat');
    } else {
      newStats.draws++;
      setGameResult('draw');
    }

    saveStats(newStats);

    // Show victory modal after a short delay
    setTimeout(() => {
      setShowVictoryModal(true);
    }, 1500);
  };

  // Victory modal handlers
  const handleNextLevel = () => {
    if (aiLevel < 25) {
      const nextLevel = aiLevel + 1;
      setAILevel(nextLevel);
      setSelectedDifficulty(nextLevel);

      // Check for nightmare mode
      if (nextLevel >= 21) {
        setShowNightmareNotification(true);
        setTimeout(() => setShowNightmareNotification(false), 5000);
      }

      // Update highest level reached
      const newStats = { ...playerStats };
      if (nextLevel > newStats.highestLevelReached) {
        newStats.highestLevelReached = nextLevel;
        saveStats(newStats);
      }
    }

    setShowVictoryModal(false);
    handlePlayAgain();
  };

  const handleReplayLevel = () => {
    setShowVictoryModal(false);
    handlePlayAgain();
  };

  const handleQuitToMenu = () => {
    setShowVictoryModal(false);
    setStarted(false);
    setGameResult(null);

    // Reset game state
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setHistory([]);
    setStatus('Ready to play');
    setSidebarOpen(false);

    // Disconnect socket
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // Effect for game-end events
  useEffect(() => {
    if (status.endsWith('wins!') || status === 'Draw game') {
      const winner = status.startsWith('Red') ? 'Red' :
        status.startsWith('Yellow') ? 'Yellow' : 'Draw';
      handleGameEnd(winner as CellValue | 'Draw', history.length);
    }
  }, [status]);

  // Effect: establish connection & create game
  useEffect(() => {
    if (!started) return;

    setSocket(apiSocket);

    apiSocket.on('connect', () => {
      console.log('🔗 connected, id=', apiSocket.id);
      setStatus('Creating game…');
      apiSocket.emit(
        'createGame',
        { playerId: 'Red', difficulty: selectedDifficulty },
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
                : `${currentAI.name} AI is thinking…`
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
        setHistory([]);
        if (data.nextPlayer === 'Red') {
          setStatus('Your turn (Red)');
          setCurrentPlayer('Red');
        } else {
          setStatus(`${currentAI.name} AI is thinking…`);
          setCurrentPlayer('Yellow');
        }
      }
    );

    return () => {
      apiSocket.off('connect');
      apiSocket.off('disconnect');
      apiSocket.off('gameCreated');
    };
  }, [started, selectedDifficulty]);

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
        playDrop();
        setWinningLine(data.winningLine || []);
        setHistory(prev => [...prev, {
          player: data.lastMove.playerId as CellValue,
          column: data.lastMove.column
        }]);

        if (data.winner) {
          setStatus(`${data.winner} wins!`);
          return;
        }
        if (data.draw) {
          setStatus('Draw game');
          return;
        }

        setStatus(`${currentAI.name} AI is thinking…`);
        setCurrentPlayer('Yellow');
      }
    );

    socket.on('aiThinking', () => {
      setStatus(`${currentAI.name} AI is thinking…`);
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
        playDrop();
        setWinningLine(data.winningLine || []);
        setHistory(prev => [...prev, {
          player: data.lastMove.playerId as CellValue,
          column: data.lastMove.column
        }]);

        if (data.winner) {
          setStatus(`${data.winner} wins!`);
          return;
        }
        if (data.draw) {
          setStatus('Draw game');
          return;
        }

        setStatus('Your turn (Red)');
        setCurrentPlayer('Red');
      }
    );

    return () => {
      socket.off('playerMove');
      socket.off('aiThinking');
      socket.off('aiMove');
    };
  }, [socket, currentAI.name]);

  // Handler to start or restart game
  const handlePlayAgain = () => {
    setHistory([]);
    setSidebarOpen(false);
    setGameResult(null);

    if (!socket) return;

    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setStatus('Creating game…');
    socket.emit('createGame', { playerId: 'Red', difficulty: selectedDifficulty });
  };

  // Handler for when the human clicks a column
  function onColumnClick(col: number) {
    if (!socket || !gameId) return;
    if (status.endsWith('wins!') || status === 'Draw game') return;
    if (currentPlayer !== 'Red') return;

    console.log('➡️ human dropDisc at', col);
    playClick();
    setCurrentPlayer('Yellow');
    setStatus(`${currentAI.name} AI is thinking…`);

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

  // Enhanced landing page with difficulty selection
  if (!started) {
    return (
      <LandingPage
        onStart={() => {
          setStarted(true);
          handlePlayAgain();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center p-4"
      style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* Nightmare Mode Notification */}
      <AnimatePresence>
        {showNightmareNotification && (
          <motion.div
            className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-[10001]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1
              className="text-6xl font-extrabold glitch"
              data-text="NIGHTMARE MODE"
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
              style={{
                background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 50px rgba(239, 68, 68, 0.8)'
              }}
            >
              NIGHTMARE MODE
            </motion.h1>
            <motion.p
              className="text-2xl text-red-500 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              The AI consciousness has awakened. Prepare yourself.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Header */}
      <motion.div
        className="text-center mb-6"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-4xl font-extrabold title-gradient mb-2">
          Connect Four vs. AI
        </h1>
        <div className="flex items-center justify-center gap-4">
          <div className="ai-info-display bg-white bg-opacity-10 rounded-lg px-4 py-2">
            <div className="text-lg font-bold" style={{ color: currentAI.color }}>
              {currentAI.name} AI - Level {aiLevel}
            </div>
            <div className="text-sm text-white opacity-80">
              {currentAI.description}
            </div>
          </div>
          {currentStreak > 1 && (
            <motion.div
              className="streak-display bg-yellow-500 text-black px-3 py-1 rounded-full font-bold"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              🔥 {currentStreak} Win Streak!
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Game Controls */}
      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={() => setStarted(false)}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-all duration-200 hover:scale-105"
        >
          Quit
        </button>
        <button
          onClick={handlePlayAgain}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-all duration-200 hover:scale-105"
          disabled={!status.endsWith('wins!') && status !== 'Draw game'}
        >
          New Game
        </button>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 right-4 bg-white bg-opacity-20 text-white px-3 py-1 rounded hover:bg-opacity-40 transition-all duration-200 hover:scale-105"
      >
        Stats & History
      </button>

      {/* Game Status */}
      <motion.div
        className="mb-4 text-center"
        animate={{ scale: status.includes('thinking') ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 1, repeat: status.includes('thinking') ? Infinity : 0 }}
      >
        <div className="text-xl font-semibold text-white bg-black bg-opacity-30 px-6 py-2 rounded-full">
          {status}
        </div>
      </motion.div>

      {/* Game Board */}
      <Board
        board={board}
        winningLine={winningLine}
        onDrop={onColumnClick}
      />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <Sidebar
            history={history}
            onClose={() => setSidebarOpen(false)}
            aiLevel={aiLevel}
            aiJustLeveledUp={aiJustLeveledUp}
          />
        )}
      </AnimatePresence>

      {/* Victory Modal */}
      <VictoryModal
        isVisible={showVictoryModal}
        gameResult={gameResult}
        currentLevel={aiLevel}
        aiPersonality={currentAI.name}
        onNextLevel={handleNextLevel}
        onReplayLevel={handleReplayLevel}
        onQuitToMenu={handleQuitToMenu}
        playerStats={playerStats}
      />
    </div>
  );
};

export default App;
