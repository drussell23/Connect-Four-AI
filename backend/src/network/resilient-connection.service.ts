/**
 * Resilient Connection Service
 * Manages client connections with automatic recovery and state synchronization
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../game/entities/game.entity';

export interface ConnectionState {
  socketId: string;
  gameId: string | null;
  playerId: string;
  lastSeen: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  missedMoves: any[];
  pendingSync: boolean;
}

export interface ReconnectionData {
  playerId: string;
  gameId: string;
  lastMoveId: string;
  boardChecksum: string;
}

export interface SyncPacket {
  type: 'full' | 'delta';
  gameState?: any;
  moves?: any[];
  timestamp: number;
  checksum: string;
}

@Injectable()
export class ResilientConnectionService implements OnModuleInit {
  private connections: Map<string, ConnectionState> = new Map();
  private gameStates: Map<string, any> = new Map();
  private pendingSyncs: Map<string, SyncPacket[]> = new Map();
  private heartbeatInterval: NodeJS.Timer;
  private syncInterval: NodeJS.Timer;

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>
  ) {}

  onModuleInit() {
    this.startHeartbeat();
    this.startSyncProcessor();
    this.setupEventListeners();
    console.log('🔌 Resilient Connection Service initialized');
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket: Socket, playerId: string): void {
    const connectionState: ConnectionState = {
      socketId: socket.id,
      gameId: null,
      playerId,
      lastSeen: new Date(),
      connectionQuality: 'excellent',
      missedMoves: [],
      pendingSync: false
    };

    this.connections.set(socket.id, connectionState);

    // Setup socket event handlers
    this.setupSocketHandlers(socket);

    // Check for pending syncs
    this.processPendingSyncs(playerId, socket);

    this.eventEmitter.emit('connection.established', {
      socketId: socket.id,
      playerId
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // Mark as disconnected but keep state for reconnection
    connection.connectionQuality = 'disconnected';
    connection.lastSeen = new Date();

    // Don't immediately remove - wait for potential reconnection
    setTimeout(() => {
      const conn = this.connections.get(socketId);
      if (conn && conn.connectionQuality === 'disconnected') {
        // Clean up after timeout
        this.connections.delete(socketId);
        this.cleanupGameState(conn.gameId);
      }
    }, 300000); // 5 minutes

    this.eventEmitter.emit('connection.lost', {
      socketId,
      playerId: connection.playerId,
      gameId: connection.gameId
    });
  }

  /**
   * Handle client reconnection
   */
  async handleReconnection(
    socket: Socket, 
    reconnectionData: ReconnectionData
  ): Promise<boolean> {
    try {
      // Find previous connection
      const previousConnection = Array.from(this.connections.values())
        .find(conn => 
          conn.playerId === reconnectionData.playerId && 
          conn.gameId === reconnectionData.gameId
        );

      if (!previousConnection) {
        // No previous connection, treat as new
        this.handleConnection(socket, reconnectionData.playerId);
        return false;
      }

      // Update connection
      previousConnection.socketId = socket.id;
      previousConnection.lastSeen = new Date();
      previousConnection.connectionQuality = 'good';
      previousConnection.pendingSync = true;

      this.connections.set(socket.id, previousConnection);

      // Verify game state
      const isValid = await this.verifyGameState(
        reconnectionData.gameId,
        reconnectionData.boardChecksum
      );

      if (isValid) {
        // Send missed moves
        await this.sendMissedMoves(socket, previousConnection);
      } else {
        // Full resync needed
        await this.fullResync(socket, reconnectionData.gameId);
      }

      this.eventEmitter.emit('connection.restored', {
        socketId: socket.id,
        playerId: reconnectionData.playerId,
        gameId: reconnectionData.gameId,
        missedMoves: previousConnection.missedMoves.length
      });

      return true;

    } catch (error) {
      console.error('Reconnection failed:', error);
      return false;
    }
  }

  /**
   * Track game move for sync
   */
  trackMove(gameId: string, move: any): void {
    // Update game state cache
    const gameState = this.gameStates.get(gameId) || { moves: [] };
    gameState.moves.push({
      ...move,
      timestamp: Date.now(),
      id: this.generateMoveId()
    });
    this.gameStates.set(gameId, gameState);

    // Track for disconnected players
    this.connections.forEach(conn => {
      if (conn.gameId === gameId && conn.connectionQuality === 'disconnected') {
        conn.missedMoves.push(move);
      }
    });
  }

  /**
   * Get connection quality for player
   */
  getConnectionQuality(playerId: string): ConnectionState['connectionQuality'] {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.playerId === playerId);
    
    return connection?.connectionQuality || 'disconnected';
  }

  /**
   * Force sync for game
   */
  async forceSyncGame(gameId: string, io: Server): Promise<void> {
    const game = await this.gameRepository.findOne({ 
      where: { id: gameId },
      relations: ['moves']
    });

    if (!game) return;

    const syncPacket: SyncPacket = {
      type: 'full',
      gameState: {
        id: game.id,
        board: game.board,
        currentPlayer: game.currentPlayer,
        status: game.status,
        moves: game.moves
      },
      timestamp: Date.now(),
      checksum: this.calculateChecksum(game.board)
    };

    // Send to all connected players in game
    this.connections.forEach((conn, socketId) => {
      if (conn.gameId === gameId && conn.connectionQuality !== 'disconnected') {
        io.to(socketId).emit('game:sync', syncPacket);
      }
    });
  }

  /**
   * Private methods
   */

  private setupSocketHandlers(socket: Socket): void {
    // Heartbeat
    socket.on('heartbeat', () => {
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.lastSeen = new Date();
        socket.emit('heartbeat:ack', { timestamp: Date.now() });
      }
    });

    // Sync acknowledgment
    socket.on('sync:ack', (data: { checksum: string; lastMoveId: string }) => {
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.pendingSync = false;
        connection.missedMoves = [];
      }
    });

    // Connection quality report
    socket.on('connection:quality', (quality: { latency: number; jitter: number }) => {
      const connection = this.connections.get(socket.id);
      if (connection) {
        // Update connection quality based on metrics
        if (quality.latency < 100) {
          connection.connectionQuality = 'excellent';
        } else if (quality.latency < 300) {
          connection.connectionQuality = 'good';
        } else {
          connection.connectionQuality = 'poor';
        }
      }
    });
  }

  private async verifyGameState(
    gameId: string, 
    clientChecksum: string
  ): Promise<boolean> {
    const gameState = this.gameStates.get(gameId);
    if (!gameState) {
      // Load from database
      const game = await this.gameRepository.findOne({ 
        where: { id: gameId } 
      });
      if (!game) return false;
      
      const serverChecksum = this.calculateChecksum(game.board);
      return serverChecksum === clientChecksum;
    }

    const serverChecksum = this.calculateChecksum(gameState.board);
    return serverChecksum === clientChecksum;
  }

  private async sendMissedMoves(
    socket: Socket, 
    connection: ConnectionState
  ): Promise<void> {
    if (connection.missedMoves.length === 0) return;

    const syncPacket: SyncPacket = {
      type: 'delta',
      moves: connection.missedMoves,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(
        this.gameStates.get(connection.gameId!)?.board || []
      )
    };

    socket.emit('game:sync', syncPacket);
  }

  private async fullResync(socket: Socket, gameId: string): Promise<void> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['moves'],
      order: { moves: { createdAt: 'ASC' } }
    });

    if (!game) {
      socket.emit('game:error', { message: 'Game not found' });
      return;
    }

    const syncPacket: SyncPacket = {
      type: 'full',
      gameState: {
        id: game.id,
        board: game.board,
        currentPlayer: game.currentPlayer,
        status: game.status,
        moves: game.moves.map(m => ({
          column: m.column,
          player: m.player,
          timestamp: m.createdAt.getTime()
        }))
      },
      timestamp: Date.now(),
      checksum: this.calculateChecksum(game.board)
    };

    socket.emit('game:sync', syncPacket);

    // Update game state cache
    this.gameStates.set(gameId, {
      board: game.board,
      moves: game.moves,
      lastSync: Date.now()
    });
  }

  private processPendingSyncs(playerId: string, socket: Socket): void {
    const pendingSyncs = this.pendingSyncs.get(playerId);
    if (!pendingSyncs || pendingSyncs.length === 0) return;

    // Send all pending syncs
    pendingSyncs.forEach(sync => {
      socket.emit('game:sync', sync);
    });

    // Clear pending syncs
    this.pendingSyncs.delete(playerId);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      this.connections.forEach((conn, socketId) => {
        const timeSinceLastSeen = now - conn.lastSeen.getTime();
        
        if (timeSinceLastSeen > timeout && conn.connectionQuality !== 'disconnected') {
          // Mark as potentially disconnected
          conn.connectionQuality = 'poor';
          
          if (timeSinceLastSeen > timeout * 2) {
            // Definitely disconnected
            this.handleDisconnection(socketId);
          }
        }
      });
    }, 10000); // Check every 10 seconds
  }

  private startSyncProcessor(): void {
    this.syncInterval = setInterval(() => {
      // Process any pending syncs
      this.connections.forEach(conn => {
        if (conn.pendingSync && conn.connectionQuality !== 'disconnected') {
          // Retry sync
          this.eventEmitter.emit('connection.sync.retry', {
            socketId: conn.socketId,
            gameId: conn.gameId
          });
        }
      });
    }, 5000); // Every 5 seconds
  }

  private setupEventListeners(): void {
    // Game events
    this.eventEmitter.on('game.move.made', (event) => {
      this.trackMove(event.gameId, event.move);
    });

    // Connection events
    this.eventEmitter.on('socket.joined.game', (event) => {
      const connection = this.connections.get(event.socketId);
      if (connection) {
        connection.gameId = event.gameId;
      }
    });
  }

  private calculateChecksum(board: any): string {
    // Simple checksum for board state
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(board))
      .digest('hex')
      .substring(0, 8);
  }

  private generateMoveId(): string {
    return `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupGameState(gameId: string | null): void {
    if (!gameId) return;

    // Check if any other connections are using this game
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.gameId === gameId);

    if (activeConnections.length === 0) {
      // No active connections, safe to cleanup
      setTimeout(() => {
        this.gameStates.delete(gameId);
      }, 600000); // 10 minutes
    }
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval as any);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval as any);
    }
  }
}