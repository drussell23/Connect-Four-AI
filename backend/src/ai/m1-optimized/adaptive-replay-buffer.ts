/**
 * 📊 Adaptive Replay Buffer
 * 
 * Memory-efficient replay buffer that automatically adjusts
 * its size based on available system memory
 */

import { Logger } from '@nestjs/common';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';

export interface Experience {
  state: number[][];
  action: number;
  reward: number;
  nextState: number[][];
  done: boolean;
  timestamp: number;
}

export class AdaptiveReplayBuffer {
  private readonly logger = new Logger('AdaptiveReplayBuffer');
  private buffer: Experience[] = [];
  private maxSize: number;
  private currentIndex: number = 0;
  private isFull: boolean = false;
  private compressionEnabled: boolean = false;
  private readonly priorityIndices: Set<number> = new Set();
  
  constructor(
    initialMaxSize?: number,
    private readonly adaptiveResize: boolean = true
  ) {
    // Get recommended buffer size based on system resources
    const config = M1PerformanceOptimizer.getOptimizationConfig();
    this.maxSize = initialMaxSize || config.recommendedSettings.replayBufferSize;
    
    this.logger.log(`Initialized with max size: ${this.maxSize}`);
    
    // Enable compression for M1 Macs with limited memory
    if (config.isM1Architecture && config.totalMemoryGB <= 8) {
      this.compressionEnabled = true;
      this.logger.log('Compression enabled for memory efficiency');
    }
    
    // Start adaptive resizing if enabled
    if (this.adaptiveResize) {
      this.startAdaptiveResizing();
    }
  }
  
  /**
   * Add experience to buffer
   */
  add(experience: Experience): void {
    // Compress state if needed
    if (this.compressionEnabled) {
      experience = this.compressExperience(experience);
    }
    
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(experience);
    } else {
      // Circular buffer - overwrite oldest
      this.buffer[this.currentIndex] = experience;
      this.isFull = true;
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.maxSize;
  }
  
  /**
   * Sample random experiences
   */
  sample(batchSize: number): Experience[] {
    const availableSize = this.isFull ? this.maxSize : this.buffer.length;
    
    if (availableSize < batchSize) {
      return [];
    }
    
    const samples: Experience[] = [];
    const indices = new Set<number>();
    
    // Prioritized sampling if available
    if (this.priorityIndices.size > 0 && this.priorityIndices.size >= batchSize / 2) {
      // Sample 50% from priority experiences
      const priorityCount = Math.floor(batchSize / 2);
      const priorityArray = Array.from(this.priorityIndices);
      
      for (let i = 0; i < priorityCount; i++) {
        const idx = priorityArray[Math.floor(Math.random() * priorityArray.length)];
        indices.add(idx);
      }
    }
    
    // Fill remaining with random sampling
    while (indices.size < batchSize) {
      const idx = Math.floor(Math.random() * availableSize);
      indices.add(idx);
    }
    
    // Collect samples
    for (const idx of indices) {
      let experience = this.buffer[idx];
      
      // Decompress if needed
      if (this.compressionEnabled) {
        experience = this.decompressExperience(experience);
      }
      
      samples.push(experience);
    }
    
    return samples;
  }
  
  /**
   * Mark experiences as high priority
   */
  markAsPriority(indices: number[]): void {
    indices.forEach(idx => {
      if (idx >= 0 && idx < this.buffer.length) {
        this.priorityIndices.add(idx);
      }
    });
    
    // Limit priority set size
    if (this.priorityIndices.size > this.maxSize / 4) {
      // Remove oldest priorities
      const toRemove = this.priorityIndices.size - Math.floor(this.maxSize / 4);
      const iterator = this.priorityIndices.values();
      for (let i = 0; i < toRemove; i++) {
        this.priorityIndices.delete(iterator.next().value);
      }
    }
  }
  
  /**
   * Get buffer statistics
   */
  getStats() {
    return {
      currentSize: this.buffer.length,
      maxSize: this.maxSize,
      isFull: this.isFull,
      compressionEnabled: this.compressionEnabled,
      priorityCount: this.priorityIndices.size,
      memoryUsageMB: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.currentIndex = 0;
    this.isFull = false;
    this.priorityIndices.clear();
    this.logger.log('Buffer cleared');
  }
  
  /**
   * Resize buffer based on memory pressure
   */
  private async adaptSize(): Promise<void> {
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const memoryPressure = memStats.heapPercentage / 100;
    
    if (memoryPressure > 0.8 && this.maxSize > 1000) {
      // High memory pressure - reduce buffer size
      const newSize = Math.floor(this.maxSize * 0.75);
      this.resize(newSize);
      this.logger.warn(`High memory pressure (${Math.round(memoryPressure * 100)}%) - reduced buffer to ${newSize}`);
    } else if (memoryPressure < 0.5 && this.maxSize < 10000) {
      // Low memory pressure - can increase buffer
      const config = M1PerformanceOptimizer.getOptimizationConfig();
      const recommendedSize = config.recommendedSettings.replayBufferSize;
      
      if (this.maxSize < recommendedSize) {
        const newSize = Math.min(this.maxSize * 1.5, recommendedSize);
        this.resize(Math.floor(newSize));
        this.logger.log(`Low memory pressure - increased buffer to ${Math.floor(newSize)}`);
      }
    }
  }
  
  /**
   * Resize the buffer
   */
  private resize(newSize: number): void {
    if (newSize === this.maxSize) return;
    
    if (newSize < this.buffer.length) {
      // Need to trim buffer
      const toRemove = this.buffer.length - newSize;
      this.buffer.splice(0, toRemove);
      this.currentIndex = 0;
      
      // Update priority indices
      const newPriorities = new Set<number>();
      this.priorityIndices.forEach(idx => {
        const newIdx = idx - toRemove;
        if (newIdx >= 0) {
          newPriorities.add(newIdx);
        }
      });
      this.priorityIndices.clear();
      newPriorities.forEach(idx => this.priorityIndices.add(idx));
    }
    
    this.maxSize = newSize;
  }
  
  /**
   * Compress experience to save memory
   */
  private compressExperience(exp: Experience): Experience {
    // Simple compression: convert board to compact representation
    // Instead of 6x7 array, use bit representation
    const compressedState = this.compressBoard(exp.state);
    const compressedNextState = this.compressBoard(exp.nextState);
    
    return {
      ...exp,
      state: compressedState as any,
      nextState: compressedNextState as any
    };
  }
  
  /**
   * Decompress experience
   */
  private decompressExperience(exp: Experience): Experience {
    if (!Array.isArray(exp.state[0])) {
      // Already compressed
      return {
        ...exp,
        state: this.decompressBoard(exp.state as any),
        nextState: this.decompressBoard(exp.nextState as any)
      };
    }
    return exp;
  }
  
  /**
   * Compress board representation
   */
  private compressBoard(board: number[][]): number[] {
    // Pack board into array of numbers
    // Each column can be represented as a single number
    const compressed: number[] = [];
    
    for (let col = 0; col < 7; col++) {
      let colValue = 0;
      for (let row = 0; row < 6; row++) {
        const cell = board[row][col];
        // 0 = empty, 1 = player1, 2 = player2
        colValue |= (cell & 0x3) << (row * 2);
      }
      compressed.push(colValue);
    }
    
    return compressed;
  }
  
  /**
   * Decompress board representation
   */
  private decompressBoard(compressed: number[]): number[][] {
    const board: number[][] = Array(6).fill(null).map(() => Array(7).fill(0));
    
    for (let col = 0; col < 7; col++) {
      const colValue = compressed[col];
      for (let row = 0; row < 6; row++) {
        board[row][col] = (colValue >> (row * 2)) & 0x3;
      }
    }
    
    return board;
  }
  
  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each experience ~1KB uncompressed, ~200B compressed
    const bytesPerExperience = this.compressionEnabled ? 200 : 1000;
    return (this.buffer.length * bytesPerExperience) / (1024 * 1024);
  }
  
  /**
   * Start adaptive resizing based on memory pressure
   */
  private startAdaptiveResizing(): void {
    setInterval(() => {
      if (this.adaptiveResize) {
        this.adaptSize();
      }
    }, 60000); // Check every minute
  }
}

export const createAdaptiveBuffer = (initialSize?: number): AdaptiveReplayBuffer => {
  return new AdaptiveReplayBuffer(initialSize, true);
};