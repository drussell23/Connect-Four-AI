import { Controller, Get, Logger } from '@nestjs/common';
import { AIProfileService } from './ai-profile.service';

@Controller('api/ai')
export class AIProfileController {
  private readonly logger = new Logger(AIProfileController.name);

  constructor(private readonly aiProfileService: AIProfileService) {}

  @Get('level')
  getCurrentLevel(): { level: number } {
    const level = this.aiProfileService.getCurrentLevel();
    this.logger.log(`Frontend requested AI level. Returning: ${level}`);
    return { level };
  }
}
