import { Module } from '@nestjs/common';
import { AlgorithmProfiler } from './algorithm-profiler';
import { AIIntegrationModule } from '../ai-integration.module';
import { M1OptimizedAIModule } from '../m1-optimized/m1-optimized-ai.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SimpleAIService } from '../simple-ai.service';
import { UnifiedAISystem } from '../unified/unified-ai-system-simple';
import { AdaptiveAIOrchestrator } from '../adaptive/adaptive-ai-orchestrator';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { LightweightInferenceService } from '../m1-optimized/lightweight-inference.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AIIntegrationModule,
    M1OptimizedAIModule
  ],
  providers: [
    {
      provide: AlgorithmProfiler,
      useFactory: (
        simpleAI: SimpleAIService,
        unifiedAI: UnifiedAISystem,
        adaptiveAI: AdaptiveAIOrchestrator,
        asyncAI: AsyncAIOrchestrator,
        lightweightAI: LightweightInferenceService
      ) => {
        return new AlgorithmProfiler(
          simpleAI,
          unifiedAI,
          adaptiveAI,
          asyncAI,
          lightweightAI
        );
      },
      inject: [
        SimpleAIService,
        UnifiedAISystem,
        AdaptiveAIOrchestrator,
        AsyncAIOrchestrator,
        LightweightInferenceService
      ]
    }
  ],
  exports: [AlgorithmProfiler]
})
export class AlgorithmProfilerModule {}