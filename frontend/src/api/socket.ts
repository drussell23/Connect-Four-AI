// frontend/src/api/socket.ts
import io, { Socket, Manager } from 'socket.io-client';
import { appConfig, buildApiEndpoint } from '../config/environment';
import { socketLogger } from './socketLogger';
import { integrationLogger } from '../utils/integrationLogger';

// Types for enhanced socket functionality
export interface ConnectionStatus {
  connected: boolean;
  id: string | null;
  transport: string;
  latency: number;
  reconnectAttempts: number;
  lastConnected: Date | null;
  uptime: number;
}

export interface SocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  acknowledged: boolean;
}

export interface PerformanceMetrics {
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  connectionUptime: number;
  reconnectionCount: number;
  errorCount: number;
}

export interface SocketConfig {
  autoConnect: boolean;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxQueueSize: number;
  enableMetrics: boolean;
  enableHeartbeat: boolean;
  enableQueue: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SocketConfig = {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 30000,
  heartbeatInterval: 20000, // Reduced from 30s to 20s to prevent timeouts
  heartbeatTimeout: 15000,  // Increased from 10s to 15s for more tolerance
  maxQueueSize: 100,
  enableMetrics: true,
  enableHeartbeat: true,
  enableQueue: true,
};

// Enhanced Socket Manager Class
class EnhancedSocketManager {
  private socket: any = null;
  private manager: any = null;
  private config: SocketConfig;
  private eventQueue: SocketEvent[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics;
  private connectionStartTime: Date | null = null;
  private reconnectAttempts: number = 0;
  private isReconnecting: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private statusCallbacks: Set<(status: ConnectionStatus) => void> = new Set();
  private connectionRetryTimer: NodeJS.Timeout | null = null;
  private connectionAttemptCount: number = 0;

  constructor(config: Partial<SocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      connectionUptime: 0,
      reconnectionCount: 0,
      errorCount: 0,
    };
  }

  // Initialize socket connection
  public initialize(): any {
    const { api } = appConfig;

    socketLogger.logInfo('🔌 Initializing Enhanced WebSocket Manager');
    socketLogger.logInfo('🏢 Enterprise Mode:', appConfig.enterprise.mode);
    socketLogger.logInfo('🔗 Connecting to:', `${api.baseUrl}`);
    socketLogger.logInfo('📍 Will connect to namespace: /game');

    // Create manager for connection pooling - DO NOT include namespace in URL!
    this.manager = new Manager(api.baseUrl, {
      transports: ['polling', 'websocket'], // Start with polling for stability
      autoConnect: false,
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      randomizationFactor: 0.5,
      timeout: this.config.timeout,
      forceNew: false,
      upgrade: true,
      rememberUpgrade: true
    });

    // Create socket instance on the /game namespace
    // Use the full path to ensure proper namespace connection
    this.socket = this.manager.socket('/game', {
      auth: {
        clientId: this.generateClientId(),
        version: '1.0.0',
        features: this.getEnabledFeatures(),
      },
      path: '/socket.io/'  // Explicitly set the path
    });

    this.setupEventHandlers();
    this.setupConnectionHandlers();
    this.setupErrorHandlers();
    this.setupGameHandlers();

    if (this.config.autoConnect) {
      this.connect();
    }

    return this.socket;
  }

  // Generate unique client ID
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Get enabled features for auth
  private getEnabledFeatures(): string[] {
    const features: string[] = [];
    if (appConfig.enterprise.aiInsightsEnabled) features.push('ai_insights');
    if (appConfig.enterprise.performanceMonitoring) features.push('performance_monitoring');
    if (appConfig.enterprise.advancedAnalytics) features.push('advanced_analytics');
    if (appConfig.enterprise.threatMeterEnabled) features.push('threat_meter');
    return features;
  }

  // Setup connection event handlers
  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      socketLogger.logSuccess('WebSocket connected successfully');
      socketLogger.logInfo('🔗 Socket ID:', this.socket?.id);
      socketLogger.logInfo('🚀 Transport:', this.socket?.io.engine.transport.name);
      socketLogger.markConnectionComplete();

      // Log to integration logger
      integrationLogger.logServiceConnection('Backend API', true, {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine.transport.name,
        namespace: '/game'
      });

      this.connectionStartTime = new Date();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;

      this.startHeartbeat();
      this.flushEventQueue();
      this.updateMetrics();
      this.notifyStatusChange();

      if (appConfig.dev.debugMode) {
        socketLogger.logInfo('📊 Connection Metrics:', this.getMetrics());
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      socketLogger.logWarning('WebSocket disconnected', reason);
      
      // Log to integration logger
      integrationLogger.logServiceConnection('Backend API', false, { reason });

      this.stopHeartbeat();
      this.updateMetrics();
      this.notifyStatusChange();

      if (reason === 'io server disconnect') {
        socketLogger.logWarning('Server initiated disconnect - attempting manual reconnection');
        this.manualReconnect();
      }
    });

    this.socket.on('connect_error', (error: any) => {
      socketLogger.logError('WebSocket connection error', error.message);
      this.metrics.errorCount++;
      this.updateMetrics();
      this.notifyStatusChange();
      
      // Implement smart retry logic
      if (this.connectionAttemptCount < 3) {
        this.connectionAttemptCount++;
        this.scheduleSmartRetry();
      }
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      socketLogger.logSuccess(`WebSocket reconnected after ${attemptNumber} attempts`);
      this.metrics.reconnectionCount++;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.updateMetrics();
      this.notifyStatusChange();
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      socketLogger.logInfo(`WebSocket reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
      this.isReconnecting = true;
      this.notifyStatusChange();
    });

    this.socket.on('reconnect_error', (error: any) => {
      socketLogger.logError('WebSocket reconnection error', error.message);
      this.metrics.errorCount++;
      this.updateMetrics();
    });

    this.socket.on('reconnect_failed', () => {
      socketLogger.logError('WebSocket reconnection failed - giving up');
      this.isReconnecting = false;
      this.notifyStatusChange();
    });
  }

  // Setup error handlers
  private setupErrorHandlers(): void {
    if (!this.socket) return;

    this.socket.on('error', (error: any) => {
      socketLogger.logError('Game error', error);
      this.metrics.errorCount++;
      this.updateMetrics();
    });

    // Handle transport errors
    this.socket.io.on('error', (error: any) => {
      socketLogger.logError('Transport error', error);
      this.metrics.errorCount++;
      this.updateMetrics();
    });
  }

  // Setup game-specific event handlers
  private setupGameHandlers(): void {
    if (!this.socket) return;

    const gameEvents = [
      'gameCreated', 'aiThinking', 'aiMove', 'playerMove', 'gameOver',
      'gameState', 'playerJoined', 'playerLeft', 'error', 'warning'
    ];

    gameEvents.forEach(event => {
      this.socket!.on(event, (data: any) => {
        console.log(`🎮 ${event}:`, data);
        this.metrics.messagesReceived++;
        this.updateMetrics();

        // Log to integration logger
        integrationLogger.logWebSocketEvent(event, data, 'in');
        
        // Special handling for AI events
        if (event === 'aiMove' && data.aiMetrics) {
          integrationLogger.logAIDecision({
            column: data.column,
            confidence: data.aiMetrics.confidence || 0,
            algorithm: data.aiMetrics.algorithm || 'unknown',
            difficulty: data.aiMetrics.difficulty || 0,
            timeMs: data.aiMetrics.responseTime || 0,
            strategy: data.aiMetrics.strategy,
            alternatives: data.aiMetrics.alternatives
          });
        }

        // Notify event listeners
        this.notifyEventListeners(event, data);
      });
    });
  }

  // Setup general event handlers
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onAny((eventName: string, ...args: any[]) => {
      if (appConfig.dev.verboseLogging) {
        console.log(`📡 Socket event: ${eventName}`, args);
      }
    });
  }

  // Heartbeat monitoring
  private startHeartbeat(): void {
    if (!this.config.enableHeartbeat || !this.socket) return;

    // Clear any existing heartbeat timer
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        const startTime = Date.now();
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ Heartbeat timeout - no pong received');
          // Don't disconnect, just log the warning
        }, this.config.heartbeatTimeout);

        this.socket.emit('ping', {}, () => {
          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;
          this.updateLatency(latency);

          if (appConfig.dev.debugMode) {
            console.log(`💓 Heartbeat - Latency: ${latency}ms`);
          }
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private updateLatency(latency: number): void {
    this.metrics.averageLatency =
      (this.metrics.averageLatency + latency) / 2;
  }

  // Event queue management
  private addToQueue(event: string, data: any): void {
    if (!this.config.enableQueue) return;

    if (this.eventQueue.length >= this.config.maxQueueSize) {
      console.warn('⚠️ Event queue full, dropping oldest event');
      this.eventQueue.shift();
    }

    this.eventQueue.push({
      event,
      data,
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  private flushEventQueue(): void {
    if (!this.socket?.connected || this.eventQueue.length === 0) return;

    console.log(`📤 Flushing ${this.eventQueue.length} queued events`);

    while (this.eventQueue.length > 0) {
      const queuedEvent = this.eventQueue.shift();
      if (queuedEvent) {
        this.emit(queuedEvent.event, queuedEvent.data);
      }
    }
  }

  // Enhanced emit with queue support
  public emit(event: string, data: any, callback?: Function): void {
    if (!this.socket) {
      console.warn('🚨 Socket not initialized, attempting to initialize...');
      this.initialize();
      return;
    }

    if (!this.socket.connected) {
      console.warn(`⚠️ Socket disconnected, queuing event: ${event}`);
      this.addToQueue(event, data);
      return;
    }

    try {
      this.socket.emit(event, data, callback);
      this.metrics.messagesSent++;
      this.updateMetrics();

      // Log to integration logger
      integrationLogger.logWebSocketEvent(event, data, 'out');

      if (appConfig.dev.verboseLogging) {
        console.log(`📤 Emitted: ${event}`, data);
      }
    } catch (error) {
      console.error(`🚨 Error emitting event ${event}:`, error);
      this.metrics.errorCount++;
      this.updateMetrics();
    }
  }

  // Manual reconnection
  private manualReconnect(): void {
    if (this.isReconnecting) return;

    console.log('🔄 Initiating manual reconnection...');
    this.isReconnecting = true;

    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, 1000);
  }

  // Public reconnection method
  public forceReconnect(): void {
    console.log('🔄 Forcing WebSocket reconnection...');
    if (this.socket) {
      // Only disconnect if connected
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socket.connect();
        }
      }, 1000);
    }
  }

  // Connection management
  public async connect(): Promise<void> {
    if (!this.socket) {
      console.warn('🚨 Socket not initialized');
      return;
    }

    // Check if already connected or connecting
    if (this.socket.connected || this.socket.connecting) {
      console.log('✅ Socket already connected or connecting');
      return;
    }

    // Validate server availability first
    const isServerAvailable = await this.validateServerConnection();
    if (!isServerAvailable) {
      console.warn('⚠️ Server not available, scheduling retry...');
      this.scheduleSmartRetry();
      return;
    }

    this.connectionAttemptCount = 0;
    this.socket.connect();
  }

  private async validateServerConnection(): Promise<boolean> {
    try {
      const response = await fetch(buildApiEndpoint('/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private scheduleSmartRetry(): void {
    if (this.connectionRetryTimer) {
      clearTimeout(this.connectionRetryTimer);
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.connectionAttemptCount), 10000);
    const jitter = Math.random() * 1000;
    
    console.log(`⏰ Scheduling connection retry in ${Math.round((delay + jitter) / 1000)}s...`);
    
    this.connectionRetryTimer = setTimeout(() => {
      this.connect();
    }, delay + jitter);
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  // Status and metrics
  public getConnectionStatus(): ConnectionStatus {
    const now = new Date();
    const uptime = this.connectionStartTime
      ? now.getTime() - this.connectionStartTime.getTime()
      : 0;

    return {
      connected: this.socket?.connected || false,
      id: this.socket?.id || null,
      transport: this.socket?.io.engine.transport.name || 'none',
      latency: this.metrics.averageLatency,
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: this.connectionStartTime,
      uptime,
    };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    if (this.connectionStartTime) {
      this.metrics.connectionUptime =
        Date.now() - this.connectionStartTime.getTime();
    }
  }

  // Event listener management
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private notifyEventListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`🚨 Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Status change notifications
  public onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallbacks.add(callback);
  }

  public offStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallbacks.delete(callback);
  }

  private notifyStatusChange(): void {
    const status = this.getConnectionStatus();
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('🚨 Error in status change callback:', error);
      }
    });
  }

  // Health check
  public isHealthy(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket instance
  public getSocket(): any {
    return this.socket;
  }

  // Cleanup
  public destroy(): void {
    this.stopHeartbeat();
    
    if (this.connectionRetryTimer) {
      clearTimeout(this.connectionRetryTimer);
      this.connectionRetryTimer = null;
    }
    
    this.eventQueue = [];
    this.eventListeners.clear();
    this.statusCallbacks.clear();

    if (this.socket) {
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      this.socket = null;
    }

    // Clear the manager reference
    this.manager = null;
  }
}

// Create singleton instance
const socketManager = new EnhancedSocketManager({
  enableMetrics: appConfig.enterprise.performanceMonitoring,
  enableHeartbeat: appConfig.enterprise.mode,
  enableQueue: appConfig.enterprise.mode,
  reconnectionAttempts: appConfig.enterprise.mode ? 15 : 5,
  heartbeatInterval: appConfig.enterprise.mode ? 15000 : 20000, // Reduced for better stability
  timeout: 45000, // Increased timeout to prevent disconnections
});

// Initialize the socket
const socket = socketManager.initialize();

// Export enhanced functions
export const getConnectionStatus = (): ConnectionStatus => socketManager.getConnectionStatus();
export const getMetrics = (): PerformanceMetrics => socketManager.getMetrics();
export const forceReconnect = (): void => socketManager.forceReconnect();
export const isHealthy = (): boolean => socketManager.isHealthy();
export const onStatusChange = (callback: (status: ConnectionStatus) => void): void => socketManager.onStatusChange(callback);
export const offStatusChange = (callback: (status: ConnectionStatus) => void): void => socketManager.offStatusChange(callback);
export const emit = (event: string, data: any, callback?: Function): void => socketManager.emit(event, data, callback);
export const on = (event: string, callback: Function): void => socketManager.on(event, callback);
export const off = (event: string, callback: Function): void => socketManager.off(event, callback);
export const destroy = (): void => socketManager.destroy();

// Export the socket instance for backward compatibility
export default socket;
