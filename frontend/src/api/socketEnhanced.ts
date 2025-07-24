// frontend/src/api/socketEnhanced.ts
import { Manager } from 'socket.io-client';
import { appConfig } from '../config/environment';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  factor: number;
}

interface ConnectionState {
  isConnecting: boolean;
  retryCount: number;
  lastError: Error | null;
  connectionAttempts: number;
}

class EnhancedSocketConnection {
  private manager: Manager | null = null;
  private retryConfig: RetryConfig;
  private connectionState: ConnectionState;
  private retryTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.retryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      factor: 1.5
    };

    this.connectionState = {
      isConnecting: false,
      retryCount: 0,
      lastError: null,
      connectionAttempts: 0
    };
  }

  private getRetryDelay(): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.factor, this.connectionState.retryCount),
      this.retryConfig.maxDelay
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  private async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Health check failed:', error);
      return false;
    }
  }

  public async createManager(): Promise<Manager> {
    if (this.manager) {
      return this.manager;
    }

    // Validate server availability before attempting connection
    const isServerAvailable = await this.validateConnection();
    if (!isServerAvailable) {
      console.warn('⚠️ Server not available, will retry connection...');
    }

    const { api } = appConfig;
    
    this.manager = new Manager(api.baseUrl, {
      transports: ['polling', 'websocket'], // Start with polling for reliability
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.retryConfig.maxRetries,
      reconnectionDelay: this.retryConfig.baseDelay,
      reconnectionDelayMax: this.retryConfig.maxDelay,
      randomizationFactor: 0.5,
      timeout: 20000,
      forceNew: false,
      upgrade: true, // Upgrade from polling to websocket when possible
      rememberUpgrade: true,
      
      // Engine.IO options for better connection handling
      engineOptions: {
        requestTimeout: 5000,
        transportOptions: {
          polling: {
            extraHeaders: {
              'X-Client-Version': '1.0.0'
            }
          }
        }
      }
    });

    // Setup connection error handling
    this.setupErrorHandling();
    
    return this.manager;
  }

  private setupErrorHandling(): void {
    if (!this.manager) return;

    // Handle manager-level errors
    this.manager.on('error', (error: Error) => {
      console.error('🚨 Manager error:', error);
      this.connectionState.lastError = error;
    });

    // Handle reconnection events
    this.manager.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 Manager reconnection attempt ${attemptNumber}`);
      this.connectionState.retryCount = attemptNumber;
    });

    this.manager.on('reconnect', () => {
      console.log('✅ Manager reconnected successfully');
      this.connectionState.retryCount = 0;
      this.connectionState.isConnecting = false;
    });

    this.manager.on('reconnect_error', (error: Error) => {
      console.error('🚨 Manager reconnection error:', error);
      this.connectionState.lastError = error;
    });

    this.manager.on('reconnect_failed', () => {
      console.error('💥 Manager reconnection failed');
      this.scheduleRetry();
    });
  }

  private scheduleRetry(): void {
    if (this.connectionState.retryCount >= this.retryConfig.maxRetries) {
      console.error('❌ Max retry attempts reached');
      return;
    }

    const delay = this.getRetryDelay();
    console.log(`⏰ Scheduling retry in ${Math.round(delay / 1000)}s...`);

    this.retryTimer = setTimeout(() => {
      this.connectionState.retryCount++;
      this.attemptReconnection();
    }, delay);
  }

  private async attemptReconnection(): Promise<void> {
    if (!this.manager) return;

    console.log(`🔄 Attempting reconnection (${this.connectionState.retryCount}/${this.retryConfig.maxRetries})...`);
    
    // Check if server is available
    const isAvailable = await this.validateConnection();
    if (!isAvailable) {
      this.scheduleRetry();
      return;
    }

    // Attempt to reconnect all sockets
    this.manager.reconnect();
  }

  public startHealthCheck(): void {
    // Regular health checks to detect connection issues early
    this.healthCheckTimer = setInterval(async () => {
      if (this.manager && !this.connectionState.isConnecting) {
        const isHealthy = await this.validateConnection();
        if (!isHealthy && this.manager.sockets.size > 0) {
          console.warn('⚠️ Server health check failed, preparing for reconnection...');
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

  public cleanup(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    
    this.stopHealthCheck();
    
    if (this.manager) {
      this.manager.close();
      this.manager = null;
    }
  }

  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }
}

// Export singleton instance
export const enhancedConnection = new EnhancedSocketConnection();

// Socket initialization wrapper
export async function initializeSocketWithRetry(): Promise<Manager> {
  try {
    const manager = await enhancedConnection.createManager();
    enhancedConnection.startHealthCheck();
    return manager;
  } catch (error) {
    console.error('🚨 Failed to initialize socket manager:', error);
    throw error;
  }
}

// Export helper functions
export const getConnectionState = () => enhancedConnection.getConnectionState();
export const cleanup = () => enhancedConnection.cleanup();