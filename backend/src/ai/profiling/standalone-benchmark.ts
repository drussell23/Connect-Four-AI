#!/usr/bin/env ts-node

import { Logger } from '@nestjs/common';
import { SimpleAIService } from '../simple-ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { performance } from 'perf_hooks';
import * as tf from '@tensorflow/tfjs';

const logger = new Logger('StandaloneBenchmark');

/**
 * Standalone Algorithm Benchmark
 * Direct testing without complex module dependencies
 */
async function main() {
  logger.log('🏃 Standalone Algorithm Benchmark');
  logger.log('================================');
  logger.log(`System: ${os.platform()} ${os.arch()}`);
  logger.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  logger.log(`CPUs: ${os.cpus().length} cores`);
  logger.log('');

  try {
    // Create SimpleAI instance directly
    const eventEmitter = new EventEmitter2();
    const simpleAI = new SimpleAIService(eventEmitter);
    
    // Initialize the service
    await simpleAI.onModuleInit();
    
    // Test scenarios
    const scenarios = [
      {
        name: 'Empty Board',
        board: createEmptyBoard()
      },
      {
        name: 'Mid Game',
        board: createMidGameBoard()
      },
      {
        name: 'Complex Position',
        board: createComplexBoard()
      }
    ];
    
    const difficulties = ['easy', 'medium', 'hard'];
    
    logger.log('Starting benchmark...\n');
    
    for (const scenario of scenarios) {
      logger.log(`📋 Scenario: ${scenario.name}`);
      
      for (const difficulty of difficulties) {
        const memBefore = process.memoryUsage();
        const tensorsBefore = tf.memory().numTensors;
        const start = performance.now();
        
        try {
          const move = await simpleAI.getBestMove(
            scenario.board,
            'Yellow',
            difficulty
          );
          
          const duration = performance.now() - start;
          const memAfter = process.memoryUsage();
          const tensorsAfter = tf.memory().numTensors;
          
          logger.log(`  ${difficulty}: Move ${move}, Time ${duration.toFixed(2)}ms, Memory ${((memAfter.heapUsed - memBefore.heapUsed) / 1024).toFixed(2)}KB, Tensors created: ${tensorsAfter - tensorsBefore}`);
          
        } catch (error) {
          logger.error(`  ${difficulty}: Failed - ${error.message}`);
        }
        
        // Clean up tensors
        await tf.tidy(() => {});
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.log('');
    }
    
    logger.log('✅ Benchmark completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

function createEmptyBoard(): any[][] {
  return Array(6).fill(null).map(() => Array(7).fill('Empty'));
}

function createMidGameBoard(): any[][] {
  const board = createEmptyBoard();
  board[5][3] = 'Red';
  board[5][4] = 'Yellow';
  board[4][3] = 'Yellow';
  board[4][4] = 'Red';
  board[5][2] = 'Red';
  board[5][5] = 'Yellow';
  return board;
}

function createComplexBoard(): any[][] {
  const board = createEmptyBoard();
  const moves = [
    [5, 3, 'Red'], [5, 4, 'Yellow'], [4, 3, 'Yellow'], [4, 4, 'Red'],
    [3, 3, 'Red'], [5, 2, 'Yellow'], [5, 5, 'Red'], [4, 2, 'Red'],
    [3, 2, 'Yellow'], [4, 5, 'Yellow'], [3, 4, 'Red'], [2, 3, 'Yellow']
  ];
  
  for (const [row, col, player] of moves) {
    board[row as number][col as number] = player;
  }
  
  return board;
}

// Run if executed directly
if (require.main === module) {
  main();
}