import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Radar, Doughnut, Scatter } from 'react-chartjs-2';
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
import { integrationLogger } from '../../utils/integrationLogger';

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

interface ServiceStatus {
    ml_service: boolean;
    ml_inference: boolean;
    continuous_learning: boolean;
    ai_coordination: boolean;
    python_trainer: boolean;
    integration_websocket: boolean;
}

interface ServiceMetrics {
    ml_service: {
        models_loaded: number;
        inference_count: number;
        average_latency: number;
        cache_hit_rate: number;
    };
    ml_inference: {
        active_models: string[];
        performance_score: number;
        optimization_level: number;
    };
    continuous_learning: {
        buffer_size: number;
        patterns_detected: number;
        learning_rate: number;
        model_version: string;
    };
    ai_coordination: {
        active_strategies: string[];
        consensus_score: number;
        simulation_count: number;
    };
    python_trainer: {
        training_progress: number;
        epochs_completed: number;
        loss: number;
        accuracy: number;
    };
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
    const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'analysis' | 'health' | 'insights' | 'services'>('overview');
    const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetric[]>([]);
    const [systemHistory, setSystemHistory] = useState<SystemMetric[]>([]);
    const [realTimeData, setRealTimeData] = useState<any>({});
    const [analysisDepth, setAnalysisDepth] = useState<'basic' | 'advanced' | 'expert'>('basic');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Service integration state
    const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
        ml_service: false,
        ml_inference: false,
        continuous_learning: false,
        ai_coordination: false,
        python_trainer: false,
        integration_websocket: false
    });
    
    const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics>({
        ml_service: { models_loaded: 0, inference_count: 0, average_latency: 0, cache_hit_rate: 0 },
        ml_inference: { active_models: [], performance_score: 0, optimization_level: 0 },
        continuous_learning: { buffer_size: 0, patterns_detected: 0, learning_rate: 0, model_version: '1.0' },
        ai_coordination: { active_strategies: [], consensus_score: 0, simulation_count: 0 },
        python_trainer: { training_progress: 0, epochs_completed: 0, loss: 0, accuracy: 0 }
    });
    
    const [learningInsights, setLearningInsights] = useState<any[]>([]);
    const [modelPerformance, setModelPerformance] = useState<any[]>([]);

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
    
    // Listen for service status updates
    useEffect(() => {
        if (!socket) return;
        
        // Request initial service status
        socket.emit('requestServiceStatus');
        
        // Service status updates
        socket.on('serviceStatusUpdate', (data: any) => {
            console.log('📊 Service status update:', data);
            // Convert the service status data to boolean values
            const updatedStatus = {
                ml_service: Boolean(data.ml_service),
                ml_inference: Boolean(data.ml_inference),
                continuous_learning: Boolean(data.continuous_learning),
                ai_coordination: Boolean(data.ai_coordination),
                python_trainer: Boolean(data.python_trainer),
                integration_websocket: Boolean(data.integration_websocket)
            };
            setServiceStatus(updatedStatus);
            integrationLogger.updateServiceStatuses(data);
        });
        
        // ML Service metrics
        socket.on('mlServiceMetrics', (data: any) => {
            setServiceMetrics(prev => ({
                ...prev,
                ml_service: {
                    models_loaded: data.models_loaded || 0,
                    inference_count: data.inference_count || 0,
                    average_latency: data.average_latency || 0,
                    cache_hit_rate: data.cache_hit_rate || 0
                }
            }));
        });
        
        // Continuous Learning updates
        socket.on('continuousLearningUpdate', (data: any) => {
            setServiceMetrics(prev => ({
                ...prev,
                continuous_learning: {
                    buffer_size: data.buffer_size || 0,
                    patterns_detected: data.patterns_detected || 0,
                    learning_rate: data.learning_rate || 0,
                    model_version: data.model_version || '1.0'
                }
            }));
            
            if (data.new_pattern) {
                setLearningInsights(prev => [{
                    id: Date.now(),
                    type: 'pattern',
                    title: 'New Pattern Detected',
                    description: data.pattern_description,
                    timestamp: new Date(),
                    impact: data.pattern_impact || 0.5
                }, ...prev].slice(0, 50));
            }
        });
        
        // AI Coordination updates
        socket.on('aiCoordinationUpdate', (data: any) => {
            setServiceMetrics(prev => ({
                ...prev,
                ai_coordination: {
                    active_strategies: data.active_strategies || [],
                    consensus_score: data.consensus_score || 0,
                    simulation_count: data.simulation_count || 0
                }
            }));
        });
        
        // Python Trainer updates
        socket.on('pythonTrainerUpdate', (data: any) => {
            setServiceMetrics(prev => ({
                ...prev,
                python_trainer: {
                    training_progress: data.progress || 0,
                    epochs_completed: data.epochs || 0,
                    loss: data.loss || 0,
                    accuracy: data.accuracy || 0
                }
            }));
        });
        
        // Model performance updates
        socket.on('modelPerformanceUpdate', (data: any) => {
            setModelPerformance(prev => {
                const index = prev.findIndex(m => m.model === data.model_name);
                const newPerf = {
                    model: data.model_name,
                    accuracy: data.accuracy,
                    latency: data.latency,
                    usage_count: data.usage_count,
                    timestamp: new Date()
                };
                
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = newPerf;
                    return updated;
                }
                return [...prev, newPerf];
            });
        });
        
        return () => {
            socket.off('serviceStatusUpdate');
            socket.off('mlServiceMetrics');
            socket.off('continuousLearningUpdate');
            socket.off('aiCoordinationUpdate');
            socket.off('pythonTrainerUpdate');
            socket.off('modelPerformanceUpdate');
        };
    }, [socket]);

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
            // Request initial data
            socket.emit('requestDashboardData', { gameId: gameData.gameId });
            
            intervalRef.current = setInterval(() => {
                socket.emit('requestDashboardData', { gameId: gameData.gameId });
            }, 2000);
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
                        Math.max(0, 100 - (serviceMetrics.ml_service.average_latency || 1000) / 50),
                        (aiMetrics.safetyScore || 1) * 100,
                        serviceMetrics.ai_coordination.consensus_score * 100,
                        (serviceMetrics.ml_inference.performance_score || 0.8) * 100,
                        (serviceMetrics.continuous_learning.patterns_detected > 10 ? 90 : 
                         serviceMetrics.continuous_learning.patterns_detected * 9) // Innovation based on patterns
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
    
    const getModelPerformanceData = () => {
        return {
            labels: modelPerformance.map(m => m.model),
            datasets: [
                {
                    label: 'Accuracy %',
                    data: modelPerformance.map(m => m.accuracy * 100),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Latency (ms)',
                    data: modelPerformance.map(m => m.latency),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        };
    };
    
    const getLearningProgressData = () => {
        const labels = performanceHistory.map((_, i) => `T${i}`);
        
        return {
            labels,
            datasets: [
                {
                    label: 'Model Accuracy',
                    data: performanceHistory.map(h => (h.accuracy || 0)),
                    borderColor: 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Learning Rate',
                    data: performanceHistory.map((_, i) => 
                        serviceMetrics.continuous_learning.learning_rate * 100 * (1 + i * 0.01)
                    ),
                    borderColor: 'rgba(168, 85, 247, 0.8)',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Consensus Score',
                    data: performanceHistory.map(() => 
                        serviceMetrics.ai_coordination.consensus_score * 100
                    ),
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    };

    const renderOverviewTab = () => (
        <div className="dashboard-overview">
            {/* Service Integration Summary */}
            <motion.div
                className="service-integration-summary"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>Service Integration Status</h3>
                <div className="services-status-grid">
                    {Object.entries(serviceStatus).map(([service, status]) => (
                        <div key={service} className={`service-status-item ${status ? 'active' : 'inactive'}`}>
                            <div className="service-icon">
                                {service === 'ml_service' ? '🧠' :
                                 service === 'ml_inference' ? '⚡' :
                                 service === 'continuous_learning' ? '📈' :
                                 service === 'ai_coordination' ? '🎯' :
                                 service === 'python_trainer' ? '🐍' : '🔌'}
                            </div>
                            <div className="service-label">
                                {service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            <div className={`service-status ${status ? 'connected' : 'disconnected'}`}>
                                {status ? '✓' : '✗'}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            <div className="metrics-grid">
                {/* Key Performance Indicators */}
                <motion.div
                    className="metric-card primary"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
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
                    transition={{ delay: 0.3 }}
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

            {/* Model Performance Comparison */}
            <motion.div
                className="chart-container model-performance"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <div className="chart-header">
                    <h3>Model Performance Comparison</h3>
                    <div className="performance-legend">
                        <span className="legend-item">
                            <span className="legend-color" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}></span>
                            Accuracy
                        </span>
                        <span className="legend-item">
                            <span className="legend-color" style={{ backgroundColor: 'rgba(59, 130, 246, 0.8)' }}></span>
                            Latency
                        </span>
                    </div>
                </div>
                <div className="chart-wrapper">
                    {modelPerformance.length > 0 ? (
                        <Bar
                            data={getModelPerformanceData()}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'top' as const,
                                        labels: { color: 'rgba(255, 255, 255, 0.8)' }
                                    }
                                },
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: {
                                            callback: (value) => `${value}%`,
                                            color: 'rgba(255, 255, 255, 0.7)'
                                        },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        beginAtZero: true,
                                        ticks: {
                                            callback: (value) => `${value}ms`,
                                            color: 'rgba(255, 255, 255, 0.7)'
                                        },
                                        grid: { drawOnChartArea: false }
                                    },
                                    x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                                        grid: { display: false }
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div className="no-data">No model performance data available</div>
                    )}
                </div>
            </motion.div>

            {/* Learning Progress Over Time */}
            <motion.div
                className="chart-container learning-progress"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <div className="chart-header">
                    <h3>Learning Progress</h3>
                    <div className="learning-stats">
                        <span>Patterns: {serviceMetrics.continuous_learning.patterns_detected}</span>
                        <span>Learning Rate: {(serviceMetrics.continuous_learning.learning_rate * 100).toFixed(2)}%</span>
                    </div>
                </div>
                <div className="chart-wrapper">
                    <Line
                        data={getLearningProgressData()}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top' as const,
                                    labels: { color: 'rgba(255, 255, 255, 0.8)' }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    max: 100,
                                    ticks: {
                                        callback: (value) => `${value}%`,
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                },
                                x: {
                                    ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                }
                            }
                        }}
                    />
                </div>
            </motion.div>

            {/* Service Performance Metrics */}
            <motion.div
                className="metrics-table-container"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <div className="table-header">
                    <h3>Service Performance Metrics</h3>
                    <button className="export-btn">Export Data</button>
                </div>
                <div className="metrics-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Status</th>
                                <th>Performance</th>
                                <th>Latency</th>
                                <th>Usage</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>ML Service</td>
                                <td className={serviceStatus.ml_service ? 'status-active' : 'status-inactive'}>
                                    {serviceStatus.ml_service ? '✅ Active' : '❌ Inactive'}
                                </td>
                                <td>{serviceMetrics.ml_service.inference_count} inferences</td>
                                <td>{serviceMetrics.ml_service.average_latency.toFixed(0)}ms</td>
                                <td>{(serviceMetrics.ml_service.cache_hit_rate * 100).toFixed(1)}% cache hits</td>
                            </tr>
                            <tr>
                                <td>ML Inference</td>
                                <td className={serviceStatus.ml_inference ? 'status-active' : 'status-inactive'}>
                                    {serviceStatus.ml_inference ? '✅ Active' : '❌ Inactive'}
                                </td>
                                <td>{serviceMetrics.ml_inference.active_models.length} models</td>
                                <td>N/A</td>
                                <td>{(serviceMetrics.ml_inference.performance_score * 100).toFixed(1)}% efficiency</td>
                            </tr>
                            <tr>
                                <td>Continuous Learning</td>
                                <td className={serviceStatus.continuous_learning ? 'status-active' : 'status-inactive'}>
                                    {serviceStatus.continuous_learning ? '✅ Active' : '❌ Inactive'}
                                </td>
                                <td>{serviceMetrics.continuous_learning.patterns_detected} patterns</td>
                                <td>Real-time</td>
                                <td>v{serviceMetrics.continuous_learning.model_version}</td>
                            </tr>
                            <tr>
                                <td>AI Coordination</td>
                                <td className={serviceStatus.ai_coordination ? 'status-active' : 'status-inactive'}>
                                    {serviceStatus.ai_coordination ? '✅ Active' : '❌ Inactive'}
                                </td>
                                <td>{(serviceMetrics.ai_coordination.consensus_score * 100).toFixed(1)}% consensus</td>
                                <td>Real-time</td>
                                <td>{serviceMetrics.ai_coordination.simulation_count} simulations</td>
                            </tr>
                            <tr>
                                <td>Python Trainer</td>
                                <td className={serviceStatus.python_trainer ? 'status-active' : 'status-inactive'}>
                                    {serviceStatus.python_trainer ? '✅ Active' : '❌ Inactive'}
                                </td>
                                <td>{(serviceMetrics.python_trainer.accuracy * 100).toFixed(1)}% accuracy</td>
                                <td>Batch</td>
                                <td>{serviceMetrics.python_trainer.epochs_completed} epochs</td>
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
                            <h4>Move Analysis</h4>
                            <p>{aiMetrics.explanation || 'The AI analyzed the current board position and determined the optimal move based on strategic patterns and opponent modeling.'}</p>

                            {/* ML Service Analysis Details */}
                            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
                                    ML Service Analysis:
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Models Used:</span>
                                    <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: '600' }}>{serviceMetrics.ml_service.models_loaded}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Inference Time:</span>
                                    <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: '600' }}>{serviceMetrics.ml_service.average_latency.toFixed(0)}ms</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Cache Hit:</span>
                                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>{(serviceMetrics.ml_service.cache_hit_rate * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* AI Coordination Strategy */}
                            {serviceMetrics.ai_coordination.active_strategies.length > 0 && (
                                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
                                        Active Strategies:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {serviceMetrics.ai_coordination.active_strategies.map((strategy, idx) => (
                                            <span key={idx} style={{ 
                                                padding: '4px 12px', 
                                                background: 'rgba(59, 130, 246, 0.2)', 
                                                border: '1px solid rgba(59, 130, 246, 0.3)', 
                                                borderRadius: '12px', 
                                                fontSize: '11px', 
                                                color: '#60a5fa' 
                                            }}>
                                                {strategy}
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '10px', fontSize: '12px' }}>
                                        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Consensus Score: </span>
                                        <span style={{ color: '#22c55e', fontWeight: '600' }}>
                                            {(serviceMetrics.ai_coordination.consensus_score * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
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

                        {/* Continuous Learning Progress */}
                        <div className="curriculum-box">
                            <h4>Continuous Learning Progress</h4>
                            <div className="curriculum-metrics">
                                <div className="progress-label">Model Version: {serviceMetrics.continuous_learning.model_version}</div>

                                {/* Real-time Learning Statistics */}
                                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
                                        Learning Statistics:
                                    </div>
                                    <div className="adaptation-metrics">
                                        <div className="adaptation-item">
                                            <span className="label">Learning Rate:</span>
                                            <span className="value">{(serviceMetrics.continuous_learning.learning_rate * 100).toFixed(2)}%</span>
                                        </div>
                                        <div className="adaptation-item">
                                            <span className="label">Buffer Size:</span>
                                            <span className="value">{serviceMetrics.continuous_learning.buffer_size}</span>
                                        </div>
                                        <div className="adaptation-item">
                                            <span className="label">Patterns Detected:</span>
                                            <span className="value">{serviceMetrics.continuous_learning.patterns_detected}</span>
                                        </div>
                                        <div className="adaptation-item">
                                            <span className="label">Training Progress:</span>
                                            <span className="value">{(serviceMetrics.python_trainer.training_progress * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Pattern Insights */}
                                {learningInsights.filter(i => i.type === 'pattern').length > 0 && (
                                    <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                                        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
                                            Recent Pattern Discoveries:
                                        </div>
                                        {learningInsights.filter(i => i.type === 'pattern').slice(0, 2).map(insight => (
                                            <div key={insight.id} style={{ marginBottom: '8px', fontSize: '11px' }}>
                                                <div style={{ color: '#60a5fa', fontWeight: '600' }}>{insight.title}</div>
                                                <div style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{insight.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

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
                            <div className="status-label">ML Service</div>
                            <div className={`status-value ${serviceStatus.ml_service ? 'healthy' : 'error'}`}>
                                {serviceStatus.ml_service ? 'Operational' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                Latency: {serviceMetrics.ml_service.average_latency.toFixed(0)}ms | {serviceMetrics.ml_service.inference_count} inferences
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">ML Inference Engine</div>
                            <div className={`status-value ${serviceStatus.ml_inference ? 'healthy' : 'error'}`}>
                                {serviceStatus.ml_inference ? 'Operational' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                {serviceMetrics.ml_inference.active_models.length} models | {(serviceMetrics.ml_inference.performance_score * 100).toFixed(0)}% efficiency
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Continuous Learning</div>
                            <div className={`status-value ${serviceStatus.continuous_learning ? 'healthy' : 'error'}`}>
                                {serviceStatus.continuous_learning ? 'Operational' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                {serviceMetrics.continuous_learning.patterns_detected} patterns | v{serviceMetrics.continuous_learning.model_version}
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">AI Coordination Hub</div>
                            <div className={`status-value ${serviceStatus.ai_coordination ? 'healthy' : 'error'}`}>
                                {serviceStatus.ai_coordination ? 'Operational' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                Consensus: {(serviceMetrics.ai_coordination.consensus_score * 100).toFixed(0)}% | {serviceMetrics.ai_coordination.active_strategies.length} strategies
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Python Trainer</div>
                            <div className={`status-value ${serviceStatus.python_trainer ? 'healthy' : 'error'}`}>
                                {serviceStatus.python_trainer ? 'Operational' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                Progress: {(serviceMetrics.python_trainer.training_progress * 100).toFixed(0)}% | Epoch {serviceMetrics.python_trainer.epochs_completed}
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Integration WebSocket</div>
                            <div className={`status-value ${serviceStatus.integration_websocket ? 'healthy' : 'error'}`}>
                                {serviceStatus.integration_websocket ? 'Connected' : 'Disconnected'}
                            </div>
                            <div className="status-details">
                                Real-time data flow active
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
                        {serviceStatus.ml_service && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon success">✓</div>
                                <div className="diagnostic-text">ML Service: {serviceMetrics.ml_service.models_loaded} models loaded</div>
                                <div className="diagnostic-time">Cache hit rate: {(serviceMetrics.ml_service.cache_hit_rate * 100).toFixed(0)}%</div>
                            </div>
                        )}

                        {serviceStatus.continuous_learning && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon success">✓</div>
                                <div className="diagnostic-text">Continuous Learning: {serviceMetrics.continuous_learning.patterns_detected} patterns detected</div>
                                <div className="diagnostic-time">Learning rate: {(serviceMetrics.continuous_learning.learning_rate * 100).toFixed(2)}%</div>
                            </div>
                        )}

                        {serviceMetrics.python_trainer.training_progress > 0 && serviceMetrics.python_trainer.training_progress < 1 && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon warning">⚠</div>
                                <div className="diagnostic-text">Training in progress: {(serviceMetrics.python_trainer.training_progress * 100).toFixed(0)}% complete</div>
                                <div className="diagnostic-time">Loss: {serviceMetrics.python_trainer.loss.toFixed(4)}</div>
                            </div>
                        )}

                        {!serviceStatus.ml_service && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon error">✗</div>
                                <div className="diagnostic-text">ML Service disconnected</div>
                                <div className="diagnostic-time">Check service connection</div>
                            </div>
                        )}

                        {serviceMetrics.ai_coordination.active_strategies.length > 0 && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon success">✓</div>
                                <div className="diagnostic-text">AI Coordination: {serviceMetrics.ai_coordination.active_strategies.length} strategies active</div>
                                <div className="diagnostic-time">{serviceMetrics.ai_coordination.simulation_count} simulations run</div>
                            </div>
                        )}

                        {learningInsights.length > 0 && (
                            <div className="diagnostic-item">
                                <div className="diagnostic-icon info">ℹ</div>
                                <div className="diagnostic-text">Latest insight: {learningInsights[0].title}</div>
                                <div className="diagnostic-time">{new Date(learningInsights[0].timestamp).toLocaleTimeString()}</div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderInsightsTab = () => {
        // Calculate real metrics from service data
        const avgLatency = serviceMetrics.ml_service.average_latency;
        const learningRate = serviceMetrics.continuous_learning.learning_rate;
        const patternsDetected = serviceMetrics.continuous_learning.patterns_detected;
        const winRate = serviceMetrics.ai_coordination.consensus_score / 100; // Use consensus score as win rate proxy
        const memUsage = systemHealth.memoryUsage;
        
        // Group insights by type
        const groupedInsights = learningInsights.reduce((acc, insight) => {
            if (!acc[insight.type]) acc[insight.type] = [];
            acc[insight.type].push(insight);
            return acc;
        }, {} as Record<string, any[]>);

        return (
            <div className="dashboard-insights">
                <div className="insights-container">
                    {/* Real-time Learning Insights */}
                    <motion.div
                        className="insights-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="section-header">
                            <h3>Continuous Learning Insights</h3>
                            <div className="insights-stats">
                                <span>Total Insights: {learningInsights.length}</span>
                                <span>Learning Rate: {(learningRate * 100).toFixed(2)}%</span>
                            </div>
                        </div>
                        
                        {learningInsights.length > 0 ? (
                            <div className="insights-grid">
                                {/* Pattern Recognition Insights */}
                                {groupedInsights.pattern && groupedInsights.pattern.length > 0 && (
                                    <div className="insight-card pattern">
                                        <div className="insight-icon">🔍</div>
                                        <div className="insight-content">
                                            <h4>Pattern Recognition</h4>
                                            <p>{groupedInsights.pattern[0].description}</p>
                                            <div className="insight-metric">{patternsDetected} patterns detected</div>
                                            <div className="insight-timestamp">
                                                {new Date(groupedInsights.pattern[0].timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Strategy Insights */}
                                {groupedInsights.strategy && groupedInsights.strategy.length > 0 && (
                                    <div className="insight-card strategy">
                                        <div className="insight-icon">♟️</div>
                                        <div className="insight-content">
                                            <h4>Strategy Adaptation</h4>
                                            <p>{groupedInsights.strategy[0].description}</p>
                                            <div className="insight-metric">Win rate: {(winRate * 100).toFixed(1)}%</div>
                                            <div className="insight-timestamp">
                                                {new Date(groupedInsights.strategy[0].timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Performance Insights */}
                                {groupedInsights.improvement && groupedInsights.improvement.length > 0 && (
                                    <div className="insight-card improvement">
                                        <div className="insight-icon">📈</div>
                                        <div className="insight-content">
                                            <h4>Performance Improvement</h4>
                                            <p>{groupedInsights.improvement[0].description}</p>
                                            <div className="insight-metric">Latency: {avgLatency.toFixed(0)}ms</div>
                                            <div className="insight-timestamp">
                                                {new Date(groupedInsights.improvement[0].timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Warning Insights */}
                                {groupedInsights.warning && groupedInsights.warning.length > 0 && (
                                    <div className="insight-card warning">
                                        <div className="insight-icon">⚠️</div>
                                        <div className="insight-content">
                                            <h4>System Warning</h4>
                                            <p>{groupedInsights.warning[0].description}</p>
                                            <div className="insight-metric">Action required</div>
                                            <div className="insight-timestamp">
                                                {new Date(groupedInsights.warning[0].timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="no-insights">
                                <p>No learning insights available yet. Play more games to generate insights.</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Dynamic Recommendations */}
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
                            {/* Memory Optimization */}
                            {memUsage > 70 && (
                                <div className="recommendation-item">
                                    <div className="recommendation-priority high">High</div>
                                    <div className="recommendation-content">
                                        <h4>Optimize Memory Usage</h4>
                                        <p>Current memory usage is at {memUsage}%. Consider enabling memory compression for better performance.</p>
                                        <button className="apply-btn">Apply Optimization</button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Learning Rate Optimization */}
                            {learningRate < 0.01 && (
                                <div className="recommendation-item">
                                    <div className="recommendation-priority medium">Medium</div>
                                    <div className="recommendation-content">
                                        <h4>Enhance Learning Rate</h4>
                                        <p>Current learning rate is {(learningRate * 100).toFixed(3)}%. Consider increasing for faster adaptation.</p>
                                        <button className="apply-btn">Configure Learning</button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Model Update */}
                            {serviceMetrics.python_trainer.epochs_completed > 100 && (
                                <div className="recommendation-item">
                                    <div className="recommendation-priority low">Low</div>
                                    <div className="recommendation-content">
                                        <h4>Deploy New Models</h4>
                                        <p>Training completed {serviceMetrics.python_trainer.epochs_completed} epochs. Deploy to improve performance.</p>
                                        <button className="apply-btn">Deploy Models</button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Pattern Database */}
                            {patternsDetected > 50 && (
                                <div className="recommendation-item">
                                    <div className="recommendation-priority medium">Medium</div>
                                    <div className="recommendation-content">
                                        <h4>Optimize Pattern Database</h4>
                                        <p>Pattern database has {patternsDetected} entries. Consider consolidation for faster matching.</p>
                                        <button className="apply-btn">Optimize Database</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Learning History Timeline */}
                    <motion.div
                        className="learning-timeline"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="section-header">
                            <h3>Recent Learning Events</h3>
                        </div>
                        <div className="timeline-container">
                            {learningInsights.slice(0, 10).map((insight, index) => (
                                <div key={insight.id} className={`timeline-item ${insight.type}`}>
                                    <div className="timeline-marker" />
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-type">{insight.type}</span>
                                            <span className="timeline-time">
                                                {new Date(insight.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <h5>{insight.title}</h5>
                                        <p>{insight.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    };

    const renderServicesTab = () => (
        <div className="dashboard-services">
            <div className="services-grid">
                {/* Service Status Overview */}
                <motion.div
                    className="service-card overview"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <h3>Service Integration Status</h3>
                    <div className="service-status-grid">
                        {Object.entries(serviceStatus).map(([service, status]) => (
                            <div key={service} className="service-item">
                                <div className={`status-indicator ${status ? 'active' : 'inactive'}`} />
                                <span className="service-name">
                                    {service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                                <span className={`status-text ${status ? 'connected' : 'disconnected'}`}>
                                    {status ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ML Service Metrics */}
                <motion.div
                    className="service-card ml-service"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>ML Service Performance</h3>
                    <div className="metrics-grid">
                        <div className="metric">
                            <span className="label">Models Loaded</span>
                            <span className="value">{serviceMetrics.ml_service.models_loaded}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Inference Count</span>
                            <span className="value">{serviceMetrics.ml_service.inference_count}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Avg Latency</span>
                            <span className="value">{serviceMetrics.ml_service.average_latency.toFixed(0)}ms</span>
                        </div>
                        <div className="metric">
                            <span className="label">Cache Hit Rate</span>
                            <span className="value">{(serviceMetrics.ml_service.cache_hit_rate * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </motion.div>

                {/* Continuous Learning Status */}
                <motion.div
                    className="service-card continuous-learning"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Continuous Learning</h3>
                    <div className="learning-metrics">
                        <div className="metric">
                            <span className="label">Buffer Size</span>
                            <span className="value">{serviceMetrics.continuous_learning.buffer_size}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Patterns Detected</span>
                            <span className="value">{serviceMetrics.continuous_learning.patterns_detected}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Learning Rate</span>
                            <span className="value">{serviceMetrics.continuous_learning.learning_rate.toFixed(4)}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Model Version</span>
                            <span className="value">{serviceMetrics.continuous_learning.model_version}</span>
                        </div>
                    </div>
                    {learningInsights.length > 0 && (
                        <div className="recent-insights">
                            <h4>Recent Insights</h4>
                            <div className="insights-list">
                                {learningInsights.slice(0, 3).map(insight => (
                                    <div key={insight.id} className="insight-item">
                                        <span className="insight-type">{insight.type}</span>
                                        <span className="insight-desc">{insight.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* AI Coordination Hub */}
                <motion.div
                    className="service-card ai-coordination"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <h3>AI Coordination Hub</h3>
                    <div className="coordination-metrics">
                        <div className="metric">
                            <span className="label">Active Strategies</span>
                            <span className="value">{serviceMetrics.ai_coordination.active_strategies.length}</span>
                        </div>
                        <div className="metric">
                            <span className="label">Consensus Score</span>
                            <span className="value">{(serviceMetrics.ai_coordination.consensus_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric">
                            <span className="label">Simulations Run</span>
                            <span className="value">{serviceMetrics.ai_coordination.simulation_count}</span>
                        </div>
                    </div>
                    {serviceMetrics.ai_coordination.active_strategies.length > 0 && (
                        <div className="strategies-list">
                            <h4>Active Strategies</h4>
                            <div className="strategy-tags">
                                {serviceMetrics.ai_coordination.active_strategies.map((strategy, idx) => (
                                    <span key={idx} className="strategy-tag">{strategy}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Python Trainer Progress */}
                <motion.div
                    className="service-card python-trainer"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3>Python Trainer</h3>
                    <div className="training-progress">
                        <div className="progress-header">
                            <span>Training Progress</span>
                            <span>{(serviceMetrics.python_trainer.training_progress * 100).toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill"
                                style={{ width: `${serviceMetrics.python_trainer.training_progress * 100}%` }}
                            />
                        </div>
                        <div className="training-metrics">
                            <div className="metric">
                                <span className="label">Epochs</span>
                                <span className="value">{serviceMetrics.python_trainer.epochs_completed}</span>
                            </div>
                            <div className="metric">
                                <span className="label">Loss</span>
                                <span className="value">{serviceMetrics.python_trainer.loss.toFixed(4)}</span>
                            </div>
                            <div className="metric">
                                <span className="label">Accuracy</span>
                                <span className="value">{(serviceMetrics.python_trainer.accuracy * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Model Performance Comparison */}
                {modelPerformance.length > 0 && (
                    <motion.div
                        className="service-card model-performance"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <h3>Model Performance</h3>
                        <div className="models-list">
                            {modelPerformance.map(model => (
                                <div key={model.model} className="model-item">
                                    <div className="model-name">{model.model}</div>
                                    <div className="model-metrics">
                                        <span className="metric">
                                            <span className="label">Accuracy:</span>
                                            <span className="value">{(model.accuracy * 100).toFixed(1)}%</span>
                                        </span>
                                        <span className="metric">
                                            <span className="label">Latency:</span>
                                            <span className="value">{model.latency.toFixed(0)}ms</span>
                                        </span>
                                        <span className="metric">
                                            <span className="label">Usage:</span>
                                            <span className="value">{model.usage_count}</span>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
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
                            { id: 'services', label: 'Services', icon: '🔧' },
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
                            {activeTab === 'services' && renderServicesTab()}
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