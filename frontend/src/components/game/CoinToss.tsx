import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CoinToss.css';

export type CoinResult = 'heads' | 'tails';

export type CoinTossResult = {
    coinResult: 'heads' | 'tails';
    userWon: boolean;
};

interface CoinTossProps {
    isVisible: boolean;
    onComplete: (result: CoinTossResult) => void;
    aiPersonality: string;
}

const CoinToss: React.FC<CoinTossProps> = ({
    isVisible,
    onComplete,
    aiPersonality
}) => {
    const [isFlipping, setIsFlipping] = useState(false);
    const [result, setResult] = useState<CoinResult | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [flipCount, setFlipCount] = useState(0);
    const [userChoice, setUserChoice] = useState<CoinResult | null>(null);
    const [showChoice, setShowChoice] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [flipAnimation, setFlipAnimation] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize audio context
    useEffect(() => {
        if (typeof window !== 'undefined' && window.AudioContext) {
            audioContextRef.current = new AudioContext();
        }
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Play sound effects
    const playSound = useCallback((frequency: number, duration: number, type: 'sine' | 'square' = 'sine') => {
        if (!soundEnabled || !audioContextRef.current) return;
        
        try {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);
            
            oscillator.start(audioContextRef.current.currentTime);
            oscillator.stop(audioContextRef.current.currentTime + duration);
        } catch (error) {
            console.warn('Audio playback failed:', error);
        }
    }, [soundEnabled]);

    const flipCoin = useCallback(() => {
        if (isFlipping || !userChoice) {
            setError('Please select heads or tails first');
            return;
        }

        setError(null);
        setIsFlipping(true);
        setIsLoading(true);
        setFlipAnimation(true);
        setFlipCount(prev => prev + 1);
        setShowChoice(false);

        // Play flip sound
        playSound(800, 0.1, 'square');
        setTimeout(() => playSound(600, 0.1, 'square'), 200);
        setTimeout(() => playSound(400, 0.1, 'square'), 400);

        // Simulate coin flip animation with multiple flips - optimized for mobile
        const isMobile = window.innerWidth < 768;
        const flipDuration = isMobile ? 1200 : 2000;
        const flipInterval = isMobile ? 200 : 100;
        let currentFlip = 0;
        const maxFlips = flipDuration / flipInterval;

        const flipIntervalId = setInterval(() => {
            currentFlip++;
            if (currentFlip >= maxFlips) {
                clearInterval(flipIntervalId);
                
                // Final result
                const coinResult: CoinResult = Math.random() < 0.5 ? 'heads' : 'tails';
                setResult(coinResult);
                setShowResult(true);
                setIsFlipping(false);
                setIsLoading(false);
                setFlipAnimation(false);

                // Play result sound
                const userWon = coinResult === userChoice;
                if (userWon) {
                    playSound(523, 0.3); // C note - victory
                    setTimeout(() => playSound(659, 0.3), 150); // E note
                    setTimeout(() => playSound(784, 0.5), 300); // G note
                } else {
                    playSound(440, 0.5); // A note - neutral
                }

                console.log('🪙 Coin toss result:', { coinResult, userChoice, userWon });
            } else {
                // Intermediate flip animation
                setFlipAnimation(!flipAnimation);
            }
        }, flipInterval);

        // Cleanup timeout
        timeoutRef.current = setTimeout(() => {
            clearInterval(flipIntervalId);
        }, flipDuration + 100);
    }, [isFlipping, userChoice, playSound, flipAnimation]);

    const continueToGame = useCallback(() => {
        if (result && userChoice) {
            const userWon = result === userChoice;
            playSound(659, 0.2); // E note - confirmation
            onComplete({
                coinResult: result,
                userWon
            });
        }
    }, [result, userChoice, onComplete, playSound]);

    const selectChoice = useCallback((choice: CoinResult) => {
        setUserChoice(choice);
        setError(null);
        playSound(440, 0.1); // A note - selection
    }, [playSound]);

    const resetCoin = useCallback(() => {
        setIsFlipping(false);
        setResult(null);
        setShowResult(false);
        setFlipCount(0);
        setUserChoice(null);
        setShowChoice(true);
        setError(null);
        setIsLoading(false);
        setFlipAnimation(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const toggleSound = useCallback(() => {
        setSoundEnabled(prev => !prev);
        playSound(523, 0.1); // C note - toggle feedback
    }, [playSound]);

    // Reset when component becomes visible
    useEffect(() => {
        if (isVisible) {
            resetCoin();
        }
    }, [isVisible, resetCoin]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (!isVisible) return;

            switch (event.key) {
                case 'h':
                case 'H':
                    if (showChoice && !userChoice) {
                        selectChoice('heads');
                    }
                    break;
                case 't':
                case 'T':
                    if (showChoice && !userChoice) {
                        selectChoice('tails');
                    }
                    break;
                case ' ':
                case 'Enter':
                    event.preventDefault();
                    if (userChoice && !isFlipping && !showResult) {
                        flipCoin();
                    } else if (showResult) {
                        continueToGame();
                    }
                    break;
                case 'Escape':
                    if (showResult) {
                        continueToGame();
                    }
                    break;
            }
        };

        if (isVisible) {
            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [isVisible, showChoice, userChoice, isFlipping, showResult, selectChoice, flipCoin, continueToGame]);

    if (!isVisible) return null;

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    className="coin-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    role="dialog"
                    aria-labelledby="coin-toss-title"
                    aria-describedby="coin-toss-description"
                >
                    <motion.div
                        className="coin-container"
                        initial={{ scale: 0.8, y: 50 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, y: 50 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        {/* Header */}
                        <div className="coin-header">
                            <motion.h2
                                id="coin-toss-title"
                                className="coin-title"
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                🪙 Who Goes First? 🪙
                            </motion.h2>
                            <motion.p
                                id="coin-toss-description"
                                className="coin-subtitle"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                Flip the coin to determine who starts the game
                            </motion.p>
                        </div>

                        {/* Sound Toggle */}
                        <motion.button
                            className="sound-toggle-button"
                            onClick={toggleSound}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            aria-label={`${soundEnabled ? 'Disable' : 'Enable'} sound effects`}
                        >
                            {soundEnabled ? '🔊' : '🔇'}
                        </motion.button>

                        {/* Error Display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    className="coin-error"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <span className="error-icon">⚠️</span>
                                    <span className="error-text">{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Coin Display */}
                        <div className="coin-game-area">
                            <motion.div
                                className="coin-display"
                                animate={isFlipping ? {
                                    rotateY: window.innerWidth < 768 ? [0, 720] : [0, 360, 720, 1080, 1440, 1800, 2160],
                                    scale: window.innerWidth < 768 ? [1, 1.05, 1] : [1, 1.1, 1, 1.1, 1, 1.1, 1],
                                    y: window.innerWidth < 768 ? [0, -5, 0] : [0, -10, 0, -10, 0, -10, 0]
                                } : {}}
                                transition={{
                                    duration: window.innerWidth < 768 ? 1.2 : 2,
                                    ease: "easeInOut",
                                    times: window.innerWidth < 768 ? [0, 0.5, 1] : [0, 0.14, 0.28, 0.42, 0.56, 0.7, 1]
                                }}
                            >
                                <div className={`coin ${flipAnimation ? 'flipping' : ''}`}>
                                    {/* Show the actual result when available, otherwise show heads by default */}
                                    <div className={`coin-face ${result === 'tails' ? 'coin-tails' : 'coin-heads'}`}>
                                        <span className="coin-emoji">🪙</span>
                                        <span className="coin-text">{result ? result.toUpperCase() : 'HEADS'}</span>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Loading Indicator */}
                            {isLoading && (
                                <motion.div
                                    className="coin-loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <div className="loading-spinner"></div>
                                    <span className="loading-text">Flipping...</span>
                                </motion.div>
                            )}

                            {/* Choice Selection */}
                            {showChoice && !isFlipping && (
                                <motion.div
                                    className="coin-choice-selection"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    <h3 className="choice-title">Pick Heads or Tails:</h3>
                                    <div className="choice-buttons">
                                        <motion.button
                                            className={`choice-button ${userChoice === 'heads' ? 'selected' : ''}`}
                                            onClick={() => selectChoice('heads')}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            aria-label="Select heads"
                                            aria-pressed={userChoice === 'heads'}
                                        >
                                            <span className="choice-emoji">🪙</span>
                                            <span className="choice-text">HEADS</span>
                                            <span className="choice-hint">(Press H)</span>
                                        </motion.button>
                                        <motion.button
                                            className={`choice-button ${userChoice === 'tails' ? 'selected' : ''}`}
                                            onClick={() => selectChoice('tails')}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            aria-label="Select tails"
                                            aria-pressed={userChoice === 'tails'}
                                        >
                                            <span className="choice-emoji">🪙</span>
                                            <span className="choice-text">TAILS</span>
                                            <span className="choice-hint">(Press T)</span>
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Flip Button */}
                            {!showResult && userChoice && !isFlipping && (
                                <motion.button
                                    className="coin-flip-button"
                                    onClick={flipCoin}
                                    disabled={isFlipping}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8 }}
                                    aria-label="Flip the coin"
                                >
                                    <span className="flip-button-emoji">🎲</span>
                                    <span className="flip-button-text">Flip Coin</span>
                                    <span className="flip-button-hint">(Press Space)</span>
                                </motion.button>
                            )}

                            {/* Result Display */}
                            <AnimatePresence>
                                {showResult && result && userChoice && (
                                    <motion.div
                                        className="coin-result"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: 'spring', stiffness: 300 }}
                                    >
                                        <div className={`coin-result-content ${result === userChoice ? 'win' : 'lose'}`}>
                                            <div className="coin-result-emoji">🪙</div>
                                            <div className="coin-result-title">{result.toUpperCase()}!</div>
                                            <div className="coin-result-subtitle">
                                                {result === userChoice
                                                    ? `You called ${userChoice.toUpperCase()} and won! You'll go first!`
                                                    : `You called ${userChoice.toUpperCase()} but got ${result.toUpperCase()}. AI goes first!`
                                                }
                                            </div>
                                            <div className="coin-continue-wrapper">
                                                <motion.button
                                                    onClick={continueToGame}
                                                    className="coin-continue-button"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.5 }}
                                                    aria-label="Start the game"
                                                >
                                                    <span className="continue-button-emoji">🎮</span>
                                                    <span className="continue-button-text">Start Game</span>
                                                    <span className="continue-button-hint">(Press Enter)</span>
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Instructions */}
                        <motion.div
                            className="coin-instructions"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <p className="coin-instruction-text">
                                {showResult
                                    ? "Click 'Start Game' to begin playing!"
                                    : "Pick heads or tails, then flip the coin to see who goes first!"
                                }
                            </p>
                            {!showResult && (
                                <p className="coin-keyboard-hints">
                                    <span className="hint-text">Keyboard shortcuts: H/T to select, Space to flip, Enter to continue</span>
                                </p>
                            )}
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CoinToss; 