import React, { useState, useEffect } from 'react';
import settingsAPI from '../../api/settings';
import './UserSettings.css';

interface Settings {
    theme: 'light' | 'dark' | 'auto';
    soundEnabled: boolean;
    soundVolume: number;
    aiDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
    animationsEnabled: boolean;
    showHints: boolean;
    autoSave: boolean;
    language: string;
    accessibility: {
        highContrast: boolean;
        reducedMotion: boolean;
        screenReader: boolean;
    };
    notifications: {
        gameStart: boolean;
        gameEnd: boolean;
        achievements: boolean;
        updates: boolean;
    };
    performance: {
        maxFPS: number;
        enableParticles: boolean;
        enableShadows: boolean;
    };
}

interface UserSettingsProps {
    playerId: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ playerId }) => {
    const [settings, setSettings] = useState<Settings>({
        theme: 'auto',
        soundEnabled: true,
        soundVolume: 70,
        aiDifficulty: 'medium',
        animationsEnabled: true,
        showHints: true,
        autoSave: true,
        language: 'en',
        accessibility: {
            highContrast: false,
            reducedMotion: false,
            screenReader: false,
        },
        notifications: {
            gameStart: true,
            gameEnd: true,
            achievements: true,
            updates: true,
        },
        performance: {
            maxFPS: 60,
            enableParticles: true,
            enableShadows: true,
        },
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, [playerId]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const userSettings = await settingsAPI.getUserSettings(playerId);
            if (userSettings) {
                setSettings(userSettings.preferences);
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
            await settingsAPI.updateUserSettings(playerId, settings);
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
            // Assuming resetToDefaults resets only for this user
            const defaultSettings = await settingsAPI.resetSettings(playerId, 'user');
            setSettings(defaultSettings);
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
            [category]: typeof prev[category] === 'object'
                ? { ...prev[category], [key]: value }
                : value
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
            await settingsAPI.importSettings(playerId, text, 'json');
            setSettings(JSON.parse(text));
            setMessage({ type: 'success', text: 'Settings imported successfully!' });
        } catch (error) {
            console.error('Failed to import settings:', error);
            setMessage({ type: 'error', text: 'Failed to import settings' });
        }
    };

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
                <h2>⚙️ User Settings</h2>
                <p>Customize your Connect Four experience</p>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            <div className="settings-content">
                {/* Appearance */}
                <div className="settings-section">
                    <h3>🎨 Appearance</h3>
                    <div className="setting-group">
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
                    </div>
                </div>

                {/* Audio */}
                <div className="settings-section">
                    <h3>🔊 Audio</h3>
                    <div className="setting-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.soundEnabled}
                                onChange={(e) => handleSettingChange('soundEnabled', '', e.target.checked)}
                            />
                            Enable Sound Effects
                        </label>
                        {settings.soundEnabled && (
                            <label>
                                Volume: {settings.soundVolume}%
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={settings.soundVolume}
                                    onChange={(e) => handleSettingChange('soundVolume', '', parseInt(e.target.value))}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Game */}
                <div className="settings-section">
                    <h3>🎮 Game</h3>
                    <div className="setting-group">
                        <label>
                            AI Difficulty:
                            <select
                                value={settings.aiDifficulty}
                                onChange={(e) => handleSettingChange('aiDifficulty', '', e.target.value)}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                                <option value="expert">Expert</option>
                            </select>
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.animationsEnabled}
                                onChange={(e) => handleSettingChange('animationsEnabled', '', e.target.checked)}
                            />
                            Enable Animations
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.showHints}
                                onChange={(e) => handleSettingChange('showHints', '', e.target.checked)}
                            />
                            Show Hints
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.autoSave}
                                onChange={(e) => handleSettingChange('autoSave', '', e.target.checked)}
                            />
                            Auto-save Games
                        </label>
                    </div>
                </div>

                {/* Accessibility */}
                <div className="settings-section">
                    <h3>♿ Accessibility</h3>
                    <div className="setting-group">
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
                    </div>
                </div>

                {/* Notifications */}
                <div className="settings-section">
                    <h3>🔔 Notifications</h3>
                    <div className="setting-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.notifications.gameStart}
                                onChange={(e) => handleSettingChange('notifications', 'gameStart', e.target.checked)}
                            />
                            Game Start
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.notifications.gameEnd}
                                onChange={(e) => handleSettingChange('notifications', 'gameEnd', e.target.checked)}
                            />
                            Game End
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.notifications.achievements}
                                onChange={(e) => handleSettingChange('notifications', 'achievements', e.target.checked)}
                            />
                            Achievements
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.notifications.updates}
                                onChange={(e) => handleSettingChange('notifications', 'updates', e.target.checked)}
                            />
                            Updates
                        </label>
                    </div>
                </div>

                {/* Performance */}
                <div className="settings-section">
                    <h3>⚡ Performance</h3>
                    <div className="setting-group">
                        <label>
                            Max FPS: {settings.performance.maxFPS}
                            <input
                                type="range"
                                min="30"
                                max="120"
                                step="30"
                                value={settings.performance.maxFPS}
                                onChange={(e) => handleSettingChange('performance', 'maxFPS', parseInt(e.target.value))}
                            />
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.performance.enableParticles}
                                onChange={(e) => handleSettingChange('performance', 'enableParticles', e.target.checked)}
                            />
                            Enable Particle Effects
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.performance.enableShadows}
                                onChange={(e) => handleSettingChange('performance', 'enableShadows', e.target.checked)}
                            />
                            Enable Shadows
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="settings-actions">
                    <button
                        className="btn-primary"
                        onClick={saveSettings}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : '💾 Save Settings'}
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
        </div>
    );
};

export default UserSettings; 