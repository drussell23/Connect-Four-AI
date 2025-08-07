/**
 * 🍎 M1-Optimized AI Module
 * 
 * High-performance AI module with intelligent resource management
 * specifically optimized for Apple Silicon Macs
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { M1AIConfigService } from './m1-ai-config.service';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { TensorFlowMemoryManager } from './tensorflow-memory-manager';
import { M1OptimizedAIService } from './m1-optimized-ai.service';
import { LightweightInferenceService } from './lightweight-inference.service';
import { EmergencyCleanupController } from './emergency-cleanup.controller';
import { PythonMLOffloadService } from './python-ml-offload.service';
import { GracefulDegradationService } from './graceful-degradation.service';
import { GracefulDegradationController } from './graceful-degradation.controller';
import { MemoryDashboardController } from './memory-dashboard.controller';
import { MemoryDashboardGateway } from './memory-dashboard.gateway';
import { M1StressTestService } from './stress-testing/m1-stress-test.service';
import { DynamicMemoryMonitor } from './dynamic-memory-monitor';
import { BackgroundLearningThrottle } from './background-learning-throttle';

@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false
    })
  ],
  providers: [
    M1AIConfigService,
    M1OptimizedAIService,
    LightweightInferenceService,
    PythonMLOffloadService,
    GracefulDegradationService,
    M1StressTestService,
    MemoryDashboardGateway,
    {
      provide: DynamicMemoryMonitor,
      useFactory: (eventEmitter: EventEmitter2) => new DynamicMemoryMonitor(eventEmitter),
      inject: [EventEmitter2]
    },
    {
      provide: BackgroundLearningThrottle,
      useFactory: (eventEmitter: EventEmitter2) => new BackgroundLearningThrottle(eventEmitter),
      inject: [EventEmitter2]
    },
    {
      provide: 'AI_CONFIG',
      useFactory: (configService: M1AIConfigService) => configService.getConfig(),
      inject: [M1AIConfigService]
    },
    {
      provide: 'AI_STATS',
      useFactory: (aiService: M1OptimizedAIService) => () => aiService.getStats(),
      inject: [M1OptimizedAIService]
    },
    {
      provide: 'MEMORY_MONITOR',
      useExisting: DynamicMemoryMonitor
    },
    {
      provide: 'LEARNING_THROTTLE',
      useExisting: BackgroundLearningThrottle
    }
  ],
  controllers: [
    EmergencyCleanupController,
    GracefulDegradationController,
    MemoryDashboardController
  ],
  exports: [
    M1OptimizedAIService,
    M1AIConfigService,
    LightweightInferenceService,
    PythonMLOffloadService,
    GracefulDegradationService,
    DynamicMemoryMonitor,
    BackgroundLearningThrottle,
    MemoryDashboardGateway,
    'AI_CONFIG',
    'AI_STATS',
    'MEMORY_MONITOR',
    'LEARNING_THROTTLE'
  ]
})
export class M1OptimizedAIModule {}

// Re-export for convenience
export * from './index';