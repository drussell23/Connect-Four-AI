import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AIProfileService {
  private readonly logger = new Logger(AIProfileService.name);
  private aiLevel = 1;

  constructor() {
    this.logger.log('AIProfileService initialized. Current AI Level: 1');
  }

  /**
   * Gets the current level of the AI.
   * @returns The AI's current level.
   */
  getCurrentLevel(): number {
    return this.aiLevel;
  }

  /**
   * Increases the AI's level. This should be called when the human player wins a game.
   */
  levelUp(): void {
    this.aiLevel++;
    this.logger.log(`Human won. AI is adapting. New level: ${this.aiLevel}`);
  }

  /**
   * Resets the AI's level to its initial state.
   */
  reset(): void {
    this.aiLevel = 1;
    this.logger.log('AI level has been reset to 1.');
  }
}
