import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import settingsAPI, {
    UserSettings as APIUserSettings,
    GameSettings as APIGameSettings,
    UISettings as APIUISettings,
    AIPreferences as APIAIPreferences
} from '../../api/settings';
import './UserSettings.css';

interface Settings {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: {
        enabled: boolean;
        sound: boolean;
        vibration: boolean;
        email: boolean;
        push: boolean;
    };
    privacy: {
        profileVisibility: 'public' | 'friends' | 'private';
        gameHistoryVisibility: 'public' | 'friends' | 'private';
        allowAnalytics: boolean;
        allowTracking: boolean;
    };
    accessibility: {
        highContrast: boolean;
        largeText: boolean;
        reducedMotion: boolean;
        screenReader: boolean;
        keyboardNavigation: boolean;
    };
}

interface GameSettings {
    startingPlayer: 'random' | 'player' | 'ai';
    aiLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
    gameMode: 'standard' | 'timed' | 'blitz' | 'training' | 'challenge';
    timeControl: {
        enabled: boolean;
        timeLimit: number;
        increment: number;
    };
    boardSize: 'standard' | 'large' | 'custom';
    customBoard: {
        rows: number;
        cols: number;
        winLength: number;
    };
    rules: {
        gravity: boolean;
        diagonalWins: boolean;
        allowDraws: boolean;
        specialMoves: boolean;
    };
    aiStyle: 'aggressive' | 'defensive' | 'balanced' | 'creative' | 'adaptive';
    difficultyScaling: boolean;
    hintsEnabled: boolean;
    moveExplanations: boolean;
    learningMode: boolean;
    personality: {
        friendly: boolean;
        competitive: boolean;
        helpful: boolean;
        challenging: boolean;
    };
}

interface UISettings {
    layout: 'default' | 'compact' | 'wide' | 'mobile';
    sidebar: {
        enabled: boolean;
        position: 'left' | 'right';
        autoHide: boolean;
    };
    board: {
        theme: 'classic' | 'modern' | 'minimal' | 'colorful';
        animations: boolean;
        soundEffects: boolean;
        particleEffects: boolean;
        showCoordinates: boolean;
        showMoveNumbers: boolean;
    };
    controls: {
        showTooltips: boolean;
        keyboardShortcuts: boolean;
        mouseWheelZoom: boolean;
        rightClickMenu: boolean;
    };
    display: {
        fontSize: 'small' | 'medium' | 'large';
        colorScheme: 'default' | 'highContrast' | 'colorBlind';
        showFPS: boolean;
        showDebugInfo: boolean;
    };
}

interface AISettings {
    modelType: 'standard' | 'advanced' | 'experimental' | 'custom';
    algorithm: 'minimax' | 'alphabeta' | 'mcts' | 'neural' | 'hybrid';
    searchDepth: number;
    timeLimit: number;
    evaluationFunction: 'standard' | 'advanced' | 'custom';
    adaptiveDifficulty: boolean;
    skillTracking: boolean;
    personalizedTraining: boolean;
    progressAnalysis: boolean;
    recommendationEngine: boolean;
    moveSuggestions: boolean;
    threatWarnings: boolean;
    strategicHints: boolean;
    postGameAnalysis: boolean;
    learningTips: boolean;
}

type SettingsTab = 'user' | 'game' | 'ui' | 'ai';

interface UserSettingsProps {
    playerId: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ playerId }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('user');
    const [settings, setSettings] = useState<Settings>({
        theme: 'auto',
        language: 'en',
        timezone: 'UTC',
        notifications: {
            enabled: true,
            sound: true,
            vibration: false,
            email: false,
            push: false,
        },
        privacy: {
            profileVisibility: 'public',
            gameHistoryVisibility: 'friends',
            allowAnalytics: true,
            allowTracking: false,
        },
        accessibility: {
            highContrast: false,
            largeText: false,
            reducedMotion: false,
            screenReader: false,
            keyboardNavigation: true,
        },
    });

    const [gameSettings, setGameSettings] = useState<GameSettings>({
        startingPlayer: 'random',
        aiLevel: 'intermediate',
        gameMode: 'standard',
        timeControl: {
            enabled: false,
            timeLimit: 300,
            increment: 0,
        },
        boardSize: 'standard',
        customBoard: {
            rows: 6,
            cols: 7,
            winLength: 4,
        },
        rules: {
            gravity: true,
            diagonalWins: true,
            allowDraws: true,
            specialMoves: false,
        },
        aiStyle: 'balanced',
        difficultyScaling: true,
        hintsEnabled: true,
        moveExplanations: true,
        learningMode: true,
        personality: {
            friendly: true,
            competitive: true,
            helpful: true,
            challenging: true,
        },
    });

    const [uiSettings, setUISettings] = useState<UISettings>({
        layout: 'default',
        sidebar: {
            enabled: true,
            position: 'right',
            autoHide: false,
        },
        board: {
            theme: 'modern',
            animations: true,
            soundEffects: true,
            particleEffects: true,
            showCoordinates: false,
            showMoveNumbers: false,
        },
        controls: {
            showTooltips: true,
            keyboardShortcuts: true,
            mouseWheelZoom: false,
            rightClickMenu: true,
        },
        display: {
            fontSize: 'medium',
            colorScheme: 'default',
            showFPS: false,
            showDebugInfo: false,
        },
    });

    const [aiSettings, setAISettings] = useState<AISettings>({
        modelType: 'standard',
        algorithm: 'hybrid',
        searchDepth: 6,
        timeLimit: 2000,
        evaluationFunction: 'advanced',
        adaptiveDifficulty: true,
        skillTracking: true,
        personalizedTraining: true,
        progressAnalysis: true,
        recommendationEngine: true,
        moveSuggestions: true,
        threatWarnings: true,
        strategicHints: true,
        postGameAnalysis: true,
        learningTips: true,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadAllSettings();
    }, [playerId]);

    const loadAllSettings = async () => {
        try {
            setLoading(true);
            const [userSettings, gameSettingsData, uiSettingsData, aiSettingsData] = await Promise.all([
                settingsAPI.getUserSettings(playerId).catch(() => null),
                settingsAPI.getGameSettings(playerId).catch(() => null),
                settingsAPI.getUISettings(playerId).catch(() => null),
                settingsAPI.getAIPreferences(playerId).catch(() => null),
            ]);

            if (userSettings) {
                setSettings(userSettings.preferences);
            }
            if (gameSettingsData) {
                const prefs = gameSettingsData.gamePreferences as any;
                setGameSettings({
                    startingPlayer: prefs.startingPlayer,
                    aiLevel: prefs.aiLevel,
                    gameMode: prefs.gameMode,
                    timeControl: prefs.timeControl,
                    boardSize: prefs.boardSize,
                    customBoard: prefs.customBoard,
                    rules: prefs.rules,
                    aiStyle: prefs.aiStyle || 'balanced',
                    difficultyScaling: prefs.difficultyScaling || true,
                    hintsEnabled: prefs.hintsEnabled || true,
                    moveExplanations: prefs.moveExplanations || true,
                    learningMode: prefs.learningMode || true,
                    personality: prefs.personality || {
                        friendly: true,
                        competitive: true,
                        helpful: true,
                        challenging: true,
                    },
                });
            }
            if (uiSettingsData) {
                setUISettings(uiSettingsData.interface);
            }
            if (aiSettingsData) {
                setAISettings({
                    ...aiSettingsData.aiConfiguration,
                    ...aiSettingsData.learningPreferences,
                    ...aiSettingsData.interactionPreferences,
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        } finally {
            setLoading(false);
        }
    };

    const saveAllSettings = async () => {
        try {
            setSaving(true);
            await Promise.all([
                settingsAPI.updateUserSettings(playerId, { preferences: settings }),
                settingsAPI.updateGameSettings(playerId, { gamePreferences: gameSettings }),
                settingsAPI.updateUISettings(playerId, { interface: uiSettings }),
                settingsAPI.updateAIPreferences(playerId, {
                    aiConfiguration: {
                        modelType: aiSettings.modelType,
                        algorithm: aiSettings.algorithm,
                        searchDepth: aiSettings.searchDepth,
                        timeLimit: aiSettings.timeLimit,
                        evaluationFunction: aiSettings.evaluationFunction,
                    },
                    learningPreferences: {
                        adaptiveDifficulty: aiSettings.adaptiveDifficulty,
                        skillTracking: aiSettings.skillTracking,
                        personalizedTraining: aiSettings.personalizedTraining,
                        progressAnalysis: aiSettings.progressAnalysis,
                        recommendationEngine: aiSettings.recommendationEngine,
                    },
                    interactionPreferences: {
                        moveSuggestions: aiSettings.moveSuggestions,
                        threatWarnings: aiSettings.threatWarnings,
                        strategicHints: aiSettings.strategicHints,
                        postGameAnalysis: aiSettings.postGameAnalysis,
                        learningTips: aiSettings.learningTips,
                    },
                }),
            ]);

            setMessage({ type: 'success', text: 'Settings saved successfully!' });

            // Apply theme immediately
            applyTheme(settings.theme);

            // Apply accessibility settings
            applyAccessibilitySettings(settings.accessibility);

        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const resetToDefaults = async () => {
        try {
            setSaving(true);
            await settingsAPI.resetSettings(playerId, 'all');
            // Reload settings after reset
            await loadAllSettings();
            setMessage({ type: 'success', text: 'Settings reset to defaults' });
        } catch (error) {
            console.error('Failed to reset settings:', error);
            setMessage({ type: 'error', text: 'Failed to reset settings' });
        } finally {
            setSaving(false);
        }
    };

    const applyTheme = (theme: string) => {
        const root = document.documentElement;
        root.classList.remove('theme-light', 'theme-dark');

        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
        } else {
            root.classList.add(`theme-${theme}`);
        }
    };

    const applyAccessibilitySettings = (accessibility: Settings['accessibility']) => {
        const root = document.documentElement;

        if (accessibility.highContrast) {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }

        if (accessibility.reducedMotion) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }
    };

    const handleSettingChange = (category: keyof Settings, key: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            [category]: typeof prev[category] === 'object' && prev[category] !== null
                ? { ...(prev[category] as object), [key]: value }
                : value
        }));
    };

    const handleGameSettingChange = (key: string, value: any) => {
        setGameSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleUISettingChange = (category: keyof UISettings, key: string, value: any) => {
        setUISettings(prev => ({
            ...prev,
            [category]: typeof prev[category] === 'object' && prev[category] !== null
                ? { ...(prev[category] as object), [key]: value }
                : value
        }));
    };

    const handleAISettingChange = (key: string, value: any) => {
        setAISettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const exportSettings = async () => {
        try {
            const exported = await settingsAPI.exportSettings(playerId, 'json');
            const blob = new Blob([exported], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'connect4-settings.json';
            a.click();
            URL.revokeObjectURL(url);
            setMessage({ type: 'success', text: 'Settings exported successfully!' });
        } catch (error) {
            console.error('Failed to export settings:', error);
            setMessage({ type: 'error', text: 'Failed to export settings' });
        }
    };

    const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedData = JSON.parse(text);
            await settingsAPI.importSettings(playerId, text, 'json');
            await loadAllSettings();
            setMessage({ type: 'success', text: 'Settings imported successfully!' });
        } catch (error) {
            console.error('Failed to import settings:', error);
            setMessage({ type: 'error', text: 'Failed to import settings' });
        }
    };

    const tabs = [
        { id: 'user', label: '👤 User', icon: '👤' },
        { id: 'game', label: '🎮 Game', icon: '🎮' },
        { id: 'ui', label: '🎨 Interface', icon: '🎨' },
        { id: 'ai', label: '🤖 AI', icon: '🤖' },
    ];

    if (loading) {
        return (
            <div className="settings-container">
                <div className="settings-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h2>⚙️ Settings</h2>
                <p>Customize your Connect Four experience</p>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="settings-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as SettingsTab)}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="settings-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* User Settings Tab */}
                        {activeTab === 'user' && (
                            <div className="settings-section">
                                <h3>👤 User Preferences</h3>

                                {/* Appearance */}
                                <div className="setting-group">
                                    <h4>🎨 Appearance</h4>
                                    <label>
                                        Theme:
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => handleSettingChange('theme', '', e.target.value)}
                                        >
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="auto">Auto (System)</option>
                                        </select>
                                    </label>
                                    <label>
                                        Language:
                                        <select
                                            value={settings.language}
                                            onChange={(e) => handleSettingChange('language', '', e.target.value)}
                                        >
                                            <option value="en">English</option>
                                            <option value="es">Spanish</option>
                                            <option value="fr">French</option>
                                            <option value="de">German</option>
                                        </select>
                                    </label>
                                    <label>
                                        Timezone:
                                        <select
                                            value={settings.timezone}
                                            onChange={(e) => handleSettingChange('timezone', '', e.target.value)}
                                        >
                                            <option value="UTC">UTC</option>
                                            <option value="EST">Eastern Time</option>
                                            <option value="PST">Pacific Time</option>
                                            <option value="GMT">GMT</option>
                                        </select>
                                    </label>
                                </div>

                                {/* Notifications */}
                                <div className="setting-group">
                                    <h4>🔔 Notifications</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.enabled}
                                            onChange={(e) => handleSettingChange('notifications', 'enabled', e.target.checked)}
                                        />
                                        Enable All Notifications
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.sound}
                                            onChange={(e) => handleSettingChange('notifications', 'sound', e.target.checked)}
                                        />
                                        Enable Sound
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.vibration}
                                            onChange={(e) => handleSettingChange('notifications', 'vibration', e.target.checked)}
                                        />
                                        Enable Vibration
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.email}
                                            onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                                        />
                                        Enable Email
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.push}
                                            onChange={(e) => handleSettingChange('notifications', 'push', e.target.checked)}
                                        />
                                        Enable Push Notifications
                                    </label>
                                </div>

                                {/* Privacy */}
                                <div className="setting-group">
                                    <h4>🔒 Privacy</h4>
                                    <label>
                                        Profile Visibility:
                                        <select
                                            value={settings.privacy.profileVisibility}
                                            onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                                        >
                                            <option value="public">Public</option>
                                            <option value="friends">Friends Only</option>
                                            <option value="private">Private</option>
                                        </select>
                                    </label>
                                    <label>
                                        Game History Visibility:
                                        <select
                                            value={settings.privacy.gameHistoryVisibility}
                                            onChange={(e) => handleSettingChange('privacy', 'gameHistoryVisibility', e.target.value)}
                                        >
                                            <option value="public">Public</option>
                                            <option value="friends">Friends Only</option>
                                            <option value="private">Private</option>
                                        </select>
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.privacy.allowAnalytics}
                                            onChange={(e) => handleSettingChange('privacy', 'allowAnalytics', e.target.checked)}
                                        />
                                        Allow Analytics
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.privacy.allowTracking}
                                            onChange={(e) => handleSettingChange('privacy', 'allowTracking', e.target.checked)}
                                        />
                                        Allow Tracking
                                    </label>
                                </div>

                                {/* Accessibility */}
                                <div className="setting-group">
                                    <h4>♿ Accessibility</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.accessibility.highContrast}
                                            onChange={(e) => handleSettingChange('accessibility', 'highContrast', e.target.checked)}
                                        />
                                        High Contrast Mode
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.accessibility.largeText}
                                            onChange={(e) => handleSettingChange('accessibility', 'largeText', e.target.checked)}
                                        />
                                        Large Text
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.accessibility.reducedMotion}
                                            onChange={(e) => handleSettingChange('accessibility', 'reducedMotion', e.target.checked)}
                                        />
                                        Reduced Motion
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.accessibility.screenReader}
                                            onChange={(e) => handleSettingChange('accessibility', 'screenReader', e.target.checked)}
                                        />
                                        Screen Reader Support
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={settings.accessibility.keyboardNavigation}
                                            onChange={(e) => handleSettingChange('accessibility', 'keyboardNavigation', e.target.checked)}
                                        />
                                        Keyboard Navigation
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Game Settings Tab */}
                        {activeTab === 'game' && (
                            <div className="settings-section">
                                <h3>🎮 Game Preferences</h3>

                                {/* Game Setup */}
                                <div className="setting-group">
                                    <h4>🎯 Game Setup</h4>
                                    <label>
                                        Starting Player:
                                        <select
                                            value={gameSettings.startingPlayer}
                                            onChange={(e) => handleGameSettingChange('startingPlayer', e.target.value)}
                                        >
                                            <option value="random">Random</option>
                                            <option value="player">Player Always</option>
                                            <option value="ai">AI Always</option>
                                        </select>
                                    </label>
                                    <label>
                                        AI Level:
                                        <select
                                            value={gameSettings.aiLevel}
                                            onChange={(e) => handleGameSettingChange('aiLevel', e.target.value)}
                                        >
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="expert">Expert</option>
                                            <option value="master">Master</option>
                                        </select>
                                    </label>
                                    <label>
                                        Game Mode:
                                        <select
                                            value={gameSettings.gameMode}
                                            onChange={(e) => handleGameSettingChange('gameMode', e.target.value)}
                                        >
                                            <option value="standard">Standard</option>
                                            <option value="timed">Timed</option>
                                            <option value="blitz">Blitz</option>
                                            <option value="training">Training</option>
                                            <option value="challenge">Challenge</option>
                                        </select>
                                    </label>
                                </div>

                                {/* Time Control */}
                                <div className="setting-group">
                                    <h4>⏱️ Time Control</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.timeControl.enabled}
                                            onChange={(e) => handleGameSettingChange('timeControl', {
                                                ...gameSettings.timeControl,
                                                enabled: e.target.checked
                                            })}
                                        />
                                        Enable Time Control
                                    </label>
                                    {gameSettings.timeControl.enabled && (
                                        <>
                                            <label>
                                                Time Limit (seconds):
                                                <input
                                                    type="number"
                                                    min="30"
                                                    max="3600"
                                                    value={gameSettings.timeControl.timeLimit}
                                                    onChange={(e) => handleGameSettingChange('timeControl', {
                                                        ...gameSettings.timeControl,
                                                        timeLimit: parseInt(e.target.value)
                                                    })}
                                                />
                                            </label>
                                            <label>
                                                Increment (seconds):
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="60"
                                                    value={gameSettings.timeControl.increment}
                                                    onChange={(e) => handleGameSettingChange('timeControl', {
                                                        ...gameSettings.timeControl,
                                                        increment: parseInt(e.target.value)
                                                    })}
                                                />
                                            </label>
                                        </>
                                    )}
                                </div>

                                {/* Board Settings */}
                                <div className="setting-group">
                                    <h4>📐 Board Settings</h4>
                                    <label>
                                        Board Size:
                                        <select
                                            value={gameSettings.boardSize}
                                            onChange={(e) => handleGameSettingChange('boardSize', e.target.value)}
                                        >
                                            <option value="standard">Standard (6x7)</option>
                                            <option value="large">Large (8x9)</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </label>
                                    {gameSettings.boardSize === 'custom' && (
                                        <>
                                            <label>
                                                Rows:
                                                <input
                                                    type="number"
                                                    min="4"
                                                    max="12"
                                                    value={gameSettings.customBoard.rows}
                                                    onChange={(e) => handleGameSettingChange('customBoard', {
                                                        ...gameSettings.customBoard,
                                                        rows: parseInt(e.target.value)
                                                    })}
                                                />
                                            </label>
                                            <label>
                                                Columns:
                                                <input
                                                    type="number"
                                                    min="4"
                                                    max="12"
                                                    value={gameSettings.customBoard.cols}
                                                    onChange={(e) => handleGameSettingChange('customBoard', {
                                                        ...gameSettings.customBoard,
                                                        cols: parseInt(e.target.value)
                                                    })}
                                                />
                                            </label>
                                            <label>
                                                Win Length:
                                                <input
                                                    type="number"
                                                    min="3"
                                                    max="6"
                                                    value={gameSettings.customBoard.winLength}
                                                    onChange={(e) => handleGameSettingChange('customBoard', {
                                                        ...gameSettings.customBoard,
                                                        winLength: parseInt(e.target.value)
                                                    })}
                                                />
                                            </label>
                                        </>
                                    )}
                                </div>

                                {/* Game Rules */}
                                <div className="setting-group">
                                    <h4>📋 Game Rules</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.rules.gravity}
                                            onChange={(e) => handleGameSettingChange('rules', {
                                                ...gameSettings.rules,
                                                gravity: e.target.checked
                                            })}
                                        />
                                        Enable Gravity
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.rules.diagonalWins}
                                            onChange={(e) => handleGameSettingChange('rules', {
                                                ...gameSettings.rules,
                                                diagonalWins: e.target.checked
                                            })}
                                        />
                                        Allow Diagonal Wins
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.rules.allowDraws}
                                            onChange={(e) => handleGameSettingChange('rules', {
                                                ...gameSettings.rules,
                                                allowDraws: e.target.checked
                                            })}
                                        />
                                        Allow Draws
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.rules.specialMoves}
                                            onChange={(e) => handleGameSettingChange('rules', {
                                                ...gameSettings.rules,
                                                specialMoves: e.target.checked
                                            })}
                                        />
                                        Enable Special Moves
                                    </label>
                                </div>

                                {/* AI Preferences */}
                                <div className="setting-group">
                                    <h4>🤖 AI Preferences</h4>
                                    <label>
                                        AI Style:
                                        <select
                                            value={gameSettings.aiStyle}
                                            onChange={(e) => handleGameSettingChange('aiStyle', e.target.value)}
                                        >
                                            <option value="aggressive">Aggressive</option>
                                            <option value="defensive">Defensive</option>
                                            <option value="balanced">Balanced</option>
                                            <option value="creative">Creative</option>
                                            <option value="adaptive">Adaptive</option>
                                        </select>
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.difficultyScaling}
                                            onChange={(e) => handleGameSettingChange('difficultyScaling', e.target.checked)}
                                        />
                                        Adaptive Difficulty
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.hintsEnabled}
                                            onChange={(e) => handleGameSettingChange('hintsEnabled', e.target.checked)}
                                        />
                                        Enable Hints
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.moveExplanations}
                                            onChange={(e) => handleGameSettingChange('moveExplanations', e.target.checked)}
                                        />
                                        Move Explanations
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.learningMode}
                                            onChange={(e) => handleGameSettingChange('learningMode', e.target.checked)}
                                        />
                                        Learning Mode
                                    </label>
                                </div>

                                {/* AI Personality */}
                                <div className="setting-group">
                                    <h4>🎭 AI Personality</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.personality.friendly}
                                            onChange={(e) => handleGameSettingChange('personality', {
                                                ...gameSettings.personality,
                                                friendly: e.target.checked
                                            })}
                                        />
                                        Friendly
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.personality.competitive}
                                            onChange={(e) => handleGameSettingChange('personality', {
                                                ...gameSettings.personality,
                                                competitive: e.target.checked
                                            })}
                                        />
                                        Competitive
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.personality.helpful}
                                            onChange={(e) => handleGameSettingChange('personality', {
                                                ...gameSettings.personality,
                                                helpful: e.target.checked
                                            })}
                                        />
                                        Helpful
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={gameSettings.personality.challenging}
                                            onChange={(e) => handleGameSettingChange('personality', {
                                                ...gameSettings.personality,
                                                challenging: e.target.checked
                                            })}
                                        />
                                        Challenging
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* UI Settings Tab */}
                        {activeTab === 'ui' && (
                            <div className="settings-section">
                                <h3>🎨 Interface Settings</h3>

                                {/* Layout */}
                                <div className="setting-group">
                                    <h4>📱 Layout</h4>
                                    <label>
                                        Layout Style:
                                        <select
                                            value={uiSettings.layout}
                                            onChange={(e) => handleUISettingChange('layout', '', e.target.value)}
                                        >
                                            <option value="default">Default</option>
                                            <option value="compact">Compact</option>
                                            <option value="wide">Wide</option>
                                            <option value="mobile">Mobile</option>
                                        </select>
                                    </label>
                                </div>

                                {/* Sidebar */}
                                <div className="setting-group">
                                    <h4>📋 Sidebar</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.sidebar.enabled}
                                            onChange={(e) => handleUISettingChange('sidebar', 'enabled', e.target.checked)}
                                        />
                                        Enable Sidebar
                                    </label>
                                    {uiSettings.sidebar.enabled && (
                                        <>
                                            <label>
                                                Position:
                                                <select
                                                    value={uiSettings.sidebar.position}
                                                    onChange={(e) => handleUISettingChange('sidebar', 'position', e.target.value)}
                                                >
                                                    <option value="left">Left</option>
                                                    <option value="right">Right</option>
                                                </select>
                                            </label>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={uiSettings.sidebar.autoHide}
                                                    onChange={(e) => handleUISettingChange('sidebar', 'autoHide', e.target.checked)}
                                                />
                                                Auto-hide Sidebar
                                            </label>
                                        </>
                                    )}
                                </div>

                                {/* Board */}
                                <div className="setting-group">
                                    <h4>🎯 Board</h4>
                                    <label>
                                        Board Theme:
                                        <select
                                            value={uiSettings.board.theme}
                                            onChange={(e) => handleUISettingChange('board', 'theme', e.target.value)}
                                        >
                                            <option value="classic">Classic</option>
                                            <option value="modern">Modern</option>
                                            <option value="minimal">Minimal</option>
                                            <option value="colorful">Colorful</option>
                                        </select>
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.board.animations}
                                            onChange={(e) => handleUISettingChange('board', 'animations', e.target.checked)}
                                        />
                                        Enable Animations
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.board.soundEffects}
                                            onChange={(e) => handleUISettingChange('board', 'soundEffects', e.target.checked)}
                                        />
                                        Sound Effects
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.board.particleEffects}
                                            onChange={(e) => handleUISettingChange('board', 'particleEffects', e.target.checked)}
                                        />
                                        Particle Effects
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.board.showCoordinates}
                                            onChange={(e) => handleUISettingChange('board', 'showCoordinates', e.target.checked)}
                                        />
                                        Show Coordinates
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.board.showMoveNumbers}
                                            onChange={(e) => handleUISettingChange('board', 'showMoveNumbers', e.target.checked)}
                                        />
                                        Show Move Numbers
                                    </label>
                                </div>

                                {/* Controls */}
                                <div className="setting-group">
                                    <h4>🎮 Controls</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.controls.showTooltips}
                                            onChange={(e) => handleUISettingChange('controls', 'showTooltips', e.target.checked)}
                                        />
                                        Show Tooltips
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.controls.keyboardShortcuts}
                                            onChange={(e) => handleUISettingChange('controls', 'keyboardShortcuts', e.target.checked)}
                                        />
                                        Keyboard Shortcuts
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.controls.mouseWheelZoom}
                                            onChange={(e) => handleUISettingChange('controls', 'mouseWheelZoom', e.target.checked)}
                                        />
                                        Mouse Wheel Zoom
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.controls.rightClickMenu}
                                            onChange={(e) => handleUISettingChange('controls', 'rightClickMenu', e.target.checked)}
                                        />
                                        Right-click Menu
                                    </label>
                                </div>

                                {/* Display */}
                                <div className="setting-group">
                                    <h4>👁️ Display</h4>
                                    <label>
                                        Font Size:
                                        <select
                                            value={uiSettings.display.fontSize}
                                            onChange={(e) => handleUISettingChange('display', 'fontSize', e.target.value)}
                                        >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                        </select>
                                    </label>
                                    <label>
                                        Color Scheme:
                                        <select
                                            value={uiSettings.display.colorScheme}
                                            onChange={(e) => handleUISettingChange('display', 'colorScheme', e.target.value)}
                                        >
                                            <option value="default">Default</option>
                                            <option value="highContrast">High Contrast</option>
                                            <option value="colorBlind">Color Blind Friendly</option>
                                        </select>
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.display.showFPS}
                                            onChange={(e) => handleUISettingChange('display', 'showFPS', e.target.checked)}
                                        />
                                        Show FPS Counter
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={uiSettings.display.showDebugInfo}
                                            onChange={(e) => handleUISettingChange('display', 'showDebugInfo', e.target.checked)}
                                        />
                                        Show Debug Info
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* AI Settings Tab */}
                        {activeTab === 'ai' && (
                            <div className="settings-section">
                                <h3>🤖 AI Configuration</h3>

                                {/* AI Model */}
                                <div className="setting-group">
                                    <h4>🧠 AI Model</h4>
                                    <label>
                                        Model Type:
                                        <select
                                            value={aiSettings.modelType}
                                            onChange={(e) => handleAISettingChange('modelType', e.target.value)}
                                        >
                                            <option value="standard">Standard</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="experimental">Experimental</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </label>
                                    <label>
                                        Algorithm:
                                        <select
                                            value={aiSettings.algorithm}
                                            onChange={(e) => handleAISettingChange('algorithm', e.target.value)}
                                        >
                                            <option value="minimax">Minimax</option>
                                            <option value="alphabeta">Alpha-Beta</option>
                                            <option value="mcts">Monte Carlo Tree Search</option>
                                            <option value="neural">Neural Network</option>
                                            <option value="hybrid">Hybrid</option>
                                        </select>
                                    </label>
                                    <label>
                                        Search Depth:
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={aiSettings.searchDepth}
                                            onChange={(e) => handleAISettingChange('searchDepth', parseInt(e.target.value))}
                                        />
                                        <span>{aiSettings.searchDepth}</span>
                                    </label>
                                    <label>
                                        Time Limit (ms):
                                        <input
                                            type="number"
                                            min="100"
                                            max="10000"
                                            step="100"
                                            value={aiSettings.timeLimit}
                                            onChange={(e) => handleAISettingChange('timeLimit', parseInt(e.target.value))}
                                        />
                                    </label>
                                    <label>
                                        Evaluation Function:
                                        <select
                                            value={aiSettings.evaluationFunction}
                                            onChange={(e) => handleAISettingChange('evaluationFunction', e.target.value)}
                                        >
                                            <option value="standard">Standard</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </label>
                                </div>

                                {/* Learning Preferences */}
                                <div className="setting-group">
                                    <h4>📚 Learning</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.adaptiveDifficulty}
                                            onChange={(e) => handleAISettingChange('adaptiveDifficulty', e.target.checked)}
                                        />
                                        Adaptive Difficulty
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.skillTracking}
                                            onChange={(e) => handleAISettingChange('skillTracking', e.target.checked)}
                                        />
                                        Skill Tracking
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.personalizedTraining}
                                            onChange={(e) => handleAISettingChange('personalizedTraining', e.target.checked)}
                                        />
                                        Personalized Training
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.progressAnalysis}
                                            onChange={(e) => handleAISettingChange('progressAnalysis', e.target.checked)}
                                        />
                                        Progress Analysis
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.recommendationEngine}
                                            onChange={(e) => handleAISettingChange('recommendationEngine', e.target.checked)}
                                        />
                                        Recommendation Engine
                                    </label>
                                </div>

                                {/* Interaction Preferences */}
                                <div className="setting-group">
                                    <h4>💬 Interaction</h4>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.moveSuggestions}
                                            onChange={(e) => handleAISettingChange('moveSuggestions', e.target.checked)}
                                        />
                                        Move Suggestions
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.threatWarnings}
                                            onChange={(e) => handleAISettingChange('threatWarnings', e.target.checked)}
                                        />
                                        Threat Warnings
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.strategicHints}
                                            onChange={(e) => handleAISettingChange('strategicHints', e.target.checked)}
                                        />
                                        Strategic Hints
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.postGameAnalysis}
                                            onChange={(e) => handleAISettingChange('postGameAnalysis', e.target.checked)}
                                        />
                                        Post-Game Analysis
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={aiSettings.learningTips}
                                            onChange={(e) => handleAISettingChange('learningTips', e.target.checked)}
                                        />
                                        Learning Tips
                                    </label>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="settings-actions">
                <button
                    className="btn-primary"
                    onClick={saveAllSettings}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : '💾 Save All Settings'}
                </button>

                <button
                    className="btn-secondary"
                    onClick={resetToDefaults}
                    disabled={saving}
                >
                    🔄 Reset to Defaults
                </button>

                <button
                    className="btn-secondary"
                    onClick={exportSettings}
                >
                    📤 Export Settings
                </button>

                <label className="btn-secondary file-input-label">
                    📥 Import Settings
                    <input
                        type="file"
                        accept=".json"
                        onChange={importSettings}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>
        </div>
    );
};

export default UserSettings; 