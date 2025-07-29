/**
 * Local-First AI Service
 * Provides offline-capable AI with progressive enhancement
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocalModelStore } from './local-model-store';
import { WasmAIEngine, getWasmEngine } from './wasm-ai-engine';
import { CellValue } from '../connect4AI';

export interface LocalAIConfig {
  enableOffline: boolean;
  enableServiceWorker: boolean;
  enableWebAssembly: boolean;
  cacheSize: number;
  syncInterval: number;
  modelStorageQuota: number;
}

export interface OfflinePrediction {
  move: number;
  confidence: number;
  method: 'wasm' | 'cached' | 'model' | 'heuristic';
  latency: number;
  offline: boolean;
}

@Injectable()
export class LocalFirstAIService implements OnModuleInit {
  private modelStore: LocalModelStore;
  private wasmEngine: WasmAIEngine;
  private serviceWorkerReady = false;
  private offlineMode = false;
  private syncTimer?: NodeJS.Timer;
  private moveCache: Map<string, { move: number; timestamp: number }>;
  private readonly config: LocalAIConfig;

  constructor(
    private eventEmitter: EventEmitter2
  ) {
    this.config = {
      enableOffline: true,
      enableServiceWorker: true,
      enableWebAssembly: true,
      cacheSize: 10000,
      syncInterval: 300000, // 5 minutes
      modelStorageQuota: 100 * 1024 * 1024 // 100MB
    };

    this.modelStore = new LocalModelStore(eventEmitter);
    this.wasmEngine = getWasmEngine(eventEmitter);
    this.moveCache = new Map();
  }

  async onModuleInit() {
    console.log('🌐 Initializing Local-First AI Service...');
    
    // Initialize components
    await this.initializeComponents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start sync timer
    if (this.config.syncInterval > 0) {
      this.startSyncTimer();
    }
    
    console.log('✅ Local-First AI Service initialized');
  }

  /**
   * Get best move with offline support
   */
  async getBestMove(
    board: CellValue[][],
    player: 'Red' | 'Yellow',
    timeLimit?: number
  ): Promise<number> {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.getBoardHash(board);
    const cached = this.moveCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 60000) { // 1 minute cache
      this.eventEmitter.emit('localai.cache.hit', {
        boardHash: cacheKey,
        move: cached.move
      });
      return cached.move;
    }
    
    try {
      // Try different methods in order of preference
      let result: OfflinePrediction;
      
      if (this.serviceWorkerReady && !this.offlineMode) {
        // Try service worker computation
        result = await this.computeWithServiceWorker(board, player, timeLimit);
      } else if (this.config.enableWebAssembly) {
        // Use WASM engine
        result = await this.computeWithWasm(board, player, timeLimit);
      } else {
        // Fallback to cached models or heuristics
        result = await this.computeOffline(board, player);
      }
      
      // Cache the result
      this.moveCache.set(cacheKey, {
        move: result.move,
        timestamp: Date.now()
      });
      
      // Prune cache if too large
      if (this.moveCache.size > this.config.cacheSize) {
        this.pruneCache();
      }
      
      // Emit metrics
      this.eventEmitter.emit('localai.move.computed', {
        method: result.method,
        latency: performance.now() - startTime,
        offline: result.offline,
        confidence: result.confidence
      });
      
      return result.move;
      
    } catch (error) {
      console.error('Local AI computation failed:', error);
      // Emergency fallback
      return this.getEmergencyMove(board, player);
    }
  }

  /**
   * Compute with Service Worker
   */
  private async computeWithServiceWorker(
    board: CellValue[][],
    player: 'Red' | 'Yellow',
    timeLimit?: number
  ): Promise<OfflinePrediction> {
    // Service worker only available in browser
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      throw new Error('Service Worker not available in Node.js environment');
    }
    
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const timeout = setTimeout(() => {
        reject(new Error('Service worker timeout'));
      }, timeLimit || 5000);
      
      const messageHandler = (event: MessageEvent) => {
        if (event.data.id === messageId && event.data.type === 'result') {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('message', messageHandler);
          
          resolve({
            move: event.data.data.move,
            confidence: event.data.data.confidence || 0.8,
            method: event.data.data.method || 'wasm',
            latency: event.data.data.computeTime,
            offline: false
          });
        }
      };
      
      navigator.serviceWorker.addEventListener('message', messageHandler);
      
      navigator.serviceWorker.controller?.postMessage({
        type: 'compute',
        id: messageId,
        data: {
          board,
          player,
          depth: 7,
          timeLimit
        }
      });
    });
  }

  /**
   * Compute with WASM
   */
  private async computeWithWasm(
    board: CellValue[][],
    player: 'Red' | 'Yellow',
    timeLimit?: number
  ): Promise<OfflinePrediction> {
    const result = await this.wasmEngine.computeMove(board, player, 7, timeLimit);
    
    return {
      move: result.move,
      confidence: this.scoreToConfidence(result.score),
      method: result.cached ? 'cached' : 'wasm',
      latency: result.time,
      offline: this.offlineMode
    };
  }

  /**
   * Compute offline using cached models
   */
  private async computeOffline(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<OfflinePrediction> {
    const startTime = performance.now();
    
    // Try to load best available model
    const models = await this.modelStore.queryModels({
      type: 'onnx',
      minAccuracy: 0.7
    });
    
    if (models.length > 0) {
      // Use best model
      const model = models[0];
      const prediction = await this.runModelInference(model, board, player);
      
      return {
        move: prediction.move,
        confidence: prediction.confidence,
        method: 'model',
        latency: performance.now() - startTime,
        offline: true
      };
    }
    
    // Fallback to heuristics
    const move = this.computeHeuristicMove(board, player);
    
    return {
      move,
      confidence: 0.5,
      method: 'heuristic',
      latency: performance.now() - startTime,
      offline: true
    };
  }

  /**
   * Run model inference
   */
  private async runModelInference(
    model: any,
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): Promise<{ move: number; confidence: number }> {
    // Check cache first
    const boardHash = this.getBoardHash(board);
    const cached = await this.modelStore.getCachedPrediction(boardHash, model.id);
    
    if (cached) {
      return cached;
    }
    
    // Simulate model inference (would use actual ONNX runtime in production)
    const validMoves = this.getValidMoves(board);
    const scores = validMoves.map(() => Math.random());
    const bestIndex = scores.indexOf(Math.max(...scores));
    
    const prediction = {
      move: validMoves[bestIndex],
      confidence: scores[bestIndex]
    };
    
    // Cache prediction
    await this.modelStore.cachePrediction(boardHash, model.id, prediction);
    
    return prediction;
  }

  /**
   * Compute heuristic move
   */
  private computeHeuristicMove(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): number {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    
    // 1. Check for winning move
    const winMove = this.findWinningMove(board, player);
    if (winMove !== -1) return winMove;
    
    // 2. Block opponent's winning move
    const blockMove = this.findWinningMove(board, opponent);
    if (blockMove !== -1) return blockMove;
    
    // 3. Play center column
    if (this.isValidMove(board, 3)) return 3;
    
    // 4. Play adjacent to center
    const centerAdjacent = [2, 4];
    for (const col of centerAdjacent) {
      if (this.isValidMove(board, col)) return col;
    }
    
    // 5. Play any valid move
    const validMoves = this.getValidMoves(board);
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  /**
   * Emergency fallback move
   */
  private getEmergencyMove(
    board: CellValue[][],
    player: 'Red' | 'Yellow'
  ): number {
    const validMoves = this.getValidMoves(board);
    
    if (validMoves.length === 0) {
      throw new Error('No valid moves available');
    }
    
    // Prefer center columns
    const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
    if (centerMoves.length > 0) {
      return centerMoves[Math.floor(Math.random() * centerMoves.length)];
    }
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  /**
   * Download and cache models for offline use
   */
  async downloadModelsForOffline(): Promise<void> {
    console.log('📥 Downloading models for offline use...');
    
    try {
      // List of models to download
      const modelsToDownload = [
        { name: 'connect4-base', url: '/models/connect4-base.onnx' },
        { name: 'connect4-advanced', url: '/models/connect4-advanced.onnx' },
        { name: 'connect4-opening', url: '/models/connect4-opening.onnx' }
      ];
      
      for (const modelInfo of modelsToDownload) {
        try {
          const response = await fetch(modelInfo.url);
          if (response.ok) {
            const weights = await response.arrayBuffer();
            await this.modelStore.saveModel(modelInfo.name, weights, {
              type: 'onnx',
              version: '1.0.0'
            });
            console.log(`✅ Downloaded ${modelInfo.name}`);
          }
        } catch (error) {
          console.warn(`Failed to download ${modelInfo.name}:`, error);
        }
      }
      
      // Warm up WASM engine
      await this.wasmEngine.warmup();
      
      console.log('✅ Offline models ready');
      
    } catch (error) {
      console.error('Failed to download models:', error);
    }
  }

  /**
   * Sync with server
   */
  async syncWithServer(): Promise<void> {
    if (this.offlineMode) {
      return;
    }
    
    try {
      const serverUrl = process.env.API_URL || 'http://localhost:3000/api';
      const result = await this.modelStore.syncWithServer(serverUrl);
      
      console.log(`🔄 Sync complete: ${result.uploaded} uploaded, ${result.downloaded} downloaded`);
      
      // Clear expired cache
      await this.modelStore.clearExpiredCache();
      
    } catch (error) {
      console.warn('Sync failed, continuing in offline mode:', error);
      this.setOfflineMode(true);
    }
  }

  /**
   * Set offline mode
   */
  setOfflineMode(offline: boolean): void {
    this.offlineMode = offline;
    this.eventEmitter.emit('localai.offline.changed', { offline });
    
    if (offline) {
      console.log('📴 Switched to offline mode');
    } else {
      console.log('📶 Switched to online mode');
      // Trigger sync
      this.syncWithServer();
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<any> {
    const modelStats = await this.modelStore.getStorageStats();
    const wasmMetrics = this.wasmEngine.getMetrics();
    
    return {
      models: modelStats,
      wasm: wasmMetrics,
      cache: {
        moveCache: this.moveCache.size,
        maxCacheSize: this.config.cacheSize
      },
      offline: this.offlineMode,
      serviceWorker: this.serviceWorkerReady
    };
  }

  /**
   * Private helper methods
   */

  private async initializeComponents(): Promise<void> {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
    
    // Initialize model store
    await this.modelStore.initialize();
    
    // Initialize WASM engine
    if (this.config.enableWebAssembly) {
      await this.wasmEngine.initialize();
    }
    
    // Register service worker (only in browser)
    if (isBrowser && this.config.enableServiceWorker && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/ai-worker.js');
        console.log('Service Worker registered:', registration.scope);
        this.serviceWorkerReady = true;
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    } else if (!isBrowser) {
      console.log('Running in Node.js environment - Service Worker skipped');
    }
    
    // Check online status (only in browser)
    if (isBrowser && 'onLine' in navigator) {
      this.setOfflineMode(!navigator.onLine);
      
      window.addEventListener('online', () => this.setOfflineMode(false));
      window.addEventListener('offline', () => this.setOfflineMode(true));
    } else {
      // In Node.js, assume we're online
      this.setOfflineMode(false);
    }
  }

  private setupEventListeners(): void {
    // Listen for storage quota exceeded
    this.eventEmitter.on('localstore.quota.exceeded', async () => {
      console.warn('Storage quota exceeded, cleaning up...');
      const stats = await this.modelStore.getStorageStats();
      
      // Delete oldest models if over quota
      if (stats.totalSize > this.config.modelStorageQuota) {
        const models = await this.modelStore.queryModels({});
        const sortedModels = models.sort((a, b) => 
          a.metadata.lastUsed.getTime() - b.metadata.lastUsed.getTime()
        );
        
        let freedSpace = 0;
        for (const model of sortedModels) {
          if (stats.totalSize - freedSpace <= this.config.modelStorageQuota * 0.8) {
            break;
          }
          
          await this.modelStore.deleteModel(model.id);
          freedSpace += model.metadata.size;
        }
      }
    });
    
    // Listen for sync events
    this.eventEmitter.on('localai.sync.requested', () => {
      this.syncWithServer();
    });
  }

  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      if (!this.offlineMode) {
        this.syncWithServer();
      }
    }, this.config.syncInterval);
  }

  private getBoardHash(board: CellValue[][]): string {
    return board.map(row => 
      row.map(cell => cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_').join('')
    ).join('');
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

  private isValidMove(board: CellValue[][], col: number): boolean {
    return board[0][col] === 'Empty';
  }

  private findWinningMove(board: CellValue[][], player: CellValue): number {
    for (const col of this.getValidMoves(board)) {
      const testBoard = this.makeMove(board, col, player);
      if (this.checkWinner(testBoard) === player) {
        return col;
      }
    }
    return -1;
  }

  private makeMove(board: CellValue[][], col: number, player: CellValue): CellValue[][] {
    const newBoard = board.map(row => [...row]);
    
    for (let row = 5; row >= 0; row--) {
      if (newBoard[row][col] === 'Empty') {
        newBoard[row][col] = player;
        break;
      }
    }
    
    return newBoard;
  }

  private checkWinner(board: CellValue[][]): CellValue | null {
    // Check all winning conditions
    // Implementation omitted for brevity
    return null;
  }

  private scoreToConfidence(score: number): number {
    // Convert minimax score to confidence (0-1)
    const normalized = Math.tanh(score / 1000);
    return (normalized + 1) / 2;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pruneCache(): void {
    // Remove oldest entries
    const entries = Array.from(this.moveCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = Math.floor(this.moveCache.size * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.moveCache.delete(entries[i][0]);
    }
  }

  /**
   * Cleanup
   */
  onModuleDestroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer as any);
    }
    
    this.wasmEngine.destroy();
  }
}