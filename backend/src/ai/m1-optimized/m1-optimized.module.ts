/**
 * M1 Optimized Module
 * 
 * Provides all M1-specific optimization services and controllers
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GracefulDegradationService } from './graceful-degradation.service';
import { DynamicMemoryMonitor } from './dynamic-memory-monitor';
import { BackgroundLearningThrottle } from './background-learning-throttle';
import { LightweightInferenceService } from './lightweight-inference.service';
import { EmergencyCleanupController } from './emergency-cleanup.controller';
import { MemoryDashboardController } from './memory-dashboard.controller';
import { MemoryDashboardGateway } from './memory-dashboard.gateway';
import { M1StressTestService } from './stress-testing/m1-stress-test.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot()
  ],
  controllers: [
    EmergencyCleanupController,
    MemoryDashboardController
  ],
  providers: [
    GracefulDegradationService,
    LightweightInferenceService,
    MemoryDashboardGateway,
    M1StressTestService,
    {
      provide: DynamicMemoryMonitor,
      useFactory: (eventEmitter: EventEmitter2) => new DynamicMemoryMonitor(eventEmitter),
      inject: [EventEmitter2]
    },
    {
      provide: BackgroundLearningThrottle,
      useFactory: (eventEmitter: EventEmitter2) => {
        const { M1PerformanceOptimizer } = require('./m1-performance-optimizer');
        const config = M1PerformanceOptimizer.getOptimizationConfig();
        return new BackgroundLearningThrottle(eventEmitter, config);
      },
      inject: [EventEmitter2]
    }
  ],
  exports: [
    GracefulDegradationService,
    DynamicMemoryMonitor,
    BackgroundLearningThrottle,
    LightweightInferenceService,
    M1StressTestService,
    MemoryDashboardGateway
  ]
})
export class M1OptimizedModule { }