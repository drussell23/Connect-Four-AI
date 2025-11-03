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
import { updatePlayerStats } from './services/playerStatsService';
import { analyzeCurrentPosition, clearMoveAnalysisCache } from './services/moveAnalysisService';
import { statsTracker } from './services/StatsTracker';
import './utils/memory-console-commands'; // Load memory console commands
import './services/DebugStats'; // Load debug utilities
import './services/TestStats'; // Load test utilities
import InactivityDetector from './components/InactivityDetector';
import MoveExplanationPanel from './components/ai-insights/MoveExplanation';
import MoveAnalysis from './components/ai-insights/MoveAnalysis';
import GameHistory from './components/game-history/GameHistory';
import UserSettings from './components/settings/UserSettings';
import apiSocket, { getConnectionStatus } from './api/socket';
import { setupMemoryListeners, removeMemoryListeners } from './utils/setup-memory-listeners';
import { appConfig, enterprise, ai, game, ui, dev, analytics } from './config/environment';
import { integrationLogger } from './utils/integrationLogger';
import { serviceHealthMonitor } from './utils/serviceHealthMonitor';
import { cleanupService } from './services/cleanupService';
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
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [gameInitialized, setGameInitialized] = useState<boolean>(false);

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
  const [lastAiMoveTime, setLastAiMoveTime] = useState<number>(0);
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

  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);

  // New API Components state
  const [showPlayerStats, setShowPlayerStats] = useState<boolean>(false);
  const [showMoveExplanation, setShowMoveExplanation] = useState<boolean>(false);
  const [showMoveAnalysis, setShowMoveAnalysis] = useState<boolean>(false);
  const [showGameHistory, setShowGameHistory] = useState<boolean>(false);
  const [showUserSettings, setShowUserSettings] = useState<boolean>(false);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number>(-1);
  const [lastAnalyzedMove, setLastAnalyzedMove] = useState<{ column: number; player: 'player' | 'ai' } | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [aiInsightsData, setAiInsightsData] = useState<any>(null);
  const [gameHistoryData, setGameHistoryData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);

  // Board state tracking for move analysis
  const [boardBeforeMove, setBoardBeforeMove] = useState<string[][]>([]);
  const [boardAfterMove, setBoardAfterMove] = useState<string[][]>([]);
  const [lastMoveColumn, setLastMoveColumn] = useState<number>(-1);
  const [lastMovePlayer, setLastMovePlayer] = useState<'player' | 'ai'>('player');

  // Load stats from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('connect4EnhancedStats');
    console.log('📊 Loading stats from localStorage:', stored);
    if (stored) {
      const stats = JSON.parse(stored);
      console.log('📊 Parsed stats:', stats);
      setPlayerStats(stats);
      setSelectedDifficulty(stats.highestLevelReached || 1);
      setAILevel(stats.highestLevelReached || 1);
    } else {
      console.log('📊 No stats found in localStorage, using defaults');
    }
  }, []);

  // Initialize Speed Insights (only in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && window.location.hostname !== 'localhost') {
      injectSpeedInsights();
    }
  }, []);

  // Initialize integration monitoring
  useEffect(() => {
    console.log('🚀 Initializing service integration monitoring...');
    
    // Show initial dashboard
    integrationLogger.showDashboard();
    
    // Start service health monitoring
    serviceHealthMonitor.startMonitoring();
    
    // Monitor service connections periodically
    const monitoringInterval = setInterval(() => {
      integrationLogger.getServiceSummary();
    }, 30000); // Every 30 seconds
    
    // Add keyboard shortcuts for debugging
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D for dashboard
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        integrationLogger.showDashboard();
      }
      // Ctrl/Cmd + Shift + T for test integration
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
        serviceHealthMonitor.testIntegration();
      }
      // Ctrl/Cmd + Shift + L for toggle detailed logging
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'L') {
        integrationLogger.toggleDetailedMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      clearInterval(monitoringInterval);
      serviceHealthMonitor.stopMonitoring();
      window.removeEventListener('keydown', handleKeyPress);
      // Clear move analysis cache when component unmounts
      clearMoveAnalysisCache();
    };
  }, []);

  // App initialization effect
  useEffect(() => {
    // Setup automatic cleanup
    cleanupService.setupAutoCleanup();
    
    // Delay app initialization to prevent Suspense during render
    const timer = setTimeout(() => {
      setAppInitialized(true);
    }, 200);
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      // Don't disconnect socket on component unmount during development
      // This prevents issues with hot reloading
      if (process.env.NODE_ENV === 'production') {
        cleanupService.cleanupForExit();
      }
    };
  }, []);

  // Save stats to localStorage
  const saveStats = (newStats: PlayerStats) => {
    console.log('💾 Saving stats:', newStats);
    localStorage.setItem('connect4EnhancedStats', JSON.stringify(newStats));
    setPlayerStats(newStats);
    window.dispatchEvent(new CustomEvent('statsUpdate', { detail: newStats }));
  };
  
  // Register cleanup handler for stats
  useEffect(() => {
    const statsCleanupHandler = () => {
      // Reset in-memory stats
      setPlayerStats({
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        currentLevelWins: 0,
        totalGamesPlayed: 0,
        highestLevelReached: 1,
        averageMovesPerGame: 0
      });
      setHistory([]);
    };
    
    cleanupService.registerCleanupHandler(statsCleanupHandler);
    
    return () => {
      cleanupService.unregisterCleanupHandler(statsCleanupHandler);
    };
  }, []);

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

  const createGameWithStartingPlayer = async (firstPlayer: CellValue, difficulty?: number) => {
    if (!socket) {
      console.error('No socket connection');
      return;
    }

    // Start stats tracking session
    console.log('📊 Starting stats session with difficulty:', difficulty || aiLevel);
    statsTracker.startSession('AI', difficulty || aiLevel);

    const gameDifficulty = difficulty || selectedDifficulty;
    
    // Clean up for new game
    await cleanupService.cleanupForRestart();
    
    // Ensure socket is connected after cleanup
    if (socket && !getConnectionStatus().connected) {
      socket.connect();
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Instead of showing "Creating game...", immediately set the game state
    setCurrentPlayer(firstPlayer);
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setHistory([]);
    setGameStartTime(Date.now()); // Track when the game starts
    setGameInitialized(false); // Reset initialization flag

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
          // Clear move analysis cache for new game
          clearMoveAnalysisCache();
          // Mark game as initialized
          setGameInitialized(true);
          // Game state is already set above, so we just confirm the gameId
          console.log('✅ Game ready with starting player:', firstPlayer, res.gameId, res.nextPlayer);
        }
      }
    );
  };

  // Enhanced victory/defeat handling with real stats tracking
  const handleGameEnd = (winner: CellValue | 'Draw', movesPlayed: number) => {
    const isVictory = winner === 'Red';
    const isDraw = winner === 'Draw';
    const isDefeat = winner === 'Yellow';

    // End stats tracking session
    const result = isVictory ? 'win' : isDraw ? 'draw' : 'loss';
    console.log('📊 Ending game session with result:', result, 'In game?', statsTracker.isInGame());
    
    // Always try to end session if we have moves
    if (movesPlayed > 0) {
      // Make sure there's a session (create one if needed for the ending)
      if (!statsTracker.isInGame()) {
        console.log('📊 Creating session for game end');
        statsTracker.startSession('AI', aiLevel);
      }
      statsTracker.endSession(result);
      console.log('📊 Stats after game:', statsTracker.getStats());
    } else {
      console.warn('📊 No moves played, not recording game');
    }

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

    // Update player stats using the new service
    const gameResult = isVictory ? 'win' : isDefeat ? 'loss' : 'draw';
    const gameData = {
      duration: Date.now() - gameStartTime, // You'll need to track game start time
      moveCount: movesPlayed,
      averageMoveTime: 2000, // Default value, can be calculated from move timestamps
      accuracyRate: 75.0 // Default value, can be calculated from move quality
    };

    updatePlayerStats(gameId || 'demo-user', gameResult, gameData).catch(err => {
      console.error('Failed to update player stats:', err);
    });

    // Show victory modal after a short delay
    setTimeout(() => {
      setShowVictoryModal(true);
    }, 1500);
  };

  // Victory modal handlers
  const handleNextLevel = async () => {
    let nextLevel = aiLevel;
    if (aiLevel < 25) {
      nextLevel = aiLevel + 1;
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
    setStatus('Ready to play'); // Clear the previous game's status to prevent auto-victory

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
      // Clean up for new game
      await cleanupService.cleanupForRestart();
      
      // Ensure socket is connected after cleanup
      if (!getConnectionStatus().connected) {
        socket.connect();
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set game state immediately - no "Creating new game..." delay
      setCurrentPlayer(nextStartingPlayer);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
      setWinningLine([]);
      setHistory([]); // Clear history to prevent auto-victory trigger
      setGameStartTime(Date.now()); // Reset game start time
      setStatus(
        nextStartingPlayer === 'Red'
          ? 'Your turn (Red)'
          : `${getCurrentAI().name} AI is thinking…`
      );

      socket.emit(
        'createGame',
        {
          playerId: 'Red',
          difficulty: nextLevel,
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
            // Clear move analysis cache for new game
            clearMoveAnalysisCache();
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

  const handleReplayLevel = async () => {
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

  const handleQuitToMenu = async () => {
    setShowVictoryModal(false);
    setStarted(false);
    setGameResult(null);
    
    // End current session if active (but don't reset all stats)
    if (statsTracker.isInGame()) {
      console.log('📊 Ending current game session');
      // Mark as abandoned/incomplete
      statsTracker.abandonSession();
    }
    
    // Perform comprehensive cleanup
    await cleanupService.cleanup({
      clearLocalStorage: false, // Keep user preferences
      clearSessionStorage: true,
      resetStats: true,
      resetHistory: true,
      disconnectSocket: false, // Keep connection for potential new game
      clearCache: true,
    });

    // Reset game state
    setBoard(Array.from({ length: 6 }, () => Array(7).fill('Empty')));
    setWinningLine([]);
    setHistory([]);
    setStatus('Ready to play');
    setSidebarOpen(false);

    // Preserve the player's current difficulty level
    // Only reset current streak for this session
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

    // Don't reset stats here - this seems to be part of a larger function
    // If we need to reset stats, it should be an explicit user action

    // Socket disconnection is handled by cleanup service if needed
    // No need to manually disconnect here since we set disconnectSocket: false above
  };

  // Effect for game-end events
  useEffect(() => {
    // Only trigger if we have a game in progress (history has moves)
    if ((status.endsWith('wins!') || status === 'Draw game') && history.length > 0) {
      const winner = status.startsWith('Red') ? 'Red' :
        status.startsWith('Yellow') ? 'Yellow' : 'Draw';
      console.log('🎯 Game ended with status:', status, 'Winner:', winner, 'Moves:', history.length);
      handleGameEnd(winner as CellValue | 'Draw', history.length);
    }
  }, [status, history.length]);

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

  // Effect: Handle page refresh/unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show confirmation if game is in progress
      if (statsTracker.isInGame() && board.some(row => row.some(cell => cell !== 'Empty'))) {
        console.log('⚠️ Game in progress - showing confirmation');
        e.preventDefault();
        e.returnValue = 'You have an active game. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [board]);

  // Effect: establish connection & create game
  useEffect(() => {
    if (!started) return;

    // Clear any stale game IDs on startup
    setGameId('');

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
      
      // Request current service status
      console.log('📊 Requesting service status...');
      apiSocket.emit('requestServiceStatus');
      
      // Setup memory dashboard listeners on the main socket
      console.log('📊 Setting up memory dashboard...');
      setupMemoryListeners(apiSocket);
      
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
        setGameStartTime(Date.now()); // Track when the game starts
        // Clear move analysis cache for new game
        clearMoveAnalysisCache();
        // Loading progress will complete and set the status
        console.log('✅ Game board ready:', data.gameId);
      }
    );

    return () => {
      apiSocket.off('connect');
      apiSocket.off('disconnect');
      apiSocket.off('gameCreated');
      removeMemoryListeners(apiSocket);
    };
  }, [started]);

  // Handler to start or restart game
  const handlePlayAgain = () => {
    setHistory([]);
    setSidebarOpen(false);
    setGameResult(null);
    setGameStartTime(Date.now()); // Reset game start time
    setGameInitialized(false); // Reset game initialization flag

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

    // Enhanced AI thinking with detailed logging
    socket.on('aiThinking', (data?: any) => {
      // Ignore aiThinking events if it's not the AI's turn or if game is over
      if (currentPlayer !== 'Yellow' || status.includes('wins') || status === 'Draw game') {
        console.log('⚠️ Ignoring aiThinking event - not AI turn or game over (currentPlayer:', currentPlayer, ', status:', status, ')');
        return;
      }
      
      // Ignore aiThinking events that arrive shortly after an AI move (race condition protection)
      if (lastAiMoveTime && Date.now() - lastAiMoveTime < 1000) {
        console.log('⚠️ Ignoring aiThinking event - too soon after AI move (', Date.now() - lastAiMoveTime, 'ms)');
        return;
      }
      
      // Log detailed AI thinking process to console
      if (data?.type) {
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        
        switch (data.type) {
          case 'systemActivation':
            console.log(`%c[${timestamp}] 🚀 ${data.message}`, 'color: #4CAF50; font-weight: bold');
            console.log('%c   Details:', 'color: #666');
            console.log(`   • System: ${data.details.system}`);
            console.log(`   • Description: ${data.details.description}`);
            if (data.details.capabilities) {
              console.log(`   • Capabilities: ${data.details.capabilities.join(', ')}`);
            }
            if (data.details.difficulty !== undefined) {
              console.log(`   • Difficulty: ${data.details.difficulty}`);
            }
            if (data.details.moveNumber) {
              console.log(`   • Move Number: ${data.details.moveNumber}`);
            }
            break;
            
          case 'criticality':
            console.log(`%c[${timestamp}] 📊 ${data.message}`, 'color: #FF9800; font-weight: bold');
            console.log('%c   Analysis:', 'color: #666');
            console.log(`   • Winning Threat: ${(data.details.factors.winningThreat * 100).toFixed(0)}%`);
            console.log(`   • Losing Threat: ${(data.details.factors.losingThreat * 100).toFixed(0)}%`);
            console.log(`   • Strategic Importance: ${(data.details.factors.strategicImportance * 100).toFixed(0)}%`);
            console.log(`   • Game Phase: ${(data.details.factors.gamePhase * 100).toFixed(0)}%`);
            console.log(`   • Recommended Depth: ${data.details.recommendedDepth}`);
            console.log(`   • Time Allocation: ${data.details.timeAllocation}ms`);
            break;
            
          case 'progress':
            console.log(`%c[${timestamp}] 🔄 ${data.message}`, 'color: #2196F3');
            if (data.details.servicesUsed) {
              console.log(`   • Services: ${data.details.servicesUsed.join(', ')}`);
            }
            break;
            
          case 'variation':
            console.log(`%c[${timestamp}] 🎯 ${data.message}`, 'color: #9C27B0');
            break;
            
          case 'moveDecision':
            console.log(`%c[${timestamp}] ✅ ${data.message}`, 'color: #4CAF50; font-weight: bold; font-size: 14px');
            console.log('%c   Decision Details:', 'color: #666; font-weight: bold');
            console.log(`   • Column: ${data.details.column}`);
            console.log(`   • Confidence: ${(data.details.confidence * 100).toFixed(1)}%`);
            console.log(`   • Computation Time: ${data.details.computationTime}ms`);
            console.log(`   • Services Used: ${data.details.servicesUsed.join(', ')}`);
            console.log(`   • Explanation: ${data.details.explanation}`);
            if (data.details.alternativeMoves?.length > 0) {
              console.log('%c   Alternative Moves:', 'color: #666');
              data.details.alternativeMoves.forEach((alt: any) => {
                console.log(`     - Column ${alt.column}: ${(alt.score * 100).toFixed(0)}% (${alt.reason})`);
              });
            }
            break;
            
          case 'difficultyMapping':
            console.log(`%c[${timestamp}] 🎮 ${data.message}`, 'color: #9C27B0; font-weight: bold');
            console.log(`   • Frontend Level: ${data.details.frontendLevel}/25`);
            console.log(`   • Backend Difficulty: ${data.details.backendDifficulty.toFixed(1)}/10`);
            console.log(`   • Category: ${data.details.difficultyName}`);
            break;
        }
      }
      
      // Update UI status
      const currentAI = getAIPersonality(aiLevel);
      if (data?.capabilities || data?.details?.capabilities) {
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
        console.log('   nextPlayer:', data.nextPlayer, 'currentPlayer before:', currentPlayer);
        setBoard(data.board);
        setLastAiMoveTime(Date.now());

        // Track move in stats
        const boardString = data.board.map(row => row.join('')).join('|');
        console.log('📊 Recording AI move:', data.lastMove.column);
        statsTracker.recordMove(data.lastMove.column, 'Yellow', boardString);

        // Capture board state after AI move for analysis
        setBoardAfterMove(data.board);
        setLastMoveColumn(data.lastMove.column);
        setLastMovePlayer('ai');
        setLastAnalyzedMove({ column: data.lastMove.column, player: 'ai' });
        console.log('📸 Board state captured after AI move');

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
          console.log('🏆 Winner detected:', data.winner, 'Winning line:', data.winningLine);
          setStatus(`${data.winner} wins!`);
          if (data.winningLine) {
            setWinningLine(data.winningLine);
          }
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

        // Set status and current player based on nextPlayer from server
        if (data.nextPlayer) {
          setCurrentPlayer(data.nextPlayer);
          // After AI move, nextPlayer should be Red (human)
          if (data.nextPlayer === 'Red') {
            setStatus('Your turn (Red)');
          } else {
            // This shouldn't happen after an AI move
            console.error('⚠️ Unexpected: AI turn after AI move? nextPlayer:', data.nextPlayer);
            setStatus(`${getCurrentAI().name} AI is thinking…`);
          }
        } else {
          // Fallback to Red if nextPlayer not provided
          setStatus('Your turn (Red)');
          setCurrentPlayer('Red');
        }
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

        // Track move in stats
        const boardString = data.board.map(row => row.join('')).join('|');
        console.log('📊 Recording player move:', data.lastMove.column);
        statsTracker.recordMove(data.lastMove.column, 'Red', boardString);

        // Capture board state after player move for analysis
        setBoardAfterMove(data.board);
        setLastMoveColumn(data.lastMove.column);
        setLastMovePlayer('player');
        setLastAnalyzedMove({ column: data.lastMove.column, player: 'player' });
        console.log('📸 Board state captured after player move');

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
          console.log('🏆 Winner detected (AI move):', data.winner, 'Winning line:', data.winningLine);
          setStatus(`${data.winner} wins!`);
          if (data.winningLine) {
            setWinningLine(data.winningLine);
          }
          return;
        }
        if (data.draw) {
          console.log('🤝 Draw detected');
          setStatus('Draw game');
          return;
        }

        // Set status and current player based on nextPlayer from server
        if (data.nextPlayer) {
          setCurrentPlayer(data.nextPlayer);
          setStatus(data.nextPlayer === 'Red' ? 'Your turn (Red)' : `${getCurrentAI().name} AI is thinking…`);
        } else {
          // Fallback to Yellow if nextPlayer not provided
          setStatus(`${getCurrentAI().name} AI is thinking…`);
          setCurrentPlayer('Yellow');
        }
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

    // Service status updates
    socket.on('serviceStatusUpdate', (data: any) => {
      console.log('📊 Service status update:', data);
      integrationLogger.updateServiceStatuses(data);
    });
    
    // Also listen for bulk status updates from integration websocket
    socket.on('service_status_bulk_update', (data: any) => {
      console.log('📊 Bulk service status update:', data);
      integrationLogger.updateServiceStatuses(data);
    });

    return () => {
      socket.off('playerMove');
      socket.off('aiThinking');
      socket.off('aiMove');
      socket.off('serviceStatusUpdate');
      socket.off('service_status_bulk_update');
    };
  }, [socket, aiLevel, currentPlayer, status, lastAiMoveTime]);

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

  const analyzeCurrentMove = async () => {
    if (!board || !currentPlayer || !gameId || lastMoveColumn === -1 || !gameInitialized) {
      console.log('Cannot analyze move - missing required data:', {
        hasBoard: !!board,
        hasCurrentPlayer: !!currentPlayer,
        hasGameId: !!gameId,
        gameInitialized,
        lastMoveColumn
      });
      if (!gameInitialized) {
        alert('Please wait for the game to be fully initialized before analyzing moves.');
      }
      return;
    }

    // Ensure we have a valid game ID (at least 8 characters)
    if (!gameId || gameId.length < 8) {
      console.log('Invalid game ID for analysis:', gameId);
      alert('Please start a new game before analyzing moves.');
      return;
    }

    try {
      console.log('🚀 Starting move analysis for game:', gameId);
      console.log('📊 Analysis parameters:', {
        gameId,
        gameInitialized,
        lastMoveColumn,
        aiLevel,
        boardState: board ? 'present' : 'missing'
      });
      // Use the captured board states and last move information
      const analysis = await analyzeCurrentPosition(
        board,
        lastMovePlayer,
        aiLevel,
        gameId,
        boardBeforeMove,
        boardAfterMove,
        lastMoveColumn
      );
      console.log('✅ Real AI move analysis completed:', analysis);

      // Show the comprehensive move analysis modal
      setShowMoveAnalysis(true);
    } catch (error) {
      console.error('❌ Failed to analyze current move:', error);

      // Check if the error is due to game not found
      if (error instanceof Error && error.message && error.message.includes('Game not found')) {
        alert('Game session has expired. Please start a new game to continue.');
        // Reset game state
        setGameId('');
        setGameInitialized(false);
      } else {
        alert('Move analysis failed. Please try again.');
      }
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

  // Enhanced column click handler with debugging and board state tracking
  function onColumnClick(col: number) {
    console.log(`🎯 Column ${col} clicked`);

    // If Move Explanation panel is open, use the click to select a column for analysis
    if (showMoveExplanation) {
      setSelectedMoveIndex(col);
      return; // Don't make a move, just analyze
    }

    // Start move timer for stats tracking
    statsTracker.startMoveTimer();

    const connStatus = getConnectionStatus();
    console.log('🔍 Current state:', {
      socket: !!socket,
      socketConnected: connStatus.connected,
      gameId,
      currentPlayer,
      socketId: connStatus.id,
      transport: connStatus.transport
    });

    if (!socket) {
      console.error('❌ No socket connection');
      setStatus('No connection - please refresh page');
      return;
    }

    const connectionStatus = getConnectionStatus();
    if (!connectionStatus.connected) {
      console.error('❌ Socket not connected, status:', connectionStatus);
      setStatus('Connection lost - reconnecting...');

      // Try to reconnect
      socket.connect();
      
      // Wait a bit and retry the move
      setTimeout(() => {
        const newStatus = getConnectionStatus();
        if (newStatus.connected) {
          onColumnClick(col);
        }
      }, 1000);
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

    // Capture board state before the move
    if (board) {
      const boardBefore = board.map(row => [...row]);
      setBoardBeforeMove(boardBefore);
      setLastMoveColumn(col);
      setLastMovePlayer('player');
      console.log('📸 Board state captured before move');
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

  // Handle inactivity callbacks
  const handleInactiveUser = () => {
    console.log('👤 User inactive');
    // Could pause AI thinking here if needed
  };

  const handleResumeGame = () => {
    console.log('▶️ User resumed');
    // Resume any paused operations
  };

  const handleInactivityQuit = () => {
    console.log('🚪 User quit due to inactivity');
    
    // Abandon current session without saving (don't count incomplete game)
    if (statsTracker.isInGame()) {
      statsTracker.abandonSession();
    }
    
    // Return to menu (stats continue to accumulate)
    handleQuitToMenu();
  };

  return (
    <div className="min-h-screen bg-blue-800 flex flex-col items-center justify-center p-2 md:p-4 overflow-x-hidden"
      style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* Inactivity Detector */}
      <InactivityDetector
        enabled={started && !showVictoryModal}
        isGameActive={!!gameId && board.some(row => row.some(cell => cell !== 'Empty'))}
        inactivityTimeout={120000} // 2 minutes
        onInactive={handleInactiveUser}
        onResume={handleResumeGame}
        onQuit={handleInactivityQuit}
      />

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
        className="text-center mb-4 md:mb-6 w-full px-2"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-2xl md:text-4xl font-extrabold title-gradient mb-2">
          Connect Four AI
        </h1>
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
          <div className="ai-info-display bg-white bg-opacity-10 rounded-lg px-3 md:px-4 py-2 max-w-full">
            <div className="text-sm md:text-lg font-bold" style={{ color: getCurrentAI().color }}>
              {getCurrentAI().name} AI - Level {aiLevel}
            </div>
            <div className="text-xs md:text-sm text-white opacity-80">
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
      <div className="fixed md:absolute top-2 md:top-4 left-2 md:left-4 flex gap-2 z-50">
        <button
          onClick={() => setStarted(false)}
          className="bg-red-500 hover:bg-red-600 text-white px-2 md:px-3 py-1 text-sm md:text-base rounded transition-all duration-200 hover:scale-105"
        >
          Quit
        </button>
        <button
          onClick={handlePlayAgain}
          className="bg-blue-500 hover:bg-blue-600 text-white px-2 md:px-3 py-1 text-sm md:text-base rounded transition-all duration-200 hover:scale-105"
        >
          New Game
        </button>
      </div>

      {/* Game Status */}
      <motion.div
        className="mb-2 md:mb-4 text-center w-full px-2"
        animate={{ scale: status.includes('thinking') ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 1, repeat: status.includes('thinking') ? Infinity : 0 }}
      >
        {status === 'Connection ready - click to start' ? (
          <button
            onClick={handleStartGame}
            className="text-base md:text-xl font-semibold text-white bg-green-600 hover:bg-green-700 px-4 md:px-6 py-2 rounded-full transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            {status}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className="text-base md:text-xl font-semibold text-white bg-black bg-opacity-30 px-4 md:px-6 py-2 rounded-full">
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
          className="fixed bottom-4 md:bottom-6 right-4 md:right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 md:p-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 z-[9999]"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="View AI's Analysis"
        >
          <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl">🧠</span>
            <span className="text-xs font-semibold mt-1 hidden md:block">AI</span>
          </div>
        </motion.button>
      )}

      {/* Floating Analyze Last Move Button */}
      {lastAnalyzedMove && !showVictoryModal && !showMoveExplanation && history.length > 0 && (
        <motion.button
          onClick={() => {
            // Instead of analyzing the column where the piece was placed,
            // analyze the board position after the move
            setShowMoveAnalysis(true);
          }}
          className="fixed bottom-4 md:bottom-6 left-4 md:left-6 bg-gradient-to-r from-yellow-600 to-orange-600 text-white p-3 md:p-4 rounded-full shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-110 z-[9999]"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          title={`Analyze ${lastAnalyzedMove.player === 'ai' ? 'AI' : 'Your'} Move (Column ${lastAnalyzedMove.column})`}
        >
          <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl">🔍</span>
            <span className="text-xs font-semibold mt-1 hidden md:block">Analyze</span>
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

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="fixed top-2 right-2 md:hidden bg-black bg-opacity-50 text-white p-2 rounded-lg z-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {showMobileMenu ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Right Side Navigation - Desktop and Mobile */}
      <div className={`fixed md:absolute top-14 md:top-4 right-2 md:right-4 flex flex-col gap-2 z-50 ${showMobileMenu ? 'block' : 'hidden md:flex'} bg-black bg-opacity-80 md:bg-transparent p-2 md:p-0 rounded-lg`}>
        <button
          onClick={() => {
            setShowAIDashboard(true);
            setShowMobileMenu(false);
          }}
          className="bg-blue-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="Open AI Analysis Dashboard"
        >
          📊 AI Dashboard
        </button>
        <button
          onClick={() => {
            setShowTrainingGround(true);
            setShowMobileMenu(false);
          }}
          className="bg-purple-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="Open AI Training Ground"
        >
          🧪 Training Ground
        </button>
        <button
          onClick={() => {
            setSidebarOpen(!sidebarOpen);
            setShowMobileMenu(false);
          }}
          className="bg-white bg-opacity-20 text-white px-3 py-2 rounded-lg hover:bg-opacity-40 transition-all duration-200 hover:scale-105 text-sm font-semibold w-full md:w-auto"
        >
          📈 Stats & History
        </button>
        <button
          onClick={() => {
            setShowPlayerStats(true);
            setShowMobileMenu(false);
          }}
          className="bg-green-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="Player Analytics"
        >
          🧑‍💼 Player Stats
        </button>
        <button
          onClick={() => {
            // Show move explanation panel - it will handle empty columns intelligently
            setShowMoveExplanation(true);
            setShowMobileMenu(false);
          }}
          className="bg-yellow-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="AI Move Explanation"
        >
          💡 Move Explanation
        </button>
        <button
          onClick={() => {
            analyzeCurrentMove();
            setShowMobileMenu(false);
          }}
          className="bg-orange-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="Analyze Current Position"
        >
          🔍 Move Analysis
        </button>
        <button
          onClick={() => {
            setShowGameHistory(true);
            setShowMobileMenu(false);
          }}
          className="bg-pink-600 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="Game History"
        >
          🕰️ Game History
        </button>
        <button
          onClick={() => {
            setShowUserSettings(true);
            setShowMobileMenu(false);
          }}
          className="bg-gray-700 bg-opacity-80 text-white px-3 py-2 rounded-lg hover:bg-opacity-100 transition-all duration-200 hover:scale-105 flex items-center gap-2 text-sm font-semibold w-full md:w-auto"
          title="User Settings"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Player Stats Panel */}
      <AnimatePresence>
        {showPlayerStats && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-4 md:p-8 max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowPlayerStats(false)}
                className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl p-2"
              >
                ×
              </button>
              <PlayerStatsComponent
                playerId="player"
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
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-4 md:p-8 max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowMoveExplanation(false)}
                className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl p-2"
              >
                ×
              </button>
              <MoveExplanationPanel
                gameId={gameId || 'demo-game'}
                move={selectedMoveIndex >= 0 ? selectedMoveIndex : (lastAnalyzedMove?.column ?? -1)}
                player={selectedMoveIndex >= 0 ? 'player' : (lastAnalyzedMove?.player ?? 'player')}
                boardState={board}
                aiLevel={aiLevel}
                isVisible={showMoveExplanation}
                onClose={() => {
                  setShowMoveExplanation(false);
                  setSelectedMoveIndex(-1); // Reset selection when closing
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game History Panel */}
      <AnimatePresence>
        {showGameHistory && (
          <motion.div
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-4 md:p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowGameHistory(false)}
                className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl p-2"
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
            className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-4 md:p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowUserSettings(false)}
                className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-500 hover:text-black dark:hover:text-white text-2xl p-2"
              >
                ×
              </button>
              <UserSettings playerId={gameId || 'demo-user'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move Analysis Modal */}
      <AnimatePresence>
        {showMoveAnalysis && (
          <MoveAnalysis
            boardState={board} // Board state
            currentPlayer={currentPlayer === 'Red' ? 'player' : 'ai'} // Current player
            aiLevel={aiLevel} // AI level
            gameId={gameId} // Game ID 
            isVisible={showMoveAnalysis} // Show move analysis
            onClose={() => setShowMoveAnalysis(false)} // Close move analysis
          />
        )}
      </AnimatePresence>

      {/* AI Insights Side Panel - Slides in from right */}
      <AnimatePresence>
        {showAIInsightsPanel && aiExplanation && (
          <motion.div
            className="fixed top-0 right-0 h-full w-full md:w-80 bg-gradient-to-b from-blue-900 to-purple-900 shadow-2xl border-l border-blue-400 z-[9999] overflow-y-auto"
            initial={{ x: '100%' }} 
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
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
