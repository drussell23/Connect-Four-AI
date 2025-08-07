/**
 * 🧹 Shared Tensor Operations Helper
 * 
 * Ensures consistent tensor management across all AI modules
 * with automatic cleanup to prevent memory leaks
 */

import * as tf from '@tensorflow/tfjs';
import { Logger } from '@nestjs/common';

export class TensorOps {
  private static readonly logger = new Logger('TensorOps');
  
  /**
   * Execute any tensor operation with automatic cleanup
   * @param name Operation name for logging
   * @param fn Function that performs tensor operations
   * @returns Result of the operation with intermediate tensors cleaned up
   */
  static tidy<T extends tf.TensorContainer>(
    name: string,
    fn: () => T
  ): T {
    const startTensors = tf.memory().numTensors;
    
    try {
      const result = tf.tidy(fn);
      
      const endTensors = tf.memory().numTensors;
      const cleaned = startTensors - endTensors + 1; // +1 for the result
      
      if (cleaned > 10) {
        this.logger.debug(`${name}: cleaned ${cleaned} intermediate tensors`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`${name}: tensor operation failed`, error);
      throw error;
    }
  }
  
  /**
   * Run model prediction with automatic cleanup
   */
  static predict(
    model: tf.LayersModel,
    input: tf.Tensor,
    name: string = 'prediction'
  ): tf.Tensor {
    return this.tidy(`${name}:predict`, () => {
      const prediction = model.predict(input) as tf.Tensor;
      return prediction;
    });
  }
  
  /**
   * Run batch prediction with automatic cleanup
   */
  static batchPredict(
    model: tf.LayersModel,
    inputs: tf.Tensor[],
    batchSize: number = 32,
    name: string = 'batchPrediction'
  ): tf.Tensor[] {
    const results: tf.Tensor[] = [];
    
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      
      const batchResult = this.tidy(`${name}:batch${i}`, () => {
        const stacked = tf.stack(batch);
        const predictions = model.predict(stacked) as tf.Tensor;
        const unstacked = tf.unstack(predictions);
        
        // Clean up intermediate tensors
        stacked.dispose();
        predictions.dispose();
        
        return unstacked;
      });
      
      results.push(...batchResult);
      
      // Dispose batch inputs
      batch.forEach(t => t.dispose());
    }
    
    return results;
  }
  
  /**
   * Create training batch with automatic cleanup
   */
  static createTrainingBatch(
    states: number[][][],
    actions: number[],
    rewards: number[],
    nextStates: number[][][],
    dones: boolean[],
    name: string = 'trainingBatch'
  ): {
    statesTensor: tf.Tensor;
    actionsTensor: tf.Tensor;
    rewardsTensor: tf.Tensor;
    nextStatesTensor: tf.Tensor;
    donesTensor: tf.Tensor;
  } {
    return this.tidy(`${name}:create`, () => {
      const statesTensor = tf.tensor(states);
      const actionsTensor = tf.tensor(actions, [actions.length, 1]);
      const rewardsTensor = tf.tensor(rewards, [rewards.length, 1]);
      const nextStatesTensor = tf.tensor(nextStates);
      const donesTensor = tf.tensor(dones.map(d => d ? 1.0 : 0.0), [dones.length, 1]);
      
      return {
        statesTensor,
        actionsTensor,
        rewardsTensor,
        nextStatesTensor,
        donesTensor
      };
    });
  }
  
  /**
   * Compute Q-values with cleanup
   */
  static computeQValues(
    model: tf.LayersModel,
    states: tf.Tensor,
    name: string = 'qValues'
  ): tf.Tensor {
    return this.tidy(`${name}:compute`, () => {
      return model.predict(states) as tf.Tensor;
    });
  }
  
  /**
   * Select action using epsilon-greedy with cleanup
   */
  static selectAction(
    qValues: tf.Tensor,
    epsilon: number,
    validActions: boolean[],
    name: string = 'selectAction'
  ): number {
    return this.tidy(`${name}:select`, () => {
      if (Math.random() < epsilon) {
        // Random action from valid actions
        const validIndices = validActions
          .map((valid, idx) => valid ? idx : -1)
          .filter(idx => idx >= 0);
        return validIndices[Math.floor(Math.random() * validIndices.length)];
      }
      
      // Greedy action
      const qArray = qValues.arraySync() as number[];
      let bestAction = -1;
      let bestValue = -Infinity;
      
      for (let i = 0; i < qArray.length; i++) {
        if (validActions[i] && qArray[i] > bestValue) {
          bestValue = qArray[i];
          bestAction = i;
        }
      }
      
      return bestAction;
    });
  }
  
  /**
   * Compute loss with cleanup
   */
  static computeLoss(
    predictions: tf.Tensor,
    targets: tf.Tensor,
    name: string = 'loss'
  ): tf.Scalar {
    return this.tidy(`${name}:compute`, () => {
      return tf.losses.meanSquaredError(targets, predictions) as tf.Scalar;
    });
  }
  
  /**
   * Safe tensor disposal
   */
  static dispose(tensors: tf.Tensor | tf.Tensor[]): void {
    if (Array.isArray(tensors)) {
      tensors.forEach(t => {
        if (t && !t.isDisposed) {
          t.dispose();
        }
      });
    } else if (tensors && !tensors.isDisposed) {
      tensors.dispose();
    }
  }
  
  /**
   * Convert board state to tensor with cleanup
   */
  static boardToTensor(
    board: number[][],
    name: string = 'boardTensor'
  ): tf.Tensor {
    return this.tidy(`${name}:convert`, () => {
      // Create separate channels for each player
      const player1Channel = board.map(row => 
        row.map(cell => cell === 1 ? 1 : 0)
      );
      const player2Channel = board.map(row => 
        row.map(cell => cell === 2 ? 1 : 0)
      );
      
      // Stack channels
      return tf.tensor([player1Channel, player2Channel]);
    });
  }
  
  /**
   * Memory-efficient batch processing
   */
  static async processBatchAsync<T>(
    items: T[],
    batchSize: number,
    processFn: (batch: T[]) => Promise<void>,
    name: string = 'batchProcess'
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      await processFn(batch);
      
      // Check memory pressure after each batch
      const memInfo = tf.memory();
      if (memInfo.numTensors > 500) {
        this.logger.warn(`${name}: High tensor count (${memInfo.numTensors}), forcing cleanup`);
        if (global.gc) {
          global.gc();
        }
      }
      
      // Small delay to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  /**
   * Get memory-safe batch size based on available memory
   */
  static getOptimalBatchSize(
    baseSize: number = 32,
    isM1: boolean = false,
    memoryGB: number = 16
  ): number {
    if (isM1) {
      if (memoryGB <= 8) return Math.min(baseSize, 16);
      if (memoryGB <= 16) return Math.min(baseSize, 32);
      return baseSize;
    }
    
    // Non-M1 systems
    if (memoryGB <= 8) return Math.min(baseSize, 32);
    if (memoryGB <= 16) return Math.min(baseSize, 64);
    return baseSize;
  }
}

// Export convenience functions
export const tidyPredict = TensorOps.predict.bind(TensorOps);
export const tidyBatchPredict = TensorOps.batchPredict.bind(TensorOps);
export const tidyCreateBatch = TensorOps.createTrainingBatch.bind(TensorOps);
export const tidyComputeQValues = TensorOps.computeQValues.bind(TensorOps);
export const tidySelectAction = TensorOps.selectAction.bind(TensorOps);
export const tidyBoardToTensor = TensorOps.boardToTensor.bind(TensorOps);
export const tidyOp = TensorOps.tidy.bind(TensorOps);