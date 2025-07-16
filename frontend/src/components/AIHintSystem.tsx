import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AIHintSystem.css';

interface HintLevel {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
}

interface Hint {
    id: string;
    type: 'strategic' | 'tactical' | 'defensive' | 'learning' | 'warning' | 'encouragement';
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    content: string;
    explanation: string;
    alternatives?: string[];
    boardPosition?: number[];
    confidence: number;
    tags: string[];
    followUp?: string;
}

interface LearningOpportunity {
    id: string;
    concept: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedTime: number;
    prerequisite?: string;
    reward: string;
}

interface HintSettings {
    enabled: boolean;
    level: 'minimal' | 'moderate' | 'comprehensive';
    autoShow: boolean;
    showOnlyWhenAsked: boolean;
    adaptToSkill: boolean;
    includeAlternatives: boolean;
    showConfidence: boolean;
    enableSounds: boolean;
}

interface AIHintSystemProps {
    isVisible: boolean;
    onClose: () => void;
    gameState: any;
    playerLevel: number;
    currentBoard: number[][];
    lastMove?: { col: number; row: number };
    turnCount: number;
    socket?: any;
}

const AIHintSystem: React.FC<AIHintSystemProps> = ({
    isVisible,
    onClose,
    gameState,
    playerLevel,
    currentBoard,
    lastMove,
    turnCount,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'hints' | 'learning' | 'settings' | 'history'>('hints');
    const [currentHints, setCurrentHints] = useState<Hint[]>([]);
    const [selectedHint, setSelectedHint] = useState<Hint | null>(null);
    const [learningOpportunities, setLearningOpportunities] = useState<LearningOpportunity[]>([]);
    const [hintSettings, setHintSettings] = useState<HintSettings>({
        enabled: true,
        level: 'moderate',
        autoShow: false,
        showOnlyWhenAsked: false,
        adaptToSkill: true,
        includeAlternatives: true,
        showConfidence: true,
        enableSounds: true
    });
    const [hintHistory, setHintHistory] = useState<Hint[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [hintRequest, setHintRequest] = useState<string>('');
    const [adaptiveLevel, setAdaptiveLevel] = useState<string>('intermediate');

    const hintLevels: HintLevel[] = [
        {
            id: 'minimal',
            name: 'Minimal',
            description: 'Basic warnings only',
            icon: '💡',
            color: '#22c55e'
        },
        {
            id: 'moderate',
            name: 'Moderate',
            description: 'Strategic suggestions',
            icon: '🧠',
            color: '#3b82f6'
        },
        {
            id: 'comprehensive',
            name: 'Comprehensive',
            description: 'Detailed analysis',
            icon: '🎓',
            color: '#8b5cf6'
        }
    ];

    // Initialize hint system
    useEffect(() => {
        if (isVisible) {
            analyzeCurrentPosition();
            generateLearningOpportunities();
        }
    }, [isVisible, currentBoard, turnCount]);

    // Real-time hint updates
    useEffect(() => {
        if (socket) {
            socket.on('hintUpdate', handleHintUpdate);
            socket.on('learningOpportunity', handleLearningOpportunity);
            socket.on('adaptiveHint', handleAdaptiveHint);

            return () => {
                socket.off('hintUpdate');
                socket.off('learningOpportunity');
                socket.off('adaptiveHint');
            };
        }
    }, [socket]);

    // Adaptive level adjustment
    useEffect(() => {
        if (hintSettings.adaptToSkill) {
            const level = playerLevel < 5 ? 'beginner' :
                playerLevel < 10 ? 'intermediate' :
                    playerLevel < 20 ? 'advanced' : 'expert';
            setAdaptiveLevel(level);
        }
    }, [playerLevel, hintSettings.adaptToSkill]);

    const analyzeCurrentPosition = async () => {
        setIsAnalyzing(true);
        setAnalysisProgress(0);

        // Simulate AI analysis
        const analysisSteps = [
            'Analyzing board position...',
            'Identifying tactical patterns...',
            'Evaluating strategic options...',
            'Generating contextual hints...',
            'Adapting to player level...'
        ];

        for (let i = 0; i < analysisSteps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 600));
            setAnalysisProgress((i + 1) * 20);
        }

        // Generate hints based on current position
        const hints = generateContextualHints();
        setCurrentHints(hints);
        setIsAnalyzing(false);
    };

    const generateContextualHints = (): Hint[] => {
        const hints: Hint[] = [];

        // Center control hint
        if (turnCount < 8) {
            hints.push({
                id: 'center_control',
                type: 'strategic',
                level: 'beginner',
                urgency: 'medium',
                title: 'Control the Center',
                content: 'Playing in the center columns (3, 4, 5) gives you more opportunities to create connections in multiple directions.',
                explanation: 'Center columns are statistically the strongest opening positions. They provide the most flexibility for creating horizontal, vertical, and diagonal connections.',
                alternatives: ['Consider column 4 for maximum flexibility', 'Column 3 or 5 are also strong center positions'],
                boardPosition: [3, 4, 5],
                confidence: 85,
                tags: ['opening', 'strategy', 'positioning'],
                followUp: 'After controlling center, look for ways to create multiple threats simultaneously.'
            });
        }

        // Defensive warning
        const threatsDetected = detectThreats();
        if (threatsDetected.length > 0) {
            hints.push({
                id: 'defensive_warning',
                type: 'warning',
                level: 'beginner',
                urgency: 'critical',
                title: 'Immediate Threat Detected!',
                content: `Opponent can win by playing in column ${threatsDetected[0] + 1}. Block this threat immediately!`,
                explanation: 'When your opponent has three pieces in a row with an open space for the fourth, you must block or they win on their next turn.',
                alternatives: [`Block by playing in column ${threatsDetected[0] + 1}`],
                boardPosition: [threatsDetected[0]],
                confidence: 95,
                tags: ['defense', 'urgent', 'blocking'],
                followUp: 'After blocking, look for your own winning opportunities.'
            });
        }

        // Strategic opportunity
        const winningMoves = detectWinningMoves();
        if (winningMoves.length > 0) {
            hints.push({
                id: 'winning_opportunity',
                type: 'tactical',
                level: 'intermediate',
                urgency: 'high',
                title: 'Winning Move Available!',
                content: `You can win by playing in column ${winningMoves[0] + 1}!`,
                explanation: 'You have three pieces in a row with an open space for the fourth. Playing here will complete your connection and win the game.',
                alternatives: winningMoves.slice(1).map(col => `Alternative winning move: column ${col + 1}`),
                boardPosition: winningMoves,
                confidence: 100,
                tags: ['offense', 'winning', 'tactical'],
                followUp: 'Great job spotting the winning move!'
            });
        }

        // Pattern recognition hint
        if (turnCount > 6 && playerLevel >= 5) {
            hints.push({
                id: 'pattern_recognition',
                type: 'learning',
                level: 'intermediate',
                urgency: 'low',
                title: 'Pattern Building Opportunity',
                content: 'You can create a potential fork by building vertically in columns 2 and 6 simultaneously.',
                explanation: 'A fork is when you create two potential winning threats at once, making it impossible for your opponent to block both.',
                alternatives: ['Build slowly to avoid telegraphing your strategy', 'Mix in some diversionary moves'],
                boardPosition: [1, 5],
                confidence: 70,
                tags: ['patterns', 'advanced', 'tactics'],
                followUp: 'Advanced pattern recognition is key to higher-level play.'
            });
        }

        // Encouragement for good moves
        if (lastMove && isGoodMove(lastMove)) {
            hints.push({
                id: 'encouragement',
                type: 'encouragement',
                level: 'beginner',
                urgency: 'low',
                title: 'Excellent Move!',
                content: 'That was a strategically sound choice. You\'re developing your position while maintaining flexibility.',
                explanation: 'Your move improved your position without creating unnecessary weaknesses. This type of balanced play is characteristic of strong players.',
                confidence: 80,
                tags: ['encouragement', 'analysis'],
                followUp: 'Keep looking for moves that improve your position while staying flexible.'
            });
        }

        // Learning opportunity
        if (playerLevel < 10) {
            hints.push({
                id: 'learning_diagonal',
                type: 'learning',
                level: 'beginner',
                urgency: 'low',
                title: 'Diagonal Awareness Tip',
                content: 'Don\'t forget about diagonal connections! They\'re often overlooked but can be game-winning.',
                explanation: 'Many players focus on horizontal and vertical connections but miss diagonal opportunities. Practice visualizing diagonal lines across the board.',
                confidence: 75,
                tags: ['learning', 'diagonals', 'visualization'],
                followUp: 'Try practicing with diagonal-focused puzzles to improve this skill.'
            });
        }

        return hints.filter(hint => shouldShowHint(hint));
    };

    const detectThreats = (): number[] => {
        // Simplified threat detection - in real implementation, this would analyze the board
        const threats: number[] = [];

        // Mock threat detection based on board state
        if (currentBoard && currentBoard.length > 0) {
            // Check for opponent three-in-a-row patterns
            for (let col = 0; col < 7; col++) {
                if (Math.random() > 0.9) { // Simulate 10% chance of threat per column
                    threats.push(col);
                }
            }
        }

        return threats;
    };

    const detectWinningMoves = (): number[] => {
        // Simplified winning move detection
        const winningMoves: number[] = [];

        if (currentBoard && currentBoard.length > 0) {
            // Check for player three-in-a-row patterns
            for (let col = 0; col < 7; col++) {
                if (Math.random() > 0.95) { // Simulate 5% chance of winning move per column
                    winningMoves.push(col);
                }
            }
        }

        return winningMoves;
    };

    const isGoodMove = (move: { col: number; row: number }): boolean => {
        // Analyze if the last move was strategically sound
        return Math.random() > 0.3; // Simulate 70% chance of good move
    };

    const shouldShowHint = (hint: Hint): boolean => {
        if (!hintSettings.enabled) return false;

        // Filter by urgency and level
        if (hintSettings.level === 'minimal' && hint.urgency !== 'critical') return false;
        if (hintSettings.level === 'moderate' && hint.urgency === 'low') return false;

        // Filter by adaptive level
        if (hintSettings.adaptToSkill) {
            const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
            const playerLevelIndex = levelOrder.indexOf(adaptiveLevel);
            const hintLevelIndex = levelOrder.indexOf(hint.level);

            if (hintLevelIndex > playerLevelIndex + 1) return false;
        }

        return true;
    };

    const generateLearningOpportunities = () => {
        const opportunities: LearningOpportunity[] = [
            {
                id: 'basic_patterns',
                concept: 'Basic Pattern Recognition',
                description: 'Learn to identify common winning patterns and defensive needs.',
                difficulty: 'easy',
                estimatedTime: 10,
                reward: 'Improved tactical awareness',
            },
            {
                id: 'opening_principles',
                concept: 'Opening Principles',
                description: 'Master the fundamental principles of strong opening play.',
                difficulty: 'medium',
                estimatedTime: 15,
                prerequisite: 'basic_patterns',
                reward: 'Better early game positioning',
            },
            {
                id: 'endgame_technique',
                concept: 'Endgame Technique',
                description: 'Learn advanced techniques for converting winning positions.',
                difficulty: 'hard',
                estimatedTime: 25,
                prerequisite: 'opening_principles',
                reward: 'Higher win rate in close games',
            },
            {
                id: 'fork_creation',
                concept: 'Creating Forks',
                description: 'Advanced tactic: Creating multiple simultaneous threats.',
                difficulty: 'hard',
                estimatedTime: 20,
                prerequisite: 'basic_patterns',
                reward: 'Powerful offensive capabilities',
            }
        ];

        setLearningOpportunities(opportunities);
    };

    const requestSpecificHint = async () => {
        if (!hintRequest.trim()) return;

        setIsAnalyzing(true);

        // Simulate AI processing the specific request
        await new Promise(resolve => setTimeout(resolve, 1500));

        const customHint: Hint = {
            id: 'custom_request',
            type: 'learning',
            level: adaptiveLevel as any,
            urgency: 'low',
            title: `Response to: "${hintRequest}"`,
            content: generateCustomHintResponse(hintRequest),
            explanation: 'This is a personalized response based on your specific question.',
            confidence: 85,
            tags: ['custom', 'requested'],
            followUp: 'Feel free to ask more specific questions!'
        };

        setCurrentHints(prev => [customHint, ...prev]);
        setHintRequest('');
        setIsAnalyzing(false);
    };

    const generateCustomHintResponse = (request: string): string => {
        const responses = {
            'opening': 'Focus on center control early in the game. Columns 3, 4, and 5 provide the most strategic flexibility.',
            'defense': 'Always scan for opponent threats before making your move. Look for three-in-a-row patterns that need blocking.',
            'attack': 'Create multiple threats simultaneously. This forces your opponent into defensive play and gives you the initiative.',
            'strategy': 'Balance offense and defense. Improve your position while staying alert to tactical opportunities.',
            'patterns': 'Study common four-in-a-row patterns: horizontal, vertical, and both diagonal directions.',
            'default': 'That\'s a great question! Focus on improving your position while staying flexible and watching for tactical opportunities.'
        };

        const key = Object.keys(responses).find(k =>
            request.toLowerCase().includes(k)
        ) || 'default';

        return responses[key as keyof typeof responses];
    };

    const handleHintUpdate = (data: any) => {
        setCurrentHints(prev => [...prev, data.hint]);
    };

    const handleLearningOpportunity = (data: any) => {
        setLearningOpportunities(prev => [...prev, data.opportunity]);
    };

    const handleAdaptiveHint = (data: any) => {
        setAdaptiveLevel(data.level);
    };

    const selectHint = (hint: Hint) => {
        setSelectedHint(hint);

        // Add to history
        setHintHistory(prev => [hint, ...prev.filter(h => h.id !== hint.id)].slice(0, 20));
    };

    const updateSettings = (key: keyof HintSettings, value: any) => {
        setHintSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const renderHintsTab = () => (
        <div className="hints-tab">
            {/* Current Analysis */}
            {isAnalyzing ? (
                <motion.div
                    className="hint-analysis"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="analysis-container">
                        <div className="analysis-icon">🤖</div>
                        <h3>AI Analyzing Position...</h3>
                        <div className="analysis-progress">
                            <motion.div
                                className="progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${analysisProgress}%` }}
                            />
                        </div>
                    </div>
                </motion.div>
            ) : (
                <>
                    {/* Hint Request */}
                    <motion.div
                        className="hint-request-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                    >
                        <h3>Ask for Specific Guidance</h3>
                        <div className="hint-request-container">
                            <input
                                type="text"
                                value={hintRequest}
                                onChange={(e) => setHintRequest(e.target.value)}
                                placeholder="Ask about strategy, tactics, patterns..."
                                className="hint-request-input"
                                onKeyPress={(e) => e.key === 'Enter' && requestSpecificHint()}
                            />
                            <button
                                className="request-hint-btn"
                                onClick={requestSpecificHint}
                                disabled={!hintRequest.trim()}
                            >
                                Get Hint
                            </button>
                        </div>
                    </motion.div>

                    {/* Current Hints */}
                    <motion.div
                        className="current-hints-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Current Position Analysis</h3>
                        {currentHints.length > 0 ? (
                            <div className="hints-grid">
                                {currentHints.map((hint, index) => (
                                    <motion.div
                                        key={hint.id}
                                        className={`hint-card ${hint.type} ${hint.urgency}`}
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.1 * index }}
                                        onClick={() => selectHint(hint)}
                                    >
                                        <div className="hint-header">
                                            <div className="hint-type-badge">
                                                <span className="hint-icon">
                                                    {hint.type === 'strategic' ? '🧠' :
                                                        hint.type === 'tactical' ? '⚡' :
                                                            hint.type === 'defensive' ? '🛡️' :
                                                                hint.type === 'learning' ? '📚' :
                                                                    hint.type === 'warning' ? '⚠️' : '💪'}
                                                </span>
                                                <span className="hint-type-text">{hint.type.toUpperCase()}</span>
                                            </div>
                                            <div className={`urgency-badge ${hint.urgency}`}>
                                                {hint.urgency.toUpperCase()}
                                            </div>
                                        </div>

                                        <h4 className="hint-title">{hint.title}</h4>
                                        <p className="hint-preview">{hint.content}</p>

                                        {hintSettings.showConfidence && (
                                            <div className="confidence-meter">
                                                <span className="confidence-label">Confidence:</span>
                                                <div className="confidence-bar">
                                                    <div
                                                        className="confidence-fill"
                                                        style={{ width: `${hint.confidence}%` }}
                                                    />
                                                </div>
                                                <span className="confidence-value">{hint.confidence}%</span>
                                            </div>
                                        )}

                                        <div className="hint-tags">
                                            {hint.tags.map(tag => (
                                                <span key={tag} className="hint-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-hints">
                                <div className="no-hints-icon">🎯</div>
                                <div className="no-hints-text">No specific hints for current position</div>
                                <div className="no-hints-subtext">Keep playing strategically!</div>
                            </div>
                        )}
                    </motion.div>

                    {/* Detailed Hint View */}
                    {selectedHint && (
                        <motion.div
                            className="detailed-hint"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="detailed-hint-header">
                                <h3>{selectedHint.title}</h3>
                                <button
                                    className="close-detailed-btn"
                                    onClick={() => setSelectedHint(null)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="detailed-hint-content">
                                <p className="hint-explanation">{selectedHint.explanation}</p>

                                {selectedHint.alternatives && hintSettings.includeAlternatives && (
                                    <div className="hint-alternatives">
                                        <h4>Alternative Approaches:</h4>
                                        <ul>
                                            {selectedHint.alternatives.map((alt, index) => (
                                                <li key={index}>{alt}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedHint.followUp && (
                                    <div className="hint-followup">
                                        <strong>Follow-up:</strong> {selectedHint.followUp}
                                    </div>
                                )}

                                {selectedHint.boardPosition && (
                                    <div className="board-highlight">
                                        <h4>Relevant Columns:</h4>
                                        <div className="column-indicators">
                                            {selectedHint.boardPosition.map(col => (
                                                <span key={col} className="column-indicator">
                                                    {col + 1}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </div>
    );

    const renderLearningTab = () => (
        <div className="learning-tab">
            <motion.div
                className="learning-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <h3>Learning Opportunities</h3>
                <div className="learning-grid">
                    {learningOpportunities.map((opportunity, index) => (
                        <motion.div
                            key={opportunity.id}
                            className={`learning-card ${opportunity.difficulty}`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <div className="learning-header">
                                <h4>{opportunity.concept}</h4>
                                <div className={`difficulty-badge ${opportunity.difficulty}`}>
                                    {opportunity.difficulty.toUpperCase()}
                                </div>
                            </div>

                            <p className="learning-description">{opportunity.description}</p>

                            <div className="learning-details">
                                <div className="learning-time">
                                    <span className="detail-icon">⏱️</span>
                                    <span>{opportunity.estimatedTime} minutes</span>
                                </div>

                                {opportunity.prerequisite && (
                                    <div className="learning-prerequisite">
                                        <span className="detail-icon">📋</span>
                                        <span>Requires: {opportunity.prerequisite.replace('_', ' ')}</span>
                                    </div>
                                )}

                                <div className="learning-reward">
                                    <span className="detail-icon">🏆</span>
                                    <span>{opportunity.reward}</span>
                                </div>
                            </div>

                            <button className="start-learning-btn">
                                Start Learning
                            </button>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Quick Tips */}
            <motion.div
                className="quick-tips-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <h3>Quick Tips</h3>
                <div className="quick-tips-grid">
                    <div className="quick-tip">
                        <div className="tip-icon">🎯</div>
                        <div className="tip-content">
                            <h4>Center Control</h4>
                            <p>Start with center columns for maximum flexibility</p>
                        </div>
                    </div>

                    <div className="quick-tip">
                        <div className="tip-icon">🛡️</div>
                        <div className="tip-content">
                            <h4>Defense First</h4>
                            <p>Always check for opponent threats before attacking</p>
                        </div>
                    </div>

                    <div className="quick-tip">
                        <div className="tip-icon">⚡</div>
                        <div className="tip-content">
                            <h4>Multiple Threats</h4>
                            <p>Create situations where you threaten in multiple ways</p>
                        </div>
                    </div>

                    <div className="quick-tip">
                        <div className="tip-icon">👁️</div>
                        <div className="tip-content">
                            <h4>Diagonal Vision</h4>
                            <p>Don't forget about diagonal connections</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );

    const renderSettingsTab = () => (
        <div className="settings-tab">
            <motion.div
                className="settings-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <h3>Hint System Configuration</h3>

                {/* Hint Level */}
                <div className="setting-group">
                    <h4>Hint Level</h4>
                    <div className="hint-levels">
                        {hintLevels.map(level => (
                            <label key={level.id} className="hint-level-option">
                                <input
                                    type="radio"
                                    name="hintLevel"
                                    value={level.id}
                                    checked={hintSettings.level === level.id}
                                    onChange={(e) => updateSettings('level', e.target.value)}
                                />
                                <div className="level-card">
                                    <span className="level-icon" style={{ color: level.color }}>
                                        {level.icon}
                                    </span>
                                    <div className="level-info">
                                        <div className="level-name">{level.name}</div>
                                        <div className="level-description">{level.description}</div>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Toggle Settings */}
                <div className="setting-group">
                    <h4>Behavior Settings</h4>
                    <div className="toggle-settings">
                        {[
                            { key: 'enabled', label: 'Enable Hint System', description: 'Turn the entire hint system on or off' },
                            { key: 'autoShow', label: 'Auto-show Hints', description: 'Automatically display hints during gameplay' },
                            { key: 'showOnlyWhenAsked', label: 'Show Only When Asked', description: 'Only show hints when specifically requested' },
                            { key: 'adaptToSkill', label: 'Adapt to Skill Level', description: 'Automatically adjust hint complexity to your skill' },
                            { key: 'includeAlternatives', label: 'Include Alternatives', description: 'Show alternative moves and strategies' },
                            { key: 'showConfidence', label: 'Show AI Confidence', description: 'Display confidence levels for hints' },
                            { key: 'enableSounds', label: 'Enable Sound Notifications', description: 'Play sounds for important hints' }
                        ].map(setting => (
                            <label key={setting.key} className="toggle-setting">
                                <div className="toggle-info">
                                    <div className="toggle-label">{setting.label}</div>
                                    <div className="toggle-description">{setting.description}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={hintSettings[setting.key as keyof HintSettings] as boolean}
                                    onChange={(e) => updateSettings(setting.key as keyof HintSettings, e.target.checked)}
                                    className="toggle-input"
                                />
                                <div className="toggle-switch" />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Adaptive Level Display */}
                {hintSettings.adaptToSkill && (
                    <div className="setting-group">
                        <h4>Current Adaptive Level</h4>
                        <div className="adaptive-level-display">
                            <span className="adaptive-level-badge">
                                {adaptiveLevel.toUpperCase()}
                            </span>
                            <p>Hints are currently adapted to {adaptiveLevel} level based on your gameplay.</p>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );

    const renderHistoryTab = () => (
        <div className="history-tab">
            <motion.div
                className="history-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <h3>Hint History</h3>
                {hintHistory.length > 0 ? (
                    <div className="history-list">
                        {hintHistory.map((hint, index) => (
                            <motion.div
                                key={`${hint.id}-${index}`}
                                className="history-item"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.05 * index }}
                            >
                                <div className="history-header">
                                    <div className="history-type">
                                        <span className="history-icon">
                                            {hint.type === 'strategic' ? '🧠' :
                                                hint.type === 'tactical' ? '⚡' :
                                                    hint.type === 'defensive' ? '🛡️' :
                                                        hint.type === 'learning' ? '📚' :
                                                            hint.type === 'warning' ? '⚠️' : '💪'}
                                        </span>
                                        <span className="history-type-text">{hint.type}</span>
                                    </div>
                                    <div className="history-time">
                                        {new Date().toLocaleTimeString()}
                                    </div>
                                </div>

                                <h4 className="history-title">{hint.title}</h4>
                                <p className="history-content">{hint.content}</p>

                                <button
                                    className="view-again-btn"
                                    onClick={() => selectHint(hint)}
                                >
                                    View Details
                                </button>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="no-history">
                        <div className="no-history-icon">📚</div>
                        <div className="no-history-text">No hints viewed yet</div>
                        <div className="no-history-subtext">
                            Hints you interact with will appear here for easy reference
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="ai-hint-system-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="ai-hint-system"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="hint-system-header">
                        <div className="header-title">
                            <h2>AI-Guided Hint System</h2>
                            <div className="header-subtitle">
                                Contextual Learning & Strategic Guidance
                            </div>
                        </div>
                        <div className="header-controls">
                            <button
                                className="refresh-analysis-btn"
                                onClick={analyzeCurrentPosition}
                            >
                                🔄 Refresh Analysis
                            </button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="hint-system-nav">
                        {[
                            { id: 'hints', label: 'Current Hints', icon: '💡' },
                            { id: 'learning', label: 'Learning', icon: '📚' },
                            { id: 'settings', label: 'Settings', icon: '⚙️' },
                            { id: 'history', label: 'History', icon: '📝' }
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

                    {/* Content */}
                    <div className="hint-system-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'hints' && renderHintsTab()}
                            {activeTab === 'learning' && renderLearningTab()}
                            {activeTab === 'settings' && renderSettingsTab()}
                            {activeTab === 'history' && renderHistoryTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AIHintSystem; 