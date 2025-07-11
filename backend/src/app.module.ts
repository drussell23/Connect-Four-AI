// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { GameAIService } from './game/game-ai.service';
import { AIProfileService } from './game/ai-profile.service';

@Module({
  providers: [GameGateway, GameService, GameAIService, AIProfileService],
})
export class AppModule {}
