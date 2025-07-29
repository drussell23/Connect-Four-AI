import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreatMeter from './ThreatMeter';
import socket from '../../api/socket';
import { integrationLogger } from '../../utils/integrationLogger';
import './Sidebar.css';

interface Move {
  player: string;
  column: number;
  timestamp?: number;
}

interface EnhancedMove extends Move {
  moveNumber: number;
  timestamp: number;
  moveType: 'opening' | 'center' | 'edge' | 'defensive' | 'offensive' | 'winning' | 'blocking';
  evaluation: 'excellent' | 'good' | 'neutral' | 'questionable' | 'poor';
  timeTaken: number;
  threats: number;
  consequence: string;
}

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  currentLevelWins: number;
  totalGamesPlayed: number;
  highestLevelReached: number;
  averageMovesPerGame: number;
}

interface GameStats {
  totalGames: number;
  playerWins: number;
  aiWins: number;
  draws: number;
  longestGame: number;
  shortestGame: number;
  averageGameLength: number;
  winStreak: number;
  lossStreak: number;
  currentStreak: number;
  currentStreakType: 'win' | 'loss' | 'none';
}

interface AIPerformance {
  model: string;
  accuracy: number;
  avgResponseTime: number;
  decisionsQuality: number;
  learningProgress: number;
  patternsRecognized: number;
  strategiesUsed: string[];
}

interface MoveExplanation {
  moveId: string;
  column: number;
  player: string;
  timestamp: number;
  reasoning: {
    primary: string;
    factors: string[];
    threatAssessment: {
      level: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    };
  };
  confidence: {
    score: number;
    distribution: { column: number; probability: number }[];
  };
  mlInsights: {
    modelUsed: string;
    inferenceTime: number;
    features: { name: string; value: number; importance: number }[];
  };
  coordinationData: {
    strategies: string[];
    consensusScore: number;
    votingResults: { strategy: string; votes: number }[];
  };
  learningImpact: {
    patternDetected: boolean;
    patternType?: string;
    adaptationTriggered: boolean;
    learningUpdate?: string;
  };
}

interface MoveAnalysis {
  boardState: {
    threats: { position: [number, number]; type: string; severity: number }[];
    opportunities: { position: [number, number]; type: string; value: number }[];
    control: { player: number; ai: number; contested: number };
  };
  strategicAssessment: {
    currentStrategy: string;
    effectiveness: number;
    alternativeStrategies: { name: string; score: number }[];
    recommendation: string;
  };
  predictedOutcome: {
    winProbability: { player: number; ai: number; draw: number };
    estimatedMovesRemaining: number;
    criticalPositions: [number, number][];
  };
  continuousLearning: {
    patternsActive: string[];
    adaptationLevel: number;
    learningRate: number;
    recentInsights: string[];
  };
  recommendedMoves: {
    column: number;
    score: number;
    reasoning: string;
    outcome: string;
  }[];
  movesToAvoid: {
    column: number;
    risk: number;
    warning: string;
    consequence: string;
  }[];
  immediateAnalysis: {
    criticalMove: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    keyFactors: string[];
    timeRecommendation: string;
  };
}

interface SidebarProps {
  history: Move[];
  onClose: () => void;
  aiLevel: number;
  aiJustLeveledUp: boolean;
  playerStats?: PlayerStats;
  currentAI?: {
    name: string;
    description: string;
    color: string;
    threatLevel: string;
  };
}

type SidebarSection = 'overview' | 'stats' | 'history' | 'analytics' | 'achievements';

const Sidebar: React.FC<SidebarProps> = ({
  history,
  onClose,
  aiLevel,
  aiJustLeveledUp,
  playerStats,
  currentAI
}) => {
  const [activeSection, setActiveSection] = useState<SidebarSection>('overview');
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    currentLevelWins: 0,
    totalGamesPlayed: 0,
    highestLevelReached: 1,
    averageMovesPerGame: 0
  });
  
  // Real-time game statistics
  const [gameStats, setGameStats] = useState<GameStats>({
    totalGames: 0,
    playerWins: 0,
    aiWins: 0,
    draws: 0,
    longestGame: 0,
    shortestGame: 0,
    averageGameLength: 0,
    winStreak: 0,
    lossStreak: 0,
    currentStreak: 0,
    currentStreakType: 'none'
  });
  
  // AI performance metrics
  const [aiPerformance, setAIPerformance] = useState<AIPerformance>({
    model: 'Unknown',
    accuracy: 0,
    avgResponseTime: 0,
    decisionsQuality: 0,
    learningProgress: 0,
    patternsRecognized: 0,
    strategiesUsed: []
  });
  
  // Historical game data
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  
  // Move explanation and analysis data
  const [currentMoveExplanation, setCurrentMoveExplanation] = useState<MoveExplanation | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveExplanation[]>([]);
  const [boardAnalysis, setBoardAnalysis] = useState<MoveAnalysis | null>(null);

  // Load stats from localStorage or props
  useEffect(() => {
    if (playerStats) {
      setStats(playerStats);
    } else {
      const stored = localStorage.getItem('connect4EnhancedStats');
      if (stored) {
        try {
          setStats(JSON.parse(stored));
        } catch (e) {
          console.error('Error parsing stored stats:', e);
        }
      }
    }
  }, [playerStats]);

  // Listen for stats updates
  useEffect(() => {
    const handleStatsUpdate = (e: CustomEvent) => {
      if (e.detail) {
        setStats(e.detail);
      }
    };
    window.addEventListener('statsUpdate', handleStatsUpdate as EventListener);
    return () => window.removeEventListener('statsUpdate', handleStatsUpdate as EventListener);
  }, []);
  
  // Socket.IO listeners for real-time data
  useEffect(() => {
    // Game statistics updates
    socket.on('gameStatsUpdate', (data: GameStats) => {
      setGameStats(data);
      integrationLogger.logIntegrationEvent('backend', 'frontend', 'game_stats_update', data);
    });
    
    // AI performance updates
    socket.on('aiPerformanceUpdate', (data: AIPerformance) => {
      setAIPerformance(data);
      integrationLogger.logIntegrationEvent('ai_service', 'frontend', 'ai_performance_update', data);
    });
    
    // Historical games update
    socket.on('gameHistoryUpdate', (data: any[]) => {
      setGameHistory(data);
    });
    
    // Player stats update from backend
    socket.on('playerStatsUpdate', (data: PlayerStats) => {
      setStats(data);
      // Also save to localStorage
      localStorage.setItem('connect4EnhancedStats', JSON.stringify(data));
    });
    
    // Move explanation updates from ML Inference Engine
    socket.on('moveExplanation', (data: MoveExplanation) => {
      setCurrentMoveExplanation(data);
      setMoveHistory(prev => [data, ...prev].slice(0, 20)); // Keep last 20 moves
      integrationLogger.logIntegrationEvent('ml_inference', 'frontend', 'move_explanation', data);
    });
    
    // Board analysis updates from AI Coordination Module
    socket.on('boardAnalysis', (data: MoveAnalysis) => {
      setBoardAnalysis(data);
      integrationLogger.logIntegrationEvent('ai_coordination', 'frontend', 'board_analysis', data);
    });
    
    // Real-time move recommendations
    socket.on('moveRecommendations', (data: { recommendedMoves: MoveAnalysis['recommendedMoves'], movesToAvoid: MoveAnalysis['movesToAvoid'] }) => {
      setBoardAnalysis(prev => prev ? {
        ...prev,
        recommendedMoves: data.recommendedMoves,
        movesToAvoid: data.movesToAvoid
      } : null);
      integrationLogger.logIntegrationEvent('ai_coordination', 'frontend', 'move_recommendations', data);
    });
    
    // Immediate move analysis
    socket.on('immediateAnalysis', (data: MoveAnalysis['immediateAnalysis']) => {
      setBoardAnalysis(prev => prev ? {
        ...prev,
        immediateAnalysis: data
      } : null);
      integrationLogger.logIntegrationEvent('ai_coordination', 'frontend', 'immediate_analysis', data);
    });
    
    // Continuous learning insights
    socket.on('learningInsight', (data: any) => {
      if (boardAnalysis) {
        setBoardAnalysis(prev => prev ? {
          ...prev,
          continuousLearning: {
            ...prev.continuousLearning,
            recentInsights: [data.insight, ...prev.continuousLearning.recentInsights].slice(0, 5)
          }
        } : null);
      }
    });
    
    // Request initial data
    socket.emit('requestGameStats');
    socket.emit('requestAIPerformance');
    socket.emit('requestGameHistory');
    socket.emit('requestLatestMoveExplanation');
    socket.emit('requestBoardAnalysis');
    
    return () => {
      socket.off('gameStatsUpdate');
      socket.off('aiPerformanceUpdate');
      socket.off('gameHistoryUpdate');
      socket.off('playerStatsUpdate');
      socket.off('moveExplanation');
      socket.off('boardAnalysis');
      socket.off('moveRecommendations');
      socket.off('immediateAnalysis');
      socket.off('learningInsight');
    };
  }, []);

  const getWinRate = () => {
    const total = stats.wins + stats.losses + stats.draws;
    return total > 0 ? (stats.wins / total) * 100 : 0;
  };

  const getColumnAnalysis = () => {
    const columnCounts = Array(7).fill(0);
    history.forEach(move => {
      columnCounts[move.column]++;
    });
    return columnCounts;
  };

  const getPlayerMovePattern = () => {
    const playerMoves = history.filter(move => move.player === 'Red');
    const columnCounts = Array(7).fill(0);
    playerMoves.forEach(move => {
      columnCounts[move.column]++;
    });
    return columnCounts;
  };

  const getAiMovePattern = () => {
    const aiMoves = history.filter(move => move.player === 'Yellow');
    const columnCounts = Array(7).fill(0);
    aiMoves.forEach(move => {
      columnCounts[move.column]++;
    });
    return columnCounts;
  };

  // Enhanced move analysis functions
  const analyzeMoveType = (move: Move, moveIndex: number): EnhancedMove['moveType'] => {
    const column = move.column;

    // Opening moves (first 4 moves)
    if (moveIndex < 4) return 'opening';

    // Center columns (2, 3, 4) are strategic
    if (column >= 2 && column <= 4) return 'center';

    // Edge columns (0, 1, 5, 6)
    if (column <= 1 || column >= 5) return 'edge';

    // Check if it's defensive (blocking opponent)
    if (isDefensiveMove(move, moveIndex)) return 'defensive';

    // Check if it's offensive (creating threat)
    if (isOffensiveMove(move, moveIndex)) return 'offensive';

    return 'center';
  };

  const isDefensiveMove = (move: Move, moveIndex: number): boolean => {
    if (moveIndex === 0) return false;
    const previousMove = history[moveIndex - 1];
    // Simple heuristic: if playing in same column as opponent's last move
    return previousMove && previousMove.player !== move.player &&
      Math.abs(previousMove.column - move.column) <= 1;
  };

  const isOffensiveMove = (move: Move, moveIndex: number): boolean => {
    // Check if move creates multiple threats or continues a pattern
    const playerMoves = history.slice(0, moveIndex).filter(m => m.player === move.player);
    const sameColumnMoves = playerMoves.filter(m => m.column === move.column).length;
    return sameColumnMoves >= 1; // Building on previous moves
  };

  const evaluateMove = (move: Move, moveIndex: number): EnhancedMove['evaluation'] => {
    const column = move.column;

    // Center columns are generally better
    if (column === 3) return 'excellent';
    if (column === 2 || column === 4) return 'good';

    // Opening moves in center are good
    if (moveIndex < 2 && column >= 2 && column <= 4) return 'good';

    // Edge moves later in game can be questionable
    if (moveIndex > 6 && (column === 0 || column === 6)) return 'questionable';

    // Defensive moves are generally good
    if (isDefensiveMove(move, moveIndex)) return 'good';

    return 'neutral';
  };

  const getMoveConsequence = (move: Move, moveIndex: number): string => {
    const moveType = analyzeMoveType(move, moveIndex);

    switch (moveType) {
      case 'opening':
        return 'Sets up early game position';
      case 'center':
        return 'Controls center territory';
      case 'edge':
        return 'Claims edge territory';
      case 'defensive':
        return 'Blocks opponent threat';
      case 'offensive':
        return 'Creates new threat';
      default:
        return 'Develops position';
    }
  };

  const calculateTimeTaken = (move: Move, moveIndex: number): number => {
    // Simulate realistic thinking times
    const isPlayerMove = move.player === 'Red';
    const baseTime = isPlayerMove ? 2000 : 1500; // ms
    const variation = Math.random() * 1000;
    return Math.round(baseTime + variation);
  };

  const enhanceMove = (move: Move, index: number): EnhancedMove => {
    const timestamp = Date.now() - (history.length - index) * 5000; // Simulate timestamps
    return {
      ...move,
      moveNumber: index + 1,
      timestamp,
      moveType: analyzeMoveType(move, index),
      evaluation: evaluateMove(move, index),
      timeTaken: calculateTimeTaken(move, index),
      threats: Math.floor(Math.random() * 3), // Simulate threat count
      consequence: getMoveConsequence(move, index)
    };
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  const formatDuration = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const getMoveTypeIcon = (type: EnhancedMove['moveType']): string => {
    switch (type) {
      case 'opening': return '🚀';
      case 'center': return '🎯';
      case 'edge': return '🔄';
      case 'defensive': return '🛡️';
      case 'offensive': return '⚔️';
      case 'winning': return '👑';
      case 'blocking': return '🚫';
      default: return '📍';
    }
  };

  const getEvaluationColor = (evaluation: EnhancedMove['evaluation']): string => {
    switch (evaluation) {
      case 'excellent': return '#10b981';
      case 'good': return '#22c55e';
      case 'neutral': return '#94a3b8';
      case 'questionable': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const sections = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'stats', icon: '📈', label: 'Statistics' },
    { id: 'history', icon: '🎯', label: 'Move History' },
    { id: 'analytics', icon: '🔍', label: 'Analytics' },
    { id: 'achievements', icon: '🏆', label: 'Achievements' }
  ];

  const renderOverview = () => (
    <motion.div
      className="sidebar-section overview-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* AI Threat Meter */}
      <div className="section-card">
        <ThreatMeter level={aiLevel} isAdapting={aiJustLeveledUp} />
      </div>

      {/* Quick Stats */}
      <div className="section-card">
        <h3 className="section-title">Quick Stats</h3>
        <div className="quick-stats-grid">
          <div className="quick-stat">
            <div className="stat-value wins">{gameStats.playerWins || stats.wins}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value losses">{gameStats.aiWins || stats.losses}</div>
            <div className="stat-label">Losses</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value draws">{gameStats.draws || stats.draws}</div>
            <div className="stat-label">Draws</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value streak">{gameStats.winStreak || stats.winStreak}</div>
            <div className="stat-label">Best Streak</div>
          </div>
        </div>
      </div>

      {/* Current Game Info */}
      <div className="section-card">
        <h3 className="section-title">Current Game</h3>
        <div className="game-info">
          <div className="info-row">
            <span className="info-label">Moves Played:</span>
            <span className="info-value">{history.length}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Level:</span>
            <span className="info-value">{aiLevel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">AI:</span>
            <span className="info-value" style={{ color: currentAI?.color || '#fff' }}>
              {currentAI?.name || 'Genesis'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStats = () => (
    <motion.div
      className="sidebar-section stats-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Detailed Statistics */}
      <div className="section-card">
        <h3 className="section-title">Performance Metrics</h3>

        {/* Win Rate Circle */}
        <div className="win-rate-circle">
          <motion.div
            className="circle-progress"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, type: 'spring' }}
          >
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <motion.circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={getWinRate() > 60 ? '#10b981' : getWinRate() > 30 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: getWinRate() / 100 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                style={{
                  transformOrigin: "50% 50%",
                  transform: "rotate(-90deg)"
                }}
                strokeDasharray={`${2 * Math.PI * 54}`}
              />
            </svg>
            <div className="circle-text">
              <div className="percentage">{getWinRate().toFixed(1)}%</div>
              <div className="label">Win Rate</div>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎮</div>
            <div className="stat-number">{gameStats.totalGames || stats.totalGamesPlayed}</div>
            <div className="stat-text">Total Games</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏁</div>
            <div className="stat-number">{gameStats.averageGameLength.toFixed(1)}</div>
            <div className="stat-text">Avg Moves</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚀</div>
            <div className="stat-number">{stats.highestLevelReached}</div>
            <div className="stat-text">Highest Level</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-number">{gameStats.currentStreak}</div>
            <div className="stat-text">{gameStats.currentStreakType === 'win' ? 'Win' : gameStats.currentStreakType === 'loss' ? 'Loss' : ''} Streak</div>
          </div>
        </div>
        
        {/* AI Performance Metrics */}
        <div className="ai-performance-metrics">
          <h4 className="subsection-title">AI Performance</h4>
          <div className="ai-metrics-grid">
            <div className="ai-metric">
              <span className="metric-label">Model:</span>
              <span className="metric-value">{aiPerformance.model}</span>
            </div>
            <div className="ai-metric">
              <span className="metric-label">Accuracy:</span>
              <span className="metric-value">{(aiPerformance.accuracy * 100).toFixed(1)}%</span>
            </div>
            <div className="ai-metric">
              <span className="metric-label">Response Time:</span>
              <span className="metric-value">{aiPerformance.avgResponseTime.toFixed(0)}ms</span>
            </div>
            <div className="ai-metric">
              <span className="metric-label">Learning Progress:</span>
              <span className="metric-value">{(aiPerformance.learningProgress * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trend */}
      <div className="section-card">
        <h3 className="section-title">Performance Trend</h3>
        <div className="trend-indicator">
          {stats.winStreak > 0 ? (
            <div className="trend-up">
              <span className="trend-icon">📈</span>
              <span className="trend-text">On a {stats.winStreak} game win streak!</span>
            </div>
          ) : (
            <div className="trend-neutral">
              <span className="trend-icon">📊</span>
              <span className="trend-text">Keep playing to build your streak!</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderHistory = () => {
    const enhancedMoves = history.map((move, index) => enhanceMove(move, index));

    return (
      <motion.div
        className="sidebar-section history-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="section-card">
          <h3 className="section-title">Detailed Move History ({history.length})</h3>

          {/* Game Summary */}
          {history.length > 0 && (
            <div className="game-summary">
              <div className="summary-stats">
                <div className="summary-item">
                  <span className="summary-label">Game Duration:</span>
                  <span className="summary-value">
                    {Math.floor(history.length * 2.5)} minutes
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Avg Time/Move:</span>
                  <span className="summary-value">2.1s</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Game Pace:</span>
                  <span className="summary-value">
                    {history.length < 10 ? 'Fast ⚡' : history.length < 20 ? 'Medium 🚶' : 'Slow 🐌'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty-history">
                <span className="empty-icon">🎯</span>
                <span className="empty-text">No moves yet - start playing!</span>
              </div>
            ) : (
              enhancedMoves.map((move, idx) => (
                <motion.div
                  key={idx}
                  className="enhanced-history-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                >
                  {/* Main move info */}
                  <div className="move-header">
                    <div className="move-number-badge">#{move.moveNumber}</div>
                    <div className={`move-player ${move.player.toLowerCase()}`}>
                      <span className="player-disc"></span>
                      <span className="player-name">{move.player}</span>
                    </div>
                    <div className="move-time">
                      {formatTime(move.timestamp)}
                    </div>
                  </div>

                  {/* Move details */}
                  <div className="move-details">
                    <div className="move-main-info">
                      <div className="column-info">
                        <span className="column-label">Column:</span>
                        <span className="column-value">{move.column + 1}</span>
                      </div>
                      <div className="move-type">
                        <span className="type-icon">{getMoveTypeIcon(move.moveType)}</span>
                        <span className="type-text">{move.moveType}</span>
                      </div>
                      <div
                        className="move-evaluation"
                        style={{ color: getEvaluationColor(move.evaluation) }}
                      >
                        <span className="eval-dot" style={{ backgroundColor: getEvaluationColor(move.evaluation) }}></span>
                        <span className="eval-text">{move.evaluation}</span>
                      </div>
                    </div>

                    <div className="move-analytics">
                      <div className="analytics-row">
                        <div className="analytics-item">
                          <span className="analytics-icon">⏱️</span>
                          <span className="analytics-text">Think: {formatDuration(move.timeTaken)}</span>
                        </div>
                        <div className="analytics-item">
                          <span className="analytics-icon">⚡</span>
                          <span className="analytics-text">Threats: {move.threats}</span>
                        </div>
                      </div>
                      <div className="move-consequence">
                        <span className="consequence-icon">💡</span>
                        <span className="consequence-text">{move.consequence}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        
        {/* Historical Games */}
        {gameHistory.length > 0 && (
          <div className="section-card">
            <h3 className="section-title">Recent Games History</h3>
            <div className="games-history-list">
              {gameHistory.slice(0, 5).map((game, idx) => (
                <div key={idx} className="historical-game-item">
                  <div className="game-header">
                    <span className="game-number">Game #{game.id || idx + 1}</span>
                    <span className="game-date">{new Date(game.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="game-details">
                    <div className="game-stat">
                      <span className="stat-icon">{game.winner === 'player' ? '🏆' : game.winner === 'ai' ? '🤖' : '🤝'}</span>
                      <span className="stat-text">
                        {game.winner === 'player' ? 'You won' : game.winner === 'ai' ? 'AI won' : 'Draw'}
                      </span>
                    </div>
                    <div className="game-stat">
                      <span className="stat-icon">🎯</span>
                      <span className="stat-text">{game.moves} moves</span>
                    </div>
                    <div className="game-stat">
                      <span className="stat-icon">⏱️</span>
                      <span className="stat-text">{game.duration}min</span>
                    </div>
                    <div className="game-stat">
                      <span className="stat-icon">🎮</span>
                      <span className="stat-text">Level {game.aiLevel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderAnalytics = () => {
    return (
      <motion.div
        className="sidebar-section analytics-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Latest Move Explanation */}
        <div className="section-card">
          <h3 className="section-title">Move Explanation</h3>
          {currentMoveExplanation ? (
            <div className="move-explanation">
              <div className="move-header">
                <span className="move-player">{currentMoveExplanation.player}</span>
                <span className="move-column">Column {currentMoveExplanation.column + 1}</span>
                <span className="confidence-badge" style={{
                  background: currentMoveExplanation.confidence.score > 0.8 ? 'rgba(34, 197, 94, 0.2)' :
                             currentMoveExplanation.confidence.score > 0.6 ? 'rgba(251, 191, 36, 0.2)' :
                             'rgba(239, 68, 68, 0.2)',
                  color: currentMoveExplanation.confidence.score > 0.8 ? '#22c55e' :
                         currentMoveExplanation.confidence.score > 0.6 ? '#fbbf24' :
                         '#ef4444'
                }}>
                  {(currentMoveExplanation.confidence.score * 100).toFixed(0)}% confident
                </span>
              </div>
              
              <div className="reasoning-section">
                <h4>AI Reasoning</h4>
                <p className="primary-reason">{currentMoveExplanation.reasoning.primary}</p>
                <div className="reasoning-factors">
                  {currentMoveExplanation.reasoning.factors.map((factor, idx) => (
                    <div key={idx} className="factor-item">
                      <span className="factor-icon">→</span>
                      <span className="factor-text">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="threat-assessment">
                <h4>Threat Level</h4>
                <div className={`threat-indicator ${currentMoveExplanation.reasoning.threatAssessment.level}`}>
                  <span className="threat-level">{currentMoveExplanation.reasoning.threatAssessment.level.toUpperCase()}</span>
                  <span className="threat-desc">{currentMoveExplanation.reasoning.threatAssessment.description}</span>
                </div>
              </div>
              
              <div className="ml-insights">
                <h4>ML Insights</h4>
                <div className="insight-grid">
                  <div className="insight-item">
                    <span className="label">Model:</span>
                    <span className="value">{currentMoveExplanation.mlInsights.modelUsed}</span>
                  </div>
                  <div className="insight-item">
                    <span className="label">Inference Time:</span>
                    <span className="value">{currentMoveExplanation.mlInsights.inferenceTime}ms</span>
                  </div>
                </div>
                
                {/* Top Features */}
                <div className="top-features">
                  <h5>Key Features</h5>
                  {currentMoveExplanation.mlInsights.features.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="feature-item">
                      <span className="feature-name">{feature.name}</span>
                      <div className="feature-bar">
                        <div className="feature-fill" style={{ width: `${feature.importance * 100}%` }} />
                      </div>
                      <span className="feature-value">{feature.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="coordination-data">
                <h4>Strategy Coordination</h4>
                <div className="strategies-list">
                  {currentMoveExplanation.coordinationData.strategies.map((strategy, idx) => (
                    <span key={idx} className="strategy-chip">{strategy}</span>
                  ))}
                </div>
                <div className="consensus-score">
                  <span className="label">Consensus:</span>
                  <span className="value">{(currentMoveExplanation.coordinationData.consensusScore * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {currentMoveExplanation.learningImpact.patternDetected && (
                <div className="learning-impact">
                  <h4>Learning Impact</h4>
                  <div className="impact-badge pattern">
                    Pattern Detected: {currentMoveExplanation.learningImpact.patternType}
                  </div>
                  {currentMoveExplanation.learningImpact.adaptationTriggered && (
                    <div className="impact-badge adaptation">
                      Adaptation: {currentMoveExplanation.learningImpact.learningUpdate}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-data">
              <p>No move explanation available yet. Make a move to see AI reasoning!</p>
            </div>
          )}
        </div>

        {/* Board Analysis */}
        <div className="section-card">
          <h3 className="section-title">Board Analysis</h3>
          {boardAnalysis ? (
            <div className="board-analysis">
              {/* Board State */}
              <div className="board-state-section">
                <h4>Board State</h4>
                <div className="state-metrics">
                  <div className="control-meter">
                    <span className="label">Board Control</span>
                    <div className="control-bars">
                      <div className="control-bar player" style={{ width: `${boardAnalysis.boardState.control.player}%` }}>
                        {boardAnalysis.boardState.control.player}%
                      </div>
                      <div className="control-bar contested" style={{ width: `${boardAnalysis.boardState.control.contested}%` }}>
                        {boardAnalysis.boardState.control.contested}%
                      </div>
                      <div className="control-bar ai" style={{ width: `${boardAnalysis.boardState.control.ai}%` }}>
                        {boardAnalysis.boardState.control.ai}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="threats-opportunities">
                    <div className="threats">
                      <h5>Threats ({boardAnalysis.boardState.threats.length})</h5>
                      {boardAnalysis.boardState.threats.slice(0, 3).map((threat, idx) => (
                        <div key={idx} className="threat-item">
                          <span className="position">({threat.position[0]}, {threat.position[1]})</span>
                          <span className="type">{threat.type}</span>
                          <span className="severity level-{threat.severity}">L{threat.severity}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="opportunities">
                      <h5>Opportunities ({boardAnalysis.boardState.opportunities.length})</h5>
                      {boardAnalysis.boardState.opportunities.slice(0, 3).map((opp, idx) => (
                        <div key={idx} className="opportunity-item">
                          <span className="position">({opp.position[0]}, {opp.position[1]})</span>
                          <span className="type">{opp.type}</span>
                          <span className="value">+{opp.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Strategic Assessment */}
              <div className="strategic-assessment">
                <h4>Strategic Assessment</h4>
                <div className="current-strategy">
                  <span className="label">Current Strategy:</span>
                  <span className="strategy-name">{boardAnalysis.strategicAssessment.currentStrategy}</span>
                  <div className="effectiveness-meter">
                    <div className="effectiveness-fill" style={{ width: `${boardAnalysis.strategicAssessment.effectiveness * 100}%` }} />
                    <span className="effectiveness-value">{(boardAnalysis.strategicAssessment.effectiveness * 100).toFixed(0)}% effective</span>
                  </div>
                </div>
                
                <div className="alternative-strategies">
                  <h5>Alternative Strategies</h5>
                  {boardAnalysis.strategicAssessment.alternativeStrategies.map((alt, idx) => (
                    <div key={idx} className="alt-strategy">
                      <span className="name">{alt.name}</span>
                      <span className="score">{(alt.score * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                
                <div className="recommendation">
                  <span className="rec-icon">💡</span>
                  <span className="rec-text">{boardAnalysis.strategicAssessment.recommendation}</span>
                </div>
              </div>

              {/* Immediate Analysis */}
              {boardAnalysis.immediateAnalysis && (
                <div className={`immediate-analysis urgency-${boardAnalysis.immediateAnalysis.urgency}`}>
                  <h4>
                    <span className="urgency-icon">
                      {boardAnalysis.immediateAnalysis.urgency === 'critical' ? '🚨' : 
                       boardAnalysis.immediateAnalysis.urgency === 'high' ? '⚠️' : 
                       boardAnalysis.immediateAnalysis.urgency === 'medium' ? '📊' : '✓'}
                    </span>
                    Immediate Analysis
                  </h4>
                  <div className="immediate-content">
                    {boardAnalysis.immediateAnalysis.criticalMove && (
                      <div className="critical-alert">⚡ CRITICAL MOVE DETECTED</div>
                    )}
                    <div className="time-recommendation">
                      {boardAnalysis.immediateAnalysis.timeRecommendation}
                    </div>
                    <div className="key-factors">
                      <span className="factors-label">Key Factors:</span>
                      <ul>
                        {boardAnalysis.immediateAnalysis.keyFactors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Moves */}
              {boardAnalysis.recommendedMoves && boardAnalysis.recommendedMoves.length > 0 && (
                <div className="recommended-moves">
                  <h4>✅ Recommended Moves</h4>
                  <div className="moves-list">
                    {boardAnalysis.recommendedMoves.map((move, idx) => (
                      <div key={idx} className="recommended-move">
                        <div className="move-header">
                          <span className="column-indicator">Column {move.column + 1}</span>
                          <span className="move-score">{(move.score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="move-reasoning">{move.reasoning}</div>
                        <div className="move-outcome">{move.outcome}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moves to Avoid */}
              {boardAnalysis.movesToAvoid && boardAnalysis.movesToAvoid.length > 0 && (
                <div className="moves-to-avoid">
                  <h4>⚠️ Moves to Avoid</h4>
                  <div className="moves-list">
                    {boardAnalysis.movesToAvoid.map((move, idx) => (
                      <div key={idx} className="avoid-move">
                        <div className="move-header">
                          <span className="column-indicator">Column {move.column + 1}</span>
                          <span className="risk-level" style={{
                            color: move.risk > 0.8 ? '#f44336' : 
                                   move.risk > 0.5 ? '#ff9800' : '#ffc107'
                          }}>
                            Risk: {(move.risk * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="move-warning">{move.warning}</div>
                        <div className="move-consequence">{move.consequence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Predicted Outcome */}
              <div className="predicted-outcome">
                <h4>Predicted Outcome</h4>
                <div className="win-probabilities">
                  <div className="prob-item player">
                    <span className="label">Player Win</span>
                    <div className="prob-bar">
                      <div className="prob-fill" style={{ width: `${boardAnalysis.predictedOutcome.winProbability.player * 100}%` }} />
                    </div>
                    <span className="prob-value">{(boardAnalysis.predictedOutcome.winProbability.player * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-item ai">
                    <span className="label">AI Win</span>
                    <div className="prob-bar">
                      <div className="prob-fill" style={{ width: `${boardAnalysis.predictedOutcome.winProbability.ai * 100}%` }} />
                    </div>
                    <span className="prob-value">{(boardAnalysis.predictedOutcome.winProbability.ai * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-item draw">
                    <span className="label">Draw</span>
                    <div className="prob-bar">
                      <div className="prob-fill" style={{ width: `${boardAnalysis.predictedOutcome.winProbability.draw * 100}%` }} />
                    </div>
                    <span className="prob-value">{(boardAnalysis.predictedOutcome.winProbability.draw * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="moves-remaining">
                  Estimated moves remaining: {boardAnalysis.predictedOutcome.estimatedMovesRemaining}
                </div>
              </div>
              
              {/* Continuous Learning */}
              <div className="continuous-learning">
                <h4>Continuous Learning</h4>
                <div className="learning-metrics">
                  <div className="metric">
                    <span className="label">Adaptation Level:</span>
                    <span className="value">{(boardAnalysis.continuousLearning.adaptationLevel * 100).toFixed(0)}%</span>
                  </div>
                  <div className="metric">
                    <span className="label">Learning Rate:</span>
                    <span className="value">{boardAnalysis.continuousLearning.learningRate.toFixed(4)}</span>
                  </div>
                </div>
                
                <div className="active-patterns">
                  <h5>Active Patterns</h5>
                  <div className="pattern-chips">
                    {boardAnalysis.continuousLearning.patternsActive.map((pattern, idx) => (
                      <span key={idx} className="pattern-chip">{pattern}</span>
                    ))}
                  </div>
                </div>
                
                {boardAnalysis.continuousLearning.recentInsights.length > 0 && (
                  <div className="recent-insights">
                    <h5>Recent Insights</h5>
                    {boardAnalysis.continuousLearning.recentInsights.map((insight, idx) => (
                      <div key={idx} className="insight-item">
                        <span className="insight-icon">💡</span>
                        <span className="insight-text">{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-data">
              <p>No board analysis available. Start playing to see strategic insights!</p>
            </div>
          )}
        </div>

        {/* Move History Analysis */}
        <div className="section-card">
          <h3 className="section-title">Recent Move History</h3>
          <div className="move-history-list">
            {moveHistory.slice(0, 5).map((move, idx) => (
              <div key={idx} className="history-move-item">
                <div className="move-summary">
                  <span className="move-number">Move #{history.length - idx}</span>
                  <span className="move-player-chip {move.player.toLowerCase()}">{move.player}</span>
                  <span className="move-col">Col {move.column + 1}</span>
                  <span className="confidence-mini">{(move.confidence.score * 100).toFixed(0)}%</span>
                </div>
                <div className="move-reason">{move.reasoning.primary}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderAchievements = () => (
    <motion.div
      className="sidebar-section achievements-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="section-card">
        <h3 className="section-title">Achievements</h3>
        <div className="achievements-grid">
          {/* Win Streak Achievements */}
          <div className={`achievement ${stats.winStreak >= 3 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">🔥</div>
            <div className="achievement-info">
              <div className="achievement-name">Hot Streak</div>
              <div className="achievement-desc">Win 3 games in a row</div>
            </div>
          </div>

          {/* Level Achievements */}
          <div className={`achievement ${stats.highestLevelReached >= 5 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">🚀</div>
            <div className="achievement-info">
              <div className="achievement-name">Rising Star</div>
              <div className="achievement-desc">Reach level 5</div>
            </div>
          </div>

          {/* Games Played Achievements */}
          <div className={`achievement ${stats.totalGamesPlayed >= 10 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">🎮</div>
            <div className="achievement-info">
              <div className="achievement-name">Dedicated Player</div>
              <div className="achievement-desc">Play 10 games</div>
            </div>
          </div>

          {/* Win Rate Achievements */}
          <div className={`achievement ${getWinRate() >= 75 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">👑</div>
            <div className="achievement-info">
              <div className="achievement-name">Champion</div>
              <div className="achievement-desc">75% win rate</div>
            </div>
          </div>

          {/* Perfect Game Achievement */}
          <div className={`achievement ${stats.averageMovesPerGame > 0 && stats.averageMovesPerGame <= 7 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">⚡</div>
            <div className="achievement-info">
              <div className="achievement-name">Lightning Fast</div>
              <div className="achievement-desc">Average under 7 moves</div>
            </div>
          </div>

          {/* Nightmare Mode Achievement */}
          <div className={`achievement ${stats.highestLevelReached >= 21 ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">💀</div>
            <div className="achievement-info">
              <div className="achievement-name">Nightmare Survivor</div>
              <div className="achievement-desc">Reach nightmare mode</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="enhanced-sidebar"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">Game Dashboard</div>
        <button onClick={onClose} className="close-button">
          <span className="close-icon">×</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`nav-button ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id as SidebarSection)}
          >
            <span className="nav-icon">{section.icon}</span>
            <span className="nav-label">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="sidebar-content">
        <AnimatePresence mode="wait">
          {activeSection === 'overview' && renderOverview()}
          {activeSection === 'stats' && renderStats()}
          {activeSection === 'history' && renderHistory()}
          {activeSection === 'analytics' && renderAnalytics()}
          {activeSection === 'achievements' && renderAchievements()}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Sidebar;
