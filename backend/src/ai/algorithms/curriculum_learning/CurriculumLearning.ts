// backend/src/ai/algorithms/curriculum_learning/CurriculumLearning.ts
import { CellValue } from '../../connect4AI';

export interface CurriculumStage {
    name: string;
    description: string;
    level: number;
    prerequisites: string[];
    objectives: LearningObjective[];
    difficultyRange: [number, number];
    estimatedDuration: number;
    successCriteria: SuccessCriteria;
    adaptationRules: AdaptationRule[];
}

export interface LearningObjective {
    id: string;
    description: string;
    type: 'tactical' | 'strategic' | 'pattern_recognition' | 'endgame' | 'opening' | 'creativity';
    targetSkill: number;
    weight: number;
    measurement: (performance: PerformanceMetrics) => number;
}

export interface SuccessCriteria {
    winRate: number;
    consistencyScore: number;
    skillImprovement: number;
    objectiveCompletion: number;
    minGamesPlayed: number;
    stabilityPeriod: number; // Games to maintain performance
}

export interface AdaptationRule {
    condition: string;
    action: 'increase_difficulty' | 'decrease_difficulty' | 'change_focus' | 'provide_hint' | 'review_concepts';
    parameters: { [key: string]: any };
    priority: number;
}

export interface PerformanceMetrics {
    winRate: number;
    averageGameLength: number;
    averageMoveTime: number;
    mistakeRate: number;
    improvementRate: number;
    consistencyScore: number;
    objectiveScores: { [objectiveId: string]: number };
    skillLevel: number;
    emotionalState: 'engaged' | 'frustrated' | 'bored' | 'confident' | 'challenged';
}

export interface CurriculumState {
    currentStage: string;
    stageProgress: number;
    completedStages: string[];
    skillLevel: number;
    learningRate: number;
    adaptationHistory: AdaptationEvent[];
    performanceHistory: PerformanceMetrics[];
    personalizedPath: string[];
    lastUpdate: number;
}

export interface AdaptationEvent {
    timestamp: number;
    stage: string;
    trigger: string;
    action: string;
    parameters: any;
    outcome: 'successful' | 'unsuccessful' | 'neutral';
}

export interface LearningPath {
    id: string;
    name: string;
    description: string;
    targetAudience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    stages: string[];
    estimatedTime: number;
    personalizedAdaptations: boolean;
}

/**
 * Advanced Curriculum Learning System
 * 
 * Features:
 * - Adaptive difficulty progression
 * - Personalized learning paths
 * - Multi-objective skill development
 * - Real-time performance monitoring
 * - Intelligent adaptation rules
 * - Emotional state awareness
 * - Concept mastery tracking
 * - Progressive challenge scaling
 */
export class CurriculumLearning {
    private stages: Map<string, CurriculumStage> = new Map();
    private learningPaths: Map<string, LearningPath> = new Map();
    private playerStates: Map<string, CurriculumState> = new Map();
    private globalMetrics: Map<string, any> = new Map();

    constructor() {
        this.initializeCurriculumStages();
        this.initializeLearningPaths();
    }

    /**
     * Get appropriate curriculum stage for player
     */
    getCurrentStage(playerId: string): CurriculumStage {
        const state = this.getPlayerState(playerId);
        return this.stages.get(state.currentStage) || this.stages.get('basic_tactics')!;
    }

    /**
     * Adapt curriculum based on player performance
     */
    adaptCurriculum(
        playerId: string,
        performance: PerformanceMetrics,
        gameData: any
    ): {
        newStage?: string;
        adaptations: string[];
        recommendations: string[];
        nextObjectives: string[];
    } {
        const state = this.getPlayerState(playerId);
        const currentStage = this.stages.get(state.currentStage)!;
        const adaptations: string[] = [];
        const recommendations: string[] = [];
        const nextObjectives: string[] = [];

        // Update performance history
        state.performanceHistory.push(performance);
        if (state.performanceHistory.length > 100) {
            state.performanceHistory = state.performanceHistory.slice(-100);
        }

        // Check adaptation rules
        const triggeredRules = this.evaluateAdaptationRules(currentStage, performance, state);

        for (const rule of triggeredRules) {
            const adaptation = this.applyAdaptationRule(rule, state, performance);
            adaptations.push(adaptation.description);

            // Record adaptation event
            state.adaptationHistory.push({
                timestamp: Date.now(),
                stage: state.currentStage,
                trigger: rule.condition,
                action: rule.action,
                parameters: rule.parameters,
                outcome: 'successful' // Will be updated based on results
            });
        }

        // Check stage progression
        const progressionResult = this.checkStageProgression(state, performance, currentStage);

        if (progressionResult.canProgress) {
            const nextStage = this.getNextStage(state, performance);
            if (nextStage) {
                state.currentStage = nextStage.name;
                state.stageProgress = 0;
                state.completedStages.push(currentStage.name);
                adaptations.push(`Advanced to ${nextStage.name}`);
                nextObjectives.push(...nextStage.objectives.map(o => o.description));
            }
        }

        // Generate recommendations
        recommendations.push(...this.generateRecommendations(state, performance, currentStage));

        // Update player state
        state.lastUpdate = Date.now();
        this.playerStates.set(playerId, state);

        return {
            newStage: state.currentStage !== currentStage.name ? state.currentStage : undefined,
            adaptations,
            recommendations,
            nextObjectives
        };
    }

    /**
     * Get personalized learning path
     */
    getPersonalizedPath(
        playerId: string,
        skillLevel: number,
        preferences: any
    ): LearningPath {
        const state = this.getPlayerState(playerId);

        // Select base path based on skill level
        let basePath: LearningPath;
        if (skillLevel < 0.3) {
            basePath = this.learningPaths.get('beginner_path')!;
        } else if (skillLevel < 0.6) {
            basePath = this.learningPaths.get('intermediate_path')!;
        } else if (skillLevel < 0.8) {
            basePath = this.learningPaths.get('advanced_path')!;
        } else {
            basePath = this.learningPaths.get('expert_path')!;
        }

        // Personalize based on preferences and performance
        const personalizedPath = this.personalizeLearningPath(basePath, state, preferences);

        return personalizedPath;
    }

    /**
     * Initialize curriculum stages
     */
    private initializeCurriculumStages(): void {
        const stages: CurriculumStage[] = [
            {
                name: 'basic_tactics',
                description: 'Learn fundamental Connect Four tactics',
                level: 1,
                prerequisites: [],
                objectives: [
                    {
                        id: 'recognize_four_in_row',
                        description: 'Recognize winning opportunities',
                        type: 'tactical',
                        targetSkill: 0.7,
                        weight: 0.4,
                        measurement: (perf) => perf.objectiveScores['recognize_four_in_row'] || 0
                    },
                    {
                        id: 'block_opponent_wins',
                        description: 'Block opponent winning moves',
                        type: 'tactical',
                        targetSkill: 0.8,
                        weight: 0.6,
                        measurement: (perf) => perf.objectiveScores['block_opponent_wins'] || 0
                    }
                ],
                difficultyRange: [0.1, 0.3],
                estimatedDuration: 10,
                successCriteria: {
                    winRate: 0.4,
                    consistencyScore: 0.6,
                    skillImprovement: 0.1,
                    objectiveCompletion: 0.7,
                    minGamesPlayed: 5,
                    stabilityPeriod: 3
                },
                adaptationRules: [
                    {
                        condition: 'winRate < 0.2',
                        action: 'decrease_difficulty',
                        parameters: { amount: 0.1 },
                        priority: 1
                    },
                    {
                        condition: 'winRate > 0.6',
                        action: 'increase_difficulty',
                        parameters: { amount: 0.1 },
                        priority: 2
                    }
                ]
            },
            {
                name: 'strategic_thinking',
                description: 'Develop strategic planning skills',
                level: 2,
                prerequisites: ['basic_tactics'],
                objectives: [
                    {
                        id: 'center_control',
                        description: 'Control center columns effectively',
                        type: 'strategic',
                        targetSkill: 0.6,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['center_control'] || 0
                    },
                    {
                        id: 'threat_creation',
                        description: 'Create multiple threats',
                        type: 'strategic',
                        targetSkill: 0.7,
                        weight: 0.4,
                        measurement: (perf) => perf.objectiveScores['threat_creation'] || 0
                    },
                    {
                        id: 'tempo_management',
                        description: 'Manage game tempo',
                        type: 'strategic',
                        targetSkill: 0.5,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['tempo_management'] || 0
                    }
                ],
                difficultyRange: [0.3, 0.5],
                estimatedDuration: 15,
                successCriteria: {
                    winRate: 0.5,
                    consistencyScore: 0.7,
                    skillImprovement: 0.15,
                    objectiveCompletion: 0.8,
                    minGamesPlayed: 8,
                    stabilityPeriod: 4
                },
                adaptationRules: [
                    {
                        condition: 'emotionalState === "frustrated"',
                        action: 'provide_hint',
                        parameters: { type: 'strategic' },
                        priority: 1
                    },
                    {
                        condition: 'improvementRate < 0.05',
                        action: 'review_concepts',
                        parameters: { focus: 'strategic_thinking' },
                        priority: 2
                    }
                ]
            },
            {
                name: 'pattern_mastery',
                description: 'Master advanced patterns and combinations',
                level: 3,
                prerequisites: ['strategic_thinking'],
                objectives: [
                    {
                        id: 'pattern_recognition',
                        description: 'Recognize complex patterns',
                        type: 'pattern_recognition',
                        targetSkill: 0.8,
                        weight: 0.4,
                        measurement: (perf) => perf.objectiveScores['pattern_recognition'] || 0
                    },
                    {
                        id: 'combination_play',
                        description: 'Execute tactical combinations',
                        type: 'tactical',
                        targetSkill: 0.7,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['combination_play'] || 0
                    },
                    {
                        id: 'positional_understanding',
                        description: 'Understand positional concepts',
                        type: 'strategic',
                        targetSkill: 0.6,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['positional_understanding'] || 0
                    }
                ],
                difficultyRange: [0.5, 0.7],
                estimatedDuration: 20,
                successCriteria: {
                    winRate: 0.6,
                    consistencyScore: 0.8,
                    skillImprovement: 0.2,
                    objectiveCompletion: 0.85,
                    minGamesPlayed: 12,
                    stabilityPeriod: 5
                },
                adaptationRules: [
                    {
                        condition: 'consistencyScore < 0.6',
                        action: 'change_focus',
                        parameters: { newFocus: 'consistency_training' },
                        priority: 1
                    }
                ]
            },
            {
                name: 'advanced_mastery',
                description: 'Achieve advanced Connect Four mastery',
                level: 4,
                prerequisites: ['pattern_mastery'],
                objectives: [
                    {
                        id: 'endgame_precision',
                        description: 'Master endgame techniques',
                        type: 'endgame',
                        targetSkill: 0.9,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['endgame_precision'] || 0
                    },
                    {
                        id: 'creative_solutions',
                        description: 'Find creative solutions',
                        type: 'creativity',
                        targetSkill: 0.7,
                        weight: 0.2,
                        measurement: (perf) => perf.objectiveScores['creative_solutions'] || 0
                    },
                    {
                        id: 'opening_theory',
                        description: 'Master opening principles',
                        type: 'opening',
                        targetSkill: 0.8,
                        weight: 0.3,
                        measurement: (perf) => perf.objectiveScores['opening_theory'] || 0
                    },
                    {
                        id: 'psychological_play',
                        description: 'Use psychological elements',
                        type: 'strategic',
                        targetSkill: 0.6,
                        weight: 0.2,
                        measurement: (perf) => perf.objectiveScores['psychological_play'] || 0
                    }
                ],
                difficultyRange: [0.7, 0.9],
                estimatedDuration: 30,
                successCriteria: {
                    winRate: 0.7,
                    consistencyScore: 0.9,
                    skillImprovement: 0.25,
                    objectiveCompletion: 0.9,
                    minGamesPlayed: 15,
                    stabilityPeriod: 6
                },
                adaptationRules: [
                    {
                        condition: 'skillLevel > 0.8',
                        action: 'increase_difficulty',
                        parameters: { amount: 0.05 },
                        priority: 1
                    }
                ]
            }
        ];

        stages.forEach(stage => {
            this.stages.set(stage.name, stage);
        });
    }

    /**
     * Initialize learning paths
     */
    private initializeLearningPaths(): void {
        const paths: LearningPath[] = [
            {
                id: 'beginner_path',
                name: 'Beginner Journey',
                description: 'Complete beginner to intermediate player',
                targetAudience: 'beginner',
                stages: ['basic_tactics', 'strategic_thinking'],
                estimatedTime: 25,
                personalizedAdaptations: true
            },
            {
                id: 'intermediate_path',
                name: 'Intermediate Development',
                description: 'Intermediate to advanced player',
                targetAudience: 'intermediate',
                stages: ['strategic_thinking', 'pattern_mastery'],
                estimatedTime: 35,
                personalizedAdaptations: true
            },
            {
                id: 'advanced_path',
                name: 'Advanced Mastery',
                description: 'Advanced to expert level',
                targetAudience: 'advanced',
                stages: ['pattern_mastery', 'advanced_mastery'],
                estimatedTime: 50,
                personalizedAdaptations: true
            },
            {
                id: 'expert_path',
                name: 'Expert Refinement',
                description: 'Expert level refinement',
                targetAudience: 'expert',
                stages: ['advanced_mastery'],
                estimatedTime: 30,
                personalizedAdaptations: true
            }
        ];

        paths.forEach(path => {
            this.learningPaths.set(path.id, path);
        });
    }

    /**
     * Get player state
     */
    private getPlayerState(playerId: string): CurriculumState {
        if (!this.playerStates.has(playerId)) {
            const newState: CurriculumState = {
                currentStage: 'basic_tactics',
                stageProgress: 0,
                completedStages: [],
                skillLevel: 0.1,
                learningRate: 0.1,
                adaptationHistory: [],
                performanceHistory: [],
                personalizedPath: [],
                lastUpdate: Date.now()
            };
            this.playerStates.set(playerId, newState);
        }
        return this.playerStates.get(playerId)!;
    }

    /**
     * Evaluate adaptation rules
     */
    private evaluateAdaptationRules(
        stage: CurriculumStage,
        performance: PerformanceMetrics,
        state: CurriculumState
    ): AdaptationRule[] {
        const triggeredRules: AdaptationRule[] = [];

        for (const rule of stage.adaptationRules) {
            if (this.evaluateCondition(rule.condition, performance, state)) {
                triggeredRules.push(rule);
            }
        }

        return triggeredRules.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Evaluate condition
     */
    private evaluateCondition(
        condition: string,
        performance: PerformanceMetrics,
        state: CurriculumState
    ): boolean {
        // Simple condition evaluation - in real implementation, use proper parser
        try {
            return eval(condition.replace(/(\w+)/g, (match) => {
                if (match in performance) {
                    return `performance.${match}`;
                }
                if (match in state) {
                    return `state.${match}`;
                }
                return match;
            }));
        } catch (e) {
            return false;
        }
    }

    /**
     * Apply adaptation rule
     */
    private applyAdaptationRule(
        rule: AdaptationRule,
        state: CurriculumState,
        performance: PerformanceMetrics
    ): { description: string; parameters: any } {
        let description = '';

        switch (rule.action) {
            case 'increase_difficulty':
                description = `Increased difficulty by ${rule.parameters.amount}`;
                break;
            case 'decrease_difficulty':
                description = `Decreased difficulty by ${rule.parameters.amount}`;
                break;
            case 'change_focus':
                description = `Changed focus to ${rule.parameters.newFocus}`;
                break;
            case 'provide_hint':
                description = `Provided ${rule.parameters.type} hint`;
                break;
            case 'review_concepts':
                description = `Initiated review of ${rule.parameters.focus}`;
                break;
        }

        return { description, parameters: rule.parameters };
    }

    /**
     * Check stage progression
     */
    private checkStageProgression(
        state: CurriculumState,
        performance: PerformanceMetrics,
        stage: CurriculumStage
    ): { canProgress: boolean; reason: string } {
        const criteria = stage.successCriteria;

        // Check all criteria
        const checks = [
            { name: 'winRate', pass: performance.winRate >= criteria.winRate },
            { name: 'consistencyScore', pass: performance.consistencyScore >= criteria.consistencyScore },
            { name: 'skillImprovement', pass: performance.improvementRate >= criteria.skillImprovement },
            { name: 'objectiveCompletion', pass: this.calculateObjectiveCompletion(stage, performance) >= criteria.objectiveCompletion },
            { name: 'minGamesPlayed', pass: state.performanceHistory.length >= criteria.minGamesPlayed }
        ];

        const passedChecks = checks.filter(check => check.pass);
        const canProgress = passedChecks.length === checks.length;

        const reason = canProgress ?
            'All criteria met' :
            `Missing: ${checks.filter(check => !check.pass).map(check => check.name).join(', ')}`;

        return { canProgress, reason };
    }

    /**
     * Calculate objective completion
     */
    private calculateObjectiveCompletion(stage: CurriculumStage, performance: PerformanceMetrics): number {
        const totalWeight = stage.objectives.reduce((sum, obj) => sum + obj.weight, 0);
        const weightedScore = stage.objectives.reduce((sum, obj) => {
            const score = obj.measurement(performance);
            const normalized = Math.min(score / obj.targetSkill, 1.0);
            return sum + (normalized * obj.weight);
        }, 0);

        return weightedScore / totalWeight;
    }

    /**
     * Get next stage
     */
    private getNextStage(state: CurriculumState, performance: PerformanceMetrics): CurriculumStage | null {
        const currentStage = this.stages.get(state.currentStage)!;

        // Find stages that have current stage as prerequisite
        const candidateStages = Array.from(this.stages.values()).filter(stage =>
            stage.prerequisites.includes(currentStage.name) &&
            !state.completedStages.includes(stage.name)
        );

        if (candidateStages.length === 0) return null;

        // Select best matching stage based on skill level
        return candidateStages.reduce((best, stage) => {
            const skillMatch = Math.abs(performance.skillLevel - (stage.difficultyRange[0] + stage.difficultyRange[1]) / 2);
            const bestMatch = Math.abs(performance.skillLevel - (best.difficultyRange[0] + best.difficultyRange[1]) / 2);
            return skillMatch < bestMatch ? stage : best;
        });
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(
        state: CurriculumState,
        performance: PerformanceMetrics,
        stage: CurriculumStage
    ): string[] {
        const recommendations: string[] = [];

        // Analyze weak objectives
        const weakObjectives = stage.objectives.filter(obj => {
            const score = obj.measurement(performance);
            return score / obj.targetSkill < 0.8;
        });

        weakObjectives.forEach(obj => {
            recommendations.push(`Focus on improving: ${obj.description}`);
        });

        // Emotional state recommendations
        switch (performance.emotionalState) {
            case 'frustrated':
                recommendations.push('Take a break and try easier challenges');
                break;
            case 'bored':
                recommendations.push('Try more challenging scenarios');
                break;
            case 'confident':
                recommendations.push('Great progress! Ready for next level');
                break;
        }

        return recommendations;
    }

    /**
     * Personalize learning path
     */
    private personalizeLearningPath(
        basePath: LearningPath,
        state: CurriculumState,
        preferences: any
    ): LearningPath {
        // Create personalized version
        const personalizedPath: LearningPath = {
            ...basePath,
            id: `${basePath.id}_personalized_${Date.now()}`,
            name: `Personalized ${basePath.name}`,
            personalizedAdaptations: true
        };

        // Customize based on preferences and performance
        if (preferences.focusArea) {
            personalizedPath.description += ` with focus on ${preferences.focusArea}`;
        }

        return personalizedPath;
    }

    /**
     * Get curriculum state
     */
    getCurriculumState(playerId: string): CurriculumState {
        return this.getPlayerState(playerId);
    }

    /**
     * Reset curriculum
     */
    resetCurriculum(playerId: string): void {
        this.playerStates.delete(playerId);
    }

    /**
     * Get all available stages
     */
    getAllStages(): CurriculumStage[] {
        return Array.from(this.stages.values());
    }

    /**
     * Get all learning paths
     */
    getAllLearningPaths(): LearningPath[] {
        return Array.from(this.learningPaths.values());
    }
} 