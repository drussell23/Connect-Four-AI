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
import { EventThrottle } from '../utils/event-throttle';
import { MemoryManagementService } from './memory-management.service';
import { M1OptimizedModule } from '../ai/m1-optimized/m1-optimized.module';

@Module({
  imports: [
    MlModule,
    AIIntegrationModule,
    UnifiedAIIntegrationModule,
    AICoordinationModule, // ← Added AI Coordination Hub integration!
    M1OptimizedModule, // ← Import M1 optimized services and controllers
    EventEmitterModule.forRoot()
  ],
  controllers: [
    GameController, 
    AIProfileController
    // Controllers from M1OptimizedModule (EmergencyCleanupController, MemoryDashboardController) are now imported
  ],
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
    EventThrottle,
    MemoryManagementService
    // M1 services are now provided by M1OptimizedModule
  ],
  exports: [GameService, GameGateway],
})
export class GameModule { }