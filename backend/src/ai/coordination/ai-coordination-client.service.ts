import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocket } from 'ws';

export interface AICoordinationRequest {
  game_id: string;
  board_state: string[][];
  context: {
    difficulty: number;
    game_phase: string;
    move_count: number;
    ai_color: string;
    opponent_color: string;
  };
  collaboration_mode: string;
  urgency: number;
  deadline_ms: number;
}

export interface AICoordinationResponse {
  game_id: string;
  move: number;
  confidence: number;
  reasoning: string;
  contributing_models: string[];
  computation_time: number;
}

@Injectable()
export class AICoordinationClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AICoordinationClient.name);
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private connected = false;
  private readonly hubUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.hubUrl = this.configService.get<string>('AI_COORDINATION_HUB_URL', 'ws://localhost:8002');
  }

  async onModuleInit() {
    // Check if service should be disabled
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const disableExternalServices = this.configService.get('DISABLE_EXTERNAL_SERVICES', 'false') === 'true';
    const enableAICoordination = this.configService.get('ENABLE_AI_COORDINATION', 'true') === 'true';
    
    if (isProduction || disableExternalServices || !enableAICoordination) {
      this.logger.log('⏭️ AI Coordination Client disabled');
      return;
    }
    
    this.logger.log('🚀 Initializing AI Coordination Client');
    await this.connectToHub();
    this.setupReconnection();
  }

  async onModuleDestroy() {
    this.logger.log('🛑 Shutting down AI Coordination Client');
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  private async connectToHub(): Promise<void> {
    try {
      this.logger.log(`📡 Connecting to AI Coordination Hub at ${this.hubUrl}`);
      
      this.ws = new WebSocket(this.hubUrl);
      
      this.ws.on('open', () => {
        this.connected = true;
        this.logger.log('✅ Connected to AI Coordination Hub');
        this.eventEmitter.emit('ai.coordination.connected');
        
        // Register this client
        this.sendMessage({
          type: 'register',
          client_type: 'game_backend',
          capabilities: ['ensemble_requests', 'emergency_coordination']
        });
      });

      this.ws.on('message', (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse coordination hub message', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.connected = false;
      });

      this.ws.on('close', () => {
        this.logger.warn('❌ Disconnected from AI Coordination Hub');
        this.connected = false;
        this.eventEmitter.emit('ai.coordination.disconnected');
      });

    } catch (error) {
      this.logger.error('Failed to connect to AI Coordination Hub', error);
      this.connected = false;
    }
  }

  private setupReconnection(): void {
    this.reconnectInterval = setInterval(() => {
      if (!this.connected) {
        this.logger.log('🔄 Attempting to reconnect to AI Coordination Hub...');
        this.connectToHub();
      }
    }, 5000);
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'registration_success':
        this.logger.log('✅ Successfully registered with AI Coordination Hub');
        break;
        
      case 'ensemble_response':
        this.eventEmitter.emit('ai.coordination.response', message);
        break;
        
      case 'error':
        this.logger.error(`Coordination Hub error: ${message.message}`);
        break;
        
      default:
        this.logger.debug(`Unknown message type: ${message.type}`);
    }
  }

  private sendMessage(message: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.logger.warn('Cannot send message - not connected to Coordination Hub');
    }
  }

  async requestCoordinatedMove(request: AICoordinationRequest): Promise<AICoordinationResponse> {
    if (!this.connected) {
      throw new Error('Not connected to AI Coordination Hub');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Coordination request timeout'));
      }, request.deadline_ms);

      const handler = (response: any) => {
        if (response.game_id === request.game_id) {
          clearTimeout(timeout);
          this.eventEmitter.off('ai.coordination.response', handler);
          resolve(response as AICoordinationResponse);
        }
      };

      this.eventEmitter.on('ai.coordination.response', handler);
      
      this.sendMessage({
        type: 'ensemble_request',
        ...request
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}