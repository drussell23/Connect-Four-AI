/**
 * AI Service Worker for Background Computation
 * Handles AI computations in the background with precomputation
 */

/// <reference lib="webworker" />

import { CellValue } from '../connect4AI';

// For Web Worker context (not Service Worker)
declare const self: DedicatedWorkerGlobalScope;

interface WorkerMessage {
  type: 'compute' | 'precompute' | 'batch' | 'train' | 'cache' | 'model';
  id: string;
  data: any;
}

interface ComputeRequest {
  board: CellValue[][];
  player: 'Red' | 'Yellow';
  depth?: number;
  timeLimit?: number;
  modelId?: string;
}

interface PrecomputeRequest {
  boards: CellValue[][][];
  depths: number[];
  priority?: number;
}

interface ModelCache {
  id: string;
  weights: ArrayBuffer;
  type: 'onnx' | 'tfjs' | 'wasm';
  loaded: boolean;
  session?: any;
}

class AIWorker {
  private models: Map<string, ModelCache> = new Map();
  private computeQueue: Array<{ request: WorkerMessage; priority: number }> = [];
  private precomputeCache: Map<string, any> = new Map();
  private wasmModule: WebAssembly.Module | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;
  private isProcessing = false;
  private maxCacheSize = 10000;
  private workerPool: Worker[] = [];
  private readonly maxWorkers = navigator.hardwareConcurrency || 4;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('AI Worker initialized with', this.maxWorkers, 'logical cores');
    
    // Load WASM module
    await this.loadWasmModule();
    
    // Create sub-workers for parallel processing
    this.createWorkerPool();
    
    // Start processing queue
    this.processQueue();
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(event: ExtendableMessageEvent) {
    const message = event.data as WorkerMessage;
    
    try {
      switch (message.type) {
        case 'compute':
          await this.handleCompute(message);
          break;
          
        case 'precompute':
          await this.handlePrecompute(message);
          break;
          
        case 'batch':
          await this.handleBatch(message);
          break;
          
        case 'train':
          await this.handleTrain(message);
          break;
          
        case 'cache':
          await this.handleCache(message);
          break;
          
        case 'model':
          await this.handleModel(message);
          break;
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      (self as any).postMessage({
        id: message.id,
        error: error.message,
        type: 'error'
      });
    }
  }

  /**
   * Compute next move
   */
  private async handleCompute(message: WorkerMessage) {
    const request = message.data as ComputeRequest;
    
    // Check cache first
    const cacheKey = this.getBoardHash(request.board);
    const cached = this.precomputeCache.get(cacheKey);
    
    if (cached && cached.depth >= (request.depth || 5)) {
      (self as any).postMessage({
        id: message.id,
        type: 'result',
        data: {
          move: cached.move,
          evaluation: cached.evaluation,
          fromCache: true,
          computeTime: 0
        }
      });
      return;
    }
    
    // Add to compute queue
    this.computeQueue.push({
      request: message,
      priority: request.depth || 5
    });
    
    // Sort by priority
    this.computeQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Precompute positions
   */
  private async handlePrecompute(message: WorkerMessage) {
    const request = message.data as PrecomputeRequest;
    
    // Add positions to precompute queue
    for (let i = 0; i < request.boards.length; i++) {
      const board = request.boards[i];
      const depth = request.depths[i] || 5;
      
      this.computeQueue.push({
        request: {
          id: `precompute_${message.id}_${i}`,
          type: 'compute',
          data: {
            board,
            player: this.getCurrentPlayer(board),
            depth,
            isPrecompute: true
          }
        },
        priority: request.priority || 1
      });
    }
    
    (self as any).postMessage({
      id: message.id,
      type: 'acknowledged',
      data: { queued: request.boards.length }
    });
  }

  /**
   * Handle batch computation
   */
  private async handleBatch(message: WorkerMessage) {
    const boards = message.data.boards as CellValue[][][];
    const results: any[] = [];
    
    // Distribute work across worker pool
    const chunkSize = Math.ceil(boards.length / this.workerPool.length);
    const promises: Promise<any>[] = [];
    
    for (let i = 0; i < this.workerPool.length; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, boards.length);
      const chunk = boards.slice(start, end);
      
      if (chunk.length > 0) {
        promises.push(this.computeOnWorker(i, chunk));
      }
    }
    
    // Wait for all workers to complete
    const chunkResults = await Promise.all(promises);
    
    // Combine results
    for (const chunk of chunkResults) {
      results.push(...chunk);
    }
    
    (self as any).postMessage({
      id: message.id,
      type: 'batch-result',
      data: results
    });
  }

  /**
   * Handle training request
   */
  private async handleTrain(message: WorkerMessage) {
    const { examples, modelType, epochs } = message.data;
    
    // Simple training simulation
    // In reality, would use TensorFlow.js or other ML library
    const progress = { epoch: 0, loss: 1.0 };
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Simulate training
      await new Promise(resolve => setTimeout(resolve, 100));
      
      progress.epoch = epoch + 1;
      progress.loss *= 0.9;
      
      // Send progress update
      (self as any).postMessage({
        id: message.id,
        type: 'training-progress',
        data: progress
      });
    }
    
    // "Save" trained model
    const modelWeights = new ArrayBuffer(1024 * 1024); // 1MB dummy weights
    
    (self as any).postMessage({
      id: message.id,
      type: 'training-complete',
      data: {
        modelId: `model_${Date.now()}`,
        weights: modelWeights,
        finalLoss: progress.loss
      }
    });
  }

  /**
   * Handle cache operations
   */
  private async handleCache(message: WorkerMessage) {
    const { operation, key, value } = message.data;
    
    switch (operation) {
      case 'get':
        const cached = this.precomputeCache.get(key);
        (self as any).postMessage({
          id: message.id,
          type: 'cache-result',
          data: cached
        });
        break;
        
      case 'set':
        this.precomputeCache.set(key, value);
        this.pruneCache();
        (self as any).postMessage({
          id: message.id,
          type: 'cache-set',
          data: { success: true }
        });
        break;
        
      case 'clear':
        this.precomputeCache.clear();
        (self as any).postMessage({
          id: message.id,
          type: 'cache-cleared',
          data: { success: true }
        });
        break;
        
      case 'stats':
        (self as any).postMessage({
          id: message.id,
          type: 'cache-stats',
          data: {
            size: this.precomputeCache.size,
            maxSize: this.maxCacheSize
          }
        });
        break;
    }
  }

  /**
   * Handle model operations
   */
  private async handleModel(message: WorkerMessage) {
    const { operation, modelId, weights, type } = message.data;
    
    switch (operation) {
      case 'load':
        await this.loadModel(modelId, weights, type);
        (self as any).postMessage({
          id: message.id,
          type: 'model-loaded',
          data: { modelId }
        });
        break;
        
      case 'unload':
        this.models.delete(modelId);
        (self as any).postMessage({
          id: message.id,
          type: 'model-unloaded',
          data: { modelId }
        });
        break;
        
      case 'list':
        const modelList = Array.from(this.models.keys());
        (self as any).postMessage({
          id: message.id,
          type: 'model-list',
          data: modelList
        });
        break;
    }
  }

  /**
   * Process compute queue
   */
  private async processQueue() {
    while (true) {
      if (this.computeQueue.length === 0 || this.isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      this.isProcessing = true;
      const item = this.computeQueue.shift()!;
      
      try {
        const result = await this.computeMove(item.request.data);
        
        // Cache result
        const cacheKey = this.getBoardHash(item.request.data.board);
        this.precomputeCache.set(cacheKey, {
          ...result,
          depth: item.request.data.depth || 5,
          timestamp: Date.now()
        });
        
        // Send result if not precompute
        if (!item.request.data.isPrecompute) {
          (self as any).postMessage({
            id: item.request.id,
            type: 'result',
            data: result
          });
        }
        
        this.pruneCache();
        
      } catch (error) {
        console.error('Compute error:', error);
        
        if (!item.request.data.isPrecompute) {
          (self as any).postMessage({
            id: item.request.id,
            type: 'error',
            error: error.message
          });
        }
      }
      
      this.isProcessing = false;
    }
  }

  /**
   * Compute move using WASM or JS
   */
  private async computeMove(request: ComputeRequest): Promise<any> {
    const startTime = performance.now();
    
    // Try WASM first if available
    if (this.wasmInstance) {
      try {
        const result = await this.computeWithWasm(request);
        return {
          ...result,
          computeTime: performance.now() - startTime,
          method: 'wasm'
        };
      } catch (error) {
        console.warn('WASM compute failed, falling back to JS:', error);
      }
    }
    
    // Try model inference if available
    if (request.modelId && this.models.has(request.modelId)) {
      try {
        const result = await this.computeWithModel(request);
        return {
          ...result,
          computeTime: performance.now() - startTime,
          method: 'model'
        };
      } catch (error) {
        console.warn('Model compute failed, falling back to JS:', error);
      }
    }
    
    // Fallback to JavaScript implementation
    const result = await this.computeWithJS(request);
    return {
      ...result,
      computeTime: performance.now() - startTime,
      method: 'js'
    };
  }

  /**
   * Compute with WebAssembly
   */
  private async computeWithWasm(request: ComputeRequest): Promise<any> {
    if (!this.wasmInstance) {
      throw new Error('WASM not loaded');
    }
    
    // Convert board to flat array
    const flatBoard = new Int32Array(42);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = request.board[r][c];
        flatBoard[r * 7 + c] = cell === 'Red' ? 1 : cell === 'Yellow' ? 2 : 0;
      }
    }
    
    // Allocate memory in WASM
    const exports = this.wasmInstance.exports as any;
    const boardPtr = exports.allocateBoard();
    const boardMemory = new Int32Array(exports.memory.buffer, boardPtr, 42);
    boardMemory.set(flatBoard);
    
    // Run evaluation
    const player = request.player === 'Red' ? 1 : 2;
    const depth = request.depth || 7;
    const result = exports.computeBestMove(boardPtr, player, depth);
    
    // Extract results
    const move = result & 0xFF;
    const evaluation = ((result >> 8) & 0xFFFF) / 1000.0 - 10.0;
    
    // Free memory
    exports.freeBoard(boardPtr);
    
    return {
      move,
      evaluation,
      depth,
      nodes: exports.getNodesSearched()
    };
  }

  /**
   * Compute with model
   */
  private async computeWithModel(request: ComputeRequest): Promise<any> {
    const model = this.models.get(request.modelId!);
    if (!model || !model.loaded) {
      throw new Error('Model not loaded');
    }
    
    // Convert board to tensor
    const input = this.boardToTensor(request.board);
    
    // Run inference based on model type
    let policy: number[];
    let value: number;
    
    switch (model.type) {
      case 'onnx':
        // ONNX inference
        const feeds = { input };
        const results = await model.session.run(feeds);
        policy = Array.from(results.policy.data);
        value = results.value.data[0];
        break;
        
      case 'tfjs':
        // TensorFlow.js inference
        // Implementation would depend on TF.js
        policy = new Array(7).fill(1/7);
        value = 0;
        break;
        
      default:
        throw new Error(`Unknown model type: ${model.type}`);
    }
    
    // Find best valid move
    const validMoves = this.getValidMoves(request.board);
    let bestMove = -1;
    let bestProb = -1;
    
    for (const move of validMoves) {
      if (policy[move] > bestProb) {
        bestProb = policy[move];
        bestMove = move;
      }
    }
    
    return {
      move: bestMove,
      evaluation: value,
      policy,
      confidence: bestProb
    };
  }

  /**
   * Compute with JavaScript (minimax)
   */
  private async computeWithJS(request: ComputeRequest): Promise<any> {
    const depth = request.depth || 5;
    const timeLimit = request.timeLimit || 5000;
    const startTime = performance.now();
    
    const result = this.minimax(
      request.board,
      depth,
      -Infinity,
      Infinity,
      request.player === 'Red',
      startTime,
      timeLimit
    );
    
    return {
      move: result.move,
      evaluation: result.score,
      depth: depth,
      nodes: result.nodes
    };
  }

  /**
   * Minimax algorithm with alpha-beta pruning
   */
  private minimax(
    board: CellValue[][],
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    startTime: number,
    timeLimit: number
  ): { move: number; score: number; nodes: number } {
    // Check time limit
    if (performance.now() - startTime > timeLimit) {
      return { move: -1, score: 0, nodes: 0 };
    }
    
    // Terminal node checks
    const winner = this.checkWinner(board);
    if (winner === 'Red') return { move: -1, score: 100 - depth, nodes: 1 };
    if (winner === 'Yellow') return { move: -1, score: -100 + depth, nodes: 1 };
    if (this.isBoardFull(board)) return { move: -1, score: 0, nodes: 1 };
    if (depth === 0) return { move: -1, score: this.evaluateBoard(board), nodes: 1 };
    
    const validMoves = this.getValidMoves(board);
    let bestMove = validMoves[0];
    let bestScore = maximizing ? -Infinity : Infinity;
    let totalNodes = 1;
    
    // Move ordering for better pruning
    const orderedMoves = this.orderMoves(validMoves, board);
    
    for (const move of orderedMoves) {
      const newBoard = this.makeMove(board, move, maximizing ? 'Red' : 'Yellow');
      const result = this.minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        !maximizing,
        startTime,
        timeLimit
      );
      
      totalNodes += result.nodes;
      
      if (maximizing) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        beta = Math.min(beta, bestScore);
      }
      
      if (beta <= alpha) {
        break; // Alpha-beta pruning
      }
    }
    
    return { move: bestMove, score: bestScore, nodes: totalNodes };
  }

  /**
   * Load WebAssembly module
   */
  private async loadWasmModule() {
    try {
      // In production, this would load actual WASM binary
      const wasmCode = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        // ... actual WASM binary
      ]);
      
      this.wasmModule = await WebAssembly.compile(wasmCode);
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, {
        env: {
          memory: new WebAssembly.Memory({ initial: 256 }),
          abort: () => console.error('WASM abort')
        }
      });
      
      console.log('WASM module loaded');
    } catch (error) {
      console.warn('Failed to load WASM module:', error);
    }
  }

  /**
   * Create worker pool for parallel processing
   */
  private createWorkerPool() {
    // In service worker context, we can't create traditional workers
    // This would be for a dedicated worker context
    console.log('Worker pool initialized');
  }

  /**
   * Load model into memory
   */
  private async loadModel(modelId: string, weights: ArrayBuffer, type: string) {
    const model: ModelCache = {
      id: modelId,
      weights,
      type: type as any,
      loaded: false
    };
    
    // Load based on type
    switch (type) {
      case 'onnx':
        // In browser, would use ONNX.js
        model.loaded = true;
        break;
        
      case 'tfjs':
        // Would use TensorFlow.js
        model.loaded = true;
        break;
        
      case 'wasm':
        // Custom WASM model
        const module = await WebAssembly.compile(weights);
        model.session = await WebAssembly.instantiate(module);
        model.loaded = true;
        break;
    }
    
    this.models.set(modelId, model);
  }

  /**
   * Helper methods
   */

  private getBoardHash(board: CellValue[][]): string {
    return board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
  }

  private getCurrentPlayer(board: CellValue[][]): 'Red' | 'Yellow' {
    let redCount = 0;
    let yellowCount = 0;
    
    for (const row of board) {
      for (const cell of row) {
        if (cell === 'Red') redCount++;
        else if (cell === 'Yellow') yellowCount++;
      }
    }
    
    return redCount <= yellowCount ? 'Red' : 'Yellow';
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }

  private makeMove(board: CellValue[][], col: number, player: 'Red' | 'Yellow'): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }

  private checkWinner(board: CellValue[][]): 'Red' | 'Yellow' | null {
    // Check all winning conditions
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const player = board[row][col];
        if (player === 'Empty') continue;
        
        for (const [dr, dc] of directions) {
          let count = 1;
          
          // Check forward
          for (let i = 1; i < 4; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
              count++;
            } else {
              break;
            }
          }
          
          // Check backward
          for (let i = 1; i < 4; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
              count++;
            } else {
              break;
            }
          }
          
          if (count >= 4) {
            return player as 'Red' | 'Yellow';
          }
        }
      }
    }
    
    return null;
  }

  private isBoardFull(board: CellValue[][]): boolean {
    return board[0].every(cell => cell !== 'Empty');
  }

  private evaluateBoard(board: CellValue[][]): number {
    let score = 0;
    
    // Center column preference
    for (let row = 0; row < 6; row++) {
      if (board[row][3] === 'Red') score += 3;
      else if (board[row][3] === 'Yellow') score -= 3;
    }
    
    // Evaluate all windows
    score += this.evaluateWindows(board);
    
    return score;
  }

  private evaluateWindows(board: CellValue[][]): number {
    let score = 0;
    
    // Horizontal, vertical, and diagonal windows
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        // Horizontal
        if (col <= 3) {
          score += this.evaluateWindow([
            board[row][col],
            board[row][col + 1],
            board[row][col + 2],
            board[row][col + 3]
          ]);
        }
        
        // Vertical
        if (row <= 2) {
          score += this.evaluateWindow([
            board[row][col],
            board[row + 1][col],
            board[row + 2][col],
            board[row + 3][col]
          ]);
        }
        
        // Diagonal
        if (row <= 2 && col <= 3) {
          score += this.evaluateWindow([
            board[row][col],
            board[row + 1][col + 1],
            board[row + 2][col + 2],
            board[row + 3][col + 3]
          ]);
        }
        
        if (row >= 3 && col <= 3) {
          score += this.evaluateWindow([
            board[row][col],
            board[row - 1][col + 1],
            board[row - 2][col + 2],
            board[row - 3][col + 3]
          ]);
        }
      }
    }
    
    return score;
  }

  private evaluateWindow(window: CellValue[]): number {
    let redCount = 0;
    let yellowCount = 0;
    
    for (const cell of window) {
      if (cell === 'Red') redCount++;
      else if (cell === 'Yellow') yellowCount++;
    }
    
    if (redCount > 0 && yellowCount > 0) {
      return 0; // Mixed window
    }
    
    if (redCount > 0) {
      if (redCount === 4) return 100;
      if (redCount === 3) return 10;
      if (redCount === 2) return 1;
    }
    
    if (yellowCount > 0) {
      if (yellowCount === 4) return -100;
      if (yellowCount === 3) return -10;
      if (yellowCount === 2) return -1;
    }
    
    return 0;
  }

  private orderMoves(moves: number[], board: CellValue[][]): number[] {
    // Order moves by potential (center columns first)
    return moves.sort((a, b) => {
      const aDist = Math.abs(a - 3);
      const bDist = Math.abs(b - 3);
      return aDist - bDist;
    });
  }

  private boardToTensor(board: CellValue[][]): Float32Array {
    const tensor = new Float32Array(3 * 6 * 7);
    let idx = 0;
    
    // 3 channels: red, yellow, empty
    for (let channel = 0; channel < 3; channel++) {
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
          const cell = board[row][col];
          if (channel === 0 && cell === 'Red') tensor[idx] = 1;
          else if (channel === 1 && cell === 'Yellow') tensor[idx] = 1;
          else if (channel === 2 && cell === 'Empty') tensor[idx] = 1;
          idx++;
        }
      }
    }
    
    return tensor;
  }

  private async computeOnWorker(workerId: number, boards: CellValue[][][]): Promise<any[]> {
    // In service worker context, would delegate to sub-workers
    const results: any[] = [];
    
    for (const board of boards) {
      const result = await this.computeMove({
        board,
        player: this.getCurrentPlayer(board),
        depth: 5
      });
      results.push(result);
    }
    
    return results;
  }

  private pruneCache() {
    if (this.precomputeCache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.precomputeCache.entries());
      entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
      
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      for (const [key] of toRemove) {
        this.precomputeCache.delete(key);
      }
    }
  }
}

// Initialize worker
const aiWorker = new AIWorker();

// Service Worker event listeners
self.addEventListener('message', (event) => {
  aiWorker.handleMessage(event as any);
});

// Note: These service worker events are commented out because this is a Web Worker, not a Service Worker
// If you need Service Worker functionality, create a separate service worker file
/*
self.addEventListener('install', (event) => {
  console.log('AI Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('AI Service Worker activated');
  event.waitUntil(clients.claim());
});
*/

// Export for TypeScript
export { AIWorker };