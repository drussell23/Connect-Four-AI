import React, { useState, useEffect } from 'react';
import './AIThreatMeter.css';

interface AIPersonality {
    name: string;
    description: string;
    aggressiveness: number;
    patience: number;
}

interface AIThreatMeterProps {
    level: number;
    experience: number;
    maxExperience: number;
    evolutionStage: string;
    personality: AIPersonality;
    specialAbilities: string[];
    gamesPlayed: number;
    winRate: number;
    isLevelingUp?: boolean;
    onLevelUpComplete?: () => void;
}

const AIThreatMeter: React.FC<AIThreatMeterProps> = ({
    level,
    experience,
    maxExperience,
    evolutionStage,
    personality,
    specialAbilities,
    gamesPlayed,
    winRate,
    isLevelingUp = false,
    onLevelUpComplete
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [animatingExp, setAnimatingExp] = useState(experience);
    const [showLevelUpEffect, setShowLevelUpEffect] = useState(false);

    const experiencePercent = (animatingExp / maxExperience) * 100;

    // Handle level up animation
    useEffect(() => {
        if (isLevelingUp) {
            setShowLevelUpEffect(true);
            const timer = setTimeout(() => {
                setShowLevelUpEffect(false);
                setAnimatingExp(0);
                onLevelUpComplete?.();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isLevelingUp, onLevelUpComplete]);

    // Animate experience bar
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatingExp(experience);
        }, 100);
        return () => clearTimeout(timer);
    }, [experience]);

    const getPersonalityColor = (name: string): string => {
        switch (name) {
            case 'Genesis': return '#4ade80'; // Green
            case 'Prometheus': return '#f59e0b'; // Orange
            case 'Nemesis': return '#ef4444'; // Red
            default: return '#6b7280'; // Gray
        }
    };

    const getThreatLevel = (): string => {
        if (level < 5) return 'MINIMAL';
        if (level < 10) return 'LOW';
        if (level < 15) return 'MODERATE';
        if (level < 20) return 'HIGH';
        if (level < 25) return 'EXTREME';
        return 'MAXIMUM';
    };

    const getThreatColor = (): string => {
        if (level < 5) return '#10b981'; // Green
        if (level < 10) return '#84cc16'; // Light green
        if (level < 15) return '#f59e0b'; // Orange
        if (level < 20) return '#ef4444'; // Red
        if (level < 25) return '#dc2626'; // Dark red
        return '#991b1b'; // Very dark red
    };

    const getAbilityIcon = (ability: string): string => {
        switch (ability) {
            case 'threat_prediction': return '🔮';
            case 'counter_strategy': return '⚔️';
            case 'perfect_opening': return '♛';
            case 'psychological_warfare': return '🧠';
            default: return '✨';
        }
    };

    const getAbilityName = (ability: string): string => {
        switch (ability) {
            case 'threat_prediction': return 'Threat Prediction';
            case 'counter_strategy': return 'Counter Strategy';
            case 'perfect_opening': return 'Perfect Opening';
            case 'psychological_warfare': return 'Psychological Warfare';
            default: return ability.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    return (
        <div className={`ai-threat-meter ${isExpanded ? 'expanded' : ''} ${showLevelUpEffect ? 'leveling-up' : ''}`}>
            {/* Level Up Effect */}
            {showLevelUpEffect && (
                <div className="level-up-overlay">
                    <div className="level-up-content">
                        <div className="level-up-text">AI EVOLUTION</div>
                        <div className="level-up-level">LEVEL {level}</div>
                        <div className="level-up-stage">{evolutionStage}</div>
                        <div className="level-up-particles">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className={`particle particle-${i}`} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Header */}
            <div className="threat-meter-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="threat-level-indicator">
                    <div className="threat-icon" style={{ color: getThreatColor() }}>
                        ⚠️
                    </div>
                    <div className="threat-info">
                        <div className="threat-level" style={{ color: getThreatColor() }}>
                            {getThreatLevel()}
                        </div>
                        <div className="threat-subtitle">AI THREAT LEVEL</div>
                    </div>
                </div>

                <div className="level-display">
                    <div className="level-number" style={{ color: getPersonalityColor(personality.name) }}>
                        {level}
                    </div>
                    <div className="level-label">LEVEL</div>
                </div>

                <div className="expand-arrow" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                </div>
            </div>

            {/* Experience Bar */}
            <div className="experience-section">
                <div className="experience-bar-container">
                    <div className="experience-bar-bg">
                        <div
                            className="experience-bar-fill"
                            style={{
                                width: `${experiencePercent}%`,
                                backgroundColor: getPersonalityColor(personality.name)
                            }}
                        />
                    </div>
                    <div className="experience-text">
                        {animatingExp}/{maxExperience} EXP
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="expanded-content">
                    {/* Personality Section */}
                    <div className="personality-section">
                        <div className="section-header">
                            <div
                                className="personality-avatar"
                                style={{ backgroundColor: getPersonalityColor(personality.name) }}
                            >
                                {personality.name.charAt(0)}
                            </div>
                            <div className="personality-info">
                                <div className="personality-name" style={{ color: getPersonalityColor(personality.name) }}>
                                    {personality.name}
                                </div>
                                <div className="personality-description">
                                    {personality.description}
                                </div>
                            </div>
                        </div>

                        {/* Personality Traits */}
                        <div className="personality-traits">
                            <div className="trait">
                                <div className="trait-label">Aggressiveness</div>
                                <div className="trait-bar">
                                    <div
                                        className="trait-fill"
                                        style={{
                                            width: `${personality.aggressiveness * 100}%`,
                                            backgroundColor: '#ef4444'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="trait">
                                <div className="trait-label">Patience</div>
                                <div className="trait-bar">
                                    <div
                                        className="trait-fill"
                                        style={{
                                            width: `${personality.patience * 100}%`,
                                            backgroundColor: '#3b82f6'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Evolution Stage */}
                    <div className="evolution-section">
                        <div className="section-title">Evolution Stage</div>
                        <div className="evolution-stage" style={{ color: getPersonalityColor(personality.name) }}>
                            {evolutionStage}
                        </div>
                    </div>

                    {/* Special Abilities */}
                    <div className="abilities-section">
                        <div className="section-title">Special Abilities</div>
                        <div className="abilities-grid">
                            {specialAbilities.map((ability, index) => (
                                <div key={index} className="ability-card">
                                    <div className="ability-icon">{getAbilityIcon(ability)}</div>
                                    <div className="ability-name">{getAbilityName(ability)}</div>
                                </div>
                            ))}
                            {specialAbilities.length === 0 && (
                                <div className="no-abilities">
                                    No special abilities unlocked yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="stats-section">
                        <div className="section-title">AI Statistics</div>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-value">{gamesPlayed}</div>
                                <div className="stat-label">Games Played</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value">{winRate.toFixed(1)}%</div>
                                <div className="stat-label">Win Rate</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value">{level}</div>
                                <div className="stat-label">Current Level</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIThreatMeter; 