import { Test, TestingModule } from '@nestjs/testing';
import { INestApplicationContext } from '@nestjs/common';
import { TestSetupModule } from './test-setup.module';
import { GameModule } from '../game/game.module';
import { MemoryManagementService } from '../game/memory-management.service';
import { GameService } from '../game/game.service';
import { GameGateway } from '../game/game.gateway';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { CellValue } from '../ai/connect4AI';

/**
 * Memory Stress Test Suite
 * Tests memory management under various load conditions
 */
export class MemoryStressTest {
  private readonly logger = new Logger(MemoryStressTest.name);
  private module: TestingModule | INestApplicationContext;
  private memoryService: MemoryManagementService;
  private gameService: GameService;
  private gameGateway: GameGateway;
  private activeGames: string[] = [];
  private testResults: any[] = [];

  async setup(appContext?: INestApplicationContext) {
    if (appContext) {
      // Use provided app context
      this.module = appContext;
    } else {
      // Create testing module
      this.module = await Test.createTestingModule({
        imports: [
          TestSetupModule,
          GameModule
        ],
      }).compile();
    }

    this.memoryService = this.module.get<MemoryManagementService>(MemoryManagementService);
    this.gameService = this.module.get<GameService>(GameService);
    this.gameGateway = this.module.get<GameGateway>(GameGateway);
  }

  async teardown() {
    // Clean up all games
    for (const gameId of this.activeGames) {
      try {
        // Just remove the game from the service's internal map
        const game = this.gameService.getGame(gameId);
        if (game) {
          // Mark game as ended by setting winner
          (game as any).winner = 'draw';
        }
      } catch (e) {
        // Game might already be ended
      }
    }
    
    // Only close if we created the module
    if ('close' in this.module && !('listen' in this.module)) {
      await this.module.close();
    }
  }

  /**
   * Test 1: Multiple Concurrent Games
   */
  async testConcurrentGames(numGames: number = 10, difficulty: number = 30) {
    this.logger.log(`🧪 Starting concurrent games test: ${numGames} games at difficulty ${difficulty}`);
    
    const startMem = this.getMemorySnapshot();
    const startTime = Date.now();
    
    try {
      // Create games
      for (let i = 0; i < numGames; i++) {
        const gameId = await this.gameService.createGame(`player-${i}`, `client-${i}`);
        this.activeGames.push(gameId);
        
        // Set AI difficulty
        const game = this.gameService.getGame(gameId);
        if (game) {
          game.aiLevel = difficulty;
        }
      }
      
      // Simulate moves in all games
      const movePromises = [];
      for (let moveNum = 0; moveNum < 10; moveNum++) {
        for (const gameId of this.activeGames) {
          const column = Math.floor(Math.random() * 7);
          movePromises.push(
            this.simulateMove(gameId, column)
              .catch(e => this.logger.error(`Move failed: ${e.message}`))
          );
        }
        
        // Wait for all moves to complete
        await Promise.all(movePromises);
        movePromises.length = 0;
        
        // Check memory pressure
        const memStats = this.memoryService.getMemoryStats();
        this.logger.log(`Move ${moveNum + 1}: Heap ${memStats.heap.percentage.toFixed(1)}%, Tensors: ${memStats.tensorflow.tensors}`);
      }
      
      const endMem = this.getMemorySnapshot();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        test: 'concurrent_games',
        numGames,
        difficulty,
        duration,
        memoryIncrease: endMem.heapUsed - startMem.heapUsed,
        finalHeapPercentage: endMem.heapPercentage,
        finalTensorCount: endMem.tensorCount,
        success: true
      });
      
      this.logger.log(`✅ Concurrent games test completed in ${duration}ms`);
      
    } catch (error) {
      this.logger.error(`❌ Concurrent games test failed: ${error.message}`);
      this.testResults.push({
        test: 'concurrent_games',
        numGames,
        difficulty,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test 2: Memory Pressure Degradation
   */
  async testGracefulDegradation() {
    this.logger.log('🧪 Starting graceful degradation test');
    
    const results = {
      normalMode: null,
      moderateMode: null,
      highMode: null,
      criticalMode: null
    };
    
    try {
      // Test at different memory pressure levels
      const levels = ['NORMAL', 'MODERATE', 'HIGH', 'CRITICAL'];
      
      for (const level of levels) {
        // Simulate memory pressure
        await this.simulateMemoryPressure(level);
        
        // Measure AI response time
        const gameId = await this.gameService.createGame('test-player', 'test-client');
        this.activeGames.push(gameId);
        
        const startTime = Date.now();
        await this.simulateMove(gameId, 3);
        const responseTime = Date.now() - startTime;
        
        results[`${level.toLowerCase()}Mode`] = {
          level,
          responseTime,
          cacheSize: this.memoryService.getCacheManager()?.getStats().currentSize || 0,
          isLightweight: this.memoryService.isLightweightModeActive()
        };
        
        this.logger.log(`${level}: Response time ${responseTime}ms`);
      }
      
      this.testResults.push({
        test: 'graceful_degradation',
        results,
        success: true
      });
      
      this.logger.log('✅ Graceful degradation test completed');
      
    } catch (error) {
      this.logger.error(`❌ Graceful degradation test failed: ${error.message}`);
      this.testResults.push({
        test: 'graceful_degradation',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test 3: Cache Hit Rate
   */
  async testCacheEfficiency() {
    this.logger.log('🧪 Starting cache efficiency test');
    
    try {
      const gameId = await this.gameService.createGame('cache-test', 'cache-client');
      this.activeGames.push(gameId);
      
      const testBoard: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty']
      ];
      
      // Set the board state
      const game = this.gameService.getGame(gameId);
      if (game) {
        game.board = testBoard;
      }
      
      // Make the same move request multiple times
      const moveTimings = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await this.simulateMove(gameId, 3);
        moveTimings.push(Date.now() - start);
      }
      
      const cacheStats = this.memoryService.getCacheManager()?.getStats();
      
      this.testResults.push({
        test: 'cache_efficiency',
        moveTimings,
        averageTime: moveTimings.reduce((a, b) => a + b, 0) / moveTimings.length,
        cacheHitRate: cacheStats?.hitRate || 0,
        cacheSize: cacheStats?.currentSize || 0,
        success: true
      });
      
      this.logger.log('✅ Cache efficiency test completed');
      
    } catch (error) {
      this.logger.error(`❌ Cache efficiency test failed: ${error.message}`);
      this.testResults.push({
        test: 'cache_efficiency',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test 4: Emergency Cleanup
   */
  async testEmergencyCleanup() {
    this.logger.log('🧪 Starting emergency cleanup test');
    
    try {
      // Create many games to increase memory usage
      for (let i = 0; i < 20; i++) {
        const gameId = await this.gameService.createGame(`emergency-${i}`, `client-${i}`);
        this.activeGames.push(gameId);
      }
      
      const beforeCleanup = this.getMemorySnapshot();
      
      // Trigger emergency cleanup
      this.memoryService.forceCleanup();
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const afterCleanup = this.getMemorySnapshot();
      
      this.testResults.push({
        test: 'emergency_cleanup',
        memoryFreed: beforeCleanup.heapUsed - afterCleanup.heapUsed,
        tensorsFreed: beforeCleanup.tensorCount - afterCleanup.tensorCount,
        heapBefore: beforeCleanup.heapPercentage,
        heapAfter: afterCleanup.heapPercentage,
        success: true
      });
      
      this.logger.log('✅ Emergency cleanup test completed');
      
    } catch (error) {
      this.logger.error(`❌ Emergency cleanup test failed: ${error.message}`);
      this.testResults.push({
        test: 'emergency_cleanup',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(appContext?: INestApplicationContext) {
    this.logger.log('🚀 Starting memory stress test suite');
    
    await this.setup(appContext);
    
    try {
      await this.testConcurrentGames(10, 30);
      await this.testGracefulDegradation();
      await this.testCacheEfficiency();
      await this.testEmergencyCleanup();
      
      this.generateReport();
      
    } finally {
      await this.teardown();
    }
  }

  /**
   * Helper methods
   */
  private async simulateMove(gameId: string, column: number) {
    const game = this.gameService.getGame(gameId);
    if (!game) return;
    
    // Simulate player move
    await this.gameService.dropDisc(gameId, 'player', column);
    
    // AI will respond automatically
  }

  private async simulateMemoryPressure(level: string) {
    // Emit memory pressure event
    const eventEmitter = this.module.get(EventEmitter2);
    eventEmitter.emit('memory.state.changed', { level });
    
    // Wait for system to react
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private getMemorySnapshot() {
    const memInfo = process.memoryUsage();
    const stats = this.memoryService.getMemoryStats();
    
    return {
      heapUsed: memInfo.heapUsed,
      heapTotal: memInfo.heapTotal,
      heapPercentage: stats.heap.percentage,
      tensorCount: stats.tensorflow.tensors,
      timestamp: Date.now()
    };
  }

  private generateReport() {
    this.logger.log('📊 Memory Stress Test Report');
    this.logger.log('===========================');
    
    for (const result of this.testResults) {
      this.logger.log(`\n${result.test.toUpperCase()}`);
      this.logger.log(JSON.stringify(result, null, 2));
    }
    
    const successCount = this.testResults.filter(r => r.success).length;
    const totalCount = this.testResults.length;
    
    this.logger.log(`\n✅ Tests passed: ${successCount}/${totalCount}`);
  }
}

// Export function to run tests
export async function runMemoryStressTests() {
  const tester = new MemoryStressTest();
  await tester.runAllTests();
}