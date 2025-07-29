/**
 * Local Model Store using IndexedDB
 * Provides offline-first model storage with synchronization
 */

import { EventEmitter2 } from '@nestjs/event-emitter';

export interface StoredModel {
  id: string;
  name: string;
  version: string;
  type: 'onnx' | 'tfjs' | 'brain' | 'custom';
  weights: ArrayBuffer;
  metadata: {
    createdAt: Date;
    lastUsed: Date;
    size: number;
    accuracy?: number;
    inferenceSpeed?: number;
    compressionRatio?: number;
  };
  config?: any;
  checksum: string;
  encrypted?: boolean;
}

export interface ModelQuery {
  name?: string;
  type?: string;
  minAccuracy?: number;
  maxSize?: number;
  createdAfter?: Date;
}

export interface StorageStats {
  totalModels: number;
  totalSize: number;
  oldestModel: Date;
  newestModel: Date;
  mostUsedModel: string;
  storageUsed: number;
  storageAvailable: number;
}

export class LocalModelStore {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'ConnectFourAI';
  private readonly version = 2;
  private readonly modelStore = 'models';
  private readonly metadataStore = 'metadata';
  private readonly cacheStore = 'predictions';
  private eventEmitter?: EventEmitter2;

  constructor(eventEmitter?: EventEmitter2) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    // Skip IndexedDB initialization in Node.js environment
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available in Node.js environment - LocalModelStore will operate in memory only');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create model store
        if (!db.objectStoreNames.contains(this.modelStore)) {
          const modelStore = db.createObjectStore(this.modelStore, { keyPath: 'id' });
          modelStore.createIndex('name', 'name', { unique: false });
          modelStore.createIndex('type', 'type', { unique: false });
          modelStore.createIndex('version', 'version', { unique: false });
          modelStore.createIndex('lastUsed', 'metadata.lastUsed', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(this.metadataStore)) {
          const metaStore = db.createObjectStore(this.metadataStore, { keyPath: 'key' });
          metaStore.createIndex('type', 'type', { unique: false });
        }

        // Create prediction cache store
        if (!db.objectStoreNames.contains(this.cacheStore)) {
          const cacheStore = db.createObjectStore(this.cacheStore, { keyPath: 'boardHash' });
          cacheStore.createIndex('modelId', 'modelId', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Save model to IndexedDB with compression
   */
  async saveModel(
    name: string,
    weights: ArrayBuffer,
    metadata?: Partial<StoredModel>
  ): Promise<string> {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available - model saving skipped');
      return this.generateModelId();
    }
    
    if (!this.db) {
      await this.initialize();
    }

    const modelId = this.generateModelId();
    
    // Compress weights if large
    const compressed = await this.compressWeights(weights);
    const checksum = await this.calculateChecksum(compressed.data);

    const model: StoredModel = {
      id: modelId,
      name,
      version: metadata?.version || '1.0.0',
      type: metadata?.type || 'custom',
      weights: compressed.data,
      metadata: {
        createdAt: new Date(),
        lastUsed: new Date(),
        size: compressed.data.byteLength,
        compressionRatio: compressed.ratio,
        ...metadata?.metadata
      },
      config: metadata?.config,
      checksum,
      encrypted: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.modelStore], 'readwrite');
      const store = transaction.objectStore(this.modelStore);
      const request = store.add(model);

      request.onsuccess = () => {
        console.log(`Model ${name} saved with ID ${modelId}`);
        
        // Update storage stats
        this.updateStorageStats();
        
        // Emit event
        this.eventEmitter?.emit('localstore.model.saved', {
          modelId,
          name,
          size: model.metadata.size
        });

        resolve(modelId);
      };

      request.onerror = () => {
        reject(new Error(`Failed to save model ${name}`));
      };
    });
  }

  /**
   * Load model from IndexedDB
   */
  async loadModel(modelId: string): Promise<StoredModel | null> {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available - model loading skipped');
      return null;
    }
    
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.modelStore], 'readonly');
      const store = transaction.objectStore(this.modelStore);
      const request = store.get(modelId);

      request.onsuccess = async () => {
        const model = request.result;
        
        if (model) {
          // Decompress weights
          const decompressed = await this.decompressWeights(model.weights);
          model.weights = decompressed;
          
          // Verify checksum
          const checksum = await this.calculateChecksum(model.weights);
          if (checksum !== model.checksum) {
            console.warn(`Checksum mismatch for model ${modelId}`);
          }
          
          // Update last used
          this.updateLastUsed(modelId);
          
          resolve(model);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to load model ${modelId}`));
      };
    });
  }

  /**
   * Query models with filters
   */
  async queryModels(query: ModelQuery): Promise<StoredModel[]> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.modelStore], 'readonly');
      const store = transaction.objectStore(this.modelStore);
      const models: StoredModel[] = [];

      let request: IDBRequest;
      
      if (query.name) {
        const index = store.index('name');
        request = index.openCursor(IDBKeyRange.only(query.name));
      } else if (query.type) {
        const index = store.index('type');
        request = index.openCursor(IDBKeyRange.only(query.type));
      } else {
        request = store.openCursor();
      }

      request.onsuccess = () => {
        const cursor = request.result;
        
        if (cursor) {
          const model = cursor.value;
          
          // Apply filters
          if (this.matchesQuery(model, query)) {
            models.push(model);
          }
          
          cursor.continue();
        } else {
          resolve(models);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to query models'));
      };
    });
  }

  /**
   * Delete model from storage
   */
  async deleteModel(modelId: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.modelStore, this.cacheStore], 'readwrite');
      const modelStore = transaction.objectStore(this.modelStore);
      const cacheStore = transaction.objectStore(this.cacheStore);

      // Delete model
      const deleteRequest = modelStore.delete(modelId);

      // Delete associated cache entries
      const cacheIndex = cacheStore.index('modelId');
      const cacheRequest = cacheIndex.openCursor(IDBKeyRange.only(modelId));

      cacheRequest.onsuccess = () => {
        const cursor = cacheRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`Model ${modelId} deleted`);
        this.updateStorageStats();
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to delete model ${modelId}`));
      };
    });
  }

  /**
   * Cache prediction result
   */
  async cachePrediction(
    boardHash: string,
    modelId: string,
    prediction: any,
    ttl: number = 3600000 // 1 hour
  ): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const cacheEntry = {
      boardHash,
      modelId,
      prediction,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.cacheStore], 'readwrite');
      const store = transaction.objectStore(this.cacheStore);
      const request = store.put(cacheEntry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to cache prediction'));
      };
    });
  }

  /**
   * Get cached prediction
   */
  async getCachedPrediction(
    boardHash: string,
    modelId: string
  ): Promise<any | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.cacheStore], 'readonly');
      const store = transaction.objectStore(this.cacheStore);
      const request = store.get(boardHash);

      request.onsuccess = () => {
        const entry = request.result;
        
        if (entry && entry.modelId === modelId && entry.expiresAt > Date.now()) {
          resolve(entry.prediction);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to get cached prediction'));
      };
    });
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.cacheStore], 'readwrite');
      const store = transaction.objectStore(this.cacheStore);
      const request = store.openCursor();
      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        
        if (cursor) {
          if (cursor.value.expiresAt < Date.now()) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`Cleared ${deletedCount} expired cache entries`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to clear expired cache'));
      };
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!this.db) {
      await this.initialize();
    }

    const stats: StorageStats = {
      totalModels: 0,
      totalSize: 0,
      oldestModel: new Date(),
      newestModel: new Date(0),
      mostUsedModel: '',
      storageUsed: 0,
      storageAvailable: 0
    };

    // Get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      stats.storageUsed = estimate.usage || 0;
      stats.storageAvailable = estimate.quota || 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.modelStore], 'readonly');
      const store = transaction.objectStore(this.modelStore);
      const request = store.openCursor();

      const modelUsage: Map<string, number> = new Map();

      request.onsuccess = () => {
        const cursor = request.result;
        
        if (cursor) {
          const model = cursor.value;
          stats.totalModels++;
          stats.totalSize += model.metadata.size;
          
          if (model.metadata.createdAt < stats.oldestModel) {
            stats.oldestModel = model.metadata.createdAt;
          }
          if (model.metadata.createdAt > stats.newestModel) {
            stats.newestModel = model.metadata.createdAt;
          }
          
          // Track usage
          const uses = modelUsage.get(model.id) || 0;
          modelUsage.set(model.id, uses + 1);
          
          cursor.continue();
        } else {
          // Find most used model
          let maxUses = 0;
          for (const [modelId, uses] of modelUsage) {
            if (uses > maxUses) {
              maxUses = uses;
              stats.mostUsedModel = modelId;
            }
          }
          
          resolve(stats);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to get storage stats'));
      };
    });
  }

  /**
   * Export model for sharing
   */
  async exportModel(modelId: string): Promise<Blob> {
    const model = await this.loadModel(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Create export package
    const exportData = {
      model: {
        ...model,
        weights: Array.from(new Uint8Array(model.weights))
      },
      exportedAt: new Date(),
      version: '1.0'
    };

    // Convert to blob
    const json = JSON.stringify(exportData);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Import model from file
   */
  async importModel(file: File): Promise<string> {
    const text = await file.text();
    const importData = JSON.parse(text);

    // Validate import
    if (!importData.model || !importData.model.weights) {
      throw new Error('Invalid model file');
    }

    // Convert weights back to ArrayBuffer
    const weights = new Uint8Array(importData.model.weights).buffer;

    // Save model
    return this.saveModel(
      importData.model.name,
      weights,
      {
        ...importData.model,
        metadata: {
          ...importData.model.metadata,
          imported: true,
          importedAt: new Date()
        }
      }
    );
  }

  /**
   * Sync models with server
   */
  async syncWithServer(
    serverUrl: string,
    authToken?: string
  ): Promise<{ uploaded: number; downloaded: number }> {
    const result = { uploaded: 0, downloaded: 0 };

    try {
      // Get local models
      const localModels = await this.queryModels({});
      
      // Get server model list
      const response = await fetch(`${serverUrl}/models`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const serverModels = await response.json();

      // Upload new local models
      for (const model of localModels) {
        const serverModel = serverModels.find((sm: any) => sm.checksum === model.checksum);
        
        if (!serverModel) {
          // Upload model
          const formData = new FormData();
          formData.append('model', new Blob([model.weights]));
          formData.append('metadata', JSON.stringify({
            name: model.name,
            version: model.version,
            type: model.type,
            checksum: model.checksum
          }));

          await fetch(`${serverUrl}/models`, {
            method: 'POST',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: formData
          });

          result.uploaded++;
        }
      }

      // Download new server models
      for (const serverModel of serverModels) {
        const localModel = localModels.find(lm => lm.checksum === serverModel.checksum);
        
        if (!localModel) {
          // Download model
          const modelResponse = await fetch(`${serverUrl}/models/${serverModel.id}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          });
          const weights = await modelResponse.arrayBuffer();

          await this.saveModel(serverModel.name, weights, {
            version: serverModel.version,
            type: serverModel.type,
            metadata: serverModel.metadata
          });

          result.downloaded++;
        }
      }

      this.eventEmitter?.emit('localstore.sync.complete', result);
      
    } catch (error) {
      console.error('Sync failed:', error);
      this.eventEmitter?.emit('localstore.sync.failed', { error });
    }

    return result;
  }

  /**
   * Private helper methods
   */

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async compressWeights(weights: ArrayBuffer): Promise<{ data: ArrayBuffer; ratio: number }> {
    // Simple compression using CompressionStream if available
    if ('CompressionStream' in window) {
      try {
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(new Uint8Array(weights));
        writer.close();

        const chunks: Uint8Array[] = [];
        const reader = cs.readable.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        return {
          data: compressed.buffer,
          ratio: compressed.byteLength / weights.byteLength
        };
      } catch (error) {
        console.warn('Compression failed, using original weights');
      }
    }

    // No compression available
    return { data: weights, ratio: 1.0 };
  }

  private async decompressWeights(weights: ArrayBuffer): Promise<ArrayBuffer> {
    // Decompress if CompressionStream was used
    if ('DecompressionStream' in window) {
      try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(new Uint8Array(weights));
        writer.close();

        const chunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }

        return decompressed.buffer;
      } catch (error) {
        // Assume it's not compressed
      }
    }

    return weights;
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private matchesQuery(model: StoredModel, query: ModelQuery): boolean {
    if (query.minAccuracy && (model.metadata.accuracy || 0) < query.minAccuracy) {
      return false;
    }
    
    if (query.maxSize && model.metadata.size > query.maxSize) {
      return false;
    }
    
    if (query.createdAfter && model.metadata.createdAt < query.createdAfter) {
      return false;
    }
    
    return true;
  }

  private async updateLastUsed(modelId: string): Promise<void> {
    const transaction = this.db!.transaction([this.modelStore], 'readwrite');
    const store = transaction.objectStore(this.modelStore);
    
    const request = store.get(modelId);
    request.onsuccess = () => {
      const model = request.result;
      if (model) {
        model.metadata.lastUsed = new Date();
        store.put(model);
      }
    };
  }

  private async updateStorageStats(): Promise<void> {
    const stats = await this.getStorageStats();
    
    // Store stats in metadata
    const transaction = this.db!.transaction([this.metadataStore], 'readwrite');
    const store = transaction.objectStore(this.metadataStore);
    
    store.put({
      key: 'storage_stats',
      type: 'stats',
      value: stats,
      updatedAt: new Date()
    });
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.modelStore, this.metadataStore, this.cacheStore],
        'readwrite'
      );
      
      transaction.objectStore(this.modelStore).clear();
      transaction.objectStore(this.metadataStore).clear();
      transaction.objectStore(this.cacheStore).clear();

      transaction.oncomplete = () => {
        console.log('All data cleared');
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to clear data'));
      };
    });
  }
}