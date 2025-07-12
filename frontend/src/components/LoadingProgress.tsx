import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingStep {
    id: string;
    label: string;
    progress: number;
    status: 'pending' | 'loading' | 'complete' | 'error';
    duration?: number;
}

interface LoadingProgressProps {
    isVisible: boolean;
    onComplete: () => void;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ isVisible, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [steps, setSteps] = useState<LoadingStep[]>([
        { id: 'backend', label: 'Connecting to Backend', progress: 0, status: 'pending', duration: 2000 },
        { id: 'ml-service', label: 'Initializing AI Engine', progress: 0, status: 'pending', duration: 3000 },
        { id: 'websocket', label: 'Establishing Real-time Connection', progress: 0, status: 'pending', duration: 1500 },
        { id: 'ai-model', label: 'Loading AI Models', progress: 0, status: 'pending', duration: 2500 },
        { id: 'game-setup', label: 'Preparing Game Environment', progress: 0, status: 'pending', duration: 1000 },
    ]);

    // Simulate loading progress for each step
    useEffect(() => {
        if (!isVisible) return;

        const processStep = (stepIndex: number) => {
            if (stepIndex >= steps.length) {
                // All steps complete
                setOverallProgress(100);
                setTimeout(() => onComplete(), 500);
                return;
            }

            const step = steps[stepIndex];
            const duration = step.duration || 2000;
            const interval = 50; // Update every 50ms
            const increment = (100 / duration) * interval;

            setSteps(prev => prev.map((s, i) =>
                i === stepIndex ? { ...s, status: 'loading' } : s
            ));

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += increment;

                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);

                    // Mark current step as complete
                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress: 100, status: 'complete' } : s
                    ));

                    // Update overall progress
                    const newOverallProgress = ((stepIndex + 1) / steps.length) * 100;
                    setOverallProgress(newOverallProgress);

                    // Move to next step after a brief pause
                    setTimeout(() => {
                        setCurrentStep(stepIndex + 1);
                        processStep(stepIndex + 1);
                    }, 300);
                } else {
                    // Update current step progress
                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress } : s
                    ));

                    // Update overall progress
                    const stepProgress = (stepIndex / steps.length) * 100 + (progress / steps.length);
                    setOverallProgress(stepProgress);
                }
            }, interval);
        };

        // Start the loading process
        processStep(0);
    }, [isVisible, onComplete, steps.length]);

    if (!isVisible) return null;

    const currentLoadingStep = steps[currentStep];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center z-50"
            >
                <div className="bg-black/30 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full mx-4 border border-white/10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 mx-auto mb-4 border-4 border-blue-400 border-t-transparent rounded-full"
                        />
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Loading Connect Four AI
                        </h2>
                        <p className="text-blue-200 text-sm">
                            Initializing advanced AI systems...
                        </p>
                    </div>

                    {/* Overall Progress */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-medium">Overall Progress</span>
                            <span className="text-blue-300 font-bold text-lg">
                                {Math.round(overallProgress)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${overallProgress}%` }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                        </div>
                    </div>

                    {/* Current Step */}
                    {currentLoadingStep && (
                        <motion.div
                            key={currentLoadingStep.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6"
                        >
                            <div className="flex items-center mb-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 animate-pulse" />
                                <span className="text-white font-medium">
                                    {currentLoadingStep.label}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-400 rounded-full"
                                    animate={{ width: `${currentLoadingStep.progress}%` }}
                                    transition={{ duration: 0.1 }}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Steps List */}
                    <div className="space-y-2">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0.3 }}
                                animate={{
                                    opacity: step.status === 'complete' ? 1 :
                                        step.status === 'loading' ? 0.8 : 0.4
                                }}
                                className="flex items-center text-sm"
                            >
                                <div className="w-4 h-4 mr-3 flex items-center justify-center">
                                    {step.status === 'complete' ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-3 h-3 bg-green-400 rounded-full"
                                        />
                                    ) : step.status === 'loading' ? (
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                            className="w-3 h-3 bg-blue-400 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-3 h-3 bg-gray-500 rounded-full" />
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

                    {/* Fun Loading Messages */}
                    <div className="mt-6 text-center">
                        <motion.p
                            key={currentStep}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-blue-200 text-xs italic"
                        >
                            {currentStep === 0 && "Establishing secure connection..."}
                            {currentStep === 1 && "Awakening the AI consciousness..."}
                            {currentStep === 2 && "Creating real-time neural pathways..."}
                            {currentStep === 3 && "Training the digital mind..."}
                            {currentStep === 4 && "Preparing for strategic combat..."}
                            {currentStep >= 5 && "Ready for battle! 🎮"}
                        </motion.p>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LoadingProgress; 