import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ReinforcementLearningService } from './reinforcement-learning.service';
import { EnhancedRLService } from './enhanced-rl.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    ReinforcementLearningService,
    EnhancedRLService,
  ],
  controllers: [LearningController],
  exports: [ReinforcementLearningService, EnhancedRLService],
})
export class LearningIntegrationModule {}