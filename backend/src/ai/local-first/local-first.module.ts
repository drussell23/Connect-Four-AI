/**
 * Local-First AI Module
 * Provides offline-capable AI with progressive enhancement
 */

import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LocalFirstAIService } from './local-first-ai.service';
import { LocalModelStore } from './local-model-store';
import { WasmAIEngine } from './wasm-ai-engine';

@Global()
@Module({
  imports: [EventEmitterModule],
  providers: [
    LocalFirstAIService,
    {
      provide: 'LOCAL_AI_CONFIG',
      useValue: {
        enableOffline: true,
        enableServiceWorker: true,
        enableWebAssembly: true,
        cacheSize: 10000,
        syncInterval: 300000, // 5 minutes
        modelStorageQuota: 100 * 1024 * 1024, // 100MB
        wasmMemoryPages: 256, // 16MB initial WASM memory
        serviceWorkerPath: '/ai-worker.js',
        modelsPath: '/models',
        features: {
          backgroundPrecomputation: true,
          modelCompression: true,
          adaptiveCaching: true,
          progressiveSyncing: true,
          offlineLearning: true
        }
      }
    },
    {
      provide: 'ServiceWorkerManager',
      useFactory: () => {
        // Service worker management for Node.js environment
        return {
          register: async () => {
            console.log('Service Worker registration skipped in Node.js');
            return null;
          },
          postMessage: (message: any) => {
            console.log('Service Worker message:', message);
          },
          ready: false
        };
      }
    },
    {
      provide: 'OfflineCapabilities',
      useFactory: (localAI: LocalFirstAIService) => {
        return {
          isOfflineReady: async () => {
            const stats = await localAI.getStorageStats();
            return stats.models.totalModels > 0 && stats.wasm.compilationTime > 0;
          },
          downloadForOffline: () => localAI.downloadModelsForOffline(),
          getOfflineStats: () => localAI.getStorageStats(),
          setOfflineMode: (offline: boolean) => localAI.setOfflineMode(offline)
        };
      },
      inject: [LocalFirstAIService]
    }
  ],
  exports: [
    LocalFirstAIService,
    'LOCAL_AI_CONFIG',
    'OfflineCapabilities'
  ]
})
export class LocalFirstModule {
  constructor(
    private localAI: LocalFirstAIService
  ) {
    console.log('🌐 Local-First AI Module loaded');
    
    // Schedule initial offline preparation
    setTimeout(() => {
      this.prepareForOffline();
    }, 5000);
  }

  private async prepareForOffline() {
    try {
      console.log('📥 Preparing for offline operation...');
      await this.localAI.downloadModelsForOffline();
      
      const stats = await this.localAI.getStorageStats();
      console.log('📊 Offline preparation complete:', {
        models: stats.models.totalModels,
        cacheSize: stats.models.totalSize,
        wasmReady: stats.wasm.compilationTime > 0
      });
    } catch (error) {
      console.error('Failed to prepare for offline:', error);
    }
  }
}