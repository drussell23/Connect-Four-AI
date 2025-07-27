/**
 * Hybrid Architecture Module
 * Integrates minimal Python training with TypeScript inference
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HybridAIService } from './hybrid-ai.service';
import { TrainingDataManager } from './training-data-manager';
import { ModelDeploymentService } from './model-deployment.service';
import { HybridAIController } from './hybrid-ai.controller';

@Module({
  imports: [
    HttpModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    HybridAIService,
    TrainingDataManager,
    ModelDeploymentService,
  ],
  controllers: [HybridAIController],
  exports: [
    HybridAIService,
    TrainingDataManager,
    ModelDeploymentService,
  ],
})
export class HybridArchitectureModule {}