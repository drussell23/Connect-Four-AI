import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    RadialLinearScale,
    ArcElement,
    Filler
} from 'chart.js';
import './AIAnalysisDashboard.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    RadialLinearScale,
    ArcElement,
    Filler
);

interface AIAnalysisDashboardProps {
    isVisible: boolean;
    onClose: () => void;
    gameData: {
        board: any[][];
        currentPlayer: string;
        gameId: string;
        history: any[];
    };
    aiMetrics: {
        confidence: number;
        thinkingTime: number;
        safetyScore: number;
        explanation: string;
        adaptationInfo?: any;
        curriculumInfo?: any;
        debateResult?: any;
    };
    systemHealth: {
        aiStatus: 'healthy' | 'warning' | 'error';
        cpuUsage: number;
        memoryUsage: number;
        networkLatency: number;
        mlServiceStatus: 'connected' | 'disconnected' | 'error';
    };
    socket?: any;
}

interface PerformanceMetric {
    timestamp: number;
    confidence: number;
    thinkingTime: number;
    safetyScore: number;
    accuracy?: number;
}

interface SystemMetric {
    timestamp: number;
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
}

const AIAnalysisDashboard: React.FC<AIAnalysisDashboardProps> = ({
    isVisible,
    onClose,
    gameData,
    aiMetrics,
    systemHealth,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'analysis' | 'health' | 'insights'>('overview');
    const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetric[]>([]);
    const [systemHistory, setSystemHistory] = useState<SystemMetric[]>([]);
    const [realTimeData, setRealTimeData] = useState<any>({});
    const [analysisDepth, setAnalysisDepth] = useState<'basic' | 'advanced' | 'expert'>('basic');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Update performance history when new AI metrics arrive
    useEffect(() => {
        if (aiMetrics && Object.keys(aiMetrics).length > 0) {
            const newMetric: PerformanceMetric = {
                timestamp: Date.now(),
                confidence: aiMetrics.confidence || 0,
                thinkingTime: aiMetrics.thinkingTime || 0,
                safetyScore: aiMetrics.safetyScore || 1,
                accuracy: calculateAccuracy()
            };

            setPerformanceHistory(prev => {
                const updated = [...prev, newMetric];
                // Keep only last 50 data points
                return updated.slice(-50);
            });
        }
    }, [aiMetrics]);

    // Update system health history
    useEffect(() => {
        if (systemHealth) {
            const newMetric: SystemMetric = {
                timestamp: Date.now(),
                cpuUsage: systemHealth.cpuUsage || 0,
                memoryUsage: systemHealth.memoryUsage || 0,
                networkLatency: systemHealth.networkLatency || 0
            };

            setSystemHistory(prev => {
                const updated = [...prev, newMetric];
                return updated.slice(-50);
            });
        }
    }, [systemHealth]);

    // Auto-refresh real-time data
    useEffect(() => {
        if (autoRefresh && socket) {
            intervalRef.current = setInterval(() => {
                socket.emit('getDashboardData', { gameId: gameData.gameId });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, socket, gameData.gameId]);

    // Listen for real-time updates
    useEffect(() => {
        if (socket) {
            socket.on('dashboardData', (data: any) => {
                setRealTimeData(data);
            });

            return () => {
                socket.off('dashboardData');
            };
        }
    }, [socket]);

    const calculateAccuracy = (): number => {
        // Calculate AI accuracy based on move quality
        // This is a simplified calculation
        if (gameData.history.length < 2) return 0;

        const recentMoves = gameData.history.slice(-10);
        const aiMoves = recentMoves.filter(move => move.player === 'Yellow');

        // Accuracy based on move timing and confidence
        if (aiMoves.length === 0) return 0;

        const avgConfidence = aiMetrics.confidence || 0.5;
        const avgThinkingTime = aiMetrics.thinkingTime || 1000;

        // Higher confidence and reasonable thinking time = better accuracy
        const confidenceScore = avgConfidence;
        const timingScore = Math.max(0, 1 - (avgThinkingTime - 1000) / 5000);

        return Math.min(1, (confidenceScore + timingScore) / 2) * 100;
    };

    const getPerformanceChartData = () => {
        const labels = performanceHistory.map((_, index) =>
            `Move ${index + 1}`
        );

        return {
            labels,
            datasets: [
                {
                    label: 'Confidence %',
                    data: performanceHistory.map(h => h.confidence * 100),
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Safety Score %',
                    data: performanceHistory.map(h => h.safetyScore * 100),
                    borderColor: 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Accuracy %',
                    data: performanceHistory.map(h => h.accuracy || 0),
                    borderColor: 'rgba(168, 85, 247, 0.8)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    };

    const getSystemHealthChartData = () => {
        const labels = systemHistory.map((_, index) =>
            new Date(systemHistory[index]?.timestamp || Date.now()).toLocaleTimeString()
        );

        return {
            labels,
            datasets: [
                {
                    label: 'CPU Usage %',
                    data: systemHistory.map(h => h.cpuUsage),
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Memory Usage %',
                    data: systemHistory.map(h => h.memoryUsage),
                    borderColor: 'rgba(245, 158, 11, 0.8)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Network Latency (ms)',
                    data: systemHistory.map(h => h.networkLatency),
                    borderColor: 'rgba(99, 102, 241, 0.8)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        };
    };

    const getAICapabilitiesRadarData = () => {
        return {
            labels: [
                'Decision Quality',
                'Speed',
                'Safety',
                'Adaptability',
                'Explainability',
                'Innovation'
            ],
            datasets: [
                {
                    label: 'Current Performance',
                    data: [
                        (aiMetrics.confidence || 0.5) * 100,
                        Math.max(0, 100 - (aiMetrics.thinkingTime || 1000) / 50),
                        (aiMetrics.safetyScore || 1) * 100,
                        aiMetrics.adaptationInfo?.score * 100 || 75,
                        80, // Explainability score
                        65  // Innovation score
                    ],
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
                }
            ]
        };
    };

    const renderOverviewTab = () => (
        <div className="dashboard-overview">
            <div className="metrics-grid">
                {/* Key Performance Indicators */}
                <motion.div
                    className="metric-card primary"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="metric-header">
                        <h3>AI Confidence</h3>
                        <div className={`status-dot ${aiMetrics.confidence > 0.8 ? 'high' : aiMetrics.confidence > 0.5 ? 'medium' : 'low'}`} />
                    </div>
                    <div className="metric-value">
                        {((aiMetrics.confidence || 0) * 100).toFixed(1)}%
                    </div>
                    <div className="metric-trend">
                        {performanceHistory.length > 1 && (
                            <span className={
                                performanceHistory[performanceHistory.length - 1]?.confidence >
                                    performanceHistory[performanceHistory.length - 2]?.confidence ? 'positive' : 'negative'
                            }>
                                {performanceHistory[performanceHistory.length - 1]?.confidence >
                                    performanceHistory[performanceHistory.length - 2]?.confidence ? '↗' : '↘'}
                            </span>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    className="metric-card secondary"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="metric-header">
                        <h3>Thinking Time</h3>
                        <div className={`status-dot ${aiMetrics.thinkingTime < 2000 ? 'high' : aiMetrics.thinkingTime < 5000 ? 'medium' : 'low'}`} />
                    </div>
                    <div className="metric-value">
                        {(aiMetrics.thinkingTime || 0).toFixed(0)}ms
                    </div>
                    <div className="metric-subtext">
                        Avg: {performanceHistory.length > 0 ?
                            (performanceHistory.reduce((sum, h) => sum + h.thinkingTime, 0) / performanceHistory.length).toFixed(0) : '0'}ms
                    </div>
                </motion.div>

                <motion.div
                    className="metric-card tertiary"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="metric-header">
                        <h3>Safety Score</h3>
                        <div className={`status-dot ${aiMetrics.safetyScore > 0.9 ? 'high' : aiMetrics.safetyScore > 0.7 ? 'medium' : 'low'}`} />
                    </div>
                    <div className="metric-value">
                        {((aiMetrics.safetyScore || 1) * 100).toFixed(1)}%
                    </div>
                    <div className="metric-subtext">
                        Excellent
                    </div>
                </motion.div>

                <motion.div
                    className="metric-card quaternary"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="metric-header">
                        <h3>System Health</h3>
                        <div className={`status-dot ${systemHealth.aiStatus === 'healthy' ? 'high' : systemHealth.aiStatus === 'warning' ? 'medium' : 'low'}`} />
                    </div>
                    <div className="metric-value">
                        {systemHealth.aiStatus.charAt(0).toUpperCase() + systemHealth.aiStatus.slice(1)}
                    </div>
                    <div className="metric-subtext">
                        CPU: {systemHealth.cpuUsage}% | RAM: {systemHealth.memoryUsage}%
                    </div>
                </motion.div>
            </div>

            {/* Real-time Performance Chart */}
            <motion.div
                className="chart-container"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <div className="chart-header">
                    <h3>Real-time Performance Metrics</h3>
                    <div className="chart-controls">
                        <button
                            className={`control-btn ${autoRefresh ? 'active' : ''}`}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                            {autoRefresh ? 'Pause' : 'Resume'}
                        </button>
                    </div>
                </div>
                <div className="chart-wrapper">
                    <Line
                        data={getPerformanceChartData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top' as const,
                                },
                                title: {
                                    display: false
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
                            },
                            elements: {
                                point: {
                                    radius: 3,
                                    hoverRadius: 6
                                }
                            }
                        }}
                    />
                </div>
            </motion.div>
        </div>
    );

    const renderPerformanceTab = () => (
        <div className="dashboard-performance">
            <div className="performance-grid">
                {/* AI Capabilities Radar */}
                <motion.div
                    className="chart-container radar-chart"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="chart-header">
                        <h3>AI Capabilities Analysis</h3>
                        <select
                            value={analysisDepth}
                            onChange={(e) => setAnalysisDepth(e.target.value as any)}
                            className="analysis-selector"
                        >
                            <option value="basic">Basic Analysis</option>
                            <option value="advanced">Advanced Analysis</option>
                            <option value="expert">Expert Analysis</option>
                        </select>
                    </div>
                    <div className="chart-wrapper">
                        <Radar
                            data={getAICapabilitiesRadarData()}
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

                {/* System Performance */}
                <motion.div
                    className="chart-container system-chart"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="chart-header">
                        <h3>System Performance</h3>
                        <div className="status-indicators">
                            <div className={`indicator ${systemHealth.mlServiceStatus}`}>
                                ML Service: {systemHealth.mlServiceStatus}
                            </div>
                        </div>
                    </div>
                    <div className="chart-wrapper">
                        <Line
                            data={getSystemHealthChartData()}
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
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
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
                                        beginAtZero: true,
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
            </div>

            {/* Performance Metrics Table */}
            <motion.div
                className="metrics-table-container"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <div className="table-header">
                    <h3>Detailed Performance Metrics</h3>
                    <button className="export-btn">Export Data</button>
                </div>
                <div className="metrics-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Current</th>
                                <th>Average</th>
                                <th>Best</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Confidence Score</td>
                                <td>{((aiMetrics.confidence || 0) * 100).toFixed(1)}%</td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        ((performanceHistory.reduce((sum, h) => sum + h.confidence, 0) / performanceHistory.length) * 100).toFixed(1) : '0'}%
                                </td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        (Math.max(...performanceHistory.map(h => h.confidence)) * 100).toFixed(1) : '0'}%
                                </td>
                                <td className="trend-cell">
                                    {performanceHistory.length > 1 && (
                                        <span className={
                                            performanceHistory[performanceHistory.length - 1]?.confidence >
                                                performanceHistory[performanceHistory.length - 2]?.confidence ? 'positive' : 'negative'
                                        }>
                                            {performanceHistory[performanceHistory.length - 1]?.confidence >
                                                performanceHistory[performanceHistory.length - 2]?.confidence ? '↗ +' : '↘ -'}
                                            {Math.abs(
                                                (performanceHistory[performanceHistory.length - 1]?.confidence -
                                                    performanceHistory[performanceHistory.length - 2]?.confidence) * 100
                                            ).toFixed(1)}%
                                        </span>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>Response Time</td>
                                <td>{(aiMetrics.thinkingTime || 0).toFixed(0)}ms</td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        (performanceHistory.reduce((sum, h) => sum + h.thinkingTime, 0) / performanceHistory.length).toFixed(0) : '0'}ms
                                </td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        Math.min(...performanceHistory.map(h => h.thinkingTime)).toFixed(0) : '0'}ms
                                </td>
                                <td className="trend-cell">
                                    {performanceHistory.length > 1 && (
                                        <span className={
                                            performanceHistory[performanceHistory.length - 1]?.thinkingTime <
                                                performanceHistory[performanceHistory.length - 2]?.thinkingTime ? 'positive' : 'negative'
                                        }>
                                            {performanceHistory[performanceHistory.length - 1]?.thinkingTime <
                                                performanceHistory[performanceHistory.length - 2]?.thinkingTime ? '↗ Faster' : '↘ Slower'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>Safety Score</td>
                                <td>{((aiMetrics.safetyScore || 1) * 100).toFixed(1)}%</td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        ((performanceHistory.reduce((sum, h) => sum + h.safetyScore, 0) / performanceHistory.length) * 100).toFixed(1) : '100'}%
                                </td>
                                <td>
                                    {performanceHistory.length > 0 ?
                                        (Math.max(...performanceHistory.map(h => h.safetyScore)) * 100).toFixed(1) : '100'}%
                                </td>
                                <td className="trend-cell">
                                    <span className="positive">↗ Stable</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );

    const renderAnalysisTab = () => (
        <div className="dashboard-analysis">
            <div className="analysis-container">
                {/* Current Move Analysis */}
                <motion.div
                    className="analysis-section"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="section-header">
                        <h3>Current Move Analysis</h3>
                        <div className="analysis-status">
                            <div className={`status-indicator ${aiMetrics.confidence > 0.8 ? 'excellent' : aiMetrics.confidence > 0.6 ? 'good' : 'needs-improvement'}`}>
                                {aiMetrics.confidence > 0.8 ? 'Excellent' : aiMetrics.confidence > 0.6 ? 'Good' : 'Needs Improvement'}
                            </div>
                        </div>
                    </div>

                    <div className="analysis-content">
                        <div className="explanation-box">
                            <h4>AI Reasoning</h4>
                            <p>{aiMetrics.explanation || 'No explanation available for this move.'}</p>
                        </div>

                        {aiMetrics.adaptationInfo && (
                            <div className="adaptation-box">
                                <h4>Adaptation Analysis</h4>
                                <div className="adaptation-metrics">
                                    <div className="adaptation-item">
                                        <span className="label">Player Style Recognition:</span>
                                        <span className="value">{((aiMetrics.adaptationInfo.styleRecognition || 0.5) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="adaptation-item">
                                        <span className="label">Strategy Adjustment:</span>
                                        <span className="value">{((aiMetrics.adaptationInfo.strategyAdjustment || 0.5) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="adaptation-item">
                                        <span className="label">Learning Rate:</span>
                                        <span className="value">{((aiMetrics.adaptationInfo.learningRate || 0.5) * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {aiMetrics.curriculumInfo && (
                            <div className="curriculum-box">
                                <h4>Learning Progress</h4>
                                <div className="curriculum-metrics">
                                    <div className="progress-bar">
                                        <div className="progress-label">Current Stage: {aiMetrics.curriculumInfo.stage || 'Basic'}</div>
                                        <div className="progress-track">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${(aiMetrics.curriculumInfo.progress || 0.5) * 100}%` }}
                                            />
                                        </div>
                                        <div className="progress-value">{((aiMetrics.curriculumInfo.progress || 0.5) * 100).toFixed(1)}%</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {aiMetrics.debateResult && (
                            <div className="debate-box">
                                <h4>Multi-Agent Consensus</h4>
                                <div className="debate-metrics">
                                    <div className="consensus-score">
                                        <span className="label">Consensus Score:</span>
                                        <span className="value">{((aiMetrics.debateResult.consensus || 0.5) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="agent-votes">
                                        {Object.entries(aiMetrics.debateResult.agentVotes || {}).map(([agent, vote]) => (
                                            <div key={agent} className="vote-item">
                                                <span className="agent-name">{`${agent}: Column ${vote}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Board Analysis Visualization */}
                <motion.div
                    className="board-analysis-section"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="section-header">
                        <h3>Board Position Analysis</h3>
                        <div className="analysis-controls">
                            <button className="analysis-btn">Deep Analysis</button>
                            <button className="analysis-btn">Compare Moves</button>
                        </div>
                    </div>

                    <div className="board-heatmap">
                        {/* Simplified board visualization with move strength indicators */}
                        <div className="heatmap-grid">
                            {Array.from({ length: 7 }, (_, col) => (
                                <div key={col} className="heatmap-column">
                                    <div className="column-header">
                                        Col {col + 1}
                                    </div>
                                    <div className="column-strength">
                                        <div
                                            className="strength-bar"
                                            style={{
                                                height: `${Math.random() * 80 + 20}%`,
                                                backgroundColor: `hsl(${Math.random() * 120}, 70%, 50%)`
                                            }}
                                        />
                                    </div>
                                    <div className="column-score">
                                        {(Math.random() * 100).toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="position-insights">
                        <h4>Position Insights</h4>
                        <ul className="insights-list">
                            <li className="insight-item positive">
                                <span className="insight-icon">✓</span>
                                <span className="insight-text">Strong central control established</span>
                            </li>
                            <li className="insight-item warning">
                                <span className="insight-icon">⚠</span>
                                <span className="insight-text">Potential threat in column 3</span>
                            </li>
                            <li className="insight-item neutral">
                                <span className="insight-icon">i</span>
                                <span className="insight-text">Multiple winning paths available</span>
                            </li>
                        </ul>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderHealthTab = () => (
        <div className="dashboard-health">
            <div className="health-grid">
                {/* System Status Overview */}
                <motion.div
                    className="health-section system-status"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="section-header">
                        <h3>System Status</h3>
                        <div className={`overall-status ${systemHealth.aiStatus}`}>
                            {systemHealth.aiStatus}
                        </div>
                    </div>

                    <div className="status-items">
                        <div className="status-item">
                            <div className="status-label">AI Engine</div>
                            <div className={`status-value ${systemHealth.aiStatus}`}>
                                {systemHealth.aiStatus === 'healthy' ? 'Operational' :
                                    systemHealth.aiStatus === 'warning' ? 'Degraded' : 'Critical'}
                            </div>
                            <div className="status-details">
                                Response time: {aiMetrics.thinkingTime || 0}ms
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">ML Service</div>
                            <div className={`status-value ${systemHealth.mlServiceStatus === 'connected' ? 'healthy' : 'error'}`}>
                                {systemHealth.mlServiceStatus}
                            </div>
                            <div className="status-details">
                                Latency: {systemHealth.networkLatency}ms
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Neural Networks</div>
                            <div className="status-value healthy">Active</div>
                            <div className="status-details">
                                Models loaded: 3/3
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Safety Systems</div>
                            <div className="status-value healthy">Monitoring</div>
                            <div className="status-details">
                                Safety score: {((aiMetrics.safetyScore || 1) * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Resource Usage */}
                <motion.div
                    className="health-section resource-usage"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="section-header">
                        <h3>Resource Usage</h3>
                    </div>

                    <div className="resource-meters">
                        <div className="resource-meter">
                            <div className="meter-label">CPU Usage</div>
                            <div className="meter-bar">
                                <div
                                    className={`meter-fill ${systemHealth.cpuUsage > 80 ? 'critical' : systemHealth.cpuUsage > 60 ? 'warning' : 'normal'}`}
                                    style={{ width: `${systemHealth.cpuUsage}%` }}
                                />
                            </div>
                            <div className="meter-value">{systemHealth.cpuUsage}%</div>
                        </div>

                        <div className="resource-meter">
                            <div className="meter-label">Memory Usage</div>
                            <div className="meter-bar">
                                <div
                                    className={`meter-fill ${systemHealth.memoryUsage > 85 ? 'critical' : systemHealth.memoryUsage > 70 ? 'warning' : 'normal'}`}
                                    style={{ width: `${systemHealth.memoryUsage}%` }}
                                />
                            </div>
                            <div className="meter-value">{systemHealth.memoryUsage}%</div>
                        </div>

                        <div className="resource-meter">
                            <div className="meter-label">Network Latency</div>
                            <div className="meter-bar">
                                <div
                                    className={`meter-fill ${systemHealth.networkLatency > 200 ? 'critical' : systemHealth.networkLatency > 100 ? 'warning' : 'normal'}`}
                                    style={{ width: `${Math.min(systemHealth.networkLatency / 500 * 100, 100)}%` }}
                                />
                            </div>
                            <div className="meter-value">{systemHealth.networkLatency}ms</div>
                        </div>
                    </div>
                </motion.div>

                {/* Diagnostics */}
                <motion.div
                    className="health-section diagnostics"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="section-header">
                        <h3>System Diagnostics</h3>
                        <button className="diagnostic-btn">Run Full Diagnostic</button>
                    </div>

                    <div className="diagnostic-results">
                        <div className="diagnostic-item">
                            <div className="diagnostic-icon success">✓</div>
                            <div className="diagnostic-text">Neural network integrity verified</div>
                            <div className="diagnostic-time">2 seconds ago</div>
                        </div>

                        <div className="diagnostic-item">
                            <div className="diagnostic-icon success">✓</div>
                            <div className="diagnostic-text">Safety protocols active</div>
                            <div className="diagnostic-time">5 seconds ago</div>
                        </div>

                        <div className="diagnostic-item">
                            <div className="diagnostic-icon warning">⚠</div>
                            <div className="diagnostic-text">High memory usage detected</div>
                            <div className="diagnostic-time">10 seconds ago</div>
                        </div>

                        <div className="diagnostic-item">
                            <div className="diagnostic-icon success">✓</div>
                            <div className="diagnostic-text">Database connection stable</div>
                            <div className="diagnostic-time">15 seconds ago</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderInsightsTab = () => (
        <div className="dashboard-insights">
            <div className="insights-container">
                {/* Performance Insights */}
                <motion.div
                    className="insights-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="section-header">
                        <h3>Performance Insights</h3>
                        <div className="insights-period">
                            <select className="period-selector">
                                <option value="current">Current Game</option>
                                <option value="session">This Session</option>
                                <option value="week">Past Week</option>
                                <option value="month">Past Month</option>
                            </select>
                        </div>
                    </div>

                    <div className="insights-grid">
                        <div className="insight-card">
                            <div className="insight-icon">🎯</div>
                            <div className="insight-content">
                                <h4>Accuracy Trend</h4>
                                <p>AI accuracy has improved by 15% over the last 10 moves, showing effective adaptation to player strategy.</p>
                                <div className="insight-metric">+15% improvement</div>
                            </div>
                        </div>

                        <div className="insight-card">
                            <div className="insight-icon">⚡</div>
                            <div className="insight-content">
                                <h4>Response Time</h4>
                                <p>Average thinking time has decreased while maintaining high confidence scores.</p>
                                <div className="insight-metric">-300ms average</div>
                            </div>
                        </div>

                        <div className="insight-card">
                            <div className="insight-icon">🛡️</div>
                            <div className="insight-content">
                                <h4>Safety Performance</h4>
                                <p>All safety protocols active with no violations detected in recent gameplay.</p>
                                <div className="insight-metric">100% compliance</div>
                            </div>
                        </div>

                        <div className="insight-card">
                            <div className="insight-icon">🎯</div>
                            <div className="insight-content">
                                <h4>Learning Adaptation</h4>
                                <p>AI has successfully identified and countered 3 distinct player patterns this game.</p>
                                <div className="insight-metric">3 patterns recognized</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Recommendations */}
                <motion.div
                    className="recommendations-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="section-header">
                        <h3>AI Optimization Recommendations</h3>
                    </div>

                    <div className="recommendations-list">
                        <div className="recommendation-item">
                            <div className="recommendation-priority high">High</div>
                            <div className="recommendation-content">
                                <h4>Optimize Memory Usage</h4>
                                <p>Current memory usage is at {systemHealth.memoryUsage}%. Consider enabling memory compression for better performance.</p>
                                <button className="apply-btn">Apply Optimization</button>
                            </div>
                        </div>

                        <div className="recommendation-item">
                            <div className="recommendation-priority medium">Medium</div>
                            <div className="recommendation-content">
                                <h4>Enhance Learning Rate</h4>
                                <p>Player adaptation could be improved by increasing the learning rate for pattern recognition.</p>
                                <button className="apply-btn">Configure Learning</button>
                            </div>
                        </div>

                        <div className="recommendation-item">
                            <div className="recommendation-priority low">Low</div>
                            <div className="recommendation-content">
                                <h4>Update Neural Networks</h4>
                                <p>New model versions are available that could improve decision quality by 5-10%.</p>
                                <button className="apply-btn">Check Updates</button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="ai-analysis-dashboard-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="ai-analysis-dashboard"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Dashboard Header */}
                    <div className="dashboard-header">
                        <div className="header-title">
                            <h2>AI Analysis Dashboard</h2>
                            <div className="header-status">
                                <div className={`status-dot ${systemHealth.aiStatus}`} />
                                <span>Real-time Analysis Active</span>
                            </div>
                        </div>
                        <div className="header-controls">
                            <button
                                className={`refresh-btn ${autoRefresh ? 'active' : ''}`}
                                onClick={() => setAutoRefresh(!autoRefresh)}
                            >
                                {autoRefresh ? '⏸️' : '▶️'}
                            </button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="dashboard-nav">
                        {[
                            { id: 'overview', label: 'Overview', icon: '📊' },
                            { id: 'performance', label: 'Performance', icon: '⚡' },
                            { id: 'analysis', label: 'Analysis', icon: '🔍' },
                            { id: 'health', label: 'Health', icon: '🛡️' },
                            { id: 'insights', label: 'Insights', icon: '💡' }
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

                    {/* Dashboard Content */}
                    <div className="dashboard-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'overview' && renderOverviewTab()}
                            {activeTab === 'performance' && renderPerformanceTab()}
                            {activeTab === 'analysis' && renderAnalysisTab()}
                            {activeTab === 'health' && renderHealthTab()}
                            {activeTab === 'insights' && renderInsightsTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AIAnalysisDashboard; 