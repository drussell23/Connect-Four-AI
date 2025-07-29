/**
 * Offline Game Service
 * Provides seamless online/offline game functionality
 */

import { io, Socket } from 'socket.io-client';
import { GameStateManager, GameState, Move, CellValue } from './GameStateManager';
import { LocalFirstAIService } from '../../../backend/src/ai/local-first/local-first-ai.service';

export interface GameServiceConfig {
  apiUrl: string;
  enableOffline: boolean;
  autoReconnect: boolean;
  reconnectInterval: number;
  syncBatchSize: number;
}

export interface ConnectionStatus {
  online: boolean;
  connected: boolean;
  latency: number;
  lastError?: string;
  reconnectAttempts: number;
}

export type GameEventHandler = (data: any) => void;

export class OfflineGameService {
  private socket: Socket | null = null;
  private gameStateManager: GameStateManager;
  private config: GameServiceConfig;
  private connectionStatus: ConnectionStatus;
  private eventHandlers: Map<string, Set<GameEventHandler>>;
  private reconnectTimer: NodeJS.Timer | null = null;
  private aiWorker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }>;

  constructor(config: Partial<GameServiceConfig> = {}) {
    this.config = {
      apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
      enableOffline: true,
      autoReconnect: true,
      reconnectInterval: 5000,
      syncBatchSize: 10,
      ...config
    };

    this.connectionStatus = {
      online: navigator.onLine,
      connected: false,
      latency: 0,
      reconnectAttempts: 0
    };

    this.gameStateManager = new GameStateManager({
      autoSave: true,
      syncOnReconnect: true
    });

    this.eventHandlers = new Map();
    this.pendingRequests = new Map();

    this.initialize();
  }

  /**
   * Initialize service
   */
  private async initialize() {
    // Setup online/offline listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Initialize AI worker if available
    if (this.config.enableOffline && 'Worker' in window) {
      try {
        this.aiWorker = new Worker('/ai-worker.js');
        this.setupAIWorker();
      } catch (error) {
        console.warn('AI Worker not available:', error);
      }
    }

    // Connect if online
    if (this.connectionStatus.online) {
      await this.connect();
    }

    // Setup game state listeners
    this.setupGameStateListeners();
  }

  /**
   * Connect to server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    try {
      this.socket = io(this.config.apiUrl, {
        transports: ['websocket'],
        reconnection: this.config.autoReconnect,
        reconnectionDelay: this.config.reconnectInterval,
        timeout: 10000
      });

      this.setupSocketHandlers();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.connectionStatus.connected = true;
      this.connectionStatus.reconnectAttempts = 0;
      
      // Sync any offline moves
      await this.syncOfflineData();

      this.emit('connection:established', this.connectionStatus);

    } catch (error) {
      console.error('Connection failed:', error);
      this.connectionStatus.lastError = error.message;
      
      if (this.config.enableOffline) {
        console.log('Switching to offline mode');
        this.emit('connection:offline-mode', {});
      } else {
        throw error;
      }
    }
  }

  /**
   * Create new game
   */
  async createGame(aiDifficulty: number = 20): Promise<GameState> {
    if (this.connectionStatus.connected) {
      try {
        // Try online first
        const response = await this.socketRequest('game:create', { aiDifficulty });
        const game = await this.gameStateManager.createGame(aiDifficulty);
        
        // Sync with server response
        if (response.gameId) {
          game.id = response.gameId;
          await this.gameStateManager.saveGame(game);
        }
        
        return game;
      } catch (error) {
        console.warn('Failed to create game online:', error);
      }
    }

    // Offline fallback
    const game = await this.gameStateManager.createGame(aiDifficulty);
    this.emit('game:created-offline', game);
    return game;
  }

  /**
   * Make move
   */
  async makeMove(column: number): Promise<void> {
    const currentGame = this.gameStateManager.currentGame;
    if (!currentGame) throw new Error('No active game');

    // Make move locally first for instant feedback
    const move = await this.gameStateManager.makeMove(
      column, 
      currentGame.currentPlayer,
      !this.connectionStatus.connected
    );

    // Emit local update
    this.emit('move:made', { move, gameState: currentGame });

    if (this.connectionStatus.connected) {
      try {
        // Sync with server
        await this.socketRequest('game:move', {
          gameId: currentGame.id,
          column,
          moveId: move.id
        });
        
        move.synced = true;
        
      } catch (error) {
        console.warn('Failed to sync move:', error);
        // Move remains marked as offline
      }
    }

    // Get AI move if it's AI's turn
    if (currentGame.currentPlayer === 'Yellow' && currentGame.status === 'active') {
      await this.getAIMove();
    }
  }

  /**
   * Get AI move
   */
  private async getAIMove(): Promise<void> {
    const currentGame = this.gameStateManager.currentGame;
    if (!currentGame) return;

    if (this.connectionStatus.connected) {
      try {
        // Try server AI
        const response = await this.socketRequest('game:ai-move', {
          gameId: currentGame.id,
          board: currentGame.board,
          difficulty: currentGame.aiDifficulty
        });

        if (response.column !== undefined) {
          await this.gameStateManager.makeMove(response.column, 'Yellow', false);
          this.emit('ai:move', { column: response.column });
        }
        
        return;
      } catch (error) {
        console.warn('Server AI failed, using offline AI:', error);
      }
    }

    // Offline AI
    const aiMove = await this.computeOfflineAIMove(currentGame.board);
    await this.gameStateManager.makeMove(aiMove, 'Yellow', true);
    this.emit('ai:move', { column: aiMove, offline: true });
  }

  /**
   * Compute AI move offline
   */
  private async computeOfflineAIMove(board: CellValue[][]): Promise<number> {
    if (this.aiWorker) {
      // Use Web Worker
      return new Promise((resolve, reject) => {
        const messageId = this.generateMessageId();
        const timeout = setTimeout(() => {
          reject(new Error('AI computation timeout'));
        }, 10000);

        const handler = (event: MessageEvent) => {
          if (event.data.id === messageId && event.data.type === 'ai-move-result') {
            clearTimeout(timeout);
            this.aiWorker!.removeEventListener('message', handler);
            resolve(event.data.move);
          }
        };

        this.aiWorker.addEventListener('message', handler);
        this.aiWorker.postMessage({
          id: messageId,
          type: 'compute-move',
          board,
          player: 'Yellow'
        });
      });
    }

    // Fallback to simple AI
    return this.simpleAIMove(board);
  }

  /**
   * Simple AI fallback
   */
  private simpleAIMove(board: CellValue[][]): number {
    // Check for winning/blocking moves
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== 'Empty') continue;

      // Test move
      const testBoard = board.map(row => [...row]);
      for (let row = 5; row >= 0; row--) {
        if (testBoard[row][col] === 'Empty') {
          // Check if AI can win
          testBoard[row][col] = 'Yellow';
          if (this.checkWinner(testBoard, row, col, 'Yellow')) {
            return col;
          }

          // Check if need to block player
          testBoard[row][col] = 'Red';
          if (this.checkWinner(testBoard, row, col, 'Red')) {
            return col;
          }

          testBoard[row][col] = 'Empty';
          break;
        }
      }
    }

    // Play center columns
    const columns = [3, 2, 4, 1, 5, 0, 6];
    for (const col of columns) {
      if (board[0][col] === 'Empty') return col;
    }

    return 0;
  }

  /**
   * Handle online event
   */
  private async handleOnline() {
    console.log('Network connection restored');
    this.connectionStatus.online = true;
    
    if (!this.connectionStatus.connected && this.config.autoReconnect) {
      await this.connect();
    }
    
    this.emit('network:online', {});
  }

  /**
   * Handle offline event
   */
  private handleOffline() {
    console.log('Network connection lost');
    this.connectionStatus.online = false;
    this.connectionStatus.connected = false;
    
    this.emit('network:offline', {});
  }

  /**
   * Setup socket handlers
   */
  private setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connectionStatus.connected = true;
      this.measureLatency();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connectionStatus.connected = false;
      
      if (this.config.autoReconnect && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('game:sync', async (data) => {
      await this.gameStateManager.handleIncomingSync(data);
    });

    this.socket.on('game:move', (data) => {
      this.emit('opponent:move', data);
    });

    this.socket.on('game:error', (error) => {
      console.error('Game error:', error);
      this.emit('game:error', error);
    });

    // Heartbeat for latency
    this.socket.on('pong', () => {
      const latency = Date.now() - this.lastPingTime;
      this.connectionStatus.latency = latency;
    });
  }

  /**
   * Setup game state listeners
   */
  private setupGameStateListeners() {
    this.gameStateManager.on('move:made', (data) => {
      this.emit('game:updated', data.gameState);
    });

    this.gameStateManager.on('sync:completed', (data) => {
      this.emit('sync:completed', data);
    });

    this.gameStateManager.on('conflict:resolved', (data) => {
      this.emit('conflict:resolved', data);
    });
  }

  /**
   * Setup AI worker
   */
  private setupAIWorker() {
    if (!this.aiWorker) return;

    this.aiWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'ready':
          console.log('AI Worker ready');
          this.emit('ai:ready', {});
          break;
          
        case 'error':
          console.error('AI Worker error:', data);
          break;
      }
    });

    // Initialize worker
    this.aiWorker.postMessage({ type: 'init' });
  }

  /**
   * Socket request with timeout
   */
  private socketRequest(event: string, data: any, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const requestId = this.generateMessageId();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject });

      this.socket.emit(event, { ...data, requestId }, (response: any) => {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Sync offline data
   */
  private async syncOfflineData() {
    if (!this.connectionStatus.connected) return;

    try {
      // Get recovery snapshot
      const snapshot = await this.gameStateManager.getRecoverySnapshot();
      if (!snapshot) return;

      // Send to server for verification
      const response = await this.socketRequest('game:verify', snapshot);
      
      if (response.needsSync) {
        // Sync offline moves
        await this.gameStateManager.syncOfflineMoves(async (moves) => {
          const syncResponse = await this.socketRequest('game:sync-moves', {
            gameId: snapshot.gameId,
            moves
          });
          return syncResponse.success;
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.connectionStatus.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.connectionStatus.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Scheduling reconnect in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (this.connectionStatus.online && !this.connectionStatus.connected) {
        await this.connect();
      }
    }, delay);
  }

  /**
   * Measure latency
   */
  private lastPingTime: number = 0;
  private measureLatency() {
    if (!this.socket?.connected) return;

    setInterval(() => {
      if (this.socket?.connected) {
        this.lastPingTime = Date.now();
        this.socket.emit('ping');
      }
    }, 10000);
  }

  /**
   * Check winner (helper)
   */
  private checkWinner(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
    const directions = [
      [[0, 1], [0, -1]],
      [[1, 0], [-1, 0]],
      [[1, 1], [-1, -1]],
      [[1, -1], [-1, 1]]
    ];

    for (const direction of directions) {
      let count = 1;
      
      for (const [dr, dc] of direction) {
        let r = row + dr;
        let c = col + dc;
        
        while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
          r += dr;
          c += dc;
        }
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }

  /**
   * Event handling
   */
  on(event: string, handler: GameEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: GameEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Utilities
   */
  private generateMessageId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public API
   */
  get isOnline(): boolean {
    return this.connectionStatus.online;
  }

  get isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  get currentGame(): GameState | null {
    return this.gameStateManager.currentGame;
  }

  async loadGame(gameId: string): Promise<GameState | null> {
    return this.gameStateManager.loadGame(gameId);
  }

  async getRecentGames(): Promise<GameState[]> {
    return this.gameStateManager.getRecentGames();
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    if (this.aiWorker) {
      this.aiWorker.terminate();
    }
    
    this.gameStateManager.destroy();
    this.eventHandlers.clear();
    this.pendingRequests.clear();
  }
}