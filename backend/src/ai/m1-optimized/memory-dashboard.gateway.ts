/**
 * 📡 Memory Dashboard WebSocket Gateway
 * 
 * Real-time metrics streaming for the memory dashboard
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { DashboardMetrics } from './memory-dashboard.controller';

interface MetricsSubscription {
  clientId: string;
  subscriptions: Set<string>;
  lastUpdate: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MemoryDashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('MetricsDashboard');
  private clients = new Map<string, MetricsSubscription>();

  /**
   * Handle client connection
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Dashboard client connected: ${client.id}`);
    
    this.clients.set(client.id, {
      clientId: client.id,
      subscriptions: new Set(['all']), // Subscribe to all metrics by default
      lastUpdate: Date.now()
    });

    // Send initial data
    client.emit('connected', {
      clientId: client.id,
      timestamp: Date.now()
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Dashboard client disconnected: ${client.id}`);
    this.clients.delete(client.id);
  }

  /**
   * Subscribe to specific metric types
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { metrics: string[] },
    @ConnectedSocket() client: Socket
  ): void {
    const subscription = this.clients.get(client.id);
    if (!subscription) return;

    // Update subscriptions
    subscription.subscriptions.clear();
    data.metrics.forEach(metric => subscription.subscriptions.add(metric));

    client.emit('subscribed', {
      metrics: Array.from(subscription.subscriptions)
    });
  }

  /**
   * Handle dashboard metrics updates
   */
  @OnEvent('dashboard.metrics')
  handleMetricsUpdate(metrics: DashboardMetrics): void {
    // Broadcast to all connected clients
    this.server.emit('metrics:update', metrics);
  }

  /**
   * Handle memory state changes
   */
  @OnEvent('memory.state.changed')
  handleMemoryStateChange(state: any): void {
    this.server.emit('memory:alert', {
      level: state.level,
      timestamp: Date.now(),
      message: this.getMemoryAlertMessage(state.level)
    });
  }

  /**
   * Handle degradation level changes
   */
  @OnEvent('degradation.level.changed')
  handleDegradationChange(data: any): void {
    this.server.emit('degradation:change', {
      previousLevel: data.previousLevel,
      currentLevel: data.currentLevel,
      timestamp: Date.now()
    });
  }

  /**
   * Handle stress test updates
   */
  @OnEvent('stress.metrics')
  handleStressMetrics(data: any): void {
    this.server.emit('stress:metrics', data);
  }

  /**
   * Handle stress test completion
   */
  @OnEvent('stress.test.completed')
  handleStressTestCompleted(metrics: any): void {
    this.server.emit('stress:completed', {
      testId: metrics.testId,
      summary: {
        duration: metrics.duration,
        totalRequests: metrics.totalRequests,
        successRate: (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1),
        avgResponseTime: metrics.avgResponseTime,
        peakMemoryMB: metrics.peakMemoryMB
      }
    });
  }

  /**
   * Handle emergency cleanup
   */
  @OnEvent('emergency.cleanup.complete')
  handleEmergencyCleanup(data: any): void {
    this.server.emit('emergency:cleanup', {
      freedMB: data.freedMB,
      tensorsFreed: data.tensorsFreed,
      timestamp: data.timestamp
    });
  }

  /**
   * Handle cache events
   */
  @OnEvent('cache.resize')
  handleCacheResize(data: any): void {
    this.server.emit('cache:resize', {
      factor: data.factor,
      timestamp: Date.now()
    });
  }

  /**
   * Handle background task events
   */
  @OnEvent('background.task.completed')
  handleTaskCompleted(data: any): void {
    this.server.emit('task:completed', {
      type: data.type,
      duration: data.duration,
      timestamp: Date.now()
    });
  }

  /**
   * Request specific metric update
   */
  @SubscribeMessage('request:metric')
  async handleMetricRequest(
    @MessageBody() data: { metric: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    // In a real implementation, this would fetch specific metrics
    client.emit('metric:response', {
      metric: data.metric,
      value: Math.random() * 100,
      timestamp: Date.now()
    });
  }

  /**
   * Get memory alert message
   */
  private getMemoryAlertMessage(level: string): string {
    switch (level) {
      case 'critical':
        return '🚨 CRITICAL: Memory usage above 90%! Emergency measures activated.';
      case 'high':
        return '⚠️ HIGH: Memory usage above 80%. Background tasks paused.';
      case 'moderate':
        return '📊 MODERATE: Memory usage above 70%. Monitoring closely.';
      default:
        return '✅ NORMAL: Memory usage is healthy.';
    }
  }

  /**
   * Broadcast system notification
   */
  broadcastNotification(type: 'info' | 'warning' | 'error', message: string): void {
    this.server.emit('notification', {
      type,
      message,
      timestamp: Date.now()
    });
  }
}