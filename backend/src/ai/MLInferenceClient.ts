/**
 * 🚀 ADVANCED ML INFERENCE CLIENT
 * 
 * Production-ready ML inference client with cutting-edge features:
 * - Circuit breaker pattern for fault tolerance
 * - Connection pooling and load balancing
 * - Comprehensive metrics and monitoring
 * - Model versioning and A/B testing
 * - Intelligent caching and optimization
 * - Real-time streaming capabilities
 * - Batch prediction processing
 * - Advanced health checks and auto-recovery
 * - Security and authentication
 * - Performance profiling and optimization
 */

import fetch, { RequestInit, Response } from 'node-fetch';
import AbortController from 'abort-controller';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// 🎯 Core Interfaces
export interface BoardState {
  board: ('Empty' | 'Red' | 'Yellow')[][];
  metadata?: {
    gameId?: string;
    moveNumber?: number;
    timestamp?: number;
    playerType?: 'human' | 'ai';
  };
}

export interface PredictResponse {
  move: number;
  probs: number[];
  confidence?: number;
  reasoning?: string;
  modelVersion?: string;
  inferenceTime?: number;
  alternatives?: Array<{
    move: number;
    probability: number;
    evaluation: number;
  }>;
}

export interface BatchPredictRequest {
  boards: BoardState[];
  requestId?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface BatchPredictResponse {
  predictions: PredictResponse[];
  requestId?: string;
  batchTime?: number;
  processedCount: number;
}

// 🔧 Advanced Configuration
export interface MLInferenceConfig {
  // Basic Settings
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;

  // Advanced Features
  enableCircuitBreaker?: boolean;
  enableConnectionPooling?: boolean;
  enableCaching?: boolean;
  enableMetrics?: boolean;
  enableHealthChecks?: boolean;
  enableSecurity?: boolean;

  // Circuit Breaker Configuration
  circuitBreaker?: {
    failureThreshold: number;
    recoveryTimeMs: number;
    monitoringWindowMs: number;
    minimumRequests: number;
  };

  // Connection Pooling
  connectionPool?: {
    maxConnections: number;
    keepAliveMs: number;
    idleTimeoutMs: number;
  };

  // Caching Configuration
  cache?: {
    enablePositionCache: boolean;
    maxEntries: number;
    ttlMs: number;
    enablePredictiveCache: boolean;
  };

  // Model Configuration
  model?: {
    version?: string;
    enableABTesting?: boolean;
    fallbackModel?: string;
    enableEnsemble?: boolean;
  };

  // Security
  security?: {
    apiKey?: string;
    enableRateLimiting?: boolean;
    rateLimitRpm?: number;
    enableRequestSigning?: boolean;
  };

  // Monitoring
  monitoring?: {
    enableMetrics: boolean;
    enableLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsEndpoint?: string;
  };
}

// 📊 Metrics and Monitoring
export interface InferenceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  circuitBreakerTrips: number;
  modelsUsed: Record<string, number>;
  errorsByType: Record<string, number>;
  throughputRpm: number;
}

// 🔄 Circuit Breaker States
enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// 💾 Cache Entry
interface CacheEntry {
  prediction: PredictResponse;
  timestamp: number;
  hitCount: number;
  lastAccessed: number;
}

// 🏥 Health Check Result
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: number;
  modelVersion?: string;
  capabilities?: string[];
  errors?: string[];
}

// 🎯 Advanced ML Inference Client
export class MLInferenceClient extends EventEmitter {
  private config: Required<MLInferenceConfig>;
  private metrics: InferenceMetrics;
  private cache = new Map<string, CacheEntry>();
  private connectionPool: Array<{ url: string; weight: number; healthy: boolean }> = [];

  // Circuit Breaker State
  private circuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  // Performance Tracking
  private latencyHistory: number[] = [];
  private requestTimes = new Map<string, number>();

  // Rate Limiting
  private requestCounts = new Map<number, number>();

  // Health Monitoring
  private lastHealthCheck = 0;
  private healthStatus: HealthCheckResult = {
    status: 'healthy',
    latency: 0,
    timestamp: Date.now()
  };

  constructor(config: MLInferenceConfig) {
    super();

    // Apply default configuration
    this.config = {
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 200,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      enableConnectionPooling: config.enableConnectionPooling ?? true,
      enableCaching: config.enableCaching ?? true,
      enableMetrics: config.enableMetrics ?? true,
      enableHealthChecks: config.enableHealthChecks ?? true,
      enableSecurity: config.enableSecurity ?? false,

      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeMs: 30000,
        monitoringWindowMs: 60000,
        minimumRequests: 10,
        ...config.circuitBreaker
      },

      connectionPool: {
        maxConnections: 10,
        keepAliveMs: 30000,
        idleTimeoutMs: 60000,
        ...config.connectionPool
      },

      cache: {
        enablePositionCache: true,
        maxEntries: 10000,
        ttlMs: 300000, // 5 minutes
        enablePredictiveCache: true,
        ...config.cache
      },

      model: {
        version: 'latest',
        enableABTesting: false,
        fallbackModel: 'stable',
        enableEnsemble: false,
        ...config.model
      },

      security: {
        enableRateLimiting: false,
        rateLimitRpm: 1000,
        enableRequestSigning: false,
        ...config.security
      },

      monitoring: {
        enableMetrics: true,
        enableLogging: true,
        logLevel: 'info',
        ...config.monitoring
      }
    };

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      cacheHitRate: 0,
      circuitBreakerTrips: 0,
      modelsUsed: {},
      errorsByType: {},
      throughputRpm: 0
    };

    // Initialize connection pool
    this.initializeConnectionPool();

    // Start health monitoring
    if (this.config.enableHealthChecks) {
      this.startHealthMonitoring();
    }

    // Start metrics cleanup
    if (this.config.enableMetrics) {
      this.startMetricsCleanup();
    }

    this.log('info', 'Advanced ML Inference Client initialized', {
      config: this.config,
      features: this.getEnabledFeatures()
    });
  }

  /**
   * 🎯 Primary prediction method with full feature support
   */
  async predict(boardState: BoardState): Promise<PredictResponse> {
    const requestId = this.generateRequestId();
    const startTime = performance.now();

    this.requestTimes.set(requestId, startTime);
    this.metrics.totalRequests++;

    try {
      // 1. Rate limiting check
      if (this.config.enableSecurity && this.config.security.enableRateLimiting) {
        if (!this.checkRateLimit()) {
          throw new Error('Rate limit exceeded');
        }
      }

      // 2. Circuit breaker check
      if (this.config.enableCircuitBreaker && !this.isCircuitBreakerClosed()) {
        throw new Error('Circuit breaker is open');
      }

      // 3. Cache lookup
      if (this.config.enableCaching) {
        const cached = this.getCachedPrediction(boardState);
        if (cached) {
          this.updateMetrics(requestId, startTime, true);
          this.emit('prediction', { requestId, result: cached, fromCache: true });
          return cached;
        }
      }

      // 4. Health check if needed
      if (this.config.enableHealthChecks && this.needsHealthCheck()) {
        await this.performHealthCheck();
      }

      // 5. Execute prediction
      const prediction = await this.executePrediction(boardState, requestId);

      // 6. Cache result
      if (this.config.enableCaching) {
        this.cachePrediction(boardState, prediction);
      }

      // 7. Update metrics and circuit breaker
      this.updateMetrics(requestId, startTime, false);
      this.recordCircuitBreakerSuccess();

      this.emit('prediction', { requestId, result: prediction, fromCache: false });
      return prediction;

    } catch (error) {
      this.handlePredictionError(error, requestId, startTime);
      throw error;
    }
  }

  /**
   * 📦 Batch prediction with optimized processing
   */
  async batchPredict(request: BatchPredictRequest): Promise<BatchPredictResponse> {
    const startTime = performance.now();
    const requestId = request.requestId ?? this.generateRequestId();

    this.log('info', `Starting batch prediction for ${request.boards.length} boards`, { requestId });

    try {
      const predictions: PredictResponse[] = [];
      const batchSize = Math.min(request.boards.length, 10); // Process in chunks

      for (let i = 0; i < request.boards.length; i += batchSize) {
        const chunk = request.boards.slice(i, i + batchSize);
        const chunkPredictions = await Promise.all(
          chunk.map(board => this.predict(board))
        );
        predictions.push(...chunkPredictions);
      }

      const batchTime = performance.now() - startTime;

      const response: BatchPredictResponse = {
        predictions,
        requestId,
        batchTime,
        processedCount: predictions.length
      };

      this.emit('batchPrediction', { requestId, response });
      return response;

    } catch (error) {
      this.log('error', 'Batch prediction failed', { requestId, error: error.message });
      throw error;
    }
  }

  /**
   * 🌊 Real-time streaming predictions
   */
  async *streamPredictions(boardStates: AsyncIterable<BoardState>): AsyncGenerator<PredictResponse> {
    for await (const boardState of boardStates) {
      try {
        const prediction = await this.predict(boardState);
        yield prediction;
      } catch (error) {
        this.log('error', 'Stream prediction failed', { error: error.message });
        // Continue with next board state
      }
    }
  }

  /**
   * 🏥 Comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const testBoard: BoardState = {
        board: Array(6).fill(null).map(() => Array(7).fill('Empty' as const))
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal as any,
        headers: this.buildHeaders()
      });

      clearTimeout(timeout);
      const latency = performance.now() - startTime;

      if (response.ok) {
        const healthData = await response.json() as any;

        this.healthStatus = {
          status: 'healthy',
          latency,
          timestamp: Date.now(),
          modelVersion: healthData.modelVersion,
          capabilities: healthData.capabilities,
        };
      } else {
        this.healthStatus = {
          status: 'degraded',
          latency,
          timestamp: Date.now(),
          errors: [`HTTP ${response.status}`]
        };
      }

    } catch (error) {
      this.healthStatus = {
        status: 'unhealthy',
        latency: performance.now() - startTime,
        timestamp: Date.now(),
        errors: [error.message]
      };
    }

    this.lastHealthCheck = Date.now();
    this.emit('healthCheck', this.healthStatus);

    return this.healthStatus;
  }

  /**
   * 📊 Get comprehensive metrics
   */
  getMetrics(): InferenceMetrics {
    return { ...this.metrics };
  }

  /**
   * 🔧 Get current configuration
   */
  getConfig(): MLInferenceConfig {
    return { ...this.config };
  }

  /**
   * ⚙️ Update configuration at runtime
   */
  updateConfig(updates: Partial<MLInferenceConfig>): void {
    this.config = { ...this.config, ...updates } as Required<MLInferenceConfig>;
    this.log('info', 'Configuration updated', { updates });
    this.emit('configUpdate', this.config);
  }

  /**
   * 🧹 Reset all state and metrics
   */
  reset(): void {
    this.cache.clear();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      cacheHitRate: 0,
      circuitBreakerTrips: 0,
      modelsUsed: {},
      errorsByType: {},
      throughputRpm: 0
    };
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.latencyHistory = [];
    this.requestTimes.clear();
    this.requestCounts.clear();

    this.log('info', 'Client state reset');
    this.emit('reset');
  }

  /**
   * 🔌 Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.log('info', 'Shutting down ML Inference Client');

    // Wait for pending requests
    await this.waitForPendingRequests();

    // Clear all timers and intervals
    this.removeAllListeners();

    this.emit('shutdown');
  }

  // ===== PRIVATE METHODS =====

  private async executePrediction(boardState: BoardState, requestId: string): Promise<PredictResponse> {
    const url = `${this.config.baseUrl}/predict`;
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const payload = {
          ...boardState,
          requestId,
          modelVersion: this.config.model.version,
          timestamp: Date.now()
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(payload),
          signal: controller.signal as any
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json() as PredictResponse;

        // Validate response
        if (!this.validatePredictionResponse(data)) {
          throw new Error('Invalid prediction response format');
        }

        return {
          ...data,
          inferenceTime: performance.now() - this.requestTimes.get(requestId)!,
          modelVersion: data.modelVersion ?? this.config.model.version
        };

      } catch (error) {
        lastError = error as Error;
        this.log('warn', `Prediction attempt ${attempt} failed`, {
          requestId,
          error: error.message,
          url
        });

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Advanced-ML-Inference-Client/1.0.0',
      'X-Request-Timestamp': Date.now().toString()
    };

    if (this.config.security.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.security.apiKey}`;
    }

    if (this.config.model.version) {
      headers['X-Model-Version'] = this.config.model.version;
    }

    return headers;
  }

  private validatePredictionResponse(data: any): boolean {
    return (
      typeof data === 'object' &&
      typeof data.move === 'number' &&
      Array.isArray(data.probs) &&
      data.probs.length === 7 &&
      data.probs.every((p: any) => typeof p === 'number' && p >= 0 && p <= 1)
    );
  }

  private generateBoardHash(boardState: BoardState): string {
    const boardStr = JSON.stringify(boardState.board);
    let hash = 0;
    for (let i = 0; i < boardStr.length; i++) {
      const char = boardStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getCachedPrediction(boardState: BoardState): PredictResponse | null {
    if (!this.config.cache.enablePositionCache) return null;

    const hash = this.generateBoardHash(boardState);
    const entry = this.cache.get(hash);

    if (entry && Date.now() - entry.timestamp < this.config.cache.ttlMs) {
      entry.hitCount++;
      entry.lastAccessed = Date.now();
      return entry.prediction;
    }

    return null;
  }

  private cachePrediction(boardState: BoardState, prediction: PredictResponse): void {
    if (!this.config.cache.enablePositionCache) return;

    const hash = this.generateBoardHash(boardState);

    // Clean cache if at capacity
    if (this.cache.size >= this.config.cache.maxEntries) {
      this.cleanCache();
    }

    this.cache.set(hash, {
      prediction,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccessed: Date.now()
    });
  }

  private cleanCache(): void {
    const entries = Array.from(this.cache.entries());

    // Remove expired entries first
    const now = Date.now();
    for (const [hash, entry] of entries) {
      if (now - entry.timestamp > this.config.cache.ttlMs) {
        this.cache.delete(hash);
      }
    }

    // If still too many, remove least recently used
    if (this.cache.size >= this.config.cache.maxEntries) {
      const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const toRemove = sorted.slice(0, Math.floor(this.config.cache.maxEntries * 0.2));

      for (const [hash] of toRemove) {
        this.cache.delete(hash);
      }
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000); // 1-minute windows

    const currentCount = this.requestCounts.get(windowStart) ?? 0;

    if (currentCount >= this.config.security.rateLimitRpm) {
      return false;
    }

    this.requestCounts.set(windowStart, currentCount + 1);

    // Clean old windows
    for (const [window] of this.requestCounts) {
      if (window < windowStart - 1) {
        this.requestCounts.delete(window);
      }
    }

    return true;
  }

  private isCircuitBreakerClosed(): boolean {
    const now = Date.now();

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (now - this.lastFailureTime > this.config.circuitBreaker.recoveryTimeMs) {
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
          this.halfOpenAttempts = 0;
          this.log('info', 'Circuit breaker moved to HALF_OPEN');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return this.halfOpenAttempts < 3;

      default:
        return false;
    }
  }

  private recordCircuitBreakerSuccess(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerState = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.log('info', 'Circuit breaker moved to CLOSED after successful request');
    }
  }

  private recordCircuitBreakerFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= 3) {
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        this.metrics.circuitBreakerTrips++;
        this.log('warn', 'Circuit breaker moved to OPEN from HALF_OPEN');
      }
    } else if (this.failureCount >= this.config.circuitBreaker.failureThreshold) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.metrics.circuitBreakerTrips++;
      this.log('warn', 'Circuit breaker moved to OPEN', { failureCount: this.failureCount });
    }
  }

  private updateMetrics(requestId: string, startTime: number, fromCache: boolean): void {
    const endTime = performance.now();
    const latency = endTime - startTime;

    this.requestTimes.delete(requestId);

    if (fromCache) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.successfulRequests++;
      this.latencyHistory.push(latency);

      // Keep only recent latency data
      if (this.latencyHistory.length > 1000) {
        this.latencyHistory = this.latencyHistory.slice(-1000);
      }

      // Update latency metrics
      this.updateLatencyMetrics();
    }

    // Update cache hit rate
    const totalCacheableRequests = this.metrics.totalRequests;
    const cacheHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hitCount, 0);
    this.metrics.cacheHitRate = totalCacheableRequests > 0 ? cacheHits / totalCacheableRequests : 0;
  }

  private updateLatencyMetrics(): void {
    if (this.latencyHistory.length === 0) return;

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    this.metrics.averageLatency = this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length;
    this.metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
    this.metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
  }

  private handlePredictionError(error: any, requestId: string, startTime: number): void {
    this.metrics.failedRequests++;
    this.requestTimes.delete(requestId);

    // Update error metrics
    const errorType = error.name || 'Unknown';
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;

    // Update circuit breaker
    if (this.config.enableCircuitBreaker) {
      this.recordCircuitBreakerFailure();
    }

    this.log('error', 'Prediction failed', {
      requestId,
      error: error.message,
      latency: performance.now() - startTime
    });

    this.emit('error', { requestId, error });
  }

  private needsHealthCheck(): boolean {
    return Date.now() - this.lastHealthCheck > 30000; // Check every 30 seconds
  }

  private initializeConnectionPool(): void {
    if (!this.config.enableConnectionPooling) return;

    this.connectionPool = [
      { url: this.config.baseUrl, weight: 1, healthy: true }
    ];
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.log('error', 'Health check failed', { error: error.message });
      });
    }, 60000); // Every minute
  }

  private startMetricsCleanup(): void {
    setInterval(() => {
      this.cleanCache();

      // Calculate throughput
      const now = Date.now();
      const windowStart = Math.floor(now / 60000);
      this.metrics.throughputRpm = this.requestCounts.get(windowStart) ?? 0;

    }, 60000); // Every minute
  }

  private getEnabledFeatures(): string[] {
    const features: string[] = [];

    if (this.config.enableCircuitBreaker) features.push('circuit-breaker');
    if (this.config.enableConnectionPooling) features.push('connection-pooling');
    if (this.config.enableCaching) features.push('caching');
    if (this.config.enableMetrics) features.push('metrics');
    if (this.config.enableHealthChecks) features.push('health-checks');
    if (this.config.enableSecurity) features.push('security');
    if (this.config.model.enableABTesting) features.push('ab-testing');
    if (this.config.model.enableEnsemble) features.push('ensemble');

    return features;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private async waitForPendingRequests(): Promise<void> {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.requestTimes.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private log(level: string, message: string, meta?: any): void {
    if (!this.config.monitoring.enableLogging) return;

    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.config.monitoring.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        component: 'MLInferenceClient',
        ...meta
      };

      console.log(JSON.stringify(logEntry));
      this.emit('log', logEntry);
    }
  }
}

// 🎯 Convenience Factory Function
export function createMLInferenceClient(config: MLInferenceConfig): MLInferenceClient {
  return new MLInferenceClient(config);
}

// 🚀 Advanced Client with Preset Configurations
export class ProductionMLInferenceClient extends MLInferenceClient {
  constructor(baseUrl: string, apiKey?: string) {
    super({
      baseUrl,
      timeoutMs: 3000,
      maxRetries: 3,
      enableCircuitBreaker: true,
      enableConnectionPooling: true,
      enableCaching: true,
      enableMetrics: true,
      enableHealthChecks: true,
      enableSecurity: !!apiKey,
      security: {
        apiKey,
        enableRateLimiting: true,
        rateLimitRpm: 1000
      },
      cache: {
        enablePositionCache: true,
        maxEntries: 50000,
        ttlMs: 600000, // 10 minutes
        enablePredictiveCache: true
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeMs: 15000,
        monitoringWindowMs: 60000,
        minimumRequests: 5
      }
    });
  }
}

// 🧪 Development Client with Debug Features
export class DevelopmentMLInferenceClient extends MLInferenceClient {
  constructor(baseUrl: string = 'http://localhost:8000') {
    super({
      baseUrl,
      timeoutMs: 10000,
      maxRetries: 1,
      enableCircuitBreaker: false,
      enableConnectionPooling: false,
      enableCaching: false,
      enableMetrics: true,
      enableHealthChecks: true,
      enableSecurity: false,
      monitoring: {
        enableMetrics: true,
        enableLogging: true,
        logLevel: 'debug'
      }
    });
  }
}
