import { Module, Global } from '@nestjs/common';
import { AICoordinationClient } from './ai-coordination-client.service';
import { CoordinationGameIntegrationService } from './coordination-game-integration.service';
import { UnifiedAIIntegrationModule } from '../unified/unified-ai-integration.module';

/**
 * AI Coordination Module
 * 
 * Provides WebSocket connectivity to the AI Coordination Hub,
 * enabling multi-agent collaboration and ensemble decision-making.
 */
@Global()
@Module({
    imports: [
        UnifiedAIIntegrationModule
    ],
    providers: [
        AICoordinationClient,
        CoordinationGameIntegrationService
    ],
    exports: [
        AICoordinationClient,
        CoordinationGameIntegrationService
    ]
})
export class AICoordinationModule {
    constructor() {
        console.log('🔗 AI Coordination Module loaded - Enabling multi-agent intelligence');
    }
} 