/**
 * 🛡️ Graceful Degradation Service
 * 
 * Manages system degradation under pressure including
 * WebSocket rate limiting and defensive AI mode
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MemoryPressureLevel } from './dynamic-memory-monitor';

export enum DegradationLevel {
  NORMAL = 'normal',
  REDUCED = 'reduced',
  MINIMAL = 'minimal',
  EMERGENCY = 'emergency'
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  delayMs: number;
}

export interface DegradationConfig {
  normal: RateLimitConfig;
  reduced: RateLimitConfig;
  minimal: RateLimitConfig;
  emergency: RateLimitConfig;
}

export interface DefensiveAIConfig {
  maxSearchDepth: number;
  maxBranchingFactor: number;
  disableMLInference: boolean;
  useSimpleHeuristics: boolean;
  responseTimeTarget: number; // Target response time in ms
}

export interface ClientRateLimitState {
  requests: number[];
  warned: boolean;
  blocked: boolean;
  lastReset: number;
}

@Injectable()
export class GracefulDegradationService {
  private readonly logger = new Logger('GracefulDegradation');
  private currentLevel: DegradationLevel = DegradationLevel.NORMAL;
  private clientStates = new Map<string, ClientRateLimitState>();
  private defensiveMode = false;
  private degradationStartTime: number | null = null;
  
  private readonly degradationConfig: DegradationConfig = {
    normal: {
      windowMs: 1000,
      maxRequests: 10,
      delayMs: 0
    },
    reduced: {
      windowMs: 1000,
      maxRequests: 5,
      delayMs: 100
    },
    minimal: {
      windowMs: 1000,
      maxRequests: 2,
      delayMs: 500
    },
    emergency: {
      windowMs: 1000,
      maxRequests: 1,
      delayMs: 1000
    }
  };

  private defensiveAIConfig: Record<DegradationLevel, DefensiveAIConfig> = {
    [DegradationLevel.NORMAL]: {
      maxSearchDepth: 6,
      maxBranchingFactor: 7,
      disableMLInference: false,
      useSimpleHeuristics: false,
      responseTimeTarget: 200
    },
    [DegradationLevel.REDUCED]: {
      maxSearchDepth: 4,
      maxBranchingFactor: 5,
      disableMLInference: false,
      useSimpleHeuristics: false,
      responseTimeTarget: 150
    },
    [DegradationLevel.MINIMAL]: {
      maxSearchDepth: 2,
      maxBranchingFactor: 3,
      disableMLInference: true,
      useSimpleHeuristics: true,
      responseTimeTarget: 100
    },
    [DegradationLevel.EMERGENCY]: {
      maxSearchDepth: 1,
      maxBranchingFactor: 2,
      disableMLInference: true,
      useSimpleHeuristics: true,
      responseTimeTarget: 50
    }
  };

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupCleanupInterval();
    this.logger.log('Graceful Degradation Service initialized');
  }

  /**
   * Check if a client request should be rate limited
   */
  checkRateLimit(clientId: string, requestType: string = 'dropDisc'): { 
    allowed: boolean; 
    delayMs: number; 
    reason?: string 
  } {
    const now = Date.now();
    const config = this.degradationConfig[this.currentLevel];
    
    // Get or create client state
    let clientState = this.clientStates.get(clientId);
    if (!clientState) {
      clientState = {
        requests: [],
        warned: false,
        blocked: false,
        lastReset: now
      };
      this.clientStates.set(clientId, clientState);
    }

    // Clean old requests outside window
    clientState.requests = clientState.requests.filter(
      timestamp => now - timestamp < config.windowMs
    );

    // Check if over limit
    if (clientState.requests.length >= config.maxRequests) {
      if (!clientState.warned) {
        clientState.warned = true;
        this.logger.warn(`Client ${clientId} hitting rate limit (${requestType})`);
      }
      
      return {
        allowed: false,
        delayMs: config.delayMs,
        reason: `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowMs}ms`
      };
    }

    // Add request
    clientState.requests.push(now);
    
    // Apply delay based on degradation level
    if (config.delayMs > 0) {
      return {
        allowed: true,
        delayMs: config.delayMs,
        reason: `Degraded performance: ${config.delayMs}ms delay`
      };
    }

    return { allowed: true, delayMs: 0 };
  }

  /**
   * Get current defensive AI configuration
   */
  getDefensiveAIConfig(): DefensiveAIConfig {
    return this.defensiveAIConfig[this.currentLevel];
  }

  /**
   * Check if defensive mode is active
   */
  isDefensiveModeActive(): boolean {
    return this.defensiveMode;
  }

  /**
   * Set degradation level manually
   */
  setDegradationLevel(level: DegradationLevel): void {
    if (level === this.currentLevel) return;

    const previousLevel = this.currentLevel;
    this.currentLevel = level;
    
    if (level !== DegradationLevel.NORMAL) {
      this.degradationStartTime = Date.now();
      this.defensiveMode = true;
    } else {
      this.degradationStartTime = null;
      this.defensiveMode = false;
    }

    this.logger.warn(`Degradation level changed: ${previousLevel} → ${level}`);
    
    // Emit event for other services
    this.eventEmitter.emit('degradation.level.changed', {
      previousLevel,
      currentLevel: level,
      config: this.getDefensiveAIConfig()
    });
  }

  /**
   * Handle memory pressure changes
   */
  @OnEvent('memory.state.changed')
  handleMemoryStateChange(state: { level: MemoryPressureLevel }): void {
    // Map memory pressure to degradation level
    switch (state.level) {
      case MemoryPressureLevel.NORMAL:
        this.setDegradationLevel(DegradationLevel.NORMAL);
        break;
      case MemoryPressureLevel.MODERATE:
        this.setDegradationLevel(DegradationLevel.REDUCED);
        break;
      case MemoryPressureLevel.HIGH:
        this.setDegradationLevel(DegradationLevel.MINIMAL);
        break;
      case MemoryPressureLevel.CRITICAL:
        this.setDegradationLevel(DegradationLevel.EMERGENCY);
        break;
    }
  }

  /**
   * Apply defensive move selection
   */
  applyDefensiveStrategy(moves: number[], board: any[][]): number[] {
    const config = this.getDefensiveAIConfig();
    
    if (!config.useSimpleHeuristics) {
      return moves;
    }

    // In defensive mode, prioritize:
    // 1. Blocking opponent wins
    // 2. Center column control
    // 3. Defensive positions
    
    const defensiveMoves = this.prioritizeDefensiveMoves(moves, board);
    
    // Limit branching factor
    return defensiveMoves.slice(0, config.maxBranchingFactor);
  }

  /**
   * Prioritize defensive moves
   */
  private prioritizeDefensiveMoves(moves: number[], board: any[][]): number[] {
    // Simple heuristic: prioritize center columns
    const centerPriority = [3, 2, 4, 1, 5, 0, 6];
    
    return moves.sort((a, b) => {
      const aPriority = centerPriority.indexOf(a);
      const bPriority = centerPriority.indexOf(b);
      return aPriority - bPriority;
    });
  }

  /**
   * Get degradation statistics
   */
  getStatistics() {
    const degradationDuration = this.degradationStartTime 
      ? Date.now() - this.degradationStartTime 
      : 0;

    const activeClients = Array.from(this.clientStates.entries())
      .filter(([_, state]) => state.requests.length > 0)
      .length;

    const blockedClients = Array.from(this.clientStates.values())
      .filter(state => state.blocked)
      .length;

    return {
      currentLevel: this.currentLevel,
      defensiveMode: this.defensiveMode,
      degradationDurationMs: degradationDuration,
      rateLimitConfig: this.degradationConfig[this.currentLevel],
      aiConfig: this.getDefensiveAIConfig(),
      clients: {
        active: activeClients,
        blocked: blockedClients,
        total: this.clientStates.size
      }
    };
  }

  /**
   * Setup cleanup interval for old client states
   */
  private setupCleanupInterval(): void {
    // Clean up inactive clients every minute
    setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 60000; // 1 minute
      
      for (const [clientId, state] of this.clientStates.entries()) {
        const lastRequest = state.requests[state.requests.length - 1] || 0;
        if (now - lastRequest > inactiveThreshold) {
          this.clientStates.delete(clientId);
        }
      }
    }, 60000);
  }

  /**
   * Emergency stop - block all requests
   */
  emergencyStop(): void {
    this.logger.error('Emergency stop activated - blocking all requests');
    this.setDegradationLevel(DegradationLevel.EMERGENCY);
    
    // Block all existing clients
    for (const state of this.clientStates.values()) {
      state.blocked = true;
    }
  }

  /**
   * Resume normal operation
   */
  resume(): void {
    this.logger.log('Resuming normal operation');
    this.setDegradationLevel(DegradationLevel.NORMAL);
    
    // Unblock all clients
    for (const state of this.clientStates.values()) {
      state.blocked = false;
      state.warned = false;
    }
  }
}

/**
 * WebSocket interceptor for rate limiting
 */
export class WebSocketRateLimitInterceptor {
  constructor(
    private degradationService: GracefulDegradationService,
    private logger = new Logger('WebSocketRateLimit')
  ) {}

  /**
   * Intercept WebSocket message
   */
  async intercept(
    clientId: string,
    message: any,
    next: () => Promise<any>
  ): Promise<any> {
    const { allowed, delayMs, reason } = this.degradationService.checkRateLimit(
      clientId,
      message.type || 'unknown'
    );

    if (!allowed) {
      this.logger.warn(`Rate limit blocked for ${clientId}: ${reason}`);
      throw new Error(reason || 'Rate limit exceeded');
    }

    if (delayMs > 0) {
      this.logger.debug(`Applying ${delayMs}ms delay for ${clientId}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return next();
  }
}