import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import * as tf from '@tensorflow/tfjs';
import { SimpleAIService } from '../simple-ai.service';
import { UnifiedAISystem } from '../unified/unified-ai-system-simple';
import { AdaptiveAIOrchestrator } from '../adaptive/adaptive-ai-orchestrator';
import { AsyncAIOrchestrator } from '../async/async-ai-orchestrator';
import { LightweightInferenceService } from '../m1-optimized/lightweight-inference.service';
import { CellValue } from '../connect4AI';

export interface AlgorithmProfile {
  algorithm: string;
  duration: number;
  memoryUsed: number;
  tensorsBefore: number;
  tensorsAfter: number;
  tensorsCreated: number;
  result: {
    column: number;
    confidence?: number;
    strategy?: string;
  };
  metadata: {
    boardComplexity: number;
    moveNumber: number;
    difficulty: number;
  };
}

export interface ProfileReport {
  timestamp: Date;
  totalAlgorithms: number;
  profiles: AlgorithmProfile[];
  summary: {
    fastestAlgorithm: string;
    slowestAlgorithm: string;
    mostMemoryEfficient: string;
    leastMemoryEfficient: string;
    averageDuration: number;
    averageMemoryUsed: number;
  };
}

@Injectable()
export class AlgorithmProfiler {
  private readonly logger = new Logger(AlgorithmProfiler.name);
  private profiles: AlgorithmProfile[] = [];
  
  constructor(
    private readonly simpleAI?: SimpleAIService,
    private readonly unifiedAI?: UnifiedAISystem,
    private readonly adaptiveAI?: AdaptiveAIOrchestrator,
    private readonly asyncAI?: AsyncAIOrchestrator,
    private readonly lightweightAI?: LightweightInferenceService
  ) {}

  /**
   * Profile a single algorithm
   */
  async profileAlgorithm(
    name: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number = 5
  ): Promise<AlgorithmProfile> {
    this.logger.log(`Profiling algorithm: ${name}`);
    
    const boardComplexity = this.calculateBoardComplexity(board);
    const moveNumber = board.flat().filter(cell => cell !== 'Empty').length;
    
    // Memory and tensor snapshot before
    const memBefore = process.memoryUsage();
    const tensorsBefore = tf.memory().numTensors;
    const start = performance.now();
    
    let result: any;
    try {
      result = await this.runAlgorithm(name, board, player, difficulty);
    } catch (error) {
      this.logger.error(`Algorithm ${name} failed: ${error.message}`);
      result = { column: -1, error: error.message };
    }
    
    // Memory and tensor snapshot after
    const duration = performance.now() - start;
    const memAfter = process.memoryUsage();
    const tensorsAfter = tf.memory().numTensors;
    
    const profile: AlgorithmProfile = {
      algorithm: name,
      duration,
      memoryUsed: memAfter.heapUsed - memBefore.heapUsed,
      tensorsBefore,
      tensorsAfter,
      tensorsCreated: tensorsAfter - tensorsBefore,
      result,
      metadata: {
        boardComplexity,
        moveNumber,
        difficulty
      }
    };
    
    this.profiles.push(profile);
    return profile;
  }

  /**
   * Profile all available algorithms
   */
  async profileAllAlgorithms(
    board: CellValue[][],
    player: CellValue,
    difficulty: number = 5
  ): Promise<ProfileReport> {
    this.logger.log('Starting comprehensive algorithm profiling...');
    
    const algorithms = this.getAvailableAlgorithms();
    const profiles: AlgorithmProfile[] = [];
    
    for (const algorithm of algorithms) {
      try {
        const profile = await this.profileAlgorithm(algorithm, board, player, difficulty);
        profiles.push(profile);
        
        // Add delay between algorithms to let system stabilize
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        this.logger.error(`Failed to profile ${algorithm}: ${error.message}`);
      }
    }
    
    return this.generateReport(profiles);
  }

  /**
   * Benchmark algorithms under different conditions
   */
  async benchmarkAlgorithms(): Promise<void> {
    this.logger.log('🏃 Starting algorithm benchmark suite');
    
    const testScenarios = [
      {
        name: 'Empty Board',
        board: this.createEmptyBoard(),
        player: 'Yellow' as CellValue
      },
      {
        name: 'Mid Game',
        board: this.createMidGameBoard(),
        player: 'Yellow' as CellValue
      },
      {
        name: 'Complex Position',
        board: this.createComplexBoard(),
        player: 'Yellow' as CellValue
      },
      {
        name: 'Endgame',
        board: this.createEndgameBoard(),
        player: 'Yellow' as CellValue
      }
    ];
    
    const difficulties = [1, 5, 10, 20, 30];
    
    for (const scenario of testScenarios) {
      this.logger.log(`\n📋 Scenario: ${scenario.name}`);
      
      for (const difficulty of difficulties) {
        this.logger.log(`  Difficulty: ${difficulty}`);
        
        const report = await this.profileAllAlgorithms(
          scenario.board,
          scenario.player,
          difficulty
        );
        
        this.logBenchmarkResults(scenario.name, difficulty, report);
      }
    }
    
    this.generateFinalBenchmarkReport();
  }

  /**
   * Compare algorithms head-to-head
   */
  async compareAlgorithms(
    algorithm1: string,
    algorithm2: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number = 5
  ): Promise<void> {
    this.logger.log(`⚔️ Head-to-head: ${algorithm1} vs ${algorithm2}`);
    
    const profile1 = await this.profileAlgorithm(algorithm1, board, player, difficulty);
    const profile2 = await this.profileAlgorithm(algorithm2, board, player, difficulty);
    
    this.logger.log('\n📊 Comparison Results:');
    this.logger.log(`Algorithm: ${algorithm1}`);
    this.logger.log(`  - Duration: ${profile1.duration.toFixed(2)}ms`);
    this.logger.log(`  - Memory: ${(profile1.memoryUsed / 1024).toFixed(2)}KB`);
    this.logger.log(`  - Move: Column ${profile1.result.column}`);
    this.logger.log(`  - Confidence: ${profile1.result.confidence?.toFixed(3) || 'N/A'}`);
    
    this.logger.log(`\nAlgorithm: ${algorithm2}`);
    this.logger.log(`  - Duration: ${profile2.duration.toFixed(2)}ms`);
    this.logger.log(`  - Memory: ${(profile2.memoryUsed / 1024).toFixed(2)}KB`);
    this.logger.log(`  - Move: Column ${profile2.result.column}`);
    this.logger.log(`  - Confidence: ${profile2.result.confidence?.toFixed(3) || 'N/A'}`);
    
    const speedup = profile1.duration / profile2.duration;
    const memoryRatio = profile1.memoryUsed / profile2.memoryUsed;
    
    this.logger.log('\n🏆 Winner:');
    this.logger.log(`  - Speed: ${speedup > 1 ? algorithm2 : algorithm1} (${(Math.abs(speedup - 1) * 100).toFixed(1)}% ${speedup > 1 ? 'faster' : 'slower'})`);
    this.logger.log(`  - Memory: ${memoryRatio > 1 ? algorithm2 : algorithm1} (${(Math.abs(memoryRatio - 1) * 100).toFixed(1)}% ${memoryRatio > 1 ? 'more' : 'less'} efficient)`);
  }

  /**
   * Run algorithm based on name
   */
  private async runAlgorithm(
    name: string,
    board: CellValue[][],
    player: CellValue,
    difficulty: number
  ): Promise<any> {
    switch (name) {
      case 'simple-ai':
        if (!this.simpleAI) throw new Error('SimpleAI not available');
        const column = await this.simpleAI.getBestMove(board as any, player as any, difficulty.toString());
        return { column, confidence: 0.8 };
        
      case 'unified-ai':
        if (!this.unifiedAI) throw new Error('UnifiedAI not available');
        const unifiedConfig = { 
          difficulty, 
          timeLimit: 5000,
          useCache: true 
        };
        const decision = await this.unifiedAI.makeMove(board as any, player as any, unifiedConfig);
        return { 
          column: decision.move, 
          confidence: decision.confidence,
          strategy: decision.strategy 
        };
        
      case 'adaptive-ai':
        if (!this.adaptiveAI) throw new Error('AdaptiveAI not available');
        const adaptiveMove = await this.adaptiveAI.computeAdaptiveMove(
          'test-game',
          board as any,
          player as any,
          difficulty
        );
        return { 
          column: adaptiveMove.column,
          confidence: adaptiveMove.confidence || 0.85,
          strategy: adaptiveMove.explanation || 'adaptive'
        };
        
      case 'async-ai':
        if (!this.asyncAI) throw new Error('AsyncAI not available');
        const asyncMove = await this.asyncAI.getAIMove({
          gameId: 'test-game',
          board: board as any,
          player: player as any,
          difficulty,
          timeLimit: 5000
        });
        return {
          column: asyncMove.move,
          confidence: asyncMove.confidence || 0.9,
          strategy: asyncMove.strategy || 'async'
        };
        
      case 'lightweight-ai':
        if (!this.lightweightAI) throw new Error('LightweightAI not available');
        const lightMove = await this.lightweightAI.getBestMove(board as any);
        return {
          column: lightMove,
          confidence: 0.75,
          strategy: 'lightweight'
        };
        
      default:
        throw new Error(`Unknown algorithm: ${name}`);
    }
  }

  /**
   * Get list of available algorithms
   */
  private getAvailableAlgorithms(): string[] {
    const algorithms = [];
    
    if (this.simpleAI) algorithms.push('simple-ai');
    if (this.unifiedAI) algorithms.push('unified-ai');
    if (this.adaptiveAI) algorithms.push('adaptive-ai');
    if (this.asyncAI) algorithms.push('async-ai');
    if (this.lightweightAI) algorithms.push('lightweight-ai');
    
    return algorithms;
  }

  /**
   * Calculate board complexity (0-1)
   */
  private calculateBoardComplexity(board: CellValue[][]): number {
    const pieces = board.flat().filter(cell => cell !== 'Empty').length;
    const maxPieces = 42;
    
    // Basic complexity based on number of pieces
    const fillRatio = pieces / maxPieces;
    
    // Additional complexity for patterns
    let patternComplexity = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] !== 'Empty') {
          // Check for potential threats
          const threats = this.countThreats(board, row, col);
          patternComplexity += threats * 0.1;
        }
      }
    }
    
    return Math.min(1, fillRatio + patternComplexity);
  }

  /**
   * Count threats around a position
   */
  private countThreats(board: CellValue[][], row: number, col: number): number {
    let threats = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let consecutive = 1;
      
      // Check positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === board[row][col]) {
        consecutive++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === board[row][col]) {
        consecutive++;
        r -= dr;
        c -= dc;
      }
      
      if (consecutive >= 3) threats++;
    }
    
    return threats;
  }

  /**
   * Generate profiling report
   */
  private generateReport(profiles: AlgorithmProfile[]): ProfileReport {
    const validProfiles = profiles.filter(p => p.result.column !== -1);
    
    if (validProfiles.length === 0) {
      return {
        timestamp: new Date(),
        totalAlgorithms: profiles.length,
        profiles,
        summary: {
          fastestAlgorithm: 'N/A',
          slowestAlgorithm: 'N/A',
          mostMemoryEfficient: 'N/A',
          leastMemoryEfficient: 'N/A',
          averageDuration: 0,
          averageMemoryUsed: 0
        }
      };
    }
    
    const sortedBySpeed = [...validProfiles].sort((a, b) => a.duration - b.duration);
    const sortedByMemory = [...validProfiles].sort((a, b) => a.memoryUsed - b.memoryUsed);
    
    const totalDuration = validProfiles.reduce((sum, p) => sum + p.duration, 0);
    const totalMemory = validProfiles.reduce((sum, p) => sum + p.memoryUsed, 0);
    
    return {
      timestamp: new Date(),
      totalAlgorithms: profiles.length,
      profiles,
      summary: {
        fastestAlgorithm: sortedBySpeed[0].algorithm,
        slowestAlgorithm: sortedBySpeed[sortedBySpeed.length - 1].algorithm,
        mostMemoryEfficient: sortedByMemory[0].algorithm,
        leastMemoryEfficient: sortedByMemory[sortedByMemory.length - 1].algorithm,
        averageDuration: totalDuration / validProfiles.length,
        averageMemoryUsed: totalMemory / validProfiles.length
      }
    };
  }

  /**
   * Log benchmark results
   */
  private logBenchmarkResults(scenario: string, difficulty: number, report: ProfileReport): void {
    this.logger.log(`    Results for ${scenario} @ difficulty ${difficulty}:`);
    this.logger.log(`      Fastest: ${report.summary.fastestAlgorithm}`);
    this.logger.log(`      Most Memory Efficient: ${report.summary.mostMemoryEfficient}`);
    this.logger.log(`      Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);
  }

  /**
   * Generate final benchmark report
   */
  private generateFinalBenchmarkReport(): void {
    this.logger.log('\n📈 Final Benchmark Report');
    this.logger.log('========================');
    
    // Group profiles by algorithm
    const algorithmStats = new Map<string, {
      totalRuns: number;
      totalDuration: number;
      totalMemory: number;
      wins: number;
    }>();
    
    for (const profile of this.profiles) {
      const stats = algorithmStats.get(profile.algorithm) || {
        totalRuns: 0,
        totalDuration: 0,
        totalMemory: 0,
        wins: 0
      };
      
      stats.totalRuns++;
      stats.totalDuration += profile.duration;
      stats.totalMemory += profile.memoryUsed;
      
      algorithmStats.set(profile.algorithm, stats);
    }
    
    // Calculate and display averages
    for (const [algorithm, stats] of algorithmStats) {
      this.logger.log(`\n${algorithm}:`);
      this.logger.log(`  Average Duration: ${(stats.totalDuration / stats.totalRuns).toFixed(2)}ms`);
      this.logger.log(`  Average Memory: ${(stats.totalMemory / stats.totalRuns / 1024).toFixed(2)}KB`);
      this.logger.log(`  Total Runs: ${stats.totalRuns}`);
    }
  }

  /**
   * Test board generators
   */
  private createEmptyBoard(): CellValue[][] {
    return Array(6).fill(null).map(() => Array(7).fill('Empty'));
  }

  private createMidGameBoard(): CellValue[][] {
    const board = this.createEmptyBoard();
    // Add some pieces
    board[5][3] = 'Red';
    board[5][4] = 'Yellow';
    board[4][3] = 'Yellow';
    board[4][4] = 'Red';
    board[5][2] = 'Red';
    board[5][5] = 'Yellow';
    return board;
  }

  private createComplexBoard(): CellValue[][] {
    const board = this.createEmptyBoard();
    // Create a complex position with multiple threats
    const moves = [
      [5, 3, 'Red'], [5, 4, 'Yellow'], [4, 3, 'Yellow'], [4, 4, 'Red'],
      [3, 3, 'Red'], [5, 2, 'Yellow'], [5, 5, 'Red'], [4, 2, 'Red'],
      [3, 2, 'Yellow'], [4, 5, 'Yellow'], [3, 4, 'Red'], [2, 3, 'Yellow'],
      [5, 1, 'Red'], [5, 6, 'Yellow'], [4, 1, 'Yellow'], [4, 6, 'Red']
    ];
    
    for (const [row, col, player] of moves) {
      board[row as number][col as number] = player as CellValue;
    }
    
    return board;
  }

  private createEndgameBoard(): CellValue[][] {
    const board = this.createEmptyBoard();
    // Fill most of the board
    for (let col = 0; col < 7; col++) {
      for (let row = 5; row >= 1; row--) {
        board[row][col] = (row + col) % 2 === 0 ? 'Red' : 'Yellow';
      }
    }
    // Leave top row mostly empty
    board[0][3] = 'Red';
    return board;
  }
}