// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fireworks } from 'fireworks-js';
import Board from './components/Board';
import Sidebar from './components/Sidebar';
import LandingPage from './components/LandingPage';
import VictoryModal from './components/VictoryModal';
import LoadingProgress from './components/LoadingProgress';
import RockPaperScissors, { type RPSResult } from './components/RockPaperScissors';
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
  const [status, setStatus] = useState<string>('Ready to play');
  const [winningLine, setWinningLine] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<Move[]>([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [started, setStarted] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | 'draw' | null>(null);
  const [showLoadingProgress, setShowLoadingProgress] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Rock Paper Scissors state
  const [showRPS, setShowRPS] = useState<boolean>(false);
  const [rpsResult, setRpsResult] = useState<RPSResult | null>(null);
  const [startingPlayer, setStartingPlayer] = useState<CellValue>('Red'); // Who goes first
  const [rpsDifficulty, setRpsDifficulty] = useState<number>(1); // Difficulty for the RPS game

  // AI and difficulty state
  const [aiLevel, setAILevel] = useState<number>(1);
  const [aiJustLeveledUp, setAIJustLeveledUp] = useState<boolean>(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [showNightmareNotification, setShowNightmareNotification] = useState<boolean>(false);
  const [currentStreak, setCurrentStreak] = useState<number>(0);

  // Enhanced AI state
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [aiSafetyScore, setAiSafetyScore] = useState<number>(1.0);
  const [aiThinkingTime, setAiThinkingTime] = useState<number>(0);
  const [showAiInsights, setShowAiInsights] = useState<boolean>(false);
  const [gameMetrics, setGameMetrics] = useState<any>({
    totalThinkingTime: 0,
    averageConfidence: 0,
    safetyScore: 1.0,
    adaptationScore: 0.5,
    explainabilityScore: 0.8
  });
  const [playerProgress, setPlayerProgress] = useState<any>(null);
  const [aiAdaptationInfo, setAiAdaptationInfo] = useState<any>(null);
  const [curriculumInfo, setCurriculumInfo] = useState<any>(null);
  const [debateResult, setDebateResult] = useState<any>(null);
  const [enhancedAiEnabled, setEnhancedAiEnabled] = useState<boolean>(true);

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

  // Rock Paper Scissors handlers
  const handleRPSComplete = (winner: RPSResult) => {
    setRpsResult(winner);
    setShowRPS(false);

    // Determine starting player based on RPS result
    let firstPlayer: CellValue = 'Red'; // Default to player
    if (winner === 'ai') {
      firstPlayer = 'Yellow'; // AI goes first
    } else {
      firstPlayer = 'Red'; // Player goes first (for 'player' win or 'tie')
    }

    setStartingPlayer(firstPlayer);

    // Create the game with the determined starting player using stored difficulty
    createGameWithStartingPlayer(firstPlayer, rpsDifficulty);
  };

  const createGameWithStartingPlayer = (firstPlayer: CellValue, difficulty?: number) => {
    if (!socket) {
      console.error('No socket connection');
      return;
    }

    const gameDifficulty = difficulty || selectedDifficulty;
    // Instead of showing "Creating game...", immediately set the game state
    setCurrentPlayer(firstPlayer);
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setHistory([]);

    // Set the appropriate status based on who goes first
    const currentAI = getAIPersonality(gameDifficulty);
    setStatus(
      firstPlayer === 'Red'
        ? 'Your turn (Red)'
        : `${currentAI.name} AI is thinking…`
    );

    socket.emit(
      'createGame',
      {
        playerId: 'Red',
        difficulty: gameDifficulty,
        startingPlayer: firstPlayer
      },
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
          // Game state is already set above, so we just confirm the gameId
          console.log('✅ Game ready with starting player:', firstPlayer, res.gameId, res.nextPlayer);
        }
      }
    );
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

    // Reset game state first
    setGameResult(null);
    setHistory([]);
    setSidebarOpen(false);

    // Determine starting player based on previous game result
    // If player won previous level, they go first in next level
    // If player lost, AI goes first
    const previousGameResult = gameResult;
    let nextStartingPlayer: CellValue;

    if (previousGameResult === 'victory') {
      nextStartingPlayer = 'Red'; // Player won, so they go first
    } else if (previousGameResult === 'defeat') {
      nextStartingPlayer = 'Yellow'; // Player lost, so AI goes first
    } else {
      // For draws or first game, use RPS
      setRpsDifficulty(aiLevel + 1); // Next level difficulty
      setShowRPS(true);
      return;
    }

    setStartingPlayer(nextStartingPlayer);

    // Create new game directly with determined starting player
    if (socket) {
      const currentAI = getAIPersonality(aiLevel + 1);

      // Set game state immediately - no "Creating new game..." delay
      setCurrentPlayer(nextStartingPlayer);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
      setWinningLine([]);
      setHistory([]);
      setStatus(
        nextStartingPlayer === 'Red'
          ? 'Your turn (Red)'
          : `${currentAI.name} AI is thinking…`
      );

      socket.emit(
        'createGame',
        {
          playerId: 'Red',
          difficulty: aiLevel + 1,
          startingPlayer: nextStartingPlayer
        },
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
            // Game state is already set above, just confirm the gameId
            console.log('✅ Next level game ready:', res.gameId, res.nextPlayer);
          }
        }
      );
    } else {
      // Fallback to full initialization if no socket
      handlePlayAgain();
    }
  };

  const handleReplayLevel = () => {
    setShowVictoryModal(false);

    // Reset game state first
    setGameResult(null);
    setHistory([]);
    setSidebarOpen(false);

    // For replay, always use RPS to determine who goes first
    setRpsDifficulty(aiLevel); // Current level difficulty
    setShowRPS(true);
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

    // Reset difficulty level back to 1 when quitting
    setAILevel(1);
    setSelectedDifficulty(1);
    setCurrentStreak(0);

    // Reset RPS state
    setShowRPS(false);
    setRpsResult(null);
    setRpsDifficulty(1);
    setStartingPlayer('Red');

    // Reset player statistics back to initial values
    const initialStats: PlayerStats = {
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      currentLevelWins: 0,
      totalGamesPlayed: 0,
      highestLevelReached: 1,
      averageMovesPerGame: 0
    };
    saveStats(initialStats);

    // Clear localStorage difficulty selection
    localStorage.removeItem('selectedDifficulty');

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

  // Handler for when loading progress completes
  const handleLoadingComplete = () => {
    setShowLoadingProgress(false);
    setIsInitializing(false);

    // Set the appropriate game status after loading completes
    if (gameId && currentPlayer) {
      setStatus(
        currentPlayer === 'Red'
          ? 'Your turn (Red)'
          : `${currentAI.name} AI is thinking…`
      );
    } else {
      // If gameId isn't set yet, wait a bit more
      setTimeout(() => {
        if (gameId && currentPlayer) {
          setStatus(
            currentPlayer === 'Red'
              ? 'Your turn (Red)'
              : `${currentAI.name} AI is thinking…`
          );
        } else {
          setStatus('Connection ready - click to start');
        }
      }, 1000);
    }
  };

  // Handler for when user clicks "Connection ready - click to start"
  const handleStartGame = () => {
    if (!socket) {
      // If no socket, fall back to full initialization
      handlePlayAgain();
      return;
    }

    // Read selected difficulty from localStorage if available
    const storedDifficulty = localStorage.getItem('selectedDifficulty');
    if (storedDifficulty) {
      const difficulty = parseInt(storedDifficulty, 10);
      setSelectedDifficulty(difficulty);
      setAILevel(difficulty);
      setRpsDifficulty(difficulty);
    }

    // Socket exists, start with RPS to determine who goes first
    setShowRPS(true);
  };

  // Effect: establish connection & create game
  useEffect(() => {
    if (!started) return;

    // Read selected difficulty from localStorage if available
    const storedDifficulty = localStorage.getItem('selectedDifficulty');
    if (storedDifficulty) {
      const difficulty = parseInt(storedDifficulty, 10);
      setSelectedDifficulty(difficulty);
      setAILevel(difficulty);
      setRpsDifficulty(difficulty);
    }

    // Show loading progress when game starts
    setShowLoadingProgress(true);
    setIsInitializing(true);
    setSocket(apiSocket);

    apiSocket.on('connect', () => {
      console.log('🔗 connected, id=', apiSocket.id);
      // Don't create game immediately - let loading complete first
      setShowLoadingProgress(false);
      setIsInitializing(false);
      setStatus('Connection ready - click to start');
    });

    apiSocket.on('disconnect', () => {
      console.log('❌ disconnected');
      setStatus('Disconnected');
      setShowLoadingProgress(false);
      setIsInitializing(false);
    });

    apiSocket.on(
      'gameCreated',
      (data: { gameId: string; nextPlayer: CellValue }) => {
        console.log('⬅️ gameCreated', data);
        setGameId(data.gameId);
        setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
        setWinningLine([]);
        setHistory([]);
        // Loading progress will complete and set the status
        console.log('✅ Game board ready:', data.gameId);
      }
    );

    return () => {
      apiSocket.off('connect');
      apiSocket.off('disconnect');
      apiSocket.off('gameCreated');
    };
  }, [started]);

  // Handler to start or restart game
  const handlePlayAgain = () => {
    setHistory([]);
    setSidebarOpen(false);
    setGameResult(null);

    // Read selected difficulty from localStorage if available
    const storedDifficulty = localStorage.getItem('selectedDifficulty');
    if (storedDifficulty) {
      const difficulty = parseInt(storedDifficulty, 10);
      setSelectedDifficulty(difficulty);
      setAILevel(difficulty);
      setRpsDifficulty(difficulty);
    }

    if (!socket) {
      // If no socket, trigger the initialization
      setShowLoadingProgress(true);
      setIsInitializing(true);
      return;
    }

    // Instead of directly creating a game, trigger the RPS flow
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setShowRPS(true);
  };

  // Effect: listen for move events
  useEffect(() => {
    if (!socket) return;

    // Enhanced AI thinking with capabilities
    socket.on('aiThinking', (data?: { status: string; capabilities: string[] }) => {
      const currentAI = getAIPersonality(aiLevel);
      if (data?.capabilities) {
        setStatus(`${currentAI.name} AI is analyzing (${data.capabilities.length} advanced systems active)...`);
      } else {
        setStatus(`${currentAI.name} AI is thinking…`);
      }
    });

    // Enhanced AI thinking complete
    socket.on('aiThinkingComplete', (data: {
      column: number;
      confidence: number;
      thinkingTime: number;
      explanation?: string;
      safetyScore?: number;
      adaptationInfo?: any;
      curriculumInfo?: any;
    }) => {
      console.log('⬅️ aiThinkingComplete', data);
      setAiConfidence(data.confidence || 0);
      setAiThinkingTime(data.thinkingTime || 0);
      setAiSafetyScore(data.safetyScore || 1.0);
      if (data.explanation) {
        setAiExplanation(data.explanation);
      }
      if (data.adaptationInfo) {
        setAiAdaptationInfo(data.adaptationInfo);
      }
      if (data.curriculumInfo) {
        setCurriculumInfo(data.curriculumInfo);
      }
    });

    // Enhanced AI move with comprehensive data
    socket.on(
      'aiMove',
      (data: {
        board: CellValue[][];
        lastMove: {
          column: number;
          playerId: string;
          confidence?: number;
          thinkingTime?: number;
        };
        nextPlayer: CellValue;
        winner?: CellValue;
        draw?: boolean;
        winningLine?: [number, number][];
        enhancedData?: {
          explanation?: string;
          confidence?: number;
          safetyScore?: number;
          adaptationInfo?: any;
          curriculumInfo?: any;
          debateResult?: any;
          thinkingTime?: number;
        };
        gameMetrics?: any;
        aiExplanation?: string;
        curriculumUpdate?: any;
      }) => {
        console.log('⬅️ Enhanced aiMove', data);
        setBoard(data.board);
        playDrop();
        setWinningLine(data.winningLine || []);
        setHistory(prev => [...prev, {
          player: data.lastMove.playerId as CellValue,
          column: data.lastMove.column
        }]);

        // Process enhanced AI data
        if (data.enhancedData) {
          setAiConfidence(data.enhancedData.confidence || 0);
          setAiSafetyScore(data.enhancedData.safetyScore || 1.0);
          setAiThinkingTime(data.enhancedData.thinkingTime || 0);

          if (data.enhancedData.explanation) {
            setAiExplanation(data.enhancedData.explanation);
            setShowAiInsights(true); // Auto-show insights for interesting moves
          }

          if (data.enhancedData.adaptationInfo) {
            setAiAdaptationInfo(data.enhancedData.adaptationInfo);
          }

          if (data.enhancedData.curriculumInfo) {
            setCurriculumInfo(data.enhancedData.curriculumInfo);
          }

          if (data.enhancedData.debateResult) {
            setDebateResult(data.enhancedData.debateResult);
          }
        }

        // Update game metrics
        if (data.gameMetrics) {
          setGameMetrics(data.gameMetrics);
        }

        // Handle curriculum updates
        if (data.curriculumUpdate) {
          // Show curriculum advancement notifications
          console.log('📚 Curriculum update:', data.curriculumUpdate);
        }

        if (data.winner) {
          setStatus(`${data.winner} wins!`);
          const currentAI = getAIPersonality(aiLevel);
          if (data.enhancedData?.explanation) {
            setStatus(`${data.winner} wins! AI explanation: ${data.enhancedData.explanation.substring(0, 50)}...`);
          }
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

    // Enhanced player move with metrics
    socket.on(
      'playerMove',
      (data: {
        board: CellValue[][];
        lastMove: { column: number; playerId: string };
        nextPlayer: CellValue;
        winner?: CellValue;
        draw?: boolean;
        winningLine?: [number, number][];
        gameMetrics?: any;
        curriculumUpdate?: any;
      }) => {
        console.log('⬅️ Enhanced playerMove', data);
        setBoard(data.board);
        playDrop();
        setWinningLine(data.winningLine || []);
        setHistory(prev => [...prev, {
          player: data.lastMove.playerId as CellValue,
          column: data.lastMove.column
        }]);

        // Update game metrics
        if (data.gameMetrics) {
          setGameMetrics(data.gameMetrics);
        }

        // Handle curriculum updates
        if (data.curriculumUpdate) {
          console.log('📚 Player curriculum update:', data.curriculumUpdate);
        }

        if (data.winner) {
          setStatus(`${data.winner} wins!`);
          return;
        }
        if (data.draw) {
          setStatus('Draw game');
          return;
        }

        const currentAI = getAIPersonality(aiLevel);
        setStatus(`${currentAI.name} AI is thinking…`);
        setCurrentPlayer('Yellow');
      }
    );

    // AI explanation response
    socket.on('aiExplanation', (data: {
      gameId: string;
      moveIndex?: number;
      explanation: string;
      timestamp: number;
    }) => {
      console.log('⬅️ AI Explanation received:', data);
      setAiExplanation(data.explanation);
      setShowAiInsights(true);
    });

    // Feedback received confirmation
    socket.on('feedbackReceived', (data: {
      gameId: string;
      message: string;
      timestamp: number;
    }) => {
      console.log('⬅️ Feedback received:', data);
      // Could show a toast notification here
    });

    // Player progress update
    socket.on('playerProgress', (data: any) => {
      console.log('⬅️ Player progress:', data);
      setPlayerProgress(data);
    });

    return () => {
      socket.off('playerMove');
      socket.off('aiThinking');
      socket.off('aiMove');
    };
  }, [socket, currentAI.name]);

  // Enhanced AI helper functions
  const requestAIExplanation = (moveIndex?: number) => {
    if (socket && gameId) {
      socket.emit('requestExplanation', {
        gameId,
        playerId: 'Red', // Assuming human player is Red
        moveIndex
      });
    }
  };

  const submitPlayerFeedback = (feedback: {
    rating: number;
    satisfaction: number;
    aiPerformance: number;
    explanation: string;
    suggestions?: string;
  }) => {
    if (socket && gameId) {
      socket.emit('submitFeedback', {
        gameId,
        playerId: 'Red',
        feedback
      });
    }
  };

  const requestPlayerProgress = () => {
    if (socket) {
      socket.emit('getPlayerProgress', {
        playerId: 'Red'
      });
    }
  };

  const toggleAIInsights = () => {
    setShowAiInsights(!showAiInsights);
  };

  const formatConfidenceLevel = (confidence: number): string => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Medium';
    if (confidence >= 0.3) return 'Low';
    return 'Very Low';
  };

  const formatSafetyLevel = (safety: number): string => {
    if (safety >= 0.95) return 'Excellent';
    if (safety >= 0.8) return 'Good';
    if (safety >= 0.6) return 'Fair';
    return 'Needs Attention';
  };

  const getAdaptationDescription = (adaptationInfo: any): string => {
    if (!adaptationInfo) return 'Standard play';

    const { styleAdaptation, difficultyLevel, emotionalStateMatch } = adaptationInfo;

    if (styleAdaptation > 0.8) return 'Highly adapted to your style';
    if (styleAdaptation > 0.6) return 'Well adapted to your preferences';
    if (styleAdaptation > 0.4) return 'Moderately adapted';
    return 'Learning your style';
  };

  const getCurriculumStageDescription = (curriculumInfo: any): string => {
    if (!curriculumInfo) return 'Assessment phase';

    const stageNames: { [key: string]: string } = {
      'basic_tactics': 'Learning Basic Tactics',
      'strategic_thinking': 'Developing Strategy',
      'pattern_mastery': 'Mastering Patterns',
      'advanced_mastery': 'Advanced Mastery'
    };

    return stageNames[curriculumInfo.currentStage] || 'Custom Learning Path';
  };

  // Enhanced column click handler with debugging
  function onColumnClick(col: number) {
    console.log(`🎯 Column ${col} clicked`);
    console.log('🔍 Current state:', {
      socket: !!socket,
      socketConnected: socket?.connected,
      gameId,
      currentPlayer,
      socketId: socket?.id
    });

    if (!socket) {
      console.error('❌ No socket connection');
      setStatus('No connection - please refresh page');
      return;
    }

    if (!socket.connected) {
      console.error('❌ Socket not connected');
      setStatus('Connection lost - reconnecting...');

      // Try to reconnect
      socket.connect();
      return;
    }

    if (!gameId) {
      console.error('❌ No game ID - creating new game');
      setStatus('No active game - starting new game...');

      // Create a new game first
      createGameWithStartingPlayer('Red', selectedDifficulty);
      return;
    }

    if (currentPlayer !== 'Red') {
      console.log(`⏳ Not player's turn (current: ${currentPlayer})`);
      return;
    }

    console.log(`🎯 Dropping disc in column ${col} for game ${gameId}`);

    try {
      socket.emit('dropDisc', {
        gameId,
        playerId: 'Red',
        column: col
      });

      playClick();
      console.log(`✅ Move sent to server`);

    } catch (error) {
      console.error('❌ Failed to send move:', error);
      setStatus('Failed to send move - please try again');
    }
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

      {/* Loading Progress Overlay */}
      <LoadingProgress
        isVisible={showLoadingProgress}
        onComplete={handleLoadingComplete}
      />

      {/* Rock Paper Scissors */}
      <RockPaperScissors
        isVisible={showRPS}
        onComplete={handleRPSComplete}
        aiPersonality={currentAI.name}
      />

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
        {status === 'Connection ready - click to start' ? (
          <button
            onClick={handleStartGame}
            className="text-xl font-semibold text-white bg-green-600 hover:bg-green-700 px-6 py-2 rounded-full transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            {status}
          </button>
        ) : (
          <div className="text-xl font-semibold text-white bg-black bg-opacity-30 px-6 py-2 rounded-full">
            {status}
          </div>
        )}
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
            playerStats={playerStats}
            currentAI={currentAI}
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
