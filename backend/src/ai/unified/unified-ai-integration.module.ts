import { Module, Global } from '@nestjs/common';
import { UnifiedThreatDetectorService } from './unified-threat-detector.service';
import { UnifiedAIEngineService } from './unified-ai-engine.service';
import { UnifiedAICoordinatorService } from './unified-ai-coordinator.service';
import { UnifiedAISystem } from './unified-ai-system-simple';

/**
 * Unified AI Integration Module
 * Provides centralized AI services to all parts of the application
 */
@Global()
@Module({
  providers: [
    UnifiedThreatDetectorService,
    UnifiedAIEngineService,
    UnifiedAICoordinatorService,
    UnifiedAISystem,
  ],
  exports: [
    UnifiedThreatDetectorService,
    UnifiedAIEngineService,
    UnifiedAICoordinatorService,
    UnifiedAISystem,
  ],
})
export class UnifiedAIIntegrationModule {
  constructor() {
    console.log('Unified AI Integration Module loaded');
  }
}