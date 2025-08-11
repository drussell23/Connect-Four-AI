#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GameModule } from '../game/game.module';
import { MemoryStressTest } from './memory-stress-test';
import * as os from 'os';

const logger = new Logger('MemoryBenchmark');

/**
 * Test module for memory benchmarking
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

/**
 * Memory Benchmark Runner
 * Executes comprehensive memory stress tests
 */
async function main() {
  logger.log('🚀 Memory Benchmark Suite');
  logger.log('========================');
  logger.log(`System: ${os.platform()} ${os.arch()}`);
  logger.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  logger.log(`CPUs: ${os.cpus().length} cores`);
  logger.log('');

  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Create NestJS application context
  const app: INestApplicationContext = await NestFactory.createApplicationContext(
    MemoryBenchmarkModule,
    { logger: ['error', 'warn', 'log'] }
  );

  try {
    const tester = new MemoryStressTest();

    if (options.test) {
      // Run specific test
      logger.log(`Running specific test: ${options.test}`);
      await tester.setup(app);

      switch (options.test) {
        case 'concurrent':
          await tester.testConcurrentGames(options.games || 10, options.difficulty || 30);
          break;
        case 'degradation':
          await tester.testGracefulDegradation();
          break;
        case 'cache':
          await tester.testCacheEfficiency();
          break;
        case 'cleanup':
          await tester.testEmergencyCleanup();
          break;
        default:
          logger.error(`Unknown test: ${options.test}`);
          printUsage();
          await app.close();
          process.exit(1);
      }

      await tester.teardown();
    } else {
      // Run all tests
      logger.log('Running all memory stress tests...\n');
      await tester.runAllTests(app);
    }

    logger.log('\n✅ Memory benchmark completed successfully');
    await app.close();
    process.exit(0);

  } catch (error) {
    logger.error('❌ Memory benchmark failed:', error);
    await app.close();
    process.exit(1);
  }
}

function parseArgs(args: string[]): any {
  const options: any = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--test':
      case '-t':
        options.test = args[++i];
        break;
      case '--games':
      case '-g':
        options.games = parseInt(args[++i]);
        break;
      case '--difficulty':
      case '-d':
        options.difficulty = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Memory Benchmark Suite

Usage: npm run benchmark:memory [options]

Options:
  -t, --test <name>        Run specific test (concurrent|degradation|cache|cleanup)
  -g, --games <number>     Number of concurrent games (default: 10)
  -d, --difficulty <level> AI difficulty level (default: 30)
  -h, --help              Show this help message

Examples:
  npm run benchmark:memory                     # Run all tests
  npm run benchmark:memory -t concurrent       # Run concurrent games test
  npm run benchmark:memory -t concurrent -g 20 -d 50  # 20 games at difficulty 50
`);
}

// Run if executed directly
if (require.main === module) {
  main();
}