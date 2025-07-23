import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getValidBoxShadow, getValidBoxShadowWithOpacity } from '../../utils/animationUtils';
import './VictoryModal.css';

interface VictoryModalProps {
    isVisible: boolean;
    gameResult: 'victory' | 'defeat' | 'draw' | null;
    currentLevel: number;
    aiPersonality: string;
    onNextLevel: () => void;
    onReplayLevel: () => void;
    onQuitToMenu: () => void;
    playerStats: {
        wins: number;
        losses: number;
        draws: number;
        winStreak: number;
        currentLevelWins: number;
    };
}

const VictoryModal: React.FC<VictoryModalProps> = ({
    isVisible,
    gameResult,
    currentLevel,
    aiPersonality,
    onNextLevel,
    onReplayLevel,
    onQuitToMenu,
    playerStats
}) => {
    const [showParticles, setShowParticles] = useState(false);
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        if (isVisible && gameResult === 'victory') {
            const timer = setTimeout(() => setShowParticles(true), 500);
            return () => clearTimeout(timer);
        } else {
            setShowParticles(false);
        }
    }, [isVisible, gameResult]);

    if (!isVisible || !gameResult) return null;

    const isVictory = gameResult === 'victory';
    const isDefeat = gameResult === 'defeat';
    const isDraw = gameResult === 'draw';

    const getResultData = () => {
        if (isVictory) {
            return {
                emoji: '🏆',
                title: 'VICTORY!',
                message: `You've defeated ${aiPersonality}! Your strategic mind has prevailed.`,
                primaryColor: '#10b981',
                secondaryColor: '#059669',
                gradientFrom: '#10b981',
                gradientTo: '#059669',
                canAdvance: currentLevel < 25
            };
        } else if (isDefeat) {
            return {
                emoji: '💀',
                title: 'DEFEAT',
                message: `${aiPersonality} has outmaneuvered you. The AI's superior tactics prevailed.`,
                primaryColor: '#ef4444',
                secondaryColor: '#dc2626',
                gradientFrom: '#ef4444',
                gradientTo: '#dc2626',
                canAdvance: false
            };
        } else {
            return {
                emoji: '🤝',
                title: 'DRAW',
                message: `A tactical stalemate! Neither you nor ${aiPersonality} could gain the upper hand.`,
                primaryColor: '#f59e0b',
                secondaryColor: '#d97706',
                gradientFrom: '#f59e0b',
                gradientTo: '#d97706',
                canAdvance: false
            };
        }
    };

    const resultData = getResultData();

    const getThreatLevelData = (level: number) => {
        if (level <= 3) return { name: 'ROOKIE', color: '#10b981', next: 'AMATEUR' };
        if (level <= 6) return { name: 'AMATEUR', color: '#84cc16', next: 'SKILLED' };
        if (level <= 9) return { name: 'SKILLED', color: '#f59e0b', next: 'EXPERT' };
        if (level <= 12) return { name: 'EXPERT', color: '#ef4444', next: 'MASTER' };
        if (level <= 15) return { name: 'MASTER', color: '#dc2626', next: 'GRANDMASTER' };
        if (level <= 18) return { name: 'GRANDMASTER', color: '#991b1b', next: 'LEGENDARY' };
        if (level <= 21) return { name: 'LEGENDARY', color: '#7c2d12', next: 'NIGHTMARE' };
        if (level <= 24) return { name: 'NIGHTMARE', color: '#1f2937', next: 'ULTIMATE' };
        return { name: 'ULTIMATE', color: '#000000', next: 'MAXIMUM' };
    };

    const currentThreat = getThreatLevelData(currentLevel);
    const nextThreat = getThreatLevelData(currentLevel + 1);

    return (
        <AnimatePresence>
            <motion.div
                className="victory-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            >
                <motion.div
                    className="victory-modal-container"
                    initial={{ scale: 0.5, y: 100, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.5, y: 100, opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                        duration: 0.8
                    }}
                    style={{
                        background: `linear-gradient(135deg, ${resultData.gradientFrom}, ${resultData.gradientTo})`,
                        border: `3px solid ${resultData.primaryColor || '#10b981'}`,
                        boxShadow: getValidBoxShadowWithOpacity(resultData.primaryColor, '#10b981', 0.25, '50px')
                    }}
                >
                    {/* Particle Effects */}
                    {showParticles && isVictory && (
                        <div className="victory-particles">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="victory-particle"
                                    initial={{
                                        opacity: 0,
                                        scale: 0,
                                        x: Math.random() * 400 - 200,
                                        y: Math.random() * 300 - 150
                                    }}
                                    animate={{
                                        opacity: [0, 1, 0],
                                        scale: [0, 1, 0],
                                        x: Math.random() * 600 - 300,
                                        y: Math.random() * 400 - 200,
                                        rotate: Math.random() * 360
                                    }}
                                    transition={{
                                        duration: 2 + Math.random() * 2,
                                        repeat: Infinity,
                                        delay: Math.random() * 2
                                    }}
                                    style={{
                                        backgroundColor: i % 2 === 0 ? '#ffd700' : '#ff6b6b'
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="victory-modal-content">
                        {/* Result Title */}
                        <motion.div
                            className="result-header"
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                        >
                            <motion.div
                                className="result-emoji"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: isVictory ? [0, 10, -10, 0] : 0
                                }}
                                transition={{
                                    duration: isVictory ? 0.6 : 0,
                                    repeat: isVictory ? Infinity : 0,
                                    repeatDelay: 1
                                }}
                            >
                                {resultData.emoji}
                            </motion.div>
                            <h1
                                className="result-title"
                                style={{ color: '#ffffff', textShadow: `0 0 20px ${resultData.primaryColor || '#10b981'}` }}
                            >
                                {resultData.title}
                            </h1>
                            <h2 className="result-subtitle">{resultData.message}</h2>
                        </motion.div>

                        {/* Level Information */}
                        <motion.div
                            className="level-info-section"
                            initial={{ x: -100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                        >
                            <div className="current-level-display">
                                <div className="level-badge" style={{ backgroundColor: currentThreat.color || '#10b981' }}>
                                    <span className="level-number">{currentLevel}</span>
                                    <span className="level-label">LEVEL</span>
                                </div>
                                <div className="threat-level-info">
                                    <div className="threat-level-name" style={{ color: currentThreat.color || '#10b981' }}>
                                        {currentThreat.name}
                                    </div>
                                    <div className="ai-personality">vs {aiPersonality} AI</div>
                                </div>
                            </div>

                            {isVictory && resultData.canAdvance && (
                                <motion.div
                                    className="level-progression"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
                                >
                                    <div className="progression-arrow">→</div>
                                    <div className="next-level-display">
                                        <div className="level-badge" style={{ backgroundColor: nextThreat.color || '#10b981' }}>
                                            <span className="level-number">{currentLevel + 1}</span>
                                            <span className="level-label">NEXT</span>
                                        </div>
                                        <div className="threat-level-info">
                                            <div className="threat-level-name" style={{ color: nextThreat.color || '#10b981' }}>
                                                {nextThreat.name}
                                            </div>
                                            <div className="unlock-text">UNLOCKED!</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Stats Display */}
                        <AnimatePresence>
                            {showStats && (
                                <motion.div
                                    className="stats-display"
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.6 }}
                                >
                                    <h3>Match Statistics</h3>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <div className="stat-value" style={{ color: '#10b981' }}>{playerStats.wins}</div>
                                            <div className="stat-label">Wins</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value" style={{ color: '#ef4444' }}>{playerStats.losses}</div>
                                            <div className="stat-label">Losses</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value" style={{ color: '#f59e0b' }}>{playerStats.draws}</div>
                                            <div className="stat-label">Draws</div>
                                        </div>
                                        <div className="stat-item">
                                            <div className="stat-value" style={{ color: '#8b5cf6' }}>{playerStats.winStreak}</div>
                                            <div className="stat-label">Win Streak</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <motion.div
                            className="action-buttons"
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1.2, duration: 0.6 }}
                        >
                            {isVictory && resultData.canAdvance && (
                                <motion.button
                                    className="action-button next-level-button"
                                    onClick={onNextLevel}
                                    initial={{ scale: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                                    whileHover={{ scale: 1.05, boxShadow: getValidBoxShadow(nextThreat.color) }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{
                                        background: `linear-gradient(135deg, ${nextThreat.color || '#10b981'}, ${resultData.primaryColor || '#10b981'})`,
                                        border: `2px solid ${nextThreat.color || '#10b981'}`
                                    }}
                                >
                                    <span className="button-text">
                                        🚀 CHALLENGE LEVEL {currentLevel + 1}
                                    </span>
                                    <span className="button-subtitle">Face {nextThreat.name} AI</span>
                                </motion.button>
                            )}

                            <motion.button
                                className="action-button replay-button"
                                onClick={onReplayLevel}
                                initial={{ scale: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                                whileHover={{ scale: 1.05, boxShadow: getValidBoxShadow(resultData.primaryColor) }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    background: `linear-gradient(135deg, ${resultData.primaryColor || '#10b981'}, ${resultData.secondaryColor || '#059669'})`,
                                    border: `2px solid ${resultData.primaryColor || '#10b981'}`
                                }}
                            >
                                <span className="button-text">
                                    🔄 REPLAY LEVEL {currentLevel}
                                </span>
                                <span className="button-subtitle">Try again vs {aiPersonality}</span>
                            </motion.button>

                            <motion.button
                                className="action-button quit-button"
                                onClick={onQuitToMenu}
                                initial={{ scale: 1, boxShadow: '0 0 0px rgba(0,0,0,0)' }}
                                whileHover={{ scale: 1.05, boxShadow: '0 0 25px #6b7280' }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <span className="button-text">
                                    🏠 MAIN MENU
                                </span>
                                <span className="button-subtitle">Return to start</span>
                            </motion.button>
                        </motion.div>

                        {/* Motivational Message */}
                        <motion.div
                            className="motivational-message"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5, duration: 0.8 }}
                        >
                            <p>{resultData.message}</p>
                            {isVictory && currentLevel >= 15 && (
                                <p className="bonus-message">
                                    ⚡ You're now facing MASTER-level AI! Only the most strategic minds reach this far.
                                </p>
                            )}
                            {currentLevel >= 21 && (
                                <p className="nightmare-message">
                                    💀 NIGHTMARE ZONE: The AI's consciousness has awakened. Proceed with extreme caution.
                                </p>
                            )}
                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default VictoryModal; 