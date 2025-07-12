import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './RockPaperScissors.css';

export type RPSChoice = 'rock' | 'paper' | 'scissors';
export type RPSResult = 'player' | 'ai' | 'tie';

interface RockPaperScissorsProps {
    isVisible: boolean;
    onComplete: (winner: RPSResult) => void;
    aiPersonality: string;
}

const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
    isVisible,
    onComplete,
    aiPersonality
}) => {
    const [playerChoice, setPlayerChoice] = useState<RPSChoice | null>(null);
    const [aiChoice, setAiChoice] = useState<RPSChoice | null>(null);
    const [result, setResult] = useState<RPSResult | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [roundNumber, setRoundNumber] = useState<number>(1);
    const [gameHistory, setGameHistory] = useState<{ player: RPSChoice; ai: RPSChoice; result: RPSResult }[]>([]);
    const [isReplaying, setIsReplaying] = useState(false);

    const choices: RPSChoice[] = ['rock', 'paper', 'scissors'];

    const getChoiceEmoji = (choice: RPSChoice | null) => {
        switch (choice) {
            case 'rock': return '🪨';
            case 'paper': return '📄';
            case 'scissors': return '✂️';
            default: return '❓';
        }
    };

    const getChoiceName = (choice: RPSChoice | null) => {
        switch (choice) {
            case 'rock': return 'Rock';
            case 'paper': return 'Paper';
            case 'scissors': return 'Scissors';
            default: return '?';
        }
    };

    const determineWinner = (player: RPSChoice, ai: RPSChoice): RPSResult => {
        if (player === ai) return 'tie';
        if (
            (player === 'rock' && ai === 'scissors') ||
            (player === 'paper' && ai === 'rock') ||
            (player === 'scissors' && ai === 'paper')
        ) {
            return 'player';
        }
        return 'ai';
    };

    const getAiChoice = (playerChoice: RPSChoice, roundNumber: number = 1): RPSChoice => {
        const random = Math.random();

        // Add some sophisticated AI strategies based on personality
        if (aiPersonality === 'Genesis') {
            // Genesis is predictable but tries basic patterns
            if (roundNumber === 1) {
                // First round: slight preference for rock
                if (random < 0.4) return 'rock';
                if (random < 0.7) return 'paper';
                return 'scissors';
            } else {
                // In rematches, try to counter what player played before
                if (playerChoice === 'rock') return random < 0.6 ? 'paper' : choices[Math.floor(random * 3)];
                if (playerChoice === 'paper') return random < 0.6 ? 'scissors' : choices[Math.floor(random * 3)];
                if (playerChoice === 'scissors') return random < 0.6 ? 'rock' : choices[Math.floor(random * 3)];
            }
        } else if (aiPersonality === 'Nightmare') {
            // Nightmare uses advanced psychological patterns
            if (roundNumber === 1) {
                // Counter the most common human first choice (rock)
                if (random < 0.5) return 'paper';
                if (random < 0.75) return 'scissors';
                return 'rock';
            } else {
                // Advanced counter-strategy: assume human will try to counter AI's last move
                if (playerChoice === 'rock') {
                    // Player might expect AI to play paper, so they might play scissors
                    return random < 0.4 ? 'rock' : (random < 0.7 ? 'paper' : 'scissors');
                }
                if (playerChoice === 'paper') {
                    return random < 0.4 ? 'scissors' : (random < 0.7 ? 'rock' : 'paper');
                }
                if (playerChoice === 'scissors') {
                    return random < 0.4 ? 'paper' : (random < 0.7 ? 'scissors' : 'rock');
                }
            }
        } else {
            // Other AI personalities use mixed strategies
            const strategies = [
                // Pure random
                () => choices[Math.floor(Math.random() * 3)],
                // Anti-human bias (humans tend to avoid repeating)
                () => playerChoice, // Copy player's last choice
                // Counter strategy
                () => {
                    if (playerChoice === 'rock') return 'paper';
                    if (playerChoice === 'paper') return 'scissors';
                    return 'rock';
                },
                // Anti-counter strategy
                () => {
                    if (playerChoice === 'rock') return 'scissors';
                    if (playerChoice === 'paper') return 'rock';
                    return 'paper';
                }
            ];

            const strategy = strategies[Math.floor(random * strategies.length)];
            return strategy();
        }

        // Fallback to pure random
        return choices[Math.floor(Math.random() * 3)];
    };

    const handlePlayerChoice = (choice: RPSChoice) => {
        if (playerChoice || countdown !== null) return;

        setPlayerChoice(choice);

        // Start countdown
        setCountdown(3);
        const countdownTimer = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(countdownTimer);
                    return null;
                }
                return prev - 1;
            });
        }, 800);

        // Generate AI choice after countdown
        setTimeout(() => {
            // Get previous player choice for AI strategy (if any)
            const lastPlayerChoice = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].player : choice;
            const ai = getAiChoice(lastPlayerChoice, roundNumber);
            setAiChoice(ai);
            setIsRevealing(true);

            // Determine result
            setTimeout(() => {
                const gameResult = determineWinner(choice, ai);
                setResult(gameResult);
                setShowResult(true);

                // Add to game history
                setGameHistory(prev => [...prev, { player: choice, ai, result: gameResult }]);

                // Handle result
                setTimeout(() => {
                    if (gameResult === 'tie') {
                        // If it's a tie, replay automatically
                        setIsReplaying(true);
                        setTimeout(() => {
                            startNewRound();
                        }, 2000);
                    } else {
                        // If there's a clear winner, complete the game
                        onComplete(gameResult);
                    }
                }, 2500);
            }, 1000);
        }, 3200);
    };

    const startNewRound = () => {
        setPlayerChoice(null);
        setAiChoice(null);
        setResult(null);
        setCountdown(null);
        setIsRevealing(false);
        setShowResult(false);
        setIsReplaying(false);
        setRoundNumber(prev => prev + 1);
    };

    const resetGame = () => {
        setPlayerChoice(null);
        setAiChoice(null);
        setResult(null);
        setCountdown(null);
        setIsRevealing(false);
        setShowResult(false);
        setRoundNumber(1);
        setGameHistory([]);
        setIsReplaying(false);
    };

    useEffect(() => {
        if (isVisible) {
            resetGame();
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="rps-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            >
                <motion.div
                    className="rps-container"
                    initial={{ scale: 0.5, y: 100 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.5, y: 100 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                    {/* Header */}
                    <motion.div
                        className="rps-header"
                        initial={{ y: -30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h2 className="rps-title">🎯 Who Goes First? 🎯</h2>
                        <p className="rps-subtitle">
                            Challenge {aiPersonality} AI to Rock Paper Scissors!
                            {roundNumber > 1 && ` • Round ${roundNumber}`}
                        </p>
                        {isReplaying && (
                            <motion.div
                                className="rps-tie-message"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <span className="tie-emoji">🤝</span>
                                <span className="tie-text">It's a tie! Let's try again...</span>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Game Area */}
                    <div className="rps-game-area">
                        {/* Player Side */}
                        <div className="rps-player-side">
                            <h3 className="rps-player-label">You</h3>
                            <div className="rps-choice-display">
                                <motion.div
                                    className="rps-choice-circle player"
                                    animate={{
                                        scale: countdown ? [1, 1.1, 1] : 1,
                                        rotate: countdown ? [0, 10, -10, 0] : 0
                                    }}
                                    transition={{ duration: 0.5, repeat: countdown ? Infinity : 0 }}
                                >
                                    <span className="rps-choice-emoji">
                                        {isRevealing ? getChoiceEmoji(playerChoice) : '❓'}
                                    </span>
                                </motion.div>
                                <div className="rps-choice-name">
                                    {isRevealing ? getChoiceName(playerChoice) : 'Choose!'}
                                </div>
                            </div>
                        </div>

                        {/* VS */}
                        <motion.div
                            className="rps-vs"
                            animate={{
                                scale: countdown ? [1, 1.2, 1] : 1,
                                rotate: countdown ? [0, 360] : 0
                            }}
                            transition={{ duration: 0.8, repeat: countdown ? Infinity : 0 }}
                        >
                            {countdown ? countdown : 'VS'}
                        </motion.div>

                        {/* AI Side */}
                        <div className="rps-ai-side">
                            <h3 className="rps-player-label">{aiPersonality} AI</h3>
                            <div className="rps-choice-display">
                                <motion.div
                                    className="rps-choice-circle ai"
                                    animate={{
                                        scale: countdown ? [1, 1.1, 1] : 1,
                                        rotate: countdown ? [0, -10, 10, 0] : 0
                                    }}
                                    transition={{ duration: 0.5, repeat: countdown ? Infinity : 0 }}
                                >
                                    <span className="rps-choice-emoji">
                                        {isRevealing ? getChoiceEmoji(aiChoice) : '🤖'}
                                    </span>
                                </motion.div>
                                <div className="rps-choice-name">
                                    {isRevealing ? getChoiceName(aiChoice) : 'Thinking...'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Choice Buttons */}
                    {!playerChoice && countdown === null && (
                        <motion.div
                            className="rps-choices"
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            {choices.map((choice) => (
                                <motion.button
                                    key={choice}
                                    className="rps-choice-button"
                                    onClick={() => handlePlayerChoice(choice)}
                                    whileHover={{ scale: 1.1, y: -5 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                >
                                    <span className="rps-button-emoji">{getChoiceEmoji(choice)}</span>
                                    <span className="rps-button-label">{getChoiceName(choice)}</span>
                                </motion.button>
                            ))}
                        </motion.div>
                    )}

                    {/* Result */}
                    <AnimatePresence>
                        {showResult && result && (
                            <motion.div
                                className="rps-result"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                            >
                                <div className={`rps-result-content ${result}`}>
                                    {result === 'player' && (
                                        <>
                                            <div className="rps-result-emoji">🎉</div>
                                            <div className="rps-result-title">You Win!</div>
                                            <div className="rps-result-subtitle">You'll go first in Connect Four!</div>
                                        </>
                                    )}
                                    {result === 'ai' && (
                                        <>
                                            <div className="rps-result-emoji">🤖</div>
                                            <div className="rps-result-title">{aiPersonality} AI Wins!</div>
                                            <div className="rps-result-subtitle">AI will go first in Connect Four!</div>
                                        </>
                                    )}
                                    {result === 'tie' && (
                                        <>
                                            <div className="rps-result-emoji">🤝</div>
                                            <div className="rps-result-title">It's a Tie!</div>
                                            <div className="rps-result-subtitle">
                                                {isReplaying ? "Starting another round..." : "You'll go first by default!"}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Game History */}
                    {gameHistory.length > 0 && roundNumber > 1 && (
                        <motion.div
                            className="rps-history"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <h4 className="rps-history-title">Previous Rounds:</h4>
                            <div className="rps-history-list">
                                {gameHistory.map((round, index) => (
                                    <div key={index} className="rps-history-item">
                                        <span className="round-number">R{index + 1}:</span>
                                        <span className="round-choices">
                                            {getChoiceEmoji(round.player)} vs {getChoiceEmoji(round.ai)}
                                        </span>
                                        <span className={`round-result ${round.result}`}>
                                            {round.result === 'tie' ? 'TIE' : round.result === 'player' ? 'YOU' : 'AI'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Instructions */}
                    {!playerChoice && countdown === null && (
                        <motion.div
                            className="rps-instructions"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <p>Choose your weapon! Winner determines who plays first.</p>
                            {roundNumber > 1 && (
                                <p className="replay-note">Keep playing until someone wins!</p>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default RockPaperScissors; 