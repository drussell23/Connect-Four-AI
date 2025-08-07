/**
 * 🐍 Python ML Offload Service
 * 
 * Routes inference to Python service with Metal (MPS) support
 * when Node.js memory is high or for better performance
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { MemoryPressureLevel } from './dynamic-memory-monitor';

export enum MLDevice {
  MPS = 'mps',      // Apple Metal Performance Shaders
  CUDA = 'cuda',    // NVIDIA GPU
  CPU = 'cpu'       // CPU fallback
}

export interface MLOffloadConfig {
  enabled: boolean;
  pythonServiceUrl: string;
  memoryThreshold: number;  // Offload when heap > this %
  preferredDevice: MLDevice;
  timeout: number;
  retryAttempts: number;
}

export interface InferenceRequest {
  board: number[][];
  model: string;
  device?: MLDevice;
  priority?: 'high' | 'normal' | 'low';
}

export interface InferenceResponse {
  move: number;
  confidence: number;
  device: MLDevice;
  inferenceTimeMs: number;
  modelVersion: string;
}

export interface DeviceCapabilities {
  hasMPS: boolean;
  hasCUDA: boolean;
  devicePriority: MLDevice[];
  systemInfo: {
    platform: string;
    gpuInfo?: string;
    pythonVersion: string;
    torchVersion: string;
  };
}

@Injectable()
export class PythonMLOffloadService {
  private readonly logger = new Logger('PythonMLOffload');
  private offloadConfig: MLOffloadConfig;
  private deviceCapabilities: DeviceCapabilities | null = null;
  private isOffloadEnabled = false;
  private currentMemoryPressure: MemoryPressureLevel = MemoryPressureLevel.NORMAL;
  private offloadStats = {
    totalRequests: 0,
    successfulOffloads: 0,
    failedOffloads: 0,
    avgInferenceTime: 0
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.offloadConfig = {
      enabled: this.configService.get('ML_OFFLOAD_ENABLED', true),
      pythonServiceUrl: this.configService.get('PYTHON_ML_SERVICE_URL', 'http://localhost:8000'),
      memoryThreshold: this.configService.get('ML_OFFLOAD_MEMORY_THRESHOLD', 70),
      preferredDevice: this.detectPreferredDevice(),
      timeout: this.configService.get('ML_OFFLOAD_TIMEOUT', 5000),
      retryAttempts: this.configService.get('ML_OFFLOAD_RETRIES', 2)
    };

    if (this.offloadConfig.enabled) {
      this.initializeOffloadService();
    }
  }

  /**
   * Initialize the offload service
   */
  private async initializeOffloadService(): Promise<void> {
    this.logger.log('🐍 Initializing Python ML offload service...');

    try {
      // Check Python service health
      const capabilities = await this.checkPythonServiceCapabilities();
      if (capabilities) {
        this.deviceCapabilities = capabilities;
        this.isOffloadEnabled = true;
        this.logger.log(`✅ Python ML service ready with devices: ${capabilities.devicePriority.join(', ')}`);
        
        if (capabilities.hasMPS) {
          this.logger.log('🍎 Metal Performance Shaders (MPS) available!');
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize Python ML service:', error);
      this.isOffloadEnabled = false;
    }
  }

  /**
   * Detect preferred device based on system
   */
  private detectPreferredDevice(): MLDevice {
    const config = M1PerformanceOptimizer.getOptimizationConfig();
    
    if (config.isM1Architecture) {
      return MLDevice.MPS;  // Prefer Metal on M1
    } else if (process.platform === 'linux' || process.platform === 'win32') {
      return MLDevice.CUDA;  // Try CUDA on Linux/Windows
    }
    
    return MLDevice.CPU;  // Fallback
  }

  /**
   * Check Python service capabilities
   */
  private async checkPythonServiceCapabilities(): Promise<DeviceCapabilities | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DeviceCapabilities>(
          `${this.offloadConfig.pythonServiceUrl}/device-capabilities`,
          { timeout: this.offloadConfig.timeout }
        )
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to check Python service capabilities:', error);
      return null;
    }
  }

  /**
   * Determine if we should offload based on current conditions
   */
  private shouldOffload(): boolean {
    if (!this.isOffloadEnabled || !this.deviceCapabilities) {
      return false;
    }

    // Always offload in critical memory situations
    if (this.currentMemoryPressure === MemoryPressureLevel.CRITICAL) {
      return true;
    }

    // Offload when memory is high
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    if (memStats.heapPercentage > this.offloadConfig.memoryThreshold) {
      return true;
    }

    // Offload if we have a better device available (MPS/CUDA)
    if (this.deviceCapabilities.hasMPS || this.deviceCapabilities.hasCUDA) {
      return true;
    }

    return false;
  }

  /**
   * Perform inference - either locally or offloaded
   */
  async performInference(
    board: number[][],
    localInferenceFn: () => Promise<number>
  ): Promise<{ move: number; offloaded: boolean; device?: MLDevice }> {
    // Check if we should offload
    if (!this.shouldOffload()) {
      const move = await localInferenceFn();
      return { move, offloaded: false };
    }

    // Try to offload
    try {
      const result = await this.offloadInference({
        board,
        model: 'connect4_dqn',  // Use appropriate model
        device: this.offloadConfig.preferredDevice,
        priority: this.currentMemoryPressure === MemoryPressureLevel.CRITICAL ? 'high' : 'normal'
      });

      this.offloadStats.successfulOffloads++;
      this.updateInferenceStats(result.inferenceTimeMs);

      this.logger.debug(`Offloaded inference to ${result.device} (${result.inferenceTimeMs}ms)`);

      return {
        move: result.move,
        offloaded: true,
        device: result.device
      };

    } catch (error) {
      this.logger.warn('Offload failed, falling back to local inference:', error);
      this.offloadStats.failedOffloads++;

      // Fallback to local inference
      const move = await localInferenceFn();
      return { move, offloaded: false };
    }
  }

  /**
   * Offload inference to Python service
   */
  private async offloadInference(request: InferenceRequest): Promise<InferenceResponse> {
    this.offloadStats.totalRequests++;

    let lastError: Error;
    
    // Retry logic
    for (let attempt = 0; attempt <= this.offloadConfig.retryAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<InferenceResponse>(
            `${this.offloadConfig.pythonServiceUrl}/inference`,
            request,
            {
              timeout: this.offloadConfig.timeout,
              headers: {
                'Content-Type': 'application/json',
                'X-Priority': request.priority || 'normal'
              }
            }
          )
        );

        return response.data;

      } catch (error) {
        lastError = error;
        
        if (attempt < this.offloadConfig.retryAttempts) {
          this.logger.debug(`Offload attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Update inference statistics
   */
  private updateInferenceStats(inferenceTimeMs: number): void {
    const { successfulOffloads, avgInferenceTime } = this.offloadStats;
    
    // Calculate rolling average
    this.offloadStats.avgInferenceTime = 
      (avgInferenceTime * (successfulOffloads - 1) + inferenceTimeMs) / successfulOffloads;
  }

  /**
   * Handle memory pressure changes
   */
  @OnEvent('memory.state.changed')
  handleMemoryStateChange(state: { level: MemoryPressureLevel }): void {
    this.currentMemoryPressure = state.level;
    
    // Re-initialize if needed when memory pressure drops
    if (state.level === MemoryPressureLevel.NORMAL && !this.isOffloadEnabled && this.offloadConfig.enabled) {
      this.initializeOffloadService();
    }
  }

  /**
   * Force enable offload (for emergency situations)
   */
  @OnEvent('ml.offload.force.enable')
  forceEnableOffload(): void {
    this.logger.warn('Force enabling ML offload');
    this.isOffloadEnabled = true;
  }

  /**
   * Get offload statistics
   */
  getStatistics() {
    return {
      enabled: this.isOffloadEnabled,
      config: this.offloadConfig,
      capabilities: this.deviceCapabilities,
      stats: {
        ...this.offloadStats,
        successRate: this.offloadStats.totalRequests > 0 
          ? (this.offloadStats.successfulOffloads / this.offloadStats.totalRequests * 100).toFixed(1) + '%'
          : 'N/A'
      },
      currentDevice: this.deviceCapabilities?.devicePriority[0] || 'none',
      memoryPressure: this.currentMemoryPressure
    };
  }

  /**
   * Test offload connection
   */
  async testOffloadConnection(): Promise<{ success: boolean; latencyMs: number; device: MLDevice }> {
    const start = Date.now();
    
    try {
      // Test with a simple board state
      const testBoard = Array(6).fill(null).map(() => Array(7).fill(0));
      const result = await this.offloadInference({
        board: testBoard,
        model: 'connect4_dqn',
        priority: 'low'
      });

      return {
        success: true,
        latencyMs: Date.now() - start,
        device: result.device
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        device: MLDevice.CPU
      };
    }
  }
}