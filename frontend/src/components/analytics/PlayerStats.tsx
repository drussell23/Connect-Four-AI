// frontend/src/components/analytics/PlayerStats.tsx
import React, { useEffect, useState } from 'react';
import { PlayerPerformance, WinRateAnalysis } from '../../api/analytics';
import { getPlayerStats, getWinRateAnalysis as getWinRateData } from '../../services/playerStatsService';
import './PlayerStats.css';

interface PlayerStatsProps {
    playerId: string;
    isVisible: boolean;
    onClose: () => void;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ playerId, isVisible, onClose }) => {
    const [stats, setStats] = useState<PlayerPerformance | null>(null);
    const [winRateData, setWinRateData] = useState<WinRateAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');

    useEffect(() => {
        if (isVisible && playerId) {
            loadPlayerData();
        }
    }, [isVisible, playerId, timeframe]);

    const loadPlayerData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [playerStats, winRate] = await Promise.all([
                getPlayerStats(playerId),
                getWinRateData(playerId, timeframe)
            ]);

            setStats(playerStats);
            setWinRateData(winRate);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load player stats');
            console.error('Error loading player stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const getSkillLevelColor = (level: string) => {
        switch (level) {
            case 'expert': return '#ff6b6b';
            case 'advanced': return '#4ecdc4';
            case 'intermediate': return '#45b7d1';
            case 'beginner': return '#96ceb4';
            default: return '#feca57';
        }
    };

    const getWinRateColor = (rate: number) => {
        if (rate >= 70) return '#2ecc71';
        if (rate >= 50) return '#f39c12';
        return '#e74c3c';
    };

    if (!isVisible) return null;

    return (
        <div className="player-stats-overlay">
            <div className="player-stats-modal">
                <div className="player-stats-header">
                    <h2>Player Statistics</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {loading && (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading player statistics...</p>
                    </div>
                )}

                {error && (
                    <div className="error-container">
                        <p className="error-message">⚠️ {error}</p>
                        <button onClick={loadPlayerData} className="retry-btn">Retry</button>
                    </div>
                )}

                {stats && !loading && (
                    <div className="player-stats-content">
                        {/* Basic Stats */}
                        <div className="stats-section">
                            <h3>Performance Overview</h3>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-value">{stats.totalGames}</div>
                                    <div className="stat-label">Total Games</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value" style={{ color: getWinRateColor(stats.winRate) }}>
                                        {stats.winRate.toFixed(1)}%
                                    </div>
                                    <div className="stat-label">Win Rate</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.wins}</div>
                                    <div className="stat-label">Wins</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.losses}</div>
                                    <div className="stat-label">Losses</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.draws}</div>
                                    <div className="stat-label">Draws</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.bestWinStreak}</div>
                                    <div className="stat-label">Best Streak</div>
                                </div>
                            </div>
                        </div>

                        {/* Skill Level */}
                        <div className="stats-section">
                            <h3>Skill Level</h3>
                            <div className="skill-level-container">
                                <div
                                    className="skill-level-badge"
                                    style={{ backgroundColor: getSkillLevelColor(stats.skillLevel) }}
                                >
                                    {stats.skillLevel.toUpperCase()}
                                </div>
                                <div className="skill-progress">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${stats.improvementRate * 100}%`,
                                                backgroundColor: getSkillLevelColor(stats.skillLevel)
                                            }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">
                                        {Math.round(stats.improvementRate * 100)}% improvement
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Game Metrics */}
                        <div className="stats-section">
                            <h3>Game Metrics</h3>
                            <div className="metrics-grid">
                                <div className="metric-item">
                                    <span className="metric-label">Average Game Duration:</span>
                                    <span className="metric-value">{Math.round(stats.averageGameDuration / 1000)}s</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Average Moves per Game:</span>
                                    <span className="metric-value">{stats.averageMovesPerGame}</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Average Move Time:</span>
                                    <span className="metric-value">{Math.round(stats.averageMoveTime / 1000)}s</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Accuracy Rate:</span>
                                    <span className="metric-value">{stats.accuracyRate.toFixed(1)}%</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Total Play Time:</span>
                                    <span className="metric-value">{Math.round(stats.totalPlayTime / 60000)}m</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Last Played:</span>
                                    <span className="metric-value">
                                        {new Date(stats.lastPlayed).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Win Rate Analysis */}
                        {winRateData && (
                            <div className="stats-section">
                                <h3>Win Rate Analysis</h3>
                                <div className="timeframe-selector">
                                    <button
                                        className={timeframe === 'week' ? 'active' : ''}
                                        onClick={() => setTimeframe('week')}
                                    >
                                        Week
                                    </button>
                                    <button
                                        className={timeframe === 'month' ? 'active' : ''}
                                        onClick={() => setTimeframe('month')}
                                    >
                                        Month
                                    </button>
                                    <button
                                        className={timeframe === 'year' ? 'active' : ''}
                                        onClick={() => setTimeframe('year')}
                                    >
                                        Year
                                    </button>
                                </div>
                                <div className="trend-analysis">
                                    <div className="trend-item">
                                        <span className="trend-label">Overall Trend:</span>
                                        <span className={`trend-value ${winRateData.trends.overallTrend}`}>
                                            {winRateData.trends.overallTrend}
                                        </span>
                                    </div>
                                    <div className="trend-item">
                                        <span className="trend-label">Recent Performance:</span>
                                        <span className="trend-value">{winRateData.trends.recentPerformance.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Achievements */}
                        {stats.achievements.length > 0 && (
                            <div className="stats-section">
                                <h3>Achievements</h3>
                                <div className="achievements-grid">
                                    {stats.achievements.map(achievement => (
                                        <div key={achievement.id} className="achievement-card">
                                            <div className="achievement-icon">{achievement.icon}</div>
                                            <div className="achievement-info">
                                                <div className="achievement-name">{achievement.name}</div>
                                                <div className="achievement-description">{achievement.description}</div>
                                                <div className="achievement-progress">
                                                    {achievement.progress}/{achievement.maxProgress}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerStats; 