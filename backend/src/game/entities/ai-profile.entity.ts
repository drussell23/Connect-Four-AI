import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AIPersonality, PlayerPattern, AIMemory } from '../ai-profile.service';

@Entity('ai_profiles')
export class AIProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    playerId: string;

    @Column({ default: 1 })
    level: number;

    @Column({ default: 0 })
    experience: number;

    @Column({ default: 0 })
    totalGamesPlayed: number;

    @Column({ default: 0 })
    totalWins: number;

    @Column({ default: 0 })
    totalLosses: number;

    @Column({ default: 0 })
    currentStreak: number;

    @Column({ default: 0 })
    maxStreak: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    lastUpdated: Date;

    // Enhanced features stored as JSON
    @Column('json')
    personality: AIPersonality;

    @Column('json')
    playerPatterns: PlayerPattern;

    @Column('json')
    aiMemories: AIMemory[];

    @Column('json')
    achievements: string[];

    @Column({ default: 'Awakening' })
    evolutionStage: string;

    @Column({ default: 'generalist' })
    specializationPath: string;

    @Column('float', { default: 1.0 })
    adaptationRate: number;

    @Column('json')
    recentPerformance: number[];

    // Dynamic settings
    @Column({ default: 1000 })
    currentThinkingTime: number;

    @Column({ default: 'minimax' })
    currentAlgorithm: string;

    @Column({ default: 4 })
    currentDepth: number;

    @Column('float', { default: 0.3 })
    aggressionLevel: number;

    @Column('float', { default: 0.7 })
    defensivenessLevel: number;

    // Seasonal/Event data
    @Column('json')
    seasonalBonuses: Record<string, number>;

    @Column({ nullable: true })
    eventMode: string;

    @Column('json')
    specialAbilities: string[];
} 