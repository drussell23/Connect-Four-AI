/**
 * Game State Manager
 * Handles game state persistence, recovery, and synchronization
 */

import { EventEmitter } from 'events';

export interface GameState {
  id: string;
  board: CellValue[][];
  currentPlayer: 'Red' | 'Yellow';
  status: 'active' | 'won' | 'draw';
  winner?: 'Red' | 'Yellow';
  moves: Move[];
  aiDifficulty: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  offlineMoves: Move[];
}

export interface Move {
  id: string;
  column: number;
  player: 'Red' | 'Yellow';
  timestamp: number;
  synced: boolean;
  offline?: boolean;
}

export type CellValue = 'Empty' | 'Red' | 'Yellow';

export interface PersistenceOptions {
  autoSave: boolean;
  autoSaveInterval: number;
  maxStoredGames: number;
  syncOnReconnect: boolean;
}

export class GameStateManager extends EventEmitter {
  private currentGame: GameState | null = null;
  private localStorage: Storage;
  private indexedDB: IDBDatabase | null = null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private syncQueue: Move[] = [];
  private options: PersistenceOptions;

  constructor(options: Partial<PersistenceOptions> = {}) {
    super();
    
    this.options = {
      autoSave: true,
      autoSaveInterval: 5000,
      maxStoredGames: 10,
      syncOnReconnect: true,
      ...options
    };

    this.localStorage = window.localStorage;
    this.initializeIndexedDB();
  }

  /**
   * Initialize IndexedDB for game storage
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('Connect4Games', 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.indexedDB = request.result;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create game store
        if (!db.objectStoreNames.contains('games')) {
          const gameStore = db.createObjectStore('games', { keyPath: 'id' });
          gameStore.createIndex('createdAt', 'createdAt', { unique: false });
          gameStore.createIndex('status', 'status', { unique: false });
        }

        // Create moves store
        if (!db.objectStoreNames.contains('moves')) {
          const moveStore = db.createObjectStore('moves', { keyPath: 'id' });
          moveStore.createIndex('gameId', 'gameId', { unique: false });
          moveStore.createIndex('timestamp', 'timestamp', { unique: false });
          moveStore.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  /**
   * Get current game
   */
  get getCurrentGame(): GameState | null {
    return this.currentGame;
  }

  /**
   * Create new game
   */
  async createGame(aiDifficulty: number = 20): Promise<GameState> {
    const game: GameState = {
      id: this.generateId(),
      board: this.createEmptyBoard(),
      currentPlayer: 'Red',
      status: 'active',
      moves: [],
      aiDifficulty,
      createdAt: new Date(),
      updatedAt: new Date(),
      offlineMoves: []
    };

    this.currentGame = game;
    await this.saveGame(game);

    if (this.options.autoSave) {
      this.startAutoSave();
    }

    this.emit('game:created', game);
    return game;
  }

  /**
   * Load game from storage
   */
  async loadGame(gameId: string): Promise<GameState | null> {
    if (!this.indexedDB) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['games', 'moves'], 'readonly');
      const gameStore = transaction.objectStore('games');
      const request = gameStore.get(gameId);

      request.onsuccess = async () => {
        const game = request.result;
        if (game) {
          // Load moves
          const moves = await this.loadMoves(gameId);
          game.moves = moves;
          
          this.currentGame = game;
          
          if (this.options.autoSave) {
            this.startAutoSave();
          }
          
          this.emit('game:loaded', game);
          resolve(game);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save current game state
   */
  async saveGame(game?: GameState): Promise<void> {
    const gameToSave = game || this.currentGame;
    if (!gameToSave || !this.indexedDB) return;

    gameToSave.updatedAt = new Date();

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['games'], 'readwrite');
      const store = transaction.objectStore('games');
      const request = store.put(gameToSave);

      request.onsuccess = () => {
        // Also save to localStorage for quick access
        this.localStorage.setItem('lastGameId', gameToSave.id);
        this.localStorage.setItem(`game_${gameToSave.id}`, JSON.stringify({
          id: gameToSave.id,
          updatedAt: gameToSave.updatedAt,
          status: gameToSave.status
        }));

        this.emit('game:saved', gameToSave);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Make move
   */
  async makeMove(column: number, player: 'Red' | 'Yellow', offline: boolean = false): Promise<Move> {
    if (!this.currentGame) {
      throw new Error('No active game');
    }

    // Validate move
    if (!this.isValidMove(column)) {
      throw new Error('Invalid move');
    }

    // Create move
    const move: Move = {
      id: this.generateMoveId(),
      column,
      player,
      timestamp: Date.now(),
      synced: !offline,
      offline
    };

    // Apply move to board
    const row = this.applyMoveToBoard(column, player);
    this.currentGame.moves.push(move);
    
    if (offline) {
      this.currentGame.offlineMoves.push(move);
    }

    // Check for winner
    const winner = this.checkWinner(row, column, player);
    if (winner) {
      this.currentGame.status = 'won';
      this.currentGame.winner = winner;
    } else if (this.isBoardFull()) {
      this.currentGame.status = 'draw';
    } else {
      // Switch player
      this.currentGame.currentPlayer = player === 'Red' ? 'Yellow' : 'Red';
    }

    this.currentGame.updatedAt = new Date();

    // Save move
    await this.saveMove(move);
    
    // Emit events
    this.emit('move:made', { move, gameState: this.currentGame });
    
    if (!move.synced) {
      this.syncQueue.push(move);
      this.emit('move:queued', move);
    }

    return move;
  }

  /**
   * Sync offline moves
   */
  async syncOfflineMoves(syncFunction: (moves: Move[]) => Promise<boolean>): Promise<void> {
    if (this.syncQueue.length === 0) return;

    const movesToSync = [...this.syncQueue];
    this.emit('sync:started', { count: movesToSync.length });

    try {
      const success = await syncFunction(movesToSync);
      
      if (success) {
        // Mark moves as synced
        for (const move of movesToSync) {
          move.synced = true;
          await this.updateMove(move);
        }
        
        // Clear sync queue
        this.syncQueue = this.syncQueue.filter(m => !movesToSync.includes(m));
        
        // Update game
        if (this.currentGame) {
          this.currentGame.offlineMoves = this.currentGame.offlineMoves.filter(
            m => !movesToSync.some(sm => sm.id === m.id)
          );
          this.currentGame.lastSyncedAt = new Date();
          await this.saveGame();
        }
        
        this.emit('sync:completed', { count: movesToSync.length });
      } else {
        this.emit('sync:failed', { moves: movesToSync });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('sync:error', { error, moves: movesToSync });
    }
  }

  /**
   * Handle incoming sync from server
   */
  async handleIncomingSync(serverState: Partial<GameState>): Promise<void> {
    if (!this.currentGame) return;

    const conflicts = this.detectConflicts(serverState);
    
    if (conflicts.length > 0) {
      // Resolve conflicts
      const resolution = await this.resolveConflicts(conflicts, serverState);
      
      if (resolution.type === 'server-wins') {
        // Apply server state
        this.currentGame = {
          ...this.currentGame,
          ...serverState,
          lastSyncedAt: new Date()
        };
      } else if (resolution.type === 'merge') {
        // Merge states
        this.currentGame = resolution.mergedState;
      }
      
      this.emit('conflict:resolved', { conflicts, resolution });
    } else {
      // No conflicts, apply server state
      this.currentGame = {
        ...this.currentGame,
        ...serverState,
        lastSyncedAt: new Date()
      };
    }

    await this.saveGame();
    this.emit('sync:applied', this.currentGame);
  }

  /**
   * Get recovery snapshot
   */
  async getRecoverySnapshot(): Promise<any> {
    if (!this.currentGame) return null;

    return {
      gameId: this.currentGame.id,
      board: this.currentGame.board,
      lastMoveId: this.currentGame.moves[this.currentGame.moves.length - 1]?.id,
      boardChecksum: this.calculateChecksum(this.currentGame.board),
      moveCount: this.currentGame.moves.length,
      offlineMoveCount: this.currentGame.offlineMoves.length,
      timestamp: Date.now()
    };
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshot: any, fullState?: GameState): Promise<void> {
    if (fullState) {
      this.currentGame = fullState;
      await this.saveGame();
    } else {
      // Partial restore
      if (this.currentGame && snapshot.gameId === this.currentGame.id) {
        // Verify checksum
        const currentChecksum = this.calculateChecksum(this.currentGame.board);
        if (currentChecksum !== snapshot.boardChecksum) {
          this.emit('restore:checksum-mismatch', { 
            expected: snapshot.boardChecksum, 
            actual: currentChecksum 
          });
        }
      }
    }

    this.emit('game:restored', this.currentGame);
  }

  /**
   * Get recent games
   */
  async getRecentGames(limit: number = 10): Promise<GameState[]> {
    if (!this.indexedDB) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['games'], 'readonly');
      const store = transaction.objectStore('games');
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev');
      const games: GameState[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && games.length < limit) {
          games.push(cursor.value);
          cursor.continue();
        } else {
          resolve(games);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear old games
   */
  async clearOldGames(): Promise<void> {
    const games = await this.getRecentGames(this.options.maxStoredGames * 2);
    const gamesToDelete = games.slice(this.options.maxStoredGames);

    for (const game of gamesToDelete) {
      await this.deleteGame(game.id);
    }
  }

  /**
   * Private helper methods
   */

  private createEmptyBoard(): CellValue[][] {
    return Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue));
  }

  private generateId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMoveId(): string {
    return `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidMove(column: number): boolean {
    if (!this.currentGame) return false;
    return column >= 0 && column < 7 && this.currentGame.board[0][column] === 'Empty';
  }

  private applyMoveToBoard(column: number, player: 'Red' | 'Yellow'): number {
    if (!this.currentGame) throw new Error('No active game');

    for (let row = 5; row >= 0; row--) {
      if (this.currentGame.board[row][column] === 'Empty') {
        this.currentGame.board[row][column] = player;
        return row;
      }
    }

    throw new Error('Column is full');
  }

  private checkWinner(row: number, col: number, player: 'Red' | 'Yellow'): 'Red' | 'Yellow' | null {
    if (!this.currentGame) return null;

    const directions = [
      [[0, 1], [0, -1]], // Horizontal
      [[1, 0], [-1, 0]], // Vertical
      [[1, 1], [-1, -1]], // Diagonal \
      [[1, -1], [-1, 1]] // Diagonal /
    ];

    for (const direction of directions) {
      let count = 1;

      for (const [dr, dc] of direction) {
        let r = row + dr;
        let c = col + dc;

        while (
          r >= 0 && r < 6 && c >= 0 && c < 7 &&
          this.currentGame.board[r][c] === player
        ) {
          count++;
          r += dr;
          c += dc;
        }
      }

      if (count >= 4) {
        return player;
      }
    }

    return null;
  }

  private isBoardFull(): boolean {
    if (!this.currentGame) return false;
    return this.currentGame.board[0].every(cell => cell !== 'Empty');
  }

  private async saveMove(move: Move): Promise<void> {
    if (!this.indexedDB || !this.currentGame) return;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['moves'], 'readwrite');
      const store = transaction.objectStore('moves');
      const request = store.put({
        ...move,
        gameId: this.currentGame!.id
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateMove(move: Move): Promise<void> {
    return this.saveMove(move);
  }

  private async loadMoves(gameId: string): Promise<Move[]> {
    if (!this.indexedDB) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['moves'], 'readonly');
      const store = transaction.objectStore('moves');
      const index = store.index('gameId');
      const request = index.getAll(gameId);

      request.onsuccess = () => {
        const moves = request.result;
        moves.sort((a, b) => a.timestamp - b.timestamp);
        resolve(moves);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async deleteGame(gameId: string): Promise<void> {
    if (!this.indexedDB) return;

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['games', 'moves'], 'readwrite');
      
      // Delete game
      transaction.objectStore('games').delete(gameId);
      
      // Delete moves
      const moveIndex = transaction.objectStore('moves').index('gameId');
      const moveRequest = moveIndex.openCursor(IDBKeyRange.only(gameId));
      
      moveRequest.onsuccess = () => {
        const cursor = moveRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveGame();
    }, this.options.autoSaveInterval);
  }

  private calculateChecksum(board: CellValue[][]): string {
    const flat = board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < flat.length; i++) {
      const char = flat.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }

  private detectConflicts(serverState: Partial<GameState>): any[] {
    const conflicts: any[] = [];

    if (!this.currentGame || !serverState.moves) return conflicts;

    // Check for divergent moves
    const localMoves = this.currentGame.moves;
    const serverMoves = serverState.moves;
    
    const minLength = Math.min(localMoves.length, serverMoves.length);
    
    for (let i = 0; i < minLength; i++) {
      if (localMoves[i].id !== serverMoves[i].id) {
        conflicts.push({
          type: 'divergent-history',
          index: i,
          local: localMoves[i],
          server: serverMoves[i]
        });
        break;
      }
    }

    // Check for offline moves
    if (this.currentGame.offlineMoves.length > 0) {
      conflicts.push({
        type: 'offline-moves',
        moves: this.currentGame.offlineMoves
      });
    }

    return conflicts;
  }

  private async resolveConflicts(conflicts: any[], serverState: Partial<GameState>): Promise<any> {
    // Simple resolution strategy - can be made more sophisticated
    if (conflicts.some(c => c.type === 'divergent-history')) {
      // Server wins for divergent history
      return { type: 'server-wins' };
    }

    if (conflicts.some(c => c.type === 'offline-moves')) {
      // Try to merge offline moves
      // This would need more sophisticated logic in production
      return { type: 'merge', mergedState: { ...this.currentGame, ...serverState } };
    }

    return { type: 'server-wins' };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    if (this.indexedDB) {
      this.indexedDB.close();
    }
    
    this.removeAllListeners();
  }
}