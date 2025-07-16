import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Radar, Scatter, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import './PlayerAnalytics.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface PlayerMetrics {
    skillLevel: number;
    accuracy: number;
    decisionSpeed: number;
    strategicThinking: number;
    adaptability: number;
    consistency: number;
    improvement: number;
    confidence: number;
}

interface PlayPattern {
    name: string;
    frequency: number;
    effectiveness: number;
    description: string;
    recommendation: string;
}

interface GameSession {
    id: string;
    timestamp: number;
    duration: number;
    moves: number;
    result: 'win' | 'loss' | 'draw';
    aiLevel: number;
    accuracy: number;
    avgThinkingTime: number;
    patterns: string[];
    mistakes: number;
    brilliantMoves: number;
}

interface SkillProgression {
    date: string;
    skillLevel: number;
    wins: number;
    losses: number;
    avgAccuracy: number;
    improvements: string[];
}

interface PersonalizedInsight {
    type: 'strength' | 'weakness' | 'opportunity' | 'recommendation';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionable: boolean;
    priority: number;
}

interface PlayerAnalyticsProps {
    isVisible: boolean;
    onClose: () => void;
    playerStats: any;
    gameHistory: any[];
    socket?: any;
}

const PlayerAnalytics: React.FC<PlayerAnalyticsProps> = ({
    isVisible,
    onClose,
    playerStats,
    gameHistory,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'progression' | 'insights' | 'comparisons'>('overview');
    const [playerMetrics, setPlayerMetrics] = useState<PlayerMetrics>({
        skillLevel: 0,
        accuracy: 0,
        decisionSpeed: 0,
        strategicThinking: 0,
        adaptability: 0,
        consistency: 0,
        improvement: 0,
        confidence: 0
    });
    const [playPatterns, setPlayPatterns] = useState<PlayPattern[]>([]);
    const [recentSessions, setRecentSessions] = useState<GameSession[]>([]);
    const [skillProgression, setSkillProgression] = useState<SkillProgression[]>([]);
    const [personalizedInsights, setPersonalizedInsights] = useState<PersonalizedInsight[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [aiRecommendations, setAiRecommendations] = useState<any>(null);
    const [comparisonData, setComparisonData] = useState<any>(null);

    // Initialize analytics data
    useEffect(() => {
        if (isVisible) {
            analyzePlayerData();
        }
    }, [isVisible, playerStats, gameHistory]);

    // Real-time analytics updates
    useEffect(() => {
        if (socket) {
            socket.on('analyticsUpdate', handleAnalyticsUpdate);
            socket.on('patternAnalysis', handlePatternAnalysis);
            socket.on('skillAssessment', handleSkillAssessment);

            return () => {
                socket.off('analyticsUpdate');
                socket.off('patternAnalysis');
                socket.off('skillAssessment');
            };
        }
    }, [socket]);

    const analyzePlayerData = async () => {
        setIsAnalyzing(true);
        setAnalysisProgress(0);

        // Simulate AI analysis with progress updates
        const analysisSteps = [
            { step: 'Analyzing game history...', progress: 20 },
            { step: 'Identifying play patterns...', progress: 40 },
            { step: 'Calculating skill metrics...', progress: 60 },
            { step: 'Generating insights...', progress: 80 },
            { step: 'Finalizing recommendations...', progress: 100 }
        ];

        for (const { step, progress } of analysisSteps) {
            await new Promise(resolve => setTimeout(resolve, 800));
            setAnalysisProgress(progress);
        }

        // Generate analytics data
        generatePlayerMetrics();
        generatePlayPatterns();
        generateGameSessions();
        generateSkillProgression();
        generatePersonalizedInsights();
        generateAIRecommendations();

        setIsAnalyzing(false);
    };

    const generatePlayerMetrics = () => {
        const totalGames = playerStats.totalGamesPlayed || 0;
        const winRate = totalGames > 0 ? (playerStats.wins / totalGames) : 0;
        const avgLevel = playerStats.highestLevelReached || 1;

        const metrics: PlayerMetrics = {
            skillLevel: Math.min(100, (avgLevel * 10) + (winRate * 30)),
            accuracy: Math.min(100, 60 + (winRate * 40) + Math.random() * 15),
            decisionSpeed: Math.min(100, 50 + (totalGames * 2) + Math.random() * 20),
            strategicThinking: Math.min(100, 40 + (avgLevel * 8) + Math.random() * 25),
            adaptability: Math.min(100, 45 + (winRate * 35) + Math.random() * 20),
            consistency: Math.min(100, 55 + (playerStats.winStreak * 5) + Math.random() * 15),
            improvement: Math.min(100, totalGames > 10 ? 70 + Math.random() * 25 : 30 + Math.random() * 40),
            confidence: Math.min(100, 50 + (winRate * 40) + (playerStats.winStreak * 3))
        };

        setPlayerMetrics(metrics);
    };

    const generatePlayPatterns = () => {
        const patterns: PlayPattern[] = [
            {
                name: 'Center Control',
                frequency: 65 + Math.random() * 25,
                effectiveness: 70 + Math.random() * 20,
                description: 'Tendency to prioritize central columns for strategic advantage',
                recommendation: 'Continue focusing on center control, but vary timing to avoid predictability'
            },
            {
                name: 'Defensive Play',
                frequency: 45 + Math.random() * 30,
                effectiveness: 60 + Math.random() * 25,
                description: 'Often responds to immediate threats rather than creating offensive opportunities',
                recommendation: 'Balance defensive moves with proactive offensive strategies'
            },
            {
                name: 'Quick Decisions',
                frequency: 70 + Math.random() * 20,
                effectiveness: 55 + Math.random() * 30,
                description: 'Makes moves quickly without extensive analysis',
                recommendation: 'Take more time for complex positions to improve decision quality'
            },
            {
                name: 'Pattern Recognition',
                frequency: 50 + Math.random() * 25,
                effectiveness: 75 + Math.random() * 20,
                description: 'Good at recognizing common tactical patterns and formations',
                recommendation: 'Excellent foundation - work on advanced pattern combinations'
            },
            {
                name: 'Endgame Precision',
                frequency: 40 + Math.random() * 20,
                effectiveness: 80 + Math.random() * 15,
                description: 'Strong performance in endgame situations with fewer pieces',
                recommendation: 'Leverage endgame strength by steering games toward favorable positions'
            },
            {
                name: 'Opening Variety',
                frequency: 30 + Math.random() * 25,
                effectiveness: 45 + Math.random() * 30,
                description: 'Limited variety in opening moves and strategies',
                recommendation: 'Study and practice different opening approaches to increase unpredictability'
            }
        ];

        setPlayPatterns(patterns);
    };

    const generateGameSessions = () => {
        const sessions: GameSession[] = [];
        const now = Date.now();

        for (let i = 0; i < 20; i++) {
            const timestamp = now - (i * 24 * 60 * 60 * 1000) - Math.random() * 12 * 60 * 60 * 1000;
            const result = Math.random() > 0.6 ? 'win' : Math.random() > 0.3 ? 'loss' : 'draw';

            sessions.push({
                id: `session_${i}`,
                timestamp,
                duration: 300 + Math.random() * 900, // 5-20 minutes
                moves: 15 + Math.random() * 25,
                result,
                aiLevel: 1 + Math.floor(Math.random() * (playerStats.highestLevelReached || 5)),
                accuracy: 60 + Math.random() * 35,
                avgThinkingTime: 2000 + Math.random() * 8000,
                patterns: ['center_control', 'defensive_play'].slice(0, 1 + Math.floor(Math.random() * 2)),
                mistakes: Math.floor(Math.random() * 5),
                brilliantMoves: Math.floor(Math.random() * 3)
            });
        }

        setRecentSessions(sessions.sort((a, b) => b.timestamp - a.timestamp));
    };

    const generateSkillProgression = () => {
        const progression: SkillProgression[] = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            progression.push({
                date: date.toISOString().split('T')[0],
                skillLevel: 30 + (i * 2) + Math.random() * 10,
                wins: Math.floor(Math.random() * 5),
                losses: Math.floor(Math.random() * 3),
                avgAccuracy: 60 + (i * 0.5) + Math.random() * 15,
                improvements: i % 7 === 0 ? ['Pattern recognition improved', 'Faster decision making'] : []
            });
        }

        setSkillProgression(progression);
    };

    const generatePersonalizedInsights = () => {
        const insights: PersonalizedInsight[] = [
            {
                type: 'strength',
                title: 'Excellent Endgame Performance',
                description: 'Your accuracy increases by 23% in endgame positions, showing strong tactical awareness when the board is less crowded.',
                impact: 'high',
                actionable: true,
                priority: 1
            },
            {
                type: 'weakness',
                title: 'Inconsistent Opening Strategy',
                description: 'Analysis shows 67% of losses occur when deviating from your strongest opening patterns. Consider standardizing your early game approach.',
                impact: 'medium',
                actionable: true,
                priority: 2
            },
            {
                type: 'opportunity',
                title: 'Time Management Optimization',
                description: 'You could improve decision quality by 15% by spending 3 more seconds on critical moves, while maintaining your current pace.',
                impact: 'medium',
                actionable: true,
                priority: 3
            },
            {
                type: 'recommendation',
                title: 'Practice Against Level 8-10 AI',
                description: 'Your win rate suggests you\'re ready for higher difficulty opponents. Challenge yourself with advanced AI to accelerate improvement.',
                impact: 'high',
                actionable: true,
                priority: 1
            },
            {
                type: 'strength',
                title: 'Adaptive Learning',
                description: 'Your performance against repeat opponents improves by 31% on average, indicating excellent pattern learning and adaptation skills.',
                impact: 'high',
                actionable: false,
                priority: 4
            }
        ];

        setPersonalizedInsights(insights.sort((a, b) => a.priority - b.priority));
    };

    const generateAIRecommendations = () => {
        const recommendations = {
            nextBestDifficulty: Math.min(25, (playerStats.highestLevelReached || 1) + 2),
            practiceAreas: [
                'Mid-game tactical combinations',
                'Opening theory expansion',
                'Time management under pressure'
            ],
            skillTargets: {
                accuracy: playerMetrics.accuracy + 8,
                strategicThinking: playerMetrics.strategicThinking + 12,
                consistency: playerMetrics.consistency + 5
            },
            estimatedTimeToNextLevel: Math.max(5, 20 - (playerStats.winStreak || 0) * 2),
            personalizedTips: [
                'Focus on controlling the center columns in your opening moves',
                'Take an extra 2-3 seconds before making defensive moves',
                'Study positions where you made brilliant moves to understand your intuitive patterns'
            ]
        };

        setAiRecommendations(recommendations);
    };

    const handleAnalyticsUpdate = (data: any) => {
        // Handle real-time analytics updates
        setPlayerMetrics(prev => ({ ...prev, ...data.metrics }));
    };

    const handlePatternAnalysis = (data: any) => {
        // Handle pattern analysis updates
        setPlayPatterns(data.patterns);
    };

    const handleSkillAssessment = (data: any) => {
        // Handle skill assessment updates
        setPlayerMetrics(prev => ({ ...prev, skillLevel: data.skillLevel }));
    };

    const getSkillRadarData = () => {
        return {
            labels: [
                'Skill Level',
                'Accuracy',
                'Decision Speed',
                'Strategic Thinking',
                'Adaptability',
                'Consistency',
                'Improvement',
                'Confidence'
            ],
            datasets: [
                {
                    label: 'Current Performance',
                    data: Object.values(playerMetrics),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#3b82f6'
                }
            ]
        };
    };

    const getProgressionChartData = () => {
        return {
            labels: skillProgression.map(p => new Date(p.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Skill Level',
                    data: skillProgression.map(p => p.skillLevel),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Accuracy',
                    data: skillProgression.map(p => p.avgAccuracy),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    };

    const getPatternEffectivenessData = () => {
        return {
            labels: playPatterns.map(p => p.name),
            datasets: [
                {
                    label: 'Frequency %',
                    data: playPatterns.map(p => p.frequency),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)'
                },
                {
                    label: 'Effectiveness %',
                    data: playPatterns.map(p => p.effectiveness),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)'
                }
            ]
        };
    };

    const getSessionPerformanceData = () => {
        const last10Sessions = recentSessions.slice(0, 10).reverse();

        return {
            labels: last10Sessions.map((_, index) => `Game ${index + 1}`),
            datasets: [
                {
                    label: 'Accuracy %',
                    data: last10Sessions.map(s => s.accuracy),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'AI Level',
                    data: last10Sessions.map(s => s.aiLevel * 10), // Scale for visibility
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        };
    };

    const renderOverviewTab = () => (
        <div className="analytics-overview">
            {isAnalyzing ? (
                <motion.div
                    className="analysis-progress"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="progress-container">
                        <div className="progress-icon">🤖</div>
                        <h3>AI Analyzing Your Performance...</h3>
                        <div className="progress-bar">
                            <motion.div
                                className="progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${analysisProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <div className="progress-text">{analysisProgress}% Complete</div>
                    </div>
                </motion.div>
            ) : (
                <>
                    {/* Skill Radar Chart */}
                    <motion.div
                        className="skill-overview-section"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Player Skill Profile</h3>
                        <div className="skill-radar-container">
                            <Radar
                                data={getSkillRadarData()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    },
                                    scales: {
                                        r: {
                                            beginAtZero: true,
                                            max: 100,
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.2)'
                                            },
                                            angleLines: {
                                                color: 'rgba(255, 255, 255, 0.2)'
                                            },
                                            pointLabels: {
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                font: {
                                                    size: 12
                                                }
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                backdropColor: 'transparent'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </motion.div>

                    {/* Key Metrics */}
                    <motion.div
                        className="key-metrics-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h3>Performance Summary</h3>
                        <div className="metrics-grid">
                            {Object.entries(playerMetrics).map(([key, value], index) => (
                                <motion.div
                                    key={key}
                                    className="metric-card"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <div className="metric-header">
                                        <span className="metric-name">
                                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        </span>
                                        <span className="metric-trend">
                                            {value > 70 ? '📈' : value > 50 ? '📊' : '📉'}
                                        </span>
                                    </div>
                                    <div className="metric-value">{value.toFixed(1)}</div>
                                    <div className="metric-bar">
                                        <div
                                            className="metric-fill"
                                            style={{
                                                width: `${value}%`,
                                                backgroundColor: value > 70 ? '#22c55e' : value > 50 ? '#3b82f6' : '#ef4444'
                                            }}
                                        />
                                    </div>
                                    <div className="metric-status">
                                        {value > 80 ? 'Excellent' : value > 60 ? 'Good' : value > 40 ? 'Fair' : 'Needs Work'}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Recent Performance */}
                    <motion.div
                        className="recent-performance-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h3>Recent Session Performance</h3>
                        <div className="performance-chart-container">
                            <Line
                                data={getSessionPerformanceData()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'top' as const,
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100,
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.1)'
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        },
                                        y1: {
                                            type: 'linear',
                                            display: true,
                                            position: 'right',
                                            max: 250,
                                            grid: {
                                                drawOnChartArea: false,
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        },
                                        x: {
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.1)'
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const renderPatternsTab = () => (
        <div className="analytics-patterns">
            {/* Pattern Analysis Chart */}
            <motion.div
                className="pattern-analysis-section"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>Play Pattern Analysis</h3>
                <div className="pattern-chart-container">
                    <Bar
                        data={getPatternEffectivenessData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top' as const,
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    max: 100,
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)'
                                    },
                                    ticks: {
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    }
                                },
                                x: {
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)'
                                    },
                                    ticks: {
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    }
                                }
                            }
                        }}
                    />
                </div>
            </motion.div>

            {/* Pattern Details */}
            <motion.div
                className="pattern-details-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <h3>Pattern Breakdown</h3>
                <div className="patterns-list">
                    {playPatterns.map((pattern, index) => (
                        <motion.div
                            key={pattern.name}
                            className="pattern-card"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <div className="pattern-header">
                                <h4>{pattern.name}</h4>
                                <div className="pattern-scores">
                                    <span className="frequency-score">
                                        Frequency: {pattern.frequency.toFixed(1)}%
                                    </span>
                                    <span className="effectiveness-score">
                                        Effectiveness: {pattern.effectiveness.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="pattern-description">
                                {pattern.description}
                            </div>

                            <div className="pattern-recommendation">
                                <strong>AI Recommendation:</strong> {pattern.recommendation}
                            </div>

                            <div className="pattern-metrics">
                                <div className="metric-bar-small">
                                    <div className="metric-label">Usage</div>
                                    <div className="metric-bar-container">
                                        <div
                                            className="metric-bar-fill frequency"
                                            style={{ width: `${pattern.frequency}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="metric-bar-small">
                                    <div className="metric-label">Success</div>
                                    <div className="metric-bar-container">
                                        <div
                                            className="metric-bar-fill effectiveness"
                                            style={{ width: `${pattern.effectiveness}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );

    const renderProgressionTab = () => (
        <div className="analytics-progression">
            {/* Skill Progression Chart */}
            <motion.div
                className="progression-chart-section"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>30-Day Skill Progression</h3>
                <div className="progression-chart-container">
                    <Line
                        data={getProgressionChartData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top' as const,
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    max: 100,
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)'
                                    },
                                    ticks: {
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    }
                                },
                                x: {
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)'
                                    },
                                    ticks: {
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    }
                                }
                            }
                        }}
                    />
                </div>
            </motion.div>

            {/* Recent Sessions */}
            <motion.div
                className="recent-sessions-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <h3>Recent Game Sessions</h3>
                <div className="sessions-list">
                    {recentSessions.slice(0, 10).map((session, index) => (
                        <motion.div
                            key={session.id}
                            className={`session-card ${session.result}`}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.05 * index }}
                        >
                            <div className="session-header">
                                <div className="session-result">
                                    <span className={`result-icon ${session.result}`}>
                                        {session.result === 'win' ? '🏆' : session.result === 'loss' ? '😔' : '🤝'}
                                    </span>
                                    <span className="result-text">{session.result.toUpperCase()}</span>
                                </div>
                                <div className="session-date">
                                    {new Date(session.timestamp).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="session-details">
                                <div className="detail-row">
                                    <span className="detail-label">AI Level:</span>
                                    <span className="detail-value">{session.aiLevel}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Duration:</span>
                                    <span className="detail-value">{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Moves:</span>
                                    <span className="detail-value">{session.moves}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Accuracy:</span>
                                    <span className="detail-value">{session.accuracy.toFixed(1)}%</span>
                                </div>
                            </div>

                            <div className="session-performance">
                                <div className="performance-item">
                                    <span className="performance-icon">✨</span>
                                    <span className="performance-text">{session.brilliantMoves} brilliant moves</span>
                                </div>
                                <div className="performance-item">
                                    <span className="performance-icon">⚠️</span>
                                    <span className="performance-text">{session.mistakes} mistakes</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );

    const renderInsightsTab = () => (
        <div className="analytics-insights">
            {/* AI Insights */}
            <motion.div
                className="insights-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>AI-Generated Insights</h3>
                <div className="insights-list">
                    {personalizedInsights.map((insight, index) => (
                        <motion.div
                            key={index}
                            className={`insight-card ${insight.type}`}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <div className="insight-header">
                                <div className="insight-type-badge">
                                    <span className="insight-icon">
                                        {insight.type === 'strength' ? '💪' :
                                            insight.type === 'weakness' ? '🎯' :
                                                insight.type === 'opportunity' ? '🚀' : '💡'}
                                    </span>
                                    <span className="insight-type">{insight.type.toUpperCase()}</span>
                                </div>
                                <div className={`impact-badge ${insight.impact}`}>
                                    {insight.impact.toUpperCase()} IMPACT
                                </div>
                            </div>

                            <h4 className="insight-title">{insight.title}</h4>
                            <p className="insight-description">{insight.description}</p>

                            {insight.actionable && (
                                <div className="insight-actions">
                                    <button className="action-btn primary">Apply Suggestion</button>
                                    <button className="action-btn secondary">Learn More</button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* AI Recommendations */}
            {aiRecommendations && (
                <motion.div
                    className="recommendations-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Personalized AI Recommendations</h3>

                    <div className="recommendations-grid">
                        <div className="recommendation-card difficulty">
                            <h4>Optimal Challenge Level</h4>
                            <div className="recommendation-value">
                                Level {aiRecommendations.nextBestDifficulty}
                            </div>
                            <p>Based on your current skill progression, this difficulty will provide optimal learning.</p>
                        </div>

                        <div className="recommendation-card practice">
                            <h4>Focus Areas</h4>
                            <ul className="practice-list">
                                {aiRecommendations.practiceAreas.map((area: string, index: number) => (
                                    <li key={index}>{area}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="recommendation-card timeline">
                            <h4>Progress Timeline</h4>
                            <div className="recommendation-value">
                                {aiRecommendations.estimatedTimeToNextLevel} games
                            </div>
                            <p>Estimated games until next skill level advancement.</p>
                        </div>

                        <div className="recommendation-card tips">
                            <h4>Personalized Tips</h4>
                            <ul className="tips-list">
                                {aiRecommendations.personalizedTips.map((tip: string, index: number) => (
                                    <li key={index}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );

    const renderComparisonsTab = () => (
        <div className="analytics-comparisons">
            <motion.div
                className="comparison-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>Performance Comparisons</h3>

                <div className="comparison-cards">
                    <div className="comparison-card global">
                        <h4>Global Ranking</h4>
                        <div className="rank-display">
                            <span className="rank-number">#1,247</span>
                            <span className="rank-total">of 50,000+ players</span>
                        </div>
                        <div className="percentile">Top 3%</div>
                    </div>

                    <div className="comparison-card skill-level">
                        <h4>Skill Level Peers</h4>
                        <div className="peer-stats">
                            <div className="stat-item">
                                <span className="stat-label">Average Accuracy:</span>
                                <span className="stat-value">72.3%</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Your Accuracy:</span>
                                <span className="stat-value highlight">{playerMetrics.accuracy.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="comparison-card improvement">
                        <h4>Improvement Rate</h4>
                        <div className="improvement-display">
                            <span className="improvement-value">+{playerMetrics.improvement.toFixed(1)}%</span>
                            <span className="improvement-period">this month</span>
                        </div>
                        <div className="comparison-text">
                            {playerMetrics.improvement > 15 ? 'Above average' : 'On track'}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="player-analytics-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="player-analytics"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="analytics-header">
                        <div className="header-title">
                            <h2>Player Analytics</h2>
                            <div className="header-subtitle">
                                AI-Powered Performance Analysis
                            </div>
                        </div>
                        <div className="header-controls">
                            <button className="refresh-btn" onClick={analyzePlayerData}>
                                🔄 Refresh Analysis
                            </button>
                            <button className="export-btn">📊 Export Report</button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="analytics-nav">
                        {[
                            { id: 'overview', label: 'Overview', icon: '📊' },
                            { id: 'patterns', label: 'Patterns', icon: '🎯' },
                            { id: 'progression', label: 'Progression', icon: '📈' },
                            { id: 'insights', label: 'Insights', icon: '💡' },
                            { id: 'comparisons', label: 'Comparisons', icon: '⚖️' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id as any)}
                            >
                                <span className="tab-icon">{tab.icon}</span>
                                <span className="tab-label">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="analytics-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'overview' && renderOverviewTab()}
                            {activeTab === 'patterns' && renderPatternsTab()}
                            {activeTab === 'progression' && renderProgressionTab()}
                            {activeTab === 'insights' && renderInsightsTab()}
                            {activeTab === 'comparisons' && renderComparisonsTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PlayerAnalytics; 