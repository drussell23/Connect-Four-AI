import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Reflector } from '@nestjs/core';

/**
 * Global test setup module that provides all required dependencies
 * for testing complex modules
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({
        // Minimal config for testing
        mlServiceUrl: 'http://localhost:8000',
        enableServiceIntegration: false,
        aiHealthCheck: false,
        performanceMonitoring: false,
        healthCheckEnabled: false,
        corsEnabled: false,
        enterpriseMode: false,
        enableAdvancedAI: false
      })]
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      // Use wildcard for all events
      wildcard: false,
      // Remove listeners on errors
      ignoreErrors: false,
      // Max listeners
      maxListeners: 10
    })
  ],
  providers: [
    // Provide Reflector globally for ScheduleModule
    {
      provide: Reflector,
      useValue: new Reflector()
    }
  ],
  exports: [
    ConfigModule,
    ScheduleModule,
    EventEmitterModule,
    Reflector
  ]
})
export class TestSetupModule {}