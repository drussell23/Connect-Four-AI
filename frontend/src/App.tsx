// src/App.tsx
import React, { useState, useEffect, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fireworks } from 'fireworks-js';
import { injectSpeedInsights } from '@vercel/speed-insights';
import Board from './components/core/Board';
import Sidebar from './components/ui/Sidebar';
import LandingPage from './components/ui/LandingPage';
import VictoryModal from './components/modals/VictoryModal';
import SimplifiedEnhancedLoading from './components/loading/SimplifiedEnhancedLoading';
import ConnectFourLoading from './components/loading/ConnectFourLoading';
import RealTimeConnectFourLoading from './components/loading/RealTimeConnectFourLoading';
import LoadingPreferences from './components/loading/LoadingPreferences';
import CoinToss, { type CoinResult, type CoinTossResult } from './components/game/CoinToss';
import AIAnalysisDashboard from './components/analytics/AIAnalysisDashboard';
import AITrainingGround from './components/analytics/AITrainingGround';
import PlayerStatsComponent from './components/analytics/PlayerStats';
import MoveExplanationPanel from './components/ai-insights/MoveExplanation';
import GameHistory from './components/game-history/GameHistory';
import UserSettings from './components/settings/UserSettings';
import apiSocket from './api/socket';
import { appConfig, enterprise, ai, game, ui, dev, analytics } from './config/environment';
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
  const [showLoadingPreferences, setShowLoadingPreferences] = useState<boolean>(false);
  const [appInitialized, setAppInitialized] = useState<boolean>(false);
  const [loadingPreferences, setLoadingPreferences] = useState(() => {
    const saved = localStorage.getItem('loadingPreferences');
    return saved ? JSON.parse(saved) : {
      theme: 'cyber',
      soundEnabled: true,
      animationSpeed: 1,
      particleCount: 50,
      showMetrics: true,
      autoStart: true,
      language: 'en',
      accessibility: {
        reducedMotion: false,
        highContrast: false,
        largeText: false,
        screenReader: false
      }
    };
  });

  // New AI Features state
  const [showAIDashboard, setShowAIDashboard] = useState<boolean>(false);
  const [showTrainingGround, setShowTrainingGround] = useState<boolean>(false);
  const [showAIInsightsPanel, setShowAIInsightsPanel] = useState<boolean>(false);

  // Rock Paper Scissors state
  const [showRPS, setShowRPS] = useState<boolean>(false);
  const [rpsResult, setRpsResult] = useState<CoinResult | null>(null);
  const [rpsDifficulty, setRpsDifficulty] = useState<number>(1); // Difficulty for the RPS game
  const [showCoinToss, setShowCoinToss] = useState<boolean>(false);
  const [coinResult, setCoinResult] = useState<CoinResult | null>(null);
  const [coinDifficulty, setCoinDifficulty] = useState<number>(1); // Difficulty for the coin toss
  const [hasDoneCoinToss, setHasDoneCoinToss] = useState<boolean>(false);

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
    safety: {
      score: 1.0,
      violations: []
    },
    adaptationScore: 0.5,
    explainabilityScore: 0.8
  });
  const [playerProgress, setPlayerProgress] = useState<any>(null);
  const [aiAdaptationInfo, setAiAdaptationInfo] = useState<any>(null);
  const [curriculumInfo, setCurriculumInfo] = useState<any>(null);
  const [debateResult, setDebateResult] = useState<any>(null);
  const [enhancedAiEnabled, setEnhancedAiEnabled] = useState<boolean>(enterprise.aiInsightsEnabled);

  // System health metrics for dashboard
  const [systemHealth, setSystemHealth] = useState<any>({
    aiStatus: 'healthy',
    cpuUsage: 25,
    memoryUsage: 45,
    networkLatency: 35,
    mlServiceStatus: 'connected'
  });

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

  // New API Components state
  const [showPlayerStats, setShowPlayerStats] = useState<boolean>(false);
  const [showMoveExplanation, setShowMoveExplanation] = useState<boolean>(false);
  const [showGameHistory, setShowGameHistory] = useState<boolean>(false);
  const [showUserSettings, setShowUserSettings] = useState<boolean>(false);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(-1);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [aiInsightsData, setAiInsightsData] = useState<any>(null);
  const [gameHistoryData, setGameHistoryData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);

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

  // Initialize Speed Insights
  useEffect(() => {
    injectSpeedInsights();
  }, []);

  // App initialization effect
  useEffect(() => {
    // Delay app initialization to prevent Suspense during render
    const timer = setTimeout(() => {
      setAppInitialized(true);
    }, 200);
    return () => clearTimeout(timer);
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
        specialAbilities: ['Endgame Mastery', 'Tactical Brilliance'],
        threatLevel: 'EXPERT',
        color: '#ef4444'
      };
    } else {
      return {
        name: 'Nightmare',
        description: 'Beyond human comprehension',
        difficulty: level,
        specialAbilities: ['Quantum Analysis', 'Temporal Manipulation'],
        threatLevel: 'NIGHTMARE',
        color: '#7c3aed'
      };
    }
  };

  // Simple function to get current AI personality - no complex React patterns
  const getCurrentAI = () => getAIPersonality(aiLevel);

  // Audio and haptic feedback setup
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);

  const playTone = (freq: number, duration: number) => {
    if (!ui.soundEffects) return; // Enterprise sound control
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
    if (ui.soundEffects) {
      playTone(1000, 0.05);
      navigator.vibrate?.(10);
    }
  };

  const playDrop = () => {
    if (ui.soundEffects) {
      playTone(300, 0.2);
      navigator.vibrate?.(20);
    }
  };

  const playVictory = () => {
    if (ui.soundEffects) {
      playTone(523.25, 0.3);
      setTimeout(() => playTone(659.25, 0.3), 300);
      setTimeout(() => playTone(783.99, 0.3), 600);
      navigator.vibrate?.([100, 50, 100, 50, 100]);
    }
  };

  const playDefeat = () => {
    if (ui.soundEffects) {
      playTone(220, 0.5);
      setTimeout(() => playTone(185, 0.5), 300);
      setTimeout(() => playTone(147, 0.8), 600);
      navigator.vibrate?.([50, 100, 50, 100, 50]);
    }
  };

  // Rock Paper Scissors handlers
  // (Remove this function, only coin toss is used now)
  // const handleRPSComplete = (winner: CoinResult) => {
  //   setRpsResult(winner);
  //   setShowRPS(false);

  //   // Determine starting player based on RPS result
  //   let firstPlayer: CellValue;
  //   if (winner === 'player') {
  //     firstPlayer = 'Red';
  //     setStatus('You go first!');
  //   } else {
  //     firstPlayer = 'Yellow';
  //     setStatus('AI goes first!');
  //   }

  //   // Create game with determined starting player
  //   createGameWithStartingPlayer(firstPlayer, rpsDifficulty);
  // };
  const handleCoinTossComplete = (result: CoinTossResult) => {
    console.log('🎯 Coin toss completed:', result);
    setCoinResult(result.coinResult);
    setShowCoinToss(false);
    setHasDoneCoinToss(true);

    // Clear any previous AI explanation
    setAiExplanation('');
    setShowAiInsights(false);

    // Determine starting player based on whether user won their call
    let firstPlayer: CellValue;
    if (result.userWon) {
      firstPlayer = 'Red';
      setStatus(`You called ${result.coinResult.toUpperCase()} and won! You go first!`);
    } else {
      firstPlayer = 'Yellow';
      setStatus(`You called ${result.coinResult === 'heads' ? 'TAILS' : 'HEADS'} but got ${result.coinResult.toUpperCase()}. AI goes first!`);
    }

    console.log('🎮 Starting game with first player:', firstPlayer);
    // Create game with determined starting player
    createGameWithStartingPlayer(firstPlayer, coinDifficulty);
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

    // Clear any previous AI explanation
    setAiExplanation('');
    setShowAiInsights(false);

    // Set the appropriate status based on who goes first
    const currentAI = getAIPersonality(gameDifficulty);
    setStatus(
      firstPlayer === 'Red'
        ? 'Your turn (Red)'
        : `${getCurrentAI().name} AI is thinking…`
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

      // Enterprise victory celebrations control
      if (ui.victoryCelebrations) {
        const fw = new Fireworks(document.body, {
          sound: { enabled: false }
        });
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

        if (dev.verboseLogging) {
          console.log('🎉 Enterprise victory celebration triggered');
        }
      }

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

    // Store the game result before clearing it
    const previousGameResult = gameResult;

    // Reset game state first
    setGameResult(null);
    setHistory([]);
    setSidebarOpen(false);

    // Determine starting player based on previous game result
    // If player won previous level, they go first in next level
    // If player lost, AI goes first
    let nextStartingPlayer: CellValue;

    if (previousGameResult === 'victory') {
      nextStartingPlayer = 'Red'; // Player won, so they go first
    } else if (previousGameResult === 'defeat') {
      nextStartingPlayer = 'Yellow'; // Player lost, so AI goes first
    } else {
      // For draws, player goes first (fair default)
      nextStartingPlayer = 'Red';
    }

    // Create new game directly with determined starting player
    if (socket) {
      // Set game state immediately - no "Creating new game..." delay
      setCurrentPlayer(nextStartingPlayer);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
      setWinningLine([]);
      setHistory([]);
      setStatus(
        nextStartingPlayer === 'Red'
          ? 'Your turn (Red)'
          : `${getCurrentAI().name} AI is thinking…`
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

    // Store the game result before clearing it
    const previousGameResult = gameResult;

    // Reset game state first
    setGameResult(null);
    setHistory([]);
    setSidebarOpen(false);

    // For replay, only show coin toss if it hasn't been done yet
    setCoinDifficulty(aiLevel); // Current level difficulty
    if (!hasDoneCoinToss) {
      setShowCoinToss(true);
    } else {
      // If coin toss has already been done, determine starting player based on previous result
      let replayFirstPlayer: CellValue;

      if (previousGameResult === 'victory') {
        replayFirstPlayer = 'Red'; // Player won, so they go first
      } else if (previousGameResult === 'defeat') {
        replayFirstPlayer = 'Yellow'; // Player lost, so AI goes first
      } else {
        // For draws, player goes first (fair default)
        replayFirstPlayer = 'Red';
      }

      createGameWithStartingPlayer(replayFirstPlayer, aiLevel);
    }
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
    // Reset coin toss state
    setShowCoinToss(false);
    setCoinResult(null);
    setCoinDifficulty(1);
    setHasDoneCoinToss(false);

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
    startTransition(() => {
      setShowLoadingProgress(false);
      setIsInitializing(false);
    });

    // Set the appropriate game status after loading completes
    if (gameId && currentPlayer) {
      setStatus(
        currentPlayer === 'Red'
          ? 'Your turn (Red)'
          : `${getCurrentAI().name} AI is thinking…`
      );
    } else {
      // If gameId isn't set yet, wait a bit more
      setTimeout(() => {
        if (gameId && currentPlayer) {
          setStatus(
            currentPlayer === 'Red'
              ? 'Your turn (Red)'
              : `${getCurrentAI().name} AI is thinking…`
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
      setCoinDifficulty(difficulty);
    }

    // Only show coin toss if it hasn't been done yet
    if (!hasDoneCoinToss) {
      startTransition(() => {
        setShowCoinToss(true);
      });
    } else {
      // If coin toss has already been done, just create a new game
      const nextStartingPlayer: CellValue = Math.random() < 0.5 ? 'Red' : 'Yellow';
      createGameWithStartingPlayer(nextStartingPlayer, selectedDifficulty);
    }
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
      setCoinDifficulty(difficulty);
    }

    // Enterprise loading control
    if (ui.loadingAnimations) {
      startTransition(() => {
        setShowLoadingProgress(true);
        setIsInitializing(true);
      });
    }
    setSocket(apiSocket);

    apiSocket.on('connect', () => {
      console.log('🔗 connected, id=', apiSocket.id);
      // Don't create game immediately - let loading complete first
      startTransition(() => {
        setShowLoadingProgress(false);
        setIsInitializing(false);
        setStatus('Connection ready - click to start');
      });
    });

    apiSocket.on('disconnect', () => {
      console.log('❌ disconnected');
      startTransition(() => {
        setStatus('Disconnected');
        setShowLoadingProgress(false);
        setIsInitializing(false);
      });
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
      setCoinDifficulty(difficulty);
    }

    if (!socket) {
      // If no socket, trigger the initialization
      startTransition(() => {
        setShowLoadingProgress(true);
        setIsInitializing(true);
      });
      return;
    }

    // Use coin toss to determine who goes first
    if (!hasDoneCoinToss) {
      startTransition(() => {
        setShowCoinToss(true);
      });
    } else {
      // If coin toss has already been done, just create a new game
      const nextStartingPlayer: CellValue = Math.random() < 0.5 ? 'Red' : 'Yellow';
      createGameWithStartingPlayer(nextStartingPlayer, aiLevel);
    }
  };

  // Effect: listen for move events
  useEffect(() => {
    if (!socket) return;

    // Enhanced AI thinking with capabilities
    socket.on('aiThinking', (data?: { status: string; capabilities: string[] }) => {
      const currentAI = getAIPersonality(aiLevel);
      if (data?.capabilities) {
        // More creative and simple AI thinking messages
        const thinkingMessages = [
          "AI is thinking...",
          "AI is calculating...",
          "AI is strategizing...",
          "AI is analyzing...",
          "AI is planning...",
          "AI is computing...",
          "AI is evaluating...",
          "AI is considering..."
        ];
        const randomMessage = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
        setStatus(randomMessage);
      } else {
        setStatus(`${getCurrentAI().name} AI is thinking…`);
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
            // Don't auto-show insights, let user choose to see it
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
            setAiExplanation(data.enhancedData.explanation);
            // Don't show explanation automatically, let user choose to see it
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

        setStatus(`${getCurrentAI().name} AI is thinking…`);
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
  }, [socket, aiLevel]);

  const handleLoadingPreferencesChange = (preferences: any) => {
    setLoadingPreferences(preferences);
    localStorage.setItem('loadingPreferences', JSON.stringify(preferences));
  };

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

      {/* Real-Time Connect Four Loading System */}
      {appInitialized && (
        <RealTimeConnectFourLoading
          isVisible={showLoadingProgress || isInitializing}
          onComplete={handleLoadingComplete}
        />
      )}

      {/* Loading Preferences Modal */}
      <LoadingPreferences
        isOpen={showLoadingPreferences}
        onClose={() => setShowLoadingPreferences(false)}
        preferences={loadingPreferences}
        onPreferencesChange={handleLoadingPreferencesChange}
      />

      {/* Enhanced Landing Page with Loading Preferences */}
      {!started && (
        <div className="relative">
          <LandingPage onStart={() => setStarted(true)} />

          {/* Loading Preferences Button */}
          <motion.button
            onClick={() => setShowLoadingPreferences(true)}
            className="fixed top-4 right-4 bg-black/30 backdrop-blur-lg rounded-xl p-3 border border-white/20 text-white hover:bg-black/40 transition-all z-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Loading System Preferences"
          >
            <span className="text-xl">⚙️</span>
          </motion.button>
        </div>
      )}

      {/* Coin Toss */}
      <CoinToss
        isVisible={showCoinToss}
        onComplete={handleCoinTossComplete}
        aiPersonality={getCurrentAI().name}
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
            <div className="text-lg font-bold" style={{ color: getCurrentAI().color }}>
              {getCurrentAI().name} AI - Level {aiLevel}
            </div>
            <div className="text-sm text-white opacity-80">
              {getCurrentAI().description}
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
        >
          New Game
        </button>
      </div>

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
          <div className="flex items-center justify-center gap-2">
            <div className="text-xl font-semibold text-white bg-black bg-opacity-30 px-6 py-2 rounded-full">
              {status}
            </div>
            {aiExplanation && (status.includes('wins!') || status.includes('AI')) && (
              <motion.button
                onClick={() => setShowAIInsightsPanel(true)}
                className="bg-blue-500 bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="View AI's thinking process"
              >
                <span className="text-sm">💭</span>
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      {/* Floating AI Insights Button - Available during gameplay */}
      {aiExplanation && !showVictoryModal && (
        <motion.button
          onClick={() => setShowAIInsightsPanel(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 z-[9999]"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="View AI's Analysis"
        >
          <div className="flex flex-col items-center">
            <span className="text-2xl">🧠</span>
            <span className="text-xs font-semibold mt-1">AI</span>
          </div>
        </motion.button>
      )}

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
            currentAI={getCurrentAI()}
          />
        )}
      </AnimatePresence>

      {/* AI Analysis Dashboard */}
      <AIAnalysisDashboard
        isVisible={showAIDashboard}
        onClose={() => setShowAIDashboard(false)}
        gameData={{
          board,
          currentPlayer: currentPlayer,
          gameId,
          history
        }}
        aiMetrics={{
          confidence: aiConfidence,
          thinkingTime: aiThinkingTime,
          safetyScore: aiSafetyScore,
          explanation: aiExplanation,
          adaptationInfo: aiAdaptationInfo,
          curriculumInfo: curriculumInfo,
          debateResult: debateResult
        }}
        systemHealth={systemHealth}
        socket={socket}
      />

      {/* AI Training Ground */}
      <AITrainingGround
        isVisible={showTrainingGround}
        onClose={() => setShowTrainingGround(false)}
        socket={socket}
      />

      {/* Victory Modal */}
      <VictoryModal
        isVisible={showVictoryModal}
        gameResult={gameResult}
        currentLevel={aiLevel}
        aiPersonality={getCurrentAI().name}
        onNextLevel={handleNextLevel}
        onReplayLevel={handleReplayLevel}
        onQuitToMenu={handleQuitToMenu}
        playerStats={playerStats}
      />

      {/* Right Side Navigation - Vertical Stack */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setShowAIDashboard(true)}
          className="bg-blue-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="Open AI Analysis Dashboard"
        >
          📊 AI Dashboard
        </button>
        <button
          onClick={() => setShowTrainingGround(true)}
          className="bg-purple-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="Open AI Training Ground"
        >
          🧪 Training Ground
        </button>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white bg-opacity-20 text-white px-3 py-2 rounded hover:bg-opacity-40 transition-all duration-200 hover:scale-105 text-sm font-semibold"
        >
          📈 Stats & History
        </button>
        <button
          onClick={() => setShowPlayerStats(true)}
          className="bg-green-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="Player Analytics"
        >
          🧑‍💼 Player Stats
        </button>
        <button
          onClick={() => setShowMoveExplanation(true)}
          className="bg-yellow-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="AI Move Explanation"
        >
          💡 Move Explanation
        </button>
        <button
          onClick={() => setShowGameHistory(true)}
          className="bg-pink-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="Game History"
        >
          🕰️ Game History
        </button>
        <button
          onClick={() => setShowUserSettings(true)}
          className="bg-gray-700 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold"
          title="User Settings"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Player Stats Panel */}
      <AnimatePresence>
        {showPlayerStats && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-lg w-full relative">
              <button
                onClick={() => setShowPlayerStats(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl"
              >
                ×
              </button>
              <PlayerStatsComponent
                playerId={gameId || 'demo-user'}
                isVisible={showPlayerStats}
                onClose={() => setShowPlayerStats(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move Explanation Panel */}
      <AnimatePresence>
        {showMoveExplanation && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-lg w-full relative">
              <button
                onClick={() => setShowMoveExplanation(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl"
              >
                ×
              </button>
              <MoveExplanationPanel
                gameId={gameId || 'demo-game'}
                move={selectedMoveIndex}
                player={'player'}
                isVisible={showMoveExplanation}
                onClose={() => setShowMoveExplanation(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game History Panel */}
      <AnimatePresence>
        {showGameHistory && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-2xl w-full relative">
              <button
                onClick={() => setShowGameHistory(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl"
              >
                ×
              </button>
              <GameHistory
                playerId={gameId || 'demo-user'}
                isVisible={showGameHistory}
                onClose={() => setShowGameHistory(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Settings Panel */}
      <AnimatePresence>
        {showUserSettings && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-2xl w-full relative">
              <button
                onClick={() => setShowUserSettings(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl"
              >
                ×
              </button>
              <UserSettings playerId={gameId || 'demo-user'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Insights Side Panel - Slides in from right */}
      <AnimatePresence>
        {showAIInsightsPanel && aiExplanation && (
          <motion.div
            className="fixed top-0 right-0 h-full w-80 bg-gradient-to-b from-blue-900 to-purple-900 shadow-2xl border-l border-blue-400 z-[9999] overflow-y-auto"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-blue-300">🧠</span>
                  {getCurrentAI().name}'s Analysis
                </h3>
                <button
                  onClick={() => setShowAIInsightsPanel(false)}
                  className="text-gray-400 hover:text-white transition-colors text-lg p-1 rounded-full hover:bg-white hover:bg-opacity-10"
                >
                  ✕
                </button>
              </div>

              <div className="text-gray-200 text-sm leading-relaxed mb-6">
                {aiExplanation}
              </div>

              <div className="space-y-4">
                <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
                  <h4 className="text-blue-300 font-semibold mb-2">AI Metrics</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400">Confidence:</span>
                      <div className="text-white font-semibold">{formatConfidenceLevel(aiConfidence)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Level:</span>
                      <div className="text-white font-semibold">{aiLevel}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Thinking Time:</span>
                      <div className="text-white font-semibold">{aiThinkingTime}ms</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Safety:</span>
                      <div className="text-white font-semibold">{formatSafetyLevel(aiSafetyScore)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-800 bg-opacity-50 rounded-lg p-4">
                  <h4 className="text-purple-300 font-semibold mb-2">Current Game</h4>
                  <div className="text-xs text-gray-300">
                    <div>Status: {status}</div>
                    <div>Moves: {history.length}</div>
                    <div>Current Player: {currentPlayer}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;
