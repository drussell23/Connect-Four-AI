import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreatMeter from './ThreatMeter';
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
            <div className="stat-value wins">{stats.wins}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value losses">{stats.losses}</div>
            <div className="stat-label">Losses</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value draws">{stats.draws}</div>
            <div className="stat-label">Draws</div>
          </div>
          <div className="quick-stat">
            <div className="stat-value streak">{stats.winStreak}</div>
            <div className="stat-label">Win Streak</div>
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
            <div className="stat-number">{stats.totalGamesPlayed}</div>
            <div className="stat-text">Total Games</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏁</div>
            <div className="stat-number">{stats.averageMovesPerGame.toFixed(1)}</div>
            <div className="stat-text">Avg Moves</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🚀</div>
            <div className="stat-number">{stats.highestLevelReached}</div>
            <div className="stat-text">Highest Level</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-number">{stats.currentLevelWins}</div>
            <div className="stat-text">Level Wins</div>
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
      </motion.div>
    );
  };

  const renderAnalytics = () => {
    const columnAnalysis = getColumnAnalysis();
    const playerPattern = getPlayerMovePattern();
    const aiPattern = getAiMovePattern();
    const maxMoves = Math.max(...columnAnalysis, 1);

    return (
      <motion.div
        className="sidebar-section analytics-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Column Usage Analysis */}
        <div className="section-card">
          <h3 className="section-title">Column Usage</h3>
          <div className="column-analysis">
            {columnAnalysis.map((count, idx) => (
              <div key={idx} className="column-bar">
                <div className="column-label">C{idx + 1}</div>
                <div className="bar-container">
                  <motion.div
                    className="usage-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / maxMoves) * 100}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                  />
                </div>
                <div className="column-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Move Patterns */}
        <div className="section-card">
          <h3 className="section-title">Move Patterns</h3>
          <div className="pattern-comparison">
            <div className="pattern-section">
              <h4 className="pattern-title">Your Pattern</h4>
              <div className="pattern-bars">
                {playerPattern.map((count, idx) => (
                  <div key={idx} className="pattern-bar red">
                    <div
                      className="bar-fill"
                      style={{ height: `${(count / Math.max(...playerPattern, 1)) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="pattern-section">
              <h4 className="pattern-title">AI Pattern</h4>
              <div className="pattern-bars">
                {aiPattern.map((count, idx) => (
                  <div key={idx} className="pattern-bar yellow">
                    <div
                      className="bar-fill"
                      style={{ height: `${(count / Math.max(...aiPattern, 1)) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Game Insights */}
        <div className="section-card">
          <h3 className="section-title">Game Insights</h3>
          <div className="insights-list">
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span className="insight-text">
                Most used column: {columnAnalysis.indexOf(Math.max(...columnAnalysis)) + 1}
              </span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">⚡</span>
              <span className="insight-text">
                Game pace: {history.length < 10 ? 'Fast' : history.length < 20 ? 'Medium' : 'Slow'}
              </span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">🧠</span>
              <span className="insight-text">
                Strategy: {playerPattern.some(count => count > 2) ? 'Focused' : 'Distributed'}
              </span>
            </div>
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
