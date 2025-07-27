import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

/**
 * 🔄 MODEL SYNCHRONIZATION SERVICE
 * ================================
 * 
 * Ensures all services use the latest and best performing models
 * by synchronizing model updates across the entire system.
 */
@Injectable()
export class ModelSyncService {
  private readonly logger = new Logger(ModelSyncService.name);
  
  // Model version tracking
  private modelVersions = new Map<string, {
    currentVersion: string;
    lastSync: Date;
    performance: number;
  }>();
  
  // Sync metrics
  private syncMetrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncTime: null as Date | null,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
  ) {
    this.setupSyncHandlers();
    this.initializeModelTracking();
  }

  /**
   * Initialize model version tracking
   */
  private async initializeModelTracking(): Promise<void> {
    const models = [
      'standard',
      'minimax',
      'mcts',
      'alphazero',
      'ensemble',
      'difficulty_1', 'difficulty_2', 'difficulty_3', 'difficulty_4', 'difficulty_5',
      'difficulty_6', 'difficulty_7', 'difficulty_8', 'difficulty_9', 'difficulty_10',
    ];
    
    for (const model of models) {
      this.modelVersions.set(model, {
        currentVersion: '1.0.0',
        lastSync: new Date(),
        performance: 0.5,
      });
    }
  }

  /**
   * Setup sync event handlers
   */
  private setupSyncHandlers(): void {
    // Handle model update events
    this.eventEmitter.on('model.updated', (data) => this.handleModelUpdate(data));
    
    // Handle sync requests
    this.eventEmitter.on('model.sync.request', (data) => this.syncModel(data));
    
    // Handle performance updates
    this.eventEmitter.on('model.performance.update', (data) => this.updateModelPerformance(data));
  }

  /**
   * Handle model update notification
   */
  private async handleModelUpdate(data: any): Promise<void> {
    this.logger.log(`📥 Model update received: ${data.modelType} v${data.version}`);
    
    // Update version tracking
    const modelInfo = this.modelVersions.get(data.modelType);
    if (modelInfo) {
      modelInfo.currentVersion = data.version;
      modelInfo.lastSync = new Date();
      
      if (data.performance) {
        modelInfo.performance = data.performance;
      }
    }
    
    // Trigger synchronization
    await this.syncModelAcrossServices(data);
  }

  /**
   * Synchronize model across all services
   */
  async syncModelAcrossServices(modelData: any): Promise<void> {
    this.logger.log(`🔄 Synchronizing model ${modelData.modelType} across services...`);
    
    const syncTargets = [
      {
        name: 'ML Service',
        url: 'http://localhost:8000/models/sync',
        critical: true,
      },
      {
        name: 'ML Inference',
        url: 'http://localhost:8001/models/sync',
        critical: true,
      },
      {
        name: 'AI Coordination',
        url: 'http://localhost:8003/models/sync',
        critical: false,
      },
      {
        name: 'Python Trainer',
        url: 'http://localhost:8004/models/sync',
        critical: false,
      },
    ];
    
    const syncResults = await Promise.all(
      syncTargets.map(async (target) => {
        try {
          const response = await firstValueFrom(
            this.httpService.post(target.url, {
              modelType: modelData.modelType,
              version: modelData.version,
              weights: modelData.weights,
              metadata: modelData.metadata,
              timestamp: new Date(),
            })
          );
          
          return {
            service: target.name,
            success: true,
            critical: target.critical,
          };
        } catch (error) {
          this.logger.error(`Failed to sync with ${target.name}:`, error.message);
          
          return {
            service: target.name,
            success: false,
            critical: target.critical,
            error: error.message,
          };
        }
      })
    );
    
    // Check sync results
    const criticalFailures = syncResults.filter(r => r.critical && !r.success);
    const successCount = syncResults.filter(r => r.success).length;
    
    if (criticalFailures.length === 0) {
      this.syncMetrics.successfulSyncs++;
      this.logger.log(`✅ Model sync completed: ${successCount}/${syncResults.length} services updated`);
      
      // Emit success event
      this.eventEmitter.emit('model.sync.success', {
        modelType: modelData.modelType,
        version: modelData.version,
        servicesUpdated: successCount,
      });
    } else {
      this.syncMetrics.failedSyncs++;
      this.logger.error(`❌ Model sync failed for critical services: ${criticalFailures.map(f => f.service).join(', ')}`);
      
      // Emit failure event
      this.eventEmitter.emit('model.sync.failure', {
        modelType: modelData.modelType,
        version: modelData.version,
        failures: criticalFailures,
      });
      
      // Schedule retry
      setTimeout(() => this.syncModelAcrossServices(modelData), 30000);
    }
    
    this.syncMetrics.totalSyncs++;
    this.syncMetrics.lastSyncTime = new Date();
  }

  /**
   * Sync specific model on request
   */
  async syncModel(request: any): Promise<void> {
    const { modelType, sourceService } = request;
    
    try {
      // Fetch latest model from source
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:8000/models/${modelType}/latest`)
      );
      
      const modelData = response.data;
      
      // Sync across services
      await this.syncModelAcrossServices(modelData);
      
    } catch (error) {
      this.logger.error(`Failed to sync model ${modelType}:`, error);
    }
  }

  /**
   * Update model performance metrics
   */
  private updateModelPerformance(data: any): void {
    const modelInfo = this.modelVersions.get(data.modelType);
    if (modelInfo) {
      modelInfo.performance = data.performance;
      
      // Check if we should promote this model
      if (data.performance > 0.8) {
        this.logger.log(`🌟 High performing model detected: ${data.modelType} (${data.performance})`);
        
        // Emit promotion event
        this.eventEmitter.emit('model.promote.candidate', {
          modelType: data.modelType,
          version: modelInfo.currentVersion,
          performance: data.performance,
        });
      }
    }
  }

  /**
   * Periodic model sync check
   */
  @Cron('0 */30 * * * *') // Every 30 minutes
  async periodicSyncCheck(): Promise<void> {
    this.logger.log('🔍 Running periodic model sync check...');
    
    try {
      // Check each model for updates
      for (const [modelType, info] of this.modelVersions.entries()) {
        const timeSinceSync = Date.now() - info.lastSync.getTime();
        
        // If not synced in last hour, check for updates
        if (timeSinceSync > 3600000) {
          await this.checkModelUpdates(modelType);
        }
      }
    } catch (error) {
      this.logger.error('Periodic sync check failed:', error);
    }
  }

  /**
   * Check for model updates
   */
  private async checkModelUpdates(modelType: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:8000/models/${modelType}/version`)
      );
      
      const latestVersion = response.data.version;
      const currentVersion = this.modelVersions.get(modelType)?.currentVersion;
      
      if (latestVersion !== currentVersion) {
        this.logger.log(`🆕 New version available for ${modelType}: ${latestVersion}`);
        
        // Fetch and sync the new model
        const modelResponse = await firstValueFrom(
          this.httpService.get(`http://localhost:8000/models/${modelType}/latest`)
        );
        
        await this.syncModelAcrossServices(modelResponse.data);
      }
    } catch (error) {
      this.logger.warn(`Failed to check updates for ${modelType}:`, error.message);
    }
  }

  /**
   * Get sync status for all models
   */
  getSyncStatus(): any {
    const status = {
      models: Array.from(this.modelVersions.entries()).map(([type, info]) => ({
        type,
        version: info.currentVersion,
        lastSync: info.lastSync,
        performance: info.performance,
        syncAge: Date.now() - info.lastSync.getTime(),
      })),
      metrics: this.syncMetrics,
      healthStatus: this.calculateHealthStatus(),
    };
    
    return status;
  }

  /**
   * Calculate overall sync health status
   */
  private calculateHealthStatus(): string {
    const recentSyncCount = Array.from(this.modelVersions.values())
      .filter(info => Date.now() - info.lastSync.getTime() < 3600000)
      .length;
    
    const syncRatio = recentSyncCount / this.modelVersions.size;
    
    if (syncRatio > 0.8) return 'healthy';
    if (syncRatio > 0.5) return 'degraded';
    return 'critical';
  }

  /**
   * Force sync all models
   */
  async forceSyncAllModels(): Promise<void> {
    this.logger.log('🔄 Force syncing all models...');
    
    for (const modelType of this.modelVersions.keys()) {
      await this.checkModelUpdates(modelType);
      await this.sleep(1000); // Prevent overwhelming services
    }
    
    this.logger.log('✅ Force sync completed');
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}