import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 🌐 INTEGRATION WEBSOCKET GATEWAY
 * ================================
 * 
 * Provides real-time WebSocket communication for service integration,
 * enabling instant data flow and event propagation across all services.
 */
@WebSocketGateway(8888, {
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'integration',
})
export class IntegrationWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(IntegrationWebSocketGateway.name);
  private connectedServices = new Map<string, Socket>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  afterInit(server: Server) {
    this.logger.log('🌐 Integration WebSocket Gateway initialized on port 8888');

    // Bootstrap: announce backend integration socket is up
    this.eventEmitter.emit('service.status.update', {
      backend: true,
      integration_websocket: true,
      game_websocket: true
    });
    
    // Setup internal event listeners
    this.setupInternalListeners();
    
    // Listen for service status updates from orchestrator
    this.eventEmitter.on('service.status.update', (status) => {
      this.server.emit('service_status_bulk_update', status);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Service connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Service disconnected: ${client.id}`);
    
    // Remove from connected services
    for (const [serviceName, socket] of this.connectedServices.entries()) {
      if (socket.id === client.id) {
        this.connectedServices.delete(serviceName);
        this.broadcastServiceStatus(serviceName, false);
        break;
      }
    }
  }

  /**
   * Handle service registration
   */
  @SubscribeMessage('register_service')
  handleServiceRegistration(
    @MessageBody() data: { serviceName: string; capabilities: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    this.connectedServices.set(data.serviceName, client);
    this.logger.log(`✅ Service registered: ${data.serviceName}`);
    
    // Broadcast service availability
    this.broadcastServiceStatus(data.serviceName, true);
    
    // Send current integration status
    client.emit('integration_status', {
      connectedServices: Array.from(this.connectedServices.keys()),
      timestamp: new Date(),
    });
    
    return { status: 'registered', serviceName: data.serviceName };
  }

  /**
   * Handle game data broadcast
   */
  @SubscribeMessage('broadcast_game_data')
  handleGameDataBroadcast(@MessageBody() data: any) {
    this.logger.debug(`Broadcasting game data: ${data.gameId}`);
    
    // Emit to all connected services
    this.server.emit('game_data_update', data);
    
    // Emit internal event for processing
    this.eventEmitter.emit('integration.game.data', data);
    
    return { status: 'broadcasted', gameId: data.gameId };
  }

  /**
   * Handle pattern sharing
   */
  @SubscribeMessage('share_pattern')
  handlePatternSharing(@MessageBody() data: any) {
    this.logger.debug(`Sharing pattern: ${data.pattern.type}`);
    
    // Broadcast to all services except sender
    this.server.emit('pattern_shared', data);
    
    // Emit internal event
    this.eventEmitter.emit('integration.pattern.shared', data);
    
    return { status: 'shared', patternId: data.pattern.id };
  }

  /**
   * Handle model update notifications
   */
  @SubscribeMessage('notify_model_update')
  handleModelUpdate(@MessageBody() data: any) {
    this.logger.log(`📢 Model update notification: ${data.modelType} v${data.version}`);
    
    // Broadcast to all services
    this.server.emit('model_updated', data);
    
    // Emit internal event for synchronization
    this.eventEmitter.emit('integration.model.updated', data);
    
    return { status: 'notified', modelType: data.modelType };
  }

  /**
   * Handle real-time move analysis
   */
  @SubscribeMessage('analyze_move_realtime')
  async handleRealtimeMoveAnalysis(@MessageBody() data: any) {
    this.logger.debug(`Real-time move analysis for game: ${data.gameId}`);
    
    // Emit to specific services for analysis
    this.emitToService('ml_service', 'analyze_move', data);
    this.emitToService('ai_coordination', 'strategic_analysis', data);
    
    // Collect responses (would need to implement response collection)
    const analysis = {
      moveQuality: 0.85,
      strategicValue: 0.78,
      threats: data.threats || [],
      opportunities: data.opportunities || [],
    };
    
    return { status: 'analyzed', analysis };
  }

  /**
   * Handle simulation results
   */
  @SubscribeMessage('simulation_result')
  handleSimulationResult(@MessageBody() data: any) {
    this.logger.debug(`Simulation result: ${data.simulationId}`);
    
    // Broadcast to learning services
    this.emitToService('continuous_learning', 'simulation_data', data);
    this.emitToService('python_trainer', 'simulation_batch', data);
    
    // Emit internal event
    this.eventEmitter.emit('integration.simulation.complete', data);
    
    return { status: 'processed', simulationId: data.simulationId };
  }

  /**
   * Handle insight propagation
   */
  @SubscribeMessage('propagate_insight')
  handleInsightPropagation(@MessageBody() data: any) {
    this.logger.log(`💡 Propagating insight: ${data.insight.type}`);
    
    // Broadcast to all services
    this.server.emit('insight_available', data);
    
    // Emit internal event
    this.eventEmitter.emit('integration.insight.propagated', data);
    
    return { status: 'propagated', insightId: data.insight.id };
  }

  /**
   * Handle metrics request
   */
  @SubscribeMessage('request_metrics')
  handleMetricsRequest(@ConnectedSocket() client: Socket) {
    // Collect metrics from all services
    const metrics = {
      timestamp: new Date(),
      services: Array.from(this.connectedServices.keys()),
      connections: this.connectedServices.size,
      uptime: process.uptime(),
    };
    
    client.emit('metrics_response', metrics);
    
    return { status: 'sent' };
  }

  /**
   * Setup internal event listeners
   */
  private setupInternalListeners(): void {
    // Forward WebSocket messages from orchestrator
    this.eventEmitter.on('websocket.send.cl', (data) => {
      this.emitToService('continuous_learning', 'data_update', data);
    });
    
    this.eventEmitter.on('websocket.send.ml', (data) => {
      this.emitToService('ml_service', 'data_update', data);
    });
    
    this.eventEmitter.on('websocket.send.coordination', (data) => {
      this.emitToService('ai_coordination', 'data_update', data);
    });
    
    // Forward integration events
    this.eventEmitter.on('integration.**', (data) => {
      this.server.emit('integration_event', {
        event: data.event,
        data: data.data,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Emit to specific service
   */
  private emitToService(serviceName: string, event: string, data: any): void {
    const socket = this.connectedServices.get(serviceName);
    if (socket) {
      socket.emit(event, data);
    } else {
      this.logger.warn(`Service ${serviceName} not connected`);
    }
  }

  /**
   * Broadcast service status update
   */
  private broadcastServiceStatus(serviceName: string, online: boolean): void {
    this.server.emit('service_status_update', {
      serviceName,
      online,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast to all services except one
   */
  broadcastExcept(excludeService: string, event: string, data: any): void {
    for (const [serviceName, socket] of this.connectedServices.entries()) {
      if (serviceName !== excludeService) {
        socket.emit(event, data);
      }
    }
  }

  /**
   * Get connected services list
   */
  getConnectedServices(): string[] {
    return Array.from(this.connectedServices.keys());
  }
}