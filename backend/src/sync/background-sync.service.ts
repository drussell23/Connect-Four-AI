/**
 * Background Sync Service
 * Manages background synchronization of game state
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval, Cron } from '@nestjs/schedule';
import { Game } from '../game/entities/game.entity';
import { Move } from '../game/entities/move.entity';
import { SyncJob } from './entities/sync-job.entity';
import { SyncQueueService } from './sync-queue.service';
import { ConflictResolutionService } from './conflict-resolution.service';

export interface SyncRequest {
  type: 'game' | 'moves' | 'full';
  gameId: string;
  playerId: string;
  data: any;
  priority: number;
  retryCount?: number;
  lastAttempt?: Date;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  conflicts: number;
  errors: string[];
  timestamp: Date;
}

@Injectable()
export class BackgroundSyncService implements OnModuleInit {
  private syncInProgress = false;
  private syncQueue: SyncRequest[] = [];
  private activeSyncJobs: Map<string, SyncJob> = new Map();

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(Move)
    private moveRepository: Repository<Move>,
    @InjectRepository(SyncJob)
    private syncJobRepository: Repository<SyncJob>,
    private syncQueueService: SyncQueueService,
    private conflictResolution: ConflictResolutionService,
    private eventEmitter: EventEmitter2
  ) {}

  onModuleInit() {
    console.log('🔄 Background Sync Service initialized');
    this.loadPendingSyncJobs();
  }

  /**
   * Register sync request
   */
  async registerSync(request: SyncRequest): Promise<string> {
    // Create sync job
    const syncJob = await this.syncJobRepository.save({
      type: request.type,
      gameId: request.gameId,
      playerId: request.playerId,
      data: request.data,
      status: 'pending',
      priority: request.priority,
      createdAt: new Date()
    });

    // Add to queue
    this.syncQueueService.enqueue({
      ...request,
      syncJobId: syncJob.id
    });

    this.eventEmitter.emit('sync.registered', {
      syncJobId: syncJob.id,
      type: request.type,
      gameId: request.gameId
    });

    // Trigger immediate sync if not in progress
    if (!this.syncInProgress) {
      this.processSyncQueue();
    }

    return syncJob.id;
  }

  /**
   * Process sync queue
   */
  @Interval(5000) // Every 5 seconds
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || this.syncQueueService.isEmpty()) {
      return;
    }

    this.syncInProgress = true;

    try {
      const batch = this.syncQueueService.getBatch(10);
      const results = await Promise.allSettled(
        batch.map(item => this.processSyncItem(item))
      );

      // Update sync jobs
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = batch[i];
        
        if (result.status === 'fulfilled' && result.value.success) {
          await this.markSyncComplete(item.syncJobId, result.value);
        } else {
          await this.markSyncFailed(
            item.syncJobId, 
            result.status === 'rejected' ? result.reason : result.value.errors
          );
          
          // Retry if needed
          if ((item.retryCount || 0) < 3) {
            this.syncQueueService.enqueue({
              ...item,
              retryCount: (item.retryCount || 0) + 1,
              lastAttempt: new Date()
            });
          }
        }
      }

      this.eventEmitter.emit('sync.batch.completed', {
        processed: batch.length,
        succeeded: results.filter(r => r.status === 'fulfilled').length
      });

    } catch (error) {
      console.error('Sync queue processing error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(item: any): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      switch (item.type) {
        case 'moves':
          return await this.syncMoves(item);
          
        case 'game':
          return await this.syncGameState(item);
          
        case 'full':
          return await this.fullSync(item);
          
        default:
          throw new Error(`Unknown sync type: ${item.type}`);
      }
    } catch (error) {
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Sync moves
   */
  private async syncMoves(item: any): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      const moves = item.data.moves;
      const gameId = item.gameId;

      // Get current game state
      const game = await this.gameRepository.findOne({
        where: { id: gameId },
        relations: ['moves']
      });

      if (!game) {
        throw new Error('Game not found');
      }

      // Check for conflicts
      const conflicts = await this.conflictResolution.detectMoveConflicts(
        game,
        moves
      );

      if (conflicts.length > 0) {
        // Resolve conflicts
        const resolution = await this.conflictResolution.resolveConflicts(
          conflicts,
          'client-first' // or based on config
        );

        result.conflicts = conflicts.length;
        
        // Apply resolved moves
        for (const move of resolution.moves) {
          await this.applyMove(game, move);
          result.syncedItems++;
        }
      } else {
        // No conflicts, apply all moves
        for (const move of moves) {
          await this.applyMove(game, move);
          result.syncedItems++;
        }
      }

      result.success = true;
      
      this.eventEmitter.emit('sync.moves.completed', {
        gameId,
        syncedMoves: result.syncedItems,
        conflicts: result.conflicts
      });

    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Sync game state
   */
  private async syncGameState(item: any): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      const clientState = item.data;
      const gameId = item.gameId;

      // Get server state
      const serverGame = await this.gameRepository.findOne({
        where: { id: gameId },
        relations: ['moves']
      });

      if (!serverGame) {
        // Create new game from client state
        const newGame = await this.gameRepository.save({
          id: gameId,
          board: clientState.board,
          currentPlayer: clientState.currentPlayer,
          status: clientState.status,
          winner: clientState.winner,
          aiDifficulty: clientState.aiDifficulty,
          createdAt: clientState.createdAt,
          updatedAt: new Date()
        });

        result.syncedItems = 1;
        result.success = true;
        return result;
      }

      // Check for conflicts
      const stateConflicts = await this.conflictResolution.detectStateConflicts(
        serverGame,
        clientState
      );

      if (stateConflicts.length > 0) {
        // Resolve conflicts
        const resolution = await this.conflictResolution.resolveStateConflicts(
          stateConflicts,
          serverGame,
          clientState
        );

        // Apply resolved state
        await this.gameRepository.save({
          ...serverGame,
          ...resolution.mergedState,
          updatedAt: new Date()
        });

        result.conflicts = stateConflicts.length;
      } else {
        // No conflicts, update server state
        await this.gameRepository.save({
          ...serverGame,
          board: clientState.board,
          currentPlayer: clientState.currentPlayer,
          status: clientState.status,
          winner: clientState.winner,
          updatedAt: new Date()
        });
      }

      result.syncedItems = 1;
      result.success = true;

    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Full sync
   */
  private async fullSync(item: any): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedItems: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      // Sync game state first
      const gameResult = await this.syncGameState(item);
      result.syncedItems += gameResult.syncedItems;
      result.conflicts += gameResult.conflicts;
      result.errors.push(...gameResult.errors);

      // Then sync moves
      if (item.data.moves) {
        const movesResult = await this.syncMoves({
          ...item,
          type: 'moves',
          data: { moves: item.data.moves }
        });
        
        result.syncedItems += movesResult.syncedItems;
        result.conflicts += movesResult.conflicts;
        result.errors.push(...movesResult.errors);
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Apply move to game
   */
  private async applyMove(game: Game, moveData: any): Promise<void> {
    // Check if move already exists
    const existingMove = await this.moveRepository.findOne({
      where: {
        game: { id: game.id },
        column: moveData.column,
        createdAt: moveData.timestamp
      }
    });

    if (existingMove) {
      return; // Move already applied
    }

    // Apply move to board
    const row = this.findEmptyRow(game.board, moveData.column);
    if (row === -1) {
      throw new Error(`Column ${moveData.column} is full`);
    }

    game.board[row][moveData.column] = moveData.player;

    // Save move
    await this.moveRepository.save({
      game,
      column: moveData.column,
      row,
      player: moveData.player,
      createdAt: new Date(moveData.timestamp)
    });

    // Update game state
    game.currentPlayer = moveData.player === 'Red' ? 'Yellow' : 'Red';
    game.updatedAt = new Date();
    
    await this.gameRepository.save(game);
  }

  /**
   * Find empty row in column
   */
  private findEmptyRow(board: any[][], column: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][column] === 'Empty') {
        return row;
      }
    }
    return -1;
  }

  /**
   * Mark sync complete
   */
  private async markSyncComplete(syncJobId: string, result: SyncResult): Promise<void> {
    await this.syncJobRepository.update(syncJobId, {
      status: 'completed',
      completedAt: new Date(),
      result: result as any
    });

    this.activeSyncJobs.delete(syncJobId);
  }

  /**
   * Mark sync failed
   */
  private async markSyncFailed(syncJobId: string, errors: any): Promise<void> {
    await this.syncJobRepository.update(syncJobId, {
      status: 'failed',
      completedAt: new Date(),
      error: JSON.stringify(errors)
    });

    this.activeSyncJobs.delete(syncJobId);
  }

  /**
   * Load pending sync jobs on startup
   */
  private async loadPendingSyncJobs(): Promise<void> {
    const pendingJobs = await this.syncJobRepository.find({
      where: { status: 'pending' },
      order: { priority: 'DESC', createdAt: 'ASC' }
    });

    for (const job of pendingJobs) {
      this.syncQueueService.enqueue({
        type: job.type as any,
        gameId: job.gameId,
        playerId: job.playerId,
        data: job.data,
        priority: job.priority,
        syncJobId: job.id
      });
    }

    console.log(`Loaded ${pendingJobs.length} pending sync jobs`);
  }

  /**
   * Clean up old sync jobs
   */
  @Cron('0 0 * * *') // Daily at midnight
  async cleanupOldSyncJobs(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.syncJobRepository
      .createQueryBuilder()
      .delete()
      .where('completedAt < :date', { date: thirtyDaysAgo })
      .andWhere('status IN (:...statuses)', { 
        statuses: ['completed', 'failed'] 
      })
      .execute();

    console.log(`Cleaned up ${result.affected} old sync jobs`);
  }

  /**
   * Get sync status
   */
  async getSyncStatus(gameId?: string): Promise<any> {
    const query = this.syncJobRepository.createQueryBuilder('job');
    
    if (gameId) {
      query.where('job.gameId = :gameId', { gameId });
    }

    const stats = await query
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany();

    return {
      queueSize: this.syncQueueService.size(),
      syncInProgress: this.syncInProgress,
      stats: stats.reduce((acc, stat) => {
        acc[stat.status] = parseInt(stat.count);
        return acc;
      }, {}),
      activeSyncJobs: this.activeSyncJobs.size
    };
  }
}