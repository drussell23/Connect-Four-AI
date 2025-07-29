// backend/src/ai/async/async-ai.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AsyncCacheManager } from './cache-manager';
import { CircuitBreaker } from './circuit-breaker';
import { RequestBatcher } from './request-batcher';
import { DynamicStrategySelector } from './strategy-selector';
import { PerformanceMonitor } from './performance-monitor';
import { PrecomputationEngine } from './precomputation-engine';
import { AsyncAIOrchestrator } from './async-ai-orchestrator';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20
    }),
    ScheduleModule.forRoot()
  ],
  providers: [
    AsyncCacheManager,
    CircuitBreaker,
    RequestBatcher,
    DynamicStrategySelector,
    PerformanceMonitor,
    PrecomputationEngine,
    AsyncAIOrchestrator
  ],
  exports: [
    AsyncAIOrchestrator,
    PerformanceMonitor,
    DynamicStrategySelector,
    AsyncCacheManager,
    CircuitBreaker,
    PrecomputationEngine,
    RequestBatcher
  ]
})
export class AsyncAIModule {}