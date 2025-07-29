import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ReinforcementLearningService } from './reinforcement-learning.service';

@Controller('api/ai/learning')
export class LearningController {
  private readonly logger = new Logger(LearningController.name);

  constructor(
    private readonly learningService: ReinforcementLearningService,
  ) {}

  /**
   * Get current learning statistics
   */
  @Get('stats')
  async getLearningStats() {
    this.logger.log('Fetching learning statistics');
    const stats = this.learningService.getLearningStats();
    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export detailed learning data for analysis
   */
  @Get('export')
  async exportLearningData() {
    this.logger.log('Exporting learning data');
    const data = await this.learningService.exportLearningData();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually record a game outcome for learning
   */
  @Post('record-game')
  async recordGameOutcome(@Body() gameData: any) {
    this.logger.log(`Recording game outcome: ${gameData.gameId}`);
    try {
      await this.learningService.recordGameOutcome(gameData);
      return {
        success: true,
        message: 'Game outcome recorded for learning',
        gameId: gameData.gameId,
      };
    } catch (error) {
      this.logger.error('Failed to record game outcome:', error);
      return {
        success: false,
        error: 'Failed to record game outcome',
      };
    }
  }

  /**
   * Get position evaluation for a specific board state
   */
  @Post('evaluate-position')
  async evaluatePosition(@Body() data: { board: any[][], difficulty: number }) {
    const evaluation = this.learningService.getPositionEvaluation(
      data.board,
      data.difficulty
    );
    
    return {
      success: true,
      evaluation,
      hasLearned: evaluation !== null,
      timestamp: new Date().toISOString(),
    };
  }
}