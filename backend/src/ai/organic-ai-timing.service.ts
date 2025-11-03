import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AITimingConfig {
  baseThinkingTime: number;      // Base time for AI to "think"
  variabilityRange: number;      // Random variation (+/-)
  difficultyMultiplier: number;  // Multiply time based on difficulty
  moveComplexityBonus: number;   // Extra time for complex board states
  firstMoveDelay: number;        // Initial move takes longer
  criticalMoveDelay: number;     // Blocking wins takes longer
}

export interface AITimingEvent {
  phase: 'analyzing' | 'evaluating' | 'deciding' | 'moving';
  progress: number; // 0-100
  estimatedTimeRemaining: number;
  message?: string;
}

@Injectable()
export class OrganicAITimingService {
  private readonly logger = new Logger(OrganicAITimingService.name);
  
  // Natural timing configurations for different scenarios
  private readonly timingProfiles = {
    quick: {
      baseThinkingTime: 800,
      variabilityRange: 400,
      difficultyMultiplier: 1.0,
      moveComplexityBonus: 200,
      firstMoveDelay: 1200,
      criticalMoveDelay: 600,
    },
    balanced: {
      baseThinkingTime: 1500,
      variabilityRange: 500,
      difficultyMultiplier: 1.2,
      moveComplexityBonus: 400,
      firstMoveDelay: 2000,
      criticalMoveDelay: 800,
    },
    thoughtful: {
      baseThinkingTime: 2500,
      variabilityRange: 700,
      difficultyMultiplier: 1.5,
      moveComplexityBonus: 600,
      firstMoveDelay: 3000,
      criticalMoveDelay: 1000,
    },
  };
  
  constructor(private readonly eventEmitter?: EventEmitter2) {}
  
  /**
   * Calculate organic thinking time based on game state
   */
  calculateThinkingTime(
    moveNumber: number,
    difficulty: number,
    boardComplexity: number,
    isCriticalMove: boolean,
    profile: 'quick' | 'balanced' | 'thoughtful' = 'balanced'
  ): number {
    const config = this.timingProfiles[profile];
    
    // Base thinking time
    let thinkingTime = config.baseThinkingTime;
    
    // Add natural variability
    const variability = (Math.random() - 0.5) * 2 * config.variabilityRange;
    thinkingTime += variability;
    
    // First move takes longer (AI is "studying" the board)
    if (moveNumber === 1) {
      thinkingTime = config.firstMoveDelay;
    }
    
    // Critical moves (blocking wins) take a bit longer
    if (isCriticalMove) {
      thinkingTime += config.criticalMoveDelay;
    }
    
    // Complex board states take longer
    thinkingTime += boardComplexity * config.moveComplexityBonus;
    
    // Difficulty affects thinking time slightly
    const difficultyFactor = 1 + (difficulty - 5) * 0.1;
    thinkingTime *= difficultyFactor * config.difficultyMultiplier;
    
    // Ensure reasonable bounds
    thinkingTime = Math.max(500, Math.min(4000, thinkingTime));
    
    // Add slight acceleration as game progresses (AI gets "warmed up")
    if (moveNumber > 10) {
      thinkingTime *= 0.9;
    }
    
    return Math.round(thinkingTime);
  }
  
  /**
   * Simulate natural thinking progression with throttled updates
   */
  async simulateThinking(
    totalTime: number,
    gameId: string,
    onProgress?: (event: AITimingEvent) => void
  ): Promise<void> {
    const phases: Array<{ phase: AITimingEvent['phase']; duration: number; message: string }> = [
      { phase: 'analyzing', duration: 0.3, message: 'Analyzing board state...' },
      { phase: 'evaluating', duration: 0.4, message: 'Evaluating possible moves...' },
      { phase: 'deciding', duration: 0.2, message: 'Selecting best move...' },
      { phase: 'moving', duration: 0.1, message: 'Executing move...' },
    ];
    
    let elapsedTime = 0;
    const UPDATE_INTERVAL = 500; // Update every 500ms to reduce frequency
    const MAX_UPDATES_PER_PHASE = 2; // Maximum 2 updates per phase to reduce spam
    
    for (const phaseInfo of phases) {
      const phaseDuration = totalTime * phaseInfo.duration;
      const steps = Math.min(
        MAX_UPDATES_PER_PHASE,
        Math.ceil(phaseDuration / UPDATE_INTERVAL)
      );
      
      // Only emit updates if phase is long enough
      if (phaseDuration < 300) { // Increased from 100ms to 300ms
        elapsedTime += phaseDuration;
        continue;
      }
      
      for (let i = 0; i <= steps; i++) {
        const overallProgress = (elapsedTime / totalTime) * 100;
        
        const event: AITimingEvent = {
          phase: phaseInfo.phase,
          progress: Math.min(100, Math.round(overallProgress)),
          estimatedTimeRemaining: Math.max(0, totalTime - elapsedTime),
          message: phaseInfo.message,
        };
        
        // Emit progress event with throttling - only emit first and last update of each phase
        if (this.eventEmitter && (i === 0 || i === steps)) {
          this.eventEmitter.emit('ai.thinking.progress', {
            gameId,
            ...event,
          });
        }
        
        // Call callback if provided (less frequently)
        if (onProgress && (i === 0 || i === steps)) {
          onProgress(event);
        }
        
        // Wait for next update
        if (i < steps) {
          const waitTime = phaseDuration / steps;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          elapsedTime += waitTime;
        }
      }
    }
    
    // Final progress update
    if (this.eventEmitter) {
      this.eventEmitter.emit('ai.thinking.progress', {
        gameId,
        phase: 'moving',
        progress: 100,
        estimatedTimeRemaining: 0,
        message: 'Executing move...',
      });
    }
  }
  
  /**
   * Calculate board complexity for timing adjustments
   */
  calculateBoardComplexity(board: any[][]): number {
    let complexity = 0;
    
    // Count pieces on board
    let pieces = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell !== 'Empty') pieces++;
      }
    }
    
    // Complexity increases with pieces but plateaus
    complexity = Math.min(pieces / 20, 1.0);
    
    // Check for potential threats (simplified)
    if (pieces > 6) {
      complexity += 0.2;
    }
    
    // Middle game is most complex
    if (pieces > 10 && pieces < 30) {
      complexity += 0.3;
    }
    
    return Math.min(complexity, 1.0);
  }
  
  /**
   * Ensure consistent timing regardless of actual computation time
   */
  async ensureMinimumThinkingTime(
    startTime: number,
    minimumTime: number,
    actualComputationTime?: number
  ): Promise<void> {
    const elapsed = Date.now() - startTime;
    const remaining = minimumTime - elapsed;
    
    if (remaining > 0) {
      this.logger.debug(
        `AI computed in ${actualComputationTime || elapsed}ms, waiting ${remaining}ms for natural timing`
      );
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
  }
  
  /**
   * Get timing profile based on game mode or settings
   */
  getTimingProfile(settings?: { fastMode?: boolean; difficulty?: number }): 'quick' | 'balanced' | 'thoughtful' {
    if (settings?.fastMode) {
      return 'quick';
    }
    
    if (settings?.difficulty && settings.difficulty >= 8) {
      return 'thoughtful';
    }
    
    return 'balanced';
  }
}