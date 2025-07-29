import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { WebSocket } from 'ws';
import { CellValue } from './connect4AI';

export interface ContinuousLearningUpdate {
  gameId: string;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  data: any;
}

export interface ModelUpdateEvent {
  version: string;
  improvements: {
    horizontal_defense: number;
    vertical_defense: number;
    diagonal_defense: number;
    overall_accuracy: number;
  };
  timestamp: number;
}

@Injectable()
export class ContinuousLearningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContinuousLearningService.name);
  private mlWebSocket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000;
  
  // Learning metrics
  private learningMetrics = {
    gamesProcessed: 0,
    lossesAnalyzed: 0,
    modelUpdates: 0,
    patternCounts: {
      horizontal: 0,
      vertical: 0,
      diagonal: 0,
      'anti-diagonal': 0
    },
    lastModelUpdate: null as Date | null,
    improvementRate: 0
  };
  
  // Learning queue (optional - can be null if not using queue-based processing)
  private learningQueue: any = null;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    // Check if service should be disabled
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const disableExternalServices = this.configService.get('DISABLE_EXTERNAL_SERVICES', 'false') === 'true';
    const enableContinuousLearning = this.configService.get('ENABLE_CONTINUOUS_LEARNING', 'true') === 'true';
    
    if (isProduction || disableExternalServices || !enableContinuousLearning) {
      this.logger.log('⏭️ Continuous Learning Service disabled');
      return;
    }
    
    this.connectToMLService();
    this.setupEventListeners();
    this.logger.log('🧠 Continuous Learning Service initialized');
  }

  async onModuleDestroy() {
    this.disconnect();
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }
  }

  /**
   * Connect to ML WebSocket service for real-time updates
   */
  private connectToMLService() {
    const mlWsUrl = this.configService.get('ML_WEBSOCKET_URL') || 'ws://localhost:8002/ws';
    
    try {
      this.mlWebSocket = new WebSocket(mlWsUrl);
      
      this.mlWebSocket.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log(`✅ Connected to ML WebSocket service at ${mlWsUrl}`);
        
        // Send initial handshake
        this.sendMessage({
          type: 'handshake',
          service: 'continuous-learning',
          version: '1.0.0'
        });
      });
      
      this.mlWebSocket.on('message', (data: any) => {
        this.handleMLMessage(data);
      });
      
      this.mlWebSocket.on('error', (error) => {
        this.logger.error('ML WebSocket error:', error);
      });
      
      this.mlWebSocket.on('close', () => {
        this.isConnected = false;
        this.logger.warn('ML WebSocket connection closed');
        this.scheduleReconnect();
      });
      
    } catch (error) {
      this.logger.error('Failed to connect to ML service:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle messages from ML service
   */
  private handleMLMessage(data: any) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'model_updated':
          this.handleModelUpdate(message.data);
          break;
          
        case 'learning_progress':
          this.handleLearningProgress(message.data);
          break;
          
        case 'pattern_insights':
          this.handlePatternInsights(message.data);
          break;
          
        case 'health_check':
          this.sendMessage({ type: 'health_check_response', status: 'healthy' });
          break;
          
        default:
          this.logger.debug(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling ML message:', error);
    }
  }

  /**
   * Handle model update notifications
   */
  private handleModelUpdate(data: ModelUpdateEvent) {
    this.logger.log('🚀 Model updated with improvements:', data.improvements);
    
    this.learningMetrics.modelUpdates++;
    this.learningMetrics.lastModelUpdate = new Date(data.timestamp);
    this.learningMetrics.improvementRate = 
      (data.improvements.horizontal_defense + 
       data.improvements.vertical_defense + 
       data.improvements.diagonal_defense) / 3;
    
    // Emit event for backend to reload model
    this.eventEmitter.emit('ml.model.updated', {
      version: data.version,
      improvements: data.improvements,
      timestamp: data.timestamp
    });
    
    // Log significant improvements
    if (this.learningMetrics.improvementRate > 0.1) {
      this.logger.warn(`⚡ Significant improvement detected: ${(this.learningMetrics.improvementRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Handle learning progress updates
   */
  private handleLearningProgress(data: any) {
    this.logger.debug('Learning progress:', data);
    
    // Update metrics
    if (data.gamesProcessed) {
      this.learningMetrics.gamesProcessed = data.gamesProcessed;
    }
    
    // Emit progress event
    this.eventEmitter.emit('ml.learning.progress', data);
  }

  /**
   * Handle pattern insights from ML analysis
   */
  private handlePatternInsights(data: any) {
    this.logger.log('📊 Pattern insights received:', data);
    
    // Store insights for AI strategy adjustment
    this.eventEmitter.emit('ml.pattern.insights', {
      patterns: data.patterns,
      recommendations: data.recommendations,
      criticalPositions: data.criticalPositions
    });
  }

  /**
   * Setup event listeners for game outcomes
   */
  private setupEventListeners() {
    // Listen for critical AI losses
    this.eventEmitter.on('ai.critical.loss', async (data: any) => {
      this.logger.warn(`⚠️ Processing critical AI loss: ${data.gameId} at difficulty ${data.difficulty}`);
      
      // Send high-priority learning request with difficulty
      await this.sendPriorityLearning({
        gameId: data.gameId,
        lossPattern: data.lossPattern,
        gameData: data.gameData,
        priority: 'high',
        learnImmediately: true,
        difficulty: data.difficulty,
        difficultyContext: {
          level: Math.round((data.difficulty || 0.5) * 10),
          transferToHigherLevels: true,
          adaptiveStrategies: true
        }
      });
      
      // Update pattern counts
      if (data.lossPattern) {
        this.learningMetrics.patternCounts[data.lossPattern.type]++;
        this.learningMetrics.lossesAnalyzed++;
      }
    });
    
    // Listen for all game completions
    this.eventEmitter.on('game.completed.for.learning', async (gameData: any) => {
      this.logger.debug(`📝 Processing game for learning: ${gameData.gameId}`);
      
      // Queue for batch processing
      if (this.learningQueue) {
        await this.learningQueue.add('process-game', gameData, {
          priority: gameData.outcome === 'loss' ? 1 : 3,
          delay: gameData.outcome === 'loss' ? 0 : 5000
        });
      }
      
      this.learningMetrics.gamesProcessed++;
    });
    
    // Listen for pattern defense requests
    this.eventEmitter.on('ai.request.pattern.defense', async (data: any) => {
      const defense = await this.requestPatternDefense(data.pattern, data.board);
      this.eventEmitter.emit('ai.pattern.defense.response', {
        requestId: data.requestId,
        defense
      });
    });
  }

  /**
   * Send priority learning request to ML service
   */
  private async sendPriorityLearning(data: any): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Not connected to ML service, queueing priority learning');
      // Queue for later
      if (this.learningQueue) {
        await this.learningQueue.add('priority-learning', data, { priority: 0 });
      }
      return;
    }
    
    this.sendMessage({
      type: 'priority_learning',
      data: {
        ...data,
        learn_immediately: true,
        boost_factor: 2.0,
        focus_patterns: [data.lossPattern?.type]
      }
    });
  }

  /**
   * Request pattern-specific defense strategy
   */
  private async requestPatternDefense(pattern: string, board: CellValue[][]): Promise<any> {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      
      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, reason: 'timeout' });
      }, 5000);
      
      // Listen for response
      const handler = (data: any) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          this.eventEmitter.off('ml.pattern.defense.result', handler);
          resolve(data.defense);
        }
      };
      
      this.eventEmitter.on('ml.pattern.defense.result', handler);
      
      // Send request
      this.sendMessage({
        type: 'pattern_defense_request',
        requestId,
        pattern,
        board
      });
    });
  }

  /**
   * Send message to ML service
   */
  private sendMessage(message: any) {
    if (this.mlWebSocket && this.mlWebSocket.readyState === WebSocket.OPEN) {
      this.mlWebSocket.send(JSON.stringify(message));
    } else {
      this.logger.warn('Cannot send message - WebSocket not connected');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    this.logger.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectToMLService();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Disconnect from ML service
   */
  private disconnect() {
    if (this.mlWebSocket) {
      this.mlWebSocket.close();
      this.mlWebSocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Get current learning metrics
   */
  getLearningMetrics() {
    return {
      ...this.learningMetrics,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Force model update check
   */
  async forceModelUpdateCheck() {
    this.sendMessage({
      type: 'check_model_updates',
      force: true
    });
  }
}