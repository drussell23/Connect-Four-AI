// backend/src/game/settings.service.ts
import { Injectable } from '@nestjs/common';

export interface UserSettings {
    playerId: string;
    preferences: {
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
    };
    lastUpdated: Date;
    version: string;
}

export interface GameSettings {
    playerId: string;
    gamePreferences: {
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
    };
    lastUpdated: Date;
    version: string;
}

export interface UISettings {
    playerId: string;
    interface: {
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
    };
    lastUpdated: Date;
    version: string;
}

export interface AIPreferences {
    playerId: string;
    aiConfiguration: {
        modelType: 'standard' | 'advanced' | 'experimental' | 'custom';
        algorithm: 'minimax' | 'alphabeta' | 'mcts' | 'neural' | 'hybrid';
        searchDepth: number;
        timeLimit: number;
        evaluationFunction: 'standard' | 'advanced' | 'custom';
    };
    learningPreferences: {
        adaptiveDifficulty: boolean;
        skillTracking: boolean;
        personalizedTraining: boolean;
        progressAnalysis: boolean;
        recommendationEngine: boolean;
    };
    interactionPreferences: {
        moveSuggestions: boolean;
        threatWarnings: boolean;
        strategicHints: boolean;
        postGameAnalysis: boolean;
        learningTips: boolean;
    };
    lastUpdated: Date;
    version: string;
}

@Injectable()
export class SettingsService {
    private userSettings: Map<string, UserSettings> = new Map();
    private gameSettings: Map<string, GameSettings> = new Map();
    private uiSettings: Map<string, UISettings> = new Map();
    private aiPreferences: Map<string, AIPreferences> = new Map();

    constructor() {
        this.initializeDefaultSettings();
    }

    private initializeDefaultSettings(): void {
        // Initialize with some default settings for demo purposes
        const defaultUserSettings: UserSettings = {
            playerId: 'demo-user',
            preferences: {
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
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        const defaultGameSettings: GameSettings = {
            playerId: 'demo-user',
            gamePreferences: {
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
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        const defaultUISettings: UISettings = {
            playerId: 'demo-user',
            interface: {
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
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        const defaultAIPreferences: AIPreferences = {
            playerId: 'demo-user',
            aiConfiguration: {
                modelType: 'standard',
                algorithm: 'hybrid',
                searchDepth: 6,
                timeLimit: 2000,
                evaluationFunction: 'advanced',
            },
            learningPreferences: {
                adaptiveDifficulty: true,
                skillTracking: true,
                personalizedTraining: true,
                progressAnalysis: true,
                recommendationEngine: true,
            },
            interactionPreferences: {
                moveSuggestions: true,
                threatWarnings: true,
                strategicHints: true,
                postGameAnalysis: true,
                learningTips: true,
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        this.userSettings.set('demo-user', defaultUserSettings);
        this.gameSettings.set('demo-user', defaultGameSettings);
        this.uiSettings.set('demo-user', defaultUISettings);
        this.aiPreferences.set('demo-user', defaultAIPreferences);
    }

    async getUserSettings(playerId: string): Promise<UserSettings | null> {
        return this.userSettings.get(playerId) || null;
    }

    async updateUserSettings(playerId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
        const existing = this.userSettings.get(playerId);
        const updated: UserSettings = {
            playerId,
            preferences: {
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
                ...(existing?.preferences || {}),
                ...(settings.preferences || {}),
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        this.userSettings.set(playerId, updated);
        return updated;
    }

    async getGameSettings(playerId: string): Promise<GameSettings | null> {
        return this.gameSettings.get(playerId) || null;
    }

    async updateGameSettings(playerId: string, settings: Partial<GameSettings>): Promise<GameSettings> {
        const existing = this.gameSettings.get(playerId);
        const updated: GameSettings = {
            playerId,
            gamePreferences: {
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
                ...(existing?.gamePreferences || {}),
                ...(settings.gamePreferences || {}),
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        this.gameSettings.set(playerId, updated);
        return updated;
    }

    async getUISettings(playerId: string): Promise<UISettings | null> {
        return this.uiSettings.get(playerId) || null;
    }

    async updateUISettings(playerId: string, settings: Partial<UISettings>): Promise<UISettings> {
        const existing = this.uiSettings.get(playerId);
        const updated: UISettings = {
            playerId,
            interface: {
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
                ...(existing?.interface || {}),
                ...(settings.interface || {}),
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        this.uiSettings.set(playerId, updated);
        return updated;
    }

    async getAIPreferences(playerId: string): Promise<AIPreferences | null> {
        return this.aiPreferences.get(playerId) || null;
    }

    async updateAIPreferences(playerId: string, preferences: Partial<AIPreferences>): Promise<AIPreferences> {
        const existing = this.aiPreferences.get(playerId);
        const updated: AIPreferences = {
            playerId,
            aiConfiguration: {
                modelType: 'standard',
                algorithm: 'hybrid',
                searchDepth: 6,
                timeLimit: 2000,
                evaluationFunction: 'advanced',
                ...(existing?.aiConfiguration || {}),
                ...(preferences.aiConfiguration || {}),
            },
            learningPreferences: {
                adaptiveDifficulty: true,
                skillTracking: true,
                personalizedTraining: true,
                progressAnalysis: true,
                recommendationEngine: true,
                ...(existing?.learningPreferences || {}),
                ...(preferences.learningPreferences || {}),
            },
            interactionPreferences: {
                moveSuggestions: true,
                threatWarnings: true,
                strategicHints: true,
                postGameAnalysis: true,
                learningTips: true,
                ...(existing?.interactionPreferences || {}),
                ...(preferences.interactionPreferences || {}),
            },
            lastUpdated: new Date(),
            version: '1.0.0',
        };

        this.aiPreferences.set(playerId, updated);
        return updated;
    }

    async resetSettings(playerId: string, type: 'user' | 'game' | 'ui' | 'ai' | 'all'): Promise<void> {
        if (type === 'all' || type === 'user') {
            this.userSettings.delete(playerId);
        }
        if (type === 'all' || type === 'game') {
            this.gameSettings.delete(playerId);
        }
        if (type === 'all' || type === 'ui') {
            this.uiSettings.delete(playerId);
        }
        if (type === 'all' || type === 'ai') {
            this.aiPreferences.delete(playerId);
        }
    }

    async exportSettings(playerId: string, format: 'json' | 'xml'): Promise<string> {
        const [user, game, ui, ai] = await Promise.all([
            this.getUserSettings(playerId),
            this.getGameSettings(playerId),
            this.getUISettings(playerId),
            this.getAIPreferences(playerId),
        ]);

        const allSettings = {
            user,
            game,
            ui,
            ai,
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        if (format === 'json') {
            return JSON.stringify(allSettings, null, 2);
        } else {
            // Simple XML export
            return `<?xml version="1.0" encoding="UTF-8"?>
<settings>
  <exportedAt>${allSettings.exportedAt}</exportedAt>
  <version>${allSettings.version}</version>
  <userSettings>${JSON.stringify(user)}</userSettings>
  <gameSettings>${JSON.stringify(game)}</gameSettings>
  <uiSettings>${JSON.stringify(ui)}</uiSettings>
  <aiPreferences>${JSON.stringify(ai)}</aiPreferences>
</settings>`;
        }
    }

    async importSettings(playerId: string, data: string, format: 'json' | 'xml'): Promise<void> {
        let parsedData: any;

        if (format === 'json') {
            parsedData = JSON.parse(data);
        } else {
            // Simple XML parsing
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            parsedData = {
                user: JSON.parse(xmlDoc.querySelector('userSettings')?.textContent || '{}'),
                game: JSON.parse(xmlDoc.querySelector('gameSettings')?.textContent || '{}'),
                ui: JSON.parse(xmlDoc.querySelector('uiSettings')?.textContent || '{}'),
                ai: JSON.parse(xmlDoc.querySelector('aiPreferences')?.textContent || '{}'),
            };
        }

        if (parsedData.user) {
            await this.updateUserSettings(playerId, parsedData.user);
        }
        if (parsedData.game) {
            await this.updateGameSettings(playerId, parsedData.game);
        }
        if (parsedData.ui) {
            await this.updateUISettings(playerId, parsedData.ui);
        }
        if (parsedData.ai) {
            await this.updateAIPreferences(playerId, parsedData.ai);
        }
    }
} 