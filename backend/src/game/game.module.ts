// backend/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameHistoryService } from './game-history.service';
import { GameGateway } from './game.gateway';
import { AIProfileController } from './ai-profile.controller';
import { AiProfileService } from './ai-profile.service';
import { GameAIService } from './game-ai.service';
import { DashboardService } from './dashboard.service';
import { TrainingService } from './training.service';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [MlModule, EventEmitterModule.forRoot()],
  controllers: [GameController, AIProfileController],
  providers: [GameService, GameHistoryService, GameGateway, AiProfileService, GameAIService, DashboardService, TrainingService],
  exports: [GameService, GameGateway],
})
export class GameModule { }