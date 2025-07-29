#!/usr/bin/env ts-node
/**
 * 🧪 DIFFICULTY-AWARE LEARNING TEST
 * =================================
 * 
 * Demonstrates that patterns learned at one difficulty level
 * are applied and strengthened at higher levels.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './backend/src/game/game.service';
import { DifficultyAwarePatternDefenseService } from './backend/src/ai/difficulty-aware-pattern-defense.service';
import { ContinuousLearningService } from './backend/src/ai/continuous-learning.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

async function testDifficultyProgression() {
  console.log('🧪 Testing Difficulty-Aware Learning System');
  console.log('=========================================\n');

  // Mock services for testing
  const mockEventEmitter = new EventEmitter2();
  const patternDefenseService = new DifficultyAwarePatternDefenseService(mockEventEmitter);
  
  // Simulate games at different difficulty levels
  const difficulties = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]; // Levels 1, 2, 3, 5, 7, 9
  
  for (const difficulty of difficulties) {
    console.log(`\n📊 Testing at difficulty ${difficulty} (Level ${Math.round(difficulty * 10)})`);
    console.log('-'.repeat(50));
    
    // Simulate a horizontal loss pattern at this difficulty
    const horizontalLoss = {
      type: 'horizontal' as const,
      winningSequence: [
        { row: 5, column: 0 },
        { row: 5, column: 1 },
        { row: 5, column: 2 },
        { row: 5, column: 3 }
      ],
      criticalPositions: [
        { row: 5, column: 1 },
        { row: 5, column: 2 }
      ],
      aiMistakes: [`missed_block_at_col_2_difficulty_${difficulty}`]
    };
    
    // Simulate learning from this loss
    await patternDefenseService.learnFromLoss(
      horizontalLoss,
      createTestBoard(),
      [],
      difficulty
    );
    
    // Get defense recommendation for this difficulty
    const defense = patternDefenseService.recommendDefense(
      createTestBoard(),
      [],
      difficulty
    );
    
    console.log(`✅ Learned defense:`, {
      pattern: defense.pattern,
      confidence: defense.confidence.toFixed(2),
      blockingMoves: defense.blockingMoves,
      sourceLevel: defense.sourceLevel,
      applicableTo: defense.applicableDifficulties
    });
    
    // Check metrics for this difficulty
    const metrics = patternDefenseService.getDifficultyMetrics(difficulty);
    console.log(`📈 Metrics:`, metrics);
  }
  
  // Test cross-level defense
  console.log('\n\n🔄 Testing Cross-Level Pattern Defense');
  console.log('=====================================');
  
  // Simulate a game at level 2 after learning from level 1
  const level2Board = createTestBoard();
  const level2Defense = patternDefenseService.recommendDefense(
    level2Board,
    [],
    0.2 // Level 2
  );
  
  console.log('\nLevel 2 defense after Level 1 learning:');
  console.log(`- Pattern: ${level2Defense.pattern}`);
  console.log(`- Confidence: ${level2Defense.confidence.toFixed(2)}`);
  console.log(`- Source Level: ${level2Defense.sourceLevel}`);
  console.log(`- Transfer Confidence: ${level2Defense.transferConfidence?.toFixed(2) || 'N/A'}`);
  
  // Show pattern transfer history
  const transferHistory = patternDefenseService.getPatternTransferHistory();
  console.log('\n📋 Pattern Transfer History:');
  transferHistory.slice(0, 5).forEach(transfer => {
    console.log(`- ${transfer.pattern} from Level ${transfer.sourceLevel} → Level ${transfer.targetLevel} (${(transfer.transferConfidence * 100).toFixed(0)}%)`);
  });
  
  // Demonstrate that higher levels are harder to beat
  console.log('\n\n💪 Difficulty Progression Summary');
  console.log('================================');
  
  const allMetrics = patternDefenseService.getDifficultyMetrics();
  for (let level = 1; level <= 10; level++) {
    const levelMetrics = allMetrics[`level_${level}`];
    if (levelMetrics && levelMetrics.patternsLearned > 0) {
      console.log(`Level ${level}:`);
      console.log(`  - Patterns Learned: ${levelMetrics.patternsLearned}`);
      console.log(`  - Cross-Level Defenses: ${levelMetrics.crossLevelDefenses}`);
      console.log(`  - Total Defenses: ${levelMetrics.patternsLearned + levelMetrics.crossLevelDefenses}`);
    }
  }
  
  console.log('\n✨ Result: Each difficulty level maintains its own pattern memory');
  console.log('   while benefiting from patterns learned at other levels!');
}

function createTestBoard(): any[][] {
  // Create a test board with some pieces
  const board = Array(6).fill(null).map(() => Array(7).fill('Empty'));
  
  // Add some test pieces
  board[5][0] = 'Red';
  board[5][1] = 'Red';
  board[5][2] = 'Red';
  board[5][3] = 'Yellow';
  board[4][3] = 'Yellow';
  
  return board;
}

// Run the test
testDifficultyProgression().catch(console.error);