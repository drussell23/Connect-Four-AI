/**
 * Background Sync Module
 * Handles background synchronization of game state
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BackgroundSyncService } from './background-sync.service';
import { SyncQueueService } from './sync-queue.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { Game } from '../game/entities/game.entity';
import { Move } from '../game/entities/move.entity';
import { SyncJob } from './entities/sync-job.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Move, SyncJob]),
    EventEmitterModule
  ],
  providers: [
    BackgroundSyncService,
    SyncQueueService,
    ConflictResolutionService
  ],
  exports: [
    BackgroundSyncService,
    SyncQueueService,
    ConflictResolutionService
  ]
})
export class BackgroundSyncModule {}