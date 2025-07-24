// backend/src/ai/async/circuit-breaker.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  halfOpenRequests?: number;
  excludeErrors?: (error: any) => boolean;
  fallback?: (...args: any[]) => Promise<any>;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorRate: number;
  avgResponseTime: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  retryIf?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly circuits = new Map<string, CircuitBreakerInstance>();
  
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Wrap a function with circuit breaker protection
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string,
    options: CircuitBreakerOptions = {}
  ): T {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreakerInstance(
        name,
        options,
        this.eventEmitter,
        this.logger
      ));
    }

    const circuit = this.circuits.get(name)!;

    return (async (...args: any[]) => {
      return circuit.execute(() => fn(...args));
    }) as T;
  }

  /**
   * Wrap with circuit breaker and retry logic
   */
  wrapWithRetry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string,
    circuitOptions: CircuitBreakerOptions = {},
    retryOptions: RetryOptions = {}
  ): T {
    const circuitProtected = this.wrap(fn, name, circuitOptions);
    
    return (async (...args: any[]) => {
      return this.executeWithRetry(
        () => circuitProtected(...args),
        retryOptions
      );
    }) as T;
  }

  /**
   * Execute a function with exponential backoff retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 100,
      maxDelay = 10000,
      factor = 2,
      jitter = true,
      retryIf = () => true,
      onRetry
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === maxAttempts || !retryIf(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        if (attempt > 1) {
          delay = Math.min(delay * factor, maxDelay);
        }

        // Add jitter to prevent thundering herd
        const actualDelay = jitter 
          ? delay * (0.5 + Math.random() * 0.5)
          : delay;

        // Notify retry attempt
        if (onRetry) {
          onRetry(error, attempt);
        }

        this.eventEmitter.emit('retry.attempt', {
          attempt,
          delay: actualDelay,
          error: error.message
        });

        this.logger.debug(`Retry attempt ${attempt} after ${actualDelay}ms`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }

    throw lastError;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(name?: string): CircuitBreakerStats | Map<string, CircuitBreakerStats> {
    if (name) {
      const circuit = this.circuits.get(name);
      return circuit ? circuit.getStats() : this.createEmptyStats();
    }

    const allStats = new Map<string, CircuitBreakerStats>();
    for (const [name, circuit] of this.circuits) {
      allStats.set(name, circuit.getStats());
    }
    return allStats;
  }

  /**
   * Reset a circuit breaker
   */
  reset(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.reset();
      this.eventEmitter.emit('circuit.reset', { name });
    }
  }

  /**
   * Force open a circuit
   */
  forceOpen(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.forceOpen();
    }
  }

  /**
   * Force close a circuit
   */
  forceClose(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.forceClose();
    }
  }

  private createEmptyStats(): CircuitBreakerStats {
    return {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      halfOpenSuccesses: 0,
      errorRate: 0,
      avgResponseTime: 0
    };
  }
}

class CircuitBreakerInstance {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private halfOpenSuccesses = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;
  private readonly responseTimes: number[] = [];
  
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly halfOpenRequests: number;
  private readonly excludeErrors?: (error: any) => boolean;
  private readonly fallback?: (...args: any[]) => Promise<any>;
  private readonly onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.halfOpenRequests = options.halfOpenRequests || 3;
    this.excludeErrors = options.excludeErrors;
    this.fallback = options.fallback;
    this.onStateChange = options.onStateChange;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        this.eventEmitter.emit('circuit.rejected', {
          name: this.name,
          state: this.state
        });

        if (this.fallback) {
          return this.fallback();
        }

        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    // Execute operation
    const startTime = Date.now();
    
    try {
      const result = await operation();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  private onSuccess(responseTime: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;
    
    // Track response time
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // Handle half-open state
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.halfOpenRequests) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    this.eventEmitter.emit('circuit.success', {
      name: this.name,
      state: this.state,
      responseTime
    });
  }

  private onFailure(error: any, responseTime: number): void {
    // Check if error should be excluded
    if (this.excludeErrors && this.excludeErrors(error)) {
      return;
    }

    this.failures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    // Track response time even for failures
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED) {
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open state reopens the circuit
      this.transitionTo(CircuitState.OPEN);
    }

    this.eventEmitter.emit('circuit.failure', {
      name: this.name,
      state: this.state,
      error: error.message,
      consecutiveFailures: this.consecutiveFailures
    });
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.consecutiveFailures = 0;
      this.halfOpenSuccesses = 0;
    }

    this.logger.log(`Circuit ${this.name} transitioned from ${oldState} to ${newState}`);
    
    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    this.eventEmitter.emit('circuit.stateChange', {
      name: this.name,
      oldState,
      newState
    });
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== undefined && Date.now() >= this.nextAttemptTime;
  }

  getStats(): CircuitBreakerStats {
    const totalRequests = this.failures + this.successes;
    const errorRate = totalRequests > 0 ? this.failures / totalRequests : 0;
    
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      consecutiveFailures: this.consecutiveFailures,
      halfOpenSuccesses: this.halfOpenSuccesses,
      errorRate,
      avgResponseTime
    };
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.halfOpenSuccesses = 0;
    this.responseTimes.length = 0;
  }

  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }
}