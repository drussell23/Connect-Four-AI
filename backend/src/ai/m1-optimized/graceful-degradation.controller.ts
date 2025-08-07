/**
 * 🎮 Graceful Degradation Controller
 * 
 * Provides endpoints for monitoring and controlling
 * system degradation and defensive modes
 */

import { Controller, Get, Post, Put, Body, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { GracefulDegradationService, DegradationLevel } from './graceful-degradation.service';
import { DefensiveAI, defensiveAI } from './defensive-ai-mode';

export interface DegradationStatusResponse {
  currentLevel: DegradationLevel;
  defensiveMode: boolean;
  degradationDurationMs: number;
  rateLimits: {
    windowMs: number;
    maxRequests: number;
    delayMs: number;
  };
  aiSettings: {
    maxSearchDepth: number;
    maxBranchingFactor: number;
    mlInferenceEnabled: boolean;
    responseTimeTarget: number;
  };
  clientStats: {
    active: number;
    blocked: number;
    total: number;
  };
}

export interface SetDegradationRequest {
  level: DegradationLevel;
  reason?: string;
}

export interface TestDefensiveAIRequest {
  board?: number[][];
  player?: 'Red' | 'Yellow';
}

@Controller('api/degradation')
export class GracefulDegradationController {
  private readonly logger = new Logger('DegradationController');

  constructor(
    private readonly degradationService: GracefulDegradationService
  ) {}

  /**
   * Get current degradation status
   */
  @Get('status')
  getStatus(): DegradationStatusResponse {
    const stats = this.degradationService.getStatistics();
    
    return {
      currentLevel: stats.currentLevel,
      defensiveMode: stats.defensiveMode,
      degradationDurationMs: stats.degradationDurationMs,
      rateLimits: stats.rateLimitConfig,
      aiSettings: {
        maxSearchDepth: stats.aiConfig.maxSearchDepth,
        maxBranchingFactor: stats.aiConfig.maxBranchingFactor,
        mlInferenceEnabled: !stats.aiConfig.disableMLInference,
        responseTimeTarget: stats.aiConfig.responseTimeTarget
      },
      clientStats: stats.clients
    };
  }

  /**
   * Manually set degradation level
   */
  @Put('level')
  setDegradationLevel(@Body() request: SetDegradationRequest): { 
    success: boolean; 
    previousLevel: DegradationLevel;
    newLevel: DegradationLevel;
  } {
    const validLevels = Object.values(DegradationLevel);
    if (!validLevels.includes(request.level)) {
      throw new HttpException(
        `Invalid degradation level. Must be one of: ${validLevels.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const previousStats = this.degradationService.getStatistics();
    this.degradationService.setDegradationLevel(request.level);
    
    this.logger.warn(`Degradation level manually set to ${request.level}${request.reason ? ` (${request.reason})` : ''}`);

    return {
      success: true,
      previousLevel: previousStats.currentLevel,
      newLevel: request.level
    };
  }

  /**
   * Emergency stop - activate maximum degradation
   */
  @Post('emergency-stop')
  emergencyStop(): { success: boolean; message: string } {
    this.logger.error('Emergency stop requested via API');
    this.degradationService.emergencyStop();
    
    return {
      success: true,
      message: 'Emergency stop activated. All requests are now heavily rate-limited.'
    };
  }

  /**
   * Resume normal operation
   */
  @Post('resume')
  resume(): { success: boolean; message: string } {
    this.logger.log('Resume normal operation requested');
    this.degradationService.resume();
    
    return {
      success: true,
      message: 'Resumed normal operation. All rate limits reset to normal.'
    };
  }

  /**
   * Test defensive AI mode
   */
  @Post('test-defensive-ai')
  testDefensiveAI(@Body() request: TestDefensiveAIRequest): {
    move: number;
    strategy: string;
    confidence: number;
    computeTimeMs: number;
    explanation: string;
    boardState?: string;
  } {
    // Use provided board or create a test board
    const board = request.board || this.createTestBoard();
    const player = request.player || 'Red';
    
    // Get defensive move
    const result = defensiveAI.getBestMove(board, player, 1);
    const explanation = defensiveAI.getMoveExplanation(result);
    
    return {
      move: result.move,
      strategy: result.strategy,
      confidence: result.confidence,
      computeTimeMs: result.computeTimeMs,
      explanation,
      boardState: this.boardToString(board)
    };
  }

  /**
   * Get rate limit status for all clients
   */
  @Get('clients')
  getClientStatus(): {
    totalClients: number;
    activeClients: { id: string; requests: number; warned: boolean; blocked: boolean }[];
  } {
    const stats = this.degradationService.getStatistics();
    
    // Note: This is a simplified version. In production, you'd want to
    // expose client states through the service properly
    return {
      totalClients: stats.clients.total,
      activeClients: [] // Would need to expose from service
    };
  }

  /**
   * Create a test board for defensive AI testing
   */
  private createTestBoard(): any[][] {
    // Create a board with some moves already made
    const board = Array(6).fill(null).map(() => Array(7).fill('Empty'));
    
    // Add some test moves
    board[5][3] = 'Red';
    board[5][4] = 'Yellow';
    board[4][3] = 'Yellow';
    board[5][2] = 'Red';
    
    return board;
  }

  /**
   * Convert board to string representation
   */
  private boardToString(board: any[][]): string {
    return board.map(row => 
      row.map(cell => 
        cell === 'Red' ? 'R' : 
        cell === 'Yellow' ? 'Y' : 
        '.'
      ).join(' ')
    ).join('\n');
  }
}