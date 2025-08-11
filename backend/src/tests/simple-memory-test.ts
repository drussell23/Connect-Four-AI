#!/usr/bin/env ts-node

import { Logger } from '@nestjs/common';
import * as os from 'os';
import * as tf from '@tensorflow/tfjs';

const logger = new Logger('SimpleMemoryTest');

/**
 * Simple Memory Test
 * Tests memory usage patterns without complex dependencies
 */
async function main() {
  logger.log('🧪 Simple Memory Test');
  logger.log('====================');
  logger.log(`System: ${os.platform()} ${os.arch()}`);
  logger.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  logger.log(`CPUs: ${os.cpus().length} cores`);
  logger.log('');

  try {
    // Test 1: Tensor Creation and Cleanup
    logger.log('Test 1: Tensor Creation and Cleanup');
    await testTensorMemory();
    
    // Test 2: Array Allocation
    logger.log('\nTest 2: Array Allocation');
    await testArrayMemory();
    
    // Test 3: Cache Simulation
    logger.log('\nTest 3: Cache Simulation');
    await testCacheMemory();
    
    logger.log('\n✅ Memory tests completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Memory test failed:', error);
    process.exit(1);
  }
}

async function testTensorMemory() {
  const iterations = 10;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const memBefore = process.memoryUsage();
    const tensorsBefore = tf.memory().numTensors;
    
    // Create tensors
    const tensors = [];
    for (let j = 0; j < 100; j++) {
      tensors.push(tf.randomNormal([100, 100]));
    }
    
    const memAfter = process.memoryUsage();
    const tensorsAfter = tf.memory().numTensors;
    
    // Clean up
    tensors.forEach(t => t.dispose());
    
    const memCleaned = process.memoryUsage();
    const tensorsCleaned = tf.memory().numTensors;
    
    results.push({
      iteration: i + 1,
      memoryUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
      memoryFreed: (memAfter.heapUsed - memCleaned.heapUsed) / 1024 / 1024,
      tensorsCreated: tensorsAfter - tensorsBefore,
      tensorsRemaining: tensorsCleaned - tensorsBefore
    });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Display results
  const avgMemoryUsed = results.reduce((sum, r) => sum + r.memoryUsed, 0) / iterations;
  const avgMemoryFreed = results.reduce((sum, r) => sum + r.memoryFreed, 0) / iterations;
  
  logger.log(`  Average memory used: ${avgMemoryUsed.toFixed(2)}MB`);
  logger.log(`  Average memory freed: ${avgMemoryFreed.toFixed(2)}MB`);
  logger.log(`  Tensor leak detection: ${results.some(r => r.tensorsRemaining > 0) ? 'LEAK DETECTED' : 'No leaks'}`);
}

async function testArrayMemory() {
  const sizes = [1000, 10000, 100000];
  
  for (const size of sizes) {
    const memBefore = process.memoryUsage();
    
    // Create large arrays
    const arrays = [];
    for (let i = 0; i < 10; i++) {
      arrays.push(new Array(size).fill(Math.random()));
    }
    
    const memAfter = process.memoryUsage();
    const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    logger.log(`  Array size ${size}: ${memoryUsed.toFixed(2)}MB for 10 arrays`);
    
    // Clear arrays
    arrays.length = 0;
  }
}

async function testCacheMemory() {
  const cache = new Map();
  const cacheSize = 1000;
  const entrySize = 1000;
  
  logger.log(`  Creating cache with ${cacheSize} entries...`);
  
  const memBefore = process.memoryUsage();
  
  // Fill cache
  for (let i = 0; i < cacheSize; i++) {
    const key = `key-${i}`;
    const value = {
      data: new Array(entrySize).fill(Math.random()),
      timestamp: Date.now()
    };
    cache.set(key, value);
  }
  
  const memAfter = process.memoryUsage();
  const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  
  logger.log(`  Cache memory used: ${memoryUsed.toFixed(2)}MB`);
  logger.log(`  Average per entry: ${(memoryUsed / cacheSize * 1024).toFixed(2)}KB`);
  
  // Test cache eviction
  logger.log('  Testing LRU eviction...');
  
  // Remove half the entries
  let removed = 0;
  for (const [key] of cache) {
    if (removed >= cacheSize / 2) break;
    cache.delete(key);
    removed++;
  }
  
  const memEvicted = process.memoryUsage();
  const memoryFreed = (memAfter.heapUsed - memEvicted.heapUsed) / 1024 / 1024;
  
  logger.log(`  Memory freed after eviction: ${memoryFreed.toFixed(2)}MB`);
  logger.log(`  Cache size: ${cache.size} entries`);
}

// Helper to get memory snapshot
function getMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed / 1024 / 1024,
    heapTotal: mem.heapTotal / 1024 / 1024,
    external: mem.external / 1024 / 1024,
    rss: mem.rss / 1024 / 1024,
    timestamp: Date.now()
  };
}

// Run if executed directly
if (require.main === module) {
  main();
}