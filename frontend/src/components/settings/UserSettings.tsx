import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import settingsAPI from '../../api/settings';
import './UserSettings.css';

// Simplified, focused settings structure
interface UserSettingsState {
    // Game Settings
    showHints: boolean;
    showMoveAnalysis: boolean;
    
    // Display Settings
    theme: 'light' | 'dark' | 'auto';
    boardTheme: 'classic' | 'modern' | 'minimal';
    enableAnimations: boolean;
    enableSounds: boolean;
    
    // Accessibility
    highContrast: boolean;
    reducedMotion: boolean;
    largeText: boolean;
}

type SettingsTab = 'game' | 'display' | 'accessibility';

interface UserSettingsProps {
    playerId: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ playerId }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('game');
    const [settings, setSettings] = useState<UserSettingsState>({
        showHints: true,
        showMoveAnalysis: true,
        theme: 'auto',
        boardTheme: 'modern',
        enableAnimations: true,
        enableSounds: true,
        highContrast: false,
        reducedMotion: false,
        largeText: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, [playerId]);

    useEffect(() => {
        // Auto-save settings after changes with debounce
        const timeoutId = setTimeout(() => {
            if (!loading) {
                saveSettings();
            }
        }, 1000);
        
        return () => clearTimeout(timeoutId);
    }, [settings, loading]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const [userSettings, gameSettings] = await Promise.all([
                settingsAPI.getUserSettings(playerId).catch(() => null),
                settingsAPI.getGameSettings(playerId).catch(() => null),
            ]);

            if (userSettings || gameSettings) {
                setSettings(prev => ({
                    ...prev,
                    // Map from API format to our simplified format
                    theme: userSettings?.preferences?.theme || prev.theme,
                    enableSounds: userSettings?.preferences?.notifications?.sound ?? prev.enableSounds,
                    highContrast: userSettings?.preferences?.accessibility?.highContrast ?? prev.highContrast,
                    reducedMotion: userSettings?.preferences?.accessibility?.reducedMotion ?? prev.reducedMotion,
                    largeText: userSettings?.preferences?.accessibility?.largeText ?? prev.largeText,
                    showHints: gameSettings?.aiPreferences?.hintsEnabled ?? prev.showHints,
                    showMoveAnalysis: gameSettings?.aiPreferences?.moveExplanations ?? prev.showMoveAnalysis,
                }));
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            
            // Convert our simplified format back to API format
            const userSettingsPayload = {
                preferences: {
                    theme: settings.theme,
                    language: 'en',
                    timezone: 'UTC',
                    notifications: {
                        enabled: true,
                        sound: settings.enableSounds,
                        vibration: false,
                        email: false,
                        push: false,
                    },
                    privacy: {
                        profileVisibility: 'public' as const,
                        gameHistoryVisibility: 'friends' as const,
                        showOnlineStatus: true,
                        shareStats: true,
                        allowFriendRequests: true,
                        allowAnalytics: true,
                        allowTracking: false,
                    },
                    accessibility: {
                        screenReader: false,
                        keyboardNavigation: true,
                        reducedMotion: settings.reducedMotion,
                        highContrast: settings.highContrast,
                        increasedTextSize: settings.largeText,
                        largeText: settings.largeText,
                    }
                }
            };

            const gameSettingsPayload = {
                gamePreferences: {
                    startingPlayer: 'random' as const,
                    aiLevel: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master',
                    gameMode: 'standard' as const,
                    timeControl: {
                        enabled: false,
                        timeLimit: 300,
                        increment: 5
                    },
                    boardSize: 'standard' as const,
                    customBoard: {
                        rows: 6,
                        cols: 7,
                        winLength: 4
                    },
                    rules: {
                        gravity: true,
                        diagonalWins: true,
                        allowDraws: true,
                        specialMoves: false
                    }
                },
                aiPreferences: {
                    aiStyle: 'balanced' as const,
                    difficultyScaling: true,
                    hintsEnabled: settings.showHints,
                    moveExplanations: settings.showMoveAnalysis,
                    learningMode: false,
                    personality: {
                        friendly: true,
                        competitive: false,
                        helpful: true,
                        challenging: false
                    }
                }
            };

            await Promise.all([
                settingsAPI.updateUserSettings(playerId, userSettingsPayload),
                settingsAPI.updateGameSettings(playerId, gameSettingsPayload),
            ]);

            // Apply theme immediately
            applyTheme(settings.theme);
            
            // Apply accessibility settings
            applyAccessibilitySettings();

        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
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

    const applyAccessibilitySettings = () => {
        const root = document.documentElement;
        root.classList.toggle('high-contrast', settings.highContrast);
        root.classList.toggle('reduced-motion', settings.reducedMotion);
        root.classList.toggle('large-text', settings.largeText);
    };

    const updateSetting = <K extends keyof UserSettingsState>(
        key: K,
        value: UserSettingsState[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setMessage({ type: 'success', text: 'Settings updated' });
        
        // Hide message after 2 seconds
        setTimeout(() => setMessage(null), 2000);
    };

    const resetToDefaults = async () => {
        const defaults: UserSettingsState = {
            showHints: true,
            showMoveAnalysis: true,
            theme: 'auto',
            boardTheme: 'modern',
            enableAnimations: true,
            enableSounds: true,
            highContrast: false,
            reducedMotion: false,
            largeText: false,
        };
        
        setSettings(defaults);
        setMessage({ type: 'success', text: 'Settings reset to defaults' });
    };

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
        { id: 'game', label: 'Game', icon: '🎮' },
        { id: 'display', label: 'Display', icon: '🎨' },
        { id: 'accessibility', label: 'Accessibility', icon: '♿' },
    ];

    return (
        <div className="user-settings">
            <div className="settings-header">
                <h2>Settings</h2>
                <button 
                    className="reset-button"
                    onClick={resetToDefaults}
                    disabled={loading || saving}
                >
                    Reset to Defaults
                </button>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Messages */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        className={`settings-message ${message.type}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab Content */}
            <div className="settings-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Game Settings */}
                        {activeTab === 'game' && (
                            <div className="settings-section">
                                <div className="setting-group">
                                    <h3>Game Assistance</h3>
                                    <label className="switch-label">
                                        <span>Show hints during gameplay</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.showHints}
                                            onChange={(e) => updateSetting('showHints', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                    <label className="switch-label">
                                        <span>Show move analysis after each turn</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.showMoveAnalysis}
                                            onChange={(e) => updateSetting('showMoveAnalysis', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Display Settings */}
                        {activeTab === 'display' && (
                            <div className="settings-section">
                                <div className="setting-group">
                                    <h3>Appearance</h3>
                                    <label className="select-label">
                                        <span>Theme</span>
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => updateSetting('theme', e.target.value as any)}
                                        >
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="auto">Auto (Follow System)</option>
                                        </select>
                                    </label>
                                    <label className="select-label">
                                        <span>Board Style</span>
                                        <select
                                            value={settings.boardTheme}
                                            onChange={(e) => updateSetting('boardTheme', e.target.value as any)}
                                        >
                                            <option value="classic">Classic</option>
                                            <option value="modern">Modern</option>
                                            <option value="minimal">Minimal</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="setting-group">
                                    <h3>Effects</h3>
                                    <label className="switch-label">
                                        <span>Enable animations</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.enableAnimations}
                                            onChange={(e) => updateSetting('enableAnimations', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                    <label className="switch-label">
                                        <span>Enable sound effects</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.enableSounds}
                                            onChange={(e) => updateSetting('enableSounds', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Accessibility Settings */}
                        {activeTab === 'accessibility' && (
                            <div className="settings-section">
                                <div className="setting-group">
                                    <h3>Visual Accessibility</h3>
                                    <label className="switch-label">
                                        <span>High contrast mode</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.highContrast}
                                            onChange={(e) => updateSetting('highContrast', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                    <label className="switch-label">
                                        <span>Large text</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.largeText}
                                            onChange={(e) => updateSetting('largeText', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                </div>

                                <div className="setting-group">
                                    <h3>Motion</h3>
                                    <label className="switch-label">
                                        <span>Reduce motion</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.reducedMotion}
                                            onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                                        />
                                        <span className="switch"></span>
                                    </label>
                                    <p className="setting-note">
                                        Reduces animations and transitions for users sensitive to motion
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Save Indicator */}
            {saving && (
                <div className="save-indicator">
                    <span className="spinner"></span>
                    Saving...
                </div>
            )}
        </div>
    );
};

export default UserSettings;