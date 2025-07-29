/**
 * Parallel AI Orchestrator for M1 MacBook
 * Manages worker threads to utilize all 8 cores efficiently
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { join } from 'path';
import * as os from 'os';
import { CellValue } from '../connect4AI';
import { WorkerTask, WorkerResult } from './parallel-ai-worker';

export interface ParallelComputeRequest {
  gameId: string;
  board: CellValue[][];
  player: CellValue;
  algorithms: Array<'mcts' | 'minimax' | 'neural' | 'evaluate'>;
  config?: any;
  timeout?: number;
}

export interface ParallelComputeResult {
  gameId: string;
  results: Map<string, any>;
  consensusMove?: number;
  totalComputeTime: number;
  workerUtilization: number[];
}

interface WorkerPool {
  worker: Worker;
  busy: boolean;
  taskCount: number;
  totalComputeTime: number;
}

@Injectable()
export class ParallelAIOrchestrator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ParallelAIOrchestrator.name);
  private workers: WorkerPool[] = [];
  private taskQueue: Map<string, (result: WorkerResult) => void> = new Map();
  private readonly numWorkers: number;
  private sharedArrayBuffer: SharedArrayBuffer;
  private boardView: Int32Array;

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Use all available cores on M1 (typically 8)
    this.numWorkers = Math.min(os.cpus().length, 8);
    
    // Initialize shared memory for board state
    // 6x7 board + metadata = 50 int32 values
    this.sharedArrayBuffer = new SharedArrayBuffer(50 * 4);
    this.boardView = new Int32Array(this.sharedArrayBuffer);
    
    this.logger.log(`Initializing Parallel AI Orchestrator with ${this.numWorkers} workers`);
  }

  async onModuleInit(): Promise<void> {
    await this.initializeWorkers();
    this.logger.log('✅ Parallel AI Orchestrator initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.terminateWorkers();
    this.logger.log('Parallel AI Orchestrator shut down');
  }

  private async initializeWorkers(): Promise<void> {
    const workerPath = join(__dirname, 'parallel-ai-worker.js');
    
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(workerPath, {
        workerData: {
          workerId: i,
          sharedBuffer: this.sharedArrayBuffer
        }
      });

      const workerPool: WorkerPool = {
        worker,
        busy: false,
        taskCount: 0,
        totalComputeTime: 0
      };

      // Set up message handler
      worker.on('message', (result: WorkerResult) => {
        this.handleWorkerResult(i, result);
      });

      worker.on('error', (error) => {
        this.logger.error(`Worker ${i} error:`, error);
        this.restartWorker(i);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.logger.error(`Worker ${i} exited with code ${code}`);
          this.restartWorker(i);
        }
      });

      this.workers.push(workerPool);
    }
  }

  private async terminateWorkers(): Promise<void> {
    await Promise.all(
      this.workers.map(async (workerPool) => {
        await workerPool.worker.terminate();
      })
    );
    this.workers = [];
  }

  private async restartWorker(workerId: number): Promise<void> {
    this.logger.warn(`Restarting worker ${workerId}`);
    
    const oldWorker = this.workers[workerId];
    if (oldWorker) {
      try {
        await oldWorker.worker.terminate();
      } catch (e) {
        // Worker might already be terminated
      }
    }

    const workerPath = join(__dirname, 'parallel-ai-worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        workerId,
        sharedBuffer: this.sharedArrayBuffer
      }
    });

    worker.on('message', (result: WorkerResult) => {
      this.handleWorkerResult(workerId, result);
    });

    worker.on('error', (error) => {
      this.logger.error(`Worker ${workerId} error:`, error);
    });

    this.workers[workerId] = {
      worker,
      busy: false,
      taskCount: 0,
      totalComputeTime: 0
    };
  }

  /**
   * Main entry point for parallel computation
   */
  async computeParallel(request: ParallelComputeRequest): Promise<ParallelComputeResult> {
    const startTime = performance.now();
    
    // Update shared board state
    this.updateSharedBoard(request.board);
    
    // Create tasks for each algorithm
    const tasks: Promise<WorkerResult>[] = request.algorithms.map((algorithm, index) => {
      const taskId = `${request.gameId}-${algorithm}-${index}`;
      
      const task: WorkerTask = {
        taskId,
        type: algorithm,
        board: request.board,
        player: request.player,
        config: request.config || {}
      };

      return this.submitTask(task, request.timeout);
    });

    // Wait for all tasks to complete
    const results = await Promise.all(tasks);
    
    // Process results
    const resultMap = new Map<string, any>();
    const moves: Map<number, number> = new Map(); // move -> count
    
    for (const result of results) {
      const algorithmType = result.taskId.split('-')[1];
      resultMap.set(algorithmType, result.result);
      
      // Track move consensus
      if (result.result?.move !== undefined) {
        const move = result.result.move;
        moves.set(move, (moves.get(move) || 0) + 1);
      }
    }

    // Find consensus move
    let consensusMove: number | undefined;
    let maxVotes = 0;
    
    for (const [move, votes] of moves.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        consensusMove = move;
      }
    }

    // Calculate worker utilization
    const workerUtilization = this.workers.map(w => 
      w.taskCount > 0 ? w.totalComputeTime / (w.taskCount * 1000) : 0
    );

    const totalComputeTime = performance.now() - startTime;

    // Emit metrics
    this.eventEmitter.emit('parallel.compute.complete', {
      gameId: request.gameId,
      algorithms: request.algorithms.length,
      totalComputeTime,
      consensusMove,
      workerUtilization
    });

    return {
      gameId: request.gameId,
      results: resultMap,
      consensusMove,
      totalComputeTime,
      workerUtilization
    };
  }

  /**
   * Submit a task to the worker pool
   */
  private async submitTask(task: WorkerTask, timeout?: number): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      // Find an available worker
      const workerIndex = this.findAvailableWorker();
      
      if (workerIndex === -1) {
        // All workers busy, use least loaded
        const leastLoaded = this.findLeastLoadedWorker();
        this.assignTask(leastLoaded, task, resolve, reject);
      } else {
        this.assignTask(workerIndex, task, resolve, reject);
      }

      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          reject(new Error(`Task ${task.taskId} timed out after ${timeout}ms`));
          this.taskQueue.delete(task.taskId);
        }, timeout);
      }
    });
  }

  private assignTask(
    workerIndex: number,
    task: WorkerTask,
    resolve: (result: WorkerResult) => void,
    reject: (error: Error) => void
  ): void {
    const workerPool = this.workers[workerIndex];
    
    workerPool.busy = true;
    workerPool.taskCount++;
    
    this.taskQueue.set(task.taskId, (result: WorkerResult) => {
      workerPool.busy = false;
      workerPool.totalComputeTime += result.computeTime;
      
      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    });

    workerPool.worker.postMessage(task);
  }

  private handleWorkerResult(workerId: number, result: WorkerResult): void {
    const handler = this.taskQueue.get(result.taskId);
    
    if (handler) {
      handler(result);
      this.taskQueue.delete(result.taskId);
    } else {
      this.logger.warn(`No handler found for task ${result.taskId}`);
    }
  }

  private findAvailableWorker(): number {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.workers[i].busy) {
        return i;
      }
    }
    return -1;
  }

  private findLeastLoadedWorker(): number {
    let minTasks = Infinity;
    let minIndex = 0;
    
    for (let i = 0; i < this.workers.length; i++) {
      if (this.workers[i].taskCount < minTasks) {
        minTasks = this.workers[i].taskCount;
        minIndex = i;
      }
    }
    
    return minIndex;
  }

  /**
   * Update shared board state for zero-copy access
   */
  private updateSharedBoard(board: CellValue[][]): void {
    let index = 0;
    
    // Store board dimensions
    this.boardView[index++] = board.length;
    this.boardView[index++] = board[0].length;
    
    // Store board state
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        const cell = board[r][c];
        this.boardView[index++] = 
          cell === 'Red' ? 1 : 
          cell === 'Yellow' ? 2 : 
          0;
      }
    }
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): {
    totalWorkers: number;
    busyWorkers: number;
    taskDistribution: number[];
    averageComputeTime: number[];
  } {
    const busyWorkers = this.workers.filter(w => w.busy).length;
    const taskDistribution = this.workers.map(w => w.taskCount);
    const averageComputeTime = this.workers.map(w => 
      w.taskCount > 0 ? w.totalComputeTime / w.taskCount : 0
    );

    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      taskDistribution,
      averageComputeTime
    };
  }

  /**
   * Run ensemble computation with multiple algorithms
   */
  async runEnsemble(
    board: CellValue[][],
    player: CellValue,
    config?: any
  ): Promise<{
    bestMove: number;
    confidence: number;
    algorithmVotes: Map<string, number>;
  }> {
    const request: ParallelComputeRequest = {
      gameId: `ensemble-${Date.now()}`,
      board,
      player,
      algorithms: ['mcts', 'minimax', 'neural', 'evaluate'],
      config,
      timeout: 5000
    };

    const result = await this.computeParallel(request);
    
    // Aggregate results
    const algorithmVotes = new Map<string, number>();
    
    for (const [algorithm, data] of result.results.entries()) {
      if (data?.move !== undefined) {
        algorithmVotes.set(algorithm, data.move);
      }
    }

    const confidence = result.consensusMove !== undefined ? 
      Array.from(algorithmVotes.values()).filter(m => m === result.consensusMove).length / 
      algorithmVotes.size : 0;

    return {
      bestMove: result.consensusMove || 0,
      confidence,
      algorithmVotes
    };
  }
}