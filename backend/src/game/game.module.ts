// backend/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameAIService } from './game-ai.service';
import { MlClientService } from '../ml/ml-client.service';
import { AiProfileService } from './ai-profile.service';
import { AIProfileController } from './ai-profile.controller';

@Module({
  imports: [HttpModule],
  controllers: [GameController, AIProfileController],
  providers: [GameService, GameGateway, GameAIService, MlClientService, AiProfileService],
  exports: [GameService, AiProfileService],
})
export class GameModule { }