// backend/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { MlClientService } from '../ml/ml-client.service';
import { AIProfileService } from './ai-profile.service';
import { AIProfileController } from './ai-profile.controller';

@Module({
  imports: [HttpModule],
  controllers: [GameController, AIProfileController],
  providers: [GameService, MlClientService, AIProfileService],
  exports: [GameService, AIProfileService],
})
export class GameModule {}