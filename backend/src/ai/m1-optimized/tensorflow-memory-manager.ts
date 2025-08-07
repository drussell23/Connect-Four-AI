/**
 * 🧹 TensorFlow.js Memory Manager
 * 
 * Prevents memory leaks by properly disposing tensors
 * and managing TensorFlow.js resources
 */

import * as tf from '@tensorflow/tfjs';
import { Logger } from '@nestjs/common';

export class TensorFlowMemoryManager {
  private static readonly logger = new Logger('TFMemoryManager');
  private static disposalQueue: tf.Tensor[] = [];
  private static disposalInterval: NodeJS.Timeout;
  private static isInitialized = false;
  
  /**
   * Initialize the memory manager
   */
  static initialize(intervalMs: number = 5000): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.startDisposalInterval(intervalMs);
    
    // Log initial memory state
    this.logger.log('TensorFlow Memory Manager initialized');
    this.logMemoryInfo();
  }
  
  /**
   * Execute a function with automatic tensor disposal
   */
  static tidy<T extends tf.TensorContainer>(fn: () => T): T {
    return tf.tidy(fn);
  }
  
  /**
   * Dispose a tensor immediately
   */
  static dispose(tensor: tf.Tensor | tf.Tensor[]): void {
    if (Array.isArray(tensor)) {
      tensor.forEach(t => t?.dispose());
    } else {
      tensor?.dispose();
    }
  }
  
  /**
   * Add tensor to disposal queue for batch cleanup
   */
  static queueForDisposal(tensor: tf.Tensor): void {
    if (tensor && !tensor.isDisposed) {
      this.disposalQueue.push(tensor);
    }
  }
  
  /**
   * Dispose all queued tensors
   */
  static disposeQueue(): number {
    const count = this.disposalQueue.length;
    this.disposalQueue.forEach(tensor => {
      try {
        if (!tensor.isDisposed) {
          tensor.dispose();
        }
      } catch (error) {
        // Tensor might already be disposed
      }
    });
    this.disposalQueue = [];
    return count;
  }
  
  /**
   * Get current memory info
   */
  static getMemoryInfo(): tf.MemoryInfo {
    return tf.memory();
  }
  
  /**
   * Log memory information
   */
  static logMemoryInfo(): void {
    const memInfo = this.getMemoryInfo();
    this.logger.log(`TF Memory: ${memInfo.numTensors} tensors, ${Math.round(memInfo.numBytes / 1024 / 1024)}MB`);
  }
  
  /**
   * Check if memory cleanup is needed
   */
  static checkMemoryPressure(): boolean {
    const memInfo = this.getMemoryInfo();
    const maxTensors = 1000; // Threshold for M1 Macs
    const maxMB = 500; // 500MB threshold
    
    const currentMB = memInfo.numBytes / 1024 / 1024;
    
    if (memInfo.numTensors > maxTensors || currentMB > maxMB) {
      this.logger.warn(`High TF memory usage: ${memInfo.numTensors} tensors, ${Math.round(currentMB)}MB`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Perform aggressive memory cleanup
   */
  static performCleanup(): void {
    this.logger.log('Performing TensorFlow memory cleanup...');
    
    // Dispose queued tensors
    const disposed = this.disposeQueue();
    
    // Force backend cleanup
    const backend = tf.getBackend();
    if (backend === 'webgl' || backend === 'webgpu') {
      // Force texture cleanup for GPU backends
      // Note: backendInstance is private, so we'll use memory() to track cleanup
      const beforeMem = tf.memory();
      tf.disposeVariables();
      const afterMem = tf.memory();
      this.logger.log(`Freed ${beforeMem.numTensors - afterMem.numTensors} tensors`);
    }
    
    // Log results
    this.logger.log(`Cleaned up ${disposed} tensors`);
    this.logMemoryInfo();
  }
  
  /**
   * Start automatic disposal interval
   */
  private static startDisposalInterval(intervalMs: number): void {
    this.disposalInterval = setInterval(() => {
      if (this.checkMemoryPressure()) {
        this.performCleanup();
      } else if (this.disposalQueue.length > 50) {
        // Clean up queue if it gets too large
        this.disposeQueue();
      }
    }, intervalMs);
  }
  
  /**
   * Stop the memory manager
   */
  static shutdown(): void {
    if (this.disposalInterval) {
      clearInterval(this.disposalInterval);
    }
    this.disposeQueue();
    this.isInitialized = false;
  }
  
  /**
   * Wrap a model prediction to ensure proper cleanup
   */
  static async predict<T extends tf.Tensor>(
    model: tf.LayersModel,
    input: tf.Tensor,
    processFn?: (output: tf.Tensor) => T
  ): Promise<T> {
    return this.tidy(() => {
      const output = model.predict(input) as tf.Tensor;
      
      if (processFn) {
        const result = processFn(output);
        output.dispose();
        return result;
      }
      
      return output as T;
    });
  }
  
  /**
   * Create a memory-safe batch prediction function
   */
  static createBatchPredictor(model: tf.LayersModel, maxBatchSize: number = 32) {
    return async (inputs: tf.Tensor[]): Promise<tf.Tensor[]> => {
      const results: tf.Tensor[] = [];
      
      // Process in batches to avoid memory spikes
      for (let i = 0; i < inputs.length; i += maxBatchSize) {
        const batch = inputs.slice(i, i + maxBatchSize);
        const batchTensor = tf.stack(batch);
        
        const batchResults = await this.tidy(() => {
          const predictions = model.predict(batchTensor) as tf.Tensor;
          const unstacked = tf.unstack(predictions);
          predictions.dispose();
          return unstacked;
        });
        
        results.push(...batchResults);
        
        // Dispose batch tensors
        batchTensor.dispose();
        batch.forEach(t => t.dispose());
        
        // Check memory pressure after each batch
        if (this.checkMemoryPressure()) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
          this.performCleanup();
        }
      }
      
      return results;
    };
  }
}

// Auto-initialize on import
TensorFlowMemoryManager.initialize();

// Cleanup on exit
process.on('exit', () => {
  TensorFlowMemoryManager.shutdown();
});

export const tfMemory = TensorFlowMemoryManager;