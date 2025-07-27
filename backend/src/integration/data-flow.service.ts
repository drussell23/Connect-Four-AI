import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MlClientService } from '../ml/ml-client.service';

/**
 * 🌊 DATA FLOW SERVICE
 * ===================
 * 
 * Manages the seamless flow of data between all services,
 * ensuring that game data, patterns, and insights are
 * properly distributed for continuous learning.
 */
@Injectable()
export class DataFlowService {
  private readonly logger = new Logger(DataFlowService.name);
  
  // Data flow metrics
  private flowMetrics = {
    gamesFlowed: 0,
    patternsDistributed: 0,
    insightsShared: 0,
    modelsSync: 0,
    errors: 0,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly mlClientService: MlClientService,
  ) {
    this.setupDataFlowHandlers();
  }

  /**
   * Setup handlers for data flow events
   */
  private setupDataFlowHandlers(): void {
    // Game data flow
    this.eventEmitter.on('game.data.ready', (data) => this.flowGameData(data));
    
    // Pattern data flow
    this.eventEmitter.on('pattern.data.ready', (data) => this.flowPatternData(data));
    
    // Model sync flow
    this.eventEmitter.on('model.sync.ready', (data) => this.flowModelSync(data));
    
    // Insight data flow
    this.eventEmitter.on('insight.data.ready', (data) => this.flowInsightData(data));
  }

  /**
   * Flow game data to all relevant services
   */
  async flowGameData(gameData: any): Promise<void> {
    try {
      this.logger.log(`📤 Flowing game data: ${gameData.gameId}`);
      
      // Send to ML service for analysis
      await this.mlClientService.logGame({
        gameId: gameData.gameId,
        finalBoard: gameData.board,
        outcome: gameData.winner === 'AI' ? 'win' : gameData.winner ? 'loss' : 'draw',
        winner: gameData.winner,
        timestamp: Date.now(),
        moves: gameData.moves,
        difficulty: gameData.difficulty,
        lossPattern: gameData.lossPattern,
        gameMetrics: gameData.gameMetrics,
      });
      
      // Send to continuous learning if it's a loss
      if (gameData.aiLost) {
        await this.sendToContinuousLearning({
          type: 'ai_loss',
          gameData: gameData,
          lossPattern: gameData.lossPattern,
          priority: 'high',
        });
      }
      
      // Send to Python trainer for batch processing
      await this.sendToPythonTrainer({
        type: 'game_data',
        data: gameData,
        requestAnalysis: true,
      });
      
      // Send to AI coordination for strategic analysis
      await this.sendToAICoordination({
        type: 'game_analysis',
        gameData: gameData,
        requestInsights: true,
      });
      
      this.flowMetrics.gamesFlowed++;
      
      // Emit completion event
      this.eventEmitter.emit('data.flow.game.complete', {
        gameId: gameData.gameId,
        services: ['ml_service', 'continuous_learning', 'python_trainer', 'ai_coordination'],
      });
      
    } catch (error) {
      this.logger.error('Failed to flow game data:', error);
      this.flowMetrics.errors++;
    }
  }

  /**
   * Flow pattern data across services
   */
  async flowPatternData(patternData: any): Promise<void> {
    try {
      this.logger.log(`🔄 Flowing pattern data: ${patternData.pattern.type}`);
      
      // Distribute pattern to all learning services
      const distributions = [
        this.sendToContinuousLearning({
          type: 'pattern_update',
          pattern: patternData.pattern,
          context: patternData.context,
        }),
        
        this.sendToMLService({
          type: 'pattern_detected',
          pattern: patternData.pattern,
          gameId: patternData.gameId,
          importance: patternData.importance,
        }),
        
        this.sendToPythonTrainer({
          type: 'pattern_analysis',
          pattern: patternData.pattern,
          examples: patternData.examples,
        }),
      ];
      
      await Promise.all(distributions);
      
      this.flowMetrics.patternsDistributed++;
      
      // Emit pattern distributed event
      this.eventEmitter.emit('data.flow.pattern.distributed', {
        patternId: patternData.pattern.id,
        type: patternData.pattern.type,
        servicesNotified: 3,
      });
      
    } catch (error) {
      this.logger.error('Failed to flow pattern data:', error);
      this.flowMetrics.errors++;
    }
  }

  /**
   * Flow model synchronization data
   */
  async flowModelSync(syncData: any): Promise<void> {
    try {
      this.logger.log(`🔄 Synchronizing model: ${syncData.modelType} v${syncData.version}`);
      
      // Notify all services about model update
      const syncPromises = [
        // Update ML inference service
        this.httpService.post('http://localhost:8001/models/update', {
          modelType: syncData.modelType,
          version: syncData.version,
          weights: syncData.weights,
          metadata: syncData.metadata,
        }),
        
        // Update AI coordination models
        this.httpService.post('http://localhost:8003/models/sync', {
          modelType: syncData.modelType,
          version: syncData.version,
          improvements: syncData.improvements,
        }),
        
        // Update Python trainer
        this.httpService.post('http://localhost:8004/models/sync', {
          modelType: syncData.modelType,
          version: syncData.version,
        }),
      ];
      
      await Promise.all(syncPromises.map(p => firstValueFrom(p).catch(e => {
        this.logger.warn(`Model sync failed for a service: ${e.message}`);
        return null;
      })));
      
      this.flowMetrics.modelsSync++;
      
      // Emit sync complete event
      this.eventEmitter.emit('data.flow.model.synced', {
        modelType: syncData.modelType,
        version: syncData.version,
        timestamp: new Date(),
      });
      
    } catch (error) {
      this.logger.error('Failed to flow model sync:', error);
      this.flowMetrics.errors++;
    }
  }

  /**
   * Flow insight data for strategic improvements
   */
  async flowInsightData(insightData: any): Promise<void> {
    try {
      this.logger.log(`💡 Flowing insight: ${insightData.type}`);
      
      // Share insights across all services
      const insightPromises = [
        // Send to continuous learning for adaptation
        this.sendToContinuousLearning({
          type: 'strategic_insight',
          insight: insightData,
          applicability: insightData.applicability,
        }),
        
        // Send to AI coordination for strategy updates
        this.sendToAICoordination({
          type: 'insight_update',
          insight: insightData,
          priority: insightData.priority || 'medium',
        }),
        
        // Send to ML service for model adjustments
        this.sendToMLService({
          type: 'insight_application',
          insight: insightData,
          targetModels: insightData.targetModels || ['all'],
        }),
      ];
      
      await Promise.all(insightPromises);
      
      this.flowMetrics.insightsShared++;
      
      // Emit insight shared event
      this.eventEmitter.emit('data.flow.insight.shared', {
        insightId: insightData.id,
        type: insightData.type,
        impact: insightData.expectedImpact,
      });
      
    } catch (error) {
      this.logger.error('Failed to flow insight data:', error);
      this.flowMetrics.errors++;
    }
  }

  /**
   * Send data to continuous learning service
   */
  private async sendToContinuousLearning(data: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:8002/api/learn', data)
      );
    } catch (error) {
      // Try WebSocket as fallback
      this.eventEmitter.emit('websocket.send.cl', data);
    }
  }

  /**
   * Send data to ML service
   */
  private async sendToMLService(data: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:8000/api/process', data)
      );
    } catch (error) {
      // Try WebSocket as fallback
      this.eventEmitter.emit('websocket.send.ml', data);
    }
  }

  /**
   * Send data to Python trainer
   */
  private async sendToPythonTrainer(data: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:8004/api/train', data)
      );
    } catch (error) {
      this.logger.warn('Python trainer not available:', error.message);
    }
  }

  /**
   * Send data to AI coordination
   */
  private async sendToAICoordination(data: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:8003/api/coordinate', data)
      );
    } catch (error) {
      // Try WebSocket as fallback
      this.eventEmitter.emit('websocket.send.coordination', data);
    }
  }

  /**
   * Get flow metrics
   */
  getMetrics(): any {
    return {
      ...this.flowMetrics,
      timestamp: new Date(),
    };
  }
}