import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { CellValue } from '../ai/connect4AI';

interface MLServiceHealth {
  available: boolean;
  lastCheck: number;
  consecutiveFailures: number;
}

@Injectable()
export class OptimizedMlClientService {
  private readonly logger = new Logger(OptimizedMlClientService.name);
  private readonly httpClient: AxiosInstance;
  
  // Connection health tracking
  private mlServiceHealth: MLServiceHealth = {
    available: false,
    lastCheck: 0,
    consecutiveFailures: 0
  };
  
  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly QUICK_TIMEOUT = 1000; // 1 second for fast checks
  private readonly NORMAL_TIMEOUT = 3000; // 3 seconds for normal requests
  
  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get('mlServiceUrl') || 'http://localhost:8000';
    
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: this.NORMAL_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    this.logger.log(`🧠 Optimized ML Client configured with base URL: ${baseUrl}`);
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  /**
   * Quick health check with short timeout
   */
  private async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.httpClient.defaults.baseURL}/health`,
        { timeout: this.QUICK_TIMEOUT }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  /**
   * Background health monitoring
   */
  private startHealthMonitoring(): void {
    // Initial check
    this.updateHealthStatus();
    
    // Periodic checks
    setInterval(() => {
      this.updateHealthStatus();
    }, this.HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * Update ML service health status
   */
  private async updateHealthStatus(): Promise<void> {
    const isHealthy = await this.checkHealth();
    const now = Date.now();
    
    if (isHealthy) {
      if (!this.mlServiceHealth.available) {
        this.logger.log('✅ ML Service is now available');
      }
      this.mlServiceHealth = {
        available: true,
        lastCheck: now,
        consecutiveFailures: 0
      };
    } else {
      this.mlServiceHealth.consecutiveFailures++;
      if (this.mlServiceHealth.available) {
        this.logger.warn('⚠️ ML Service is now unavailable');
      }
      this.mlServiceHealth = {
        available: false,
        lastCheck: now,
        consecutiveFailures: this.mlServiceHealth.consecutiveFailures
      };
    }
  }
  
  /**
   * Check if ML service should be used based on health
   */
  private shouldUseMlService(): boolean {
    // Don't use if we've had too many consecutive failures
    if (this.mlServiceHealth.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return false;
    }
    
    // If we haven't checked recently, do a quick check
    const timeSinceLastCheck = Date.now() - this.mlServiceHealth.lastCheck;
    if (timeSinceLastCheck > this.HEALTH_CHECK_INTERVAL) {
      // Don't block on health check - use last known state
      this.updateHealthStatus().catch(() => {});
    }
    
    return this.mlServiceHealth.available;
  }
  
  /**
   * Get best move with fast fallback
   */
  async getBestMove(board: CellValue[][], player: CellValue): Promise<number | null> {
    // Quick check if ML service should be used
    if (!this.shouldUseMlService()) {
      this.logger.debug('ML Service unavailable - returning null for fallback');
      return null;
    }
    
    try {
      const response = await axios.post<{ move: number }>(
        `${this.httpClient.defaults.baseURL}/predict_move`,
        { board, player },
        { timeout: this.NORMAL_TIMEOUT }
      );
      
      // Success - ensure health is marked as good
      if (this.mlServiceHealth.consecutiveFailures > 0) {
        this.mlServiceHealth.consecutiveFailures = 0;
        this.mlServiceHealth.available = true;
      }
      
      return response.data.move;
    } catch (error: any) {
      // Mark failure
      this.mlServiceHealth.consecutiveFailures++;
      if (this.mlServiceHealth.consecutiveFailures === 1) {
        this.logger.warn(`ML Service request failed: ${error.message}`);
      }
      
      // Return null to trigger fallback
      return null;
    }
  }
  
  /**
   * Get prediction with fast fallback
   */
  async getPrediction(board: CellValue[][]): Promise<{ probs: number[] } | null> {
    if (!this.shouldUseMlService()) {
      return null;
    }
    
    try {
      const response = await axios.post<{ probs: number[] }>(
        `${this.httpClient.defaults.baseURL}/predict`,
        { board },
        { timeout: this.NORMAL_TIMEOUT }
      );
      
      // Success
      if (this.mlServiceHealth.consecutiveFailures > 0) {
        this.mlServiceHealth.consecutiveFailures = 0;
        this.mlServiceHealth.available = true;
      }
      
      return response.data;
    } catch {
      this.mlServiceHealth.consecutiveFailures++;
      return null;
    }
  }
  
  /**
   * Log game results (fire and forget)
   */
  async logGame(payload: any): Promise<void> {
    if (!this.shouldUseMlService()) {
      return;
    }
    
    try {
      // Fire and forget with short timeout
      axios.post(`${this.httpClient.defaults.baseURL}/log_game`, payload, {
        timeout: this.QUICK_TIMEOUT
      }).catch(() => {}); // Ignore errors
    } catch {
      // Ignore errors for logging
    }
  }
  
  /**
   * Get current ML service status
   */
  getServiceStatus(): { available: boolean; lastCheck: Date; failures: number } {
    return {
      available: this.mlServiceHealth.available,
      lastCheck: new Date(this.mlServiceHealth.lastCheck),
      failures: this.mlServiceHealth.consecutiveFailures
    };
  }
}