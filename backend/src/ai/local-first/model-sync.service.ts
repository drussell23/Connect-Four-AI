/**
 * Model Synchronization Service
 * Handles syncing AI models between local storage and server
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { LocalModelStore, StoredModel } from './local-model-store';
import axios from 'axios';

export interface SyncConfig {
  serverUrl: string;
  authToken?: string;
  syncInterval: number;
  maxRetries: number;
  conflictResolution: 'local-first' | 'server-first' | 'newest';
  bandwidthLimit?: number;
  deltaSync: boolean;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
  duration: number;
  bytesTransferred: number;
}

export interface ModelManifest {
  models: Array<{
    id: string;
    name: string;
    version: string;
    checksum: string;
    size: number;
    lastModified: Date;
    metadata: any;
  }>;
  lastSync: Date;
  totalSize: number;
}

export interface SyncProgress {
  phase: 'preparing' | 'uploading' | 'downloading' | 'finalizing';
  current: number;
  total: number;
  bytesTransferred: number;
  currentModel?: string;
}

@Injectable()
export class ModelSyncService implements OnModuleInit {
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private syncQueue: Set<string> = new Set();
  private readonly config: SyncConfig;
  private syncHistory: SyncResult[] = [];
  private bandwidthMonitor = {
    bytesTransferred: 0,
    startTime: 0,
    currentRate: 0
  };

  constructor(
    private eventEmitter: EventEmitter2,
    private modelStore: LocalModelStore
  ) {
    this.config = {
      serverUrl: process.env.MODEL_SYNC_URL || 'http://localhost:3000/api/models',
      syncInterval: 300000, // 5 minutes
      maxRetries: 3,
      conflictResolution: 'newest',
      bandwidthLimit: 1024 * 1024, // 1MB/s
      deltaSync: true
    };
  }

  async onModuleInit() {
    console.log('🔄 Model Sync Service initialized');
    this.setupEventListeners();
  }

  /**
   * Perform full synchronization
   */
  async syncModels(options?: Partial<SyncConfig>): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    const config = { ...this.config, ...options };
    const startTime = Date.now();
    const result: SyncResult = {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
      bytesTransferred: 0
    };

    this.syncInProgress = true;
    this.bandwidthMonitor.startTime = startTime;
    this.bandwidthMonitor.bytesTransferred = 0;

    try {
      // Emit sync start
      this.eventEmitter.emit('modelsync.started', { time: new Date() });
      this.updateProgress('preparing', 0, 1);

      // Get local and remote manifests
      const localManifest = await this.getLocalManifest();
      const remoteManifest = await this.getRemoteManifest(config);

      // Calculate sync operations
      const operations = this.calculateSyncOperations(localManifest, remoteManifest, config);

      // Upload new/modified local models
      if (operations.toUpload.length > 0) {
        this.updateProgress('uploading', 0, operations.toUpload.length);
        for (let i = 0; i < operations.toUpload.length; i++) {
          try {
            await this.uploadModel(operations.toUpload[i], config);
            result.uploaded++;
            this.updateProgress('uploading', i + 1, operations.toUpload.length);
          } catch (error) {
            result.errors.push(`Upload failed: ${operations.toUpload[i].name} - ${error.message}`);
          }
        }
      }

      // Download new/modified remote models
      if (operations.toDownload.length > 0) {
        this.updateProgress('downloading', 0, operations.toDownload.length);
        for (let i = 0; i < operations.toDownload.length; i++) {
          try {
            await this.downloadModel(operations.toDownload[i], config);
            result.downloaded++;
            this.updateProgress('downloading', i + 1, operations.toDownload.length);
          } catch (error) {
            result.errors.push(`Download failed: ${operations.toDownload[i].name} - ${error.message}`);
          }
        }
      }

      // Handle conflicts
      if (operations.conflicts.length > 0) {
        for (const conflict of operations.conflicts) {
          try {
            await this.resolveConflict(conflict, config);
            result.conflicts++;
          } catch (error) {
            result.errors.push(`Conflict resolution failed: ${conflict.model.name} - ${error.message}`);
          }
        }
      }

      // Update sync metadata
      this.updateProgress('finalizing', 1, 1);
      await this.updateSyncMetadata(remoteManifest.lastSync);

      // Calculate final stats
      result.duration = Date.now() - startTime;
      result.bytesTransferred = this.bandwidthMonitor.bytesTransferred;
      this.lastSyncTime = new Date();

      // Store sync history
      this.syncHistory.push(result);
      if (this.syncHistory.length > 100) {
        this.syncHistory.shift();
      }

      // Emit sync complete
      this.eventEmitter.emit('modelsync.completed', result);

      return result;

    } catch (error) {
      console.error('Sync failed:', error);
      result.errors.push(`Sync failed: ${error.message}`);
      this.eventEmitter.emit('modelsync.failed', { error: error.message });
      throw error;

    } finally {
      this.syncInProgress = false;
      this.syncQueue.clear();
    }
  }

  /**
   * Queue model for sync
   */
  queueModelForSync(modelId: string): void {
    this.syncQueue.add(modelId);
    
    // Trigger sync if not already in progress
    if (!this.syncInProgress && this.syncQueue.size >= 5) {
      this.syncModels().catch(console.error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    inProgress: boolean;
    lastSync: Date | null;
    queueSize: number;
    history: SyncResult[];
  } {
    return {
      inProgress: this.syncInProgress,
      lastSync: this.lastSyncTime,
      queueSize: this.syncQueue.size,
      history: this.syncHistory
    };
  }

  /**
   * Schedule periodic sync
   */
  @Interval('model-sync', 300000) // 5 minutes
  async scheduledSync() {
    if (!this.syncInProgress) {
      try {
        await this.syncModels();
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    }
  }

  /**
   * Private methods
   */

  private async getLocalManifest(): Promise<ModelManifest> {
    const models = await this.modelStore.queryModels({});
    
    return {
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        version: model.version,
        checksum: model.checksum,
        size: model.metadata.size,
        lastModified: model.metadata.lastUsed,
        metadata: model.metadata
      })),
      lastSync: this.lastSyncTime || new Date(0),
      totalSize: models.reduce((sum, m) => sum + m.metadata.size, 0)
    };
  }

  private async getRemoteManifest(config: SyncConfig): Promise<ModelManifest> {
    try {
      const response = await axios.get(`${config.serverUrl}/manifest`, {
        headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
        params: {
          lastSync: this.lastSyncTime?.toISOString(),
          deltaSync: config.deltaSync
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch remote manifest: ${error.message}`);
    }
  }

  private calculateSyncOperations(
    local: ModelManifest,
    remote: ModelManifest,
    config: SyncConfig
  ): {
    toUpload: StoredModel[];
    toDownload: any[];
    conflicts: Array<{ model: any; reason: string }>;
  } {
    const localMap = new Map(local.models.map(m => [m.checksum, m]));
    const remoteMap = new Map(remote.models.map(m => [m.checksum, m]));
    
    const toUpload: StoredModel[] = [];
    const toDownload: any[] = [];
    const conflicts: Array<{ model: any; reason: string }> = [];

    // Find models to upload
    for (const localModel of local.models) {
      if (!remoteMap.has(localModel.checksum)) {
        // Check if it's a different version of same model
        const remoteVersion = remote.models.find(m => m.name === localModel.name);
        
        if (remoteVersion) {
          // Conflict: different versions
          conflicts.push({
            model: localModel,
            reason: 'version-mismatch'
          });
        } else if (this.syncQueue.has(localModel.id) || !config.deltaSync) {
          // New model to upload
          const fullModel = local.models.find(m => m.id === localModel.id);
          if (fullModel) {
            toUpload.push(fullModel as any);
          }
        }
      }
    }

    // Find models to download
    for (const remoteModel of remote.models) {
      if (!localMap.has(remoteModel.checksum)) {
        toDownload.push(remoteModel);
      }
    }

    return { toUpload, toDownload, conflicts };
  }

  private async uploadModel(model: StoredModel, config: SyncConfig): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Apply bandwidth limiting
      if (config.bandwidthLimit) {
        await this.applyBandwidthLimit(model.metadata.size);
      }

      const formData = new FormData();
      formData.append('model', new Blob([model.weights]));
      formData.append('metadata', JSON.stringify({
        name: model.name,
        version: model.version,
        type: model.type,
        checksum: model.checksum,
        metadata: model.metadata
      }));

      await axios.post(`${config.serverUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {})
        },
        onUploadProgress: (progressEvent) => {
          this.bandwidthMonitor.bytesTransferred += progressEvent.bytes || 0;
          this.updateBandwidthRate();
        }
      });

      this.eventEmitter.emit('modelsync.model.uploaded', {
        modelId: model.id,
        size: model.metadata.size,
        duration: Date.now() - startTime
      });

    } catch (error) {
      throw new Error(`Upload failed for ${model.name}: ${error.message}`);
    }
  }

  private async downloadModel(remoteModel: any, config: SyncConfig): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Apply bandwidth limiting
      if (config.bandwidthLimit) {
        await this.applyBandwidthLimit(remoteModel.size);
      }

      const response = await axios.get(`${config.serverUrl}/download/${remoteModel.id}`, {
        headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent) => {
          this.bandwidthMonitor.bytesTransferred += progressEvent.bytes || 0;
          this.updateBandwidthRate();
        }
      });

      const weights = response.data;
      
      // Verify checksum
      const checksum = await this.calculateChecksum(weights);
      if (checksum !== remoteModel.checksum) {
        throw new Error('Checksum mismatch');
      }

      // Save to local store
      await this.modelStore.saveModel(remoteModel.name, weights, {
        version: remoteModel.version,
        type: remoteModel.type,
        metadata: remoteModel.metadata
      });

      this.eventEmitter.emit('modelsync.model.downloaded', {
        modelName: remoteModel.name,
        size: remoteModel.size,
        duration: Date.now() - startTime
      });

    } catch (error) {
      throw new Error(`Download failed for ${remoteModel.name}: ${error.message}`);
    }
  }

  private async resolveConflict(
    conflict: { model: any; reason: string },
    config: SyncConfig
  ): Promise<void> {
    switch (config.conflictResolution) {
      case 'local-first':
        // Keep local version, upload to server
        await this.uploadModel(conflict.model, config);
        break;
        
      case 'server-first':
        // Download server version, overwrite local
        const remoteModel = await this.getRemoteModel(conflict.model.name, config);
        await this.downloadModel(remoteModel, config);
        break;
        
      case 'newest':
        // Compare timestamps and keep newest
        const remoteInfo = await this.getRemoteModel(conflict.model.name, config);
        if (remoteInfo.lastModified > conflict.model.lastModified) {
          await this.downloadModel(remoteInfo, config);
        } else {
          await this.uploadModel(conflict.model, config);
        }
        break;
    }
  }

  private async getRemoteModel(name: string, config: SyncConfig): Promise<any> {
    const response = await axios.get(`${config.serverUrl}/model/${name}`, {
      headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}
    });
    return response.data;
  }

  private async updateSyncMetadata(remoteLastSync: Date): Promise<void> {
    // Store sync metadata in local store
    const metadata = {
      lastLocalSync: new Date(),
      lastRemoteSync: remoteLastSync,
      syncHistory: this.syncHistory.slice(-10)
    };

    // This would be stored in IndexedDB metadata store
    this.eventEmitter.emit('modelsync.metadata.updated', metadata);
  }

  private updateProgress(
    phase: SyncProgress['phase'],
    current: number,
    total: number,
    currentModel?: string
  ): void {
    const progress: SyncProgress = {
      phase,
      current,
      total,
      bytesTransferred: this.bandwidthMonitor.bytesTransferred,
      currentModel
    };

    this.eventEmitter.emit('modelsync.progress', progress);
  }

  private async applyBandwidthLimit(bytes: number): Promise<void> {
    if (!this.config.bandwidthLimit) return;

    const currentRate = this.bandwidthMonitor.currentRate;
    if (currentRate > this.config.bandwidthLimit) {
      // Calculate delay needed
      const delay = (bytes / this.config.bandwidthLimit) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private updateBandwidthRate(): void {
    const elapsed = (Date.now() - this.bandwidthMonitor.startTime) / 1000;
    if (elapsed > 0) {
      this.bandwidthMonitor.currentRate = 
        this.bandwidthMonitor.bytesTransferred / elapsed;
    }
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private setupEventListeners(): void {
    // Listen for model changes
    this.eventEmitter.on('localstore.model.saved', (event) => {
      this.queueModelForSync(event.modelId);
    });

    // Listen for network status changes
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('online', () => {
        console.log('Network online, triggering sync...');
        this.syncModels().catch(console.error);
      });
    }
  }
}