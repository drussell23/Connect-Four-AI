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
import { SettingsService } from './settings.service';
import { MlModule } from '../ml/ml.module';
import { AIIntegrationModule } from '../ai/ai-integration.module';
import { AIGameIntegrationService } from '../ai/ai-game-integration.service';
import { UnifiedAIIntegrationModule } from '../ai/unified/unified-ai-integration.module';
import { AICoordinationModule } from '../ai/coordination/ai-coordination.module';
import { OrganicAITimingService } from '../ai/organic-ai-timing.service';
import { GameAIOrganicService } from './game-ai-organic.service';

@Module({
  imports: [
    MlModule,
    AIIntegrationModule,
    UnifiedAIIntegrationModule,
    AICoordinationModule, // ← Added AI Coordination Hub integration!
    EventEmitterModule.forRoot()
  ],
  controllers: [GameController, AIProfileController],
  providers: [
    GameService,
    GameHistoryService,
    GameGateway,
    AiProfileService,
    GameAIService,
    GameAIOrganicService,
    OrganicAITimingService,
    DashboardService,
    TrainingService,
    SettingsService,
    AIGameIntegrationService,
    // AdaptiveAIOrchestrator is already provided by AIIntegrationModule - removed to avoid duplicate instantiation
  ],
  exports: [GameService, GameGateway],
})
export class GameModule { }