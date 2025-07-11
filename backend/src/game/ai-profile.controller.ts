import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { AiProfileService } from './ai-profile.service';

@Controller('api/ai-profile')
export class AIProfileController {
  private readonly logger = new Logger(AIProfileController.name);

  constructor(private readonly aiProfileService: AiProfileService) { }

  @Get(':playerId')
  async getProfile(@Param('playerId') playerId: string) {
    this.logger.log(`Getting AI profile for player: ${playerId}`);
    const profile = await this.aiProfileService.getOrCreateProfile(playerId);
    return profile;
  }

  @Get(':playerId/configuration')
  async getAIConfiguration(@Param('playerId') playerId: string) {
    this.logger.log(`Getting AI configuration for player: ${playerId}`);
    const config = await this.aiProfileService.getAIConfiguration(playerId);
    return config;
  }

  @Get(':playerId/analysis')
  async getPlayerAnalysis(@Param('playerId') playerId: string) {
    this.logger.log(`Getting player analysis for player: ${playerId}`);
    const analysis = await this.aiProfileService.getPlayerAnalysis(playerId);
    return analysis;
  }

  @Get(':playerId/stats')
  async getPlayerStats(@Param('playerId') playerId: string) {
    this.logger.log(`Getting player stats for player: ${playerId}`);
    const stats = await this.aiProfileService.getPlayerStats(playerId);
    return stats;
  }

  @Get(':playerId/taunt')
  async getTaunt(@Param('playerId') playerId: string) {
    const taunt = await this.aiProfileService.getTaunt(playerId);
    return { message: taunt };
  }

  @Get(':playerId/victory-message')
  async getVictoryMessage(@Param('playerId') playerId: string) {
    const message = await this.aiProfileService.getVictoryMessage(playerId);
    return { message };
  }

  @Get(':playerId/level-up-message')
  async getLevelUpMessage(@Param('playerId') playerId: string) {
    const message = await this.aiProfileService.getLevelUpMessage(playerId);
    return { message };
  }

  @Post(':playerId/game-result')
  async recordGameResult(
    @Param('playerId') playerId: string,
    @Body() gameData: {
      gameId: string;
      playerMoves: number[];
      aiMoves: number[];
      winner: 'player' | 'ai';
      gameLength: number;
      playerMistakes: number;
      aiThreatsMissed: number;
      analysisNotes: string[];
    }
  ) {
    this.logger.log(`Recording game result for player: ${playerId}, winner: ${gameData.winner}`);
    const updatedProfile = await this.aiProfileService.recordGameResult(playerId, gameData);
    return updatedProfile;
  }

  // Legacy endpoint for backward compatibility
  @Get('level')
  async getLegacyLevel() {
    // For backward compatibility, return a default level
    const defaultPlayerId = 'default_player';
    const profile = await this.aiProfileService.getOrCreateProfile(defaultPlayerId);
    this.logger.log(`Legacy API requested AI level. Returning: ${profile.level}`);
    return { level: profile.level };
  }
}
