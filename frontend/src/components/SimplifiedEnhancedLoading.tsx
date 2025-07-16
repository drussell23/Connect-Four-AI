import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './EnhancedLoadingSystem.css';

interface LoadingStep {
    id: string;
    label: string;
    progress: number;
    status: 'pending' | 'loading' | 'complete' | 'error';
    duration?: number;
    icon?: string;
    color?: string;
    description?: string;
}

interface UserPreferences {
    theme: 'cyber' | 'neural' | 'quantum' | 'matrix' | 'organic' | 'minimal' | 'retro' | 'neon';
    soundEnabled: boolean;
    animationSpeed: number;
    particleCount: number;
    showMetrics: boolean;
    autoStart: boolean;
    accessibility: {
        reducedMotion: boolean;
        highContrast: boolean;
        largeText: boolean;
        screenReader: boolean;
    };
}

interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
    diskIO: number;
    gpuUsage: number;
    temperature: number;
}

interface SimplifiedEnhancedLoadingProps {
    isVisible: boolean;
    onComplete: () => void;
    enableMetrics?: boolean;
    assetsToPreload?: string[];
}

const SimplifiedEnhancedLoading: React.FC<SimplifiedEnhancedLoadingProps> = ({
    isVisible,
    onComplete,
    enableMetrics = true,
    assetsToPreload = []
}) => {
    // Core State
    const [currentStep, setCurrentStep] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [showMetricsPanel, setShowMetricsPanel] = useState(enableMetrics);
    const [interactionCount, setInteractionCount] = useState(0);

    // User Preferences
    const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => {
        const saved = localStorage.getItem('loadingPreferences');
        return saved ? JSON.parse(saved) : {
            theme: 'cyber' as const,
            soundEnabled: true,
            animationSpeed: 1,
            particleCount: 50,
            showMetrics: true,
            autoStart: true,
            accessibility: {
                reducedMotion: false,
                highContrast: false,
                largeText: false,
                screenReader: false
            }
        };
    });

    // System Metrics
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
        cpuUsage: 25,
        memoryUsage: 45,
        networkLatency: 35,
        diskIO: 20,
        gpuUsage: 30,
        temperature: 55
    });

    // Audio Context
    const audioContextRef = useRef<AudioContext>();

    // Enhanced Steps
    const [steps, setSteps] = useState<LoadingStep[]>([
        {
            id: 'quantum-bootstrap',
            label: 'Quantum Bootstrap Sequence',
            progress: 0,
            status: 'pending',
            duration: 2500,
            icon: '⚛️',
            color: '#00f5ff',
            description: 'Initializing quantum computational cores...'
        },
        {
            id: 'neural-mesh',
            label: 'Neural Mesh Construction',
            progress: 0,
            status: 'pending',
            duration: 3200,
            icon: '🧠',
            color: '#ff006e',
            description: 'Establishing synaptic networks...'
        },
        {
            id: 'consciousness-matrix',
            label: 'Consciousness Matrix Online',
            progress: 0,
            status: 'pending',
            duration: 2800,
            icon: '🤖',
            color: '#8338ec',
            description: 'Awakening artificial intelligence...'
        },
        {
            id: 'reality-calibration',
            label: 'Reality Calibration Protocol',
            progress: 0,
            status: 'pending',
            duration: 2000,
            icon: '🌐',
            color: '#3a86ff',
            description: 'Synchronizing dimensional parameters...'
        },
        {
            id: 'strategic-engine',
            label: 'Strategic Engine Deployment',
            progress: 0,
            status: 'pending',
            duration: 1800,
            icon: '🎮',
            color: '#06ffa5',
            description: 'Loading tactical algorithms...'
        },
        {
            id: 'combat-systems',
            label: 'Combat Systems Integration',
            progress: 0,
            status: 'pending',
            duration: 1500,
            icon: '⚔️',
            color: '#ffbe0b',
            description: 'All systems operational!'
        }
    ]);

    // Theme Configuration
    const themes = {
        cyber: {
            name: 'Cyberpunk',
            primary: '#00f5ff',
            secondary: '#ff006e',
            accent: '#8338ec',
            background: 'from-blue-900 via-purple-900 to-indigo-900'
        },
        neural: {
            name: 'Neural Network',
            primary: '#ff006e',
            secondary: '#8338ec',
            accent: '#00f5ff',
            background: 'from-pink-900 via-purple-900 to-blue-900'
        },
        quantum: {
            name: 'Quantum Field',
            primary: '#06ffa5',
            secondary: '#3a86ff',
            accent: '#ffbe0b',
            background: 'from-green-900 via-blue-900 to-yellow-900'
        },
        matrix: {
            name: 'Matrix Code',
            primary: '#00ff00',
            secondary: '#00aa00',
            accent: '#ffffff',
            background: 'from-black via-green-900 to-black'
        },
        organic: {
            name: 'Bio-Neural',
            primary: '#ff6b35',
            secondary: '#f7931e',
            accent: '#ffe66d',
            background: 'from-orange-900 via-red-900 to-yellow-900'
        },
        minimal: {
            name: 'Minimal Design',
            primary: '#ffffff',
            secondary: '#e5e5e5',
            accent: '#cccccc',
            background: 'from-gray-900 via-gray-800 to-gray-900'
        },
        retro: {
            name: 'Retro Wave',
            primary: '#ff0080',
            secondary: '#00ffff',
            accent: '#ffff00',
            background: 'from-purple-900 via-pink-900 to-blue-900'
        },
        neon: {
            name: 'Neon Glow',
            primary: '#ff073a',
            secondary: '#39ff14',
            accent: '#ff7700',
            background: 'from-black via-gray-900 to-black'
        }
    };

    const currentTheme = themes[userPreferences.theme];

    // Simple Audio System
    const playSimpleSound = useCallback((frequency: number, duration: number = 0.2) => {
        if (!userPreferences.soundEnabled) return;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            // Check if context is suspended and resume if needed
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            // Only proceed if context is running or resuming
            if (audioContextRef.current.state === 'closed') {
                return; // Don't try to use a closed context
            }

            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);

            oscillator.start();
            oscillator.stop(audioContextRef.current.currentTime + duration);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }, [userPreferences.soundEnabled]);

    // System Metrics Simulation
    const updateSystemMetrics = useCallback(() => {
        setSystemMetrics(prev => ({
            cpuUsage: Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() - 0.5) * 10)),
            memoryUsage: Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() - 0.5) * 5)),
            networkLatency: Math.max(10, Math.min(200, prev.networkLatency + (Math.random() - 0.5) * 20)),
            diskIO: Math.max(0, Math.min(100, prev.diskIO + (Math.random() - 0.5) * 15)),
            gpuUsage: Math.max(0, Math.min(100, prev.gpuUsage + (Math.random() - 0.5) * 12)),
            temperature: Math.max(30, Math.min(85, prev.temperature + (Math.random() - 0.5) * 3))
        }));
    }, []);

    // Loading Process
    const processLoadingSteps = useCallback(() => {
        if (!isVisible) return;

        const processStep = (stepIndex: number) => {
            if (stepIndex >= steps.length) {
                setOverallProgress(100);

                // Victory sound sequence
                if (userPreferences.soundEnabled) {
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        setTimeout(() => playSimpleSound(freq, 0.3), i * 200);
                    });
                }

                setTimeout(() => onComplete(), 800);
                return;
            }

            const step = steps[stepIndex];
            const duration = step.duration || 2000;
            const interval = 50;
            const increment = (100 / duration) * interval * userPreferences.animationSpeed;

            setSteps(prev => prev.map((s, i) =>
                i === stepIndex ? { ...s, status: 'loading' } : s
            ));

            // Play step sound
            if (userPreferences.soundEnabled) {
                playSimpleSound(200 + stepIndex * 100, 0.2);
            }

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += increment + Math.random() * increment * 0.3;

                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);

                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress: 100, status: 'complete' } : s
                    ));

                    const newOverallProgress = ((stepIndex + 1) / steps.length) * 100;
                    setOverallProgress(newOverallProgress);

                    // Step completion sound
                    if (userPreferences.soundEnabled) {
                        setTimeout(() => playSimpleSound(400 + stepIndex * 150, 0.3), 100);
                    }

                    setTimeout(() => {
                        setCurrentStep(stepIndex + 1);
                        processStep(stepIndex + 1);
                    }, 400);
                } else {
                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress } : s
                    ));

                    const stepProgress = (stepIndex / steps.length) * 100 + (progress / steps.length);
                    setOverallProgress(stepProgress);
                }
            }, interval);
        };

        processStep(0);
    }, [isVisible, steps, userPreferences, playSimpleSound, onComplete]);

    const handleInteraction = () => {
        setInteractionCount(prev => prev + 1);
        if (userPreferences.soundEnabled) {
            playSimpleSound(300 + interactionCount * 50, 0.1);
        }
    };

    const updateUserPreferences = (updates: Partial<UserPreferences>) => {
        setUserPreferences(prev => {
            const updated = { ...prev, ...updates };
            localStorage.setItem('loadingPreferences', JSON.stringify(updated));
            return updated;
        });
    };

    // Initialize everything
    useEffect(() => {
        if (!isVisible) return;

        // Start metrics monitoring
        const metricsInterval = setInterval(updateSystemMetrics, 500);

        // Start loading process
        setTimeout(processLoadingSteps, 500);

        return () => {
            clearInterval(metricsInterval);
            // Properly close AudioContext only if it exists and isn't already closed
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    audioContextRef.current.close();
                } catch (error) {
                    console.warn('AudioContext close failed:', error);
                }
            }
        };
    }, [isVisible, processLoadingSteps, updateSystemMetrics]);

    if (!isVisible) return null;

    const currentLoadingStep = steps[currentStep];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 bg-gradient-to-br ${currentTheme.background} flex items-center justify-center z-50 overflow-hidden`}
                onClick={handleInteraction}
            >
                {/* System Metrics Overlay */}
                {showMetricsPanel && (
                    <motion.div
                        initial={{ opacity: 0, x: -100 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute top-4 left-4 bg-black/20 backdrop-blur-lg rounded-xl p-4 border border-white/10"
                    >
                        <h3 className="text-white text-sm font-bold mb-3">System Metrics</h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            {Object.entries(systemMetrics).map(([key, value]) => (
                                <div key={key} className="metric-item">
                                    <div className="flex justify-between text-blue-300">
                                        <span>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                                        <span>{typeof value === 'number' ? value.toFixed(1) : value}{key.includes('Usage') || key.includes('IO') ? '%' : key === 'temperature' ? '°C' : key === 'networkLatency' ? 'ms' : ''}</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                                        <div
                                            className="bg-blue-400 h-1 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, (value as number) / (key === 'networkLatency' ? 200 : key === 'temperature' ? 85 : 100) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Theme Selector */}
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-4 right-4 bg-black/20 backdrop-blur-lg rounded-xl p-3 border border-white/10"
                >
                    <div className="flex items-center space-x-2 mb-2">
                        <span className="text-white text-xs font-medium">Theme</span>
                        <motion.button
                            onClick={() => setShowMetricsPanel(!showMetricsPanel)}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            📊
                        </motion.button>
                        <motion.button
                            onClick={() => updateUserPreferences({ soundEnabled: !userPreferences.soundEnabled })}
                            className={`text-xs ${userPreferences.soundEnabled ? 'text-green-400' : 'text-gray-400'}`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            {userPreferences.soundEnabled ? '🔊' : '🔇'}
                        </motion.button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {Object.entries(themes).map(([themeName, theme]) => (
                            <motion.button
                                key={themeName}
                                onClick={() => updateUserPreferences({ theme: themeName as any })}
                                className={`w-4 h-4 rounded-full border-2 ${userPreferences.theme === themeName ? 'border-white' : 'border-gray-500'
                                    }`}
                                style={{ backgroundColor: theme.primary }}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                title={theme.name}
                            />
                        ))}
                    </div>
                </motion.div>

                {/* Main Loading Interface */}
                <motion.div
                    initial={{ scale: 0.8, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full mx-4 border border-white/20 shadow-2xl glass-card"
                >
                    {/* Dynamic Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            className="relative w-24 h-24 mx-auto mb-6"
                            animate={userPreferences.accessibility.reducedMotion ? {} : {
                                rotateX: [0, 360],
                                rotateY: [0, 180],
                                rotateZ: [0, 360]
                            }}
                            transition={{
                                duration: 10 / userPreferences.animationSpeed,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            {[0, 1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className="quantum-ring absolute"
                                    style={{
                                        width: `${80 - i * 15}px`,
                                        height: `${80 - i * 15}px`,
                                        top: `${i * 7.5}px`,
                                        left: `${i * 7.5}px`,
                                        borderColor: i === 3 ? 'transparent' : currentTheme.primary,
                                        borderWidth: i === 3 ? '0' : '2px',
                                        backgroundColor: i === 3 ? currentTheme.accent : 'transparent'
                                    }}
                                />
                            ))}
                        </motion.div>

                        <motion.h2
                            className="text-4xl font-bold text-white mb-3 gradient-text"
                            style={{
                                fontSize: userPreferences.accessibility.largeText ? '3rem' : '2rem'
                            }}
                        >
                            {currentTheme.name} Loading System
                        </motion.h2>

                        <motion.p
                            className="text-blue-200 text-lg"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            Quantum AI initialization in progress...
                        </motion.p>
                    </div>

                    {/* Enhanced Progress Display */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-white font-medium text-lg">System Integration</span>
                            <motion.span
                                className="text-3xl font-bold gradient-text"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                {Math.round(overallProgress)}%
                            </motion.span>
                        </div>

                        <div className="holographic-progress relative w-full bg-gray-800/50 rounded-xl h-6 overflow-hidden border border-white/10">
                            <div
                                className="progress-fill h-full rounded-xl relative transition-all duration-500 ease-out"
                                style={{
                                    width: `${overallProgress}%`,
                                    background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary} 50%, ${currentTheme.accent} 100%)`
                                }}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-white/20 rounded-xl"
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Current Step Display */}
                    {currentLoadingStep && (
                        <motion.div
                            key={currentLoadingStep.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="mb-8 p-6 glass-card"
                        >
                            <div className="flex items-center mb-4">
                                <motion.span
                                    className="text-4xl mr-4"
                                    animate={userPreferences.accessibility.reducedMotion ? {} : {
                                        rotate: [0, 360],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{
                                        rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 1.5, repeat: Infinity }
                                    }}
                                >
                                    {currentLoadingStep.icon}
                                </motion.span>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-xl mb-1">
                                        {currentLoadingStep.label}
                                    </h3>
                                    <p className="text-blue-200 text-sm opacity-90">
                                        {currentLoadingStep.description}
                                    </p>
                                </div>
                            </div>

                            <div className="relative w-full bg-gray-700/50 rounded-xl h-4 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-xl relative transition-all duration-200"
                                    style={{
                                        width: `${currentLoadingStep.progress}%`,
                                        backgroundColor: currentLoadingStep.color
                                    }}
                                >
                                    <motion.div
                                        className="absolute inset-0 bg-white/30 rounded-xl"
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    />
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                    {/* Enhanced Steps List */}
                    <div className="space-y-3 mb-6">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0.3, x: -30 }}
                                animate={{
                                    opacity: step.status === 'complete' ? 1 :
                                        step.status === 'loading' ? 0.9 : 0.6,
                                    x: 0,
                                    scale: step.status === 'loading' ? 1.02 : 1
                                }}
                                className={`step-indicator ${step.status} flex items-center text-sm p-3 rounded-xl transition-all duration-300`}
                            >
                                <div className="w-8 h-8 mr-4 flex items-center justify-center">
                                    {step.status === 'complete' ? (
                                        <motion.div
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center"
                                        >
                                            <span className="text-white text-sm font-bold">✓</span>
                                        </motion.div>
                                    ) : step.status === 'loading' ? (
                                        <div className="quantum-spinner w-6 h-6">
                                            <div className="quantum-ring"></div>
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 bg-gray-600 rounded-full opacity-50" />
                                    )}
                                </div>

                                <span className="text-2xl mr-4">{step.icon}</span>

                                <div className="flex-1">
                                    <span className={`font-medium ${step.status === 'complete' ? 'text-green-300' :
                                        step.status === 'loading' ? 'text-blue-300' :
                                            'text-gray-400'
                                        }`}>
                                        {step.label}
                                    </span>
                                    {step.status === 'loading' && (
                                        <div className="text-xs text-blue-200 opacity-75 mt-1">
                                            {step.description}
                                        </div>
                                    )}
                                </div>

                                {step.status === 'loading' && (
                                    <motion.div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: step.color }}
                                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Dynamic Status Messages */}
                    <div className="text-center">
                        <motion.p
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-blue-200 text-lg italic"
                        >
                            {currentStep === 0 && "🔮 Quantum field stabilization..."}
                            {currentStep === 1 && "🧠 Neural pathways forming..."}
                            {currentStep === 2 && "🤖 Consciousness matrix online..."}
                            {currentStep === 3 && "🌐 Reality synchronization..."}
                            {currentStep === 4 && "⚔️ Strategic systems online..."}
                            {currentStep === 5 && "🎮 Combat ready!"}
                            {currentStep >= 6 && "⚡ All systems operational! ⚡"}
                        </motion.p>

                        {interactionCount > 0 && (
                            <motion.p
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-xs text-purple-300 mt-2"
                            >
                                {interactionCount > 10 ? "🔥 System overclocked!" :
                                    interactionCount > 5 ? "⚡ Energy building..." :
                                        "✨ Good energy!"}
                            </motion.p>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SimplifiedEnhancedLoading; 