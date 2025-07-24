// frontend/src/api/socketLogger.ts
interface LogConfig {
  suppressInitialErrors: boolean;
  errorWindowMs: number;
  maxSuppressedErrors: number;
}

class SocketLogger {
  private config: LogConfig;
  private suppressedErrors: Map<string, number> = new Map();
  private errorTimestamps: Date[] = [];
  private isInitialConnection: boolean = true;
  private connectionSuccessful: boolean = false;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      suppressInitialErrors: true,
      errorWindowMs: 5000,
      maxSuppressedErrors: 3,
      ...config
    };
  }

  public logError(message: string, error?: any): void {
    const now = new Date();
    
    // Clean old timestamps
    this.errorTimestamps = this.errorTimestamps.filter(
      ts => now.getTime() - ts.getTime() < this.config.errorWindowMs
    );

    // Check if we should suppress this error
    if (this.shouldSuppressError(message)) {
      this.suppressedErrors.set(message, (this.suppressedErrors.get(message) || 0) + 1);
      return;
    }

    // Log the error
    if (error) {
      console.error(`🚨 ${message}:`, error);
    } else {
      console.error(`🚨 ${message}`);
    }

    this.errorTimestamps.push(now);
  }

  public logWarning(message: string, details?: any): void {
    if (this.isInitialConnection && this.config.suppressInitialErrors) {
      return;
    }

    if (details) {
      console.warn(`⚠️ ${message}:`, details);
    } else {
      console.warn(`⚠️ ${message}`);
    }
  }

  public logInfo(message: string, details?: any): void {
    if (details) {
      console.log(`ℹ️ ${message}:`, details);
    } else {
      console.log(`ℹ️ ${message}`);
    }
  }

  public logSuccess(message: string, details?: any): void {
    this.connectionSuccessful = true;
    this.isInitialConnection = false;
    
    if (details) {
      console.log(`✅ ${message}:`, details);
    } else {
      console.log(`✅ ${message}`);
    }

    // Log suppressed errors summary if any
    if (this.suppressedErrors.size > 0) {
      console.log('📊 Suppressed initial connection errors:', 
        Array.from(this.suppressedErrors.entries())
          .map(([msg, count]) => `${msg} (${count}x)`)
          .join(', ')
      );
      this.suppressedErrors.clear();
    }
  }

  private shouldSuppressError(message: string): boolean {
    // Suppress initial connection errors
    if (this.isInitialConnection && this.config.suppressInitialErrors) {
      const suppressPatterns = [
        'websocket error',
        'WebSocket connection to',
        'Transport error',
        'connection error'
      ];
      
      return suppressPatterns.some(pattern => message.includes(pattern));
    }

    // Suppress repeated errors
    const errorCount = this.suppressedErrors.get(message) || 0;
    return errorCount < this.config.maxSuppressedErrors;
  }

  public markConnectionComplete(): void {
    this.isInitialConnection = false;
  }

  public reset(): void {
    this.suppressedErrors.clear();
    this.errorTimestamps = [];
    this.isInitialConnection = true;
    this.connectionSuccessful = false;
  }
}

export const socketLogger = new SocketLogger();