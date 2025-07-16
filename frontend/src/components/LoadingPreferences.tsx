import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserPreferences {
    theme: 'cyber' | 'neural' | 'quantum' | 'matrix' | 'organic' | 'minimal' | 'retro' | 'neon';
    soundEnabled: boolean;
    animationSpeed: number;
    particleCount: number;
    showMetrics: boolean;
    autoStart: boolean;
    language: string;
    accessibility: {
        reducedMotion: boolean;
        highContrast: boolean;
        largeText: boolean;
        screenReader: boolean;
    };
}

interface LoadingPreferencesProps {
    isOpen: boolean;
    onClose: () => void;
    preferences: UserPreferences;
    onPreferencesChange: (preferences: UserPreferences) => void;
}

const LoadingPreferences: React.FC<LoadingPreferencesProps> = ({
    isOpen,
    onClose,
    preferences,
    onPreferencesChange
}) => {
    const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences);

    useEffect(() => {
        setLocalPreferences(preferences);
    }, [preferences]);

    const handleSave = () => {
        onPreferencesChange(localPreferences);
        onClose();
    };

    const themes = [
        { key: 'cyber', name: 'Cyberpunk', color: '#00f5ff', description: 'Futuristic neon aesthetics' },
        { key: 'neural', name: 'Neural Network', color: '#ff006e', description: 'Brain-inspired visuals' },
        { key: 'quantum', name: 'Quantum Field', color: '#06ffa5', description: 'Quantum physics inspired' },
        { key: 'matrix', name: 'Matrix Code', color: '#00ff00', description: 'Digital rain effects' },
        { key: 'organic', name: 'Bio-Neural', color: '#ff6b35', description: 'Natural organic patterns' },
        { key: 'minimal', name: 'Minimal Design', color: '#ffffff', description: 'Clean and simple' },
        { key: 'retro', name: 'Retro Wave', color: '#ff0080', description: '80s synthwave vibes' },
        { key: 'neon', name: 'Neon Glow', color: '#ff073a', description: 'Bright neon colors' }
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.8, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 50 }}
                    className="bg-gray-900/90 backdrop-blur-lg rounded-2xl p-6 max-w-2xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Loading System Preferences</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Theme Selection */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-3">Visual Theme</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {themes.map((theme) => (
                                    <motion.button
                                        key={theme.key}
                                        onClick={() => setLocalPreferences(prev => ({ ...prev, theme: theme.key as any }))}
                                        className={`p-4 rounded-xl border-2 transition-all ${localPreferences.theme === theme.key
                                                ? 'border-white bg-white/10'
                                                : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
                                            }`}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className="w-6 h-6 rounded-full border-2 border-white/30"
                                                style={{ backgroundColor: theme.color }}
                                            />
                                            <div className="text-left">
                                                <div className="text-white font-medium">{theme.name}</div>
                                                <div className="text-gray-400 text-sm">{theme.description}</div>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Audio Settings */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-3">Audio & Effects</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-white">Sound Effects</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.soundEnabled ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.soundEnabled ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white">Animation Speed</span>
                                        <span className="text-blue-300">{localPreferences.animationSpeed}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={localPreferences.animationSpeed}
                                        onChange={(e) => setLocalPreferences(prev => ({ ...prev, animationSpeed: parseFloat(e.target.value) }))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white">Particle Count</span>
                                        <span className="text-blue-300">{localPreferences.particleCount}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={localPreferences.particleCount}
                                        onChange={(e) => setLocalPreferences(prev => ({ ...prev, particleCount: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* System Settings */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-3">System Display</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white">Show System Metrics</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({ ...prev, showMetrics: !prev.showMetrics }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.showMetrics ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.showMetrics ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-white">Auto-start Loading</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({ ...prev, autoStart: !prev.autoStart }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.autoStart ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.autoStart ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Accessibility Settings */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-3">Accessibility</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white">Reduced Motion</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({
                                            ...prev,
                                            accessibility: { ...prev.accessibility, reducedMotion: !prev.accessibility.reducedMotion }
                                        }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.accessibility.reducedMotion ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.accessibility.reducedMotion ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-white">High Contrast</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({
                                            ...prev,
                                            accessibility: { ...prev.accessibility, highContrast: !prev.accessibility.highContrast }
                                        }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.accessibility.highContrast ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.accessibility.highContrast ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-white">Large Text</span>
                                    <button
                                        onClick={() => setLocalPreferences(prev => ({
                                            ...prev,
                                            accessibility: { ...prev.accessibility, largeText: !prev.accessibility.largeText }
                                        }))}
                                        className={`w-12 h-6 rounded-full transition-colors ${localPreferences.accessibility.largeText ? 'bg-blue-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${localPreferences.accessibility.largeText ? 'translate-x-7' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-3 mt-8 pt-4 border-t border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <motion.button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Save Preferences
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LoadingPreferences; 