import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ConnectFourLoading.css';

interface LoadingStep {
    id: string;
    label: string;
    progress: number;
    status: 'pending' | 'loading' | 'complete' | 'error';
    duration?: number;
    color?: 'red' | 'yellow';
}

interface ConnectFourLoadingProps {
    isVisible: boolean;
    onComplete: () => void;
}

const ConnectFourLoading: React.FC<ConnectFourLoadingProps> = ({
    isVisible,
    onComplete
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [fallingDiscs, setFallingDiscs] = useState<Array<{
        id: number;
        column: number;
        color: 'red' | 'yellow';
        delay: number;
    }>>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [boardState, setBoardState] = useState<('red' | 'yellow' | 'empty')[][]>(
        Array.from({ length: 6 }, () => Array(7).fill('empty'))
    );

    const audioContextRef = useRef<AudioContext>();

    // Connect Four themed loading steps
    const [steps, setSteps] = useState<LoadingStep[]>([
        {
            id: 'board-setup',
            label: 'Setting up the board',
            progress: 0,
            status: 'pending',
            duration: 2000,
            color: 'red'
        },
        {
            id: 'ai-awakening',
            label: 'Awakening AI opponent',
            progress: 0,
            status: 'pending',
            duration: 2500,
            color: 'yellow'
        },
        {
            id: 'strategy-loading',
            label: 'Loading strategy engines',
            progress: 0,
            status: 'pending',
            duration: 2200,
            color: 'red'
        },
        {
            id: 'game-ready',
            label: 'Preparing for battle',
            progress: 0,
            status: 'pending',
            duration: 1800,
            color: 'yellow'
        }
    ]);

    // Simple Connect Four-themed sound
    const playConnectFourSound = useCallback((frequency: number, duration: number = 0.3) => {
        if (!soundEnabled) return;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            if (audioContextRef.current.state === 'closed') {
                return;
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
    }, [soundEnabled]);

    // Add falling disc animation
    const addFallingDisc = useCallback(() => {
        const newDisc = {
            id: Math.random(),
            column: Math.floor(Math.random() * 7),
            color: Math.random() > 0.5 ? 'red' : 'yellow' as 'red' | 'yellow',
            delay: Math.random() * 1000
        };

        setFallingDiscs(prev => [...prev.slice(-10), newDisc]);

        // Play drop sound
        if (soundEnabled) {
            setTimeout(() => {
                playConnectFourSound(newDisc.color === 'red' ? 440 : 523, 0.2);
            }, newDisc.delay);
        }
    }, [soundEnabled, playConnectFourSound]);

    // Fill board progressively
    const fillBoardCell = useCallback(() => {
        setBoardState(prev => {
            const newBoard = prev.map(row => [...row]);

            // Find next empty cell from bottom up
            for (let col = 0; col < 7; col++) {
                for (let row = 5; row >= 0; row--) {
                    if (newBoard[row][col] === 'empty') {
                        newBoard[row][col] = Math.random() > 0.5 ? 'red' : 'yellow';
                        return newBoard;
                    }
                }
            }

            return newBoard;
        });
    }, []);

    // Main loading process
    const processLoadingSteps = useCallback(() => {
        if (!isVisible) return;

        const processStep = (stepIndex: number) => {
            if (stepIndex >= steps.length) {
                setOverallProgress(100);

                // Victory sound sequence
                if (soundEnabled) {
                    [523, 659, 784].forEach((freq, i) => {
                        setTimeout(() => playConnectFourSound(freq, 0.4), i * 200);
                    });
                }

                setTimeout(() => onComplete(), 1000);
                return;
            }

            const step = steps[stepIndex];
            const duration = step.duration || 2000;
            const interval = 50;
            const increment = (100 / duration) * interval;

            setSteps(prev => prev.map((s, i) =>
                i === stepIndex ? { ...s, status: 'loading' } : s
            ));

            // Play step start sound
            if (soundEnabled) {
                playConnectFourSound(step.color === 'red' ? 330 : 392, 0.3);
            }

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += increment + Math.random() * increment * 0.2;

                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);

                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress: 100, status: 'complete' } : s
                    ));

                    const newOverallProgress = ((stepIndex + 1) / steps.length) * 100;
                    setOverallProgress(newOverallProgress);

                    // Step completion sound
                    if (soundEnabled) {
                        setTimeout(() => playConnectFourSound(step.color === 'red' ? 523 : 659, 0.3), 100);
                    }

                    setTimeout(() => {
                        setCurrentStep(stepIndex + 1);
                        processStep(stepIndex + 1);
                    }, 500);
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
    }, [isVisible, steps, soundEnabled, playConnectFourSound, onComplete]);

    // Initialize effects
    useEffect(() => {
        if (!isVisible) return;

        // Start falling discs animation
        const discInterval = setInterval(addFallingDisc, 800);

        // Fill board progressively
        const boardInterval = setInterval(fillBoardCell, 400);

        // Start loading process
        setTimeout(processLoadingSteps, 300);

        return () => {
            clearInterval(discInterval);
            clearInterval(boardInterval);
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    audioContextRef.current.close();
                } catch (error) {
                    console.warn('AudioContext close failed:', error);
                }
            }
        };
    }, [isVisible, addFallingDisc, fillBoardCell, processLoadingSteps]);

    if (!isVisible) return null;

    const currentLoadingStep = steps[currentStep];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center z-50 overflow-hidden"
            >
                {/* Falling Discs Background Animation */}
                <div className="absolute inset-0">
                    {fallingDiscs.map((disc) => (
                        <motion.div
                            key={disc.id}
                            className={`absolute w-8 h-8 rounded-full ${disc.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                } shadow-lg`}
                            style={{
                                left: `${10 + disc.column * 12}%`,
                                top: '-50px'
                            }}
                            initial={{ y: -50, opacity: 0.8 }}
                            animate={{
                                y: window.innerHeight + 50,
                                opacity: [0.8, 1, 0.8, 0]
                            }}
                            transition={{
                                duration: 3,
                                delay: disc.delay / 1000,
                                ease: "easeIn"
                            }}
                        />
                    ))}
                </div>

                {/* Sound Toggle */}
                <motion.button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="absolute top-4 right-4 bg-black/20 backdrop-blur-lg rounded-xl p-3 border border-white/20 text-white hover:bg-black/30 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <span className="text-xl">{soundEnabled ? '🔊' : '🔇'}</span>
                </motion.button>

                {/* Main Loading Container */}
                <motion.div
                    initial={{ scale: 0.9, y: 30, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full mx-4 border border-white/20 shadow-2xl"
                >
                    {/* Header with Connect Four Discs */}
                    <div className="text-center mb-8">
                        <motion.div
                            className="flex justify-center space-x-2 mb-6"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            {[0, 1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    className={`w-12 h-12 rounded-full ${i % 2 === 0 ? 'bg-red-500' : 'bg-yellow-500'
                                        } shadow-lg`}
                                    animate={{
                                        scale: [1, 1.1, 1],
                                        rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: i * 0.2
                                    }}
                                />
                            ))}
                        </motion.div>

                        <motion.h2
                            className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent"
                        >
                            Connect Four AI
                        </motion.h2>

                        <motion.p
                            className="text-blue-200 text-sm"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            Preparing your game experience...
                        </motion.p>
                    </div>

                    {/* Overall Progress */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-white font-medium">Loading Progress</span>
                            <motion.span
                                className="text-2xl font-bold text-blue-300"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                            >
                                {Math.round(overallProgress)}%
                            </motion.span>
                        </div>

                        <div className="relative w-full bg-gray-800/50 rounded-xl h-4 overflow-hidden border border-white/10">
                            <motion.div
                                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-xl relative"
                                animate={{ width: `${overallProgress}%` }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-white/20 rounded-xl"
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Connect Four Board Progress */}
                    <div className="mb-6">
                        <div className="connect-four-board bg-blue-700 rounded-lg p-2 mx-auto w-fit">
                            {boardState.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex space-x-1 mb-1">
                                    {row.map((cell, colIndex) => (
                                        <motion.div
                                            key={`${rowIndex}-${colIndex}`}
                                            className={`w-6 h-6 rounded-full border-2 border-blue-800 ${cell === 'red' ? 'bg-red-500' :
                                                    cell === 'yellow' ? 'bg-yellow-500' : 'bg-blue-900'
                                                }`}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: cell === 'empty' ? 0 : 1 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Current Step */}
                    {currentLoadingStep && (
                        <motion.div
                            key={currentLoadingStep.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10"
                        >
                            <div className="flex items-center mb-2">
                                <motion.div
                                    className={`w-6 h-6 rounded-full mr-3 ${currentLoadingStep.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 180, 360]
                                    }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                <span className="text-white font-medium text-lg">
                                    {currentLoadingStep.label}
                                </span>
                            </div>

                            <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full ${currentLoadingStep.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                    animate={{ width: `${currentLoadingStep.progress}%` }}
                                    transition={{ duration: 0.1 }}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Loading Steps List */}
                    <div className="space-y-2">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                className={`flex items-center text-sm p-2 rounded-lg transition-all duration-300 ${step.status === 'complete' ? 'bg-green-500/20' :
                                        step.status === 'loading' ? 'bg-blue-500/20' : 'bg-gray-500/10'
                                    }`}
                            >
                                <div className="w-6 h-6 mr-3 flex items-center justify-center">
                                    {step.status === 'complete' ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                                        >
                                            <span className="text-white text-xs">✓</span>
                                        </motion.div>
                                    ) : step.status === 'loading' ? (
                                        <motion.div
                                            className={`w-4 h-4 rounded-full ${step.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                                }`}
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                        />
                                    ) : (
                                        <div className="w-4 h-4 bg-gray-600 rounded-full opacity-50" />
                                    )}
                                </div>

                                <span className={`${step.status === 'complete' ? 'text-green-300' :
                                        step.status === 'loading' ? 'text-blue-300' :
                                            'text-gray-400'
                                    }`}>
                                    {step.label}
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Fun Loading Message */}
                    <div className="text-center mt-6">
                        <motion.p
                            key={currentStep}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-blue-200 text-sm italic"
                        >
                            {currentStep === 0 && "🔴 Setting up the game board..."}
                            {currentStep === 1 && "🟡 Your AI opponent is getting ready..."}
                            {currentStep === 2 && "🧠 Loading strategic thinking..."}
                            {currentStep === 3 && "⚡ Almost ready to play!"}
                            {currentStep >= 4 && "🎮 Game ready! Let's play! 🎮"}
                        </motion.p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConnectFourLoading; 