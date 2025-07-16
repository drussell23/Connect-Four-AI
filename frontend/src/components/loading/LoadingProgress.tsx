import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingProgress.css';

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

interface LoadingProgressProps {
    isVisible: boolean;
    onComplete: () => void;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    type: 'spark' | 'glow' | 'neural' | 'data';
}

interface NeuralConnection {
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    active: boolean;
    pulse: number;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ isVisible, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [neuralConnections, setNeuralConnections] = useState<NeuralConnection[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [theme, setTheme] = useState<'cyber' | 'neural' | 'quantum' | 'matrix'>('cyber');
    const [interactionCount, setInteractionCount] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const audioContextRef = useRef<AudioContext>();

    const [steps, setSteps] = useState<LoadingStep[]>([
        {
            id: 'quantum-init',
            label: 'Initializing Quantum Cores',
            progress: 0,
            status: 'pending',
            duration: 2500,
            icon: '⚛️',
            color: '#00f5ff',
            description: 'Spinning up quantum processing units...'
        },
        {
            id: 'neural-bootstrap',
            label: 'Bootstrapping Neural Networks',
            progress: 0,
            status: 'pending',
            duration: 3200,
            icon: '🧠',
            color: '#ff006e',
            description: 'Establishing synaptic connections...'
        },
        {
            id: 'ai-consciousness',
            label: 'Awakening AI Consciousness',
            progress: 0,
            status: 'pending',
            duration: 2800,
            icon: '🤖',
            color: '#8338ec',
            description: 'Loading artificial intelligence matrix...'
        },
        {
            id: 'reality-sync',
            label: 'Synchronizing with Reality',
            progress: 0,
            status: 'pending',
            duration: 2000,
            icon: '🌐',
            color: '#3a86ff',
            description: 'Calibrating dimensional interfaces...'
        },
        {
            id: 'game-matrix',
            label: 'Generating Game Matrix',
            progress: 0,
            status: 'pending',
            duration: 1800,
            icon: '🎮',
            color: '#06ffa5',
            description: 'Preparing strategic battleground...'
        },
        {
            id: 'combat-ready',
            label: 'Combat Systems Online',
            progress: 0,
            status: 'pending',
            duration: 1500,
            icon: '⚔️',
            color: '#ffbe0b',
            description: 'All systems operational!'
        }
    ]);

    // Sound synthesis for feedback
    const playLoadingSound = useCallback((frequency: number, duration: number = 0.1, type: 'sine' | 'square' | 'sawtooth' = 'sine') => {
        if (!soundEnabled || !audioContextRef.current) return;

        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);

        oscillator.start();
        oscillator.stop(audioContextRef.current.currentTime + duration);
    }, [soundEnabled]);

    // Initialize audio context
    useEffect(() => {
        if (soundEnabled && !audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }, [soundEnabled]);

    // Particle system
    const createParticle = useCallback((x: number, y: number, type: Particle['type'] = 'spark'): Particle => {
        const colors = {
            spark: ['#00f5ff', '#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b'],
            glow: ['#00f5ff', '#ff006e', '#8338ec'],
            neural: ['#00f5ff', '#ff006e'],
            data: ['#06ffa5', '#3a86ff']
        };

        return {
            id: Math.random(),
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1,
            maxLife: Math.random() * 60 + 30,
            color: colors[type][Math.floor(Math.random() * colors[type].length)],
            size: Math.random() * 3 + 1,
            type
        };
    }, []);

    const updateParticles = useCallback(() => {
        setParticles(prev => {
            const updated = prev.map(particle => ({
                ...particle,
                x: particle.x + particle.vx,
                y: particle.y + particle.vy,
                life: particle.life - 1,
                vx: particle.vx * 0.99,
                vy: particle.vy * 0.99
            })).filter(particle => particle.life > 0);

            // Add new particles based on loading progress
            if (Math.random() < 0.3) {
                const canvas = canvasRef.current;
                if (canvas) {
                    const newParticle = createParticle(
                        Math.random() * canvas.width,
                        Math.random() * canvas.height,
                        Math.random() > 0.7 ? 'neural' : 'spark'
                    );
                    updated.push(newParticle);
                }
            }

            return updated.slice(-100); // Limit particle count
        });
    }, [createParticle]);

    const generateNeuralConnections = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const connections: NeuralConnection[] = [];
        const nodeCount = 12;
        const nodes = Array.from({ length: nodeCount }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        }));

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const distance = Math.sqrt(
                    Math.pow(nodes[i].x - nodes[j].x, 2) +
                    Math.pow(nodes[i].y - nodes[j].y, 2)
                );

                if (distance < 150 && Math.random() > 0.6) {
                    connections.push({
                        id: Math.random(),
                        x1: nodes[i].x,
                        y1: nodes[i].y,
                        x2: nodes[j].x,
                        y2: nodes[j].y,
                        active: Math.random() > 0.5,
                        pulse: Math.random()
                    });
                }
            }
        }

        setNeuralConnections(connections);
    }, []);

    // Canvas animation loop
    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw neural network connections
        neuralConnections.forEach(connection => {
            if (connection.active) {
                const gradient = ctx.createLinearGradient(
                    connection.x1, connection.y1,
                    connection.x2, connection.y2
                );
                gradient.addColorStop(0, `rgba(0, 245, 255, ${0.3 + connection.pulse * 0.4})`);
                gradient.addColorStop(0.5, `rgba(255, 0, 110, ${0.5 + connection.pulse * 0.3})`);
                gradient.addColorStop(1, `rgba(131, 56, 236, ${0.3 + connection.pulse * 0.4})`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1 + connection.pulse * 2;
                ctx.beginPath();
                ctx.moveTo(connection.x1, connection.y1);
                ctx.lineTo(connection.x2, connection.y2);
                ctx.stroke();

                connection.pulse = Math.sin(Date.now() * 0.003 + connection.id) * 0.5 + 0.5;
            }
        });

        // Draw particles
        particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.fillStyle = particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');

            if (particle.type === 'glow') {
                const gradient = ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, particle.size * 3
                );
                gradient.addColorStop(0, particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
                gradient.addColorStop(1, particle.color.replace(')', ', 0)').replace('rgb', 'rgba'));
                ctx.fillStyle = gradient;
            }

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();

            if (particle.type === 'neural') {
                ctx.strokeStyle = particle.color.replace(')', `, ${alpha * 0.5})`).replace('rgb', 'rgba');
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        updateParticles();
        animationRef.current = requestAnimationFrame(animate);
    }, [particles, neuralConnections, updateParticles]);

    // Canvas setup and cleanup
    useEffect(() => {
        if (!isVisible) return;

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            generateNeuralConnections();
            animate();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isVisible, animate, generateNeuralConnections]);

    // Theme color schemes
    const getThemeColors = (themeName: typeof theme) => {
        const themes = {
            cyber: {
                primary: '#00f5ff',
                secondary: '#ff006e',
                accent: '#8338ec',
                background: 'from-blue-900 via-purple-900 to-indigo-900'
            },
            neural: {
                primary: '#ff006e',
                secondary: '#8338ec',
                accent: '#00f5ff',
                background: 'from-pink-900 via-purple-900 to-blue-900'
            },
            quantum: {
                primary: '#06ffa5',
                secondary: '#3a86ff',
                accent: '#ffbe0b',
                background: 'from-green-900 via-blue-900 to-yellow-900'
            },
            matrix: {
                primary: '#00ff00',
                secondary: '#00aa00',
                accent: '#ffffff',
                background: 'from-black via-green-900 to-black'
            }
        };
        return themes[themeName];
    };

    const currentTheme = getThemeColors(theme);

    // Enhanced loading simulation
    useEffect(() => {
        if (!isVisible) return;

        const processStep = (stepIndex: number) => {
            if (stepIndex >= steps.length) {
                setOverallProgress(100);

                // Victory sound sequence
                if (soundEnabled) {
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        setTimeout(() => playLoadingSound(freq, 0.3, 'sine'), i * 200);
                    });
                }

                // Burst of particles
                const canvas = canvasRef.current;
                if (canvas) {
                    for (let i = 0; i < 50; i++) {
                        setTimeout(() => {
                            setParticles(prev => [
                                ...prev,
                                createParticle(
                                    canvas.width / 2 + (Math.random() - 0.5) * 100,
                                    canvas.height / 2 + (Math.random() - 0.5) * 100,
                                    'glow'
                                )
                            ]);
                        }, i * 20);
                    }
                }

                setTimeout(() => onComplete(), 800);
                return;
            }

            const step = steps[stepIndex];
            const duration = step.duration || 2000;
            const interval = 50;
            const increment = (100 / duration) * interval;

            setSteps(prev => prev.map((s, i) =>
                i === stepIndex ? { ...s, status: 'loading' } : s
            ));

            // Step start sound
            if (soundEnabled) {
                playLoadingSound(200 + stepIndex * 100, 0.2, 'sine');
            }

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += increment + Math.random() * increment * 0.5;

                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);

                    // Step complete sound
                    if (soundEnabled) {
                        playLoadingSound(400 + stepIndex * 150, 0.3, 'sine');
                    }

                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress: 100, status: 'complete' } : s
                    ));

                    const newOverallProgress = ((stepIndex + 1) / steps.length) * 100;
                    setOverallProgress(newOverallProgress);

                    // Create particle burst for step completion
                    const canvas = canvasRef.current;
                    if (canvas) {
                        for (let i = 0; i < 20; i++) {
                            setParticles(prev => [
                                ...prev,
                                createParticle(
                                    Math.random() * canvas.width,
                                    Math.random() * canvas.height,
                                    'spark'
                                )
                            ]);
                        }
                    }

                    setTimeout(() => {
                        setCurrentStep(stepIndex + 1);
                        processStep(stepIndex + 1);
                    }, 300);
                } else {
                    setSteps(prev => prev.map((s, i) =>
                        i === stepIndex ? { ...s, progress } : s
                    ));

                    const stepProgress = (stepIndex / steps.length) * 100 + (progress / steps.length);
                    setOverallProgress(stepProgress);

                    // Random particle generation during loading
                    if (Math.random() < 0.1) {
                        const canvas = canvasRef.current;
                        if (canvas) {
                            setParticles(prev => [
                                ...prev,
                                createParticle(
                                    Math.random() * canvas.width,
                                    Math.random() * canvas.height,
                                    'data'
                                )
                            ]);
                        }
                    }
                }
            }, interval);
        };

        // Initialize neural connections
        generateNeuralConnections();

        // Start loading with dramatic intro
        if (soundEnabled) {
            playLoadingSound(150, 0.5, 'sawtooth');
        }

        processStep(0);
    }, [isVisible, onComplete, steps.length, soundEnabled, playLoadingSound, createParticle, generateNeuralConnections]);

    const handleInteraction = () => {
        setInteractionCount(prev => prev + 1);

        if (soundEnabled) {
            playLoadingSound(300 + interactionCount * 50, 0.1, 'sine');
        }

        // Add interaction particles
        const canvas = canvasRef.current;
        if (canvas) {
            for (let i = 0; i < 10; i++) {
                setParticles(prev => [
                    ...prev,
                    createParticle(
                        Math.random() * canvas.width,
                        Math.random() * canvas.height,
                        'spark'
                    )
                ]);
            }
        }
    };

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
                {/* Animated Background Canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full opacity-40"
                    style={{ filter: 'blur(0.5px)' }}
                />

                {/* Matrix Rain Effect */}
                {theme === 'matrix' && (
                    <div className="absolute inset-0 opacity-20">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute text-green-400 text-xs font-mono"
                                style={{
                                    left: `${(i * 5) % 100}%`,
                                    top: '-100px',
                                }}
                                animate={{
                                    y: window.innerHeight + 100,
                                    opacity: [0, 1, 0]
                                }}
                                transition={{
                                    duration: 3 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 2
                                }}
                            >
                                {Array.from({ length: 10 }).map((_, j) => (
                                    <div key={j}>
                                        {String.fromCharCode(65 + Math.floor(Math.random() * 26))}
                                    </div>
                                ))}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Main Loading Container */}
                <motion.div
                    initial={{ scale: 0.8, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.8, y: -50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full mx-4 border border-white/20 shadow-2xl"
                >
                    {/* Header Section */}
                    <div className="text-center mb-8">
                        {/* Dynamic Holographic Logo */}
                        <motion.div
                            className="relative w-20 h-20 mx-auto mb-6"
                            animate={{
                                rotateX: [0, 360],
                                rotateY: [0, 180],
                                rotateZ: [0, 360]
                            }}
                            transition={{
                                duration: 8,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            <div className="absolute inset-0 border-4 border-blue-400 border-t-transparent rounded-full opacity-60" />
                            <div className="absolute inset-2 border-4 border-purple-400 border-b-transparent rounded-full opacity-80" />
                            <div className="absolute inset-4 border-4 border-pink-400 border-l-transparent rounded-full" />
                            <motion.div
                                className="absolute inset-6 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </motion.div>

                        <motion.h2
                            className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                            animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                            style={{ backgroundSize: '200% 200%' }}
                        >
                            Loading Connect Four AI
                        </motion.h2>

                        <motion.p
                            className="text-blue-200 text-sm"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            Initializing advanced quantum AI systems...
                        </motion.p>
                    </div>

                    {/* Overall Progress with Holographic Effect */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-white font-medium">System Integration</span>
                            <motion.span
                                className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                            >
                                {Math.round(overallProgress)}%
                            </motion.span>
                        </div>

                        <div className="relative w-full bg-gray-800/50 rounded-full h-4 overflow-hidden border border-white/10">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full relative"
                                initial={{ width: 0 }}
                                animate={{ width: `${overallProgress}%` }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-white/30 rounded-full"
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                            </motion.div>

                            {/* Progress particles */}
                            <motion.div
                                className="absolute top-1/2 left-0 w-2 h-2 bg-white rounded-full"
                                animate={{
                                    x: `${overallProgress * 4}px`,
                                    y: [-2, 2, -2]
                                }}
                                transition={{
                                    x: { duration: 0.3 },
                                    y: { duration: 1, repeat: Infinity }
                                }}
                                style={{ left: `${overallProgress}%` }}
                            />
                        </div>
                    </div>

                    {/* Current Step with Enhanced Visuals */}
                    {currentLoadingStep && (
                        <motion.div
                            key={currentLoadingStep.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10"
                        >
                            <div className="flex items-center mb-3">
                                <motion.span
                                    className="text-2xl mr-3"
                                    animate={{
                                        rotate: [0, 360],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{
                                        rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 1, repeat: Infinity }
                                    }}
                                >
                                    {currentLoadingStep.icon}
                                </motion.span>
                                <div className="flex-1">
                                    <span className="text-white font-medium text-lg">
                                        {currentLoadingStep.label}
                                    </span>
                                    <p className="text-blue-200 text-sm opacity-80">
                                        {currentLoadingStep.description}
                                    </p>
                                </div>
                            </div>

                            <div className="relative w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full relative"
                                    style={{
                                        background: `linear-gradient(90deg, ${currentLoadingStep.color}, ${currentLoadingStep.color}80)`
                                    }}
                                    animate={{ width: `${currentLoadingStep.progress}%` }}
                                    transition={{ duration: 0.1 }}
                                >
                                    <motion.div
                                        className="absolute inset-0 bg-white/20 rounded-full"
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
                                initial={{ opacity: 0.3, x: -20 }}
                                animate={{
                                    opacity: step.status === 'complete' ? 1 :
                                        step.status === 'loading' ? 0.9 : 0.5,
                                    x: 0,
                                    scale: step.status === 'loading' ? 1.02 : 1
                                }}
                                transition={{ type: 'spring', stiffness: 300 }}
                                className={`flex items-center text-sm p-2 rounded-lg transition-all duration-300 ${step.status === 'loading' ? 'bg-white/10' : ''
                                    }`}
                            >
                                <div className="w-6 h-6 mr-3 flex items-center justify-center">
                                    {step.status === 'complete' ? (
                                        <motion.div
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            className="w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center"
                                        >
                                            <span className="text-white text-xs">✓</span>
                                        </motion.div>
                                    ) : step.status === 'loading' ? (
                                        <motion.div
                                            animate={{
                                                rotate: [0, 360],
                                                scale: [1, 1.3, 1]
                                            }}
                                            transition={{
                                                rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                                                scale: { duration: 0.5, repeat: Infinity }
                                            }}
                                            className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"
                                        />
                                    ) : (
                                        <div className="w-4 h-4 bg-gray-600 rounded-full opacity-50" />
                                    )}
                                </div>

                                <span className="text-lg mr-3">{step.icon}</span>

                                <span className={`flex-1 ${step.status === 'complete' ? 'text-green-300' :
                                        step.status === 'loading' ? 'text-blue-300' :
                                            'text-gray-400'
                                    }`}>
                                    {step.label}
                                </span>

                                {step.status === 'loading' && (
                                    <motion.div
                                        className="w-2 h-2 bg-blue-400 rounded-full"
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Interactive Controls */}
                    <div className="flex justify-between items-center mb-4">
                        <motion.button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`p-2 rounded-lg border ${soundEnabled ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-gray-400'} transition-all`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {soundEnabled ? '🔊' : '🔇'}
                        </motion.button>

                        <div className="flex space-x-1">
                            {(['cyber', 'neural', 'quantum', 'matrix'] as const).map((themeName) => (
                                <motion.button
                                    key={themeName}
                                    onClick={() => setTheme(themeName)}
                                    className={`w-3 h-3 rounded-full border-2 ${theme === themeName ? 'border-white' : 'border-gray-500'
                                        }`}
                                    style={{ backgroundColor: getThemeColors(themeName).primary }}
                                    whileHover={{ scale: 1.2 }}
                                    whileTap={{ scale: 0.9 }}
                                />
                            ))}
                        </div>

                        <motion.div
                            className="text-xs text-gray-400"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            Click anywhere to interact
                        </motion.div>
                    </div>

                    {/* Dynamic Loading Messages */}
                    <div className="text-center">
                        <motion.p
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-blue-200 text-sm italic"
                        >
                            {currentStep === 0 && "🔮 Quantum entanglement initialized..."}
                            {currentStep === 1 && "🧠 Neural pathways forming..."}
                            {currentStep === 2 && "🤖 AI consciousness awakening..."}
                            {currentStep === 3 && "🌐 Reality synchronization complete..."}
                            {currentStep === 4 && "⚔️ Strategic matrix online..."}
                            {currentStep === 5 && "🎮 All systems operational!"}
                            {currentStep >= 6 && "⚡ Ready for quantum chess! ⚡"}
                        </motion.p>

                        {/* Interaction Counter */}
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

export default LoadingProgress; 