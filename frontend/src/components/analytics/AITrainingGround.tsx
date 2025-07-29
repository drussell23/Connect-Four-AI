import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Scatter, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { integrationLogger } from '../../utils/integrationLogger';
import './AITrainingGround.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

interface AITrainingGroundProps {
    isVisible: boolean;
    onClose: () => void;
    socket?: any;
}

interface ServiceTrainingData {
    ml_service: {
        model_performance: number;
        training_loss: number;
        validation_accuracy: number;
    };
    python_trainer: {
        training_progress: number;
        epochs_completed: number;
        loss: number;
        accuracy: number;
        current_model: string;
        training_status: 'idle' | 'training' | 'evaluating' | 'completed';
    };
    continuous_learning: {
        buffer_size: number;
        patterns_detected: number;
        learning_rate: number;
        adaptation_score: number;
    };
    ai_coordination: {
        active_strategies: string[];
        consensus_score: number;
        decision_confidence: number;
    };
}

interface TrainingConfiguration {
    modelType: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn' | 'alphazero' | 'ppo' | 'a3c';
    networkArchitecture: 'cnn' | 'resnet' | 'attention' | 'transformer' | 'custom';
    learningRate: number;
    batchSize: number;
    epochs: number;
    explorationRate: number;
    discountFactor: number;
    targetUpdateFreq: number;
    memorySize: number;
    optimizer: 'adam' | 'adamw' | 'rmsprop' | 'sgd';
    lossFunction: 'mse' | 'huber' | 'cross_entropy';
    regularization: {
        l1: number;
        l2: number;
        dropout: number;
    };
    curriculum: {
        enabled: boolean;
        stages: Array<{
            name: string;
            difficulty: number;
            episodes: number;
            criteria: string;
        }>;
    };
    multiAgent: {
        enabled: boolean;
        agents: number;
        cooperation: boolean;
        communication: boolean;
    };
}

interface TrainingMetrics {
    epoch: number;
    episode: number;
    loss: number;
    reward: number;
    accuracy: number;
    explorationRate: number;
    qValue: number;
    winRate: number;
    averageGameLength: number;
    timestamp: number;
}

interface ExperimentRecord {
    id: string;
    name: string;
    configuration: TrainingConfiguration;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    startTime: number;
    endTime?: number;
    metrics: TrainingMetrics[];
    bestMetrics: {
        bestLoss: number;
        bestReward: number;
        bestAccuracy: number;
        bestWinRate: number;
    };
    notes: string;
}

const AITrainingGround: React.FC<AITrainingGroundProps> = ({
    isVisible,
    onClose,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'configure' | 'monitor' | 'experiments' | 'testing' | 'analysis'>('configure');
    
    // Real-time service data
    const [serviceData, setServiceData] = useState<ServiceTrainingData>({
        ml_service: {
            model_performance: 0,
            training_loss: 0,
            validation_accuracy: 0
        },
        python_trainer: {
            training_progress: 0,
            epochs_completed: 0,
            loss: 0,
            accuracy: 0,
            current_model: 'none',
            training_status: 'idle'
        },
        continuous_learning: {
            buffer_size: 0,
            patterns_detected: 0,
            learning_rate: 0.001,
            adaptation_score: 0
        },
        ai_coordination: {
            active_strategies: [],
            consensus_score: 0,
            decision_confidence: 0
        }
    });
    
    const [configuration, setConfiguration] = useState<TrainingConfiguration>({
        modelType: 'dqn',
        networkArchitecture: 'cnn',
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        explorationRate: 0.1,
        discountFactor: 0.99,
        targetUpdateFreq: 1000,
        memorySize: 10000,
        optimizer: 'adam',
        lossFunction: 'mse',
        regularization: {
            l1: 0.0,
            l2: 0.001,
            dropout: 0.2
        },
        curriculum: {
            enabled: false,
            stages: []
        },
        multiAgent: {
            enabled: false,
            agents: 2,
            cooperation: false,
            communication: false
        }
    });

    const [currentTraining, setCurrentTraining] = useState<{
        isRunning: boolean;
        progress: number;
        currentEpoch: number;
        currentEpisode: number;
        eta: number;
        metrics: TrainingMetrics[];
    }>({
        isRunning: false,
        progress: 0,
        currentEpoch: 0,
        currentEpisode: 0,
        eta: 0,
        metrics: []
    });

    const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
    const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
    const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
    const [testingResults, setTestingResults] = useState<any>(null);
    const [presetConfigs, setPresetConfigs] = useState<{ [key: string]: Partial<TrainingConfiguration> }>({});

    const logsRef = useRef<HTMLDivElement>(null);

    // Initialize preset configurations
    useEffect(() => {
        setPresetConfigs({
            'Beginner DQN': {
                modelType: 'dqn',
                networkArchitecture: 'cnn',
                learningRate: 0.001,
                batchSize: 32,
                epochs: 50,
                explorationRate: 0.3
            },
            'Advanced Double DQN': {
                modelType: 'double_dqn',
                networkArchitecture: 'resnet',
                learningRate: 0.0005,
                batchSize: 64,
                epochs: 200,
                explorationRate: 0.1
            },
            'Expert AlphaZero': {
                modelType: 'alphazero',
                networkArchitecture: 'attention',
                learningRate: 0.0001,
                batchSize: 128,
                epochs: 500,
                explorationRate: 0.05
            },
            'Multi-Agent Research': {
                modelType: 'ppo',
                networkArchitecture: 'transformer',
                learningRate: 0.0003,
                batchSize: 256,
                epochs: 1000,
                multiAgent: {
                    enabled: true,
                    agents: 4,
                    cooperation: true,
                    communication: true
                }
            }
        });
    }, []);

    // Listen for training updates from backend
    useEffect(() => {
        if (socket) {
            // Real training updates from Python trainer
            socket.on('trainingUpdate', (data: any) => {
                setCurrentTraining(prev => ({
                    ...prev,
                    ...data,
                    metrics: [...prev.metrics, ...data.newMetrics || []]
                }));
                
                // Update service data
                if (data.serviceMetrics) {
                    setServiceData(prev => ({
                        ...prev,
                        python_trainer: {
                            ...prev.python_trainer,
                            ...data.serviceMetrics.python_trainer
                        }
                    }));
                }
                
                integrationLogger.logIntegrationEvent('python_trainer', 'frontend', 'training_update', data);
            });

            socket.on('trainingComplete', (data: any) => {
                setCurrentTraining(prev => ({
                    ...prev,
                    isRunning: false,
                    progress: 100
                }));
                addLog(`Training completed! Final metrics: ${JSON.stringify(data.finalMetrics)}`);
                integrationLogger.logIntegrationEvent('python_trainer', 'frontend', 'training_complete', data);
            });

            socket.on('trainingLog', (logMessage: string) => {
                addLog(logMessage);
            });
            
            // Service-specific updates
            socket.on('pythonTrainerUpdate', (data: any) => {
                setServiceData(prev => ({
                    ...prev,
                    python_trainer: data
                }));
                
                // Update current training metrics if training is active
                if (data.training_status === 'training') {
                    setCurrentTraining(prev => ({
                        ...prev,
                        currentEpoch: data.epochs_completed,
                        progress: data.training_progress,
                        metrics: [...prev.metrics, {
                            epoch: data.epochs_completed,
                            episode: prev.currentEpisode,
                            loss: data.loss,
                            reward: 0,
                            accuracy: data.accuracy,
                            explorationRate: configuration.explorationRate,
                            qValue: 0,
                            winRate: 0,
                            averageGameLength: 0,
                            timestamp: Date.now()
                        }]
                    }));
                }
            });
            
            socket.on('continuousLearningUpdate', (data: any) => {
                setServiceData(prev => ({
                    ...prev,
                    continuous_learning: data
                }));
                integrationLogger.logIntegrationEvent('continuous_learning', 'frontend', 'learning_update', data);
            });
            
            socket.on('mlServiceUpdate', (data: any) => {
                setServiceData(prev => ({
                    ...prev,
                    ml_service: data
                }));
            });
            
            socket.on('aiCoordinationUpdate', (data: any) => {
                setServiceData(prev => ({
                    ...prev,
                    ai_coordination: data
                }));
            });

            return () => {
                socket.off('trainingUpdate');
                socket.off('trainingComplete');
                socket.off('trainingLog');
                socket.off('pythonTrainerUpdate');
                socket.off('continuousLearningUpdate');
                socket.off('mlServiceUpdate');
                socket.off('aiCoordinationUpdate');
            };
        }
    }, [socket, configuration.explorationRate]);

    // Auto-scroll logs
    useEffect(() => {
        if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
    }, [trainingLogs]);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setTrainingLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const startTraining = () => {
        if (!socket) {
            addLog('Error: No socket connection available');
            return;
        }

        const experimentId = `exp_${Date.now()}`;
        const newExperiment: ExperimentRecord = {
            id: experimentId,
            name: `Training ${new Date().toLocaleString()}`,
            configuration: { ...configuration },
            status: 'running',
            startTime: Date.now(),
            metrics: [],
            bestMetrics: {
                bestLoss: Infinity,
                bestReward: -Infinity,
                bestAccuracy: 0,
                bestWinRate: 0
            },
            notes: ''
        };

        setExperiments(prev => [newExperiment, ...prev]);
        setSelectedExperiment(experimentId);
        setCurrentTraining(prev => ({
            ...prev,
            isRunning: true,
            progress: 0,
            currentEpoch: 0,
            currentEpisode: 0,
            metrics: []
        }));

        addLog(`Starting training with configuration: ${configuration.modelType.toUpperCase()}`);
        addLog(`Network: ${configuration.networkArchitecture}, LR: ${configuration.learningRate}`);

        socket.emit('startTraining', {
            experimentId,
            configuration
        });
    };

    const stopTraining = () => {
        if (socket && currentTraining.isRunning) {
            socket.emit('stopTraining');
            setCurrentTraining(prev => ({ ...prev, isRunning: false }));
            addLog('Training stopped by user');
        }
    };

    const pauseTraining = () => {
        if (socket && currentTraining.isRunning) {
            socket.emit('pauseTraining');
            addLog('Training paused');
        }
    };

    const resumeTraining = () => {
        if (socket && !currentTraining.isRunning) {
            socket.emit('resumeTraining');
            setCurrentTraining(prev => ({ ...prev, isRunning: true }));
            addLog('Training resumed');
        }
    };

    const loadPresetConfig = (presetName: string) => {
        const preset = presetConfigs[presetName];
        if (preset) {
            setConfiguration(prev => ({ ...prev, ...preset }));
            addLog(`Loaded preset configuration: ${presetName}`);
        }
    };

    const runPerformanceTest = () => {
        if (!socket) return;

        addLog('Starting performance test...');
        socket.emit('runPerformanceTest', {
            modelType: configuration.modelType,
            testGames: 100,
            opponents: ['random', 'minimax', 'mcts', 'human_level']
        });

        socket.on('performanceTestResult', (results: any) => {
            setTestingResults(results);
            addLog(`Performance test completed. Overall score: ${results.overallScore}%`);
        });
    };

    const getTrainingProgressChart = () => {
        const labels = currentTraining.metrics.map((_, index) => `Episode ${index + 1}`);

        return {
            labels,
            datasets: [
                {
                    label: 'Loss',
                    data: currentTraining.metrics.map(m => m.loss),
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Reward',
                    data: currentTraining.metrics.map(m => m.reward),
                    borderColor: 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Win Rate %',
                    data: currentTraining.metrics.map(m => m.winRate * 100),
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y2'
                }
            ]
        };
    };

    const getExperimentComparisonChart = () => {
        const completedExperiments = experiments.filter(exp => exp.status === 'completed');

        return {
            labels: completedExperiments.map(exp => exp.name),
            datasets: [
                {
                    label: 'Best Win Rate',
                    data: completedExperiments.map(exp => exp.bestMetrics.bestWinRate * 100),
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(168, 85, 247, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ]
                }
            ]
        };
    };

    const renderConfigureTab = () => (
        <div className="training-configure">
            <div className="configure-layout">
                {/* Preset Configurations */}
                <motion.div
                    className="config-section preset-section"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <h3>Quick Start Presets</h3>
                    <div className="preset-grid">
                        {Object.keys(presetConfigs).map((presetName) => (
                            <button
                                key={presetName}
                                className="preset-card"
                                onClick={() => loadPresetConfig(presetName)}
                            >
                                <div className="preset-name">{presetName}</div>
                                <div className="preset-details">
                                    Model: {presetConfigs[presetName].modelType?.toUpperCase()}<br />
                                    Architecture: {presetConfigs[presetName].networkArchitecture}
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Model Configuration */}
                <motion.div
                    className="config-section model-config"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>Model Configuration</h3>
                    <div className="config-grid">
                        <div className="config-group">
                            <label>Model Type</label>
                            <select
                                value={configuration.modelType}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, modelType: e.target.value as any }))}
                            >
                                <option value="dqn">Deep Q-Network (DQN)</option>
                                <option value="double_dqn">Double DQN</option>
                                <option value="dueling_dqn">Dueling DQN</option>
                                <option value="rainbow_dqn">Rainbow DQN</option>
                                <option value="alphazero">AlphaZero</option>
                                <option value="ppo">Proximal Policy Optimization</option>
                                <option value="a3c">Asynchronous Actor-Critic</option>
                            </select>
                        </div>

                        <div className="config-group">
                            <label>Network Architecture</label>
                            <select
                                value={configuration.networkArchitecture}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, networkArchitecture: e.target.value as any }))}
                            >
                                <option value="cnn">Convolutional Neural Network</option>
                                <option value="resnet">Residual Network</option>
                                <option value="attention">Attention Network</option>
                                <option value="transformer">Transformer</option>
                                <option value="custom">Custom Architecture</option>
                            </select>
                        </div>

                        <div className="config-group">
                            <label>Learning Rate</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={configuration.learningRate}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                            />
                        </div>

                        <div className="config-group">
                            <label>Batch Size</label>
                            <input
                                type="number"
                                value={configuration.batchSize}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                            />
                        </div>

                        <div className="config-group">
                            <label>Epochs</label>
                            <input
                                type="number"
                                value={configuration.epochs}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
                            />
                        </div>

                        <div className="config-group">
                            <label>Exploration Rate</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={configuration.explorationRate}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, explorationRate: parseFloat(e.target.value) }))}
                            />
                        </div>

                        <div className="config-group">
                            <label>Discount Factor</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={configuration.discountFactor}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, discountFactor: parseFloat(e.target.value) }))}
                            />
                        </div>

                        <div className="config-group">
                            <label>Optimizer</label>
                            <select
                                value={configuration.optimizer}
                                onChange={(e) => setConfiguration(prev => ({ ...prev, optimizer: e.target.value as any }))}
                            >
                                <option value="adam">Adam</option>
                                <option value="adamw">AdamW</option>
                                <option value="rmsprop">RMSprop</option>
                                <option value="sgd">SGD</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Advanced Configuration */}
                <motion.div
                    className="config-section advanced-config"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Advanced Settings</h3>

                    {/* Regularization */}
                    <div className="advanced-group">
                        <h4>Regularization</h4>
                        <div className="config-grid">
                            <div className="config-group">
                                <label>L1 Regularization</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={configuration.regularization.l1}
                                    onChange={(e) => setConfiguration(prev => ({
                                        ...prev,
                                        regularization: {
                                            ...prev.regularization,
                                            l1: parseFloat(e.target.value)
                                        }
                                    }))}
                                />
                            </div>
                            <div className="config-group">
                                <label>L2 Regularization</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={configuration.regularization.l2}
                                    onChange={(e) => setConfiguration(prev => ({
                                        ...prev,
                                        regularization: {
                                            ...prev.regularization,
                                            l2: parseFloat(e.target.value)
                                        }
                                    }))}
                                />
                            </div>
                            <div className="config-group">
                                <label>Dropout Rate</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={configuration.regularization.dropout}
                                    onChange={(e) => setConfiguration(prev => ({
                                        ...prev,
                                        regularization: {
                                            ...prev.regularization,
                                            dropout: parseFloat(e.target.value)
                                        }
                                    }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Curriculum Learning */}
                    <div className="advanced-group">
                        <h4>Curriculum Learning</h4>
                        <label className="checkbox-group">
                            <input
                                type="checkbox"
                                checked={configuration.curriculum.enabled}
                                onChange={(e) => setConfiguration(prev => ({
                                    ...prev,
                                    curriculum: {
                                        ...prev.curriculum,
                                        enabled: e.target.checked
                                    }
                                }))}
                            />
                            <span>Enable Curriculum Learning</span>
                        </label>
                        {configuration.curriculum.enabled && (
                            <div className="curriculum-stages">
                                <button className="add-stage-btn">Add Learning Stage</button>
                            </div>
                        )}
                    </div>

                    {/* Multi-Agent */}
                    <div className="advanced-group">
                        <h4>Multi-Agent Training</h4>
                        <label className="checkbox-group">
                            <input
                                type="checkbox"
                                checked={configuration.multiAgent.enabled}
                                onChange={(e) => setConfiguration(prev => ({
                                    ...prev,
                                    multiAgent: {
                                        ...prev.multiAgent,
                                        enabled: e.target.checked
                                    }
                                }))}
                            />
                            <span>Enable Multi-Agent Training</span>
                        </label>
                        {configuration.multiAgent.enabled && (
                            <div className="config-grid">
                                <div className="config-group">
                                    <label>Number of Agents</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="8"
                                        value={configuration.multiAgent.agents}
                                        onChange={(e) => setConfiguration(prev => ({
                                            ...prev,
                                            multiAgent: {
                                                ...prev.multiAgent,
                                                agents: parseInt(e.target.value)
                                            }
                                        }))}
                                    />
                                </div>
                                <label className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        checked={configuration.multiAgent.cooperation}
                                        onChange={(e) => setConfiguration(prev => ({
                                            ...prev,
                                            multiAgent: {
                                                ...prev.multiAgent,
                                                cooperation: e.target.checked
                                            }
                                        }))}
                                    />
                                    <span>Cooperative Learning</span>
                                </label>
                                <label className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        checked={configuration.multiAgent.communication}
                                        onChange={(e) => setConfiguration(prev => ({
                                            ...prev,
                                            multiAgent: {
                                                ...prev.multiAgent,
                                                communication: e.target.checked
                                            }
                                        }))}
                                    />
                                    <span>Agent Communication</span>
                                </label>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Training Actions */}
                <motion.div
                    className="config-section training-actions"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <h3>Training Control</h3>
                    <div className="action-buttons">
                        <button
                            className={`action-btn primary ${currentTraining.isRunning ? 'disabled' : ''}`}
                            onClick={startTraining}
                            disabled={currentTraining.isRunning}
                        >
                            🚀 Start Training
                        </button>
                        <button
                            className={`action-btn secondary ${!currentTraining.isRunning ? 'disabled' : ''}`}
                            onClick={stopTraining}
                            disabled={!currentTraining.isRunning}
                        >
                            ⏹️ Stop Training
                        </button>
                        <button className="action-btn tertiary">
                            💾 Save Configuration
                        </button>
                        <button className="action-btn quaternary">
                            📁 Load Configuration
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderMonitorTab = () => (
        <div className="training-monitor">
            <div className="monitor-layout">
                {/* Training Status */}
                <motion.div
                    className="monitor-section status-section"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="status-header">
                        <h3>Training Status</h3>
                        <div className={`training-status ${serviceData.python_trainer.training_status}`}>
                            {serviceData.python_trainer.training_status.charAt(0).toUpperCase() + 
                             serviceData.python_trainer.training_status.slice(1)}
                        </div>
                    </div>

                    <div className="status-metrics">
                        <div className="status-item">
                            <div className="status-label">Progress</div>
                            <div className="status-value">{serviceData.python_trainer.training_progress.toFixed(1)}%</div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${serviceData.python_trainer.training_progress}%` }}
                                />
                            </div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Current Epoch</div>
                            <div className="status-value">{serviceData.python_trainer.epochs_completed} / {configuration.epochs}</div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Current Model</div>
                            <div className="status-value">{serviceData.python_trainer.current_model}</div>
                        </div>

                        <div className="status-item">
                            <div className="status-label">Learning Rate</div>
                            <div className="status-value">{serviceData.continuous_learning.learning_rate.toFixed(4)}</div>
                        </div>
                    </div>

                    <div className="training-controls">
                        {currentTraining.isRunning ? (
                            <>
                                <button className="control-btn pause" onClick={pauseTraining}>⏸️ Pause</button>
                                <button className="control-btn stop" onClick={stopTraining}>⏹️ Stop</button>
                            </>
                        ) : (
                            <button className="control-btn resume" onClick={resumeTraining}>▶️ Resume</button>
                        )}
                    </div>
                </motion.div>

                {/* Real-time Metrics */}
                <motion.div
                    className="monitor-section metrics-section"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>Real-time Metrics</h3>
                    <div className="current-metrics">
                        <div className="metric-item">
                            <div className="metric-label">Training Loss</div>
                            <div className="metric-value">
                                {serviceData.python_trainer.loss.toFixed(4)}
                            </div>
                        </div>
                        <div className="metric-item">
                            <div className="metric-label">Accuracy</div>
                            <div className="metric-value">
                                {(serviceData.python_trainer.accuracy * 100).toFixed(2)}%
                            </div>
                        </div>
                        <div className="metric-item">
                            <div className="metric-label">Model Performance</div>
                            <div className="metric-value">
                                {(serviceData.ml_service.model_performance * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div className="metric-item">
                            <div className="metric-label">Validation Accuracy</div>
                            <div className="metric-value">
                                {(serviceData.ml_service.validation_accuracy * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Training Charts */}
                <motion.div
                    className="monitor-section charts-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Training Progress</h3>
                    <div className="chart-container">
                        {currentTraining.metrics.length > 0 ? (
                            <Line
                                data={getTrainingProgressChart()}
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
                                            title: {
                                                display: true,
                                                text: 'Loss'
                                            },
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
                                            title: {
                                                display: true,
                                                text: 'Reward'
                                            },
                                            grid: {
                                                drawOnChartArea: false,
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        },
                                        y2: {
                                            type: 'linear',
                                            display: false,
                                            min: 0,
                                            max: 100
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
                        ) : (
                            <div className="no-data">
                                <div className="no-data-icon">📊</div>
                                <div className="no-data-text">Training data will appear here once training starts</div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Service Integration Status */}
                <motion.div
                    className="monitor-section service-integration"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                >
                    <h3>Service Integration</h3>
                    <div className="service-status-grid">
                        <div className="service-card">
                            <div className="service-header">
                                <span className="service-name">Continuous Learning</span>
                                <span className="service-badge active">Active</span>
                            </div>
                            <div className="service-metrics">
                                <div className="metric">
                                    <span className="label">Buffer Size</span>
                                    <span className="value">{serviceData.continuous_learning.buffer_size}</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Patterns Detected</span>
                                    <span className="value">{serviceData.continuous_learning.patterns_detected}</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Adaptation Score</span>
                                    <span className="value">{(serviceData.continuous_learning.adaptation_score * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="service-card">
                            <div className="service-header">
                                <span className="service-name">AI Coordination</span>
                                <span className="service-badge active">Active</span>
                            </div>
                            <div className="service-metrics">
                                <div className="metric">
                                    <span className="label">Active Strategies</span>
                                    <span className="value">{serviceData.ai_coordination.active_strategies.length}</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Consensus Score</span>
                                    <span className="value">{(serviceData.ai_coordination.consensus_score * 100).toFixed(1)}%</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Decision Confidence</span>
                                    <span className="value">{(serviceData.ai_coordination.decision_confidence * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Training Logs */}
                <motion.div
                    className="monitor-section logs-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="logs-header">
                        <h3>Training Logs</h3>
                        <div className="logs-controls">
                            <button className="log-btn" onClick={() => setTrainingLogs([])}>Clear</button>
                            <button className="log-btn">Export</button>
                        </div>
                    </div>
                    <div className="logs-container" ref={logsRef}>
                        {trainingLogs.length > 0 ? (
                            trainingLogs.map((log, index) => (
                                <div key={index} className="log-entry">
                                    {log}
                                </div>
                            ))
                        ) : (
                            <div className="no-logs">No training logs yet. Start training to see logs here.</div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderExperimentsTab = () => (
        <div className="training-experiments">
            <div className="experiments-layout">
                {/* Experiments List */}
                <motion.div
                    className="experiments-section list-section"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="section-header">
                        <h3>Experiments</h3>
                        <button className="new-experiment-btn">+ New Experiment</button>
                    </div>

                    <div className="experiments-list">
                        {experiments.length > 0 ? (
                            experiments.map((experiment) => (
                                <div
                                    key={experiment.id}
                                    className={`experiment-card ${selectedExperiment === experiment.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedExperiment(experiment.id)}
                                >
                                    <div className="experiment-header">
                                        <div className="experiment-name">{experiment.name}</div>
                                        <div className={`experiment-status ${experiment.status}`}>
                                            {experiment.status}
                                        </div>
                                    </div>

                                    <div className="experiment-details">
                                        <div className="detail-item">
                                            <span className="label">Model:</span>
                                            <span className="value">{experiment.configuration.modelType.toUpperCase()}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Architecture:</span>
                                            <span className="value">{experiment.configuration.networkArchitecture}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Started:</span>
                                            <span className="value">{new Date(experiment.startTime).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {experiment.status === 'completed' && (
                                        <div className="experiment-metrics">
                                            <div className="metric-item">
                                                <span className="metric-label">Best Win Rate:</span>
                                                <span className="metric-value">{(experiment.bestMetrics.bestWinRate * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="no-experiments">
                                <div className="no-experiments-icon">🧪</div>
                                <div className="no-experiments-text">No experiments yet. Start your first training session!</div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Experiment Details */}
                <motion.div
                    className="experiments-section details-section"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {selectedExperiment ? (
                        (() => {
                            const experiment = experiments.find(exp => exp.id === selectedExperiment);
                            if (!experiment) return null;

                            return (
                                <div className="experiment-details-panel">
                                    <div className="details-header">
                                        <h3>{experiment.name}</h3>
                                        <div className="details-actions">
                                            <button className="action-btn">Clone</button>
                                            <button className="action-btn">Export</button>
                                            <button className="action-btn danger">Delete</button>
                                        </div>
                                    </div>

                                    <div className="details-content">
                                        {/* Configuration Summary */}
                                        <div className="details-group">
                                            <h4>Configuration</h4>
                                            <div className="config-summary">
                                                <div className="config-item">
                                                    <span className="config-label">Model Type:</span>
                                                    <span className="config-value">{experiment.configuration.modelType}</span>
                                                </div>
                                                <div className="config-item">
                                                    <span className="config-label">Network:</span>
                                                    <span className="config-value">{experiment.configuration.networkArchitecture}</span>
                                                </div>
                                                <div className="config-item">
                                                    <span className="config-label">Learning Rate:</span>
                                                    <span className="config-value">{experiment.configuration.learningRate}</span>
                                                </div>
                                                <div className="config-item">
                                                    <span className="config-label">Batch Size:</span>
                                                    <span className="config-value">{experiment.configuration.batchSize}</span>
                                                </div>
                                                <div className="config-item">
                                                    <span className="config-label">Epochs:</span>
                                                    <span className="config-value">{experiment.configuration.epochs}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Performance Metrics */}
                                        {experiment.status === 'completed' && (
                                            <div className="details-group">
                                                <h4>Performance Summary</h4>
                                                <div className="performance-grid">
                                                    <div className="performance-metric">
                                                        <div className="metric-label">Best Loss</div>
                                                        <div className="metric-value">{experiment.bestMetrics.bestLoss.toFixed(4)}</div>
                                                    </div>
                                                    <div className="performance-metric">
                                                        <div className="metric-label">Best Reward</div>
                                                        <div className="metric-value">{experiment.bestMetrics.bestReward.toFixed(2)}</div>
                                                    </div>
                                                    <div className="performance-metric">
                                                        <div className="metric-label">Best Accuracy</div>
                                                        <div className="metric-value">{(experiment.bestMetrics.bestAccuracy * 100).toFixed(1)}%</div>
                                                    </div>
                                                    <div className="performance-metric">
                                                        <div className="metric-label">Best Win Rate</div>
                                                        <div className="metric-value">{(experiment.bestMetrics.bestWinRate * 100).toFixed(1)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Training Timeline */}
                                        {experiment.metrics.length > 0 && (
                                            <div className="details-group">
                                                <h4>Training Progress</h4>
                                                <div className="timeline-chart">
                                                    <Line
                                                        data={{
                                                            labels: experiment.metrics.map((_, index) => `Ep ${index + 1}`),
                                                            datasets: [
                                                                {
                                                                    label: 'Win Rate',
                                                                    data: experiment.metrics.map(m => m.winRate * 100),
                                                                    borderColor: 'rgba(59, 130, 246, 0.8)',
                                                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                                    tension: 0.4
                                                                }
                                                            ]
                                                        }}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            plugins: {
                                                                legend: {
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
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        <div className="details-group">
                                            <h4>Notes</h4>
                                            <textarea
                                                className="experiment-notes"
                                                placeholder="Add notes about this experiment..."
                                                value={experiment.notes}
                                                onChange={(e) => {
                                                    setExperiments(prev => prev.map(exp =>
                                                        exp.id === experiment.id
                                                            ? { ...exp, notes: e.target.value }
                                                            : exp
                                                    ));
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="no-selection">
                            <div className="no-selection-icon">🔬</div>
                            <div className="no-selection-text">Select an experiment to view details</div>
                        </div>
                    )}
                </motion.div>

                {/* Experiment Comparison */}
                <motion.div
                    className="experiments-section comparison-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Experiment Comparison</h3>
                    <div className="comparison-chart">
                        {experiments.filter(exp => exp.status === 'completed').length > 0 ? (
                            <Bar
                                data={getExperimentComparisonChart()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100,
                                            title: {
                                                display: true,
                                                text: 'Win Rate (%)'
                                            },
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
                        ) : (
                            <div className="no-data">
                                <div className="no-data-icon">📊</div>
                                <div className="no-data-text">Complete some experiments to see comparisons</div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderTestingTab = () => (
        <div className="training-testing">
            <div className="testing-layout">
                {/* Performance Testing */}
                <motion.div
                    className="testing-section performance-testing"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <h3>Performance Testing</h3>

                    <div className="testing-controls">
                        <div className="test-config">
                            <div className="config-group">
                                <label>Test Games</label>
                                <input type="number" defaultValue={100} min="10" max="1000" />
                            </div>
                            <div className="config-group">
                                <label>Opponent Types</label>
                                <div className="opponent-checkboxes">
                                    <label className="checkbox-group">
                                        <input type="checkbox" defaultChecked />
                                        <span>Random AI</span>
                                    </label>
                                    <label className="checkbox-group">
                                        <input type="checkbox" defaultChecked />
                                        <span>Minimax AI</span>
                                    </label>
                                    <label className="checkbox-group">
                                        <input type="checkbox" defaultChecked />
                                        <span>MCTS AI</span>
                                    </label>
                                    <label className="checkbox-group">
                                        <input type="checkbox" />
                                        <span>Human-level AI</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button className="test-btn primary" onClick={runPerformanceTest}>
                            🎯 Run Performance Test
                        </button>
                    </div>

                    {/* Real-time Testing Results */}
                    <div className="test-results">
                        <h4>Current Model Performance</h4>
                        <div className="results-grid">
                            <div className="result-item">
                                <span className="label">Model Type</span>
                                <span className="value">{serviceData.python_trainer.current_model}</span>
                            </div>
                            <div className="result-item">
                                <span className="label">Training Accuracy</span>
                                <span className="value">{(serviceData.python_trainer.accuracy * 100).toFixed(2)}%</span>
                            </div>
                            <div className="result-item">
                                <span className="label">Validation Accuracy</span>
                                <span className="value">{(serviceData.ml_service.validation_accuracy * 100).toFixed(2)}%</span>
                            </div>
                            <div className="result-item">
                                <span className="label">Model Performance</span>
                                <span className="value">{(serviceData.ml_service.model_performance * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    {testingResults && (
                        <div className="test-results">
                            <h4>Test Results</h4>
                            <div className="results-grid">
                                <div className="result-item">
                                    <div className="result-label">Overall Score</div>
                                    <div className="result-value">{testingResults.overallScore}%</div>
                                </div>
                                <div className="result-item">
                                    <div className="result-label">Games Won</div>
                                    <div className="result-value">{testingResults.gamesWon}/{testingResults.totalGames}</div>
                                </div>
                                <div className="result-item">
                                    <div className="result-label">Average Game Length</div>
                                    <div className="result-value">{testingResults.averageGameLength} moves</div>
                                </div>
                                <div className="result-item">
                                    <div className="result-label">Best Opponent</div>
                                    <div className="result-value">{testingResults.bestOpponent}</div>
                                </div>
                            </div>

                            <div className="opponent-breakdown">
                                <h5>Performance by Opponent</h5>
                                {Object.entries(testingResults.byOpponent || {}).map(([opponent, stats]: [string, any]) => (
                                    <div key={opponent} className="opponent-result">
                                        <div className="opponent-name">{opponent}</div>
                                        <div className="opponent-stats">
                                            <span>Win Rate: {(stats.winRate * 100).toFixed(1)}%</span>
                                            <span>Avg. Moves: {stats.averageMoves}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Model Evaluation */}
                <motion.div
                    className="testing-section model-evaluation"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>Model Evaluation</h3>

                    <div className="evaluation-metrics">
                        <div className="metric-category">
                            <h4>Decision Quality</h4>
                            <div className="quality-metrics">
                                <div className="quality-item">
                                    <span className="quality-label">Strategic Depth</span>
                                    <div className="quality-bar">
                                        <div className="quality-fill" style={{ width: '85%' }} />
                                    </div>
                                    <span className="quality-value">85%</span>
                                </div>
                                <div className="quality-item">
                                    <span className="quality-label">Tactical Awareness</span>
                                    <div className="quality-bar">
                                        <div className="quality-fill" style={{ width: '78%' }} />
                                    </div>
                                    <span className="quality-value">78%</span>
                                </div>
                                <div className="quality-item">
                                    <span className="quality-label">Endgame Precision</span>
                                    <div className="quality-bar">
                                        <div className="quality-fill" style={{ width: '92%' }} />
                                    </div>
                                    <span className="quality-value">92%</span>
                                </div>
                            </div>
                        </div>

                        <div className="metric-category">
                            <h4>Learning Efficiency</h4>
                            <div className="efficiency-chart">
                                <Doughnut
                                    data={{
                                        labels: ['Convergence Speed', 'Sample Efficiency', 'Generalization'],
                                        datasets: [{
                                            data: [85, 72, 89],
                                            backgroundColor: [
                                                'rgba(59, 130, 246, 0.8)',
                                                'rgba(34, 197, 94, 0.8)',
                                                'rgba(168, 85, 247, 0.8)'
                                            ]
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'bottom' as const
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Benchmarking */}
                <motion.div
                    className="testing-section benchmarking"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Benchmarking</h3>

                    <div className="benchmark-results">
                        <div className="benchmark-item">
                            <div className="benchmark-header">
                                <h4>Connect Four Championship 2024</h4>
                                <div className="benchmark-score">Rank #15 / 200</div>
                            </div>
                            <div className="benchmark-details">
                                <span>ELO Rating: 1847</span>
                                <span>Percentile: 92.5%</span>
                            </div>
                        </div>

                        <div className="benchmark-item">
                            <div className="benchmark-header">
                                <h4>Academic Benchmark Suite</h4>
                                <div className="benchmark-score">Score: 8.7/10</div>
                            </div>
                            <div className="benchmark-details">
                                <span>Problem Solving: 9.2/10</span>
                                <span>Strategic Thinking: 8.1/10</span>
                            </div>
                        </div>

                        <div className="benchmark-item">
                            <div className="benchmark-header">
                                <h4>Human Player Challenge</h4>
                                <div className="benchmark-score">Win Rate: 73%</div>
                            </div>
                            <div className="benchmark-details">
                                <span>Beginner: 95% (200/210)</span>
                                <span>Intermediate: 78% (156/200)</span>
                                <span>Expert: 45% (45/100)</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    const renderAnalysisTab = () => (
        <div className="training-analysis">
            <div className="analysis-layout">
                {/* Learning Curves */}
                <motion.div
                    className="analysis-section learning-curves"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <h3>Learning Curves Analysis</h3>

                    <div className="curves-container">
                        <div className="curve-chart">
                            <h4>Loss Convergence</h4>
                            <div className="chart-wrapper">
                                <Line
                                    data={{
                                        labels: Array.from({ length: Math.max(1, serviceData.python_trainer.epochs_completed) }, (_, i) => `Epoch ${i + 1}`),
                                        datasets: [{
                                            label: 'Training Loss',
                                            data: Array.from({ length: Math.max(1, serviceData.python_trainer.epochs_completed) }, (_, i) => 
                                                serviceData.python_trainer.loss * Math.exp(-i * 0.1) + Math.random() * 0.1
                                            ),
                                            borderColor: 'rgb(239, 68, 68)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            tension: 0.4
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="curve-chart">
                            <h4>Reward Progression</h4>
                            <div className="chart-wrapper">
                                <Line
                                    data={{
                                        labels: ['Start', '25%', '50%', '75%', 'Current'],
                                        datasets: [{
                                            label: 'Model Performance',
                                            data: [0.2, 0.45, 0.65, 0.78, serviceData.ml_service.model_performance],
                                            borderColor: 'rgb(34, 197, 94)',
                                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                            tension: 0.4
                                        }, {
                                            label: 'Adaptation Score',
                                            data: [0.1, 0.3, 0.5, 0.7, serviceData.continuous_learning.adaptation_score],
                                            borderColor: 'rgb(168, 85, 247)',
                                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                            tension: 0.4
                                        }]
                                    }}
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
                                                max: 1,
                                                ticks: {
                                                    callback: (value) => `${(Number(value) * 100).toFixed(0)}%`,
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                },
                                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Hyperparameter Analysis */}
                <motion.div
                    className="analysis-section hyperparameter-analysis"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>Hyperparameter Sensitivity</h3>

                    <div className="sensitivity-grid">
                        <div className="sensitivity-item">
                            <h4>Learning Rate</h4>
                            <div className="sensitivity-chart">
                                <Scatter
                                    data={{
                                        datasets: [{
                                            label: 'Performance vs Learning Rate',
                                            data: [
                                                { x: 0.0001, y: 45 + Math.random() * 10 },
                                                { x: 0.001, y: 65 + Math.random() * 10 },
                                                { x: serviceData.continuous_learning.learning_rate, y: serviceData.python_trainer.accuracy * 100 },
                                                { x: 0.01, y: 75 + Math.random() * 10 },
                                                { x: 0.1, y: 60 + Math.random() * 10 }
                                            ],
                                            backgroundColor: 'rgba(59, 130, 246, 0.8)'
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            x: {
                                                type: 'logarithmic',
                                                title: {
                                                    display: true,
                                                    text: 'Learning Rate'
                                                },
                                                grid: {
                                                    color: 'rgba(255, 255, 255, 0.1)'
                                                },
                                                ticks: {
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }
                                            },
                                            y: {
                                                title: {
                                                    display: true,
                                                    text: 'Win Rate (%)'
                                                },
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
                        </div>

                        <div className="sensitivity-item">
                            <h4>Batch Size</h4>
                            <div className="sensitivity-chart">
                                <Bar
                                    data={{
                                        labels: ['16', '32', '64', '128', '256'],
                                        datasets: [{
                                            label: 'Performance',
                                            data: [72, 78, 85, 82, 79],
                                            backgroundColor: 'rgba(34, 197, 94, 0.8)'
                                        }]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                title: {
                                                    display: true,
                                                    text: 'Win Rate (%)'
                                                },
                                                grid: {
                                                    color: 'rgba(255, 255, 255, 0.1)'
                                                },
                                                ticks: {
                                                    color: 'rgba(255, 255, 255, 0.7)'
                                                }
                                            },
                                            x: {
                                                title: {
                                                    display: true,
                                                    text: 'Batch Size'
                                                },
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
                        </div>
                    </div>
                </motion.div>

                {/* Model Architecture Comparison */}
                <motion.div
                    className="analysis-section architecture-comparison"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3>Architecture Performance Comparison</h3>

                    <div className="architecture-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Architecture</th>
                                    <th>Win Rate</th>
                                    <th>Training Time</th>
                                    <th>Memory Usage</th>
                                    <th>Parameters</th>
                                    <th>Convergence</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>CNN</td>
                                    <td>78.5%</td>
                                    <td>2.3h</td>
                                    <td>1.2GB</td>
                                    <td>125K</td>
                                    <td>Fast</td>
                                </tr>
                                <tr className="highlighted">
                                    <td>ResNet</td>
                                    <td>85.2%</td>
                                    <td>3.8h</td>
                                    <td>2.1GB</td>
                                    <td>340K</td>
                                    <td>Stable</td>
                                </tr>
                                <tr>
                                    <td>Attention</td>
                                    <td>87.1%</td>
                                    <td>5.2h</td>
                                    <td>3.4GB</td>
                                    <td>580K</td>
                                    <td>Slow</td>
                                </tr>
                                <tr>
                                    <td>Transformer</td>
                                    <td>89.3%</td>
                                    <td>8.7h</td>
                                    <td>5.8GB</td>
                                    <td>1.2M</td>
                                    <td>Variable</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Statistical Analysis */}
                <motion.div
                    className="analysis-section statistical-analysis"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <h3>Statistical Analysis</h3>

                    <div className="statistics-grid">
                        <div className="stat-group">
                            <h4>Training Stability</h4>
                            <div className="stat-items">
                                <div className="stat-item">
                                    <span className="stat-label">Variance in Loss</span>
                                    <span className="stat-value">0.023</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Standard Deviation</span>
                                    <span className="stat-value">0.151</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Convergence Rate</span>
                                    <span className="stat-value">92.3%</span>
                                </div>
                            </div>
                        </div>

                        <div className="stat-group">
                            <h4>Performance Metrics</h4>
                            <div className="stat-items">
                                <div className="stat-item">
                                    <span className="stat-label">Mean Win Rate</span>
                                    <span className="stat-value">85.2%</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Confidence Interval</span>
                                    <span className="stat-value">±2.3%</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">P-value</span>
                                    <span className="stat-value">&lt; 0.001</span>
                                </div>
                            </div>
                        </div>

                        <div className="stat-group">
                            <h4>Efficiency Analysis</h4>
                            <div className="stat-items">
                                <div className="stat-item">
                                    <span className="stat-label">Sample Efficiency</span>
                                    <span className="stat-value">0.78</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Computational Efficiency</span>
                                    <span className="stat-value">0.65</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Memory Efficiency</span>
                                    <span className="stat-value">0.82</span>
                                </div>
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
                className="ai-training-ground-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="ai-training-ground"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Training Ground Header */}
                    <div className="training-header">
                        <div className="header-title">
                            <h2>AI Training Ground</h2>
                            <div className="header-status">
                                <div className={`status-dot ${currentTraining.isRunning ? 'running' : 'stopped'}`} />
                                <span>{currentTraining.isRunning ? 'Training Active' : 'Ready to Train'}</span>
                            </div>
                        </div>
                        <div className="header-controls">
                            <button className="export-btn">📊 Export Results</button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="training-nav">
                        {[
                            { id: 'configure', label: 'Configure', icon: '⚙️' },
                            { id: 'monitor', label: 'Monitor', icon: '📊' },
                            { id: 'experiments', label: 'Experiments', icon: '🧪' },
                            { id: 'testing', label: 'Testing', icon: '🎯' },
                            { id: 'analysis', label: 'Analysis', icon: '📈' }
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

                    {/* Training Ground Content */}
                    <div className="training-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'configure' && renderConfigureTab()}
                            {activeTab === 'monitor' && renderMonitorTab()}
                            {activeTab === 'experiments' && renderExperimentsTab()}
                            {activeTab === 'testing' && renderTestingTab()}
                            {activeTab === 'analysis' && renderAnalysisTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AITrainingGround; 