// frontend/src/api/socket.ts
import io, { Manager } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { appConfig, buildApiEndpoint } from '../config/environment';
import { environmentDetector } from '../utils/environmentDetector';
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
  private socket: Socket | null = null;
  private manager: Manager | null = null;
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

  // Validate server connection health
  private async validateConnection(): Promise<boolean> {
    try {
      const timeoutMs = environmentDetector.getEnvironmentInfo().isProduction ? 12000 : 10000;
      const healthEndpoint = buildApiEndpoint('/health');
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        socketLogger.logInfo('Health check successful:', data.status);
        return true;
      }
      
      socketLogger.logWarning('Health check returned non-OK status:', response.status);
      return false;
    } catch (error) {
      socketLogger.logWarning('Server health check failed, connection may be degraded');
      // Non-fatal during startup; automatic retries will continue
      // Don't log the full error as it's expected during initial connection
      return false;
    }
  }

  // Initialize socket connection
  public async initialize(): Promise<Socket> {
    const { api } = appConfig;

    socketLogger.logInfo('🔌 Initializing Enhanced WebSocket Manager');
    socketLogger.logInfo('🏢 Enterprise Mode:', appConfig.enterprise.mode);
    socketLogger.logInfo('🔗 Connecting to:', `${api.baseUrl}`);
    socketLogger.logInfo('📍 Will connect to namespace: /game');

    // Validate server availability before attempting connection
    const isServerAvailable = await this.validateConnection();
    if (!isServerAvailable) {
      socketLogger.logWarning('⚠️ Server not available, will attempt connection anyway...');
    }

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

    // Setup manager-level error handling
    this.setupManagerErrorHandling();

    // Create socket instance on the /game namespace
    // Use the full path to ensure proper namespace connection
    this.socket = this.manager.socket('/game', {
      auth: {
        clientId: this.generateClientId(),
        version: '1.0.0',
        features: this.getEnabledFeatures(),
      }
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

  // Generate unique client ID with persistence and device fingerprinting
  private generateClientId(): string {
    const storageKey = 'connect4_client_id';
    
    try {
      // Try to retrieve existing client ID from localStorage
      const existingId = localStorage.getItem(storageKey);
      if (existingId) {
        socketLogger.logInfo('🔑 Using existing client ID:', existingId);
        return existingId;
      }

      // Generate device fingerprint components
      const fingerprint = this.generateDeviceFingerprint();
      
      // Create new client ID with fingerprint
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 11);
      const clientId = `client_${timestamp}_${randomPart}_${fingerprint}`;
      
      // Persist the client ID
      try {
        localStorage.setItem(storageKey, clientId);
        localStorage.setItem(`${storageKey}_created`, new Date().toISOString());
        socketLogger.logInfo('🆕 Generated and stored new client ID:', clientId);
      } catch (storageError) {
        console.warn('⚠️ Failed to persist client ID:', storageError);
        // Fall back to session storage
        try {
          sessionStorage.setItem(storageKey, clientId);
        } catch (sessionError) {
          console.error('🚨 Failed to store client ID in any storage');
        }
      }
      
      return clientId;
    } catch (error) {
      console.error('🚨 Error generating client ID:', error);
      // Fallback to simple generation
      return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_fallback`;
    }
  }

  // Generate device fingerprint for better client identification
  private generateDeviceFingerprint(): string {
    try {
      const components: string[] = [];
      
      // Screen resolution
      if (window.screen) {
        components.push(`${window.screen.width}x${window.screen.height}`);
      }
      
      // Color depth
      if (window.screen.colorDepth) {
        components.push(`c${window.screen.colorDepth}`);
      }
      
      // Timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      components.push(timezone.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10));
      
      // Language
      components.push(navigator.language.substring(0, 2));
      
      // Platform
      if ((navigator as any).userAgentData?.platform) {
        components.push((navigator as any).userAgentData.platform.substring(0, 3).toLowerCase());
      } else if (navigator.platform) {
        components.push(navigator.platform.substring(0, 3).toLowerCase());
      }
      
      // Create hash from components
      const fingerprintString = components.join('_');
      let hash = 0;
      for (let i = 0; i < fingerprintString.length; i++) {
        const char = fingerprintString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(36).substring(0, 8);
    } catch (error) {
      console.warn('⚠️ Failed to generate device fingerprint:', error);
      return 'unknown';
    }
  }

  // Get enabled features with dynamic detection and validation
  private getEnabledFeatures(): string[] {
    const features: string[] = [];
    
    try {
      // Core feature detection
      if (appConfig.enterprise.aiInsightsEnabled) {
        features.push('ai_insights');
        features.push('ai_analysis_v2'); // Version indicator
      }
      
      if (appConfig.enterprise.performanceMonitoring) {
        features.push('performance_monitoring');
        features.push('real_time_metrics');
      }
      
      if (appConfig.enterprise.advancedAnalytics) {
        features.push('advanced_analytics');
        features.push('predictive_analytics');
      }
      
      if (appConfig.enterprise.threatMeterEnabled) {
        features.push('threat_meter');
        features.push('threat_prediction');
      }
      
      // Additional capability detection
      if (appConfig.enterprise.mode) {
        features.push('enterprise_mode');
        features.push('priority_support');
      }
      
      // Browser capability features
      if ('serviceWorker' in navigator) {
        features.push('offline_capable');
      }
      
      if ('storage' in navigator && navigator.storage && (navigator.storage.estimate as any)) {
        features.push('storage_api');
      }
      
      if (window.performance && (performance as any).memory) {
        features.push('memory_monitoring');
      }
      
      // WebRTC support for future P2P features
      if (window.RTCPeerConnection) {
        features.push('webrtc_ready');
      }
      
      // GPU detection for AI acceleration
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && 'getExtension' in gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          features.push('gpu_acceleration');
        }
      }
      
      // Add client version
      features.push(`client_v${process.env.REACT_APP_VERSION || '1.0.0'}`);
      
      // Add experimental features if enabled
      if ((appConfig.dev as any).experimentalFeatures) {
        features.push('experimental_features');
        features.push('beta_access');
      }
      
      socketLogger.logInfo('🎯 Enabled features:', features);
      
      return features;
    } catch (error) {
      console.error('🚨 Error detecting features:', error);
      return ['basic_mode', 'error_recovery'];
    }
  }

  // Setup connection event handlers with enhanced recovery and analytics
  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      const connectionTime = Date.now();
      const previousUptime = this.connectionStartTime 
        ? connectionTime - this.connectionStartTime.getTime() 
        : 0;

      socketLogger.logSuccess('WebSocket connected successfully');
      socketLogger.logInfo('🔗 Socket ID:', this.socket?.id);
      socketLogger.logInfo('🚀 Transport:', this.socket?.io.engine.transport.name);
      socketLogger.logInfo('⏱️ Connection established in:', `${Date.now() - (this.connectionAttemptCount > 0 ? connectionTime : 0)}ms`);
      socketLogger.markConnectionComplete();

      // Request current service status snapshot on connect
      try {
        this.socket!.emit('requestServiceStatus');
      } catch (e) {
        // ignore
      }

      // Enhanced connection analytics
      const connectionDetails = {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine.transport.name,
        namespace: '/game',
        reconnectionCount: this.metrics.reconnectionCount,
        previousUptime: previousUptime,
        clientId: (this.socket?.auth as any)?.clientId,
        features: (this.socket?.auth as any)?.features,
        protocolVersion: (this.socket?.io as any)?.protocol,
        engineVersion: this.socket?.io.engine?.id
      };

      // Log to integration logger
      integrationLogger.logServiceConnection('Backend API', true, connectionDetails);

      // Send connection analytics
      this.socket!.emit('connection:analytics', {
        type: 'connected',
        timestamp: new Date().toISOString(),
        metrics: {
          reconnectAttempts: this.reconnectAttempts,
          totalReconnections: this.metrics.reconnectionCount,
          previousSessionDuration: previousUptime,
          errorsSinceLastConnection: this.metrics.errorCount
        },
        client: {
          version: process.env.REACT_APP_VERSION || '1.0.0',
          features: this.getEnabledFeatures(),
          userAgent: navigator.userAgent
        }
      });

      // Reset connection state
      this.connectionStartTime = new Date();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connectionAttemptCount = 0;

      // Start services
      this.startHeartbeat();
      this.startHealthCheck();
      this.flushEventQueue();
      this.updateMetrics();
      this.notifyStatusChange();

      // Request server state sync if reconnecting
      if (this.metrics.reconnectionCount > 0) {
        socketLogger.logInfo('🔄 Requesting state synchronization after reconnection');
        this.socket!.emit('sync:request', {
          lastEventId: this.getLastProcessedEventId(),
          clientTime: Date.now()
        });
      }

      // Setup quality monitoring
      this.startQualityMonitoring();

      if (appConfig.dev.debugMode) {
        socketLogger.logInfo('📊 Connection Metrics:', this.getMetrics());
        socketLogger.logInfo('🔌 Connection Details:', connectionDetails);
      }
    });

    // Disconnection handling with reason analysis
    this.socket.on('disconnect', (reason: string) => {
      const sessionDuration = this.connectionStartTime 
        ? Date.now() - this.connectionStartTime.getTime() 
        : 0;

      socketLogger.logWarning('WebSocket disconnected', reason);
      socketLogger.logInfo('📊 Session duration:', `${Math.round(sessionDuration / 1000)}s`);

      // Analyze disconnect reason
      const disconnectAnalysis = this.analyzeDisconnectReason(reason);
      
      // Log to integration logger with analysis
      integrationLogger.logServiceConnection('Backend API', false, { 
        reason,
        analysis: disconnectAnalysis,
        sessionDuration,
        messagesExchanged: this.metrics.messagesSent + this.metrics.messagesReceived
      });

      // Stop services
      this.stopHeartbeat();
      this.stopHealthCheck();
      this.stopQualityMonitoring();
      this.updateMetrics();
      this.notifyStatusChange();

      // Handle different disconnect scenarios
      switch (disconnectAnalysis.type) {
        case 'server_initiated':
          socketLogger.logWarning('Server initiated disconnect - attempting immediate reconnection');
          this.manualReconnect();
          break;
        
        case 'transport_error':
          socketLogger.logError('Transport error detected - scheduling smart retry');
          this.scheduleSmartRetry();
          break;
        
        case 'client_initiated':
          socketLogger.logInfo('Client initiated disconnect - no auto-reconnect');
          break;
        
        default:
          if (this.config.reconnection) {
            socketLogger.logInfo('Unexpected disconnect - will attempt reconnection');
          }
      }
    });

    // Enhanced connection error handling
    this.socket.on('connect_error', (error: any) => {
      const errorDetails = this.analyzeConnectionError(error);
      
      socketLogger.logError('WebSocket connection error', errorDetails.message);
      socketLogger.logError('Error type:', errorDetails.type);
      
      this.metrics.errorCount++;
      this.updateMetrics();
      this.notifyStatusChange();

      // Track error patterns
      this.trackErrorPattern(errorDetails);

      // Implement adaptive retry logic based on error type
      if (errorDetails.recoverable && this.connectionAttemptCount < this.config.reconnectionAttempts) {
        this.connectionAttemptCount++;
        
        // Adjust retry strategy based on error
        const retryDelay = this.calculateAdaptiveRetryDelay(errorDetails);
        socketLogger.logInfo(`⏰ Scheduling retry in ${Math.round(retryDelay / 1000)}s (attempt ${this.connectionAttemptCount}/${this.config.reconnectionAttempts})`);
        
        setTimeout(() => this.scheduleSmartRetry(), retryDelay);
      } else if (!errorDetails.recoverable) {
        socketLogger.logError('🚨 Unrecoverable error detected - manual intervention required');
        this.notifyFatalError(errorDetails);
      }
    });

    // Successful reconnection
    this.socket.on('reconnect', (attemptNumber: number) => {
      socketLogger.logSuccess(`WebSocket reconnected after ${attemptNumber} attempts`);
      
      // Calculate downtime
      const downtime = this.connectionStartTime 
        ? Date.now() - this.connectionStartTime.getTime() 
        : 0;
      
      socketLogger.logInfo('⏱️ Total downtime:', `${Math.round(downtime / 1000)}s`);
      
      this.metrics.reconnectionCount++;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.updateMetrics();
      this.notifyStatusChange();

      // Send reconnection analytics
      this.socket!.emit('connection:analytics', {
        type: 'reconnected',
        timestamp: new Date().toISOString(),
        metrics: {
          attempts: attemptNumber,
          downtime: downtime,
          totalReconnections: this.metrics.reconnectionCount
        }
      });
    });

    // Reconnection attempt tracking
    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      socketLogger.logInfo(`WebSocket reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
      this.isReconnecting = true;
      
      // Exponential backoff notification
      if (attemptNumber > 3) {
        socketLogger.logWarning(`⚠️ Multiple reconnection attempts (${attemptNumber}) - connection may be unstable`);
      }
      
      this.notifyStatusChange();
    });

    // Reconnection errors with pattern detection
    this.socket.on('reconnect_error', (error: any) => {
      const errorDetails = this.analyzeConnectionError(error);
      socketLogger.logError('WebSocket reconnection error', errorDetails.message);
      
      this.metrics.errorCount++;
      this.updateMetrics();
      
      // Detect error patterns
      if (this.detectErrorPattern('reconnect_error', errorDetails)) {
        socketLogger.logWarning('🔍 Error pattern detected - adjusting strategy');
        this.adjustReconnectionStrategy();
      }
    });

    // Final reconnection failure
    this.socket.on('reconnect_failed', () => {
      socketLogger.logError('WebSocket reconnection failed - all attempts exhausted');
      this.isReconnecting = false;
      this.notifyStatusChange();
      
      // Send failure analytics
      const failureReport = {
        type: 'reconnection_failed',
        timestamp: new Date().toISOString(),
        attempts: this.reconnectAttempts,
        errorCount: this.metrics.errorCount,
        lastError: this.getLastError()
      };
      
      // Try to send via HTTP if possible
      this.sendFailureReportViaHTTP(failureReport);
      
      // Notify user with recovery options
      this.notifyReconnectionFailure();
    });
  }

  // Helper methods for enhanced connection handling
  private analyzeDisconnectReason(reason: string): { type: string; recoverable: boolean; message: string } {
    const reasonMap: Record<string, { type: string; recoverable: boolean; message: string }> = {
      'io server disconnect': {
        type: 'server_initiated',
        recoverable: true,
        message: 'Server terminated the connection'
      },
      'io client disconnect': {
        type: 'client_initiated',
        recoverable: false,
        message: 'Client initiated disconnect'
      },
      'transport close': {
        type: 'transport_error',
        recoverable: true,
        message: 'Transport layer closed unexpectedly'
      },
      'transport error': {
        type: 'transport_error',
        recoverable: true,
        message: 'Transport layer error occurred'
      },
      'ping timeout': {
        type: 'timeout',
        recoverable: true,
        message: 'Server did not respond to ping'
      }
    };

    return reasonMap[reason] || {
      type: 'unknown',
      recoverable: true,
      message: `Unknown disconnect reason: ${reason}`
    };
  }

  private analyzeConnectionError(error: any): { 
    type: string; 
    message: string; 
    recoverable: boolean; 
    code?: string;
  } {
    // Network errors
    if (error.type === 'TransportError' || error.message?.includes('ECONNREFUSED')) {
      return {
        type: 'network',
        message: 'Network connection failed',
        recoverable: true,
        code: 'NETWORK_ERROR'
      };
    }

    // CORS errors
    if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
      return {
        type: 'cors',
        message: 'Cross-origin request blocked',
        recoverable: false,
        code: 'CORS_ERROR'
      };
    }

    // Timeout errors
    if (error.type === 'timeout' || error.message?.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Connection timeout',
        recoverable: true,
        code: 'TIMEOUT'
      };
    }

    // Authentication errors
    if (error.data?.code === 401 || error.message?.includes('unauthorized')) {
      return {
        type: 'auth',
        message: 'Authentication failed',
        recoverable: false,
        code: 'AUTH_ERROR'
      };
    }

    // Default
    return {
      type: 'unknown',
      message: error.message || 'Unknown error',
      recoverable: true,
      code: 'UNKNOWN'
    };
  }

  private errorPatterns: Map<string, { count: number; lastOccurrence: Date }[]> = new Map();

  private trackErrorPattern(errorDetails: any): void {
    const key = `${errorDetails.type}_${errorDetails.code}`;
    if (!this.errorPatterns.has(key)) {
      this.errorPatterns.set(key, []);
    }
    
    const patterns = this.errorPatterns.get(key)!;
    patterns.push({
      count: 1,
      lastOccurrence: new Date()
    });

    // Keep only recent patterns (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    this.errorPatterns.set(
      key,
      patterns.filter(p => p.lastOccurrence > fiveMinutesAgo)
    );
  }

  private detectErrorPattern(event: string, errorDetails: any): boolean {
    const key = `${errorDetails.type}_${errorDetails.code}`;
    const patterns = this.errorPatterns.get(key) || [];
    
    // Detect if we have more than 3 similar errors in 5 minutes
    return patterns.length > 3;
  }

  // Advanced retry delay calculation with multiple algorithms
  private calculateAdaptiveRetryDelay(errorDetails: any): number {
    const baseDelay = this.config.reconnectionDelay;
    const maxDelay = this.config.reconnectionDelayMax;
    
    // Get retry history for this error type
    const retryHistory = this.getRetryHistory(errorDetails.type);
    
    // Choose algorithm based on error patterns and history
    const algorithm = this.selectRetryAlgorithm(errorDetails, retryHistory);
    
    let calculatedDelay: number;
    
    switch (algorithm) {
      case 'exponential':
        calculatedDelay = this.exponentialBackoff(baseDelay, this.connectionAttemptCount, maxDelay);
        break;
        
      case 'fibonacci':
        calculatedDelay = this.fibonacciBackoff(baseDelay, this.connectionAttemptCount, maxDelay);
        break;
        
      case 'decorrelated':
        calculatedDelay = this.decorrelatedJitter(baseDelay, retryHistory.lastDelay || baseDelay, maxDelay);
        break;
        
      case 'adaptive':
        calculatedDelay = this.adaptiveBackoff(errorDetails, retryHistory, baseDelay, maxDelay);
        break;
        
      default:
        calculatedDelay = this.exponentialBackoff(baseDelay, this.connectionAttemptCount, maxDelay);
    }
    
    // Apply error-type specific multipliers
    const errorMultiplier = this.getErrorTypeMultiplier(errorDetails);
    calculatedDelay *= errorMultiplier;
    
    // Apply network quality factor
    const networkQualityFactor = this.calculateNetworkQualityFactor();
    calculatedDelay *= networkQualityFactor;
    
    // Apply time-of-day adjustment (reduce delays during off-peak hours)
    const timeOfDayFactor = this.getTimeOfDayFactor();
    calculatedDelay *= timeOfDayFactor;
    
    // Ensure we don't exceed max delay
    calculatedDelay = Math.min(calculatedDelay, maxDelay);
    
    // Add intelligent jitter
    const jitter = this.calculateIntelligentJitter(calculatedDelay, errorDetails);
    const finalDelay = calculatedDelay + jitter;
    
    // Update retry history
    this.updateRetryHistory(errorDetails.type, {
      delay: finalDelay,
      timestamp: Date.now(),
      algorithm,
      attempt: this.connectionAttemptCount
    });
    
    // Log retry decision
    socketLogger.logInfo(`🔄 Retry delay calculated: ${Math.round(finalDelay)}ms`, {
      algorithm,
      baseDelay: Math.round(calculatedDelay),
      jitter: Math.round(jitter),
      errorType: errorDetails.type,
      attempt: this.connectionAttemptCount,
      networkQuality: networkQualityFactor.toFixed(2)
    });
    
    return finalDelay;
  }

  // Retry algorithms
  private exponentialBackoff(base: number, attempt: number, max: number): number {
    return Math.min(base * Math.pow(2, attempt - 1), max);
  }

  private fibonacciBackoff(base: number, attempt: number, max: number): number {
    const fib = (n: number): number => {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    };
    return Math.min(base * fib(attempt), max);
  }

  private decorrelatedJitter(base: number, lastDelay: number, max: number): number {
    // AWS-style decorrelated jitter
    return Math.min(max, Math.random() * (lastDelay * 3 - base) + base);
  }

  private adaptiveBackoff(errorDetails: any, history: any, base: number, max: number): number {
    // Adaptive algorithm that learns from success/failure patterns
    const successRate = this.calculateSuccessRate(errorDetails.type);
    const avgRecoveryTime = history.avgRecoveryTime || base;
    
    // If we have good success rate, be more aggressive
    if (successRate > 0.7) {
      return Math.min(avgRecoveryTime * 0.8, max);
    }
    
    // If poor success rate, be more conservative
    if (successRate < 0.3) {
      return Math.min(avgRecoveryTime * 2, max);
    }
    
    // Otherwise, use average recovery time with some variance
    return Math.min(avgRecoveryTime * (0.8 + Math.random() * 0.4), max);
  }

  // Helper methods for retry calculation
  private retryHistories: Map<string, any[]> = new Map();

  private getRetryHistory(errorType: string): any {
    const history = this.retryHistories.get(errorType) || [];
    
    return {
      attempts: history.length,
      lastDelay: history[history.length - 1]?.delay,
      avgDelay: history.reduce((sum, h) => sum + h.delay, 0) / Math.max(1, history.length),
      avgRecoveryTime: this.calculateAvgRecoveryTime(history),
      successRate: this.calculateSuccessRate(errorType)
    };
  }

  private updateRetryHistory(errorType: string, entry: any): void {
    if (!this.retryHistories.has(errorType)) {
      this.retryHistories.set(errorType, []);
    }
    
    const history = this.retryHistories.get(errorType)!;
    history.push(entry);
    
    // Keep only last 50 entries
    if (history.length > 50) {
      history.shift();
    }
  }

  private selectRetryAlgorithm(errorDetails: any, history: any): string {
    // Select algorithm based on error characteristics and history
    if (errorDetails.type === 'auth' || errorDetails.type === 'cors') {
      return 'exponential'; // Predictable for permanent errors
    }
    
    if (errorDetails.type === 'rate_limit') {
      return 'fibonacci'; // Gentler increase for rate limits
    }
    
    if (history.attempts > 5 && history.successRate < 0.5) {
      return 'decorrelated'; // High randomness for persistent issues
    }
    
    if (history.attempts > 2) {
      return 'adaptive'; // Learn from patterns after a few attempts
    }
    
    return 'exponential'; // Default
  }

  private getErrorTypeMultiplier(errorDetails: any): number {
    const multipliers: Record<string, number> = {
      'timeout': 1.5,
      'network': 2.0,
      'auth': 3.0,
      'rate_limit': 2.5,
      'server': 1.8,
      'protocol': 3.0,
      'unknown': 1.2
    };
    
    return multipliers[errorDetails.type] || 1.0;
  }

  private calculateNetworkQualityFactor(): number {
    const quality = this.assessConnectionQuality();
    
    // Better quality = shorter delays
    if (quality.score > 0.8) return 0.7;
    if (quality.score > 0.6) return 0.9;
    if (quality.score > 0.4) return 1.1;
    if (quality.score > 0.2) return 1.5;
    return 2.0; // Poor quality = longer delays
  }

  private getTimeOfDayFactor(): number {
    const hour = new Date().getHours();
    
    // Reduce delays during off-peak hours (midnight to 6am)
    if (hour >= 0 && hour < 6) return 0.7;
    
    // Increase delays during peak hours (9am-5pm)
    if (hour >= 9 && hour < 17) return 1.2;
    
    return 1.0;
  }

  private calculateIntelligentJitter(baseDelay: number, errorDetails: any): number {
    // Intelligent jitter based on error type and network conditions
    const maxJitter = Math.min(baseDelay * 0.3, 5000); // Max 30% or 5 seconds
    
    // Use different jitter strategies based on error type
    switch (errorDetails.type) {
      case 'rate_limit':
        // Full jitter for rate limits to spread load
        return Math.random() * maxJitter;
        
      case 'network':
        // Partial jitter for network issues
        return (0.5 + Math.random() * 0.5) * maxJitter;
        
      case 'timeout':
        // Minimal jitter for timeouts
        return Math.random() * maxJitter * 0.3;
        
      default:
        // Standard jitter
        return Math.random() * maxJitter * 0.5;
    }
  }

  private calculateAvgRecoveryTime(history: any[]): number {
    const successfulRecoveries = history.filter(h => h.recovered);
    if (successfulRecoveries.length === 0) return this.config.reconnectionDelay;
    
    const totalTime = successfulRecoveries.reduce((sum, h) => sum + h.delay, 0);
    return totalTime / successfulRecoveries.length;
  }

  private calculateSuccessRate(errorType: string): number {
    const history = this.retryHistories.get(errorType) || [];
    if (history.length === 0) return 0.5; // Unknown, assume 50%
    
    const successful = history.filter(h => h.recovered).length;
    return successful / history.length;
  }

  // Enhanced reconnection strategy adjustment
  private adjustReconnectionStrategy(): void {
    // Analyze current situation
    const analysis = this.analyzeConnectionSituation();
    
    socketLogger.logInfo('📊 Adjusting reconnection strategy based on:', analysis);
    
    // Multi-factor decision making
    const decisions = this.makeStrategicDecisions(analysis);
    
    // Apply decisions
    decisions.forEach(decision => {
      this.applyStrategicDecision(decision);
    });
    
    // Log strategy changes
    socketLogger.logInfo('🎯 Reconnection strategy adjusted:', {
      newDelay: this.config.reconnectionDelay,
      transport: this.socket?.io.opts.transports,
      algorithm: this.currentRetryAlgorithm,
      healthCheckInterval: this.healthCheckInterval
    });
  }

  private currentRetryAlgorithm: string = 'exponential';
  private healthCheckInterval: number = 30000;

  private analyzeConnectionSituation(): any {
    const errorPatterns = this.detectErrorPatterns();
    const networkHealth = this.assessNetworkHealth();
    const serverHealth = this.assessServerHealth();
    const clientResources = this.assessClientResources();
    
    return {
      errorPatterns,
      networkHealth,
      serverHealth,
      clientResources,
      totalErrors: this.metrics.errorCount,
      reconnectionAttempts: this.reconnectAttempts,
      uptime: this.metrics.connectionUptime,
      lastError: this.lastError,
      currentTransport: this.socket?.io.engine?.transport?.name
    };
  }

  private detectErrorPatterns(): any {
    const patterns: any = {
      persistent: false,
      intermittent: false,
      escalating: false,
      cyclic: false
    };
    
    // Analyze error history
    const recentErrors = Array.from(this.errorPatterns.values()).flat();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    const windowedErrors = recentErrors.filter(e => 
      now - e.lastOccurrence.getTime() < timeWindow
    );
    
    // Persistent pattern: constant errors
    patterns.persistent = windowedErrors.length > 10;
    
    // Intermittent pattern: sporadic errors
    if (windowedErrors.length > 0) {
      const intervals = [];
      for (let i = 1; i < windowedErrors.length; i++) {
        intervals.push(
          windowedErrors[i].lastOccurrence.getTime() - 
          windowedErrors[i-1].lastOccurrence.getTime()
        );
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      patterns.intermittent = avgInterval > 30000; // More than 30s between errors
    }
    
    // Escalating pattern: increasing frequency
    if (windowedErrors.length > 5) {
      const firstHalf = windowedErrors.slice(0, Math.floor(windowedErrors.length / 2));
      const secondHalf = windowedErrors.slice(Math.floor(windowedErrors.length / 2));
      patterns.escalating = secondHalf.length > firstHalf.length * 1.5;
    }
    
    // Cyclic pattern: regular intervals
    if (windowedErrors.length > 3) {
      const intervals = [];
      for (let i = 1; i < windowedErrors.length; i++) {
        intervals.push(
          windowedErrors[i].lastOccurrence.getTime() - 
          windowedErrors[i-1].lastOccurrence.getTime()
        );
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => 
        sum + Math.pow(interval - avgInterval, 2), 0
      ) / intervals.length;
      const stdDev = Math.sqrt(variance);
      patterns.cyclic = stdDev < avgInterval * 0.2; // Low variance indicates cycles
    }
    
    return patterns;
  }

  private assessNetworkHealth(): any {
    return {
      latency: this.metrics.averageLatency,
      packetLoss: this.estimatePacketLoss(),
      bandwidth: this.estimateBandwidth(),
      stability: this.calculateNetworkStability(),
      congestion: this.detectNetworkCongestion()
    };
  }

  private assessServerHealth(): any {
    // Based on error types and response patterns
    const serverErrors = Array.from(this.errorPatterns.entries())
      .filter(([key]) => key.includes('server'))
      .reduce((sum, [, errors]) => sum + errors.length, 0);
    
    return {
      availability: serverErrors === 0 ? 1.0 : Math.max(0, 1 - (serverErrors / 10)),
      responseTime: this.metrics.averageLatency,
      errorRate: serverErrors / Math.max(1, this.metrics.messagesSent),
      overloaded: this.metrics.averageLatency > 1000 || serverErrors > 5
    };
  }

  private assessClientResources(): any {
    const perfMemory = (performance as any).memory;
    const memory = perfMemory ? {
      used: perfMemory.usedJSHeapSize,
      total: perfMemory.totalJSHeapSize,
      limit: perfMemory.jsHeapSizeLimit,
      usage: perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit
    } : null;
    
    return {
      memory,
      cpu: this.estimateCPUUsage(),
      battery: 'getBattery' in navigator ? 'available' : 'unknown',
      networkType: (navigator as any).connection?.effectiveType || 'unknown'
    };
  }

  private makeStrategicDecisions(analysis: any): any[] {
    const decisions = [];
    
    // Decision 1: Adjust retry delays
    if (analysis.errorPatterns.persistent) {
      decisions.push({
        type: 'delay_adjustment',
        action: 'increase',
        factor: 2.0,
        reason: 'persistent_errors'
      });
    } else if (analysis.errorPatterns.intermittent) {
      decisions.push({
        type: 'delay_adjustment',
        action: 'randomize',
        factor: 1.5,
        reason: 'intermittent_errors'
      });
    }
    
    // Decision 2: Transport switching
    if (analysis.networkHealth.stability < 0.5 && analysis.currentTransport === 'websocket') {
      decisions.push({
        type: 'transport_switch',
        action: 'polling_only',
        reason: 'unstable_network'
      });
    } else if (analysis.networkHealth.congestion && analysis.currentTransport === 'polling') {
      decisions.push({
        type: 'transport_switch',
        action: 'prefer_websocket',
        reason: 'network_congestion'
      });
    }
    
    // Decision 3: Algorithm selection
    if (analysis.errorPatterns.cyclic) {
      decisions.push({
        type: 'algorithm_change',
        action: 'decorrelated',
        reason: 'cyclic_pattern'
      });
    } else if (analysis.reconnectionAttempts > 10) {
      decisions.push({
        type: 'algorithm_change',
        action: 'adaptive',
        reason: 'many_attempts'
      });
    }
    
    // Decision 4: Health check frequency
    if (analysis.serverHealth.overloaded) {
      decisions.push({
        type: 'health_check',
        action: 'reduce_frequency',
        interval: 60000,
        reason: 'server_overload'
      });
    } else if (analysis.networkHealth.stability > 0.8) {
      decisions.push({
        type: 'health_check',
        action: 'increase_frequency',
        interval: 15000,
        reason: 'stable_connection'
      });
    }
    
    // Decision 5: Resource management
    if (analysis.clientResources.memory?.usage > 0.8) {
      decisions.push({
        type: 'resource_management',
        action: 'reduce_buffer_size',
        reason: 'high_memory_usage'
      });
    }
    
    return decisions;
  }

  private applyStrategicDecision(decision: any): void {
    switch (decision.type) {
      case 'delay_adjustment':
        if (decision.action === 'increase') {
          this.config.reconnectionDelay = Math.min(
            this.config.reconnectionDelay * decision.factor,
            this.config.reconnectionDelayMax
          );
        } else if (decision.action === 'randomize') {
          // Add more randomness to delays
          this.currentRetryAlgorithm = 'decorrelated';
        }
        break;
        
      case 'transport_switch':
        if (decision.action === 'polling_only' && this.socket?.io.opts.transports) {
          this.socket.io.opts.transports = ['polling'];
          socketLogger.logInfo('🔄 Switched to polling-only transport');
        } else if (decision.action === 'prefer_websocket' && this.socket?.io.opts.transports) {
          this.socket.io.opts.transports = ['websocket', 'polling'];
          socketLogger.logInfo('🔄 Preferring WebSocket transport');
        }
        break;
        
      case 'algorithm_change':
        this.currentRetryAlgorithm = decision.action;
        socketLogger.logInfo(`🎯 Changed retry algorithm to: ${decision.action}`);
        break;
        
      case 'health_check':
        this.healthCheckInterval = decision.interval;
        socketLogger.logInfo(`⏱️ Adjusted health check interval to: ${decision.interval}ms`);
        break;
        
      case 'resource_management':
        if (decision.action === 'reduce_buffer_size') {
          this.config.maxQueueSize = Math.max(10, Math.floor(this.config.maxQueueSize * 0.5));
          socketLogger.logInfo(`📦 Reduced queue size to: ${this.config.maxQueueSize}`);
        }
        break;
    }
  }

  // Network quality estimation helpers
  private estimatePacketLoss(): number {
    // Estimate based on failed heartbeats and timeouts
    const totalPackets = this.metrics.messagesSent + this.metrics.messagesReceived;
    const lostPackets = this.metrics.errorCount * 0.3; // Rough estimate
    return totalPackets > 0 ? lostPackets / totalPackets : 0;
  }

  private estimateBandwidth(): string {
    // Rough estimation based on message throughput
    const duration = this.metrics.connectionUptime / 1000; // seconds
    const dataTransferred = (this.metrics.messagesSent + this.metrics.messagesReceived) * 100; // assume 100 bytes avg
    const bandwidth = duration > 0 ? dataTransferred / duration : 0;
    
    if (bandwidth > 100000) return 'high';
    if (bandwidth > 10000) return 'medium';
    return 'low';
  }

  private calculateNetworkStability(): number {
    // Based on reconnection frequency and error patterns
    const reconnectRate = this.metrics.reconnectionCount / Math.max(1, this.metrics.connectionUptime / (60 * 1000));
    const errorRate = this.metrics.errorCount / Math.max(1, this.metrics.messagesSent + this.metrics.messagesReceived);
    
    return Math.max(0, 1 - reconnectRate - errorRate);
  }

  private detectNetworkCongestion(): boolean {
    // High latency with low error rate might indicate congestion
    return this.metrics.averageLatency > 500 && 
           this.metrics.errorCount / Math.max(1, this.metrics.messagesSent) < 0.05;
  }

  private estimateCPUUsage(): string {
    // Very rough estimation based on processing delays
    if (this.metrics.averageLatency < 50) return 'low';
    if (this.metrics.averageLatency < 200) return 'medium';
    return 'high';
  }

  // Enhanced error tracking with detailed history
  private errorHistory: Array<{
    timestamp: Date;
    error: any;
    context: any;
    recovery?: {
      attempted: boolean;
      successful: boolean;
      duration: number;
      method: string;
    };
  }> = [];

  private lastError: any = null;

  private getLastError(): any {
    return {
      ...this.lastError,
      history: this.getErrorHistory(),
      analysis: this.analyzeLastError()
    };
  }

  private trackError(error: any, context?: any): void {
    const errorEntry = {
      timestamp: new Date(),
      error: {
        ...error,
        stack: error.stack,
        code: error.code,
        type: error.type || this.classifyError(error).category
      },
      context: {
        ...context,
        connectionState: this.getConnectionStatus(),
        metrics: this.getMetrics(),
        transport: this.socket?.io.engine?.transport?.name
      }
    };
    
    this.errorHistory.push(errorEntry);
    this.lastError = errorEntry;
    
    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
    
    // Persist critical errors
    if (error.severity === 'critical') {
      this.persistCriticalError(errorEntry);
    }
  }

  private getErrorHistory(limit: number = 10): any[] {
    return this.errorHistory
      .slice(-limit)
      .map(entry => ({
        ...entry,
        age: Date.now() - entry.timestamp.getTime()
      }));
  }

  private analyzeLastError(): any {
    if (!this.lastError) return null;
    
    const similarErrors = this.errorHistory.filter(e => 
      e.error.type === this.lastError.error.type &&
      e.error.code === this.lastError.error.code
    );
    
    return {
      frequency: similarErrors.length,
      firstOccurrence: similarErrors[0]?.timestamp,
      pattern: this.detectErrorPattern(this.lastError.error.type, this.lastError.error),
      suggestedAction: this.suggestErrorRecovery(this.lastError.error),
      correlatedEvents: this.findCorrelatedEvents(this.lastError.timestamp)
    };
  }

  private persistCriticalError(error: any): void {
    try {
      const criticalErrors = JSON.parse(localStorage.getItem('critical_errors') || '[]');
      criticalErrors.push({
        ...error,
        timestamp: error.timestamp.toISOString()
      });
      
      // Keep only last 10 critical errors
      if (criticalErrors.length > 10) {
        criticalErrors.splice(0, criticalErrors.length - 10);
      }
      
      localStorage.setItem('critical_errors', JSON.stringify(criticalErrors));
    } catch (e) {
      console.error('Failed to persist critical error:', e);
    }
  }

  private suggestErrorRecovery(error: any): string {
    const classification = this.classifyError(error);
    
    const suggestions: Record<string, string> = {
      'network': 'Check network connection and firewall settings',
      'auth': 'Verify authentication credentials and refresh tokens',
      'rate_limit': 'Reduce request frequency or upgrade plan',
      'timeout': 'Check server status and network latency',
      'protocol': 'Update client version or check API compatibility',
      'server': 'Contact support or check service status page',
      'cors': 'Verify CORS configuration on server',
      'unknown': 'Check logs and contact support if issue persists'
    };
    
    return suggestions[classification.category] || suggestions.unknown;
  }

  private findCorrelatedEvents(timestamp: Date): any[] {
    const window = 5000; // 5 seconds
    const targetTime = timestamp.getTime();
    
    return this.errorHistory
      .filter(e => Math.abs(e.timestamp.getTime() - targetTime) < window && e !== this.lastError)
      .map(e => ({
        type: e.error.type,
        timeDiff: e.timestamp.getTime() - targetTime,
        severity: e.error.severity
      }));
  }

  private getLastProcessedEventId(): string | null {
    // This would be implemented to track the last successfully processed event
    return localStorage.getItem('last_processed_event_id');
  }

  private qualityMonitoringTimer: NodeJS.Timeout | null = null;

  private startQualityMonitoring(): void {
    this.stopQualityMonitoring();
    
    this.qualityMonitoringTimer = setInterval(() => {
      if (this.socket?.connected) {
        const quality = this.assessConnectionQuality();
        if (quality.score < 0.5) {
          socketLogger.logWarning(`⚠️ Poor connection quality detected: ${(quality.score * 100).toFixed(0)}%`);
          this.socket.emit('connection:quality', quality);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private stopQualityMonitoring(): void {
    if (this.qualityMonitoringTimer) {
      clearInterval(this.qualityMonitoringTimer);
      this.qualityMonitoringTimer = null;
    }
  }

  private assessConnectionQuality(): { score: number; factors: any } {
    const factors = {
      latency: this.metrics.averageLatency < 200 ? 1 : (1000 / this.metrics.averageLatency),
      errorRate: 1 - (this.metrics.errorCount / Math.max(1, this.metrics.messagesSent + this.metrics.messagesReceived)),
      uptime: Math.min(1, (Date.now() - (this.connectionStartTime?.getTime() || Date.now())) / (5 * 60 * 1000)),
      reconnections: Math.max(0, 1 - (this.metrics.reconnectionCount / 10))
    };
    
    const score = (factors.latency + factors.errorRate + factors.uptime + factors.reconnections) / 4;
    
    return { score, factors };
  }

  private async sendFailureReportViaHTTP(report: any): Promise<void> {
    try {
      await fetch(buildApiEndpoint('/connection/failure'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    } catch (error) {
      console.error('Failed to send failure report:', error);
    }
  }

  private notifyFatalError(errorDetails: any): void {
    this.notifyEventListeners('fatal_error', errorDetails);
  }

  private notifyReconnectionFailure(): void {
    this.notifyEventListeners('reconnection_failed', {
      attempts: this.reconnectAttempts,
      canRetry: true,
      retryAction: () => this.forceReconnect()
    });
  }

  // Setup error handlers with classification and recovery
  private setupErrorHandlers(): void {
    if (!this.socket) return;

    // Socket-level errors
    this.socket.on('error', (error: any) => {
      const errorInfo = this.classifyError(error);
      
      socketLogger.logError(`Game error [${errorInfo.severity}]`, errorInfo.message);
      socketLogger.logError('Error details:', errorInfo);
      
      // Update error tracking
      this.lastError = errorInfo;
      this.metrics.errorCount++;
      this.updateMetrics();
      
      // Log to integration logger with classification
      integrationLogger.logError('socket_error', errorInfo);
      
      // Handle based on severity
      this.handleErrorBySeverity(errorInfo);
      
      // Notify listeners with error info
      this.notifyEventListeners('socket_error', errorInfo);
    });

    // Transport-level errors
    this.socket.io.on('error', (error: any) => {
      const errorInfo = this.classifyError(error);
      errorInfo.level = 'transport';
      
      socketLogger.logError(`Transport error [${errorInfo.severity}]`, errorInfo.message);
      
      this.lastError = errorInfo;
      this.metrics.errorCount++;
      this.updateMetrics();
      
      // Check if we need to switch transports
      const transports = this.socket?.io?.opts?.transports;
      if (errorInfo.category === 'connection' && transports && transports.length > 1) {
        socketLogger.logWarning('🔄 Considering transport switch due to errors');
        this.considerTransportSwitch();
      }
    });

    // Manager-level errors
    if (this.manager) {
      this.manager.on('error', (error: any) => {
        const errorInfo = this.classifyError(error);
        errorInfo.level = 'manager';
        
        socketLogger.logError(`Manager error [${errorInfo.severity}]`, errorInfo.message);
        
        // Manager errors are often critical
        if (errorInfo.severity === 'critical') {
          this.handleCriticalError(errorInfo);
        }
      });
    }

    // Custom error event from server
    this.socket.on('server:error', (errorData: any) => {
      const errorInfo = {
        ...this.classifyError(errorData),
        source: 'server',
        timestamp: new Date().toISOString()
      };
      
      socketLogger.logError(`Server error [${errorInfo.severity}]`, errorInfo.message);
      
      // Handle server-specific errors
      this.handleServerError(errorInfo);
    });

    // Validation errors
    this.socket.on('validation:error', (validationError: any) => {
      socketLogger.logWarning('Validation error:', validationError);
      
      // Track validation errors separately
      this.trackValidationError(validationError);
      
      // Notify UI about validation issues
      this.notifyEventListeners('validation_error', validationError);
    });
  }

  // Error classification system
  private classifyError(error: any): {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    code?: string;
    recoverable: boolean;
    retryable: boolean;
    details: any;
    level?: string;
  } {
    // Default classification
    let classification: {
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      code?: string;
      recoverable: boolean;
      retryable: boolean;
      details: any;
      level?: string;
    } = {
      category: 'unknown',
      severity: 'medium',
      message: error?.message || 'Unknown error',
      code: error?.code,
      recoverable: true,
      retryable: true,
      details: error
    };

    // Connection errors
    if (error?.type === 'TransportError' || error?.message?.includes('connect')) {
      classification.category = 'connection';
      classification.severity = 'high';
      classification.retryable = true;
    }
    
    // Authentication errors
    else if (error?.code === 401 || error?.message?.includes('auth')) {
      classification.category = 'authentication';
      classification.severity = 'critical';
      classification.recoverable = false;
      classification.retryable = false;
    }
    
    // Rate limiting
    else if (error?.code === 429 || error?.message?.includes('rate limit')) {
      classification.category = 'rate_limit';
      classification.severity = 'medium';
      classification.retryable = true;
    }
    
    // Timeout errors
    else if (error?.message?.includes('timeout')) {
      classification.category = 'timeout';
      classification.severity = 'medium';
      classification.retryable = true;
    }
    
    // Protocol errors
    else if (error?.message?.includes('protocol') || error?.message?.includes('version')) {
      classification.category = 'protocol';
      classification.severity = 'critical';
      classification.recoverable = false;
      classification.retryable = false;
    }
    
    // Server errors
    else if (error?.code >= 500 && error?.code < 600) {
      classification.category = 'server';
      classification.severity = 'high';
      classification.retryable = true;
    }

    return classification;
  }

  // Error handling by severity
  private handleErrorBySeverity(errorInfo: any): void {
    switch (errorInfo.severity) {
      case 'critical':
        this.handleCriticalError(errorInfo);
        break;
      
      case 'high':
        this.handleHighSeverityError(errorInfo);
        break;
      
      case 'medium':
        this.handleMediumSeverityError(errorInfo);
        break;
      
      case 'low':
        // Log and continue
        console.warn('Low severity error:', errorInfo);
        break;
    }
  }

  private handleCriticalError(errorInfo: any): void {
    socketLogger.logError('🚨 CRITICAL ERROR - Initiating emergency procedures');
    
    // Stop all operations
    this.stopHeartbeat();
    this.stopHealthCheck();
    this.stopQualityMonitoring();
    
    // Clear queues to prevent cascading failures
    this.eventQueue = [];
    
    // Notify all listeners
    this.notifyEventListeners('critical_error', {
      ...errorInfo,
      action: 'immediate_attention_required'
    });
    
    // Attempt emergency recovery if possible
    if (errorInfo.recoverable) {
      setTimeout(() => {
        socketLogger.logInfo('🚑 Attempting emergency recovery...');
        this.restart({ reason: 'critical_error_recovery' });
      }, 5000);
    }
  }

  private handleHighSeverityError(errorInfo: any): void {
    if (errorInfo.retryable) {
      const retryDelay = this.calculateAdaptiveRetryDelay(errorInfo);
      socketLogger.logWarning(`⚠️ High severity error - retrying in ${Math.round(retryDelay / 1000)}s`);
      
      setTimeout(() => {
        if (errorInfo.category === 'connection') {
          this.forceReconnect();
        }
      }, retryDelay);
    }
  }

  private handleMediumSeverityError(errorInfo: any): void {
    // Implement backoff strategy
    if (errorInfo.category === 'rate_limit') {
      const backoffTime = errorInfo.details?.retryAfter || 60000;
      socketLogger.logWarning(`⏱️ Rate limited - backing off for ${backoffTime / 1000}s`);
      
      // Temporarily disable operations
      this.pauseOperations(backoffTime);
    }
  }

  private handleServerError(errorInfo: any): void {
    // Server errors might require special handling
    if (errorInfo.code === 'GAME_FULL') {
      this.notifyEventListeners('game_full', errorInfo);
    } else if (errorInfo.code === 'INVALID_MOVE') {
      this.notifyEventListeners('invalid_move', errorInfo);
    }
  }

  private validationErrors: Map<string, number> = new Map();

  private trackValidationError(error: any): void {
    const key = error.field || 'general';
    this.validationErrors.set(key, (this.validationErrors.get(key) || 0) + 1);
    
    // If we see repeated validation errors, there might be a client issue
    if (this.validationErrors.get(key)! > 5) {
      socketLogger.logError(`🚨 Repeated validation errors on field: ${key}`);
      this.notifyEventListeners('repeated_validation_error', { field: key, count: this.validationErrors.get(key) });
    }
  }

  private considerTransportSwitch(): void {
    const transports = this.socket?.io?.opts?.transports as string[] | undefined;
    if (transports && transports.includes('polling') && 
        transports[0] && typeof transports[0] === 'string' && !transports[0].includes('polling')) {
      socketLogger.logInfo('🔄 Switching to polling transport due to websocket errors');
      this.socket!.io.opts.transports = ['polling'] as any;
      this.forceReconnect();
    }
  }

  private pauseOperations(duration: number): void {
    this.config.enableQueue = false;
    
    setTimeout(() => {
      this.config.enableQueue = true;
      socketLogger.logInfo('✅ Operations resumed after backoff');
    }, duration);
  }

  // Setup game-specific event handlers with validation and buffering
  private setupGameHandlers(): void {
    if (!this.socket) return;

    const gameEvents = [
      'gameCreated', 'aiThinking', 'aiMove', 'playerMove', 'gameOver',
      'gameState', 'playerJoined', 'playerLeft', 'error', 'warning',
      'gameUpdate', 'spectatorJoined', 'chatMessage', 'moveAnalysis',
      'serviceStatusUpdate'
    ];

    // Event buffer for replay and analysis
    const eventBuffer: Array<{ event: string; data: any; timestamp: Date }> = [];
    const maxBufferSize = 100;

    gameEvents.forEach(event => {
      this.socket!.on(event, (data: any, ack?: Function) => {
        const timestamp = new Date();
        
        // Validate event data
        const validation = this.validateGameEvent(event, data);
        if (!validation.isValid) {
          socketLogger.logError(`Invalid ${event} event:`, validation.errors);
          socketLogger.logError(`Event data received:`, data);
          console.error(`🚨 Validation failed for ${event}:`, {
            errors: validation.errors,
            receivedData: data,
            dataType: typeof data,
            hasColumn: data?.hasOwnProperty('column'),
            hasPlayer: data?.hasOwnProperty('player'),
            columnValue: data?.column,
            playerValue: data?.player,
            allKeys: data ? Object.keys(data) : [],
            dataStringified: JSON.stringify(data)
          });
          this.trackValidationError({ event, errors: validation.errors, data });
          
          // Acknowledge with error if callback provided
          if (ack) {
            ack({ error: 'validation_failed', details: validation.errors });
          }
          return;
        }

        // Enhanced logging with emojis
        const eventEmojis: Record<string, string> = {
          gameCreated: '🎮',
          aiThinking: '🤔',
          aiMove: '🤖',
          playerMove: '👤',
          gameOver: '🏁',
          gameState: '📊',
          playerJoined: '👋',
          playerLeft: '👋',
          error: '❌',
          warning: '⚠️',
          gameUpdate: '🔄',
          spectatorJoined: '👁️',
          chatMessage: '💬',
          moveAnalysis: '🔍',
          serviceStatusUpdate: '📡',
          serviceStatusRequested: '📊',
          'memory:alert': '🧠'
        };

        console.log(`${eventEmojis[event] || '📡'} ${event}:`, data);
        
        // Update metrics
        this.metrics.messagesReceived++;
        this.updateMetrics();

        // Buffer events for replay
        eventBuffer.push({ event, data, timestamp });
        if (eventBuffer.length > maxBufferSize) {
          eventBuffer.shift();
        }

        // Store last event ID for sync
        if (data.eventId) {
          localStorage.setItem('last_processed_event_id', data.eventId);
        }

        // Log to integration logger with enhanced metadata
        integrationLogger.logWebSocketEvent(event, {
          ...data,
          _metadata: {
            timestamp,
            latency: data.serverTime ? Date.now() - data.serverTime : null,
            sequence: this.metrics.messagesReceived
          }
        }, 'in');

        // Special handling for different event types
        switch (event) {
          case 'aiMove':
            this.handleAIMove(data);
            break;
          
          case 'gameState':
            this.handleGameState(data);
            break;
          
          case 'gameOver':
            this.handleGameOver(data);
            break;
          
          case 'moveAnalysis':
            this.handleMoveAnalysis(data);
            break;
            
          case 'serviceStatusUpdate':
            this.handleServiceStatusUpdate(data);
            break;
        }

        // Acknowledge receipt if callback provided
        if (ack) {
          ack({ received: true, timestamp: timestamp.toISOString() });
        }

        // Notify event listeners
        this.notifyEventListeners(event, data);
        
        // Notify catch-all listeners
        this.notifyEventListeners('game_event', { event, data, timestamp });
      });
    });

    // Setup event buffer access
    this.socket.on('request:event_buffer', (callback: Function) => {
      callback(eventBuffer);
    });

    // Setup event replay
    this.socket.on('replay:events', (filter: any, callback: Function) => {
      const filtered = eventBuffer.filter(e => 
        !filter.event || e.event === filter.event
      ).slice(filter.start || 0, filter.end);
      
      callback(filtered);
    });
  }

  // Event validation
  private validateGameEvent(event: string, data: any): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Skip validation for certain events
    const skipValidationEvents = ['error', 'warning', 'serviceStatusUpdate', 'gameUpdate'];
    if (skipValidationEvents.includes(event)) {
      return { isValid: true };
    }

    // Common validations
    if (!data) {
      errors.push('Event data is required');
    }

    // If data is missing, return early
    if (!data) {
      return {
        isValid: false,
        errors
      };
    }

    // Event-specific validations
    switch (event) {
      case 'playerMove':
      case 'aiMove':
        // Handle different data structures
        let column, player;
        
        // Check if move data is nested in lastMove
        if (data.lastMove) {
          column = data.lastMove.column ?? data.lastMove.col;
          player = data.lastMove.player ?? data.lastMove.color ?? data.lastMove.playerColor;
        } else {
          // Direct properties
          column = data.column ?? data.col;
          player = data.player ?? data.color ?? data.playerColor;
        }
        
        // If we have nextPlayer but no player in lastMove, derive it
        if (!player && data.nextPlayer) {
          // The player who just moved is the opposite of nextPlayer
          player = data.nextPlayer === 'Yellow' ? 'Red' : 'Yellow';
        }
        
        // Validate column
        if (column !== undefined && (typeof column !== 'number' || column < 0 || column > 6)) {
          errors.push('Invalid column number');
        } else if (column === undefined && !data.board) {
          // Only require column if we don't have a board state
          errors.push('Invalid column number');
        }
        
        // Validate player
        if (player) {
          const normalizedPlayer = player.toString().toLowerCase();
          if (normalizedPlayer !== 'red' && normalizedPlayer !== 'yellow') {
            errors.push('Invalid player');
          }
        } else if (!data.board && !data.nextPlayer) {
          // Only require player if we don't have board state or nextPlayer
          errors.push('Invalid player');
        }
        break;
      
      case 'gameState':
        if (!data.board || !Array.isArray(data.board)) {
          errors.push('Invalid board state');
        }
        if (!data.currentPlayer) {
          errors.push('Current player is required');
        }
        break;
      
      case 'gameOver':
        if (!data.winner && data.winner !== null) {
          errors.push('Winner information is required');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Special event handlers
  private handleAIMove(data: any): void {
    // Extract column from various possible locations
    const column = data.column ?? data.col ?? data.lastMove?.column ?? data.lastMove?.col;
    
    if (data.aiMetrics || data.lastMove?.aiMetrics) {
      const aiMetrics = data.aiMetrics || data.lastMove?.aiMetrics;
      // Enhanced AI metrics logging
      const metrics = {
        column: column,
        confidence: aiMetrics.confidence || 0,
        algorithm: aiMetrics.algorithm || 'unknown',
        difficulty: aiMetrics.difficulty || 0,
        timeMs: aiMetrics.responseTime || 0,
        strategy: aiMetrics.strategy,
        alternatives: aiMetrics.alternatives,
        evaluations: aiMetrics.evaluations,
        depth: aiMetrics.searchDepth,
        nodesEvaluated: aiMetrics.nodesEvaluated
      };
      
      integrationLogger.logAIDecision(metrics);
      
      // Track AI performance
      this.trackAIPerformance(metrics);
    }
  }

  private handleGameState(data: any): void {
    // Cache current game state for recovery
    sessionStorage.setItem('last_game_state', JSON.stringify({
      ...data,
      timestamp: Date.now()
    }));
  }

  private handleGameOver(data: any): void {
    // Clear game-specific caches
    sessionStorage.removeItem('last_game_state');
    
    // Send game analytics
    this.socket!.emit('game:analytics', {
      duration: data.duration,
      moves: data.totalMoves,
      winner: data.winner,
      endType: data.isDraw ? 'draw' : 'win'
    });
  }

  private handleMoveAnalysis(data: any): void {
    // Store move analysis for learning
    const analyses = JSON.parse(localStorage.getItem('move_analyses') || '[]');
    analyses.push({
      ...data,
      timestamp: Date.now()
    });
    
    // Keep only last 50 analyses
    if (analyses.length > 50) {
      analyses.splice(0, analyses.length - 50);
    }
    
    localStorage.setItem('move_analyses', JSON.stringify(analyses));
  }

  private handleServiceStatusUpdate(data: any): void {
    // Log service status updates
    socketLogger.logInfo('📡 Service status update received:', data);
    
    // Update integration logger with service status
    if (data.service && data.status !== undefined) {
      integrationLogger.logServiceConnection(data.service, data.status === 'connected', data);
    }
    
    // Track service health metrics
    if (data.metrics) {
      this.trackServiceHealth(data.service, data.metrics);
    }
  }

  private trackServiceHealth(service: string, metrics: any): void {
    const serviceHealth = JSON.parse(sessionStorage.getItem('service_health') || '{}');
    serviceHealth[service] = {
      ...metrics,
      lastUpdate: Date.now()
    };
    sessionStorage.setItem('service_health', JSON.stringify(serviceHealth));
  }

  private aiPerformanceMetrics: any[] = [];

  private trackAIPerformance(metrics: any): void {
    this.aiPerformanceMetrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // Keep only recent metrics
    if (this.aiPerformanceMetrics.length > 100) {
      this.aiPerformanceMetrics.shift();
    }
    
    // Calculate averages
    if (this.aiPerformanceMetrics.length % 10 === 0) {
      const avgResponseTime = this.aiPerformanceMetrics.reduce((sum, m) => sum + m.timeMs, 0) / this.aiPerformanceMetrics.length;
      const avgConfidence = this.aiPerformanceMetrics.reduce((sum, m) => sum + m.confidence, 0) / this.aiPerformanceMetrics.length;
      
      console.log(`📊 AI Performance - Avg Response: ${avgResponseTime.toFixed(0)}ms, Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }
  }

  // Setup manager-level error handling
  private setupManagerErrorHandling(): void {
    if (!this.manager) return;

    // Handle manager-level errors
    this.manager.on('error', (error: Error) => {
      socketLogger.logError('Manager error:', error);
      this.metrics.errorCount++;
    });

    // Handle manager reconnection events
    this.manager.on('reconnect_attempt', (attemptNumber: number) => {
      socketLogger.logInfo(`Manager reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
    });

    this.manager.on('reconnect', () => {
      socketLogger.logInfo('Manager reconnected successfully');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    });

    this.manager.on('reconnect_error', (error: Error) => {
      socketLogger.logError('Manager reconnection error:', error);
      this.metrics.errorCount++;
    });

    this.manager.on('reconnect_failed', () => {
      socketLogger.logError('Manager reconnection failed after all attempts');
      // Could trigger additional recovery logic here
    });
  }

  // Setup general event handlers with filtering and monitoring
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Event monitoring
    const eventStats: Map<string, { count: number; lastSeen: Date }> = new Map();
    const ignoredEvents = new Set(['ping', 'pong']); // Don't log these noisy events

    this.socket.onAny((eventName: string, ...args: any[]) => {
      // Update event statistics
      const stats = eventStats.get(eventName) || { count: 0, lastSeen: new Date() };
      stats.count++;
      stats.lastSeen = new Date();
      eventStats.set(eventName, stats);

      // Filter out ignored events
      if (ignoredEvents.has(eventName)) {
        return;
      }

      // Verbose logging with filtering
      if (appConfig.dev.verboseLogging) {
        // Color-code events by type
        const eventColor = this.getEventColor(eventName);
        console.log(`${eventColor} Socket event: ${eventName}`, args);
      }

      // Detect unusual event patterns
      if (stats.count > 100 && stats.count % 100 === 0) {
        socketLogger.logWarning(`⚠️ High frequency event detected: ${eventName} (${stats.count} occurrences)`);
      }

      // Track unknown events
      if (!this.isKnownEvent(eventName)) {
        socketLogger.logWarning(`🔍 Unknown event received: ${eventName}`);
        this.trackUnknownEvent(eventName, args);
      }
    });

    // Setup event monitoring report
    if (appConfig.dev.debugMode) {
      setInterval(() => {
        const report = Array.from(eventStats.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([event, stats]) => `${event}: ${stats.count}`);
        
        if (report.length > 0) {
          console.log('📊 Top 10 events:', report.join(', '));
        }
      }, 60000); // Report every minute
    }

    // Setup event interceptors for debugging
    const originalEmit = this.socket.emit.bind(this.socket);
    this.socket.emit = (event: string, ...args: any[]) => {
      if (appConfig.dev.verboseLogging && !ignoredEvents.has(event)) {
        console.log(`📤 Emitting: ${event}`, args[0]);
      }
      
      // Track outgoing events
      const stats = eventStats.get(`out:${event}`) || { count: 0, lastSeen: new Date() };
      stats.count++;
      stats.lastSeen = new Date();
      eventStats.set(`out:${event}`, stats);
      
      return originalEmit(event, ...args);
    };
  }

  private getEventColor(eventName: string): string {
    if (eventName.includes('error')) return '❌';
    if (eventName.includes('warning')) return '⚠️';
    if (eventName.includes('connect')) return '🔌';
    if (eventName.includes('disconnect')) return '🔌';
    if (eventName.includes('game')) return '🎮';
    if (eventName.includes('ai')) return '🤖';
    if (eventName.includes('player')) return '👤';
    return '📡';
  }

  private knownEvents = new Set([
    'connect', 'disconnect', 'connect_error', 'reconnect', 'reconnect_attempt',
    'reconnect_error', 'reconnect_failed', 'error', 'ping', 'pong',
    'gameCreated', 'aiThinking', 'aiMove', 'playerMove', 'gameOver',
    'gameState', 'playerJoined', 'playerLeft', 'warning', 'gameUpdate',
    'spectatorJoined', 'chatMessage', 'moveAnalysis', 'server:error',
    'validation:error', 'connection:analytics', 'sync:request', 'connection:quality',
    'serviceStatusUpdate', 'client:cleanup', 'game:analytics', 'request:event_buffer',
    'replay:events', 'memory:alert', 'serviceStatusRequested'
  ]);

  private isKnownEvent(eventName: string): boolean {
    return this.knownEvents.has(eventName) || eventName.startsWith('out:');
  }

  private unknownEvents: Map<string, number> = new Map();

  private trackUnknownEvent(eventName: string, args: any[]): void {
    this.unknownEvents.set(eventName, (this.unknownEvents.get(eventName) || 0) + 1);
    
    // Log unknown event details for debugging
    if (this.unknownEvents.get(eventName) === 1) {
      console.warn('📝 New unknown event structure:', { event: eventName, args });
    }
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

  // Server health monitoring
  private healthCheckTimer: NodeJS.Timeout | null = null;

  public startHealthCheck(): void {
    // Regular health checks to detect connection issues early
    this.healthCheckTimer = setInterval(async () => {
      if (this.manager && !this.isReconnecting) {
        const isHealthy = await this.validateConnection();
        if (!isHealthy && this.socket?.connected) {
          // One retry before warning to avoid noisy transient logs
          await new Promise(r => setTimeout(r, 1000));
          const secondTry = await this.validateConnection();
          if (!secondTry) {
            socketLogger.logWarning('Server health check failed, connection may be degraded');
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  public stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
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
    const isConnecting = !this.socket.connected && !this.socket.disconnected;
    if (this.socket.connected || isConnecting) {
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
      const timeoutMs = environmentDetector.getEnvironmentInfo().isProduction ? 12000 : 3000;
      const response = await fetch(buildApiEndpoint('/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs)
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

    const delay = Math.min(1000 * Math.pow(1.5, this.connectionAttemptCount), environmentDetector.getEnvironmentInfo().isProduction ? 20000 : 10000);
    const jitter = Math.random() * 1000;

    console.log(`⏰ Scheduling connection retry in ${Math.round((delay + jitter) / 1000)}s...`);

    this.connectionRetryTimer = setTimeout(() => {
      this.connect();
    }, delay + jitter);
  }

  public disconnect(): void {
    this.stopHeartbeat();
    this.stopHealthCheck();
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

  // Advanced health check with multiple criteria
  public isHealthy(): boolean {
    try {
      // Basic connection check
      if (!this.socket?.connected) {
        return false;
      }

      // Check if socket is in a valid state
      if (!this.socket.id || this.socket.disconnected) {
        return false;
      }

      // Check transport health
      const transport = this.socket.io?.engine?.transport;
      if (!transport || (transport as any).readyState !== 'open') {
        return false;
      }

      // Check error rate threshold (max 5% error rate)
      const totalMessages = this.metrics.messagesSent + this.metrics.messagesReceived;
      const errorRate = totalMessages > 0 ? this.metrics.errorCount / totalMessages : 0;
      if (errorRate > 0.05) {
        console.warn(`⚠️ High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
        return false;
      }

      // Check if we're stuck in reconnection loop
      if (this.isReconnecting && this.reconnectAttempts > 5) {
        return false;
      }

      // Check latency threshold (warn if > 1000ms)
      if (this.metrics.averageLatency > 1000) {
        console.warn(`⚠️ High latency detected: ${this.metrics.averageLatency}ms`);
        // Still healthy but degraded
      }

      // Check event queue health
      if (this.eventQueue.length > this.config.maxQueueSize * 0.8) {
        console.warn(`⚠️ Event queue nearly full: ${this.eventQueue.length}/${this.config.maxQueueSize}`);
        // Still healthy but under pressure
      }

      return true;
    } catch (error) {
      console.error('🚨 Error checking socket health:', error);
      return false;
    }
  }

  // Get detailed health status
  public getHealthStatus(): {
    isHealthy: boolean;
    details: {
      connected: boolean;
      transport: string;
      latency: number;
      errorRate: number;
      queueUsage: number;
      uptime: number;
      warnings: string[];
    };
  } {
    const warnings: string[] = [];
    const totalMessages = this.metrics.messagesSent + this.metrics.messagesReceived;
    const errorRate = totalMessages > 0 ? this.metrics.errorCount / totalMessages : 0;
    const queueUsage = this.config.maxQueueSize > 0 
      ? (this.eventQueue.length / this.config.maxQueueSize) * 100 
      : 0;

    // Collect warnings
    if (this.metrics.averageLatency > 500) {
      warnings.push(`High latency: ${this.metrics.averageLatency}ms`);
    }
    if (errorRate > 0.02) {
      warnings.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    if (queueUsage > 50) {
      warnings.push(`Queue usage high: ${queueUsage.toFixed(1)}%`);
    }
    if (this.reconnectAttempts > 0) {
      warnings.push(`Reconnection attempts: ${this.reconnectAttempts}`);
    }

    const status = this.getConnectionStatus();

    return {
      isHealthy: this.isHealthy(),
      details: {
        connected: this.socket?.connected || false,
        transport: this.socket?.io?.engine?.transport?.name || 'none',
        latency: this.metrics.averageLatency,
        errorRate: errorRate,
        queueUsage: queueUsage,
        uptime: status.uptime,
        warnings
      }
    };
  }

  // Get socket instance with validation
  public getSocket(): Socket | null {
    if (!this.socket) {
      console.warn('🚨 Socket instance not available - not initialized');
      return null;
    }

    if (!this.socket.connected) {
      console.warn('⚠️ Socket instance available but not connected');
    }

    return this.socket;
  }

  // Safe socket access with auto-initialization
  public async getSocketSafe(): Promise<Socket> {
    if (!this.socket) {
      console.log('🔄 Socket not initialized, initializing now...');
      this.initialize();
      
      // Wait for connection with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket initialization timeout'));
        }, 10000);

        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            clearTimeout(timeout);
            resolve(this.socket);
          }
        }, 100);
      });
    }

    if (!this.socket.connected) {
      console.log('🔄 Socket not connected, attempting connection...');
      await this.connect();
    }

    return this.socket;
  }

  // Get socket state information
  public getSocketState(): {
    initialized: boolean;
    connected: boolean;
    connecting: boolean;
    disconnected: boolean;
    transport: string | null;
    bufferedAmount: number;
    auth: any;
  } {
    return {
      initialized: !!this.socket,
      connected: this.socket?.connected || false,
      connecting: (this.socket && !this.socket.connected && !this.socket.disconnected) || false,
      disconnected: this.socket?.disconnected || false,
      transport: this.socket?.io?.engine?.transport?.name || null,
      bufferedAmount: this.socket?.sendBuffer?.length || 0,
      auth: this.socket?.auth || null
    };
  }

  // Advanced cleanup with graceful shutdown
  public async destroy(options: { 
    force?: boolean; 
    timeout?: number; 
    reason?: string;
  } = {}): Promise<void> {
    const { force = false, timeout = 5000, reason = 'manual' } = options;

    console.log(`🧹 Starting socket cleanup (reason: ${reason}, force: ${force})`);

    try {
      // Stop all timers first
      this.stopHeartbeat();
      this.stopHealthCheck();

      if (this.connectionRetryTimer) {
        clearTimeout(this.connectionRetryTimer);
        this.connectionRetryTimer = null;
      }

      // If not forcing, try graceful shutdown
      if (!force && this.socket?.connected) {
        console.log('📤 Sending cleanup notification to server...');
        
        // Notify server about cleanup
        const cleanupPromise = new Promise<void>((resolve) => {
          const timer = setTimeout(() => resolve(), timeout);
          
          this.socket!.emit('client:cleanup', { reason }, () => {
            clearTimeout(timer);
            resolve();
          });
        });

        await cleanupPromise;
      }

      // Clear event listeners before disconnecting
      console.log('🔌 Removing all event listeners...');
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.offAny();
      }

      // Clear internal event tracking
      this.eventListeners.clear();
      this.statusCallbacks.clear();

      // Process remaining queued events if not forcing
      if (!force && this.eventQueue.length > 0) {
        console.log(`⚠️ ${this.eventQueue.length} events in queue - ${force ? 'discarding' : 'processing'}...`);
        
        if (!force) {
          // Try to send critical events
          const criticalEvents = this.eventQueue.filter(e => 
            e.event === 'gameOver' || e.event === 'playerMove'
          );
          
          for (const event of criticalEvents) {
            try {
              await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 1000);
                this.socket!.emit(event.event, event.data, () => {
                  clearTimeout(timer);
                  resolve();
                });
              });
            } catch (error) {
              console.error('Failed to send critical event:', error);
            }
          }
        }
      }

      // Clear event queue
      this.eventQueue = [];

      // Disconnect socket
      if (this.socket) {
        const isConnecting = !this.socket.connected && !this.socket.disconnected;
        if (this.socket.connected || isConnecting) {
          console.log('🔌 Disconnecting socket...');
          this.socket.disconnect();
        }
        this.socket = null;
      }

      // Close manager and all its sockets
      if (this.manager) {
        console.log('🏢 Closing socket manager...');
        (this.manager as any)._close();
        this.manager = null;
      }

      // Reset state
      this.connectionStartTime = null;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connectionAttemptCount = 0;

      // Reset metrics
      this.metrics = {
        messagesSent: 0,
        messagesReceived: 0,
        averageLatency: 0,
        connectionUptime: 0,
        reconnectionCount: 0,
        errorCount: 0,
      };

      // Final status notification
      this.notifyStatusChange();

      console.log('✅ Socket cleanup completed successfully');

      // Log final state
      if (appConfig.dev.debugMode) {
        console.log('📊 Final cleanup state:', {
          socket: this.socket ? 'exists' : 'null',
          manager: this.manager ? 'exists' : 'null',
          eventQueue: this.eventQueue.length,
          listeners: this.eventListeners.size,
          callbacks: this.statusCallbacks.size
        });
      }
    } catch (error) {
      console.error('🚨 Error during socket cleanup:', error);
      
      // Force cleanup on error
      if (!force) {
        console.log('⚠️ Retrying with force cleanup...');
        await this.destroy({ force: true, reason: 'cleanup-error' });
      }
    }
  }

  // Restart connection with fresh state
  public async restart(options: { reason?: string } = {}): Promise<Socket> {
    console.log(`🔄 Restarting socket connection (reason: ${options.reason || 'manual'})...`);
    
    // Destroy existing connection
    await this.destroy({ reason: options.reason || 'restart' });
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize
    this.initialize();
    
    // Connect and wait
    await this.connect();
    
    if (!this.socket) {
      throw new Error('Failed to restart socket connection');
    }
    
    return this.socket;
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

// Initialize the socket (now async)
let socket: Socket | null = null; // Initialize socket as null
let socketInitPromise: Promise<Socket>; // Initialize promise as null

// Create initialization promise
socketInitPromise = socketManager.initialize().then(s => {
  socket = s;
  socketLogger.logInfo('Socket initialized successfully');
  return s;
}).catch(error => {
  socketLogger.logError('Failed to initialize socket:', error); 
  throw error;
});

// Helper to get socket when ready
export const getInitializedSocket = async (): Promise<Socket> => {
  if (socket) return socket;
  return socketInitPromise;
};

// Export enhanced functions
export const getConnectionStatus = (): ConnectionStatus => socketManager.getConnectionStatus();
export const getMetrics = (): PerformanceMetrics => socketManager.getMetrics();
export const forceReconnect = (): void => socketManager.forceReconnect();
export const isHealthy = (): boolean => socketManager.isHealthy();
export const getHealthStatus = () => socketManager.getHealthStatus();
export const onStatusChange = (callback: (status: ConnectionStatus) => void): void => socketManager.onStatusChange(callback);
export const offStatusChange = (callback: (status: ConnectionStatus) => void): void => socketManager.offStatusChange(callback);
export const emit = (event: string, data: any, callback?: Function): void => socketManager.emit(event, data, callback);
export const on = (event: string, callback: Function): void => socketManager.on(event, callback);
export const off = (event: string, callback: Function): void => socketManager.off(event, callback);
export const destroy = (options?: { force?: boolean; timeout?: number; reason?: string; }): Promise<void> => socketManager.destroy(options);
export const getSocket = (): Socket | null => socketManager.getSocket();
export const getSocketSafe = (): Promise<Socket> => socketManager.getSocketSafe();
export const getSocketState = () => socketManager.getSocketState();
export const restart = (options?: { reason?: string }): Promise<Socket> => socketManager.restart(options);
export const connect = (): Promise<void> => socketManager.connect();
export const disconnect = (): void => socketManager.disconnect();

// Create a proxy object that handles async initialization for backward compatibility
const socketProxy = new Proxy({} as Socket, {
  get(target, prop) {
    if (!socket) {
      // Return a function that queues the operation for methods
      if (prop === 'on' || prop === 'off' || prop === 'emit' || prop === 'once') {
        return (...args: any[]) => {
          socketInitPromise.then(s => {
            (s as any)[prop](...args);
          }).catch(error => {
            console.error(`Failed to execute ${String(prop)} on socket:`, error);
          });
        };
      }
      
      // For property access like 'id', 'connected', etc., return appropriate defaults
      if (prop === 'id') return null;
      if (prop === 'connected') return false;
      if (prop === 'disconnected') return true;
      
      // React internal properties - return null without warning
      const reactInternals = ['$$typeof', '_owner', '_store', 'key', 'ref', 'type', 'props', '_self', '_source'];
      if (reactInternals.includes(String(prop))) {
        return null;
      }
      
      // Symbol properties - likely React internals or Node.js internals
      if (typeof prop === 'symbol') {
        return null;
      }
      
      // Common object methods and properties - return safe defaults
      const safeProperties = [
        'valueOf', 'toString', 'constructor', 'hasOwnProperty', 
        'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
        '__proto__', '__defineGetter__', '__defineSetter__',
        '__lookupGetter__', '__lookupSetter__'
      ];
      
      if (safeProperties.includes(String(prop))) {
        return undefined;
      }
      
      // Only log warnings in development mode for unknown properties
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Socket proxy: Property '${String(prop)}' accessed before initialization`);
      }
      return undefined;
    }
    return (socket as any)[prop];
  },
  has(target, prop) {
    return socket ? prop in socket : false;
  }
});

// Export the socket proxy for backward compatibility
export default socketProxy;
