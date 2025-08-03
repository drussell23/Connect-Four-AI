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
  connectedAt?: Date;
  reconnecting?: boolean;
}

export type GameEventHandler = (data: any) => void;

export class OfflineGameService {
  private socket: Socket | null = null;
  private gameStateManager: GameStateManager;
  private config: GameServiceConfig;
  private connectionStatus: ConnectionStatus;
  private eventHandlers: Map<string, Set<GameEventHandler>>;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
      this.connectionStatus.lastError = error instanceof Error ? error.message : String(error);
      
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
    const currentGame = this.gameStateManager.getCurrentGame;
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
    const currentGame = this.gameStateManager.getCurrentGame;
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

        this.aiWorker!.addEventListener('message', handler);
        this.aiWorker!.postMessage({
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
  /**
   * Enhanced winner checking with detailed win information and pattern recognition
   */
  private checkWinner(
    board: CellValue[][], 
    row: number, 
    col: number, 
    player: CellValue,
    options: {
      returnWinDetails?: boolean;
      checkThreats?: boolean;
      evaluateStrength?: boolean;
    } = {}
  ): boolean | {
    isWinner: boolean;
    winPattern?: {
      type: 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up';
      positions: Array<[number, number]>;
      length: number;
    };
    threats?: Array<{
      position: [number, number];
      type: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }>;
    boardStrength?: {
      player: number;
      opponent: number;
      advantage: number;
    };
  } {
    const { returnWinDetails = false, checkThreats = false, evaluateStrength = false } = options;
    
    // Validate inputs
    if (!board || row < 0 || row >= 6 || col < 0 || col >= 7) {
      console.warn('Invalid board position for win check:', { row, col });
      return returnWinDetails ? { isWinner: false } : false;
    }
    
    if (player !== 'Red' && player !== 'Yellow') {
      console.warn('Invalid player for win check:', player);
      return returnWinDetails ? { isWinner: false } : false;
    }

    // Direction vectors: horizontal, vertical, diagonal-down, diagonal-up
    const directions = [
      { name: 'horizontal', vectors: [[0, 1], [0, -1]] },
      { name: 'vertical', vectors: [[1, 0], [-1, 0]] },
      { name: 'diagonal-down', vectors: [[1, 1], [-1, -1]] },
      { name: 'diagonal-up', vectors: [[1, -1], [-1, 1]] }
    ] as const;

    let winPattern = null;
    const threats: Array<{ position: [number, number]; type: string; priority: 'critical' | 'high' | 'medium' | 'low' }> = [];

    // Check each direction for wins
    for (const direction of directions) {
      const positions: Array<[number, number]> = [[row, col]];
      let count = 1;
      
      // Count in both directions
      for (const [dr, dc] of direction.vectors) {
        let r = row + dr;
        let c = col + dc;
        
        while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          positions.push([r, c]);
          count++;
          r += dr;
          c += dc;
        }
        
        // Check for threats (3 in a row with empty space)
        if (checkThreats && r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === 'Empty') {
          if (count === 3) {
            threats.push({
              position: [r, c],
              type: `${direction.name}-threat`,
              priority: 'critical'
            });
          } else if (count === 2) {
            threats.push({
              position: [r, c],
              type: `${direction.name}-potential`,
              priority: 'high'
            });
          }
        }
      }
      
      // Found a win
      if (count >= 4) {
        winPattern = {
          type: direction.name as 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up',
          positions: positions.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
          length: count
        };
        
        if (!returnWinDetails) {
          return true;
        }
        break; // Continue checking for additional info if returnWinDetails is true
      }
    }

    // Evaluate board strength if requested
    let boardStrength;
    if (evaluateStrength) {
      boardStrength = this.evaluateBoardStrength(board, player);
    }

    // Check for additional threats across the board
    if (checkThreats && !winPattern) {
      const additionalThreats = this.findAllThreats(board, player);
      threats.push(...additionalThreats);
    }

    if (returnWinDetails) {
      return {
        isWinner: winPattern !== null,
        winPattern: winPattern || undefined,
        threats: threats.length > 0 ? threats : undefined,
        boardStrength
      };
    }
    
    return winPattern !== null;
  }

  /**
   * Evaluate the overall strength of board positions
   */
  private evaluateBoardStrength(board: CellValue[][], player: CellValue): {
    player: number;
    opponent: number;
    advantage: number;
  } {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    let playerScore = 0;
    let opponentScore = 0;

    // Position weights (center columns are more valuable)
    const columnWeights = [1, 2, 3, 4, 3, 2, 1];
    const rowWeights = [1, 2, 3, 3, 2, 1];

    // Evaluate each position
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        const positionValue = columnWeights[col] * rowWeights[row];
        
        if (cell === player) {
          playerScore += positionValue;
          
          // Check for patterns
          playerScore += this.evaluatePatterns(board, row, col, player) * 10;
        } else if (cell === opponent) {
          opponentScore += positionValue;
          opponentScore += this.evaluatePatterns(board, row, col, opponent) * 10;
        }
      }
    }

    return {
      player: playerScore,
      opponent: opponentScore,
      advantage: playerScore - opponentScore
    };
  }

  /**
   * Evaluate patterns around a position
   */
  private evaluatePatterns(board: CellValue[][], row: number, col: number, player: CellValue): number {
    let score = 0; // Initialize score to 0
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]; // Directions to check for patterns (horizontal, vertical, diagonal-down, diagonal-up)
  
    // Check each direction for patterns
    for (const [dr, dc] of directions) {
      let consecutive = 0; // Count of consecutive pieces in the direction
      let openEnds = 0; // Count of open ends in the direction
      
      // Check forward (positive direction)
      let r = row + dr; // Start from the current position
      let c = col + dc; // Start from the current position
      
      // Check forward (positive direction) for consecutive pieces (player's pieces) and count them
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        consecutive++; // Increment the count of consecutive pieces
        r += dr; // Move to the next position in the direction 
        c += dc; // Move to the next position in the direction
      }

      // Check if the next position is empty (open end) and count it if it is empty 
      // (open end) and if it is not empty (open end) then break the loop and continue 
      // with the next direction 
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === 'Empty') 
        openEnds++; // Increment the count of open ends
      
      // Check backward (negative direction)
      r = row - dr; // Start from the current position
      c = col - dc; // Start from the current position
      
      // Check backward (negative direction) for consecutive pieces (player's pieces) and count them
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        consecutive++; // Increment the count of consecutive pieces
        r -= dr; // Move to the next position in the direction
        c -= dc; // Move to the next position in the direction
      }

      // Check if the next position is empty (open end) and count it if it is empty 
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === 'Empty') 
        openEnds++; // Increment the count of open ends 
      
      // Score based on pattern length and open ends 
      if (consecutive >= 3) score += 50; // If there are 3 consecutive pieces, score is 50
      else if (consecutive >= 2) score += 10; // If there are 2 consecutive pieces, score is 10
      else if (consecutive >= 1) score += 1; // If there is 1 consecutive piece, score is 1
      
      score += openEnds * 5; // Score based on the number of open ends (5 points per open end) 
    }
    
    return score; // Return the score of the pattern 
  }

  /**
   * Find all threats on the board (critical threats) 
   */
  private findAllThreats(
    board: CellValue[][], // The board to check for threats
    player: CellValue // The player to check for threats
  ): Array<{ position: [number, number]; type: string; priority: 'critical' | 'high' | 'medium' | 'low' }> {
    const threats: Array<{ position: [number, number]; type: string; priority: 'critical' | 'high' | 'medium' | 'low' }> = []; // Initialize an empty array to store the threats 
    const opponent = player === 'Red' ? 'Yellow' : 'Red'; // The opponent of the player 
    
    // Check each empty position on the board 
    for (let row = 0; row < 6; row++) { // Iterate over each row of the board 
      for (let col = 0; col < 7; col++) { // Iterate over each column of the board 
        if (board[row][col] === 'Empty') { // If the position is empty 
          // Check if this position would create a win for either player
          board[row][col] = player; // Place the player's piece on the board 
          if (this.checkWinner(board, row, col, player) === true) { // If the position would create a win for the player 
            threats.push({ // Add the threat to the array 
              position: [row, col], // The position of the threat 
              type: 'winning-move', // The type of threat (winning move) 
              priority: 'critical' // The priority of the threat (critical) 
            });
          }
          board[row][col] = 'Empty'; // Remove the player's piece from the board 
          
          board[row][col] = opponent; // Place the opponent's piece on the board 
          if (this.checkWinner(board, row, col, opponent) === true) { // If the position would create a win for the opponent 
            threats.push({
              position: [row, col], // The position of the threat 
              type: 'must-block', // The type of threat (must-block) 
              priority: 'critical' // The priority of the threat (critical) 
            });
          }
          board[row][col] = 'Empty'; // Remove the opponent's piece from the board 
        }
      }
    }
    
    return threats; // Return the array of threats 
  }

  /**
   * Cache management helpers (for AI moves) 
   */
  private cache: Map<string, { data: any; expiry: number }> = new Map(); // Initialize a map to store the cached data 

  private getCachedData<T>(key: string): T | null { // Get the cached data from the map 
    const cached = this.cache.get(key); // Get the cached data from the map 
    if (cached && cached.expiry > Date.now()) { // If the cached data is not expired 
      return cached.data as T; // Return the cached data 
    }
    this.cache.delete(key); // Delete the cached data from the map 
    return null; // Return null if the cached data is expired 
  }

  private setCachedData(key: string, data: any, ttl: number): void { // Set the cached data in the map 
    this.cache.set(key, { // Set the cached data in the map 
      data, // The data to cache 
      expiry: Date.now() + ttl // The expiry time of the cached data 
    });
  }

  /**
   * Game integrity and repair helpers (for game state) 
   */
  private validateGameIntegrity(game: GameState): boolean { // Validate the integrity of the game state 
    // Check board dimensions (6 rows and 7 columns) 
    if (!game.board || game.board.length !== 6 || 
        !game.board.every(row => row.length === 7)) { // If the board is not 6 rows and 7 columns 
      return false; // Return false if the board is not 6 rows and 7 columns 
    }

    // Check moves are valid (column is between 0 and 6 and player is either Red or Yellow) 
    for (const move of game.moves) { // Iterate over each move 
      if (move.column < 0 || move.column >= 7 || 
          !['Red', 'Yellow'].includes(move.player)) { // If the move is not valid 
        return false; // Return false if the move is not valid 
      }
    }

    // Check game state consistency (board matches the moves) 
    const reconstructedBoard = this.reconstructBoardFromMoves(game.moves); // Reconstruct the board from the moves 
    for (let row = 0; row < 6; row++) { // Iterate over each row of the board 
      for (let col = 0; col < 7; col++) { // Iterate over each column of the board 
        if (game.board[row][col] !== reconstructedBoard[row][col]) { // If the board does not match the moves 
          return false; // Return false if the board does not match the moves 
        }
      }
    }

    return true; // Return true if the game state is consistent 
  }

  // Repair the game state 
  private async repairGameState(game: GameState): Promise<GameState> { 
    console.log('🔧 Attempting to repair game state');
    
    // Reconstruct board from moves
    const repairedBoard = this.reconstructBoardFromMoves(game.moves);
    
    // Determine current player
    const currentPlayer = game.moves.length % 2 === 0 ? 'Red' : 'Yellow';
    
    // Check for winner
    let status: 'active' | 'won' | 'draw' = 'active'; // The status of the game (active, won, draw)
    let winner: 'Red' | 'Yellow' | undefined; // The winner of the game (Red, Yellow, undefined)
    
    // Check if the game has moves 
    if (game.moves.length > 0) {
      const lastMove = game.moves[game.moves.length - 1]; // The last move of the game 
      const row = this.findRowForColumn(repairedBoard, lastMove.column); // Find the row for the last move 
      if (row >= 0) { // If the row is valid 
        const isWin = this.checkWinner(repairedBoard, row, lastMove.column, lastMove.player); // Check if the last move is a win 
        if (isWin) { // If the last move is a win 
          status = 'won'; // Set the status to won 
          winner = lastMove.player; // Set the winner to the last move player 
        }
      }
    }

    // Return the repaired game state 
    return {
      ...game, // The original game state 
      board: repairedBoard, // The repaired board 
      currentPlayer, // The current player 
      status, // The status of the game 
      winner, // The winner of the game 
      updatedAt: new Date() // The updated at time 
    };
  }

  // Reconstruct the board from the moves 
  private reconstructBoardFromMoves(moves: Move[]): CellValue[][] {
    const board: CellValue[][] = Array(6).fill(null).map(() => Array(7).fill('Empty')); // Initialize the board with empty cells 
    
    for (const move of moves) { // Iterate over each move 
      const row = this.findRowForColumn(board, move.column); // Find the row for the move 
      if (row >= 0) { // If the row is valid 
        board[row][move.column] = move.player; // Set the player's piece on the board 
      }
    }
    
    return board; // Return the reconstructed board 
  }

  // Find the row for the column 
  private findRowForColumn(board: CellValue[][], column: number): number {
    for (let row = 5; row >= 0; row--) { // Iterate over each row from the bottom to the top 
      if (board[row][column] === 'Empty') { // If the cell is empty 
        return row; // Return the row 
      }
    }
    return -1; // Return -1 if no empty row is found 
  }

  // Merge the game states (local and server)  
  private mergeGameStates(local: GameState, server: any): GameState {
    // Prefer server state for critical fields 
    return {
      ...local, // The local game state 
      board: server.board || local.board, // The board from the server or the local game state 
      currentPlayer: server.currentPlayer || local.currentPlayer, // The current player from the server or the local game state 
      status: server.status || local.status, // The status from the server or the local game state 
      winner: server.winner || local.winner, // The winner from the server or the local game state 
      moves: server.moves?.length > local.moves.length ? server.moves : local.moves, // The moves from the server or the local game state 
      updatedAt: new Date(Math.max(
        new Date(local.updatedAt).getTime(), // The updated at time from the local game state 
        new Date(server.updatedAt || 0).getTime() // The updated at time from the server 
      )) // The updated at time from the server or the local game state 
    };
  }

  // Load the game backup from the session storage or IndexedDB 
  private async loadGameBackup(gameId: string): Promise<GameState | null> {
    try { // Try to load the game backup from the session storage or IndexedDB 
      // Try loading from session storage
      const sessionBackup = sessionStorage.getItem(`game_backup_${gameId}`); // Get the game backup from the session storage 
      if (sessionBackup) { // If the game backup is found in the session storage 
        return JSON.parse(sessionBackup); // Return the game backup 
      }

      // Try loading from IndexedDB if available
      if (this.gameStateManager.getCurrentGame?.id === gameId) { // If the current game is the same as the gameId 
        return this.gameStateManager.getCurrentGame; // Return the current game 
      }

      return null; // Return null if no game backup is found 
    } catch (error) { // If there is an error 
      console.error('Failed to load game backup:', error); // Log the error 
      return null; // Return null if there is an error 
    }
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
    return this.gameStateManager.getCurrentGame;
  }

  /**
   * Enhanced game loading with validation, caching, and error recovery
   */
  async loadGame(
    gameId: string, 
    options: {
      validateIntegrity?: boolean;
      syncWithServer?: boolean;
      includeAnalytics?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<GameState | null> {
    const { 
      validateIntegrity = true, 
      syncWithServer = this.connectionStatus.connected,
      includeAnalytics = false,
      maxRetries = 3 
    } = options;

    try {
      // Validate gameId format
      if (!gameId || typeof gameId !== 'string' || gameId.length < 6) {
        throw new Error(`Invalid game ID format: ${gameId}`);
      }

      // Try loading from cache first
      const cacheKey = `game_${gameId}`;
      const cachedGame = this.getCachedData<GameState>(cacheKey);
      if (cachedGame && !syncWithServer) {
        console.log(`✅ Loaded game ${gameId} from cache`);
        return cachedGame;
      }

      // Load from local storage
      let game = await this.gameStateManager.loadGame(gameId);

      // Validate game integrity if requested
      if (game && validateIntegrity) {
        const isValid = this.validateGameIntegrity(game);
        if (!isValid) {
          console.warn(`⚠️ Game ${gameId} failed integrity check`);
          // Try to repair the game state
          game = await this.repairGameState(game);
        }
      }

      // Sync with server if connected
      if (game && syncWithServer && this.connectionStatus.connected) {
        let retries = 0;
        while (retries < maxRetries) {
          try {
            const serverGame = await this.socketRequest('game:load', { 
              gameId,
              includeHistory: true,
              includeAnalytics 
            });
            
            // Merge server and local states
            game = this.mergeGameStates(game, serverGame);
            break;
          } catch (error) {
            retries++;
            console.warn(`Failed to sync game ${gameId} with server (attempt ${retries}/${maxRetries}):`, error);
            if (retries >= maxRetries) {
              // Continue with local version
              console.log('Using local game version');
            } else {
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
            }
          }
        }
      }

      // Cache the loaded game
      if (game) {
        this.setCachedData(cacheKey, game, 300000); // Cache for 5 minutes
        
        // Emit game loaded event
        this.emit('game:loaded', { 
          gameId, 
          game, 
          source: syncWithServer ? 'synced' : 'local' 
        });
      }

      return game;
    } catch (error) {
      console.error(`Failed to load game ${gameId}:`, error);
      this.emit('game:load-error', { gameId, error });
      
      // Try recovery from backup
      try {
        const backup = await this.loadGameBackup(gameId);
        if (backup) {
          console.log(`✅ Recovered game ${gameId} from backup`);
          return backup;
        }
      } catch (backupError) {
        console.error('Backup recovery failed:', backupError);
      }
      
      return null;
    }
  }

  /**
   * Enhanced recent games retrieval with filtering and sorting
   */
  async getRecentGames(options: {
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'moves' | 'status';
    sortOrder?: 'asc' | 'desc';
    filter?: {
      status?: 'active' | 'won' | 'draw';
      aiDifficulty?: number;
      minMoves?: number;
      maxMoves?: number;
      winner?: CellValue;
      dateFrom?: Date;
      dateTo?: Date;
    };
    includeStats?: boolean;
  } = {}): Promise<{
    games: GameState[];
    total: number;
    stats?: {
      totalGames: number;
      winRate: number;
      averageMoves: number;
      averageDuration: number;
      difficultyDistribution: Record<number, number>;
    };
  }> {
    const {
      limit = 10,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      filter = {},
      includeStats = false
    } = options;

    try {
      // Get all games from manager
      let games = await this.gameStateManager.getRecentGames();

      // Apply filters
      if (filter.status) {
        games = games.filter(g => g.status === filter.status);
      }
      if (filter.aiDifficulty !== undefined) {
        games = games.filter(g => g.aiDifficulty === filter.aiDifficulty);
      }
      if (filter.minMoves !== undefined) {
        const minMoves = filter.minMoves;
        games = games.filter(g => g.moves.length >= minMoves);
      }
      if (filter.maxMoves !== undefined) {
        const maxMoves = filter.maxMoves;
        games = games.filter(g => g.moves.length <= maxMoves);
      }
      if (filter.winner) {
        games = games.filter(g => g.winner === filter.winner);
      }
      if (filter.dateFrom) {
        const dateFrom = filter.dateFrom;
        games = games.filter(g => new Date(g.createdAt) >= dateFrom);
      }
      if (filter.dateTo) {
        const dateTo = filter.dateTo;
        games = games.filter(g => new Date(g.createdAt) <= dateTo);
      }

      // Sort games (createdAt, updatedAt, moves, status)
      games.sort((a, b) => {
        let compareValue = 0; // The compare value 
        switch (sortBy) { // Switch case for the sortBy parameter 
          case 'createdAt': // If the sortBy parameter is createdAt 
            compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Compare the createdAt time of the two games 
            break;
          case 'updatedAt': // If the sortBy parameter is updatedAt 
            compareValue = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); // Compare the updatedAt time of the two games 
            break;
          case 'moves': // If the sortBy parameter is moves 
            compareValue = a.moves.length - b.moves.length;
            break;
          case 'status': // If the sortBy parameter is status 
            compareValue = a.status.localeCompare(b.status); // Compare the status of the two games 
            break;
        }
        // Return the compare value based on the sortOrder parameter 
        return sortOrder === 'asc' ? compareValue : -compareValue;
      });

      const total = games.length;
      
      // Apply pagination
      const paginatedGames = games.slice(offset, offset + limit);

      // Calculate stats if requested
      let stats;
      if (includeStats) {
        const completedGames = games.filter(g => g.status === 'won' || g.status === 'draw');
        const wonGames = completedGames.filter(g => g.winner === 'Red');
        
        stats = {
          totalGames: games.length,
          winRate: completedGames.length > 0 ? wonGames.length / completedGames.length : 0,
          averageMoves: games.reduce((sum, g) => sum + g.moves.length, 0) / (games.length || 1),
          averageDuration: completedGames.reduce((sum, g) => {
            const duration = new Date(g.updatedAt).getTime() - new Date(g.createdAt).getTime();
            return sum + duration;
          }, 0) / (completedGames.length || 1),
          difficultyDistribution: games.reduce((dist, g) => {
            dist[g.aiDifficulty] = (dist[g.aiDifficulty] || 0) + 1;
            return dist;
          }, {} as Record<number, number>)
        };
      }

      // Emit event
      this.emit('games:fetched', { games: paginatedGames, total, stats });

      return { games: paginatedGames, total, stats };
    } catch (error) {
      console.error('Failed to get recent games:', error);
      this.emit('games:fetch-error', { error });
      return { games: [], total: 0 };
    }
  }

  /**
   * Enhanced connection status with detailed metrics and health scoring
   */
  getConnectionStatus(): ConnectionStatus & {
    health: {
      score: number;
      status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
      factors: {
        connectivity: number;
        latency: number;
        stability: number;
        reliability: number;
      };
    };
    metrics: {
      totalAttempts: number;
      successfulConnections: number;
      averageReconnectTime: number;
      lastSuccessfulConnection: Date | null;
      currentSessionDuration: number;
      dataTransferred: {
        sent: number;
        received: number;
      };
    };
    capabilities: {
      offlineMode: boolean;
      backgroundSync: boolean;
      webWorkers: boolean;
      indexedDB: boolean;
      localStorage: boolean;
    };
  } {
    // Calculate health score
    const now = Date.now();
    const sessionDuration = this.connectionStatus.connected && this.connectionStatus.connectedAt 
      ? now - this.connectionStatus.connectedAt.getTime() 
      : 0;
    
    // Calculate health factors
    const connectivityScore = this.connectionStatus.connected ? 100 : 
                             this.connectionStatus.reconnecting ? 50 : 0;
    
    const latencyScore = this.connectionStatus.latency < 50 ? 100 :
                        this.connectionStatus.latency < 100 ? 80 :
                        this.connectionStatus.latency < 200 ? 60 :
                        this.connectionStatus.latency < 500 ? 40 : 20;
    
    const stabilityScore = sessionDuration > 3600000 ? 100 : // 1 hour
                          sessionDuration > 600000 ? 80 :   // 10 minutes
                          sessionDuration > 60000 ? 60 :    // 1 minute
                          sessionDuration > 10000 ? 40 : 20; // 10 seconds
    
    const reliabilityScore = this.connectionStatus.reconnectAttempts === 0 ? 100 :
                            this.connectionStatus.reconnectAttempts < 3 ? 70 :
                            this.connectionStatus.reconnectAttempts < 5 ? 40 : 10;
    
    // Calculate overall health score
    const healthScore = (connectivityScore * 0.4 + 
                        latencyScore * 0.2 + 
                        stabilityScore * 0.2 + 
                        reliabilityScore * 0.2);
    
    const healthStatus = healthScore >= 90 ? 'excellent' :
                        healthScore >= 75 ? 'good' :
                        healthScore >= 50 ? 'fair' :
                        healthScore >= 25 ? 'poor' : 'critical';

    // Check capabilities
    const capabilities = {
      offlineMode: this.config.enableOffline,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype,
      webWorkers: typeof Worker !== 'undefined',
      indexedDB: 'indexedDB' in window,
      localStorage: 'localStorage' in window
    };

    return {
      ...this.connectionStatus,
      health: {
        score: Math.round(healthScore),
        status: healthStatus,
        factors: {
          connectivity: connectivityScore,
          latency: latencyScore,
          stability: stabilityScore,
          reliability: reliabilityScore
        }
      },
      metrics: {
        totalAttempts: this.connectionStatus.reconnectAttempts + (this.connectionStatus.connected ? 1 : 0),
        successfulConnections: this.connectionStatus.connected ? 1 : 0,
        averageReconnectTime: 0, // Would need to track this
        lastSuccessfulConnection: this.connectionStatus.connectedAt || null,
        currentSessionDuration: sessionDuration,
        dataTransferred: {
          sent: 0, // Would need to track this
          received: 0 // Would need to track this
        }
      },
      capabilities
    };
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