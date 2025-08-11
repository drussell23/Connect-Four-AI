#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AlgorithmProfiler } from './algorithm-profiler';
import { AlgorithmProfilerModule } from './algorithm-profiler.module';
import * as os from 'os';

const logger = new Logger('AlgorithmBenchmark');

/**
 * Test module for algorithm benchmarking
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
        healthCheckEnabled: false,
        corsEnabled: false
      })]
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AlgorithmProfilerModule
  ]
})
class AlgorithmBenchmarkModule {}

/**
 * Algorithm Benchmark Runner
 * Profiles and compares AI algorithm performance
 */
async function main() {
  logger.log('🏃 Algorithm Benchmark Suite');
  logger.log('===========================');
  logger.log(`System: ${os.platform()} ${os.arch()}`);
  logger.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  logger.log(`CPUs: ${os.cpus().length} cores`);
  logger.log('');

  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Create NestJS application context
  const app: INestApplicationContext = await NestFactory.createApplicationContext(
    AlgorithmBenchmarkModule,
    { 
      logger: options.verbose ? ['log', 'error', 'warn', 'debug'] : ['error', 'warn']
    }
  );

  try {
    const profiler = app.get(AlgorithmProfiler);

    if (options.compare) {
      // Compare two algorithms
      const [algo1, algo2] = options.compare.split(',');
      logger.log(`Comparing ${algo1} vs ${algo2}\n`);
      
      const board = createTestBoard(options.scenario || 'midgame');
      await profiler.compareAlgorithms(
        algo1,
        algo2,
        board,
        'Yellow',
        options.difficulty || 10
      );

    } else if (options.algorithm) {
      // Profile specific algorithm
      logger.log(`Profiling algorithm: ${options.algorithm}\n`);
      
      const board = createTestBoard(options.scenario || 'midgame');
      const profile = await profiler.profileAlgorithm(
        options.algorithm,
        board,
        'Yellow',
        options.difficulty || 10
      );

      displayProfile(profile);

    } else if (options.benchmark) {
      // Run full benchmark suite
      logger.log('Running comprehensive algorithm benchmark...\n');
      await profiler.benchmarkAlgorithms();

    } else {
      // Default: profile all algorithms
      logger.log('Profiling all available algorithms...\n');
      
      const board = createTestBoard(options.scenario || 'midgame');
      const report = await profiler.profileAllAlgorithms(
        board,
        'Yellow',
        options.difficulty || 10
      );

      displayReport(report);
    }

    await app.close();
    logger.log('\n✅ Algorithm benchmark completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Algorithm benchmark failed:', error);
    await app.close();
    process.exit(1);
  }
}

function createTestBoard(scenario: string): any[][] {
  switch (scenario) {
    case 'empty':
      return Array(6).fill(null).map(() => Array(7).fill('Empty'));
    
    case 'midgame':
      const mid = Array(6).fill(null).map(() => Array(7).fill('Empty'));
      mid[5][3] = 'Red';
      mid[5][4] = 'Yellow';
      mid[4][3] = 'Yellow';
      mid[4][4] = 'Red';
      mid[5][2] = 'Red';
      mid[5][5] = 'Yellow';
      return mid;
    
    case 'complex':
      const complex = Array(6).fill(null).map(() => Array(7).fill('Empty'));
      const moves = [
        [5, 3, 'Red'], [5, 4, 'Yellow'], [4, 3, 'Yellow'], [4, 4, 'Red'],
        [3, 3, 'Red'], [5, 2, 'Yellow'], [5, 5, 'Red'], [4, 2, 'Red'],
        [3, 2, 'Yellow'], [4, 5, 'Yellow'], [3, 4, 'Red'], [2, 3, 'Yellow']
      ];
      for (const [row, col, player] of moves) {
        complex[row as number][col as number] = player;
      }
      return complex;
    
    case 'endgame':
      const endgame = Array(6).fill(null).map(() => Array(7).fill('Empty'));
      for (let col = 0; col < 7; col++) {
        for (let row = 5; row >= 1; row--) {
          endgame[row][col] = (row + col) % 2 === 0 ? 'Red' : 'Yellow';
        }
      }
      endgame[0][3] = 'Red';
      return endgame;
    
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

function displayProfile(profile: any) {
  logger.log('📊 Algorithm Profile');
  logger.log('-------------------');
  logger.log(`Algorithm: ${profile.algorithm}`);
  logger.log(`Duration: ${profile.duration.toFixed(2)}ms`);
  logger.log(`Memory Used: ${(profile.memoryUsed / 1024).toFixed(2)}KB`);
  logger.log(`Tensors Created: ${profile.tensorsCreated}`);
  logger.log(`Move: Column ${profile.result.column}`);
  if (profile.result.confidence) {
    logger.log(`Confidence: ${(profile.result.confidence * 100).toFixed(1)}%`);
  }
  if (profile.result.strategy) {
    logger.log(`Strategy: ${profile.result.strategy}`);
  }
}

function displayReport(report: any) {
  logger.log('📊 Algorithm Performance Report');
  logger.log('------------------------------');
  logger.log(`Total Algorithms: ${report.totalAlgorithms}`);
  logger.log(`\n🏆 Summary:`);
  logger.log(`  Fastest: ${report.summary.fastestAlgorithm}`);
  logger.log(`  Most Memory Efficient: ${report.summary.mostMemoryEfficient}`);
  logger.log(`  Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
  logger.log(`  Average Memory: ${(report.summary.averageMemoryUsed / 1024).toFixed(2)}KB`);
  
  logger.log('\n📈 Individual Results:');
  for (const profile of report.profiles) {
    logger.log(`\n${profile.algorithm}:`);
    logger.log(`  Duration: ${profile.duration.toFixed(2)}ms`);
    logger.log(`  Memory: ${(profile.memoryUsed / 1024).toFixed(2)}KB`);
    logger.log(`  Move: Column ${profile.result.column}`);
  }
}

function parseArgs(args: string[]): any {
  const options: any = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--algorithm':
      case '-a':
        options.algorithm = args[++i];
        break;
      case '--compare':
      case '-c':
        options.compare = args[++i];
        break;
      case '--difficulty':
      case '-d':
        options.difficulty = parseInt(args[++i]);
        break;
      case '--scenario':
      case '-s':
        options.scenario = args[++i];
        break;
      case '--benchmark':
      case '-b':
        options.benchmark = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
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
Algorithm Benchmark Suite

Usage: npm run benchmark:algorithms [options]

Options:
  -a, --algorithm <name>   Profile specific algorithm
  -c, --compare <a1,a2>    Compare two algorithms
  -d, --difficulty <level> AI difficulty level (default: 10)
  -s, --scenario <name>    Board scenario (empty|midgame|complex|endgame)
  -b, --benchmark          Run full benchmark suite
  -v, --verbose            Enable verbose logging
  -h, --help              Show this help message

Available algorithms:
  - simple-ai       Basic minimax AI
  - unified-ai      Unified AI system
  - adaptive-ai     Adaptive orchestrator
  - async-ai        Async AI with caching
  - lightweight-ai  M1-optimized lightweight AI

Examples:
  npm run benchmark:algorithms                        # Profile all algorithms
  npm run benchmark:algorithms -a simple-ai           # Profile simple-ai
  npm run benchmark:algorithms -c simple-ai,unified-ai # Compare two algorithms
  npm run benchmark:algorithms -b                     # Run full benchmark
  npm run benchmark:algorithms -s complex -d 20       # Complex board, difficulty 20
`);
}

// Run if executed directly
if (require.main === module) {
  main();
}