import React, { useState, useEffect } from 'react';
import settingsAPI, { UserSettings as APIUserSettings } from '../../api/settings';
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

interface UserSettingsProps {
    playerId: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ playerId }) => {
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
            const userSettingsData: Partial<APIUserSettings> = {
                preferences: settings
            };
            await settingsAPI.updateUserSettings(playerId, userSettingsData);
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
            await settingsAPI.resetSettings(playerId, 'user');
            // Reload settings after reset
            await loadSettings();
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
            if (importedData.preferences) {
                setSettings(importedData.preferences);
            }
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
                </div>

                {/* Notifications */}
                <div className="settings-section">
                    <h3>🔔 Notifications</h3>
                    <div className="setting-group">
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
                </div>

                {/* Privacy */}
                <div className="settings-section">
                    <h3>🔒 Privacy</h3>
                    <div className="setting-group">
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