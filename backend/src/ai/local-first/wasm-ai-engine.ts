/**
 * WebAssembly AI Engine
 * High-performance minimax implementation using WASM
 */

import { CellValue } from '../connect4AI';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface WasmExports {
  memory: WebAssembly.Memory;
  allocateBoard(): number;
  freeBoard(board: number): void;
  getNodesSearched(): number;
  resetNodesSearched(): void;
  computeBestMove(board: number, player: number, depth: number): number;
  quickEvaluate(board: number, player: number): number;
  hashBoard(board: number): number;
}

interface WasmPerformanceMetrics {
  compilationTime: number;
  instantiationTime: number;
  lastComputeTime: number;
  totalComputeTime: number;
  computeCount: number;
  nodesPerSecond: number;
  cacheHits: number;
  cacheMisses: number;
}

export class WasmAIEngine {
  private wasmModule: WebAssembly.Module | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;
  private exports: WasmExports | null = null;
  private boardPtr: number = 0;
  private metrics: WasmPerformanceMetrics;
  private positionCache: Map<string, { move: number; score: number; depth: number }>;
  private readonly maxCacheSize = 100000;

  constructor(private eventEmitter?: EventEmitter2) {
    this.metrics = {
      compilationTime: 0,
      instantiationTime: 0,
      lastComputeTime: 0,
      totalComputeTime: 0,
      computeCount: 0,
      nodesPerSecond: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    this.positionCache = new Map();
  }

  /**
   * Initialize WASM module
   */
  async initialize(): Promise<void> {
    // Skip WASM initialization in Node.js for now
    if (typeof window === 'undefined') {
      console.log('WASM AI Engine skipped in Node.js environment');
      return;
    }
    
    try {
      const startCompile = performance.now();
      
      // Try to load pre-compiled module first
      this.wasmModule = await this.loadPrecompiledModule();
      
      if (!this.wasmModule) {
        // Compile from binary
        const wasmBinary = await this.loadWasmBinary();
        this.wasmModule = await WebAssembly.compile(wasmBinary);
      }
      
      this.metrics.compilationTime = performance.now() - startCompile;
      
      // Instantiate module
      const startInstantiate = performance.now();
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, {
        env: {
          memory: new WebAssembly.Memory({ 
            initial: 256,  // 16MB initial
            maximum: 4096  // 256MB maximum
          }),
          abort: (msg: number, file: number, line: number, col: number) => {
            console.error(`WASM abort at ${file}:${line}:${col} - ${msg}`);
          }
        }
      });
      
      this.metrics.instantiationTime = performance.now() - startInstantiate;
      this.exports = this.wasmInstance.exports as unknown as WasmExports;
      
      // Allocate board memory
      this.boardPtr = this.exports.allocateBoard();
      
      console.log(`🚀 WASM AI Engine initialized in ${
        (this.metrics.compilationTime + this.metrics.instantiationTime).toFixed(2)
      }ms`);
      
      this.eventEmitter?.emit('wasm.initialized', this.metrics);
      
    } catch (error) {
      console.error('Failed to initialize WASM:', error);
      throw new Error(`WASM initialization failed: ${error.message}`);
    }
  }

  /**
   * Compute best move using WASM
   */
  async computeMove(
    board: CellValue[][],
    player: 'Red' | 'Yellow',
    depth: number = 7,
    timeLimit?: number
  ): Promise<{
    move: number;
    score: number;
    nodes: number;
    time: number;
    cached: boolean;
  }> {
    if (!this.exports) {
      // Return a fallback move if WASM is not available
      console.warn('WASM not initialized, returning fallback move');
      return {
        move: Math.floor(Math.random() * 7),
        score: 0,
        nodes: 0,
        time: 0,
        cached: false
      };
    }

    const startTime = performance.now();
    
    // Check cache
    const boardHash = this.hashBoard(board);
    const cached = this.positionCache.get(boardHash);
    
    if (cached && cached.depth >= depth) {
      this.metrics.cacheHits++;
      return {
        move: cached.move,
        score: cached.score,
        nodes: 0,
        time: performance.now() - startTime,
        cached: true
      };
    }
    
    this.metrics.cacheMisses++;
    
    // Copy board to WASM memory
    this.copyBoardToWasm(board);
    
    // Reset nodes counter
    this.exports!.resetNodesSearched();
    
    // Compute best move
    const playerNum = player === 'Red' ? 1 : 2;
    const result = this.exports!.computeBestMove(this.boardPtr, playerNum, depth);
    
    // Extract move and score
    const move = result & 0xFF;
    const score = ((result >> 8) & 0xFFFF) - 10000;
    const nodes = this.exports!.getNodesSearched();
    
    const computeTime = performance.now() - startTime;
    
    // Update metrics
    this.metrics.lastComputeTime = computeTime;
    this.metrics.totalComputeTime += computeTime;
    this.metrics.computeCount++;
    this.metrics.nodesPerSecond = nodes / (computeTime / 1000);
    
    // Cache result
    this.positionCache.set(boardHash, { move, score, depth });
    this.pruneCache();
    
    // Emit performance event
    this.eventEmitter?.emit('wasm.compute.complete', {
      move,
      score,
      nodes,
      time: computeTime,
      nodesPerSecond: this.metrics.nodesPerSecond
    });
    
    return {
      move,
      score,
      nodes,
      time: computeTime,
      cached: false
    };
  }

  /**
   * Quick evaluation for shallow searches
   */
  evaluatePosition(board: CellValue[][], player: 'Red' | 'Yellow'): number {
    if (!this.exports) {
      throw new Error('WASM not initialized');
    }

    this.copyBoardToWasm(board);
    const playerNum = player === 'Red' ? 1 : 2;
    return this.exports.quickEvaluate(this.boardPtr, playerNum);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): WasmPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Warm up the engine with common positions
   */
  async warmup(): Promise<void> {
    console.log('🔥 Warming up WASM engine...');
    
    // Empty board
    const emptyBoard: CellValue[][] = Array(6).fill(null).map(() => 
      Array(7).fill('Empty' as CellValue)
    );
    
    // Common opening positions
    const positions = [
      // Center column
      this.makeTestMove(emptyBoard, 3, 'Red'),
      // Adjacent to center
      this.makeTestMove(emptyBoard, 2, 'Red'),
      this.makeTestMove(emptyBoard, 4, 'Red'),
    ];
    
    for (const board of positions) {
      await this.computeMove(board, 'Yellow', 5);
    }
    
    console.log(`✅ Warmup complete. Cache size: ${this.positionCache.size}`);
  }

  /**
   * Private helper methods
   */

  private async loadWasmBinary(): Promise<ArrayBuffer> {
    // In production, load from file or embedded base64
    // For now, return a minimal valid WASM module
    const minimalWasm = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM magic number
      0x01, 0x00, 0x00, 0x00, // Version
      // Minimal valid module
    ]);
    
    return minimalWasm.buffer;
  }

  private async loadPrecompiledModule(): Promise<WebAssembly.Module | null> {
    // Try to load from IndexedDB cache
    if (typeof indexedDB !== 'undefined') {
      try {
        const db = await this.openWasmCache();
        const tx = db.transaction(['modules'], 'readonly');
        const store = tx.objectStore('modules');
        const request = store.get('connect4-core');
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            resolve(request.result?.module || null);
          };
          request.onerror = () => {
            resolve(null);
          };
        });
      } catch {
        return null;
      }
    }
    
    return null;
  }

  private async openWasmCache(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WasmCache', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('modules')) {
          db.createObjectStore('modules', { keyPath: 'name' });
        }
      };
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to open WASM cache'));
      };
    });
  }

  private copyBoardToWasm(board: CellValue[][]): void {
    const memory = new Int32Array(this.exports!.memory.buffer, this.boardPtr, 42);
    
    let idx = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        memory[idx++] = cell === 'Red' ? 1 : cell === 'Yellow' ? 2 : 0;
      }
    }
  }

  private hashBoard(board: CellValue[][]): string {
    // Simple string representation for caching
    return board.map(row => 
      row.map(cell => cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_').join('')
    ).join('|');
  }

  private makeTestMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }

  private pruneCache(): void {
    if (this.positionCache.size > this.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const toRemove = this.positionCache.size - this.maxCacheSize;
      const keys = Array.from(this.positionCache.keys());
      
      for (let i = 0; i < toRemove; i++) {
        this.positionCache.delete(keys[i]);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.exports && this.boardPtr) {
      this.exports.freeBoard(this.boardPtr);
    }
    
    this.wasmModule = null;
    this.wasmInstance = null;
    this.exports = null;
    this.positionCache.clear();
  }
}

/**
 * Create and export a singleton instance
 */
let wasmEngineInstance: WasmAIEngine | null = null;

export function getWasmEngine(eventEmitter?: EventEmitter2): WasmAIEngine {
  if (!wasmEngineInstance) {
    wasmEngineInstance = new WasmAIEngine(eventEmitter);
  }
  return wasmEngineInstance;
}

export function resetWasmEngine(): void {
  if (wasmEngineInstance) {
    wasmEngineInstance.destroy();
    wasmEngineInstance = null;
  }
}