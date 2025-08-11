#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GameModule } from '../game/game.module';
import { MemoryStressTest } from './memory-stress-test';

/**
 * Standalone module for memory benchmarking
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({
        mlServiceUrl: 'http://localhost:8000',
        enableServiceIntegration: false,
        aiHealthCheck: false,
        performanceMonitoring: false,
        healthCheckEnabled: false
      })]
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    GameModule
  ]
})
class MemoryBenchmarkModule {}

async function bootstrap() {
  // Create full NestJS application context
  const app: INestApplicationContext = await NestFactory.createApplicationContext(
    MemoryBenchmarkModule,
    {
      logger: ['error', 'warn', 'log']
    }
  );

  try {
    // Run memory stress tests
    const tester = new MemoryStressTest();
    await tester.runAllTests();
  } finally {
    await app.close();
  }
}

// Run if executed directly
if (require.main === module) {
  bootstrap().catch(err => {
    console.error('Memory benchmark failed:', err);
    process.exit(1);
  });
}