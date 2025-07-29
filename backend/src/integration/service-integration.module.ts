import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServiceIntegrationOrchestrator } from './service-integration-orchestrator';
import { IntegrationWebSocketGateway } from './integration-websocket.gateway';
import { DataFlowService } from './data-flow.service';
import { ModelSyncService } from './model-sync.service';
import { MlModule } from '../ml/ml.module';

/**
 * 🔗 SERVICE INTEGRATION MODULE
 * =============================
 * 
 * Orchestrates seamless communication between all Connect Four services:
 * - Backend ↔ ML Service: Game data and predictions
 * - ML Service ↔ Continuous Learning: Real-time model updates
 * - Backend ↔ AI Coordination: Strategic decisions
 * - All Services ↔ Pattern Analysis: Cross-service insights
 */
@Global()
@Module({
  imports: [
    HttpModule,
    MlModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
  ],
  providers: [
    ServiceIntegrationOrchestrator,
    IntegrationWebSocketGateway,
    DataFlowService,
    ModelSyncService,
  ],
  exports: [
    ServiceIntegrationOrchestrator,
    DataFlowService,
    ModelSyncService,
  ],
})
export class ServiceIntegrationModule {}