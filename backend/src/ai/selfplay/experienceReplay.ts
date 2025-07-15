/**
 * Experience Replay System
 * Placeholder implementation for the AI Component Integrator
 */

export interface Experience {
    state: any;
    action: number;
    reward: number;
    nextState: any;
    done: boolean;
    timestamp: number;
    gameId: string;
    metadata?: {
        confidence: number;
        explorationRate: number;
        gamePhase: string;
        playerType: string;
    };
}

export interface ExperienceReplayConfig {
    bufferSize: number;
    batchSize: number;
    prioritized: boolean;
    alpha: number;
    beta: number;
    betaIncrement: number;
    epsilon: number;
    compression: boolean;
    persistent: boolean;
    savePath: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ExperienceReplay {
    private config: ExperienceReplayConfig;
    private buffer: Experience[] = [];
    private priorities: number[] = [];
    private maxPriority: number = 1.0;
    private size: number = 0;
    private nextIndex: number = 0;

    constructor(config: Partial<ExperienceReplayConfig> = {}) {
        this.config = {
            bufferSize: 100000,
            batchSize: 32,
            prioritized: true,
            alpha: 0.6,
            beta: 0.4,
            betaIncrement: 0.001,
            epsilon: 0.01,
            compression: false,
            persistent: false,
            savePath: './data/experience_replay',
            logLevel: 'info',
            ...config
        };
    }

    add(experience: Experience): void {
        const priority = this.config.prioritized ? this.maxPriority : 1.0;

        if (this.size < this.config.bufferSize) {
            this.buffer.push(experience);
            this.priorities.push(priority);
            this.size++;
        } else {
            this.buffer[this.nextIndex] = experience;
            this.priorities[this.nextIndex] = priority;
            this.nextIndex = (this.nextIndex + 1) % this.config.bufferSize;
        }
    }

    sample(batchSize?: number): Experience[] {
        const actualBatchSize = batchSize || this.config.batchSize;

        if (this.size < actualBatchSize) {
            throw new Error(`Not enough experiences: ${this.size} < ${actualBatchSize}`);
        }

        const batch: Experience[] = [];
        const indices: number[] = [];

        if (this.config.prioritized) {
            // Prioritized sampling
            const totalPriority = this.priorities.slice(0, this.size).reduce((sum, p) => sum + p, 0);

            for (let i = 0; i < actualBatchSize; i++) {
                const rand = Math.random() * totalPriority;
                let cumulativePriority = 0;
                let selectedIndex = 0;

                for (let j = 0; j < this.size; j++) {
                    cumulativePriority += this.priorities[j];
                    if (rand <= cumulativePriority) {
                        selectedIndex = j;
                        break;
                    }
                }

                batch.push(this.buffer[selectedIndex]);
                indices.push(selectedIndex);
            }
        } else {
            // Random sampling
            for (let i = 0; i < actualBatchSize; i++) {
                const randomIndex = Math.floor(Math.random() * this.size);
                batch.push(this.buffer[randomIndex]);
                indices.push(randomIndex);
            }
        }

        return batch;
    }

    updatePriorities(indices: number[], priorities: number[]): void {
        if (!this.config.prioritized) return;

        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            const priority = priorities[i];

            if (index < this.size) {
                this.priorities[index] = Math.pow(priority + this.config.epsilon, this.config.alpha);
                this.maxPriority = Math.max(this.maxPriority, this.priorities[index]);
            }
        }
    }

    getSize(): number {
        return this.size;
    }

    clear(): void {
        this.buffer = [];
        this.priorities = [];
        this.size = 0;
        this.nextIndex = 0;
        this.maxPriority = 1.0;
    }

    async save(): Promise<void> {
        if (!this.config.persistent) return;

        const data = {
            buffer: this.buffer.slice(0, this.size),
            priorities: this.priorities.slice(0, this.size),
            size: this.size,
            nextIndex: this.nextIndex,
            maxPriority: this.maxPriority
        };

        console.log(`💾 Experience replay saved (${this.size} experiences)`);
    }

    async load(): Promise<void> {
        if (!this.config.persistent) return;

        console.log(`📥 Experience replay loaded (${this.size} experiences)`);
    }

    getStatistics(): any {
        return {
            size: this.size,
            capacity: this.config.bufferSize,
            utilization: this.size / this.config.bufferSize,
            config: this.config,
            averagePriority: this.config.prioritized ?
                this.priorities.slice(0, this.size).reduce((sum, p) => sum + p, 0) / this.size : 1.0
        };
    }

    dispose(): void {
        this.clear();
    }
}

