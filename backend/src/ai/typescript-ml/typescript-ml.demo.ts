/**
 * TypeScript ML Demo
 * Demonstrates the power of TypeScript-native ML for Connect Four
 */

import { TypeScriptMLService } from './typescript-ml.service';
import { CellValue } from '../connect4AI';

/**
 * Demo class showing TypeScript ML capabilities
 */
export class TypeScriptMLDemo {
  constructor(private mlService: TypeScriptMLService) {}

  /**
   * Run comprehensive ML demo
   */
  async runDemo(): Promise<void> {
    console.log('🤖 TypeScript ML Demo for Connect Four\n');

    // Initialize the service if not already done
    await this.mlService.initialize();

    // Demo 1: Fast prediction
    await this.demoFastPrediction();

    // Demo 2: Balanced prediction
    await this.demoBalancedPrediction();

    // Demo 3: Accurate prediction with ensemble
    await this.demoAccuratePrediction();

    // Demo 4: Training with game history
    await this.demoTraining();

    // Demo 5: Complex board analysis
    await this.demoComplexAnalysis();

    console.log('\n✅ Demo completed!');
  }

  /**
   * Demo fast prediction mode
   */
  private async demoFastPrediction(): Promise<void> {
    console.log('\n📊 Demo 1: Fast Prediction Mode');
    console.log('--------------------------------');

    const board: CellValue[][] = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty', 'Empty']
    ];

    const start = performance.now();
    const result = await this.mlService.predict(board, {
      strategy: 'fast',
      timeLimit: 100
    });
    const elapsed = performance.now() - start;

    console.log(`Move: Column ${result.move}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Time: ${elapsed.toFixed(1)}ms`);
    console.log(`Models used: ${result.reasoning.modelsUsed}`);
    console.log(`Method: ${result.reasoning.ensembleMethod}`);
  }

  /**
   * Demo balanced prediction mode
   */
  private async demoBalancedPrediction(): Promise<void> {
    console.log('\n📊 Demo 2: Balanced Prediction Mode');
    console.log('-----------------------------------');

    const board: CellValue[][] = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Yellow', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty', 'Red']
    ];

    const result = await this.mlService.predict(board, {
      strategy: 'balanced'
    });

    console.log(`Move: Column ${result.move}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Value: ${result.value.toFixed(3)}`);
    console.log(`Consensus: ${(result.reasoning.consensus * 100).toFixed(1)}%`);
    
    console.log('\nModel Contributions:');
    result.modelBreakdown
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .forEach(model => {
        console.log(`  - ${model.model}: ${(model.contribution * 100).toFixed(1)}%`);
      });
  }

  /**
   * Demo accurate prediction with full ensemble
   */
  private async demoAccuratePrediction(): Promise<void> {
    console.log('\n📊 Demo 3: Accurate Prediction Mode');
    console.log('-----------------------------------');

    // Complex tactical position
    const board: CellValue[][] = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Empty', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Yellow', 'Yellow', 'Red', 'Yellow', 'Empty'],
      ['Yellow', 'Yellow', 'Red', 'Red', 'Yellow', 'Red', 'Yellow']
    ];

    const result = await this.mlService.predict(board, {
      strategy: 'accurate',
      minConfidence: 0.6
    });

    console.log(`Move: Column ${result.move}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Value: ${result.value.toFixed(3)}`);
    console.log(`Inference Time: ${result.reasoning.inferenceTime.toFixed(1)}ms`);
    console.log(`Ensemble Method: ${result.reasoning.ensembleMethod}`);
    
    // Show why this move was chosen
    console.log('\nMove Analysis:');
    if (result.move === 4) {
      console.log('  ✓ Blocks Yellow\'s winning threat');
      console.log('  ✓ Creates Red\'s own winning opportunity');
    } else if (result.move === 2) {
      console.log('  ✓ Prevents Yellow from building threats');
      console.log('  ✓ Maintains board control');
    }
  }

  /**
   * Demo training capabilities
   */
  private async demoTraining(): Promise<void> {
    console.log('\n📊 Demo 4: Model Training');
    console.log('-------------------------');

    // Generate sample training data
    const trainingData = [
      {
        board: this.createBoard([
          [3, 'Red'], [3, 'Yellow'], [4, 'Red'], [4, 'Yellow']
        ]),
        move: 2,
        outcome: 'win' as const
      },
      {
        board: this.createBoard([
          [3, 'Red'], [3, 'Yellow'], [4, 'Red'], [4, 'Yellow'],
          [2, 'Red'], [5, 'Yellow']
        ]),
        move: 1,
        outcome: 'loss' as const
      },
      {
        board: this.createBoard([
          [3, 'Red'], [4, 'Yellow'], [3, 'Red'], [4, 'Yellow'],
          [3, 'Red'], [4, 'Yellow']
        ]),
        move: 2,
        outcome: 'draw' as const
      }
    ];

    console.log(`Training with ${trainingData.length} positions...`);
    
    const start = performance.now();
    await this.mlService.train(trainingData);
    const elapsed = performance.now() - start;

    console.log(`Training completed in ${elapsed.toFixed(1)}ms`);
    console.log('Models have been updated with new game knowledge');
  }

  /**
   * Demo complex board analysis
   */
  private async demoComplexAnalysis(): Promise<void> {
    console.log('\n📊 Demo 5: Complex Board Analysis');
    console.log('---------------------------------');

    // Create a position with multiple threats
    const board: CellValue[][] = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Red', 'Yellow']
    ];

    console.log('Analyzing complex position with multiple threats...\n');

    // Get predictions with different strategies
    const strategies: Array<'fast' | 'balanced' | 'accurate'> = ['fast', 'balanced', 'accurate'];
    const predictions = await Promise.all(
      strategies.map(strategy => 
        this.mlService.predict(board, { strategy })
      )
    );

    // Compare results
    console.log('Strategy Comparison:');
    strategies.forEach((strategy, idx) => {
      const pred = predictions[idx];
      console.log(`  ${strategy.padEnd(8)} - Move: ${pred.move}, ` +
                  `Confidence: ${(pred.confidence * 100).toFixed(1)}%, ` +
                  `Time: ${pred.reasoning.inferenceTime.toFixed(1)}ms`);
    });

    // Show consensus
    const moves = predictions.map(p => p.move);
    const uniqueMoves = new Set(moves);
    
    console.log(`\nConsensus: ${uniqueMoves.size === 1 ? 'Strong' : 'Weak'} ` +
                `(${uniqueMoves.size} different moves suggested)`);

    // Get service status
    const status = this.mlService.getStatus();
    console.log('\nML Service Status:');
    console.log(`  Models loaded: ${status.models.length}`);
    console.log(`  Ensemble members: ${status.ensembleMembers}`);
    console.log(`  Cache hit rate: ${(status.performance.cacheHitRate * 100).toFixed(1)}%`);
  }

  /**
   * Helper to create board from moves
   */
  private createBoard(moves: Array<[number, 'Red' | 'Yellow']>): CellValue[][] {
    const board: CellValue[][] = Array(6).fill(null).map(() => 
      Array(7).fill('Empty')
    );

    moves.forEach(([col, player]) => {
      // Find lowest empty row in column
      for (let row = 5; row >= 0; row--) {
        if (board[row][col] === 'Empty') {
          board[row][col] = player;
          break;
        }
      }
    });

    return board;
  }
}

/**
 * Example usage
 */
export async function runTypescriptMLDemo(mlService: TypeScriptMLService): Promise<void> {
  const demo = new TypeScriptMLDemo(mlService);
  await demo.runDemo();
}