// backend/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameAIService } from './game-ai.service';
import { MlClientService } from '../ml/ml-client.service';
import { AiProfileService } from './ai-profile.service';
import { AIProfileController } from './ai-profile.controller';
import { DashboardService } from './dashboard.service';
import { TrainingService } from './training.service';

@Module({
  imports: [
    HttpModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot()
  ],
  controllers: [GameController, AIProfileController],
  providers: [
    GameService,
    GameGateway,
    GameAIService,
    MlClientService,
    AiProfileService,
    DashboardService,
    TrainingService
  ],
  exports: [GameService, AiProfileService, DashboardService, TrainingService],
})
export class GameModule { }