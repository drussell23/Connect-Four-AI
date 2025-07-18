// backend/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { AIProfileController } from './ai-profile.controller';
import { AIProfileService } from './ai-profile.service';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [MlModule],
  controllers: [GameController, AIProfileController],
  providers: [GameService, GameGateway, AIProfileService],
  exports: [GameService, GameGateway],
})
export class GameModule { }